package com.phill.cockpit

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.widget.Toast
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.core.graphics.drawable.toBitmap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

data class AppInfo(val label: String, val pkg: String, val icon: ImageBitmap)

object Apps {
    val list = mutableStateOf<List<AppInfo>>(emptyList())
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun load(ctx: Context) {
        val app = ctx.applicationContext
        scope.launch {
            val pm = app.packageManager
            val i = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
            val res = pm.queryIntentActivities(i, 0)
                .filter { it.activityInfo.packageName != app.packageName }
                .distinctBy { it.activityInfo.packageName }
                .mapNotNull { ri ->
                    try {
                        AppInfo(
                            ri.loadLabel(pm).toString(),
                            ri.activityInfo.packageName,
                            ri.loadIcon(pm).toBitmap(128, 128).asImageBitmap()
                        )
                    } catch (e: Exception) { null }
                }
                .sortedBy { it.label.lowercase() }
            list.value = res
        }
    }

    fun find(pkg: String): AppInfo? = list.value.firstOrNull { it.pkg == pkg }

    fun launch(ctx: Context, pkg: String) {
        val i = ctx.packageManager.getLaunchIntentForPackage(pkg)
        if (i == null) {
            Toast.makeText(ctx, "App não instalado", Toast.LENGTH_SHORT).show()
            return
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
        try { ctx.startActivity(i) } catch (e: Exception) {
            Toast.makeText(ctx, "Não foi possível abrir", Toast.LENGTH_SHORT).show()
        }
    }

    fun details(ctx: Context, pkg: String) {
        open(ctx, Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg")))
    }

    fun open(ctx: Context, vararg intents: Intent) {
        for (i in intents) {
            try {
                ctx.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); return
            } catch (e: ActivityNotFoundException) { } catch (e: SecurityException) { }
        }
        Toast.makeText(ctx, "Esta central não tem essa tela", Toast.LENGTH_SHORT).show()
    }
}
