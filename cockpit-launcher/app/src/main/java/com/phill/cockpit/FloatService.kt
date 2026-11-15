package com.phill.cockpit

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.savedstate.SavedStateRegistry
import androidx.savedstate.SavedStateRegistryController
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import kotlin.math.roundToInt

/**
 * Janelinha flutuante por cima de outros apps (por exemplo o Android Auto pelo ZLink):
 * velocidade, limite e, com o OBD2 ligado, giro e temperatura do motor.
 * Aparece só quando o Cockpit sai da frente. Arraste para mover, toque para voltar ao Cockpit.
 */
class FloatService : Service(), LifecycleOwner, SavedStateRegistryOwner {
    private val registry = LifecycleRegistry(this)
    private val savedState = SavedStateRegistryController.create(this)
    override val lifecycle: Lifecycle get() = registry
    override val savedStateRegistry: SavedStateRegistry get() = savedState.savedStateRegistry

    private lateinit var wm: WindowManager
    private var view: ComposeView? = null
    private val lp = WindowManager.LayoutParams(
        WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
        if (Build.VERSION.SDK_INT >= 26) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        PixelFormat.TRANSLUCENT
    ).apply { gravity = Gravity.TOP or Gravity.START }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        savedState.performRestore(null)
        registry.handleLifecycleEvent(Lifecycle.Event.ON_CREATE)
        // Serviço em primeiro plano: mantém o GPS e o OBD2 vivos com o Cockpit em segundo plano
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(ID, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
            else startForeground(ID, notification())
        } catch (e: Exception) { stopSelf(); return }
        Gps.start(this)
        wm = getSystemService(WINDOW_SERVICE) as WindowManager
        lp.x = Prefs.floatX.v; lp.y = Prefs.floatY.v
        val v = ComposeView(this).apply {
            setViewTreeLifecycleOwner(this@FloatService)
            setViewTreeSavedStateRegistryOwner(this@FloatService)
            setContent { Bubble() }
            setOnTouchListener(DragOrTap())
        }
        try { wm.addView(v, lp); view = v } catch (e: Exception) { stopSelf(); return }
        registry.handleLifecycleEvent(Lifecycle.Event.ON_START)
        registry.handleLifecycleEvent(Lifecycle.Event.ON_RESUME)
    }

    override fun onDestroy() {
        registry.handleLifecycleEvent(Lifecycle.Event.ON_DESTROY)
        view?.let { try { wm.removeView(it) } catch (e: Exception) { } }
        view = null
        super.onDestroy()
    }

    /** Arrasta com as coordenadas da tela (rawX/rawY), que não mudam quando a janela se move; toque curto volta ao Cockpit. */
    private inner class DragOrTap : View.OnTouchListener {
        private var startX = 0f; private var startY = 0f
        private var winX = 0; private var winY = 0
        private var dragging = false

        override fun onTouch(v: View, e: MotionEvent): Boolean {
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    startX = e.rawX; startY = e.rawY; winX = lp.x; winY = lp.y; dragging = false
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = e.rawX - startX; val dy = e.rawY - startY
                    if (!dragging && dx * dx + dy * dy > slop * slop) dragging = true
                    if (dragging) {
                        lp.x = (winX + dx).roundToInt().coerceAtLeast(0)
                        lp.y = (winY + dy).roundToInt().coerceAtLeast(0)
                        try { wm.updateViewLayout(v, lp) } catch (ex: Exception) { }
                    }
                }
                MotionEvent.ACTION_UP -> {
                    if (dragging) { Prefs.floatX.v = lp.x; Prefs.floatY.v = lp.y } else openCockpit()
                }
            }
            return true
        }
    }

    private val slop by lazy { ViewConfiguration.get(this).scaledTouchSlop.toFloat() }

    private fun openCockpit() {
        startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    private fun notification(): Notification {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26)
            nm.createNotificationChannel(NotificationChannel(CHANNEL, "Janela flutuante", NotificationManager.IMPORTANCE_MIN))
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL)
        else @Suppress("DEPRECATION") Notification.Builder(this)
        return b.setSmallIcon(R.drawable.ic_launcher).setContentTitle("Cockpit")
            .setContentText("Janela flutuante ativa").setContentIntent(open).setOngoing(true).build()
    }

    companion object {
        private const val ID = 42
        private const val CHANNEL = "float"

        fun canDraw(ctx: Context) = Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(ctx)

        /** Liga a janela quando o Cockpit sai da frente e desliga quando ele volta. */
        fun update(ctx: Context, cockpitHidden: Boolean) {
            val i = Intent(ctx, FloatService::class.java)
            if (cockpitHidden && Prefs.floatWin.v && canDraw(ctx)) {
                try {
                    if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
                } catch (e: Exception) { }
            } else ctx.stopService(i)
        }
    }
}

@Composable
private fun Bubble() {
    val ac = accent()
    val speed = Live.speed.floatValue
    val lim = Prefs.speedLimit.state.value
    val over = Live.overLimit.value
    val obd = Obd.data.value
    val shape = RoundedCornerShape(20.dp)
    Row(
        Modifier.clip(shape).background(Color(0xE6101318))
            .border(1.dp, (if (over) Color(0xFFFF3B30) else ac).copy(alpha = 0.6f), shape)
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            T(speed.roundToInt().toString(), 34f, if (over) Color(0xFFFF3B30) else Color.White, display = true)
            T("km/h ${Live.speedFrom.value}", 10f, ac)
        }
        if (lim > 0) {
            Box(
                Modifier.size(40.dp).clip(CircleShape).background(Color.White).border(4.dp, Color(0xFFD32F2F), CircleShape),
                contentAlignment = Alignment.Center
            ) { T(lim.toString(), 15f, Color.Black, display = true) }
        }
        if (Obd.connected) {
            Column {
                obd.rpm?.let { T("${it.roundToInt()} rpm", 13f) }
                obd.coolant?.let { T("${it.roundToInt()}°C motor", 13f, if (it >= 105f) Color(0xFFFF3B30) else Color.White) }
            }
        }
    }
}
