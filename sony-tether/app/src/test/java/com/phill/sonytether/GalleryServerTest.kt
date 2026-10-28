package com.phill.sonytether

import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipInputStream

class GalleryServerTest {
    private val photos = mapOf(1 to byteArrayOf(1, 2, 3), 2 to ByteArray(50_000) { it.toByte() })

    private val server = GalleryServer(object : GalleryServer.Source {
        override val galleryTitle = "Maria & <Júlia>"
        override val brand = GalleryServer.Brand("Phill Foto", "@phill.foto", "(11) 98765-4321", hasLogo = true)
        override fun items() = listOf(2 to "Maria_002.arw", 1 to "Maria_001.jpg")
        override fun slideshowItems() = listOf(1)
        override fun photo(number: Int) = photos[number]
        override fun thumbnail(number: Int) = byteArrayOf(9)
        override fun screen(number: Int) = byteArrayOf(7, number.toByte())
        override fun logo() = byteArrayOf(5)
    }).apply { start() }

    @After
    fun stop() = server.stop()

    private fun get(path: String): Pair<Int, ByteArray> {
        val c = URL("http://127.0.0.1:${server.port}$path").openConnection() as HttpURLConnection
        val code = c.responseCode
        val body = (if (code < 400) c.inputStream else c.errorStream).use { it.readBytes() }
        return code to body
    }

    @Test
    fun pageListsThePhotosWithEscapedTitle() {
        val (code, body) = get(server.path)
        val html = String(body)
        assertEquals(200, code)
        assertTrue(html.contains("Maria &amp; &lt;Júlia&gt;"))
        assertTrue(html.contains("photo/2.jpg") && html.contains("photo/1.jpg"))
        assertTrue(html.contains("2 fotos"))
    }

    @Test
    fun withoutTheCodeNothingIsServed() {
        assertEquals(404, get("/").first)
        assertEquals(404, get("/outro/photo/1.jpg").first)
    }

    @Test
    fun servesPhotosAndThumbnails() {
        assertArrayEquals(photos[2], get("${server.path}photo/2.jpg").second)
        assertArrayEquals(byteArrayOf(9), get("${server.path}thumb/1.jpg").second)
        assertEquals(404, get("${server.path}photo/7.jpg").first)
    }

    @Test
    fun zipHasEveryPhotoAsJpeg() {
        val (code, body) = get("${server.path}fotos.zip")
        assertEquals(200, code)
        val names = ArrayList<String>()
        ZipInputStream(ByteArrayInputStream(body)).use { zip ->
            while (true) {
                val e = zip.nextEntry ?: break
                names += e.name
                val data = zip.readBytes()
                assertArrayEquals(if (e.name == "Maria_002.jpg") photos[2] else photos[1], data)
            }
        }
        assertEquals(listOf("Maria_002.jpg", "Maria_001.jpg"), names)
    }

    @Test
    fun pageShowsTheBrand() {
        val html = String(get(server.path).second)
        assertTrue(html.contains("logo.png"))
        assertTrue(html.contains("Fotos por <b>Phill Foto</b>"))
        assertTrue(html.contains("https://wa.me/5511987654321"))
        assertTrue(html.contains("https://instagram.com/phill.foto"))
        assertArrayEquals(byteArrayOf(5), get("${server.path}logo.png").second)
    }

    @Test
    fun slideshowOnlyServesApprovedPhotos() {
        val (code, body) = get("${server.path}tv")
        assertEquals(200, code)
        assertTrue(String(body).contains("slides.json"))
        assertEquals("{\"items\":[1]}", String(get("${server.path}slides.json").second))
        assertArrayEquals(byteArrayOf(7, 1), get("${server.path}screen/1.jpg").second)
        assertEquals(404, get("${server.path}screen/2.jpg").first)
    }
}
