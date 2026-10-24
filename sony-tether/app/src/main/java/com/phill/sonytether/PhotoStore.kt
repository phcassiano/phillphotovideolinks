package com.phill.sonytether

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import java.io.ByteArrayInputStream
import java.io.OutputStream
import kotlin.math.max

/**
 * Galeria: o arquivo que veio da câmera vai para Imagens/SonyTether/Originais e a versão
 * com preset para Imagens/SonyTether. Também gera as prévias para a tela.
 */
object PhotoStore {
    private const val FOLDER = "SonyTether"

    fun saveOriginal(context: Context, name: String, data: ByteArray): Uri? =
        save(context, name, mimeType(name), "$FOLDER/Originais") { it.write(data) }

    fun saveJpeg(context: Context, name: String, bitmap: Bitmap): Uri? =
        save(context, name, "image/jpeg", FOLDER) { bitmap.compress(Bitmap.CompressFormat.JPEG, 93, it) }

    fun delete(context: Context, uri: Uri) {
        runCatching { context.contentResolver.delete(uri, null, null) }
    }

    fun readBytes(context: Context, uri: Uri): ByteArray? =
        runCatching { context.contentResolver.openInputStream(uri)!!.use { it.readBytes() } }.getOrNull()

    private fun save(context: Context, name: String, mime: String, folder: String, write: (OutputStream) -> Unit): Uri? {
        val resolver = context.contentResolver
        // RAW (.ARW) nem sempre é aceito como imagem; nesse caso vai para Downloads.
        val targets = buildList {
            if (mime.startsWith("image/")) {
                add(MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY) to "${Environment.DIRECTORY_PICTURES}/$folder")
            }
            add(MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY) to "${Environment.DIRECTORY_DOWNLOADS}/$folder")
        }
        for ((collection, path) in targets) {
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, name)
                put(MediaStore.MediaColumns.MIME_TYPE, mime)
                put(MediaStore.MediaColumns.RELATIVE_PATH, path)
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
            val uri = try {
                resolver.insert(collection, values)
            } catch (e: Exception) {
                null
            } ?: continue
            try {
                resolver.openOutputStream(uri)!!.use(write)
                resolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
                return uri
            } catch (e: Exception) {
                runCatching { resolver.delete(uri, null, null) }
            }
        }
        return null
    }

    /** JPEG e HEIF são lidos direto; do RAW usa a prévia JPEG que vem dentro do arquivo. */
    fun decodePreview(data: ByteArray, maxPx: Int): Bitmap? {
        val (offset, length) = previewRegion(data) ?: return null
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(data, offset, length, bounds)
        if (bounds.outWidth <= 0) return null
        var sample = 1
        while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxPx) sample *= 2
        val options = BitmapFactory.Options().apply {
            inSampleSize = sample
            inMutable = true
        }
        val bitmap = BitmapFactory.decodeByteArray(data, offset, length, options) ?: return null
        return rotate(bitmap, orientation(data))
    }

    /** Cópia reduzida (sempre um bitmap novo, nunca o próprio [bitmap]). */
    fun scaled(bitmap: Bitmap, maxPx: Int): Bitmap {
        val longest = max(bitmap.width, bitmap.height)
        if (longest <= maxPx) return bitmap.copy(Bitmap.Config.ARGB_8888, true)
        val w = max(1, bitmap.width * maxPx / longest)
        val h = max(1, bitmap.height * maxPx / longest)
        return Bitmap.createScaledBitmap(bitmap, w, h, true)
    }

    private fun previewRegion(data: ByteArray): Pair<Int, Int>? {
        if (width(data, 0, data.size) > 0) return 0 to data.size
        var best: Pair<Int, Int>? = null
        var bestWidth = 0
        var candidates = 0
        var i = 0
        val end = data.size - 3
        while (i < end && candidates < 500) {
            if (data[i] == FF && data[i + 1] == SOI && data[i + 2] == FF) {
                candidates++
                val w = width(data, i, data.size - i)
                if (w > bestWidth) {
                    bestWidth = w
                    best = i to data.size - i
                }
            }
            i++
        }
        return best
    }

    private fun width(data: ByteArray, offset: Int, length: Int): Int {
        val o = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(data, offset, length, o)
        return o.outWidth
    }

    private fun orientation(data: ByteArray): Int = runCatching {
        ExifInterface(ByteArrayInputStream(data)).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
    }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)

    private fun rotate(bitmap: Bitmap, orientation: Int): Bitmap {
        val degrees = when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> return bitmap
        }
        val m = Matrix().apply { postRotate(degrees) }
        val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, m, true)
        bitmap.recycle()
        return rotated
    }

    fun isRaw(name: String) = name.substringAfterLast('.', "").lowercase() in setOf("arw", "srf", "sr2")

    private fun mimeType(name: String): String = when (name.substringAfterLast('.', "").lowercase()) {
        "jpg", "jpeg" -> "image/jpeg"
        "arw", "srf", "sr2" -> "image/x-sony-arw"
        "hif", "heif", "heic" -> "image/heif"
        else -> "application/octet-stream"
    }

    private const val FF = 0xFF.toByte()
    private const val SOI = 0xD8.toByte()
}
