package com.phill.sonytether

import android.content.Context
import android.os.Handler
import android.os.Looper
import java.io.IOException
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Mantém a pasta da sessão no Google Drive igual às fotos do app: envia as novas, atualiza as
 * que mudaram de preset ou marca d'água e manda para a lixeira do Drive as escondidas e apagadas.
 * Sem internet, espera e tenta de novo; nada se perde, porque o que falta enviar é recalculado
 * a partir das fotos da sessão.
 */
class DriveSync(context: Context, private val host: Host) {

    interface Host {
        /** JPEG para entregar e a assinatura do visual com que foi feito. Roda fora da thread da tela. */
        fun deliverable(photo: SessionPhoto, session: ShootSession): Pair<ByteArray, String>?

        /** Assinatura do visual atual (preset, intensidade, marca d'água). */
        val signature: String

        /** A sessão mudou (pasta, ids no Drive): salvar. Chamado na thread da tela. */
        fun driveChanged(session: ShootSession)

        /** Texto de estado para o painel. Chamado na thread da tela. */
        fun driveStatus(text: String)
    }

    private val prefs = context.getSharedPreferences("sony-tether", Context.MODE_PRIVATE)
    private val main = Handler(Looper.getMainLooper())
    private val worker = Executors.newSingleThreadExecutor()
    private val running = AtomicBoolean(false)
    private val again = AtomicBoolean(false)
    private var retryDelay = RETRY_MIN_MS
    private var pending: Pair<ShootSession, List<SessionPhoto>>? = null
    private val retry = Runnable { pending?.let { (s, list) -> start(s, list) } }

    private val tokens = object : DriveClient.Tokens {
        override var refreshToken: String?
            get() = prefs.getString("drive.refresh", null)
            set(value) = prefs.edit().putString("drive.refresh", value).apply()
        override var accessToken: String?
            get() = prefs.getString("drive.access", null)
            set(value) = prefs.edit().putString("drive.access", value).apply()
        override var expiresAt: Long
            get() = prefs.getLong("drive.expires", 0)
            set(value) = prefs.edit().putLong("drive.expires", value).apply()
    }

    var clientId: String
        get() = prefs.getString("drive.clientId", "") ?: ""
        private set(value) = prefs.edit().putString("drive.clientId", value).apply()

    var clientSecret: String
        get() = prefs.getString("drive.clientSecret", "") ?: ""
        private set(value) = prefs.edit().putString("drive.clientSecret", value).apply()

    /** 0 = desligado, 1 = todas as fotos, 2 = só as favoritas. */
    var mode: Int
        get() = prefs.getInt("drive.mode", MODE_ALL)
        set(value) = prefs.edit().putInt("drive.mode", value).apply()

    val hasCredentials get() = clientId.isNotBlank()

    val client: DriveClient? get() = if (hasCredentials) DriveClient(clientId, clientSecret, tokens) else null

    val connected get() = client?.connected == true

    val active get() = connected && mode != MODE_OFF

    fun setCredentials(id: String, secret: String) {
        if (id != clientId) tokens.refreshToken = null
        clientId = id.trim()
        clientSecret = secret.trim()
    }

    fun signOut() = client?.signOut()

    fun eligible(p: SessionPhoto) = !p.deleted && !p.hidden && when (mode) {
        MODE_ALL -> true
        MODE_FAVORITES -> p.favorite
        else -> false
    }

    /** Arquivo de uma foto apagada no app: vai para a lixeira do Drive na próxima rodada. */
    fun forget(driveId: String) {
        val set = prefs.getStringSet("drive.trash", emptySet())!!.toMutableSet()
        set += driveId
        prefs.edit().putStringSet("drive.trash", set).apply()
    }

    /** Pede uma rodada de sincronização da sessão (na thread da tela). */
    fun sync(session: ShootSession) {
        if (!active) return
        start(session, session.photos.toList())
    }

    private fun start(session: ShootSession, photos: List<SessionPhoto>) {
        main.removeCallbacks(retry)
        pending = session to photos
        if (!running.compareAndSet(false, true)) {
            again.set(true)
            return
        }
        worker.execute { loop() }
    }

