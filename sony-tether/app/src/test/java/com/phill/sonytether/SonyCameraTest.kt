package com.phill.sonytether

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
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
        val f = props.getValue(0x5007)
        assertEquals(400L, f.current)
        assertArrayEquals(longArrayOf(280, 400, 560), f.values)
        assertEquals(0x000100FAL, props.getValue(0xD20D).current)
        assertEquals(0x8001L, props.getValue(SonyCamera.PROP_OBJECT_IN_MEMORY).current)
    }
}
