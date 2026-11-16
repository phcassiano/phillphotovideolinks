import AppKit
import UserNotifications

enum AppleScript {
    /// Executa um AppleScript. Devolve `nil` se deu erro.
    @discardableResult
    static func run(_ source: String) -> NSAppleEventDescriptor? {
        var error: NSDictionary?
        guard let script = NSAppleScript(source: source) else { return nil }
        let result = script.executeAndReturnError(&error)
        if let error {
            NSLog("AppleScript erro: %@", error)
            return nil
        }
        return result
    }
}

enum SystemControl {
    static func volume() -> Int {
        Int(AppleScript.run("output volume of (get volume settings)")?.int32Value ?? 50)
    }

    static func setVolume(_ v: Int) {
        AppleScript.run("set volume output volume \(min(100, max(0, v)))")
    }

    /// Roda um atalho do app Atalhos.
    static func runShortcut(_ name: String) {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/usr/bin/shortcuts")
        p.arguments = ["run", name]
        try? p.run()
    }
}

enum Notifier {
    static func post(title: String, body: String) {
        let c = UNMutableNotificationContent()
        c.title = title
        c.body = body
        c.sound = .default
        let req = UNNotificationRequest(identifier: UUID().uuidString, content: c, trigger: nil)
        UNUserNotificationCenter.current().add(req, withCompletionHandler: nil)
    }
}

/// Acha um app instalado pelo nome falado ("abre a calculadora").
enum AppFinder {
    static let aliases: [String: String] = [
        "zap": "whatsapp", "whats": "whatsapp", "navegador": "safari", "chrome": "google chrome",
        "calculadora": "calculator", "calendario": "calendar", "agenda": "calendar",
        "lembretes": "reminders", "notas": "notes", "fotos": "photos", "musica": "music",
        "mensagens": "messages", "mapas": "maps", "configuracoes": "system settings",
        "ajustes": "system settings", "preferencias": "system settings", "loja": "app store",
        "contatos": "contacts", "relogio": "clock", "atalhos": "shortcuts", "visualizar": "preview",
        "pre visualizacao": "preview", "editor de texto": "textedit", "monitor de atividade": "activity monitor",
        "arquivos": "finder", "livros": "books", "email": "mail", "e mail": "mail",
    ]

    static let dirs = [
        "/Applications", "/Applications/Utilities", "/System/Applications",
        "/System/Applications/Utilities", NSHomeDirectory() + "/Applications",
    ]

    static func find(_ name: String) -> URL? {
        var target = Words.normalize(name)
        if let a = aliases[target] { target = a }
        guard target.count >= 2 else { return nil }
        if target == "finder" { return URL(fileURLWithPath: "/System/Library/CoreServices/Finder.app") }

        var best: URL?
        var bestScore = 0
        for dir in dirs {
            guard let items = try? FileManager.default.contentsOfDirectory(atPath: dir) else { continue }
            for item in items where item.hasSuffix(".app") {
                let url = URL(fileURLWithPath: dir).appendingPathComponent(item)
                let names = [Words.normalize(String(item.dropLast(4))), Words.normalize(displayName(url))]
                for n in names where !n.isEmpty {
                    var score = 0
                    if n == target { score = 4 }
                    else if n.hasPrefix(target) { score = 3 }
                    else if n.contains(target) { score = 2 }
                    else if target.contains(n) && n.count >= 4 { score = 1 }
                    if score > bestScore {
                        bestScore = score
                        best = url
                    }
                }
            }
        }
        return best
    }

    static func displayName(_ url: URL) -> String {
        var n = FileManager.default.displayName(atPath: url.path)
        if n.hasSuffix(".app") { n = String(n.dropLast(4)) }
        return n
    }
}

/// Controla o Spotify ou o app Música via AppleScript.
@MainActor
final class MusicController {
    static let spotify = "com.spotify.client"
    static let appleMusic = "com.apple.Music"
    private var warned = false

    private func running(_ id: String) -> Bool {
        !NSRunningApplication.runningApplications(withBundleIdentifier: id).isEmpty
    }

