package com.phill.sonytether

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.ClipDrawable
import android.graphics.drawable.Drawable
import android.graphics.drawable.LayerDrawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView

/** Cores do app (as mesmas de res/values/colors.xml, usadas aqui no código). */
object Palette {
    const val BACKGROUND = 0xFF0D0D10.toInt()
    const val PANEL = 0xFF131317.toInt()
    const val CARD = 0xFF1B1B21.toInt()
    const val STROKE = 0xFF292931.toInt()
    const val ROW = 0xFF23232B.toInt()
    const val TEXT = 0xFFF2F2F5.toInt()
    const val TEXT2 = 0xFFA1A1AD.toInt()
    const val TEXT3 = 0xFF6E6E7A.toInt()
    const val GOLD = 0xFFE9B45A.toInt()
    const val GOLD_DEEP = 0xFFC98A2E.toInt()
    const val GREEN = 0xFF4CD38A.toInt()
    const val RED = 0xFFFF6B6B.toInt()
    const val PINK = 0xFFFF5A7A.toInt()
    const val SCRIM = 0x99000000.toInt()
}

/** Botão que fica translúcido quando desligado (os nossos não têm estado visual próprio). */
class RowButton(context: Context) : Button(context) {
    override fun setEnabled(enabled: Boolean) {
        super.setEnabled(enabled)
        alpha = if (enabled) 1f else 0.38f
    }
}

/** Peças da tela feitas em código: cartões, linhas com ícone, botões. */
class Ui(private val context: Context) {
    private val density = context.resources.displayMetrics.density

    fun dp(value: Int) = (value * density).toInt()

    val medium: Typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)

    fun text(text: String, sp: Float, color: Int, bold: Boolean = false) = TextView(context).apply {
        this.text = text
        setTextColor(color)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
        if (bold) typeface = medium
        includeFontPadding = false
        setLineSpacing(0f, 1.15f)
    }

    fun icon(res: Int, color: Int, sizeDp: Int = 24) = ImageView(context).apply {
        setImageResource(res)
        imageTintList = ColorStateList.valueOf(color)
        layoutParams = LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp))
    }

    fun rounded(color: Int, radiusDp: Int, stroke: Int? = null, strokeDp: Int = 1) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = dp(radiusDp).toFloat()
        if (stroke != null) setStroke(dp(strokeDp), stroke)
    }

    fun gradient(orientation: GradientDrawable.Orientation, vararg colors: Int, radiusDp: Int = 0) =
        GradientDrawable(orientation, colors).apply { cornerRadius = dp(radiusDp).toFloat() }

    /** Fundo com o efeito de toque do Android, nos mesmos cantos arredondados. */
    fun ripple(content: Drawable?, radiusDp: Int, color: Int = 0x33FFFFFF) =
        RippleDrawable(ColorStateList.valueOf(color), content, rounded(Color.WHITE, radiusDp))

    fun card() = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        background = rounded(Palette.CARD, 16, Palette.STROKE)
        setPadding(dp(16), dp(14), dp(16), dp(16))
    }

    /** Título do cartão: ícone dourado + nome em versalete. */
    fun cardTitle(iconRes: Int, title: String) = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        addView(icon(iconRes, Palette.GOLD, 16))
        addView(text(title.uppercase(), 11f, Palette.TEXT2, bold = true).apply {
            letterSpacing = 0.12f
            setPadding(dp(8), 0, 0, 0)
        })
        setPadding(0, 0, 0, dp(12))
    }

    private fun base(text: String, iconRes: Int?, onClick: () -> Unit) = RowButton(context).apply {
        this.text = text
        isAllCaps = false
        textSize = 15f
        typeface = medium
        stateListAnimator = null
        minHeight = 0
        minimumHeight = 0
        minWidth = 0
        minimumWidth = 0
        compoundDrawablePadding = dp(12)
        setPadding(dp(14), 0, dp(12), 0)
        isSingleLine = true
        ellipsize = android.text.TextUtils.TruncateAt.END
        if (iconRes != null) setIcon(this, iconRes)
        setOnClickListener { onClick() }
    }

    /** Linha de cartão: ícone, texto e (para escolhas) a seta à direita. */
    fun row(iconRes: Int, text: String, chevron: Boolean = true, color: Int = Palette.TEXT, onClick: () -> Unit) =
        base(text, iconRes, onClick).apply {
            gravity = Gravity.START or Gravity.CENTER_VERTICAL
            setTextColor(color)
            background = ripple(rounded(Palette.ROW, 12), 12)
            compoundDrawableTintList = ColorStateList.valueOf(if (color == Palette.TEXT) Palette.TEXT2 else color)
            if (chevron) setEnd(this, R.drawable.ic_chevron_right)
        }

    /** Ação principal: dourado, texto escuro. */
    fun primary(iconRes: Int?, text: String, onClick: () -> Unit) = base(text, iconRes, onClick).apply {
        gravity = Gravity.CENTER
        setTextColor(0xFF1A1307.toInt())
        background = ripple(gradient(GradientDrawable.Orientation.TL_BR, Palette.GOLD, Palette.GOLD_DEEP, radiusDp = 12), 12, 0x40FFFFFF)
        compoundDrawableTintList = ColorStateList.valueOf(0xFF1A1307.toInt())
        elevation = dp(2).toFloat()
    }

    fun setIcon(button: Button, iconRes: Int) {
        val end = button.compoundDrawablesRelative[2]
        button.setCompoundDrawablesRelative(sized(iconRes, 20), null, end, null)
    }

    private fun setEnd(button: Button, iconRes: Int) {
        button.setCompoundDrawablesRelative(button.compoundDrawablesRelative[0], null, sized(iconRes, 20), null)
    }

    private fun sized(res: Int, sizeDp: Int) = context.getDrawable(res)!!.mutate().apply { setBounds(0, 0, dp(sizeDp), dp(sizeDp)) }

    /** Controle deslizante dourado, com trilho fino. */
    fun styleSlider(bar: SeekBar) {
        val track = rounded(0x33FFFFFF, 2)
        val fill = ClipDrawable(rounded(Palette.GOLD, 2), Gravity.START, ClipDrawable.HORIZONTAL)
        bar.progressDrawable = LayerDrawable(arrayOf(track, fill)).apply {
            setId(0, android.R.id.background)
            setId(1, android.R.id.progress)
        }
        bar.minHeight = dp(4)
        bar.maxHeight = dp(4)
        bar.thumb = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(Palette.GOLD)
            setStroke(dp(3), Palette.CARD)
            setSize(dp(22), dp(22))
        }
        bar.splitTrack = false
        bar.background = null
    }

    /** Pequena etiqueta arredondada (versão, ORIGINAL…). */
    fun pill(text: String, textColor: Int, background: Int, stroke: Int? = null) = text(text, 10f, textColor, bold = true).apply {
        letterSpacing = 0.1f
        this.background = rounded(background, 20, stroke)
        setPadding(dp(8), dp(4), dp(8), dp(4))
    }

    /** Bolinha de cor (estado da conexão). */
    fun dot(color: Int) = View(context).apply {
        background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(color)
        }
        layoutParams = LinearLayout.LayoutParams(dp(10), dp(10))
    }

    fun setDotColor(view: View, color: Int) {
        (view.background as GradientDrawable).setColor(color)
    }

    fun matchWidth(heightDp: Int, topDp: Int = 0) = LinearLayout.LayoutParams(MATCH_PARENT, dp(heightDp)).apply { topMargin = dp(topDp) }

    fun wrap(topDp: Int = 0) = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(topDp) }
}
