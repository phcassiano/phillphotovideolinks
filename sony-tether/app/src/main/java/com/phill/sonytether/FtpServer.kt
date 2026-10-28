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
    }

    private var server: ServerSocket? = null
    private val workers = Executors.newCachedThreadPool()

    /** Arquivos com nome que não é de foto, à espera de serem renomeados (caminho → bytes). */
    private val pending = ConcurrentHashMap<String, ByteArray>()

    val port get() = server?.localPort ?: 0
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
                workers.execute { Session(client).run() }
            }
        }, "ftp").start()
    }

    fun stop() {
        runCatching { server?.close() }
        server = null
        pending.clear()
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
                    reply(220, "Revela pronto para receber fotos")
                    listener.onLog("FTP: conexão de $from")
                    while (true) {
                        val line = input.readLine() ?: break
                        val command = line.substringBefore(' ').uppercase()
                        val arg = line.substringAfter(' ', "").trim()
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
                "PASS" -> if (userOk && arg == password) {
                    loggedIn = true
                    listener.onLog("FTP: câmera $from entrou")
                    reply(230, "Bem-vinda")
                } else {
                    listener.onLog("FTP: usuário ou senha errados vindos de $from")
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
            socket.soTimeout = 30_000
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
            if (n.size != 6) return reply(501, "Endereço inválido")
            closeData()
            active = InetSocketAddress(InetAddress.getByName(n.take(4).joinToString(".")), n[4] * 256 + n[5])
            reply(200, "OK")
        }

        private fun eprt(arg: String) {
            val parts = arg.split(arg.firstOrNull() ?: '|')
            if (parts.size < 4) return reply(501, "Endereço inválido")
            closeData()
            active = InetSocketAddress(InetAddress.getByName(parts[2]), parts[3].toInt())
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
            reply(150, "Pode enviar")
            val data = openData() ?: return reply(425, "Não consegui abrir a conexão de dados")
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
            } else {
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
        /** Portas abaixo de 1024 são proibidas para apps no Android. */
        const val DEFAULT_PORT = 2121
        private const val MAX_FILE = 400L * 1024 * 1024
    }
}
