package com.phill.cockpit

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.compose.runtime.mutableStateOf
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.InetAddress
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.net.URLDecoder
import java.util.concurrent.Executors

/**
 * Controle pelo celular: a central sobe um servidor web na rede Wi-Fi.
 * O celular abre o endereço no navegador e controla a música e manda
 * um destino que abre o Waze (ou o Maps) navegando na tela do carro.
 * Tudo roda na rede local; nada sai para a internet.
 */
object RemoteServer {
    val running = mutableStateOf(false)
    val url = mutableStateOf("")
    val lastClientAt = mutableStateOf(0L)

    private var server: ServerSocket? = null
    private val pool = Executors.newCachedThreadPool()
    private val main = Handler(Looper.getMainLooper())
    @Volatile private var appCtx: Context? = null

    fun ensure(ctx: Context) {
        if (Prefs.remoteEnabled.v && !running.value) start(ctx)
        else if (!Prefs.remoteEnabled.v && running.value) stop()
    }

    fun start(ctx: Context) {
        if (running.value) return
        appCtx = ctx.applicationContext
        pool.execute {
            try {
                val s = ServerSocket(Prefs.remotePort.v)
                s.reuseAddress = true
                server = s
                val ip = localIp()
                main.post { running.value = true; url.value = "http://$ip:${Prefs.remotePort.v}" }
                while (!s.isClosed) {
                    val c = try { s.accept() } catch (e: Exception) { break }
                    pool.execute { handle(c) }
                }
            } catch (e: Exception) {
                main.post { running.value = false; url.value = "" }
            }
        }
    }

    fun stop() {
        try { server?.close() } catch (e: Exception) { }
        server = null
        running.value = false; url.value = ""
    }

    private fun handle(c: Socket) {
        try {
            c.soTimeout = 8000
            val r = BufferedReader(InputStreamReader(c.getInputStream()))
            val line = r.readLine() ?: return
            while (true) { val h = r.readLine() ?: break; if (h.isEmpty()) break }
            val parts = line.split(" ")
            if (parts.size < 2) return
            val full = parts[1]
            val path = full.substringBefore('?')
            val query = parseQuery(full.substringAfter('?', ""))
            lastClientAt.value = System.currentTimeMillis()
            route(c.getOutputStream(), path, query)
        } catch (e: Exception) {
        } finally {
            try { c.close() } catch (e: Exception) { }
        }
    }

    private fun route(out: OutputStream, path: String, q: Map<String, String>) {
        val ctx = appCtx ?: return send(out, 500, "text/plain", "sem contexto".toByteArray())
        // PIN opcional
        val pin = Prefs.remotePin.v
        if (pin.isNotBlank() && path.startsWith("/api/") && q["k"] != pin) {
            return send(out, 403, "application/json", """{"err":"pin"}""".toByteArray())
        }
        when {
            path == "/" -> send(out, 200, "text/html; charset=utf-8", page(pin.isNotBlank()).toByteArray(Charsets.UTF_8))
            path == "/api/state" -> {
                val o = JSONObject()
                    .put("title", Media.title.value)
                    .put("artist", Media.artist.value)
                    .put("playing", Media.playing.value)
                    .put("app", Apps.find(Media.source.value)?.label ?: "")
                    .put("speed", Live.speed.floatValue.toInt())
                    .put("obd", Obd.connected)
                send(out, 200, "application/json", o.toString().toByteArray(Charsets.UTF_8))
            }
            path == "/api/cmd" -> {
                main.post {
                    when (q["a"]) {
                        "play", "pause" -> Media.playPause(ctx)
                        "next" -> Media.next(ctx)
                        "prev" -> Media.prev(ctx)
                        "volup" -> Media.volume(ctx, true)
                        "voldown" -> Media.volume(ctx, false)
                    }
                }
                send(out, 200, "application/json", "{\"ok\":1}".toByteArray())
            }
            path == "/api/nav" -> {
                val dest = q["q"]?.trim().orEmpty()
                val app = q["app"] ?: "waze"
                if (dest.isNotEmpty()) main.post { navigate(ctx, dest, app) }
                send(out, 200, "application/json", "{\"ok\":1}".toByteArray())
            }
            path == "/api/open" -> {
                main.post {
                    val pkg = when (q["app"]) {
                        "waze" -> "com.waze"
                        "maps" -> "com.google.android.apps.maps"
                        "spotify" -> "com.spotify.music"
                        "ytmusic" -> "com.google.android.apps.youtube.music"
                        "aa" -> "com.google.android.projection.gearhead"
                        else -> q["pkg"] ?: ""
                    }
                    if (pkg.isNotEmpty()) Apps.launch(ctx, pkg)
                }
                send(out, 200, "application/json", "{\"ok\":1}".toByteArray())
            }
            else -> send(out, 404, "text/plain", "nao encontrado".toByteArray())
        }
    }

    private fun navigate(ctx: Context, dest: String, app: String) {
        val enc = Uri.encode(dest)
        val intents = if (app == "maps") listOf(
            Intent(Intent.ACTION_VIEW, Uri.parse("google.navigation:q=$enc")).setPackage("com.google.android.apps.maps"),
            Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=$enc"))
        ) else listOf(
            Intent(Intent.ACTION_VIEW, Uri.parse("https://waze.com/ul?q=$enc&navigate=yes")).setPackage("com.waze"),
            Intent(Intent.ACTION_VIEW, Uri.parse("waze://?q=$enc&navigate=yes")),
            Intent(Intent.ACTION_VIEW, Uri.parse("google.navigation:q=$enc")).setPackage("com.google.android.apps.maps"),
            Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=$enc"))
        )
        Apps.open(ctx, *intents.toTypedArray())
    }

