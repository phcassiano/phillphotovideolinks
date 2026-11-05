import AppKit
import RevelaCore
import SwiftUI
import UniformTypeIdentifiers

/** Uma foto da sessão: os arquivos da câmera (RAW e/ou JPEG com o mesmo número) e o JPEG editado. */
struct Photo: Identifiable, Equatable {
    let id = UUID()
    let number: Int
    var files: [URL]
    /** JPEG pronto para entregar e com que visual ele foi feito. */
    var edited: URL?
    var editedWith: String?

    /** O que vale revelar: o RAW, se houver (mais qualidade), senão o JPEG. */
    var source: URL { files.first { PhotoFiles.isRaw($0.lastPathComponent) } ?? files[0] }
    var name: String { source.lastPathComponent }
}

struct PresetEntry: Identifiable, Hashable {
    var id: String { file }
    /** Nome do arquivo guardado na pasta de presets do app. */
    let file: String
    let name: String
    let ignored: [String]
    let preset: Preset

    static func == (a: PresetEntry, b: PresetEntry) -> Bool { a.file == b.file }
    func hash(into h: inout Hasher) { h.combine(file) }
}

/** Estado do app. Tudo aqui muda só na thread principal (os trabalhos pesados voltam por DispatchQueue.main). */
final class AppModel: ObservableObject {
    // Câmera
    @Published var cameraName: String?
    @Published var status = "Procurando a câmera…"

    // Sessão
    @Published var sessionName = "Ensaio"
    @Published private(set) var folder: URL
    @Published var photos: [Photo] = []
    @Published var selectedID: Photo.ID?

    // Tela
    @Published var display: NSImage?
    @Published var original: NSImage?
    @Published var thumbs: [Photo.ID: NSImage] = [:]
    @Published var showOriginal = false

    // Presets
    @Published var presets: [PresetEntry] = []
    @Published var presetFile: String? { didSet { lookChanged() } }
    @Published var amount: Double = 100 { didSet { lookChanged() } }

    private let camera = CameraController()
    private let work = DispatchQueue(label: "revela.revelar", qos: .userInitiated)
    private let exporter = DispatchQueue(label: "revela.exportar", qos: .utility)
    private var renderTicket = 0
    private var numbers: [String: Int] = [:]
    private var next = 1
    private var lookCache: (String, PresetLook?) = ("-", nil)

    static let displayPixels: CGFloat = 2560
    static let thumbPixels: CGFloat = 220

    init() {
        folder = AppModel.newFolder(named: "Ensaio")
        loadPresets()
        let defaults = UserDefaults.standard
        presetFile = defaults.string(forKey: "preset").flatMap { f in presets.contains { $0.file == f } ? f : nil }
        amount = defaults.object(forKey: "amount") as? Double ?? 100
        camera.onStatus = { [weak self] in self?.status = $0 }
        camera.onConnected = { [weak self] in self?.cameraName = $0 }
        camera.onDisconnected = { [weak self] reason in
            self?.cameraName = nil
            self?.status = reason.map { "Câmera desconectada (\($0)). Ligue de novo no cabo." } ?? "Câmera desconectada. Ligue de novo no cabo."
        }
        camera.onFile = { [weak self] url, name in self?.received(url, cameraName: name) }
        camera.start()
    }

    var selected: Photo? { photos.first { $0.id == selectedID } }
    var activePreset: PresetEntry? { presets.first { $0.file == presetFile } }

    // MARK: - Visual

    /** Assinatura do visual atual: o JPEG editado é refeito quando ela muda. */
    var signature: String { presetFile.map { "\($0)@\(Int(amount))" } ?? "none" }

    var look: PresetLook? {
        if lookCache.0 == signature { return lookCache.1 }
        let l = activePreset.map { PresetLook(preset: $0.preset, amount: Float(amount / 100)) }
        lookCache = (signature, l)
        return l
    }

    private func lookChanged() {
        UserDefaults.standard.set(presetFile, forKey: "preset")
        UserDefaults.standard.set(amount, forKey: "amount")
        renderSelected(resetOriginal: false)
        refreshThumbs()
    }

    // MARK: - Fotos

