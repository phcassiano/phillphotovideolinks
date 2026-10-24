package com.phill.sonytether

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ClipData
import android.content.ClipboardManager
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
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.OpenableColumns
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
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
import android.widget.SeekBar
import android.widget.TextView
import android.widget.Toast
import java.util.concurrent.Executors

class MainActivity : Activity(), CameraSession.Listener {

    private lateinit var usb: UsbManager
    private lateinit var library: PresetLibrary
    private var session: CameraSession? = null
    private val main = Handler(Looper.getMainLooper())

    /** Decodificar, aplicar preset e salvar: uma foto por vez, fora da thread da tela. */
    private val processor = Executors.newSingleThreadExecutor()

    private lateinit var root: LinearLayout
    private lateinit var stage: FrameLayout
    private lateinit var panel: ScrollView
    private lateinit var image: ImageView
    private lateinit var hint: TextView
    private lateinit var badge: TextView
    private lateinit var thumbs: LinearLayout
    private lateinit var status: TextView
    private lateinit var connectButton: Button
    private lateinit var presetButton: Button
    private lateinit var amountLabel: TextView
    private lateinit var amountBar: SeekBar
    private lateinit var presetNote: TextView
    private lateinit var shareButton: Button
    private lateinit var shareAllButton: Button
    private lateinit var counter: TextView

    private class Photo(var name: String, var original: Uri?, val thumb: ImageView) {
        @Volatile
        var edited: Uri? = null

        /** Preset e intensidade com que [edited] foi gerado. */
        @Volatile
        var editedWith: String? = null

        val base get() = name.substringBeforeLast('.')
        val isRaw get() = PhotoStore.isRaw(name)
    }

