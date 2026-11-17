import SwiftUI
import AppKit
import Speech

// MARK: - Fundo do painel (Entalho/Ilha + Escuro/Aurora/Foto)

struct PanelBackground: View {
    @ObservedObject var state: AppState
    let collapsed: Bool

    private var shape: AnyShape {
        if state.islandStyle == "ilha" {
            return AnyShape(RoundedRectangle(cornerRadius: collapsed ? 15 : 24, style: .continuous))
        }
        return AnyShape(NotchShape(radius: collapsed ? 10 : 24))
    }

    var body: some View {
        fill
            .clipShape(shape)
            .overlay(shape.stroke(Color.white.opacity(state.islandStyle == "ilha" ? 0.12 : 0), lineWidth: 1))
    }

    @ViewBuilder
    private var fill: some View {
        if collapsed || state.theme == "escuro" {
            Color.black.opacity(collapsed ? 1 : 0.95)
        } else if state.theme == "aurora" {
            LinearGradient(colors: [Color(red: 0.22, green: 0.30, blue: 0.92),
                                    Color(red: 0.10, green: 0.11, blue: 0.42),
                                    Color(red: 0.03, green: 0.04, blue: 0.14)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
        } else if let img = state.background {
            Image(nsImage: img)
                .resizable()
                .scaledToFill()
                .overlay(Color.black.opacity(0.6))
        } else {
            Color.black.opacity(0.95)
        }
    }
}

// MARK: - "Deixe 100%" (checklist do Início)

struct SetupChecklist: View {
    @ObservedObject var state: AppState
    let assistant: Assistant
    let openSettings: @MainActor () -> Void
    @ObservedObject var helper: HelperManager
    @ObservedObject var tools: MacTools
    @ObservedObject var phone: PhoneServer

    private struct Item: Identifiable {
        let id: String
        let title: String
        let done: Bool
        let icon: String
    }

    private var items: [Item] {
        let ai = Prefs.provider == "local" || UserDefaults.standard.bool(forKey: "aiConfigured")
        let mic = SFSpeechRecognizer.authorizationStatus() == .authorized
        return [
            Item(id: "ai", title: "Escolher o cérebro (IA)", done: ai, icon: "brain.head.profile"),
            Item(id: "name", title: "Dizer seu nome", done: !state.userName.isEmpty, icon: "person.fill"),
            Item(id: "mic", title: "Liberar voz e microfone", done: mic, icon: "mic.fill"),
            Item(id: "helper", title: "Instalar o ajudante (bateria e ventoinha)", done: helper.running, icon: "bolt.shield.fill"),
            Item(id: "agenda", title: "Conectar a agenda", done: tools.agendaAllowed, icon: "calendar"),
            Item(id: "phone", title: "Conectar o celular", done: phone.running, icon: "iphone"),
        ]
    }

    var body: some View {
        let list = items
        let done = list.filter { $0.done }.count
        if done < list.count {
            Card {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("Faça agora para deixar 100%").font(.system(size: 12, weight: .bold))
                        Spacer()
                        Text("\(done * 100 / list.count)%").font(.system(size: 12, weight: .bold)).foregroundColor(state.accent)
                    }
                    ProgressView(value: Double(done), total: Double(list.count)).tint(state.accent)
                    ForEach(list.filter { !$0.done }.prefix(3)) { item in
                        HStack {
                            Image(systemName: item.icon).foregroundColor(state.accent).frame(width: 18)
                            Text(item.title).font(.system(size: 11))
                            Spacer()
                            Button("Configurar") { act(item.id) }.font(.system(size: 10))
                        }
                    }
                }
            }
        }
    }

    private func act(_ id: String) {
        switch id {
        case "ai", "name": openSettings()
        case "mic":
            SpeechService.requestPermissions { _ in }
        case "helper": state.tab = .battery
        case "agenda": tools.requestAgenda()
        case "phone": state.tab = .phone
        default: break
        }
    }
}

// MARK: - Editor de rotinas

struct RoutineEditor: View {
    let original: Routine
    let accent: Color
    let onSave: (Routine) -> Void
    let onCancel: () -> Void

