package com.phill.sonytether

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs

class LocalEffectsTest {
    private fun gray(v: Int) = (0xFF shl 24) or (v shl 16) or (v shl 8) or v
    private fun value(c: Int) = c and 0xFF

    /** Metade esquerda escura, direita clara. */
    private fun edge(w: Int, h: Int) = IntArray(w * h) { i -> gray(if (i % w < w / 2) 90 else 160) }

    private fun preset(vararg values: Pair<String, Double>) = Preset("t", values.toMap(), emptyMap(), emptyMap(), emptyList())

    @Test
    fun clarityRaisesContrastNearEdges() {
        val w = 400
        val h = 300
        val px = edge(w, h)
        LocalEffects.from(preset("Clarity2012" to 100.0)).apply(px, w, h)
        val row = 150 * w
        assertTrue("lado escuro fica mais escuro perto da borda", value(px[row + w / 2 - 2]) < 90)
        assertTrue("lado claro fica mais claro perto da borda", value(px[row + w / 2 + 2]) > 160)
        assertEquals("longe da borda quase não muda", 90.0, value(px[row + 2]).toDouble(), 3.0)
    }

    @Test
    fun negativeClaritySoftens() {
        val w = 400
        val h = 300
        val px = edge(w, h)
        LocalEffects.from(preset("Clarity2012" to -100.0)).apply(px, w, h)
        val row = 150 * w
        assertTrue(value(px[row + w / 2 - 2]) > 90)
        assertTrue(value(px[row + w / 2 + 2]) < 160)
    }

    @Test
    fun flatImageIsUntouchedByClarityAndTexture() {
        val px = IntArray(100 * 80) { gray(128) }
        val copy = px.copyOf()
        LocalEffects.from(preset("Clarity2012" to 80.0, "Texture" to 80.0)).apply(px, 100, 80)
        assertArrayEquals(copy, px)
    }

    @Test
    fun grainIsDeterministicAndFollowsThePhotoNotTheTile() {
        val effects = LocalEffects.from(preset("GrainAmount" to 60.0))
        val full = IntArray(300 * 200) { gray(128) }
        effects.apply(full, 300, 200)
        assertTrue("o grão muda pixels de uma área lisa", full.any { value(it) != 128 })
        val again = IntArray(300 * 200) { gray(128) }
        effects.apply(again, 300, 200)
        assertArrayEquals(full, again)

        // Um trecho (como no zoom) recebe o mesmo grão que aquela região da foto inteira.
        val tile = IntArray(50 * 40) { gray(128) }
        effects.apply(tile, 50, 40, fullW = 300f, fullH = 200f, offX = 120f, offY = 70f)
        for (y in 0 until 40) for (x in 0 until 50) assertEquals(value(full[(70 + y) * 300 + 120 + x]), value(tile[y * 50 + x]))
    }

    @Test
    fun intensityScalesTheEffect() {
        val w = 400
        val h = 300
        val strong = edge(w, h).also { LocalEffects.from(preset("Clarity2012" to 100.0), 1f).apply(it, w, h) }
        val weak = edge(w, h).also { LocalEffects.from(preset("Clarity2012" to 100.0), 0.3f).apply(it, w, h) }
        val i = 150 * w + w / 2 + 2
        assertTrue(abs(value(strong[i]) - 160) > abs(value(weak[i]) - 160))
    }

    @Test
    fun dehazeDeepensMidtonesAndAddsColor() {
        val look = PresetLook(preset("Dehaze" to 60.0), 1f)
        val out = FloatArray(3)
        look.lookup(0.5f, 0.5f, 0.5f, out)
        assertTrue(out[0] < 0.5f)
        look.lookup(0.6f, 0.45f, 0.4f, out)
        val plain = FloatArray(3).also { PresetLook(preset(), 1f).lookup(0.6f, 0.45f, 0.4f, it) }
        assertTrue("mais saturado", out[0] - out[2] > plain[0] - plain[2])
    }
}
