package com.phill.sonytether

import android.graphics.Bitmap
import android.graphics.RectF
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.pow
import kotlin.math.sqrt

/**
 * Aproximação dos ajustes do Lightroom em cima de um JPEG: balanço de branco, exposição, tons
 * (contraste, realces, sombras, brancos, pretos), remover névoa, curvas, HSL, vibração, saturação,
 * color grading e vinheta; claridade, textura e granulado ficam em [LocalEffects]. Não é o motor da Adobe, então o resultado fica próximo, não idêntico.
 *
 * A parte de cor vira uma tabela 3D (LUT) de 33×33×33; cada pixel só faz uma interpolação nela.
 */
class PresetLook(preset: Preset, private val amount: Float) {

    private val p = Params(preset)
    private val effects = LocalEffects.from(preset, amount)
    private val table = FloatArray(N * N * N * 3)

    init {
        val out = FloatArray(3)
        var i = 0
        for (b in 0 until N) for (g in 0 until N) for (r in 0 until N) {
            val rf = r / (N - 1f)
            val gf = g / (N - 1f)
            val bf = b / (N - 1f)
            map(rf, gf, bf, out)
            table[i++] = rf + (out[0] - rf) * amount
            table[i++] = gf + (out[1] - gf) * amount
            table[i++] = bf + (out[2] - bf) * amount
        }
    }

    /** Cor de um pixel (0 a 1), já com a intensidade aplicada. */
    fun lookup(r: Float, g: Float, b: Float, out: FloatArray) {
        val x = r * (N - 1)
        val y = g * (N - 1)
        val z = b * (N - 1)
        val x0 = floor(x).toInt().coerceIn(0, N - 2)
        val y0 = floor(y).toInt().coerceIn(0, N - 2)
        val z0 = floor(z).toInt().coerceIn(0, N - 2)
        interpolate(x0, y0, z0, x - x0, y - y0, z - z0, out)
    }

    /**
     * Aplica o preset no próprio bitmap (se ele for mutável) ou numa cópia. [frame] diz onde o
     * bitmap fica na foto inteira (0..1) quando ele é só um trecho dela, para a vinheta.
     */
    fun apply(source: Bitmap, frame: RectF? = null): Bitmap {
        val bitmap = if (source.isMutable && source.config == Bitmap.Config.ARGB_8888) source
        else source.copy(Bitmap.Config.ARGB_8888, true)
        val w = bitmap.width
        val h = bitmap.height
        val index = IntArray(256)
        val frac = FloatArray(256)
        for (v in 0..255) {
            val x = v * (N - 1) / 255f
            index[v] = floor(x).toInt().coerceAtMost(N - 2)
            frac[v] = x - index[v]
        }
        val vignette = p.vignette * amount
        // Num trecho da foto (zoom), a vinheta é calculada pelo centro da foto inteira.
        val fullW = if (frame != null) w / frame.width() else w.toFloat()
        val fullH = if (frame != null) h / frame.height() else h.toFloat()
        val offX = (frame?.left ?: 0f) * fullW
        val offY = (frame?.top ?: 0f) * fullH
        val cx = fullW / 2f
        val cy = fullH / 2f
        val rows = 64
        val pixels = IntArray(w * rows)
        val out = FloatArray(3)
        var top = 0
        while (top < h) {
            val count = minOf(rows, h - top)
            bitmap.getPixels(pixels, 0, w, 0, top, w, count)
            for (row in 0 until count) {
                val dy = (offY + top + row - cy) / cy
                for (col in 0 until w) {
                    val k = row * w + col
                    val c = pixels[k]
                    val r = (c shr 16) and 0xFF
                    val g = (c shr 8) and 0xFF
                    val b = c and 0xFF
                    interpolate(index[r], index[g], index[b], frac[r], frac[g], frac[b], out)
                    var gain = 1f
                    if (vignette != 0f) {
                        val dx = (offX + col - cx) / cx
                        gain = 1f + vignette * smoothstep(p.vignetteStart, VIGNETTE_END, sqrt(dx * dx + dy * dy))
                    }
                    pixels[k] = (c and 0xFF000000.toInt()) or
                        (byte(out[0] * gain) shl 16) or (byte(out[1] * gain) shl 8) or byte(out[2] * gain)
                }
            }
            bitmap.setPixels(pixels, 0, w, 0, top, w, count)
            top += count
        }
        if (!effects.isEmpty) {
            // Claridade, textura e grão olham a vizinhança: precisam da imagem inteira de uma vez.
            val all = IntArray(w * h)
            bitmap.getPixels(all, 0, w, 0, 0, w, h)
            effects.apply(all, w, h, fullW, fullH, offX, offY)
            bitmap.setPixels(all, 0, w, 0, 0, w, h)
        }
        return bitmap
    }

