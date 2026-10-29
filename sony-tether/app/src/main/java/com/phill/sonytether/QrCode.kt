package com.phill.sonytether

import android.graphics.Bitmap
import android.graphics.Color

/**
 * Gerador de QR code (modo byte, correção de erro nível M, versões 1 a 10: até 213 bytes),
 * suficiente para o endereço da galeria. Segue a norma ISO 18004, no mesmo caminho do
 * gerador de referência de Project Nayuki.
 */
class QrCode private constructor(val version: Int) {
    val size = version * 4 + 17
    private val modules = Array(size) { BooleanArray(size) }
    private val function = Array(size) { BooleanArray(size) }

    /** true = módulo escuro. [x] é a coluna e [y] a linha. */
    fun get(x: Int, y: Int) = modules[y][x]

    /** Imagem com [scale] pixels por módulo e a margem branca de 4 módulos que a norma pede. */
    fun toBitmap(scale: Int): Bitmap {
        val side = (size + 8) * scale
        val pixels = IntArray(side * side) { Color.WHITE }
        for (y in 0 until size) for (x in 0 until size) if (modules[y][x]) {
            for (dy in 0 until scale) {
                val row = ((y + 4) * scale + dy) * side + (x + 4) * scale
                pixels.fill(Color.BLACK, row, row + scale)
            }
        }
        return Bitmap.createBitmap(pixels, side, side, Bitmap.Config.ARGB_8888)
    }

    private fun set(x: Int, y: Int, dark: Boolean) {
        modules[y][x] = dark
        function[y][x] = true
    }

    private fun drawFunctionPatterns() {
        for (i in 0 until size) {
            set(6, i, i % 2 == 0)
            set(i, 6, i % 2 == 0)
        }
        drawFinder(3, 3)
        drawFinder(size - 4, 3)
        drawFinder(3, size - 4)
        val align = alignmentPositions(version)
        val last = align.size - 1
        for (i in align.indices) for (j in align.indices) {
            if ((i == 0 && j == 0) || (i == 0 && j == last) || (i == last && j == 0)) continue
            for (dy in -2..2) for (dx in -2..2) set(align[i] + dx, align[j] + dy, maxOf(Math.abs(dx), Math.abs(dy)) != 1)
        }
        drawFormatBits(0) // reserva a área; o valor certo entra depois de escolher a máscara
        drawVersion()
    }

    private fun drawFinder(cx: Int, cy: Int) {
        for (dy in -4..4) for (dx in -4..4) {
            val x = cx + dx
            val y = cy + dy
            if (x !in 0 until size || y !in 0 until size) continue
            val dist = maxOf(Math.abs(dx), Math.abs(dy))
            set(x, y, dist != 2 && dist != 4)
        }
    }

    private fun drawFormatBits(mask: Int) {
        val data = (EC_LEVEL_M_BITS shl 3) or mask
        var rem = data
        repeat(10) { rem = (rem shl 1) xor ((rem ushr 9) * 0x537) }
        val bits = ((data shl 10) or rem) xor 0x5412
        fun bit(i: Int) = (bits ushr i) and 1 != 0

        for (i in 0..5) set(8, i, bit(i))
        set(8, 7, bit(6))
        set(8, 8, bit(7))
        set(7, 8, bit(8))
        for (i in 9..14) set(14 - i, 8, bit(i))

        for (i in 0..7) set(size - 1 - i, 8, bit(i))
        for (i in 8..14) set(8, size - 15 + i, bit(i))
        set(8, size - 8, true)
    }

    private fun drawVersion() {
        if (version < 7) return
        var rem = version
        repeat(12) { rem = (rem shl 1) xor ((rem ushr 11) * 0x1F25) }
        val bits = (version shl 12) or rem
        for (i in 0..17) {
            val dark = (bits ushr i) and 1 != 0
            val a = size - 11 + i % 3
            val b = i / 3
            set(a, b, dark)
            set(b, a, dark)
        }
    }

