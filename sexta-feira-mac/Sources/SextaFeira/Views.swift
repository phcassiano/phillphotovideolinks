import SwiftUI

// MARK: - Formas e rostinho

/// Retângulo com o topo reto (colado na borda da tela) e cantos de baixo arredondados.
struct NotchShape: Shape {
    var radius: CGFloat

    func path(in r: CGRect) -> Path {
        let rad = min(radius, r.height / 2, r.width / 2)
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: r.minY))
        p.addLine(to: CGPoint(x: r.maxX, y: r.minY))
        p.addLine(to: CGPoint(x: r.maxX, y: r.maxY - rad))
        p.addQuadCurve(to: CGPoint(x: r.maxX - rad, y: r.maxY), control: CGPoint(x: r.maxX, y: r.maxY))
        p.addLine(to: CGPoint(x: r.minX + rad, y: r.maxY))
        p.addQuadCurve(to: CGPoint(x: r.minX, y: r.maxY - rad), control: CGPoint(x: r.minX, y: r.maxY))
        p.closeSubpath()
        return p
    }
}

/// Rostinho de tela: pisca, olha para os lados pensando, "fala" mexendo a boca.
struct RobotFace: View {
    let mode: Mode
    let size: CGFloat
    let accent: Color
    var asleep = false
    var bouncing = false

    var body: some View {
        TimelineView(.animation(minimumInterval: bouncing ? 1.0 / 24.0 : 1.0 / 12.0, paused: false)) { ctx in
            face(t: ctx.date.timeIntervalSinceReferenceDate)
        }
        .frame(width: size, height: size * 0.8)
    }

    private func face(t: Double) -> some View {
        let blinking = t.truncatingRemainder(dividingBy: 4.2) < 0.15
        let eyeW = size * 0.16
        var eyeH = size * (mode == .listening ? 0.30 : 0.24)
        if (blinking && mode != .listening) || asleep { eyeH = size * 0.04 }
        let bounce: CGFloat = bouncing ? -abs(CGFloat(sin(t * 10))) * size * 0.08 : 0
        let lookX: CGFloat = mode == .thinking ? CGFloat(sin(t * 2.5)) * size * 0.08 : 0
        let lookY: CGFloat = mode == .thinking ? -size * 0.05 : 0
        let mouthH: CGFloat = mode == .speaking ? size * (0.04 + 0.08 * CGFloat(abs(sin(t * 11)))) : size * 0.035
        let mouthW: CGFloat = mode == .listening ? size * 0.10 : size * 0.22
        let glow: CGFloat = mode == .idle ? 0 : size * 0.12

        return ZStack {
            RoundedRectangle(cornerRadius: size * 0.26, style: .continuous)
                .fill(Color(white: 0.10))
            RoundedRectangle(cornerRadius: size * 0.26, style: .continuous)
                .strokeBorder(accent.opacity(0.55), lineWidth: max(1, size * 0.045))
            VStack(spacing: size * 0.08) {
                HStack(spacing: size * 0.17) {
                    Capsule().fill(accent).frame(width: eyeW, height: eyeH)
                    Capsule().fill(accent).frame(width: eyeW, height: eyeH)
                }
                .frame(height: size * 0.30)
                .offset(x: lookX, y: lookY)
                Capsule().fill(accent.opacity(0.85)).frame(width: mouthW, height: mouthH)
            }
        }
        .shadow(color: accent.opacity(glow > 0 ? 0.6 : 0), radius: glow)
        .offset(y: bounce)
    }
}

// MARK: - Raiz

struct RootView: View {
    @ObservedObject var state: AppState
    let assistant: Assistant
    let openSettings: @MainActor () -> Void

    var body: some View {
        ZStack(alignment: .top) {
            if state.expanded {
                ExpandedView(state: state, assistant: assistant, openSettings: openSettings)
                    .transition(.opacity)
            } else {
                PillView(state: state)
                    .transition(.opacity)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .environment(\.colorScheme, .dark)
        .animation(.easeOut(duration: 0.18), value: state.expanded)
    }
}

// MARK: - Ilha recolhida

struct PillView: View {
    @ObservedObject var state: AppState

    var body: some View {
        HStack(spacing: 8) {
            RobotFace(mode: state.mode, size: max(14, state.menuBarHeight - 7), accent: state.accent)
            if state.notchWidth > 0 { Spacer(minLength: state.notchWidth) }
            PillInfo(state: state)
                .frame(maxWidth: .infinity, alignment: state.notchWidth > 0 ? .trailing : .leading)
        }
        .padding(.horizontal, 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(NotchShape(radius: 10).fill(Color.black))
        .contentShape(Rectangle())
        .onTapGesture {
            state.tab = .chat
            state.expanded = true
            state.wantsFocus = true
        }
    }
}

struct PillInfo: View {
    @ObservedObject var state: AppState

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            Text(text(now: ctx.date))
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.white)
                .lineLimit(1)
                .truncationMode(.tail)
        }
    }

