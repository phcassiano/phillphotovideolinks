import SwiftUI
import AppKit

// MARK: - Peças comuns

struct SectionTitle: View {
    let text: String
    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10, weight: .bold))
            .foregroundColor(.secondary)
    }
}

struct Card<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.white.opacity(0.05)))
    }
}

/// Mini gráfico de linha.
struct Sparkline: View {
    let values: [Double]
    let color: Color
    var body: some View {
        GeometryReader { geo in
            Path { p in
                guard values.count > 1 else { return }
                let w = geo.size.width, h = geo.size.height
                for (i, v) in values.enumerated() {
                    let pt = CGPoint(x: w * CGFloat(i) / CGFloat(values.count - 1),
                                     y: h - h * CGFloat(min(1, max(0, v))))
                    if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
                }
            }
            .stroke(color, style: StrokeStyle(lineWidth: 1.5, lineJoin: .round))
        }
    }
}

struct RingView: View {
    let value: Double
    let color: Color
    let label: String
    var sub: String = ""
    var body: some View {
        ZStack {
            Circle().stroke(Color.white.opacity(0.1), lineWidth: 8)
            Circle()
                .trim(from: 0, to: min(1, max(0, value)))
                .stroke(color, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeOut(duration: 0.4), value: value)
            VStack(spacing: 0) {
                Text(label).font(.system(size: 22, weight: .bold, design: .rounded))
                if !sub.isEmpty { Text(sub).font(.system(size: 9)).foregroundColor(.secondary) }
            }
        }
    }
}

func scoreColor(_ s: Int) -> Color {
    s >= 80 ? .green : (s >= 60 ? .yellow : .orange)
}

// MARK: - Meu Mac (monitor ao vivo + nota + Boost)

struct MyMacTab: View {
    @ObservedObject var state: AppState
    @ObservedObject var tools: MacTools
    let assistant: Assistant

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                monitor
                scoreCard
                if state.scanProgress != nil { scanning }
                if !state.report.isEmpty && state.scanProgress == nil { report }
                if !tools.topApps.isEmpty { topApps }
            }
        }
        .onAppear { tools.refreshTopApps() }
    }

    private var monitor: some View {
        VStack(alignment: .leading, spacing: 6) {
            SectionTitle(text: "Ao vivo")
            HStack(spacing: 8) {
                metric("CPU", "\(Int((tools.cpu * 100).rounded()))%", "cpu", tools.cpuHistory)
                metric("Memória", "\(tools.memPercent)%", "memorychip", tools.memHistory)
                metric("GPU", tools.gpu.map { "\($0)%" } ?? "—", "cube", [])
            }
            HStack(spacing: 8) {
                metric("Rede ↓ / ↑", "\(Self.speed(tools.netIn)) / \(Self.speed(tools.netOut))", "network", [])
                metric("Temperatura", tools.thermalText + (tools.battery?.temperature.map { String(format: " · bat. %.0f°C", $0) } ?? ""),
                       "thermometer.medium", [])
            }
        }
    }

    private func metric(_ title: String, _ value: String, _ icon: String, _ history: [Double]) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 4) {
                Label(title, systemImage: icon)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(state.accent)
                Text(value)
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                if history.count > 1 {
                    Sparkline(values: history, color: state.accent).frame(height: 20)
                }
            }
        }
    }

    private var scoreCard: some View {
        Card {
            HStack(spacing: 16) {
                RingView(value: Double(state.score ?? 0) / 100, color: scoreColor(state.score ?? 0),
                         label: state.score.map { "\($0)" } ?? "?", sub: "nota")
                    .frame(width: 84, height: 84)
                VStack(alignment: .leading, spacing: 6) {
                    Text(state.score == nil ? "Qual a nota do seu Mac?" : "Nota do seu Mac")
                        .font(.system(size: 14, weight: .bold))
                    Text("Memória, disco, caches, lixeira, inicialização, bateria e temperatura viram uma nota de 0 a 100.")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                    HStack {
                        Button("Verificar") { _ = assistant.actions.run(.checkMac) }
                        Button("⚡ Boost") { _ = assistant.actions.run(.boost) }
                            .help("Limpa caches seguros e logs, depois verifica de novo")
                        Button("Monitor de Atividade") { _ = assistant.actions.run(.openApp("activity monitor")) }
                    }
                    .disabled(state.scanProgress != nil)
                }
            }
        }
    }

    private var scanning: some View {
        Card {
            HStack(spacing: 16) {
                RingView(value: state.scanProgress ?? 0, color: state.accent,
                         label: "\(Int((state.scanProgress ?? 0) * 100))%")
                    .frame(width: 70, height: 70)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Verificando seu Mac…").font(.system(size: 13, weight: .bold))
                    ForEach(state.scanSteps) { s in
                        HStack(spacing: 6) {
                            Image(systemName: s.done ? "checkmark.circle.fill" : "circle.dotted")
                                .foregroundColor(s.done ? state.accent : .secondary)
                            Text(s.title).font(.system(size: 11)).foregroundColor(s.done ? .white : .secondary)
                        }
                    }
                }
            }
        }
    }

    private var report: some View {
        VStack(alignment: .leading, spacing: 6) {
            SectionTitle(text: "Resultado")
            ForEach(state.report) { line in
                HStack(spacing: 10) {
                    Image(systemName: line.icon)
                        .foregroundColor(line.warn ? .orange : state.accent)
                        .frame(width: 20)
                    Text(line.title).font(.system(size: 12, weight: .semibold))
                    Spacer()
                    Text(line.value)
                        .font(.system(size: 12))
                        .foregroundColor(line.warn ? .orange : .secondary)
                        .lineLimit(1)
                    if line.warn { Image(systemName: "exclamationmark.triangle.fill").foregroundColor(.orange) }
                }
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.05)))
            }
        }
    }

    private var topApps: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                SectionTitle(text: "Quem mais usa o processador agora")
                Spacer()
                Button {
                    tools.refreshTopApps()
                } label: { Image(systemName: "arrow.clockwise") }
                .buttonStyle(.plain)
            }
            ForEach(tools.topApps.prefix(5)) { p in
                HStack {
                    Text(p.name).font(.system(size: 12)).lineLimit(1)
                    Spacer()
                    Text(String(format: "%.0f%%", p.value)).font(.system(size: 12, weight: .semibold))
                }
            }
        }
    }

    static func speed(_ bytesPerSec: Double) -> String {
        if bytesPerSec < 1024 { return "0 KB/s" }
        if bytesPerSec < 1024 * 1024 { return String(format: "%.0f KB/s", bytesPerSec / 1024) }
        return String(format: "%.1f MB/s", bytesPerSec / 1024 / 1024)
    }
}

