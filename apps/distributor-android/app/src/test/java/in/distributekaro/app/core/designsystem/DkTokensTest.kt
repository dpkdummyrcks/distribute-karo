package `in`.distributekaro.app.core.designsystem

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DkTokensTest {
    private fun contrast(a: Color, b: Color): Double {
        val (hi, lo) = listOf(a.luminance(), b.luminance()).sortedDescending()
        return (hi + 0.05) / (lo + 0.05)
    }

    @Test
    fun everyOrderStatusHasReadableColours() {
        for (ext in listOf(DkTokens.LightExtended, DkTokens.DarkExtended)) {
            assertEquals(OrderStatusKey.entries.toSet(), ext.status.keys)
            ext.status.forEach { (key, c) -> assertTrue("$key contrast", contrast(c.container, c.content) >= 4.5) }
        }
    }

    @Test
    fun primaryTextIsReadable() {
        for (s in listOf(DkTokens.LightColors, DkTokens.DarkColors)) {
            assertTrue(contrast(s.primary, s.onPrimary) >= 4.5)
            assertTrue(contrast(s.surface, s.onSurface) >= 4.5)
        }
    }
}