    private fun interpolate(x0: Int, y0: Int, z0: Int, fx: Float, fy: Float, fz: Float, out: FloatArray) {
        for (ch in 0..2) {
            val c000 = table[at(x0, y0, z0) + ch]
            val c100 = table[at(x0 + 1, y0, z0) + ch]
            val c010 = table[at(x0, y0 + 1, z0) + ch]
            val c110 = table[at(x0 + 1, y0 + 1, z0) + ch]
            val c001 = table[at(x0, y0, z0 + 1) + ch]
            val c101 = table[at(x0 + 1, y0, z0 + 1) + ch]
            val c011 = table[at(x0, y0 + 1, z0 + 1) + ch]
            val c111 = table[at(x0 + 1, y0 + 1, z0 + 1) + ch]
            val c00 = c000 + (c100 - c000) * fx
            val c10 = c010 + (c110 - c010) * fx
            val c01 = c001 + (c101 - c001) * fx
            val c11 = c011 + (c111 - c011) * fx
            val c0 = c00 + (c10 - c00) * fy
            val c1 = c01 + (c11 - c01) * fy
            out[ch] = c0 + (c1 - c0) * fz
        }
    }

    private fun at(x: Int, y: Int, z: Int) = ((z * N + y) * N + x) * 3

    /** O preset inteiro para uma cor, sem intensidade. Valores de 0 a 1 em sRGB. */
    private fun map(r0: Float, g0: Float, b0: Float, out: FloatArray) {
        // Balanço de branco e exposição em luz linear.
        var r = linear(r0) * p.wbRed * p.exposure
        var g = linear(g0) * p.wbGreen * p.exposure
        var b = linear(b0) * p.wbBlue * p.exposure

        // Tons e curvas em valores de tela.
        r = p.curveRed.at(p.curveMaster.at(tone(dehaze(gamma(r)))))
        g = p.curveGreen.at(p.curveMaster.at(tone(dehaze(gamma(g)))))
        b = p.curveBlue.at(p.curveMaster.at(tone(dehaze(gamma(b)))))

        // HSL, vibração e saturação.
        val hsl = rgbToHsl(r, g, b)
        var hue = hsl[0]
        var sat = hsl[1]
        var lum = hsl[2]
        if (p.hasHsl) {
            val (band, next, t) = band(hue)
            val wa = 1f - t
            hue += (p.hue[band] * wa + p.hue[next] * t) * HUE_RANGE
            sat *= 1f + p.sat[band] * wa + p.sat[next] * t
            lum += (p.lum[band] * wa + p.lum[next] * t) * 0.3f * sat * (1f - abs(2f * lum - 1f))
        }
        if (p.vibrance != 0f) sat *= 1f + p.vibrance * (1f - sat)
        if (p.dehaze != 0f) sat *= 1f + p.dehaze * 0.35f
        sat = (sat * (1f + p.saturation)).coerceIn(0f, 1f)
        hslToRgb(hue, sat, lum.coerceIn(0f, 1f), out)
        r = out[0]
        g = out[1]
        b = out[2]

        // Color grading (ou divisão de tons, nos presets antigos).
        if (p.hasGrading) {
            val y = 0.2126f * r + 0.7152f * g + 0.0722f * b
            val pivot = (0.5f + p.balance * 0.25f).coerceIn(0.15f, 0.85f)
            val shadows = (1f - smoothstep(0f, pivot * 2f, y)).coerceIn(0f, 1f)
            val highlights = smoothstep(pivot * 2f - 1f, 1f, y).coerceIn(0f, 1f)
            val mids = (1f - shadows - highlights).coerceIn(0f, 1f)
            for (zone in p.grading) {
                val w = when (zone.region) {
                    Region.SHADOWS -> shadows
                    Region.MIDTONES -> mids
                    Region.HIGHLIGHTS -> highlights
                    Region.GLOBAL -> 1f
                }
                if (w == 0f) continue
                r += w * (zone.tint[0] * zone.strength + zone.light)
                g += w * (zone.tint[1] * zone.strength + zone.light)
                b += w * (zone.tint[2] * zone.strength + zone.light)
            }
        }

        out[0] = r.coerceIn(0f, 1f)
        out[1] = g.coerceIn(0f, 1f)
        out[2] = b.coerceIn(0f, 1f)
    }

