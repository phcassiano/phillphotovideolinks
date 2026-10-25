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

class MainActivity : Activity(), CameraSession.Listener, ZoomImageView.Listener, GalleryServer.Source {

    private lateinit var usb: UsbManager
    private lateinit var library: PresetLibrary
    private lateinit var sessions: SessionStore
    private lateinit var watermark: Watermark
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

    private lateinit var root: LinearLayout
    private lateinit var stage: FrameLayout
    private lateinit var panel: ScrollView
    private lateinit var viewer: ZoomImageView
    private lateinit var hint: TextView
    private lateinit var badge: TextView
    private lateinit var ratingBar: LinearLayout
    private lateinit var heart: TextView
    private lateinit var stars: List<TextView>
    private lateinit var hideButton: TextView
    private lateinit var hidePanelButton: Button
    private lateinit var deletePanelButton: Button
    private lateinit var strip: HorizontalScrollView
    private lateinit var thumbs: LinearLayout
    private lateinit var lock: TextView
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
        filter = prefs().getInt(KEY_FILTER, 0).coerceIn(FILTERS.indices)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        buildUi()
        applyOrientation(resources.configuration)
        setConnected(false)
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
        setConnected(true)
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
        setConnected(false)
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
        hint.visibility = View.VISIBLE
        hint.text = if (camera != null) "Pronto. Dispare na câmera para ver a primeira foto." else "Conecte a câmera Sony pelo cabo USB"
        updateRatingBar()
        shareButton.isEnabled = false
        sessionButton.text = "${s.label}  ▾"
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
        hint.visibility = View.GONE
        for ((p, tile) in tiles) tile.frame.alpha = if (p === photo) 1f else 0.55f
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
        s.photos.remove(photo)
        tiles.remove(photo)?.let { thumbs.removeView(it.frame) }
        saveSession()
        thumbCache.clear()
        updateCounter()
        refreshGallery()
        if (current === photo) showNeighbor(photo, before)
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
        hint.visibility = View.VISIBLE
        shareButton.isEnabled = false
        updateRatingBar()
    }

    private fun ratingChanged(photo: SessionPhoto) {
        saveSession()
        updateRatingBar()
        updateMarks(photo)
        applyFilter()
    }

    private fun updateRatingBar() {
        updatePhotoButtons()
        val photo = current
        ratingBar.visibility = if (photo == null || clientMode) View.GONE else View.VISIBLE
        if (photo == null) return
        heart.text = if (photo.favorite) "♥" else "♡"
        heart.setTextColor(if (photo.favorite) FAVORITE else Color.WHITE)
        stars.forEachIndexed { i, star ->
            star.text = if (i < photo.rating) "★" else "☆"
            star.setTextColor(if (i < photo.rating) ACCENT else Color.WHITE)
        }
        hideButton.text = if (photo.hidden) "👁" else "⊘"
        hideButton.contentDescription = if (photo.hidden) "Mostrar de novo" else "Esconder"
    }

    /** Botões do painel para a foto da tela; ficam desligados sem foto. */
    private fun updatePhotoButtons() {
        val photo = current
        hidePanelButton.isEnabled = photo != null
        deletePanelButton.isEnabled = photo != null
        hidePanelButton.text = if (photo?.hidden == true) "👁  Mostrar de novo" else "⊘  Esconder esta foto"
        hidePanelButton.alpha = if (photo != null) 1f else 0.4f
        deletePanelButton.alpha = if (photo != null) 1f else 0.4f
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
        filterButton.text = "Mostrar: ${FILTERS[filter]}  ▾"
        updateCounter()
        refreshGallery()
    }

    // ---- Galeria do cliente (QR code) ----

    private fun refreshGallery() {
        galleryPhotos = visiblePhotos()
    }

    override val galleryTitle: String get() = shoot.name

    override fun items(): List<Pair<Int, String>> = galleryPhotos.map { it.number to it.name }

    /** Prepara no [processor] (o mesmo que revela as fotos) e espera; roda numa thread do servidor. */
    private fun preparedUri(number: Int): Uri? {
        val photo = galleryPhotos.firstOrNull { it.number == number } ?: return null
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
        val server = server ?: GalleryServer(this).also { server = it }
        try {
            server.start()
        } catch (e: Exception) {
            Toast.makeText(this, "Não foi possível abrir a galeria: ${e.message}", Toast.LENGTH_LONG).show()
            return
        }
        updateQrButton()
        val url = server.url()
        if (url == null) {
            AlertDialog.Builder(this)
                .setTitle("Sem rede Wi-Fi")
                .setMessage("Ligue o Wi-Fi do tablet (na mesma rede do celular do cliente) ou o ponto de acesso do tablet e tente de novo. Não precisa de internet.")
                .setPositiveButton("OK", null)
                .show()
            return
        }
        val qr = ImageView(this).apply {
            setImageBitmap(QrCode.encode(url).toBitmap(12))
            scaleType = ImageView.ScaleType.FIT_CENTER
        }
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(12), dp(20), dp(4))
            addView(qr, LinearLayout.LayoutParams(MATCH_PARENT, dp(300)))
            addView(label(url, 15f, Color.WHITE).apply {
                gravity = Gravity.CENTER
                setTextIsSelectable(true)
                setPadding(0, dp(12), 0, dp(8))
            })
            addView(label(
                "O cliente aponta a câmera do celular para o código. O celular precisa estar no mesmo Wi-Fi do " +
                    "tablet (ou no ponto de acesso dele); não precisa de internet. A página mostra as fotos do " +
                    "filtro \"${FILTERS[filter]}\" (${galleryPhotos.size}), com preset e marca d'água, e se atualiza " +
                    "quando o cliente puxa a página.",
                13f, MUTED,
            ))
        }
        AlertDialog.Builder(this)
            .setTitle("Galeria para o cliente")
            .setView(ScrollView(this).apply { addView(column) })
            .setPositiveButton("Fechar", null)
            .setNegativeButton("Desligar galeria") { _, _ ->
                server.stop()
                this.server = null
                updateQrButton()
                setStatus("Galeria do cliente desligada.")
            }
            .show()
    }

    private fun updateQrButton() {
        qrButton.text = if (server?.running == true) "QR code para o cliente (no ar)" else "QR code para o cliente"
    }

    // ---- Modo cliente ----

    private val exitClientMode = Runnable { setClientMode(false) }

    private fun setClientMode(on: Boolean) {
        clientMode = on
        panel.visibility = if (on) View.GONE else View.VISIBLE
        strip.visibility = if (on) View.GONE else View.VISIBLE
        lock.visibility = if (on) View.VISIBLE else View.GONE
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
        presetButton.text = entry?.preset?.name?.let { "$it  ▾" } ?: "Sem preset  ▾"
        amountBar.isEnabled = entry != null
        amountLabel.text = "Intensidade: ${library.amount}%"
        val ignored = entry?.preset?.ignored.orEmpty()
        presetNote.text = if (ignored.isEmpty()) "" else "Não reproduzido neste app: ${ignored.joinToString(", ")}"
        presetNote.visibility = if (ignored.isEmpty()) View.GONE else View.VISIBLE
        watermarkButton.text = when {
            stamp == null && watermark.enabled -> "Ligada, mas sem logo nem texto  ▾"
            stamp == null -> "Desligada  ▾"
            watermark.hasLogo -> "Ligada: logo  ▾"
            else -> "Ligada: \"${watermark.text.trim()}\"  ▾"
        }
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
                lookChanged()
                dialog.dismiss()
            }
            .setNeutralButton("Importar…") { _, _ -> importPreset() }
            .setNegativeButton("Remover o atual") { _, _ ->
                library.activeFile?.let {
                    library.remove(it)
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
            if (requestCode == REQUEST_LOGO) editWatermark()
            return
        }
        when (requestCode) {
            REQUEST_IMPORT -> importedPresets(data)
            REQUEST_LOGO -> {
                val bytes = data.data?.let { PhotoStore.readBytes(this, it) }
                if (bytes != null && watermark.setLogo(bytes)) {
                    watermark.enabled = true
                    lookChanged()
                } else {
                    Toast.makeText(this, "Não consegui abrir essa imagem.", Toast.LENGTH_LONG).show()
                }
                editWatermark()
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
    }

    private fun setConnected(connected: Boolean) {
        connectButton.visibility = if (connected) View.GONE else View.VISIBLE
    }

    private fun updateCounter() {
        val n = shoot.photos.size
        val shown = visiblePhotos().size
        val hidden = shoot.photos.count { it.hidden }
        val inFilter = if (filter == 0) "" else " ($shown no filtro)"
        val hiddenText = if (hidden == 0) "" else " · $hidden ${if (hidden == 1) "escondida" else "escondidas"}"
        counter.text = "$n ${if (n == 1) "foto" else "fotos"}$inFilter$hiddenText · Imagens/${PhotoStore.FOLDER}/${shoot.folder}"
        shareAllButton.text = if (filter == 0) "Compartilhar todas ($shown)" else "Compartilhar as do filtro ($shown)"
        shareAllButton.isEnabled = shown > 0
    }

    private fun addTile(photo: SessionPhoto, atStart: Boolean) {
        val image = ImageView(this).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            setBackgroundColor(SURFACE)
        }
        val marks = label("", 11f, Color.WHITE).apply {
            typeface = Typeface.DEFAULT_BOLD
            background = rounded(0xB0000000.toInt(), dp(3))
            setPadding(dp(4), dp(1), dp(4), dp(1))
            visibility = View.GONE
        }
        val frame = FrameLayout(this).apply {
            addView(image, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
            addView(marks, FrameLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT, Gravity.BOTTOM or Gravity.START).apply {
                setMargins(dp(3), 0, 0, dp(3))
            })
            layoutParams = LinearLayout.LayoutParams(dp(96), dp(72)).apply { marginEnd = dp(6) }
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
    }

    private fun setThumb(photo: SessionPhoto, bitmap: Bitmap) {
        val tile = tiles[photo] ?: return
        tile.image.setImageBitmap(bitmap)
        tile.frame.layoutParams = LinearLayout.LayoutParams(dp(72) * bitmap.width / maxOf(1, bitmap.height), dp(72)).apply {
            marginEnd = dp(6)
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun buildUi() {
        viewer = ZoomImageView(this).apply { listener = this@MainActivity }
        hint = label("Conecte a câmera Sony pelo cabo USB", 18f, MUTED).apply { gravity = Gravity.CENTER }
        badge = label("ORIGINAL", 13f, Color.WHITE).apply {
            typeface = Typeface.DEFAULT_BOLD
            background = rounded(0xCC000000.toInt(), dp(4))
            setPadding(dp(10), dp(4), dp(10), dp(4))
            visibility = View.GONE
        }
        heart = label("♡", 26f, Color.WHITE).apply {
            setPadding(dp(8), 0, dp(10), 0)
            setOnClickListener { toggleFavorite() }
        }
        stars = (1..5).map { n ->
            label("☆", 26f, Color.WHITE).apply {
                setPadding(dp(3), 0, dp(3), 0)
                setOnClickListener { rate(n) }
            }
        }
        hideButton = label("⊘", 24f, Color.WHITE).apply {
            contentDescription = "Esconder"
            setPadding(dp(14), 0, dp(8), 0)
            setOnClickListener { toggleHidden() }
        }
        val trash = label("🗑", 22f, Color.WHITE).apply {
            contentDescription = "Apagar"
            setPadding(dp(8), 0, dp(6), 0)
            setOnClickListener { confirmDelete() }
        }
        ratingBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = rounded(0x99000000.toInt(), dp(22))
            setPadding(dp(8), dp(2), dp(10), dp(4))
            addView(heart)
            stars.forEach { addView(it) }
            addView(View(this@MainActivity).apply { setBackgroundColor(0x55FFFFFF) }, LinearLayout.LayoutParams(dp(1), dp(24)).apply {
                marginStart = dp(10)
            })
            addView(hideButton)
            addView(trash)
            visibility = View.GONE
        }
        thumbs = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(8), dp(8), dp(8), dp(8))
        }
        strip = HorizontalScrollView(this).apply {
            setBackgroundColor(0xAA000000.toInt())
            addView(thumbs)
        }
        lock = label("🔒", 22f, Color.WHITE).apply {
            gravity = Gravity.CENTER
            alpha = 0.45f
            background = rounded(0x66000000, dp(24))
            visibility = View.GONE
            setOnTouchListener { _, e ->
                when (e.actionMasked) {
                    MotionEvent.ACTION_DOWN -> {
                        alpha = 1f
                        main.postDelayed(exitClientMode, 2000)
                    }
                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                        alpha = 0.45f
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
            addView(hint, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
            addView(badge, FrameLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT, Gravity.TOP or Gravity.START).apply {
                setMargins(dp(16), dp(16), 0, 0)
            })
            addView(ratingBar, FrameLayout.LayoutParams(WRAP_CONTENT, dp(44), Gravity.TOP or Gravity.END).apply {
                setMargins(0, dp(12), dp(12), 0)
            })
            addView(strip, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.BOTTOM))
            addView(lock, FrameLayout.LayoutParams(dp(48), dp(48), Gravity.BOTTOM or Gravity.END).apply {
                setMargins(0, 0, dp(16), dp(16))
            })
        }

        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(20), dp(20), dp(20))
        }
        column.addView(label("Sony Tether", 22f, Color.WHITE).apply { typeface = Typeface.DEFAULT_BOLD })
        column.addView(label("versão ${BuildConfig.VERSION_NAME}", 12f, MUTED))
        status = label("", 14f, MUTED).apply { setPadding(0, dp(6), 0, dp(12)) }
        column.addView(status)
        connectButton = button("Conectar câmera", ACCENT, Color.BLACK) {
            askedPermissionFor = null
            connect()
        }
        column.addView(connectButton, fullWidth(dp(48)))
        column.addView(button("Diagnóstico", SURFACE, MUTED) { showDiagnostics() }, fullWidth(dp(40)).apply { topMargin = dp(8) })

        column.addView(section("SESSÃO"))
        sessionButton = button("", SURFACE, Color.WHITE) { chooseSession() }
        column.addView(sessionButton, fullWidth(dp(48)))
        filterButton = button("", SURFACE, Color.WHITE) { chooseFilter() }
        column.addView(filterButton, fullWidth(dp(44)).apply { topMargin = dp(8) })

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
                    lookChanged()
                }
            })
        }
        column.addView(amountBar, fullWidth(WRAP_CONTENT))
        presetNote = label("", 12f, MUTED).apply { setPadding(0, dp(6), 0, 0) }
        column.addView(presetNote)

        column.addView(section("MARCA D'ÁGUA"))
        watermarkButton = button("Desligada  ▾", SURFACE, Color.WHITE) { editWatermark() }
        column.addView(watermarkButton, fullWidth(dp(48)))

        column.addView(section("FOTO DA TELA"))
        hidePanelButton = button("⊘  Esconder esta foto", SURFACE, Color.WHITE) { toggleHidden() }
        column.addView(hidePanelButton, fullWidth(dp(44)))
        deletePanelButton = button("🗑  Apagar esta foto", SURFACE, DANGER) { confirmDelete() }
        column.addView(deletePanelButton, fullWidth(dp(44)).apply { topMargin = dp(8) })

        column.addView(section("COMPARTILHAR"))
        shareButton = button("Compartilhar esta foto", ACCENT, Color.BLACK) { current?.let { share(listOf(it)) } }
        shareButton.isEnabled = false
        column.addView(shareButton, fullWidth(dp(52)))
        shareAllButton = button("Compartilhar todas (0)", SURFACE, Color.WHITE) { share(visiblePhotos()) }
        shareAllButton.isEnabled = false
        column.addView(shareAllButton, fullWidth(dp(44)).apply { topMargin = dp(8) })

        column.addView(section("CLIENTE"))
        qrButton = button("QR code para o cliente", SURFACE, Color.WHITE) { showQr() }
        column.addView(qrButton, fullWidth(dp(48)))
        column.addView(button("Modo cliente (tela cheia)", SURFACE, Color.WHITE) { setClientMode(true) }, fullWidth(dp(44)).apply {
            topMargin = dp(8)
        })

        counter = label("Nenhuma foto ainda", 13f, MUTED).apply { setPadding(0, dp(16), 0, 0) }
        column.addView(counter, fullWidth(WRAP_CONTENT))
        column.addView(label(
            "Dois toques: zoom 100% para conferir o foco · pinça amplia · deslize para trocar de foto · segure para ver sem o preset · ⊘ esconde e 🗑 apaga a foto",
            12f, MUTED,
        ).apply { setPadding(0, dp(8), 0, 0) }, fullWidth(WRAP_CONTENT))

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
        const val REQUEST_LOGO = 2
        const val KEY_FILTER = "filter"
        const val RETRY_MIN_MS = 3000L
        const val RETRY_MAX_MS = 20000L
        const val GALLERY_THUMB_PX = 480
        val FILTERS = arrayOf("Todas", "Favoritas", "3★ ou mais", "5★", "Escondidas")
        const val FILTER_HIDDEN = 4
        const val PANEL = 0xFF16161A.toInt()
        const val SURFACE = 0xFF2A2A31.toInt()
        const val ACCENT = 0xFFE8A33D.toInt()
        const val FAVORITE = 0xFFFF5A6E.toInt()
        const val DANGER = 0xFFFF6B6B.toInt()
        const val MUTED = 0xFF9A9AA5.toInt()
    }
}
