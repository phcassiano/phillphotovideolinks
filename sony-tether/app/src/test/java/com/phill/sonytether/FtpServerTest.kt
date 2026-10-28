package com.phill.sonytether

import org.apache.commons.net.ftp.FTP
import org.apache.commons.net.ftp.FTPClient
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CopyOnWriteArrayList

/** O servidor FTP do app contra um cliente FTP de verdade (Apache Commons Net), como uma câmera faria. */
class FtpServerTest {
    private val received = CopyOnWriteArrayList<Pair<String, ByteArray>>()
    private val server = FtpServer("camera", "123456", object : FtpServer.Listener {
        override fun onFile(name: String, data: ByteArray, from: String) {
            received += name to data
        }

        override fun onLog(text: String) {}
    }, preferredPort = 0).apply { start() }

    @After
    fun stop() = server.stop()

    private fun client(passive: Boolean = true) = FTPClient().apply {
        connect("127.0.0.1", server.port)
        assertTrue(login("camera", "123456"))
        setFileType(FTP.BINARY_FILE_TYPE)
        if (passive) enterLocalPassiveMode() else enterLocalActiveMode()
    }

    private val jpeg = ByteArray(300_000) { (it * 31).toByte() }

    private fun waitFor(count: Int) {
        val end = System.currentTimeMillis() + 5000
        while (received.size < count && System.currentTimeMillis() < end) Thread.sleep(20)
    }

    @Test
    fun receivesAPhotoInPassiveMode() {
        val ftp = client()
        assertTrue(ftp.storeFile("DSC01234.JPG", jpeg.inputStream()))
        ftp.logout()
        waitFor(1)
        assertEquals("DSC01234.JPG", received.single().first)
        assertArrayEquals(jpeg, received.single().second)
    }

    @Test
    fun receivesInActiveModeToo() {
        val ftp = client(passive = false)
        assertTrue(ftp.storeFile("_DSC5678.NEF", jpeg.inputStream()))
        waitFor(1)
        assertEquals("_DSC5678.NEF", received.single().first)
    }

    @Test
    fun foldersCreatedByTheCameraWork() {
        val ftp = client()
        assertTrue(ftp.makeDirectory("DCIM"))
        assertTrue(ftp.changeWorkingDirectory("DCIM/100CANON"))
        assertEquals("/DCIM/100CANON", ftp.printWorkingDirectory())
        assertTrue(ftp.storeFile("IMG_0001.CR3", jpeg.inputStream()))
        assertTrue(ftp.storeFile("IMG_0001.JPG", byteArrayOf(1, 2).inputStream()))
        waitFor(2)
        assertEquals(listOf("IMG_0001.CR3", "IMG_0001.JPG"), received.map { it.first })
    }

    @Test
    fun temporaryNameThenRename() {
        val ftp = client()
        assertTrue(ftp.storeFile("DSC00001.JPG.tmp", jpeg.inputStream()))
        Thread.sleep(200)
        assertTrue("não entrega antes de renomear", received.isEmpty())
        assertTrue(ftp.rename("DSC00001.JPG.tmp", "DSC00001.JPG"))
        waitFor(1)
        assertEquals("DSC00001.JPG", received.single().first)
        assertArrayEquals(jpeg, received.single().second)
    }

    @Test
    fun wrongPasswordIsRefused() {
        val ftp = FTPClient()
        ftp.connect("127.0.0.1", server.port)
        assertFalse(ftp.login("camera", "errada"))
        assertFalse(ftp.storeFile("x.jpg", jpeg.inputStream()))
        assertTrue(received.isEmpty())
    }

    @Test
    fun otherFilesAreIgnoredAndListingIsEmpty() {
        val ftp = client()
        assertTrue(ftp.storeFile("video.MP4", byteArrayOf(1).inputStream()))
        assertEquals(0, ftp.listFiles().size)
        Thread.sleep(200)
        assertTrue(received.isEmpty())
    }
}
