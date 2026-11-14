package com.phill.cockpit

import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val ptBR = Locale("pt", "BR")

@Composable
fun HomeScreen(act: MainActivity, wide: Boolean) {
    val gap = Arrangement.spacedBy(12.dp)
    if (wide) {
        Row(Modifier.fillMaxSize().padding(12.dp), horizontalArrangement = gap) {
            Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = gap) {
                ClockPanel(act, Modifier.weight(0.85f).fillMaxWidth())
                SpeedPanel(act, Modifier.weight(1.35f).fillMaxWidth())
            }
            Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = gap) {
                MediaPanel(Modifier.weight(1.35f).fillMaxWidth())
                TripPanel(act, Modifier.weight(0.85f).fillMaxWidth())
            }
            Column(Modifier.weight(1.1f).fillMaxHeight(), verticalArrangement = gap) {
                Shortcuts(act, Modifier.weight(1f).fillMaxWidth(), cols = 2)
                Dock(act)
            }
        }
    } else {
        Column(Modifier.fillMaxSize().padding(12.dp), verticalArrangement = gap) {
            ClockPanel(act, Modifier.weight(0.7f).fillMaxWidth())
            Row(Modifier.weight(1.1f).fillMaxWidth(), horizontalArrangement = gap) {
                SpeedPanel(act, Modifier.weight(1f).fillMaxHeight())
                TripPanel(act, Modifier.weight(0.8f).fillMaxHeight())
            }
            MediaPanel(Modifier.weight(0.9f).fillMaxWidth())
            Shortcuts(act, Modifier.weight(0.9f).fillMaxWidth(), cols = 3)
            Dock(act)
        }
    }
}

@Composable
fun ClockPanel(act: MainActivity, modifier: Modifier) {
    val now by produceState(System.currentTimeMillis()) {
        while (true) { value = System.currentTimeMillis(); delay(1000L - value % 1000L) }
    }
    val time = SimpleDateFormat(if (Prefs.clock24.state.value) "HH:mm" else "h:mm", ptBR).format(Date(now))
    val date = SimpleDateFormat("EEEE, d 'de' MMMM", ptBR).format(Date(now)).replaceFirstChar { it.uppercase() }
    val w = Weather.now.value
    val ac = accent()
    Panel(modifier, onClick = { act.screen.value = Screen.Garage }) {
        if (Prefs.showCar.state.value) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomEnd) {
                CarView(Modifier.fillMaxWidth(0.52f).fillMaxHeight(0.5f), Prefs.carType.state.value, Color(Prefs.carColor.state.value), Prefs.carVariant.state.value, ac)
            }
        }
        Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
            Column {
                T(time, 58f, display = true)
                T(date, 16f, alpha = 0.75f)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (w != null) {
                    T(Weather.icon(w.code, Weather.isDay()), 24f)
                    Spacer(Modifier.width(8.dp))
                    Column {
                        T("${w.temp}°  ${Weather.label(w.code)}", 16f)
                        T("↑${w.max}°  ↓${w.min}°  ☂ ${w.rainChance}%", 13f, alpha = 0.6f)
                    }
                } else T(if (Gps.location.value == null) "Clima: aguardando localização" else "Clima: carregando…", 13f, alpha = 0.5f)
            }
        }
    }
}

@Composable
fun SpeedPanel(act: MainActivity, modifier: Modifier) {
    val speed = Live.speed.floatValue
    val lim = Prefs.speedLimit.state.value
    val over = Live.overLimit.value
    Panel(modifier, onClick = { act.screen.value = Screen.DriveLab }) {
        Row(Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
            ArcGauge(speed, 200f, "km/h", Live.speedFrom.value, Modifier.weight(1f).fillMaxHeight(), alert = over, numberSize = 50f)
            Column(Modifier.weight(0.55f).padding(start = 6.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                T("LIMITE", 12f, alpha = 0.6f)
                Box(
                    Modifier.size((56 * LocalK.current).dp).clip(CircleShape).background(Color.White)
                        .padding(5.dp).clip(CircleShape).background(Color(0xFFD50000)).padding(5.dp).clip(CircleShape).background(Color.White),
                    contentAlignment = Alignment.Center
                ) { T(if (lim == 0) "—" else "$lim", 18f, Color.Black, display = true) }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    MiniBtn("−") { Prefs.speedLimit.v = (lim - 10).coerceAtLeast(0) }
                    MiniBtn("+") { Prefs.speedLimit.v = (lim + 10).coerceAtMost(180) }
                }
                val rpm = Obd.data.value.rpm
                if (Obd.connected && rpm != null) T("%.0f rpm".format(rpm), 14f, accent())
            }
        }
    }
}

