// Ajudante da Sexta-feira — roda como root (LaunchDaemon).
//
// O que faz:
//  • Limite de carga REAL: liga/desliga a carga no chip SMC conforme a porcentagem.
//  • Descarregar até o limite mesmo na tomada (opcional).
//  • Ventoinha: modo automático ou velocidade fixa.
//  • Purge: libera memória quando o app pede (Boost).
//
// Conversa com o app por dois arquivos em /Users/Shared/SextaFeira:
//  • helper.json         → o app escreve o que quer
//  • helper-status.json  → o ajudante escreve como está
//
// Segurança: ao parar (desinstalar, SIGTERM) ou se o arquivo de configuração sumir,
// a carga volta a ficar LIGADA e a ventoinha volta para o automático.

import Foundation
import IOKit
import SMC

let version = 1
let dir = "/Users/Shared/SextaFeira"
let configPath = dir + "/helper.json"
let statusPath = dir + "/helper-status.json"

struct Config {
    var chargeLimitEnabled = false
    var limit = 80
    var sailing = 5
    var topUp = false
    var dischargeToLimit = false
    var fanMode = "auto"
    var fanRPM: Double = 0
    var purgeRequest: Double = 0
}

func readConfig() -> Config? {
    guard let data = FileManager.default.contents(atPath: configPath),
          let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return nil }
    var c = Config()
    c.chargeLimitEnabled = obj["chargeLimitEnabled"] as? Bool ?? false
    c.limit = min(100, max(20, (obj["limit"] as? NSNumber)?.intValue ?? 80))
    c.sailing = min(20, max(1, (obj["sailing"] as? NSNumber)?.intValue ?? 5))
    c.topUp = obj["topUp"] as? Bool ?? false
    c.dischargeToLimit = obj["dischargeToLimit"] as? Bool ?? false
    c.fanMode = obj["fanMode"] as? String ?? "auto"
    c.fanRPM = (obj["fanRPM"] as? NSNumber)?.doubleValue ?? 0
    c.purgeRequest = (obj["purgeRequest"] as? NSNumber)?.doubleValue ?? 0
    return c
}

// MARK: - SMC

func keyExists(_ key: String) -> Bool {
    var b = [UInt8](repeating: 0, count: 32)
    var size: UInt32 = 0
    var type = [CChar](repeating: 0, count: 5)
    return smc_read(key, &b, &size, &type) == 0
}

func readBytes(_ key: String) -> [UInt8]? {
    var b = [UInt8](repeating: 0, count: 32)
    var size: UInt32 = 0
    var type = [CChar](repeating: 0, count: 5)
    guard smc_read(key, &b, &size, &type) == 0 else { return nil }
    return Array(b.prefix(Int(size)))
}

func readType(_ key: String) -> String? {
    var b = [UInt8](repeating: 0, count: 32)
    var size: UInt32 = 0
    var type = [CChar](repeating: 0, count: 5)
    guard smc_read(key, &b, &size, &type) == 0 else { return nil }
    return String(cString: type)
}

@discardableResult
func write(_ key: String, _ bytes: [UInt8]) -> Bool {
    smc_write(key, bytes, UInt32(bytes.count)) == 0
}

/// Escreve um número respeitando o tipo da chave (flt no Apple Silicon, fpe2 no Intel).
@discardableResult
func writeNumber(_ key: String, _ value: Double) -> Bool {
    switch readType(key) {
    case "flt ":
        var f = Float(value)
        let bytes = withUnsafeBytes(of: &f) { Array($0) }
        return write(key, bytes)
    case "fpe2":
        let v = UInt16(max(0, min(16383, value * 4)))
        return write(key, [UInt8(v >> 8), UInt8(v & 0xff)])
    case "ui8 ":
        return write(key, [UInt8(max(0, min(255, value)))])
    default:
        return false
    }
}

enum Charging {
    /// Firmware novo (macOS 15+ no Apple Silicon) usa CHTE; o antigo, CH0B/CH0C.
    static let useCHTE = keyExists("CHTE")
    static let dischargeKey: String? = keyExists("CHIE") ? "CHIE" : (keyExists("CH0I") ? "CH0I" : nil)

