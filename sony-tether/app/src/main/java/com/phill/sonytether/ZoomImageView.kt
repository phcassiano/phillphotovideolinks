package com.phill.sonytether

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import android.view.animation.DecelerateInterpolator
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * A foto grande da tela: pinça para zoom, dois toques alternam entre a foto inteira e 100%
 * (um pixel da foto por pixel da tela), arrastar move, deslizar para o lado troca de foto
 * e segurar mostra o original. Com zoom além da imagem da tela, pede um trecho em
 * resolução cheia ([Listener.onDetailNeeded]) para conferir o foco.
 */
class ZoomImageView(context: Context) : View(context) {

    interface Listener {
        /** [rect] é o trecho visível (0..1 na foto); [widthPx] é a largura que ele ocupa na tela. */
        fun onDetailNeeded(rect: RectF, widthPx: Int, token: Int)
        fun onHold(holding: Boolean)

        /** -1 = foto anterior, +1 = próxima. */
        fun onSwipe(direction: Int)
    }

    var listener: Listener? = null

    private var bitmap: Bitmap? = null
    private var sourceWidth = 0
    private var detail: Bitmap? = null
    private var detailRect: RectF? = null
    private var token = 0

    /** 1 = foto inteira na tela. */
    private var zoom = 1f
    private var offsetX = 0f
    private var offsetY = 0f
    private var holding = false
    private var scaling = false
    private var animator: ValueAnimator? = null
    private val paint = Paint(Paint.FILTER_BITMAP_FLAG)
    private val dst = RectF()
    private val detailDst = RectF()

    /** Moldura de recorte por cima da foto (índice em [Frames.ALL]); 0 = nenhuma. */
    var frame = 0
        set(value) {
            field = value
            invalidate()
        }

    val isZoomed get() = zoom > 1.01f

    /** [resetZoom] = false mantém o enquadramento (mesma foto com outro preset). */
    fun setImage(image: Bitmap?, fullWidth: Int, resetZoom: Boolean) {
        bitmap = image
        sourceWidth = fullWidth
        clearDetail()
        if (resetZoom) {
            animator?.cancel()
            zoom = 1f
        }
        clamp()
        invalidate()
        if (!resetZoom) requestDetail()
    }

    /** Troca só a imagem (ex.: segurar para ver o original), sem mexer no zoom nem no trecho. */
    fun swapImage(image: Bitmap?) {
        bitmap = image
        invalidate()
    }

    fun setDetail(image: Bitmap, rect: RectF, forToken: Int) {
        if (forToken != token) return
        detail = image
        detailRect = rect
        invalidate()
    }

    private fun clearDetail() {
        token++
        detail = null
        detailRect = null
    }

    private fun fitScale(b: Bitmap) = min(width / b.width.toFloat(), height / b.height.toFloat())

    /** Zoom em que um pixel da foto inteira vira um pixel da tela. */
    private fun fullZoom(b: Bitmap): Float {
        val z = if (sourceWidth > 0) sourceWidth / (b.width * fitScale(b)) else 3f
        return max(z, 2f)
    }

    private fun maxZoom(b: Bitmap) = fullZoom(b) * 2f

    private fun clamp() {
        val b = bitmap ?: return
        if (width == 0) return
        val s = fitScale(b) * zoom
        val w = b.width * s
        val h = b.height * s
        offsetX = if (w <= width) (width - w) / 2 else offsetX.coerceIn(width - w, 0f)
        offsetY = if (h <= height) (height - h) / 2 else offsetY.coerceIn(height - h, 0f)
    }

    /** Muda o zoom mantendo parado o ponto da foto que está em ([fx], [fy]). */
    private fun zoomTo(target: Float, fx: Float, fy: Float) {
        val b = bitmap ?: return
        val z = target.coerceIn(1f, maxZoom(b))
        offsetX = fx - (fx - offsetX) * (z / zoom)
        offsetY = fy - (fy - offsetY) * (z / zoom)
        zoom = z
        clamp()
        invalidate()
    }

