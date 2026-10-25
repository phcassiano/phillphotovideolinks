package com.phill.sonytether

import android.content.Context
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbInterface
import android.net.Uri
import android.os.Handler
import android.os.Looper
import com.phill.sonytether.ptp.PtpException
import com.phill.sonytether.ptp.PtpUsb

/**
 * Thread única que fala com a câmera: conecta no modo PC Remoto e baixa cada foto
 * nova assim que ela é tirada. Todos os avisos para a tela chegam na thread principal.
 */
class CameraSession(
    private val context: Context,
    val device: UsbDevice,
    private val connection: UsbDeviceConnection,
    private val iface: UsbInterface,
    private val listener: Listener,
    /** Nome e pasta de cada foto que chega, pelo nome que ela tem na câmera. */
    private val target: (String) -> ShotTarget,
) : Thread("camera") {

    interface Listener {
        fun onStatus(text: String)
        fun onConnected(model: String)

        /** Foto recebida e salva como veio da câmera ([original] é null se não deu para salvar). */
        fun onShot(target: ShotTarget, data: ByteArray, original: Uri?)
        fun onDisconnected(session: CameraSession, reason: String?)
    }

    @Volatile
    private var running = true

    private val main = Handler(Looper.getMainLooper())

    fun shutdown() {
        running = false
        interrupt()
    }

    override fun run() {
        var reason: String? = null
        var camera: SonyCamera? = null
        try {
            DiagLog.describe(device)
            DiagLog.add("usando a interface #${iface.id} (classe ${iface.interfaceClass})")
            camera = SonyCamera(PtpUsb(connection, iface))
            connectWithRetries(camera)
            ui { listener.onConnected(device.productName ?: "Sony") }
            loop(camera)
        } catch (e: InterruptedException) {
            // Encerrada pela tela.
        } catch (e: Exception) {
            if (running) reason = e.message ?: e.javaClass.simpleName
            DiagLog.add("sessão encerrada: ${e.javaClass.simpleName}: ${e.message}")
        } finally {
            if (camera != null) camera.close() else runCatching { connection.close() }
            main.post { listener.onDisconnected(this, reason) }
        }
    }

    /** A câmera pode estar presa numa conexão anterior ou ainda trocando de modo: destrava e tenta de novo. */
    private fun connectWithRetries(camera: SonyCamera) {
        for (attempt in 1..CONNECT_ATTEMPTS) {
            ui { listener.onStatus(if (attempt == 1) "Ativando o modo PC Remoto…" else "Tentando de novo ($attempt de $CONNECT_ATTEMPTS)…") }
            DiagLog.add("conectar: tentativa $attempt")
            if (attempt > 1) Thread.sleep(1500)
            camera.recover()
            try {
                camera.connect()
                DiagLog.add("conectado, protocolo ${camera.protocolVersion}, ${camera.props.size} ajustes")
                return
            } catch (e: PtpException) {
                if (attempt == CONNECT_ATTEMPTS || !running) throw e
            }
        }
    }

    private fun loop(camera: SonyCamera) {
        while (running) {
            Thread.sleep(POLL_MS)
            camera.refreshProps()
            var downloads = 0
            while (running && camera.hasPendingShot() && downloads++ < 10) {
                ui { listener.onStatus("Recebendo foto…") }
                val shot = camera.downloadShot()
                val to = target(shot.name)
                DiagLog.add("foto ${shot.name} → ${to.name}, ${shot.data.size} bytes")
                val uri = PhotoStore.saveOriginal(context, to.session.folder, to.name, shot.data)
                ui { listener.onShot(to, shot.data, uri) }
                if (!camera.refreshProps()) break
            }
        }
    }

    private fun ui(block: () -> Unit) {
        main.post { if (running) block() }
    }

    private companion object {
        const val CONNECT_ATTEMPTS = 3
        const val POLL_MS = 400L
    }
}
