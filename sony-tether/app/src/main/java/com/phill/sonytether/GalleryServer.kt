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
 * Páginas servidas pelo próprio tablet na rede Wi-Fi (ou no ponto de acesso dele), sem internet:
 * a galeria do cliente, aberta pelo QR code, e o slideshow para uma TV ou notebook. O endereço
 * leva um código aleatório para quem está na mesma rede não ver as fotos só por adivinhar.
 */
class GalleryServer(private val source: Source) {

    /** Dados do fotógrafo na galeria e no slideshow (campos vazios ficam de fora). */
    data class Brand(val studio: String, val instagram: String, val whatsapp: String, val hasLogo: Boolean)

    interface Source {
        val galleryTitle: String
        val brand: Brand

        /** Fotos que o cliente vê agora (número e nome do arquivo). */
        fun items(): List<Pair<Int, String>>

        /** Fotos aprovadas para o slideshow, da mais antiga para a mais nova. */
        fun slideshowItems(): List<Int>

        /** JPEG pronto para entregar (com preset e marca d'água), ou null. Pode demorar. */
        fun photo(number: Int): ByteArray?

        /** Miniatura em JPEG para a página. */
        fun thumbnail(number: Int): ByteArray?

        /** JPEG do tamanho de uma TV (1920 px) para o slideshow. */
        fun screen(number: Int): ByteArray?

        /** Logo em PNG, se houver. */
        fun logo(): ByteArray?
    }

    private val token = (1..12).map { ALPHABET[random.nextInt(ALPHABET.length)] }.joinToString("")
    private var socket: ServerSocket? = null
    private val workers = Executors.newFixedThreadPool(4)

    val port get() = socket?.localPort ?: 0
    val running get() = socket?.isClosed == false

    /** Caminho da galeria, com o código. */
    val path get() = "/$token/"

    /** Endereço para o QR code, ou null se o tablet não estiver em nenhuma rede local. */
    fun url(): String? = localAddress()?.let { "http://$it:$port$path" }

    /** Endereço curto do slideshow, para digitar no navegador da TV. */
    fun slideshowUrl(): String? = url()?.let { "${it}tv" }

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
        // Cabeçalhos: não precisa de nenhum, mas não deixa um cliente mandar infinitos.
        var headers = 0
        while (readLine(input)?.isNotEmpty() == true) if (++headers > MAX_HEADERS) return
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
            rest == "tv" || rest == "slideshow" -> send(out, 200, "text/html; charset=utf-8", slideshow().toByteArray(), head)
            rest == "slides.json" -> send(out, 200, "application/json", slidesJson().toByteArray(), head)
            rest == "logo.png" -> source.logo()?.let { send(out, 200, "image/png", it, head) }
                ?: send(out, 404, "text/plain", "Sem logo".toByteArray(), head)
            rest.startsWith("screen/") -> screen(out, rest.removePrefix("screen/"), head)
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

    private fun screen(out: OutputStream, id: String, head: Boolean) {
        val number = id.substringBefore('.').toIntOrNull()
        val data = number?.takeIf { it in source.slideshowItems() }?.let { source.screen(it) }
            ?: return send(out, 404, "text/plain", "Foto indisponível".toByteArray(), head)
        send(out, 200, "image/jpeg", data, head)
    }

    /** Lista do slideshow: números das fotos aprovadas; a página consulta a cada poucos segundos. */
    fun slidesJson(): String = "{\"items\":[${source.slideshowItems().joinToString(",")}]}"