    private fun animateZoom(target: Float, fx: Float, fy: Float) {
        animator?.cancel()
        animator = ValueAnimator.ofFloat(zoom, target).apply {
            duration = 220
            interpolator = DecelerateInterpolator()
            addUpdateListener { zoomTo(it.animatedValue as Float, fx, fy) }
            addListener(object : android.animation.AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: android.animation.Animator) = requestDetail()
            })
            start()
        }
    }

    private val requestRunnable = Runnable { requestDetail() }

    private fun requestDetailSoon() {
        removeCallbacks(requestRunnable)
        postDelayed(requestRunnable, 150)
    }

    private fun requestDetail() {
        val b = bitmap ?: return
        val s = fitScale(b) * zoom
        // Só vale a pena quando a imagem da tela já está sendo ampliada.
        if (s <= 1.05f || sourceWidth <= b.width) {
            if (zoom <= 1.01f && detail != null) {
                clearDetail()
                invalidate()
            }
            return
        }
        val w = b.width * s
        val h = b.height * s
        val rect = RectF(
            max(0f, -offsetX / w), max(0f, -offsetY / h),
            min(1f, (width - offsetX) / w), min(1f, (height - offsetY) / h),
        )
        if (rect.width() <= 0f || rect.height() <= 0f) return
        token++
        listener?.onDetailNeeded(rect, (rect.width() * w).toInt(), token)
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        clamp()
    }

    override fun onDraw(canvas: Canvas) {
        canvas.drawColor(Color.BLACK)
        val b = bitmap ?: return
        if (b.isRecycled) return
        val s = fitScale(b) * zoom
        dst.set(offsetX, offsetY, offsetX + b.width * s, offsetY + b.height * s)
        canvas.drawBitmap(b, null, dst, paint)
        val d = detail
        val r = detailRect
        if (d != null && r != null && !d.isRecycled && !holding) {
            val dw = dst.width()
            val dh = dst.height()
            detailDst.set(dst.left + r.left * dw, dst.top + r.top * dh, dst.left + r.right * dw, dst.top + r.bottom * dh)
            canvas.drawBitmap(d, null, detailDst, paint)
        }
        if (frame != 0 && !holding) Frames.draw(canvas, frame, dst, resources.displayMetrics.density)
    }

    private val scaleDetector = ScaleGestureDetector(context, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScaleBegin(detector: ScaleGestureDetector): Boolean {
            animator?.cancel()
            scaling = true
            return true
        }

        override fun onScale(detector: ScaleGestureDetector): Boolean {
            zoomTo(zoom * detector.scaleFactor, detector.focusX, detector.focusY)
            return true
        }
    })

    private val gestures = GestureDetector(context, object : GestureDetector.SimpleOnGestureListener() {
        override fun onDown(e: MotionEvent) = true

        override fun onDoubleTap(e: MotionEvent): Boolean {
            val b = bitmap ?: return true
            if (isZoomed) animateZoom(1f, e.x, e.y) else animateZoom(fullZoom(b), e.x, e.y)
            return true
        }

        override fun onScroll(e1: MotionEvent?, e2: MotionEvent, dx: Float, dy: Float): Boolean {
            if (!isZoomed) return false
            offsetX -= dx
            offsetY -= dy
            clamp()
            invalidate()
            return true
        }

        override fun onFling(e1: MotionEvent?, e2: MotionEvent, vx: Float, vy: Float): Boolean {
            if (isZoomed || scaling || e1 == null) return false
            val dx = e2.x - e1.x
            if (abs(dx) > width / 8f && abs(vx) > abs(vy) * 1.5f) listener?.onSwipe(if (dx < 0) 1 else -1)
            return true
        }

        override fun onLongPress(e: MotionEvent) {
            if (scaling) return
            holding = true
            listener?.onHold(true)
            invalidate()
        }
    })

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        scaleDetector.onTouchEvent(event)
        gestures.onTouchEvent(event)
        when (event.actionMasked) {
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                if (holding) {
                    holding = false
                    listener?.onHold(false)
                    invalidate()
                }
                scaling = false
                if (animator?.isRunning != true) requestDetailSoon()
            }
        }
        return true
    }
}
