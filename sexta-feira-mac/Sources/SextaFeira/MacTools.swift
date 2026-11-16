import AppKit
import SwiftUI
import IOKit
import IOKit.pwr_mgt
import CoreAudio
import CoreMediaIO
import EventKit
import Darwin

// MARK: - Bateria

struct BatteryInfo: Equatable {
    var percent = 0
    var charging = false
    var plugged = false
    var cycles = 0
    var designCapacity = 0
    var maxCapacity = 0
    var temperature: Double?
    var minutesLeft: Int?
    var watts: Double?

    /// Saúde: capacidade máxima atual / capacidade de fábrica.
    var health: Int {
        guard designCapacity > 0, maxCapacity > 0 else { return 0 }
        return min(100, Int((Double(maxCapacity) / Double(designCapacity) * 100).rounded()))
    }

    var statusText: String {
        if charging { return "Carregando" }
        if plugged { return "Na tomada" }
        return "Na bateria"
    }
}

enum BatteryReader {
    static func read() -> BatteryInfo? {
        let service = IOServiceGetMatchingService(kIOMainPortDefault, IOServiceMatching("AppleSmartBattery"))
        guard service != 0 else { return nil }
        defer { IOObjectRelease(service) }
        var props: Unmanaged<CFMutableDictionary>?
        guard IORegistryEntryCreateCFProperties(service, &props, kCFAllocatorDefault, 0) == KERN_SUCCESS,
              let cf = props?.takeRetainedValue(),
              let dict = cf as NSDictionary as? [String: Any] else { return nil }

        func int(_ k: String) -> Int? { (dict[k] as? NSNumber)?.intValue }
        func bool(_ k: String) -> Bool { (dict[k] as? NSNumber)?.boolValue ?? false }

        var b = BatteryInfo()
        let cur = int("CurrentCapacity") ?? 0
        let maxC = int("MaxCapacity") ?? 100
        b.percent = maxC > 0 ? min(100, cur * 100 / maxC) : cur
        b.charging = bool("IsCharging")
        b.plugged = bool("ExternalConnected")
        b.cycles = int("CycleCount") ?? 0
        b.designCapacity = int("DesignCapacity") ?? 0
        b.maxCapacity = int("AppleRawMaxCapacity") ?? int("NominalChargeCapacity") ?? 0
        if let t = int("Temperature") { b.temperature = Double(t) / 100 }
        if let m = int("TimeRemaining"), m > 0, m < 6000 { b.minutesLeft = m }
        if let v = int("Voltage"), let a = int("InstantAmperage") ?? int("Amperage"), a != 0 {
            b.watts = abs(Double(v) * Double(a)) / 1_000_000
        }
        return b
    }
}

// MARK: - Processador, GPU, rede

final class CPUSampler {
    private var prevUsed: UInt64 = 0
    private var prevTotal: UInt64 = 0

    /// Uso total do processador (0…1) desde a última leitura.
    func sample() -> Double {
        var cpuInfo: processor_info_array_t?
        var numInfo: mach_msg_type_number_t = 0
        var numCPUs: natural_t = 0
        guard host_processor_info(mach_host_self(), PROCESSOR_CPU_LOAD_INFO, &numCPUs, &cpuInfo, &numInfo) == KERN_SUCCESS,
              let info = cpuInfo else { return 0 }
        defer {
            vm_deallocate(mach_task_self_, vm_address_t(UInt(bitPattern: info)),
                          vm_size_t(Int(numInfo) * MemoryLayout<integer_t>.stride))
        }
        var used: UInt64 = 0
        var total: UInt64 = 0
        for i in 0..<Int(numCPUs) {
            let base = Int(CPU_STATE_MAX) * i
            let user = UInt64(UInt32(bitPattern: info[base + Int(CPU_STATE_USER)]))
            let sys = UInt64(UInt32(bitPattern: info[base + Int(CPU_STATE_SYSTEM)]))
            let nice = UInt64(UInt32(bitPattern: info[base + Int(CPU_STATE_NICE)]))
            let idle = UInt64(UInt32(bitPattern: info[base + Int(CPU_STATE_IDLE)]))
            used += user + sys + nice
            total += user + sys + nice + idle
        }
        let pu = prevUsed, pt = prevTotal
        prevUsed = used
        prevTotal = total
        guard pt > 0, total > pt, used >= pu else { return 0 }
        return Double(used - pu) / Double(total - pt)
    }
}

