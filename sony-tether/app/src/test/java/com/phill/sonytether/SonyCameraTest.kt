package com.phill.sonytether

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import java.io.ByteArrayOutputStream

class SonyCameraTest {

    private class Packet {
        val out = ByteArrayOutputStream()
        fun u8(v: Int) = apply { out.write(v and 0xFF) }
        fun u16(v: Int) = apply { u8(v); u8(v shr 8) }
        fun u32(v: Long) = apply { u16(v.toInt()); u16((v shr 16).toInt()) }
        fun u64(v: Long) = apply { u32(v); u32(v shr 32) }
        fun bytes() = out.toByteArray()
    }

    /** F-number com lista, velocidade sem lista e fotos pendentes; [twoLists] imita o protocolo 3. */
    private fun allProps(twoLists: Boolean): ByteArray {
        val p = Packet().u64(3)
        // 0x5007 UINT16, lista f/2.8 f/4 f/5.6, atual f/4
        p.u16(0x5007).u16(4).u8(1).u8(1).u16(400).u16(400).u8(2)
        p.u16(3).u16(280).u16(400).u16(560)
        if (twoLists) p.u16(3).u16(280).u16(400).u16(560)
        // 0xD20D UINT32 sem lista, 1/250
        p.u16(0xD20D).u16(6).u8(1).u8(1).u32(0x000100FA).u32(0x000100FA).u8(0)
        // 0xD215 UINT16 faixa, 0x8001 = uma foto esperando
        p.u16(0xD215).u16(4).u8(0).u8(1).u16(0).u16(0x8001).u8(1).u16(0).u16(0xFFFF).u16(1)
        return p.bytes()
    }

    @Test
    fun parsesOldProtocol() = checkParsed(SonyCamera.parseAllProps(allProps(twoLists = false)))

    @Test
    fun parsesProtocol3WithTwoLists() = checkParsed(SonyCamera.parseAllProps(allProps(twoLists = true)))

    private fun checkParsed(props: Map<Int, SonyProp>) {
        assertEquals(3, props.size)
        val f = props.getValue(SonyCamera.PROP_F_NUMBER)
        assertEquals(400L, f.current)
        assertArrayEquals(longArrayOf(280, 400, 560), f.values)
        assertEquals(0x000100FAL, props.getValue(SonyCamera.PROP_SHUTTER_SPEED).current)
        assertEquals(0x8001L, props.getValue(SonyCamera.PROP_OBJECT_IN_MEMORY).current)
    }

    @Test
    fun findsJpegInLiveViewPacket() {
        val jpeg = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 1, 2, 3, 0xFF.toByte(), 0xD9.toByte())
        val packet = Packet().u32(16).u32(jpeg.size.toLong()).u64(0).bytes() + jpeg + byteArrayOf(9, 9)
        val region = SonyCamera.findJpeg(packet)
        assertNotNull(region)
        region!!
        assertEquals(16, region.offset)
        assertEquals(jpeg.size, region.length)
    }

    @Test
    fun formatsValues() {
        assertEquals("1/250", SonyFormat.value(SonyCamera.PROP_SHUTTER_SPEED, 0x000100FA))
        assertEquals("1.3\"", SonyFormat.value(SonyCamera.PROP_SHUTTER_SPEED, (13L shl 16) or 10))
        assertEquals("30\"", SonyFormat.value(SonyCamera.PROP_SHUTTER_SPEED, (300L shl 16) or 10))
        assertEquals("f/2.8", SonyFormat.value(SonyCamera.PROP_F_NUMBER, 280))
        assertEquals("f/11", SonyFormat.value(SonyCamera.PROP_F_NUMBER, 1100))
        assertEquals("AUTO", SonyFormat.value(SonyCamera.PROP_ISO, 0xFFFFFF))
        assertEquals("800", SonyFormat.value(SonyCamera.PROP_ISO, 800))
        assertEquals("-0.7", SonyFormat.value(SonyCamera.PROP_EXPOSURE_COMP, -700))
        assertEquals("M", SonyFormat.value(SonyCamera.PROP_EXPOSURE_MODE, 1))
    }
}
