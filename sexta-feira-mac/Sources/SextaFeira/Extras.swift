import AppKit
import AVFoundation
import CoreAudio
import AudioToolbox

// MARK: - Equalizador do sistema
//
// Usa os "process taps" do Core Audio (macOS 14.2+): captura o som de todos os apps,
// passa por um equalizador de 5 faixas e toca no alto-falante. Sem driver.

enum EQError: LocalizedError {
    case message(String)
    var errorDescription: String? {
        switch self { case .message(let m): return m }
    }
}

/// Filtros biquad (receitas do "Audio EQ Cookbook"). Seguro para o thread de áudio.
final class EQDSP {
    static let frequencies: [Double] = [60, 250, 1000, 4000, 12000]
    static let bandCount = 5

    private let coeffs = UnsafeMutablePointer<Double>.allocate(capacity: 5 * 5)   // b0 b1 b2 a1 a2
    private let state = UnsafeMutablePointer<Double>.allocate(capacity: 2 * 5 * 4) // canal × faixa × (x1 x2 y1 y2)
    private var gain: Double = 1
    private var sampleRate: Double = 48000

    init() {
        coeffs.initialize(repeating: 0, count: 25)
        state.initialize(repeating: 0, count: 40)
        for b in 0..<5 { coeffs[b * 5] = 1 }
    }

    deinit {
        coeffs.deallocate()
        state.deallocate()
    }

    func configure(sampleRate: Double, gains: [Double], preamp: Double) {
        self.sampleRate = sampleRate
        update(gains: gains, preamp: preamp)
    }

    func update(gains: [Double], preamp: Double) {
        for b in 0..<Self.bandCount {
            let g = b < gains.count ? gains[b] : 0
            let kind: Int = b == 0 ? 0 : (b == Self.bandCount - 1 ? 2 : 1) // 0 low shelf, 1 pico, 2 high shelf
            let c = Self.biquad(kind: kind, f0: Self.frequencies[b], gainDB: g, q: 1.0, fs: sampleRate)
            for i in 0..<5 { coeffs[b * 5 + i] = c[i] }
        }
        gain = pow(10, preamp / 20)
    }

