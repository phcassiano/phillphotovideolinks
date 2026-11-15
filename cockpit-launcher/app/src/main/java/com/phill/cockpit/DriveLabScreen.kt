package com.phill.cockpit

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val tabs = listOf("Cockpit", "Desempenho", "Viagem", "Saúde", "Conexão")
private var lastTab = 0

@Composable
fun DriveLabScreen(act: MainActivity, wide: Boolean) {
    var tab by remember { mutableStateOf(if (!Obd.configured()) 3 else lastTab) }
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Header(act, "Drive Lab") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                tabs.forEachIndexed { i, t -> Pill(t, tab == i) { tab = i; lastTab = i } }
            }
        }
        StatusLine()
        Spacer(Modifier.height(10.dp))
        Box(Modifier.weight(1f).fillMaxWidth()) {
            when (tab) {
                0 -> CockpitTab(wide)
                1 -> PerfTab()
                2 -> TripTab()
                3 -> HealthTab()
                else -> ConnectTab(act)
            }
        }
    }
}

@Composable
fun StatusLine() {
    val st = Obd.state.value
    val dot = when (st) { Obd.ST_CAR -> Color(0xFF00E676); Obd.ST_ADAPTER, Obd.ST_CONNECTING -> Color(0xFFFFAB00); else -> Color(0xFF757575) }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(10.dp).clip(CircleShape).background(dot))
        Spacer(Modifier.width(8.dp))
        T(Obd.status.value, 14f, alpha = 0.85f)
        if (st >= Obd.ST_ADAPTER) T("   ${Obd.adapterInfo.value}  ${Obd.protocol.value}", 12f, alpha = 0.5f)
    }
}

@Composable
fun CockpitTab(wide: Boolean) {
    val d = Obd.data.value
    val tiles = listOf(
        Triple("Motor", d.coolant?.let { "%.0f °C".format(it) }, (d.coolant ?: 0f) >= 105f),
        Triple("Bateria", d.voltage?.let { "%.1f V".format(it) }, d.voltage != null && (d.voltage < 12.0f || d.voltage > 15.0f)),
        Triple("Admissão", d.intake?.let { "%.0f °C".format(it) }, false),
        Triple("Carga", d.load?.let { "%.0f %%".format(it) }, false),
        Triple("Acelerador", d.throttle?.let { "%.0f %%".format(it) }, false),
        Triple("Tanque", d.fuelLevel?.let { "%.0f %%".format(it) }, d.fuelLevel != null && d.fuelLevel < 12f),
        Triple("Consumo", d.kml?.let { "%.1f km/l".format(it) } ?: d.lph?.let { "%.1f L/h".format(it) }, false),
        Triple("Fluxo de ar", d.maf?.let { "%.1f g/s".format(it) }, false),
        Triple("Avanço", d.timing?.let { "%.0f°".format(it) }, false),
    )
    val content: @Composable (Modifier) -> Unit = { m ->
        LazyVerticalGrid(GridCells.Adaptive((130 * LocalK.current).dp), m,
            verticalArrangement = Arrangement.spacedBy(10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            items(tiles) { (l, v, warn) ->
                Panel {
                    Column {
                        T(l, 13f, alpha = 0.6f)
                        T(v ?: "—", 24f, if (warn) Color(0xFFFF5252) else Color.White, display = true)
                    }
                }
            }
        }
    }
    if (wide) Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        ArcGauge(d.rpm?.div(1000f), 8f, "x1000 rpm", "GIRO", Modifier.weight(0.6f), warnFrom = 6f, decimals = 1, numberSize = 40f)
        ArcGauge(Live.speed.floatValue, 200f, "km/h", Live.speedFrom.value, Modifier.weight(0.6f), alert = Live.overLimit.value, numberSize = 40f)
        content(Modifier.weight(1f).fillMaxHeight())
    } else Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(Modifier.fillMaxWidth().weight(0.8f), horizontalArrangement = Arrangement.SpaceEvenly) {
            ArcGauge(d.rpm?.div(1000f), 8f, "x1000 rpm", "GIRO", Modifier.fillMaxHeight(), warnFrom = 6f, decimals = 1)
            ArcGauge(Live.speed.floatValue, 200f, "km/h", Live.speedFrom.value, Modifier.fillMaxHeight(), alert = Live.overLimit.value)
        }
        content(Modifier.weight(1f).fillMaxWidth())
    }
}