    private fun drawCodewords(data: ByteArray) {
        var i = 0
        var right = size - 1
        while (right >= 1) {
            if (right == 6) right = 5
            for (vert in 0 until size) for (j in 0..1) {
                val x = right - j
                val upward = (right + 1) and 2 == 0
                val y = if (upward) size - 1 - vert else vert
                if (!function[y][x] && i < data.size * 8) {
                    modules[y][x] = (data[i ushr 3].toInt() ushr (7 - (i and 7))) and 1 != 0
                    i++
                }
            }
            right -= 2
        }
    }

    private fun applyMask(mask: Int) {
        for (y in 0 until size) for (x in 0 until size) {
            val invert = when (mask) {
                0 -> (x + y) % 2 == 0
                1 -> y % 2 == 0
                2 -> x % 3 == 0
                3 -> (x + y) % 3 == 0
                4 -> (x / 3 + y / 2) % 2 == 0
                5 -> x * y % 2 + x * y % 3 == 0
                6 -> (x * y % 2 + x * y % 3) % 2 == 0
                else -> ((x + y) % 2 + x * y % 3) % 2 == 0
            }
            if (!function[y][x] && invert) modules[y][x] = !modules[y][x]
        }
    }

    /** Penalidade simplificada (sequências, blocos 2×2 e equilíbrio claro/escuro): qualquer máscara é válida, esta só escolhe a mais legível. */
    private fun penalty(): Int {
        var result = 0
        for (line in 0 until size) {
            var runRow = 1
            var runCol = 1
            for (k in 1 until size) {
                if (modules[line][k] == modules[line][k - 1]) runRow++ else runRow = 1
                if (runRow == 5) result += 3 else if (runRow > 5) result++
                if (modules[k][line] == modules[k - 1][line]) runCol++ else runCol = 1
                if (runCol == 5) result += 3 else if (runCol > 5) result++
            }
        }
        var dark = 0
        for (y in 0 until size) for (x in 0 until size) {
            if (modules[y][x]) dark++
            if (x < size - 1 && y < size - 1) {
                val c = modules[y][x]
                if (c == modules[y][x + 1] && c == modules[y + 1][x] && c == modules[y + 1][x + 1]) result += 3
            }
        }
        val total = size * size
        result += ((Math.abs(dark * 20 - total * 10) + total - 1) / total - 1).coerceAtLeast(0) * 10
        return result
    }

