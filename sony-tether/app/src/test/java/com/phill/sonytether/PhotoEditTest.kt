package com.phill.sonytether

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class PhotoEditTest {

    @Test
    fun zerosAreDroppedAndSignatureIsStable() {
        val a = PhotoEdit(mapOf("Contrast2012" to 20, "Exposure2012" to 50, "Saturation" to 0))
        val b = PhotoEdit(mapOf("Exposure2012" to 50, "Contrast2012" to 20))
        assertEquals(a.signature, b.signature)
        assertTrue(PhotoEdit(mapOf("Saturation" to 0)).isEmpty)
    }

    @Test
    fun jsonRoundTripKeepsKnownKeysWithinLimits() {
        val edit = PhotoEdit(mapOf("Exposure2012" to -120, "IncrementalTemperature" to 35))
        assertEquals(edit.signature, PhotoEdit.fromJson(JSONObject(edit.toJson().toString())).signature)
        val odd = PhotoEdit.fromJson(JSONObject("""{"Contrast2012": 500, "Desconhecido": 10}"""))
        assertEquals(mapOf("Contrast2012" to 100), odd.values)
    }

    @Test
    fun exposureIsInHundredthsOfStop() {
        assertEquals(1.0, PhotoEdit(mapOf("Exposure2012" to 100)).toPreset().n("Exposure2012"), 1e-9)
        val out = FloatArray(3)
        PresetLook(PhotoEdit(mapOf("Exposure2012" to 100)).toPreset(), 1f).lookup(0.3f, 0.3f, 0.3f, out)
        assertTrue("mais claro: ${out[0]}", out[0] > 0.35f)
        PresetLook(PhotoEdit.NONE.toPreset(), 1f).lookup(0.3f, 0.3f, 0.3f, out)
        assertEquals(0.3f, out[0], 0.01f)
    }
}
