import AppKit
import Darwin

// MARK: - Hábitos

struct Habit: Codable, Identifiable, Equatable {
    var id = UUID()
    var name: String
    var icon: String
    var goal: Int
    var count = 0
    var day = Habit.today()

    static func today() -> String { Fmt.day(Date()) }

    static let defaults: [Habit] = [
        Habit(name: "Água", icon: "drop.fill", goal: 8),
        Habit(name: "Leitura", icon: "book.fill", goal: 1),
        Habit(name: "Exercício", icon: "figure.walk", goal: 1),
    ]
}

// MARK: - Funções personalizadas e rotinas

/// "Dê um nome e diga o que abrir": app, site, pasta ou arquivo.
struct CustomCommand: Codable, Identifiable, Equatable {
    var id = UUID()
    var name: String
    var target: String
}

/// Vários comandos em sequência, ex.: "modo foco".
struct Routine: Codable, Identifiable, Equatable {
    var id = UUID()
    var name: String
    var steps: [String]

    static let defaults: [Routine] = [
        Routine(name: "modo foco", steps: ["fecha o WhatsApp", "volume 30", "timer de 25 minutos para foco"]),
    ]
}

enum Automations {
    private static let lead: Set<String> = [
        "abre", "abrir", "abra", "executa", "executar", "roda", "rodar", "ativa", "ativar",
        "liga", "ligar", "inicia", "iniciar", "comeca", "rotina", "funcao", "a", "o", "meu", "minha", "modo",
    ]

    /// "ativa o modo foco" combina com a rotina "modo foco" (ou só "foco").
    static func matches(_ text: String, name: String) -> Bool {
        let t = Words.normalize(text)
        let n = Words.normalize(name)
        guard !n.isEmpty else { return false }
        if t == n { return true }
        guard t.hasSuffix(" " + n) else { return false }
        let prefix = t.dropLast(n.count + 1).split(separator: " ")
        return prefix.allSatisfy { lead.contains(String($0)) }
    }
}

// MARK: - Copiados

struct ClipItem: Identifiable, Equatable {
    let id = UUID()
    let text: String
    let date = Date()
}

// MARK: - Personalidade

enum Personality {
    static let all: [(id: String, title: String, prompt: String)] = [
        ("divertido", "Divertida", "bem-humorada, com uma piadinha leve de vez em quando"),
        ("fofo", "Fofa", "carinhosa, animada e fofa"),
        ("profissional", "Profissional", "objetiva e profissional, sem brincadeiras"),
        ("sarcastico", "Sarcástica", "sarcástica de um jeito engraçado, mas sempre útil e nunca grossa"),
        ("zen", "Zen", "calma, tranquila e acolhedora"),
    ]

    static func prompt(_ id: String) -> String {
        all.first { $0.id == id }?.prompt ?? all[0].prompt
    }
}

// MARK: - Verificar o Mac

struct ScanStep: Identifiable, Equatable {
    let id = UUID()
    let title: String
    var done = false
}

struct ReportLine: Identifiable, Equatable {
    let id = UUID()
    let icon: String
    let title: String
    let value: String
    let warn: Bool
}

enum MacInfo {
    static let steps = [
        "Olhando a memória",
        "Vendo quem está usando o processador",
        "Medindo o disco",
        "Somando arquivos temporários (caches)",
        "Conferindo a lixeira",
        "Contando o que abre junto com o Mac",
        "Checando a bateria",
    ]

    static func bytes(_ n: Int64) -> String {
        ByteCountFormatter.string(fromByteCount: n, countStyle: .file)
    }

