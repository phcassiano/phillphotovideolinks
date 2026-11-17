import AppKit
import SMC

// MARK: - Ajudante (root): instalar, configurar e ler o status

struct HelperStatus: Equatable {
    var time = Date.distantPast
    var chargingInhibited = false
    var discharging = false
    var chargeKey = ""
    var canDischarge = false
    var fanMode = "auto"
    var fanRPM: Double = 0
    var error = ""

    var alive: Bool { Date().timeIntervalSince(time) < 30 }
}

@MainActor
final class HelperManager: ObservableObject {
    static let label = "com.local.sextafeira.helper"
    static let shared = "/Users/Shared/SextaFeira"
    static let configPath = shared + "/helper.json"
    static let statusPath = shared + "/helper-status.json"

    @Published var installed = false
    @Published var status = HelperStatus()
    @Published var message = ""

    // Configuração (fica salva também no UserDefaults)
    @Published var limitEnabled = UserDefaults.standard.bool(forKey: "realLimitEnabled") { didSet { save() } }
    @Published var limit = UserDefaults.standard.object(forKey: "chargeLimit") as? Int ?? 80 { didSet { save() } }
    @Published var sailing = UserDefaults.standard.object(forKey: "chargeSailing") as? Int ?? 5 { didSet { save() } }
    @Published var topUp = false { didSet { save() } }
    @Published var dischargeToLimit = UserDefaults.standard.bool(forKey: "dischargeToLimit") { didSet { save() } }
    @Published var fanMode = UserDefaults.standard.string(forKey: "fanMode") ?? "auto" { didSet { save() } }
    @Published var fanRPM = UserDefaults.standard.object(forKey: "fanRPM") as? Double ?? 3000 { didSet { save() } }
    private var purgeRequest: Double = 0

    var running: Bool { installed && status.alive }

    init() {
        refresh()
        writeConfig()
    }

    func refresh() {
        installed = FileManager.default.fileExists(atPath: "/Library/LaunchDaemons/\(Self.label).plist")
        guard let data = FileManager.default.contents(atPath: Self.statusPath),
              let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return }
        var s = HelperStatus()
        s.time = Date(timeIntervalSince1970: (obj["time"] as? NSNumber)?.doubleValue ?? 0)
        s.chargingInhibited = obj["chargingInhibited"] as? Bool ?? false
        s.discharging = obj["discharging"] as? Bool ?? false
        s.chargeKey = obj["chargeKey"] as? String ?? ""
        s.canDischarge = obj["canDischarge"] as? Bool ?? false
        s.fanMode = obj["fanMode"] as? String ?? "auto"
        s.fanRPM = (obj["fanRPM"] as? NSNumber)?.doubleValue ?? 0
        s.error = obj["error"] as? String ?? ""
        if s != status { status = s }
    }

    private func save() {
        let d = UserDefaults.standard
        d.set(limitEnabled, forKey: "realLimitEnabled")
        d.set(limit, forKey: "chargeLimit")
        d.set(sailing, forKey: "chargeSailing")
        d.set(dischargeToLimit, forKey: "dischargeToLimit")
        d.set(fanMode, forKey: "fanMode")
        d.set(fanRPM, forKey: "fanRPM")
        writeConfig()
    }

    func writeConfig() {
        let fm = FileManager.default
        if !fm.fileExists(atPath: Self.shared) {
            try? fm.createDirectory(atPath: Self.shared, withIntermediateDirectories: true)
        }
        let cfg: [String: Any] = [
            "chargeLimitEnabled": limitEnabled,
            "limit": limit,
            "sailing": sailing,
            "topUp": topUp,
            "dischargeToLimit": dischargeToLimit,
            "fanMode": fanMode,
            "fanRPM": fanRPM,
            "purgeRequest": purgeRequest,
        ]
        if let data = try? JSONSerialization.data(withJSONObject: cfg, options: [.prettyPrinted]) {
            try? data.write(to: URL(fileURLWithPath: Self.configPath), options: .atomic)
        }
    }

    /// Pede ao ajudante para liberar memória (purge). Só funciona com o ajudante rodando.
    func requestPurge() {
        purgeRequest = Date().timeIntervalSince1970
        writeConfig()
    }

    // MARK: Instalar / remover (pede senha de administrador)

    private static func asString(_ s: String) -> String {
        "\"" + s.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"") + "\""
    }

    private func runAsAdmin(_ args: [String]) -> String? {
        let parts = args.map { "quoted form of " + Self.asString($0) }.joined(separator: " & \" \" & ")
        let source = """
        do shell script "/bin/bash " & \(parts) with administrator privileges \
        with prompt "A Sexta-feira quer instalar o ajudante de bateria e ventoinha."
        """
        var error: NSDictionary?
        NSAppleScript(source: source)?.executeAndReturnError(&error)
        if let error {
            let msg = error[NSAppleScript.errorMessage] as? String ?? "\(error)"
            return msg.contains("cancel") ? "Instalação cancelada." : msg
        }
        return nil
    }

    func install() {
        guard let bin = Bundle.main.url(forAuxiliaryExecutable: "SextaFeiraHelper")?.path,
              let script = Bundle.main.path(forResource: "install-helper", ofType: "sh") else {
            message = "Não achei o ajudante dentro do app. Reinstale a Sexta-feira."
            return
        }
        NSApp.activate(ignoringOtherApps: true)
        if let err = runAsAdmin([script, "install", bin]) {
            message = err
            return
        }
        writeConfig()
        message = "Ajudante instalado! ✅"
        after(6) { [weak self] in self?.refresh() }
        refresh()
    }

    func uninstall() {
        guard let script = Bundle.main.path(forResource: "install-helper", ofType: "sh") else { return }
        NSApp.activate(ignoringOtherApps: true)
        if let err = runAsAdmin([script, "uninstall"]) {
            message = err
            return
        }
        message = "Ajudante removido. A carga voltou ao normal."
        refresh()
    }
}

