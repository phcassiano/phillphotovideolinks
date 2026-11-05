import Foundation
import ImageCaptureCore
import RevelaCore

/**
 * Acha a câmera no USB e recebe cada foto assim que ela é tirada, pelo ImageCaptureCore (o mesmo
 * sistema do app Captura de Imagem do macOS).
 *
 * - Sony no modo "PC Remoto": a foto não vai para o cartão; o app pede pelo protocolo da Sony
 *   ([SonyLink]), com comandos PTP enviados pelo macOS.
 * - Canon, Nikon e outras: a foto vai para o cartão e o macOS avisa que apareceu um arquivo novo.
 *
 * Os avisos chegam na thread principal.
 */
final class CameraController: NSObject, ICDeviceBrowserDelegate, ICCameraDeviceDelegate {
    var onStatus: (String) -> Void = { _ in }
    var onConnected: (String) -> Void = { _ in }
    var onDisconnected: (String?) -> Void = { _ in }
    /** Arquivo recebido numa pasta temporária, com o nome que tinha na câmera. */
    var onFile: (URL, String) -> Void = { _, _ in }

    private let browser = ICDeviceBrowser()
    private var camera: ICCameraDevice?
    private var sony: SonyLink?
    /** Arquivos que já estavam no cartão ao conectar: não são fotos novas. */
    private var known = Set<String>()
    private var catalogReady = false

