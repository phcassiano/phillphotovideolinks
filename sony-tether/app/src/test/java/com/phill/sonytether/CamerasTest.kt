package com.phill.sonytether

import com.phill.sonytether.ptp.PtpDeviceInfo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

class CamerasTest {
    private class Writer {
        val out = ByteArrayOutputStream()
        fun u16(v: Int) = apply { out.write(v and 0xFF); out.write((v shr 8) and 0xFF) }
        fun u32(v: Long) = apply { u16((v and 0xFFFF).toInt()); u16(((v shr 16) and 0xFFFF).toInt()) }
        fun u32(v: Int) = u32(v.toLong() and 0xFFFFFFFFL)
        fun str(s: String) = apply {
            if (s.isEmpty()) { out.write(0); return@apply }
            out.write(s.length + 1)
            for (c in s) u16(c.code)
            u16(0)
        }
        fun array(vararg v: Int) = apply { u32(v.size); v.forEach { u16(it) } }
        fun bytes() = out.toByteArray()
    }

    @Test
    fun readsDeviceInfo() {
        val data = Writer().u16(100).u32(0x0B).u16(100).str("canon.com: 1.0").u16(0)
            .array(0x1001, 0x1002, 0x9116).array(0x4002).array(0x5001).array(0x3801).array(0x3801, 0xB108)
            .str("Canon Inc.").str("Canon EOS R6").str("1-1.8.0").str("123").bytes()
        val info = PtpDeviceInfo.parse(data)
        assertEquals(0x0B, info.vendorExtension)
        assertEquals("Canon EOS R6", info.model)
        assertTrue(info.supports(CanonCamera.OC_GET_EVENT))
    }

    /** Registro de "objeto novo" da Canon como o GetEvent devolve. */
    private fun canonRecord(type: Int, handle: Int, format: Int, size: Long, name: String, wide: Boolean): ByteArray {
        val nameAt = if (wide) 44 else 40
        val total = nameAt + name.length + 1 + 3
        val b = ByteBuffer.allocate(total).order(ByteOrder.LITTLE_ENDIAN)
        b.putInt(0, total).putInt(4, type).putInt(8, handle).putInt(12, 0x00010001).putShort(16, format.toShort())
        if (wide) b.putLong(28, size) else b.putInt(28, size.toInt())
        name.forEachIndexed { i, c -> b.put(nameAt + i, c.code.toByte()) }
        return b.array()
    }

    @Test
    fun readsCanonNewPhotoEvents() {
        val propChange = ByteBuffer.allocate(20).order(ByteOrder.LITTLE_ENDIAN).putInt(20).putInt(0xC189).array()
        val end = ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN).putInt(8).putInt(0).array()
        val data = propChange +
            canonRecord(CanonCamera.EC_OBJECT_ADDED_EX, 0x91A3, 0xB108, 28_000_000, "IMG_0042.CR3", wide = false) +
            canonRecord(CanonCamera.EC_OBJECT_ADDED_EX64, 0x91A4, 0x3801, 9_000_000, "IMG_0042.JPG", wide = true) +
            end + canonRecord(CanonCamera.EC_OBJECT_ADDED_EX, 1, 0x3801, 1, "DEPOIS.JPG", wide = false)
        val objects = CanonCamera.parseEvents(data)
        assertEquals(listOf("IMG_0042.CR3", "IMG_0042.JPG"), objects.map { it.name })
        assertEquals(listOf(0x91A3, 0x91A4), objects.map { it.handle })
        assertEquals(28_000_000L, objects[0].size)
        assertEquals(9_000_000L, objects[1].size)
    }

    @Test
    fun readsNikonEvents() {
        val check = Writer().u16(2).u16(0x4002).u32(0x1234).u16(0xC101).u32(0).bytes()
        val events = NikonCamera.parseCheckEvent(check)
        assertEquals(listOf(0x4002, 0xC101), events.map { it.code })
        assertEquals(0x1234, events[0].params[0])

        val ex = Writer().u16(2).u16(0x4002).u16(1).u32(0x55).u16(0x4006).u16(0).bytes()
        val exEvents = NikonCamera.parseEventEx(ex)
        assertEquals(listOf(0x4002, 0x4006), exEvents.map { it.code })
        assertEquals(0x55, exEvents[0].params[0])
    }

    @Test
    fun onlyPhotosAreDownloaded() {
        assertTrue(GenericPtpCamera.isPhoto("DSC_0001.NEF"))
        assertTrue(GenericPtpCamera.isPhoto("IMG_0001.CR3"))
        assertTrue(GenericPtpCamera.isPhoto("DSC00001.HIF"))
        assertTrue(!GenericPtpCamera.isPhoto("MVI_0001.MP4"))
        assertTrue(!GenericPtpCamera.isPhoto("IMG_0001.XMP"))
    }
}
