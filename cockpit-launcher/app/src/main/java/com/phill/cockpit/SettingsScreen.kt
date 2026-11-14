package com.phill.cockpit

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.ToneGenerator
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp

@Composable
fun Section(title: String, content: @Composable () -> Unit) {
    Panel(Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            T(title, 18f, accent(), display = true)
            content()
        }
    }
}

@Composable
fun SwitchRow(label: String, p: Prefs.P<Boolean>, sub: String? = null, onChange: (Boolean) -> Unit = {}) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            T(label, 16f, maxLines = 2)
            if (sub != null) T(sub, 12f, alpha = 0.5f, maxLines = 2)
        }
        Switch(p.state.value, { p.v = it; onChange(it) })
    }
}

@Composable
fun SliderRow(label: String, value: Float, range: ClosedFloatingPointRange<Float>, steps: Int = 0, fmt: (Float) -> String, onChange: (Float) -> Unit) {
    Column {
        Row { T(label, 15f, modifier = Modifier.weight(1f)); T(fmt(value), 15f, accent()) }
        Slider(value, onChange, valueRange = range, steps = steps)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SettingsScreen(act: MainActivity) {
    val ctx = LocalContext.current
    if (Live.speed.floatValue > 10f) {
        Column(Modifier.fillMaxSize().padding(16.dp)) { Header(act, "Ajustes"); Moving() }
        return
    }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Header(act, "Ajustes") }

        item {
            Section("Boas-vindas") {
                OutlinedTextField(Prefs.name.state.value, { Prefs.name.v = it }, Modifier.fillMaxWidth(), label = { Text("Seu nome ou do carro") }, singleLine = true)
                OutlinedTextField(Prefs.welcomeText.state.value, { Prefs.welcomeText.v = it }, Modifier.fillMaxWidth(), label = { Text("Frase") }, singleLine = true)
                SwitchRow("Mostrar entrada ao ligar a central", Prefs.greeting)
                Btn("Ver entrada agora") { Live.welcomed = false; act.screen.value = Screen.Settings; act.recreate() }
            }
        }

        item {
            Section("Temas prontos") {
                T("Troque o visual inteiro num toque. Depois dá para ajustar tudo abaixo.", 13f, alpha = 0.6f, maxLines = 2)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    ThemePresets.forEach { p -> ThemeCard(p) }
                }
            }
        }

        item {
            Section("Cores e visual") {
                T("Cor de destaque", 14f, alpha = 0.7f)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Accents.forEach { c ->
                        val sel = Prefs.accent.state.value == c
                        Box(
                            Modifier.size((44 * LocalK.current).dp).clip(CircleShape).background(Color(c))
                                .border(if (sel) 4.dp else 0.dp, Color.White, CircleShape).clickable { Prefs.accent.v = c }
                        )
                    }
                }
                var hue by remember { mutableFloatStateOf(0f) }
                SliderRow("Cor livre (arraste)", hue, 0f..360f, fmt = { "" }) { hue = it; Prefs.accent.v = Color.hsv(it, 0.9f, 1f).toArgb() }
                T("Fundo", 14f, alpha = 0.7f)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    BgStyles.forEach { s -> Pill(s.name, Prefs.bgStyle.state.value == s.id && Prefs.wallpaper.state.value.isBlank()) { Prefs.bgStyle.v = s.id; Prefs.wallpaper.v = "" } }
                }
                SwitchRow("Fundo em movimento", Prefs.animatedBg, "Desligue se a central for lenta")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Btn("Usar foto de fundo") { act.wallLauncher.launch(arrayOf("image/*")) }
                    if (Prefs.wallpaper.state.value.isNotBlank()) Btn("Remover foto") { Prefs.wallpaper.v = "" }
                }
                if (Prefs.wallpaper.state.value.isNotBlank())
                    SliderRow("Escurecer foto", Prefs.wallDim.state.value, 0f..0.9f, fmt = { "%.0f%%".format(it * 100) }) { Prefs.wallDim.v = it }
                T("Estilo dos botões", 14f, alpha = 0.7f)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("glass" to "Vidro", "solid" to "Sólido", "outline" to "Contorno").forEach { (id, n) ->
                        Pill(n, Prefs.tileStyle.state.value == id) { Prefs.tileStyle.v = id }
                    }
                }
                SliderRow("Transparência dos painéis", Prefs.panelAlpha.state.value, 0f..0.3f, fmt = { "%.0f%%".format(it * 100 / 0.3f) }) { Prefs.panelAlpha.v = it }
                SwitchRow("Relógio 24 horas", Prefs.clock24)
                SwitchRow("Tela cheia (esconde barras do Android)", Prefs.fullscreen) { act.applyFullscreen() }
            }
        }

        item {
            Section("Controle pelo celular (Wi-Fi)") {
                T("Ligue, conecte o celular na mesma rede e abra o endereço no navegador dele. Dá para controlar a música e mandar um destino que abre o Waze aqui na central.", 13f, alpha = 0.65f, maxLines = 4)
                SwitchRow("Ativar controle pelo celular", Prefs.remoteEnabled) { RemoteServer.ensure(ctx) }
                if (RemoteServer.running.value) {
                    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(accent().copy(alpha = 0.12f)).padding(14.dp)) {
                        Column {
                            T("No navegador do celular, digite:", 12f, alpha = 0.6f)
                            T(RemoteServer.url.value, 24f, accent(), display = true)
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Btn("Copiar endereço") {
                            (ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("url", RemoteServer.url.value))
                            Toast.makeText(ctx, "Copiado", Toast.LENGTH_SHORT).show()
                        }
                        Btn("Rede Wi-Fi") { Apps.open(ctx, Intent(Settings.ACTION_WIFI_SETTINGS)) }
                    }
                } else if (Prefs.remoteEnabled.state.value) {
                    T("Procurando a rede… conecte a central ao Wi-Fi.", 13f, alpha = 0.6f)
                }
                var pin by remember { mutableStateOf(Prefs.remotePin.v) }
                OutlinedTextField(pin, { pin = it.filter { c -> c.isDigit() }.take(6); Prefs.remotePin.v = pin },
                    label = { Text("PIN (opcional, protege o controle)") }, singleLine = true)
                T("Qualquer um na mesma rede consegue controlar. Prefira o ponto de acesso do celular, ou defina um PIN.", 12f, alpha = 0.5f, maxLines = 3)
            }
        }

        item {
            Section("Velocidade") {
                SliderRow("Aviso sonoro acima de", Prefs.speedLimit.state.value.toFloat(), 0f..180f, steps = 35,
                    fmt = { if (it < 1) "desligado" else "%.0f km/h".format(it) }) { Prefs.speedLimit.v = it.toInt() }
                SliderRow("Volume do aviso", Prefs.beepVolume.state.value.toFloat(), 10f..100f, fmt = { "%.0f%%".format(it) }) { Prefs.beepVolume.v = it.toInt() }
                Btn("Testar aviso") {
                    try { ToneGenerator(AudioManager.STREAM_MUSIC, Prefs.beepVolume.v).startTone(ToneGenerator.TONE_PROP_BEEP2, 500) } catch (e: Exception) { }
                }
                T("Fonte da velocidade", 14f, alpha = 0.7f)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("auto" to "Automática", "gps" to "GPS", "obd" to "OBD2").forEach { (id, n) -> Pill(n, Prefs.speedSource.state.value == id) { Prefs.speedSource.v = id } }
                }
            }
        }

        item {
            Section("Combustível (consumo e custo)") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("gasolina" to "Gasolina", "etanol" to "Etanol", "diesel" to "Diesel").forEach { (id, n) -> Pill(n, Prefs.fuel.state.value == id) { Prefs.fuel.v = id } }
                }
                var price by remember { mutableStateOf("%.2f".format(Prefs.fuelPrice.v)) }
                OutlinedTextField(price, { price = it; it.replace(',', '.').toFloatOrNull()?.let { p -> Prefs.fuelPrice.v = p } },
                    label = { Text("Preço do litro (R$)") }, singleLine = true)
                SliderRow("Cilindrada do motor", Prefs.displacement.state.value, 1.0f..5.0f, steps = 39, fmt = { "%.1f L".format(it) }) { Prefs.displacement.v = it }
                T("A cilindrada só é usada em carros sem sensor MAF. O consumo é uma estimativa (margem de 10–15%).", 12f, alpha = 0.5f, maxLines = 3)
            }
        }

        item {
            Section("Brilho automático (dia / noite)") {
                SwitchRow("Mudar brilho no nascer e no pôr do sol", Prefs.autoBright, "Usa o horário do sol da sua cidade") {
                    if (it && !Live.canWriteSettings(ctx)) openWriteSettings(ctx) else Live.applyBrightness(ctx, true)
                }
                SliderRow("Brilho de dia", Prefs.brightDay.state.value.toFloat(), 5f..255f, fmt = { "%.0f%%".format(it / 2.55f) }) { Prefs.brightDay.v = it.toInt() }
                SliderRow("Brilho à noite", Prefs.brightNight.state.value.toFloat(), 5f..255f, fmt = { "%.0f%%".format(it / 2.55f) }) { Prefs.brightNight.v = it.toInt() }
                if (!Live.canWriteSettings(ctx)) Btn("Permitir alterar o brilho") { openWriteSettings(ctx) }
            }
        }

        item {
            Section("Permissões e sistema") {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Btn(if (Gps.hasPermission(ctx)) "Localização ✓" else "Liberar localização") { act.requestLocation() }
                    Btn(if (Media.hasAccess.value) "Acesso à música ✓" else "Liberar capa e faixa da música") {
                        Apps.open(ctx, Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS), Intent(Settings.ACTION_SETTINGS))
                    }
                    Btn("Liberar Bluetooth") { act.requestBluetooth() }
                    Btn("Definir como tela inicial", primary = true) { Apps.open(ctx, Intent(Settings.ACTION_HOME_SETTINGS), Intent(Settings.ACTION_SETTINGS)) }
                    Btn("Informações do app") { Apps.details(ctx, ctx.packageName) }
                }
                if (Build.VERSION.SDK_INT >= 33)
                    T("Se o acesso à música estiver bloqueado: Informações do app → ⋮ → \"Permitir configurações restritas\" e tente de novo.", 12f, alpha = 0.5f, maxLines = 3)
            }
        }

        item {
            Section("Tema por código") {
                val code = Prefs.exportCode()
                T("Passe sua tela (cores, fundo, botões) para um amigo:", 14f, alpha = 0.7f)
                T(code, 12f, maxLines = 3)
                Btn("Copiar código") {
                    (ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("tema", code))
                    Toast.makeText(ctx, "Código copiado", Toast.LENGTH_SHORT).show()
                }
                var imp by remember { mutableStateOf("") }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(imp, { imp = it }, Modifier.weight(1f), label = { Text("Colar código de um amigo") }, singleLine = true)
                    Spacer(Modifier.width(8.dp))
                    Btn("Aplicar", primary = true, enabled = imp.isNotBlank()) {
                        Toast.makeText(ctx, if (Prefs.importCode(imp)) "Tema aplicado!" else "Código inválido", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }

        item {
            Section("Sobre") {
                T("Cockpit Launcher 1.0 — grátis, sem licença, sem anúncios e sem coleta de dados.", 14f, maxLines = 3)
                T("Clima: Open-Meteo. Fontes: Chakra Petch e Exo 2 (SIL Open Font License).", 12f, alpha = 0.5f, maxLines = 2)
                T("Personalize com o carro parado e mantenha a atenção no trânsito.", 12f, alpha = 0.5f, maxLines = 2)
            }
        }
    }
}

private fun openWriteSettings(ctx: Context) {
    if (Build.VERSION.SDK_INT >= 23)
        Apps.open(ctx, Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS, Uri.parse("package:${ctx.packageName}")))
}

