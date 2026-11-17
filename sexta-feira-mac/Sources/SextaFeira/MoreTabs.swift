import SwiftUI
import AppKit

// MARK: - Início

struct HomeTab: View {
    @ObservedObject var state: AppState
    let assistant: Assistant
    var openSettings: @MainActor () -> Void = {}
    @State private var input = ""

    private let tryThese = [
        "resumo do dia", "vai chover hoje?", "quanto está o dólar?", "como está meu Mac?",
        "timer de 10 minutos pra pizza", "claude code, faz uma landing page de café",
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                askBar
                SetupChecklist(state: state, assistant: assistant, openSettings: openSettings,
                               helper: assistant.tools.helper, tools: assistant.tools, phone: assistant.phone)

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
    @State private var editing: Routine?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                routines
                BriefingSettings(assistant: assistant)
                functions
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
            HStack {
                SectionTitle(text: "Rotinas — vários passos de uma vez")
                Spacer()
                Button("+ Nova rotina") {
                    editing = Routine(name: "", steps: [], items: [RoutineStep(kind: "falar", value: "")])
                }
            }
            Text("Diga o nome ou a frase da rotina (ex.: “acorda criança”), ou marque um horário para ela rodar sozinha.")
                .font(.system(size: 10))
                .foregroundColor(.secondary)
            if let draft = editing {
                RoutineEditor(routine: draft, accent: state.accent, onSave: { r in
                    if let i = state.routines.firstIndex(where: { $0.id == r.id }) {
                        state.routines[i] = r
                    } else {
                        state.routines.append(r)
                    }
                    editing = nil
                }, onCancel: { editing = nil })
                .id(draft.id)
            }
            ForEach(state.routines) { r in
                itemRow(icon: r.hasSchedule ? "clock.fill" : "bolt.fill", title: r.name, detail: routineDetail(r),
                        run: { assistant.runRoutine(r) },
                        delete: { state.routines.removeAll { $0.id == r.id } },
                        edit: { editing = r })
            }
        }
    }

    private func routineDetail(_ r: Routine) -> String {
        var parts: [String] = []
        if let p = r.phrase, !p.isEmpty { parts.append("frase: “\(p)”") }
        if let t = r.time, !t.isEmpty {
            let letters = ["D", "S", "T", "Q", "Q", "S", "S"]
            let days = (r.days ?? []).map { letters[max(0, min(6, $0 - 1))] }.joined()
            parts.append("às \(t)" + (days.isEmpty ? " todo dia" : " (\(days))"))
        }
        let steps = (r.items ?? []).map { (StepKind(rawValue: $0.kind)?.title ?? $0.kind) + ($0.value.isEmpty ? "" : ": \($0.value)") }
        parts.append((steps.isEmpty ? r.steps : steps).joined(separator: " · "))
        return parts.joined(separator: "  —  ")
    }

    private func field(_ placeholder: String, _ text: Binding<String>) -> some View {
        TextField(placeholder, text: text)
            .textFieldStyle(.plain)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.08)))
    }

    private func itemRow(icon: String, title: String, detail: String,
                         run: @escaping () -> Void, delete: @escaping () -> Void,
                         edit: (() -> Void)? = nil) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon).foregroundColor(state.accent)
            VStack(alignment: .leading, spacing: 2) {
                Text("“\(title)”").font(.system(size: 12, weight: .semibold))
                Text(detail).font(.system(size: 10)).foregroundColor(.secondary).lineLimit(1)
            }
            Spacer()
            Button(action: run) { Image(systemName: "play.fill") }.buttonStyle(.plain)
            if let edit { Button(action: edit) { Image(systemName: "pencil") }.buttonStyle(.plain) }
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

}
