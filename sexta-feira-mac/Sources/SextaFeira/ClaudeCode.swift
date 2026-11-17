import AppKit
import Network
import CoreImage

/// Modo Claude Code: manda o pedido para o Claude Code instalado no Mac (usa a sua conta),
/// mostra o progresso na ilha ("Escrevendo index.html… 15 linhas") e devolve os arquivos criados.
@MainActor
final class ClaudeCodeRunner: ObservableObject {
    @Published var enabled = false
    @Published var running = false
    @Published var status = ""
    @Published var startedAt: Date?
    @Published var installedPath: String?

    var onProgress: (@MainActor (String) -> Void)?
    var onDone: (@MainActor (String, [String]) -> Void)?

    private var process: Process?
    private var sessionID: String?
    private var buffer = ""
    private var lastText = ""
    private var finalText: String?
    private var files: [String] = []
    private var errText = ""
    private var envPath: String?

    static var workDir: URL {
        let url = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Documents/Sexta-feira/Projetos", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    /// Acha o executável `claude` e o PATH do seu Terminal (apps abertos pelo Finder não herdam o PATH).
    nonisolated static func locate() -> (bin: String, path: String)? {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/bin/zsh")
        p.arguments = ["-lic", "echo __BIN__$(command -v claude); echo __PATH__$PATH"]
        let out = Pipe()
        p.standardOutput = out
        p.standardError = Pipe()
        p.standardInput = FileHandle.nullDevice
        var shellBin: String?
        var shellPath = "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
        if (try? p.run()) != nil {
            let data = out.fileHandleForReading.readDataToEndOfFile()
            p.waitUntilExit()
            for line in String(decoding: data, as: UTF8.self).split(separator: "\n") {
                if line.hasPrefix("__BIN__") {
                    let b = String(line.dropFirst(7)).trimmingCharacters(in: .whitespaces)
                    if b.hasPrefix("/") { shellBin = b }
                } else if line.hasPrefix("__PATH__") {
                    shellPath = String(line.dropFirst(8))
                }
            }
        }
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let candidates = [shellBin, home + "/.local/bin/claude", home + "/.claude/local/claude",
                          "/opt/homebrew/bin/claude", "/usr/local/bin/claude", home + "/.npm-global/bin/claude"]
        for c in candidates.compactMap({ $0 }) where FileManager.default.isExecutableFile(atPath: c) {
            let dir = (c as NSString).deletingLastPathComponent
            return (c, dir + ":" + shellPath)
        }
        return nil
    }

    func checkInstalled() {
        Task { @MainActor in
            installedPath = await Task.detached { Self.locate()?.bin }.value
        }
    }

    func newConversation() {
        sessionID = nil
    }

    func stop() {
        process?.terminate()
    }

    func run(_ prompt: String) {
        guard !running else { return }
        running = true
        status = "Chamando o Claude Code…"
        startedAt = Date()
        buffer = ""
        lastText = ""
        finalText = nil
        files = []
        errText = ""
        onProgress?(status)

        Task { @MainActor in
            guard let found = await Task.detached(operation: { Self.locate() }).value else {
                running = false
                onDone?("Não encontrei o Claude Code neste Mac. Instale no Terminal com:  curl -fsSL https://claude.ai/install.sh | bash  e depois rode  claude  uma vez para entrar na sua conta.", [])
                return
            }
            installedPath = found.bin
            var args = [
                "-p", prompt,
                "--output-format", "stream-json", "--verbose",
                "--permission-mode", "acceptEdits",
                "--append-system-prompt",
                "Responda em português do Brasil, de forma curta e simples. Crie cada projeto numa subpasta com nome claro dentro da pasta atual e diga no final qual arquivo abrir.",
            ]
            if let sid = sessionID { args += ["--resume", sid] }

            let p = Process()
            p.executableURL = URL(fileURLWithPath: found.bin)
            p.arguments = args
            p.currentDirectoryURL = Self.workDir
            var env = ProcessInfo.processInfo.environment
            env["PATH"] = found.path
            p.environment = env
            let out = Pipe()
            let err = Pipe()
            p.standardOutput = out
            p.standardError = err
            p.standardInput = FileHandle.nullDevice
            out.fileHandleForReading.readabilityHandler = { h in
                let data = h.availableData
                guard !data.isEmpty else { return }
                let chunk = String(decoding: data, as: UTF8.self)
                Task { @MainActor [weak self] in self?.consume(chunk) }
            }
            err.fileHandleForReading.readabilityHandler = { h in
                let data = h.availableData
                guard !data.isEmpty else { return }
                let chunk = String(decoding: data, as: UTF8.self)
                Task { @MainActor [weak self] in self?.errText += chunk }
            }
            p.terminationHandler = { proc in
                let code = proc.terminationStatus
                Task { @MainActor [weak self] in
                    // dá um instante para ler o resto da saída
                    try? await Task.sleep(nanoseconds: 300_000_000)
                    out.fileHandleForReading.readabilityHandler = nil
                    err.fileHandleForReading.readabilityHandler = nil
                    self?.finished(code: code)
                }
            }
            do {
                try p.run()
                process = p
            } catch {
                running = false
                onDone?("Não consegui abrir o Claude Code: \(error.localizedDescription)", [])
            }
        }
    }

    private func consume(_ chunk: String) {
        buffer += chunk
        while let nl = buffer.firstIndex(of: "\n") {
            let line = String(buffer[..<nl])
            buffer.removeSubrange(...nl)
            handle(line)
        }
    }

    private func handle(_ line: String) {
        guard let data = line.data(using: .utf8),
              let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return }
        if let sid = obj["session_id"] as? String { sessionID = sid }
        switch obj["type"] as? String {
        case "assistant":
            guard let msg = obj["message"] as? [String: Any], let content = msg["content"] as? [[String: Any]] else { return }
            for block in content {
                if block["type"] as? String == "text", let t = block["text"] as? String, !t.trimmed.isEmpty {
                    lastText = t
                }
                if block["type"] as? String == "tool_use" {
                    let name = block["name"] as? String ?? ""
                    let input = block["input"] as? [String: Any] ?? [:]
                    let path = input["file_path"] as? String ?? input["path"] as? String ?? ""
                    let file = (path as NSString).lastPathComponent
                    switch name {
                    case "Write":
                        let lines = (input["content"] as? String)?.split(separator: "\n", omittingEmptySubsequences: false).count ?? 0
                        status = "Escrevendo \(file)… \(lines) linhas"
                        if !path.isEmpty && !files.contains(path) { files.append(path) }
                    case "Edit", "MultiEdit":
                        status = "Editando \(file)…"
                        if !path.isEmpty && !files.contains(path) { files.append(path) }
                    case "Read": status = "Lendo \(file)…"
                    case "Bash": status = "Rodando um comando…"
                    case "Glob", "Grep": status = "Procurando nos arquivos…"
                    case "WebFetch", "WebSearch": status = "Pesquisando na internet…"
                    default: status = "Trabalhando (\(name))…"
                    }
                    onProgress?(status)
                }
            }
        case "result":
            if let r = obj["result"] as? String, !r.trimmed.isEmpty { finalText = r }
        default:
            break
        }
    }

