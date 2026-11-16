import Foundation

struct ChatTurn {
    let role: String   // "user" ou "assistant"
    let text: String
}

enum AIError: LocalizedError {
    case missingKey(String)
    case http(Int, String)
    case empty
    case refusal
    case offline(String)

    var errorDescription: String? {
        switch self {
        case .missingKey(let p): return "Falta a chave do \(p). Abra Configurações e cole a chave."
        case .http(let code, let msg): return "Erro \(code) da IA: \(msg)"
        case .empty: return "A IA respondeu vazio."
        case .refusal: return "A IA preferiu não responder isso."
        case .offline(let m): return m
        }
    }
}

/// Fala com Gemini, Claude ou um modelo local (Ollama) e devolve o texto cru.
enum AIClient {
    static func complete(system: String, turns: [ChatTurn]) async throws -> String {
        switch Prefs.provider {
        case "claude": return try await claude(system: system, turns: turns)
        case "local": return try await ollama(system: system, turns: turns)
        default: return try await gemini(system: system, turns: turns)
        }
    }

    // MARK: Gemini (Google)

    private static func gemini(system: String, turns: [ChatTurn]) async throws -> String {
        let key = Keychain.get("gemini")
        guard !key.isEmpty else { throw AIError.missingKey("Gemini") }
        let model = Prefs.geminiModel
        guard let url = URL(string: "https://generativelanguage.googleapis.com/v1beta/models/\(model):generateContent") else {
            throw AIError.offline("Nome de modelo inválido: \(model)")
        }
        let contents: [[String: Any]] = turns.map { t -> [String: Any] in
            ["role": t.role == "assistant" ? "model" : "user", "parts": [["text": t.text]]]
        }
        let body: [String: Any] = [
            "systemInstruction": ["parts": [["text": system]]],
            "contents": contents,
            "generationConfig": ["responseMimeType": "application/json"],
        ]
        let obj = try await post(url, headers: ["x-goog-api-key": key], body: body)
        guard let cands = obj["candidates"] as? [[String: Any]],
              let content = cands.first?["content"] as? [String: Any],
              let parts = content["parts"] as? [[String: Any]] else { throw AIError.empty }
        let text = parts.filter { ($0["thought"] as? Bool) != true }.compactMap { $0["text"] as? String }.joined()
        guard !text.isEmpty else { throw AIError.empty }
        return text
    }

    // MARK: Claude (Anthropic) — API REST /v1/messages

    private static func claude(system: String, turns: [ChatTurn]) async throws -> String {
        let key = Keychain.get("claude")
        guard !key.isEmpty else { throw AIError.missingKey("Claude") }
        let model = Prefs.claudeModel
        var body: [String: Any] = [
            "model": model,
            "max_tokens": 2048,
            "system": system,
            "messages": turns.map { ["role": $0.role, "content": $0.text] },
        ]
        var headers = ["x-api-key": key, "anthropic-version": "2026-10-21"]

        // Modelos atuais: esforço baixo = respostas rápidas, boas para um assistente de voz.
        let current = ["claude-opus-5", "claude-sonnet-5", "claude-haiku-5", "claude-fable"]
        if current.contains(where: { model.hasPrefix($0) }) {
            body["output_config"] = ["effort": "low"]
        }
        // Se o modelo recusar por segurança, a API tenta de novo num modelo alternativo.
        let withFallback = ["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-2", "claude-fable-5-1"]
        if withFallback.contains(model) {
            body["fallbacks"] = "default"
            headers["anthropic-beta"] = "server-side-fallback-2026-07-01"
        }

        let obj = try await post(URL(string: "https://api.anthropic.com/v1/messages")!, headers: headers, body: body)
        if (obj["stop_reason"] as? String) == "refusal" { throw AIError.refusal }
        let blocks = obj["content"] as? [[String: Any]] ?? []
        let text = blocks.filter { ($0["type"] as? String) == "text" }.compactMap { $0["text"] as? String }.joined()
        guard !text.isEmpty else { throw AIError.empty }
        return text
    }

