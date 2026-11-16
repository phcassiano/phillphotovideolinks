import SwiftUI
import Security

enum Mode { case idle, listening, thinking, speaking }

struct ChatMessage: Identifiable, Equatable {
    let id = UUID()
    let fromUser: Bool
    let text: String
}

struct TaskItem: Codable, Identifiable, Equatable {
    var id = UUID()
    var text: String
    var done = false
    var created = Date()
}

struct RunningTimer: Identifiable, Equatable {
    let id = UUID()
    let label: String
    let end: Date
    let isReminder: Bool
}

struct NowPlaying: Equatable {
    let title: String
    let artist: String
    let playing: Bool
    let app: String
}

enum PanelTab: String, CaseIterable, Identifiable {
    case home, chat, tasks, habits, timers, clips, routines, memory, mymac
    var id: String { rawValue }
    var title: String {
        switch self {
        case .home: return "Início"
        case .chat: return "Conversa"
        case .tasks: return "Tarefas"
        case .habits: return "Hábitos"
        case .timers: return "Timers"
        case .clips: return "Copiados"
        case .routines: return "Rotinas"
        case .memory: return "Memória"
        case .mymac: return "Meu Mac"
        }
    }
    var icon: String {
        switch self {
        case .home: return "house.fill"
        case .chat: return "bubble.left.and.bubble.right.fill"
        case .tasks: return "checklist"
        case .habits: return "drop.fill"
        case .timers: return "timer"
        case .clips: return "doc.on.clipboard"
        case .routines: return "bolt.fill"
        case .memory: return "brain"
        case .mymac: return "laptopcomputer"
        }
    }
}

enum Palette {
    static let colors: [Color] = [
        Color(red: 0.49, green: 1.00, blue: 0.42),
        Color(red: 0.35, green: 0.85, blue: 1.00),
        Color(red: 1.00, green: 0.45, blue: 0.75),
        Color(red: 1.00, green: 0.65, blue: 0.30),
        Color(red: 0.70, green: 0.55, blue: 1.00),
        Color(red: 1.00, green: 0.88, blue: 0.35),
    ]
    static let names = ["Verde", "Azul", "Rosa", "Laranja", "Roxo", "Amarelo"]
}

/// Estado compartilhado entre a "ilha" e o assistente.
@MainActor
final class AppState: ObservableObject {
    @Published var expanded = false
    @Published var pinned = false
    @Published var inputFocused = false
    @Published var wantsFocus = false
    @Published var tab: PanelTab = .home

    @Published var mode: Mode = .idle
    @Published var partial = ""
    @Published var pillText = ""
    @Published var messages: [ChatMessage] = []
    @Published var timers: [RunningTimer] = []
    @Published var nowPlaying: NowPlaying?

    @Published var tasks: [TaskItem] = [] {
        didSet { Storage.save(tasks, "tarefas.json") }
    }
    @Published var memories: [String] = [] {
        didSet { Storage.save(memories, "memoria.json") }
    }
    @Published var habits: [Habit] = [] {
        didSet { Storage.save(habits, "habitos.json") }
    }
    @Published var customCommands: [CustomCommand] = [] {
        didSet { Storage.save(customCommands, "funcoes.json") }
    }
    @Published var routines: [Routine] = [] {
        didSet { Storage.save(routines, "rotinas.json") }
    }
    @Published var clips: [ClipItem] = []

    /// Nível e XP: cresce a cada pedido, tarefa concluída e hábito cumprido.
    @Published var xp: Int = UserDefaults.standard.integer(forKey: "xp") {
        didSet { UserDefaults.standard.set(xp, forKey: "xp") }
    }
    var level: Int { xp / 100 + 1 }
    var levelProgress: Double { Double(xp % 100) / 100 }

    @Published var scanSteps: [ScanStep] = []
    @Published var scanProgress: Double?
    @Published var report: [ReportLine] = []

    @Published var assistantName = Prefs.assistantName
    @Published var userName = Prefs.userName
    @Published var accentIndex = Prefs.accent
    @Published var wakeEnabled = Prefs.wakeEnabled

    @Published var notchWidth: CGFloat = 0
    @Published var menuBarHeight: CGFloat = 24

    var accent: Color {
        let n = Palette.colors.count
        return Palette.colors[((accentIndex % n) + n) % n]
    }

    init() {
        tasks = Storage.load([TaskItem].self, "tarefas.json") ?? []
        memories = Storage.load([String].self, "memoria.json") ?? []
        habits = Storage.load([Habit].self, "habitos.json") ?? Habit.defaults
        customCommands = Storage.load([CustomCommand].self, "funcoes.json") ?? []
        routines = Storage.load([Routine].self, "rotinas.json") ?? Routine.defaults
        rolloverHabits()
    }

