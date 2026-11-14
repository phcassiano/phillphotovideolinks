package com.phill.cockpit

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.SystemClock
import androidx.compose.runtime.mutableStateOf
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.coroutines.coroutineContext

// ---------- Transporte ----------

interface ElmLink {
    fun write(s: String)
    fun read(timeoutMs: Long): String
    fun close()
}

class StreamLink(private val inp: InputStream, private val out: OutputStream, private val closer: () -> Unit) : ElmLink {
    private val buf = ByteArray(512)
    override fun write(s: String) { out.write(s.toByteArray()); out.flush() }
    override fun read(timeoutMs: Long): String {
        val end = SystemClock.uptimeMillis() + timeoutMs
        while (SystemClock.uptimeMillis() < end) {
            val n = inp.available()
            if (n > 0) {
                val r = inp.read(buf, 0, minOf(n, buf.size))
                if (r < 0) throw IOException("Conexão encerrada")
                return String(buf, 0, r)
            }
            Thread.sleep(8)
        }
        return ""
    }
    override fun close() { try { closer() } catch (e: Exception) { } }
}

/** ELM327 BLE (Vgate iCar BLE, Konnwei, clones "V-LINK"): acha sozinho a característica de escrita/notificação. */
@SuppressLint("MissingPermission")
class BleLink(private val ctx: Context, private val device: BluetoothDevice) : ElmLink {
    private val q = LinkedBlockingQueue<String>()
    private var gatt: BluetoothGatt? = null
    private var writeCh: BluetoothGattCharacteristic? = null
    private val ready = CountDownLatch(1)
    @Volatile private var failed = false

    private val preferred = listOf("fff0", "ffe0", "18f0", "e7810a71", "beef")
    private val ignored = listOf("00001800", "00001801", "0000180a", "0000180f")

    private val cb = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
            if (newState == BluetoothProfile.STATE_CONNECTED) g.discoverServices()
            else if (newState == BluetoothProfile.STATE_DISCONNECTED) { failed = true; ready.countDown() }
        }

        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
            val services = g.services.filter { s -> ignored.none { s.uuid.toString().startsWith(it) } }
                .sortedBy { s -> if (preferred.any { s.uuid.toString().lowercase().contains(it) }) 0 else 1 }
            for (s in services) {
                val n = s.characteristics.firstOrNull {
                    it.properties and (BluetoothGattCharacteristic.PROPERTY_NOTIFY or BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0
                }
                val w = s.characteristics.firstOrNull {
                    it.properties and (BluetoothGattCharacteristic.PROPERTY_WRITE or BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0
                }
                if (n != null && w != null) {
                    writeCh = w
                    g.setCharacteristicNotification(n, true)
                    val d = n.getDescriptor(UUID.fromString("00002902-0000-1000-8000-00805f9b34fb"))
                    if (d == null) { ready.countDown(); return }
                    val v = if (n.properties and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0)
                        BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE else BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
                    if (Build.VERSION.SDK_INT >= 33) g.writeDescriptor(d, v)
                    else { @Suppress("DEPRECATION") run { d.value = v; g.writeDescriptor(d) } }
                    return
                }
            }
            failed = true; ready.countDown()
        }

        override fun onDescriptorWrite(g: BluetoothGatt, d: BluetoothGattDescriptor, status: Int) { ready.countDown() }

        @Deprecated("API < 33")
        override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic) {
            if (Build.VERSION.SDK_INT < 33) @Suppress("DEPRECATION") c.value?.let { q.offer(String(it)) }
        }

        override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic, value: ByteArray) {
            q.offer(String(value))
        }
    }

    fun connect(): Boolean {
        gatt = if (Build.VERSION.SDK_INT >= 23) device.connectGatt(ctx, false, cb, BluetoothDevice.TRANSPORT_LE)
        else device.connectGatt(ctx, false, cb)
        return ready.await(15, TimeUnit.SECONDS) && !failed && writeCh != null
    }

    override fun write(s: String) {
        val g = gatt ?: throw IOException("BLE desconectado")
        val ch = writeCh ?: throw IOException("BLE sem canal")
        if (failed) throw IOException("BLE desconectado")
        val type = if (ch.properties and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0)
            BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE else BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
        s.toByteArray().toList().chunked(20).forEach { part ->
            val bytes = part.toByteArray()
            if (Build.VERSION.SDK_INT >= 33) g.writeCharacteristic(ch, bytes, type)
            else @Suppress("DEPRECATION") run { ch.writeType = type; ch.value = bytes; g.writeCharacteristic(ch) }
            Thread.sleep(15)
        }
    }

    override fun read(timeoutMs: Long): String {
        if (failed) throw IOException("BLE desconectado")
        return q.poll(timeoutMs, TimeUnit.MILLISECONDS) ?: ""
    }

    override fun close() {
        try { gatt?.disconnect(); gatt?.close() } catch (e: Exception) { }
        gatt = null
    }
}