    @State private var name: String
    @State private var phrase: String
    @State private var time: String
    @State private var scheduleOn: Bool
    @State private var days: Set<Int>
    @State private var items: [RoutineStep]

    private let dayLetters = ["D", "S", "T", "Q", "Q", "S", "S"]

    init(routine: Routine, accent: Color, onSave: @escaping (Routine) -> Void, onCancel: @escaping () -> Void) {
        self.original = routine
        self.accent = accent
        self.onSave = onSave
        self.onCancel = onCancel
        _name = State(initialValue: routine.name)
        _phrase = State(initialValue: routine.phrase ?? "")
        _time = State(initialValue: routine.time ?? "07:30")
        _scheduleOn = State(initialValue: routine.hasSchedule)
        _days = State(initialValue: Set(routine.days ?? []))
        _items = State(initialValue: routine.items ?? routine.steps.map { RoutineStep(kind: "comando", value: $0) })
    }

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    input("Nome da rotina", $name)
                    input("Frase que ativa (opcional), ex.: acorda criança", $phrase)
                }
                HStack(spacing: 6) {
                    Toggle("Rodar sozinha às", isOn: $scheduleOn)
                        .toggleStyle(.checkbox)
                        .font(.system(size: 11))
                    TextField("07:30", text: $time)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 60)
                        .disabled(!scheduleOn)
                    ForEach(1...7, id: \.self) { d in
                        Button {
                            if days.contains(d) { days.remove(d) } else { days.insert(d) }
                        } label: {
                            Text(dayLetters[d - 1])
                                .font(.system(size: 10, weight: .bold))
                                .frame(width: 20, height: 20)
                                .background(Circle().fill(days.contains(d) ? accent : Color.white.opacity(0.08)))
                                .foregroundColor(days.contains(d) ? .black : .white)
                        }
                        .buttonStyle(.plain)
                        .disabled(!scheduleOn)
                    }
                    if scheduleOn && days.isEmpty {
                        Text("todo dia").font(.system(size: 10)).foregroundColor(.secondary)
                    }
                }
                ForEach(Array(items.enumerated()), id: \.element.id) { i, step in
                    stepRow(i, step)
                }
                HStack {
                    Button("+ Ação") { items.append(RoutineStep(kind: "falar", value: "")) }
                    Spacer()
                    Button("Cancelar", action: onCancel)
                    Button("Salvar") { save() }
                        .disabled(name.trimmed.isEmpty)
                }
            }
        }
    }

    private func input(_ placeholder: String, _ text: Binding<String>) -> some View {
        TextField(placeholder, text: text)
            .textFieldStyle(.plain)
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.08)))
    }

    private func stepRow(_ i: Int, _ step: RoutineStep) -> some View {
        let kind = StepKind(rawValue: step.kind) ?? .command
        return HStack(spacing: 6) {
            Text("\(i + 1)").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary).frame(width: 14)
            Picker("", selection: Binding(get: { i < items.count ? items[i].kind : "falar" },
                                          set: { if i < items.count { items[i].kind = $0 } })) {
                ForEach(StepKind.allCases) { k in
                    Label(k.title, systemImage: k.icon).tag(k.rawValue)
                }
            }
            .labelsHidden()
            .frame(width: 180)
            if kind != .hideAll && kind != .briefing {
                TextField(kind.placeholder, text: Binding(get: { i < items.count ? items[i].value : "" },
                                                          set: { if i < items.count { items[i].value = $0 } }))
                    .textFieldStyle(.plain)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .background(RoundedRectangle(cornerRadius: 7).fill(Color.white.opacity(0.08)))
            } else {
                Spacer()
            }
            Button {
                if i > 0 { items.swapAt(i, i - 1) }
            } label: { Image(systemName: "chevron.up") }
            .buttonStyle(.plain)
            .disabled(i == 0)
            Button {
                if i < items.count { items.remove(at: i) }
            } label: { Image(systemName: "trash").foregroundColor(.secondary) }
            .buttonStyle(.plain)
        }
    }

    private func save() {
        var r = original
        r.name = name.trimmed
        r.phrase = phrase.trimmed.isEmpty ? nil : phrase.trimmed
        r.time = scheduleOn ? time.trimmed : nil
        r.days = days.isEmpty ? nil : days.sorted()
        r.items = items.filter { !$0.value.trimmed.isEmpty || $0.kind == "esconder" || $0.kind == "resumo" }
        r.steps = []
        onSave(r)
    }
}

