package com.phill.sonytether

import android.graphics.Bitmap
import android.graphics.RectF
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

    @Test
    fun geometryTurnsStraightensAndCrops() {
        val photo = Bitmap.createBitmap(400, 200, Bitmap.Config.ARGB_8888)
        val turned = PhotoEdit.NONE.withGeometry(1, 0, RectF(0f, 0f, 1f, 1f)).shape(photo)
        assertEquals(200, turned.width)
        assertEquals(400, turned.height)

        val half = PhotoEdit.NONE.withGeometry(0, 0, RectF(0.5f, 0f, 1f, 0.5f))
        assertTrue(half.hasGeometry)
        val cropped = half.shape(photo)
        assertEquals(200, cropped.width)
        assertEquals(100, cropped.height)

        // Endireitar encolhe na mesma proporção, sem canto vazio.
        val k = PhotoEdit.straightenScale(400f, 200f, 10f)
        assertTrue(k < 1f && k > 0.7f)
        val straight = PhotoEdit.NONE.withGeometry(0, 100, RectF(0f, 0f, 1f, 1f)).shape(photo)
        assertEquals(2f, straight.width.toFloat() / straight.height, 0.02f)
    }

    @Test
    fun tonesAndGeometryTravelSeparately() {
        val edit = PhotoEdit(mapOf("Contrast2012" to 30)).withGeometry(2, -15, RectF(0.1f, 0.1f, 0.9f, 0.9f))
        assertEquals(mapOf("Contrast2012" to 30), edit.tonesOnly().values)
        assertEquals(2, edit.geometryOnly().quarters)
        assertEquals(0.1f, edit.crop.left, 1e-4f)
        assertEquals(0.9f, edit.crop.right, 1e-4f)
        val back = PhotoEdit.fromJson(JSONObject(edit.toJson().toString()))
        assertEquals(edit.signature, back.signature)
        assertTrue(!back.toPreset().numbers.containsKey(PhotoEdit.ROTATE))
    }
}