    static func step(_ i: Int) -> [ReportLine] {
        switch i {
        case 0:
            let m = memory()
            guard m.total > 0 else { return [] }
            let pct = Int((m.used / m.total * 100).rounded())
            return [ReportLine(icon: "memorychip", title: "Memória em uso",
                               value: "\(pct)% de \(bytes(Int64(m.total)))", warn: pct >= 85)]
        case 1:
            let top = topCPU()
            guard let first = top.first else { return [] }
            let list = top.prefix(3).map { "\($0.0) (\(Int($0.1))%)" }.joined(separator: ", ")
            return [ReportLine(icon: "cpu", title: "Mais usam o processador", value: list, warn: first.1 >= 80)]
        case 2:
            guard let d = disk() else { return [] }
            let lowPct = Double(d.free) / Double(max(d.total, 1)) < 0.10
            return [ReportLine(icon: "internaldrive", title: "Espaço livre no disco",
                               value: "\(bytes(d.free)) de \(bytes(d.total))",
                               warn: lowPct || d.free < 15_000_000_000)]
        case 3:
            let caches = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Caches")
            guard let size = folderSize(caches) else { return [] }
            return [ReportLine(icon: "archivebox", title: "Caches dos apps", value: bytes(size), warn: size > 5_000_000_000)]
        case 4:
            let trash = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".Trash")
            guard let size = folderSize(trash) else {
                return [ReportLine(icon: "trash", title: "Lixeira", value: "sem permissão para medir", warn: false)]
            }
            return [ReportLine(icon: "trash", title: "Lixeira", value: bytes(size), warn: size > 1_000_000_000)]
        case 5:
            let home = FileManager.default.homeDirectoryForCurrentUser.path
            let n = countPlists(home + "/Library/LaunchAgents") + countPlists("/Library/LaunchAgents")
            return [ReportLine(icon: "power", title: "Itens que iniciam sozinhos", value: "\(n)", warn: n > 15)]
        case 6:
            guard let b = battery() else { return [] }
            return [ReportLine(icon: b.charging ? "battery.100.bolt" : "battery.50", title: "Bateria",
                               value: "\(b.percent)%\(b.charging ? " (carregando)" : "")",
                               warn: b.percent < 20 && !b.charging)]
        default:
            return []
        }
    }

    static func summary(_ lines: [ReportLine]) -> String {
        let warns = lines.filter { $0.warn }
        if warns.isEmpty { return "Seu Mac está tranquilo, tudo em ordem! ✅" }
        let items = warns.map { "\($0.title.lowercased()): \($0.value)" }.joined(separator: "; ")
        return "Achei \(warns.count == 1 ? "1 ponto" : "\(warns.count) pontos") de atenção — \(items)."
    }

    // MARK: medições

    static func memory() -> (used: Double, total: Double) {
        let total = Double(ProcessInfo.processInfo.physicalMemory)
        var stats = vm_statistics64()
        var count = mach_msg_type_number_t(MemoryLayout<vm_statistics64_data_t>.size / MemoryLayout<integer_t>.size)
        let kr = withUnsafeMutablePointer(to: &stats) { ptr in
            ptr.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                host_statistics64(mach_host_self(), HOST_VM_INFO64, $0, &count)
            }
        }
        guard kr == KERN_SUCCESS else { return (0, total) }
        let page = Double(vm_kernel_page_size)
        let pages = UInt64(stats.active_count) + UInt64(stats.wire_count) + UInt64(stats.compressor_page_count)
        return (Double(pages) * page, total)
    }

    static func shell(_ path: String, _ args: [String]) -> String {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: path)
        p.arguments = args
        let out = Pipe()
        p.standardOutput = out
        p.standardError = Pipe()
        do { try p.run() } catch { return "" }
        let data = out.fileHandleForReading.readDataToEndOfFile()
        p.waitUntilExit()
        return String(decoding: data, as: UTF8.self)
    }

    static func topCPU() -> [(String, Double)] {
        let out = shell("/bin/ps", ["-Aceo", "pcpu=,comm=", "-r"])
        return out.split(separator: "\n").prefix(5).compactMap { line in
            let parts = line.trimmingCharacters(in: .whitespaces).split(separator: " ", maxSplits: 1)
            guard parts.count == 2,
                  let v = Double(parts[0].replacingOccurrences(of: ",", with: ".")) else { return nil }
            return (String(parts[1]).trimmingCharacters(in: .whitespaces), v)
        }
    }

    static func disk() -> (free: Int64, total: Int64)? {
        let keys: Set<URLResourceKey> = [.volumeAvailableCapacityForImportantUsageKey, .volumeTotalCapacityKey]
        guard let v = try? URL(fileURLWithPath: "/").resourceValues(forKeys: keys),
              let free = v.volumeAvailableCapacityForImportantUsage,
              let total = v.volumeTotalCapacity else { return nil }
        return (free, Int64(total))
    }

    /// `nil` quando não há permissão para ler a pasta.
    static func folderSize(_ url: URL) -> Int64? {
        guard (try? FileManager.default.contentsOfDirectory(atPath: url.path)) != nil,
              let en = FileManager.default.enumerator(at: url, includingPropertiesForKeys: [.totalFileAllocatedSizeKey],
                                                      options: [], errorHandler: { _, _ in true }) else { return nil }
        var total: Int64 = 0
        while let f = en.nextObject() as? URL {
            if let s = (try? f.resourceValues(forKeys: [.totalFileAllocatedSizeKey]))?.totalFileAllocatedSize {
                total += Int64(s)
            }
        }
        return total
    }

    static func countPlists(_ dir: String) -> Int {
        ((try? FileManager.default.contentsOfDirectory(atPath: dir)) ?? []).filter { $0.hasSuffix(".plist") }.count
    }

    static func battery() -> (percent: Int, charging: Bool)? {
        let out = shell("/usr/bin/pmset", ["-g", "batt"])
        guard let m = Rx.match(#"(\d+)%"#, out), let p = Int(m[1]) else { return nil }
        let charging = out.contains("AC Power") || out.contains("charging;") || out.contains("charged")
        return (p, charging)
    }
}

/// Roda a verificação passo a passo, atualizando a tela.
@MainActor
final class MacChecker {
    let state: AppState
    private var running = false

    init(state: AppState) { self.state = state }

    func run(_ done: @escaping @MainActor (String) -> Void) {
        guard !running else { return }
        running = true
        state.scanSteps = MacInfo.steps.map { ScanStep(title: $0) }
        state.scanProgress = 0
        state.report = []

        Task { @MainActor in
            var lines: [ReportLine] = []
            let total = MacInfo.steps.count
            for i in 0..<total {
                let found = await Task.detached { MacInfo.step(i) }.value
                lines += found
                if i < state.scanSteps.count { state.scanSteps[i].done = true }
                state.scanProgress = Double(i + 1) / Double(total)
                try? await Task.sleep(nanoseconds: 250_000_000)
            }
            state.report = lines
            state.scanProgress = nil
            running = false
            done(MacInfo.summary(lines))
        }
    }

    static func emptyTrash() {
        let alert = NSAlert()
        alert.messageText = "Esvaziar a lixeira?"
        alert.informativeText = "Os arquivos da lixeira serão apagados para sempre."
        alert.addButton(withTitle: "Esvaziar")
        alert.addButton(withTitle: "Cancelar")
        NSApp.activate(ignoringOtherApps: true)
        if alert.runModal() == .alertFirstButtonReturn {
            AppleScript.run("tell application \"Finder\" to empty trash")
        }
    }
}