// MARK: - O que entra no Resumo do dia

struct BriefingSettings: View {
    let assistant: Assistant
    @AppStorage("brief.saudacao") private var greeting = true
    @AppStorage("brief.tarefas") private var tasks = true
    @AppStorage("brief.atrasadas") private var overdue = true
    @AppStorage("brief.agenda") private var agenda = true
    @AppStorage("brief.clima") private var weather = true
    @AppStorage("brief.emails") private var emails = true
    @AppStorage("brief.noticias") private var news = true
    @AppStorage("city") private var city = ""

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Image(systemName: "sun.max.fill").foregroundColor(.yellow)
                    Text("Resumo do dia").font(.system(size: 13, weight: .bold))
                    Spacer()
                    Button("▶︎ Ouvir agora") { _ = assistant.actions.run(.briefing) }
                }
                Text("O que a assistente fala quando você pede “resumo do dia” (ou numa rotina de bom dia).")
                    .font(.system(size: 10)).foregroundColor(.secondary)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 4) {
                    Toggle("Bom dia / boa tarde", isOn: $greeting)
                    Toggle("Tarefas e lembretes", isOn: $tasks)
                    Toggle("O que ficou de antes", isOn: $overdue)
                    Toggle("Agenda", isOn: $agenda)
                    Toggle("Clima e chuva", isOn: $weather)
                    Toggle("E-mails não lidos (app Mail)", isOn: $emails)
                    Toggle("Notícias", isOn: $news)
                }
                .font(.system(size: 11))
                .toggleStyle(.checkbox)
                HStack {
                    Text("Cidade do clima:").font(.system(size: 11))
                    TextField("São Paulo", text: $city).textFieldStyle(.roundedBorder).frame(width: 180)
                }
            }
        }
    }
}

// MARK: - Conectores (MCP)