    private val photos = ArrayList<Photo>()
    private var current: Photo? = null
    private var currentOriginal: Bitmap? = null
    private var currentShown: Bitmap? = null
    private var look: PresetLook? = null

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
        library = PresetLibrary(this)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        buildUi()
        applyOrientation(resources.configuration)
        setConnected(false)
        presetChanged(rerender = false)

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
        processor.shutdownNow()
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
            DiagLog.describe(device)
            DiagLog.add("nenhuma interface PTP")
            setStatus("A câmera não está no modo PC Remoto. Mude a Conexão USB para \"PC Remoto\" e conecte de novo.")
            return
        }
        val connection = usb.openDevice(device)
        if (connection == null) {
            setStatus("Não foi possível abrir a conexão USB.")
            return
        }
        setStatus("Conectando a ${device.productName ?: "câmera"}…")
        session = CameraSession(applicationContext, device, connection, iface, this).also { it.start() }
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
        setStatus("Conectada: $model. Fotografe na câmera: cada foto aparece aqui.")
        if (photos.isEmpty()) hint.text = "Pronto. Dispare na câmera para ver a primeira foto."
    }

    override fun onShot(name: String, data: ByteArray, original: Uri?) {
        // No modo RAW+JPEG chegam dois arquivos da mesma foto: fica um só na tela, de preferência o JPEG.
        val twin = photos.firstOrNull { it.base.equals(name.substringBeforeLast('.'), ignoreCase = true) }
        val photo = when {
            twin == null -> Photo(name, original, newThumb()).also {
                photos.add(it)
                thumbs.addView(it.thumb, 0)
                updateCounter()
            }
            twin.isRaw && !PhotoStore.isRaw(name) -> twin.also {
                it.name = name
                it.original = original
            }
            else -> {
                setStatus("$name salva")
                return
            }
        }
        develop(photo, data)
    }

    override fun onDisconnected(session: CameraSession, reason: String?) {
        if (session !== this.session) return
        this.session = null
        setConnected(false)
        setStatus(reason?.let { "Desconectada: $it" } ?: "Câmera desconectada.")
    }

    // ---- Fotos ----

    private fun develop(photo: Photo, data: ByteArray) {
        val look = look
        val signature = signature()
        setStatus(if (look != null) "Aplicando preset em ${photo.name}…" else "Abrindo ${photo.name}…")
        processor.execute {
            val previous = photo.edited
            val result = Darkroom.develop(this, photo.name, data, look)
            if (result?.edited != null && previous != null) PhotoStore.delete(this, previous)
            if (result != null) {
                photo.edited = result.edited
                photo.editedWith = signature
            }
            main.post {
                if (result == null) {
                    setStatus("Não foi possível abrir ${photo.name}")
                    return@post
                }
                setThumb(photo, result.thumb)
                show(photo, result.original, result.display)
                setStatus("${photo.name} pronta${if (look != null) ", com preset" else ""}")
            }
        }
    }

    private fun select(photo: Photo) {
        val uri = photo.original ?: return
        val look = look
        processor.execute {
            val result = Darkroom.preview(this, uri, look)
            main.post { if (result != null) show(photo, result.first, result.second) }
        }
    }

    private fun show(photo: Photo, original: Bitmap, display: Bitmap) {
        current = photo
        currentOriginal = original
        currentShown = display
        image.setImageBitmap(display)
        hint.visibility = View.GONE
        for (p in photos) p.thumb.alpha = if (p === photo) 1f else 0.55f
        shareButton.isEnabled = true
    }

    /** Ao trocar de preset ou intensidade, a foto da tela é refeita na hora. */
    private fun rerenderCurrent() {
        val original = currentOriginal ?: return
        val photo = current
        val look = look
        processor.execute {
            val display = look?.apply(PhotoStore.scaled(original, Darkroom.DISPLAY_PX)) ?: original
            main.post {
                if (current === photo) {
                    currentShown = display
                    image.setImageBitmap(display)
                }
            }
        }
    }

    private fun share(list: List<Photo>) {
        if (list.isEmpty()) return
        val look = look
        val signature = signature()
        setStatus("Preparando para compartilhar…")
        processor.execute {
            val uris = ArrayList<Uri>()
            list.forEachIndexed { i, photo ->
                // Com preset (ou RAW), compartilha o JPEG gerado; refaz se o preset mudou desde então.
                val needsJpeg = look != null || photo.isRaw
                if (needsJpeg && photo.editedWith != signature) {
                    main.post { setStatus("Preparando ${i + 1} de ${list.size}…") }
                    val data = photo.original?.let { PhotoStore.readBytes(this, it) }
                    val result = data?.let { Darkroom.develop(this, photo.name, it, look) }
                    if (result?.edited != null) {
                        photo.edited?.let { PhotoStore.delete(this, it) }
                        photo.edited = result.edited
                        photo.editedWith = signature
                    }
                }
                val uri = if (needsJpeg) photo.edited ?: photo.original else photo.original
                uri?.let(uris::add)
            }
            main.post { send(uris) }
        }
    }

    private fun send(uris: List<Uri>) {
        if (uris.isEmpty()) {
            setStatus("Nenhuma foto salva para compartilhar.")
            return
        }
        val intent = if (uris.size == 1) {
            Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, uris[0])
        } else {
            Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(uris))
        }
        intent.type = "image/*"
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        intent.clipData = ClipData.newUri(contentResolver, "Fotos", uris[0]).apply {
            uris.drop(1).forEach { addItem(ClipData.Item(it)) }
        }
        setStatus(if (uris.size == 1) "Escolha onde compartilhar." else "Escolha onde compartilhar as ${uris.size} fotos.")
        startActivity(Intent.createChooser(intent, "Compartilhar"))
    }

    // ---- Presets ----

    private fun signature(): String = library.activeFile?.let { "$it@${library.amount}" } ?: "none"

    private fun presetChanged(rerender: Boolean = true) {
        val entry = library.active()
        look = entry?.let { PresetLook(it.preset, library.amount / 100f) }
        presetButton.text = entry?.preset?.name?.let { "$it  ▾" } ?: "Sem preset  ▾"
        amountBar.isEnabled = entry != null
        amountLabel.text = "Intensidade: ${library.amount}%"
        val ignored = entry?.preset?.ignored.orEmpty()
        presetNote.text = if (ignored.isEmpty()) "" else "Não reproduzido neste app: ${ignored.joinToString(", ")}"
        presetNote.visibility = if (ignored.isEmpty()) View.GONE else View.VISIBLE
        if (rerender) rerenderCurrent()
    }

    private fun choosePreset() {
        val entries = library.all()
        val names = arrayOf("Sem preset") + entries.map { it.preset.name }
        val selected = entries.indexOfFirst { it.file == library.activeFile } + 1
        AlertDialog.Builder(this)
            .setTitle("Preset")
            .setSingleChoiceItems(names, selected) { dialog, which ->
                library.activeFile = if (which == 0) null else entries[which - 1].file
                presetChanged()
                dialog.dismiss()
            }
            .setNeutralButton("Importar…") { _, _ -> importPreset() }
            .setNegativeButton("Remover o atual") { _, _ ->
                library.activeFile?.let {
                    library.remove(it)
                    presetChanged()
                }
            }
            .show()
    }

    private fun importPreset() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("*/*")
            .putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        @Suppress("DEPRECATION")
        startActivityForResult(intent, REQUEST_IMPORT)
    }

    @Deprecated("Activity sem AndroidX: o retorno do seletor de arquivos ainda chega por aqui.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_IMPORT || resultCode != RESULT_OK || data == null) return
        val uris = data.clipData?.let { clip -> (0 until clip.itemCount).map { clip.getItemAt(it).uri } }
            ?: listOfNotNull(data.data)
        val imported = ArrayList<PresetLibrary.Entry>()
        var failed = 0
        for (uri in uris) {
            val bytes = PhotoStore.readBytes(this, uri)
            val found = bytes?.let { library.import(displayName(uri), it) }.orEmpty()
            if (found.isEmpty()) failed++ else imported += found
        }
        imported.lastOrNull()?.let {
            library.activeFile = it.file
            presetChanged()
        }
        val message = when {
            imported.isEmpty() -> "Não reconheci esse arquivo como preset do Lightroom (.xmp, .lrtemplate, .dng ou .zip)."
            imported.size == 1 -> "Preset \"${imported[0].preset.name}\" importado."
            else -> "${imported.size} presets importados. Ativo: \"${imported.last().preset.name}\"."
        } + if (imported.isNotEmpty() && failed > 0) " $failed arquivo(s) não reconhecido(s)." else ""
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    private fun displayName(uri: Uri): String =
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        } ?: uri.lastPathSegment ?: "preset"

    // ---- Tela ----

    private fun setStatus(text: String) {
        status.text = text
    }

    private fun setConnected(connected: Boolean) {
        connectButton.visibility = if (connected) View.GONE else View.VISIBLE
    }

    private fun updateCounter() {
        val n = photos.size
        counter.text = "$n ${if (n == 1) "foto" else "fotos"} nesta sessão · salvas em Imagens/SonyTether"
        shareAllButton.text = "Compartilhar todas ($n)"
        shareAllButton.isEnabled = n > 0
    }

    private fun newThumb() = ImageView(this).apply {
        scaleType = ImageView.ScaleType.CENTER_CROP
        setBackgroundColor(SURFACE)
        layoutParams = LinearLayout.LayoutParams(dp(96), dp(72)).apply { marginEnd = dp(6) }
    }

    private fun setThumb(photo: Photo, bitmap: Bitmap) {
        photo.thumb.setImageBitmap(bitmap)
        photo.thumb.contentDescription = photo.name
        photo.thumb.layoutParams = LinearLayout.LayoutParams(dp(72) * bitmap.width / maxOf(1, bitmap.height), dp(72)).apply {
            marginEnd = dp(6)
        }
        photo.thumb.setOnClickListener { select(photo) }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun buildUi() {
        image = ImageView(this).apply {
            scaleType = ImageView.ScaleType.FIT_CENTER
            setBackgroundColor(Color.BLACK)
            // Segurar a foto mostra o original, sem preset.
            setOnTouchListener { _, e ->
                when (e.actionMasked) {
                    MotionEvent.ACTION_DOWN -> if (look != null) currentOriginal?.let {
                        setImageBitmap(it)
                        badge.visibility = View.VISIBLE
                    }
                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                        currentShown?.let(::setImageBitmap)
                        badge.visibility = View.GONE
                    }
                }
                true
            }
        }
        hint = label("Conecte a câmera Sony pelo cabo USB", 18f, MUTED).apply { gravity = Gravity.CENTER }
        badge = label("ORIGINAL", 13f, Color.WHITE).apply {
            typeface = Typeface.DEFAULT_BOLD
            background = rounded(0xCC000000.toInt(), dp(4))
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
        column.addView(button("Diagnóstico", SURFACE, MUTED) { showDiagnostics() }, fullWidth(dp(40)).apply { topMargin = dp(8) })

        column.addView(section("PRESET DO LIGHTROOM"))
        presetButton = button("Sem preset  ▾", SURFACE, Color.WHITE) { choosePreset() }
        column.addView(presetButton, fullWidth(dp(48)))
        column.addView(button("Importar preset", SURFACE, Color.WHITE) { importPreset() }, fullWidth(dp(44)).apply { topMargin = dp(8) })
        amountLabel = label("", 13f, MUTED).apply { setPadding(0, dp(12), 0, 0) }
        column.addView(amountLabel)
        amountBar = SeekBar(this).apply {
            max = 100
            progress = library.amount
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(bar: SeekBar, value: Int, fromUser: Boolean) {
                    amountLabel.text = "Intensidade: $value%"
                }

                override fun onStartTrackingTouch(bar: SeekBar) {}

                override fun onStopTrackingTouch(bar: SeekBar) {
                    library.amount = bar.progress
                    presetChanged()
                }
            })
        }
        column.addView(amountBar, fullWidth(WRAP_CONTENT))
        presetNote = label("", 12f, MUTED).apply { setPadding(0, dp(6), 0, 0) }
        column.addView(presetNote)

        column.addView(section("COMPARTILHAR"))
        shareButton = button("Compartilhar esta foto", ACCENT, Color.BLACK) { current?.let { share(listOf(it)) } }
        shareButton.isEnabled = false
        column.addView(shareButton, fullWidth(dp(52)))
        shareAllButton = button("Compartilhar todas (0)", SURFACE, Color.WHITE) { share(photos.toList()) }
        shareAllButton.isEnabled = false
        column.addView(shareAllButton, fullWidth(dp(44)).apply { topMargin = dp(8) })

        counter = label("Nenhuma foto ainda", 13f, MUTED).apply { setPadding(0, dp(16), 0, 0) }
        column.addView(counter, fullWidth(WRAP_CONTENT))
        column.addView(label("Segure a foto para ver sem o preset · toque numa miniatura para rever", 12f, MUTED).apply {
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

    private fun showDiagnostics() {
        val text = DiagLog.text()
        val view = label(text, 11f, Color.WHITE).apply {
            typeface = Typeface.MONOSPACE
            setTextIsSelectable(true)
            setPadding(dp(16), dp(12), dp(16), dp(12))
        }
        AlertDialog.Builder(this)
            .setTitle("Diagnóstico")
            .setView(ScrollView(this).apply { addView(view) })
            .setPositiveButton("Copiar") { _, _ ->
                val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText("Sony Tether", text))
                Toast.makeText(this, "Diagnóstico copiado", Toast.LENGTH_SHORT).show()
            }
            .setNeutralButton("Compartilhar") { _, _ ->
                val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
                startActivity(Intent.createChooser(send, "Enviar diagnóstico"))
            }
            .setNegativeButton("Fechar", null)
            .show()
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

    private fun section(title: String) = label(title, 12f, ACCENT).apply {
        typeface = Typeface.DEFAULT_BOLD
        letterSpacing = 0.08f
        setPadding(0, dp(24), 0, dp(8))
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
        const val REQUEST_IMPORT = 1
        const val PANEL = 0xFF16161A.toInt()
        const val SURFACE = 0xFF2A2A31.toInt()
        const val ACCENT = 0xFFE8A33D.toInt()
        const val MUTED = 0xFF9A9AA5.toInt()
    }
}
