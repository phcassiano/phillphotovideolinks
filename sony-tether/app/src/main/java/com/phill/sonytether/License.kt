package com.phill.sonytether

import android.annotation.SuppressLint
import android.content.Context
import android.provider.Settings
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.PublicKey
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.time.LocalDate
import java.util.Base64

/** Conteúdo de uma chave de ativação. */
class LicenseKey(
    val id: String,
    val name: String,
    /** "mensal", "anual", "vitalicia"… só para mostrar. */
    val plan: String,
    val until: LocalDate,
    /** Código do aparelho ("*" = qualquer aparelho). */
    val device: String,
    /** Chave vendida pela Kiwify: precisa ser ativada pela internet, que a liga ao 1º tablet. */
    val online: Boolean = false,
)

/**
 * Lê e confere chaves de ativação: "REVELA-<dados>.<assinatura>", os dois em Base64 (URL).
 * Os dados são JSON; a assinatura é ECDSA P-256 com SHA-256, feita pelo servidor do Revela
 * com a chave privada. O app só tem a chave pública: dá para conferir, não para fabricar.
 */
class LicenseVerifier(publicKeyBase64: String) {
    private val key: PublicKey = KeyFactory.getInstance("EC").generatePublic(X509EncodedKeySpec(Base64.getDecoder().decode(publicKeyBase64)))

    sealed class Result {
        class Ok(val license: LicenseKey) : Result()
        class Invalid(val reason: String) : Result()
    }

    fun read(text: String): Result {
        val compact = text.filterNot { it.isWhitespace() }
        val body = compact.removePrefix(PREFIX)
        if (body == compact || !body.contains('.')) return Result.Invalid("Isso não parece uma chave do Revela (ela começa com $PREFIX).")
        val (data, signature) = body.split('.', limit = 2).let { it[0] to it[1] }
        val payload = runCatching { Base64.getUrlDecoder().decode(data) }.getOrNull()
        val sig = runCatching { Base64.getUrlDecoder().decode(signature) }.getOrNull()
        if (payload == null || sig == null) return Result.Invalid("A chave está incompleta. Copie de novo, inteira.")
        val genuine = runCatching {
            Signature.getInstance("SHA256withECDSA").run {
                initVerify(key)
                update(payload)
                verify(sig)
            }
        }.getOrDefault(false)
        if (!genuine) return Result.Invalid("Chave inválida. Confira se copiou inteira, sem cortar o fim.")
        val json = String(payload, Charsets.UTF_8)
        val until = runCatching { LocalDate.parse(field(json, "a")) }.getOrNull()
            ?: return Result.Invalid("Chave com data inválida.")
        return Result.Ok(LicenseKey(field(json, "i"), field(json, "n"), field(json, "p"), until, field(json, "d").ifEmpty { "*" }, field(json, "o") == "1"))
    }

    companion object {
        const val PREFIX = "REVELA-"

        /** Valor de texto de um campo do JSON da chave (os campos são simples, sem aninhamento). */
        fun field(json: String, name: String): String {
            val m = Regex("\"" + name + "\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"").find(json) ?: return ""
            return m.groupValues[1].replace("\\\"", "\"").replace("\\\\", "\\")
        }
    }
}

/**
 * Situação da assinatura neste aparelho: teste grátis, chave ativa ou vencida. Guarda a chave
 * e se protege de relógio atrasado (usa sempre o dia mais recente que já viu).
 */
class LicenseManager(private val context: Context, private val verifier: LicenseVerifier = LicenseVerifier(PUBLIC_KEY)) {
    private val prefs = context.getSharedPreferences("sony-tether", Context.MODE_PRIVATE)

    sealed class State {
        abstract val active: Boolean

        class Licensed(val license: LicenseKey, val daysLeft: Long) : State() {
            override val active = true
        }

        class Trial(val daysLeft: Long) : State() {
            override val active = true
        }

        class Expired(val license: LicenseKey?) : State() {
            override val active = false
        }

        class Revoked(val license: LicenseKey) : State() {
            override val active = false
        }
    }

    /** Código curto deste aparelho, para a chave valer só nele. */
    val deviceCode: String by lazy { code(androidId()) }

