package com.phill.sonytether

import android.content.Context
import android.graphics.Bitmap
import android.graphics.RectF
import android.net.Uri

/**
 * Uma foto pronta para a tela: [original] sem preset, [display] como vai ser compartilhada.
 * [width] e [height] são da foto inteira.
 */
class Developed(val original: Bitmap, val display: Bitmap, val edited: Uri?, val thumb: Bitmap, val width: Int, val height: Int)

/**
 * Como a foto sai do app: girada e recortada ([shape]), com preset (e intensidade), ajustes do
 * editor e marca d'água, nessa ordem; a vinheta fica centrada na foto já recortada.
 */
class Look(
    val preset: PresetLook?,
    val stamp: Watermark.Stamp?,
    val signature: String,
    val manual: PresetLook? = null,
    val shape: PhotoEdit? = null,
) {
    /** Sem nada para aplicar, o JPEG da câmera é compartilhado como veio. */
    fun needsJpeg(name: String) = changesPhoto || PhotoStore.isRaw(name)

    val changesPhoto get() = preset != null || manual != null || stamp != null || shape != null

    /** Só a cor e a luz (preset e ajustes), sem a marca d'água. */
    fun tones(bitmap: Bitmap, frame: RectF? = null): Bitmap {
        val toned = preset?.apply(bitmap, frame) ?: bitmap
        return manual?.apply(toned, frame) ?: toned
    }

    fun apply(bitmap: Bitmap): Bitmap {
        val edited = tones(shape?.shape(bitmap) ?: bitmap)
        return stamp?.draw(edited) ?: edited
    }
}

/** Aplica preset e marca d'água numa foto e salva o JPEG que vai ser compartilhado. */
object Darkroom {
    /**
     * Lado maior do JPEG para compartilhar: sobra para Instagram, WhatsApp e impressão pequena.
     * A leitura reduz pela metade até caber, então 42 MP (7952 px) viram 3976 px.
     */
    const val EXPORT_PX = 4096
    const val DISPLAY_PX = 2048
    const val THUMB_PX = 240

    /**
     * Gera o JPEG para compartilhar ("<nome>.jpg" na pasta da sessão) quando há algo a aplicar
     * ou a foto é RAW. [replacing] é a versão anterior, apagada antes para o nome ficar livre.
     */
    fun develop(context: Context, folder: String, name: String, data: ByteArray, look: Look, replacing: Uri? = null): Developed? {
        val full = PhotoStore.decodePreview(data, EXPORT_PX) ?: return null
        val (width, height) = PhotoStore.sourceSize(data)
        val original = PhotoStore.scaled(full, DISPLAY_PX)
        if (!look.needsJpeg(name)) {
            full.recycle()
            return Developed(original, original, null, PhotoStore.scaled(original, THUMB_PX), width, height)
        }
        val edited = look.apply(full)
        if (edited !== full) full.recycle()
        replacing?.let { PhotoStore.delete(context, it) }
        val uri = PhotoStore.saveJpeg(context, folder, name.substringBeforeLast('.') + ".jpg", edited)
        val display = PhotoStore.scaled(edited, DISPLAY_PX)
        edited.recycle()
        return Developed(original, display, uri, PhotoStore.scaled(display, THUMB_PX), width, height)
    }

    /** Só a imagem da tela, com o visual atual, a partir do original salvo. */
    fun preview(context: Context, uri: Uri, look: Look): Developed? {
        val data = PhotoStore.readBytes(context, uri) ?: return null
        val original = PhotoStore.decodePreview(data, DISPLAY_PX) ?: return null
        val (width, height) = PhotoStore.sourceSize(data)
        val display = look.apply(PhotoStore.scaled(original, DISPLAY_PX))
        return Developed(original, display, null, PhotoStore.scaled(display, THUMB_PX), width, height)
    }

    /** Trecho da foto em resolução cheia para o zoom, com preset e ajustes (a marca d'água fica de fora). */
    fun detail(region: PhotoStore.Region, rect: RectF, minWidth: Int, look: Look): Bitmap? {
        val bitmap = region.read(rect, minWidth) ?: return null
        return look.tones(bitmap, rect)
    }
}