    private func finished(code: Int32) {
        process = nil
        running = false
        status = ""
        var text = finalText ?? lastText
        if text.trimmed.isEmpty {
            let e = errText.trimmed
            if e.contains("login") || e.contains("auth") || e.contains("API key") {
                text = "O Claude Code precisa que você entre na sua conta: abra o Terminal, rode  claude  e faça o login."
            } else {
                text = code == 0 ? "Pronto." : "O Claude Code parou com erro. \(String(e.suffix(300)))"
            }
        }
        onDone?(text, files)
    }
}

// MARK: - Conectores (MCP) — funcionam quando o cérebro é o Claude

struct Connector: Codable, Identifiable, Equatable {
    var id = UUID()
    var name: String
    var url: String
    var enabled = true

    var tokenKey: String { "mcp.\(id.uuidString)" }

    static let presets: [(name: String, url: String, about: String, needsToken: Bool)] = [
        ("Zapier", "https://mcp.zapier.com/api/mcp/s/SEU-CODIGO/mcp",
         "Liga a assistente a mais de 8.000 apps: Gmail, Planilhas, Trello, Slack, Notion… Crie o servidor em mcp.zapier.com e cole o endereço.", false),
        ("GitHub", "https://api.githubcopilot.com/mcp/",
         "Repositórios, issues e pull requests. Precisa de um token do GitHub.", true),
        ("Home Assistant", "https://SEU-HOME-ASSISTANT/api/mcp",
         "Casa inteligente: luzes, tomadas, ar, sensores. Precisa de um token de acesso longo do Home Assistant.", true),
        ("DeepWiki", "https://mcp.deepwiki.com/mcp",
         "Pergunte sobre qualquer projeto público do GitHub. Grátis, sem chave.", false),
    ]
}

