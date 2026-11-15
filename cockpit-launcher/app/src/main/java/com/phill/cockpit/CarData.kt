package com.phill.cockpit

import android.os.SystemClock
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import org.json.JSONArray
import org.json.JSONObject

// ---------------- Garagem salva ----------------

data class SavedCar(val type: String, val color: Int, val variant: String, val name: String)

object Garage {
    val cars = mutableStateListOf<SavedCar>()

    fun load() {
        cars.clear()
        val a = JSONArray(Prefs.garageJson.v)
        for (i in 0 until a.length()) {
            val o = a.getJSONObject(i)
            cars += SavedCar(o.getString("t"), o.getInt("c"), o.optString("v", "original"), o.optString("n", ""))
        }
    }

    private fun save() {
        val a = JSONArray()
        cars.forEach { a.put(JSONObject().put("t", it.type).put("c", it.color).put("v", it.variant).put("n", it.name)) }
        Prefs.garageJson.v = a.toString()
    }

    fun add(c: SavedCar) { cars.add(0, c); save() }
    fun remove(i: Int) { if (i in cars.indices) { cars.removeAt(i); save() } }
}

// ---------------- Abastecimentos ----------------

data class Fuel(val date: Long, val odo: Float, val liters: Float, val price: Float, val full: Boolean) {
    val total get() = liters * price
}

object FuelLog {
    val list = mutableStateListOf<Fuel>()

    fun load() {
        list.clear()
        val a = JSONArray(Prefs.fuelJson.v)
        for (i in 0 until a.length()) {
            val o = a.getJSONObject(i)
            list += Fuel(o.getLong("d"), o.getDouble("o").toFloat(), o.getDouble("l").toFloat(), o.getDouble("p").toFloat(), o.optBoolean("f", true))
        }
        list.sortByDescending { it.odo }
    }

    private fun save() {
        val a = JSONArray()
        list.forEach { a.put(JSONObject().put("d", it.date).put("o", it.odo.toDouble()).put("l", it.liters.toDouble()).put("p", it.price.toDouble()).put("f", it.full)) }
        Prefs.fuelJson.v = a.toString()
    }

    fun add(f: Fuel) {
        list.add(f); list.sortByDescending { it.odo }; save()
        if (f.odo > Prefs.odometer.v) Prefs.odometer.v = f.odo
    }

    fun remove(f: Fuel) { list.remove(f); save() }

    /** Consumo (km/l) entre dois abastecimentos cheios consecutivos. */
    fun kmlFor(index: Int): Float? {
        val sorted = list.sortedBy { it.odo }
        val pos = sorted.indexOf(list.sortedByDescending { it.odo }[index])
        if (pos <= 0) return null
        val cur = sorted[pos]; val prev = sorted[pos - 1]
        val dist = cur.odo - prev.odo
        return if (cur.full && dist > 1 && cur.liters > 0.1f) dist / cur.liters else null
    }

    fun avgKml(): Float? {
        val sorted = list.sortedBy { it.odo }
        if (sorted.size < 2) return null
        val dist = sorted.last().odo - sorted.first().odo
        val liters = sorted.drop(1).filter { it.full }.sumOf { it.liters.toDouble() }.toFloat()
        return if (dist > 1 && liters > 0.1f) dist / liters else null
    }

    fun totalSpent() = list.sumOf { it.total.toDouble() }.toFloat()
    fun costPerKm(): Float? {
        val sorted = list.sortedBy { it.odo }
        if (sorted.size < 2) return null
        val dist = sorted.last().odo - sorted.first().odo
        val spent = sorted.drop(1).sumOf { it.total.toDouble() }.toFloat()
        return if (dist > 1) spent / dist else null
    }
}

// ---------------- Manutenção ----------------

data class Maint(val id: Long, val name: String, val everyKm: Int, val everyMonths: Int, val lastKm: Float, val lastDate: Long) {
    fun dueKm() = if (everyKm > 0) lastKm + everyKm else null
    fun kmLeft(odo: Float) = dueKm()?.let { it - odo }
    fun dueDate() = if (everyMonths > 0) lastDate + everyMonths * 30L * 86400_000L else null
    fun daysLeft() = dueDate()?.let { ((it - System.currentTimeMillis()) / 86400_000L).toInt() }
    /** -1 vencido, 0 perto, 1 ok */
    fun status(odo: Float): Int {
        val k = kmLeft(odo); val d = daysLeft()
        if ((k != null && k <= 0) || (d != null && d <= 0)) return -1
        if ((k != null && k <= 500) || (d != null && d <= 15)) return 0
        return 1
    }
}

object Maintenance {
    val list = mutableStateListOf<Maint>()

