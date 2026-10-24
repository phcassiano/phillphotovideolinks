package com.phill.sonytether

import com.phill.sonytether.ptp.Ptp
import com.phill.sonytether.ptp.PtpException
import com.phill.sonytether.ptp.PtpReader
import com.phill.sonytether.ptp.PtpResponse
import com.phill.sonytether.ptp.PtpUsb
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.Locale
import kotlin.math.abs

/** Uma propriedade da câmera, como vem no pacote GetAllDevicePropData. */
class SonyProp(
    val code: Int,
    val type: Int,
    val enabled: Int,
    val current: Long,
    /** Valores que a câmera aceita; vazio quando ela só aceita "um passo para cima/baixo". */
    val values: LongArray,
)

class Shot(val name: String, val data: ByteArray)

/** Região de um JPEG dentro de um pacote maior (o quadro do ao vivo vem com cabeçalho). */
class JpegRegion(val data: ByteArray, val offset: Int, val length: Int)

/**
 * Câmera Sony no modo "PC Remoto", pelo protocolo PTP com as extensões SDIO da Sony
 * (as mesmas que o Imaging Edge e o libgphoto2 usam).
 */
class SonyCamera(private val ptp: PtpUsb) {

    var protocolVersion = 0
        private set
    var props: Map<Int, SonyProp> = emptyMap()
        private set

    // Depois de baixar uma foto, o contador de fotos pendentes só vale de novo após uma leitura nova.
    private var propsFresh = false

    fun connect() {
        ptp.restartTransactionIds()
        val open = ptp.transaction(Ptp.OC_OPEN_SESSION, intArrayOf(1))
        if (open.code == Ptp.RC_SESSION_ALREADY_OPEN) {
            ptp.transaction(Ptp.OC_CLOSE_SESSION)
            ptp.restartTransactionIds()
            Ptp.expectOk("Abrir sessão", ptp.transaction(Ptp.OC_OPEN_SESSION, intArrayOf(1)))
        } else {
            Ptp.expectOk("Abrir sessão", open)
        }

        sdioConnect(1)
        sdioConnect(2)
        protocolVersion = extDeviceInfo()
        sdioConnect(3)

        // A câmera leva alguns instantes para liberar as propriedades depois do aperto de mão.
        repeat(40) {
            if (refreshProps()) return
            Thread.sleep(250)
        }
        throw PtpException("A câmera não respondeu. Confira se ela está no modo PC Remoto.")
    }

    fun refreshProps(): Boolean {
        val r = ptp.transaction(OC_GET_ALL_PROP_DATA)
        if (r.code == Ptp.RC_DEVICE_BUSY) return false
        Ptp.expectOk("Ler ajustes", r)
        val parsed = parseAllProps(r.data)
        if (parsed.isEmpty()) return false
        props = parsed
        propsFresh = true
        return true
    }

    fun hasPendingShot(): Boolean = propsFresh && (props[PROP_OBJECT_IN_MEMORY]?.current ?: 0L) > 0x8000

    /** Meio aperto (foco), disparo e soltura, como no botão da câmera. */
    fun capture() {
        press(PROP_AUTOFOCUS, 2)
        Thread.sleep(300)
        press(PROP_SHUTTER_BUTTON, 2)
        Thread.sleep(100)
        press(PROP_SHUTTER_BUTTON, 1)
        press(PROP_AUTOFOCUS, 1)
    }

    /** Anda um passo ([direction] = -1 ou +1) na lista de valores de um ajuste. */
    fun step(code: Int, direction: Int) {
        val prop = props[code] ?: throw PtpException("A câmera não informou esse ajuste", -1)
        val values = selectableValues(prop)
        if (values.size > 1) {
            var index = values.indexOf(prop.current)
            if (index < 0) index = values.indices.minBy { abs(values[it] - prop.current) }
            val next = (index + direction).coerceIn(0, values.lastIndex)
            if (next == index) return
            val r = ptp.transaction(OC_SET_CONTROL_A, intArrayOf(code), encode(prop.type, values[next]))
            Ptp.expectOk("Mudar ajuste", r)
        } else {
            // Sem lista: a câmera aceita "gire o disco um clique" (+1 / -1).
            val r = ptp.transaction(OC_SET_CONTROL_B, intArrayOf(code), encode(TYPE_UINT8, if (direction > 0) 0x01 else 0xFF))
            Ptp.expectOk("Mudar ajuste", r)
        }
        propsFresh = false
    }

    fun downloadShot(): Shot {
        propsFresh = false
        val info = Ptp.expectOk("Ler foto", ptp.transaction(Ptp.OC_GET_OBJECT_INFO, intArrayOf(HANDLE_SHOT)))
        // ObjectInfo: o nome do arquivo começa no byte 52.
        val name = runCatching { PtpReader(info.data, 52).string() }.getOrNull()
            ?.takeIf { it.isNotBlank() }
            ?: "DSC_${System.currentTimeMillis()}.JPG"
        val obj = Ptp.expectOk("Baixar foto", ptp.transaction(Ptp.OC_GET_OBJECT, intArrayOf(HANDLE_SHOT), timeoutMs = 20_000))
        return Shot(name, obj.data)
    }