final class NetSampler {
    private var prevIn: UInt64 = 0
    private var prevOut: UInt64 = 0
    private var prevTime = Date()

    /// Bytes por segundo (entrada, saída).
    func sample() -> (Double, Double) {
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return (0, 0) }
        defer { freeifaddrs(ifaddr) }
        var inB: UInt64 = 0
        var outB: UInt64 = 0
        var ptr: UnsafeMutablePointer<ifaddrs>? = first
        while let p = ptr {
            let ifa = p.pointee
            if let addr = ifa.ifa_addr, addr.pointee.sa_family == UInt8(AF_LINK), let data = ifa.ifa_data {
                let name = String(cString: ifa.ifa_name)
                if name.hasPrefix("en") || name.hasPrefix("pdp_ip") || name.hasPrefix("utun") {
                    let d = data.assumingMemoryBound(to: if_data.self).pointee
                    inB += UInt64(d.ifi_ibytes)
                    outB += UInt64(d.ifi_obytes)
                }
            }
            ptr = ifa.ifa_next
        }
        let now = Date()
        let dt = max(0.5, now.timeIntervalSince(prevTime))
        defer { prevIn = inB; prevOut = outB; prevTime = now }
        guard prevIn > 0, inB >= prevIn, outB >= prevOut else { return (0, 0) }
        return (Double(inB - prevIn) / dt, Double(outB - prevOut) / dt)
    }
}

enum GPUReader {
    static func usage() -> Int? {
        var iter: io_iterator_t = 0
        guard IOServiceGetMatchingServices(kIOMainPortDefault, IOServiceMatching("IOAccelerator"), &iter) == KERN_SUCCESS else {
            return nil
        }
        defer { IOObjectRelease(iter) }
        var result: Int?
        var entry = IOIteratorNext(iter)
        while entry != 0 {
            if let raw = IORegistryEntryCreateCFProperty(entry, "PerformanceStatistics" as CFString, kCFAllocatorDefault, 0)?
                .takeRetainedValue(),
               let stats = raw as? NSDictionary,
               let u = (stats["Device Utilization %"] as? NSNumber)?.intValue {
                result = max(result ?? 0, u)
            }
            IOObjectRelease(entry)
            entry = IOIteratorNext(iter)
        }
        return result
    }
}

struct ProcUsage: Identifiable, Equatable {
    let id = UUID()
    let name: String
    let value: Double
}

// MARK: - Cafeína

final class Caffeine {
    private var assertion: IOPMAssertionID = 0
    var isOn: Bool { assertion != 0 }

    func start() {
        guard assertion == 0 else { return }
        var id: IOPMAssertionID = 0
        let ok = IOPMAssertionCreateWithName("PreventUserIdleDisplaySleep" as CFString,
                                             IOPMAssertionLevel(kIOPMAssertionLevelOn),
                                             "Sexta-feira: mantendo o Mac acordado" as CFString, &id)
        if ok == kIOReturnSuccess { assertion = id }
    }

    func stop() {
        if assertion != 0 {
            IOPMAssertionRelease(assertion)
            assertion = 0
        }
    }
}

// MARK: - Telas (brilho por software)

struct DisplayItem: Identifiable, Equatable {
    let id: CGDirectDisplayID
    let name: String
}

enum DisplayDimmer {
    static func displays() -> [DisplayItem] {
        NSScreen.screens.compactMap { s in
            guard let n = s.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber else { return nil }
            return DisplayItem(id: CGDirectDisplayID(n.uint32Value), name: s.localizedName)
        }
    }

    /// Escurece a tela via tabela de gama (0.15…1). Funciona em qualquer monitor.
    static func set(_ id: CGDirectDisplayID, level: Double) {
        let v = Float(max(0.15, min(1, level)))
        CGSetDisplayTransferByFormula(id, 0, v, 1, 0, v, 1, 0, v, 1)
    }

    static func resetAll() { CGDisplayRestoreColorSyncSettings() }
}

// MARK: - Som

struct AudioDevice: Identifiable, Hashable {
    let id: AudioDeviceID
    let name: String
}

