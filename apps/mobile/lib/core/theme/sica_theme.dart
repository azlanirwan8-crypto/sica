import 'package:flutter/material.dart';
import 'color_tokens.dart';

/// Tema Material 3 Baku SICA Mobile
abstract final class SicaTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: const ColorScheme(
        brightness: Brightness.light,
        primary: SicaColors.primary,
        onPrimary: Colors.white,
        secondary: SicaColors.secondary,
        onSecondary: Colors.white,
        tertiary: SicaColors.success,
        onTertiary: Colors.white,
        error: SicaColors.danger,
        onError: Colors.white,
        surface: SicaColors.cardLight,
        onSurface: SicaColors.textHeadingLight,
        outline: SicaColors.borderLight,
      ),
      scaffoldBackgroundColor: SicaColors.canvasLight,
      fontFamily: 'Inter',
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: SicaColors.textHeadingLight,
        elevation: 0,
        scrolledUnderElevation: 1,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: SicaColors.textHeadingLight,
          fontSize: 18,
          fontWeight: FontWeight.bold,
          fontFamily: 'Inter',
        ),
      ),
      cardTheme: CardTheme(
        color: SicaColors.cardLight,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: SicaColors.borderLight),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: SicaColors.borderLight),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: SicaColors.borderLight),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: SicaColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: SicaColors.danger),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: SicaColors.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          minimumSize: const Size.fromHeight(46),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
          textStyle: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            fontFamily: 'Inter',
          ),
        ),
      ),
    );
  }

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: const ColorScheme(
        brightness: Brightness.dark,
        primary: SicaColors.primary,
        onPrimary: Colors.white,
        secondary: SicaColors.secondary,
        onSecondary: Colors.white,
        tertiary: SicaColors.success,
        onTertiary: Colors.white,
        error: SicaColors.danger,
        onError: Colors.white,
        surface: SicaColors.cardDark,
        onSurface: SicaColors.textHeadingDark,
        outline: SicaColors.borderDark,
      ),
      scaffoldBackgroundColor: SicaColors.canvasDark,
      fontFamily: 'Inter',
      appBarTheme: const AppBarTheme(
        backgroundColor: SicaColors.cardDark,
        foregroundColor: SicaColors.textHeadingDark,
        elevation: 0,
        centerTitle: false,
      ),
      cardTheme: CardTheme(
        color: SicaColors.cardDark,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: SicaColors.borderDark),
        ),
      ),
    );
  }
}
