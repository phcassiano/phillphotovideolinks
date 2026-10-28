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
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.RectF
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
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import java.io.ByteArrayOutputStream
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

class MainActivity : Activity(), CameraSession.Listener, ZoomImageView.Listener, GalleryServer.Source, DriveSync.Host {

    private lateinit var usb: UsbManager
    private lateinit var library: PresetLibrary
    private lateinit var sessions: SessionStore
    private lateinit var watermark: Watermark
    private lateinit var brandSettings: BrandSettings
    private lateinit var drive: DriveSync
    private lateinit var presetStrip: PresetStrip
    private var camera: CameraSession? = null
    private val main = Handler(Looper.getMainLooper())

    /** Decodificar, aplicar preset e salvar: uma foto por vez, fora da thread da tela. */
    private val processor = Executors.newSingleThreadExecutor()

    /** Trechos em resolução cheia para o zoom: separado para não esperar fotos sendo reveladas. */
    private val detailer = Executors.newSingleThreadExecutor()
    private val latestDetail = AtomicInteger()
    private var region: PhotoStore.Region? = null
    private var regionFor: SessionPhoto? = null

    @Volatile
    private lateinit var shoot: ShootSession

    @Volatile
    private var look = Look(null, null, "none")

    private val ui by lazy { Ui(this) }
    private lateinit var root: LinearLayout
    private lateinit var stage: FrameLayout
    private lateinit var panel: ScrollView
    private lateinit var viewer: ZoomImageView
    private lateinit var hint: TextView
    private lateinit var badge: TextView
    private lateinit var ratingBar: LinearLayout
    private lateinit var heart: ImageView
    private lateinit var stars: List<ImageView>
    private lateinit var hideButton: ImageView
    private lateinit var emptyState: LinearLayout
    private lateinit var topBar: LinearLayout
    private lateinit var photoTitle: TextView
    private lateinit var photoInfo: TextView
    private lateinit var statusDot: View
    private lateinit var statusTitle: TextView
    private lateinit var hidePanelButton: Button
    private lateinit var deletePanelButton: Button
    private lateinit var strip: HorizontalScrollView
    private lateinit var thumbs: LinearLayout
    private lateinit var lock: ImageView
    private lateinit var status: TextView
    private lateinit var connectButton: Button
    private lateinit var sessionButton: Button
    private lateinit var filterButton: Button
    private lateinit var presetButton: Button
    private lateinit var amountLabel: TextView
    private lateinit var amountBar: SeekBar
    private lateinit var presetNote: TextView
    private lateinit var watermarkButton: Button
    private lateinit var shareButton: Button
    private lateinit var shareAllButton: Button
    private lateinit var qrButton: Button
    private lateinit var counter: TextView
    private lateinit var frameButton: Button
    private lateinit var slideshowButton: Button
    private lateinit var driveButton: Button
    private lateinit var driveStatusLabel: TextView
    private lateinit var brandButton: Button

    private class Tile(val frame: FrameLayout, val image: ImageView, val marks: TextView)

    private val tiles = HashMap<SessionPhoto, Tile>()
    private var current: SessionPhoto? = null
    private var currentOriginal: Bitmap? = null
    private var currentShown: Bitmap? = null
    @Volatile
    private var selecting = 0

    /** Índice em [FILTERS]. */
    private var filter = 0

    /** O que a galeria do QR code mostra: as fotos do filtro, da mais nova para a mais antiga. */
    @Volatile
    private var galleryPhotos: List<SessionPhoto> = emptyList()
    private var server: GalleryServer? = null
    private val thumbCache = ConcurrentHashMap<String, ByteArray>()

    /** O que o slideshow mostra: favoritas (ou todas), da mais antiga para a mais nova. */
    @Volatile
    private var slidePhotos: List<SessionPhoto> = emptyList()
    private var slideMode = 0

    @Volatile
    private var logoCache: ByteArray? = null

    /** Para onde volta a escolha do logo: marca d'água ou sua marca. */
    private var logoFor = REQUEST_LOGO
    private var frameIndex = 0
    private var driveStatusText = ""
    private var lastAmount = -1

    private var clientMode = false

    // Reconexão automática
    private var retryDelay = RETRY_MIN_MS
    private var askedPermissionFor: String? = null
    private val reconnect = Runnable { tryReconnect() }