enum AudioDevices {
    private static func address(_ selector: AudioObjectPropertySelector,
                                _ scope: AudioObjectPropertyScope = kAudioObjectPropertyScopeGlobal) -> AudioObjectPropertyAddress {
        AudioObjectPropertyAddress(mSelector: selector, mScope: scope, mElement: kAudioObjectPropertyElementMain)
    }

    static func allIDs() -> [AudioDeviceID] {
        var addr = address(kAudioHardwarePropertyDevices)
        var size: UInt32 = 0
        let sys = AudioObjectID(kAudioObjectSystemObject)
        guard AudioObjectGetPropertyDataSize(sys, &addr, 0, nil, &size) == noErr, size > 0 else { return [] }
        var ids = [AudioDeviceID](repeating: 0, count: Int(size) / MemoryLayout<AudioDeviceID>.size)
        guard AudioObjectGetPropertyData(sys, &addr, 0, nil, &size, &ids) == noErr else { return [] }
        return ids
    }

    static func channels(_ id: AudioDeviceID, input: Bool) -> Int {
        var addr = address(kAudioDevicePropertyStreamConfiguration,
                           input ? kAudioDevicePropertyScopeInput : kAudioDevicePropertyScopeOutput)
        var size: UInt32 = 0
        guard AudioObjectGetPropertyDataSize(id, &addr, 0, nil, &size) == noErr, size > 0 else { return 0 }
        let raw = UnsafeMutableRawPointer.allocate(byteCount: Int(size), alignment: MemoryLayout<AudioBufferList>.alignment)
        defer { raw.deallocate() }
        guard AudioObjectGetPropertyData(id, &addr, 0, nil, &size, raw) == noErr else { return 0 }
        let list = UnsafeMutableAudioBufferListPointer(raw.assumingMemoryBound(to: AudioBufferList.self))
        return list.reduce(0) { $0 + Int($1.mNumberChannels) }
    }

    static func name(_ id: AudioDeviceID) -> String {
        var addr = address(kAudioObjectPropertyName)
        var name: Unmanaged<CFString>?
        var size = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
        guard AudioObjectGetPropertyData(id, &addr, 0, nil, &size, &name) == noErr, let n = name else { return "Dispositivo" }
        return n.takeRetainedValue() as String
    }

    static func uid(_ id: AudioDeviceID) -> String? {
        var addr = address(kAudioDevicePropertyDeviceUID)
        var value: Unmanaged<CFString>?
        var size = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
        guard AudioObjectGetPropertyData(id, &addr, 0, nil, &size, &value) == noErr, let v = value else { return nil }
        return v.takeRetainedValue() as String
    }

    static func outputs() -> [AudioDevice] {
        allIDs().filter { channels($0, input: false) > 0 }.map { AudioDevice(id: $0, name: name($0)) }
    }

    static func defaultOutput() -> AudioDeviceID {
        var addr = address(kAudioHardwarePropertyDefaultOutputDevice)
        var id = AudioDeviceID(0)
        var size = UInt32(MemoryLayout<AudioDeviceID>.size)
        AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, &size, &id)
        return id
    }

    static func setDefaultOutput(_ id: AudioDeviceID) {
        var addr = address(kAudioHardwarePropertyDefaultOutputDevice)
        var dev = id
        AudioObjectSetPropertyData(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil,
                                   UInt32(MemoryLayout<AudioDeviceID>.size), &dev)
        var sysAddr = address(kAudioHardwarePropertyDefaultSystemOutputDevice)
        AudioObjectSetPropertyData(AudioObjectID(kAudioObjectSystemObject), &sysAddr, 0, nil,
                                   UInt32(MemoryLayout<AudioDeviceID>.size), &dev)
    }

    /// Algum app está usando um microfone?
    static func micInUse() -> Bool {
        for id in allIDs() where channels(id, input: true) > 0 {
            var addr = address(kAudioDevicePropertyDeviceIsRunningSomewhere)
            var running: UInt32 = 0
            var size = UInt32(MemoryLayout<UInt32>.size)
            if AudioObjectGetPropertyData(id, &addr, 0, nil, &size, &running) == noErr, running != 0 { return true }
        }
        return false
    }
}