    func addXP(_ n: Int) { xp += n }

    /// Zera os contadores de hábitos quando vira o dia.
    func rolloverHabits() {
        let today = Habit.today()
        guard habits.contains(where: { $0.day != today }) else { return }
        habits = habits.map { h in
            var h = h
            if h.day != today { h.count = 0; h.day = today }
            return h
        }
    }

    var waterHabit: Habit? {
        habits.first { Words.normalize($0.name).contains("agua") }
    }
}

/// Preferências (as mesmas chaves que a tela de Configurações usa via @AppStorage).
enum Prefs {
    static var d: UserDefaults { .standard }

    static let defaultGemini = "gemini-flash-latest"
    static let defaultClaude = "claude-opus-5-5"
    static let defaultOllama = "qwen2.5:7b"
    static let defaultOllamaURL = "http://localhost:11434"

    static var assistantName: String { d.string(forKey: "assistantName").nonEmpty ?? "Sexta-feira" }
    static var userName: String { d.string(forKey: "userName") ?? "" }
    static var provider: String { d.string(forKey: "provider").nonEmpty ?? "gemini" }
    static var geminiModel: String { d.string(forKey: "geminiModel").nonEmpty ?? defaultGemini }
    static var claudeModel: String { d.string(forKey: "claudeModel").nonEmpty ?? defaultClaude }
    static var ollamaModel: String { d.string(forKey: "ollamaModel").nonEmpty ?? defaultOllama }
    static var ollamaURL: String { d.string(forKey: "ollamaURL").nonEmpty ?? defaultOllamaURL }
    static var speakReplies: Bool { d.object(forKey: "speakReplies") as? Bool ?? true }
    static var wakeEnabled: Bool { d.bool(forKey: "wakeEnabled") }
    static var voiceID: String { d.string(forKey: "voiceID") ?? "" }
    static var accent: Int { d.integer(forKey: "accent") }
    static var personality: String { d.string(forKey: "personality").nonEmpty ?? "divertido" }
    static var petEnabled: Bool { d.object(forKey: "petEnabled") as? Bool ?? true }
    static var waterReminder: Bool { d.bool(forKey: "waterReminder") }
    static var pixKey: String { d.string(forKey: "pixKey") ?? "" }
    static let defaultImageModel = "gemini-2.5-flash-image"
    static var imageModel: String { d.string(forKey: "imageModel").nonEmpty ?? defaultImageModel }
}

/// Arquivos em ~/Library/Application Support/SextaFeira
enum Storage {
    static var dir: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("SextaFeira", isDirectory: true)
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        return base
    }

    static func load<T: Decodable>(_ type: T.Type, _ name: String) -> T? {
        guard let data = try? Data(contentsOf: dir.appendingPathComponent(name)) else { return nil }
        let dec = JSONDecoder()
        dec.dateDecodingStrategy = .iso8601
        return try? dec.decode(T.self, from: data)
    }

    static func save<T: Encodable>(_ value: T, _ name: String) {
        let enc = JSONEncoder()
        enc.outputFormatting = [.prettyPrinted]
        enc.dateEncodingStrategy = .iso8601
        if let data = try? enc.encode(value) {
            try? data.write(to: dir.appendingPathComponent(name), options: .atomic)
        }
    }

    static func appendNote(_ text: String) {
        let url = dir.appendingPathComponent("notas.md")
        let line = "- [\(Fmt.stamp(Date()))] \(text)\n"
        if let h = try? FileHandle(forWritingTo: url) {
            h.seekToEndOfFile()
            h.write(Data(line.utf8))
            try? h.close()
        } else {
            try? Data(("# Notas\n\n" + line).utf8).write(to: url)
        }
    }
}

/// Chaves de API guardadas no Keychain do Mac.
enum Keychain {
    private static func base(_ key: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: "SextaFeira",
         kSecAttrAccount as String: key]
    }

    static func set(_ value: String, for key: String) {
        SecItemDelete(base(key) as CFDictionary)
        let v = value.trimmed
        guard !v.isEmpty else { return }
        var add = base(key)
        add[kSecValueData as String] = Data(v.utf8)
        SecItemAdd(add as CFDictionary, nil)
    }

    static func get(_ key: String) -> String {
        var q = base(key)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return "" }
        return String(decoding: data, as: UTF8.self)
    }
}