// MARK: - Bateria e energia

struct BatteryTab: View {
    @ObservedObject var state: AppState
    @ObservedObject var tools: MacTools
    @AppStorage("chargeAlert") private var chargeAlert = true
    @AppStorage("chargeLimit") private var chargeLimit = 80

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if let b = tools.battery {
                    overview(b)
                    details(b)
                } else {
                    Card { Text("Este Mac não tem bateria (ou não consegui ler).").foregroundColor(.secondary) }
                }
                limit
                caffeine
            }
        }
    }

    private func overview(_ b: BatteryInfo) -> some View {
        Card {
            HStack(spacing: 18) {
                RingView(value: Double(b.percent) / 100, color: b.percent <= 20 ? .orange : state.accent,
                         label: "\(b.percent)%", sub: b.statusText.lowercased())
                    .frame(width: 96, height: 96)
                VStack(alignment: .leading, spacing: 6) {
                    Text("Saúde da bateria").font(.system(size: 11)).foregroundColor(.secondary)
                    Text(b.health > 0 ? "\(b.health)%" : "—")
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundColor(b.health >= 80 || b.health == 0 ? .white : .orange)
                    Text(healthText(b)).font(.system(size: 11)).foregroundColor(.secondary)
                }
            }
        }
    }

    private func healthText(_ b: BatteryInfo) -> String {
        if b.health == 0 { return "" }
        if b.health >= 90 { return "Excelente, quase como nova." }
        if b.health >= 80 { return "Boa. A Apple considera normal acima de 80%." }
        return "Abaixo de 80%: vale considerar a troca."
    }

    private func details(_ b: BatteryInfo) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
            info("Ciclos", "\(b.cycles)", "arrow.triangle.2.circlepath")
            info("Capacidade", b.maxCapacity > 0 ? "\(b.maxCapacity) / \(b.designCapacity) mAh" : "—", "battery.100")
            info("Temperatura", b.temperature.map { String(format: "%.1f °C", $0) } ?? "—", "thermometer.medium")
            info("Potência", b.watts.map { String(format: "%.1f W", $0) } ?? "—", "bolt")
            info("Tempo restante", b.minutesLeft.map { Fmt.countdown(Double($0 * 60)) } ?? "—", "clock")
            info("Estado", b.statusText, b.plugged ? "powerplug" : "battery.50")
        }
    }

    private func info(_ title: String, _ value: String, _ icon: String) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 3) {
                Label(title, systemImage: icon).font(.system(size: 10)).foregroundColor(.secondary)
                Text(value).font(.system(size: 13, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.7)
            }
        }
    }

    private var limit: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                Toggle(isOn: $chargeAlert) {
                    Text("Avisar quando a carga chegar em \(chargeLimit)%").font(.system(size: 13, weight: .semibold))
                }
                Slider(value: Binding(get: { Double(chargeLimit) }, set: { chargeLimit = Int($0) }), in: 50...100, step: 5)
                    .tint(state.accent)
                Text("Ficar horas em 100% na tomada envelhece a bateria. A Sexta-feira avisa (com voz e notificação) para você tirar da tomada no limite. Ative também Ajustes do Sistema › Bateria › Carregamento otimizado.")
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
            }
        }
    }

    private var caffeine: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: tools.caffeineOn ? "cup.and.saucer.fill" : "cup.and.saucer")
                        .foregroundColor(tools.caffeineOn ? state.accent : .secondary)
                    Text("Cafeína: manter o Mac acordado").font(.system(size: 13, weight: .semibold))
                    Spacer()
                    if tools.caffeineOn {
                        Text(tools.caffeineUntil.map { "até \(Fmt.time($0))" } ?? "ligada")
                            .font(.system(size: 11)).foregroundColor(state.accent)
                    }
                }
                HStack {
                    Button("30 min") { tools.setCaffeine(minutes: 30) }
                    Button("1 hora") { tools.setCaffeine(minutes: 60) }
                    Button("2 horas") { tools.setCaffeine(minutes: 120) }
                    Button("Sempre") { tools.setCaffeine(minutes: nil) }
                    if tools.caffeineOn { Button("Desligar") { tools.stopCaffeine() } }
                }
            }
        }
    }
}