@Composable
fun TripTab() {
    val items = listOf(
        "Distância" to "%.2f km".format(Trip.km.floatValue),
        "Tempo em movimento" to fmtDur(Trip.movingSec.longValue),
        "Tempo total" to fmtDur(Trip.totalSec.longValue),
        "Velocidade média" to "%.0f km/h".format(Trip.avgSpeed()),
        "Velocidade máxima" to "%.0f km/h".format(Trip.maxSpeed.floatValue),
        "Combustível gasto" to if (Trip.hasFuel.value) "%.2f L".format(Trip.liters.floatValue) else "— (precisa do OBD2)",
        "Média de consumo" to if (Trip.hasFuel.value) "%.1f km/l".format(Trip.avgKml()) else "—",
        "Custo da viagem" to if (Trip.hasFuel.value) "R$ %.2f".format(Trip.cost()) else "—",
    )
    Column(Modifier.fillMaxSize()) {
        LazyVerticalGrid(GridCells.Adaptive((210 * LocalK.current).dp), Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            items(items) { (l, v) -> Panel { Column { T(l, 13f, alpha = 0.6f); T(v, 26f, display = true) } } }
        }
        Spacer(Modifier.height(10.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Panel {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CompassRose(Modifier.size((56 * LocalK.current).dp))
                    Spacer(Modifier.width(10.dp))
                    Column {
                        val h = Gps.heading.floatValue
                        T("Bússola", 12f, alpha = 0.6f)
                        T(if (h < 0) "—" else "${compassName(h)}  %.0f°".format(h), 20f, display = true)
                    }
                }
            }
            Panel { Column { T("Altitude", 12f, alpha = 0.6f); T(Gps.altitude.value?.let { "%.0f m".format(it) } ?: "—", 22f, display = true) } }
            Btn("Zerar viagem") { Trip.reset() }
        }
        T("Consumo é estimativa (margem de 10–15%%). Altitude e bússola vêm do GPS.", 12f, alpha = 0.45f, modifier = Modifier.padding(top = 6.dp))
    }
}

fun compassName(deg: Float): String {
    val dirs = listOf("N", "NE", "L", "SE", "S", "SO", "O", "NO")
    return dirs[(((deg + 22.5f) % 360f) / 45f).toInt().coerceIn(0, 7)]
}

@Composable
fun HealthTab() {
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var codes by remember { mutableStateOf<List<Pair<String, Boolean>>?>(null) }
    var msg by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf(false) }
    val ok = Obd.state.value >= Obd.ST_ADAPTER
    Column(Modifier.fillMaxSize()) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Btn(if (busy) "Lendo…" else "Ler códigos", primary = true, enabled = ok && !busy) {
                busy = true; msg = ""
                scope.launch {
                    val stored = Obd.raw("03")?.let { Obd.parseDtcs(it, "43") } ?: emptyList()
                    val pend = Obd.raw("07")?.let { Obd.parseDtcs(it, "47") } ?: emptyList()
                    codes = stored.map { it to false } + pend.filter { it !in stored }.map { it to true }
                    msg = if (codes!!.isEmpty()) "Nenhum código de falha. Tudo certo!" else ""
                    busy = false
                }
            }
            Btn("Apagar códigos", enabled = ok && !busy && Live.speed.floatValue < 3f) { confirm = true }
            if (!ok) T("Conecte o OBD2 na aba Conexão.", 14f, alpha = 0.6f)
        }
        Spacer(Modifier.height(10.dp))
        if (msg.isNotEmpty()) T(msg, 18f, accent())
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(codes ?: emptyList()) { (c, pending) ->
                Panel(Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        T(c, 24f, if (Dtc.severe(c)) Color(0xFFFF5252) else accent(), display = true)
                        Spacer(Modifier.width(14.dp))
                        Column {
                            T(Dtc.describe(c), 15f, maxLines = 2)
                            T(if (pending) "Pendente (ainda não acendeu a luz)" else "Confirmado", 12f, alpha = 0.55f)
                        }
                    }
                }
            }
        }
    }
    if (confirm) AlertDialog(
        onDismissRequest = { confirm = false },
        title = { Text("Apagar códigos?") },
        text = { Text("Isso apaga a luz de injeção e os dados de prontidão. Faça com o carro parado e a ignição ligada (motor desligado). Se o defeito continuar, o código volta.") },
        confirmButton = {
            TextButton({
                confirm = false
                scope.launch { val r = Obd.raw("04"); msg = if (r != null && r.uppercase().contains("44")) "Códigos apagados." else "O carro não confirmou. Tente com o motor desligado."; codes = null }
            }) { Text("Apagar") }
        },
        dismissButton = { TextButton({ confirm = false }) { Text("Cancelar") } }
    )
}