    private fun loop() {
        while (true) {
            again.set(false)
            val (session, photos) = pending ?: break
            val drive = client ?: break
            try {
                pass(drive, session, photos)
                retryDelay = RETRY_MIN_MS
            } catch (e: DriveClient.LoginFailed) {
                status(e.message ?: "Conecte o Google Drive de novo.")
                break
            } catch (e: IOException) {
                val wait = retryDelay
                retryDelay = (retryDelay * 2).coerceAtMost(RETRY_MAX_MS)
                status("Drive: sem conexão (${e.message?.take(60) ?: "erro"}). Tentando de novo em ${wait / 1000} s.")
                main.postDelayed(retry, wait)
                break
            } catch (e: Exception) {
                status("Drive: erro inesperado: ${e.message ?: e.javaClass.simpleName}")
                break
            }
            if (!again.get()) break
        }
        running.set(false)
        if (again.get()) pending?.let { (s, list) -> main.post { start(s, list) } }
    }

    private fun pass(drive: DriveClient, session: ShootSession, photos: List<SessionPhoto>) {
        val folder = folderFor(drive, session, photos)

        val trash = prefs.getStringSet("drive.trash", emptySet())!!.toMutableSet()
        for (id in trash.toList()) {
            drive.trash(id)
            trash -= id
            prefs.edit().putStringSet("drive.trash", trash).apply()
        }

        val wanted = photos.filter(::eligible)
        var done = wanted.count { it.driveId != null && it.driveWith == host.signature }
        for (p in photos) {
            if (again.get()) return // chegou foto nova ou algo mudou: recomeça com a lista atual
            val id = p.driveId
            if (!eligible(p)) {
                if (id != null) {
                    drive.trash(id)
                    p.driveId = null
                    p.driveWith = null
                    changed(session)
                }
                continue
            }
            if (id != null && p.driveWith == host.signature) continue
            status("Drive: enviando ${p.name} (${done + 1} de ${wanted.size})…")
            val (jpeg, signature) = host.deliverable(p, session) ?: continue
            val name = p.name.substringBeforeLast('.') + ".jpg"
            if (id == null) {
                p.driveId = drive.upload(name, folder, jpeg)
            } else {
                try {
                    drive.update(id, jpeg)
                } catch (e: DriveClient.HttpException) {
                    if (e.code != 404) throw e
                    p.driveId = drive.upload(name, folder, jpeg) // apagaram no Drive: envia de novo
                }
            }
            p.driveWith = signature
            if (id == null || signature == host.signature) done++
            changed(session)
        }
        status(if (wanted.isEmpty()) "Drive: nada para enviar ainda." else "Drive: $done de ${wanted.size} fotos enviadas.")
    }

    /** Pasta "Sony Tether / <sessão>", criada e compartilhada por link na primeira vez. */
    private fun folderFor(drive: DriveClient, session: ShootSession, photos: List<SessionPhoto>): String {
        session.driveFolder?.let { if (checked == it || drive.exists(it)) return it.also { checked = it } }
        val root = prefs.getString("drive.root", null)?.takeIf { drive.exists(it) }
            ?: drive.createFolder(ROOT_NAME, null).also { prefs.edit().putString("drive.root", it).apply() }
        val folder = drive.createFolder(session.folder, root)
        session.driveLink = drive.share(folder)
        session.driveFolder = folder
        checked = folder
        // A pasta é nova: tudo o que estava marcado como enviado era de outra pasta.
        for (p in photos) {
            p.driveId = null
            p.driveWith = null
        }
        changed(session)
        return folder
    }

    @Volatile
    private var checked: String? = null

    private fun changed(session: ShootSession) = main.post { host.driveChanged(session) }

    private fun status(text: String) = main.post { host.driveStatus(text) }

    fun shutdown() {
        main.removeCallbacks(retry)
        worker.shutdownNow()
    }

    companion object {
        const val MODE_OFF = 0
        const val MODE_ALL = 1
        const val MODE_FAVORITES = 2
        val MODES = arrayOf("Desligado", "Todas as fotos", "Só as favoritas ♥")
        private const val ROOT_NAME = "Sony Tether"
        private const val RETRY_MIN_MS = 5_000L
        private const val RETRY_MAX_MS = 120_000L
    }
}
