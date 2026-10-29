package com.phill.sonytether.ptp

import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.os.SystemClock
import com.phill.sonytether.DiagLog
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** [code] é o código de resposta PTP; 0 quando a falha foi no próprio USB (cabo, câmera desligada). */
class PtpException(message: String, val code: Int = 0) : IOException(message)

class PtpResponse(val code: Int, val params: IntArray, val data: ByteArray) {
    val ok get() = code == Ptp.RC_OK
}

/** Evento que a câmera manda sozinha (pela porta de interrupção do USB). */
class PtpEvent(val code: Int, val params: IntArray)

object Ptp {
    const val OC_GET_DEVICE_INFO = 0x1001
    const val OC_OPEN_SESSION = 0x1002
    const val OC_CLOSE_SESSION = 0x1003
    const val OC_GET_OBJECT_INFO = 0x1008
    const val OC_GET_OBJECT = 0x1009

    const val RC_OK = 0x2001
    const val RC_DEVICE_BUSY = 0x2019
    const val RC_SESSION_ALREADY_OPEN = 0x201E

    const val EC_OBJECT_ADDED = 0x4002

    /** Formato "pasta" no ObjectInfo: não é foto. */
    const val FORMAT_ASSOCIATION = 0x3001

    const val VENDOR_NIKON = 0x0000000A
    const val VENDOR_CANON = 0x0000000B
    const val VENDOR_SONY = 0x00000011

    fun expectOk(what: String, response: PtpResponse): PtpResponse {
        if (!response.ok) throw PtpException("$what falhou (0x%04X)".format(response.code), response.code)
        return response
    }

    /** Abre a sessão PTP; se a câmera disser que já havia uma aberta, fecha e abre de novo. */
    fun openSession(ptp: PtpUsb) {
        ptp.restartTransactionIds()
        val open = ptp.transaction(OC_OPEN_SESSION, intArrayOf(1))
        if (open.code == RC_SESSION_ALREADY_OPEN) {
            ptp.transaction(OC_CLOSE_SESSION)
            ptp.restartTransactionIds()
            expectOk("Abrir sessão", ptp.transaction(OC_OPEN_SESSION, intArrayOf(1)))
        } else {
            expectOk("Abrir sessão", open)
        }
    }
}

/** O que a câmera diz de si mesma (GetDeviceInfo): fabricante, modelo e comandos que entende. */
class PtpDeviceInfo(
    val vendorExtension: Int,
    val manufacturer: String,
    val model: String,
    val version: String,
    val operations: Set<Int>,
    val events: Set<Int>,
) {
    fun supports(op: Int) = op in operations

    companion object {
        fun parse(data: ByteArray): PtpDeviceInfo {
            val r = PtpReader(data)
            r.u16() // versão do padrão
            val vendor = r.u32().toInt()
            r.u16() // versão da extensão
            r.string() // descrição da extensão
            r.u16() // modo funcional
            val ops = r.u16Array().toSet()
            val events = r.u16Array().toSet()
            r.u16Array() // propriedades
            r.u16Array() // formatos de captura
            r.u16Array() // formatos de imagem
            val manufacturer = r.string()
            val model = r.string()
            val version = runCatching { r.string() }.getOrDefault("")
            return PtpDeviceInfo(vendor, manufacturer, model, version, ops, events)
        }
    }
}

/** Partes do ObjectInfo que importam aqui: formato, tamanho e nome do arquivo. */
class PtpObjectInfo(val format: Int, val size: Long, val name: String) {
    val isFolder get() = format == Ptp.FORMAT_ASSOCIATION

    companion object {
        fun parse(data: ByteArray): PtpObjectInfo {
            val r = PtpReader(data)
            r.u32() // storage
            val format = r.u16()
            r.u16() // proteção
            val size = r.u32()
            // O nome do arquivo começa no byte 52.
            val name = runCatching { PtpReader(data, 52).string() }.getOrDefault("")
            return PtpObjectInfo(format, size, name)
        }
    }
}

