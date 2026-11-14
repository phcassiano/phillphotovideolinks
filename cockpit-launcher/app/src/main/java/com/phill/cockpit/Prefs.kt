package com.phill.cockpit

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import androidx.compose.runtime.mutableStateOf
import org.json.JSONObject

/** Configurações persistentes, observáveis pelo Compose. */
object Prefs {
    private lateinit var sp: SharedPreferences
    private val all = mutableListOf<P<*>>()

    class P<T : Any>(val key: String, val def: T, val shareable: Boolean = false) {
        val state = mutableStateOf(def)
        var v: T
            get() = state.value
            set(x) {
                state.value = x
                write(key, x)
            }

        init { all += this }

        @Suppress("UNCHECKED_CAST")
        fun load() {
            state.value = when (def) {
                is Int -> sp.getInt(key, def) as T
                is Boolean -> sp.getBoolean(key, def) as T
                is Float -> sp.getFloat(key, def) as T
                is String -> (sp.getString(key, def) ?: def) as T
                else -> def
            }
        }

        @Suppress("UNCHECKED_CAST")
        fun setAny(x: Any) {
            v = when (def) {
                is Int -> (x as Number).toInt() as T
                is Float -> (x as Number).toFloat() as T
                is Boolean -> x as T
                else -> x.toString() as T
            }
        }
    }

    private fun write(k: String, x: Any) {
        if (!::sp.isInitialized) return
        sp.edit().apply {
            when (x) {
                is Int -> putInt(k, x)
                is Boolean -> putBoolean(k, x)
                is Float -> putFloat(k, x)
                is String -> putString(k, x)
            }
        }.apply()
    }

    // Perfil
    val name = P("name", "")
    val greeting = P("greeting", true)
    val welcomeText = P("welcomeText", "Vamos começar!", true)

    // Visual
    val accent = P("accent", 0xFF00E5FF.toInt(), true)
    val bgStyle = P("bg", "neon", true)
    val animatedBg = P("animBg", true, true)
    val wallpaper = P("wall", "")
    val wallDim = P("wallDim", 0.45f, true)
    val clock24 = P("clock24", true, true)
    val panelAlpha = P("panelAlpha", 0.10f, true)
    val tileStyle = P("tileStyle", "glass", true)
    val fullscreen = P("fullscreen", false)

    // Garagem (carro escolhido, desenhado pelo app)
    val carType = P("carType", "sedan", true)
    val carColor = P("carColor", 0xFFD32F2F.toInt(), true)
    val carVariant = P("carVariant", "original", true)
    val carName = P("carNameHome", "", true)
    val showCar = P("showCar", true, true)
    val odometer = P("odo", 0f)

    // Listas persistidas (JSON)
    val garageJson = P("garageJson", "[]")
    val fuelJson = P("fuelJson", "[]")
    val maintJson = P("maintJson", "[]")

    // Atalhos (8 posições)
    val defaultSlots = listOf(
        "com.google.android.apps.maps", "com.waze", "com.spotify.music",
        "com.google.android.apps.youtube.music", "com.google.android.projection.gearhead",
        "com.android.chrome", "", ""
    )
    val slots = defaultSlots.mapIndexed { i, d -> P("slot$i", d, true) }

    // Velocidade
    val speedLimit = P("speedLimit", 0)
    val speedSource = P("speedSource", "auto")
    val beepVolume = P("beepVol", 80)

    // OBD2
    val obdType = P("obdType", "bt")
    val obdAddr = P("obdAddr", "")
    val obdName = P("obdName", "")
    val wifiHost = P("wifiHost", "192.168.0.10")
    val wifiPort = P("wifiPort", 35000)
    val obdAuto = P("obdAuto", true)

    // Combustível
    val fuel = P("fuel", "gasolina")
    val fuelPrice = P("fuelPrice", 6.29f)
    val displacement = P("displ", 1.6f)

    // Brilho
    val autoBright = P("autoBright", false)
    val brightDay = P("brightDay", 230)
    val brightNight = P("brightNight", 50)

    fun init(c: Context) {
        sp = c.getSharedPreferences("cockpit", Context.MODE_PRIVATE)
        all.forEach { it.load() }
    }

    /** "Tema por código": gera um código curto com o visual para passar a um amigo. */
    fun exportCode(): String {
        val o = JSONObject()
        all.filter { it.shareable }.forEach { o.put(it.key, it.v) }
        val b = Base64.encodeToString(o.toString().toByteArray(), Base64.NO_WRAP or Base64.URL_SAFE)
        return "CKP1-$b"
    }

    fun importCode(code: String): Boolean = try {
        val o = JSONObject(String(Base64.decode(code.trim().removePrefix("CKP1-"), Base64.NO_WRAP or Base64.URL_SAFE)))
        all.filter { it.shareable && o.has(it.key) }.forEach { it.setAny(o.get(it.key)) }
        true
    } catch (e: Exception) {
        false
    }
}