    /**
     * Remover névoa: tira (ou, negativo, põe) um véu claro uniforme. Aproximação global; o
     * Lightroom estima a névoa por região.
     */
    private fun dehaze(x: Float): Float {
        val d = p.dehaze
        if (d == 0f) return x
        return if (d > 0f) {
            val haze = 0.09f * d
            ((x - haze) / (1f - haze)).coerceIn(0f, 1f)
        } else {
            val haze = -0.18f * d
            x * (1f - haze) + haze
        }
    }

    /** Pretos, sombras, realces, brancos, contraste e curva paramétrica, num canal de 0 a 1. */
    private fun tone(x0: Float): Float {
        var x = x0
        if (p.blacks != 0f) x += p.blacks * 0.12f * (1f - x.coerceIn(0f, 1f)).pow(3)
        if (p.shadows != 0f) x += p.shadows * 0.22f * bump(x.coerceIn(0f, 1f), shadow = true)
        if (p.highlights != 0f) x += p.highlights * 0.22f * bump(x.coerceIn(0f, 1f), shadow = false)
        if (p.whites != 0f) x += p.whites * 0.12f * x.coerceIn(0f, 1f).pow(3)
        x = x.coerceIn(0f, 1f)
        if (p.contrast != 0f) x += p.contrast * 0.6f * (x * x * (3f - 2f * x) - x)
        for (zone in p.parametric) {
            if (zone.amount != 0f) {
                val d = (x - zone.center) / 0.14f
                x += zone.amount * 0.12f * exp(-d * d)
            }
        }
        return x.coerceIn(0f, 1f)
    }

    private fun bump(x: Float, shadow: Boolean): Float {
        // x(1-x)² tem pico em 1/3 (sombras); x²(1-x) em 2/3 (realces). Os dois normalizados para 1.
        val v = if (shadow) x * (1f - x) * (1f - x) else x * x * (1f - x)
        return v / 0.148f
    }

    private enum class Region { SHADOWS, MIDTONES, HIGHLIGHTS, GLOBAL }

    private class Zone(val region: Region, hue: Float, saturation: Float, luminance: Float) {
        val tint = FloatArray(3).also { hslToRgb(hue, 1f, 0.5f, it) }.map { it - 0.5f }.toFloatArray()
        val strength = saturation * 0.35f
        val light = luminance * 0.15f
    }

    private class ParametricZone(val center: Float, val amount: Float)

    /** Curva de tons com interpolação cúbica monótona (não cria ondulações entre os pontos). */
    private class Curve(points: List<Pair<Double, Double>>?) {
        private val lut: FloatArray? = points
            ?.filter { it.first in 0.0..255.0 }
            ?.sortedBy { it.first }
            ?.distinctBy { it.first }
            ?.takeIf { it.size >= 2 && !isIdentity(it) }
            ?.let { build(it) }

        fun at(x: Float): Float {
            val table = lut ?: return x
            val pos = x.coerceIn(0f, 1f) * 255f
            val i = pos.toInt().coerceAtMost(254)
            val t = pos - i
            return table[i] + (table[i + 1] - table[i]) * t
        }

        companion object {
            fun isIdentity(points: List<Pair<Double, Double>>) = points.all { abs(it.first - it.second) < 0.5 }

            fun build(points: List<Pair<Double, Double>>): FloatArray {
                val n = points.size
                val xs = DoubleArray(n) { points[it].first }
                val ys = DoubleArray(n) { points[it].second }
                val slopes = DoubleArray(n - 1) { (ys[it + 1] - ys[it]) / (xs[it + 1] - xs[it]) }
                val m = DoubleArray(n)
                m[0] = slopes[0]
                m[n - 1] = slopes[n - 2]
                for (i in 1 until n - 1) {
                    m[i] = if (slopes[i - 1] * slopes[i] <= 0) 0.0 else (slopes[i - 1] + slopes[i]) / 2
                }
                for (i in 0 until n - 1) {
                    if (slopes[i] == 0.0) {
                        m[i] = 0.0
                        m[i + 1] = 0.0
                        continue
                    }
                    val a = m[i] / slopes[i]
                    val b = m[i + 1] / slopes[i]
                    val s = a * a + b * b
                    if (s > 9) {
                        val tau = 3 / sqrt(s)
                        m[i] = tau * a * slopes[i]
                        m[i + 1] = tau * b * slopes[i]
                    }
                }
                return FloatArray(256) { v ->
                    val x = v.toDouble()
                    val y = when {
                        x <= xs[0] -> ys[0]
                        x >= xs[n - 1] -> ys[n - 1]
                        else -> {
                            var k = 0
                            while (x > xs[k + 1]) k++
                            val h = xs[k + 1] - xs[k]
                            val t = (x - xs[k]) / h
                            val t2 = t * t
                            val t3 = t2 * t
                            (2 * t3 - 3 * t2 + 1) * ys[k] + (t3 - 2 * t2 + t) * h * m[k] +
                                (-2 * t3 + 3 * t2) * ys[k + 1] + (t3 - t2) * h * m[k + 1]
                        }
                    }
                    (y / 255.0).toFloat().coerceIn(0f, 1f)
                }
            }
        }
    }