/**
 * PTP sobre USB (classe Still Image): comando, fase de dados opcional e resposta,
 * uma transação por vez. Só deve ser usado por uma única thread.
 */
class PtpUsb(private val connection: UsbDeviceConnection, private val iface: UsbInterface) {

    private val bulkIn: UsbEndpoint
    private val bulkOut: UsbEndpoint

    /** Porta de eventos (interrupção); nem toda câmera tem. */
    private val interruptIn: UsbEndpoint?
    private val eventBuffer = ByteArray(64)
    private val chunk = ByteArray(CHUNK)
    private var transactionId = 0

    init {
        var inEp: UsbEndpoint? = null
        var outEp: UsbEndpoint? = null
        var intEp: UsbEndpoint? = null
        for (i in 0 until iface.endpointCount) {
            val ep = iface.getEndpoint(i)
            if (ep.type == UsbConstants.USB_ENDPOINT_XFER_INT && ep.direction == UsbConstants.USB_DIR_IN) intEp = ep
            if (ep.type != UsbConstants.USB_ENDPOINT_XFER_BULK) continue
            if (ep.direction == UsbConstants.USB_DIR_IN) inEp = ep else outEp = ep
        }
        interruptIn = intEp
        bulkIn = inEp ?: throw PtpException("A câmera não tem endpoint USB de entrada")
        bulkOut = outEp ?: throw PtpException("A câmera não tem endpoint USB de saída")
        if (!connection.claimInterface(iface, true)) throw PtpException("Não foi possível assumir a interface USB")
    }

    /** A próxima transação abre a sessão: pelo padrão PTP, ela usa o número 0. */
    fun restartTransactionIds() {
        transactionId = -1
    }

    /**
     * Destrava a conexão: pedido de reset do PTP, limpeza da trava (halt) das duas portas
     * e descarte de dados velhos que a câmera ainda tinha para mandar.
     */
    fun recover() {
        val reset = connection.controlTransfer(0x21, REQ_DEVICE_RESET, 0, iface.id, null, 0, 1000)
        val haltOut = clearHalt(bulkOut)
        val haltIn = clearHalt(bulkIn)
        var drained = 0
        for (i in 0 until 8) {
            val n = connection.bulkTransfer(bulkIn, chunk, chunk.size, 200)
            if (n <= 0) break
            drained += n
        }
        DiagLog.add("recuperar: reset=$reset halt(out)=$haltOut halt(in)=$haltIn descartados=$drained bytes, status=${deviceStatus()}")
    }

    /** Status do dispositivo (pedido de classe PTP 0x67): "0x2001" quando está pronto. */
    fun deviceStatus(): String {
        val buf = ByteArray(32)
        val n = connection.controlTransfer(0xA1, REQ_GET_DEVICE_STATUS, 0, iface.id, buf, buf.size, 1000)
        if (n < 4) return "indisponível ($n)"
        return "0x%04X".format((buf[2].toInt() and 0xFF) or ((buf[3].toInt() and 0xFF) shl 8))
    }

    private fun clearHalt(ep: UsbEndpoint) =
        connection.controlTransfer(0x02, REQ_CLEAR_FEATURE, FEATURE_ENDPOINT_HALT, ep.address, null, 0, 1000)

    fun transaction(
        op: Int,
        params: IntArray = IntArray(0),
        dataOut: ByteArray? = null,
        timeoutMs: Int = TIMEOUT_MS,
    ): PtpResponse {
        val tid = ++transactionId
        val name = "0x%04X(%s)".format(op, params.joinToString(",") { "0x%X".format(it) })
        try {
            val response = exchange(op, tid, params, dataOut, timeoutMs)
            // A leitura periódica dos ajustes, quando dá certo, fica fora do registro.
            if (!(response.ok && op in QUIET)) DiagLog.add("$name tid=$tid → 0x%04X, %d bytes".format(response.code, response.data.size))
            return response
        } catch (e: PtpException) {
            DiagLog.add("$name tid=$tid → ERRO: ${e.message}")
            throw e
        }
    }