// MARK: - Limpeza e desinstalador

struct CleanupTab: View {
    @ObservedObject var state: AppState
    @ObservedObject var tools: MacTools
    @State private var mode = 0
    @State private var items: [CleanItem] = []
    @State private var scanning = false
    @State private var trash: Int64?
    @State private var message = ""
    @State private var apps: [AppEntry] = []
    @State private var search = ""
    @State private var chosen: AppEntry?
    @State private var leftovers: [Leftover] = []

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Picker("", selection: $mode) {
                Text("Limpar disco").tag(0)
                Text("Desinstalar apps").tag(1)
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            if mode == 0 { cleaner } else { uninstaller }
        }
    }

    // MARK: limpeza

    private var cleaner: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Button(scanning ? "Procurando…" : "Procurar o que limpar", action: scan).disabled(scanning)
                if !items.isEmpty {
                    Button("Limpar \(MacInfo.bytes(selectedTotal))", action: clean)
                        .disabled(selectedTotal == 0)
                }
                Spacer()
                Button("Esvaziar lixeira\(trash.map { " (\(MacInfo.bytes($0)))" } ?? "")") {
                    MacChecker.emptyTrash()
                    after(2) { refreshTrash() }
                }
            }
            if !message.isEmpty {
                Text(message).font(.system(size: 11)).foregroundColor(state.accent)
            }
            if items.isEmpty && !scanning {
                Spacer()
                Text("Mostro os caches e logs que dá para apagar com segurança. Caches da Apple ficam de fora.")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                Spacer()
            } else {
                ScrollView {
                    VStack(spacing: 4) {
                        ForEach($items) { $item in
                            HStack(spacing: 10) {
                                Toggle("", isOn: $item.selected).labelsHidden()
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(item.name).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                                    Text(item.note).font(.system(size: 10))
                                        .foregroundColor(item.safe ? .secondary : .orange)
                                }
                                Spacer()
                                Text(MacInfo.bytes(item.size)).font(.system(size: 12, weight: .semibold))
                            }
                            .padding(8)
                            .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.05)))
                        }
                    }
                }
            }
        }
        .onAppear(perform: refreshTrash)
    }

    private var selectedTotal: Int64 { items.filter { $0.selected }.reduce(0) { $0 + $1.size } }

    private func refreshTrash() {
        Task { @MainActor in trash = await Task.detached { Cleaner.trashSize() }.value }
    }

    private func scan() {
        scanning = true
        message = ""
        let running = Set(NSWorkspace.shared.runningApplications.compactMap { $0.bundleIdentifier?.lowercased() })
        Task { @MainActor in
            items = await Task.detached { Cleaner.scan(running: running) }.value
            scanning = false
            if items.isEmpty { message = "Tudo limpo por aqui ✨" }
        }
    }

    private func clean() {
        let chosenItems = items.filter { $0.selected }
        let alert = NSAlert()
        alert.messageText = "Apagar \(MacInfo.bytes(selectedTotal))?"
        alert.informativeText = "Caches e logs são recriados pelos apps quando precisarem."
        alert.addButton(withTitle: "Limpar")
        alert.addButton(withTitle: "Cancelar")
        state.pinned = true
        NSApp.activate(ignoringOtherApps: true)
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        Task { @MainActor in
            let freed = await Task.detached { Cleaner.clean(chosenItems) }.value
            state.addXP(15)
            message = "Pronto! Liberei \(MacInfo.bytes(freed))."
            items.removeAll { $0.selected }
        }
    }

    // MARK: desinstalador

    private var filteredApps: [AppEntry] {
        let t = Words.normalize(search)
        return t.isEmpty ? apps : apps.filter { Words.normalize($0.name).contains(t) }
    }

    private var uninstaller: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(spacing: 6) {
                TextField("Buscar app…", text: $search)
                    .textFieldStyle(.plain)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.08)))
                ScrollView {
                    VStack(alignment: .leading, spacing: 2) {
                        ForEach(filteredApps) { app in
                            Button {
                                choose(app)
                            } label: {
                                HStack(spacing: 6) {
                                    Image(nsImage: NSWorkspace.shared.icon(forFile: app.path))
                                        .resizable().frame(width: 18, height: 18)
                                    Text(app.name).font(.system(size: 12)).lineLimit(1)
                                    Spacer()
                                }
                                .padding(5)
                                .background(RoundedRectangle(cornerRadius: 6)
                                    .fill(chosen == app ? state.accent.opacity(0.25) : Color.clear))
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .frame(width: 200)

            VStack(alignment: .leading, spacing: 6) {
                if let app = chosen {
                    Text(app.name).font(.system(size: 14, weight: .bold))
                    Text("Vai para o Lixo (dá para recuperar de lá):")
                        .font(.system(size: 10)).foregroundColor(.secondary)
                    ScrollView {
                        VStack(spacing: 3) {
                            ForEach($leftovers) { $l in
                                HStack {
                                    Toggle("", isOn: $l.selected).labelsHidden()
                                    Text(l.label).font(.system(size: 10)).lineLimit(1).truncationMode(.middle)
                                    Spacer()
                                    Text(MacInfo.bytes(l.size)).font(.system(size: 10, weight: .semibold))
                                }
                            }
                        }
                    }
                    Button("Desinstalar \(app.name) (\(MacInfo.bytes(leftovers.filter { $0.selected }.reduce(0) { $0 + $1.size })))") {
                        uninstall(app)
                    }
                } else {
                    Spacer()
                    Text("Escolha um app para ver tudo o que ele deixou espalhado no Mac.")
                        .font(.system(size: 12)).foregroundColor(.secondary)
                    Spacer()
                }
                if !message.isEmpty {
                    Text(message).font(.system(size: 11)).foregroundColor(state.accent)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .onAppear {
            if apps.isEmpty { apps = Uninstaller.apps() }
        }
    }

    private func choose(_ app: AppEntry) {
        chosen = app
        message = ""
        leftovers = []
        Task { @MainActor in leftovers = await Task.detached { Uninstaller.leftovers(for: app) }.value }
    }

    private func uninstall(_ app: AppEntry) {
        let alert = NSAlert()
        alert.messageText = "Desinstalar \(app.name)?"
        alert.informativeText = "O app e os arquivos marcados vão para o Lixo. O app será fechado se estiver aberto."
        alert.addButton(withTitle: "Desinstalar")
        alert.addButton(withTitle: "Cancelar")
        state.pinned = true
        NSApp.activate(ignoringOtherApps: true)
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        let failed = Uninstaller.uninstall(app, items: leftovers)
        if failed.isEmpty {
            message = "\(app.name) foi para o Lixo. ✅"
            apps.removeAll { $0 == app }
            chosen = nil
            leftovers = []
        } else {
            message = "Não consegui mover: \(failed.joined(separator: ", ")). Talvez precise arrastar para o Lixo e digitar sua senha."
        }
    }
}

// MARK: - Janelas, telas e som

struct WindowsTab: View {
    @ObservedObject var state: AppState
    @ObservedObject var tools: MacTools
    @State private var volume = Double(SystemControl.volume())
    @State private var trusted = WindowManager.trusted

    private let grid: [WindowSnap] = [.left, .right, .top, .bottom, .topLeft, .topRight, .bottomLeft, .bottomRight,
                                      .leftThird, .centerThird, .rightThird, .maximize, .center, .nextDisplay]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                windows
                screens
                sound
            }
        }
        .onAppear {
            trusted = WindowManager.trusted
            tools.refreshDisplays()
            tools.refreshAudio()
            volume = Double(SystemControl.volume())
        }
    }

    private var windows: some View {
        VStack(alignment: .leading, spacing: 6) {
            SectionTitle(text: "Janelas")
            if !trusted {
                Card {
                    HStack {
                        Text("Para mover janelas, libere a Sexta-feira em Acessibilidade.")
                            .font(.system(size: 11))
                        Spacer()
                        Button("Liberar") {
                            WindowManager.askPermission()
                            after(5) { trusted = WindowManager.trusted }
                        }
                    }
                }
            }
            Text("Use os atalhos com a janela desejada em primeiro plano, ou diga “coloca a janela na esquerda”.")
                .font(.system(size: 10))
                .foregroundColor(.secondary)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 120), spacing: 6)], spacing: 6) {
                ForEach(grid, id: \.self) { s in
                    HStack(spacing: 6) {
                        Image(systemName: s.icon).foregroundColor(state.accent)
                        VStack(alignment: .leading, spacing: 0) {
                            Text(s.title).font(.system(size: 10, weight: .semibold)).lineLimit(1)
                            if let k = s.shortcut { Text(k).font(.system(size: 9)).foregroundColor(.secondary) }
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(6)
                    .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.05)))
                }
            }
        }
    }

    private var screens: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                SectionTitle(text: "Brilho das telas")
                Spacer()
                Button("Restaurar") { tools.resetDim() }.font(.system(size: 10))
            }
            ForEach(tools.displays) { d in
                Card {
                    HStack {
                        Image(systemName: "sun.max.fill").foregroundColor(state.accent)
                        Text(d.name).font(.system(size: 12)).frame(width: 150, alignment: .leading).lineLimit(1)
                        Slider(value: Binding(get: { tools.dim[d.id] ?? 1 }, set: { tools.setDim(d.id, $0) }), in: 0.15...1)
                            .tint(state.accent)
                        Text("\(Int(((tools.dim[d.id] ?? 1) * 100).rounded()))%").font(.system(size: 11)).frame(width: 36)
                    }
                }
            }
            Text("Escurece por software, então funciona em qualquer monitor externo, sem botão físico. O brilho original volta ao fechar o app.")
                .font(.system(size: 10))
                .foregroundColor(.secondary)
        }
    }

    private var sound: some View {
        VStack(alignment: .leading, spacing: 6) {
            SectionTitle(text: "Som")
            Card {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Image(systemName: "speaker.wave.2.fill").foregroundColor(state.accent)
                        Slider(value: $volume, in: 0...100, onEditingChanged: { editing in
                            if !editing { SystemControl.setVolume(Int(volume)) }
                        })
                        .tint(state.accent)
                        Text("\(Int(volume))%").font(.system(size: 11)).frame(width: 36)
                    }
                    Picker("Saída", selection: Binding(get: { tools.currentOutput }, set: { tools.setOutput($0) })) {
                        ForEach(tools.outputs) { d in Text(d.name).tag(d.id) }
                    }
                }
            }
        }
    }
}

