package com.phill.cockpit

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import android.os.SystemClock
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.core.content.ContextCompat

object Gps : LocationListener {
    val speedKmh = mutableFloatStateOf(0f)
    val hasFix = mutableStateOf(false)
    val location = mutableStateOf<Location?>(null)
    val heading = androidx.compose.runtime.mutableFloatStateOf(-1f)
    val altitude = mutableStateOf<Double?>(null)
    private var lastFixAt = 0L
    private var started = false

    fun hasPermission(c: Context) =
        ContextCompat.checkSelfPermission(c, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(c, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    @SuppressLint("MissingPermission")
    fun start(c: Context) {
        if (started || !hasPermission(c)) return
        val lm = c.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        try {
            if (lm.allProviders.contains(LocationManager.GPS_PROVIDER))
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, this, Looper.getMainLooper())
            if (lm.allProviders.contains(LocationManager.NETWORK_PROVIDER))
                lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 120_000L, 200f, this, Looper.getMainLooper())
            val last = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER)
                .mapNotNull { p -> try { lm.getLastKnownLocation(p) } catch (e: Exception) { null } }
                .maxByOrNull { it.time }
            if (last != null && location.value == null) location.value = last
            started = true
        } catch (e: Exception) { }
    }

    /** Chamado a cada segundo: zera a velocidade se o GPS parou de responder. */
    fun tick() {
        if (SystemClock.elapsedRealtime() - lastFixAt > 5000) {
            hasFix.value = false
            speedKmh.floatValue = 0f
        }
    }

    override fun onLocationChanged(l: Location) {
        location.value = l
        if (l.hasAltitude()) altitude.value = l.altitude
        if (l.hasBearing() && (l.hasSpeed() && l.speed > 1.5f)) heading.floatValue = l.bearing
        if (l.provider == LocationManager.GPS_PROVIDER) {
            lastFixAt = SystemClock.elapsedRealtime()
            hasFix.value = true
            val s = if (l.hasSpeed()) l.speed * 3.6f else 0f
            speedKmh.floatValue = if (s < 2f) 0f else s
        }
    }

    // Obrigatórios em Android 7–10 (sem implementação padrão lá).
    @Deprecated("") override fun onStatusChanged(p: String?, s: Int, e: Bundle?) {}
    override fun onProviderEnabled(p: String) {}
    override fun onProviderDisabled(p: String) {}
}
