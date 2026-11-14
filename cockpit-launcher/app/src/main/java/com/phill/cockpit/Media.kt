package com.phill.cockpit

import android.content.ComponentName
import android.content.Context
import android.graphics.Bitmap
import android.media.AudioManager
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.service.notification.NotificationListenerService
import android.view.KeyEvent
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.core.app.NotificationManagerCompat

/** Só existe para o Android liberar o acesso às sessões de mídia (capa, faixa, controles). */
class MediaListener : NotificationListenerService() {
    override fun onListenerConnected() {
        super.onListenerConnected()
        Media.refresh(this)
    }
}

object Media {
    val title = mutableStateOf("")
    val artist = mutableStateOf("")
    val art = mutableStateOf<ImageBitmap?>(null)
    val playing = mutableStateOf(false)
    val source = mutableStateOf("")
    val duration = mutableLongStateOf(0L)
    val position = mutableLongStateOf(0L)
    val hasAccess = mutableStateOf(false)

    private var controller: MediaController? = null
    private var listening = false
    private val main = Handler(Looper.getMainLooper())

    private val cb = object : MediaController.Callback() {
        override fun onMetadataChanged(m: MediaMetadata?) = readMeta(m)
        override fun onPlaybackStateChanged(s: PlaybackState?) = readState(s)
        override fun onSessionDestroyed() { controller = null; playing.value = false }
    }

    fun accessGranted(c: Context) = NotificationManagerCompat.getEnabledListenerPackages(c).contains(c.packageName)

    fun refresh(c: Context) {
        val ctx = c.applicationContext
        hasAccess.value = accessGranted(ctx)
        if (!hasAccess.value) return
        try {
            val msm = ctx.getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager
            val cn = ComponentName(ctx, MediaListener::class.java)
            if (!listening) {
                msm.addOnActiveSessionsChangedListener({ pick(it) }, cn, main)
                listening = true
            }
            pick(msm.getActiveSessions(cn))
        } catch (e: SecurityException) {
            hasAccess.value = false
        }
    }

    private fun pick(list: List<MediaController>?) {
        val best = list?.firstOrNull { it.playbackState?.state == PlaybackState.STATE_PLAYING } ?: list?.firstOrNull()
        if (best?.sessionToken == controller?.sessionToken) return
        controller?.unregisterCallback(cb)
        controller = best
        best?.registerCallback(cb, main)
        source.value = best?.packageName ?: ""
        readMeta(best?.metadata)
        readState(best?.playbackState)
    }

    private fun readMeta(m: MediaMetadata?) {
        title.value = m?.getString(MediaMetadata.METADATA_KEY_TITLE) ?: m?.getString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE) ?: ""
        artist.value = m?.getString(MediaMetadata.METADATA_KEY_ARTIST) ?: m?.getString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST)
            ?: m?.getString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE) ?: ""
        duration.longValue = m?.getLong(MediaMetadata.METADATA_KEY_DURATION) ?: 0L
        val bmp: Bitmap? = m?.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART)
            ?: m?.getBitmap(MediaMetadata.METADATA_KEY_ART)
            ?: m?.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON)
        art.value = try { bmp?.asImageBitmap() } catch (e: Exception) { null }
    }

    private var posAt = 0L
    private var speed = 1f
    private fun readState(s: PlaybackState?) {
        playing.value = s?.state == PlaybackState.STATE_PLAYING
        position.longValue = s?.position ?: 0L
        posAt = s?.lastPositionUpdateTime ?: SystemClock.elapsedRealtime()
        speed = s?.playbackSpeed ?: 1f
    }

    /** Posição atual estimada (para a barra de progresso). */
    fun livePosition(): Long {
        if (!playing.value) return position.longValue
        return position.longValue + ((SystemClock.elapsedRealtime() - posAt) * speed).toLong()
    }

    private fun key(c: Context, code: Int) {
        val am = c.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, code))
        am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, code))
    }

    // Com permissão usa a sessão; sem permissão manda a tecla de mídia (funciona até com CarPlay/AA na maioria das centrais).
    fun playPause(c: Context) {
        val t = controller?.transportControls
        if (t == null) key(c, KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE)
        else if (playing.value) t.pause() else t.play()
    }
    fun next(c: Context) = controller?.transportControls?.skipToNext() ?: key(c, KeyEvent.KEYCODE_MEDIA_NEXT)
    fun prev(c: Context) = controller?.transportControls?.skipToPrevious() ?: key(c, KeyEvent.KEYCODE_MEDIA_PREVIOUS)

    fun volume(c: Context, up: Boolean) {
        val am = c.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        am.adjustStreamVolume(
            AudioManager.STREAM_MUSIC,
            if (up) AudioManager.ADJUST_RAISE else AudioManager.ADJUST_LOWER,
            AudioManager.FLAG_SHOW_UI
        )
    }

    fun openSource(c: Context) {
        if (source.value.isNotEmpty()) Apps.launch(c, source.value)
    }
}
