package com.phill.sonytether

import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * O pouco da API do Google Drive que o app usa, sem as bibliotecas do Google: login pelo
 * "código de dispositivo" (o mesmo das TVs: o app mostra um código e você confirma em
 * google.com/device no celular), criar pasta, compartilhar por link e enviar fotos.
 *
 * Permissão pedida: drive.file, que só enxerga o que o próprio app criou.
 */
class DriveClient(
    private val clientId: String,
    private val clientSecret: String,
    private val tokens: Tokens,
    private val oauthBase: String = "https://oauth2.googleapis.com",
    private val apiBase: String = "https://www.googleapis.com",
) {
    interface Tokens {
        var refreshToken: String?
        var accessToken: String?

        /** Quando o [accessToken] vence (ms desde 1970). */
        var expiresAt: Long
    }

    class DeviceCode(val deviceCode: String, val userCode: String, val verificationUrl: String, val intervalMs: Long, val expiresAt: Long)

    class HttpException(val code: Int, val body: String) : IOException("HTTP $code: ${body.take(300)}")

    /** O login foi recusado ou o código venceu: precisa começar de novo. */
    class LoginFailed(message: String) : IOException(message)

    val connected get() = tokens.refreshToken != null

    fun startDeviceLogin(): DeviceCode {
        val o = JSONObject(form("$oauthBase/device/code", "client_id" to clientId, "scope" to SCOPE))
        return DeviceCode(
            o.getString("device_code"),
            o.getString("user_code"),
            o.optString("verification_url", o.optString("verification_uri", "https://www.google.com/device")),
            o.optLong("interval", 5) * 1000,
            System.currentTimeMillis() + o.optLong("expires_in", 1800) * 1000,
        )
    }

    /** true quando o login foi confirmado; false enquanto a pessoa ainda não confirmou. */
    fun pollDeviceLogin(code: DeviceCode): Boolean {
        if (System.currentTimeMillis() > code.expiresAt) throw LoginFailed("O código venceu. Comece de novo.")
        val body = try {
            form(
                "$oauthBase/token",
                "client_id" to clientId, "client_secret" to clientSecret,
                "device_code" to code.deviceCode, "grant_type" to "urn:ietf:params:oauth:grant-type:device_code",
            )
        } catch (e: HttpException) {
            val error = runCatching { JSONObject(e.body).optString("error") }.getOrDefault("")
            when (error) {
                "authorization_pending", "slow_down" -> return false
                "access_denied" -> throw LoginFailed("O acesso foi recusado na conta Google.")
                "expired_token" -> throw LoginFailed("O código venceu. Comece de novo.")
                else -> throw e
            }
        }
        saveToken(JSONObject(body))
        return true
    }

    fun signOut() {
        tokens.refreshToken = null
        tokens.accessToken = null
        tokens.expiresAt = 0
    }

    /** Cria uma pasta e devolve o id. */
    fun createFolder(name: String, parent: String?): String {
        val meta = JSONObject().put("name", name).put("mimeType", FOLDER_MIME)
        if (parent != null) meta.put("parents", listOf(parent).toJsonArray())
        return JSONObject(api("POST", "$apiBase/drive/v3/files?fields=id", meta.toString().toByteArray(), JSON)).getString("id")
    }

    /** Deixa a pasta aberta para quem tiver o link e devolve o link. */
    fun share(fileId: String): String {
        val permission = JSONObject().put("role", "reader").put("type", "anyone")
        api("POST", "$apiBase/drive/v3/files/$fileId/permissions", permission.toString().toByteArray(), JSON)
        return JSONObject(api("GET", "$apiBase/drive/v3/files/$fileId?fields=webViewLink", null, null)).getString("webViewLink")
    }

    /** true se a pasta (ou arquivo) ainda existe e não está na lixeira. */
    fun exists(fileId: String): Boolean = try {
        !JSONObject(api("GET", "$apiBase/drive/v3/files/$fileId?fields=id,trashed", null, null)).optBoolean("trashed")
    } catch (e: HttpException) {
        if (e.code == 404) false else throw e
    }

    /** Envia uma foto nova para a pasta e devolve o id do arquivo. */
    fun upload(name: String, folderId: String, jpeg: ByteArray): String {
        val boundary = "sonytether" + System.nanoTime()
        val meta = JSONObject().put("name", name).put("parents", listOf(folderId).toJsonArray()).toString()
        val head = "--$boundary\r\nContent-Type: $JSON\r\n\r\n$meta\r\n--$boundary\r\nContent-Type: image/jpeg\r\n\r\n"
        val body = head.toByteArray() + jpeg + "\r\n--$boundary--\r\n".toByteArray()
        val response = api("POST", "$apiBase/upload/drive/v3/files?uploadType=multipart&fields=id", body, "multipart/related; boundary=$boundary")
        return JSONObject(response).getString("id")
    }

    /** Troca o conteúdo de um arquivo já enviado (ex.: o preset mudou). */
    fun update(fileId: String, jpeg: ByteArray) {
        api("PATCH", "$apiBase/upload/drive/v3/files/$fileId?uploadType=media", jpeg, "image/jpeg")
    }

    /** Manda para a lixeira do Drive (dá para recuperar por lá). */
    fun trash(fileId: String) {
        try {
            api("PATCH", "$apiBase/drive/v3/files/$fileId", JSONObject().put("trashed", true).toString().toByteArray(), JSON)
        } catch (e: HttpException) {
            if (e.code != 404) throw e
        }
    }

    private fun accessToken(): String {
        val current = tokens.accessToken
        if (current != null && System.currentTimeMillis() < tokens.expiresAt - 60_000) return current
        val refresh = tokens.refreshToken ?: throw LoginFailed("Conecte o Google Drive primeiro.")
        val body = try {
            form("$oauthBase/token", "client_id" to clientId, "client_secret" to clientSecret, "refresh_token" to refresh, "grant_type" to "refresh_token")
        } catch (e: HttpException) {
            if (e.code == 400 || e.code == 401) {
                signOut()
                throw LoginFailed("O acesso ao Google Drive expirou ou foi removido. Conecte de novo.")
            }
            throw e
        }
        saveToken(JSONObject(body))
        return tokens.accessToken!!
    }

    private fun saveToken(o: JSONObject) {
        tokens.accessToken = o.getString("access_token")
        tokens.expiresAt = System.currentTimeMillis() + o.optLong("expires_in", 3600) * 1000
        o.optString("refresh_token").takeIf { it.isNotEmpty() }?.let { tokens.refreshToken = it }
    }

    /** Chamada autenticada; se o token tiver acabado de vencer, renova e tenta uma vez de novo. */
    private fun api(method: String, url: String, body: ByteArray?, type: String?): String = try {
        http(method, url, body, type, accessToken())
    } catch (e: HttpException) {
        if (e.code != 401) throw e
        tokens.accessToken = null
        http(method, url, body, type, accessToken())
    }

    private fun form(url: String, vararg fields: Pair<String, String>): String {
        val body = fields.joinToString("&") { (k, v) -> "$k=${URLEncoder.encode(v, "UTF-8")}" }
        return http("POST", url, body.toByteArray(), "application/x-www-form-urlencoded", null)
    }

    private fun http(method: String, url: String, body: ByteArray?, type: String?, token: String?): String {
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            // HttpURLConnection não faz PATCH; a API do Google aceita o método no cabeçalho.
            c.requestMethod = if (method == "PATCH") "POST" else method
            if (method == "PATCH") c.setRequestProperty("X-HTTP-Method-Override", "PATCH")
            c.connectTimeout = 20_000
            c.readTimeout = 60_000
            token?.let { c.setRequestProperty("Authorization", "Bearer $it") }
            if (body != null) {
                c.doOutput = true
                c.setRequestProperty("Content-Type", type)
                c.setFixedLengthStreamingMode(body.size)
                c.outputStream.use { it.write(body) }
            }
            val code = c.responseCode
            val text = (if (code < 400) c.inputStream else c.errorStream)?.use { String(it.readBytes()) } ?: ""
            if (code >= 400) throw HttpException(code, text)
            return text
        } finally {
            c.disconnect()
        }
    }

    private fun List<String>.toJsonArray() = org.json.JSONArray(this)

    companion object {
        const val SCOPE = "https://www.googleapis.com/auth/drive.file"
        private const val FOLDER_MIME = "application/vnd.google-apps.folder"
        private const val JSON = "application/json; charset=UTF-8"

        /**
         * Lê o client_id e o client_secret do JSON que o Google Cloud deixa baixar
         * ({"installed": {...}} ou direto os campos).
         */
        fun credentialsFromJson(text: String): Pair<String, String>? = runCatching {
            val root = JSONObject(text)
            val o = root.optJSONObject("installed") ?: root.optJSONObject("web") ?: root
            val id = o.getString("client_id")
            val secret = o.optString("client_secret")
            if (id.isBlank()) null else id to secret
        }.getOrNull()
    }
}
