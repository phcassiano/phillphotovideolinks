package com.phill.sonytether

import com.phill.sonytether.ptp.Ptp
import com.phill.sonytether.ptp.PtpDeviceInfo
import com.phill.sonytether.ptp.PtpEvent
import com.phill.sonytether.ptp.PtpException
import com.phill.sonytether.ptp.PtpObjectInfo
import com.phill.sonytether.ptp.PtpReader
import com.phill.sonytether.ptp.PtpUsb

/**
 * O que muda de uma marca para outra: como ligar o modo "conectado ao computador" e como
 * saber que uma foto nova foi tirada. Todo o resto (USB, PTP, presets, galeria) é o mesmo.
 */
interface CameraDriver {
    /** "Sony", "Canon EOS", "Nikon"… para mostrar e registrar. */
    val brand: String

    fun connect()

    /** Fotos novas desde a última chamada (a sessão chama umas duas vezes por segundo). */
    fun poll(): List<Shot>

    /** Destrava a conexão USB antes de uma nova tentativa. */
    fun recover()

    fun close()

    /** Linha para o Diagnóstico depois de conectar. */
    fun describe(): String
}

object Cameras {
    const val VENDOR_SONY = 0x054C
    const val VENDOR_CANON = 0x04A9
    const val VENDOR_NIKON = 0x04B0
    val VENDORS = setOf(VENDOR_SONY, VENDOR_CANON, VENDOR_NIKON)

    /**
     * Escolhe o driver: Sony pelo fabricante do USB; as outras pelo que a câmera diz de si
     * (GetDeviceInfo funciona antes de abrir a sessão).
     */
    fun create(usbVendor: Int, ptp: PtpUsb): CameraDriver {
        if (usbVendor == VENDOR_SONY) return SonyCamera(ptp)
        val info = runCatching {
            PtpDeviceInfo.parse(Ptp.expectOk("Identificar câmera", ptp.transaction(Ptp.OC_GET_DEVICE_INFO)).data)
        }.getOrNull()
        DiagLog.add(info?.let { "câmera: ${it.manufacturer} ${it.model} (${it.version}), extensão 0x%X, ${it.operations.size} comandos".format(it.vendorExtension) } ?: "câmera sem DeviceInfo")
        return when {
            info != null && info.supports(CanonCamera.OC_GET_EVENT) -> CanonCamera(ptp, info)
            usbVendor == VENDOR_NIKON || info?.vendorExtension == Ptp.VENDOR_NIKON -> NikonCamera(ptp, info)
            else -> GenericPtpCamera(ptp, info)
        }
    }
}

/**
 * Qualquer câmera PTP que avise "objeto novo" pela porta de eventos do USB (o padrão):
 * baixa cada foto que aparece no cartão. A Nikon usa esta base com os comandos dela.
 */
open class GenericPtpCamera(protected val ptp: PtpUsb, protected val info: PtpDeviceInfo?) : CameraDriver {
    override val brand get() = info?.manufacturer?.ifBlank { null } ?: "Câmera PTP"

    /** Fotos já baixadas nesta conexão (a câmera pode avisar a mesma duas vezes). */
    private val seen = HashSet<Int>()

    override fun connect() {
        Ptp.openSession(ptp)
        if (!ptp.hasEvents) DiagLog.add("aviso: a câmera não tem porta de eventos")
    }

    /** Números dos objetos novos. */
    protected open fun newObjects(): List<Int> {
        val out = ArrayList<Int>()
        // Lê o que estiver na fila; a espera curta deixa o laço da sessão no ritmo dele.
        for (i in 0 until 16) {
            val e = ptp.readEvent(if (i == 0) 150 else 20) ?: break
            handles(e)?.let(out::addAll)
        }
        return out
    }

    protected open fun handles(e: PtpEvent): List<Int>? =
        if (e.code == Ptp.EC_OBJECT_ADDED && e.params.isNotEmpty()) listOf(e.params[0]) else null

    // O número da memória interna da Nikon se repete a cada foto: não entra na lista de já baixadas.
    override fun poll(): List<Shot> = newObjects().filter { it == NikonCamera.HANDLE_SDRAM || seen.add(it) }.mapNotNull(::download)

    protected open fun download(handle: Int): Shot? {
        val r = ptp.transaction(Ptp.OC_GET_OBJECT_INFO, intArrayOf(handle))
        if (!r.ok) return null
        val obj = PtpObjectInfo.parse(r.data)
        if (obj.isFolder || !isPhoto(obj.name)) return null
        val data = Ptp.expectOk("Baixar foto", ptp.transaction(Ptp.OC_GET_OBJECT, intArrayOf(handle), timeoutMs = DOWNLOAD_TIMEOUT)).data
        return Shot(obj.name.ifBlank { "IMG_${System.currentTimeMillis()}.JPG" }, data)
    }

    override fun recover() = ptp.recover()

    override fun close() {
        runCatching { ptp.transaction(Ptp.OC_CLOSE_SESSION, timeoutMs = 1000) }
        ptp.close()
    }