/// Servidor MCP pronto para mandar à API do Claude.
struct MCPServer: Sendable {
    let name: String
    let url: String
    let token: String
}

// MARK: - Celular (mesmo Wi-Fi)

@MainActor
final class PhoneServer: ObservableObject {
    @Published var running = false
    @Published var url = ""
    @Published var error = ""

    var ask: (@MainActor (String) async -> String)?
    private var listener: NWListener?
    let port: UInt16 = 8765

    let token: String = {
        if let t = UserDefaults.standard.string(forKey: "phoneToken"), !t.isEmpty { return t }
        let t = String(UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(10)).lowercased()
        UserDefaults.standard.set(t, forKey: "phoneToken")
        return t
    }()

    func setEnabled(_ on: Bool) {
        if on { start() } else { stop() }
    }

    func start() {
        guard listener == nil, let p = NWEndpoint.Port(rawValue: port) else { return }
        do {
            let l = try NWListener(using: .tcp, on: p)
            l.newConnectionHandler = { [weak self] conn in
                Task { @MainActor in self?.accept(conn) }
            }
            l.stateUpdateHandler = { [weak self] st in
                Task { @MainActor in
                    switch st {
                    case .ready: self?.running = true; self?.error = ""
                    case .failed(let e): self?.running = false; self?.error = "\(e)"
                    case .cancelled: self?.running = false
                    default: break
                    }
                }
            }
            l.start(queue: .main)
            listener = l
            url = "http://\(Self.localIP() ?? "SEU-MAC.local"):\(port)/?t=\(token)"
        } catch {
            self.error = error.localizedDescription
        }
    }

    func stop() {
        listener?.cancel()
        listener = nil
        running = false
    }

    static func localIP() -> String? {
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return nil }
        defer { freeifaddrs(ifaddr) }
        var ptr: UnsafeMutablePointer<ifaddrs>? = first
        while let p = ptr {
            let ifa = p.pointee
            if let addr = ifa.ifa_addr, addr.pointee.sa_family == UInt8(AF_INET) {
                let name = String(cString: ifa.ifa_name)
                if name.hasPrefix("en") {
                    var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                    if getnameinfo(addr, socklen_t(addr.pointee.sa_len), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 {
                        return String(cString: host)
                    }
                }
            }
            ptr = ifa.ifa_next
        }
        return nil
    }