    private func installed(_ id: String) -> Bool {
        NSWorkspace.shared.urlForApplication(withBundleIdentifier: id) != nil
    }

    private var target: String? {
        if running(Self.spotify) { return Self.spotify }
        if running(Self.appleMusic) { return Self.appleMusic }
        return nil
    }

    func command(_ cmd: String) -> String? {
        let verbs = ["play": "play", "pause": "pause", "toggle": "playpause",
                     "next": "next track", "previous": "previous track"]
        guard let verb = verbs[cmd] else { return nil }
        let id = target ?? (installed(Self.spotify) ? Self.spotify : Self.appleMusic)
        if AppleScript.run("tell application id \"\(id)\" to \(verb)") == nil {
            return "Não consegui controlar a música. Libere em Ajustes do Sistema › Privacidade e Segurança › Automação."
        }
        return nil
    }

    func search(_ query: String) {
        if installed(Self.spotify), let url = URL(string: "spotify:search:\(Words.urlEncode(query))") {
            NSWorkspace.shared.open(url)
        } else if let url = URL(string: "music://music.apple.com/search?term=\(Words.urlEncode(query))") {
            NSWorkspace.shared.open(url)
        }
    }

    func nowPlaying() -> NowPlaying? {
        guard let id = target else { return nil }
        let src = """
        tell application id "\(id)"
            if player state is stopped then return "stopped"
            return (player state as string) & "|||" & (name of current track) & "|||" & (artist of current track)
        end tell
        """
        guard let s = AppleScript.run(src)?.stringValue else {
            if !warned { warned = true; NSLog("Sem permissão de Automação para ler a música.") }
            return nil
        }
        let p = s.components(separatedBy: "|||")
        guard s != "stopped", p.count == 3 else { return nil }
        return NowPlaying(title: p[1], artist: p[2], playing: p[0] == "playing",
                          app: id == Self.spotify ? "Spotify" : "Música")
    }
}

/// Executa as ações pedidas.
@MainActor
final class ActionRunner {
    let state: AppState
    let music: MusicController
    let checker: MacChecker
    let tools: MacTools
    var announce: (@MainActor (String) -> Void)?
    /// Roda uma função personalizada ou rotina pelo nome (configurado pelo Assistant).
    var runNamed: (@MainActor (String) -> String?)?
    private var handles: [UUID: Timer] = [:]

    init(state: AppState, music: MusicController, tools: MacTools) {
        self.state = state
        self.music = music
        self.tools = tools
        self.checker = MacChecker(state: state)
    }

    private func openTab(_ tab: PanelTab) {
        state.tab = tab
        state.expanded = true
    }

    /// Boost: limpa caches seguros e logs e verifica de novo, mostrando a nota antes e depois.
    func boost() {
        openTab(.mymac)
        let before = state.score
        let running = Set(NSWorkspace.shared.runningApplications.compactMap { $0.bundleIdentifier?.lowercased() })
        Task { @MainActor [weak self] in
            if self?.tools.helper.running == true { self?.tools.helper.requestPurge() }
            let items = await Task.detached { Cleaner.scan(running: running) }.value
            let safe = items.filter { $0.safe }
            let freed = await Task.detached { Cleaner.clean(safe) }.value
            guard let self else { return }
            self.state.addXP(20)
            self.checker.run { [weak self] _ in
                guard let self else { return }
                let after = self.state.score ?? 0
                var msg = "Boost feito! Liberei \(MacInfo.bytes(freed))."
                if let b = before { msg += " Nota de \(b) para \(after)." } else { msg += " Nota: \(after) de 100." }
                self.announce?(msg)
            }
        }
    }

