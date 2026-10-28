package com.phill.sonytether

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import java.io.File
import kotlin.math.min

/**
 * Marca d'água: o logo (PNG com fundo transparente, de preferência) ou, sem logo, um texto.
 * Os ajustes ficam guardados; [snapshot] devolve uma cópia fixa para usar fora da thread da tela.
 */
class Watermark(context: Context) {
    private val prefs = context.getSharedPreferences("sony-tether", Context.MODE_PRIVATE)
    private val logoFile = File(context.filesDir, "watermark-logo")

    var enabled: Boolean
        get() = prefs.getBoolean("wm.on", false)
        set(value) = prefs.edit().putBoolean("wm.on", value).apply()

    var text: String
        get() = prefs.getString("wm.text", "") ?: ""
        set(value) = prefs.edit().putString("wm.text", value).apply()

    /** Índice em [POSITIONS]. */
    var position: Int
        get() = prefs.getInt("wm.pos", 0)
        set(value) = prefs.edit().putInt("wm.pos", value).apply()

    /** Largura da marca, em % do lado menor da foto. */
    var size: Int
        get() = prefs.getInt("wm.size", 20)
        set(value) = prefs.edit().putInt("wm.size", value).apply()

    var opacity: Int
        get() = prefs.getInt("wm.alpha", 70)
        set(value) = prefs.edit().putInt("wm.alpha", value).apply()

    val hasLogo get() = logoFile.exists()

    fun setLogo(bytes: ByteArray?): Boolean {
        if (bytes == null) {
            logoFile.delete()
            return true
        }
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        if (bounds.outWidth <= 0) return false
        logoFile.writeBytes(bytes)
        return true
    }

    /** O logo em PNG (até 800 px), para a galeria e o slideshow; null se não houver. */
    fun logoPng(): ByteArray? {
        if (!hasLogo) return null
        val bitmap = BitmapFactory.decodeFile(logoFile.path) ?: return null
        val scaled = PhotoStore.scaled(bitmap, 800)
        return java.io.ByteArrayOutputStream().also { scaled.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
    }

    /** null se estiver desligada ou sem nada para desenhar. */
    fun snapshot(): Stamp? {
        if (!enabled) return null
        val logo = if (hasLogo) BitmapFactory.decodeFile(logoFile.path) else null
        if (logo == null && text.isBlank()) return null
        val id = "wm:${if (logo != null) logoFile.lastModified() else text.hashCode()}:$position:$size:$opacity"
        return Stamp(logo, text.trim(), position, size, opacity, id)
    }

    /** Ajustes congelados: pode ser usado em qualquer thread. */
    class Stamp(
        private val logo: Bitmap?,
        private val text: String,
        private val position: Int,
        private val size: Int,
        private val opacity: Int,
        val signature: String,
    ) {
        /** Desenha na própria foto se der; devolve a foto com a marca. */
        fun draw(source: Bitmap): Bitmap {
            val bitmap = if (source.isMutable) source else source.copy(Bitmap.Config.ARGB_8888, true)
            val canvas = Canvas(bitmap)
            val short = min(bitmap.width, bitmap.height).toFloat()
            val width = short * size / 100f
            val margin = short * 0.03f
            val alpha = opacity * 255 / 100
            if (logo != null) {
                val height = width * logo.height / logo.width
                val paint = Paint(Paint.FILTER_BITMAP_FLAG).apply { this.alpha = alpha }
                canvas.drawBitmap(logo, null, place(bitmap, width, height, margin), paint)
            } else {
                val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = Color.WHITE
                    this.alpha = alpha
                    typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
                    textSize = 100f
                }
                paint.textSize = 100f * width / paint.measureText(text).coerceAtLeast(1f)
                paint.setShadowLayer(short * 0.004f, 0f, short * 0.002f, Color.argb(alpha * 2 / 3, 0, 0, 0))
                val metrics = paint.fontMetrics
                val box = place(bitmap, width, metrics.descent - metrics.ascent, margin)
                canvas.drawText(text, box.left, box.top - metrics.ascent, paint)
            }
            return bitmap
        }

        private fun place(bitmap: Bitmap, w: Float, h: Float, margin: Float): RectF {
            val right = bitmap.width - margin - w
            val bottom = bitmap.height - margin - h
            val (x, y) = when (position) {
                0 -> right to bottom
                1 -> margin to bottom
                2 -> right to margin
                3 -> margin to margin
                4 -> (bitmap.width - w) / 2 to bottom
                else -> (bitmap.width - w) / 2 to (bitmap.height - h) / 2
            }
            return RectF(x, y, x + w, y + h)
        }
    }

    companion object {
        val POSITIONS = arrayOf(
            "Inferior direito", "Inferior esquerdo", "Superior direito", "Superior esquerdo", "Embaixo, no centro", "Centro",
        )
    }
}