enum CameraWatch {
    /// Algum app está usando uma câmera?
    static func inUse() -> Bool {
        var addr = CMIOObjectPropertyAddress(
            mSelector: CMIOObjectPropertySelector(kCMIOHardwarePropertyDevices),
            mScope: CMIOObjectPropertyScope(kCMIOObjectPropertyScopeGlobal),
            mElement: CMIOObjectPropertyElement(kCMIOObjectPropertyElementMain))
        var size: UInt32 = 0
        let sys = CMIOObjectID(kCMIOObjectSystemObject)
        guard CMIOObjectGetPropertyDataSize(sys, &addr, 0, nil, &size) == 0, size > 0 else { return false }
        var ids = [CMIOObjectID](repeating: 0, count: Int(size) / MemoryLayout<CMIOObjectID>.size)
        var used: UInt32 = 0
        guard CMIOObjectGetPropertyData(sys, &addr, 0, nil, size, &used, &ids) == 0 else { return false }
        for id in ids {
            var a = CMIOObjectPropertyAddress(
                mSelector: CMIOObjectPropertySelector(kCMIODevicePropertyDeviceIsRunningSomewhere),
                mScope: CMIOObjectPropertyScope(kCMIOObjectPropertyScopeGlobal),
                mElement: CMIOObjectPropertyElement(kCMIOObjectPropertyElementMain))
            var running: UInt32 = 0
            var got: UInt32 = 0
            if CMIOObjectGetPropertyData(id, &a, 0, nil, UInt32(MemoryLayout<UInt32>.size), &got, &running) == 0,
               running != 0 { return true }
        }
        return false
    }
}

struct PrivacyEvent: Identifiable, Equatable {
    let id = UUID()
    let date = Date()
    let text: String
}

// MARK: - Agenda e relógio mundial

struct AgendaEvent: Identifiable {
    let id = UUID()
    let title: String
    let start: Date
    let end: Date
    let allDay: Bool
    let color: Color
}

struct ClockZone: Identifiable, Equatable {
    var id: String { tz }
    let tz: String
    let city: String
    let flag: String

    static let options: [ClockZone] = [
        ClockZone(tz: "America/Sao_Paulo", city: "São Paulo", flag: "🇧🇷"),
        ClockZone(tz: "America/Manaus", city: "Manaus", flag: "🇧🇷"),
        ClockZone(tz: "America/Noronha", city: "Noronha", flag: "🇧🇷"),
        ClockZone(tz: "America/New_York", city: "Nova York", flag: "🇺🇸"),
        ClockZone(tz: "America/Chicago", city: "Chicago", flag: "🇺🇸"),
        ClockZone(tz: "America/Los_Angeles", city: "Los Angeles", flag: "🇺🇸"),
        ClockZone(tz: "America/Mexico_City", city: "Cidade do México", flag: "🇲🇽"),
        ClockZone(tz: "America/Bogota", city: "Bogotá", flag: "🇨🇴"),
        ClockZone(tz: "America/Santiago", city: "Santiago", flag: "🇨🇱"),
        ClockZone(tz: "America/Argentina/Buenos_Aires", city: "Buenos Aires", flag: "🇦🇷"),
        ClockZone(tz: "Europe/Lisbon", city: "Lisboa", flag: "🇵🇹"),
        ClockZone(tz: "Europe/London", city: "Londres", flag: "🇬🇧"),
        ClockZone(tz: "Europe/Madrid", city: "Madri", flag: "🇪🇸"),
        ClockZone(tz: "Europe/Paris", city: "Paris", flag: "🇫🇷"),
        ClockZone(tz: "Europe/Rome", city: "Roma", flag: "🇮🇹"),
        ClockZone(tz: "Europe/Berlin", city: "Berlim", flag: "🇩🇪"),
        ClockZone(tz: "Asia/Dubai", city: "Dubai", flag: "🇦🇪"),
        ClockZone(tz: "Asia/Shanghai", city: "Xangai", flag: "🇨🇳"),
        ClockZone(tz: "Asia/Tokyo", city: "Tóquio", flag: "🇯🇵"),
        ClockZone(tz: "Asia/Singapore", city: "Singapura", flag: "🇸🇬"),
        ClockZone(tz: "Australia/Sydney", city: "Sydney", flag: "🇦🇺"),
    ]

    static func find(_ tz: String) -> ClockZone? { options.first { $0.tz == tz } }

    func time(_ date: Date) -> String {
        let f = DateFormatter()
        f.timeZone = TimeZone(identifier: tz)
        f.dateFormat = "HH:mm"
        return f.string(from: date)
    }