@SuppressLint("MissingPermission")
private fun bonded(ctx: Context): List<Pair<String, String>> = try {
    (ctx.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter?.bondedDevices
        ?.map { (it.name ?: it.address) to it.address }?.sortedByDescending { p ->
            val n = p.first.uppercase(); n.contains("OBD") || n.contains("ELM") || n.contains("V-LINK") || n.contains("VLINK")
        } ?: emptyList()
} catch (e: SecurityException) { emptyList() }

@Composable
fun ConnectTab(act: MainActivity) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var type by remember { mutableStateOf(Prefs.obdType.v) }
    var refresh by remember { mutableStateOf(0) }
    val bleFound = remember { mutableStateListOf<Pair<String, String>>() }
    var scanning by remember { mutableStateOf(false) }
    var console by remember { mutableStateOf("") }
    var consoleOut by remember { mutableStateOf("") }

    if (Live.speed.floatValue > 10f) { Moving(); return }

    DisposableEffect(scanning) {
        var cb: ScanCallback? = null
        val ad = (ctx.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter
        if (scanning) {
            cb = object : ScanCallback() {
                @SuppressLint("MissingPermission")
                override fun onScanResult(callbackType: Int, r: ScanResult) {
                    val d: BluetoothDevice = r.device
                    val n = try { d.name } catch (e: SecurityException) { null } ?: r.scanRecord?.deviceName ?: return
                    if (bleFound.none { it.second == d.address }) bleFound += n to d.address
                }
            }
            try { ad?.bluetoothLeScanner?.startScan(cb) } catch (e: SecurityException) { act.requestBluetooth(); scanning = false }
            scope.launch { delay(10000); scanning = false }
        }
        onDispose { try { if (cb != null) ad?.bluetoothLeScanner?.stopScan(cb) } catch (e: Exception) { } }
    }

    Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Column(Modifier.weight(1f).fillMaxHeight().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            T("Tipo de adaptador ELM327", 15f, alpha = 0.7f)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("bt" to "Bluetooth", "ble" to "BLE", "wifi" to "Wi-Fi", "demo" to "Demonstração").forEach { (id, n) ->
                    Pill(n, type == id) { type = id; Prefs.obdType.v = id }
                }
            }
            when (type) {
                "demo" -> T("Simula um adaptador num carro rodando, para você conhecer o Drive Lab sem OBD2.", 13f, alpha = 0.6f, maxLines = 3)
                "wifi" -> {
                    T("Conecte a central na rede Wi-Fi do adaptador (ex.: WiFi_OBDII) antes.", 13f, alpha = 0.6f, maxLines = 3)
                    var host by remember { mutableStateOf(Prefs.wifiHost.v) }
                    var port by remember { mutableStateOf(Prefs.wifiPort.v.toString()) }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(host, { host = it; Prefs.wifiHost.v = it }, Modifier.weight(2f), label = { Text("Endereço") }, singleLine = true)
                        OutlinedTextField(port, { port = it; it.toIntOrNull()?.let { p -> Prefs.wifiPort.v = p } }, Modifier.weight(1f), label = { Text("Porta") }, singleLine = true)
                    }
                    Btn("Abrir Wi-Fi da central") { Apps.open(ctx, Intent(Settings.ACTION_WIFI_SETTINGS)) }
                }
                "ble" -> {
                    T("BLE não precisa parear: ligue a ignição e toque em Procurar.", 13f, alpha = 0.6f, maxLines = 2)
                    Btn(if (scanning) "Procurando…" else "Procurar", primary = true, enabled = !scanning) {
                        if (Obd.state.value != Obd.ST_OFF) Obd.disconnect()
                        bleFound.clear(); act.requestBluetooth(); scanning = true
                    }
                    DeviceList(bleFound)
                }
                else -> {
                    T("Pareie o adaptador nas configurações de Bluetooth (senha comum: 1234 ou 0000).", 13f, alpha = 0.6f, maxLines = 2)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Btn("Atualizar lista") { act.requestBluetooth(); refresh++ }
                        Btn("Parear novo") { Apps.open(ctx, Intent(Settings.ACTION_BLUETOOTH_SETTINGS)) }
                    }
                    val list = remember(refresh) { bonded(ctx) }
                    if (list.isEmpty()) T("Nenhum aparelho pareado (ou falta permissão de Bluetooth).", 13f, alpha = 0.5f, maxLines = 2)
                    DeviceList(list)
                }
            }
        }
        Column(Modifier.weight(0.9f).fillMaxHeight().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Panel(Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    T("Adaptador escolhido", 13f, alpha = 0.6f)
                    T(if (type == "demo") "Demonstração" else if (type == "wifi") "${Prefs.wifiHost.v}:${Prefs.wifiPort.v}" else Prefs.obdName.v.ifEmpty { "nenhum" }, 18f)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (Obd.state.value == Obd.ST_OFF) Btn("Conectar", primary = true, enabled = Obd.configured()) { Obd.connect(ctx) }
                        else Btn("Desconectar") { Obd.disconnect() }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Switch(Prefs.obdAuto.state.value, { Prefs.obdAuto.v = it })
                        Spacer(Modifier.width(8.dp))
                        T("Conectar sozinho ao ligar a central", 14f, maxLines = 2)
                    }
                }
            }
            Panel(Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    T("Console (comandos AT / PID)", 13f, alpha = 0.6f)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(console, { console = it.uppercase() }, Modifier.weight(1f), singleLine = true,
                            placeholder = { Text("ex.: ATRV ou 010C") }, textStyle = TextStyle(fontFamily = Display))
                        Btn("Enviar", enabled = Obd.state.value >= Obd.ST_ADAPTER && console.isNotBlank()) {
                            val c = console.trim()
                            scope.launch { consoleOut = "> $c\n" + (Obd.raw(c) ?: "(sem resposta)") }
                        }
                    }
                    if (consoleOut.isNotEmpty()) T(consoleOut, 13f, maxLines = 8)
                }
            }
            T("Funciona com ELM327 Bluetooth clássico, BLE e Wi-Fi. Cada carro informa só parte dos dados; clones muito baratos podem ser lentos.", 12f, alpha = 0.45f, maxLines = 4)
        }
    }
}

