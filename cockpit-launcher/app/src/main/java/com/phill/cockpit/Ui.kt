package com.phill.cockpit

import android.graphics.BitmapFactory
import android.net.Uri
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

val Display = FontFamily(Font(R.font.chakra_petch, FontWeight.SemiBold))
val Body = FontFamily(Font(R.font.exo2, FontWeight.SemiBold))

/** Escala de texto conforme o tamanho da tela da central. */
val LocalK = compositionLocalOf { 1f }

@Composable
fun k(v: Float): TextUnit = (v * LocalK.current).sp

val Accents = listOf(
    0xFF00E5FF, 0xFF2979FF, 0xFF7C4DFF, 0xFFE040FB, 0xFFFF1744, 0xFFFF6D00,
    0xFFFFAB00, 0xFFFFEA00, 0xFF76FF03, 0xFF00E676, 0xFF1DE9B6, 0xFFFFFFFF
).map { it.toInt() }

data class BgStyle(val id: String, val name: String, val top: Color, val bottom: Color, val glow: Color?)

val BgStyles = listOf(
    BgStyle("ceu", "Céu azul", Color(0xFF1B3B68), Color(0xFF060B18), Color(0xFF4DA3FF)),
    BgStyle("neon", "Neon noturno", Color(0xFF04060C), Color(0xFF0B1730), null),
    BgStyle("ambar", "Oficina âmbar", Color(0xFF0E0803), Color(0xFF2B1806), Color(0xFFFFA726)),
    BgStyle("grafite", "Grafite", Color(0xFF070707), Color(0xFF1B1C1F), null),
    BgStyle("oceano", "Oceano", Color(0xFF01090F), Color(0xFF053244), Color(0xFF26C6DA)),
    BgStyle("sunset", "Pôr do sol", Color(0xFF12041A), Color(0xFF3B0E22), Color(0xFFFF7043)),
    BgStyle("floresta", "Floresta", Color(0xFF030A05), Color(0xFF0C2614), Color(0xFF66BB6A)),
    BgStyle("vermelho", "Esportivo", Color(0xFF0A0202), Color(0xFF2A0606), Color(0xFFFF1744)),
)

@Composable
fun accent() = Color(Prefs.accent.state.value)

/** Céu azul com nuvens suaves, estilo painel premium. */
fun androidx.compose.ui.graphics.drawscope.DrawScope.drawClouds(drift: Float, ac: Color, glow: Color) {
    val w = size.width; val h = size.height
    drawRect(Brush.verticalGradient(listOf(glow.copy(alpha = 0.16f), Color.Transparent), 0f, h * 0.55f))
    val clouds = listOf(
        Triple(0.18f, 0.12f, 0.40f), Triple(0.60f, 0.09f, 0.46f), Triple(0.88f, 0.20f, 0.34f),
        Triple(0.38f, 0.24f, 0.50f), Triple(0.05f, 0.30f, 0.30f), Triple(0.74f, 0.34f, 0.34f)
    )
    for ((cx, cy, cr) in clouds) {
        val x = (((cx + drift * 0.05f) % 1.15f)) * w
        val r = cr * w * 0.5f
        drawCircle(
            Brush.radialGradient(
                listOf(Color.White.copy(alpha = 0.11f), Color.White.copy(alpha = 0.03f), Color.Transparent),
                Offset(x, cy * h), r
            ), r, Offset(x, cy * h)
        )
    }
    drawCircle(
        Brush.radialGradient(listOf(ac.copy(alpha = 0.12f), Color.Transparent), Offset(w * 0.5f, h * 1.04f), w * 0.65f),
        w * 0.65f, Offset(w * 0.5f, h * 1.04f)
    )
}

/** Temas prontos: trocam cor, fundo, estilo dos botões e transparência de uma vez. */
data class ThemePreset(val name: String, val accent: Long, val bg: String, val tile: String, val panelAlpha: Float, val anim: Boolean)

val ThemePresets = listOf(
    ThemePreset("Céu azul", 0xFF3FA9FF, "ceu", "glass", 0.08f, true),
    ThemePreset("Neon noturno", 0xFF00E5FF, "neon", "glass", 0.10f, true),
    ThemePreset("Oceano", 0xFF26C6DA, "oceano", "glass", 0.09f, true),
    ThemePreset("Oficina âmbar", 0xFFFFA726, "ambar", "glass", 0.10f, false),
    ThemePreset("Esportivo", 0xFFFF1744, "vermelho", "solid", 0.10f, false),
    ThemePreset("Grafite", 0xFFECEFF1, "grafite", "outline", 0.06f, false),
)

