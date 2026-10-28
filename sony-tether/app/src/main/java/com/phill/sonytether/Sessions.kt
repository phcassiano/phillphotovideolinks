package com.phill.sonytether

import android.content.Context
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.Normalizer
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Uma foto da sessão. Os campos mudam na thread da tela, menos [edited] e [editedWith] (no processador). */
class SessionPhoto(val number: Int, var name: String) {
    var original: Uri? = null

    @Volatile
    var edited: Uri? = null

    /** Preset, intensidade e marca d'água com que [edited] foi gerado. */
    @Volatile
    var editedWith: String? = null

    var rating = 0
    var favorite = false

    /** Escondida: some da tela, do compartilhamento e da galeria do cliente, mas os arquivos ficam. */
    var hidden = false

    /** Outros arquivos da mesma foto (o RAW, quando chega RAW+JPEG), para apagar junto. */
    val extras = ArrayList<Uri>()

    /** Apagada nesta execução: o que ainda estiver sendo feito com ela é descartado. */
    @Volatile
    var deleted = false

    /** Tamanho da foto inteira, já de pé (0 enquanto não se sabe). */
    var width = 0
    var height = 0

    val base get() = name.substringBeforeLast('.')
    val isRaw get() = PhotoStore.isRaw(name)
}

/** Onde e com que nome salvar uma foto que acabou de chegar da câmera. */
class ShotTarget(val session: ShootSession, val number: Int, val name: String)

/** Um ensaio: tem nome de cliente, pasta própria na galeria e numeração própria dos arquivos. */
class ShootSession(val id: String, val name: String, val folder: String, val created: Long) {
    /** Só na thread da tela. */
    val photos = ArrayList<SessionPhoto>()
    val prefix = SessionNames.prefix(name)

    private var next = 1

    /** Nome do arquivo na câmera → número: o RAW e o JPEG da mesma foto ficam com o mesmo número. */
    private val recent = LinkedHashMap<String, Int>()

    @Synchronized
    fun target(cameraName: String): ShotTarget {
        val base = cameraName.substringBeforeLast('.').lowercase()
        val number = recent[base] ?: next++.also {
            recent[base] = it
            if (recent.size > 8) recent.remove(recent.keys.first())
        }
        return ShotTarget(this, number, SessionNames.fileName(prefix, number, cameraName.substringAfterLast('.', "jpg")))
    }

    val label: String get() = "$name · ${SimpleDateFormat("dd/MM", Locale.US).format(Date(created))}"

    @Synchronized
    fun toJson(): JSONObject = JSONObject()
        .put("id", id).put("name", name).put("folder", folder).put("created", created).put("next", next)
        .put("photos", JSONArray().apply {
            for (p in photos) put(JSONObject()
                .put("n", p.number).put("name", p.name)
                .put("original", p.original?.toString()).put("edited", p.edited?.toString())
                .put("editedWith", p.editedWith).put("rating", p.rating).put("fav", p.favorite)
                .put("hidden", p.hidden).put("extras", JSONArray(p.extras.map { it.toString() }))
                .put("w", p.width).put("h", p.height))
        })

    companion object {
        fun fromJson(o: JSONObject): ShootSession {
            val s = ShootSession(o.getString("id"), o.getString("name"), o.getString("folder"), o.getLong("created"))
            s.next = o.optInt("next", 1)
            val list = o.optJSONArray("photos") ?: JSONArray()
            for (i in 0 until list.length()) {
                val p = list.getJSONObject(i)
                s.photos += SessionPhoto(p.getInt("n"), p.getString("name")).apply {
                    original = p.optString("original").takeIf { it.isNotEmpty() && it != "null" }?.let(Uri::parse)
                    edited = p.optString("edited").takeIf { it.isNotEmpty() && it != "null" }?.let(Uri::parse)
                    editedWith = p.optString("editedWith").takeIf { it.isNotEmpty() && it != "null" }
                    rating = p.optInt("rating")
                    favorite = p.optBoolean("fav")
                    hidden = p.optBoolean("hidden")
                    p.optJSONArray("extras")?.let { a -> for (k in 0 until a.length()) extras += Uri.parse(a.getString(k)) }
                    width = p.optInt("w")
                    height = p.optInt("h")
                }
            }
            s.next = maxOf(s.next, (s.photos.maxOfOrNull { it.number } ?: 0) + 1)
            return s
        }
    }
}

object SessionNames {
    const val DEFAULT_NAME = "Ensaio"

    /** "Maria Júlia" → "Maria_Julia": seguro em qualquer app e sistema para onde a foto for. */
    fun prefix(name: String): String {
        val ascii = Normalizer.normalize(name, Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "")
        return ascii.replace(Regex("[^A-Za-z0-9]+"), "_").trim('_').take(40).ifEmpty { "Foto" }
    }

    fun fileName(prefix: String, number: Int, extension: String) =
        "${prefix}_${number.toString().padStart(3, '0')}.${extension.lowercase()}"

    /** Pasta dentro de Imagens/SonyTether: "2026-10-25 Maria". */
    fun folder(name: String, created: Long): String {
        val clean = name.replace(Regex("[\\\\/:*?\"<>|]+"), " ").replace(Regex("\\s+"), " ").trim().take(60)
        val date = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(created))
        return if (clean.isEmpty()) date else "$date $clean"
    }
}

/** Sessões guardadas em arquivos JSON na pasta do app; lembra qual está aberta. */
class SessionStore(context: Context) {
    private val dir = File(context.filesDir, "sessions").apply { mkdirs() }
    private val prefs = context.getSharedPreferences("sony-tether", Context.MODE_PRIVATE)

    fun current(): ShootSession? = prefs.getString(KEY_CURRENT, null)?.let(::load)

    fun all(): List<ShootSession> =
        (dir.listFiles() ?: emptyArray()).filter { it.extension == "json" }.mapNotNull { load(it.nameWithoutExtension) }.sortedByDescending { it.created }

    fun create(name: String): ShootSession {
        val created = System.currentTimeMillis()
        val clean = name.trim().ifEmpty { SessionNames.DEFAULT_NAME }
        val base = SessionNames.folder(clean, created)
        val taken = all().map { it.folder }.toSet()
        var folder = base
        var n = 2
        while (folder in taken) folder = "$base (${n++})"
        return ShootSession(created.toString(), clean, folder, created).also {
            save(it)
            select(it)
        }
    }

    fun select(session: ShootSession) = prefs.edit().putString(KEY_CURRENT, session.id).apply()

    fun save(session: ShootSession) {
        val file = File(dir, "${session.id}.json")
        val tmp = File(dir, "${session.id}.tmp")
        tmp.writeText(session.toJson().toString())
        tmp.renameTo(file)
    }

    private fun load(id: String): ShootSession? = runCatching {
        ShootSession.fromJson(JSONObject(File(dir, "$id.json").readText()))
    }.getOrNull()

    private companion object {
        const val KEY_CURRENT = "session"
    }
}
