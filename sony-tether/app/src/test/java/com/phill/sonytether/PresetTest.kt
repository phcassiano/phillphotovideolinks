package com.phill.sonytether

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs

class PresetTest {

    private val xmp = """
        <x:xmpmeta xmlns:x="adobe:ns:meta/">
         <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
          <rdf:Description rdf:about="" xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
           crs:Version="15.0" crs:Exposure2012="+0.50" crs:Contrast2012="+20" crs:Clarity2012="+10"
           crs:WhiteBalance="As Shot" crs:Temperature="6500" crs:SplitToningShadowHue="220"
           crs:SplitToningShadowSaturation="15">
           <crs:Name><rdf:Alt><rdf:li xml:lang="x-default">Casamento Quente</rdf:li></rdf:Alt></crs:Name>
           <crs:ToneCurvePV2012>
            <rdf:Seq><rdf:li>0, 20</rdf:li><rdf:li>128, 128</rdf:li><rdf:li>255, 240</rdf:li></rdf:Seq>
           </crs:ToneCurvePV2012>
          </rdf:Description>
         </rdf:RDF>
        </x:xmpmeta>
    """.trimIndent()

    private val lrtemplate = """
        s = {
            id = "ABC",
            title = "Filme Antigo",
            type = "Develop",
            value = {
                settings = {
                    Exposure2012 = -0.3,
                    Saturation = -25,
                    ToneCurvePV2012 = { 0, 30, 255, 255, },
                    WhiteBalance = "Custom",
                },
            },
        }
    """.trimIndent()

    @Test
    fun readsXmpPreset() {
        val p = Preset.parse("casamento.xmp", xmp.toByteArray())
        assertNotNull(p)
        p!!
        assertEquals("Casamento Quente", p.name)
        assertEquals(0.5, p.n("Exposure2012"), 1e-9)
        assertEquals(20.0, p.n("Contrast2012"), 1e-9)
        assertEquals("As Shot", p.texts["WhiteBalance"])
        assertEquals(listOf(0.0 to 20.0, 128.0 to 128.0, 255.0 to 240.0), p.curves["ToneCurvePV2012"])
        assertEquals(emptyList<String>(), p.ignored) // claridade agora é reproduzida
    }

    @Test
    fun readsLrtemplatePreset() {
        val p = Preset.parse("filme.lrtemplate", lrtemplate.toByteArray())!!
        assertEquals("Filme Antigo", p.name)
        assertEquals(-0.3, p.n("Exposure2012"), 1e-9)
        assertEquals(-25.0, p.n("Saturation"), 1e-9)
        assertEquals(listOf(0.0 to 30.0, 255.0 to 255.0), p.curves["ToneCurvePV2012"])
    }

    @Test
    fun rejectsOtherFiles() {
        assertNull(Preset.parse("foto.txt", "nada aqui".toByteArray()))
    }

    private fun look(vararg values: Pair<String, Double>, amount: Float = 1f) =
        PresetLook(Preset("t", mapOf(*values), emptyMap(), emptyMap(), emptyList()), amount)

    private fun color(look: PresetLook, r: Float, g: Float, b: Float) = FloatArray(3).also { look.lookup(r, g, b, it) }

    @Test
    fun emptyPresetKeepsColors() {
        val l = look()
        for (c in listOf(floatArrayOf(0f, 0f, 0f), floatArrayOf(1f, 1f, 1f), floatArrayOf(0.8f, 0.3f, 0.1f), floatArrayOf(0.2f, 0.5f, 0.9f))) {
            val out = color(l, c[0], c[1], c[2])
            for (i in 0..2) assertEquals(c[i], out[i], 0.01f)
        }
    }

    @Test
    fun adjustmentsGoTheRightWay() {
        val grey = 0.5f
        assertTrue(color(look("Exposure2012" to 1.0), grey, grey, grey)[0] > 0.6f)
        assertTrue(color(look("Exposure2012" to -1.0), grey, grey, grey)[0] < 0.4f)

        val warm = color(look("IncrementalTemperature" to 50.0), grey, grey, grey)
        assertTrue(warm[0] > warm[2])

        val desat = color(look("Saturation" to -100.0), 0.8f, 0.3f, 0.1f)
        assertTrue(abs(desat[0] - desat[2]) < 0.02f)

        val contrast = look("Contrast2012" to 80.0)
        assertTrue(color(contrast, 0.2f, 0.2f, 0.2f)[0] < 0.2f)
        assertTrue(color(contrast, 0.8f, 0.8f, 0.8f)[0] > 0.8f)
    }

    @Test
    fun intensityBlendsWithOriginal() {
        val full = color(look("Exposure2012" to 1.0), 0.4f, 0.4f, 0.4f)[0]
        val half = color(look("Exposure2012" to 1.0, amount = 0.5f), 0.4f, 0.4f, 0.4f)[0]
        assertEquals((0.4f + full) / 2f, half, 0.01f)
    }

    @Test
    fun curveLiftsBlacks() {
        val p = Preset("c", emptyMap(), emptyMap(), mapOf("ToneCurvePV2012" to listOf(0.0 to 40.0, 255.0 to 255.0)), emptyList())
        val out = color(PresetLook(p, 1f), 0f, 0f, 0f)
        assertEquals(40f / 255f, out[0], 0.01f)
    }
}
