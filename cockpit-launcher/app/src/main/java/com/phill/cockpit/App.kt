package com.phill.cockpit

import android.app.Application
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        Prefs.init(this)
        Apps.load(this)
        Garage.load()
        FuelLog.load()
        Maintenance.load()
        Live.start(this)
        val f = IntentFilter().apply {
            addAction(Intent.ACTION_PACKAGE_ADDED)
            addAction(Intent.ACTION_PACKAGE_REMOVED)
            addAction(Intent.ACTION_PACKAGE_CHANGED)
            addDataScheme("package")
        }
        registerReceiver(object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) = Apps.load(c)
        }, f)
    }
}