    /// Diferença em horas para o fuso do Mac, ex.: "+4h".
    func offset(_ date: Date) -> String {
        guard let zone = TimeZone(identifier: tz) else { return "" }
        let diff = (zone.secondsFromGMT(for: date) - TimeZone.current.secondsFromGMT(for: date)) / 3600
        if diff == 0 { return "mesmo horário" }
        return diff > 0 ? "+\(diff)h" : "\(diff)h"
    }
}

// MARK: - Central das ferramentas do Mac

/// Monitora o Mac ao vivo e guarda o estado das ferramentas (bateria, cafeína, telas, som, agenda, vigia).
@MainActor
final class MacTools: ObservableObject {
    let state: AppState

    @Published var battery: BatteryInfo?
    @Published var cpu: Double = 0
    @Published var gpu: Int?
    @Published var memUsed: Double = 0
    @Published var memTotal: Double = 0
    @Published var netIn: Double = 0
    @Published var netOut: Double = 0
    @Published var thermal: ProcessInfo.ThermalState = .nominal
    @Published var cpuHistory: [Double] = []
    @Published var memHistory: [Double] = []
    @Published var topApps: [ProcUsage] = []

    @Published var cpuTemp: Double?
    @Published var gpuTemp: Double?
    @Published var fans: [FanInfo] = []
    let helper = HelperManager()
    let eq = EqualizerController()
    let menuBar = MenuBarCleaner()

    @Published var caffeineOn = false
    @Published var caffeineUntil: Date?

    @Published var displays: [DisplayItem] = []
    @Published var dim: [CGDirectDisplayID: Double] = [:]

    @Published var outputs: [AudioDevice] = []
    @Published var currentOutput: AudioDeviceID = 0

    @Published var events: [AgendaEvent] = []
    @Published var agendaAllowed = false

    @Published var micOn = false
    @Published var camOn = false
    @Published var privacyLog: [PrivacyEvent] = []

    @Published var worldClocks: [String] = UserDefaults.standard.stringArray(forKey: "worldClocks")
        ?? ["America/New_York", "Europe/Lisbon", "Asia/Tokyo"] {
        didSet { UserDefaults.standard.set(worldClocks, forKey: "worldClocks") }
    }

    var announce: (@MainActor (String) -> Void)?
    /// Diz se o microfone está sendo usado pela própria Sexta-feira (para não alertar à toa).
    var ownMicActive: (@MainActor () -> Bool)?

    private let cpuSampler = CPUSampler()
    private let netSampler = NetSampler()
    private let caffeine = Caffeine()
    private let store = EKEventStore()
    private var fastTimer: Timer?
    private var slowTimer: Timer?
    private var caffeineTimer: Timer?
    private var chargeNotified = false
    private var cpuKeys: [String] = []
    private var gpuKeys: [String] = []
    private var sensorsReady = false
    private var ddcServices: [CFTypeRef] = []
    private var privacyPrimed = false

    init(state: AppState) {
        self.state = state
        refreshDisplays()
        refreshAudio()
        tick()
        slowTick()
        fastTimer = every(2) { [weak self] in self?.tick() }
        Task { @MainActor [weak self] in
            let found = await Task.detached { SMCSensors.discover() }.value
            self?.cpuKeys = found.cpu
            self?.gpuKeys = found.gpu
            self?.sensorsReady = true
        }
        slowTimer = every(20) { [weak self] in self?.slowTick() }
        if Self.calendarAuthorized() {
            agendaAllowed = true
            loadEvents()
        }
    }

    // MARK: Monitor

    private func tick() {
        cpu = cpuSampler.sample()
        let m = MacInfo.memory()
        memUsed = m.used
        memTotal = m.total
        let n = netSampler.sample()
        netIn = n.0
        netOut = n.1
        gpu = GPUReader.usage()
        thermal = ProcessInfo.processInfo.thermalState
        if sensorsReady {
            cpuTemp = SMCSensors.temperature(cpuKeys)
            gpuTemp = SMCSensors.temperature(gpuKeys)
            fans = SMCSensors.fans()
        }
        helper.refresh()
        eq.checkDevice()
        cpuHistory = Array((cpuHistory + [cpu]).suffix(60))
        memHistory = Array((memHistory + [m.total > 0 ? m.used / m.total : 0]).suffix(60))
        checkPrivacy()
    }

