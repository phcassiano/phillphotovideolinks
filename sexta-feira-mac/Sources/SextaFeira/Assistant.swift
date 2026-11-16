import AppKit

/// O "cérebro": recebe pedidos (texto ou voz), resolve comandos rápidos,
/// pergunta à IA quando precisa, executa as ações e responde.
@MainActor
final class Assistant {
    let state: AppState
    let speech = SpeechService()
    let speaker = Speaker()
    let music: MusicController
    let actions: ActionRunner

    private var history: [ChatTurn] = []
    private var busy: Task<Void, Never>?
    private var pillTimer: Timer?
    private var musicTimer: Timer?
    private var wantPush = false

    init(state: AppState) {
        self.state = state
        let music = MusicController()
        self.music = music
        self.actions = ActionRunner(state: state, music: music)

        speech.onPartial = { [weak self] text in self?.state.partial = text }
        speech.onListeningChanged = { [weak self] on in self?.listeningChanged(on) }
        speech.onCommand = { [weak self] text in self?.handle(text, fromVoice: true) }
        speaker.onFinish = { [weak self] in self?.speechFinished() }
        actions.announce = { [weak self] msg in self?.respond(msg) }

        musicTimer = every(2) { [weak self] in self?.refreshMusic() }
        refreshMusic()
    }

    // MARK: Preferências

    func applyPrefs() {
        state.assistantName = Prefs.assistantName
        state.userName = Prefs.userName
        state.accentIndex = Prefs.accent
        state.wakeEnabled = Prefs.wakeEnabled
        speech.wakePhrase = Prefs.assistantName

        if Prefs.wakeEnabled {
            SpeechService.requestPermissions { [weak self] ok in
                guard let self else { return }
                self.speech.setWake(ok)
                if !ok { self.permissionProblem() }
            }
        } else {
            speech.setWake(false)
        }
    }

    // MARK: Música

    func refreshMusic() {
        let np = music.nowPlaying()
        if np != state.nowPlaying { state.nowPlaying = np }
    }

    func refreshMusicSoon() {
        after(0.5) { [weak self] in self?.refreshMusic() }
    }

    // MARK: Voz

    func startListening() {
        wantPush = true
        interrupt()
        SpeechService.requestPermissions { [weak self] ok in
            guard let self, self.wantPush else { return }
            if ok { self.speech.beginPush() } else { self.permissionProblem() }
        }
    }

    func stopListening() {
        wantPush = false
        speech.endPush()
    }

    func toggleListening() {
        if speech.isPushing { stopListening() } else { startListening() }
    }

    func interrupt() {
        speaker.stop()
        busy?.cancel()
    }

    private func listeningChanged(_ on: Bool) {
        if on {
            speaker.stop()
            state.partial = ""
            state.pillText = ""
            state.mode = .listening
        } else if state.mode == .listening {
            state.mode = .idle
            state.partial = ""
        }
    }

    private func speechFinished() {
        if state.mode == .speaking { state.mode = .idle }
        speech.resume()
        schedulePillClear(3)
    }

    private func permissionProblem() {
        respond("Preciso de permissão para o microfone e o reconhecimento de fala. Libere em Ajustes do Sistema › Privacidade e Segurança.", speak: false)
    }

    // MARK: Pedidos

    func handle(_ raw: String, fromVoice: Bool = false) {
        var text = raw.trimmed
        if !fromVoice, let rest = Words.textAfter(phrase: Prefs.assistantName, in: text, atStart: true) {
            text = rest.trimmed
        }
        guard !text.isEmpty else {
            if state.mode == .listening { state.mode = .idle }
            return
        }
        interrupt()
        let display = String(text.prefix(1)).uppercased() + String(text.dropFirst())
        state.messages.append(ChatMessage(fromUser: true, text: display))
        state.partial = ""

        // 1) Comandos rápidos (sem IA)
        if let quick = QuickCommands.parse(text) {
            let problems = quick.actions.compactMap { actions.run($0) }
            let say = problems.first ?? quick.say
            addToHistory(user: text, say: say)
            refreshMusicSoon()
            respond(say)
            return
        }

        // 2) IA
        state.mode = .thinking
        state.pillText = ""
        let request = text
        let system = systemPrompt()
        let turns = recentHistory() + [ChatTurn(role: "user", text: request)]

        busy = Task { [weak self] in
            do {
                let raw = try await AIClient.complete(system: system, turns: turns)
                guard let self else { return }
                let reply = ReplyParser.parse(raw)
                self.history.append(ChatTurn(role: "user", text: request))
                self.history.append(ChatTurn(role: "assistant", text: raw))
                self.trimHistory()
                let problems = reply.actions.compactMap { self.actions.run($0) }
                var say = reply.say
                if !problems.isEmpty {
                    say = ([say] + problems).filter { !$0.isEmpty }.joined(separator: " ")
                }
                self.refreshMusicSoon()
                self.respond(say.isEmpty ? "Feito." : say)
            } catch {
                guard let self else { return }
                if error is CancellationError || (error as? URLError)?.code == .cancelled {
                    if self.state.mode == .thinking { self.state.mode = .idle }
                    return
                }
                self.respond("⚠️ " + error.localizedDescription, speak: false)
            }
        }
    }