    static var keyName: String { useCHTE ? "CHTE" : "CH0B/CH0C" }

    @discardableResult
    static func set(enabled: Bool) -> Bool {
        if useCHTE {
            return write("CHTE", enabled ? [0, 0, 0, 0] : [1, 0, 0, 0])
        }
        let v: [UInt8] = [enabled ? 0x00 : 0x02]
        let a = write("CH0B", v)
        let b = write("CH0C", v)
        return a || b
    }

    static func isInhibited() -> Bool {
        if useCHTE { return (readBytes("CHTE")?.first ?? 0) != 0 }
        return (readBytes("CH0B")?.first ?? 0) != 0
    }

    static func setDischarge(_ on: Bool) {
        guard let key = dischargeKey else { return }
        if key == "CHIE" { write(key, [on ? 0x08 : 0x00]) } else { write(key, [on ? 0x01 : 0x00]) }
    }
}

enum Fans {
    static var count: Int {
        var v = 0.0
        return smc_read_number("FNum", &v) == 0 ? Int(v) : 0
    }

    static func modeKey(_ i: Int) -> String? {
        if keyExists("F\(i)Md") { return "F\(i)Md" }
        if keyExists("F\(i)md") { return "F\(i)md" }
        return nil
    }

    static func setManual(rpm: Double) -> Bool {
        var ok = true
        for i in 0..<count {
            guard let mk = modeKey(i) else { ok = false; continue }
            if !write(mk, [1]) {
                // Em alguns Macs com Apple Silicon é preciso destravar o modo de teste primeiro.
                write("Ftst", [1])
                usleep(500_000)
                if !write(mk, [1]) { ok = false; continue }
            }
            var minR = 0.0, maxR = 10000.0
            _ = smc_read_number("F\(i)Mn", &minR)
            _ = smc_read_number("F\(i)Mx", &maxR)
            let target = max(minR, min(maxR > 0 ? maxR : 10000, rpm))
            if !writeNumber("F\(i)Tg", target) { ok = false }
        }
        return ok
    }

    static func setAuto() {
        for i in 0..<count {
            if let mk = modeKey(i) { write(mk, [0]) }
        }
        if keyExists("Ftst") { write("Ftst", [0]) }
    }
}

// MARK: - Bateria

struct Battery {
    let percent: Int
    let plugged: Bool
}

func readBattery() -> Battery? {
    let service = IOServiceGetMatchingService(kIOMainPortDefault, IOServiceMatching("AppleSmartBattery"))
    guard service != 0 else { return nil }
    defer { IOObjectRelease(service) }
    var props: Unmanaged<CFMutableDictionary>?
    guard IORegistryEntryCreateCFProperties(service, &props, kCFAllocatorDefault, 0) == KERN_SUCCESS,
          let cf = props?.takeRetainedValue(),
          let dict = cf as NSDictionary as? [String: Any] else { return nil }
    let cur = (dict["CurrentCapacity"] as? NSNumber)?.intValue ?? 0
    let maxC = (dict["MaxCapacity"] as? NSNumber)?.intValue ?? 100
    let plugged = (dict["ExternalConnected"] as? NSNumber)?.boolValue ?? false
    return Battery(percent: maxC > 0 ? min(100, cur * 100 / maxC) : cur, plugged: plugged)
}

// MARK: - Estado

var inhibited = Charging.isInhibited()
var discharging = false
var appliedFan = "auto"
var appliedRPM: Double = 0
var lastPurge: Double = 0
var lastError = ""
var firstTick = true

func restoreDefaults() {
    Charging.setDischarge(false)
    Charging.set(enabled: true)
    Fans.setAuto()
    inhibited = false
    discharging = false
}