    /** Um quadro do ao vivo, ou null se a câmera ainda não tem um. */
    fun liveViewFrame(): JpegRegion? {
        val r: PtpResponse = ptp.transaction(Ptp.OC_GET_OBJECT, intArrayOf(HANDLE_LIVE_VIEW))
        if (r.code == Ptp.RC_DEVICE_BUSY) return null
        Ptp.expectOk("Ao vivo", r)
        return findJpeg(r.data)
    }

    /** Destrava a conexão USB antes de uma nova tentativa. */
    fun recover() = ptp.recover()

    fun close() {
        runCatching { ptp.transaction(Ptp.OC_CLOSE_SESSION, timeoutMs = 1000) }
        ptp.close()
    }

    private fun press(code: Int, value: Int) {
        Ptp.expectOk("Disparar", ptp.transaction(OC_SET_CONTROL_B, intArrayOf(code), encode(TYPE_UINT16, value.toLong())))
    }

    private fun sdioConnect(phase: Int) {
        Ptp.expectOk("Conectar (etapa $phase)", ptp.transaction(OC_SDIO_CONNECT, intArrayOf(phase, 0, 0)))
    }

    private fun extDeviceInfo(): Int {
        for (version in intArrayOf(300, 200)) {
            val r = ptp.transaction(OC_SDIO_GET_EXT_DEVICE_INFO, intArrayOf(version))
            if (r.ok && r.data.size >= 2) return PtpReader(r.data).u16()
        }
        throw PtpException("A câmera não aceitou o modo PC Remoto da Sony")
    }

    companion object {
        const val OC_SDIO_CONNECT = 0x9201
        const val OC_SDIO_GET_EXT_DEVICE_INFO = 0x9202
        const val OC_SET_CONTROL_A = 0x9205
        const val OC_SET_CONTROL_B = 0x9207
        const val OC_GET_ALL_PROP_DATA = 0x9209

        const val PROP_WHITE_BALANCE = 0x5005
        const val PROP_F_NUMBER = 0x5007
        const val PROP_EXPOSURE_MODE = 0x500E
        const val PROP_EXPOSURE_COMP = 0x5010
        const val PROP_SHUTTER_SPEED = 0xD20D
        const val PROP_OBJECT_IN_MEMORY = 0xD215
        const val PROP_BATTERY = 0xD218
        const val PROP_ISO = 0xD21E
        const val PROP_AUTOFOCUS = 0xD2C1
        const val PROP_SHUTTER_BUTTON = 0xD2C2

        const val HANDLE_SHOT = 0xFFFFC001.toInt()
        const val HANDLE_LIVE_VIEW = 0xFFFFC002.toInt()

        private const val TYPE_UINT8 = 2
        private const val TYPE_UINT16 = 4
        private const val TYPE_STRING = 0xFFFF

        /**
         * As câmeras mais novas (protocolo 3) mandam duas listas de valores por ajuste, as antigas uma só.
         * Lê o pacote dos dois jeitos e fica com o que fecha certinho com a contagem declarada.
         */
        fun parseAllProps(data: ByteArray): Map<Int, SonyProp> {
            if (data.size <= 8) return emptyMap()
            val declared = PtpReader(data).u32().toInt()
            val attempts = listOf(parse(data, twoLists = false), parse(data, twoLists = true))
            return (attempts.firstOrNull { it.complete && it.props.size == declared }
                ?: attempts.firstOrNull { it.complete }
                ?: attempts.maxBy { it.props.size }).props
        }

        private class Parsed(val props: Map<Int, SonyProp>, val complete: Boolean)

        private fun parse(data: ByteArray, twoLists: Boolean): Parsed {
            val r = PtpReader(data, 8)
            val out = LinkedHashMap<Int, SonyProp>()
            return try {
                while (r.remaining > 0) {
                    val prop = readProp(r, twoLists)
                    out[prop.code] = prop
                }
                Parsed(out, true)
            } catch (e: IllegalStateException) {
                Parsed(out, false)
            }
        }

        private fun readProp(r: PtpReader, twoLists: Boolean): SonyProp {
            val code = r.u16()
            val type = r.u16()
            r.u8() // get/set
            val enabled = r.u8()
            readValue(r, type) // padrão de fábrica
            val current = readValue(r, type)
            val values = when (val form = r.u8()) {
                0 -> LongArray(0)
                1 -> {
                    repeat(3) { readValue(r, type) } // mínimo, máximo, passo
                    LongArray(0)
                }
                2 -> {
                    val first = LongArray(r.u16()) { readValue(r, type) }
                    if (twoLists) {
                        val second = LongArray(r.u16()) { readValue(r, type) }
                        if (first.isEmpty()) second else first
                    } else first
                }
                else -> throw IllegalStateException("Formato de ajuste desconhecido: $form")
            }
            return SonyProp(code, type, enabled, current, values)
        }

        private fun readValue(r: PtpReader, type: Int): Long = when (type) {
            1 -> r.u8().toByte().toLong()
            2 -> r.u8().toLong()
            3 -> r.u16().toShort().toLong()
            4 -> r.u16().toLong()
            5 -> r.u32().toInt().toLong()
            6 -> r.u32()
            7, 8 -> r.u64()
            9, 10 -> {
                r.skip(16)
                0L
            }
            TYPE_STRING -> {
                r.string()
                0L
            }
            else -> {
                if (type and 0x4000 == 0) throw IllegalStateException("Tipo de dado desconhecido: $type")
                val count = r.u32()
                if (count > r.remaining) throw IllegalStateException("Lista grande demais")
                repeat(count.toInt()) { readValue(r, type and 0x3FFF) }
                0L
            }
        }

        private fun encode(type: Int, value: Long): ByteArray {
            val size = when (type) {
                1, 2 -> 1
                3, 4 -> 2
                5, 6 -> 4
                else -> 8
            }
            val b = ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN).putLong(value).array()
            return b.copyOf(size)
        }