// MARK: - Agenda e relógio mundial

struct AgendaTab: View {
    @ObservedObject var state: AppState
    @ObservedObject var tools: MacTools
    @State private var addZone = ""

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            agenda.frame(maxWidth: .infinity, alignment: .topLeading)
            world.frame(width: 230)
        }
    }

    private var agenda: some View {
        VStack(alignment: .leading, spacing: 6) {
            SectionTitle(text: "Próximos compromissos")
            if !tools.agendaAllowed {
                Card {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Mostro seus eventos do app Calendário, incluindo Google Agenda e iCloud.")
                            .font(.system(size: 11))
                        Button("Permitir acesso à agenda") { tools.requestAgenda() }
                    }
                }
            } else if tools.events.isEmpty {
                Text("Nada nos próximos 3 dias 🎉").foregroundColor(.secondary).padding(.top, 10)
            } else {
                ScrollView {
                    VStack(spacing: 4) {
                        ForEach(tools.events) { e in
                            HStack(spacing: 8) {
                                Capsule().fill(e.color).frame(width: 4, height: 30)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(e.title).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                                    Text(label(e)).font(.system(size: 10)).foregroundColor(.secondary)
                                }
                                Spacer()
                            }
                            .padding(6)
                            .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.05)))
                        }
                    }
                }
            }
        }
    }

    private func label(_ e: AgendaEvent) -> String {
        let day = Calendar.current.isDateInToday(e.start) ? "Hoje" :
            (Calendar.current.isDateInTomorrow(e.start) ? "Amanhã" : DesktopWidgetView.dayText(e.start))
        return e.allDay ? "\(day) · dia todo" : "\(day) · \(Fmt.time(e.start))–\(Fmt.time(e.end))"
    }

    private var world: some View {
        VStack(alignment: .leading, spacing: 6) {
            SectionTitle(text: "Relógio mundial")
            TimelineView(.periodic(from: .now, by: 30)) { ctx in
                VStack(spacing: 4) {
                    ForEach(tools.worldClocks.compactMap { ClockZone.find($0) }) { z in
                        HStack {
                            Text(z.flag)
                            VStack(alignment: .leading, spacing: 0) {
                                Text(z.city).font(.system(size: 12, weight: .semibold))
                                Text(z.offset(ctx.date)).font(.system(size: 9)).foregroundColor(.secondary)
                            }
                            Spacer()
                            Text(z.time(ctx.date)).font(.system(size: 16, weight: .bold, design: .rounded))
                            Button {
                                tools.worldClocks.removeAll { $0 == z.tz }
                            } label: {
                                Image(systemName: "xmark").font(.system(size: 9)).foregroundColor(.secondary)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(6)
                        .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.05)))
                    }
                }
            }
            Picker("Adicionar", selection: $addZone) {
                Text("Adicionar cidade…").tag("")
                ForEach(ClockZone.options.filter { !tools.worldClocks.contains($0.tz) }) { z in
                    Text("\(z.flag) \(z.city)").tag(z.tz)
                }
            }
            .labelsHidden()
            .onChange(of: addZone) { v in
                if !v.isEmpty {
                    tools.worldClocks.append(v)
                    addZone = ""
                }
            }
        }
    }
}