    static func biquad(kind: Int, f0: Double, gainDB: Double, q: Double, fs: Double) -> [Double] {
        let a = pow(10, gainDB / 40)
        let w0 = 2 * Double.pi * min(f0, fs * 0.45) / fs
        let cw = cos(w0), sw = sin(w0)
        var b0, b1, b2, a0, a1, a2: Double
        switch kind {
        case 0, 2:
            let alpha = sw / 2 * sqrt(2.0)
            let sa = 2 * sqrt(a) * alpha
            if kind == 0 {
                b0 = a * ((a + 1) - (a - 1) * cw + sa)
                b1 = 2 * a * ((a - 1) - (a + 1) * cw)
                b2 = a * ((a + 1) - (a - 1) * cw - sa)
                a0 = (a + 1) + (a - 1) * cw + sa
                a1 = -2 * ((a - 1) + (a + 1) * cw)
                a2 = (a + 1) + (a - 1) * cw - sa
            } else {
                b0 = a * ((a + 1) + (a - 1) * cw + sa)
                b1 = -2 * a * ((a - 1) + (a + 1) * cw)
                b2 = a * ((a + 1) + (a - 1) * cw - sa)
                a0 = (a + 1) - (a - 1) * cw + sa
                a1 = 2 * ((a - 1) - (a + 1) * cw)
                a2 = (a + 1) - (a - 1) * cw - sa
            }
        default:
            let alpha = sw / (2 * q)
            b0 = 1 + alpha * a
            b1 = -2 * cw
            b2 = 1 - alpha * a
            a0 = 1 + alpha / a
            a1 = -2 * cw
            a2 = 1 - alpha / a
        }
        return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0]
    }

    @inline(__always)
    private func filter(_ ch: Int, _ b: Int, _ x: Double) -> Double {
        let c = coeffs + b * 5
        let s = state + (ch * 5 + b) * 4
        let y = c[0] * x + c[1] * s[0] + c[2] * s[1] - c[3] * s[2] - c[4] * s[3]
        s[1] = s[0]
        s[0] = x
        s[3] = s[2]
        s[2] = y
        return y
    }

    /// Lê o som do tap (os 2 últimos canais de entrada) e escreve na saída já equalizado.
    func process(_ input: UnsafePointer<AudioBufferList>, _ output: UnsafeMutablePointer<AudioBufferList>) {
        let inList = UnsafeMutableAudioBufferListPointer(UnsafeMutablePointer(mutating: input))
        let outList = UnsafeMutableAudioBufferListPointer(output)

        var src: [(UnsafeMutablePointer<Float>, Int, Int)] = []
        for buf in inList {
            guard let d = buf.mData else { continue }
            let n = max(1, Int(buf.mNumberChannels))
            let frames = Int(buf.mDataByteSize) / (4 * n)
            let p = d.assumingMemoryBound(to: Float.self)
            for c in 0..<n { src.append((p + c, n, frames)) }
        }
        if src.count > 2 { src = Array(src.suffix(2)) }
        let g = gain

        var outIndex = 0
        for buf in outList {
            guard let d = buf.mData else { continue }
            let n = max(1, Int(buf.mNumberChannels))
            let frames = Int(buf.mDataByteSize) / (4 * n)
            let p = d.assumingMemoryBound(to: Float.self)
            for c in 0..<n {
                defer { outIndex += 1 }
                guard outIndex < 2, !src.isEmpty else {
                    for f in 0..<frames { p[f * n + c] = 0 }
                    continue
                }
                let ch = outIndex
                let s = src[min(ch, src.count - 1)]
                let count = min(frames, s.2)
                for f in 0..<count {
                    var x = Double(s.0[f * s.1]) * g
                    for b in 0..<Self.bandCount { x = filter(ch, b, x) }
                    p[f * n + c] = Float(max(-1, min(1, x)))
                }
                if count < frames {
                    for f in count..<frames { p[f * n + c] = 0 }
                }
            }
        }
    }
}

@available(macOS 14.2, *)
final class SystemEQ {
    private var tapID = AudioObjectID(kAudioObjectUnknown)
    private var aggID = AudioObjectID(kAudioObjectUnknown)
    private var procID: AudioDeviceIOProcID?
    private let queue = DispatchQueue(label: "sextafeira.eq", qos: .userInteractive)
    private let keepAlive = AVAudioEngine()
    let dsp = EQDSP()