/** Adaptador simulado (modo demonstração): responde como um ELM327 num carro rodando. */
class DemoLink : ElmLink {
    private val q = LinkedBlockingQueue<String>()
    private val t0 = SystemClock.elapsedRealtime()
    private fun h(v: Int, bytes: Int = 1) = String.format("%0${bytes * 2}X", v.coerceIn(0, (1 shl (8 * bytes)) - 1))
    override fun write(s: String) {
        val c = s.trim().uppercase()
        val t = (SystemClock.elapsedRealtime() - t0) / 1000.0
        val speed = (55 + 45 * Math.sin(t / 14)).coerceAtLeast(0.0)
        val rpm = 850 + speed * 32 + 250 * Math.sin(t / 2.5)
        val r = when (c) {
            "ATZ", "ATI" -> "ELM327 v1.5"
            "ATRV" -> String.format(java.util.Locale.US, "%.1fV", 13.8 + 0.2 * Math.sin(t))
            "ATDP" -> "AUTO, ISO 15765-4 (CAN 11/500)"
            "0100" -> "4100BE3FB813"
            "0120" -> "412000020000"
            "010C" -> "410C" + h((rpm * 4).toInt(), 2)
            "010D" -> "410D" + h(speed.toInt())
            "0105" -> "4105" + h(91 + 40)
            "010F" -> "410F" + h(34 + 40)
            "0104" -> "4104" + h((90 + 80 * Math.sin(t / 3)).toInt())
            "0111" -> "4111" + h((50 + 40 * Math.sin(t / 3)).toInt())
            "0110" -> "4110" + h((rpm / 1000 * 3.2 * 100).toInt(), 2)
            "012F" -> "412F" + h(150)
            "010E" -> "410E" + h(2 * (14 + 64))
            "03" -> "4302030101710000"
            "07" -> "4700"
            "04" -> "44"
            else -> if (c.startsWith("AT")) "OK" else "NO DATA"
        }
        q.offer("$r\r\r>")
    }
    override fun read(timeoutMs: Long): String = q.poll(timeoutMs, TimeUnit.MILLISECONDS) ?: ""
    override fun close() {}
}

// ---------- Protocolo ELM327 ----------

class Elm(private val link: ElmLink) {
    var lastRaw = ""

    fun cmd(c: String, timeout: Long = 3000): String {
        link.write("$c\r")
        val sb = StringBuilder()
        val end = SystemClock.uptimeMillis() + timeout
        while (SystemClock.uptimeMillis() < end) {
            val r = link.read(minOf(200L, end - SystemClock.uptimeMillis()).coerceAtLeast(1))
            if (r.isNotEmpty()) { sb.append(r); if (r.contains('>')) break }
        }
        lastRaw = sb.toString().replace(">", "").replace("\u0000", "").trim()
        return lastRaw
    }