    private fun send(out: OutputStream, code: Int, type: String, body: ByteArray) {
        val head = "HTTP/1.1 $code OK\r\nContent-Type: $type\r\nContent-Length: ${body.size}\r\n" +
            "Access-Control-Allow-Origin: *\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n"
        try { out.write(head.toByteArray()); out.write(body); out.flush() } catch (e: Exception) { }
    }

    private fun parseQuery(q: String): Map<String, String> {
        if (q.isBlank()) return emptyMap()
        return q.split("&").mapNotNull {
            val i = it.indexOf('='); if (i < 0) return@mapNotNull null
            try { URLDecoder.decode(it.substring(0, i), "UTF-8") to URLDecoder.decode(it.substring(i + 1), "UTF-8") } catch (e: Exception) { null }
        }.toMap()
    }

    fun localIp(): String {
        try {
            val addrs = NetworkInterface.getNetworkInterfaces().toList().flatMap { it.inetAddresses.toList() }
                .filter { !it.isLoopbackAddress && it is InetAddress && it.address.size == 4 }
            // prefere faixas privadas (rede do roteador / hotspot do celular)
            val priv = addrs.firstOrNull { val h = it.hostAddress ?: ""; h.startsWith("192.168.") || h.startsWith("10.") || h.startsWith("172.") }
            return (priv ?: addrs.firstOrNull())?.hostAddress ?: "0.0.0.0"
        } catch (e: Exception) { return "0.0.0.0" }
    }

    private fun page(pin: Boolean): String = """<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Controle do carro</title><style>
:root{--ac:#00e5ff;--bg:#0b1020;--p:#161c2e}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;background:var(--bg);color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:16px;max-width:520px;margin:0 auto}
h1{font-size:18px;margin:4px 0 14px;color:var(--ac)}
.card{background:var(--p);border-radius:18px;padding:16px;margin-bottom:14px}
.np{font-size:20px;font-weight:600;min-height:26px}.sub{opacity:.6;font-size:14px;min-height:20px}
.row{display:flex;gap:10px;margin-top:12px}
button{flex:1;border:0;border-radius:14px;background:#26304a;color:#fff;font-size:22px;padding:16px;cursor:pointer;font-weight:600}
button:active{transform:scale(.96)}.pri{background:var(--ac);color:#000}
input{width:100%;padding:14px;border-radius:12px;border:1px solid #2a3350;background:#0e1424;color:#fff;font-size:16px;margin-bottom:10px}
.q{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.q button{flex:0 0 auto;font-size:15px;padding:12px 16px}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#555;margin-right:6px}.on{background:#00e676}
small{opacity:.5}
</style></head><body>
<h1>🚗 Controle do carro</h1>
${if (pin) "<div class=card><input id=pin type=number inputmode=numeric placeholder=\"PIN mostrado na central\" oninput=\"savePin()\"></div>" else ""}
<div class=card>
  <div class=np id=title>—</div><div class=sub id=artist></div>
  <div class=row>
    <button onclick="cmd('prev')">⏮</button>
    <button class=pri id=pp onclick="cmd('play')">⏯</button>
    <button onclick="cmd('next')">⏭</button>
  </div>
  <div class=row>
    <button onclick="cmd('voldown')">🔉 −</button>
    <button onclick="cmd('volup')">🔊 +</button>
  </div>
</div>
<div class=card>
  <div class=sub style="margin-bottom:8px">Mandar destino para o carro</div>
  <input id=dest placeholder="Endereço ou lugar (ex.: Av. Paulista, 1000)">
  <div class=row>
    <button class=pri onclick="nav('waze')">Abrir no Waze</button>
    <button onclick="nav('maps')">No Maps</button>
  </div>
</div>
<div class=card>
  <div class=sub style="margin-bottom:8px">Abrir na central</div>
  <div class=q>
    <button onclick="open_('waze')">Waze</button>
    <button onclick="open_('maps')">Maps</button>
    <button onclick="open_('spotify')">Spotify</button>
    <button onclick="open_('ytmusic')">YT Music</button>
    <button onclick="open_('aa')">Android Auto</button>
  </div>
</div>
<div class=sub><span class=dot id=cx></span><span id=st>conectando…</span></div>
<small>Funciona na mesma rede Wi-Fi. Use o roteador do carro ou o ponto de acesso do celular.</small>
<script>
var pin=localStorage.pin||'';
function savePin(){pin=document.getElementById('pin').value;localStorage.pin=pin}
${if (pin) "document.getElementById('pin').value=pin;" else ""}
function k(){return pin?('&k='+encodeURIComponent(pin)):''}
function cmd(a){fetch('/api/cmd?a='+a+k())}
function open_(a){fetch('/api/open?app='+a+k())}
function nav(app){var d=document.getElementById('dest').value.trim();if(!d)return;fetch('/api/nav?app='+app+'&q='+encodeURIComponent(d)+k())}
function poll(){fetch('/api/state'+(pin?('?k='+encodeURIComponent(pin)):'')).then(r=>r.json()).then(s=>{
  document.getElementById('title').textContent=s.title||'Nada tocando';
  document.getElementById('artist').textContent=s.artist||s.app||'';
  document.getElementById('pp').textContent=s.playing?'⏸':'▶';
  document.getElementById('cx').className='dot on';
  document.getElementById('st').textContent=(s.obd?'OBD2 · ':'')+s.speed+' km/h';
}).catch(()=>{document.getElementById('cx').className='dot';document.getElementById('st').textContent='sem conexão'})}
setInterval(poll,2000);poll();
</script></body></html>"""
}
