import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/sica_theme.dart';
import 'features/auth/presentation/controllers/auth_notifier.dart';
import 'features/auth/presentation/screens/login_screen.dart';
import 'features/dashboard/presentation/screens/main_shell_screen.dart';
import 'features/attendance/presentation/screens/qr_scanner_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  runApp(
    const ProviderScope(
      child: SicaMobileApp(),
    ),
  );
}

class SicaMobileApp extends ConsumerWidget {
  const SicaMobileApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final isAuthenticated = authState.status == AuthStatus.authenticated;

    return MaterialApp(
      title: 'SICA Mobile',
      debugShowCheckedModeBanner: false,
      theme: SicaTheme.lightTheme,
      darkTheme: SicaTheme.darkTheme,
      themeMode: ThemeMode.light,
      home: isAuthenticated
          ? Builder(
              builder: (ctx) => MainShellScreen(
                onScanQrRequested: () {
                  Navigator.of(ctx).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const QrScannerScreen(),
                    ),
                  );
                },
              ),
            )
          : const LoginScreen(),
    );
  }
}