    // MARK: Local (Ollama)

    private static func ollama(system: String, turns: [ChatTurn]) async throws -> String {
        let base = Prefs.ollamaURL.trimmingCharacters(in: CharacterSet(charactersIn: "/ "))
        guard let url = URL(string: base + "/api/chat") else { throw AIError.offline("Endereço do Ollama inválido.") }
        let messages: [[String: String]] = [["role": "system", "content": system]]
            + turns.map { ["role": $0.role, "content": $0.text] }
        let body: [String: Any] = [
            "model": Prefs.ollamaModel,
            "stream": false,
            "format": "json",
            "keep_alive": "15m",
            "messages": messages,
        ]
        do {
            let obj = try await post(url, headers: [:], body: body, timeout: 180)
            guard let msg = obj["message"] as? [String: Any], let text = msg["content"] as? String, !text.isEmpty else {
                throw AIError.empty
            }
            return text
        } catch let e as URLError where e.code == .cannotConnectToHost || e.code == .cannotFindHost {
            throw AIError.offline("Não consegui falar com o Ollama em \(base). O app Ollama está aberto?")
        }
    }

    // MARK: HTTP

    static func post(_ url: URL, headers: [String: String], body: [String: Any],
                             timeout: TimeInterval = 60) async throws -> [String: Any] {
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = timeout
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        for (k, v) in headers { req.setValue(v, forHTTPHeaderField: k) }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(code) else { throw AIError.http(code, errorMessage(data)) }
        guard let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { throw AIError.empty }
        return obj
    }

    private static func errorMessage(_ data: Data) -> String {
        if let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
            if let err = obj["error"] as? [String: Any], let msg = err["message"] as? String { return msg }
            if let msg = obj["error"] as? String { return msg }
        }
        return String(decoding: data.prefix(300), as: UTF8.self)
    }
}

/// Cria imagens com o modelo de imagem do Gemini (usa a mesma chave do Gemini).
enum ImageGen {
    static func generate(_ prompt: String) async throws -> URL {
        let key = Keychain.get("gemini")
        guard !key.isEmpty else { throw AIError.missingKey("Gemini (usada para criar imagens)") }
        let model = Prefs.imageModel
        guard let url = URL(string: "https://generativelanguage.googleapis.com/v1beta/models/\(model):generateContent") else {
            throw AIError.offline("Nome de modelo de imagem inválido: \(model)")
        }
        let body: [String: Any] = [
            "contents": [["parts": [["text": prompt]]]],
            "generationConfig": ["responseModalities": ["IMAGE", "TEXT"]],
        ]
        let obj = try await AIClient.post(url, headers: ["x-goog-api-key": key], body: body, timeout: 180)
        guard let cands = obj["candidates"] as? [[String: Any]],
              let content = cands.first?["content"] as? [String: Any],
              let parts = content["parts"] as? [[String: Any]] else { throw AIError.empty }

        for part in parts {
            guard let inline = (part["inlineData"] ?? part["inline_data"]) as? [String: Any],
                  let b64 = inline["data"] as? String,
                  let data = Data(base64Encoded: b64) else { continue }
            let mime = inline["mimeType"] as? String ?? "image/png"
            let ext = mime.contains("jpeg") ? "jpg" : "png"
            let dir = FileManager.default.homeDirectoryForCurrentUser
                .appendingPathComponent("Pictures/Sexta-feira", isDirectory: true)
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let stamp = Fmt.stamp(Date()).replacingOccurrences(of: ":", with: "-").replacingOccurrences(of: " ", with: "_")
            let file = dir.appendingPathComponent("arte-\(stamp).\(ext)")
            try data.write(to: file)
            return file
        }
        throw AIError.offline("O modelo não devolveu nenhuma imagem. Tente descrever de outro jeito.")
    }
}
