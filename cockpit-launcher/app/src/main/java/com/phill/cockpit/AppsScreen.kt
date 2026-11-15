package com.phill.cockpit

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

@Composable
fun Header(act: MainActivity, title: String, extra: @Composable () -> Unit = {}) {
    Row(Modifier.fillMaxWidth().padding(bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier.size((48 * LocalK.current).dp).clip(RoundedCornerShape(14.dp)).background(Color.White.copy(alpha = 0.1f))
                .clickable { act.screen.value = Screen.Home }.padding(10.dp)
        ) { BackArrow(Modifier.fillMaxSize()) }
        Spacer(Modifier.width(12.dp))
        T(title, 24f, display = true)
        Spacer(Modifier.width(16.dp))
        extra()
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun AppsScreen(act: MainActivity, pickSlot: Int?) {
    val ctx = LocalContext.current
    var q by remember { mutableStateOf("") }
    val apps = Apps.list.value.filter { q.isBlank() || it.label.contains(q, ignoreCase = true) }
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Header(act, if (pickSlot != null) "Escolha o app do botão ${pickSlot + 1}" else "Apps") {
            Box(
                Modifier.weight(1f).clip(RoundedCornerShape(14.dp)).background(Color.White.copy(alpha = 0.08f)).padding(14.dp)
            ) {
                if (q.isEmpty()) T("Buscar app…", 16f, alpha = 0.4f)
                BasicTextField(
                    q, { q = it }, Modifier.fillMaxWidth(), singleLine = true,
                    textStyle = TextStyle(color = Color.White, fontFamily = Body, fontSize = k(16f)),
                    cursorBrush = SolidColor(accent())
                )
            }
            if (pickSlot != null) {
                Spacer(Modifier.width(10.dp))
                Btn("Deixar vazio") { Prefs.slots[pickSlot].v = ""; act.screen.value = Screen.Home }
            }
        }
        if (pickSlot == null) T("Dica: toque e segure num app para ver as informações dele.", 12f, alpha = 0.45f, modifier = Modifier.padding(bottom = 8.dp))
        LazyVerticalGrid(GridCells.Adaptive((112 * LocalK.current).dp), Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            items(apps, key = { it.pkg }) { app ->
                Column(
                    Modifier.clip(RoundedCornerShape(18.dp)).background(Color.White.copy(alpha = 0.05f))
                        .combinedClickable(
                            onClick = {
                                if (pickSlot != null) { Prefs.slots[pickSlot].v = app.pkg; act.screen.value = Screen.Home }
                                else Apps.launch(ctx, app.pkg)
                            },
                            onLongClick = { Apps.details(ctx, app.pkg) }
                        ).padding(10.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Image(app.icon, app.label, Modifier.size((64 * LocalK.current).dp))
                    Spacer(Modifier.size(6.dp))
                    T(app.label, 13f, align = TextAlign.Center, maxLines = 2)
                }
            }
        }
    }
}