struct ConnectorsTab: View {
    @ObservedObject var state: AppState
    @State private var name = ""
    @State private var url = ""
    @State private var token = ""
    @State private var testing: UUID?
    @State private var result = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Text("Ligue a assistente a outros serviços. Ela usa as ferramentas deles quando você pede algo que precisa delas.")
                    .font(.system(size: 11)).foregroundColor(.secondary)
                if Prefs.provider != "claude" {
                    Card {
                        Text("⚠️ Conectores funcionam quando o cérebro é o Claude (Configurações › Cérebro).")
                            .font(.system(size: 11))
                    }
                }
                SectionTitle(text: "Prontos para usar")
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                    ForEach(Connector.presets.indices, id: \.self) { i in
                        let p = Connector.presets[i]
                        Card {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(p.name).font(.system(size: 12, weight: .bold))
                                Text(p.about).font(.system(size: 10)).foregroundColor(.secondary).lineLimit(3)
                                Button("Adicionar") {
                                    name = p.name
                                    url = p.url
                                    token = ""
                                }
                                .font(.system(size: 10))
                            }
                        }
                    }
                }
                SectionTitle(text: "Novo conector")
                Card {
                    VStack(alignment: .leading, spacing: 6) {
                        TextField("Nome (ex.: Zapier)", text: $name).textFieldStyle(.roundedBorder)
                        TextField("Endereço do servidor MCP (https://…)", text: $url).textFieldStyle(.roundedBorder)
                        SecureField("Token (se o serviço pedir)", text: $token).textFieldStyle(.roundedBorder)
                        HStack {
                            Text("Só conecte serviços em que você confia: eles podem ler e mexer no que você permitir.")
                                .font(.system(size: 10)).foregroundColor(.secondary)
                            Spacer()
                            Button("Salvar conector", action: add)
                                .disabled(name.trimmed.isEmpty || !url.trimmed.hasPrefix("https://"))
                        }
                    }
                }
                if !state.connectors.isEmpty {
                    SectionTitle(text: "Seus conectores")
                    ForEach(state.connectors) { c in row(c) }
                }
                if !result.isEmpty {
                    Text(result).font(.system(size: 11)).foregroundColor(state.accent)
                }
            }
        }
    }

    private func row(_ c: Connector) -> some View {
        Card {
            HStack {
                Toggle("", isOn: Binding(get: { c.enabled }, set: { v in
                    if let i = state.connectors.firstIndex(where: { $0.id == c.id }) { state.connectors[i].enabled = v }
                }))
                .labelsHidden()
                .toggleStyle(.switch)
                VStack(alignment: .leading, spacing: 1) {
                    Text(c.name).font(.system(size: 12, weight: .semibold))
                    Text(c.url).font(.system(size: 10)).foregroundColor(.secondary).lineLimit(1).truncationMode(.middle)
                }
                Spacer()
                Button(testing == c.id ? "Testando…" : "Testar") { test(c) }
                    .disabled(testing != nil)
                Button {
                    Keychain.set("", for: c.tokenKey)
                    state.connectors.removeAll { $0.id == c.id }
                } label: { Image(systemName: "trash").foregroundColor(.secondary) }
                .buttonStyle(.plain)
            }
        }
    }

    private func add() {
        let c = Connector(name: name.trimmed, url: url.trimmed)
        Keychain.set(token, for: c.tokenKey)
        state.connectors.append(c)
        name = ""
        url = ""
        token = ""
    }

    private func test(_ c: Connector) {
        guard Prefs.provider == "claude" else {
            result = "Escolha o Claude como cérebro para testar."
            return
        }
        testing = c.id
        result = ""
        let server = MCPServer(name: c.name, url: c.url, token: Keychain.get(c.tokenKey))
        Task { @MainActor in
            do {
                let raw = try await AIClient.complete(
                    system: "Responda só com JSON {\"say\": \"...\", \"actions\": []}.",
                    turns: [ChatTurn(role: "user", text: "Em uma frase curta em português: o que você consegue fazer com o conector \(c.name)?")],
                    connectors: [server])
                result = "✅ " + ReplyParser.parse(raw).say
            } catch {
                result = "❌ " + error.localizedDescription
            }
            testing = nil
        }
    }
}

// MARK: - Celular

struct PhoneTab: View {
    @ObservedObject var state: AppState
    @ObservedObject var phone: PhoneServer
    @AppStorage("phoneEnabled") private var enabled = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Toggle("Falar com a \(state.assistantName) pelo celular (mesmo Wi-Fi)", isOn: Binding(get: { enabled }, set: { v in
                enabled = v
                phone.setEnabled(v)
            }))
            .toggleStyle(.switch)
            .font(.system(size: 12, weight: .semibold))
            if phone.running {
                HStack(alignment: .top, spacing: 16) {
                    if let img = phone.qrImage() {
                        Image(nsImage: img)
                            .interpolation(.none)
                            .resizable()
                            .frame(width: 170, height: 170)
                            .background(Color.white)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Aponte a câmera do celular para o QR Code").font(.system(size: 13, weight: .bold))
                        Text("Abre uma conversa no navegador do celular. Tudo o que você pedir lá, a \(state.assistantName) faz aqui no Mac.")
                            .font(.system(size: 11)).foregroundColor(.secondary)
                        Text(phone.url).font(.system(size: 10, design: .monospaced)).textSelection(.enabled)
                        Text("Dica: no iPhone, toque em Compartilhar › Adicionar à Tela de Início para virar um app.")
                            .font(.system(size: 10)).foregroundColor(.secondary)
                        Text("O endereço tem um código secreto; só quem tiver o QR consegue usar.")
                            .font(.system(size: 10)).foregroundColor(.secondary)
                    }
                }
            } else if enabled {
                Text(phone.error.isEmpty ? "Ligando…" : "Não consegui ligar: \(phone.error)")
                    .font(.system(size: 11)).foregroundColor(.secondary)
            } else {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "qrcode").font(.system(size: 40)).foregroundColor(state.accent)
                    Text("Ligue para mostrar o QR Code.").foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                Spacer()
            }
        }
    }
}
