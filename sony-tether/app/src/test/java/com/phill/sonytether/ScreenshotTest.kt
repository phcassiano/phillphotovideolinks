package com.phill.sonytether

import android.app.AlertDialog
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import android.view.View
import android.widget.ScrollView
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.shadows.ShadowDialog
import java.io.File

/**
 * Capturas da tela para conferir o design sem o tablet:
 * ./gradlew testReleaseUnitTest --tests ScreenshotTest -Pscreenshots  (imagens em design/)
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w1280dp-h800dp-land-xhdpi")
class ScreenshotTest {
    private lateinit var dir: File

    @Before
    fun setUp() {
        val path = System.getProperty("screenshots")
        assumeTrue(path != null)
        dir = File(path!!).apply { mkdirs() }
    }

    private fun save(view: View, name: String) {
        val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
        view.draw(Canvas(bitmap))
        File(dir, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    /** Uma "foto" de teste: céu de fim de tarde com sol. */
    private fun fakePhoto(w: Int, h: Int): Bitmap {
        val b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val c = Canvas(b)
        c.drawPaint(Paint().apply { shader = LinearGradient(0f, 0f, 0f, h.toFloat(), intArrayOf(0xFF22305A.toInt(), 0xFFE07A4F.toInt(), 0xFFF3C27A.toInt()), floatArrayOf(0f, 0.65f, 1f), Shader.TileMode.CLAMP) })
        c.drawCircle(w * 0.62f, h * 0.68f, h * 0.12f, Paint(Paint.ANTI_ALIAS_FLAG).apply { shader = RadialGradient(w * 0.62f, h * 0.68f, h * 0.12f, Color.WHITE, 0xFFFFD27A.toInt(), Shader.TileMode.CLAMP) })
        c.drawRect(0f, h * 0.78f, w.toFloat(), h.toFloat(), Paint().apply { color = 0xFF1A1420.toInt() })
        return b
    }

    private fun call(target: Any, name: String, vararg args: Any?) {
        val m = target.javaClass.declaredMethods.first { it.name == name && it.parameterCount == args.size }
        m.isAccessible = true
        m.invoke(target, *args)
    }

    @Test
    fun screens() {
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        val root = activity.window.decorView
        save(root, "1-sem-fotos")

        val shoot = activity.javaClass.getDeclaredField("shoot").apply { isAccessible = true }.get(activity) as ShootSession
        val photos = (1..6).map { n ->
            SessionPhoto(n, "Ensaio_00$n.jpg").apply {
                width = 7952
                height = 5304
                rating = if (n == 6) 4 else n % 3
                favorite = n == 6 || n == 2
            }
        }
        photos.forEach { p ->
            shoot.photos += p
            call(activity, "addTile", p, true)
            call(activity, "setThumb", p, fakePhoto(360, 240))
        }
        val big = fakePhoto(1800, 1200)
        call(activity, "show", photos.last(), big, big, true)
        call(activity, "updateCounter")
        shadowOf(android.os.Looper.getMainLooper()).idle()
        root.measure(View.MeasureSpec.makeMeasureSpec(root.width, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(root.height, View.MeasureSpec.EXACTLY))
        root.layout(0, 0, root.width, root.height)
        save(root, "2-com-foto")

        val panel = activity.javaClass.getDeclaredField("panel").apply { isAccessible = true }.get(activity) as ScrollView
        panel.scrollTo(0, 10_000)
        save(root, "3-painel-rolado")

        call(activity, "choosePreset")
        shadowOf(android.os.Looper.getMainLooper()).idle()
        val dialog = ShadowDialog.getLatestDialog() as AlertDialog
        save(dialog.window!!.decorView, "4-dialogo")
    }
}