@Composable
fun MiniBtn(t: String, onClick: () -> Unit) {
    Box(
        Modifier.size((38 * LocalK.current).dp).clip(CircleShape).background(Color.White.copy(alpha = 0.12f)).clickable { onClick() },
        contentAlignment = Alignment.Center
    ) { T(t, 20f) }
}

@Composable
fun MediaPanel(modifier: Modifier) {
    val ctx = LocalContext.current
    val title = Media.title.value
    val artist = Media.artist.value
    val art = Media.art.value
    val ac = accent()
    val pos by produceState(0L, Media.playing.value, title) {
        while (true) { value = Media.livePosition(); delay(1000) }
    }
    Panel(modifier) {
        Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
            Row(Modifier.weight(1f).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.weight(0.42f).fillMaxHeight().clip(RoundedCornerShape(16.dp))
                        .background(ac.copy(alpha = 0.15f)).clickable { Media.openSource(ctx) },
                    contentAlignment = Alignment.Center
                ) {
                    if (art != null) Image(art, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                    else T("♫", 40f, ac)
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(0.58f)) {
                    T(title.ifEmpty { "Nada tocando" }, 18f, maxLines = 2)
                    T(artist.ifEmpty { Apps.find(Media.source.value)?.label ?: "" }, 14f, alpha = 0.65f)
                    if (!Media.hasAccess.value) {
                        Spacer(Modifier.height(6.dp))
                        T("Toque para mostrar capa e faixa", 12f, ac, maxLines = 2,
                            modifier = Modifier.clickable {
                                Apps.open(ctx, Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS), Intent(Settings.ACTION_SETTINGS))
                            })
                    }
                }
            }
            val dur = Media.duration.longValue
            if (dur > 0) {
                Spacer(Modifier.height(8.dp))
                Box(Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(Color.White.copy(alpha = 0.12f))) {
                    Box(Modifier.fillMaxWidth((pos.toFloat() / dur).coerceIn(0f, 1f)).fillMaxHeight().background(ac))
                }
            }
            Spacer(Modifier.height(8.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
                CtrlBtn("−🔊", small = true) { Media.volume(ctx, false) }
                CtrlBtn("⏮") { Media.prev(ctx) }
                CtrlBtn(if (Media.playing.value) "⏸" else "▶", primary = true) { Media.playPause(ctx) }
                CtrlBtn("⏭") { Media.next(ctx) }
                CtrlBtn("+🔊", small = true) { Media.volume(ctx, true) }
            }
        }
    }
}

@Composable
fun CtrlBtn(t: String, primary: Boolean = false, small: Boolean = false, onClick: () -> Unit) {
    val s = (if (primary) 56 else 46) * LocalK.current
    Box(
        Modifier.size(s.dp).clip(CircleShape).background(if (primary) accent() else Color.White.copy(alpha = 0.10f)).clickable { onClick() },
        contentAlignment = Alignment.Center
    ) { T(t, if (small) 13f else 20f, if (primary) Color.Black else Color.White) }
}

