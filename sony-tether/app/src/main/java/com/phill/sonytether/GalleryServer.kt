package com.phill.sonytether

import java.io.BufferedInputStream
import java.io.OutputStream
import java.net.Inet4Address
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.security.SecureRandom
import java.util.concurrent.Executors
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * Página com as fotos para o cliente abrir no celular pelo QR code. Roda no próprio tablet,
 * na rede Wi-Fi (ou no ponto de acesso do tablet), sem internet. O endereço leva um código
 * aleatório para quem está na mesma rede não ver as fotos só por adivinhar o endereço.
 */
class GalleryServer(private val source: Source) {

    interface Source {
        val galleryTitle: String

        /** Fotos que o cliente vê agora (número e nome do arquivo). */
        fun items(): List<Pair<Int, String>>

        /** JPEG pronto para entregar (com preset e marca d'água), ou null. Pode demorar. */
        fun photo(number: Int): ByteArray?

        /** Miniatura em JPEG para a página. */
        fun thumbnail(number: Int): ByteArray?
    }

    private val token = (1..8).map { ALPHABET[random.nextInt(ALPHABET.length)] }.joinToString("")
    private var socket: ServerSocket? = null
    private val workers = Executors.newFixedThreadPool(4)

    val port get() = socket?.localPort ?: 0
    val running get() = socket?.isClosed == false

    /** Caminho da galeria, com o código. */
    val path get() = "/$token/"

    /** Endereço para o QR code, ou null se o tablet não estiver em nenhuma rede local. */
    fun url(): String? = localAddress()?.let { "http://$it:$port$path" }

    fun start() {
        if (running) return
        val server = (PORTS).firstNotNullOfOrNull { runCatching { ServerSocket(it) }.getOrNull() } ?: ServerSocket(0)
        socket = server
        Thread({
            while (!server.isClosed) {
                val client = try {
                    server.accept()
                } catch (e: SocketException) {
                    break
                }
                workers.execute { handle(client) }
            }
        }, "gallery").start()
    }

    fun stop() {
        runCatching { socket?.close() }
        socket = null
    }

    private fun handle(client: Socket) {
        client.use { s -> runCatching { serve(s) } }
    }

    private fun serve(s: Socket) {
        s.soTimeout = 30_000
        val input = BufferedInputStream(s.getInputStream())
        val requestLine = readLine(input) ?: return
        while (readLine(input)?.isNotEmpty() == true) Unit // cabeçalhos: não precisa de nenhum
        val parts = requestLine.split(' ')
        val head = parts.getOrNull(0) == "HEAD"
        val path = parts.getOrNull(1)?.substringBefore('?') ?: "/"
        val query = parts.getOrNull(1)?.substringAfter('?', "") ?: ""
        val out = s.getOutputStream()
        val prefix = this.path
        if (!path.startsWith(prefix)) return send(out, 404, "text/plain", "Não encontrado".toByteArray(), head)
        val rest = path.removePrefix(prefix)
        when {
            rest.isEmpty() -> send(out, 200, "text/html; charset=utf-8", page().toByteArray(), head)
            rest == "fotos.zip" -> zip(out)
            rest.startsWith("thumb/") -> image(out, rest.removePrefix("thumb/"), head, null) { source.thumbnail(it) }
            rest.startsWith("photo/") -> image(out, rest.removePrefix("photo/"), head, query.contains("dl=1")) { source.photo(it) }
            else -> send(out, 404, "text/plain", "Não encontrado".toByteArray(), head)
        }
    }

    private fun image(out: OutputStream, id: String, head: Boolean, download: Boolean?, load: (Int) -> ByteArray?) {
        val number = id.substringBefore('.').toIntOrNull()
        val item = source.items().firstOrNull { it.first == number }
        val data = item?.let { load(it.first) }
        if (data == null) return send(out, 404, "text/plain", "Foto indisponível".toByteArray(), head)
        val disposition = if (download == true) "attachment" else "inline"
        send(out, 200, "image/jpeg", data, head, "Content-Disposition: $disposition; filename=\"${jpegName(item.second)}\"\r\n")
    }