    func qrImage() -> NSImage? {
        guard let filter = CIFilter(name: "CIQRCodeGenerator") else { return nil }
        filter.setValue(Data(url.utf8), forKey: "inputMessage")
        filter.setValue("M", forKey: "inputCorrectionLevel")
        guard let img = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 8, y: 8)) else { return nil }
        let rep = NSCIImageRep(ciImage: img)
        let ns = NSImage(size: rep.size)
        ns.addRepresentation(rep)
        return ns
    }

    // MARK: HTTP bem simples

    private func accept(_ c: NWConnection) {
        c.start(queue: .main)
        receive(c, Data())
    }

    private func receive(_ c: NWConnection, _ acc: Data) {
        c.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, done, err in
            Task { @MainActor in
                guard let self else { return }
                var buf = acc
                if let data { buf.append(data) }
                if let req = Self.parse(buf) {
                    await self.route(c, req)
                } else if done || err != nil || buf.count > 1_000_000 {
                    c.cancel()
                } else {
                    self.receive(c, buf)
                }
            }
        }
    }

    private struct Request {
        let method: String
        let path: String
        let query: [String: String]
        let body: String
    }

    private static func parse(_ data: Data) -> Request? {
        guard let sep = data.range(of: Data("\r\n\r\n".utf8)) else { return nil }
        let head = String(decoding: data[..<sep.lowerBound], as: UTF8.self)
        let lines = head.components(separatedBy: "\r\n")
        let parts = (lines.first ?? "").split(separator: " ")
        guard parts.count >= 2 else { return nil }
        var length = 0
        for l in lines.dropFirst() where l.lowercased().hasPrefix("content-length:") {
            length = Int(l.dropFirst(15).trimmingCharacters(in: .whitespaces)) ?? 0
        }
        let bodyData = data[sep.upperBound...]
        guard bodyData.count >= length else { return nil }
        let full = String(parts[1])
        let comps = URLComponents(string: "http://x" + full)
        var q: [String: String] = [:]
        for item in comps?.queryItems ?? [] { q[item.name] = item.value ?? "" }
        return Request(method: String(parts[0]), path: comps?.path ?? "/", query: q,
                       body: String(decoding: bodyData.prefix(length), as: UTF8.self))
    }

    private func send(_ c: NWConnection, _ status: String, _ type: String, _ body: String) {
        let data = Data(body.utf8)
        let head = "HTTP/1.1 \(status)\r\nContent-Type: \(type); charset=utf-8\r\nContent-Length: \(data.count)\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n"
        c.send(content: Data(head.utf8) + data, completion: .contentProcessed { _ in c.cancel() })
    }

    private func route(_ c: NWConnection, _ r: Request) async {
        guard r.query["t"] == token else {
            send(c, "403 Forbidden", "text/plain", "Acesso negado. Escaneie o QR Code de novo.")
            return
        }
        if r.method == "POST" && r.path == "/ask" {
            let text = r.body.trimmed
            guard !text.isEmpty, let ask else { send(c, "400 Bad Request", "text/plain", ""); return }
            let reply = await ask(String(text.prefix(2000)))
            let json = (try? JSONSerialization.data(withJSONObject: ["reply": reply])).map { String(decoding: $0, as: UTF8.self) } ?? "{}"
            send(c, "200 OK", "application/json", json)
        } else {
            send(c, "200 OK", "text/html", Self.page(token: token, name: Prefs.assistantName))
        }
    }

    private static func page(token: String, name: String) -> String {
        """
        <!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
        <title>\(name)</title>
        <style>
        :root{color-scheme:dark}
        body{margin:0;font-family:-apple-system,system-ui,sans-serif;background:#0b0d12;color:#fff;display:flex;flex-direction:column;height:100vh;height:100dvh}
        header{padding:14px 16px;font-weight:700;font-size:18px;border-bottom:1px solid #222}
        #log{flex:1;overflow:auto;padding:12px 16px;display:flex;flex-direction:column;gap:8px}
        .m{max-width:80%;padding:9px 12px;border-radius:14px;line-height:1.35;white-space:pre-wrap}
        .u{align-self:flex-end;background:#2e7d32}.a{align-self:flex-start;background:#1e2230}
        form{display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));border-top:1px solid #222}
        input{flex:1;font-size:16px;padding:12px;border-radius:12px;border:0;background:#1e2230;color:#fff}
        button{font-size:16px;padding:0 16px;border-radius:12px;border:0;background:#7cff6b;color:#000;font-weight:700}
        .chips{display:flex;gap:6px;flex-wrap:wrap;padding:0 16px 8px}
        .chips span{background:#1e2230;padding:6px 10px;border-radius:99px;font-size:13px}
        </style></head><body>
        <header>🤖 \(name)</header>
        <div id="log"><div class="m a">Oi! Pode pedir qualquer coisa — eu faço no seu Mac.</div></div>
        <div class="chips"><span>resumo do dia</span><span>pausa</span><span>próxima</span><span>como está meu Mac?</span><span>timer de 10 minutos</span></div>
        <form id="f"><input id="q" placeholder="Fale com a \(name)…" autocomplete="off"><button>↑</button></form>
        <script>
        const log=document.getElementById('log'),q=document.getElementById('q');
        function add(t,c){const d=document.createElement('div');d.className='m '+c;d.textContent=t;log.appendChild(d);log.scrollTop=log.scrollHeight;return d}
        async function ask(t){add(t,'u');const w=add('…','a');
          try{const r=await fetch('/ask?t=\(token)',{method:'POST',body:t});const j=await r.json();w.textContent=j.reply||'Feito.'}
          catch(e){w.textContent='Não consegui falar com o Mac.'}}
        document.getElementById('f').onsubmit=e=>{e.preventDefault();const t=q.value.trim();if(t){q.value='';ask(t)}};
        document.querySelectorAll('.chips span').forEach(s=>s.onclick=()=>ask(s.textContent));
        </script></body></html>
        """
    }
}
