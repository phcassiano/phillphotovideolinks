package com.phill.sonytether

import android.content.Context

/** Seus dados na galeria do cliente e no slideshow: nome do estúdio, Instagram e WhatsApp. */
class BrandSettings(context: Context) {
    private val prefs = context.getSharedPreferences("sony-tether", Context.MODE_PRIVATE)

    var studio: String
        get() = prefs.getString("brand.studio", "") ?: ""
        set(value) = prefs.edit().putString("brand.studio", value.trim()).apply()

    var instagram: String
        get() = prefs.getString("brand.instagram", "") ?: ""
        set(value) = prefs.edit().putString("brand.instagram", value.trim()).apply()

    var whatsapp: String
        get() = prefs.getString("brand.whatsapp", "") ?: ""
        set(value) = prefs.edit().putString("brand.whatsapp", value.trim()).apply()

    /** Mostrar o logo (o mesmo da marca d'água) na galeria e no slideshow. */
    var useLogo: Boolean
        get() = prefs.getBoolean("brand.logo", true)
        set(value) = prefs.edit().putBoolean("brand.logo", value).apply()

    val isEmpty get() = studio.isEmpty() && instagram.isEmpty() && whatsapp.isEmpty()
}