@Composable
fun TripPanel(act: MainActivity, modifier: Modifier) {
    val d = Obd.data.value
    val st = Obd.state.value
    val dot = when (st) { Obd.ST_CAR -> Color(0xFF00E676); Obd.ST_ADAPTER, Obd.ST_CONNECTING -> Color(0xFFFFAB00); else -> Color(0xFF616161) }
    Panel(modifier, onClick = { act.screen.value = Screen.DriveLab }) {
        Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(10.dp).clip(CircleShape).background(dot))
                Spacer(Modifier.width(8.dp))
                T(if (st == Obd.ST_CAR) "Drive Lab · OBD2" else "Drive Lab · ${if (st == Obd.ST_OFF) "toque para conectar" else "conectando"}", 13f, alpha = 0.8f)
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Stat("%.1f".format(Trip.km.floatValue), "km")
                Stat(fmtDur(Trip.movingSec.longValue), "em movimento")
                Stat("%.0f".format(Trip.avgSpeed()), "km/h méd.")
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                if (st == Obd.ST_CAR) {
                    Stat(d.kml?.let { "%.1f".format(it) } ?: d.lph?.let { "%.1f".format(it) } ?: "—", if (d.kml != null) "km/l agora" else "L/h agora")
                    Stat(d.coolant?.let { "%.0f°".format(it) } ?: "—", "motor", warn = (d.coolant ?: 0f) >= 105f)
                    Stat(d.voltage?.let { "%.1f".format(it) } ?: "—", "volts", warn = d.voltage != null && d.voltage < 12.0f)
                } else {
                    Stat("%.0f".format(Trip.maxSpeed.floatValue), "km/h máx.")
                    Stat(if (Trip.hasFuel.value) "%.1f".format(Trip.avgKml()) else "—", "km/l méd.")
                    Stat(if (Trip.hasFuel.value) "R$ %.2f".format(Trip.cost()) else "—", "gasto")
                }
            }
        }
    }
}

@Composable
fun Stat(v: String, l: String, warn: Boolean = false) {
    Column(horizontalAlignment = Alignment.Start) {
        T(v, 22f, if (warn) Color(0xFFFF5252) else Color.White, display = true)
        T(l, 11f, alpha = 0.6f)
    }
}

fun fmtDur(s: Long): String = if (s >= 3600) "%dh%02d".format(s / 3600, (s % 3600) / 60) else "%d:%02d".format(s / 60, s % 60)

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun Shortcuts(act: MainActivity, modifier: Modifier, cols: Int) {
    val ctx = LocalContext.current
    val apps = Apps.list.value
    val count = 6
    val rows = (count + cols - 1) / cols
    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        for (r in 0 until rows) {
            Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                for (c in 0 until cols) {
                    val i = r * cols + c
                    if (i >= count) { Spacer(Modifier.weight(1f)); continue }
                    val pkg = Prefs.slots[i].state.value
                    val app = apps.firstOrNull { it.pkg == pkg }
                    Tile(app, Modifier.weight(1f).fillMaxHeight(),
                        onClick = { if (app != null) Apps.launch(ctx, app.pkg) else act.screen.value = Screen.Apps(i) },
                        onLong = { act.screen.value = Screen.Apps(i) })
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun Tile(app: AppInfo?, modifier: Modifier, onClick: () -> Unit, onLong: () -> Unit) {
    val ac = accent()
    val shape = RoundedCornerShape(22.dp)
    val style = Prefs.tileStyle.state.value
    Box(
        modifier.clip(shape)
            .background(if (style == "solid") Color(0xFF15181F) else Color.White.copy(alpha = if (style == "outline") 0.02f else Prefs.panelAlpha.state.value))
            .combinedClickable(onClick = onClick, onLongClick = onLong)
            .padding(8.dp),
        contentAlignment = Alignment.Center
    ) {
        if (app == null) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                T("+", 30f, ac)
                T("Adicionar", 12f, alpha = 0.6f)
            }
        } else {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                Image(app.icon, app.label, Modifier.weight(1f, fill = false).aspectRatio(1f).padding(4.dp))
                T(app.label, 14f, align = TextAlign.Center)
            }
        }
    }
}

@Composable
fun Dock(act: MainActivity) {
    val ctx = LocalContext.current
    Row(Modifier.fillMaxWidth().height((58 * LocalK.current).dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        DockBtn("▦", "Apps") { act.screen.value = Screen.Apps() }
        DockBtn("⛝", "Garagem") { act.screen.value = Screen.Garage }
        DockBtn("◎", "Drive Lab") { act.screen.value = Screen.DriveLab }
        DockBtn("⚙", "Ajustes") { act.screen.value = Screen.Settings }
    }
}

@Composable
fun RowScope.DockBtn(icon: String, label: String, narrow: Boolean = false, onClick: () -> Unit) {
    Row(
        Modifier.weight(if (narrow) 0.45f else 1f).fillMaxHeight().clip(RoundedCornerShape(16.dp))
            .background(Color.White.copy(alpha = 0.08f)).clickable { onClick() }.padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center
    ) {
        T(icon, 20f, accent())
        if (label.isNotEmpty()) { Spacer(Modifier.width(6.dp)); T(label, 12f) }
    }
}
