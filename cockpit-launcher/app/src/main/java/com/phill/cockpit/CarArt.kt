package com.phill.cockpit

import androidx.compose.foundation.Canvas
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import kotlin.math.cos
import kotlin.math.sin

/**
 * Carros desenhados pelo próprio app (vetor), em perfil. São silhuetas genéricas,
 * criadas aqui — não reproduzem nenhum modelo, marca ou desenho de terceiros.
 * A cor troca só na lataria; vidros, rodas e faróis continuam fixos.
 */

data class CarType(val id: String, val name: String)

val CarTypes = listOf(
    CarType("hatch", "Hatch"),
    CarType("sedan", "Sedã"),
    CarType("suv", "SUV"),
    CarType("coupe", "Cupê"),
    CarType("pickup", "Picape"),
    CarType("sport", "Esportivo"),
    CarType("classic", "Clássico"),
    CarType("van", "Van"),
)

val CarColors = listOf(
    0xFFD32F2F, 0xFF1976D2, 0xFF212121, 0xFFFAFAFA, 0xFF9E9E9E, 0xFF2E7D32,
    0xFFF9A825, 0xFFEF6C00, 0xFF6A1B9A, 0xFF00838F, 0xFF4E342E, 0xFFC2185B,
).map { it.toInt() }

val CarVariants = listOf("original" to "Original", "rebaixado" to "Rebaixado", "sport" to "Esportivo")

/** Pontos-chave de cada carroceria, em fração (0..1) da caixa do carro. */
private data class Spec(
    val roofY: Float, val beltY: Float, val hoodY: Float, val noseY: Float, val tailY: Float,
    val roofFX: Float, val roofRX: Float, val frontX: Float, val rearX: Float,
    val wsBaseX: Float, val blBaseX: Float, val faX: Float, val raX: Float,
    val wheelR: Float, val bed: Boolean = false, val chrome: Boolean = false, val tall: Float = 0f
)

private fun spec(type: String): Spec = when (type) {
    "hatch" -> Spec(0.14f, 0.46f, 0.49f, 0.55f, 0.52f, 0.34f, 0.70f, 0.05f, 0.90f, 0.30f, 0.76f, 0.24f, 0.74f, 0.105f)
    "suv" -> Spec(0.06f, 0.44f, 0.47f, 0.52f, 0.49f, 0.30f, 0.76f, 0.05f, 0.94f, 0.27f, 0.80f, 0.24f, 0.76f, 0.125f, tall = 0.04f)
    "coupe" -> Spec(0.22f, 0.49f, 0.53f, 0.60f, 0.55f, 0.40f, 0.66f, 0.04f, 0.95f, 0.33f, 0.78f, 0.25f, 0.76f, 0.11f)
    "pickup" -> Spec(0.12f, 0.46f, 0.49f, 0.55f, 0.56f, 0.30f, 0.50f, 0.05f, 0.95f, 0.26f, 0.49f, 0.23f, 0.80f, 0.115f, bed = true, tall = 0.02f)
    "sport" -> Spec(0.30f, 0.52f, 0.56f, 0.66f, 0.60f, 0.42f, 0.70f, 0.03f, 0.97f, 0.34f, 0.82f, 0.25f, 0.77f, 0.115f)
    "classic" -> Spec(0.12f, 0.44f, 0.48f, 0.52f, 0.50f, 0.36f, 0.68f, 0.05f, 0.92f, 0.31f, 0.74f, 0.25f, 0.75f, 0.105f, chrome = true)
    "van" -> Spec(0.03f, 0.46f, 0.50f, 0.56f, 0.20f, 0.18f, 0.93f, 0.05f, 0.95f, 0.22f, 0.90f, 0.22f, 0.80f, 0.11f, tall = 0.03f)
    else -> Spec(0.12f, 0.46f, 0.49f, 0.55f, 0.52f, 0.34f, 0.66f, 0.05f, 0.95f, 0.30f, 0.74f, 0.25f, 0.76f, 0.105f) // sedan
}

/** Desenha o carro preenchendo a largura `w`; devolve a altura usada. */
fun DrawScope.drawCar(w: Float, color: Color, variant: String, accent: Color, topPad: Float = 0f) {
    val type = Prefs.carType.v
    drawCarOf(type, w, color, variant, accent, topPad)
}

