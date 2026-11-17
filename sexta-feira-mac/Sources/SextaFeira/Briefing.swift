import Foundation
import AppKit

/// Dados da internet sem precisar de chave: clima (Open-Meteo), cotação (AwesomeAPI) e notícias (Google Notícias).
struct Weather {
    let city: String
    let temp: Double
    let max: Double
    let min: Double
    let rainChance: Int
    let code: Int

    var text: String {
        switch code {
        case 0: return "céu limpo"
        case 1: return "poucas nuvens"
        case 2: return "parcialmente nublado"
        case 3: return "nublado"
        case 45, 48: return "neblina"
        case 51...57: return "garoa"
        case 61...67: return "chuva"
        case 71...77: return "neve"
        case 80...82: return "pancadas de chuva"
        case 95...99: return "tempestade"
        default: return "tempo variado"
        }
    }

    var icon: String {
        switch code {
        case 0: return "sun.max.fill"
        case 1, 2: return "cloud.sun.fill"
        case 3, 45, 48: return "cloud.fill"
        case 51...67, 80...82: return "cloud.rain.fill"
        case 95...99: return "cloud.bolt.rain.fill"
        default: return "cloud.fill"
        }
    }

    var sentence: String {
        "Em \(city), \(text), \(Int(temp.rounded()))°. Máxima de \(Int(max.rounded()))°, mínima de \(Int(min.rounded()))° e \(rainChance)% de chance de chuva."
    }
}

enum WebData {
    private static func json(_ url: String) async throws -> Any {
        guard let u = URL(string: url) else { throw AIError.offline("Endereço inválido.") }
        var req = URLRequest(url: u)
        req.timeoutInterval = 15
        let (data, _) = try await URLSession.shared.data(for: req)
        return try JSONSerialization.jsonObject(with: data)
    }

    static func weather(city: String) async throws -> Weather {
        let name = city.trimmed.isEmpty ? "São Paulo" : city.trimmed
        let geo = try await json("https://geocoding-api.open-meteo.com/v1/search?count=1&language=pt&name=\(Words.urlEncode(name))")
        guard let results = (geo as? [String: Any])?["results"] as? [[String: Any]], let first = results.first,
              let lat = (first["latitude"] as? NSNumber)?.doubleValue,
              let lon = (first["longitude"] as? NSNumber)?.doubleValue else {
            throw AIError.offline("Não achei a cidade “\(name)”. Confira em Configurações.")
        }
        let place = first["name"] as? String ?? name
        let url = "https://api.open-meteo.com/v1/forecast?latitude=\(lat)&longitude=\(lon)"
            + "&current=temperature_2m,weather_code"
            + "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max"
            + "&timezone=auto&forecast_days=1"
        guard let f = try await json(url) as? [String: Any],
              let current = f["current"] as? [String: Any],
              let daily = f["daily"] as? [String: Any] else {
            throw AIError.offline("A previsão do tempo não respondeu.")
        }
        func day(_ key: String) -> Double { ((daily[key] as? [Any])?.first as? NSNumber)?.doubleValue ?? 0 }
        return Weather(city: place,
                       temp: (current["temperature_2m"] as? NSNumber)?.doubleValue ?? 0,
                       max: day("temperature_2m_max"),
                       min: day("temperature_2m_min"),
                       rainChance: Int(day("precipitation_probability_max")),
                       code: (current["weather_code"] as? NSNumber)?.intValue ?? -1)
    }

    /// Dólar e euro em reais.
    static func currencies() async throws -> String {
        guard let obj = try await json("https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL") as? [String: Any] else {
            throw AIError.offline("A cotação não respondeu.")
        }
        func bid(_ k: String) -> String? {
            guard let d = obj[k] as? [String: Any], let s = d["bid"] as? String, let v = Double(s) else { return nil }
            return String(format: "R$ %.2f", v).replacingOccurrences(of: ".", with: ",")
        }
        var parts: [String] = []
        if let u = bid("USDBRL") { parts.append("o dólar está \(u)") }
        if let e = bid("EURBRL") { parts.append("o euro, \(e)") }
        guard !parts.isEmpty else { throw AIError.offline("A cotação não respondeu.") }
        return "Agora " + parts.joined(separator: " e ") + "."
    }

    /// Principais manchetes do Google Notícias (Brasil).
    static func news(limit: Int = 3) async throws -> [String] {
        guard let url = URL(string: "https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419") else { return [] }
        let (data, _) = try await URLSession.shared.data(from: url)
        let xml = String(decoding: data, as: UTF8.self)
        guard let re = try? NSRegularExpression(pattern: "<item>.*?<title>(.*?)</title>", options: [.dotMatchesLineSeparators]) else { return [] }
        let ns = xml as NSString
        var titles: [String] = []
        for m in re.matches(in: xml, range: NSRange(location: 0, length: ns.length)).prefix(limit) {
            var t = ns.substring(with: m.range(at: 1))
            t = t.replacingOccurrences(of: "<![CDATA[", with: "").replacingOccurrences(of: "]]>", with: "")
                .replacingOccurrences(of: "&amp;", with: "&").replacingOccurrences(of: "&quot;", with: "\"")
                .replacingOccurrences(of: "&#39;", with: "'")
            // tira o " - Nome do jornal" do final
            if let r = t.range(of: " - ", options: .backwards) { t = String(t[..<r.lowerBound]) }
            titles.append(t)
        }
        return titles
    }

    /// E-mails não lidos no app Mail (só se ele estiver aberto, para não abrir sozinho).
    @MainActor
    static func unreadMail() -> Int? {
        guard !NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.mail").isEmpty else { return nil }
        return AppleScript.run("tell application id \"com.apple.mail\" to return unread count of inbox").map { Int($0.int32Value) }
    }
}