@Composable
fun ThemeCard(p: ThemePreset) {
    val style = BgStyles.firstOrNull { it.id == p.bg } ?: BgStyles[0]
    val sel = Prefs.bgStyle.state.value == p.bg && Prefs.accent.state.value == p.accent.toInt()
    val ac = Color(p.accent)
    Column(
        Modifier.width((132 * LocalK.current).dp).clip(RoundedCornerShape(16.dp))
            .border(if (sel) 3.dp else 1.dp, if (sel) ac else Color.White.copy(alpha = 0.15f), RoundedCornerShape(16.dp))
            .clickable { applyPreset(p) }
    ) {
        Box(
            Modifier.fillMaxWidth().height((70 * LocalK.current).dp)
                .background(androidx.compose.ui.graphics.Brush.verticalGradient(listOf(style.top, style.bottom)))
        ) {
            if (style.glow != null) Box(
                Modifier.fillMaxWidth().height((28 * LocalK.current).dp)
                    .background(androidx.compose.ui.graphics.Brush.verticalGradient(listOf(style.glow.copy(alpha = 0.35f), Color.Transparent)))
            )
            Box(Modifier.align(Alignment.Center).size((30 * LocalK.current).dp).clip(CircleShape).background(Color.White.copy(alpha = 0.10f)).border(1.dp, ac.copy(alpha = 0.4f), CircleShape))
            Box(Modifier.align(Alignment.BottomStart).padding(8.dp).size((14 * LocalK.current).dp).clip(CircleShape).background(ac))
            if (sel) Box(Modifier.align(Alignment.TopEnd).padding(6.dp)) { T("✓", 14f, ac) }
        }
        Box(Modifier.fillMaxWidth().background(Color.Black.copy(alpha = 0.25f)).padding(vertical = 6.dp), contentAlignment = Alignment.Center) {
            T(p.name, 13f)
        }
    }
}
