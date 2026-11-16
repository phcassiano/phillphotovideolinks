import Foundation
import AVFoundation
import Speech

/// Reconhecimento de voz em português.
/// - "Segurar para falar": beginPush / endPush
/// - "Sempre ouvindo": escuta continuamente e reage quando ouve o nome da assistente.
@MainActor
final class SpeechService {
    var onPartial: (@MainActor (String) -> Void)?
    var onCommand: (@MainActor (String) -> Void)?
    var onListeningChanged: (@MainActor (Bool) -> Void)?
    var wakePhrase = "Sexta-feira"

    private(set) var isPushing = false
    private var wakeEnabled = false
    private var paused = false
    private var awake = false
    private var latest = ""
    private var failures = 0

    private let engine = AVAudioEngine()
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "pt-BR"))
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var generation = 0
    private var silenceTimer: Timer?
    private var restartTimer: Timer?
    private var pushTimeout: Timer?

    nonisolated static func requestPermissions(_ done: @escaping @Sendable @MainActor (Bool) -> Void) {
        SFSpeechRecognizer.requestAuthorization { status in
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                Task { @MainActor in done(status == .authorized && granted) }
            }
        }
    }

    // MARK: Controles

    func setWake(_ enabled: Bool) {
        wakeEnabled = enabled
        failures = 0
        if enabled {
            if !isPushing && !paused { startSession() }
        } else if !isPushing {
            stopSession()
        }
    }

    func beginPush() {
        isPushing = true
        awake = false
        startSession()
        onListeningChanged?(true)
    }

    func endPush() {
        guard isPushing else { return }
        stopAudio()
        request?.endAudio()
        pushTimeout?.invalidate()
        pushTimeout = after(1.5) { [weak self] in self?.finishPush() }
    }

    /// Para de ouvir enquanto a assistente fala (para ela não ouvir a si mesma).
    func pause() {
        paused = true
        if !isPushing { stopSession() }
    }

    func resume() {
        paused = false
        resumeWakeIfNeeded()
    }

    // MARK: Sessão de reconhecimento

    private func startSession() {
        stopSession()
        guard let recognizer, recognizer.isAvailable else {
            NSLog("Reconhecimento de fala indisponível")
            return
        }
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else {
            NSLog("Nenhum microfone disponível")
            return
        }
        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        if recognizer.supportsOnDeviceRecognition { req.requiresOnDeviceRecognition = true }
        request = req

        input.installTap(onBus: 0, bufferSize: 1024, format: format, block: Self.makeTap(req))
        engine.prepare()
        do {
            try engine.start()
        } catch {
            NSLog("Erro ao abrir o microfone: \(error)")
            input.removeTap(onBus: 0)
            return
        }

        generation += 1
        latest = ""
        task = recognizer.recognitionTask(with: req, resultHandler: Self.makeHandler(owner: self, generation: generation))

        if !isPushing {
            // O reconhecimento da Apple tem limite de ~1 min por sessão: reinicia antes disso.
            restartTimer = after(55) { [weak self] in self?.periodicRestart() }
        }
    }

    nonisolated private static func makeTap(_ req: SFSpeechAudioBufferRecognitionRequest) -> AVAudioNodeTapBlock {
        return { buffer, _ in req.append(buffer) }
    }

    nonisolated private static func makeHandler(owner: SpeechService, generation: Int)
        -> (SFSpeechRecognitionResult?, Error?) -> Void {
        return { result, error in
            let text = result?.bestTranscription.formattedString
            let isFinal = result?.isFinal ?? false
            let failed = error != nil
            Task { @MainActor in
                owner.handle(generation: generation, text: text, isFinal: isFinal, failed: failed)
            }
        }
    }

    private func handle(generation gen: Int, text: String?, isFinal: Bool, failed: Bool) {
        guard gen == generation else { return }
        if let text {
            latest = text
            failures = 0
        }

        if isPushing {
            if let text { onPartial?(text) }
            if isFinal || failed { finishPush() }
            return
        }

        if let text { processWake(text) }
        if isFinal || failed {
            if awake {
                deliverWake()
            } else {
                if failed { failures += 1 }
                scheduleRestart(failed ? min(30, pow(2, Double(failures))) : 0.2)
            }
        }
    }

    private func finishPush() {
        guard isPushing else { return }
        isPushing = false
        pushTimeout?.invalidate()
        let text = latest.trimmed
        stopSession()
        onListeningChanged?(false)
        if !text.isEmpty { onCommand?(text) }
        resumeWakeIfNeeded()
    }

    // MARK: "Sempre ouvindo"

    private func processWake(_ text: String) {
        guard let cmd = Words.textAfter(phrase: wakePhrase, in: text) else { return }
        if !awake {
            awake = true
            onListeningChanged?(true)
        }
        onPartial?(cmd)
        silenceTimer?.invalidate()
        // Espera uma pausa na fala para considerar o pedido completo.
        silenceTimer = after(cmd.isEmpty ? 5.0 : 1.4) { [weak self] in self?.deliverWake() }
    }

    private func deliverWake() {
        silenceTimer?.invalidate()
        guard awake else { return }
        awake = false
        let cmd = (Words.textAfter(phrase: wakePhrase, in: latest) ?? "").trimmed
        onListeningChanged?(false)
        startSession() // começa do zero para não reaproveitar o texto antigo
        if !cmd.isEmpty { onCommand?(cmd) }
    }

    private func periodicRestart() {
        guard wakeEnabled, !isPushing, !paused else { return }
        if awake {
            restartTimer = after(5) { [weak self] in self?.periodicRestart() }
            return
        }
        startSession()
    }

    private func scheduleRestart(_ delay: TimeInterval) {
        restartTimer?.invalidate()
        restartTimer = after(delay) { [weak self] in
            guard let self, self.wakeEnabled, !self.paused, !self.isPushing else { return }
            self.startSession()
        }
    }

    private func resumeWakeIfNeeded() {
        if wakeEnabled && !paused && !isPushing { startSession() }
    }

    // MARK: Limpeza

    private func stopAudio() {
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
    }

    private func stopSession() {
        generation += 1
        silenceTimer?.invalidate()
        restartTimer?.invalidate()
        pushTimeout?.invalidate()
        task?.cancel()
        task = nil
        request?.endAudio()
        request = nil
        stopAudio()
        awake = false
    }
}

