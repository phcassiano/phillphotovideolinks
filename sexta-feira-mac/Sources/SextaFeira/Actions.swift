import Foundation

/// Tudo que a assistente sabe fazer no Mac.
enum Action {
    case openApp(String), quitApp(String), openURL(String), webSearch(String)
    case music(String), musicSearch(String)
    case volumeSet(Int), volumeChange(Int)
    case timer(seconds: Double, label: String)
    case reminder(seconds: Double, text: String)
    case addTask(String), completeTask(String)
    case note(String), remember(String), forget(String)
    case shortcut(String)
    case habit(String), copyPix, checkMac, image(String), run(String)
    case boost, battery, agenda, caffeine(Int?), caffeineOff
    case window(WindowSnap), audioOutput(String), brightness(Int)

    /// Converte um item de "actions" do JSON da IA.
    static func from(_ d: [String: Any]) -> Action? {
        func str(_ k: String) -> String {
            if let s = d[k] as? String { return s.trimmed }
            if let n = d[k] as? NSNumber { return n.stringValue }
            return ""
        }
        func num(_ k: String) -> Double? {
            if let n = d[k] as? NSNumber { return n.doubleValue }
            if let s = d[k] as? String { return Double(s.replacingOccurrences(of: ",", with: ".").trimmed) }
            return nil
        }
        func nonEmpty(_ s: String, _ make: (String) -> Action) -> Action? { s.isEmpty ? nil : make(s) }

        switch str("type").lowercased() {
        case "open_app": return nonEmpty(str("app")) { .openApp($0) }
        case "quit_app": return nonEmpty(str("app")) { .quitApp($0) }
        case "open_url": return nonEmpty(str("url")) { .openURL($0) }
        case "web_search": return nonEmpty(str("query")) { .webSearch($0) }
        case "music": return nonEmpty(str("command").lowercased()) { .music($0) }
        case "music_search": return nonEmpty(str("query")) { .musicSearch($0) }
        case "volume":
            if let l = num("level") { return .volumeSet(Int(l)) }
            if let c = num("change") { return .volumeChange(Int(c)) }
            return nil
        case "timer":
            let secs = num("seconds") ?? num("minutes").map { $0 * 60 } ?? 0
            return secs > 0 ? .timer(seconds: secs, label: str("label")) : nil
        case "reminder":
            let text = str("text")
            if let m = num("minutes") { return .reminder(seconds: m * 60, text: text) }
            if let s = num("seconds") { return .reminder(seconds: s, text: text) }
            if let s = secondsUntil(str("at")) { return .reminder(seconds: s, text: text) }
            return nil
        case "add_task": return nonEmpty(str("text")) { .addTask($0) }
        case "complete_task": return nonEmpty(str("text")) { .completeTask($0) }
        case "note": return nonEmpty(str("text")) { .note($0) }
        case "remember": return nonEmpty(str("fact")) { .remember($0) }
        case "forget": return nonEmpty(str("fact")) { .forget($0) }
        case "shortcut": return nonEmpty(str("name")) { .shortcut($0) }
        case "habit": return nonEmpty(str("name")) { .habit($0) }
        case "copy_pix": return .copyPix
        case "check_mac": return .checkMac
        case "image": return nonEmpty(str("prompt")) { .image($0) }
        case "run": return nonEmpty(str("name")) { .run($0) }
        case "boost": return .boost
        case "battery_status": return .battery
        case "agenda": return .agenda
        case "caffeine":
            if str("state").lowercased() == "off" { return .caffeineOff }
            return .caffeine(num("minutes").map { Int($0) })
        case "window":
            let pos = str("position").lowercased()
            return WindowSnap(rawValue: pos).map { .window($0) } ?? windowAlias(pos).map { .window($0) }
        case "audio_output": return nonEmpty(str("name")) { .audioOutput($0) }
        case "brightness": return num("level").map { .brightness(Int($0)) }
        default: return nil
        }
    }

