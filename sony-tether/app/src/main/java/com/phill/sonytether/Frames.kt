package com.phill.sonytether

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import kotlin.math.min

/**
 * Molduras de recorte desenhadas por cima da foto, para enquadrar já pensando no destino:
 * feed e story do Instagram, capa de revista, lâmina de álbum. Só guiam o olhar; a foto salva
 * não é cortada.
 */
object Frames {
    class Frame(val name: String, val ratio: Float, val kind: Int)

    private const val NONE = 0
    private const val THIRDS = 1
    private const val FEED = 2
    private const val STORY = 3
    private const val MAGAZINE = 4
    private const val ALBUM = 5

    val ALL = listOf(
        Frame("Nenhuma", 0f, NONE),
        Frame("Regra dos terços", 0f, THIRDS),
        Frame("Instagram 4:5", 4f / 5f, FEED),
        Frame("Quadrado 1:1", 1f, FEED),
        Frame("Story / Reels 9:16", 9f / 16f, STORY),
        Frame("Capa de revista (A4)", 210f / 297f, MAGAZINE),
        Frame("Álbum, lâmina 2:1", 2f, ALBUM),
    )

    val NAMES get() = ALL.map { it.name }.toTypedArray()

    /** Maior retângulo na proporção [ratio] (largura/altura) que cabe em [image], centrado. */
    fun crop(image: RectF, ratio: Float): RectF {
        if (ratio <= 0f) return RectF(image)
        val w = min(image.width(), image.height() * ratio)
        val h = w / ratio
        val cx = image.centerX()
        val cy = image.centerY()
        return RectF(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
    }

    private val shade = Paint().apply { color = 0xA6000000.toInt() }
    private val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        color = 0xE6FFFFFF.toInt()
    }
    private val guide = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        color = 0x66FFFFFF
    }
    private val dashed = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        color = 0x99E9B45A.toInt()
    }
    private val band = Paint().apply { color = 0x1FFFFFFF }
    private val masthead = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0x8CFFFFFF.toInt()
        typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD)
        textAlign = Paint.Align.CENTER
        letterSpacing = 0.18f
    }
    private val labelText = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    }
    private val labelBack = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xB3000000.toInt() }

    fun draw(canvas: Canvas, index: Int, image: RectF, density: Float) {
        val frame = ALL.getOrNull(index) ?: return
        if (frame.kind == NONE) return
        val c = crop(image, frame.ratio)
        border.strokeWidth = 1.5f * density
        guide.strokeWidth = 1f * density
        dashed.strokeWidth = 1.5f * density
        dashed.pathEffect = DashPathEffect(floatArrayOf(6f * density, 5f * density), 0f)

        // Escurece o que fica de fora.
        canvas.drawRect(image.left, image.top, image.right, c.top, shade)
        canvas.drawRect(image.left, c.bottom, image.right, image.bottom, shade)
        canvas.drawRect(image.left, c.top, c.left, c.bottom, shade)
        canvas.drawRect(c.right, c.top, image.right, c.bottom, shade)

        when (frame.kind) {
            THIRDS, FEED -> thirds(canvas, c)
            STORY -> {
                thirds(canvas, c)
                // Faixas que o Instagram cobre com o perfil (em cima) e a caixa de resposta (embaixo).
                val top = c.top + c.height() * 0.14f
                val bottom = c.bottom - c.height() * 0.20f
                canvas.drawLine(c.left, top, c.right, top, dashed)
                canvas.drawLine(c.left, bottom, c.right, bottom, dashed)
            }
            MAGAZINE -> {
                val head = c.height() * 0.16f
                canvas.drawRect(c.left, c.top, c.right, c.top + head, band)
                masthead.textSize = head * 0.55f
                canvas.drawText("REVISTA", c.centerX(), c.top + head * 0.72f, masthead)
                val m = c.width() * 0.06f
                canvas.drawRect(c.left + m, c.top + head + m * 0.5f, c.right - m, c.bottom - m, dashed)
            }
            ALBUM -> {
                // Dobra no meio: nada importante (rosto!) em cima dela.
                canvas.drawLine(c.centerX(), c.top, c.centerX(), c.bottom, dashed)
                val m = c.height() * 0.05f
                canvas.drawRect(c.left + m, c.top + m, c.right - m, c.bottom - m, guide)
            }
        }
        canvas.drawRect(c, border)

        labelText.textSize = 12f * density
        val pad = 8f * density
        val w = labelText.measureText(frame.name) + pad * 2
        val h = 24f * density
        val x = c.left + pad
        val y = c.bottom - pad - h
        canvas.drawRoundRect(x, y, x + w, y + h, h / 2, h / 2, labelBack)
        canvas.drawText(frame.name, x + pad, y + h / 2 + labelText.textSize * 0.35f, labelText)
    }

    private fun thirds(canvas: Canvas, c: RectF) {
        for (k in 1..2) {
            val x = c.left + c.width() * k / 3f
            val y = c.top + c.height() * k / 3f
            canvas.drawLine(x, c.top, x, c.bottom, guide)
            canvas.drawLine(c.left, y, c.right, y, guide)
        }
    }
}