    @SuppressLint("HardwareIds")
    private fun androidId() = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: "sem-id"

    /** Hoje, sem voltar no tempo se alguém atrasar o relógio. */
    private fun today(): LocalDate {
        val now = LocalDate.now().toEpochDay()
        val seen = prefs.getLong(KEY_MAX_DAY, 0)
        if (now > seen) prefs.edit().putLong(KEY_MAX_DAY, now).apply()
        return LocalDate.ofEpochDay(maxOf(now, seen))
    }

    /**
     * Primeiro dia do teste: o mais antigo entre o que este app anotou e o que o servidor
     * registrou para este tablet (reinstalar não começa um teste novo).
     */
    private val trialStart: Long
        get() {
            val local = prefs.getLong(KEY_TRIAL, -1).takeIf { it >= 0 }
                ?: today().toEpochDay().also { prefs.edit().putLong(KEY_TRIAL, it).apply() }
            val server = prefs.getLong(KEY_TRIAL_SERVER, -1)
            return if (server >= 0) minOf(local, server) else local
        }

    fun state(): State {
        val today = today()
        val stored = prefs.getString(KEY_LICENSE, null)?.let { verifier.read(it) as? LicenseVerifier.Result.Ok }?.license
        if (stored != null) {
            if (stored.id in revoked()) return State.Revoked(stored)
            val left = stored.until.toEpochDay() - today.toEpochDay()
            if (left >= 0) return State.Licensed(stored, left)
        }
        val trialLeft = trialStart + TRIAL_DAYS - 1 - today.toEpochDay()
        if (stored == null && trialLeft >= 0) return State.Trial(trialLeft)
        return State.Expired(stored)
    }

    /**
     * Confere e guarda a chave. Devolve null se deu certo, ou o motivo. Chaves da Kiwify vão ao
     * servidor, que as liga a este tablet: precisa de internet e roda fora da thread da tela.
     */
    fun activate(input: String): String? {
        var text = input.filterNot { it.isWhitespace() }
        var license = when (val r = verifier.read(text)) {
            is LicenseVerifier.Result.Invalid -> return r.reason
            is LicenseVerifier.Result.Ok -> r.license
        }
        if (license.online) {
            val reply = try {
                post(ACTIVATE_URL, "{\"chave\":\"${text}\",\"aparelho\":\"$deviceCode\"}")
            } catch (e: Exception) {
                return "Sem internet. Na primeira vez a chave precisa de internet para ser ativada neste tablet."
            }
            if (reply.first != 200) {
                if (reply.second.contains("\"revogada\":true")) markRevoked(license.id)
                return LicenseVerifier.field(reply.second, "erro").ifEmpty { "O servidor recusou a chave (${reply.first})." }
            }
            text = LicenseVerifier.field(reply.second, "chave")
            license = (verifier.read(text) as? LicenseVerifier.Result.Ok)?.license ?: return "Resposta inválida do servidor. Tente de novo."
        }
        if (license.device != "*" && !license.device.equals(deviceCode, ignoreCase = true)) {
            return "Essa chave é de outro aparelho (${license.device}). O código deste tablet é $deviceCode."
        }
        if (license.id in revoked()) return "Essa chave foi cancelada."
        if (license.until < today()) return "Essa chave venceu em ${format(license.until)}. Peça a renovação."
        prefs.edit().putString(KEY_LICENSE, text.filterNot { it.isWhitespace() }).apply()
        return null
    }

    fun remove() = prefs.edit().remove(KEY_LICENSE).apply()

    private fun markRevoked(id: String) {
        prefs.edit().putStringSet(KEY_REVOKED, revoked() + id).apply()
    }

