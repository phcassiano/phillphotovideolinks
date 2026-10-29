package com.phill.sonytether

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import org.json.JSONObject
import java.util.Locale
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Ajustes feitos à mão numa foto, por cima do preset. Os de luz e cor usam as chaves e a escala do
 * Lightroom (a exposição em centésimos de EV), então o mesmo [PresetLook] aplica os dois. Girar,
 * endireitar (décimos de grau) e recortar (margens em décimos de milésimo) vão no mesmo mapa.
 */
class PhotoEdit(values: Map<String, Int>) {
    val values: Map<String, Int> = values.filterValues { it != 0 }

    val isEmpty get() = values.isEmpty()
    val hasTones get() = values.keys.any { it !in GEOMETRY }
    val hasGeometry get() = values.keys.any { it in GEOMETRY }

    /** Quartos de volta no sentido do relógio. */
    val quarters get() = (values[ROTATE] ?: 0).mod(4)
    val straighten get() = values[STRAIGHTEN] ?: 0

    /** Recorte em frações da foto já girada e endireitada. */
    val crop get() = RectF(inset(CROP_LEFT), inset(CROP_TOP), 1f - inset(CROP_RIGHT), 1f - inset(CROP_BOTTOM))

    private fun inset(key: String) = (values[key] ?: 0) / CROP_SCALE

    fun tonesOnly() = PhotoEdit(values.filterKeys { it !in GEOMETRY })
    fun geometryOnly() = PhotoEdit(values.filterKeys { it in GEOMETRY })

    fun withGeometry(quarters: Int, straighten: Int, crop: RectF) = PhotoEdit(
        tonesOnly().values + mapOf(
            ROTATE to quarters.mod(4),
            STRAIGHTEN to straighten,
            CROP_LEFT to (crop.left * CROP_SCALE).roundToInt(),
            CROP_TOP to (crop.top * CROP_SCALE).roundToInt(),
            CROP_RIGHT to ((1f - crop.right) * CROP_SCALE).roundToInt(),
            CROP_BOTTOM to ((1f - crop.bottom) * CROP_SCALE).roundToInt(),
        ),
    )

    /** Girada, endireitada e (se [cropped]) recortada; sempre uma cópia nova. */
    fun shape(source: Bitmap, cropped: Boolean = true): Bitmap {
        val turned = quarters % 2 == 1
        val w = (if (turned) source.height else source.width).toFloat()
        val h = (if (turned) source.width else source.height).toFloat()
        val k = straightenScale(w, h, straighten / 10f)
        val frameW = w * k
        val frameH = h * k
        val c = if (cropped) crop else RectF(0f, 0f, 1f, 1f)
        val out = Bitmap.createBitmap(
            max(1, (frameW * c.width()).roundToInt()),
            max(1, (frameH * c.height()).roundToInt()),
            Bitmap.Config.ARGB_8888,
        )
        val m = Matrix().apply {
            postTranslate(-source.width / 2f, -source.height / 2f)
            postRotate(quarters * 90f + straighten / 10f)
            postTranslate(frameW / 2f - c.left * frameW, frameH / 2f - c.top * frameH)
        }
        Canvas(out).drawBitmap(source, m, Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG))
        return out
    }

    /** Muda quando qualquer ajuste muda: entra na assinatura do JPEG que é compartilhado. */
    val signature: String = this.values.toSortedMap().entries.joinToString(",") { "${it.key}=${it.value}" }

    fun toPreset() = Preset(
        "Ajustes",
        tonesOnly().values.mapValues { (key, v) -> if (key == EXPOSURE) v / 100.0 else v.toDouble() },
        emptyMap(),
        emptyMap(),
        emptyList(),
    )

    fun toJson() = JSONObject(values)

    class Slider(val key: String, val label: String, val min: Int, val max: Int) {
        fun format(value: Int) = when {
            key == EXPOSURE -> String.format(Locale("pt", "BR"), "%+.2f", value / 100f)
            value > 0 -> "+$value"
            else -> value.toString()
        }
    }

    companion object {
        const val EXPOSURE = "Exposure2012"
        val NONE = PhotoEdit(emptyMap())

        val SLIDERS = listOf(
            Slider(EXPOSURE, "Exposição", -300, 300),
            Slider("Contrast2012", "Contraste", -100, 100),
            Slider("Highlights2012", "Realces", -100, 100),
            Slider("Shadows2012", "Sombras", -100, 100),
            Slider("Whites2012", "Brancos", -100, 100),
            Slider("Blacks2012", "Pretos", -100, 100),
            Slider("IncrementalTemperature", "Temperatura", -100, 100),
            Slider("IncrementalTint", "Matiz", -100, 100),
            Slider("Vibrance", "Vibração", -100, 100),
            Slider("Saturation", "Saturação", -100, 100),
            Slider("Clarity2012", "Claridade", -100, 100),
            Slider("Dehaze", "Remover névoa", -100, 100),
            Slider("PostCropVignetteAmount", "Vinheta", -100, 100),
        )

        const val ROTATE = "Rotate"
        const val STRAIGHTEN = "Straighten"
        const val CROP_LEFT = "CropLeft"
        const val CROP_TOP = "CropTop"
        const val CROP_RIGHT = "CropRight"
        const val CROP_BOTTOM = "CropBottom"
        private const val CROP_SCALE = 10000f
        const val MAX_STRAIGHTEN = 450

        /** Limites de cada chave de girar e recortar. */
        private val GEOMETRY = mapOf(
            ROTATE to 0..3,
            STRAIGHTEN to -MAX_STRAIGHTEN..MAX_STRAIGHTEN,
            CROP_LEFT to 0..9500,
            CROP_TOP to 0..9500,
            CROP_RIGHT to 0..9500,
            CROP_BOTTOM to 0..9500,
        )

        /**
         * Quanto a foto encolhe ao endireitar [degrees] para não sobrar canto vazio: o maior
         * retângulo com a mesma proporção que cabe dentro dela girada.
         */
        fun straightenScale(w: Float, h: Float, degrees: Float): Float {
            val a = abs(degrees) * PI.toFloat() / 180f
            val c = cos(a)
            val s = sin(a)
            return min(w / (w * c + h * s), h / (w * s + h * c))
        }

        fun fromJson(o: JSONObject?): PhotoEdit {
            if (o == null) return NONE
            val ranges = SLIDERS.associate { it.key to it.min..it.max } + GEOMETRY
            val values = HashMap<String, Int>()
            for (key in o.keys()) {
                val range = ranges[key] ?: continue
                values[key] = o.optInt(key).coerceIn(range)
            }
            return PhotoEdit(values)
        }
    }
}