    static func windowAlias(_ s: String) -> WindowSnap? {
        switch s {
        case "left", "esquerda": return .left
        case "right", "direita": return .right
        case "top", "cima", "em cima": return .top
        case "bottom", "baixo", "embaixo": return .bottom
        case "maximize", "max", "tela cheia", "full": return .maximize
        case "center", "centro", "meio": return .center
        case "next_display", "outro monitor", "outra tela", "proximo monitor": return .nextDisplay
        case "previous_display": return .previousDisplay
        case "top_left": return .topLeft
        case "top_right": return .topRight
        case "bottom_left": return .bottomLeft
        case "bottom_right": return .bottomRight
        default: return nil
        }
    }

    /// "16:30" -> segundos até a próxima vez que o relógio marcar 16:30.
    static func secondsUntil(_ hhmm: String) -> Double? {
        let parts = hhmm.split(whereSeparator: { $0 == ":" || $0 == "h" || $0 == "." }).compactMap { Int($0) }
        guard let h = parts.first, (0..<24).contains(h) else { return nil }
        let m = parts.count > 1 ? parts[1] : 0
        let cal = Calendar.current
        var comps = cal.dateComponents([.year, .month, .day], from: Date())
        comps.hour = h
        comps.minute = m
        guard var date = cal.date(from: comps) else { return nil }
        if date <= Date() { date = cal.date(byAdding: .day, value: 1, to: date) ?? date }
        return date.timeIntervalSinceNow
    }
}

/// Comandos simples resolvidos na hora, sem IA (funcionam offline).
enum QuickCommands {
    struct Result {
        let actions: [Action]
        let say: String
    }

    private static func unit(_ u: String) -> Double {
        if u.hasPrefix("h") { return 3600 }
        if u.hasPrefix("m") { return 60 }
        return 1
    }