/// Fala as respostas com as vozes do macOS.
@MainActor
final class Speaker: NSObject, AVSpeechSynthesizerDelegate {
    private let synth = AVSpeechSynthesizer()
    var onFinish: (@MainActor () -> Void)?

    override init() {
        super.init()
        synth.delegate = self
    }

    func speak(_ text: String) {
        let u = AVSpeechUtterance(string: text)
        u.voice = Self.voice()
        u.rate = AVSpeechUtteranceDefaultSpeechRate * 1.05
        synth.speak(u)
    }

    func stop() {
        if synth.isSpeaking { synth.stopSpeaking(at: .immediate) }
    }

    nonisolated static func ptVoices() -> [AVSpeechSynthesisVoice] {
        AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.language.hasPrefix("pt") }
            .sorted {
                let a = ($0.language == "pt-BR" ? 10 : 0) + $0.quality.rawValue
                let b = ($1.language == "pt-BR" ? 10 : 0) + $1.quality.rawValue
                return a > b
            }
    }

    private static func voice() -> AVSpeechSynthesisVoice? {
        let id = Prefs.voiceID
        if !id.isEmpty, let v = AVSpeechSynthesisVoice(identifier: id) { return v }
        return ptVoices().first ?? AVSpeechSynthesisVoice(language: "pt-BR")
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in self.onFinish?() }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in self.onFinish?() }
    }
}
