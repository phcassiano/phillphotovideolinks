package com.phill.sonytether

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.view.MotionEvent
import android.view.View
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * A foto girada e endireitada, com a moldura do recorte por cima: arrastar dentro move, arrastar
 * um canto muda o tamanho (na proporção escolhida, se houver).
 */
class CropView(context: Context) : View(context) {

    private var image: Bitmap? = null

    /** Recorte em frações da imagem (0 a 1). */
    var crop = RectF(0f, 0f, 1f, 1f)
        set(value) {
            field = RectF(value)
            invalidate()
        }

    /** Largura ÷ altura do recorte, em pixels; null = livre. */
    var aspect: Float? = null
        set(value) {
            field = value
            fitAspect()
            invalidate()
        }

    val imageAspect get() = image?.let { it.width.toFloat() / it.height } ?: 1f

    private val density = resources.displayMetrics.density
    private val dst = RectF()
    private val imagePaint = Paint(Paint.FILTER_BITMAP_FLAG)
    private val dim = Paint().apply { color = 0xB3000000.toInt() }
    private val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        color = Color.WHITE
        strokeWidth = 1.5f * density
    }
    private val grid = Paint().apply {
        color = 0x66FFFFFF
        strokeWidth = 1f * density
    }
    private val handle = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        strokeWidth = 4f * density
        strokeCap = Paint.Cap.SQUARE
    }

    /** 0 a 3 = canto (esq-cima, dir-cima, dir-baixo, esq-baixo), 4 = mover, -1 = nada. */
    private var mode = -1
    private var lastX = 0f
    private var lastY = 0f

    fun setImage(bitmap: Bitmap) {
        image = bitmap
        fitAspect()
        invalidate()
    }

    /** O maior recorte na proporção escolhida, centrado onde o atual estava. */
    private fun fitAspect() {
        val a = aspect ?: return
        if (image == null) return
        val ratio = a / imageAspect // largura ÷ altura em frações
        var w = min(1f, ratio)
        var h = w / ratio
        if (h > 1f) {
            h = 1f
            w = ratio
        }
        val cx = crop.centerX().coerceIn(w / 2, 1f - w / 2)
        val cy = crop.centerY().coerceIn(h / 2, 1f - h / 2)
        crop = RectF(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
    }

    override fun onDraw(canvas: Canvas) {
        val b = image ?: return
        val pad = 28f * density
        val scale = min((width - 2 * pad) / b.width, (height - 2 * pad) / b.height)
        val w = b.width * scale
        val h = b.height * scale
        dst.set((width - w) / 2, (height - h) / 2, (width + w) / 2, (height + h) / 2)
        canvas.drawBitmap(b, null, dst, imagePaint)

        val c = screenCrop()
        canvas.drawRect(dst.left, dst.top, dst.right, c.top, dim)
        canvas.drawRect(dst.left, c.bottom, dst.right, dst.bottom, dim)
        canvas.drawRect(dst.left, c.top, c.left, c.bottom, dim)
        canvas.drawRect(c.right, c.top, dst.right, c.bottom, dim)
        for (i in 1..2) {
            val x = c.left + c.width() * i / 3
            val y = c.top + c.height() * i / 3
            canvas.drawLine(x, c.top, x, c.bottom, grid)
            canvas.drawLine(c.left, y, c.right, y, grid)
        }
        canvas.drawRect(c, border)
        val len = 18f * density
        for ((x, y, sx, sy) in corners(c)) {
            canvas.drawLine(x, y, x + sx * len, y, handle)
            canvas.drawLine(x, y, x, y + sy * len, handle)
        }
    }

    private fun screenCrop() = RectF(
        dst.left + crop.left * dst.width(),
        dst.top + crop.top * dst.height(),
        dst.left + crop.right * dst.width(),
        dst.top + crop.bottom * dst.height(),
    )

    /** Cantos na ordem de [mode], com a direção para dentro do recorte. */
    private fun corners(c: RectF) = listOf(
        listOf(c.left, c.top, 1f, 1f),
        listOf(c.right, c.top, -1f, 1f),
        listOf(c.right, c.bottom, -1f, -1f),
        listOf(c.left, c.bottom, 1f, -1f),
    )

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(e: MotionEvent): Boolean {
        if (image == null || dst.isEmpty) return false
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                val c = screenCrop()
                val reach = 36f * density
                mode = corners(c).indexOfFirst { (x, y) -> abs(e.x - x) < reach && abs(e.y - y) < reach }
                if (mode < 0 && c.contains(e.x, e.y)) mode = MOVE
                lastX = e.x
                lastY = e.y
                parent?.requestDisallowInterceptTouchEvent(true)
                return mode >= 0
            }
            MotionEvent.ACTION_MOVE -> {
                if (mode == MOVE) {
                    val dx = ((e.x - lastX) / dst.width()).coerceIn(-crop.left, 1f - crop.right)
                    val dy = ((e.y - lastY) / dst.height()).coerceIn(-crop.top, 1f - crop.bottom)
                    crop = RectF(crop.left + dx, crop.top + dy, crop.right + dx, crop.bottom + dy)
                } else if (mode >= 0) {
                    resize(mode, (e.x - dst.left) / dst.width(), (e.y - dst.top) / dst.height())
                }
                lastX = e.x
                lastY = e.y
                return true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> mode = -1
        }
        return true
    }

    /** Arrasta o canto [corner] até (px, py), com o canto oposto parado. */
    private fun resize(corner: Int, px: Float, py: Float) {
        val sx = if (corner == 1 || corner == 2) 1f else -1f // para onde o canto cresce
        val sy = if (corner >= 2) 1f else -1f
        val fx = if (sx > 0) crop.left else crop.right
        val fy = if (sy > 0) crop.top else crop.bottom
        val maxW = if (sx > 0) 1f - fx else fx
        val maxH = if (sy > 0) 1f - fy else fy
        var w = ((px - fx) * sx).coerceIn(MIN, maxW)
        var h = ((py - fy) * sy).coerceIn(MIN, maxH)
        aspect?.let { a ->
            val ratio = a / imageAspect
            h = w / ratio
            if (h > maxH) {
                h = maxH
                w = h * ratio
            }
            if (h < MIN) {
                h = MIN
                w = min(maxW, h * ratio)
            }
        }
        val x2 = fx + sx * w
        val y2 = fy + sy * h
        crop = RectF(min(fx, x2), min(fy, y2), max(fx, x2), max(fy, y2))
    }

    private companion object {
        const val MOVE = 4
        const val MIN = 0.08f
    }
}
