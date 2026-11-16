import Foundation

extension Optional where Wrapped == String {
    var nonEmpty: String? {
        guard let s = self, !s.isEmpty else { return nil }
        return s
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}

/// Roda `work` na thread principal depois de `seconds`.
@MainActor @discardableResult
func after(_ seconds: TimeInterval, _ work: @escaping @MainActor @Sendable () -> Void) -> Timer {
    let t = Timer(timeInterval: seconds, repeats: false) { _ in
        Task { @MainActor in work() }
    }
    RunLoop.main.add(t, forMode: .common)
    return t
}

/// Roda `work` na thread principal a cada `seconds`.
@MainActor @discardableResult
func every(_ seconds: TimeInterval, _ work: @escaping @MainActor @Sendable () -> Void) -> Timer {
    let t = Timer(timeInterval: seconds, repeats: true) { _ in
        Task { @MainActor in work() }
    }
    RunLoop.main.add(t, forMode: .common)
    return t
}

/// Ferramentas de texto em português (sem acento, minúsculo, etc).
enum Words {
    static func normalize(_ s: String) -> String {
        let folded = s.folding(options: [.diacriticInsensitive, .caseInsensitive],
                               locale: Locale(identifier: "pt_BR")).lowercased()
        var out = ""
        for c in folded { out.append((c.isLetter || c.isNumber) ? c : " ") }
        return out.split(separator: " ").joined(separator: " ")
    }

    static func urlEncode(_ s: String) -> String {
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")
        return s.addingPercentEncoding(withAllowedCharacters: allowed) ?? s
    }

    /// Troca números por extenso ("dez minutos") por dígitos ("10 minutos").
    static func digits(_ s: String) -> String {
        var t = " " + s + " "
        t = t.replacingOccurrences(of: " meia hora ", with: " 30 minutos ")
        let map: [String: String] = [
            "um": "1", "uma": "1", "dois": "2", "duas": "2", "tres": "3", "quatro": "4",
            "cinco": "5", "seis": "6", "sete": "7", "oito": "8", "nove": "9", "dez": "10",
            "doze": "12", "quinze": "15", "vinte": "20", "trinta": "30", "quarenta": "40",
            "cinquenta": "50", "sessenta": "60", "noventa": "90",
        ]
        for (word, digit) in map {
            t = t.replacingOccurrences(of: " \(word) ", with: " \(digit) ")
        }
        return t.trimmed
    }

    private static func tokens(_ original: String) -> (words: [String], owner: [Int], toks: [String]) {
        let words = original.split(whereSeparator: { $0.isWhitespace }).map(String.init)
        var owner: [Int] = []
        var toks: [String] = []
        for (i, w) in words.enumerated() {
            for t in normalize(w).split(separator: " ") {
                toks.append(String(t))
                owner.append(i)
            }
        }
        return (words, owner, toks)
    }

    /// Devolve o texto original que vem depois da frase (ex.: o nome da assistente).
    /// `nil` quando a frase não aparece. Com `atStart`, só aceita a frase no começo
    /// (permitindo "ei", "oi"… antes).
    static func textAfter(phrase: String, in original: String, atStart: Bool = false) -> String? {
        let (words, owner, toks) = tokens(original)
        let p = normalize(phrase).split(separator: " ").map(String.init)
        guard !p.isEmpty, toks.count >= p.count else { return nil }
        let fillers: Set<String> = ["ei", "oi", "ola", "e", "ai", "hey", "opa", "fala"]
        var foundEnd: Int?
        for start in 0...(toks.count - p.count) {
            guard (0..<p.count).allSatisfy({ toks[start + $0] == p[$0] }) else { continue }
            if atStart {
                guard toks[..<start].allSatisfy({ fillers.contains($0) }) else { continue }
                foundEnd = start + p.count - 1
                break
            }
            foundEnd = start + p.count - 1
        }
        guard let end = foundEnd else { return nil }
        let next = owner[end] + 1
        guard next < words.count else { return "" }
        return words[next...].joined(separator: " ")
            .trimmingCharacters(in: CharacterSet(charactersIn: " ,.!?;:–-"))
    }

    /// Dado o texto original e o "final" dele já normalizado, devolve esse final
    /// com acentos e maiúsculas originais.
    static func originalTail(_ original: String, tail: String) -> String {
        let (words, owner, toks) = tokens(original)
        let tailCount = tail.split(separator: " ").count
        let k = toks.count - tailCount
        guard tailCount > 0, k >= 0, k < owner.count else { return tail }
        return words[owner[k]...].joined(separator: " ")
            .trimmingCharacters(in: CharacterSet(charactersIn: " ,.!?;:"))
    }
}

enum Rx {
    /// Primeira ocorrência; devolve [texto inteiro, grupo1, grupo2…] ("" para grupos vazios).
    static func match(_ pattern: String, _ text: String) -> [String]? {
        guard let re = try? NSRegularExpression(pattern: pattern) else { return nil }
        let ns = text as NSString
        guard let m = re.firstMatch(in: text, range: NSRange(location: 0, length: ns.length)) else { return nil }
        return (0..<m.numberOfRanges).map { i in
            let r = m.range(at: i)
            return r.location == NSNotFound ? "" : ns.substring(with: r)
        }
    }
}

enum Fmt {
    private static let hm: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f
    }()
    private static let full: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt_BR")
        f.dateStyle = .full
        f.timeStyle = .short
        return f
    }()
    private static let stampF: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd HH:mm"
        return f
    }()

    static func time(_ d: Date) -> String { hm.string(from: d) }
    static func longDate(_ d: Date) -> String { full.string(from: d) }
    static func stamp(_ d: Date) -> String { stampF.string(from: d) }

    static func countdown(_ s: TimeInterval) -> String {
        let t = max(0, Int(s.rounded(.up)))
        let h = t / 3600, m = (t % 3600) / 60, sec = t % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, sec) : String(format: "%02d:%02d", m, sec)
    }

    static func duration(_ secs: Double) -> String {
        let t = Int(secs.rounded())
        let h = t / 3600, m = (t % 3600) / 60, s = t % 60
        var parts: [String] = []
        if h > 0 { parts.append(h == 1 ? "1 hora" : "\(h) horas") }
        if m > 0 { parts.append(m == 1 ? "1 minuto" : "\(m) minutos") }
        if s > 0 && h == 0 { parts.append(s == 1 ? "1 segundo" : "\(s) segundos") }
        return parts.isEmpty ? "0 segundos" : parts.joined(separator: " e ")
    }
}