    /** Uma foto chegou (da câmera ou importada): vai para a pasta da sessão com o nome do ensaio. */
    func received(_ temp: URL, cameraName: String) {
        let base = (cameraName as NSString).deletingPathExtension.lowercased()
        let number = numbers[base] ?? {
            defer { next += 1 }
            numbers[base] = next
            return next
        }()
        let ext = (cameraName as NSString).pathExtension.isEmpty ? "jpg" : (cameraName as NSString).pathExtension
        let dest = folder.appendingPathComponent(PhotoFiles.fileName(prefix: PhotoFiles.prefix(sessionName), number: number, extension: ext))
        do {
            try? FileManager.default.removeItem(at: dest)
            try FileManager.default.moveItem(at: temp, to: dest)
        } catch {
            Log.add("salvar \(cameraName): \(error.localizedDescription)")
            status = "Não consegui salvar \(cameraName): \(error.localizedDescription)"
            return
        }
        if let i = photos.firstIndex(where: { $0.number == number }) {
            // RAW + JPEG da mesma foto: um item só, revelado a partir do RAW.
            photos[i].files.append(dest)
            photos[i].editedWith = nil
            if photos[i].id == selectedID { renderSelected(resetOriginal: true) }
            makeThumb(photos[i])
            develop(photos[i])
        } else {
            let photo = Photo(number: number, files: [dest])
            photos.append(photo)
            select(photo.id)
            makeThumb(photo)
            develop(photo)
        }
        status = "\(dest.lastPathComponent) recebida"
    }