fun DrawScope.drawCarOf(type: String, w: Float, color: Color, variant: String, accent: Color, topPad: Float = 0f) {
    val s = spec(type)
    val vh = w * 0.50f                 // altura da caixa do carro
    fun x(f: Float) = f * w
    fun y(f: Float) = topPad + f * vh

    // Postura
    val lift = when (variant) { "rebaixado" -> -0.015f; "sport" -> -0.028f; else -> 0.0f } + s.tall
    val wheelR = x(s.wheelR) * (if (variant == "original") 1f else 1.06f)
    val cy = y(0.74f - lift)
    val sillY = y(0.74f - lift)
    val faX = x(s.faX); val raX = x(s.raX)
    val archR = wheelR * 1.28f
    val archTop = cy - wheelR - x(if (s.tall > 0 && variant == "original") 0.02f else 0.004f)

    // Sombra no chão
    drawOval(
        Brush.radialGradient(
            listOf(Color.Black.copy(alpha = 0.35f), Color.Transparent),
            Offset(w * 0.5f, cy + wheelR), w * 0.5f
        ),
        Offset(x(0.04f), cy + wheelR * 0.75f), Size(w * 0.92f, wheelR * 0.9f)
    )

    drawWheel(Offset(faX, cy), wheelR, accent, variant)
    drawWheel(Offset(raX, cy), wheelR, accent, variant)

    // Corpo (lataria) — recortes de para-lama sobre as rodas
    val body = Path().apply {
        moveTo(x(s.frontX), sillY)
        lineTo(x(s.frontX), y(s.noseY))
        cubicTo(x(s.frontX + 0.02f), y(s.hoodY - 0.02f), x(s.wsBaseX - 0.10f), y(s.hoodY), x(s.wsBaseX), y(s.hoodY))
        cubicTo(x(s.wsBaseX + 0.05f), y(s.hoodY - 0.02f), x(s.roofFX - 0.03f), y(s.roofY + 0.02f), x(s.roofFX), y(s.roofY))
        if (s.bed) {
            lineTo(x(s.roofRX), y(s.roofY))                 // teto da cabine
            lineTo(x(s.roofRX), y(s.beltY))                 // desce atrás da cabine
            lineTo(x(s.blBaseX + 0.04f), y(s.beltY + 0.02f))
            lineTo(x(s.blBaseX + 0.04f), y(s.tailY))        // parede da caçamba
            lineTo(x(s.rearX), y(s.tailY))
        } else {
            quadraticBezierTo(x((s.roofFX + s.roofRX) / 2), y(s.roofY - 0.025f), x(s.roofRX), y(s.roofY))
            cubicTo(x(s.roofRX + 0.04f), y(s.roofY + 0.03f), x(s.blBaseX - 0.02f), y(s.beltY - 0.02f), x(s.blBaseX), y(s.tailY - 0.02f))
            lineTo(x(s.rearX), y(s.tailY))
        }
        lineTo(x(s.rearX), sillY)
        lineTo(raX + archR, sillY)
        cubicTo(raX + archR * 0.55f, archTop, raX - archR * 0.55f, archTop, raX - archR, sillY)
        lineTo(faX + archR, sillY)
        cubicTo(faX + archR * 0.55f, archTop, faX - archR * 0.55f, archTop, faX - archR, sillY)
        close()
    }
    val light = color.lighten(0.22f)
    val dark = color.darken(0.30f)
    drawPath(body, Brush.verticalGradient(listOf(light, color, dark), startY = topPad, endY = topPad + vh))
    // Reflexo na lateral
    drawPath(body, Color.White.copy(alpha = 0.06f), style = Stroke(w * 0.012f))
    drawLine(Color.White.copy(alpha = 0.18f), Offset(x(s.frontX + 0.04f), y(s.beltY + 0.03f)), Offset(x(s.rearX - 0.04f), y(s.beltY + 0.03f)), w * 0.006f)

    // Vidros
    if (!s.bed || true) {
        val glass = Path().apply {
            moveTo(x(s.wsBaseX + 0.01f), y(s.beltY))
            lineTo(x(s.roofFX + 0.02f), y(s.roofY + 0.035f))
            val rr = if (s.bed) s.roofRX else s.roofRX
            lineTo(x(rr - 0.02f), y(s.roofY + 0.035f))
            if (s.bed) lineTo(x(rr - 0.02f), y(s.beltY)) else lineTo(x(s.blBaseX - 0.03f), y(s.beltY))
            close()
        }
        drawPath(glass, Brush.verticalGradient(listOf(Color(0xFF2A3340), Color(0xFF151A22))))
        drawPath(glass, Color.White.copy(alpha = 0.10f), style = Stroke(w * 0.004f))
        // Pilar central
        if (type != "coupe" && type != "sport") {
            val pillarX = x((s.roofFX + (if (s.bed) s.roofRX else s.roofRX)) / 2)
            drawLine(color, Offset(pillarX, y(s.roofY + 0.04f)), Offset(pillarX, y(s.beltY)), w * 0.018f)
        }
    }

    // Faróis e lanterna
    drawCircle(Color(0xFFFFF3C4), w * 0.018f, Offset(x(s.frontX + 0.015f), y(s.hoodY + 0.02f)))
    drawRoundRectCompat(Color(0xFFB71C1C), Offset(x(s.rearX - 0.03f), y(s.tailY + 0.015f)), Size(w * 0.025f, vh * 0.07f), w * 0.004f)

    // Maçanetas e vinco de porta
    drawLine(dark.copy(alpha = 0.6f), Offset(x(0.42f), y(s.beltY + 0.06f)), Offset(x(0.42f), y(0.70f - lift)), w * 0.004f)
    drawLine(Color.Black.copy(alpha = 0.35f), Offset(x(0.38f), y(s.beltY + 0.05f)), Offset(x(0.46f), y(s.beltY + 0.05f)), w * 0.006f)

    // Retrovisor
    drawRoundRectCompat(dark, Offset(x(s.wsBaseX - 0.02f), y(s.beltY - 0.005f)), Size(w * 0.03f, vh * 0.05f), w * 0.004f)

    if (s.chrome) {
        drawLine(Color(0xFFCFD8DC), Offset(x(s.frontX), y(0.71f - lift)), Offset(x(s.frontX + 0.05f), y(0.71f - lift)), w * 0.012f)
        drawLine(Color(0xFFCFD8DC), Offset(x(s.rearX - 0.05f), y(0.71f - lift)), Offset(x(s.rearX), y(0.71f - lift)), w * 0.012f)
    }

    // Postura esportiva: aerofólio + splitter
    if (variant == "sport") {
        drawRoundRectCompat(dark, Offset(x(s.rearX - 0.10f), y(s.tailY - 0.055f)), Size(w * 0.12f, vh * 0.028f), w * 0.006f)
        drawLine(dark, Offset(x(s.rearX - 0.04f), y(s.tailY - 0.03f)), Offset(x(s.rearX - 0.04f), y(s.tailY)), w * 0.012f)
        drawLine(accent, Offset(x(s.frontX - 0.01f), sillY + wheelR * 0.2f), Offset(x(s.frontX + 0.12f), sillY + wheelR * 0.2f), w * 0.01f)
    }
}