    /** Linhas limpas: maiúsculas, sem espaços, sem "SEARCHING...". */
    fun lines(raw: String) = raw.uppercase().replace("SEARCHING...", "").replace(" ", "")
        .split('\r', '\n').map { it.trim() }.filter { it.isNotEmpty() }

    fun pid(p: String, timeout: Long = 1500): IntArray? {
        val raw = cmd("01$p", timeout)
        for (l in lines(raw)) {
            val i = l.indexOf("41$p")
            if (i >= 0) {
                val b = l.substring(i + 4).chunked(2).filter { it.length == 2 }.mapNotNull { it.toIntOrNull(16) }
                if (b.isNotEmpty()) return b.toIntArray()
            }
        }
        return null
    }
}

// ---------- Dados ----------

data class ObdData(
    val rpm: Float? = null, val speed: Float? = null, val coolant: Float? = null, val intake: Float? = null,
    val load: Float? = null, val throttle: Float? = null, val fuelLevel: Float? = null, val voltage: Float? = null,
    val maf: Float? = null, val map: Float? = null, val lph: Float? = null, val kml: Float? = null,
    val timing: Float? = null
)

object Obd {
    const val ST_OFF = 0; const val ST_CONNECTING = 1; const val ST_ADAPTER = 2; const val ST_CAR = 3

    val state = mutableStateOf(ST_OFF)
    val status = mutableStateOf("OBD2 desligado")
    val adapterInfo = mutableStateOf("")
    val protocol = mutableStateOf("")
    val data = mutableStateOf(ObdData())

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var job: Job? = null
    @Volatile private var link: ElmLink? = null
    private val pending = Channel<Pair<String, CompletableDeferred<String>>>(Channel.UNLIMITED)
    private val spp: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

    val connected get() = state.value == ST_CAR

    fun configured() = when (Prefs.obdType.v) {
        "wifi" -> Prefs.wifiHost.v.isNotBlank()
        "demo" -> true
        else -> Prefs.obdAddr.v.isNotBlank()
    }

    fun connect(ctx: Context) {
        disconnect()
        val app = ctx.applicationContext
        job = scope.launch { session(app) }
    }

    fun disconnect() {
        job?.cancel(); job = null
        link?.close(); link = null
        state.value = ST_OFF
        status.value = "OBD2 desligado"
        data.value = ObdData()
    }

    /** Comando livre (console, códigos de falha). */
    suspend fun raw(cmd: String, timeoutMs: Long = 15000): String? {
        if (state.value < ST_ADAPTER) return null
        val d = CompletableDeferred<String>()
        pending.send(cmd to d)
        return withTimeoutOrNull(timeoutMs) { d.await() }
    }

    private suspend fun session(ctx: Context) {
        var attempt = 0
        while (coroutineContext.isActive) {
            state.value = ST_CONNECTING
            status.value = if (attempt == 0) "Conectando ao adaptador…" else "Reconectando… (tentativa ${attempt + 1})"
            try {
                val l = open(ctx)
                link = l
                run(Elm(l))
            } catch (e: Exception) {
                if (!coroutineContext.isActive) break
                status.value = "Sem conexão: ${e.message ?: e.javaClass.simpleName}"
            } finally {
                link?.close(); link = null
                while (true) { val p = pending.tryReceive().getOrNull() ?: break; p.second.complete("") }
            }
            if (!coroutineContext.isActive) break
            state.value = ST_OFF
            data.value = ObdData()
            if (!Prefs.obdAuto.v) break
            attempt++
            delay(if (attempt < 3) 4000 else 15000)
        }
    }