    private fun exchange(op: Int, tid: Int, params: IntArray, dataOut: ByteArray?, timeoutMs: Int): PtpResponse {
        write(container(TYPE_COMMAND, op, tid, params, null), timeoutMs, "comando")
        if (dataOut != null) write(container(TYPE_DATA, op, tid, IntArray(0), dataOut), timeoutMs, "dados")

        var data = EMPTY
        while (true) {
            val n = readContainerStart(timeoutMs)
            val header = ByteBuffer.wrap(chunk, 0, n).order(ByteOrder.LITTLE_ENDIAN)
            val length = header.int.toLong() and 0xFFFFFFFFL
            val type = header.short.toInt() and 0xFFFF
            val code = header.short.toInt() and 0xFFFF
            val containerTid = header.int
            when (type) {
                TYPE_DATA -> data = readData(length, n, timeoutMs)
                TYPE_RESPONSE -> {
                    val count = ((minOf(length, n.toLong()) - HEADER) / 4).toInt().coerceIn(0, 5)
                    val responseParams = IntArray(count) { header.int }
                    // Uma resposta atrasada de outra transação é descartada.
                    if (containerTid != tid) continue
                    return PtpResponse(code, responseParams, data)
                }
            }
        }
    }

    val hasEvents get() = interruptIn != null

    /** Próximo evento da câmera, ou null se nada chegou em [timeoutMs]. */
    fun readEvent(timeoutMs: Int): PtpEvent? {
        val ep = interruptIn ?: return null
        val n = connection.bulkTransfer(ep, eventBuffer, eventBuffer.size, timeoutMs)
        if (n < HEADER) return null
        val b = ByteBuffer.wrap(eventBuffer, 0, n).order(ByteOrder.LITTLE_ENDIAN)
        val length = b.int
        val type = b.short.toInt() and 0xFFFF
        val code = b.short.toInt() and 0xFFFF
        b.int // transação
        if (type != TYPE_EVENT) return null
        val count = ((minOf(length, n) - HEADER) / 4).coerceIn(0, 3)
        val event = PtpEvent(code, IntArray(count) { b.int })
        DiagLog.add("evento 0x%04X(%s)".format(code, event.params.joinToString(",") { "0x%X".format(it) }))
        return event
    }

    fun close() {
        runCatching { connection.releaseInterface(iface) }
        connection.close()
    }

    private fun readContainerStart(timeoutMs: Int): Int {
        // Pacotes vazios (fim de uma fase de dados com tamanho múltiplo do pacote USB) são pulados.
        repeat(4) {
            val started = SystemClock.elapsedRealtime()
            val n = connection.bulkTransfer(bulkIn, chunk, chunk.size, timeoutMs)
            if (n < 0) throw PtpException("A câmera não respondeu pelo USB (${SystemClock.elapsedRealtime() - started} ms)")
            if (n >= HEADER) return n
            if (n > 0) throw PtpException("Pacote USB inválido ($n bytes)")
        }
        throw PtpException("A câmera parou de responder pelo USB")
    }

    private fun readData(length: Long, firstRead: Int, timeoutMs: Int): ByteArray {
        if (length < HEADER || length > Int.MAX_VALUE) throw PtpException("Arquivo grande demais ($length bytes)")
        val size = (length - HEADER).toInt()
        val out = ByteArray(size)
        val first = minOf(firstRead - HEADER, size)
        System.arraycopy(chunk, HEADER, out, 0, first)
        var got = first
        var emptyReads = 0
        while (got < size) {
            val n = connection.bulkTransfer(bulkIn, out, got, minOf(CHUNK, size - got), timeoutMs)
            if (n < 0) throw PtpException("A transferência pelo USB foi interrompida")
            if (n == 0 && ++emptyReads > 4) throw PtpException("A câmera parou de enviar dados")
            got += n
        }
        return out
    }