// MARK: - Vigia de câmera e microfone

struct PrivacyTab: View {
    @ObservedObject var state: AppState
    @ObservedObject var tools: MacTools
    @AppStorage("privacyWatch") private var privacyWatch = true

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                status("Microfone", tools.micOn, "mic.fill")
                status("Câmera", tools.camOn, "video.fill")
            }
            Toggle("Me avisar quando algum app ligar a câmera ou o microfone", isOn: $privacyWatch)
                .font(.system(size: 12))
            SectionTitle(text: "Histórico")
            if tools.privacyLog.isEmpty {
                Spacer()
                Text("Nenhum uso de câmera ou microfone desde que a Sexta-feira abriu.")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                Spacer()
            } else {
                ScrollView {
                    VStack(spacing: 4) {
                        ForEach(tools.privacyLog) { e in
                            HStack {
                                Text(e.text).font(.system(size: 12))
                                Spacer()
                                Text(Fmt.time(e.date)).font(.system(size: 10)).foregroundColor(.secondary)
                            }
                            .padding(7)
                            .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.05)))
                        }
                    }
                }
            }
        }
    }

    private func status(_ title: String, _ on: Bool, _ icon: String) -> some View {
        Card {
            HStack {
                Image(systemName: icon).foregroundColor(on ? .red : .secondary)
                VStack(alignment: .leading, spacing: 1) {
                    Text(title).font(.system(size: 12, weight: .semibold))
                    Text(on ? "EM USO agora" : "Desligado")
                        .font(.system(size: 10, weight: on ? .bold : .regular))
                        .foregroundColor(on ? .red : .secondary)
                }
                Spacer()
                Circle().fill(on ? Color.red : Color.green.opacity(0.6)).frame(width: 10, height: 10)
            }
        }
    }
}