    private class Params(preset: Preset) {
        val exposure: Float
        val wbRed: Float
        val wbGreen: Float
        val wbBlue: Float
        val contrast = (preset.n("Contrast2012") / 100).toFloat()
        val highlights = (preset.n("Highlights2012") / 100).toFloat()
        val shadows = (preset.n("Shadows2012") / 100).toFloat()
        val whites = (preset.n("Whites2012") / 100).toFloat()
        val blacks = (preset.n("Blacks2012") / 100).toFloat()
        val vibrance = (preset.n("Vibrance") / 100).toFloat()
        val saturation = (preset.n("Saturation") / 100).toFloat()
        val dehaze = (preset.n("Dehaze") / 100).toFloat().coerceIn(-1f, 1f)
        val curveMaster = Curve(preset.curves["ToneCurvePV2012"])
        val curveRed = Curve(preset.curves["ToneCurvePV2012Red"])
        val curveGreen = Curve(preset.curves["ToneCurvePV2012Green"])
        val curveBlue = Curve(preset.curves["ToneCurvePV2012Blue"])
        val hue = FloatArray(8) { (preset.n("HueAdjustment${BANDS[it]}") / 100).toFloat() }
        val sat = FloatArray(8) { (preset.n("SaturationAdjustment${BANDS[it]}") / 100).toFloat() }
        val lum = FloatArray(8) { (preset.n("LuminanceAdjustment${BANDS[it]}") / 100).toFloat() }
        val hasHsl = (hue + sat + lum).any { it != 0f }
        val parametric: List<ParametricZone>
        val grading: List<Zone>
        val hasGrading: Boolean
        val balance: Float
        val vignette = (preset.n("PostCropVignetteAmount") / 100).toFloat()
        val vignetteStart = (1.25f - preset.n("PostCropVignetteMidpoint", 50.0).toFloat() / 100f * 0.9f)

        init {
            exposure = 2.0.pow(preset.numbers["Exposure2012"] ?: preset.n("Exposure")).toFloat()

            // Presets feitos em JPEG trazem o ajuste relativo; os feitos em RAW trazem Kelvin.
            val asShot = preset.texts["WhiteBalance"]?.let { it == "As Shot" || it == "Como fotografado" } ?: false
            val temperature = when {
                preset.numbers.containsKey("IncrementalTemperature") -> preset.n("IncrementalTemperature")
                !asShot && preset.numbers.containsKey("Temperature") -> ((preset.n("Temperature") - 5500) / 40).coerceIn(-100.0, 100.0)
                else -> 0.0
            }.toFloat() / 100f
            val tint = when {
                preset.numbers.containsKey("IncrementalTint") -> preset.n("IncrementalTint")
                !asShot && preset.numbers.containsKey("Tint") -> preset.n("Tint") / 1.5
                else -> 0.0
            }.toFloat() / 100f
            wbRed = (1f + 0.22f * temperature) * (1f + 0.05f * tint)
            wbGreen = 1f - 0.18f * tint
            wbBlue = (1f - 0.22f * temperature) * (1f + 0.05f * tint)

            val s1 = preset.n("ParametricShadowSplit", 25.0).toFloat() / 100f
            val s2 = preset.n("ParametricMidtoneSplit", 50.0).toFloat() / 100f
            val s3 = preset.n("ParametricHighlightSplit", 75.0).toFloat() / 100f
            parametric = listOf(
                ParametricZone(s1 / 2f, (preset.n("ParametricShadows") / 100).toFloat()),
                ParametricZone((s1 + s2) / 2f, (preset.n("ParametricDarks") / 100).toFloat()),
                ParametricZone((s2 + s3) / 2f, (preset.n("ParametricLights") / 100).toFloat()),
                ParametricZone((s3 + 1f) / 2f, (preset.n("ParametricHighlights") / 100).toFloat()),
            )

            fun zone(region: Region, hueKey: String, satKey: String, lumKey: String?, oldHue: String? = null, oldSat: String? = null): Zone? {
                val hue = preset.numbers[hueKey] ?: oldHue?.let { preset.numbers[it] } ?: 0.0
                val s = preset.numbers[satKey] ?: oldSat?.let { preset.numbers[it] } ?: 0.0
                val l = lumKey?.let { preset.n(it) } ?: 0.0
                if (s == 0.0 && l == 0.0) return null
                return Zone(region, hue.toFloat(), (s / 100).toFloat(), (l / 100).toFloat())
            }
            grading = listOfNotNull(
                zone(Region.SHADOWS, "ColorGradeShadowHue", "ColorGradeShadowSat", "ColorGradeShadowLum", "SplitToningShadowHue", "SplitToningShadowSaturation"),
                zone(Region.MIDTONES, "ColorGradeMidtoneHue", "ColorGradeMidtoneSat", "ColorGradeMidtoneLum"),
                zone(Region.HIGHLIGHTS, "ColorGradeHighlightHue", "ColorGradeHighlightSat", "ColorGradeHighlightLum", "SplitToningHighlightHue", "SplitToningHighlightSaturation"),
                zone(Region.GLOBAL, "ColorGradeGlobalHue", "ColorGradeGlobalSat", "ColorGradeGlobalLum"),
            )
            hasGrading = grading.isNotEmpty()
            balance = (preset.n("SplitToningBalance") / 100).toFloat()
        }
    }

