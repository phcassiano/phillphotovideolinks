import SwiftUI
import AppKit

// MARK: - Início

struct HomeTab: View {
    @ObservedObject var state: AppState
    let assistant: Assistant
    @State private var input = ""

    private let tryThese = [
        "toca Henrique e Juliano", "timer de 10 minutos pra pizza", "como está meu Mac?",
        "bebi água", "cria uma arte de um gato astronauta", "abre o YouTube",
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                askBar

                if let last = state.messages.last(where: { !$0.fromUser }) {
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: "quote.bubble.fill").foregroundColor(state.accent)
                        Text(last.text)
                            .font(.system(size: 12))
                            .lineLimit(3)
                    }
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.05)))
                }

                LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8),
                                    GridItem(.flexible(), spacing: 8)], spacing: 8) {
                    if let w = state.waterHabit {
                        card(icon: "drop.fill", color: .cyan, value: "\(w.count)/\(w.goal)", label: "água · toque +1") {
                            _ = assistant.actions.run(.habit(w.name))
                        }
                    }
                    card(icon: "checklist", color: .orange,
                         value: "\(state.tasks.filter { !$0.done }.count)", label: "tarefas abertas") {
                        state.tab = .tasks
                    }
                    card(icon: "timer", color: .pink, value: "\(state.timers.count)", label: "timers") {
                        state.tab = .timers
                    }
                    card(icon: "bolt.fill", color: .yellow, value: "\(state.routines.count + state.customCommands.count)",
                         label: "rotinas e funções") {
                        state.tab = .routines
                    }
                    card(icon: "laptopcomputer", color: .green, value: "Mac", label: "verificar agora") {
                        _ = assistant.actions.run(.checkMac)
                    }
                    card(icon: "paintpalette.fill", color: .purple, value: "Arte", label: "criar imagem") {
                        state.tab = .chat
                        state.wantsFocus = true
                    }
                }

                Text("Experimente dizer")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.secondary)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 6)], alignment: .leading, spacing: 6) {
                    ForEach(tryThese, id: \.self) { s in
                        Button {
                            assistant.handle(s)
                        } label: {
                            Text("“\(s)”")
                                .font(.system(size: 11))
                                .lineLimit(1)
                                .padding(.horizontal, 9)
                                .padding(.vertical, 5)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Capsule().fill(Color.white.opacity(0.07)))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var askBar: some View {
        HStack(spacing: 8) {
            TextField("Escreva ou fale com a \(state.assistantName)…", text: $input)
                .textFieldStyle(.plain)
                .onSubmit(send)
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.08)))
            Button {
                assistant.toggleListening()
            } label: {
                Image(systemName: state.mode == .listening ? "stop.circle.fill" : "mic.circle.fill")
                    .font(.system(size: 24))
                    .foregroundColor(state.mode == .listening ? Color.red : Color.white.opacity(0.8))
            }
            .buttonStyle(.plain)
            Button(action: send) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 24))
                    .foregroundColor(state.accent)
            }
            .buttonStyle(.plain)
        }
    }

    private func send() {
        let t = input.trimmed
        guard !t.isEmpty else { return }
        input = ""
        assistant.handle(t)
    }

    private func card(icon: String, color: Color, value: String, label: String,
                      action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 4) {
                Image(systemName: icon).foregroundColor(color)
                Text(value).font(.system(size: 17, weight: .bold))
                Text(label).font(.system(size: 10)).foregroundColor(.secondary).lineLimit(1)
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(LinearGradient(colors: [color.opacity(0.22), color.opacity(0.06)],
                                         startPoint: .topLeading, endPoint: .bottomTrailing))
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Hábitos

struct HabitsTab: View {
    @ObservedObject var state: AppState
    @State private var newName = ""
    @State private var newGoal = 1

    var body: some View {
        VStack(spacing: 8) {
            ScrollView {
                VStack(spacing: 6) {
                    ForEach(state.habits) { h in row(h) }
                }
            }
            HStack {
                TextField("Novo hábito (ex.: Meditar)", text: $newName)
                    .textFieldStyle(.plain)
                    .onSubmit(add)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.08)))
                Stepper("Meta: \(newGoal)", value: $newGoal, in: 1...20)
                    .font(.system(size: 11))
                    .fixedSize()
                Button("Criar", action: add)
            }
            Text("Os contadores zeram todo dia. Diga “bebi água” para somar um copo.")
                .font(.system(size: 10))
                .foregroundColor(.secondary)
        }
    }

    private func row(_ h: Habit) -> some View {
        let done = h.count >= h.goal
        return HStack(spacing: 10) {
            Image(systemName: h.icon)
                .foregroundColor(done ? state.accent : .secondary)
                .frame(width: 20)
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(h.name).font(.system(size: 13, weight: .semibold))
                    Spacer()
                    Text("\(h.count)/\(h.goal)")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(done ? state.accent : .white)
                }
                ProgressView(value: min(1, Double(h.count) / Double(max(h.goal, 1))))
                    .tint(state.accent)
            }
            Button { change(h, -1) } label: { Image(systemName: "minus.circle") }
                .buttonStyle(.plain)
            Button { change(h, 1) } label: { Image(systemName: "plus.circle.fill").foregroundColor(state.accent) }
                .buttonStyle(.plain)
            Button {
                state.habits.removeAll { $0.id == h.id }
            } label: {
                Image(systemName: "trash").foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.05)))
    }

    private func change(_ h: Habit, _ delta: Int) {
        guard let i = state.habits.firstIndex(where: { $0.id == h.id }) else { return }
        state.habits[i].count = max(0, state.habits[i].count + delta)
        if delta > 0 { state.addXP(3) }
    }

    private func add() {
        let n = newName.trimmed
        guard !n.isEmpty else { return }
        state.habits.append(Habit(name: n, icon: "star.fill", goal: newGoal))
        newName = ""
        newGoal = 1
    }
}