    func start(gains: [Double], preamp: Double) throws {
        // 1) Garante que o app é um "cliente de áudio" para poder se excluir do tap (senão vira eco infinito).
        keepAlive.mainMixerNode.outputVolume = 0
        try? keepAlive.start()

        var pid = getpid()
        var addr = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyTranslatePIDToProcessObject,
                                              mScope: kAudioObjectPropertyScopeGlobal,
                                              mElement: kAudioObjectPropertyElementMain)
        var me = AudioObjectID(kAudioObjectUnknown)
        var size = UInt32(MemoryLayout<AudioObjectID>.size)
        AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &addr,
                                   UInt32(MemoryLayout<pid_t>.size), &pid, &size, &me)
        guard me != AudioObjectID(kAudioObjectUnknown) else {
            throw EQError.message("Não consegui registrar o app no sistema de áudio.")
        }

        // 2) Tap de todo o som do Mac, menos o da Sexta-feira; o som original fica mudo enquanto o EQ roda.
        let desc = CATapDescription(stereoGlobalTapButExcludeProcesses: [me])
        desc.uuid = UUID()
        desc.name = "Sexta-feira EQ"
        desc.isPrivate = true
        desc.muteBehavior = .mutedWhenTapped
        var tap = AudioObjectID(kAudioObjectUnknown)
        var st = AudioHardwareCreateProcessTap(desc, &tap)
        guard st == noErr else {
            throw EQError.message("O macOS não liberou a captura do som (\(st)). Permita em Ajustes › Privacidade e Segurança › Gravação de Tela e Áudio do Sistema.")
        }
        tapID = tap

        var fmtAddr = AudioObjectPropertyAddress(mSelector: kAudioTapPropertyFormat,
                                                 mScope: kAudioObjectPropertyScopeGlobal,
                                                 mElement: kAudioObjectPropertyElementMain)
        var asbd = AudioStreamBasicDescription()
        var fsize = UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
        AudioObjectGetPropertyData(tapID, &fmtAddr, 0, nil, &fsize, &asbd)
        let rate = asbd.mSampleRate > 0 ? asbd.mSampleRate : 48000

        // 3) Dispositivo agregado: saída atual + tap.
        let out = AudioDevices.defaultOutput()
        guard let outUID = AudioDevices.uid(out) else {
            stop()
            throw EQError.message("Não achei a saída de som atual.")
        }
        let dict: [String: Any] = [
            kAudioAggregateDeviceNameKey: "Sexta-feira EQ",
            kAudioAggregateDeviceUIDKey: "com.local.sextafeira.eq." + UUID().uuidString,
            kAudioAggregateDeviceMainSubDeviceKey: outUID,
            kAudioAggregateDeviceIsPrivateKey: true,
            kAudioAggregateDeviceIsStackedKey: false,
            kAudioAggregateDeviceTapAutoStartKey: true,
            kAudioAggregateDeviceSubDeviceListKey: [[kAudioSubDeviceUIDKey: outUID]],
            kAudioAggregateDeviceTapListKey: [[kAudioSubTapDriftCompensationKey: true,
                                               kAudioSubTapUIDKey: desc.uuid.uuidString]],
        ]
        var agg = AudioObjectID(kAudioObjectUnknown)
        st = AudioHardwareCreateAggregateDevice(dict as CFDictionary, &agg)
        guard st == noErr else {
            stop()
            throw EQError.message("Não consegui montar o dispositivo do equalizador (\(st)).")
        }
        aggID = agg

        // 4) Processamento.
        dsp.configure(sampleRate: rate, gains: gains, preamp: preamp)
        let dsp = self.dsp
        var proc: AudioDeviceIOProcID?
        st = AudioDeviceCreateIOProcIDWithBlock(&proc, aggID, queue) { _, input, _, output, _ in
            dsp.process(input, output)
        }
        guard st == noErr, let proc else {
            stop()
            throw EQError.message("Não consegui iniciar o processamento de áudio (\(st)).")
        }
        procID = proc
        st = AudioDeviceStart(aggID, proc)
        guard st == noErr else {
            stop()
            throw EQError.message("Não consegui ligar o equalizador (\(st)).")
        }
    }

    func stop() {
        if let p = procID {
            AudioDeviceStop(aggID, p)
            AudioDeviceDestroyIOProcID(aggID, p)
        }
        procID = nil
        if aggID != AudioObjectID(kAudioObjectUnknown) {
            AudioHardwareDestroyAggregateDevice(aggID)
            aggID = AudioObjectID(kAudioObjectUnknown)
        }
        if tapID != AudioObjectID(kAudioObjectUnknown) {
            AudioHardwareDestroyProcessTap(tapID)
            tapID = AudioObjectID(kAudioObjectUnknown)
        }
        keepAlive.stop()
    }
}

@MainActor
final class EqualizerController: ObservableObject {
    static let labels = ["60", "250", "1k", "4k", "12k"]
    static let presets: [(name: String, gains: [Double])] = [
        ("Plano", [0, 0, 0, 0, 0]),
        ("Mais graves", [6, 3, 0, 0, 0]),
        ("Voz e podcast", [-3, -1, 3, 4, 1]),
        ("Mais agudos", [0, 0, 0, 3, 6]),
        ("Rock", [4, 2, -1, 2, 4]),
        ("Pop", [-1, 2, 4, 2, -1]),
        ("Eletrônica", [5, 3, 0, 2, 4]),
        ("Notebook", [4, 2, 0, 1, 2]),
    ]

