package com.phill.cockpit

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val garageTabs = listOf("Garagem", "Abastecer", "Manutenção")
private var lastGarageTab = 0
private val df = SimpleDateFormat("dd/MM/yy", Locale("pt", "BR"))

@Composable
fun GarageScreen(act: MainActivity) {
    var tab by remember { mutableStateOf(lastGarageTab) }
    val odo = Prefs.odometer.state.value
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Header(act, "Meu carro") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                garageTabs.forEachIndexed { i, t ->
                    val badge = if (i == 2) Maintenance.alerts(odo) else 0
                    Pill(if (badge > 0) "$t ($badge)" else t, tab == i) { tab = i; lastGarageTab = i }
                }
            }
        }
        Box(Modifier.weight(1f).fillMaxWidth()) {
            when (tab) { 0 -> GarageTab(); 1 -> FuelTab(); else -> MaintTab() }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun GarageTab() {
    val ac = accent()
    var type by remember { mutableStateOf(Prefs.carType.v) }
    var color by remember { mutableStateOf(Prefs.carColor.v) }
    var variant by remember { mutableStateOf(Prefs.carVariant.v) }
    Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Column(Modifier.weight(1.1f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Panel(Modifier.fillMaxWidth().weight(1f)) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CarView(Modifier.fillMaxWidth(0.95f).fillMaxHeight(), type, Color(color), variant, ac)
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
                        T(CarTypes.first { it.id == type }.name + " · " + CarVariants.first { it.first == variant }.second, 14f, alpha = 0.6f)
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Btn("Usar na tela inicial", primary = true) {
                    Prefs.carType.v = type; Prefs.carColor.v = color; Prefs.carVariant.v = variant; Prefs.showCar.v = true
                }
                Btn("Salvar na garagem") {
                    Garage.add(SavedCar(type, color, variant, CarTypes.first { it.id == type }.name))
                }
            }
        }
        Column(Modifier.weight(1f).fillMaxHeight().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            T("Modelo", 14f, alpha = 0.7f)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                CarTypes.forEach { ct -> Pill(ct.name, type == ct.id) { type = ct.id } }
            }
            if (type == "photo") T("É a foto do seu carro (fundo removido). A cor e a postura abaixo valem para os carros desenhados.", 12f, alpha = 0.6f, maxLines = 3)
            T("Cor da lataria", 14f, alpha = 0.7f)
            T("Vidros, rodas e faróis continuam originais.", 12f, alpha = 0.45f)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                CarColors.forEach { c ->
                    val sel = color == c
                    Box(
                        Modifier.size((44 * LocalK.current).dp).clip(CircleShape).background(Color(c))
                            .border(if (sel) 4.dp else 1.dp, if (sel) Color.White else Color.White.copy(alpha = 0.3f), CircleShape)
                            .clickable { color = c }
                    )
                }
            }
            T("Postura", 14f, alpha = 0.7f)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CarVariants.forEach { (id, n) -> Pill(n, variant == id) { variant = id } }
            }
            if (Garage.cars.isNotEmpty()) {
                T("Minha garagem", 14f, alpha = 0.7f)
                Garage.cars.forEachIndexed { i, sc ->
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color.White.copy(alpha = 0.05f)).padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CarView(Modifier.width((90 * LocalK.current).dp).height((46 * LocalK.current).dp), sc.type, Color(sc.color), sc.variant, ac)
                        Spacer(Modifier.width(8.dp))
                        Column(Modifier.weight(1f).clickable { type = sc.type; color = sc.color; variant = sc.variant }) {
                            T(sc.name, 15f); T(CarVariants.first { it.first == sc.variant }.second, 12f, alpha = 0.5f)
                        }
                        Box(Modifier.clip(CircleShape).clickable { Garage.remove(i) }.padding(8.dp)) { T("✕", 16f, alpha = 0.6f) }
                    }
                }
            }
        }
    }
}

