package com.phill.sonytether

import com.phill.sonytether.ptp.Ptp
import com.phill.sonytether.ptp.PtpException
import com.phill.sonytether.ptp.PtpReader
import com.phill.sonytether.ptp.PtpUsb

/** Uma propriedade da câmera, como vem no pacote GetAllDevicePropData. */
class SonyProp(
    val code: Int,
    val type: Int,
    val enabled: Int,
    val current: Long,
    /** Valores que a câmera aceita para esse ajuste. */
    val values: LongArray,
)

class Shot(val name: String, val data: ByteArray)

/**
 * Câmera Sony no modo "PC Remoto", pelo protocolo PTP com as extensões SDIO da Sony
 * (as mesmas que o Imaging Edge e o libgphoto2 usam). O app só recebe as fotos:
 * a cada disparo na câmera, a foto fica esperando no objeto 0xFFFFC001.
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

    /** Destrava a conexão USB antes de uma nova tentativa. */
    fun recover() = ptp.recover()

    fun close() {
        runCatching { ptp.transaction(Ptp.OC_CLOSE_SESSION, timeoutMs = 1000) }
        ptp.close()
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
        const val OC_GET_ALL_PROP_DATA = 0x9209

        const val PROP_OBJECT_IN_MEMORY = 0xD215

        const val HANDLE_SHOT = 0xFFFFC001.toInt()

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
    }
}