    @Published var enabled = false
    @Published var gains: [Double] = UserDefaults.standard.array(forKey: "eqGains") as? [Double] ?? [0, 0, 0, 0, 0] {
        didSet { changed() }
    }
    @Published var preamp: Double = UserDefaults.standard.object(forKey: "eqPreamp") as? Double ?? 0 {
        didSet { changed() }
    }
    @Published var error = ""

    private var engine: AnyObject?
    private var device: AudioDeviceID = 0

    var supported: Bool {
        if #available(macOS 14.2, *) { return true }
        return false
    }

    private func changed() {
        UserDefaults.standard.set(gains, forKey: "eqGains")
        UserDefaults.standard.set(preamp, forKey: "eqPreamp")
        if #available(macOS 14.2, *), let eq = engine as? SystemEQ {
            eq.dsp.update(gains: gains, preamp: preamp)
        }
    }

    func setEnabled(_ on: Bool) {
        if on { start() } else { stop() }
    }

    func apply(preset name: String) -> Bool {
        let t = Words.normalize(name)
        guard let p = Self.presets.first(where: { Words.normalize($0.name).contains(t) || t.contains(Words.normalize($0.name)) }) else {
            return false
        }
        gains = p.gains
        if !enabled { start() }
        return true
    }

    func start() {
        guard #available(macOS 14.2, *) else {
            error = "O equalizador precisa do macOS 14.2 ou mais novo."
            return
        }
        stop()
        let eq = SystemEQ()
        do {
            try eq.start(gains: gains, preamp: preamp)
            engine = eq
            device = AudioDevices.defaultOutput()
            enabled = true
            error = ""
        } catch {
            self.error = error.localizedDescription
            enabled = false
        }
    }

    func stop() {
        if #available(macOS 14.2, *), let eq = engine as? SystemEQ { eq.stop() }
        engine = nil
        enabled = false
    }

    /// Se trocar a saída de som (ex.: conectou o AirPods), religa o EQ no novo dispositivo.
    func checkDevice() {
        guard enabled else { return }
        let now = AudioDevices.defaultOutput()
        if now != device { start() }
    }
}

// MARK: - Barra de menus limpa

/// Esconde ícones da barra de menus: tudo o que ficar à esquerda do separador "│" some
/// quando a barra está recolhida. Arraste os ícones com ⌘ pressionado para organizar.
@MainActor
final class MenuBarCleaner: NSObject {
    private var toggleItem: NSStatusItem?
    private var separator: NSStatusItem?
    private(set) var collapsed = false
    private var autoTimer: Timer?

    var enabled: Bool { toggleItem != nil }

    func setEnabled(_ on: Bool) {
        if on { enable() } else { disable() }
    }

    private func enable() {
        guard toggleItem == nil else { return }
        let t = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        t.autosaveName = "SextaFeiraBarToggle"
        t.button?.image = NSImage(systemSymbolName: "chevron.left.circle", accessibilityDescription: "Mostrar ícones")
        t.button?.target = self
        t.button?.action = #selector(toggle)
        toggleItem = t
        // Criado depois, fica à esquerda do botão.
        let s = NSStatusBar.system.statusItem(withLength: 12)
        s.autosaveName = "SextaFeiraBarSeparator"
        s.button?.title = "│"
        s.button?.appearsDisabled = true
        separator = s
        after(1) { [weak self] in self?.collapse() }
    }

    private func disable() {
        autoTimer?.invalidate()
        if let s = separator { NSStatusBar.system.removeStatusItem(s) }
        if let t = toggleItem { NSStatusBar.system.removeStatusItem(t) }
        separator = nil
        toggleItem = nil
        collapsed = false
    }

    @objc private func toggle() {
        if collapsed { expand() } else { collapse() }
    }