    private func text(now: Date) -> String {
        switch state.mode {
        case .listening: return state.partial.isEmpty ? "Ouvindo…" : "🎙 " + state.partial
        case .thinking: return "Pensando…"
        default: break
        }
        if !state.pillText.isEmpty { return state.pillText }
        if let t = state.timers.min(by: { $0.end < $1.end }) {
            return "⏱ " + Fmt.countdown(t.end.timeIntervalSince(now)) + (t.label.isEmpty ? "" : " · \(t.label)")
        }
        if let np = state.nowPlaying, np.playing { return "♪ \(np.title) — \(np.artist)" }
        return Fmt.time(now)
    }
}

// MARK: - Ilha aberta

struct ExpandedView: View {
    @ObservedObject var state: AppState
    let assistant: Assistant
    let openSettings: @MainActor () -> Void

    var body: some View {
        VStack(spacing: 0) {
            if state.notchWidth > 0 {
                Color.clear.frame(height: state.menuBarHeight - 6)
            }
            HStack(alignment: .top, spacing: 0) {
                sidebar
                    .frame(width: 168)
                Rectangle().fill(Color.white.opacity(0.08)).frame(width: 1)
                VStack(spacing: 10) {
                    header
                    content
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    if let np = state.nowPlaying {
                        MusicBar(np: np, assistant: assistant, accent: state.accent)
                    }
                }
                .padding(.leading, 14)
            }
        }
        .padding(.horizontal, 14)
        .padding(.top, 10)
        .padding(.bottom, 14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(NotchShape(radius: 24).fill(Color.black.opacity(0.95)))
    }

    // Menu lateral: rostinho, nome, nível e abas
    private var sidebar: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 8) {
                RobotFace(mode: state.mode, size: 34, accent: state.accent)
                VStack(alignment: .leading, spacing: 3) {
                    Text(state.assistantName)
                        .font(.system(size: 13, weight: .bold))
                        .lineLimit(1)
                    HStack(spacing: 5) {
                        Text("Nv \(state.level)")
                            .font(.system(size: 9, weight: .heavy))
                            .foregroundColor(state.accent)
                        ProgressView(value: state.levelProgress)
                            .progressViewStyle(.linear)
                            .tint(state.accent)
                            .frame(width: 60)
                    }
                }
            }
            .padding(.bottom, 8)

            ForEach(PanelTab.allCases) { tab in
                Button {
                    state.tab = tab
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: tab.icon)
                            .frame(width: 16)
                            .foregroundColor(state.tab == tab ? .black : state.accent)
                        Text(tab.title)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(state.tab == tab ? .black : .white)
                        Spacer()
                        if let badge = badge(tab) {
                            Text(badge)
                                .font(.system(size: 9, weight: .bold))
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1)
                                .background(Capsule().fill(Color.white.opacity(0.15)))
                                .foregroundColor(state.tab == tab ? .black : .white)
                        }
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .background(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(state.tab == tab ? state.accent : Color.clear)
                    )
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }

            Spacer(minLength: 4)

            Button {
                openSettings()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "gearshape.fill").frame(width: 16)
                    Text("Configurações").font(.system(size: 12))
                }
                .foregroundColor(.secondary)
                .padding(.horizontal, 8)
            }
            .buttonStyle(.plain)
        }
        .padding(.trailing, 10)
    }

    private func badge(_ tab: PanelTab) -> String? {
        switch tab {
        case .tasks:
            let n = state.tasks.filter { !$0.done }.count
            return n > 0 ? "\(n)" : nil
        case .habits:
            let done = state.habits.filter { $0.count >= $0.goal }.count
            return state.habits.isEmpty ? nil : "\(done)/\(state.habits.count)"
        case .timers:
            return state.timers.isEmpty ? nil : "\(state.timers.count)"
        default:
            return nil
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(state.tab == .home ? greeting : state.tab.title)
                    .font(.system(size: 16, weight: .bold))
                Text(subtitle)
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
            }
            Spacer()
            Button {
                state.pinned.toggle()
            } label: {
                Image(systemName: state.pinned ? "pin.fill" : "pin")
            }
            .buttonStyle(.plain)
            .help("Manter aberta")
        }
    }

    private var greeting: String {
        state.userName.isEmpty ? "\(Fmt.greeting())!" : "\(Fmt.greeting()), \(state.userName)!"
    }

    private var subtitle: String {
        switch state.mode {
        case .listening: return "Ouvindo…"
        case .thinking: return "Pensando…"
        case .speaking: return "Falando…"
        case .idle:
            return state.wakeEnabled
                ? "Diga “\(state.assistantName)” ou segure ⌥ Espaço"
                : "Escreva ou segure ⌥ Espaço para falar"
        }
    }

    @ViewBuilder
    private var content: some View {
        switch state.tab {
        case .home: HomeTab(state: state, assistant: assistant)
        case .chat: ChatTab(state: state, assistant: assistant)
        case .tasks: TasksTab(state: state)
        case .habits: HabitsTab(state: state)
        case .timers: TimersTab(state: state, assistant: assistant)
        case .clips: ClipsTab(state: state)
        case .routines: RoutinesTab(state: state, assistant: assistant)
        case .memory: MemoryTab(state: state)
        case .mymac: MyMacTab(state: state, assistant: assistant)
        }
    }
}

