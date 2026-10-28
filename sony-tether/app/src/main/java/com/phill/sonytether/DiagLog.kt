package com.phill.sonytether

import android.content.Context
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.os.Build
import android.os.SystemClock
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.util.ArrayDeque
import java.util.Locale

/** Registro do que aconteceu com a câmera, para copiar e mandar quando algo falha. */
object DiagLog {
    private const val MAX_LINES = 400
    private val lines = ArrayDeque<String>()
    private val start = SystemClock.elapsedRealtime()

    @Synchronized
    fun add(text: String) {
        val t = (SystemClock.elapsedRealtime() - start) / 1000.0
        lines.addLast(String.format(Locale.US, "%8.2f  %s", t, text))
        while (lines.size > MAX_LINES) lines.removeFirst()
    }

    /**
     * Guarda o erro de um fechamento inesperado num arquivo; na próxima abertura ele entra no
     * Diagnóstico, para dar para mandar e corrigir.
     */
    fun install(context: Context) {
        val file = File(context.filesDir, "ultimo-erro.txt")
        if (file.exists()) {
            val previous = runCatching { file.readText() }.getOrDefault("")
            file.delete()
            if (previous.isNotBlank()) {
                add("O APP FECHOU NA ÚLTIMA VEZ:")
                previous.lineSequence().take(40).forEach { add("  $it") }
            }
        }
        val next = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            runCatching {
                val trace = StringWriter().also { error.printStackTrace(PrintWriter(it)) }.toString()
                file.writeText("Revela ${BuildConfig.VERSION_NAME} · thread ${thread.name}\n" + trace.take(6000) + "\n--- antes do erro ---\n" + text().lines().takeLast(25).joinToString("\n"))
            }
            next?.uncaughtException(thread, error)
        }
    }

    @Synchronized
    fun text(): String = buildString {
        appendLine("Revela ${BuildConfig.VERSION_NAME} · Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT}) · ${Build.MANUFACTURER} ${Build.MODEL}")
        lines.forEach { appendLine(it) }
    }

    fun describe(device: UsbDevice) {
        add(
            "USB %04X:%04X \"%s\" \"%s\" interfaces=%d".format(
                device.vendorId, device.productId, device.manufacturerName, device.productName, device.interfaceCount
            )
        )
        for (i in 0 until device.interfaceCount) {
            val iface = device.getInterface(i)
            val endpoints = (0 until iface.endpointCount).joinToString(" ") {
                val ep = iface.getEndpoint(it)
                val dir = if (ep.direction == UsbConstants.USB_DIR_IN) "in" else "out"
                val type = when (ep.type) {
                    UsbConstants.USB_ENDPOINT_XFER_BULK -> "bulk"
                    UsbConstants.USB_ENDPOINT_XFER_INT -> "int"
                    UsbConstants.USB_ENDPOINT_XFER_ISOC -> "isoc"
                    else -> "ctrl"
                }
                "0x%02X/%s-%s/%d".format(ep.address, type, dir, ep.maxPacketSize)
            }
            add("  if#%d alt=%d classe=%d/%d/%d  %s".format(iface.id, iface.alternateSetting, iface.interfaceClass, iface.interfaceSubclass, iface.interfaceProtocol, endpoints))
        }
    }
}
