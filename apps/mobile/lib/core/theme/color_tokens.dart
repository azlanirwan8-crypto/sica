import 'package:flutter/material.dart';

/// SICA Velzon Theme Color Tokens (Mobile)
/// Dipetakan 100% konsisten dengan Web Design Tokens (UI_UX_DESIGN.md & velzon-theme.css)
abstract final class SicaColors {
  // Brand & Status Palette
  static const Color primary = Color(0xFF3577F1);
  static const Color primaryHover = Color(0xFF2960C9);
  static const Color primaryLight = Color(0x1A3577F1); // 10% opacity

  static const Color secondary = Color(0xFF405189);
  static const Color secondaryLight = Color(0x1A405189);

  static const Color success = Color(0xFF0AB39C);
  static const Color successLight = Color(0x1A0AB39C);

  static const Color info = Color(0xFF299CDB);
  static const Color infoLight = Color(0x1A299CDB);

  static const Color warning = Color(0xFFF7B84B);
  static const Color warningLight = Color(0x1FF7B84B); // 12% opacity

  static const Color danger = Color(0xFFF06548);
  static const Color dangerLight = Color(0x1AF06548);

  // Surface Tokens (Light Mode)
  static const Color canvasLight = Color(0xFFF3F3F9);
  static const Color cardLight = Color(0xFFFFFFFF);
  static const Color borderLight = Color(0xFFE9EBEC);
  static const Color textHeadingLight = Color(0xFF212529);
  static const Color textBodyLight = Color(0xFF495057);
  static const Color textMutedLight = Color(0xFF74788D);

  // Surface Tokens (Dark Mode)
  static const Color canvasDark = Color(0xFF14171A);
  static const Color cardDark = Color(0xFF1E2227);
  static const Color borderDark = Color(0xFF292E35);
  static const Color textHeadingDark = Color(0xFFF3F6F9);
  static const Color textBodyDark = Color(0xFFCED4DA);
  static const Color textMutedDark = Color(0xFF798399);
}