// MARK: - Conversa

struct Bubble: View {
    let text: String
    let fromUser: Bool
    let accent: Color
    var faded = false

    var body: some View {
        HStack {
            if fromUser { Spacer(minLength: 50) }
            Text(text)
                .font(.system(size: 13))
                .textSelection(.enabled)
                .padding(.horizontal, 11)
                .padding(.vertical, 7)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(fromUser ? accent.opacity(0.22) : Color.white.opacity(0.08))
                )
                .opacity(faded ? 0.55 : 1)
            if !fromUser { Spacer(minLength: 50) }
        }
    }
}

struct ChatTab: View {
    @ObservedObject var state: AppState
    let assistant: Assistant
    @State private var input = ""
    @FocusState private var focused: Bool

    private let suggestions = [
        "abre o Spotify",
        "timer de 10 minutos para a pizza",
        "me lembra de beber água em 30 minutos",
        "anota que preciso comprar café",
        "quanto é 15% de 230?",
        "me conta uma curiosidade rápida",
    ]

    var body: some View {
        VStack(spacing: 8) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 8) {
                        if state.messages.isEmpty { suggestionsView }
                        ForEach(state.messages) { m in
                            Bubble(text: m.text, fromUser: m.fromUser, accent: state.accent).id(m.id)
                        }
                        if state.mode == .listening && !state.partial.isEmpty {
                            Bubble(text: state.partial, fromUser: true, accent: state.accent, faded: true)
                        }
                    }
                    .padding(.vertical, 4)
                }
                .onChange(of: state.messages.count) { _ in
                    if let last = state.messages.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }

            HStack(spacing: 8) {
                TextField("Escreva para \(state.assistantName)…", text: $input)
                    .textFieldStyle(.plain)
                    .focused($focused)
                    .onSubmit(send)
                    .onExitCommand {
                        state.pinned = false
                        state.inputFocused = false
                        state.expanded = false
                    }
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
                .help("Falar")

                Button(action: send) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 24))
                        .foregroundColor(state.accent)
                }
                .buttonStyle(.plain)
                .disabled(input.trimmed.isEmpty)
            }
        }
        .onChange(of: focused) { v in state.inputFocused = v }
        .onChange(of: state.wantsFocus) { _ in takeFocusIfWanted() }
        .onAppear { takeFocusIfWanted() }
    }

    private var suggestionsView: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Experimente:")
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(.secondary)
            ForEach(suggestions, id: \.self) { s in
                Button {
                    assistant.handle(s)
                } label: {
                    Text(s)
                        .font(.system(size: 12))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Capsule().fill(Color.white.opacity(0.07)))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 4)
    }

    private func takeFocusIfWanted() {
        guard state.wantsFocus else { return }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 150_000_000)
            focused = true
            state.wantsFocus = false
        }
    }

    private func send() {
        let t = input.trimmed
        guard !t.isEmpty else { return }
        input = ""
        assistant.handle(t)
    }
}

// MARK: - Tarefas

struct TasksTab: View {
    @ObservedObject var state: AppState
    @State private var newTask = ""