    private fun write(bytes: ByteArray, timeoutMs: Int, what: String) {
        var offset = 0
        while (offset < bytes.size) {
            val started = SystemClock.elapsedRealtime()
            val n = connection.bulkTransfer(bulkOut, bytes, offset, minOf(CHUNK, bytes.size - offset), timeoutMs)
            // Perto do tempo limite = a câmera não aceitou; bem rápido = a porta USB está travada.
            if (n < 0) throw PtpException("A câmera não aceitou o $what pelo USB (${SystemClock.elapsedRealtime() - started} ms)")
            offset += n
        }
        // Pacote vazio para fechar a transferência quando ela cai exatamente no limite do pacote USB.
        if (bytes.size % bulkOut.maxPacketSize == 0) connection.bulkTransfer(bulkOut, bytes, 0, 0, timeoutMs)
    }

    private fun container(type: Int, op: Int, tid: Int, params: IntArray, payload: ByteArray?): ByteArray {
        val length = HEADER + params.size * 4 + (payload?.size ?: 0)
        val buffer = ByteBuffer.allocate(length).order(ByteOrder.LITTLE_ENDIAN)
            .putInt(length)
            .putShort(type.toShort())
            .putShort(op.toShort())
            .putInt(tid)
        params.forEach { buffer.putInt(it) }
        payload?.let { buffer.put(it) }
        return buffer.array()
    }

    private companion object {
        const val HEADER = 12
        const val CHUNK = 256 * 1024
        const val TIMEOUT_MS = 5000
        const val TYPE_COMMAND = 1
        const val TYPE_DATA = 2
        const val TYPE_RESPONSE = 3
        const val TYPE_EVENT = 4
        /** Leituras periódicas (Sony, Canon, Nikon): quando dão certo, ficam fora do registro. */
        val QUIET = setOf(0x9209, 0x9116, 0x90C7, 0x941C)
        const val REQ_CLEAR_FEATURE = 0x01
        const val FEATURE_ENDPOINT_HALT = 0
        const val REQ_DEVICE_RESET = 0x66
        const val REQ_GET_DEVICE_STATUS = 0x67
        val EMPTY = ByteArray(0)
    }
}

/** Leitura little-endian dos pacotes de dados PTP. */
class PtpReader(private val data: ByteArray, var pos: Int = 0) {
    val remaining get() = data.size - pos

    fun u8(): Int {
        need(1)
        return data[pos++].toInt() and 0xFF
    }

    fun u16(): Int {
        need(2)
        val v = (data[pos].toInt() and 0xFF) or ((data[pos + 1].toInt() and 0xFF) shl 8)
        pos += 2
        return v
    }

    fun u32(): Long {
        val low = u16().toLong()
        return low or (u16().toLong() shl 16)
    }

    fun u64(): Long {
        val low = u32()
        return low or (u32() shl 32)
    }

    /** Lista PTP de números de 16 bits: quantidade (32 bits) e os valores. */
    fun u16Array(): IntArray {
        val n = u32()
        if (n * 2 > remaining) throw IllegalStateException("Lista PTP grande demais")
        return IntArray(n.toInt()) { u16() }
    }

    fun skip(n: Int) {
        need(n)
        pos += n
    }

    /** String PTP: 1 byte com o número de caracteres (com o terminador) e depois UTF-16LE. */
    fun string(): String {
        val chars = u8()
        if (chars == 0) return ""
        need(chars * 2)
        val s = String(data, pos, chars * 2, Charsets.UTF_16LE)
        pos += chars * 2
        return s.trimEnd('\u0000')
    }

    private fun need(n: Int) {
        if (n < 0 || pos + n > data.size) throw IllegalStateException("Pacote PTP terminou antes do esperado")
    }
}
