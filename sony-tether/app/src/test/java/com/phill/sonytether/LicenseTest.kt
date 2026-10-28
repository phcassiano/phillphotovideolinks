package com.phill.sonytether

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class LicenseTest {
    private val verifier = LicenseVerifier(LicenseManager.PUBLIC_KEY)

    /** Chaves feitas pelo servidor (revela-site/api/licenca.js) com a chave privada de verdade. */
    private val anual = "REVELA-eyJpIjoiWEdzYTRzZk8iLCJuIjoiVGVzdGUgXCJBc3Bhc1wiIMOHw6NvIiwicCI6ImFudWFsIiwiYSI6IjIwMzAtMDEtMzEiLCJkIjoiQUJDRDIzNDUifQ.MEUCIQDuUpM_0nLmbHNrQymwoAFLGLMK2qtUMaOl_cQv9ghewgIgENdvvhuS2RwFEnYFSgPoycVo67bRIVriZkHeO4fwEgE"
    private val qualquerAparelho = "REVELA-eyJpIjoia3hCQmxNaEciLCJuIjoiUXVhbHF1ZXIiLCJwIjoidml0YWxpY2lhIiwiYSI6IjIwOTktMTItMzEiLCJkIjoiKiJ9.MEUCIQDjprxGfnbYXRT2j6tURgLmqjEsmEQwSoGbpa0vE7umvwIgLlMTs_fz-hzeQEr7Lhzsdwm8OqMCCgjE8lrnjSHhO0U"

    /** Feita pelo servidor publicado no Vercel (/api/licenca). */
    private val doServidor = "REVELA-eyJpIjoiQ0ZHOVc5LUEiLCJuIjoiVGVzdGUgc2Vydmlkb3IiLCJwIjoibWVuc2FsIiwiYSI6IjIwMjYtMTItMDMiLCJkIjoiQUJDRDIzNDUifQ.MEUCIQD2lYXndwFwmosiBQ2TWiQtWdtGFcvZmsV6XrGIk-cFsgIgVJxrTjLQq6EVkNJc0JodVH6N4pusIrvvZiCGgehr8TM"

    private fun ok(text: String) = (verifier.read(text) as LicenseVerifier.Result.Ok).license

    @Test
    fun acceptsKeysSignedByTheServer() {
        val l = ok(anual)
        assertEquals("Teste \"Aspas\" Ção", l.name)
        assertEquals("anual", l.plan)
        assertEquals(LocalDate.of(2030, 1, 31), l.until)
        assertEquals("ABCD2345", l.device)
        assertEquals("*", ok(qualquerAparelho).device)
        assertEquals("Teste servidor", ok(doServidor).name)
        assertEquals(LocalDate.of(2026, 12, 3), ok(doServidor).until)
    }

    @Test
    fun pastedWithSpacesAndLineBreaksStillWorks() {
        val messy = "  " + anual.chunked(40).joinToString("\n") + " \n"
        assertEquals("anual", ok(messy).plan)
    }

    @Test
    fun rejectsTamperedOrCutKeys() {
        // Trocar a data dentro da chave invalida a assinatura.
        val body = anual.removePrefix("REVELA-").substringBefore('.')
        val json = String(java.util.Base64.getUrlDecoder().decode(body)).replace("2030-01-31", "2099-01-31")
        val forged = "REVELA-" + java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(json.toByteArray()) + "." + anual.substringAfter('.')
        assertTrue(verifier.read(forged) is LicenseVerifier.Result.Invalid)
        assertTrue(verifier.read(anual.dropLast(6)) is LicenseVerifier.Result.Invalid)
        assertTrue(verifier.read("ABC-123") is LicenseVerifier.Result.Invalid)
    }

    @Test
    fun deviceCodeIsStableAndShort() {
        val a = LicenseManager.code("9774d56d682e549c")
        assertEquals(a, LicenseManager.code("9774d56d682e549c"))
        assertEquals(8, a.length)
        assertTrue(a.all { it in "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" })
        assertTrue(a != LicenseManager.code("outro-aparelho"))
    }
}
