package com.phill.sonytether

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbInterface
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import com.phill.sonytether.ptp.PtpException
import com.phill.sonytether.ptp.PtpUsb
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * Thread única que fala com a câmera: executa os comandos da tela, lê os ajustes,
 * baixa cada foto nova e, se ligado, puxa os quadros do ao vivo.
 * Todos os avisos para a tela chegam na thread principal.
 */
class CameraSession(
    private val context: Context,
    val device: UsbDevice,
    private val connection: UsbDeviceConnection,
    private val iface: UsbInterface,
    private val listener: Listener,
) : Thread("camera") {

    interface Listener {
        fun onStatus(text: String)
        fun onConnected(model: String)
        fun onProps(props: Map<Int, SonyProp>)
        fun onLiveFrame(frame: Bitmap)
        fun onLiveViewUnavailable()
        fun onPhoto(photo: SavedPhoto)
        fun onDisconnected(session: CameraSession, reason: String?)
    }

    @Volatile
    var liveView = false

    @Volatile
    private var running = true

    private val tasks = LinkedBlockingQueue<(SonyCamera) -> Unit>()
    private val main = Handler(Looper.getMainLooper())
    private val pendingFrame = AtomicReference<Bitmap?>(null)

    fun post(task: (SonyCamera) -> Unit) {
        tasks.offer(task)
    }

    fun shutdown() {
        running = false
        interrupt()
    }

    override fun run() {
        var reason: String? = null
        var camera: SonyCamera? = null
        try {
            camera = SonyCamera(PtpUsb(connection, iface))
            ui { listener.onStatus("Ativando o modo PC Remoto…") }
            camera.connect()
            val props = camera.props
            ui {
                listener.onConnected(device.productName ?: "Sony")
                listener.onProps(props)
            }
            loop(camera)
        } catch (e: InterruptedException) {
            // Encerrada pela tela.
        } catch (e: Exception) {
            if (running) reason = e.message ?: e.javaClass.simpleName
        } finally {
            if (camera != null) camera.close() else runCatching { connection.close() }
            main.post { listener.onDisconnected(this, reason) }
        }
    }

    private fun loop(camera: SonyCamera) {
        var lastPoll = 0L
        var liveFailures = 0
        while (running) {
            val task = if (liveView) tasks.poll() else tasks.poll(100, TimeUnit.MILLISECONDS)
            if (task != null) {
                runTask(camera, task)
                lastPoll = 0L
            }

            val now = SystemClock.elapsedRealtime()
            if (now - lastPoll >= POLL_MS) {
                lastPoll = now
                if (camera.refreshProps()) publishProps(camera)
                var downloads = 0
                while (running && camera.hasPendingShot() && downloads++ < 10) {
                    download(camera)
                    if (camera.refreshProps()) publishProps(camera) else break
                }
            }

            if (liveView) {
                try {
                    val jpeg = camera.liveViewFrame()
                    val frame = jpeg?.let { BitmapFactory.decodeByteArray(it.data, it.offset, it.length) }
                    if (frame != null) {
                        liveFailures = 0
                        showFrame(frame)
                    } else {
                        Thread.sleep(50)
                    }
                } catch (e: PtpException) {
                    if (e.code == 0) throw e
                    if (++liveFailures >= 20) {
                        liveView = false
                        ui { listener.onLiveViewUnavailable() }
                    } else {
                        Thread.sleep(100)
                    }
                }
            }
        }
    }

    private fun runTask(camera: SonyCamera, task: (SonyCamera) -> Unit) {
        try {
            task(camera)
        } catch (e: PtpException) {
            // Código 0 é falha do USB: derruba a sessão. Os outros são a câmera recusando o comando.
            if (e.code == 0) throw e
            val message = e.message ?: "A câmera recusou o comando"
            ui { listener.onStatus(message) }
        }
    }

    private fun download(camera: SonyCamera) {
        ui { listener.onStatus("Recebendo foto…") }
        val shot = camera.downloadShot()
        val uri = PhotoStore.save(context, shot.name, shot.data)
        val preview = PhotoStore.decodePreview(shot.data, PREVIEW_PX)
        val thumb = preview?.let { PhotoStore.thumbnail(it, THUMB_PX) }
        val photo = SavedPhoto(shot.name, uri, preview, thumb)
        val sizeMb = shot.data.size / 1_000_000.0
        ui {
            listener.onPhoto(photo)
            listener.onStatus(
                if (uri != null) "%s recebida (%.1f MB)".format(shot.name, sizeMb)
                else "${shot.name} recebida, mas não foi possível salvar"
            )
        }
    }

    private fun publishProps(camera: SonyCamera) {
        val props = camera.props
        ui { listener.onProps(props) }
    }

    /** Só um quadro por vez na fila da tela: se ela atrasar, os quadros velhos são trocados pelo mais novo. */
    private fun showFrame(frame: Bitmap) {
        if (pendingFrame.getAndSet(frame) == null) {
            main.post { pendingFrame.getAndSet(null)?.let(listener::onLiveFrame) }
        }
    }

    private fun ui(block: () -> Unit) {
        main.post { if (running) block() }
    }

    private companion object {
        const val POLL_MS = 400L
        const val PREVIEW_PX = 2048
        const val THUMB_PX = 160
    }
}
