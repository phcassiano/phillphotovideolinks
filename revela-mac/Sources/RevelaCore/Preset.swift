import Foundation

/**
 * Preset do Lightroom lido de um .xmp (Lightroom Classic/CC), de um .lrtemplate (Lightroom antigo)
 * ou de um .dng exportado pelo Lightroom Mobile: todos guardam os ajustes como "crs:Nome=valor".
 * Mesma leitura do app Android (Preset.kt).
 */
public struct Preset {
    public let name: String
    public let numbers: [String: Double]
    public let texts: [String: String]
    /** Curvas de tons: pontos (entrada, saída) de 0 a 255. */
    public let curves: [String: [(Double, Double)]]
    /** Partes do preset que este app não reproduz (só para avisar). */
    public let ignored: [String]

    public init(name: String, numbers: [String: Double], texts: [String: String] = [:], curves: [String: [(Double, Double)]] = [:], ignored: [String] = []) {
        self.name = name
        self.numbers = numbers
        self.texts = texts
        self.curves = curves
        self.ignored = ignored
    }

    public func n(_ key: String, _ fallback: Double = 0) -> Double { numbers[key] ?? fallback }

    private static let attribute = regex(#"crs:(\w+)\s*=\s*"([^"]*)""#)
    private static let element = regex(#"<crs:(\w+)>([^<]*)</crs:\1>"#)
    private static let xmpName = regex(#"<crs:Name>\s*<rdf:Alt>\s*<rdf:li[^>]*>([^<]*)</rdf:li>"#)
    private static let xmpCurve = regex(#"<crs:(ToneCurvePV2012(?:Red|Green|Blue)?)>\s*<rdf:Seq>(.*?)</rdf:Seq>"#, dotAll: true)
    private static let xmpPoint = regex(#"<rdf:li>\s*([\d.]+)\s*,\s*([\d.]+)\s*</rdf:li>"#)
    private static let lrNumber = regex(#"\b(\w+)\s*=\s*([-+]?\d+(?:\.\d+)?)\s*,"#)
    private static let lrText = regex(#"\b(\w+)\s*=\s*"([^"]*)"\s*,"#)
    private static let lrTitle = regex(#"\btitle\s*=\s*"([^"]*)""#)
    private static let lrCurve = regex(#"\b(ToneCurvePV2012(?:Red|Green|Blue)?)\s*=\s*\{([^}]*)\}"#)
    private static let number = regex(#"[-+]?\d+(?:\.\d+)?"#)

    public static func parse(fileName: String, data: Data) -> Preset? {
        // Latin-1 aceita qualquer byte: serve para o XMP dentro de um .dng (binário) também.
        let text = String(data: data, encoding: .isoLatin1) ?? ""
        var numbers: [String: Double] = [:]
        var texts: [String: String] = [:]
        var curves: [String: [(Double, Double)]] = [:]

        for m in groups(attribute, text) + groups(element, text) {
            let value = m[2].trimmingCharacters(in: .whitespaces)
            let plain = value.hasPrefix("+") ? String(value.dropFirst()) : value
            if let v = Double(plain), v.isFinite { numbers[m[1]] = v } else { texts[m[1]] = m[2] }
        }
        for m in groups(xmpCurve, text) {
            curves[m[1]] = groups(xmpPoint, m[2]).compactMap { p in
                guard let x = Double(p[1]), let y = Double(p[2]) else { return nil }
                return (x, y)
            }
        }
        var name = groups(xmpName, text).first?[1]

        // .lrtemplate: só quando não há nada no formato XMP.
        if numbers.isEmpty && text.contains("settings") {
            for m in groups(lrNumber, text) { if let v = Double(m[2]) { numbers[m[1]] = v } }
            for m in groups(lrText, text) { texts[m[1]] = m[2] }
            for m in groups(lrCurve, text) {
                let values = groups(number, m[2]).compactMap { Double($0[0]) }
                var points: [(Double, Double)] = []
                var i = 0
                while i + 1 < values.count {
                    points.append((values[i], values[i + 1]))
                    i += 2
                }
                curves[m[1]] = points
            }
            name = name ?? groups(lrTitle, text).first?[1]
        }

        if numbers.isEmpty && curves.isEmpty { return nil }
        var ignored: [String] = []
        if text.contains("RGBTable") || texts["LookName"] != nil { ignored.append("Perfil criativo") }
        if (numbers["GrainAmount"] ?? 0) != 0 { ignored.append("Granulado") }
        if (numbers["Texture"] ?? 0) != 0 { ignored.append("Textura") }
        let base = (fileName as NSString).deletingPathExtension
        let fallback = base.isEmpty ? "Preset" : base
        let clean = name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return Preset(name: clean.isEmpty ? fallback : clean, numbers: numbers, texts: texts, curves: curves, ignored: ignored)
    }

    private static func regex(_ pattern: String, dotAll: Bool = false) -> NSRegularExpression {
        // swiftlint:disable:next force_try
        try! NSRegularExpression(pattern: pattern, options: dotAll ? [.dotMatchesLineSeparators] : [])
    }

    /** Todas as ocorrências, cada uma com o texto inteiro e os grupos (vazio se o grupo não casou). */
    static func groups(_ re: NSRegularExpression, _ text: String) -> [[String]] {
        let ns = text as NSString
        return re.matches(in: text, range: NSRange(location: 0, length: ns.length)).map { m in
            (0..<m.numberOfRanges).map { i in
                let r = m.range(at: i)
                return r.location == NSNotFound ? "" : ns.substring(with: r)
            }
        }
    }
}
