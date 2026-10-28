package com.phill.sonytether

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.BufferedInputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket

/** O cliente do Drive contra um servidor falso que imita as respostas do Google. */
class DriveClientTest {
    private class Call(val method: String, val path: String, val headers: Map<String, String>, val body: ByteArray)

    private val calls = ArrayList<Call>()
    private var pendingPolls = 1
    private var expireNextApiCall = false
    private val socket = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))

    init {
        Thread {
            while (!socket.isClosed) {
                val client = runCatching { socket.accept() }.getOrNull() ?: break
                client.use { serve(it) }
            }
        }.apply { isDaemon = true }.start()
    }

    /** Servidor HTTP mínimo: lê a requisição inteira e responde de acordo com o caminho. */
    private fun serve(client: Socket) {
        val input = BufferedInputStream(client.getInputStream())
        fun line(): String {
            val b = StringBuilder()
            while (true) {
                val c = input.read()
                if (c < 0 || c == '\n'.code) return b.toString().trimEnd('\r')
                b.append(c.toChar())
            }
        }
        val (method, path) = line().split(' ').let { it[0] to it[1] }
        val headers = HashMap<String, String>()
        while (true) {
            val h = line()
            if (h.isEmpty()) break
            headers[h.substringBefore(':').trim().lowercase()] = h.substringAfter(':').trim()
        }
        val length = headers["content-length"]?.toInt() ?: 0
        val body = ByteArray(length)
        var read = 0
        while (read < length) read += input.read(body, read, length - read)
        calls += Call(method, path, headers, body)
        val form = String(body)
        val (code, response) = when {
            path == "/device/code" -> 200 to """{"device_code":"dev","user_code":"ABCD-EFGH","verification_url":"https://www.google.com/device","interval":5,"expires_in":1800}"""
            path == "/token" && form.contains("device_code") && pendingPolls-- > 0 -> 428 to """{"error":"authorization_pending"}"""
            path == "/token" && form.contains("device_code") -> 200 to """{"access_token":"A1","refresh_token":"R1","expires_in":3600}"""
            path == "/token" && form.contains("refresh_token=R1") -> 200 to """{"access_token":"A2","expires_in":3600}"""
            expireNextApiCall && headers["authorization"] == "Bearer A1" -> {
                expireNextApiCall = false
                401 to """{"error":{"code":401}}"""
            }
            path.startsWith("/drive/v3/files?fields=id") -> 200 to """{"id":"folder1"}"""
            path.startsWith("/drive/v3/files/folder1/permissions") -> 200 to """{"id":"anyone"}"""
            path.startsWith("/drive/v3/files/folder1?fields=webViewLink") -> 200 to """{"webViewLink":"https://drive.google.com/drive/folders/folder1"}"""
            path.startsWith("/upload/drive/v3/files?uploadType=multipart") -> 200 to """{"id":"photo1"}"""
            path.startsWith("/upload/drive/v3/files/photo1") -> 200 to """{"id":"photo1"}"""
            path.startsWith("/drive/v3/files/gone") -> 404 to """{"error":{"code":404}}"""
            else -> 500 to "?"
        }
        val bytes = response.toByteArray()
        val out = client.getOutputStream()
        out.write("HTTP/1.1 $code X\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
        out.write(bytes)
        out.flush()
    }

    private val base = "http://127.0.0.1:${socket.localPort}"

    private val tokens = object : DriveClient.Tokens {
        override var refreshToken: String? = null
        override var accessToken: String? = null
        override var expiresAt = 0L
    }
    private val drive = DriveClient("id.apps.googleusercontent.com", "segredo", tokens, base, base)

    @After
    fun stop() = socket.close()

    @Test
    fun deviceLoginWaitsForConfirmationThenKeepsTheTokens() {
        val code = drive.startDeviceLogin()
        assertEquals("ABCD-EFGH", code.userCode)
        assertTrue(String(calls[0].body).contains("drive.file"))
        assertFalse(drive.pollDeviceLogin(code))
        assertTrue(drive.pollDeviceLogin(code))
        assertEquals("R1", tokens.refreshToken)
        assertTrue(drive.connected)
    }

    @Test
    fun foldersAreSharedByLinkAndPhotosGoAsMultipart() {
        tokens.refreshToken = "R1"
        val folder = drive.createFolder("Ensaio Maria", null)
        assertEquals("folder1", folder)
        assertEquals("https://drive.google.com/drive/folders/folder1", drive.share(folder))
        assertTrue(String(calls.first { it.path.contains("permissions") }.body).contains("\"anyone\""))

        val id = drive.upload("Maria_001.jpg", folder, byteArrayOf(1, 2, 3))
        assertEquals("photo1", id)
        val upload = calls.first { it.path.contains("uploadType=multipart") }
        assertTrue(upload.headers["content-type"]!!.startsWith("multipart/related; boundary="))
        val text = String(upload.body, Charsets.ISO_8859_1)
        assertTrue(text.contains("\"name\":\"Maria_001.jpg\"") && text.contains("\"parents\":[\"folder1\"]"))
        assertTrue(text.contains("image/jpeg\r\n\r\n\u0001\u0002\u0003\r\n"))
        assertEquals("Bearer A2", upload.headers["authorization"])
    }

    @Test
    fun updateUsesPatchThroughTheOverrideHeader() {
        tokens.refreshToken = "R1"
        drive.update("photo1", byteArrayOf(9))
        val call = calls.last()
        assertEquals("POST", call.method)
        assertEquals("PATCH", call.headers["x-http-method-override"])
    }

    @Test
    fun expiredAccessTokenIsRenewedOnce() {
        tokens.refreshToken = "R1"
        tokens.accessToken = "A1"
        tokens.expiresAt = System.currentTimeMillis() + 3_600_000
        expireNextApiCall = true
        assertEquals("folder1", drive.createFolder("x", null))
        assertEquals("A2", tokens.accessToken)
    }

    @Test
    fun missingFilesAreHandled() {
        tokens.refreshToken = "R1"
        assertFalse(drive.exists("gone"))
        drive.trash("gone") // não lança
    }

    @Test
    fun readsTheCredentialsFileFromGoogleCloud() {
        val json = """{"installed":{"client_id":"123.apps.googleusercontent.com","client_secret":"GOCSPX-x","auth_uri":"..."}}"""
        assertEquals("123.apps.googleusercontent.com" to "GOCSPX-x", DriveClient.credentialsFromJson(json))
        assertEquals(null, DriveClient.credentialsFromJson("não é json"))
    }
}