    companion object {
        private const val N = 33
        private const val HUE_RANGE = 30f
        private const val VIGNETTE_END = 1.42f
        private val BANDS = arrayOf("Red", "Orange", "Yellow", "Green", "Aqua", "Blue", "Purple", "Magenta")
        private val CENTERS = floatArrayOf(0f, 30f, 60f, 120f, 180f, 240f, 270f, 300f, 360f)

        /** Faixa de cor do HSL do Lightroom em que o matiz cai, a seguinte e a posição entre as duas. */
        private fun band(hue: Float): Triple<Int, Int, Float> {
            val h = ((hue % 360f) + 360f) % 360f
            var i = 0
            while (h >= CENTERS[i + 1]) i++
            val t = (h - CENTERS[i]) / (CENTERS[i + 1] - CENTERS[i])
            return Triple(i, (i + 1) % 8, t)
        }

        private fun linear(c: Float) = if (c <= 0.04045f) c / 12.92f else ((c + 0.055f) / 1.055f).pow(2.4f)

        private fun gamma(c0: Float): Float {
            val c = c0.coerceAtLeast(0f)
            return if (c <= 0.0031308f) c * 12.92f else 1.055f * c.pow(1f / 2.4f) - 0.055f
        }

        private fun smoothstep(a: Float, b: Float, x: Float): Float {
            val t = ((x - a) / (b - a)).coerceIn(0f, 1f)
            return t * t * (3f - 2f * t)
        }

        private fun byte(v: Float) = (v * 255f + 0.5f).toInt().coerceIn(0, 255)

        private fun rgbToHsl(r: Float, g: Float, b: Float): FloatArray {
            val max = maxOf(r, g, b)
            val min = minOf(r, g, b)
            val l = (max + min) / 2f
            if (max - min < 1e-6f) return floatArrayOf(0f, 0f, l)
            val d = max - min
            val s = if (l > 0.5f) d / (2f - max - min) else d / (max + min)
            val h = when (max) {
                r -> ((g - b) / d + (if (g < b) 6f else 0f))
                g -> (b - r) / d + 2f
                else -> (r - g) / d + 4f
            } * 60f
            return floatArrayOf(h, s, l)
        }

        private fun hslToRgb(h0: Float, s: Float, l: Float, out: FloatArray) {
            if (s <= 0f) {
                out[0] = l
                out[1] = l
                out[2] = l
                return
            }
            val h = (((h0 % 360f) + 360f) % 360f) / 360f
            val q = if (l < 0.5f) l * (1f + s) else l + s - l * s
            val p = 2f * l - q
            out[0] = hue(p, q, h + 1f / 3f)
            out[1] = hue(p, q, h)
            out[2] = hue(p, q, h - 1f / 3f)
        }

        private fun hue(p: Float, q: Float, t0: Float): Float {
            var t = t0
            if (t < 0f) t += 1f
            if (t > 1f) t -= 1f
            return when {
                t < 1f / 6f -> p + (q - p) * 6f * t
                t < 0.5f -> q
                t < 2f / 3f -> p + (q - p) * (2f / 3f - t) * 6f
                else -> p
            }
        }
    }
}