    @SuppressLint("MissingPermission")
    private fun open(ctx: Context): ElmLink {
        when (Prefs.obdType.v) {
            "demo" -> return DemoLink()
            "wifi" -> {
                val cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                // Usa a rede Wi-Fi mesmo sem internet (rede do adaptador), para o Android não mandar pelo 4G.
                @Suppress("DEPRECATION")
                val net = cm.allNetworks.firstOrNull { cm.getNetworkCapabilities(it)?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true }
                val s: Socket = net?.socketFactory?.createSocket() ?: Socket()
                s.connect(InetSocketAddress(Prefs.wifiHost.v.trim(), Prefs.wifiPort.v), 6000)
                s.tcpNoDelay = true
                return StreamLink(s.getInputStream(), s.getOutputStream()) { s.close() }
            }
            "ble" -> {
                val ad = (ctx.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter
                    ?: throw IOException("Sem Bluetooth")
                if (!ad.isEnabled) throw IOException("Bluetooth desligado")
                val l = BleLink(ctx, ad.getRemoteDevice(Prefs.obdAddr.v))
                if (!l.connect()) { l.close(); throw IOException("adaptador BLE não respondeu") }
                return l
            }
            else -> {
                val ad: BluetoothAdapter = (ctx.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter
                    ?: throw IOException("Sem Bluetooth")
                if (!ad.isEnabled) throw IOException("Bluetooth desligado")
                val dev = ad.getRemoteDevice(Prefs.obdAddr.v)
                try { ad.cancelDiscovery() } catch (e: Exception) { }
                val tries: List<() -> BluetoothSocket> = listOf(
                    { dev.createRfcommSocketToServiceRecord(spp) },
                    { dev.createInsecureRfcommSocketToServiceRecord(spp) },
                    { dev.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType).invoke(dev, 1) as BluetoothSocket }
                )
                var last: Exception? = null
                for (t in tries) {
                    var s: BluetoothSocket? = null
                    try {
                        s = t(); s.connect()
                        val sock = s
                        return StreamLink(sock.inputStream, sock.outputStream) { sock.close() }
                    } catch (e: Exception) { last = e; try { s?.close() } catch (x: Exception) { } }
                }
                throw IOException(last?.message ?: "falha no Bluetooth")
            }
        }
    }

    private fun supportedFrom(bytes: IntArray?, base: Int, into: MutableSet<Int>) {
        if (bytes == null) return
        for (i in 0 until minOf(4, bytes.size)) for (b in 0 until 8)
            if (bytes[i] and (0x80 shr b) != 0) into += base + i * 8 + b + 1
    }

    private suspend fun run(elm: Elm) {
        elm.cmd("ATZ", 4000); delay(600)
        elm.cmd("ATE0"); elm.cmd("ATL0"); elm.cmd("ATS0"); elm.cmd("ATH0"); elm.cmd("ATAT1")
        adapterInfo.value = Regex("ELM327\\s*v?[\\d.]+", RegexOption.IGNORE_CASE).find(elm.cmd("ATI"))?.value ?: "ELM327"
        elm.cmd("ATSP0")
        state.value = ST_ADAPTER
        status.value = "Adaptador conectado. Procurando o carro…"

        val sup = mutableSetOf<Int>()
        while (coroutineContext.isActive) {
            val r = elm.pid("00", 12000)
            if (r != null) { supportedFrom(r, 0, sup); break }
            status.value = "Adaptador OK, mas o carro não respondeu. A ignição está ligada?"
            servePending(elm)
            delay(5000)
        }
        if (sup.contains(0x20)) supportedFrom(elm.pid("20"), 0x20, sup)
        if (sup.contains(0x40)) supportedFrom(elm.pid("40"), 0x40, sup)
        protocol.value = elm.cmd("ATDP").lines().firstOrNull { it.isNotBlank() }?.trim()?.removePrefix("AUTO,") ?: ""
        state.value = ST_CAR
        status.value = "OBD2 conectado"

        fun has(p: Int) = sup.isEmpty() || sup.contains(p)
        var cycle = 0
        var d = ObdData()
        var misses = 0
        while (coroutineContext.isActive) {
            val rpmB = if (has(0x0C)) elm.pid("0C") else null
            val spdB = if (has(0x0D)) elm.pid("0D") else null
            if (rpmB == null && spdB == null) {
                if (++misses >= 6) throw IOException("o carro parou de responder")
            } else misses = 0
            val rpm = rpmB?.takeIf { it.size >= 2 }?.let { (it[0] * 256 + it[1]) / 4f }
            val spd = spdB?.let { it[0].toFloat() }
            var maf: Float? = null
            var map: Float? = d.map
            if (has(0x10)) maf = elm.pid("10")?.takeIf { it.size >= 2 }?.let { (it[0] * 256 + it[1]) / 100f }
            else if (has(0x0B)) map = elm.pid("0B")?.let { it[0].toFloat() }

            if (cycle % 5 == 0) {
                d = d.copy(
                    coolant = if (has(0x05)) elm.pid("05")?.let { it[0] - 40f } else null,
                    intake = if (has(0x0F)) elm.pid("0F")?.let { it[0] - 40f } else null,
                    load = if (has(0x04)) elm.pid("04")?.let { it[0] * 100f / 255f } else null,
                    throttle = if (has(0x11)) elm.pid("11")?.let { it[0] * 100f / 255f } else null,
                    fuelLevel = if (sup.contains(0x2F)) elm.pid("2F")?.let { it[0] * 100f / 255f } else null,
                    timing = if (sup.contains(0x0E)) elm.pid("0E")?.let { it[0] / 2f - 64f } else null,
                    voltage = Regex("(\\d+\\.?\\d*)V").find(elm.cmd("ATRV", 1500).uppercase())?.groupValues?.get(1)?.toFloatOrNull()
                )
            }

            // Consumo: MAF direto ou estimado por MAP+IAT+RPM (speed-density).
            val iatK = (d.intake ?: 30f) + 273.15f
            val mafEff = maf ?: if (map != null && rpm != null)
                (rpm * map / iatK / 2f) / 60f * 0.85f * Prefs.displacement.v * 28.97f / 8.314f else null
            val (afr, dens) = when (Prefs.fuel.v) {
                "etanol" -> 8.7f to 809f
                "diesel" -> 14.5f to 832f
                else -> 13.2f to 750f // gasolina C brasileira (27% etanol)
            }
            val lph = mafEff?.let { it * 3600f / (afr * dens) }
            val kml = if (lph != null && spd != null && spd > 3f && lph > 0.05f) (spd / lph).coerceAtMost(99f) else null

            d = d.copy(rpm = rpm, speed = spd, maf = mafEff, map = map, lph = lph, kml = kml)
            data.value = d
            servePending(elm)
            cycle++
        }
    }

    private fun servePending(elm: Elm) {
        while (true) {
            val p = pending.tryReceive().getOrNull() ?: break
            p.second.complete(try { elm.cmd(p.first, 8000) } catch (e: Exception) { "" })
        }
    }

    // ---------- Códigos de falha ----------

    fun parseDtcs(raw: String, mode: String): List<String> {
        val lines = raw.uppercase().replace(" ", "").split('\r', '\n').map { it.trim() }.filter { it.isNotEmpty() }
        val multi = lines.any { it.length > 2 && it[1] == ':' }
        val frames = if (multi) listOf(lines.filter { it.contains(':') }.joinToString("") { it.substringAfter(':') })
        else lines.filter { it.contains(mode) }
        val out = mutableListOf<String>()
        for (f in frames) {
            val idx = f.indexOf(mode); if (idx < 0) continue
            var h = f.substring(idx + 2)
            if ((h.length / 2) % 2 == 1) h = h.substring(2) // CAN: primeiro byte = quantidade
            h.chunked(4).filter { it.length == 4 && it != "0000" && it.all { c -> c.isLetterOrDigit() } }.forEach {
                val a = it.substring(0, 1).toIntOrNull(16) ?: return@forEach
                out += "${"PCBU"[a shr 2]}${a and 3}${it.substring(1)}"
            }
        }
        return out.distinct()
    }
}
