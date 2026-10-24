package com.phill.sonytether

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri

/** Uma foto pronta para a tela: [original] sem preset, [display] como vai ser compartilhada. */
class Developed(val original: Bitmap, val display: Bitmap, val edited: Uri?, val thumb: Bitmap)

/** Aplica o preset numa foto e salva o JPEG que vai ser compartilhado. */
object Darkroom {
    /**
     * Lado maior do JPEG com preset: sobra para Instagram, WhatsApp e impressão pequena.
     * A leitura reduz pela metade até caber, então 42 MP (7952 px) viram 3976 px.
     */
    const val EXPORT_PX = 4096
    const val DISPLAY_PX = 2048
    private const val THUMB_PX = 240

    /**
     * Com preset, salva "<nome>_preset.jpg". Sem preset, só gera um JPEG se a foto for RAW
     * (para ter algo que dê para compartilhar); JPEG da câmera é compartilhado como veio.
     */
    fun develop(context: Context, name: String, data: ByteArray, look: PresetLook?): Developed? {
        val full = PhotoStore.decodePreview(data, EXPORT_PX) ?: return null
        val original = PhotoStore.scaled(full, DISPLAY_PX)
        if (look == null && !PhotoStore.isRaw(name)) {
            full.recycle()
            return Developed(original, original, null, PhotoStore.scaled(original, THUMB_PX))
        }
        val edited = look?.apply(full) ?: full
        val suffix = if (look != null) "_preset" else ""
        val uri = PhotoStore.saveJpeg(context, name.substringBeforeLast('.') + "$suffix.jpg", edited)
        val display = PhotoStore.scaled(edited, DISPLAY_PX)
        edited.recycle()
        return Developed(original, display, uri, PhotoStore.scaled(display, THUMB_PX))
    }

    /** Só a imagem da tela, com o preset atual, a partir do original salvo. */
    fun preview(context: Context, uri: Uri, look: PresetLook?): Pair<Bitmap, Bitmap>? {
        val data = PhotoStore.readBytes(context, uri) ?: return null
        val original = PhotoStore.decodePreview(data, DISPLAY_PX) ?: return null
        val display = look?.apply(PhotoStore.scaled(original, DISPLAY_PX)) ?: original
        return original to display
    }
}
