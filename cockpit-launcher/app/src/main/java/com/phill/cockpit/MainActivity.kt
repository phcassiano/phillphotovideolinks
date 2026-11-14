package com.phill.cockpit

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

sealed class Screen {
    data object Home : Screen()
    data class Apps(val pickSlot: Int? = null) : Screen()
    data object DriveLab : Screen()
    data object Settings : Screen()
}

class MainActivity : ComponentActivity() {
    val screen = mutableStateOf<Screen>(Screen.Home)

    private val permLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        Gps.start(this)
    }

    val wallLauncher = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            try { contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) } catch (e: Exception) { }
            Prefs.wallpaper.v = uri.toString()
        }
    }

    fun requestLocation() = permLauncher.launch(
        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
    )

    fun requestBluetooth() = permLauncher.launch(
        if (Build.VERSION.SDK_INT >= 31) arrayOf(Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.ACCESS_FINE_LOCATION)
        else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { Root(this) }
        if (!Gps.hasPermission(this)) requestLocation()
    }

    override fun onResume() {
        super.onResume()
        Gps.start(this)
        Media.refresh(this)
        applyFullscreen()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) applyFullscreen()
    }

    fun applyFullscreen() {
        val c = WindowCompat.getInsetsController(window, window.decorView)
        if (Prefs.fullscreen.v) {
            c.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            c.hide(WindowInsetsCompat.Type.systemBars())
        } else c.show(WindowInsetsCompat.Type.systemBars())
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Botão "Home" da central: volta para a tela inicial
        if (intent.hasCategory(Intent.CATEGORY_HOME)) screen.value = Screen.Home
    }
}

@Composable
fun Root(act: MainActivity) {
    val ac = accent()
    MaterialTheme(colorScheme = darkColorScheme(primary = ac, secondary = ac, onPrimary = Color.Black, surface = Color(0xFF15181F))) {
        Background {
            BoxWithConstraints(Modifier.fillMaxSize()) {
                val wide = maxWidth > maxHeight
                val kk = ((if (wide) maxHeight.value else maxWidth.value) / 440f).coerceIn(0.65f, 2.2f)
                CompositionLocalProvider(LocalK provides kk) {
                    val s = act.screen.value
                    BackHandler(enabled = true) { act.screen.value = Screen.Home }
                    when (s) {
                        Screen.Home -> HomeScreen(act, wide)
                        is Screen.Apps -> AppsScreen(act, s.pickSlot)
                        Screen.DriveLab -> DriveLabScreen(act, wide)
                        Screen.Settings -> SettingsScreen(act)
                    }
                    Welcome()
                }
            }
        }
    }
}

/** Entrada de boas-vindas: varredura dos ponteiros como na partida do carro. */
@Composable
fun Welcome() {
    var show by remember { mutableStateOf(Prefs.greeting.v && !Live.welcomed) }
    val sweep = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        Live.welcomed = true
        if (!show) return@LaunchedEffect
        launch {
            sweep.animateTo(200f, tween(1100, easing = FastOutSlowInEasing))
            sweep.animateTo(0f, tween(1100, easing = FastOutSlowInEasing))
        }
        delay(3800)
        show = false
    }
    AnimatedVisibility(show, enter = fadeIn(), exit = fadeOut(tween(900))) {
        Box(
            Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.94f)).clickable { show = false },
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                ArcGauge(sweep.value, 200f, "km/h", "", Modifier.fillMaxWidth(0.28f), numberSize = 34f)
                Spacer(Modifier.height(16.dp))
                val n = Prefs.name.v.trim()
                T(if (n.isEmpty()) "Bem-vindo!" else "Bem-vindo, $n!", 40f, display = true)
                T(Prefs.welcomeText.v, 22f, accent())
            }
        }
    }
}