    private func slowTick() {
        battery = BatteryReader.read()
        checkCharge()
        if agendaAllowed { loadEvents() }
    }

    func slowRefresh() { slowTick() }

    func refreshTopApps() {
        Task { @MainActor in
            let list = await Task.detached { MacInfo.topCPU() }.value
            topApps = list.map { ProcUsage(name: $0.0, value: $0.1) }
        }
    }

    var memPercent: Int { memTotal > 0 ? Int((memUsed / memTotal * 100).rounded()) : 0 }

    var tempText: String {
        if let t = cpuTemp { return String(format: "%.0f °C", t) }
        return thermalText
    }

    var thermalText: String {
        switch thermal {
        case .nominal: return "Normal"
        case .fair: return "Morno"
        case .serious: return "Quente"
        case .critical: return "Muito quente"
        @unknown default: return "—"
        }
    }

    // MARK: Bateria / limite de carga

    private func checkCharge() {
        guard let b = battery else { return }
        // "Carregar até 100% agora": volta ao limite quando enche ou quando tira da tomada.
        if helper.topUp && (b.percent >= 100 || !b.plugged) { helper.topUp = false }
        // Com o ajudante cuidando do limite de verdade, não precisa avisar.
        if helper.running && helper.limitEnabled { return }
        let limit = Prefs.chargeLimit
        if !b.plugged || b.percent < limit - 3 {
            chargeNotified = false
            return
        }
        guard Prefs.chargeAlert, b.plugged, b.percent >= limit, !chargeNotified else { return }
        chargeNotified = true
        let msg = "Bateria em \(b.percent)%. Pode tirar da tomada para preservar a bateria."
        Notifier.post(title: "Limite de carga", body: msg)
        announce?(msg)
    }

    func batterySummary() -> String {
        guard let b = battery else { return "Não encontrei bateria neste Mac." }
        var s = "Bateria em \(b.percent)%, \(b.statusText.lowercased())."
        if b.health > 0 { s += " Saúde de \(b.health)% com \(b.cycles) ciclos." }
        if let m = b.minutesLeft, !b.plugged { s += " Dura mais umas \(Fmt.duration(Double(m * 60)))." }
        return s
    }

    // MARK: Cafeína

    func setCaffeine(minutes: Int?) {
        caffeine.start()
        caffeineOn = caffeine.isOn
        caffeineTimer?.invalidate()
        caffeineTimer = nil
        if let m = minutes, m > 0 {
            caffeineUntil = Date().addingTimeInterval(Double(m * 60))
            caffeineTimer = after(Double(m * 60)) { [weak self] in self?.stopCaffeine() }
        } else {
            caffeineUntil = nil
        }
    }

    func stopCaffeine() {
        caffeine.stop()
        caffeineOn = false
        caffeineUntil = nil
        caffeineTimer?.invalidate()
        caffeineTimer = nil
    }

    // MARK: Telas

    func refreshDisplays() {
        ddcServices = []
        displays = DisplayDimmer.displays()
        for d in displays {
            if let v = dim[d.id], v < 1 { DisplayDimmer.set(d.id, level: v) }
        }
    }

    /// Brilho: tela do Mac pelo sistema; monitor externo por DDC; se não der, escurece por software.
    func setDim(_ id: CGDirectDisplayID, _ v: Double) {
        dim[id] = v
        let software = UserDefaults.standard.bool(forKey: "softwareBrightness")
        if !software {
            if CGDisplayIsBuiltin(id) != 0 {
                if DisplayHardware.setBuiltIn(id, v) { DisplayDimmer.set(id, level: 1); return }
            } else {
                let externals = displays.filter { CGDisplayIsBuiltin($0.id) == 0 }
                if let idx = externals.firstIndex(where: { $0.id == id }) {
                    if ddcServices.isEmpty { ddcServices = DisplayHardware.externalServices() }
                    if idx < ddcServices.count, DisplayHardware.setDDC(ddcServices[idx], brightness: Int(v * 100)) {
                        DisplayDimmer.set(id, level: 1)
                        return
                    }
                }
            }
        }
        DisplayDimmer.set(id, level: v)
    }

    func setAllDim(_ v: Double) {
        for d in displays { setDim(d.id, v) }
    }

