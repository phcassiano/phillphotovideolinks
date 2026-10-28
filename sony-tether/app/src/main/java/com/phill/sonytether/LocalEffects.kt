package com.phill.sonytether

import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/**
 * Ajustes do Lightroom que dependem da vizinhança do pixel (Claridade, Textura) ou da posição
 * dele na foto (Granulado). Rodam depois da tabela de cor, sobre os pixels ARGB.
 *
 * Os raios e o tamanho do grão são proporcionais ao lado menor da foto inteira, então a tela
 * (2048 px), o JPEG (4096 px) e o trecho do zoom ficam com o mesmo aspecto.
 */
class LocalEffects(
    /** -1 a 1 (Clarity2012 / 100). */
    private val clarity: Float,
    /** -1 a 1 (Texture / 100). */
    private val texture: Float,
    /** 0 a 1 (GrainAmount / 100). */
    private val grain: Float,
    /** 0 a 1 (GrainSize / 100; o padrão do Lightroom é 25). */
    private val grainSize: Float,
    /** 0 a 1 (GrainFrequency / 100, "Aspereza"; padrão 50). */
    private val grainRoughness: Float,
) {
    val isEmpty get() = clarity == 0f && texture == 0f && grain == 0f

    /**
     * [pixels] é a imagem [w]×[h]. Ela é um trecho da foto inteira, que mede [fullW]×[fullH] na mesma
     * escala e começa em ([offX], [offY]); para a foto inteira, use o próprio tamanho e 0.
     */
    fun apply(pixels: IntArray, w: Int, h: Int, fullW: Float = w.toFloat(), fullH: Float = h.toFloat(), offX: Float = 0f, offY: Float = 0f) {
        if (isEmpty || w <= 0 || h <= 0) return
        val unit = min(fullW, fullH)
        val luma = FloatArray(w * h)
        for (i in luma.indices) {
            val c = pixels[i]
            luma[i] = 0.299f * ((c shr 16) and 0xFF) + 0.587f * ((c shr 8) and 0xFF) + 0.114f * (c and 0xFF)
        }
        val clarityBlur = if (clarity != 0f) Blur(luma, w, h, unit * CLARITY_RADIUS) else null
        val textureBlur = if (texture != 0f) Blur(luma, w, h, unit * TEXTURE_RADIUS) else null
        val grainCell = unit * (0.0006f + grainSize * 0.0028f)
        val grainStrength = grain * 26f

        for (y in 0 until h) {
            for (x in 0 until w) {
                val i = y * w + x
                val l = luma[i]
                val t = l / 255f * 2f - 1f
                val mids = 1f - t * t
                var delta = 0f
                if (clarityBlur != null) delta += clarity * 0.9f * (l - clarityBlur.at(x, y)) * (0.25f + 0.75f * mids)
                if (textureBlur != null) delta += texture * 1.1f * (l - textureBlur.at(x, y)) * (0.4f + 0.6f * mids)
                if (grainStrength > 0f) {
                    val gx = (offX + x) / grainCell
                    val gy = (offY + y) / grainCell
                    val n = noise(gx, gy) * (1f - grainRoughness * 0.5f) + noise(gx * 2.3f + 17f, gy * 2.3f + 5f) * grainRoughness * 0.7f
                    delta += grainStrength * n * (0.45f + 0.55f * mids)
                }
                if (delta == 0f) continue
                val c = pixels[i]
                val d = delta.toInt()
                pixels[i] = (c and 0xFF000000.toInt()) or
                    (clamp(((c shr 16) and 0xFF) + d) shl 16) or (clamp(((c shr 8) and 0xFF) + d) shl 8) or clamp((c and 0xFF) + d)
            }
        }
    }

    /**
     * Desfoque de caixa feito numa grade reduzida (cada célula ≈ um terço do raio) e lido com
     * interpolação: barato e com memória pequena mesmo para raios grandes.
     */
    private class Blur(luma: FloatArray, private val w: Int, private val h: Int, radius: Float) {
        private val cell = max(1, (radius / 3f).toInt())
        private val gw = ceil(w / cell.toFloat()).toInt()
        private val gh = ceil(h / cell.toFloat()).toInt()
        private val grid = FloatArray(gw * gh)

        init {
            val count = IntArray(gw * gh)
            for (y in 0 until h) {
                val row = (y / cell) * gw
                for (x in 0 until w) {
                    val g = row + x / cell
                    grid[g] += luma[y * w + x]
                    count[g]++
                }
            }
            for (i in grid.indices) grid[i] /= max(1, count[i])
            val r = max(1, (radius / cell).toInt())
            repeat(2) {
                boxRows(r)
                boxColumns(r)
            }
        }

        private fun boxRows(r: Int) {
            val line = FloatArray(gw)
            for (y in 0 until gh) {
                val base = y * gw
                var sum = 0f
                for (k in -r..r) sum += grid[base + k.coerceIn(0, gw - 1)]
                for (x in 0 until gw) {
                    line[x] = sum / (2 * r + 1)
                    sum += grid[base + (x + r + 1).coerceAtMost(gw - 1)] - grid[base + (x - r).coerceAtLeast(0)]
                }
                line.copyInto(grid, base)
            }
        }

        private fun boxColumns(r: Int) {
            val line = FloatArray(gh)
            for (x in 0 until gw) {
                var sum = 0f
                for (k in -r..r) sum += grid[k.coerceIn(0, gh - 1) * gw + x]
                for (y in 0 until gh) {
                    line[y] = sum / (2 * r + 1)
                    sum += grid[(y + r + 1).coerceAtMost(gh - 1) * gw + x] - grid[(y - r).coerceAtLeast(0) * gw + x]
                }
                for (y in 0 until gh) grid[y * gw + x] = line[y]
            }
        }

        fun at(x: Int, y: Int): Float {
            val fx = ((x + 0.5f) / cell - 0.5f).coerceIn(0f, gw - 1f)
            val fy = ((y + 0.5f) / cell - 0.5f).coerceIn(0f, gh - 1f)
            val x0 = fx.toInt().coerceAtMost(gw - 1)
            val y0 = fy.toInt().coerceAtMost(gh - 1)
            val x1 = min(x0 + 1, gw - 1)
            val y1 = min(y0 + 1, gh - 1)
            val tx = fx - x0
            val ty = fy - y0
            val top = grid[y0 * gw + x0] + (grid[y0 * gw + x1] - grid[y0 * gw + x0]) * tx
            val bottom = grid[y1 * gw + x0] + (grid[y1 * gw + x1] - grid[y1 * gw + x0]) * tx
            return top + (bottom - top) * ty
        }
    }

    companion object {
        /** Raio da Claridade: 2% do lado menor (contraste local amplo). */
        const val CLARITY_RADIUS = 0.02f

        /** Raio da Textura: 0,3% do lado menor (detalhes finos, pele, tecido). */
        const val TEXTURE_RADIUS = 0.003f

        /** [amount] é a intensidade do preset (0 a 1). */
        fun from(preset: Preset, amount: Float = 1f) = LocalEffects(
            clarity = (preset.n("Clarity2012", preset.n("Clarity")) / 100).toFloat().coerceIn(-1f, 1f) * amount,
            texture = (preset.n("Texture") / 100).toFloat().coerceIn(-1f, 1f) * amount,
            grain = (preset.n("GrainAmount") / 100).toFloat().coerceIn(0f, 1f) * amount,
            grainSize = (preset.n("GrainSize", 25.0) / 100).toFloat().coerceIn(0f, 1f),
            grainRoughness = (preset.n("GrainFrequency", 50.0) / 100).toFloat().coerceIn(0f, 1f),
        )

        private fun clamp(v: Int) = if (v < 0) 0 else if (v > 255) 255 else v

        /** Ruído suave de -1 a 1: valores aleatórios fixos nos cantos da grade, interpolados. */
        fun noise(x: Float, y: Float): Float {
            val xi = floor(x).toInt()
            val yi = floor(y).toInt()
            val tx = x - xi
            val ty = y - yi
            val sx = tx * tx * (3f - 2f * tx)
            val sy = ty * ty * (3f - 2f * ty)
            val a = hash(xi, yi)
            val b = hash(xi + 1, yi)
            val c = hash(xi, yi + 1)
            val d = hash(xi + 1, yi + 1)
            val top = a + (b - a) * sx
            val bottom = c + (d - c) * sx
            return top + (bottom - top) * sy
        }

        private fun hash(x: Int, y: Int): Float {
            var h = x * 374761393 + y * 668265263
            h = (h xor (h ushr 13)) * 1274126177
            h = h xor (h ushr 16)
            return (h and 0xFFFF) / 32767.5f - 1f
        }
    }
}