// MARK: - Copiados

struct ClipsTab: View {
    @ObservedObject var state: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Tudo o que você copiou nesta sessão. Clique para copiar de novo.")
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
                Spacer()
                if !state.clips.isEmpty {
                    Button("Limpar") { state.clips.removeAll() }
                }
            }
            if state.clips.isEmpty {
                Spacer()
                Text("Nada copiado ainda. Senhas de gerenciadores de senha não são guardadas.")
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                Spacer()
            } else {
                ScrollView {
                    VStack(spacing: 4) {
                        ForEach(state.clips) { c in
                            HStack(alignment: .top) {
                                Text(c.text)
                                    .font(.system(size: 12))
                                    .lineLimit(2)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                Text(Fmt.time(c.date))
                                    .font(.system(size: 10))
                                    .foregroundColor(.secondary)
                                Button {
                                    state.clips.removeAll { $0.id == c.id }
                                } label: {
                                    Image(systemName: "xmark").foregroundColor(.secondary)
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(8)
                            .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.05)))
                            .contentShape(Rectangle())
                            .onTapGesture {
                                NSPasteboard.general.clearContents()
                                NSPasteboard.general.setString(c.text, forType: .string)
                            }
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Rotinas e funções

struct RoutinesTab: View {
    @ObservedObject var state: AppState
    let assistant: Assistant

    @State private var fnName = ""
    @State private var fnTarget = ""
    @State private var rtName = ""
    @State private var rtSteps = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                functions
                routines
            }
        }
    }

    // "Dê um nome e mostre o que abrir"
    private var functions: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("FUNÇÕES — dê um nome e diga o que abrir")
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.secondary)
            Text("Ex.: “painel da TV” → um site, app, pasta ou arquivo. Depois é só dizer “abre o painel da TV”.")
                .font(.system(size: 11))
                .foregroundColor(.secondary)
            HStack {
                field("Nome (ex.: painel da TV)", $fnName)
                field("Site, app ou caminho", $fnTarget)
                Button("Escolher…", action: pickTarget)
                Button("Salvar", action: addFunction)
            }
            ForEach(state.customCommands) { c in
                itemRow(icon: "link", title: c.name, detail: c.target,
                        run: { _ = assistant.actions.openTarget(c.target) },
                        delete: { state.customCommands.removeAll { $0.id == c.id } })
            }
        }
    }

    private var routines: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("ROTINAS — vários comandos de uma vez")
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.secondary)
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    field("Nome (ex.: modo estudo)", $rtName)
                    TextEditor(text: $rtSteps)
                        .font(.system(size: 12))
                        .frame(height: 64)
                        .scrollContentBackground(.hidden)
                        .padding(6)
                        .background(RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.08)))
                    Text("Um comando por linha: “abre o Notion”, “volume 30”, “timer de 25 minutos”…")
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                }
                Button("Salvar", action: addRoutine)
            }
            ForEach(state.routines) { r in
                itemRow(icon: "bolt.fill", title: r.name, detail: r.steps.joined(separator: " · "),
                        run: { assistant.handle(r.name) },
                        delete: { state.routines.removeAll { $0.id == r.id } })
            }
        }
    }

    private func field(_ placeholder: String, _ text: Binding<String>) -> some View {
        TextField(placeholder, text: text)
            .textFieldStyle(.plain)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.08)))
    }

    private func itemRow(icon: String, title: String, detail: String,
                         run: @escaping () -> Void, delete: @escaping () -> Void) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon).foregroundColor(state.accent)
            VStack(alignment: .leading, spacing: 2) {
                Text("“\(title)”").font(.system(size: 12, weight: .semibold))
                Text(detail).font(.system(size: 10)).foregroundColor(.secondary).lineLimit(1)
            }
            Spacer()
            Button(action: run) { Image(systemName: "play.fill") }.buttonStyle(.plain)
            Button(action: delete) { Image(systemName: "trash").foregroundColor(.secondary) }.buttonStyle(.plain)
        }
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.05)))
    }

    private func pickTarget() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.directoryURL = URL(fileURLWithPath: "/Applications")
        state.pinned = true
        NSApp.activate(ignoringOtherApps: true)
        if panel.runModal() == .OK, let url = panel.url {
            fnTarget = url.path
            if fnName.trimmed.isEmpty { fnName = url.deletingPathExtension().lastPathComponent }
        }
    }

    private func addFunction() {
        let n = fnName.trimmed, t = fnTarget.trimmed
        guard !n.isEmpty, !t.isEmpty else { return }
        state.customCommands.append(CustomCommand(name: n, target: t))
        fnName = ""
        fnTarget = ""
    }

    private func addRoutine() {
        let n = rtName.trimmed
        let steps = rtSteps.split(separator: "\n").map { String($0).trimmed }.filter { !$0.isEmpty }
        guard !n.isEmpty, !steps.isEmpty else { return }
        state.routines.append(Routine(name: n, steps: steps))
        rtName = ""
        rtSteps = ""
    }
}