    let downloads: URL = {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("Revela-recebendo", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    func start() {
        browser.delegate = self
        browser.browsedDeviceTypeMask = ICDeviceTypeMask(rawValue: ICDeviceTypeMask.camera.rawValue | ICDeviceLocationTypeMask.local.rawValue)
        browser.start()
        Log.add("procurando câmeras no USB")
        onStatus("Ligue a câmera no cabo USB")
    }

    // MARK: ICDeviceBrowserDelegate

    func deviceBrowser(_ browser: ICDeviceBrowser, didAdd device: ICDevice, moreComing: Bool) {
        guard camera == nil, let cam = device as? ICCameraDevice else { return }
        Log.add("câmera encontrada: \(cam.name ?? "?") (USB \(String(format: "%04X:%04X", cam.usbVendorID, cam.usbProductID)))")
        camera = cam
        known = []
        catalogReady = false
        cam.delegate = self
        onStatus("Conectando à \(cam.name ?? "câmera")…")
        cam.requestOpenSession()
    }

    func deviceBrowser(_ browser: ICDeviceBrowser, didRemove device: ICDevice, moreGoing: Bool) {
        if device === camera { lost(nil) }
    }

    // MARK: ICDeviceDelegate

    func didRemove(_ device: ICDevice) {
        if device === camera { lost(nil) }
    }

    func device(_ device: ICDevice, didOpenSessionWithError error: Error?) {
        guard let cam = camera, device === cam else { return }
        if let error {
            Log.add("abrir sessão: \(error.localizedDescription)")
            onStatus("A câmera não aceitou a conexão. Feche o Captura de Imagem, o Fotos e o Imaging Edge e religue a câmera.")
            return
        }
        Log.add("sessão aberta; recursos: \(cam.capabilities.joined(separator: ", "))")
        if cam.usbVendorID == SonyProtocol.usbVendor {
            let link = SonyLink(camera: cam)
            link.onStatus = { [weak self] in self?.onStatus($0) }
            link.onConnected = { [weak self] in self?.onConnected(cam.name ?? "Sony") }
            link.onFile = { [weak self] url, name in self?.onFile(url, name) }
            link.onFailed = { [weak self] reason in self?.lost(reason) }
            sony = link
            link.start(downloads: downloads)
        } else {
            onStatus("Lendo o cartão da \(cam.name ?? "câmera")…")
        }
    }

    func device(_ device: ICDevice, didCloseSessionWithError error: Error?) {
        if device === camera { lost(error?.localizedDescription) }
    }

    func device(_ device: ICDevice, didEncounterError error: Error?) {
        Log.add("erro da câmera: \(error?.localizedDescription ?? "?")")
    }

    // MARK: ICCameraDeviceDelegate

    func deviceDidBecomeReady(withCompleteContentCatalog device: ICCameraDevice) {
        guard device === camera else { return }
        if !catalogReady {
            catalogReady = true
            known.formUnion(device.mediaFiles?.compactMap { ($0 as? ICCameraFile).map(key) } ?? [])
            Log.add("cartão lido: \(known.count) arquivo(s) que já estavam lá")
        }
        if sony == nil {
            onConnected(device.name ?? "Câmera")
            onStatus("Pronto: cada foto tirada aparece aqui")
        }
    }

    func cameraDevice(_ camera: ICCameraDevice, didAdd items: [ICCameraItem]) {
        guard camera === self.camera, sony == nil else { return }
        for item in items {
            guard let file = item as? ICCameraFile, let name = file.name, PhotoFiles.isPhoto(name) else { continue }
            if !catalogReady {
                known.insert(key(file))
                continue
            }
            guard known.insert(key(file)).inserted else { continue }
            download(file)
        }
    }

    func cameraDevice(_ camera: ICCameraDevice, didRemove items: [ICCameraItem]) {}
    func cameraDevice(_ camera: ICCameraDevice, didReceiveThumbnail thumbnail: CGImage?, for item: ICCameraItem, error: Error?) {}
    func cameraDevice(_ camera: ICCameraDevice, didReceiveMetadata metadata: [AnyHashable: Any]?, for item: ICCameraItem, error: Error?) {}
    func cameraDevice(_ camera: ICCameraDevice, didRenameItems items: [ICCameraItem]) {}
    func cameraDeviceDidChangeCapability(_ camera: ICCameraDevice) {}
    func cameraDevice(_ camera: ICCameraDevice, didReceivePTPEvent eventData: Data) {}
    func cameraDeviceDidRemoveAccessRestriction(_ device: ICDevice) {}
    func cameraDeviceDidEnableAccessRestriction(_ device: ICDevice) {
        Log.add("a câmera bloqueou o acesso (cartão protegido ou câmera ocupada)")
    }

    // MARK: -

    private func key(_ file: ICCameraFile) -> String {
        "\(file.parentFolder?.name ?? "")/\(file.name ?? "")/\(file.fileSize)"
    }

    private func download(_ file: ICCameraFile) {
        let name = file.name ?? "foto.jpg"
        Log.add("foto nova no cartão: \(name)")
        onStatus("Recebendo \(name)…")
        let dir = downloads.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let options: [ICDownloadOption: Any] = [.downloadsDirectoryURL: dir, .overwrite: true]
        file.requestDownload(options: options) { [weak self] saved, error in
            DispatchQueue.main.async {
                if let error {
                    Log.add("baixar \(name): \(error.localizedDescription)")
                    self?.onStatus("Não consegui baixar \(name)")
                    return
                }
                self?.onFile(dir.appendingPathComponent(saved ?? name), name)
            }
        }
    }

    private func lost(_ reason: String?) {
        guard camera != nil else { return }
        Log.add("câmera desconectada\(reason.map { ": \($0)" } ?? "")")
        sony?.stop()
        sony = nil
        camera = nil
        onDisconnected(reason)
    }
}

/**
 * Conversa com a Sony no modo PC Remoto por comandos PTP que o macOS repassa à câmera.
 * Roda numa thread própria; cada comando espera a resposta (o macOS responde em outra fila).
 */
final class SonyLink {
    var onStatus: (String) -> Void = { _ in }
    var onConnected: () -> Void = {}
    var onFile: (URL, String) -> Void = { _, _ in }
    var onFailed: (String) -> Void = { _ in }

    private let camera: ICCameraDevice
    private var transaction: UInt32 = 0x1000
    private var running = true

    init(camera: ICCameraDevice) { self.camera = camera }

    func stop() { running = false }

    func start(downloads: URL) {
        Thread { [weak self] in self?.run(downloads: downloads) }.start()
    }

    private func main(_ block: @escaping () -> Void) { DispatchQueue.main.async { if self.running { block() } } }

    private func run(downloads: URL) {
        do {
            main { self.onStatus("Conectando à Sony (PC Remoto)…") }
            try connect()
            main { self.onConnected(); self.onStatus("Pronto: cada foto tirada aparece aqui") }
            var failures = 0
            while running {
                Thread.sleep(forTimeInterval: 0.4)
                do {
                    try poll(downloads: downloads)
                    failures = 0
                } catch {
                    failures += 1
                    Log.add("sony: \(error)")
                    if failures >= 5 { throw error }
                }
            }
        } catch {
            let reason = "\(error)"
            Log.add("sony: conexão encerrada: \(reason)")
            DispatchQueue.main.async { if self.running { self.onFailed(reason) } }
        }
    }

    private func connect() throws {
        try expectOk("Conectar (etapa 1)", send(SonyProtocol.ocSdioConnect, [1, 0, 0]))
        try expectOk("Conectar (etapa 2)", send(SonyProtocol.ocSdioConnect, [2, 0, 0]))
        var version: UInt16?
        for v: UInt32 in [300, 200] {
            let r = send(SonyProtocol.ocSdioGetExtDeviceInfo, [v])
            if r.response?.ok == true, r.data.count >= 2 { version = try? PtpReader(r.data).u16(); break }
        }
        guard let version else { throw PtpError("A câmera não aceitou o modo PC Remoto da Sony. Confira: Menu → Rede/USB → Conexão USB → PC Remoto.") }
        Log.add("sony: protocolo \(version)")
        try expectOk("Conectar (etapa 3)", send(SonyProtocol.ocSdioConnect, [3, 0, 0]))
        // A câmera leva alguns instantes para liberar os ajustes depois do aperto de mão.
        for _ in 0..<40 {
            if let props = try readProps(), !props.isEmpty {
                Log.add("sony: \(props.count) ajustes")
                return
            }
            Thread.sleep(forTimeInterval: 0.25)
        }
        throw PtpError("A câmera não respondeu. Confira se ela está no modo PC Remoto.")
    }

    /** nil se a câmera está ocupada. */
    private func readProps() throws -> [Int: SonyProtocol.Prop]? {
        let r = send(SonyProtocol.ocGetAllPropData)
        if r.response?.code == Ptp.rcDeviceBusy { return nil }
        try expectOk("Ler ajustes", r)
        return SonyProtocol.parseAllProps(r.data)
    }

    private func poll(downloads: URL) throws {
        var count = 0
        while running, count < 10, let props = try readProps(), SonyProtocol.hasPendingShot(props) {
            count += 1
            let info = send(Ptp.ocGetObjectInfo, [SonyProtocol.handleShot])
            try expectOk("Ler foto", info)
            let name = Ptp.objectName(info.data) ?? "DSC_\(Int(Date().timeIntervalSince1970)).JPG"
            main { self.onStatus("Recebendo \(name)…") }
            let obj = send(Ptp.ocGetObject, [SonyProtocol.handleShot], timeout: 90)
            try expectOk("Baixar foto", obj)
            let url = downloads.appendingPathComponent("\(UUID().uuidString)-\(name)")
            try obj.data.write(to: url)
            Log.add("sony: \(name), \(obj.data.count) bytes")
            main { self.onFile(url, name) }
        }
    }

    private struct Result {
        let response: Ptp.Response?
        let data: Data
        let error: Error?
    }

    private func send(_ code: UInt16, _ params: [UInt32] = [], timeout: TimeInterval = 20) -> Result {
        transaction &+= 1
        let command = Ptp.command(code, transaction: transaction, params: params)
        let done = DispatchSemaphore(value: 0)
        var result = Result(response: nil, data: Data(), error: PtpError("sem resposta"))
        camera.requestSendPTPCommand(command, outData: nil) { data, response, error in
            result = Result(response: Ptp.response(response), data: Ptp.payload(data, code: code), error: error)
            done.signal()
        }
        if done.wait(timeout: .now() + timeout) == .timedOut {
            return Result(response: nil, data: Data(), error: PtpError("A câmera não respondeu pelo USB"))
        }
        return result
    }

    private func expectOk(_ what: String, _ r: Result) throws {
        if let error = r.error { throw PtpError("\(what): \(error.localizedDescription)") }
        guard let response = r.response else { throw PtpError("\(what): resposta inválida da câmera") }
        if !response.ok { throw PtpError(String(format: "%@: a câmera respondeu 0x%04X", what, response.code)) }
    }
}

/** Registro para o Diagnóstico (copiável), também no Console do macOS. */
enum Log {
    private static let queue = DispatchQueue(label: "revela.log")
    private static var lines: [String] = []

    static func add(_ text: String) {
        let stamp = Date().formatted(date: .omitted, time: .standard)
        queue.sync {
            lines.append("\(stamp)  \(text)")
            if lines.count > 400 { lines.removeFirst(lines.count - 400) }
        }
        NSLog("Revela: %@", text)
    }

    static var text: String { queue.sync { lines.joined(separator: "\n") } }
}