func writeStatus(_ cfg: Config?, _ bat: Battery?) {
    let status: [String: Any] = [
        "version": version,
        "time": Date().timeIntervalSince1970,
        "chargingInhibited": inhibited,
        "discharging": discharging,
        "chargeKey": Charging.keyName,
        "canDischarge": Charging.dischargeKey != nil,
        "percent": bat?.percent ?? -1,
        "plugged": bat?.plugged ?? false,
        "limitEnabled": cfg?.chargeLimitEnabled ?? false,
        "limit": cfg?.limit ?? 80,
        "fanMode": appliedFan,
        "fanRPM": appliedRPM,
        "fanCount": Fans.count,
        "error": lastError,
    ]
    try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true,
                                             attributes: [.posixPermissions: 0o1777])
    if let data = try? JSONSerialization.data(withJSONObject: status, options: [.prettyPrinted]) {
        let url = URL(fileURLWithPath: statusPath)
        try? data.write(to: url, options: .atomic)
        try? FileManager.default.setAttributes([.posixPermissions: 0o644], ofItemAtPath: statusPath)
    }
}

func tick() {
    guard let cfg = readConfig() else {
        // Sem configuração: tudo no padrão de fábrica.
        if inhibited || discharging || appliedFan != "auto" || firstTick {
            restoreDefaults()
            appliedFan = "auto"
        }
        firstTick = false
        writeStatus(nil, readBattery())
        return
    }
    lastError = ""
    let bat = readBattery()

    // --- Carga ---
    var wantInhibit = false
    if let b = bat, cfg.chargeLimitEnabled, !cfg.topUp {
        if b.percent >= cfg.limit {
            wantInhibit = true
        } else if b.percent <= cfg.limit - cfg.sailing {
            wantInhibit = false
        } else {
            wantInhibit = inhibited // zona de folga: mantém como está
        }
    }
    if wantInhibit != inhibited || firstTick {
        if Charging.set(enabled: !wantInhibit) {
            inhibited = wantInhibit
        } else {
            lastError = "Não consegui mudar a carga (chave \(Charging.keyName))."
        }
    }

    // --- Descarregar até o limite, mesmo na tomada ---
    var wantDischarge = false
    if let b = bat, cfg.chargeLimitEnabled, cfg.dischargeToLimit, !cfg.topUp, b.plugged, b.percent > cfg.limit {
        wantDischarge = true
    }
    if wantDischarge != discharging {
        Charging.setDischarge(wantDischarge)
        discharging = wantDischarge
    }

    // --- Ventoinha ---
    if cfg.fanMode == "manual" && cfg.fanRPM > 0 {
        if appliedFan != "manual" || abs(appliedRPM - cfg.fanRPM) > 1 || firstTick {
            if Fans.setManual(rpm: cfg.fanRPM) {
                appliedFan = "manual"
                appliedRPM = cfg.fanRPM
            } else {
                lastError = "Não consegui controlar a ventoinha neste Mac."
            }
        }
    } else if appliedFan != "auto" || firstTick {
        Fans.setAuto()
        appliedFan = "auto"
        appliedRPM = 0
    }

    // --- Purge (Boost) ---
    if cfg.purgeRequest > lastPurge {
        lastPurge = cfg.purgeRequest
        if Date().timeIntervalSince1970 - cfg.purgeRequest < 120 {
            let p = Process()
            p.executableURL = URL(fileURLWithPath: "/usr/sbin/purge")
            try? p.run()
            p.waitUntilExit()
        }
    }

    firstTick = false
    writeStatus(cfg, bat)
}

// MARK: - Início

guard getuid() == 0 else {
    FileHandle.standardError.write("O ajudante precisa rodar como root.\n".data(using: .utf8)!)
    exit(1)
}
guard smc_open() == 0 else {
    FileHandle.standardError.write("Não consegui abrir o SMC.\n".data(using: .utf8)!)
    exit(1)
}

// Já começa com a purge atual como "feita", para não rodar uma antiga.
lastPurge = readConfig()?.purgeRequest ?? 0

var signalSources: [DispatchSourceSignal] = []
for sig in [SIGTERM, SIGINT, SIGHUP] {
    signal(sig, SIG_IGN)
    let src = DispatchSource.makeSignalSource(signal: sig, queue: .main)
    src.setEventHandler {
        restoreDefaults()
        appliedFan = "auto"
        writeStatus(nil, readBattery())
        smc_close()
        exit(0)
    }
    src.resume()
    signalSources.append(src)
}

let timer = DispatchSource.makeTimerSource(queue: .main)
timer.schedule(deadline: .now(), repeating: .seconds(5))
timer.setEventHandler { tick() }
timer.resume()

dispatchMain()