// MARK: - Sensores do SMC (temperatura e ventoinhas, só leitura)

struct FanInfo: Identifiable, Equatable {
    let id: Int
    let rpm: Double
    let min: Double
    let max: Double
}

enum SMCSensors {
    /// Procura as chaves de temperatura do processador e da GPU (roda uma vez, em segundo plano).
    static func discover() -> (cpu: [String], gpu: [String]) {
        let count = smc_key_count()
        var cpu: [String] = []
        var gpu: [String] = []
        guard count > 0 else { return ([], []) }
        for i in 0..<count {
            var buf = [CChar](repeating: 0, count: 5)
            guard smc_key_at(i, &buf) == 0 else { continue }
            let key = String(cString: buf)
            guard key.hasPrefix("T") else { continue }
            let isCPU = key.hasPrefix("Tp") || key.hasPrefix("Te") || key.hasPrefix("TC")
            let isGPU = key.hasPrefix("Tg") || key.hasPrefix("TG")
            guard isCPU || isGPU else { continue }
            var v = 0.0
            guard smc_read_number(key, &v) == 0, v > 10, v < 115 else { continue }
            if isCPU { cpu.append(key) } else { gpu.append(key) }
        }
        return (cpu, gpu)
    }

    static func temperature(_ keys: [String]) -> Double? {
        var values: [Double] = []
        for k in keys {
            var v = 0.0
            if smc_read_number(k, &v) == 0, v > 10, v < 115 { values.append(v) }
        }
        guard !values.isEmpty else { return nil }
        // média dos sensores mais quentes, como os apps de monitoramento fazem
        let top = values.sorted(by: >).prefix(max(1, values.count / 2))
        return top.reduce(0, +) / Double(top.count)
    }

    static func fans() -> [FanInfo] {
        var n = 0.0
        guard smc_read_number("FNum", &n) == 0, n > 0 else { return [] }
        return (0..<Int(n)).map { i in
            var rpm = 0.0, mn = 0.0, mx = 0.0
            _ = smc_read_number("F\(i)Ac", &rpm)
            _ = smc_read_number("F\(i)Mn", &mn)
            _ = smc_read_number("F\(i)Mx", &mx)
            return FanInfo(id: i, rpm: rpm, min: mn, max: mx)
        }
    }
}