    /// Abre o destino de uma função personalizada: site, pasta, arquivo ou app.
    func openTarget(_ target: String) -> String? {
        let t = target.trimmed
        guard !t.isEmpty else { return "Essa função não tem destino." }
        if t.contains("://") || t.hasPrefix("www.") { return run(.openURL(t)) }
        let path = (t as NSString).expandingTildeInPath
        if FileManager.default.fileExists(atPath: path) {
            NSWorkspace.shared.open(URL(fileURLWithPath: path))
            return nil
        }
        if AppFinder.find(t) != nil { return run(.openApp(t)) }
        if t.contains(".") { return run(.openURL(t)) }
        return "Não achei “\(t)”."
    }

    /// Devolve uma frase só quando algo deu errado ou precisa de aviso.
    func run(_ action: Action) -> String? {
        switch action {
        case .openApp(let name):
            guard let url = AppFinder.find(name) else { return "Não encontrei o app \(name)." }
            NSWorkspace.shared.openApplication(at: url, configuration: NSWorkspace.OpenConfiguration())
            return nil

        case .quitApp(let name):
            let target = Words.normalize(name)
            let apps = NSWorkspace.shared.runningApplications.filter { $0.activationPolicy == .regular }
            let exact = apps.first { Words.normalize($0.localizedName ?? "") == target }
            let partial = apps.first { Words.normalize($0.localizedName ?? "").contains(target) }
            if let app = exact ?? partial {
                app.terminate()
                return nil
            }
            return "O \(name) não está aberto."

        case .openURL(let raw):
            var s = raw.trimmed
            if !s.contains("://") { s = "https://" + s }
            guard let url = URL(string: s) else { return "Esse link não parece válido." }
            NSWorkspace.shared.open(url)
            return nil

        case .webSearch(let q):
            if let url = URL(string: "https://www.google.com/search?q=\(Words.urlEncode(q))") {
                NSWorkspace.shared.open(url)
            }
            return nil

        case .music(let cmd):
            return music.command(cmd)

        case .musicSearch(let q):
            music.search(q)
            return nil

        case .volumeSet(let v):
            SystemControl.setVolume(v)
            return nil

        case .volumeChange(let delta):
            SystemControl.setVolume(SystemControl.volume() + delta)
            return nil

        case .timer(let secs, let label):
            startTimer(secs, label: label, reminder: false)
            return nil

        case .reminder(let secs, let text):
            startTimer(secs, label: text, reminder: true)
            return nil

        case .addTask(let text):
            state.tasks.append(TaskItem(text: text))
            return nil

        case .habit(let name):
            let t = Words.normalize(name)
            guard let i = state.habits.firstIndex(where: {
                let n = Words.normalize($0.name)
                return n.contains(t) || t.contains(n)
            }) else { return "Não achei o hábito \(name)." }
            state.habits[i].count += 1
            state.addXP(3)
            return nil

        case .copyPix:
            let key = Prefs.pixKey.trimmed
            guard !key.isEmpty else { return "Você ainda não cadastrou sua chave Pix nas Configurações." }
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(key, forType: .string)
            return nil

        case .checkMac:
            openTab(.mymac)
            checker.run { [weak self] summary in self?.announce?(summary) }
            return nil

        case .image(let prompt):
            Task { @MainActor [weak self] in
                do {
                    let file = try await ImageGen.generate(prompt)
                    NSWorkspace.shared.open(file)
                    self?.announce?("Sua arte ficou pronta! Salvei em Imagens › Sexta-feira.")
                } catch {
                    self?.announce?("Não consegui criar a imagem: \(error.localizedDescription)")
                }
            }
            return nil

        case .boost:
            boost()
            return nil

        case .battery:
            openTab(.battery)
            tools.slowRefresh()
            announce?(tools.batterySummary())
            return nil

        case .agenda:
            openTab(.agenda)
            if !tools.agendaAllowed {
                tools.requestAgenda()
                return "Preciso de acesso à sua agenda: aceite o pedido do macOS e pergunte de novo."
            }
            announce?(tools.agendaSummary())
            return nil

        case .caffeine(let minutes):
            tools.setCaffeine(minutes: minutes)
            return nil

        case .caffeineOff:
            tools.stopCaffeine()
            return nil

        case .window(let snap):
            return WindowManager.snap(snap)

        case .audioOutput(let name):
            return tools.setOutput(named: name)

        case .brightness(let level):
            tools.refreshDisplays()
            tools.setAllDim(Double(max(15, min(100, level))) / 100)
            return nil

        case .fan(let mode):
            let h = tools.helper
            guard h.running else {
                openTab(.fans)
                return "Para controlar a ventoinha, instale o ajudante na aba Ventoinha."
            }
            let fan = tools.fans.first
            switch mode {
            case "automatico", "automatica", "auto", "normal":
                h.fanMode = "auto"
            case "maximo", "max", "maxima":
                h.fanRPM = fan?.max ?? 6000
                h.fanMode = "manual"
            case "silencioso", "silenciosa", "minimo", "minima":
                h.fanRPM = fan?.min ?? 1200
                h.fanMode = "manual"
            default:
                if let f = fan { h.fanRPM = (f.min + f.max) / 2 }
                h.fanMode = "manual"
            }
            return nil

        case .chargeLimit(let limit):
            let h = tools.helper
            guard h.running else {
                openTab(.battery)
                return "Para o limite real, instale o ajudante na aba Bateria (pede sua senha uma vez)."
            }
            if let l = limit {
                h.limit = max(50, min(100, l))
                h.limitEnabled = true
            } else {
                h.limitEnabled = false
            }
            return nil

        case .topUp:
            guard tools.helper.running else { return "O ajudante não está instalado." }
            tools.helper.topUp = true
            return nil

        case .equalizer(let preset):
            if Words.normalize(preset) == "off" {
                tools.eq.stop()
                return nil
            }
            openTab(.windows)
            if !tools.eq.apply(preset: preset) {
                tools.eq.start()
                return "Liguei o equalizador. Os modos são: " + EqualizerController.presets.map { $0.name }.joined(separator: ", ") + "."
            }
            return tools.eq.error.isEmpty ? nil : tools.eq.error

        case .run(let name):
            return runNamed?(name) ?? "Não achei a função ou rotina “\(name)”."

        case .completeTask(let text):
            let t = Words.normalize(text)
            let i = state.tasks.firstIndex { !$0.done && Words.normalize($0.text).contains(t) }
                ?? state.tasks.firstIndex { !$0.done && t.contains(Words.normalize($0.text)) }
            guard let i else { return "Não achei essa tarefa." }
            state.tasks[i].done = true
            state.addXP(10)
            return nil

        case .note(let text):
            Storage.appendNote(text)
            return nil

        case .remember(let fact):
            if !state.memories.contains(fact) { state.memories.append(fact) }
            return nil

        case .forget(let fact):
            let t = Words.normalize(fact)
            let before = state.memories.count
            state.memories.removeAll {
                let m = Words.normalize($0)
                return m.contains(t) || t.contains(m)
            }
            return state.memories.count == before ? "Não achei isso na memória." : nil

        case .shortcut(let name):
            SystemControl.runShortcut(name)
            return nil
        }
    }

    func startTimer(_ secs: Double, label: String, reminder: Bool) {
        let item = RunningTimer(label: label, end: Date().addingTimeInterval(secs), isReminder: reminder)
        state.timers.append(item)
        let id = item.id
        handles[id] = after(secs) { [weak self] in self?.fired(id) }
    }

    func cancelTimer(_ id: UUID) {
        handles[id]?.invalidate()
        handles[id] = nil
        state.timers.removeAll { $0.id == id }
    }

    private func fired(_ id: UUID) {
        handles[id] = nil
        guard let i = state.timers.firstIndex(where: { $0.id == id }) else { return }
        let t = state.timers.remove(at: i)
        NSSound(named: "Glass")?.play()
        let msg: String
        if t.isReminder {
            msg = "Lembrete: \(t.label)"
        } else {
            msg = t.label.isEmpty ? "Seu timer acabou!" : "O timer \(t.label) acabou!"
        }
        Notifier.post(title: state.assistantName, body: msg)
        announce?(msg)
    }
}