    private val usbReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                ACTION_USB_PERMISSION -> {
                    val device = intent.usbDevice() ?: return
                    if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) open(device)
                    else setStatus("Acesso à câmera não autorizado. Toque em Conectar câmera para pedir de novo.")
                }
                UsbManager.ACTION_USB_DEVICE_ATTACHED -> scheduleReconnect(500)
                UsbManager.ACTION_USB_DEVICE_DETACHED -> {
                    val device = intent.usbDevice() ?: return
                    if (device.deviceName == askedPermissionFor) askedPermissionFor = null
                    if (device.deviceName == camera?.device?.deviceName) camera?.shutdown()
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        usb = getSystemService(Context.USB_SERVICE) as UsbManager
        library = PresetLibrary(this)
        sessions = SessionStore(this)
        watermark = Watermark(this)
        brandSettings = BrandSettings(this)
        drive = DriveSync(this, this)
        filter = prefs().getInt(KEY_FILTER, 0).coerceIn(FILTERS.indices)
        slideMode = prefs().getInt(KEY_SLIDE_MODE, 0)
        frameIndex = prefs().getInt(KEY_FRAME, 0).coerceIn(Frames.ALL.indices)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        buildUi()
        applyOrientation(resources.configuration)
        setLink(LINK_OFF)
        viewer.frame = frameIndex
        updateFrameButton()
        updateBrandButton()
        updateDriveButton()
        presetStrip.rebuild()
        lookChanged(rerender = false)
        openSession(sessions.current() ?: sessions.create(SessionNames.DEFAULT_NAME))

        val usbEvents = IntentFilter().apply {
            addAction(ACTION_USB_PERMISSION)
            addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
            addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
        }
        // Antes do Android 13 a flag é ignorada; a partir dele, impede outros apps de mandar esses avisos.
        registerReceiver(usbReceiver, usbEvents, Context.RECEIVER_NOT_EXPORTED)

        if (!handleUsbIntent(intent)) tryReconnect()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleUsbIntent(intent)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        applyOrientation(newConfig)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus && clientMode) setFullScreen(true)
    }

    @Deprecated("Activity sem AndroidX: o botão voltar ainda chega por aqui.")
    override fun onBackPressed() {
        if (clientMode) {
            Toast.makeText(this, "Modo cliente: segure o cadeado por 2 segundos para sair.", Toast.LENGTH_SHORT).show()
            return
        }
        @Suppress("DEPRECATION")
        super.onBackPressed()
    }

    override fun onDestroy() {
        unregisterReceiver(usbReceiver)
        main.removeCallbacks(reconnect)
        camera?.shutdown()
        server?.stop()
        drive.shutdown()
        presetStrip.shutdown()
        processor.shutdownNow()
        detailer.shutdownNow()
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
        askedPermissionFor = device.deviceName
        setStatus("Autorize o acesso à câmera na janela do Android.")
        val intent = Intent(ACTION_USB_PERMISSION).setPackage(packageName)
        val flags = PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        usb.requestPermission(device, PendingIntent.getBroadcast(this, 0, intent, flags))
    }

    private fun scheduleReconnect(delayMs: Long) {
        main.removeCallbacks(reconnect)
        main.postDelayed(reconnect, delayMs)
    }

    /**
     * Fica de olho na câmera enquanto ela não está conectada: quando o cabo volta ou a câmera
     * liga de novo, conecta sozinho (pedindo autorização uma vez, se o Android exigir).
     */
    private fun tryReconnect() {
        if (camera != null) return
        val device = findCamera()
        when {
            device == null -> scheduleReconnect(RETRY_MIN_MS)
            usb.hasPermission(device) -> open(device)
            askedPermissionFor != device.deviceName -> {
                requestPermission(device)
                scheduleReconnect(RETRY_MIN_MS)
            }
            else -> scheduleReconnect(RETRY_MIN_MS)
        }
    }

    /** Depois de uma falha, espera cada vez mais (até 20 s) para não ficar martelando a câmera. */
    private fun retryLater(): Long {
        val delay = retryDelay
        retryDelay = (retryDelay * 2).coerceAtMost(RETRY_MAX_MS)
        scheduleReconnect(delay)
        return delay
    }

    private fun open(device: UsbDevice) {
        if (camera != null) return
        main.removeCallbacks(reconnect)
        val iface = ptpInterface(device)
        if (iface == null) {
            DiagLog.describe(device)
            DiagLog.add("nenhuma interface PTP")
            setStatus("A câmera não está no modo PC Remoto. Mude a Conexão USB para \"PC Remoto\"; o app conecta sozinho.")
            retryLater()
            return
        }
        val connection = usb.openDevice(device)
        if (connection == null) {
            setStatus("Não foi possível abrir a conexão USB. Tentando de novo…")
            retryLater()
            return
        }
        setStatus("Conectando a ${device.productName ?: "câmera"}…")
        camera = CameraSession(applicationContext, device, connection, iface, this) { shoot.target(it) }.also { it.start() }
        setLink(LINK_CONNECTING)
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
        retryDelay = RETRY_MIN_MS
        setLink(LINK_ON, model)
        setStatus("Conectada: $model. Fotografe na câmera: cada foto aparece aqui.")
        if (shoot.photos.isEmpty()) hint.text = "Pronto. Dispare na câmera para ver a primeira foto."
    }

    override fun onShot(target: ShotTarget, data: ByteArray, original: Uri?) {
        val s = target.session
        // No modo RAW+JPEG chegam dois arquivos da mesma foto, com o mesmo número: fica um só, de preferência o JPEG.
        val twin = s.photos.lastOrNull { it.number == target.number }
        val photo = when {
            twin == null -> SessionPhoto(target.number, target.name).also {
                it.original = original
                s.photos += it
                if (s === shoot) addTile(it, atStart = true)
            }
            twin.isRaw && !PhotoStore.isRaw(target.name) -> twin.also {
                it.original?.let(it.extras::add)
                it.name = target.name
                it.original = original
            }
            else -> {
                original?.let(twin.extras::add)
                sessions.save(s)
                setStatus("${target.name} salva")
                return
            }
        }
        sessions.save(s)
        if (s !== shoot) return
        updateCounter()
        refreshGallery()
        develop(photo, data)
    }

    override fun onDisconnected(session: CameraSession, reason: String?) {
        if (session !== camera) return
        camera = null
        setLink(if (reason != null) LINK_ERROR else LINK_OFF)
        if (reason != null) {
            val delay = retryLater()
            setStatus("Desconectada: $reason. Tentando de novo em ${delay / 1000} s…")
        } else {
            setStatus("Câmera desconectada. Ligue o cabo de novo: o app conecta sozinho.")
            scheduleReconnect(RETRY_MIN_MS)
        }
    }

    // ---- Sessões ----

    private fun openSession(s: ShootSession) {
        shoot = s
        thumbCache.clear()
        tiles.clear()
        thumbs.removeAllViews()
        current = null
        currentOriginal = null
        currentShown = null
        viewer.setImage(null, 0, resetZoom = true)
        emptyState.visibility = View.VISIBLE
        hint.text = if (camera != null) "Pronto. Dispare na câmera para ver a primeira foto." else "Conecte a câmera Sony pelo cabo USB"
        updateRatingBar()
        shareButton.isEnabled = false
        sessionButton.text = "${s.label}"
        for (p in s.photos) addTile(p, atStart = true)
        // Miniaturas pelo sistema, sem abrir cada foto inteira.
        val list = s.photos.toList()
        processor.execute {
            for (p in list.asReversed()) {
                val uri = p.edited ?: p.original ?: continue
                val thumb = PhotoStore.thumbnail(this, uri, Darkroom.THUMB_PX) ?: continue
                main.post { if (shoot === s) setThumb(p, thumb) }
            }
        }
        applyFilter()
        visiblePhotos().firstOrNull()?.let(::select)
        driveStatusText = ""
        if (::drive.isInitialized) {
            updateDriveButton()
            drive.sync(s)
        }
    }

    private fun chooseSession() {
        val all = sessions.all().filter { it.id != shoot.id }
        val names = arrayOf("+ Nova sessão…", "${shoot.label} (aberta, ${shoot.photos.size} fotos)") +
            all.map { "${it.label} (${it.photos.size} fotos)" }
        AlertDialog.Builder(this)
            .setTitle("Sessão")
            .setItems(names) { _, which ->
                when (which) {
                    0 -> newSession()
                    1 -> Unit
                    else -> all[which - 2].let {
                        sessions.select(it)
                        openSession(it)
                        setStatus("Sessão \"${it.name}\" aberta.")
                    }
                }
            }
            .show()
    }

    private fun newSession() {
        val input = EditText(this).apply {
            hint = "Nome do cliente ou do ensaio"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_WORDS
            setSingleLine()
        }
        val box = FrameLayout(this).apply {
            setPadding(dp(20), dp(8), dp(20), 0)
            addView(input)
        }
        AlertDialog.Builder(this)
            .setTitle("Nova sessão")
            .setMessage("As fotos vão para uma pasta própria e ficam com o nome do cliente (ex.: Maria_001.jpg).")
            .setView(box)
            .setPositiveButton("Criar") { _, _ ->
                val s = sessions.create(input.text.toString())
                openSession(s)
                setStatus("Sessão \"${s.name}\" criada. Pasta: Imagens/${PhotoStore.FOLDER}/${s.folder}")
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun saveSession() = sessions.save(shoot)

    // ---- Fotos ----

    private fun develop(photo: SessionPhoto, data: ByteArray) {
        val look = look
        val s = shoot
        setStatus(if (look.preset != null) "Aplicando preset em ${photo.name}…" else "Abrindo ${photo.name}…")
        processor.execute {
            val needsJpeg = look.needsJpeg(photo.name)
            val result = Darkroom.develop(this, s.folder, photo.name, data, look, replacing = if (needsJpeg) photo.edited else null)
            if (result != null && needsJpeg) {
                photo.edited = result.edited
                photo.editedWith = look.signature
            }
            main.post {
                if (result == null) {
                    setStatus("Não foi possível abrir ${photo.name}")
                    return@post
                }
                if (photo.deleted) {
                    result.edited?.let { uri -> processor.execute { PhotoStore.delete(this, uri) } }
                    return@post
                }
                photo.width = result.width
                photo.height = result.height
                sessions.save(s)
                if (shoot !== s) return@post
                setThumb(photo, result.thumb)
                show(photo, result.original, result.display, resetZoom = true)
                setStatus("${photo.name} pronta${if (look.preset != null) ", com preset" else ""}")
                syncDriveSoon(300)
            }
        }
    }

    private fun select(photo: SessionPhoto) {
        val uri = photo.original ?: return
        val look = look
        val ticket = ++selecting
        processor.execute {
            if (ticket != selecting) return@execute // já pediram outra foto
            val result = Darkroom.preview(this, uri, look)
            main.post {
                if (result == null || ticket != selecting) return@post
                if (photo.width == 0) {
                    photo.width = result.width
                    photo.height = result.height
                }
                show(photo, result.original, result.display, resetZoom = true)
            }
        }
    }

    private fun show(photo: SessionPhoto, original: Bitmap, display: Bitmap, resetZoom: Boolean) {
        if (photo.deleted) return
        val changed = photo !== current
        current = photo
        currentOriginal = original
        currentShown = display
        viewer.setImage(display, photo.width, resetZoom = resetZoom || changed)
        if (changed) presetStrip.setPhoto(original)
        emptyState.visibility = View.GONE
        highlightTiles()
        shareButton.isEnabled = true
        updateRatingBar()
    }

    /** Ao trocar de preset, intensidade ou marca d'água, a foto da tela é refeita na hora. */
    private fun rerenderCurrent() {
        val original = currentOriginal ?: return
        val photo = current ?: return
        val look = look
        processor.execute {
            val display = look.apply(PhotoStore.scaled(original, Darkroom.DISPLAY_PX))
            main.post {
                if (current === photo) {
                    currentShown = display
                    viewer.setImage(display, photo.width, resetZoom = false)
                }
            }
        }
    }

    /**
     * Arquivo para entregar: o JPEG com o visual atual (refeito se o preset ou a marca mudaram)
     * ou, sem nada a aplicar, o arquivo da câmera. Roda no [processor].
     */
    private fun prepare(photo: SessionPhoto, look: Look, s: ShootSession): Uri? {
        if (photo.deleted) return null
        if (!look.needsJpeg(photo.name)) return photo.original
        if (photo.edited != null && photo.editedWith == look.signature) return photo.edited
        val data = photo.original?.let { PhotoStore.readBytes(this, it) } ?: return photo.edited ?: photo.original
        val result = Darkroom.develop(this, s.folder, photo.name, data, look, replacing = photo.edited) ?: return photo.edited
        photo.edited = result.edited
        photo.editedWith = look.signature
        main.post {
            sessions.save(s)
            if (shoot === s) setThumb(photo, result.thumb)
        }
        return result.edited ?: photo.original
    }

    private fun share(list: List<SessionPhoto>) {
        if (list.isEmpty()) return
        val look = look
        val s = shoot
        setStatus("Preparando para compartilhar…")
        processor.execute {
            val uris = list.mapIndexedNotNull { i, photo ->
                if (list.size > 1) main.post { setStatus("Preparando ${i + 1} de ${list.size}…") }
                prepare(photo, look, s)
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

    // ---- Zoom ----

    override fun onDetailNeeded(rect: RectF, widthPx: Int, token: Int) {
        val photo = current ?: return
        val uri = photo.original ?: return
        val look = look
        val ticket = latestDetail.incrementAndGet()
        detailer.execute {
            if (ticket != latestDetail.get()) return@execute
            if (regionFor !== photo) {
                region?.close()
                region = PhotoStore.readBytes(this, uri)?.let(PhotoStore::region)
                regionFor = photo
            }
            val bitmap = region?.let { runCatching { Darkroom.detail(it, rect, widthPx, look) }.getOrNull() } ?: return@execute
            main.post { if (current === photo) viewer.setDetail(bitmap, rect, token) }
        }
    }

    override fun onHold(holding: Boolean) {
        val original = currentOriginal ?: return
        if (look.preset == null && look.stamp == null) return
        viewer.swapImage(if (holding) original else currentShown)
        badge.visibility = if (holding) View.VISIBLE else View.GONE
    }

    override fun onSwipe(direction: Int) {
        val list = visiblePhotos()
        if (list.isEmpty()) return
        val index = list.indexOf(current)
        val next = list.getOrNull(if (index < 0) 0 else index + direction) ?: return
        select(next)
        tiles[next]?.frame?.let { strip.smoothScrollTo((it.left - strip.width / 2 + it.width / 2).coerceAtLeast(0), 0) }
    }

    // ---- Estrelas, favoritas e filtro ----

    /** As escondidas só aparecem no filtro "Escondidas". */
    private fun matches(p: SessionPhoto) = when (filter) {
        FILTER_HIDDEN -> p.hidden
        1 -> !p.hidden && p.favorite
        2 -> !p.hidden && p.rating >= 3
        3 -> !p.hidden && p.rating >= 5
        else -> !p.hidden
    }

    /** Fotos do filtro, na ordem das miniaturas (a mais nova primeiro). */
    private fun visiblePhotos() = shoot.photos.asReversed().filter(::matches)

    private fun rate(stars: Int) {
        val photo = current ?: return
        photo.rating = if (photo.rating == stars) 0 else stars
        ratingChanged(photo)
    }

    private fun toggleFavorite() {
        val photo = current ?: return
        photo.favorite = !photo.favorite
        ratingChanged(photo)
    }

    private fun toggleHidden(photo: SessionPhoto? = current) {
        photo ?: return
        val before = visiblePhotos()
        photo.hidden = !photo.hidden
        ratingChanged(photo)
        if (photo.hidden) {
            Toast.makeText(this, "${photo.name} escondida. Para ver de novo: Mostrar → Escondidas.", Toast.LENGTH_SHORT).show()
        }
        if (photo === current && !matches(photo)) showNeighbor(photo, before)
    }

    private fun confirmDelete(photo: SessionPhoto? = current) {
        photo ?: return
        val files = 1 + (if (photo.edited != null) 1 else 0) + photo.extras.size
        AlertDialog.Builder(this)
            .setTitle("Apagar ${photo.name}?")
            .setMessage(
                "Apaga do tablet o arquivo da câmera e a versão com preset ($files ${if (files == 1) "arquivo" else "arquivos"}). " +
                    "A cópia no cartão da câmera não é apagada. Não dá para desfazer.",
            )
            .setPositiveButton("Apagar") { _, _ -> delete(photo) }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun delete(photo: SessionPhoto) {
        val s = shoot
        val before = visiblePhotos()
        photo.deleted = true
        photo.driveId?.let(drive::forget)
        s.photos.remove(photo)
        tiles.remove(photo)?.let { thumbs.removeView(it.frame) }
        saveSession()
        thumbCache.clear()
        updateCounter()
        refreshGallery()
        if (current === photo) showNeighbor(photo, before)
        syncDriveSoon()
        // No processador: espera o que já estava sendo feito com a foto (preset, compartilhar) terminar antes.
        processor.execute {
            val uris = listOfNotNull(photo.original, photo.edited) + photo.extras
            val failed = uris.count { !PhotoStore.delete(this, it) }
            main.post {
                setStatus(
                    if (failed == 0) "${photo.name} apagada."
                    else "${photo.name} saiu da sessão, mas $failed arquivo(s) não puderam ser apagados (o app foi reinstalado?). Apague pela Galeria.",
                )
            }
        }
    }

    /** Depois de esconder ou apagar: mostra a próxima foto do filtro (ou a anterior, se era a última). */
    private fun showNeighbor(photo: SessionPhoto, before: List<SessionPhoto>) {
        val after = visiblePhotos().toSet()
        val i = before.indexOf(photo)
        val next = before.drop(i + 1).firstOrNull { it in after } ?: before.take(maxOf(i, 0)).lastOrNull { it in after }
        if (next != null) {
            select(next)
            return
        }
        selecting++
        current = null
        currentOriginal = null
        currentShown = null
        viewer.setImage(null, 0, resetZoom = true)
        hint.text = "Nenhuma foto neste filtro."
        emptyState.visibility = View.VISIBLE
        shareButton.isEnabled = false
        updateRatingBar()
    }

    private fun ratingChanged(photo: SessionPhoto) {
        saveSession()
        updateRatingBar()
        updateMarks(photo)
        applyFilter()
        syncDriveSoon()
    }

    private fun updateRatingBar() {
        updatePhotoButtons()
        val photo = current
        updatePhotoInfo()
        if (photo == null) return
        heart.setImageResource(if (photo.favorite) R.drawable.ic_favorite else R.drawable.ic_favorite_border)
        heart.imageTintList = ColorStateList.valueOf(if (photo.favorite) Palette.PINK else Color.WHITE)
        stars.forEachIndexed { i, star ->
            star.setImageResource(if (i < photo.rating) R.drawable.ic_star else R.drawable.ic_star_border)
            star.imageTintList = ColorStateList.valueOf(if (i < photo.rating) Palette.GOLD else Color.WHITE)
        }
        hideButton.setImageResource(if (photo.hidden) R.drawable.ic_visibility else R.drawable.ic_visibility_off)
        hideButton.contentDescription = if (photo.hidden) "Mostrar de novo" else "Esconder"
    }

    /** Botões do painel para a foto da tela; ficam desligados sem foto. */
    private fun updatePhotoButtons() {
        val photo = current
        hidePanelButton.isEnabled = photo != null
        deletePanelButton.isEnabled = photo != null
        hidePanelButton.text = if (photo?.hidden == true) "Mostrar" else "Esconder"
        ui.setIcon(hidePanelButton, if (photo?.hidden == true) R.drawable.ic_visibility else R.drawable.ic_visibility_off)
    }

    /** Segurar uma miniatura: esconder ou apagar sem precisar abrir a foto. */
    private fun photoMenu(photo: SessionPhoto) {
        AlertDialog.Builder(this)
            .setTitle(photo.name)
            .setItems(arrayOf(if (photo.hidden) "👁  Mostrar de novo" else "⊘  Esconder", "🗑  Apagar…")) { _, which ->
                if (which == 0) toggleHidden(photo) else confirmDelete(photo)
            }
            .show()
    }

    private fun updateMarks(photo: SessionPhoto) {
        val marks = tiles[photo]?.marks ?: return
        val text = listOfNotNull(
            if (photo.hidden) "⊘" else null,
            if (photo.favorite) "♥" else null,
            if (photo.rating > 0) "${photo.rating}★" else null,
        ).joinToString(" ")
        marks.text = text
        marks.visibility = if (text.isEmpty()) View.GONE else View.VISIBLE
    }

    private fun chooseFilter() {
        AlertDialog.Builder(this)
            .setTitle("Mostrar")
            .setSingleChoiceItems(FILTERS, filter) { dialog, which ->
                filter = which
                prefs().edit().putInt(KEY_FILTER, which).apply()
                applyFilter()
                dialog.dismiss()
            }
            .show()
    }

    private fun applyFilter() {
        for ((p, tile) in tiles) tile.frame.visibility = if (matches(p)) View.VISIBLE else View.GONE
        filterButton.text = "Mostrar: ${FILTERS[filter]}"
        updateCounter()
        refreshGallery()
    }

    // ---- Galeria do cliente (QR code) ----

    private fun refreshGallery() {
        galleryPhotos = visiblePhotos()
        slidePhotos = shoot.photos.filter { !it.hidden && (slideMode == 1 || it.favorite) }
    }

    override val galleryTitle: String get() = shoot.name

    override fun items(): List<Pair<Int, String>> = galleryPhotos.map { it.number to it.name }

    /** Prepara no [processor] (o mesmo que revela as fotos) e espera; roda numa thread do servidor. */
    private fun preparedUri(number: Int): Uri? {
        val photo = galleryPhotos.firstOrNull { it.number == number } ?: slidePhotos.firstOrNull { it.number == number } ?: return null
        val look = look
        val s = shoot
        return runCatching { processor.submit<Uri?> { prepare(photo, look, s) }.get(2, TimeUnit.MINUTES) }.getOrNull()
    }

    override fun photo(number: Int): ByteArray? = preparedUri(number)?.let { PhotoStore.readBytes(this, it) }

    override fun thumbnail(number: Int): ByteArray? {
        val key = "$number|${look.signature}"
        thumbCache[key]?.let { return it }
        val uri = preparedUri(number) ?: return null
        val bitmap = PhotoStore.thumbnail(this, uri, GALLERY_THUMB_PX) ?: return null
        val bytes = ByteArrayOutputStream().also { bitmap.compress(Bitmap.CompressFormat.JPEG, 82, it) }.toByteArray()
        thumbCache[key] = bytes
        return bytes
    }

    private fun showQr() {
        val server = startServer() ?: return
        val local = server.url() ?: return
        val driveUrl = driveLink
        val qr = qrImage(local)
        val urlText = label(local, 15f, Color.WHITE).apply {
            gravity = Gravity.CENTER
            setTextIsSelectable(true)
            setPadding(0, dp(12), 0, dp(8))
        }
        val localHelp = "O cliente aponta a câmera do celular para o código. O celular precisa estar no mesmo Wi-Fi do " +
            "tablet (ou no ponto de acesso dele); não precisa de internet. A página mostra as fotos do " +
            "filtro \"${FILTERS[filter]}\" (${galleryPhotos.size}), com preset, marca d'água e a sua marca."
        val driveHelp = "Link da pasta da sessão no Google Drive: funciona em qualquer lugar, com internet, e continua " +
            "valendo depois do ensaio. Mostra as fotos já enviadas."
        val help = label(localHelp, 13f, MUTED)
        var showingDrive = false
        val toggle = Button(this).apply {
            isAllCaps = false
            text = "Mostrar o link do Google Drive"
            visibility = if (driveUrl != null) View.VISIBLE else View.GONE
            setOnClickListener {
                showingDrive = !showingDrive
                val target = if (showingDrive) driveUrl!! else local
                qr.setImageBitmap(QrCode.encode(target).toBitmap(12))
                urlText.text = target
                help.text = if (showingDrive) driveHelp else localHelp
                text = if (showingDrive) "Mostrar a galeria do Wi-Fi" else "Mostrar o link do Google Drive"
            }
        }
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(12), dp(20), dp(4))
            addView(qr, LinearLayout.LayoutParams(MATCH_PARENT, dp(300)))
            addView(urlText)
            addView(help)
            addView(toggle, ui.wrap(8))
        }
        AlertDialog.Builder(this)
            .setTitle("Galeria para o cliente")
            .setView(ScrollView(this).apply { addView(column) })
            .setPositiveButton("Fechar", null)
            .setNegativeButton("Desligar galeria") { _, _ ->
                server.stop()
                this.server = null
                updateQrButton()
                setStatus("Galeria do cliente e slideshow desligados.")
            }
            .show()
    }

    private fun updateQrButton() {
        val on = server?.running == true
        qrButton.text = if (on) "QR code para o cliente (no ar)" else "QR code para o cliente"
        slideshowButton.text = if (on) "Slideshow para TV (no ar)" else "Slideshow para TV"
    }

    // ---- Slideshow, marca, Google Drive e moldura ----

    override val brand: GalleryServer.Brand
        get() = GalleryServer.Brand(brandSettings.studio, brandSettings.instagram, brandSettings.whatsapp, brandSettings.useLogo && watermark.hasLogo)

    override val driveLink: String? get() = if (drive.active) shoot.driveLink else null

    override fun slideshowItems(): List<Int> = slidePhotos.map { it.number }

    override fun screen(number: Int): ByteArray? {
        val key = "s$number|${look.signature}"
        thumbCache[key]?.let { return it }
        val uri = preparedUri(number) ?: return null
        val data = PhotoStore.readBytes(this, uri) ?: return null
        val bitmap = PhotoStore.decodePreview(data, SCREEN_PX) ?: return null
        val bytes = ByteArrayOutputStream().also { PhotoStore.scaled(bitmap, SCREEN_PX).compress(Bitmap.CompressFormat.JPEG, 86, it) }.toByteArray()
        thumbCache[key] = bytes
        return bytes
    }

    override fun logo(): ByteArray? = if (brandSettings.useLogo) logoCache ?: watermark.logoPng().also { logoCache = it } else null

    /** O servidor local, ligado na primeira vez que a galeria ou o slideshow são abertos. */
    private fun startServer(): GalleryServer? {
        val server = server ?: GalleryServer(this).also { server = it }
        try {
            server.start()
        } catch (e: Exception) {
            Toast.makeText(this, "Não foi possível abrir a galeria: ${e.message}", Toast.LENGTH_LONG).show()
            return null
        }
        updateQrButton()
        if (server.url() == null) {
            AlertDialog.Builder(this)
                .setTitle("Sem rede Wi-Fi")
                .setMessage("Ligue o Wi-Fi do tablet (na mesma rede do celular ou da TV) ou o ponto de acesso do tablet e tente de novo. Não precisa de internet.")
                .setPositiveButton("OK", null)
                .show()
            return null
        }
        return server
    }

    private fun qrImage(text: String) = ImageView(this).apply {
        setImageBitmap(QrCode.encode(text).toBitmap(12))
        scaleType = ImageView.ScaleType.FIT_CENTER
    }

    private fun showSlideshow() {
        val server = startServer() ?: return
        val url = server.slideshowUrl() ?: return
        val modes = arrayOf("Só as favoritas ♥ (você aprova cada foto com o coração)", "Todas as fotos (menos as escondidas)")
        val group = android.widget.RadioGroup(this)
        modes.forEachIndexed { i, text ->
            group.addView(android.widget.RadioButton(this).apply {
                id = i + 1
                this.text = text
                setTextColor(Palette.TEXT)
                isChecked = slideMode == i
            })
        }
        group.setOnCheckedChangeListener { _, id ->
            slideMode = id - 1
            prefs().edit().putInt(KEY_SLIDE_MODE, slideMode).apply()
            refreshGallery()
        }
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(8), dp(20), dp(4))
            addView(label("No navegador da TV ou do notebook, digite:", 13f, MUTED))
            addView(ui.text(url, 20f, Palette.GOLD, bold = true).apply {
                setTextIsSelectable(true)
                setPadding(0, dp(8), 0, dp(12))
            })
            addView(qrImage(url), LinearLayout.LayoutParams(MATCH_PARENT, dp(220)))
            addView(label("Ou aponte a câmera de um celular ou tablet para o código. A TV precisa estar no mesmo Wi-Fi do tablet.", 13f, MUTED).apply {
                setPadding(0, dp(10), 0, dp(14))
            })
            addView(ui.text("O que aparece no telão", 13f, Palette.TEXT, bold = true))
            addView(group)
            addView(label("As fotos novas entram na hora; as outras se revezam a cada 7 segundos. Clique na tela da TV para tela cheia.", 12f, MUTED).apply {
                setPadding(0, dp(8), 0, 0)
            })
        }
        AlertDialog.Builder(this)
            .setTitle("Slideshow para TV")
            .setView(ScrollView(this).apply { addView(column) })
            .setPositiveButton("Fechar", null)
            .show()
    }

    private fun editBrand() {
        fun field(hint: String, value: String, type: Int) = EditText(this).apply {
            this.hint = hint
            setText(value)
            inputType = type
            setSingleLine()
        }
        val studio = field("Nome do estúdio ou fotógrafo", brandSettings.studio, InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_WORDS)
        val instagram = field("Instagram (ex.: @seuestudio)", brandSettings.instagram, InputType.TYPE_CLASS_TEXT)
        val whatsapp = field("WhatsApp com DDD (ex.: 11 98765-4321)", brandSettings.whatsapp, InputType.TYPE_CLASS_PHONE)
        val useLogo = Switch(this).apply {
            text = if (watermark.hasLogo) "Mostrar meu logo" else "Mostrar meu logo (escolha um abaixo)"
            isChecked = brandSettings.useLogo
            setTextColor(Palette.TEXT)
            setPadding(0, dp(12), 0, dp(4))
        }
        lateinit var dialog: AlertDialog
        fun save() {
            brandSettings.studio = studio.text.toString()
            brandSettings.instagram = instagram.text.toString()
            brandSettings.whatsapp = whatsapp.text.toString()
            brandSettings.useLogo = useLogo.isChecked
            logoCache = null
            updateBrandButton()
        }
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(8), dp(20), dp(8))
            addView(label("Aparece no topo da galeria do cliente (QR code), com botões de WhatsApp e Instagram, e no canto do slideshow.", 13f, MUTED).apply {
                setPadding(0, 0, 0, dp(8))
            })
            addView(studio)
            addView(instagram)
            addView(whatsapp)
            addView(useLogo)
            addView(Button(this@MainActivity).apply {
                isAllCaps = false
                text = if (watermark.hasLogo) "Trocar logo…" else "Escolher logo (PNG)…"
                setOnClickListener {
                    save()
                    dialog.dismiss()
                    logoFor = REQUEST_BRAND
                    chooseLogo()
                }
            })
            addView(label("O logo é o mesmo da marca d'água.", 12f, MUTED))
        }
        dialog = AlertDialog.Builder(this)
            .setTitle("Sua marca")
            .setView(ScrollView(this).apply { addView(column) })
            .setPositiveButton("Salvar") { _, _ -> save() }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun updateBrandButton() {
        brandButton.text = brandSettings.studio.ifEmpty { "Sua marca na galeria" }
    }

    private fun chooseFrame() {
        AlertDialog.Builder(this)
            .setTitle("Moldura de recorte")
            .setSingleChoiceItems(Frames.NAMES, frameIndex) { d, which ->
                frameIndex = which
                prefs().edit().putInt(KEY_FRAME, which).apply()
                viewer.frame = if (clientMode) 0 else which
                updateFrameButton()
                d.dismiss()
            }
            .show()
    }

    private fun updateFrameButton() {
        frameButton.text = "Moldura: ${Frames.ALL[frameIndex].name}"
    }

    // Google Drive

    override val signature: String get() = look.signature

    override fun deliverable(photo: SessionPhoto, session: ShootSession): Pair<ByteArray, String>? {
        val look = look
        val uri = runCatching { processor.submit<Uri?> { prepare(photo, look, session) }.get(5, TimeUnit.MINUTES) }.getOrNull() ?: return null
        val data = PhotoStore.readBytes(this, uri) ?: return null
        return data to look.signature
    }

    override fun driveChanged(session: ShootSession) {
        sessions.save(session)
        updateDriveButton()
    }

    override fun driveStatus(text: String) {
        driveStatusText = text
        updateDriveButton()
    }

    private val driveSoon = Runnable { drive.sync(shoot) }

    /** Pede uma sincronização daqui a pouco (junta várias mudanças seguidas numa só). */
    private fun syncDriveSoon(delayMs: Long = 1500) {
        main.removeCallbacks(driveSoon)
        main.postDelayed(driveSoon, delayMs)
    }

    private fun updateDriveButton() {
        driveButton.text = when {
            !drive.hasCredentials || !drive.connected -> "Google Drive: conectar"
            drive.mode == DriveSync.MODE_OFF -> "Google Drive: pausado"
            else -> "Google Drive: ${DriveSync.MODES[drive.mode].lowercase()}"
        }
        val text = when {
            !drive.connected -> ""
            drive.mode == DriveSync.MODE_OFF -> "O envio está pausado."
            else -> driveStatusText
        }
        driveStatusLabel.text = text
        driveStatusLabel.visibility = if (text.isEmpty()) View.GONE else View.VISIBLE
    }

    private fun driveDialog() {
        when {
            !drive.hasCredentials -> driveSetup()
            !drive.connected -> driveLogin()
            else -> {
                val link = shoot.driveLink
                AlertDialog.Builder(this)
                    .setTitle("Google Drive: o que enviar")
                    .setSingleChoiceItems(DriveSync.MODES, drive.mode) { d, which ->
                        drive.mode = which
                        updateDriveButton()
                        drive.sync(shoot)
                        d.dismiss()
                    }
                    .setPositiveButton("Fechar", null)
                    .setNeutralButton("Desconectar") { _, _ ->
                        drive.signOut()
                        updateDriveButton()
                    }
                    .apply {
                        if (link != null) setNegativeButton("Abrir a pasta") { _, _ ->
                            runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link))) }
                        }
                    }
                    .show()
            }
        }
    }

    /** Primeira vez: as credenciais do projeto no Google Cloud (só o dono da conta pode criar). */
    private fun driveSetup() {
        val id = EditText(this).apply {
            hint = "ID do cliente (…apps.googleusercontent.com)"
            setText(drive.clientId)
            setSingleLine()
        }
        val secret = EditText(this).apply {
            hint = "Chave secreta do cliente"
            setText(drive.clientSecret)
            setSingleLine()
        }
        lateinit var dialog: AlertDialog
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(8), dp(20), dp(8))
            addView(label(
                "As fotos vão para o SEU Google Drive, sem mensalidade. Na primeira vez, o Google exige um " +
                    "\"projeto\" seu (gratuito, uns 10 minutos, de preferência num computador):\n\n" +
                    "1. Entre em console.cloud.google.com e crie um projeto (ex.: Sony Tether).\n" +
                    "2. Em APIs e serviços → Biblioteca, ative a \"Google Drive API\".\n" +
                    "3. Em Google Auth Platform (tela de permissão OAuth): tipo Externo, preencha nome e e-mail e " +
                    "depois clique em Publicar o app. Sem publicar, o acesso vence a cada 7 dias.\n" +
                    "4. Em Clientes (Credenciais) → Criar cliente: tipo \"TVs e dispositivos de entrada limitada\".\n" +
                    "5. Baixe o arquivo JSON e importe aqui, ou copie o ID e a chave secreta.",
                13f, MUTED,
            ))
            addView(Button(this@MainActivity).apply {
                isAllCaps = false
                text = "Importar o arquivo JSON…"
                setOnClickListener {
                    dialog.dismiss()
                    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
                    @Suppress("DEPRECATION")
                    startActivityForResult(intent, REQUEST_DRIVE_JSON)
                }
            }, ui.wrap(12))
            addView(id)
            addView(secret)
        }
        dialog = AlertDialog.Builder(this)
            .setTitle("Conectar o Google Drive")
            .setView(ScrollView(this).apply { addView(column) })
            .setPositiveButton("Continuar") { _, _ ->
                if (id.text.isBlank()) return@setPositiveButton
                drive.setCredentials(id.text.toString(), secret.text.toString())
                driveLogin()
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    /** Login pelo código: o app mostra um código e a pessoa confirma em google.com/device. */
    private fun driveLogin() {
        val client = drive.client ?: return driveSetup()
        setStatus("Pedindo um código ao Google…")
        Thread {
            val code = try {
                client.startDeviceLogin()
            } catch (e: Exception) {
                main.post {
                    AlertDialog.Builder(this)
                        .setTitle("Não deu para falar com o Google")
                        .setMessage("${e.message}\n\nConfira a internet do tablet e o ID do cliente.")
                        .setPositiveButton("Corrigir dados") { _, _ -> driveSetup() }
                        .setNegativeButton("Fechar", null)
                        .show()
                }
                return@Thread
            }
            main.post { showDeviceCode(client, code) }
        }.start()
    }

    private fun showDeviceCode(client: DriveClient, code: DriveClient.DeviceCode) {
        var waiting = true
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(20), dp(8), dp(20), dp(8))
            addView(label("1. No celular, abra ${code.verificationUrl.removePrefix("https://")} (ou leia o código QR).", 14f, Palette.TEXT))
            addView(qrImage(code.verificationUrl), LinearLayout.LayoutParams(dp(180), dp(180)).apply { topMargin = dp(10) })
            addView(label("2. Entre na conta Google onde as fotos devem ficar e digite:", 14f, Palette.TEXT).apply {
                setPadding(0, dp(10), 0, 0)
            })
            addView(ui.text(code.userCode, 32f, Palette.GOLD, bold = true).apply {
                letterSpacing = 0.12f
                setTextIsSelectable(true)
                setPadding(0, dp(10), 0, dp(10))
            })
            addView(label("3. Autorize. O Google pode avisar que o app não foi verificado: toque em Avançado → Acessar. O app só enxerga as pastas que ele mesmo criar.", 12f, MUTED))
        }
        val dialog = AlertDialog.Builder(this)
            .setTitle("Conectar o Google Drive")
            .setView(ScrollView(this).apply { addView(column) })
            .setNegativeButton("Cancelar") { _, _ -> waiting = false }
            .setOnDismissListener { waiting = false }
            .show()
        Thread {
            while (waiting) {
                Thread.sleep(code.intervalMs)
                if (!waiting) break
                val result = runCatching { client.pollDeviceLogin(code) }
                val error = result.exceptionOrNull()
                if (result.getOrNull() == true || error is DriveClient.LoginFailed) {
                    main.post {
                        dialog.dismiss()
                        if (error != null) {
                            Toast.makeText(this, error.message, Toast.LENGTH_LONG).show()
                        } else {
                            Toast.makeText(this, "Google Drive conectado.", Toast.LENGTH_LONG).show()
                            if (drive.mode == DriveSync.MODE_OFF) drive.mode = DriveSync.MODE_ALL
                            driveStatusText = "Drive: preparando a pasta…"
                            updateDriveButton()
                            drive.sync(shoot)
                        }
                    }
                    break
                }
            }
        }.start()
    }

    // ---- Modo cliente ----

    private val exitClientMode = Runnable { setClientMode(false) }

    private fun setClientMode(on: Boolean) {
        clientMode = on
        panel.visibility = if (on) View.GONE else View.VISIBLE
        strip.visibility = if (on) View.GONE else View.VISIBLE
        lock.visibility = if (on) View.VISIBLE else View.GONE
        viewer.frame = if (on) 0 else frameIndex
        updateRatingBar()
        setFullScreen(on)
        if (on) Toast.makeText(this, "Modo cliente. Para sair, segure o cadeado por 2 segundos.", Toast.LENGTH_LONG).show()
    }

    private fun setFullScreen(on: Boolean) {
        if (Build.VERSION.SDK_INT >= 30) {
            val controller = window.insetsController ?: return
            if (on) {
                controller.hide(WindowInsets.Type.systemBars())
                controller.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            } else {
                controller.show(WindowInsets.Type.systemBars())
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = if (on) {
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_FULLSCREEN
            } else {
                0
            }
        }
    }

    // ---- Presets e marca d'água ----

    private fun presetSignature(): String = library.activeFile?.let { "$it@${library.amount}" } ?: "none"

    private fun lookChanged(rerender: Boolean = true) {
        val entry = library.active()
        val stamp = watermark.snapshot()
        look = Look(entry?.let { PresetLook(it.preset, library.amount / 100f) }, stamp, "${presetSignature()}|${stamp?.signature ?: "-"}")
        presetButton.text = entry?.preset?.name?.let { "$it" } ?: "Sem preset"
        amountBar.isEnabled = entry != null
        amountLabel.text = "${library.amount}%"
        val ignored = entry?.preset?.ignored.orEmpty()
        presetNote.text = if (ignored.isEmpty()) "" else "Não reproduzido neste app: ${ignored.joinToString(", ")}"
        presetNote.visibility = if (ignored.isEmpty()) View.GONE else View.VISIBLE
        watermarkButton.text = when {
            stamp == null && watermark.enabled -> "Ligada, mas sem logo nem texto"
            stamp == null -> "Desligada"
            watermark.hasLogo -> "Ligada: logo"
            else -> "Ligada: \"${watermark.text.trim()}\""
        }
        presetStrip.highlight()
        if (lastAmount != library.amount) {
            if (lastAmount >= 0) presetStrip.refresh()
            lastAmount = library.amount
        }
        if (rerender) {
            rerenderCurrent()
            // Fotos já enviadas ao Drive são atualizadas com o visual novo (espera você terminar de ajustar).
            syncDriveSoon(6000)
        }
    }

    private fun choosePreset() {
        val entries = library.all()
        val names = arrayOf("Sem preset") + entries.map { it.preset.name }
        val selected = entries.indexOfFirst { it.file == library.activeFile } + 1
        AlertDialog.Builder(this)
            .setTitle("Preset")
            .setSingleChoiceItems(names, selected) { dialog, which ->
                library.activeFile = if (which == 0) null else entries[which - 1].file
                lookChanged()
                dialog.dismiss()
            }
            .setNeutralButton("Importar…") { _, _ -> importPreset() }
            .setNegativeButton("Remover o atual") { _, _ ->
                library.activeFile?.let {
                    library.remove(it)
                    presetStrip.rebuild()
                    lookChanged()
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

    private fun chooseLogo() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*")
        @Suppress("DEPRECATION")
        startActivityForResult(intent, REQUEST_LOGO)
    }

    private fun editWatermark() {
        val enabled = Switch(this).apply {
            text = "Usar marca d'água"
            isChecked = watermark.enabled
            setTextColor(Color.WHITE)
            textSize = 16f
        }
        val text = EditText(this).apply {
            hint = "Texto, usado quando não há logo (ex.: @seuestudio)"
            setText(watermark.text)
            setSingleLine()
        }
        var position = watermark.position
        val positionButton = Button(this).apply { isAllCaps = false }
        fun showPosition() {
            positionButton.text = "Posição: ${Watermark.POSITIONS[position]}  ▾"
        }
        showPosition()
        positionButton.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("Posição")
                .setSingleChoiceItems(Watermark.POSITIONS, position) { d, which ->
                    position = which
                    showPosition()
                    d.dismiss()
                }
                .show()
        }
        val sizeLabel = label("", 14f, MUTED)
        val size = slider(5, 50, watermark.size) { sizeLabel.text = "Tamanho: $it% do lado menor da foto" }
        val opacityLabel = label("", 14f, MUTED)
        val opacity = slider(10, 100, watermark.opacity) { opacityLabel.text = "Opacidade: $it%" }

        lateinit var dialog: AlertDialog
        fun save() {
            watermark.enabled = enabled.isChecked
            watermark.text = text.text.toString()
            watermark.position = position
            watermark.size = size.progress + 5
            watermark.opacity = opacity.progress + 10
        }
        val logoRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            addView(Button(this@MainActivity).apply {
                isAllCaps = false
                this.text = if (watermark.hasLogo) "Trocar logo…" else "Escolher logo (PNG)…"
                setOnClickListener {
                    save()
                    dialog.dismiss()
                    chooseLogo()
                }
            }, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
            if (watermark.hasLogo) addView(Button(this@MainActivity).apply {
                isAllCaps = false
                this.text = "Remover logo"
                setOnClickListener {
                    watermark.setLogo(null)
                    save()
                    dialog.dismiss()
                    lookChanged()
                    editWatermark()
                }
            }, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        }
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(8), dp(20), dp(8))
            addView(enabled)
            addView(label(if (watermark.hasLogo) "Logo escolhido. O texto só é usado sem logo." else "Sem logo: use um PNG com fundo transparente, ou escreva um texto.", 13f, MUTED).apply {
                setPadding(0, dp(12), 0, dp(4))
            })
            addView(logoRow)
            addView(text)
            addView(positionButton)
            addView(sizeLabel.apply { setPadding(0, dp(12), 0, 0) })
            addView(size)
            addView(opacityLabel.apply { setPadding(0, dp(8), 0, 0) })
            addView(opacity)
            addView(label("Vai nas fotos compartilhadas e na galeria do cliente. Os originais ficam sem marca.", 12f, MUTED).apply {
                setPadding(0, dp(12), 0, 0)
            })
        }
        dialog = AlertDialog.Builder(this)
            .setTitle("Marca d'água")
            .setView(ScrollView(this).apply { addView(column) })
            .setPositiveButton("Aplicar") { _, _ ->
                save()
                lookChanged()
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun slider(min: Int, max: Int, value: Int, onChange: (Int) -> Unit) = SeekBar(this).apply {
        ui.styleSlider(this)
        setPadding(dp(11), dp(12), dp(11), dp(12))
        this.max = max - min
        progress = (value - min).coerceIn(0, max - min)
        onChange(progress + min)
        setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(bar: SeekBar, p: Int, fromUser: Boolean) = onChange(p + min)
            override fun onStartTrackingTouch(bar: SeekBar) {}
            override fun onStopTrackingTouch(bar: SeekBar) {}
        })
    }

    @Deprecated("Activity sem AndroidX: o retorno do seletor de arquivos ainda chega por aqui.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode != RESULT_OK || data == null) {
            if (requestCode == REQUEST_LOGO) if (logoFor == REQUEST_BRAND) editBrand() else editWatermark()
            return
        }
        when (requestCode) {
            REQUEST_IMPORT -> importedPresets(data)
            REQUEST_LOGO -> {
                val bytes = data.data?.let { PhotoStore.readBytes(this, it) }
                val forBrand = logoFor == REQUEST_BRAND
                logoFor = REQUEST_LOGO
                if (bytes != null && watermark.setLogo(bytes)) {
                    logoCache = null
                    if (forBrand) brandSettings.useLogo = true else watermark.enabled = true
                    lookChanged()
                } else {
                    Toast.makeText(this, "Não consegui abrir essa imagem.", Toast.LENGTH_LONG).show()
                }
                if (forBrand) editBrand() else editWatermark()
            }
            REQUEST_DRIVE_JSON -> {
                val text = data.data?.let { PhotoStore.readBytes(this, it) }?.toString(Charsets.UTF_8)
                val credentials = text?.let(DriveClient::credentialsFromJson)
                if (credentials == null) {
                    Toast.makeText(this, "Esse arquivo não tem as credenciais do Google (client_id).", Toast.LENGTH_LONG).show()
                    driveSetup()
                } else {
                    drive.setCredentials(credentials.first, credentials.second)
                    driveLogin()
                }
            }
        }
    }

    private fun importedPresets(data: Intent) {
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
            presetStrip.rebuild()
            lookChanged()
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

    private fun prefs() = getSharedPreferences("sony-tether", Context.MODE_PRIVATE)

    private fun setStatus(text: String) {
        status.text = text
        status.visibility = if (text.isEmpty()) View.GONE else View.VISIBLE
    }

    /** Estado da conexão no cartão do topo: bolinha colorida, título e o botão de conectar. */
    private fun setLink(state: Int, model: String? = null) {
        connectButton.visibility = if (state == LINK_ON || state == LINK_CONNECTING) View.GONE else View.VISIBLE
        ui.setDotColor(statusDot, when (state) {
            LINK_ON -> Palette.GREEN
            LINK_CONNECTING -> Palette.GOLD
            LINK_ERROR -> Palette.RED
            else -> Palette.TEXT3
        })
        statusTitle.text = when (state) {
            LINK_ON -> model ?: "Câmera conectada"
            LINK_CONNECTING -> "Conectando…"
            LINK_ERROR -> "Conexão interrompida"
            else -> "Câmera desconectada"
        }
    }

    private fun updateCounter() {
        val n = shoot.photos.size
        val shown = visiblePhotos().size
        val hidden = shoot.photos.count { it.hidden }
        val inFilter = if (filter == 0) "" else " · $shown no filtro"
        val hiddenText = if (hidden == 0) "" else " · $hidden ${if (hidden == 1) "escondida" else "escondidas"}"
        counter.text = "$n ${if (n == 1) "foto" else "fotos"}$inFilter$hiddenText\nImagens/${PhotoStore.FOLDER}/${shoot.folder}"
        shareAllButton.text = if (filter == 0) "Compartilhar todas ($shown)" else "Compartilhar as do filtro ($shown)"
        shareAllButton.isEnabled = shown > 0
        updatePhotoInfo()
    }

    /** Nome e posição da foto da tela, na faixa de cima. */
    private fun updatePhotoInfo() {
        val photo = current
        topBar.visibility = if (photo == null || clientMode) View.GONE else View.VISIBLE
        if (photo == null) return
        photoTitle.text = photo.name
        val list = visiblePhotos()
        val index = list.indexOf(photo)
        val position = if (index >= 0) "${index + 1} de ${list.size}" else "fora do filtro"
        val mp = photo.width.toLong() * photo.height / 1_000_000
        photoInfo.text = if (mp > 0) "$position  ·  $mp MP  ·  ${photo.width} × ${photo.height}" else position
    }

    private fun highlightTiles() {
        for ((p, tile) in tiles) {
            val selected = p === current
            tile.frame.alpha = if (selected) 1f else 0.6f
            tile.frame.foreground = if (selected) ui.rounded(Color.TRANSPARENT, 8, Palette.GOLD, 2) else null
        }
    }

    private fun addTile(photo: SessionPhoto, atStart: Boolean) {
        val image = ImageView(this).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            setBackgroundColor(Palette.ROW)
        }
        val marks = ui.text("", 10f, Color.WHITE, bold = true).apply {
            background = ui.rounded(0xB3000000.toInt(), 6)
            setPadding(dp(5), dp(2), dp(5), dp(2))
            visibility = View.GONE
        }
        val frame = FrameLayout(this).apply {
            background = ui.rounded(Palette.ROW, 8)
            clipToOutline = true
            addView(image, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
            addView(marks, FrameLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT, Gravity.BOTTOM or Gravity.START).apply {
                setMargins(dp(4), 0, 0, dp(4))
            })
            layoutParams = LinearLayout.LayoutParams(dp(THUMB_H * 3 / 2), dp(THUMB_H)).apply { marginEnd = dp(8) }
            contentDescription = photo.name
            setOnClickListener { select(photo) }
            setOnLongClickListener {
                photoMenu(photo)
                true
            }
        }
        tiles[photo] = Tile(frame, image, marks)
        if (atStart) thumbs.addView(frame, 0) else thumbs.addView(frame)
        frame.visibility = if (matches(photo)) View.VISIBLE else View.GONE
        updateMarks(photo)
        highlightTiles()
    }

    private fun setThumb(photo: SessionPhoto, bitmap: Bitmap) {
        val tile = tiles[photo] ?: return
        tile.image.setImageBitmap(bitmap)
        tile.frame.layoutParams = LinearLayout.LayoutParams(dp(THUMB_H) * bitmap.width / maxOf(1, bitmap.height), dp(THUMB_H)).apply {
            marginEnd = dp(8)
        }
    }

    /** Botão redondo de ícone, para a barra de cima da foto. */
    private fun iconButton(res: Int, description: String, onClick: () -> Unit) = ImageView(this).apply {
        setImageResource(res)
        imageTintList = ColorStateList.valueOf(Color.WHITE)
        contentDescription = description
        setPadding(dp(8), dp(8), dp(8), dp(8))
        background = ui.ripple(null, 20)
        layoutParams = LinearLayout.LayoutParams(dp(40), dp(40))
        setOnClickListener { onClick() }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun buildUi() {
        viewer = ZoomImageView(this).apply { listener = this@MainActivity }

        // Sem foto: ícone, título e o que fazer.
        hint = ui.text("Conecte a câmera Sony pelo cabo USB", 20f, Palette.TEXT, bold = true).apply { gravity = Gravity.CENTER }
        emptyState = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(32), 0, dp(32), dp(40))
            addView(FrameLayout(this@MainActivity).apply {
                background = ui.rounded(Palette.CARD, 48, Palette.STROKE)
                addView(ui.icon(R.drawable.ic_camera, Palette.GOLD, 44), FrameLayout.LayoutParams(dp(44), dp(44), Gravity.CENTER))
            }, LinearLayout.LayoutParams(dp(96), dp(96)))
            addView(hint, ui.wrap(24))
            addView(ui.text(
                "Cabo USB-C na câmera · Conexão USB: PC Remoto\nCada foto aparece aqui assim que você dispara.",
                14f, Palette.TEXT2,
            ).apply { gravity = Gravity.CENTER }, ui.wrap(10))
        }

        badge = ui.pill("ORIGINAL", 0xFF1A1307.toInt(), Palette.GOLD).apply { visibility = View.GONE }

        heart = iconButton(R.drawable.ic_favorite_border, "Favorita") { toggleFavorite() }
        stars = (1..5).map { n -> iconButton(R.drawable.ic_star_border, "$n estrelas") { rate(n) }.apply { setPadding(dp(9), dp(9), dp(9), dp(9)) } }
        hideButton = iconButton(R.drawable.ic_visibility_off, "Esconder") { toggleHidden() }
        val trash = iconButton(R.drawable.ic_delete_outline, "Apagar") { confirmDelete() }
        ratingBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = ui.rounded(0xB31B1B21.toInt(), 24, 0x26FFFFFF)
            setPadding(dp(4), dp(2), dp(4), dp(2))
            addView(heart)
            stars.forEach { addView(it) }
            addView(View(this@MainActivity).apply { setBackgroundColor(0x33FFFFFF) }, LinearLayout.LayoutParams(dp(1), dp(22)).apply {
                marginStart = dp(6)
                marginEnd = dp(6)
            })
            addView(hideButton)
            addView(trash)
        }
        photoTitle = ui.text("", 16f, Color.WHITE, bold = true).apply { isSingleLine = true }
        photoInfo = ui.text("", 12f, 0xCCFFFFFF.toInt()).apply { isSingleLine = true }
        topBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = ui.gradient(GradientDrawable.Orientation.TOP_BOTTOM, 0xB3000000.toInt(), 0x00000000)
            setPadding(dp(20), dp(14), dp(14), dp(32))
            addView(LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.VERTICAL
                addView(photoTitle)
                addView(photoInfo, ui.wrap(4))
            }, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
            addView(ratingBar)
            visibility = View.GONE
        }

        thumbs = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(16), dp(28), dp(8), dp(14))
        }
        strip = HorizontalScrollView(this).apply {
            background = ui.gradient(GradientDrawable.Orientation.BOTTOM_TOP, 0xE6000000.toInt(), 0x00000000)
            isHorizontalScrollBarEnabled = false
            addView(thumbs)
        }
        lock = ImageView(this).apply {
            setImageResource(R.drawable.ic_lock)
            imageTintList = ColorStateList.valueOf(Color.WHITE)
            contentDescription = "Sair do modo cliente (segure)"
            setPadding(dp(14), dp(14), dp(14), dp(14))
            background = ui.rounded(0x80000000.toInt(), 26, 0x33FFFFFF)
            alpha = 0.5f
            visibility = View.GONE
            setOnTouchListener { _, e ->
                when (e.actionMasked) {
                    MotionEvent.ACTION_DOWN -> {
                        alpha = 1f
                        main.postDelayed(exitClientMode, 2000)
                    }
                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                        alpha = 0.5f
                        if (clientMode) {
                            main.removeCallbacks(exitClientMode)
                            Toast.makeText(this@MainActivity, "Segure o cadeado por 2 segundos para sair.", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
                true
            }
        }

        stage = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
            addView(viewer, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
            addView(emptyState, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
            addView(topBar, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.TOP))
            addView(badge, FrameLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT, Gravity.TOP or Gravity.CENTER_HORIZONTAL).apply {
                topMargin = dp(84)
            })
            addView(strip, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.BOTTOM))
            addView(lock, FrameLayout.LayoutParams(dp(52), dp(52), Gravity.BOTTOM or Gravity.END).apply {
                setMargins(0, 0, dp(20), dp(20))
            })
        }

        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(20), dp(16), dp(24))
        }

        // Cabeçalho: marca, nome e versão.
        column.addView(LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(4), 0, dp(4), dp(18))
            addView(FrameLayout(this@MainActivity).apply {
                background = ui.gradient(GradientDrawable.Orientation.TL_BR, 0xFF2A2214.toInt(), 0xFF16130D.toInt(), radiusDp = 12)
                addView(ui.icon(R.drawable.ic_camera, Palette.GOLD, 24), FrameLayout.LayoutParams(dp(24), dp(24), Gravity.CENTER))
            }, LinearLayout.LayoutParams(dp(42), dp(42)))
            addView(LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(12), 0, 0, 0)
                addView(ui.text("Sony Tether", 19f, Palette.TEXT, bold = true))
                addView(ui.text("Tethering para Sony Alpha", 12f, Palette.TEXT3), ui.wrap(3))
            }, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
            addView(ui.pill(BuildConfig.VERSION_NAME.replace("-beta", " BETA"), Palette.GOLD, 0x14E9B45A, 0x55E9B45A))
        })

        // Câmera: estado da conexão.
        statusDot = ui.dot(Palette.TEXT3)
        statusTitle = ui.text("Câmera desconectada", 16f, Palette.TEXT, bold = true)
        status = ui.text("Ligue o cabo USB-C e coloque a câmera em PC Remoto.", 13f, Palette.TEXT2)
        connectButton = ui.primary(R.drawable.ic_usb, "Conectar câmera") {
            askedPermissionFor = null
            connect()
        }
        column.addView(ui.card().apply {
            addView(LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                addView(statusDot)
                addView(statusTitle, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f).apply { marginStart = dp(10) })
                addView(ImageView(this@MainActivity).apply {
                    setImageResource(R.drawable.ic_bug_report)
                    imageTintList = ColorStateList.valueOf(Palette.TEXT3)
                    contentDescription = "Diagnóstico"
                    setPadding(dp(6), dp(6), dp(6), dp(6))
                    background = ui.ripple(null, 16)
                    setOnClickListener { showDiagnostics() }
                }, LinearLayout.LayoutParams(dp(32), dp(32)))
            })
            addView(status, ui.wrap(8))
            addView(connectButton, ui.matchWidth(48, 14))
        }, ui.wrap())

        // Sessão
        sessionButton = ui.row(R.drawable.ic_folder, "") { chooseSession() }
        filterButton = ui.row(R.drawable.ic_filter_list, "") { chooseFilter() }
        counter = ui.text("Nenhuma foto ainda", 12f, Palette.TEXT3)
        column.addView(ui.card().apply {
            addView(ui.cardTitle(R.drawable.ic_photo_library, "Sessão"))
            addView(sessionButton, ui.matchWidth(48))
            addView(filterButton, ui.matchWidth(48, 8))
            addView(counter, ui.wrap(12))
        }, ui.wrap(12))

        // Preset
        presetStrip = PresetStrip(this, ui, library) { file ->
            library.activeFile = file
            lookChanged()
        }
        presetButton = ui.row(R.drawable.ic_tune, "Sem preset") { choosePreset() }
        amountLabel = ui.text("", 13f, Palette.GOLD, bold = true)
        amountBar = SeekBar(this).apply {
            max = 100
            progress = library.amount
            ui.styleSlider(this)
            setPadding(dp(11), dp(12), dp(11), dp(12))
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(bar: SeekBar, value: Int, fromUser: Boolean) {
                    amountLabel.text = "$value%"
                }

                override fun onStartTrackingTouch(bar: SeekBar) {}

                override fun onStopTrackingTouch(bar: SeekBar) {
                    library.amount = bar.progress
                    lookChanged()
                }
            })
        }
        presetNote = ui.text("", 12f, Palette.TEXT3)
        column.addView(ui.card().apply {
            addView(ui.cardTitle(R.drawable.ic_auto_awesome, "Preset do Lightroom"))
            addView(presetStrip.view, ui.wrap(2).apply { bottomMargin = dp(12) })
            addView(presetButton, ui.matchWidth(48))
            addView(ui.row(R.drawable.ic_upload_file, "Importar preset…", chevron = false) { importPreset() }, ui.matchWidth(48, 8))
            addView(LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.HORIZONTAL
                addView(ui.text("Intensidade", 13f, Palette.TEXT2), LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
                addView(amountLabel)
            }, ui.wrap(16))
            addView(amountBar, ui.wrap(4))
            addView(presetNote, ui.wrap(4))
        }, ui.wrap(12))

        // Marca d'água
        watermarkButton = ui.row(R.drawable.ic_branding_watermark, "Desligada") { editWatermark() }
        column.addView(ui.card().apply {
            addView(ui.cardTitle(R.drawable.ic_branding_watermark, "Marca d'água"))
            addView(watermarkButton, ui.matchWidth(48))
        }, ui.wrap(12))

        // Foto da tela
        frameButton = ui.row(R.drawable.ic_crop, "Moldura: Nenhuma") { chooseFrame() }
        hidePanelButton = ui.row(R.drawable.ic_visibility_off, "Esconder", chevron = false) { toggleHidden() }
        deletePanelButton = ui.row(R.drawable.ic_delete_outline, "Apagar", chevron = false, color = Palette.RED) { confirmDelete() }
        column.addView(ui.card().apply {
            addView(ui.cardTitle(R.drawable.ic_photo_camera, "Foto da tela"))
            addView(LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.HORIZONTAL
                addView(hidePanelButton, LinearLayout.LayoutParams(0, dp(48), 1f))
                addView(deletePanelButton, LinearLayout.LayoutParams(0, dp(48), 1f).apply { marginStart = dp(8) })
            })
            addView(frameButton, ui.matchWidth(48, 8))
        }, ui.wrap(12))

        // Entregar
        shareButton = ui.primary(R.drawable.ic_share, "Compartilhar esta foto") { current?.let { share(listOf(it)) } }
        shareButton.isEnabled = false
        shareAllButton = ui.row(R.drawable.ic_photo_library, "Compartilhar todas (0)", chevron = false) { share(visiblePhotos()) }
        shareAllButton.isEnabled = false
        qrButton = ui.row(R.drawable.ic_qr_code_2, "QR code para o cliente") { showQr() }
        slideshowButton = ui.row(R.drawable.ic_tv, "Slideshow para TV") { showSlideshow() }
        driveButton = ui.row(R.drawable.ic_cloud_upload, "Google Drive: conectar") { driveDialog() }
        driveStatusLabel = ui.text("", 12f, Palette.TEXT3).apply { setPadding(dp(4), 0, dp(4), 0) }
        brandButton = ui.row(R.drawable.ic_storefront, "Sua marca na galeria") { editBrand() }
        column.addView(ui.card().apply {
            addView(ui.cardTitle(R.drawable.ic_share, "Entregar"))
            addView(shareButton, ui.matchWidth(50))
            addView(shareAllButton, ui.matchWidth(48, 8))
            addView(qrButton, ui.matchWidth(48, 8))
            addView(slideshowButton, ui.matchWidth(48, 8))
            addView(driveButton, ui.matchWidth(48, 8))
            addView(driveStatusLabel, ui.wrap(6))
            addView(brandButton, ui.matchWidth(48, 8))
            addView(ui.row(R.drawable.ic_fullscreen, "Modo cliente (tela cheia)") { setClientMode(true) }, ui.matchWidth(48, 8))
        }, ui.wrap(12))

        column.addView(ui.text(
            "Dois toques: zoom 100% para conferir o foco · pinça amplia · deslize para trocar de foto · " +
                "segure para ver sem o preset · segure uma miniatura para esconder ou apagar",
            12f, Palette.TEXT3,
        ).apply { setPadding(dp(4), 0, dp(4), 0) }, ui.wrap(16))

        panel = ScrollView(this).apply {
            setBackgroundColor(Palette.PANEL)
            isVerticalScrollBarEnabled = false
            addView(column)
        }
        root = LinearLayout(this).apply {
            setBackgroundColor(Palette.PANEL)
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

    private fun label(text: String, sp: Float, color: Int) = TextView(this).apply {
        this.text = text
        setTextColor(color)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    @Suppress("DEPRECATION")
    private fun Intent.usbDevice(): UsbDevice? =
        if (Build.VERSION.SDK_INT >= 33) getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
        else getParcelableExtra(UsbManager.EXTRA_DEVICE)

    private companion object {
        const val ACTION_USB_PERMISSION = "com.phill.sonytether.USB_PERMISSION"
        const val SONY_VENDOR_ID = 0x054C
        const val REQUEST_IMPORT = 1
        const val REQUEST_LOGO = 2
        const val REQUEST_DRIVE_JSON = 3
        const val REQUEST_BRAND = 4
        const val KEY_SLIDE_MODE = "slideMode"
        const val KEY_FRAME = "frame"
        const val SCREEN_PX = 1920
        const val KEY_FILTER = "filter"
        const val RETRY_MIN_MS = 3000L
        const val RETRY_MAX_MS = 20000L
        const val GALLERY_THUMB_PX = 480
        val FILTERS = arrayOf("Todas", "Favoritas", "3★ ou mais", "5★", "Escondidas")
        const val FILTER_HIDDEN = 4
        const val MUTED = Palette.TEXT2
        const val THUMB_H = 64
        const val LINK_OFF = 0
        const val LINK_CONNECTING = 1
        const val LINK_ON = 2
        const val LINK_ERROR = 3
    }
}