    override fun describe() = "$brand ${info?.model.orEmpty()}, eventos USB: ${if (ptp.hasEvents) "sim" else "não"}"

    companion object {
        const val DOWNLOAD_TIMEOUT = 60_000

        /** Só fotos: vídeos e arquivos auxiliares (.XMP, .THM) ficam no cartão. */
        fun isPhoto(name: String) = name.substringAfterLast('.', "").lowercase() in PHOTO_EXTENSIONS || name.isBlank()

        val PHOTO_EXTENSIONS = setOf("jpg", "jpeg", "arw", "srf", "sr2", "cr2", "cr3", "crw", "nef", "nrw", "dng", "hif", "heif", "heic", "tif", "tiff")
    }
}

/**
 * Nikon (D500, D850, D780, Z5/Z6/Z7 e versões II/III, Z8, Z9, Zf, Z50…): as fotos tiradas
 * no corpo da câmera aparecem como "objeto novo". A Nikon tem dois comandos para buscar
 * os avisos (GetEventEx nos modelos novos, CheckEvent nos anteriores); sem eles, usa a porta
 * de eventos do USB, como qualquer câmera PTP.
 */
class NikonCamera(ptp: PtpUsb, info: PtpDeviceInfo?) : GenericPtpCamera(ptp, info) {
    override val brand get() = "Nikon"

    override fun newObjects(): List<Int> {
        val op = when {
            info?.supports(OC_GET_EVENT_EX) == true -> OC_GET_EVENT_EX
            info?.supports(OC_CHECK_EVENT) == true -> OC_CHECK_EVENT
            else -> return super.newObjects()
        }
        val r = ptp.transaction(op)
        if (!r.ok) return if (r.code == Ptp.RC_DEVICE_BUSY) emptyList() else super.newObjects()
        val events = if (op == OC_GET_EVENT_EX) parseEventEx(r.data) else parseCheckEvent(r.data)
        return events.flatMap { handles(it).orEmpty() }
    }

    override fun handles(e: PtpEvent): List<Int>? = when {
        e.code == EC_OBJECT_ADDED_IN_SDRAM -> listOf(HANDLE_SDRAM)
        else -> super.handles(e)
    }

    override fun describe() = "Nikon ${info?.model.orEmpty()}, avisos por " + when {
        info?.supports(OC_GET_EVENT_EX) == true -> "GetEventEx"
        info?.supports(OC_CHECK_EVENT) == true -> "CheckEvent"
        else -> "porta de eventos USB"
    }

    companion object {
        const val OC_CHECK_EVENT = 0x90C7
        const val OC_GET_EVENT_EX = 0x941C

        /** Foto que ficou só na memória da câmera (gravação "no computador"). */
        const val EC_OBJECT_ADDED_IN_SDRAM = 0xC101
        const val HANDLE_SDRAM = 0xFFFF0001.toInt()

        /** CheckEvent: quantidade (16 bits) e, para cada aviso, código (16) e um parâmetro (32). */
        fun parseCheckEvent(data: ByteArray): List<PtpEvent> = runCatching {
            val r = PtpReader(data)
            List(r.u16()) { PtpEvent(r.u16(), intArrayOf(r.u32().toInt())) }
        }.getOrDefault(emptyList())

        /** GetEventEx: quantidade (16 bits) e, para cada aviso, código, número de parâmetros e os parâmetros. */
        fun parseEventEx(data: ByteArray): List<PtpEvent> = runCatching {
            val r = PtpReader(data)
            List(r.u16()) {
                val code = r.u16()
                val n = r.u16()
                PtpEvent(code, IntArray(n) { r.u32().toInt() })
            }
        }.getOrDefault(emptyList())
    }
}

/**
 * Canon EOS (DSLR e mirrorless R/M de 2015 para cá: 5D IV, 6D II, 80D/90D, R, RP, R5, R6, R7,
 * R8, R10, R50…): liga o modo remoto da Canon e pergunta à câmera, várias vezes por segundo,
 * se há avisos. Cada foto gravada no cartão chega como "objeto novo"; depois de baixar,
 * avisa que a transferência terminou.
 */
class CanonCamera(private val ptp: PtpUsb, private val info: PtpDeviceInfo?) : CameraDriver {
    override val brand get() = "Canon EOS"

    private val seen = HashSet<Int>()

    override fun connect() {
        Ptp.openSession(ptp)
        // Alguns modelos recusam um dos dois e funcionam assim mesmo: só o GetEvent decide.
        val remote = ptp.transaction(OC_SET_REMOTE_MODE, intArrayOf(1))
        val events = ptp.transaction(OC_SET_EVENT_MODE, intArrayOf(1))
        if (!remote.ok || !events.ok) DiagLog.add("Canon: modo remoto 0x%04X, avisos 0x%04X".format(remote.code, events.code))
        // A primeira leitura traz o estado inteiro da câmera (centenas de ajustes): descarta.
        Ptp.expectOk("Avisos da Canon", ptp.transaction(OC_GET_EVENT))
    }