    private fun zip(out: OutputStream) {
        out.write(
            ("HTTP/1.1 200 OK\r\nContent-Type: application/zip\r\n" +
                "Content-Disposition: attachment; filename=\"${SessionNames.prefix(source.galleryTitle)}.zip\"\r\n" +
                "Connection: close\r\n\r\n").toByteArray(),
        )
        ZipOutputStream(out).apply {
            setLevel(0) // JPEG não comprime mais: só junta os arquivos
            for ((number, name) in source.items()) {
                val data = source.photo(number) ?: continue
                putNextEntry(ZipEntry(jpegName(name)))
                write(data)
                closeEntry()
            }
            finish()
        }
        out.flush()
    }

    private fun page(): String {
        val items = source.items()
        val title = escape(source.galleryTitle)
        val cards = items.joinToString("\n") { (number, name) ->
            """<a href="photo/$number.jpg"><img loading="lazy" src="thumb/$number.jpg" alt="${escape(name)}"></a>"""
        }
        val empty = if (items.isEmpty()) "<p class=\"hint\">Ainda não há fotos aqui. Atualize a página daqui a pouco.</p>" else ""
        return """<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>$title</title>
<style>
body{margin:0;background:#16161a;color:#eee;font-family:system-ui,-apple-system,sans-serif}
header{padding:20px 16px 8px}h1{margin:0;font-size:22px}
.hint{color:#9a9aa5;font-size:14px;margin:6px 0 0;line-height:1.4}
.bar{display:flex;gap:8px;padding:12px 16px}
.btn{flex:1;text-align:center;background:#e8a33d;color:#000;text-decoration:none;padding:12px;border-radius:10px;font-weight:600}
.btn.alt{background:#2a2a31;color:#fff}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:4px;padding:4px 16px 32px}
.grid img{width:100%;aspect-ratio:1;object-fit:cover;display:block;background:#2a2a31;border-radius:4px}
</style></head><body>
<header><h1>$title</h1>
<p class="hint">${items.size} ${if (items.size == 1) "foto" else "fotos"}. Toque numa foto para abrir; no celular, segure a foto aberta para salvar.</p></header>
<div class="bar"><a class="btn" href="fotos.zip">Baixar todas (.zip)</a><a class="btn alt" href="./">Atualizar</a></div>
$empty
<div class="grid">
$cards
</div></body></html>"""
    }

    private fun send(out: OutputStream, code: Int, type: String, body: ByteArray, head: Boolean, extra: String = "") {
        val status = when (code) {
            200 -> "OK"
            else -> "Not Found"
        }
        out.write(
            ("HTTP/1.1 $code $status\r\nContent-Type: $type\r\nContent-Length: ${body.size}\r\n" +
                "Cache-Control: no-store\r\n$extra" + "Connection: close\r\n\r\n").toByteArray(),
        )
        if (!head) out.write(body)
        out.flush()
    }

    private fun readLine(input: BufferedInputStream): String? {
        val line = StringBuilder()
        while (true) {
            val c = input.read()
            if (c < 0) return if (line.isEmpty()) null else line.toString()
            if (c == '\n'.code) return line.toString().trimEnd('\r')
            if (line.length > 8192) return null
            line.append(c.toChar())
        }
    }

    private fun jpegName(name: String) = name.substringBeforeLast('.') + ".jpg"

    private fun escape(text: String) = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")

    companion object {
        private val PORTS = 8080..8089
        private const val ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
        private val random = SecureRandom()

        /** IPv4 do Wi-Fi ou do ponto de acesso; ignora dados móveis e VPN. */
        fun localAddress(): String? {
            val candidates = runCatching { NetworkInterface.getNetworkInterfaces().toList() }.getOrDefault(emptyList())
                .filter { runCatching { it.isUp && !it.isLoopback }.getOrDefault(false) }
                .filterNot { n -> SKIP.any { n.name.startsWith(it) } }
                .flatMap { n -> n.inetAddresses.toList().filterIsInstance<Inet4Address>().filter { it.isSiteLocalAddress }.map { n.name to it } }
            val ranked = candidates.sortedBy { (name, _) ->
                when {
                    name.startsWith("wlan") -> 0
                    name.startsWith("ap") || name.startsWith("swlan") || name.startsWith("softap") -> 1
                    name.startsWith("eth") -> 2
                    else -> 3
                }
            }
            return ranked.firstOrNull()?.second?.hostAddress
        }

        private val SKIP = listOf("rmnet", "ccmni", "pdp", "v4-", "tun", "ppp", "dummy", "p2p", "ipsec", "clat", "seth", "usb")
    }
}
