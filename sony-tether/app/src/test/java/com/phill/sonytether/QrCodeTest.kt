package com.phill.sonytether

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class QrCodeTest {
    private val samples = listOf(
        "http://192.168.0.12:8080/k3m9xq2a/",
        "http://192.168.43.1:8080/ab12cd34/",
        "A",
        "x".repeat(120),
        "Sessão Maria · http://10.0.0.5:8081/zzzzzzzz/",
        "y".repeat(200),
    )

    @Test
    fun versionGrowsWithTheText() {
        assertEquals(1, QrCode.encode("A").version)
        assertTrue(QrCode.encode("y".repeat(200)).version >= 7)
    }

    /** Grava as matrizes em java.io.tmpdir/sony-tether-qr para conferir com um leitor de verdade (ex.: OpenCV). */
    @Test
    fun writesSamples() {
        val dir = File(System.getProperty("java.io.tmpdir"), "sony-tether-qr").apply { mkdirs() }
        samples.forEachIndexed { i, text ->
            val qr = QrCode.encode(text)
            val rows = (0 until qr.size).joinToString("\n") { y -> (0 until qr.size).joinToString("") { x -> if (qr.get(x, y)) "1" else "0" } }
            File(dir, "qr$i.txt").writeText(rows)
            File(dir, "qr$i.expected").writeText(text)
        }
    }
}