@Composable
fun FuelTab() {
    val ctx = LocalContext.current
    var liters by remember { mutableStateOf("") }
    var price by remember { mutableStateOf("%.2f".format(Prefs.fuelPrice.v)) }
    var odo by remember { mutableStateOf("%.0f".format(Prefs.odometer.v)) }
    var full by remember { mutableStateOf(true) }
    Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Column(Modifier.weight(1f).fillMaxHeight().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Section("Novo abastecimento") {
                OutlinedTextField(odo, { odo = it }, Modifier.fillMaxWidth(), label = { Text("Odômetro (km)") }, singleLine = true)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(liters, { liters = it }, Modifier.weight(1f), label = { Text("Litros") }, singleLine = true)
                    OutlinedTextField(price, { price = it }, Modifier.weight(1f), label = { Text("R$/L") }, singleLine = true)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Switch(full, { full = it }); Spacer(Modifier.width(8.dp)); T("Tanque cheio (para calcular o consumo)", 13f, maxLines = 2)
                }
                val l = liters.replace(',', '.').toFloatOrNull(); val p = price.replace(',', '.').toFloatOrNull(); val o = odo.replace(',', '.').toFloatOrNull()
                if (l != null && p != null) T("Total: R$ %.2f".format(l * p), 16f, accent())
                Btn("Registrar", primary = true, enabled = l != null && p != null && o != null && l > 0) {
                    FuelLog.add(Fuel(System.currentTimeMillis(), o!!, l!!, p!!, full))
                    Prefs.fuelPrice.v = p; liters = ""
                }
            }
            Section("Resumo") {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Stat(FuelLog.avgKml()?.let { "%.1f".format(it) } ?: "—", "km/l médio")
                    Stat(FuelLog.costPerKm()?.let { "R$ %.2f".format(it) } ?: "—", "por km")
                    Stat("R$ %.0f".format(FuelLog.totalSpent()), "total gasto")
                }
            }
        }
        Column(Modifier.weight(1f).fillMaxHeight()) {
            T("Histórico", 15f, alpha = 0.7f, modifier = Modifier.padding(bottom = 8.dp))
            if (FuelLog.list.isEmpty()) T("Nenhum abastecimento ainda.", 13f, alpha = 0.5f)
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                itemsIndexed(FuelLog.list) { i, f ->
                    Panel(Modifier.fillMaxWidth()) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                T("%.1f L · R$ %.2f".format(f.liters, f.total), 16f)
                                T("${df.format(Date(f.date))} · %.0f km".format(f.odo) + if (f.full) "" else " · parcial", 12f, alpha = 0.55f)
                            }
                            FuelLog.kmlFor(i)?.let { T("%.1f km/l".format(it), 18f, accent(), display = true) }
                            Spacer(Modifier.width(8.dp))
                            Box(Modifier.clip(CircleShape).clickable { FuelLog.remove(f) }.padding(6.dp)) { T("✕", 14f, alpha = 0.5f) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun MaintTab() {
    val odo = Prefs.odometer.state.value
    var adding by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            T("Odômetro atual: %.0f km".format(odo), 15f, alpha = 0.7f, modifier = Modifier.weight(1f))
            Btn(if (adding) "Fechar" else "+ Novo lembrete") { adding = !adding }
        }
        if (adding) { Spacer(Modifier.height(10.dp)); AddMaint(odo) { adding = false } }
        Spacer(Modifier.height(10.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(Maintenance.list.sortedBy { it.status(odo) }) { m ->
                val st = m.status(odo)
                val col = when (st) { -1 -> Color(0xFFFF5252); 0 -> Color(0xFFFFB300); else -> Color(0xFF00E676) }
                Panel(Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(12.dp).clip(CircleShape).background(col))
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            T(m.name, 17f)
                            val parts = buildList {
                                m.kmLeft(odo)?.let { add(if (it <= 0) "vencido há %.0f km".format(-it) else "faltam %.0f km".format(it)) }
                                m.daysLeft()?.let { add(if (it <= 0) "vencido há ${-it} dias" else "faltam $it dias") }
                            }
                            T(parts.joinToString(" · ").ifEmpty { "sem prazo" }, 12f, alpha = 0.6f, maxLines = 2)
                        }
                        Btn("Feito") { Maintenance.done(m, odo) }
                        Spacer(Modifier.width(6.dp))
                        Box(Modifier.clip(CircleShape).clickable { Maintenance.remove(m) }.padding(8.dp)) { T("✕", 14f, alpha = 0.5f) }
                    }
                }
            }
        }
    }
}

@Composable
private fun AddMaint(odo: Float, onDone: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var km by remember { mutableStateOf("") }
    var months by remember { mutableStateOf("") }
    Panel(Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(name, { name = it }, Modifier.fillMaxWidth(), label = { Text("Nome (ex.: Troca de óleo)") }, singleLine = true)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(km, { km = it }, Modifier.weight(1f), label = { Text("A cada km") }, singleLine = true)
                OutlinedTextField(months, { months = it }, Modifier.weight(1f), label = { Text("A cada meses") }, singleLine = true)
            }
            Btn("Adicionar", primary = true, enabled = name.isNotBlank() && (km.toIntOrNull() ?: 0) + (months.toIntOrNull() ?: 0) > 0) {
                Maintenance.add(Maint(System.currentTimeMillis(), name.trim(), km.toIntOrNull() ?: 0, months.toIntOrNull() ?: 0, odo, System.currentTimeMillis()))
                onDone()
            }
        }
    }
}