    func resetDim() {
        dim = [:]
        DisplayDimmer.resetAll()
    }

    // MARK: Som

    func refreshAudio() {
        outputs = AudioDevices.outputs()
        currentOutput = AudioDevices.defaultOutput()
    }

    func setOutput(_ id: AudioDeviceID) {
        AudioDevices.setDefaultOutput(id)
        refreshAudio()
    }

    func setOutput(named name: String) -> String? {
        refreshAudio()
        let t = Words.normalize(name)
        guard let d = outputs.first(where: { Words.normalize($0.name).contains(t) || t.contains(Words.normalize($0.name)) }) else {
            let list = outputs.map { $0.name }.joined(separator: ", ")
            return "Não achei a saída “\(name)”. Tenho: \(list)."
        }
        setOutput(d.id)
        return nil
    }

    // MARK: Agenda

    static func calendarAuthorized() -> Bool {
        let s = EKEventStore.authorizationStatus(for: .event)
        if #available(macOS 14.0, *) { return s == .fullAccess }
        return s == .authorized
    }

    func requestAgenda() {
        let done: @Sendable (Bool, Error?) -> Void = { [weak self] ok, _ in
            Task { @MainActor in
                self?.agendaAllowed = ok
                if ok { self?.loadEvents() }
            }
        }
        if #available(macOS 14.0, *) {
            store.requestFullAccessToEvents(completion: done)
        } else {
            store.requestAccess(to: .event, completion: done)
        }
    }

    func loadEvents() {
        let start = Calendar.current.startOfDay(for: Date())
        guard let end = Calendar.current.date(byAdding: .day, value: 3, to: start) else { return }
        let pred = store.predicateForEvents(withStart: start, end: end, calendars: nil)
        let now = Date()
        events = store.events(matching: pred)
            .filter { $0.endDate > now }
            .sorted { $0.startDate < $1.startDate }
            .prefix(20)
            .map { e in
                AgendaEvent(title: e.title ?? "Sem título", start: e.startDate, end: e.endDate,
                            allDay: e.isAllDay, color: Color(nsColor: e.calendar?.color ?? .systemBlue))
            }
    }

    func agendaSummary() -> String {
        guard agendaAllowed else { return "Preciso de acesso à sua agenda. Abra a aba Agenda e toque em Permitir." }
        loadEvents()
        let today = events.filter { Calendar.current.isDateInToday($0.start) || ($0.start < Date() && $0.end > Date()) }
        if today.isEmpty {
            if let next = events.first {
                return "Hoje está livre. O próximo é “\(next.title)” \(Self.when(next))."
            }
            return "Sua agenda está livre nos próximos dias."
        }
        let list = today.prefix(3).map { "\($0.allDay ? "o dia todo" : Fmt.time($0.start)): \($0.title)" }.joined(separator: "; ")
        return "Hoje você tem \(today.count == 1 ? "1 compromisso" : "\(today.count) compromissos"): \(list)."
    }

    static func when(_ e: AgendaEvent) -> String {
        if Calendar.current.isDateInTomorrow(e.start) { return "amanhã às \(Fmt.time(e.start))" }
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt_BR")
        f.dateFormat = "EEEE 'às' HH:mm"
        return f.string(from: e.start)
    }

    // MARK: Vigia de câmera e microfone

    private func checkPrivacy() {
        let mic = AudioDevices.micInUse() && !(ownMicActive?() ?? false)
        let cam = CameraWatch.inUse()
        defer {
            micOn = mic
            camOn = cam
            privacyPrimed = true
        }
        guard privacyPrimed else { return }
        let app = NSWorkspace.shared.frontmostApplication?.localizedName ?? "um app"
        if mic != micOn { log(mic ? "🎙 Microfone ligado (app em uso: \(app))" : "🎙 Microfone desligado", alert: mic) }
        if cam != camOn { log(cam ? "📷 Câmera ligada (app em uso: \(app))" : "📷 Câmera desligada", alert: cam) }
    }

    private func log(_ text: String, alert: Bool) {
        privacyLog.insert(PrivacyEvent(text: text), at: 0)
        if privacyLog.count > 50 { privacyLog.removeLast(privacyLog.count - 50) }
        if alert && Prefs.privacyWatch { Notifier.post(title: "Vigia", body: text) }
    }
}
