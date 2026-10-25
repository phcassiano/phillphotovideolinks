package com.phill.sonytether

import org.junit.Assert.assertEquals
import org.junit.Test

class SessionNamesTest {
    @Test
    fun prefixIsSafeForAnyApp() {
        assertEquals("Maria_Julia", SessionNames.prefix("Maria Júlia"))
        assertEquals("Casamento_Ana_Joao", SessionNames.prefix("  Casamento: Ana & João! "))
        assertEquals("Foto", SessionNames.prefix("!!!"))
    }

    @Test
    fun fileNamesAreNumberedWithThreeDigits() {
        assertEquals("Maria_001.jpg", SessionNames.fileName("Maria", 1, "JPG"))
        assertEquals("Maria_1234.arw", SessionNames.fileName("Maria", 1234, "ARW"))
    }

    @Test
    fun folderHasDateAndCleanName() {
        val created = java.util.GregorianCalendar(2026, 9, 25, 12, 0).timeInMillis
        assertEquals("2026-10-25 Ana João", SessionNames.folder("Ana/João", created))
        assertEquals("2026-10-25", SessionNames.folder("  ", created))
    }
}