    private var sorted: [TaskItem] {
        state.tasks.filter { !$0.done } + state.tasks.filter { $0.done }.suffix(10)
    }

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                TextField("Nova tarefa…", text: $newTask)
                    .textFieldStyle(.plain)
                    .onSubmit(add)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.08)))
                Button("Adicionar", action: add)
            }
            if state.tasks.isEmpty {
                Spacer()
                Text("Nenhuma tarefa. Diga “cria a tarefa …”")
                    .foregroundColor(.secondary)
                Spacer()
            } else {
                ScrollView {
                    VStack(spacing: 4) {
                        ForEach(sorted) { t in row(t) }
                    }
                }
            }
        }
    }

    private func row(_ t: TaskItem) -> some View {
        HStack(spacing: 10) {
            Button {
                if let i = state.tasks.firstIndex(where: { $0.id == t.id }) {
                    state.tasks[i].done.toggle()
                    if state.tasks[i].done { state.addXP(10) }
                }
            } label: {
                Image(systemName: t.done ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(t.done ? state.accent : .secondary)
            }
            .buttonStyle(.plain)
            Text(t.text)
                .strikethrough(t.done)
                .foregroundColor(t.done ? .secondary : .primary)
            Spacer()
            Button {
                state.tasks.removeAll { $0.id == t.id }
            } label: {
                Image(systemName: "trash").foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 8)
        .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.04)))
    }

    private func add() {
        let t = newTask.trimmed
        guard !t.isEmpty else { return }
        state.tasks.append(TaskItem(text: t))
        newTask = ""
    }
}

// MARK: - Timers

struct TimersTab: View {
    @ObservedObject var state: AppState
    let assistant: Assistant

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                quick("5 min", 300, "")
                quick("10 min", 600, "")
                quick("Foco 25 min", 1500, "foco")
            }
            if state.timers.isEmpty {
                Spacer()
                Text("Nenhum timer rodando. Diga “timer de 10 minutos”.")
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                Spacer()
            } else {
                TimelineView(.periodic(from: .now, by: 1)) { ctx in
                    ScrollView {
                        VStack(spacing: 6) {
                            ForEach(state.timers) { t in row(t, now: ctx.date) }
                        }
                    }
                }
            }
        }
    }

    private func quick(_ title: String, _ secs: Double, _ label: String) -> some View {
        Button(title) { assistant.actions.startTimer(secs, label: label, reminder: false) }
    }

    private func row(_ t: RunningTimer, now: Date) -> some View {
        HStack {
            Image(systemName: t.isReminder ? "bell.fill" : "timer")
                .foregroundColor(state.accent)
            Text(t.label.isEmpty ? "Timer" : t.label)
            Spacer()
            Text(Fmt.countdown(t.end.timeIntervalSince(now)))
                .font(.system(size: 15, weight: .semibold, design: .monospaced))
            Button {
                assistant.actions.cancelTimer(t.id)
            } label: {
                Image(systemName: "xmark.circle.fill").foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
        }
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.05)))
    }
}

// MARK: - Memória

struct MemoryTab: View {
    @ObservedObject var state: AppState
    @State private var newFact = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Coisas que a \(state.assistantName) sabe sobre você (vão junto em cada pergunta para a IA).")
                .font(.system(size: 11))
                .foregroundColor(.secondary)
            HStack {
                TextField("Ex.: meu time é o Grêmio", text: $newFact)
                    .textFieldStyle(.plain)
                    .onSubmit(add)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.08)))
                Button("Guardar", action: add)
            }
            if state.memories.isEmpty {
                Spacer()
                Text("Vazia. Diga “lembra que eu gosto de café sem açúcar”.")
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                Spacer()
            } else {
                ScrollView {
                    VStack(spacing: 4) {
                        ForEach(Array(state.memories.enumerated()), id: \.offset) { i, fact in
                            HStack {
                                Image(systemName: "brain").foregroundColor(state.accent)
                                Text(fact)
                                Spacer()
                                Button {
                                    if i < state.memories.count { state.memories.remove(at: i) }
                                } label: {
                                    Image(systemName: "trash").foregroundColor(.secondary)
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(8)
                            .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.04)))
                        }
                    }
                }
            }
        }
    }

    private func add() {
        let f = newFact.trimmed
        guard !f.isEmpty else { return }
        state.memories.append(f)
        newFact = ""
    }
}

// MARK: - Música

struct MusicBar: View {
    let np: NowPlaying
    let assistant: Assistant
    let accent: Color

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "music.note")
                .foregroundColor(accent)
            VStack(alignment: .leading, spacing: 1) {
                Text(np.title)
                    .font(.system(size: 12, weight: .semibold))
                    .lineLimit(1)
                Text("\(np.artist) · \(np.app)")
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            HStack(spacing: 16) {
                control("backward.fill", "previous")
                control(np.playing ? "pause.fill" : "play.fill", "toggle")
                control("forward.fill", "next")
            }
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.06)))
    }

    private func control(_ icon: String, _ cmd: String) -> some View {
        Button {
            _ = assistant.actions.run(.music(cmd))
            assistant.refreshMusicSoon()
        } label: {
            Image(systemName: icon)
        }
        .buttonStyle(.plain)
    }
}