@Composable
private fun DeviceList(list: List<Pair<String, String>>) {
    val ctx = LocalContext.current
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        list.forEach { (name, addr) ->
            val sel = Prefs.obdAddr.state.value == addr
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
                    .background(if (sel) accent().copy(alpha = 0.25f) else Color.White.copy(alpha = 0.06f))
                    .clickable {
                        Prefs.obdAddr.v = addr; Prefs.obdName.v = name
                        Obd.connect(ctx)
                    }.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)) { T(name, 16f); T(addr, 11f, alpha = 0.5f) }
                if (sel) T("✓", 20f, accent())
            }
        }
    }
}

@Composable
fun Moving() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            T("⚠", 48f, Color(0xFFFFAB00))
            T("Pare o carro para mexer nos ajustes.", 22f)
            T("Atenção no trânsito.", 16f, alpha = 0.6f)
        }
    }
}

@Composable
fun PerfTab() {
    val src = Live.speedFrom.value
    val running = Performance.running.value
    val armed = Performance.armed.value
    Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Panel(Modifier.fillMaxWidth().weight(1f)) {
                Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                    T(when { running -> "%.2f".format(Performance.elapsed.value); armed -> "Pronto…"; else -> "0.00" }, 64f, if (armed) Color(0xFFFFB300) else accent(), display = true)
                    T("segundos", 14f, alpha = 0.6f)
                    Spacer(Modifier.height(6.dp))
                    T("%.0f km/h   %.0f m".format(Live.speed.floatValue, Performance.distance.value), 18f)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (!running && !armed) Btn("Preparar largada", primary = true) { Performance.arm() }
                else Btn("Cancelar") { Performance.reset() }
                T("Fonte: $src · comece parado e acelere.", 12f, alpha = 0.5f, maxLines = 2)
            }
        }
        Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            val items = listOf(
                "0–60 km/h" to Performance.t0to60.value,
                "0–100 km/h" to Performance.t0to100.value,
                "100–200 km/h" to Performance.t100to200.value,
                "0–200 m" to Performance.t200m.value,
                "0–400 m" to Performance.t400m.value,
            )
            androidx.compose.foundation.lazy.grid.LazyVerticalGrid(
                androidx.compose.foundation.lazy.grid.GridCells.Fixed(2), Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(items.size) { idx ->
                    val (l, v) = items[idx]
                    Panel { Column { T(l, 12f, alpha = 0.6f); T(v?.let { "%.2fs".format(it) } ?: "—", 24f, display = true) } }
                }
                item { Panel { Column { T("Vel. nos 400 m", 12f, alpha = 0.6f); T(if (Performance.v400.value > 0) "%.0f km/h".format(Performance.v400.value) else "—", 24f, display = true) } } }
                item { Panel { Column { T("Reação", 12f, alpha = 0.6f); T(Performance.reaction.value?.let { "%.2fs".format(it) } ?: "—", 24f, display = true) } } }
            }
            if (Performance.bestList.isNotEmpty()) {
                T("Últimas tentativas", 13f, alpha = 0.6f)
                Performance.bestList.take(3).forEach { T("• $it", 13f, alpha = 0.8f, maxLines = 1) }
            }
        }
    }
}