private fun DrawScope.drawWheel(c: Offset, r: Float, accent: Color, variant: String) {
    drawCircle(Color(0xFF0D0D0D), r, c)
    drawCircle(Color(0xFF1C1C1C), r * 0.97f, c, style = Stroke(r * 0.06f))
    val rimR = r * if (variant == "original") 0.56f else 0.68f
    drawCircle(Color(0xFF2B2F36), rimR, c)
    drawCircle(if (variant == "sport") accent else Color(0xFFB0BEC5), rimR, c, style = Stroke(r * 0.07f))
    for (i in 0 until 5) {
        val a = Math.toRadians((i * 72).toDouble())
        drawLine(
            Color(0xFF90A4AE), c,
            Offset(c.x + (rimR * 0.85f * cos(a)).toFloat(), c.y + (rimR * 0.85f * sin(a)).toFloat()),
            r * 0.08f
        )
    }
    drawCircle(Color(0xFF546E7A), rimR * 0.22f, c)
}

private fun DrawScope.drawRoundRectCompat(color: Color, topLeft: Offset, size: Size, radius: Float) {
    drawRoundRect(color, topLeft, size, androidx.compose.ui.geometry.CornerRadius(radius, radius))
}

fun Color.lighten(f: Float) = Color(
    red + (1 - red) * f, green + (1 - green) * f, blue + (1 - blue) * f, alpha
)

fun Color.darken(f: Float) = Color(red * (1 - f), green * (1 - f), blue * (1 - f), alpha)

/** Composable reutilizável: mostra um carro. */
@androidx.compose.runtime.Composable
fun CarView(modifier: Modifier, type: String, color: Color, variant: String, accent: Color) {
    Canvas(modifier) {
        val w = size.width
        val carH = w * 0.50f
        val pad = (size.height - carH).coerceAtLeast(0f) / 2f
        drawCarOf(type, w, color, variant, accent, pad)
    }
}
