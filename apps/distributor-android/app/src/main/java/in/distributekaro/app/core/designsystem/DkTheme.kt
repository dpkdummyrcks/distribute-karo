package `in`.distributekaro.app.core.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.unit.dp

private val LocalDkColors = staticCompositionLocalOf { DkTokens.LightExtended }

private val DkShapes = Shapes(
    small = RoundedCornerShape(DkTokens.Radius.SM.dp),
    medium = RoundedCornerShape(DkTokens.Radius.MD.dp),
    large = RoundedCornerShape(DkTokens.Radius.LG.dp),
    extraLarge = RoundedCornerShape(DkTokens.Radius.XL.dp),
)

/** Brand theme from tokens.json. Dynamic colour stays off so the brand is consistent (LLD §12). */
@Composable
fun DkTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalDkColors provides if (darkTheme) DkTokens.DarkExtended else DkTokens.LightExtended) {
        MaterialTheme(
            colorScheme = if (darkTheme) DkTokens.DarkColors else DkTokens.LightColors,
            typography = DkTokens.Typography,
            shapes = DkShapes,
            content = content,
        )
    }
}

object DkTheme {
    /** Colours Material 3 has no slot for (accent, success, warning, order status). */
    val colors: DkExtendedColors
        @Composable @ReadOnlyComposable
        get() = LocalDkColors.current
}
