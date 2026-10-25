package com.phill.sonytether

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapRegionDecoder
import android.graphics.Matrix
import android.graphics.Rect
import android.graphics.RectF
import android.media.ExifInterface
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import android.util.Size
import java.io.ByteArrayInputStream
import java.io.OutputStream
import kotlin.math.max
import kotlin.math.min

/**
 * Galeria: cada sessão tem a pasta Imagens/SonyTether/<sessão>, com o arquivo que veio da câmera
 * em Originais e a versão para compartilhar (preset, marca d'água) na própria pasta.
 * Também gera as prévias para a tela.
 */
object PhotoStore {
    const val FOLDER = "SonyTether"

    fun saveOriginal(context: Context, folder: String, name: String, data: ByteArray): Uri? =
        save(context, name, mimeType(name), "$FOLDER/$folder/Originais") { it.write(data) }

    fun saveJpeg(context: Context, folder: String, name: String, bitmap: Bitmap): Uri? =
        save(context, name, "image/jpeg", "$FOLDER/$folder") { bitmap.compress(Bitmap.CompressFormat.JPEG, 93, it) }

    /** Miniatura pelo sistema (rápida, sem ler o arquivo inteiro); se não der, decodifica a foto. */
    fun thumbnail(context: Context, uri: Uri, maxPx: Int): Bitmap? =
        runCatching { context.contentResolver.loadThumbnail(uri, Size(maxPx, maxPx), null) }.getOrNull()
            ?: readBytes(context, uri)?.let { decodePreview(it, maxPx) }

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
        // Reduz já na leitura até caber em maxPx: uma foto de 42 MP inteira não cabe na memória do app.
        var sample = 1
        while (max(bounds.outWidth, bounds.outHeight) / sample > maxPx) sample *= 2
        val options = BitmapFactory.Options().apply {
            inSampleSize = sample
            inMutable = true
        }
        val bitmap = BitmapFactory.decodeByteArray(data, offset, length, options) ?: return null
        return rotate(bitmap, orientation(data))
    }

    /** Tamanho da foto inteira, já de pé. */
    fun sourceSize(data: ByteArray): Pair<Int, Int> {
        val (offset, length) = previewRegion(data) ?: return 0 to 0
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(data, offset, length, bounds)
        val turned = degrees(orientation(data)) % 180 != 0
        return if (turned) bounds.outHeight to bounds.outWidth else bounds.outWidth to bounds.outHeight
    }

    /** Leitor de trechos da foto em resolução cheia, para o zoom de conferir foco. */
    class Region(private val decoder: BitmapRegionDecoder, private val degrees: Int) {
        /** Tamanho da foto já de pé. */
        val width = if (degrees % 180 != 0) decoder.height else decoder.width
        val height = if (degrees % 180 != 0) decoder.width else decoder.height

        /**
         * Lê o trecho [rect] (0..1, na foto de pé) com pelo menos [minWidth] pixels de largura,
         * pulando pixels quando a foto tem bem mais que isso.
         */
        fun read(rect: RectF, minWidth: Int): Bitmap? {
            val (x0, y0) = toSource(rect.left, rect.top)
            val (x1, y1) = toSource(rect.right, rect.bottom)
            val area = Rect(
                (min(x0, x1) * decoder.width).toInt().coerceIn(0, decoder.width - 1),
                (min(y0, y1) * decoder.height).toInt().coerceIn(0, decoder.height - 1),
                (max(x0, x1) * decoder.width).toInt().coerceIn(1, decoder.width),
                (max(y0, y1) * decoder.height).toInt().coerceIn(1, decoder.height),
            )
            if (area.width() <= 0 || area.height() <= 0) return null
            val uprightWidth = if (degrees % 180 != 0) area.height() else area.width()
            var sample = 1
            while (uprightWidth / (sample * 2) >= minWidth) sample *= 2
            val options = BitmapFactory.Options().apply { inSampleSize = sample }
            val bitmap = synchronized(decoder) { decoder.decodeRegion(area, options) } ?: return null
            if (degrees == 0) return bitmap
            val m = Matrix().apply { postRotate(degrees.toFloat()) }
            return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, m, true).also {
                if (it !== bitmap) bitmap.recycle()
            }
        }

        /** Ponto da foto de pé → ponto do arquivo, que fica como o sensor gravou. */
        private fun toSource(u: Float, v: Float): Pair<Float, Float> = when (degrees) {
            90 -> v to 1 - u
            180 -> 1 - u to 1 - v
            270 -> 1 - v to u
            else -> u to v
        }

        fun close() = decoder.recycle()
    }

    fun region(data: ByteArray): Region? {
        val (offset, length) = previewRegion(data) ?: return null
        @Suppress("DEPRECATION")
        val decoder = runCatching { BitmapRegionDecoder.newInstance(data, offset, length, false) }.getOrNull() ?: return null
        return Region(decoder, degrees(orientation(data)))
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

    private fun degrees(orientation: Int) = when (orientation) {
        ExifInterface.ORIENTATION_ROTATE_90 -> 90
        ExifInterface.ORIENTATION_ROTATE_180 -> 180
        ExifInterface.ORIENTATION_ROTATE_270 -> 270
        else -> 0
    }

    private fun rotate(bitmap: Bitmap, orientation: Int): Bitmap {
        val degrees = degrees(orientation)
        if (degrees == 0) return bitmap
        val m = Matrix().apply { postRotate(degrees.toFloat()) }
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