    fun load() {
        list.clear()
        val a = JSONArray(Prefs.maintJson.v)
        for (i in 0 until a.length()) {
            val o = a.getJSONObject(i)
            list += Maint(o.getLong("id"), o.getString("n"), o.getInt("km"), o.getInt("mo"), o.getDouble("lk").toFloat(), o.getLong("ld"))
        }
        if (a.length() == 0) seed()
    }

    private fun seed() {
        val odo = Prefs.odometer.v; val now = System.currentTimeMillis()
        listOf(
            Triple("Troca de óleo", 10000, 12),
            Triple("Filtro de ar", 15000, 12),
            Triple("Filtro de combustível", 20000, 24),
            Triple("Rodízio de pneus", 10000, 0),
            Triple("Velas", 40000, 0),
        ).forEach { (n, km, mo) -> list += Maint(now + n.hashCode(), n, km, mo, odo, now) }
        save()
    }

    private fun save() {
        val a = JSONArray()
        list.forEach { a.put(JSONObject().put("id", it.id).put("n", it.name).put("km", it.everyKm).put("mo", it.everyMonths).put("lk", it.lastKm.toDouble()).put("ld", it.lastDate)) }
        Prefs.maintJson.v = a.toString()
    }

    fun add(m: Maint) { list.add(m); save() }
    fun remove(m: Maint) { list.remove(m); save() }
    fun done(m: Maint, odo: Float) {
        val i = list.indexOf(m); if (i < 0) return
        list[i] = m.copy(lastKm = odo, lastDate = System.currentTimeMillis()); save()
    }

    fun alerts(odo: Float) = list.count { it.status(odo) <= 0 }
}

// ---------------- Desempenho (0–100, 0–400 m) ----------------

object Performance {
    val running = mutableStateOf(false)
    val armed = mutableStateOf(false)
    val elapsed = mutableStateOf(0f)        // s desde a largada
    val distance = mutableStateOf(0f)       // m
    val t0to100 = mutableStateOf<Float?>(null)
    val t0to60 = mutableStateOf<Float?>(null)
    val t100to200 = mutableStateOf<Float?>(null)
    val t400m = mutableStateOf<Float?>(null)
    val v400 = mutableStateOf(0f)
    val t200m = mutableStateOf<Float?>(null)
    val reaction = mutableStateOf<Float?>(null)
    val peakG = mutableStateOf(0f)

    val bestList = mutableStateListOf<String>()

    private var startAt = 0L
    private var armAt = 0L
    private var lastT = 0L
    private var lastV = 0f
    private var at100 = 0f

    fun arm() {
        reset(); armed.value = true; armAt = SystemClock.elapsedRealtime()
    }

    fun reset() {
        running.value = false; armed.value = false
        elapsed.value = 0f; distance.value = 0f; peakG.value = 0f
        t0to100.value = null; t0to60.value = null; t100to200.value = null
        t400m.value = null; t200m.value = null; reaction.value = null; v400.value = 0f
        lastV = 0f
    }

    /** Chamado a cada segundo pelo Live com a velocidade (km/h). */
    fun tick(speed: Float, dt: Float) {
        val now = SystemClock.elapsedRealtime()
        if (armed.value && !running.value) {
            if (speed > 2f) {
                running.value = true; armed.value = false
                startAt = now; lastT = now; lastV = speed
                reaction.value = (now - armAt) / 1000f
            }
            return
        }
        if (!running.value) return
        elapsed.value = (now - startAt) / 1000f
        val v = speed
        distance.value += (v + lastV) / 2f / 3.6f * dt
        val a = (v - lastV) / 3.6f / dt
        peakG.value = maxOf(peakG.value, a / 9.81f)
        if (t0to60.value == null && v >= 60f) t0to60.value = elapsed.value
        if (t0to100.value == null && v >= 100f) { t0to100.value = elapsed.value; at100 = elapsed.value }
        if (t100to200.value == null && v >= 200f && at100 > 0) t100to200.value = elapsed.value - at100
        if (t200m.value == null && distance.value >= 200f) t200m.value = elapsed.value
        if (t400m.value == null && distance.value >= 400f) { t400m.value = elapsed.value; v400.value = v; finish() }
        lastV = v; lastT = now
        if (elapsed.value > 60f) finish()
    }

    private fun finish() {
        if (!running.value) return
        running.value = false
        val r = buildString {
            t0to100.value?.let { append("0–100: %.2fs  ".format(it)) }
            t400m.value?.let { append("400m: %.2fs @ %.0f km/h".format(it, v400.value)) }
        }.trim()
        if (r.isNotEmpty()) { bestList.add(0, r); while (bestList.size > 8) bestList.removeAt(bestList.size - 1) }
    }
}