    func importPhotos() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = false
        panel.allowedContentTypes = [.image, .rawImage]
        panel.message = "Escolha fotos para revelar com o preset (sem câmera)"
        guard panel.runModal() == .OK else { return }
        for url in panel.urls {
            let temp = camera.downloads.appendingPathComponent("\(UUID().uuidString)-\(url.lastPathComponent)")
            do {
                try FileManager.default.copyItem(at: url, to: temp)
                received(temp, cameraName: url.lastPathComponent)
            } catch {
                status = "Não consegui importar \(url.lastPathComponent)"
            }
        }
    }

    func select(_ id: Photo.ID?) {
        selectedID = id
        showOriginal = false
        renderSelected(resetOriginal: true)
    }

    func step(_ delta: Int) {
        guard !photos.isEmpty else { return }
        let i = photos.firstIndex { $0.id == selectedID } ?? 0
        select(photos[min(max(i + delta, 0), photos.count - 1)].id)
    }

    private func renderSelected(resetOriginal: Bool) {
        guard let photo = selected else {
            display = nil
            original = nil
            return
        }
        renderTicket += 1
        let ticket = renderTicket
        let look = self.look
        let url = photo.source
        work.async {
            let shown = Renderer.shared.image(url, look: look, maxPixels: AppModel.displayPixels)
            let plain = resetOriginal || look == nil ? Renderer.shared.image(url, look: nil, maxPixels: AppModel.displayPixels) : nil
            DispatchQueue.main.async {
                guard ticket == self.renderTicket else { return }
                self.display = shown
                if let plain { self.original = plain }
                if shown == nil { self.status = "Não consegui abrir \(url.lastPathComponent)" }
            }
        }
    }

    private func makeThumb(_ photo: Photo) {
        let look = self.look
        work.async {
            let image = Renderer.shared.image(photo.source, look: look, maxPixels: AppModel.thumbPixels)
            DispatchQueue.main.async { self.thumbs[photo.id] = image }
        }
    }

    private func refreshThumbs() { photos.forEach(makeThumb) }

    /** Gera o JPEG editado (resolução cheia) em segundo plano, se houver preset. */
    private func develop(_ photo: Photo) {
        guard let look else { return }
        let signature = self.signature
        let dir = folder.appendingPathComponent("Editadas", isDirectory: true)
        exporter.async {
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let dest = dir.appendingPathComponent((photo.name as NSString).deletingPathExtension + ".jpg")
            do {
                try Renderer.shared.exportJPEG(photo.source, look: look, to: dest)
                DispatchQueue.main.async {
                    guard let i = self.photos.firstIndex(where: { $0.id == photo.id }) else { return }
                    self.photos[i].edited = dest
                    self.photos[i].editedWith = signature
                }
            } catch {
                Log.add("exportar \(photo.name): \(error.localizedDescription)")
            }
        }
    }

    /** Arquivo para entregar com o visual atual: o JPEG editado (refeito se mudou) ou o original. */
    func deliverable(_ photo: Photo) -> URL {
        guard let look else { return photo.files.first { !PhotoFiles.isRaw($0.lastPathComponent) } ?? photo.source }
        if let edited = photo.edited, photo.editedWith == signature, FileManager.default.fileExists(atPath: edited.path) { return edited }
        let dir = folder.appendingPathComponent("Editadas", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let dest = dir.appendingPathComponent((photo.name as NSString).deletingPathExtension + ".jpg")
        do {
            try Renderer.shared.exportJPEG(photo.source, look: look, to: dest)
            if let i = photos.firstIndex(where: { $0.id == photo.id }) {
                photos[i].edited = dest
                photos[i].editedWith = signature
            }
            return dest
        } catch {
            status = error.localizedDescription
            return photo.source
        }
    }

    /** Refaz todas as editadas com o visual atual e abre a pasta. */
    func exportAll() {
        let list = photos
        let total = list.count
        guard total > 0 else { return }
        status = "Exportando \(total) foto(s)…"
        Task { @MainActor in
            for (i, photo) in list.enumerated() {
                _ = deliverable(photo)
                status = "Exportando \(i + 1) de \(total)…"
                await Task.yield()
            }
            status = "\(total) foto(s) prontas em Editadas"
            NSWorkspace.shared.activateFileViewerSelecting([folder.appendingPathComponent(look == nil ? "" : "Editadas")])
        }
    }

    /** AirDrop, Mensagens, Mail… com o JPEG editado da foto da tela. */
    func shareSelected() {
        guard let photo = selected, let view = NSApp.keyWindow?.contentView else { return }
        let picker = NSSharingServicePicker(items: [deliverable(photo)])
        picker.show(relativeTo: NSRect(x: 150, y: 60, width: 1, height: 1), of: view, preferredEdge: .maxY)
    }

    func revealFolder() {
        NSWorkspace.shared.activateFileViewerSelecting([selected.map { deliverable($0) } ?? folder])
    }

    // MARK: - Sessão

    func newSession(_ name: String) {
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        sessionName = clean.isEmpty ? "Ensaio" : clean
        folder = AppModel.newFolder(named: sessionName)
        photos = []
        thumbs = [:]
        numbers = [:]
        next = 1
        select(nil)
        status = "Sessão \"\(sessionName)\": fotos em Imagens › Revela"
    }

    /** Imagens/Revela/2026-11-05 Maria (com número se já existir). */
    static func newFolder(named name: String) -> URL {
        let root = FileManager.default.urls(for: .picturesDirectory, in: .userDomainMask)[0].appendingPathComponent("Revela", isDirectory: true)
        let day = Date().formatted(.iso8601.year().month().day())
        let safe = name.replacingOccurrences(of: "/", with: "-").replacingOccurrences(of: ":", with: "-")
        var url = root.appendingPathComponent("\(day) \(safe)", isDirectory: true)
        var n = 2
        while FileManager.default.fileExists(atPath: url.path),
              let items = try? FileManager.default.contentsOfDirectory(atPath: url.path), !items.isEmpty {
            url = root.appendingPathComponent("\(day) \(safe) \(n)", isDirectory: true)
            n += 1
        }
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    // MARK: - Presets

    private static var presetDir: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Revela/Presets", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private func loadPresets() {
        let files = (try? FileManager.default.contentsOfDirectory(at: AppModel.presetDir, includingPropertiesForKeys: nil)) ?? []
        presets = files.compactMap { url in
            guard let data = try? Data(contentsOf: url), let p = Preset.parse(fileName: url.lastPathComponent, data: data) else { return nil }
            return PresetEntry(file: url.lastPathComponent, name: p.name, ignored: p.ignored, preset: p)
        }.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    func importPresets() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = true
        panel.message = "Escolha presets do Lightroom (.xmp, .lrtemplate ou .dng) ou uma pasta com eles"
        guard panel.runModal() == .OK else { return }
        var urls: [URL] = []
        for url in panel.urls {
            if (try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true,
               let e = FileManager.default.enumerator(at: url, includingPropertiesForKeys: nil) {
                urls += e.compactMap { $0 as? URL }
            } else {
                urls.append(url)
            }
        }
        var added = 0, rejected = 0
        var last: String?
        for url in urls where ["xmp", "lrtemplate", "dng"].contains(url.pathExtension.lowercased()) {
            guard let data = try? Data(contentsOf: url), Preset.parse(fileName: url.lastPathComponent, data: data) != nil else {
                rejected += 1
                continue
            }
            let name = "\(abs(url.path.hashValue) % 100_000)-\(url.lastPathComponent)"
            try? data.write(to: AppModel.presetDir.appendingPathComponent(name))
            last = name
            added += 1
        }
        loadPresets()
        if let last { presetFile = last }
        status = added == 0 ? "Nenhum preset do Lightroom nesses arquivos." :
            "\(added) preset(s) importado(s)" + (rejected > 0 ? "; \(rejected) arquivo(s) não eram presets" : "")
    }

    func removePreset(_ entry: PresetEntry) {
        try? FileManager.default.removeItem(at: AppModel.presetDir.appendingPathComponent(entry.file))
        if presetFile == entry.file { presetFile = nil }
        loadPresets()
    }
}
