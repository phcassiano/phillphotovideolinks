import AppKit
import SwiftUI

struct ContentView: View {
    @EnvironmentObject var model: AppModel
    @State private var askingSession = false
    @State private var newName = ""
    @State private var showingLog = false

    var body: some View {
        HStack(spacing: 0) {
            Sidebar(askingSession: $askingSession, showingLog: $showingLog)
                .frame(width: 290)
                .background(Palette.panel)
            Divider()
            VStack(spacing: 0) {
                Viewer()
                Filmstrip()
                    .frame(height: 112)
                    .background(Color.black)
            }
            .background(Color.black)
        }
        .background(Palette.background)
        .onReceive(NotificationCenter.default.publisher(for: .newSession)) { _ in askingSession = true }
        .alert("Nova sessão", isPresented: $askingSession) {
            TextField("Nome do cliente ou do ensaio", text: $newName)
            Button("Criar") {
                model.newSession(newName)
                newName = ""
            }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text("As fotos ficam numa pasta própria em Imagens › Revela, com o nome do ensaio.")
        }
        .sheet(isPresented: $showingLog) { DiagnosticsView() }
    }
}

// MARK: - Painel

struct Sidebar: View {
    @EnvironmentObject var model: AppModel
    @Binding var askingSession: Bool
    @Binding var showingLog: Bool
    @State private var showingHelp = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 8) {
                    Image(systemName: "camera.aperture").foregroundStyle(Palette.gold).font(.title2)
                    Text("Revela").font(.title2.weight(.semibold))
                    Spacer()
                    Text("Mac beta").font(.caption).foregroundStyle(Palette.muted)
                }
                .padding(.top, 6)

                Card(title: "Câmera", icon: "cable.connector") {
                    HStack(alignment: .top, spacing: 8) {
                        Circle().fill(model.cameraName == nil ? Color.orange : Palette.green).frame(width: 9, height: 9).padding(.top, 4)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(model.cameraName ?? "Sem câmera").font(.callout.weight(.medium))
                            Text(model.status).font(.caption).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    Button("Como conectar") { showingHelp.toggle() }
                        .buttonStyle(.link)
                        .popover(isPresented: $showingHelp, arrowEdge: .trailing) { ConnectHelp() }
                }

                Card(title: "Sessão", icon: "folder") {
                    Text(model.sessionName).font(.callout.weight(.medium))
                    Text("\(model.photos.count) foto(s) · Imagens › Revela").font(.caption).foregroundStyle(Palette.muted)
                    HStack {
                        Button("Nova sessão…") { askingSession = true }
                        Button("Abrir pasta") { NSWorkspace.shared.open(model.folder) }
                    }
                    Button("Importar fotos…") { model.importPhotos() }
                        .help("Para testar os presets com fotos que você já tem, sem a câmera")
                }

                Card(title: "Preset", icon: "camera.filters") {
                    PresetList()
                    HStack {
                        Text("Intensidade").font(.caption).foregroundStyle(Palette.muted)
                        Spacer()
                        Text("\(Int(model.amount))%").font(.caption.monospacedDigit())
                    }
                    Slider(value: $model.amount, in: 0...100, step: 5)
                        .disabled(model.presetFile == nil)
                    if let ignored = model.activePreset?.ignored, !ignored.isEmpty {
                        Text("Não reproduzido: \(ignored.joined(separator: ", "))").font(.caption2).foregroundStyle(Palette.muted)
                    }
                    Button("Importar presets…") { model.importPresets() }
                }

                Card(title: "Entregar", icon: "square.and.arrow.up") {
                    Button {
                        model.shareSelected()
                    } label: {
                        Label("Compartilhar esta foto…", systemImage: "square.and.arrow.up")
                    }
                    .disabled(model.selected == nil)
                    Button("Mostrar no Finder") { model.revealFolder() }
                        .disabled(model.selected == nil)
                    Button("Exportar todas com o preset") { model.exportAll() }
                        .disabled(model.photos.isEmpty)
                    Text("Os JPEGs editados ficam na pasta Editadas da sessão; os originais, intactos.")
                        .font(.caption2).foregroundStyle(Palette.muted)
                }

                Button {
                    showingLog = true
                } label: {
                    Label("Diagnóstico", systemImage: "ladybug")
                }
                .buttonStyle(.link)
                .foregroundStyle(Palette.muted)
            }
            .padding(14)
        }
    }
}

struct Card<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title.uppercased(), systemImage: icon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Palette.gold)
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: 12))
    }
}

