package com.phill.sonytether

import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.os.Build
import android.os.SystemClock
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
