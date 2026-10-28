package com.phill.sonytether

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.os.Handler
import android.os.Looper
import android.text.TextUtils
import android.view.Gravity
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import java.util.concurrent.Executors

/**
 * Fileira de miniaturas com a foto da tela em cada preset, como no Lightroom Mobile:
 * um toque troca o preset. As miniaturas são feitas fora da thread da tela.
 */
class PresetStrip(
    context: Context,
    private val ui: Ui,
    private val library: PresetLibrary,
    private val onPick: (file: String?) -> Unit,
) {
    private class Item(val file: String?, val frame: FrameLayout, val image: ImageView, val label: TextView)

    private val main = Handler(Looper.getMainLooper())
    private val worker = Executors.newSingleThreadExecutor()
    private val row = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
    val view = HorizontalScrollView(context).apply {
        isHorizontalScrollBarEnabled = false
        clipToPadding = false
        addView(row)
    }
    private val items = ArrayList<Item>()
    private var source: Bitmap? = null
    @Volatile
    private var ticket = 0

    /** Monta de novo a fileira (presets importados ou removidos). */
    fun rebuild() {
        row.removeAllViews()
        items.clear()
        val entries = listOf<Pair<String?, String>>(null to "Original") + library.all().map { it.file to it.preset.name }
        for ((file, name) in entries) {
            val image = ImageView(row.context).apply {
                scaleType = ImageView.ScaleType.CENTER_CROP
                setBackgroundColor(Palette.ROW)
            }
            val frame = FrameLayout(row.context).apply {
                background = ui.rounded(Palette.ROW, 10)
                clipToOutline = true
                addView(image, FrameLayout.LayoutParams(ui.dp(TILE_W), ui.dp(TILE_H)))
            }
            val label = ui.text(name, 11f, Palette.TEXT2).apply {
                isSingleLine = true
                ellipsize = TextUtils.TruncateAt.END
                gravity = Gravity.CENTER
            }
            val tile = LinearLayout(row.context).apply {
                orientation = LinearLayout.VERTICAL
                addView(frame, LinearLayout.LayoutParams(ui.dp(TILE_W), ui.dp(TILE_H)))
                addView(label, LinearLayout.LayoutParams(ui.dp(TILE_W), WRAP_CONTENT).apply { topMargin = ui.dp(6) })
                setOnClickListener { onPick(file) }
                contentDescription = name
            }
            row.addView(tile, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { marginEnd = ui.dp(10) })
            items += Item(file, frame, image, label)
        }
        highlight()
        render()
    }

    /** Foto da tela mudou (ou null, sem foto): refaz as miniaturas. */
    fun setPhoto(original: Bitmap?) {
        source = original
        render()
    }

    /** A intensidade mudou: as miniaturas mostram o preset com ela. */
    fun refresh() = render()

    fun highlight() {
        val active = library.activeFile
        for (item in items) {
            val selected = item.file == active
            item.frame.foreground = if (selected) ui.rounded(Color.TRANSPARENT, 10, Palette.GOLD, 2) else null
            item.label.setTextColor(if (selected) Palette.GOLD else Palette.TEXT2)
        }
    }

    private fun render() {
        val base = source
        val list = items.toList()
        val amount = library.amount / 100f
        val mine = ++ticket
        worker.execute {
            if (mine != ticket) return@execute
            val small = base?.let { PhotoStore.scaled(it, ui.dp(TILE_W) * 2) } ?: sample(ui.dp(TILE_W) * 2, ui.dp(TILE_H) * 2)
            val presets = library.all().associateBy { it.file }
            for (item in list) {
                if (mine != ticket) return@execute
                val look = item.file?.let { presets[it] }?.let { PresetLook(it.preset, amount) }
                val bitmap = look?.apply(small.copy(Bitmap.Config.ARGB_8888, true)) ?: small
                main.post { if (mine == ticket) item.image.setImageBitmap(bitmap) }
            }
        }
    }

    /** Sem foto na tela: um degradê de céu para dar ideia da cor de cada preset. */
    private fun sample(w: Int, h: Int): Bitmap {
        val b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val c = Canvas(b)
        c.drawPaint(Paint().apply {
            shader = LinearGradient(0f, 0f, 0f, h.toFloat(), intArrayOf(0xFF3B4C7A.toInt(), 0xFFD9896A.toInt(), 0xFFF2D19B.toInt()), floatArrayOf(0f, 0.6f, 1f), Shader.TileMode.CLAMP)
        })
        c.drawRect(0f, h * 0.72f, w.toFloat(), h.toFloat(), Paint().apply { color = 0xFF3A2E2A.toInt() })
        c.drawCircle(w * 0.3f, h * 0.55f, h * 0.18f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFC9A27E.toInt() })
        return b
    }

    fun shutdown() = worker.shutdownNow()

    private companion object {
        const val TILE_W = 84
        const val TILE_H = 60
    }
}