fun applyPreset(p: ThemePreset) {
    Prefs.accent.v = p.accent.toInt()
    Prefs.bgStyle.v = p.bg
    Prefs.tileStyle.v = p.tile
    Prefs.panelAlpha.v = p.panelAlpha
    Prefs.animatedBg.v = p.anim
    Prefs.wallpaper.v = ""
}

@Composable
fun Background(content: @Composable BoxScope.() -> Unit) {
    val style = BgStyles.firstOrNull { it.id == Prefs.bgStyle.state.value } ?: BgStyles[0]
    val ac = accent()
    val glow = style.glow ?: ac
    val wallUri = Prefs.wallpaper.state.value
    val ctx = LocalContext.current
    val wall by produceState<ImageBitmap?>(null, wallUri) {
        value = if (wallUri.isBlank()) null else withContext(Dispatchers.IO) {
            try {
                val u = Uri.parse(wallUri)
                val o = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                ctx.contentResolver.openInputStream(u)?.use { BitmapFactory.decodeStream(it, null, o) }
                var s = 1
                while (o.outWidth / (s * 2) >= 1280) s *= 2
                ctx.contentResolver.openInputStream(u)?.use {
                    BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = s })
                }?.asImageBitmap()
            } catch (e: Exception) { null }
        }
    }
    Box(
        Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(style.top, style.bottom)))
    ) {
        if (wall != null) {
            Image(wall!!, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = Prefs.wallDim.state.value)))
        } else if (style.id == "ceu") {
            val t = rememberInfiniteTransition(label = "ceu")
            val drift by t.animateFloat(0f, 1f, infiniteRepeatable(tween(60000, easing = LinearEasing), RepeatMode.Reverse), label = "d")
            Canvas(Modifier.fillMaxSize()) { drawClouds(if (Prefs.animatedBg.v) drift else 0.5f, ac, glow) }
        } else if (Prefs.animatedBg.state.value) {
            val t = rememberInfiniteTransition(label = "bg")
            val a by t.animateFloat(0f, 1f, infiniteRepeatable(tween(18000, easing = LinearEasing), RepeatMode.Reverse), label = "a")
            val b by t.animateFloat(1f, 0f, infiniteRepeatable(tween(26000, easing = LinearEasing), RepeatMode.Reverse), label = "b")
            Canvas(Modifier.fillMaxSize()) {
                val r = size.maxDimension * 0.55f
                drawCircle(
                    Brush.radialGradient(listOf(glow.copy(alpha = 0.22f), Color.Transparent), Offset(size.width * a, size.height * 0.2f), r),
                    r, Offset(size.width * a, size.height * 0.2f)
                )
                drawCircle(
                    Brush.radialGradient(listOf(ac.copy(alpha = 0.14f), Color.Transparent), Offset(size.width * b, size.height * 0.95f), r),
                    r, Offset(size.width * b, size.height * 0.95f)
                )
                // linhas de "estrada"
                val y0 = size.height * 0.98f
                for (i in 0..14) {
                    val x = size.width * (i / 14f)
                    drawLine(ac.copy(alpha = 0.05f), Offset(size.width / 2, size.height * 0.55f), Offset(x, y0), 1.5f)
                }
            }
        } else if (style.glow != null) {
            Canvas(Modifier.fillMaxSize()) {
                val r = size.maxDimension * 0.6f
                drawCircle(Brush.radialGradient(listOf(glow.copy(alpha = 0.18f), Color.Transparent), Offset(size.width * 0.5f, 0f), r), r, Offset(size.width * 0.5f, 0f))
            }
        }
        content()
    }
}

@Composable
fun Panel(modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, content: @Composable BoxScope.() -> Unit) {
    val ac = accent()
    val shape = RoundedCornerShape(22.dp)
    val style = Prefs.tileStyle.state.value
    val bg = when (style) {
        "solid" -> Color(0xFF15181F)
        "outline" -> Color.Transparent
        else -> Color.White.copy(alpha = Prefs.panelAlpha.state.value)
    }
    var m = modifier.clip(shape).background(bg)
        .border(if (style == "outline") 2.dp else 1.dp, ac.copy(alpha = if (style == "outline") 0.7f else 0.22f), shape)
    if (onClick != null) m = m.clickable { onClick() }
    Box(m.padding(12.dp), content = content)
}