struct PresetList: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            row(nil, "Sem preset")
            ForEach(model.presets) { entry in
                row(entry.file, entry.name)
                    .contextMenu {
                        Button("Remover \"\(entry.name)\"", role: .destructive) { model.removePreset(entry) }
                    }
            }
            if model.presets.isEmpty {
                Text("Importe os seus presets do Lightroom (.xmp). No Lightroom Classic: clique com o botão direito no preset › Mostrar no Finder.")
                    .font(.caption2).foregroundStyle(Palette.muted).padding(.top, 4)
            }
        }
    }

    private func row(_ file: String?, _ name: String) -> some View {
        let on = model.presetFile == file
        return Button {
            model.presetFile = file
        } label: {
            HStack {
                Image(systemName: on ? "checkmark.circle.fill" : "circle").foregroundStyle(on ? Palette.gold : Palette.muted)
                Text(name).lineLimit(1)
                Spacer()
            }
            .contentShape(Rectangle())
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
    }
}

struct ConnectHelp: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Conectar a câmera").font(.headline)
            Text("**Sony:** Menu › Rede (ou Configuração) › Conexão USB › **PC Remoto**. Em PC Remoto, escolha salvar **no PC** (ou PC+Câmera). Ligue o cabo USB-C no Mac.")
            Text("**Canon e Nikon:** é só ligar o cabo com a câmera ligada; as fotos vão para o cartão e chegam aqui na hora.")
            Text("Se não conectar: feche o Captura de Imagem, o Fotos, o Lightroom e o Imaging Edge (só um app pode usar a câmera por vez) e religue a câmera.")
                .foregroundStyle(Palette.muted)
        }
        .font(.callout)
        .frame(width: 340)
        .padding(16)
    }
}

// MARK: - Foto

struct Viewer: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        ZStack {
            Color.black
            if let image = model.showOriginal ? (model.original ?? model.display) : model.display {
                Image(nsImage: image)
                    .resizable()
                    .interpolation(.high)
                    .scaledToFit()
                    .padding(12)
            } else {
                VStack(spacing: 10) {
                    Image(systemName: "camera").font(.system(size: 44)).foregroundStyle(Palette.gold)
                    Text("Tire uma foto: ela aparece aqui com o seu preset").font(.title3)
                    Text("Ou use Arquivo › Importar fotos para testar sem a câmera.").foregroundStyle(Palette.muted)
                }
            }
            if model.selected != nil {
                VStack {
                    HStack {
                        if let photo = model.selected {
                            Text(photo.name).font(.callout.weight(.medium))
                                .padding(.horizontal, 10).padding(.vertical, 6)
                                .background(.black.opacity(0.55), in: Capsule())
                        }
                        Spacer()
                        if model.showOriginal {
                            Text("ORIGINAL").font(.caption.weight(.bold)).foregroundStyle(.black)
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(Palette.gold, in: Capsule())
                        }
                        Text("Segure \\ para ver o original")
                            .font(.caption).foregroundStyle(Palette.muted)
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .background(.black.opacity(0.55), in: Capsule())
                    }
                    Spacer()
                }
                .padding(16)
            }
        }
        .contentShape(Rectangle())
        .onLongPressGesture(minimumDuration: 0.15, maximumDistance: 50, pressing: { model.showOriginal = $0 }, perform: {})
        .focusable()
        .focusEffectDisabled()
        .onKeyPress(.leftArrow) { model.step(-1); return .handled }
        .onKeyPress(.rightArrow) { model.step(1); return .handled }
        .onKeyPress(keys: ["\\"], phases: [.down, .up]) { press in
            model.showOriginal = press.phase == .down
            return .handled
        }
    }
}

struct Filmstrip: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 8) {
                    ForEach(model.photos) { photo in
                        Button {
                            model.select(photo.id)
                        } label: {
                            ZStack {
                                Palette.card
                                if let thumb = model.thumbs[photo.id] {
                                    Image(nsImage: thumb).resizable().scaledToFill()
                                } else {
                                    ProgressView().controlSize(.small)
                                }
                            }
                            .frame(width: 120, height: 84)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(photo.id == model.selectedID ? Palette.gold : .clear, lineWidth: 2))
                        }
                        .buttonStyle(.plain)
                        .id(photo.id)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 14)
            }
            .onChange(of: model.selectedID) { _, id in
                guard let id else { return }
                withAnimation { proxy.scrollTo(id, anchor: .center) }
            }
        }
    }
}

struct DiagnosticsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var text = Log.text

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Diagnóstico").font(.headline)
            Text("Se algo não funcionar, copie e mande para o suporte.").font(.caption).foregroundStyle(Palette.muted)
            ScrollView {
                Text(text.isEmpty ? "(vazio)" : text)
                    .font(.system(.caption, design: .monospaced))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.black.opacity(0.4))
            HStack {
                Button("Atualizar") { text = Log.text }
                Button("Copiar") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(text, forType: .string)
                }
                Spacer()
                Button("Fechar") { dismiss() }.keyboardShortcut(.defaultAction)
            }
        }
        .padding(16)
        .frame(width: 640, height: 460)
    }
}