// MARK: - Meu Mac

struct MyMacTab: View {
    @ObservedObject var state: AppState
    let assistant: Assistant

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let progress = state.scanProgress {
                scanning(progress)
            } else if state.report.isEmpty {
                Spacer()
                VStack(spacing: 10) {
                    Image(systemName: "laptopcomputer")
                        .font(.system(size: 36))
                        .foregroundColor(state.accent)
                    Text("Veja memória, processador, disco, caches, lixeira e bateria.")
                        .foregroundColor(.secondary)
                    Button("Verificar meu Mac") { _ = assistant.actions.run(.checkMac) }
                }
                .frame(maxWidth: .infinity)
                Spacer()
            } else {
                ScrollView {
                    VStack(spacing: 6) {
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
                            .padding(9)
                            .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.05)))
                        }
                    }
                }
                HStack {
                    Button("Verificar de novo") { _ = assistant.actions.run(.checkMac) }
                    Button("Esvaziar lixeira…") { MacChecker.emptyTrash() }
                    Button("Abrir Monitor de Atividade") { _ = assistant.actions.run(.openApp("activity monitor")) }
                }
            }
        }
    }

    private func scanning(_ progress: Double) -> some View {
        HStack(alignment: .center, spacing: 20) {
            ZStack {
                Circle().stroke(Color.white.opacity(0.1), lineWidth: 8)
                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(state.accent, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.easeOut(duration: 0.3), value: progress)
                VStack(spacing: 2) {
                    RobotFace(mode: .thinking, size: 34, accent: state.accent)
                    Text("\(Int(progress * 100))%").font(.system(size: 13, weight: .bold))
                }
            }
            .frame(width: 120, height: 120)

            VStack(alignment: .leading, spacing: 6) {
                Text("Verificando seu Mac…").font(.system(size: 15, weight: .bold))
                ForEach(state.scanSteps) { s in
                    HStack(spacing: 6) {
                        Image(systemName: s.done ? "checkmark.circle.fill" : "circle.dotted")
                            .foregroundColor(s.done ? state.accent : .secondary)
                        Text(s.title)
                            .font(.system(size: 12))
                            .foregroundColor(s.done ? .white : .secondary)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
