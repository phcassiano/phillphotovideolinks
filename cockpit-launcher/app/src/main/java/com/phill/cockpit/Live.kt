package com.phill.cockpit

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.provider.Settings
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Computador de bordo: distância, tempo, médias, litros e custo. */
object Trip {
    val km = mutableFloatStateOf(0f)
    val movingSec = mutableLongStateOf(0L)
    val totalSec = mutableLongStateOf(0L)
    val maxSpeed = mutableFloatStateOf(0f)
    val liters = mutableFloatStateOf(0f)
    val hasFuel = mutableStateOf(false)

    fun tick(speed: Float, lph: Float?, dt: Float) {
        totalSec.longValue += 1
        if (speed > 2f) {
            movingSec.longValue += 1
            km.floatValue += speed * dt / 3600f
        }
        if (speed > maxSpeed.floatValue) maxSpeed.floatValue = speed
        if (lph != null) { liters.floatValue += lph * dt / 3600f; hasFuel.value = true }
    }

    fun avgSpeed() = if (movingSec.longValue > 0) km.floatValue / (movingSec.longValue / 3600f) else 0f
    fun avgKml() = if (liters.floatValue > 0.01f) km.floatValue / liters.floatValue else 0f
    fun cost() = liters.floatValue * Prefs.fuelPrice.v

    fun reset() {
        km.floatValue = 0f; movingSec.longValue = 0; totalSec.longValue = 0
        maxSpeed.floatValue = 0f; liters.floatValue = 0f; hasFuel.value = false
    }
}

object Live {
    val speed = mutableFloatStateOf(0f)
    val speedFrom = mutableStateOf("GPS")
    val overLimit = mutableStateOf(false)
    var welcomed = false

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var tone: ToneGenerator? = null
    private var lastBeep = 0L
    private var lastBright = -1
    private var lastWeather = 0L
    private var odoAccum = 0f

    fun start(ctx: Context) {
        val app = ctx.applicationContext
        scope.launch {
            var n = 0
            while (true) {
                tick(app, n++)
                delay(1000)
            }
        }
    }

    private fun tick(ctx: Context, n: Int) {
        Gps.tick()
        val obd = Obd.data.value
        val useObd = when (Prefs.speedSource.v) {
            "obd" -> true
            "gps" -> false
            else -> Obd.connected && obd.speed != null
        }
        val s = if (useObd) obd.speed ?: 0f else Gps.speedKmh.floatValue
        speed.floatValue = s
        speedFrom.value = if (useObd) "OBD2" else "GPS"
        Trip.tick(s, if (Obd.connected) obd.lph else null, 1f)
        Performance.tick(s, 1f)
        if (s > 2f) { odoAccum += s / 3600f; if (odoAccum >= 0.2f) { Prefs.odometer.v = Prefs.odometer.v + odoAccum; odoAccum = 0f } }

        // Aviso de velocidade
        val lim = Prefs.speedLimit.v
        overLimit.value = lim > 0 && s > lim
        if (overLimit.value && System.currentTimeMillis() - lastBeep > 8000) {
            lastBeep = System.currentTimeMillis()
            try {
                if (tone == null) tone = ToneGenerator(AudioManager.STREAM_MUSIC, Prefs.beepVolume.v.coerceIn(10, 100))
                tone?.startTone(ToneGenerator.TONE_PROP_BEEP2, 500)
            } catch (e: Exception) { tone = null }
        }

        // Previsão do tempo a cada 30 min
        val loc = Gps.location.value
        if (loc != null && (System.currentTimeMillis() - lastWeather > 30 * 60_000L || Weather.now.value == null && n % 60 == 5)) {
            lastWeather = System.currentTimeMillis()
            scope.launch { Weather.refresh(loc.latitude, loc.longitude) }
        }

        // Brilho automático (nascer / pôr do sol)
        if (Prefs.autoBright.v && n % 30 == 0) applyBrightness(ctx)

        // Reconexão automática do OBD2
        if (n == 3 && Prefs.obdAuto.v && Obd.configured() && Obd.state.value == Obd.ST_OFF) Obd.connect(ctx)

        // Controle pelo celular
        if (n % 5 == 0) RemoteServer.ensure(ctx)
    }

    fun canWriteSettings(ctx: Context) = Build.VERSION.SDK_INT < 23 || Settings.System.canWrite(ctx)

    fun applyBrightness(ctx: Context, force: Boolean = false) {
        if (!canWriteSettings(ctx)) return
        val target = if (Weather.isDay()) Prefs.brightDay.v else Prefs.brightNight.v
        if (target == lastBright && !force) return
        try {
            val cr = ctx.contentResolver
            Settings.System.putInt(cr, Settings.System.SCREEN_BRIGHTNESS_MODE, Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL)
            Settings.System.putInt(cr, Settings.System.SCREEN_BRIGHTNESS, target.coerceIn(5, 255))
            lastBright = target
        } catch (e: Exception) { }
    }
}
