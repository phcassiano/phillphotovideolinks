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
    var announce: (@MainActor (String) -> Void)?
    private var handles: [UUID: Timer] = [:]

    init(state: AppState, music: MusicController) {
        self.state = state
        self.music = music
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

        case .completeTask(let text):
            let t = Words.normalize(text)
            let i = state.tasks.firstIndex { !$0.done && Words.normalize($0.text).contains(t) }
                ?? state.tasks.firstIndex { !$0.done && t.contains(Words.normalize($0.text)) }
            guard let i else { return "Não achei essa tarefa." }
            state.tasks[i].done = true
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