@Composable
fun CompassRose(modifier: Modifier) {
    val ac = accent()
    val h = Gps.heading.floatValue
    androidx.compose.foundation.Canvas(modifier) {
        val c = androidx.compose.ui.geometry.Offset(size.width / 2, size.height / 2)
        val r = size.minDimension / 2 * 0.9f
        drawCircle(Color.White.copy(alpha = 0.08f), r, c, style = Stroke(size.minDimension * 0.03f))
        val dirs = listOf("N" to 0f, "L" to 90f, "S" to 180f, "O" to 270f)
        rotate(if (h >= 0) -h else 0f, c) {
            for ((lbl, ang) in dirs) {
                val a = Math.toRadians((ang - 90).toDouble())
                val p = androidx.compose.ui.geometry.Offset(c.x + (r * 0.78f * kotlin.math.cos(a)).toFloat(), c.y + (r * 0.78f * kotlin.math.sin(a)).toFloat())
                drawCircle(if (lbl == "N") Color(0xFFFF5252) else Color.White.copy(alpha = 0.6f), size.minDimension * 0.035f, p)
            }
            drawLine(ac, androidx.compose.ui.geometry.Offset(c.x, c.y + r * 0.5f), androidx.compose.ui.geometry.Offset(c.x, c.y - r * 0.5f), size.minDimension * 0.04f)
        }
    }
}
