package com.phill.sonytether

import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.util.concurrent.Executors

class MainActivity : Activity(), CameraSession.Listener {

    private lateinit var usb: UsbManager
    private var session: CameraSession? = null
    private val main = Handler(Looper.getMainLooper())
    private val loader = Executors.newSingleThreadExecutor()

    private lateinit var root: LinearLayout
    private lateinit var stage: FrameLayout
    private lateinit var panel: ScrollView
    private lateinit var image: ImageView
    private lateinit var hint: TextView
    private lateinit var badge: TextView
    private lateinit var thumbs: LinearLayout
    private lateinit var status: TextView
    private lateinit var connectButton: Button
    private lateinit var info: TextView
    private lateinit var liveButton: Button
    private lateinit var shutterButton: Button
    private lateinit var counter: TextView
    private val rows = LinkedHashMap<Int, SettingRow>()

    private var photoCount = 0
    private var liveOn = false
    private var reviewUntil = 0L

    private class SettingRow(val value: TextView, val buttons: List<Button>)

    private val usbReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val device = intent.usbDevice() ?: return
            when (intent.action) {
                ACTION_USB_PERMISSION ->
                    if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) open(device)
                    else setStatus("Acesso à câmera não autorizado.")
                UsbManager.ACTION_USB_DEVICE_DETACHED ->
                    if (device.deviceName == session?.device?.deviceName) session?.shutdown()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        usb = getSystemService(Context.USB_SERVICE) as UsbManager
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        buildUi()
        applyOrientation(resources.configuration)
        setConnected(false)

        val filter = IntentFilter().apply {
            addAction(ACTION_USB_PERMISSION)
            addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
        }
        // Antes do Android 13 a flag é ignorada; a partir dele, impede outros apps de mandar esses avisos.
        registerReceiver(usbReceiver, filter, Context.RECEIVER_NOT_EXPORTED)