        private fun selectableValues(prop: SonyProp): LongArray = when (prop.code) {
            // ISO com redução de ruído multiquadro tem bits extras; esses ficam de fora.
            PROP_ISO -> prop.values.filter { (it shr 24) == 0L }.toLongArray()
            else -> prop.values
        }

        fun findJpeg(data: ByteArray): JpegRegion? {
            // Cabeçalho do ao vivo: deslocamento e tamanho do JPEG nos 8 primeiros bytes.
            if (data.size > 8) {
                val r = PtpReader(data)
                val offset = r.u32()
                val length = r.u32()
                if (offset in 8 until data.size && offset + length <= data.size && isSoi(data, offset.toInt())) {
                    return JpegRegion(data, offset.toInt(), length.toInt())
                }
            }
            val start = (0 until data.size - 1).firstOrNull { isSoi(data, it) } ?: return null
            var end = data.size
            for (i in data.size - 2 downTo start) {
                if (data[i] == 0xFF.toByte() && data[i + 1] == 0xD9.toByte()) {
                    end = i + 2
                    break
                }
            }
            return JpegRegion(data, start, end - start)
        }

        private fun isSoi(data: ByteArray, i: Int) =
            i + 1 < data.size && data[i] == 0xFF.toByte() && data[i + 1] == 0xD8.toByte()
    }
}

/** Texto para mostrar os valores na tela. */
object SonyFormat {
    fun value(code: Int, v: Long): String = when (code) {
        SonyCamera.PROP_SHUTTER_SPEED -> shutter(v)
        SonyCamera.PROP_F_NUMBER -> if (v <= 0 || v >= 0xFFFE) "—" else fNumber(v / 100.0)
        SonyCamera.PROP_ISO -> if ((v and 0xFFFFFF) == 0xFFFFFFL) "AUTO" else (v and 0xFFFFFF).toString()
        SonyCamera.PROP_EXPOSURE_COMP -> ev(v / 1000.0)
        SonyCamera.PROP_WHITE_BALANCE -> whiteBalance(v)
        SonyCamera.PROP_EXPOSURE_MODE -> exposureMode(v)
        SonyCamera.PROP_BATTERY -> if (v in 0..100) "$v%" else "—"
        else -> v.toString()
    }

    private fun shutter(v: Long): String {
        if (v == 0L) return "BULB"
        val num = (v shr 16) and 0xFFFF
        val den = v and 0xFFFF
        if (den == 0L) return "—"
        if (num == 1L && den > 1) return "1/$den"
        val seconds = num.toDouble() / den
        return if (seconds >= 10 || seconds == Math.floor(seconds)) "${seconds.toInt()}\""
        else String.format(Locale.US, "%.1f\"", seconds)
    }

    private fun fNumber(f: Double): String =
        if (f >= 10) "f/${Math.round(f)}" else String.format(Locale.US, "f/%.1f", f)

    private fun ev(e: Double): String = when {
        abs(e) < 0.05 -> "±0.0"
        else -> String.format(Locale.US, "%+.1f", e)
    }

    private fun whiteBalance(v: Long): String = when (v) {
        0x0002L -> "Auto"
        0x0004L -> "Luz do dia"
        0x8011L -> "Sombra"
        0x8010L -> "Nublado"
        0x0006L -> "Incandesc."
        0x8001L, 0x8002L, 0x8003L, 0x8004L, 0x0005L -> "Fluoresc."
        0x0007L -> "Flash"
        0x8012L -> "Temp. cor"
        0x8020L, 0x8021L, 0x8022L, 0x8023L -> "Personaliz."
        else -> "0x%04X".format(v)
    }

    private fun exposureMode(v: Long): String = when (v and 0xFFFF) {
        1L -> "M"
        2L -> "P"
        3L -> "A"
        4L -> "S"
        else -> if ((v and 0xFFFF) >= 0x8000) "Auto" else "?"
    }
}
