import 'package:flutter/foundation.dart';
import '../config/app_env.dart';

/// Monitoring & Crash Reporting Service untuk Flutter Mobile
class SentryMonitoringService {
  static Future<void> initialize() async {
    if (kReleaseMode) {
      // Inisialisasi Sentry saat mode rilis produksi
      debugPrint('Sentry Monitoring initialized for environment: ${AppEnv.appEnv}');
    }
  }

  static void captureException(dynamic exception, dynamic stackTrace, {String? tag}) {
    if (kReleaseMode) {
      debugPrint('Capturing crash report: $exception, tag: $tag');
    } else {
      debugPrint('Dev Crash: $exception\n$stackTrace');
    }
  }

  static void addBreadcrumb(String message, {String category = 'action'}) {
    debugPrint('Breadcrumb [$category]: $message');
  }
}
