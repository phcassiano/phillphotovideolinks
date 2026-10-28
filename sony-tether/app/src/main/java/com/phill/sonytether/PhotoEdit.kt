package com.phill.sonytether

import org.json.JSONObject
import java.util.Locale

/**
 * Ajustes feitos à mão numa foto, por cima do preset. Os valores usam as chaves e a escala do
 * Lightroom (a exposição em centésimos de EV), então o mesmo [PresetLook] aplica os dois.
 */
class PhotoEdit(values: Map<String, Int>) {
    val values: Map<String, Int> = values.filterValues { it != 0 }

    val isEmpty get() = values.isEmpty()

    /** Muda quando qualquer ajuste muda: entra na assinatura do JPEG que é compartilhado. */
    val signature: String = this.values.toSortedMap().entries.joinToString(",") { "${it.key}=${it.value}" }

    fun toPreset() = Preset(
        "Ajustes",
        values.mapValues { (key, v) -> if (key == EXPOSURE) v / 100.0 else v.toDouble() },
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

        fun fromJson(o: JSONObject?): PhotoEdit {
            if (o == null) return NONE
            val keys = SLIDERS.associateBy { it.key }
            val values = HashMap<String, Int>()
            for (key in o.keys()) {
                val s = keys[key] ?: continue
                values[key] = o.optInt(key).coerceIn(s.min, s.max)
            }
            return PhotoEdit(values)
        }
    }
}
