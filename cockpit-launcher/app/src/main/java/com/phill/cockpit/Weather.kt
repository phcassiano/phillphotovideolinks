package com.phill.cockpit

import androidx.compose.runtime.mutableStateOf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Locale

data class WeatherNow(
    val temp: Int, val code: Int, val max: Int, val min: Int,
    val rainChance: Int, val sunrise: Long?, val sunset: Long?, val at: Long
)

object Weather {
    val now = mutableStateOf<WeatherNow?>(null)

    suspend fun refresh(lat: Double, lon: Double) = withContext(Dispatchers.IO) {
        try {
            val u = URL(
                String.format(
                    Locale.US,
                    "https://api.open-meteo.com/v1/forecast?latitude=%.3f&longitude=%.3f" +
                        "&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min," +
                        "precipitation_probability_max,sunrise,sunset&timezone=auto&forecast_days=1",
                    lat, lon
                )
            )
            val c = u.openConnection() as HttpURLConnection
            c.connectTimeout = 8000; c.readTimeout = 8000
            c.setRequestProperty("User-Agent", "CockpitLauncher/1.0")
            val txt = c.inputStream.bufferedReader().use { it.readText() }
            val j = JSONObject(txt)
            val cur = j.getJSONObject("current")
            val d = j.getJSONObject("daily")
            val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm", Locale.US)
            fun t(k: String) = try { fmt.parse(d.getJSONArray(k).getString(0))?.time } catch (e: Exception) { null }
            now.value = WeatherNow(
                cur.getDouble("temperature_2m").toInt(),
                cur.getInt("weather_code"),
                d.getJSONArray("temperature_2m_max").getDouble(0).toInt(),
                d.getJSONArray("temperature_2m_min").getDouble(0).toInt(),
                d.optJSONArray("precipitation_probability_max")?.optInt(0, 0) ?: 0,
                t("sunrise"), t("sunset"), System.currentTimeMillis()
            )
        } catch (e: Exception) { }
    }

    fun icon(code: Int, day: Boolean = true) = when (code) {
        0 -> if (day) "☀️" else "🌙"
        1, 2 -> if (day) "🌤️" else "☁️"
        3 -> "☁️"
        45, 48 -> "🌫️"
        in 51..57 -> "🌦️"
        in 61..67, in 80..82 -> "🌧️"
        in 71..77, 85, 86 -> "❄️"
        in 95..99 -> "⛈️"
        else -> "🌡️"
    }

    fun label(code: Int) = when (code) {
        0 -> "Céu limpo"
        1 -> "Poucas nuvens"
        2 -> "Parcialmente nublado"
        3 -> "Nublado"
        45, 48 -> "Neblina"
        in 51..57 -> "Garoa"
        in 61..65 -> "Chuva"
        66, 67 -> "Chuva gelada"
        in 80..82 -> "Pancadas de chuva"
        in 71..77, 85, 86 -> "Neve"
        in 95..99 -> "Tempestade"
        else -> ""
    }

    /** Dia ou noite pelo nascer/pôr do sol do local (ou 6h–18h, se ainda não houver previsão). */
    fun isDay(): Boolean {
        val w = now.value
        val nowMs = System.currentTimeMillis()
        if (w?.sunrise != null && w.sunset != null) {
            val day = 86_400_000L
            val shift = ((nowMs - w.sunrise) / day) * day // reaproveita horários de ontem/hoje
            return nowMs in (w.sunrise + shift)..(w.sunset + shift)
        }
        val h = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
        return h in 6..17
    }
}