    companion object {
        private const val EC_LEVEL_M_BITS = 0
        private val ECC_PER_BLOCK = intArrayOf(-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26)
        private val BLOCKS = intArrayOf(-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5)
        const val MAX_VERSION = 10

        fun encode(text: String): QrCode {
            val bytes = text.toByteArray(Charsets.UTF_8)
            val version = (1..MAX_VERSION).firstOrNull { v ->
                4 + countBits(v) + bytes.size * 8 <= dataCodewords(v) * 8
            } ?: throw IllegalArgumentException("Texto grande demais para o QR code (${bytes.size} bytes)")

            val bits = BitBuffer()
            bits.append(0b0100, 4)
            bits.append(bytes.size, countBits(version))
            for (b in bytes) bits.append(b.toInt() and 0xFF, 8)
            val capacity = dataCodewords(version) * 8
            bits.append(0, minOf(4, capacity - bits.length))
            bits.append(0, (8 - bits.length % 8) % 8)
            var pad = 0xEC
            while (bits.length < capacity) {
                bits.append(pad, 8)
                pad = pad xor 0xEC xor 0x11
            }

            val qr = QrCode(version)
            qr.drawFunctionPatterns()
            qr.drawCodewords(withErrorCorrection(version, bits.toBytes()))
            var best = 0
            var bestPenalty = Int.MAX_VALUE
            for (mask in 0..7) {
                qr.applyMask(mask)
                qr.drawFormatBits(mask)
                val p = qr.penalty()
                if (p < bestPenalty) {
                    best = mask
                    bestPenalty = p
                }
                qr.applyMask(mask) // desfaz (a máscara é um XOR)
            }
            qr.applyMask(best)
            qr.drawFormatBits(best)
            return qr
        }

        private fun countBits(version: Int) = if (version <= 9) 8 else 16

        private fun rawDataModules(version: Int): Int {
            var result = (16 * version + 128) * version + 64
            if (version >= 2) {
                val align = version / 7 + 2
                result -= (25 * align - 10) * align - 55
                if (version >= 7) result -= 36
            }
            return result
        }

        private fun dataCodewords(version: Int) = rawDataModules(version) / 8 - ECC_PER_BLOCK[version] * BLOCKS[version]

        private fun alignmentPositions(version: Int): IntArray {
            if (version == 1) return IntArray(0)
            val count = version / 7 + 2
            val step = (version * 8 + count * 3 + 5) / (count * 4 - 4) * 2
            val result = IntArray(count)
            result[0] = 6
            var pos = version * 4 + 17 - 7
            for (i in count - 1 downTo 1) {
                result[i] = pos
                pos -= step
            }
            return result
        }

        private fun withErrorCorrection(version: Int, data: ByteArray): ByteArray {
            val blocks = BLOCKS[version]
            val eccLen = ECC_PER_BLOCK[version]
            val raw = rawDataModules(version) / 8
            val shortBlocks = blocks - raw % blocks
            val shortLen = raw / blocks
            val divisor = rsDivisor(eccLen)
            val all = ArrayList<ByteArray>()
            var k = 0
            for (i in 0 until blocks) {
                val len = shortLen - eccLen + if (i < shortBlocks) 0 else 1
                val dat = data.copyOfRange(k, k + len)
                k += len
                val ecc = rsRemainder(dat, divisor)
                // Blocos curtos ganham um byte vazio para todos terem o mesmo tamanho ao intercalar.
                val block = ByteArray(shortLen + 1)
                dat.copyInto(block, 0)
                ecc.copyInto(block, shortLen + 1 - eccLen)
                all += block
            }
            val result = ByteArray(raw)
            var n = 0
            for (i in 0..shortLen) for (j in all.indices) {
                if (i != shortLen - eccLen || j >= shortBlocks) result[n++] = all[j][i]
            }
            return result
        }

        private fun rsDivisor(degree: Int): IntArray {
            val result = IntArray(degree)
            result[degree - 1] = 1
            var root = 1
            repeat(degree) {
                for (j in result.indices) {
                    result[j] = gfMultiply(result[j], root)
                    if (j + 1 < result.size) result[j] = result[j] xor result[j + 1]
                }
                root = gfMultiply(root, 0x02)
            }
            return result
        }

        private fun rsRemainder(data: ByteArray, divisor: IntArray): ByteArray {
            val result = IntArray(divisor.size)
            for (b in data) {
                val factor = (b.toInt() and 0xFF) xor result[0]
                System.arraycopy(result, 1, result, 0, result.size - 1)
                result[result.size - 1] = 0
                for (i in result.indices) result[i] = result[i] xor gfMultiply(divisor[i], factor)
            }
            return ByteArray(result.size) { result[it].toByte() }
        }

        private fun gfMultiply(x: Int, y: Int): Int {
            var z = 0
            for (i in 7 downTo 0) {
                z = (z shl 1) xor ((z ushr 7) * 0x11D)
                z = z xor (((y ushr i) and 1) * x)
            }
            return z
        }
    }

    private class BitBuffer {
        private val bits = ArrayList<Boolean>()
        val length get() = bits.size

        fun append(value: Int, count: Int) {
            for (i in count - 1 downTo 0) bits += (value ushr i) and 1 != 0
        }

        fun toBytes() = ByteArray(bits.size / 8) { i ->
            var b = 0
            for (j in 0..7) if (bits[i * 8 + j]) b = b or (0x80 ushr j)
            b.toByte()
        }
    }
}