    func respond(_ say: String, speak: Bool = true) {
        let text = say.trimmed
        guard !text.isEmpty else {
            if state.mode != .listening { state.mode = .idle }
            return
        }
        state.messages.append(ChatMessage(fromUser: false, text: text))
        state.pillText = text
        pillTimer?.invalidate()
        if speak && Prefs.speakReplies {
            state.mode = .speaking
            speech.pause()
            speaker.speak(Self.forSpeech(text))
        } else {
            state.mode = .idle
            schedulePillClear(6)
        }
    }

    private func schedulePillClear(_ seconds: TimeInterval) {
        pillTimer?.invalidate()
        pillTimer = after(seconds) { [weak self] in
            guard let self, self.state.mode == .idle else { return }
            self.state.pillText = ""
        }
    }

    /// Tira emojis para a voz não ler "rosto sorridente".
    private static func forSpeech(_ s: String) -> String {
        let scalars = s.unicodeScalars.filter { u in
            !(u.properties.isEmojiPresentation || (0x2600...0x27BF).contains(u.value) || u.value >= 0x1F000)
        }
        return String(String.UnicodeScalarView(scalars))
    }

    // MARK: Contexto para a IA

    private func addToHistory(user: String, say: String) {
        let payload: [String: Any] = ["say": say, "actions": [Any]()]
        let json = (try? JSONSerialization.data(withJSONObject: payload)).map { String(decoding: $0, as: UTF8.self) } ?? say
        history.append(ChatTurn(role: "user", text: user))
        history.append(ChatTurn(role: "assistant", text: json))
        trimHistory()
    }

    private func trimHistory() {
        if history.count > 40 { history.removeFirst(history.count - 40) }
    }

    private func recentHistory() -> [ChatTurn] {
        var h = Array(history.suffix(16))
        while let first = h.first, first.role != "user" { h.removeFirst() }
        return h
    }

    private func systemPrompt() -> String {
        let name = Prefs.assistantName
        let user = Prefs.userName.isEmpty ? "o usuário" : Prefs.userName

        var ctx = "Agora: \(Fmt.longDate(Date())).\n"
        if !state.memories.isEmpty {
            ctx += "\nO que você sabe sobre \(user):\n" + state.memories.map { "- \($0)" }.joined(separator: "\n") + "\n"
        }
        let open = state.tasks.filter { !$0.done }.prefix(15)
        if !open.isEmpty {
            ctx += "\nTarefas abertas:\n" + open.map { "- \($0.text)" }.joined(separator: "\n") + "\n"
        }
        if let np = state.nowPlaying {
            ctx += "\nMúsica: \(np.playing ? "tocando" : "pausada") “\(np.title)” de \(np.artist) (\(np.app)).\n"
        }
        if !state.timers.isEmpty {
            ctx += "\nTimers ativos: " + state.timers.map { "\($0.label.isEmpty ? "timer" : $0.label) (faltam \(Fmt.countdown($0.end.timeIntervalSinceNow)))" }.joined(separator: ", ") + "\n"
        }

        return """
        Você é \(name), uma assistente pessoal que vive no topo da tela do Mac de \(user). \
        Fale português do Brasil, com um jeito simpático, esperto e direto. \
        Suas respostas são faladas em voz alta: seja breve (no máximo 2 frases curtas), sem markdown, sem listas e sem emojis.

        \(ctx)
        Responda SEMPRE com um único objeto JSON, sem nada antes ou depois, neste formato:
        {"say": "o que você vai falar", "actions": []}

        "actions" é uma lista (pode ser vazia) com as ações abaixo:
        - {"type":"open_app","app":"Nome do app"}
        - {"type":"quit_app","app":"Nome do app"}
        - {"type":"open_url","url":"https://..."}
        - {"type":"web_search","query":"..."}
        - {"type":"music","command":"play|pause|toggle|next|previous"}
        - {"type":"music_search","query":"artista ou música"}  (abre a busca no Spotify)
        - {"type":"volume","level":0-100}  ou  {"type":"volume","change":10}  (negativo abaixa)
        - {"type":"timer","seconds":600,"label":"pizza"}
        - {"type":"reminder","text":"ligar pro cliente","minutes":30}  ou  {"type":"reminder","text":"...","at":"16:30"}
        - {"type":"add_task","text":"..."}
        - {"type":"complete_task","text":"..."}
        - {"type":"note","text":"..."}
        - {"type":"remember","fact":"..."}  (use quando \(user) pedir para lembrar algo, ou contar algo importante e duradouro sobre si)
        - {"type":"forget","fact":"..."}
        - {"type":"shortcut","name":"Nome do atalho"}  (roda um atalho do app Atalhos)

        Regras:
        - Só use ações quando o pedido pedir. Para conversa normal, "actions" fica vazia.
        - Para informação em tempo real que você não tem (clima, cotação, notícias, resultados de jogos), use web_search e diga que abriu a pesquisa.
        - Para abrir um site conhecido (YouTube, Gmail, Instagram…), use open_url.
        - Em "say", confirme o que fez em poucas palavras.
        """
    }
}