    /**
     * Fala com o servidor quando há internet (fora da thread da tela): registra o teste grátis
     * deste tablet, atualiza a validade da chave (renovações da Kiwify) e a lista de canceladas.
     */
    fun sync() {
        runCatching {
            val (code, body) = post(TRIAL_URL, "{\"aparelho\":\"$deviceCode\"}")
            if (code == 200) {
                val start = LocalDate.parse(LicenseVerifier.field(body, "inicio")).toEpochDay()
                prefs.edit().putLong(KEY_TRIAL_SERVER, start).apply()
            }
        }
        val stored = prefs.getString(KEY_LICENSE, null)
        val current = stored?.let { verifier.read(it) as? LicenseVerifier.Result.Ok }?.license
        if (stored != null && current != null) runCatching {
            val (code, body) = post(ACTIVATE_URL, "{\"chave\":\"$stored\",\"aparelho\":\"$deviceCode\"}")
            if (code == 200) {
                val fresh = LicenseVerifier.field(body, "chave")
                val renewed = (verifier.read(fresh) as? LicenseVerifier.Result.Ok)?.license
                if (renewed != null && renewed.id == current.id && renewed.until >= current.until) {
                    prefs.edit().putString(KEY_LICENSE, fresh).apply()
                }
            } else if (code == 403 && body.contains("\"revogada\":true")) {
                markRevoked(current.id)
            }
        }
        refreshRevoked()
    }

    /** POST com JSON; devolve o código HTTP e o corpo. */
    private fun post(url: String, json: String): Pair<Int, String> {
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.connectTimeout = 10_000
            c.readTimeout = 15_000
            c.requestMethod = "POST"
            c.doOutput = true
            c.setRequestProperty("Content-Type", "application/json")
            c.outputStream.use { it.write(json.toByteArray()) }
            val code = c.responseCode
            val body = (if (code < 400) c.inputStream else c.errorStream)?.use { String(it.readBytes()) } ?: ""
            return code to body
        } finally {
            c.disconnect()
        }
    }

    private fun revoked(): Set<String> = prefs.getStringSet(KEY_REVOKED, emptySet()) ?: emptySet()

    /**
     * Baixa a lista de chaves canceladas (reembolso, uso indevido), no máximo uma vez por dia.
     * Sem internet, fica com a última lista. Roda fora da thread da tela.
     */
    fun refreshRevoked(force: Boolean = false) {
        val last = prefs.getLong(KEY_REVOKED_AT, 0)
        if (!force && System.currentTimeMillis() - last < 24 * 3600_000L) return
        runCatching {
            val c = URL(REVOKED_URL).openConnection() as HttpURLConnection
            c.connectTimeout = 8000
            c.readTimeout = 8000
            val text = c.inputStream.use { String(it.readBytes()) }
            val ids = Regex("\"([A-Za-z0-9_-]{4,64})\"").findAll(text.substringAfter("[", "")).map { it.groupValues[1] }.toSet()
            prefs.edit().putStringSet(KEY_REVOKED, ids).putLong(KEY_REVOKED_AT, System.currentTimeMillis()).apply()
        }
    }

    companion object {
        /** Dias de teste grátis na primeira instalação. 0 = sem teste. */
        const val TRIAL_DAYS = 3

        const val SITE = "https://revela-beta-nine.vercel.app"
        const val SUBSCRIBE_URL = "$SITE/assinar"
        private const val REVOKED_URL = "$SITE/api/revogadas"
        private const val TRIAL_URL = "$SITE/api/trial"
        private const val ACTIVATE_URL = "$SITE/api/ativar"

        /** Chave pública do Revela (a privada fica só no servidor). */
        const val PUBLIC_KEY =
            "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAExAAVC2V2A2RbHKx570qRqxpDdptG8v35YlKjrKpei4G6FTcOPAeJhf4GO6ItYYU+JXcRP556kBE2+cAzt6l6vg=="

        private const val KEY_LICENSE = "license.key"
        private const val KEY_TRIAL = "license.trialStart"
        private const val KEY_TRIAL_SERVER = "license.trialServer"
        private const val KEY_MAX_DAY = "license.maxDay"
        private const val KEY_REVOKED = "license.revoked"
        private const val KEY_REVOKED_AT = "license.revokedAt"

        /** 8 letras/números a partir do identificador do aparelho (sem expor o identificador). */
        fun code(androidId: String): String {
            val hash = MessageDigest.getInstance("SHA-256").digest("revela:$androidId".toByteArray())
            val alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
            return (0 until 8).joinToString("") { alphabet[(hash[it].toInt() and 0xFF) % alphabet.length].toString() }
        }

        fun format(date: LocalDate) = "%02d/%02d/%d".format(date.dayOfMonth, date.monthValue, date.year)
    }
}