    static func parse(_ raw: String) -> Result? {
        let t = Words.normalize(raw)
        guard !t.isEmpty else { return nil }
        let n = Words.digits(t)

        // Horas
        if ["que horas sao", "que hora e", "que horas e", "me diz as horas", "me fala as horas"].contains(t) {
            return Result(actions: [], say: "São \(Fmt.time(Date())).")
        }

        // Água / hábitos
        if Rx.match(#"^(?:bebi|tomei) (?:mais )?(?:um |1 )?(?:copo )?(?:de |d )?agua$"#, t) != nil {
            return Result(actions: [.habit("água")], say: "Boa! Mais um copo de água. 💧")
        }

        // Pix
        if ["copia meu pix", "copia o pix", "copia minha chave pix", "copiar meu pix", "meu pix"].contains(t) {
            return Result(actions: [.copyPix], say: "Pix copiado!")
        }

        // Verificar o Mac
        let checkPhrases = ["como esta meu mac", "como esta o mac", "como ta meu mac", "como esta meu pc",
                            "como ta meu pc", "como esta meu computador", "verifica o mac", "verifica meu mac",
                            "verifica o pc", "verifica meu pc", "checa meu mac", "analisa meu mac"]
        if checkPhrases.contains(t) {
            return Result(actions: [.checkMac], say: "Deixa eu dar uma olhada no seu Mac…")
        }

        // Arte / imagem
        if Rx.match(#"^(?:cria|crie|criar|gera|gere|gerar|faz|faca|fazer|desenha|desenhe)(?: uma| um)? (?:arte|imagem|desenho|logo|logotipo|figura|ilustracao|foto)\b.+$"#, t) != nil {
            return Result(actions: [.image(raw.trimmed)], say: "Criando sua arte… já te mostro! 🎨")
        }

        // Ferramentas do Mac (Pulso)
        if ["boost", "faz um boost", "faca um boost", "da um boost", "acelera o mac", "otimiza o mac", "otimizar o mac"].contains(t) {
            return Result(actions: [.boost], say: "Boost começando! Vou limpar o que é seguro e te digo a nota. ⚡")
        }
        if ["bateria", "como esta a bateria", "como ta a bateria", "quanto de bateria", "saude da bateria",
            "como esta a saude da bateria", "quanto tem de bateria"].contains(t) {
            return Result(actions: [.battery], say: "")
        }
        if ["agenda", "minha agenda", "agenda de hoje", "o que tenho hoje", "o que eu tenho hoje", "proximo compromisso",
            "qual meu proximo compromisso", "tenho reuniao hoje", "compromissos de hoje"].contains(t) {
            return Result(actions: [.agenda], say: "")
        }
        if ["desliga a cafeina", "pode dormir", "desativa a cafeina", "tira a cafeina"].contains(t) {
            return Result(actions: [.caffeineOff], say: "Cafeína desligada. O Mac pode dormir quando quiser.")
        }
        if let m = Rx.match(#"^(?:deixa|mantem|mantenha|manter) o (?:mac|computador|pc) acordado(?: (?:por|durante) (\d+) ?(minutos?|min|horas?|h))?$"#, n) {
            let mins = Int(m[1]).map { $0 * (m[2].hasPrefix("h") ? 60 : 1) }
            return Result(actions: [.caffeine(mins)],
                          say: mins.map { "Cafeína ligada por \(Fmt.duration(Double($0 * 60)))." } ?? "Cafeína ligada. O Mac não vai dormir.")
        }
        if ["cafeina", "modo cafeina", "liga a cafeina", "ativa a cafeina"].contains(t) {
            return Result(actions: [.caffeine(nil)], say: "Cafeína ligada. O Mac não vai dormir.")
        }
        if let m = Rx.match(#"^(?:coloca|joga|manda|move|poe|bota|leva)?(?: a)? ?janela (?:para a |pra |na |no |pro |para o |a |o |em )?(esquerda|direita|cima|em cima|baixo|embaixo|tela cheia|centro|meio|outro monitor|outra tela|proximo monitor)$"#, t),
           let snap = Action.windowAlias(m[1]) {
            return Result(actions: [.window(snap)], say: "")
        }
        if ["maximiza", "maximiza a janela", "janela em tela cheia", "aumenta a janela"].contains(t) {
            return Result(actions: [.window(.maximize)], say: "")
        }
        if let m = Rx.match(#"^(?:muda|troca|coloca|passa|joga) (?:o )?(?:som|audio|saida de audio|saida) (?:para|pra|no|na|nos|nas) (?:o |a |os |as )?(.+)$"#, t) {
            return Result(actions: [.audioOutput(m[1])], say: "Som trocado.")
        }
        if let m = Rx.match(#"^(?:brilho|escurece a tela|escurecer a tela)(?: em| para| pra| no| a)? (\d{1,3})(?: por cento)?$"#, n),
           let v = Int(m[1]) {
            return Result(actions: [.brightness(v)], say: "")
        }

        // Volume
        if let m = Rx.match(#"^(?:volume|(?:coloca|poe|bota|muda|deixa) o volume)(?: em| para| pra| no| a)? (\d{1,3})(?: por cento)?$"#, n),
           let v = Int(m[1]) {
            return Result(actions: [.volumeSet(v)], say: "")
        }
        if Rx.match(#"^(?:aumenta|aumentar|sobe|subir) (?:o )?(?:volume|som)(?: um pouco)?$"#, t) != nil {
            return Result(actions: [.volumeChange(12)], say: "")
        }
        if Rx.match(#"^(?:abaixa|abaixar|baixa|baixar|diminui|diminuir) (?:o )?(?:volume|som)(?: um pouco)?$"#, t) != nil {
            return Result(actions: [.volumeChange(-12)], say: "")
        }
        if ["muta", "mudo", "silencio", "tira o som"].contains(t) {
            return Result(actions: [.volumeSet(0)], say: "")
        }

        // Timer: "timer de 10 minutos pra pizza"
        if let m = Rx.match(#"^(?:(?:coloca|poe|bota|cria|inicia|liga|faz|marca) )?(?:1 )?(?:timer|temporizador|alarme|cronometro)(?: de)? (\d+) ?(segundos?|seg|s|minutos?|min|m|horas?|h)(?: (?:pra|para|pro|de|do|da) (.+))?$"#, n),
           let v = Double(m[1]) {
            let secs = v * unit(m[2])
            let label = m[3].isEmpty ? "" : Words.originalTail(raw, tail: m[3])
            let suffix = label.isEmpty ? "" : " para \(label)"
            return Result(actions: [.timer(seconds: secs, label: label)],
                          say: "Timer de \(Fmt.duration(secs))\(suffix) começou.")
        }

        // Lembrete: "me lembra de ligar pro cliente em 30 minutos"
        if let m = Rx.match(#"^(?:me )?lembr[ae](?: me)? (?:de |que )?(.+?) (?:em|daqui a|daqui) (\d+) ?(segundos?|minutos?|min|horas?|h)$"#, n),
           let v = Double(m[2]) {
            let secs = v * unit(m[3])
            return Result(actions: [.reminder(seconds: secs, text: m[1])],
                          say: "Combinado, te lembro em \(Fmt.duration(secs)).")
        }

        // Tarefa: "cria a tarefa mandar a proposta"
        if let m = Rx.match(#"^(?:adiciona|adicionar|cria|criar|coloca|poe|bota|anota) (?:uma |a )?(?:nova )?tarefa(?: de| pra| para)? (.+)$"#, t) {
            let text = Words.originalTail(raw, tail: m[1])
            return Result(actions: [.addTask(text)], say: "Tarefa criada.")
        }

        // Nota: "anota que preciso comprar café"
        if let m = Rx.match(#"^(?:anota|anote|anotar|toma nota)(?: ai)?(?: que)? (.+)$"#, t) {
            let text = Words.originalTail(raw, tail: m[1])
            return Result(actions: [.note(text)], say: "Anotado.")
        }

        // Música
        let pause = ["pausa", "pause", "pausar", "pausa a musica", "para a musica", "parar a musica", "pausa musica"]
        let play = ["continua", "continuar", "despausa", "play", "volta a tocar", "toca", "tocar", "continua a musica"]
        let next = ["proxima", "proxima musica", "pula", "pular", "pula a musica", "passa", "passa a musica", "proxima faixa"]
        let prev = ["anterior", "musica anterior", "volta a musica", "volta uma musica", "faixa anterior"]
        if pause.contains(t) { return Result(actions: [.music("pause")], say: "") }
        if play.contains(t) { return Result(actions: [.music("play")], say: "") }
        if next.contains(t) { return Result(actions: [.music("next")], say: "") }
        if prev.contains(t) { return Result(actions: [.music("previous")], say: "") }

        if let m = Rx.match(#"^(?:toca|tocar|toque|coloca|bota|poe) (?:uma musica |umas musicas |musica |musicas |as musicas |a musica |o som )?(?:d[oae]s? )?(.+)$"#, t) {
            let q = Words.originalTail(raw, tail: m[1])
            return Result(actions: [.musicSearch(q)], say: "Abri a busca de “\(q)”. É só dar play.")
        }

        // Abrir app (só se o app existir; se não, a IA decide — pode ser um site)
        if let m = Rx.match(#"^(?:abre|abrir|abra|abri|inicia|iniciar) (?:pra mim )?(?:o |a )?(?:app |aplicativo )?(.+)$"#, t),
           let url = AppFinder.find(m[1]) {
            return Result(actions: [.openApp(m[1])], say: "Abrindo \(AppFinder.displayName(url)).")
        }

        // Fechar app
        if let m = Rx.match(#"^(?:fecha|fechar|feche|encerra|encerrar) (?:o |a )?(?:app |aplicativo )?(.+)$"#, t) {
            return Result(actions: [.quitApp(m[1])], say: "Fechando.")
        }

        return nil
    }
}

/// Lê a resposta da IA: {"say": "...", "actions": [...]}
enum ReplyParser {
    static func parse(_ raw: String) -> (say: String, actions: [Action]) {
        let s = raw.trimmed
        if let a = s.firstIndex(of: "{"), let b = s.lastIndex(of: "}"), a < b,
           let data = String(s[a...b]).data(using: .utf8),
           let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
            let say = (obj["say"] as? String ?? "").trimmed
            let acts = (obj["actions"] as? [[String: Any]] ?? []).compactMap { Action.from($0) }
            return (say, acts)
        }
        return (s.replacingOccurrences(of: "```", with: "").trimmed, [])
    }
}
