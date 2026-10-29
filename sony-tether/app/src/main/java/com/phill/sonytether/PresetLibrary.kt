package com.phill.sonytether

import android.content.Context
import java.io.ByteArrayInputStream
import java.io.File
import java.util.zip.ZipInputStream

/** Presets importados (guardados como vieram, na pasta do app) e o preset/intensidade escolhidos. */
class PresetLibrary(context: Context) {

    class Entry(val file: String, val preset: Preset)

    private val dir = File(context.filesDir, "presets").apply { mkdirs() }
    private val prefs = context.getSharedPreferences("sony-tether", Context.MODE_PRIVATE)
    private var counter = 0

    fun all(): List<Entry> = (dir.listFiles() ?: emptyArray())
        .sortedBy { it.name }
        .mapNotNull { f -> Preset.parse(f.name.substringAfter('_').substringAfter('_'), f.readBytes())?.let { Entry(f.name, it) } }

    var activeFile: String?
        get() = prefs.getString(KEY_ACTIVE, null)?.takeIf { File(dir, it).exists() }
        set(value) = prefs.edit().putString(KEY_ACTIVE, value).apply()

    /** Intensidade do preset, de 0 a 100. */
    var amount: Int
        get() = prefs.getInt(KEY_AMOUNT, 100)
        set(value) = prefs.edit().putInt(KEY_AMOUNT, value).apply()

    fun active(): Entry? = activeFile?.let { name ->
        Preset.parse(name.substringAfter('_').substringAfter('_'), File(dir, name).readBytes())?.let { Entry(name, it) }
    }

    /** Importa um arquivo de preset; um .zip pode trazer vários. Devolve os que foram reconhecidos. */
    fun import(fileName: String, bytes: ByteArray): List<Entry> {
        if (bytes.size > 4 && bytes[0] == 'P'.code.toByte() && bytes[1] == 'K'.code.toByte()) {
            val found = ArrayList<Entry>()
            ZipInputStream(ByteArrayInputStream(bytes)).use { zip ->
                while (true) {
                    val entry = zip.nextEntry ?: break
                    val name = entry.name.substringAfterLast('/')
                    val ext = name.substringAfterLast('.', "").lowercase()
                    if (!entry.isDirectory && !entry.name.contains("__MACOSX") && ext in EXTENSIONS) {
                        importOne(name, zip.readBytes())?.let(found::add)
                    }
                }
            }
            return found
        }
        return listOfNotNull(importOne(fileName, bytes))
    }

    fun remove(file: String) {
        File(dir, file).delete()
        if (activeFile == file) activeFile = null
    }

    private fun importOne(fileName: String, bytes: ByteArray): Entry? {
        val preset = Preset.parse(fileName, bytes) ?: return null
        val safe = fileName.replace(Regex("[^A-Za-z0-9._-]"), "_").takeLast(60)
        val name = "${System.currentTimeMillis()}_${counter++}_$safe"
        File(dir, name).writeBytes(bytes)
        return Entry(name, preset)
    }

    private companion object {
        const val KEY_ACTIVE = "preset"
        const val KEY_AMOUNT = "amount"
        val EXTENSIONS = setOf("xmp", "lrtemplate", "dng")
    }
}