    override fun poll(): List<Shot> {
        val r = ptp.transaction(OC_GET_EVENT)
        if (!r.ok) {
            if (r.code == Ptp.RC_DEVICE_BUSY) return emptyList()
            Ptp.expectOk("Ler avisos da Canon", r)
        }
        return parseEvents(r.data).filter { seen.add(it.handle) }.mapNotNull(::download)
    }

    private fun download(obj: NewObject): Shot? {
        if (obj.format == Ptp.FORMAT_ASSOCIATION) return null
        var name = obj.name
        if (name.isBlank()) {
            val r = ptp.transaction(Ptp.OC_GET_OBJECT_INFO, intArrayOf(obj.handle))
            if (r.ok) name = PtpObjectInfo.parse(r.data).name
        }
        if (!GenericPtpCamera.isPhoto(name)) return null
        val r = ptp.transaction(Ptp.OC_GET_OBJECT, intArrayOf(obj.handle), timeoutMs = GenericPtpCamera.DOWNLOAD_TIMEOUT)
        val data = if (r.ok) r.data else partial(obj) ?: Ptp.expectOk("Baixar foto", r).data
        runCatching { ptp.transaction(OC_TRANSFER_COMPLETE, intArrayOf(obj.handle)) }
        return Shot(name.ifBlank { "IMG_${System.currentTimeMillis()}.JPG" }, data)
    }

    /** Plano B de alguns modelos: baixar em pedaços com o comando da Canon. */
    private fun partial(obj: NewObject): ByteArray? {
        if (obj.size <= 0 || obj.size > Int.MAX_VALUE) return null
        val out = ByteArray(obj.size.toInt())
        var offset = 0
        while (offset < out.size) {
            val want = minOf(PART, out.size - offset)
            val r = ptp.transaction(OC_GET_PARTIAL_OBJECT, intArrayOf(obj.handle, offset, want), timeoutMs = GenericPtpCamera.DOWNLOAD_TIMEOUT)
            if (!r.ok || r.data.isEmpty()) return null
            r.data.copyInto(out, offset, 0, minOf(r.data.size, out.size - offset))
            offset += r.data.size
        }
        return out
    }

    override fun recover() = ptp.recover()

    override fun close() {
        runCatching { ptp.transaction(OC_SET_EVENT_MODE, intArrayOf(0), timeoutMs = 1000) }
        runCatching { ptp.transaction(OC_SET_REMOTE_MODE, intArrayOf(0), timeoutMs = 1000) }
        runCatching { ptp.transaction(Ptp.OC_CLOSE_SESSION, timeoutMs = 1000) }
        ptp.close()
    }

    override fun describe() = "Canon ${info?.model.orEmpty()} (${info?.version.orEmpty()})"

    class NewObject(val handle: Int, val format: Int, val size: Long, val name: String)

    companion object {
        const val OC_GET_PARTIAL_OBJECT = 0x9107
        const val OC_SET_REMOTE_MODE = 0x9114
        const val OC_SET_EVENT_MODE = 0x9115
        const val OC_GET_EVENT = 0x9116
        const val OC_TRANSFER_COMPLETE = 0x9117

        const val EC_OBJECT_ADDED_EX = 0xC181
        const val EC_REQUEST_OBJECT_TRANSFER = 0xC186
        const val EC_OBJECT_ADDED_EX64 = 0xC1A7

        private const val PART = 1024 * 1024

        /**
         * GetEvent devolve vários registros seguidos: tamanho (32 bits), tipo (32) e o conteúdo.
         * Nos de "objeto novo": número do objeto em +8, formato em +16, tamanho em +28 e o nome
         * em +40 (+44 na versão de 64 bits). Um registro de 8 bytes com tipo 0 encerra a lista.
         */
        fun parseEvents(data: ByteArray): List<NewObject> {
            val out = ArrayList<NewObject>()
            var pos = 0
            while (pos + 8 <= data.size) {
                val r = PtpReader(data, pos)
                val size = r.u32().toInt()
                val type = r.u32().toInt()
                if (size < 8 || pos + size > data.size) break
                if (type == 0 && size == 8) break
                when (type) {
                    EC_OBJECT_ADDED_EX, EC_OBJECT_ADDED_EX64 -> runCatching {
                        val wide = type == EC_OBJECT_ADDED_EX64
                        val handle = PtpReader(data, pos + 8).u32().toInt()
                        val format = PtpReader(data, pos + 16).u16()
                        val length = if (wide) PtpReader(data, pos + 28).u64() else PtpReader(data, pos + 28).u32()
                        val name = ascii(data, pos + if (wide) 44 else 40, pos + size)
                        out += NewObject(handle, format, length, name)
                    }
                    EC_REQUEST_OBJECT_TRANSFER -> runCatching {
                        out += NewObject(PtpReader(data, pos + 8).u32().toInt(), 0, 0, "")
                    }
                }
                pos += size
            }
            return out
        }

        private fun ascii(data: ByteArray, from: Int, end: Int): String {
            if (from >= end) return ""
            var to = from
            while (to < end && data[to] != 0.toByte()) to++
            return String(data, from, to - from, Charsets.US_ASCII).trim()
        }
    }
}
