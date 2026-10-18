/// Konfigurasi Environment Flutter Mobile SICA
/// Mengacu pada docs/ENV_CONTRACT.md Bagian 3
class AppEnv {
  AppEnv._();

  static const String appFlavor = String.fromEnvironment(
    'APP_FLAVOR',
    defaultValue: 'development',
  );

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.sica.ac.id/api/v1',
  );

  static const String appPackageName = String.fromEnvironment(
    'APP_PACKAGE_NAME',
    defaultValue: 'id.ac.sica.mobile',
  );

  static const bool enableRootDetection = bool.fromEnvironment(
    'ENABLE_ROOT_DETECTION',
    defaultValue: true,
  );

  static const bool enableSslPinning = bool.fromEnvironment(
    'ENABLE_SSL_PINNING',
    defaultValue: true,
  );

  static const String sentryDsn = String.fromEnvironment('SENTRY_DSN');

  /// Validasi environment variables saat runtime sebelum runApp()
  static void validate() {
    final List<String> missing = <String>[];

    if (apiBaseUrl.isEmpty || (!apiBaseUrl.startsWith('https://') && !apiBaseUrl.startsWith('http://'))) {
      missing.add('API_BASE_URL (Wajib berawalan http:// atau https://)');
    }

    if (missing.isNotEmpty) {
      throw StateError(
        'CRITICAL CONFIG ERROR: Variabel compile-time berikut tidak valid: ${missing.join(', ')}.\n'
        'Jalankan aplikasi dengan menyertakan argumen: --dart-define=API_BASE_URL=https://...',
      );
    }
  }
}
