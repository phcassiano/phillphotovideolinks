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
        return Result.Ok(LicenseKey(field(json, "i"), field(json, "n"), field(json, "p"), until, field(json, "d").ifEmpty { "*" }))
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

    private val trialStart: Long
        get() = prefs.getLong(KEY_TRIAL, -1).takeIf { it >= 0 }
            ?: today().toEpochDay().also { prefs.edit().putLong(KEY_TRIAL, it).apply() }

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

    /** Confere e guarda a chave. Devolve null se deu certo, ou o motivo. */
    fun activate(text: String): String? {
        val license = when (val r = verifier.read(text)) {
            is LicenseVerifier.Result.Invalid -> return r.reason
            is LicenseVerifier.Result.Ok -> r.license
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
        const val TRIAL_DAYS = 7

        const val SITE = "https://revela-beta-nine.vercel.app"
        const val SUBSCRIBE_URL = "$SITE/assinar"
        private const val REVOKED_URL = "$SITE/licencas/revogadas.json"

        /** Chave pública do Revela (a privada fica só no servidor). */
        const val PUBLIC_KEY =
            "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAExAAVC2V2A2RbHKx570qRqxpDdptG8v35YlKjrKpei4G6FTcOPAeJhf4GO6ItYYU+JXcRP556kBE2+cAzt6l6vg=="

        private const val KEY_LICENSE = "license.key"
        private const val KEY_TRIAL = "license.trialStart"
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
