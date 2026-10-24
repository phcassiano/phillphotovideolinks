package com.phill.sonytether

/**
 * Preset do Lightroom lido de um .xmp (Lightroom Classic/CC), de um .lrtemplate (Lightroom antigo)
 * ou de um .dng exportado pelo Lightroom Mobile: todos guardam os ajustes como "crs:Nome=valor".
 */
class Preset(
    val name: String,
    val numbers: Map<String, Double>,
    val texts: Map<String, String>,
    /** Curvas de tons: pontos (entrada, saída) de 0 a 255. */
    val curves: Map<String, List<Pair<Double, Double>>>,
    /** Partes do preset que este app não reproduz (só para avisar). */
    val ignored: List<String>,
) {
    fun n(key: String, default: Double = 0.0) = numbers[key] ?: default

    companion object {
        private val ATTRIBUTE = Regex("""crs:(\w+)\s*=\s*"([^"]*)"""")
        private val ELEMENT = Regex("""<crs:(\w+)>([^<]*)</crs:\1>""")
        private val XMP_NAME = Regex("""<crs:Name>\s*<rdf:Alt>\s*<rdf:li[^>]*>([^<]*)</rdf:li>""")
        private val XMP_CURVE = Regex("""<crs:(ToneCurvePV2012(?:Red|Green|Blue)?)>\s*<rdf:Seq>(.*?)</rdf:Seq>""", RegexOption.DOT_MATCHES_ALL)
        private val XMP_POINT = Regex("""<rdf:li>\s*([\d.]+)\s*,\s*([\d.]+)\s*</rdf:li>""")
        private val LR_NUMBER = Regex("""\b(\w+)\s*=\s*([-+]?\d+(?:\.\d+)?)\s*,""")
        private val LR_TEXT = Regex("""\b(\w+)\s*=\s*"([^"]*)"\s*,""")
        private val LR_TITLE = Regex("""\btitle\s*=\s*"([^"]*)"""")
        private val LR_CURVE = Regex("""\b(ToneCurvePV2012(?:Red|Green|Blue)?)\s*=\s*\{([^}]*)\}""")
        private val NUMBER = Regex("""[-+]?\d+(?:\.\d+)?""")

        private val NOT_REPRODUCED = linkedMapOf(
            "Clarity2012" to "Claridade",
            "Texture" to "Textura",
            "Dehaze" to "Remover névoa",
            "GrainAmount" to "Granulado",
        )

        fun parse(fileName: String, bytes: ByteArray): Preset? {
            val text = String(bytes, Charsets.ISO_8859_1)
            val numbers = HashMap<String, Double>()
            val texts = HashMap<String, String>()
            val curves = HashMap<String, List<Pair<Double, Double>>>()

            for (m in ATTRIBUTE.findAll(text) + ELEMENT.findAll(text)) {
                val (key, value) = m.destructured
                value.trim().removePrefix("+").toDoubleOrNull()?.let { numbers[key] = it } ?: run { texts[key] = value }
            }
            for (m in XMP_CURVE.findAll(text)) {
                curves[m.groupValues[1]] = XMP_POINT.findAll(m.groupValues[2])
                    .map { it.groupValues[1].toDouble() to it.groupValues[2].toDouble() }.toList()
            }
            var name = XMP_NAME.find(text)?.groupValues?.get(1)

            // .lrtemplate: só quando não há nada no formato XMP.
            if (numbers.isEmpty() && text.contains("settings")) {
                LR_NUMBER.findAll(text).forEach { numbers[it.groupValues[1]] = it.groupValues[2].toDouble() }
                LR_TEXT.findAll(text).forEach { texts[it.groupValues[1]] = it.groupValues[2] }
                for (m in LR_CURVE.findAll(text)) {
                    val values = NUMBER.findAll(m.groupValues[2]).map { it.value.toDouble() }.toList()
                    curves[m.groupValues[1]] = values.chunked(2).filter { it.size == 2 }.map { it[0] to it[1] }
                }
                name = name ?: LR_TITLE.find(text)?.groupValues?.get(1)
            }

            if (numbers.isEmpty() && curves.isEmpty()) return null
            val ignored = NOT_REPRODUCED.filter { (key, _) -> (numbers[key] ?: 0.0) != 0.0 }.values.toMutableList()
            if (text.contains("RGBTable") || texts.containsKey("LookName")) ignored += "Perfil criativo"
            val fallback = fileName.substringBeforeLast('.').ifBlank { "Preset" }
            return Preset(name?.trim()?.ifBlank { null } ?: fallback, numbers, texts, curves, ignored)
        }
    }
}
