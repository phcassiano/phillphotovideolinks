package com.phill.sonytether

import java.io.BufferedReader
import java.io.ByteArrayOutputStream
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/**
 * Servidor FTP mínimo para receber fotos pelo Wi-Fi: a câmera (Sony, Canon, Nikon e outras
 * com "transferência FTP") manda cada foto assim que é tirada. Aceita só gravar; listar
 * pastas devolve vazio e criar ou entrar em pasta sempre "dá certo", que é o que as câmeras
 * esperam. Arquivos que chegam com nome temporário e depois são renomeados também valem.
 */
class FtpServer(
    private val user: String,
    private val password: String,
    private val listener: Listener,
    private val preferredPort: Int = DEFAULT_PORT,
) {
    interface Listener {
        /** Uma foto chegou inteira. Roda na thread da conexão. */
        fun onFile(name: String, data: ByteArray, from: String)

        /** Avisos para o Diagnóstico e o painel (câmera conectou, login errado…). */
        fun onLog(text: String)

        /** Cada comando da câmera, só para o Diagnóstico. */
        fun onTrace(text: String) {}
    }

    private var server: ServerSocket? = null
    private val workers = Executors.newCachedThreadPool()

    /** Arquivos com nome que não é de foto, à espera de serem renomeados (caminho → bytes). */
    private val pending = ConcurrentHashMap<String, ByteArray>()

    /** Senhas erradas por endereço: depois de [MAX_FAILURES], o endereço espera [LOCK_MS]. */
    private class Failures(var count: Int, var lockedUntil: Long)

    private val failures = ConcurrentHashMap<String, Failures>()
    private val sessions = AtomicInteger()

    val port get() = server?.localPort ?: 0

    /** Endereço do tablet que a última câmera usou para entrar (o certo, quando o tablet tem mais de uma rede). */
    @Volatile
    var cameraAddress: String? = null
        private set
    val running get() = server?.isClosed == false

    fun start() {
        if (running) return
        val socket = runCatching { ServerSocket(preferredPort) }.getOrElse { ServerSocket(0) }
        server = socket
        Thread({
            while (!socket.isClosed) {
                val client = try {
                    socket.accept()
                } catch (e: SocketException) {
                    break
                }
                if (sessions.incrementAndGet() > MAX_SESSIONS) {
                    sessions.decrementAndGet()
                    runCatching { client.use { it.getOutputStream().write("421 Muitas conexões\r\n".toByteArray()) } }
                    continue
                }
                workers.execute {
                    try {
                        Session(client).run()
                    } finally {
                        sessions.decrementAndGet()
                    }
                }
            }
        }, "ftp").start()
    }

    fun stop() {
        runCatching { server?.close() }
        server = null
        pending.clear()
        failures.clear()
    }

    private fun locked(address: String) = (failures[address]?.lockedUntil ?: 0) > System.currentTimeMillis()

    private fun failed(address: String) {
        val f = failures.getOrPut(address) { Failures(0, 0) }
        synchronized(f) {
            f.count++
            if (f.count >= MAX_FAILURES) {
                f.count = 0
                f.lockedUntil = System.currentTimeMillis() + LOCK_MS
            }
        }
    }

    private inner class Session(private val control: Socket) {
        private val from = control.inetAddress.hostAddress ?: "?"
        private val out: OutputStream = control.getOutputStream()
        private var loggedIn = false
        private var userOk = false
        private var cwd = "/"
        private var passive: ServerSocket? = null
        private var active: InetSocketAddress? = null
        private var renameFrom: String? = null

        fun run() {
            control.use {
                runCatching {
                    control.soTimeout = 10 * 60_000
                    val input = BufferedReader(InputStreamReader(control.getInputStream(), Charsets.UTF_8))
                    if (locked(from)) {
                        reply(421, "Muitas senhas erradas: espere um minuto")
                        return@runCatching
                    }
                    reply(220, "Revela pronto para receber fotos")
                    listener.onLog("FTP: conexão de $from")
                    while (true) {
                        val line = input.readLine() ?: break
                        val command = line.substringBefore(' ').uppercase()
                        val arg = line.substringAfter(' ', "").trim()
                        listener.onTrace("FTP ‹ " + if (command == "PASS") "PASS ***" else line.take(200))
                        if (!handle(command, arg)) break
                    }
                }.onFailure { listener.onLog("FTP: conexão de $from caiu (${it.message})") }
                closeData()
            }
        }

        private fun handle(command: String, arg: String): Boolean {
            if (!loggedIn && command !in setOf("USER", "PASS", "QUIT", "SYST", "FEAT", "AUTH", "OPTS", "NOOP")) {
                reply(530, "Faça login primeiro")
                return true
            }
            when (command) {
                "USER" -> {
                    userOk = arg == user
                    reply(331, "Senha, por favor")
                }
                "PASS" -> if (locked(from)) {
                    reply(421, "Muitas senhas erradas: espere um minuto")
                    return false
                } else if (userOk && sameSecret(arg, password)) {
                    failures.remove(from)
                    loggedIn = true
                    cameraAddress = control.localAddress.hostAddress
                    listener.onLog("FTP: câmera $from entrou")
                    reply(230, "Bem-vinda")
                } else {
                    listener.onLog("FTP: usuário ou senha errados vindos de $from")
                    failed(from)
                    Thread.sleep(WRONG_PASSWORD_DELAY_MS)
                    reply(530, "Usuário ou senha incorretos")
                }
                "AUTH" -> reply(502, "Sem TLS: desligue o protocolo seguro (FTPS) na câmera")
                "SYST" -> reply(215, "UNIX Type: L8")
                "FEAT" -> multi(211, listOf("Recursos:", " PASV", " EPSV", " SIZE", " UTF8", " REST STREAM"), "Fim")
                "OPTS", "TYPE", "MODE", "STRU", "ALLO" -> reply(200, "OK")
                "NOOP" -> reply(200, "OK")
                "PWD", "XPWD" -> reply(257, "\"$cwd\"")
                "CWD", "XCWD" -> {
                    cwd = resolve(arg)
                    reply(250, "OK")
                }
                "CDUP", "XCUP" -> {
                    cwd = resolve("..")
                    reply(250, "OK")
                }
                "MKD", "XMKD" -> reply(257, "\"${resolve(arg)}\" criada")
                "RMD", "XRMD" -> reply(250, "OK")
                "PASV" -> pasv(extended = false)
                "EPSV" -> pasv(extended = true)
                "PORT" -> port(arg)
                "EPRT" -> eprt(arg)
                "STOR", "APPE", "STOU" -> store(arg.ifBlank { "foto_${System.currentTimeMillis()}.jpg" })
                "LIST", "NLST", "MLSD" -> list()
                "SIZE" -> pending[resolve(arg)]?.let { reply(213, it.size.toString()) } ?: reply(550, "Não existe")
                "MDTM" -> reply(550, "Não disponível")
                "DELE" -> {
                    pending.remove(resolve(arg))
                    reply(250, "OK")
                }
                "RNFR" -> {
                    renameFrom = resolve(arg)
                    reply(350, "Pronto para renomear")
                }
                "RNTO" -> rename(arg)
                "REST" -> reply(350, "OK")
                "ABOR" -> {
                    closeData()
                    reply(226, "OK")
                }
                "QUIT" -> {
                    reply(221, "Até logo")
                    return false
                }
                else -> reply(502, "Comando não suportado")
            }
            return true
        }

        private fun pasv(extended: Boolean) {
            closeData()
            val socket = ServerSocket(0, 1, control.localAddress)
            socket.soTimeout = 60_000
            passive = socket
            val p = socket.localPort
            if (extended) {
                reply(229, "Modo passivo (|||$p|)")
            } else {
                val ip = control.localAddress.hostAddress!!.replace('.', ',')
                reply(227, "Modo passivo ($ip,${p shr 8},${p and 0xFF})")
            }
        }

        private fun port(arg: String) {
            val n = arg.split(',').mapNotNull { it.trim().toIntOrNull() }
            if (n.size != 6 || n.any { it !in 0..255 }) return reply(501, "Endereço inválido")
            closeData()
            val address = InetAddress.getByName(n.take(4).joinToString("."))
            // Só para a própria câmera: não deixa usar o tablet para conectar em outro aparelho da rede.
            if (address != control.inetAddress) return reply(501, "Endereço diferente da conexão")
            active = InetSocketAddress(address, n[4] * 256 + n[5])
            reply(200, "OK")
        }

        private fun eprt(arg: String) {
            val parts = arg.split(arg.firstOrNull() ?: '|')
            if (parts.size < 4) return reply(501, "Endereço inválido")
            closeData()
            val host = parts[2]
            val numeric = host.isNotEmpty() && host.all { it.isDigit() || it == '.' || it == ':' || it in 'a'..'f' || it in 'A'..'F' } &&
                (host.contains(':') || host.count { it == '.' } == 3)
            val address = if (numeric) runCatching { InetAddress.getByName(host) }.getOrNull() else null
            val port = parts[3].toIntOrNull()
            if (address != control.inetAddress || port == null || port !in 1..65535) return reply(501, "Endereço inválido")
            active = InetSocketAddress(address, port)
            reply(200, "OK")
        }

        private fun openData(): Socket? {
            passive?.let { p ->
                return runCatching { p.accept() }.getOrNull().also {
                    runCatching { p.close() }
                    passive = null
                }
            }
            active?.let { a ->
                active = null
                return runCatching { Socket().apply { connect(a, 15_000) } }.getOrNull()
            }
            return null
        }

        private fun store(arg: String) {
            val path = resolve(arg)
            listener.onLog("FTP: recebendo ${path.substringAfterLast('/')}…")
            reply(150, "Pode enviar")
            val data = openData() ?: run {
                listener.onLog("FTP: a câmera não abriu a conexão de dados de ${path.substringAfterLast('/')} (confira firewall/VPN e o modo passivo na câmera)")
                return reply(425, "Não consegui abrir a conexão de dados")
            }
            val bytes = try {
                data.use { s ->
                    s.soTimeout = 60_000
                    val buffer = ByteArrayOutputStream()
                    val input = s.getInputStream()
                    val chunk = ByteArray(256 * 1024)
                    while (true) {
                        val n = input.read(chunk)
                        if (n < 0) break
                        buffer.write(chunk, 0, n)
                        if (buffer.size() > MAX_FILE) throw IllegalStateException("arquivo grande demais")
                    }
                    buffer.toByteArray()
                }
            } catch (e: Exception) {
                listener.onLog("FTP: envio de ${path.substringAfterLast('/')} interrompido (${e.message})")
                return reply(426, "Transferência interrompida")
            }
            reply(226, "Recebido")
            accept(path, bytes)
        }

        private fun rename(arg: String) {
            val old = renameFrom ?: return reply(503, "Use RNFR antes")
            renameFrom = null
            val target = resolve(arg)
            val bytes = pending.remove(old)
            reply(250, "OK")
            if (bytes != null) accept(target, bytes)
        }

        /** Foto: entrega. Outro nome (ex.: ".tmp"): guarda até a câmera renomear. */
        private fun accept(path: String, bytes: ByteArray) {
            val name = path.substringAfterLast('/')
            if (GenericPtpCamera.isPhoto(name) && name.contains('.')) {
                listener.onFile(name, bytes, from)
            } else if (!name.contains('.') && isJpeg(bytes)) {
                // Sem extensão, mas o conteúdo é um JPEG: entrega mesmo assim.
                listener.onFile(name.ifBlank { "foto_${System.currentTimeMillis()}" } + ".jpg", bytes, from)
            } else {
                listener.onTrace("FTP: ${name.ifBlank { "(sem nome)" }} guardado até a câmera renomear (${bytes.size} bytes)")
                pending[path] = bytes
                // Não deixa acumular arquivos que nunca serão renomeados.
                while (pending.size > 4) pending.keys.firstOrNull()?.let(pending::remove)
            }
        }

        private fun list() {
            reply(150, "Lista")
            openData()?.close()
            reply(226, "Fim da lista")
        }

        private fun resolve(arg: String): String {
            val base = if (arg.startsWith("/")) "" else cwd
            val parts = ArrayList<String>()
            for (p in "$base/$arg".split('/')) {
                when (p) {
                    "", "." -> Unit
                    ".." -> if (parts.isNotEmpty()) parts.removeAt(parts.size - 1)
                    else -> parts += p
                }
            }
            return "/" + parts.joinToString("/")
        }

        private fun closeData() {
            runCatching { passive?.close() }
            passive = null
            active = null
        }

        private fun reply(code: Int, text: String) {
            out.write("$code $text\r\n".toByteArray(Charsets.UTF_8))
            out.flush()
        }

        private fun multi(code: Int, lines: List<String>, last: String) {
            val text = buildString {
                append("$code-${lines.first()}\r\n")
                lines.drop(1).forEach { append("$it\r\n") }
                append("$code $last\r\n")
            }
            out.write(text.toByteArray(Charsets.UTF_8))
            out.flush()
        }
    }

    companion object {
        /** Compara em tempo constante, para o tempo da resposta não dar pistas da senha. */
        fun sameSecret(a: String, b: String) = java.security.MessageDigest.isEqual(a.toByteArray(), b.toByteArray())

        const val MAX_FAILURES = 5
        const val LOCK_MS = 60_000L
        private const val WRONG_PASSWORD_DELAY_MS = 1_000L
        private const val MAX_SESSIONS = 8

        fun isJpeg(bytes: ByteArray) = bytes.size > 3 && bytes[0] == 0xFF.toByte() && bytes[1] == 0xD8.toByte() && bytes[2] == 0xFF.toByte()

        /** Portas abaixo de 1024 são proibidas para apps no Android. */
        const val DEFAULT_PORT = 2121
        /** Maior RAW sem compressão das câmeras atuais (~120 MB) com folga, sem estourar a memória. */
        private const val MAX_FILE = 256L * 1024 * 1024
    }
}