    private fun zip(out: OutputStream) {
        out.write(
            ("HTTP/1.1 200 OK\r\nContent-Type: application/zip\r\n$SECURITY_HEADERS" +
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
        val brand = source.brand
        val studio = escape(brand.studio)
        val cards = items.joinToString("\n") { (number, name) ->
            """<a href="photo/$number.jpg"><img loading="lazy" src="thumb/$number.jpg" alt="${escape(name)}"></a>"""
        }
        val empty = if (items.isEmpty()) "<p class=\"hint\">Ainda não há fotos aqui. Atualize a página daqui a pouco.</p>" else ""
        val logo = if (brand.hasLogo) "<img class=\"logo\" src=\"logo.png\" alt=\"$studio\">" else ""
        val contacts = listOfNotNull(
            whatsappLink(brand.whatsapp)?.let { "<a class=\"chip\" href=\"$it\">WhatsApp</a>" },
            instagramLink(brand.instagram)?.let { "<a class=\"chip\" href=\"$it\">Instagram</a>" },
        ).joinToString("")
        val by = if (studio.isNotEmpty()) "<p class=\"by\">Fotos por <b>$studio</b></p>" else ""
        return """<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0d0d10">
<title>$title${if (studio.isNotEmpty()) " · $studio" else ""}</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#0d0d10;color:#f2f2f5;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header{padding:28px 18px 6px;text-align:center}
.logo{max-height:64px;max-width:60%;object-fit:contain;margin-bottom:14px}
.by{margin:0 0 4px;color:#a1a1ad;font-size:13px;letter-spacing:.04em}.by b{color:#e9b45a;font-weight:600}
h1{margin:0;font-size:24px;font-weight:600;letter-spacing:-.01em}
.hint{color:#a1a1ad;font-size:14px;margin:8px 0 0;line-height:1.45}
.chips{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:14px}
.chip{color:#f2f2f5;text-decoration:none;border:1px solid #33333d;border-radius:999px;padding:8px 14px;font-size:14px;background:#1b1b21}
.bar{display:flex;gap:10px;padding:18px 18px 12px;max-width:640px;margin:0 auto}
.btn{flex:1;text-align:center;background:linear-gradient(135deg,#e9b45a,#c98a2e);color:#1a1307;text-decoration:none;padding:13px;border-radius:12px;font-weight:600}
.btn.alt{background:#1b1b21;color:#f2f2f5;border:1px solid #292931}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:6px;padding:4px 18px 40px}
.grid img{width:100%;aspect-ratio:1;object-fit:cover;display:block;background:#1b1b21;border-radius:8px}
footer{color:#6e6e7a;font-size:12px;text-align:center;padding:0 18px 28px}
</style></head><body>
<header>$logo$by<h1>$title</h1>
<p class="hint">${items.size} ${if (items.size == 1) "foto" else "fotos"}. Toque numa foto para abrir; no celular, segure a foto aberta para salvar.</p>
${if (contacts.isNotEmpty()) "<div class=\"chips\">$contacts</div>" else ""}</header>
<div class="bar"><a class="btn" href="fotos.zip">Baixar todas (.zip)</a><a class="btn alt" href="./">Atualizar</a></div>
$empty
<div class="grid">
$cards
</div>
${if (studio.isNotEmpty()) "<footer>© $studio</footer>" else ""}
</body></html>"""
    }

    /** Tela cheia para TV: troca a foto sozinho e mostra na hora cada foto nova aprovada. */
    private fun slideshow(): String {
        val brand = source.brand
        val studio = escape(brand.studio)
        val mark = when {
            brand.hasLogo -> "<img id=\"mark\" src=\"logo.png\" alt=\"$studio\">"
            studio.isNotEmpty() -> "<div id=\"mark\" class=\"text\">$studio</div>"
            else -> ""
        }
        return """<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(source.galleryTitle)} · ao vivo</title>
<style>
html,body{margin:0;height:100%;background:#000;overflow:hidden;cursor:none;font-family:system-ui,-apple-system,Roboto,sans-serif}
.slide{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0;transition:opacity 1.2s ease}
.slide.on{opacity:1;animation:drift 9s ease-out forwards}
@keyframes drift{from{transform:scale(1)}to{transform:scale(1.035)}}
#mark{position:absolute;right:3vw;bottom:3vh;max-height:8vh;max-width:18vw;opacity:.85;object-fit:contain}
#mark.text{color:#fff;font-size:2.4vh;letter-spacing:.12em;text-transform:uppercase;text-shadow:0 1px 6px #000}
#wait{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#a1a1ad;font-size:3vh;text-align:center}
#wait b{color:#e9b45a;font-weight:600;font-size:4vh;margin-bottom:1vh}
#tip{position:absolute;left:50%;top:3vh;transform:translateX(-50%);background:#1b1b21cc;color:#f2f2f5;padding:10px 18px;border-radius:999px;font-size:14px;transition:opacity .6s}
</style></head><body>
<img class="slide" id="a" alt=""><img class="slide" id="b" alt="">
<div id="wait"><b>Ao vivo</b>As fotos aparecem aqui assim que forem aprovadas.</div>
$mark
<div id="tip">Toque ou clique para tela cheia</div>
<script>
var items=[],seen={},queue=[],pos=-1,front='a',timer=null,started=false;
function el(id){return document.getElementById(id)}
function show(n){
  var next=front==='a'?'b':'a',img=el(next);
  img.onload=function(){img.className='slide on';el(front).className='slide';front=next;el('wait').style.display='none';};
  img.src='screen/'+n+'.jpg';
}
function advance(){
  if(!items.length)return;
  var n;
  if(queue.length){n=queue.shift();pos=items.indexOf(n);}else{pos=(pos+1)%items.length;n=items[pos];}
  show(n);
}
function poll(){
  fetch('slides.json',{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){
    var fresh=d.items.filter(function(n){return !seen[n]});
    fresh.forEach(function(n){seen[n]=1});
    items=d.items;
    queue=queue.filter(function(n){return items.indexOf(n)>=0});
    if(started)queue=queue.concat(fresh);
    if(!started&&items.length){started=true;pos=items.length-2;advance();}
    else if(fresh.length&&started){advance();restart();}
  }).catch(function(){});
}
function restart(){clearInterval(timer);timer=setInterval(advance,7000);}
document.addEventListener('click',function(){var d=document.documentElement;(d.requestFullscreen||d.webkitRequestFullscreen||function(){}).call(d);el('tip').style.opacity=0;});
setTimeout(function(){el('tip').style.opacity=0},6000);
poll();setInterval(poll,4000);restart();
</script></body></html>"""
    }

    private fun send(out: OutputStream, code: Int, type: String, body: ByteArray, head: Boolean, extra: String = "") {
        val status = when (code) {
            200 -> "OK"
            else -> "Not Found"
        }
        out.write(
            ("HTTP/1.1 $code $status\r\nContent-Type: $type\r\nContent-Length: ${body.size}\r\n" +
                "Cache-Control: no-store\r\n$SECURITY_HEADERS$extra" + "Connection: close\r\n\r\n").toByteArray(),
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

    private fun whatsappLink(number: String): String? {
        val digits = number.filter { it.isDigit() }
        if (digits.length < 8) return null
        // Número brasileiro sem DDI: põe o 55.
        return "https://wa.me/" + if (digits.length <= 11) "55$digits" else digits
    }

    private fun instagramLink(handle: String): String? {
        val user = handle.trim().removePrefix("@").substringAfterLast("instagram.com/").trim('/').filter { it.isLetterOrDigit() || it == '.' || it == '_' }
        return if (user.isEmpty()) null else "https://instagram.com/$user"
    }

    private fun jpegName(name: String) = name.substringBeforeLast('.') + ".jpg"

    private fun escape(text: String) = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")

    companion object {
        private val PORTS = 8080..8089
        private const val MAX_HEADERS = 100

        /**
         * O endereço leva o código da galeria: sem Referer ele não vaza para o Instagram ou o
         * WhatsApp quando o cliente toca nos links; e as páginas não abrem dentro de outro site.
         */
        private const val SECURITY_HEADERS = "Referrer-Policy: no-referrer\r\nX-Content-Type-Options: nosniff\r\n" +
            "X-Frame-Options: DENY\r\nContent-Security-Policy: frame-ancestors 'none'\r\n"
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