@Composable
fun T(
    text: String, size: Float = 16f, color: Color = Color.White, display: Boolean = false,
    modifier: Modifier = Modifier, align: TextAlign? = null, maxLines: Int = 1, alpha: Float = 1f
) {
    Text(
        text, modifier, color = color.copy(alpha = color.alpha * alpha), maxLines = maxLines, overflow = TextOverflow.Ellipsis,
        textAlign = align,
        style = TextStyle(fontFamily = if (display) Display else Body, fontSize = k(size), lineHeight = k(size * 1.15f))
    )
}

@Composable
fun ArcGauge(
    value: Float?, max: Float, unit: String, label: String, modifier: Modifier = Modifier,
    color: Color = accent(), warnFrom: Float? = null, numberSize: Float = 46f, decimals: Int = 0, alert: Boolean = false
) {
    val v by animateFloatAsState((value ?: 0f).coerceIn(0f, max), tween(350), label = "g")
    val warnColor = Color(0xFFFF1744)
    val col = if (alert || (warnFrom != null && v >= warnFrom)) warnColor else color
    Box(modifier.aspectRatio(1f), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val stroke = size.minDimension * 0.075f
            val inset = stroke / 2 + size.minDimension * 0.04f
            val tl = Offset(inset, inset)
            val sz = Size(size.width - inset * 2, size.height - inset * 2)
            drawArc(Color.White.copy(alpha = 0.08f), 135f, 270f, false, tl, sz, style = Stroke(stroke, cap = StrokeCap.Round))
            if (warnFrom != null) {
                val ws = 270f * warnFrom / max
                drawArc(warnColor.copy(alpha = 0.25f), 135f + ws, 270f - ws, false, tl, sz, style = Stroke(stroke, cap = StrokeCap.Butt))
            }
            drawArc(
                Brush.sweepGradient(listOf(col.copy(alpha = 0.5f), col, col.copy(alpha = 0.5f))),
                135f, 270f * v / max, false, tl, sz, style = Stroke(stroke, cap = StrokeCap.Round)
            )
            val c = Offset(size.width / 2, size.height / 2)
            val rOut = sz.width / 2 - stroke * 0.9f
            for (i in 0..20) {
                val major = i % 2 == 0
                rotate(135f + 270f * i / 20f, c) {
                    drawLine(
                        Color.White.copy(alpha = if (major) 0.5f else 0.2f),
                        Offset(c.x + rOut - (if (major) stroke * 0.9f else stroke * 0.5f), c.y), Offset(c.x + rOut, c.y),
                        if (major) 3f else 2f
                    )
                }
            }
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            T(value?.let { if (decimals == 0) "%.0f".format(it) else "%.${decimals}f".format(it) } ?: "—", numberSize, if (alert) warnColor else Color.White, display = true)
            T(unit, numberSize * 0.3f, alpha = 0.7f)
            T(label, numberSize * 0.24f, col, alpha = 0.9f)
        }
    }
}

@Composable
fun Pill(text: String, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val ac = accent()
    Box(
        modifier.clip(RoundedCornerShape(50)).background(if (selected) ac else Color.White.copy(alpha = 0.08f))
            .clickable { onClick() }.padding(horizontal = 16.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) { T(text, 15f, if (selected) Color.Black else Color.White) }
}

@Composable
fun Btn(text: String, modifier: Modifier = Modifier, primary: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
    val ac = accent()
    Box(
        modifier.clip(RoundedCornerShape(14.dp))
            .background(if (!enabled) Color.White.copy(alpha = 0.04f) else if (primary) ac else Color.White.copy(alpha = 0.10f))
            .clickable(enabled = enabled) { onClick() }.padding(horizontal = 18.dp, vertical = 12.dp),
        contentAlignment = Alignment.Center
    ) { T(text, 15f, if (primary && enabled) Color.Black else Color.White, alpha = if (enabled) 1f else 0.4f, align = TextAlign.Center) }
}

/** Ícone de seta "voltar" desenhado (sem depender de pacote de ícones). */
@Composable
fun BackArrow(modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val w = size.width; val h = size.height
        drawLine(Color.White, Offset(w * 0.3f, h / 2), Offset(w * 0.8f, h / 2), 5f, StrokeCap.Round)
        drawLine(Color.White, Offset(w * 0.3f, h / 2), Offset(w * 0.52f, h * 0.25f), 5f, StrokeCap.Round)
        drawLine(Color.White, Offset(w * 0.3f, h / 2), Offset(w * 0.52f, h * 0.75f), 5f, StrokeCap.Round)
    }
}