    func collapse() {
        // Só recolhe se o separador estiver à esquerda do botão (senão o botão sumiria junto).
        guard let sx = separator?.button?.window?.frame.minX,
              let tx = toggleItem?.button?.window?.frame.minX, sx < tx else { return }
        separator?.length = 10_000
        collapsed = true
        toggleItem?.button?.image = NSImage(systemSymbolName: "chevron.left.circle", accessibilityDescription: "Mostrar ícones")
    }

    func expand() {
        separator?.length = 12
        collapsed = false
        toggleItem?.button?.image = NSImage(systemSymbolName: "chevron.right.circle.fill", accessibilityDescription: "Esconder ícones")
        autoTimer?.invalidate()
        autoTimer = after(15) { [weak self] in self?.collapse() }
    }
}

// MARK: - Brilho de verdade (tela do Mac e monitores externos via DDC)

enum DisplayHardware {
    private typealias SetBrightnessFn = @convention(c) (CGDirectDisplayID, Float) -> Int32
    private typealias AVCreateFn = @convention(c) (CFAllocator?, io_service_t) -> Unmanaged<CFTypeRef>?
    private typealias AVWriteFn = @convention(c) (CFTypeRef, UInt32, UInt32, UnsafeMutableRawPointer, UInt32) -> Int32

    private static let displayServices = dlopen("/System/Library/PrivateFrameworks/DisplayServices.framework/DisplayServices", RTLD_LAZY)
    private static let iokit = dlopen("/System/Library/Frameworks/IOKit.framework/IOKit", RTLD_LAZY)

    /// Brilho da tela embutida (0…1).
    static func setBuiltIn(_ id: CGDirectDisplayID, _ level: Double) -> Bool {
        guard let ds = displayServices, let sym = dlsym(ds, "DisplayServicesSetBrightness") else { return false }
        let fn = unsafeBitCast(sym, to: SetBrightnessFn.self)
        return fn(id, Float(max(0, min(1, level)))) == 0
    }

    /// Serviços DDC dos monitores externos (Apple Silicon), na ordem em que o sistema os lista.
    static func externalServices() -> [CFTypeRef] {
        guard let lib = iokit, let c = dlsym(lib, "IOAVServiceCreateWithService") else { return [] }
        let create = unsafeBitCast(c, to: AVCreateFn.self)
        var iter: io_iterator_t = 0
        guard IOServiceGetMatchingServices(kIOMainPortDefault, IOServiceMatching("DCPAVServiceProxy"), &iter) == KERN_SUCCESS else {
            return []
        }
        defer { IOObjectRelease(iter) }
        var result: [CFTypeRef] = []
        var s = IOIteratorNext(iter)
        while s != 0 {
            let loc = IORegistryEntryCreateCFProperty(s, "Location" as CFString, kCFAllocatorDefault, 0)?
                .takeRetainedValue() as? String
            if loc == "External", let av = create(kCFAllocatorDefault, s)?.takeRetainedValue() {
                result.append(av)
            }
            IOObjectRelease(s)
            s = IOIteratorNext(iter)
        }
        return result
    }

    /// Envia "brilho = X" (0–100) para o monitor via DDC/CI.
    static func setDDC(_ service: CFTypeRef, brightness: Int) -> Bool {
        guard let lib = iokit, let w = dlsym(lib, "IOAVServiceWriteI2C") else { return false }
        let write = unsafeBitCast(w, to: AVWriteFn.self)
        let v = UInt8(max(0, min(100, brightness)))
        var packet: [UInt8] = [0x84, 0x03, 0x10, 0x00, v, 0]
        packet[5] = 0x6E ^ 0x51 ^ packet[0] ^ packet[1] ^ packet[2] ^ packet[3] ^ packet[4]
        var ok = false
        for _ in 0..<2 {
            usleep(10_000)
            if write(service, 0x37, 0x51, &packet, UInt32(packet.count)) == 0 { ok = true }
        }
        return ok
    }
}