        if (!handleUsbIntent(intent)) findCamera()?.takeIf { usb.hasPermission(it) }?.let(::open)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleUsbIntent(intent)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        applyOrientation(newConfig)
    }

    override fun onDestroy() {
        unregisterReceiver(usbReceiver)
        session?.shutdown()
        loader.shutdownNow()
        super.onDestroy()
    }

    // ---- Conexão USB ----

    private fun handleUsbIntent(intent: Intent?): Boolean {
        if (intent?.action != UsbManager.ACTION_USB_DEVICE_ATTACHED) return false
        val device = intent.usbDevice() ?: return false
        if (usb.hasPermission(device)) open(device) else requestPermission(device)
        return true
    }

    private fun connect() {
        val device = findCamera()
        if (device == null) {
            setStatus("Nenhuma câmera Sony encontrada. Ligue o cabo USB e coloque a câmera em PC Remoto.")
            return
        }
        if (usb.hasPermission(device)) open(device) else requestPermission(device)
    }

    private fun requestPermission(device: UsbDevice) {
        setStatus("Autorize o acesso à câmera na janela do Android.")
        val intent = Intent(ACTION_USB_PERMISSION).setPackage(packageName)
        val flags = PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        usb.requestPermission(device, PendingIntent.getBroadcast(this, 0, intent, flags))
    }

    private fun open(device: UsbDevice) {
        if (session != null) return
        val iface = ptpInterface(device)
        if (iface == null) {
            setStatus("A câmera não está no modo PC Remoto. Mude a Conexão USB para \"PC Remoto\" e conecte de novo.")
            return
        }
        val connection = usb.openDevice(device)
        if (connection == null) {
            setStatus("Não foi possível abrir a conexão USB.")
            return
        }
        setStatus("Conectando a ${device.productName ?: "câmera"}…")
        session = CameraSession(applicationContext, device, connection, iface, this).also {
            it.liveView = liveOn
            it.start()
        }
    }

    private fun findCamera(): UsbDevice? =
        usb.deviceList.values.firstOrNull { it.vendorId == SONY_VENDOR_ID && ptpInterface(it) != null }
            ?: usb.deviceList.values.firstOrNull { it.vendorId == SONY_VENDOR_ID }

    private fun ptpInterface(device: UsbDevice): UsbInterface? {
        val interfaces = (0 until device.interfaceCount).map { device.getInterface(it) }
        return interfaces.firstOrNull { it.interfaceClass == UsbConstants.USB_CLASS_STILL_IMAGE }
            ?: interfaces.firstOrNull { it.interfaceClass == UsbConstants.USB_CLASS_VENDOR_SPEC && it.endpointCount >= 3 }
    }

    // ---- Avisos da câmera ----

    override fun onStatus(text: String) = setStatus(text)

    override fun onConnected(model: String) {
        setConnected(true)
        setStatus("Conectada: $model. Dispare pelo tablet ou pela câmera, as fotos chegam aqui.")
        hint.text = if (photoCount == 0) "Pronto. Dispare para ver a primeira foto." else hint.text
    }

    override fun onProps(props: Map<Int, SonyProp>) {
        for ((code, row) in rows) {
            val prop = props[code]
            row.value.text = prop?.let { SonyFormat.value(code, it.current) } ?: "—"
            row.value.alpha = if (prop == null || prop.enabled == 1) 1f else 0.45f
        }
        val mode = props[SonyCamera.PROP_EXPOSURE_MODE]?.let { SonyFormat.value(it.code, it.current) } ?: "—"
        val battery = props[SonyCamera.PROP_BATTERY]?.let { SonyFormat.value(it.code, it.current) } ?: "—"
        info.text = "Modo $mode   ·   Bateria $battery"
    }

    override fun onLiveFrame(frame: Bitmap) {
        if (!liveOn || SystemClock.elapsedRealtime() < reviewUntil) return
        image.setImageBitmap(frame)
        hint.visibility = View.GONE
        badge.visibility = View.VISIBLE
    }

    override fun onLiveViewUnavailable() {
        setLive(false)
        setStatus("A câmera não enviou imagem ao vivo.")
    }

    override fun onPhoto(photo: SavedPhoto) {
        photoCount++
        counter.text = "$photoCount ${if (photoCount == 1) "foto" else "fotos"} nesta sessão\nSalvas em Imagens/SonyTether"
        photo.preview?.let { showPhoto(it, REVIEW_MS) }
        addThumb(photo)
    }

    override fun onDisconnected(session: CameraSession, reason: String?) {
        if (session !== this.session) return
        this.session = null
        setConnected(false)
        badge.visibility = View.GONE
        setStatus(reason?.let { "Desconectada: $it" } ?: "Câmera desconectada.")
    }

    // ---- Tela ----

    private fun setStatus(text: String) {
        status.text = text
    }

    private fun setConnected(connected: Boolean) {
        connectButton.visibility = if (connected) View.GONE else View.VISIBLE
        for (row in rows.values) row.buttons.forEach { it.isEnabled = connected }
        liveButton.isEnabled = connected
        shutterButton.isEnabled = connected
        shutterButton.alpha = if (connected) 1f else 0.4f
        if (!connected) {
            rows.values.forEach { it.value.text = "—" }
            info.text = ""
        }
    }

    private fun setLive(on: Boolean) {
        liveOn = on
        session?.liveView = on
        reviewUntil = 0L
        liveButton.text = if (on) "Parar ao vivo" else "Ver ao vivo"
        if (!on) badge.visibility = View.GONE
    }

    private fun showPhoto(bitmap: Bitmap, holdMs: Long) {
        image.setImageBitmap(bitmap)
        hint.visibility = View.GONE
        badge.visibility = View.GONE
        reviewUntil = SystemClock.elapsedRealtime() + holdMs
    }

    private fun addThumb(photo: SavedPhoto) {
        val thumb = photo.thumb ?: return
        val view = ImageView(this).apply {
            setImageBitmap(thumb)
            scaleType = ImageView.ScaleType.CENTER_CROP
            contentDescription = photo.name
            layoutParams = LinearLayout.LayoutParams(dp(72) * thumb.width / maxOf(1, thumb.height), dp(72)).apply {
                marginEnd = dp(6)
            }
            setOnClickListener { openInApp(photo) }
            setOnLongClickListener {
                openInGallery(photo)
                true
            }
        }
        thumbs.addView(view, 0)
    }

    private fun openInApp(photo: SavedPhoto) {
        val uri = photo.uri ?: return
        loader.execute {
            val bitmap = PhotoStore.load(this, uri, 2048)
            main.post { if (bitmap != null) showPhoto(bitmap, if (liveOn) PINNED_MS else 0L) }
        }
    }

    private fun openInGallery(photo: SavedPhoto) {
        val uri = photo.uri ?: return
        val intent = Intent(Intent.ACTION_VIEW).setDataAndType(uri, contentResolver.getType(uri) ?: "image/*")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        runCatching { startActivity(intent) }.onFailure {
            Toast.makeText(this, "Nenhum app abre esse arquivo", Toast.LENGTH_SHORT).show()
        }
    }

    private fun buildUi() {
        image = ImageView(this).apply {
            scaleType = ImageView.ScaleType.FIT_CENTER
            setBackgroundColor(Color.BLACK)
        }
        hint = label("Conecte a câmera Sony pelo cabo USB", 18f, MUTED).apply { gravity = Gravity.CENTER }
        badge = label("●  AO VIVO", 13f, Color.WHITE).apply {
            typeface = Typeface.DEFAULT_BOLD
            background = rounded(0xCCD32F2F.toInt(), dp(4))
            setPadding(dp(10), dp(4), dp(10), dp(4))
            visibility = View.GONE
        }
        thumbs = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(8), dp(8), dp(8), dp(8))
        }
        val strip = HorizontalScrollView(this).apply {
            setBackgroundColor(0xAA000000.toInt())
            addView(thumbs)
        }

        stage = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
            addView(image, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
            addView(hint, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
            addView(badge, FrameLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT, Gravity.TOP or Gravity.START).apply {
                setMargins(dp(16), dp(16), 0, 0)
            })
            addView(strip, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.BOTTOM))
        }

        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(20), dp(20), dp(20))
        }
        column.addView(label("Sony Tether", 22f, Color.WHITE).apply { typeface = Typeface.DEFAULT_BOLD })
        status = label("", 14f, MUTED).apply { setPadding(0, dp(6), 0, dp(12)) }
        column.addView(status)
        connectButton = button("Conectar câmera", ACCENT, Color.BLACK) { connect() }
        column.addView(connectButton, fullWidth(dp(48)))
        info = label("", 14f, Color.WHITE).apply { setPadding(0, dp(12), 0, dp(4)) }
        column.addView(info)

        addSetting(column, "Velocidade", SonyCamera.PROP_SHUTTER_SPEED)
        addSetting(column, "Abertura", SonyCamera.PROP_F_NUMBER)
        addSetting(column, "ISO", SonyCamera.PROP_ISO)
        addSetting(column, "Exposição (EV)", SonyCamera.PROP_EXPOSURE_COMP)
        addSetting(column, "Balanço de branco", SonyCamera.PROP_WHITE_BALANCE)

        liveButton = button("Ver ao vivo", SURFACE, Color.WHITE) { setLive(!liveOn) }
        column.addView(liveButton, fullWidth(dp(48)).apply { topMargin = dp(16) })

        shutterButton = Button(this).apply {
            text = "DISPARAR"
            setTextColor(Color.WHITE)
            textSize = 16f
            typeface = Typeface.DEFAULT_BOLD
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(0xFFD32F2F.toInt())
                setStroke(dp(4), Color.WHITE)
            }
            setOnClickListener {
                setStatus("Disparando…")
                session?.post { it.capture() }
            }
        }
        column.addView(shutterButton, LinearLayout.LayoutParams(dp(120), dp(120)).apply {
            gravity = Gravity.CENTER_HORIZONTAL
            topMargin = dp(20)
        })

        counter = label("Nenhuma foto ainda", 13f, MUTED).apply {
            gravity = Gravity.CENTER
            setPadding(0, dp(16), 0, 0)
        }
        column.addView(counter, fullWidth(WRAP_CONTENT))
        column.addView(label("Toque numa miniatura para rever · segure para abrir na galeria", 12f, MUTED).apply {
            gravity = Gravity.CENTER
            setPadding(0, dp(8), 0, 0)
        }, fullWidth(WRAP_CONTENT))

        panel = ScrollView(this).apply {
            setBackgroundColor(PANEL)
            addView(column)
        }
        root = LinearLayout(this).apply {
            setBackgroundColor(PANEL)
            addView(stage)
            addView(panel)
        }
        setContentView(root)
    }

    private fun applyOrientation(config: Configuration) {
        if (config.orientation == Configuration.ORIENTATION_PORTRAIT) {
            root.orientation = LinearLayout.VERTICAL
            stage.layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, 0, 1.2f)
            panel.layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, 0, 1f)
        } else {
            root.orientation = LinearLayout.HORIZONTAL
            stage.layoutParams = LinearLayout.LayoutParams(0, MATCH_PARENT, 1f)
            panel.layoutParams = LinearLayout.LayoutParams(dp(340), MATCH_PARENT)
        }
    }

    private fun addSetting(column: LinearLayout, title: String, code: Int) {
        column.addView(label(title, 12f, MUTED).apply { setPadding(0, dp(12), 0, dp(2)) })
        val value = label("—", 20f, Color.WHITE).apply { typeface = Typeface.DEFAULT_BOLD }
        val minus = button("◀", SURFACE, Color.WHITE) { session?.post { it.step(code, -1) } }
        val plus = button("▶", SURFACE, Color.WHITE) { session?.post { it.step(code, +1) } }
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(value, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
            addView(minus, LinearLayout.LayoutParams(dp(56), dp(44)).apply { marginEnd = dp(8) })
            addView(plus, LinearLayout.LayoutParams(dp(56), dp(44)))
        }
        column.addView(row, fullWidth(WRAP_CONTENT))
        rows[code] = SettingRow(value, listOf(minus, plus))
    }

    private fun label(text: String, sp: Float, color: Int) = TextView(this).apply {
        this.text = text
        setTextColor(color)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
    }

    private fun button(text: String, background: Int, textColor: Int, onClick: () -> Unit) = Button(this).apply {
        this.text = text
        isAllCaps = false
        setTextColor(textColor)
        textSize = 15f
        this.background = rounded(background, dp(10))
        stateListAnimator = null
        setOnClickListener { onClick() }
    }

    private fun rounded(color: Int, radius: Int) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = radius.toFloat()
    }

    private fun fullWidth(height: Int) = LinearLayout.LayoutParams(MATCH_PARENT, height)

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    @Suppress("DEPRECATION")
    private fun Intent.usbDevice(): UsbDevice? =
        if (Build.VERSION.SDK_INT >= 33) getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
        else getParcelableExtra(UsbManager.EXTRA_DEVICE)

    private companion object {
        const val ACTION_USB_PERMISSION = "com.phill.sonytether.USB_PERMISSION"
        const val SONY_VENDOR_ID = 0x054C
        const val REVIEW_MS = 3000L
        const val PINNED_MS = 8000L
        const val PANEL = 0xFF16161A.toInt()
        const val SURFACE = 0xFF2A2A31.toInt()
        const val ACCENT = 0xFFE8A33D.toInt()
        const val MUTED = 0xFF9A9AA5.toInt()
    }
}
