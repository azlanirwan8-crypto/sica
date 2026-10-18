import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/color_tokens.dart';
import '../controllers/auth_notifier.dart';

class LoginScreen extends ConsumerStatefulWidget {
  final VoidCallback? onLoginSuccess;

  const LoginScreen({super.key, this.onLoginSuccess});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _tenantController = TextEditingController(text: 'demo');
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _tenantController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submitLogin() async {
    if (!_formKey.currentState!.validate()) return;

    final success = await ref.read(authProvider.notifier).login(
      tenantIdentifier: _tenantController.text.trim(),
      username: _usernameController.text.trim(),
      password: _passwordController.text,
    );

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Login berhasil! Selamat datang di SICA.'),
          backgroundColor: SicaColors.success,
        ),
      );
      widget.onLoginSuccess?.call();
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final isLoading = authState.status == AuthStatus.authenticating;

    return Scaffold(
      backgroundColor: SicaColors.canvasLight,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // App Icon / Logo
                  Center(
                    child: Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: SicaColors.primary,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x333577F1),
                            blurRadius: 16,
                            offset: Offset(0, 8),
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.school_rounded,
                        color: Colors.white,
                        size: 38,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'SICA Mobile Portal',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: SicaColors.textHeadingLight,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Sistem Informasi Akademik Kampus Terpadu',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      color: SicaColors.textMutedLight,
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Card Form Container
                  Card(
                    color: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: const BorderSide(color: SicaColors.borderLight),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Tenant Identifier
                          const Text(
                            'KODE INSTITUSI KAMPUS',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: SicaColors.textMutedLight,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _tenantController,
                            decoration: const InputDecoration(
                              hintText: 'Slug kampus (contoh: demo)',
                              prefixIcon: Icon(Icons.business_rounded, color: SicaColors.primary, size: 20),
                            ),
                            validator: (val) => val == null || val.isEmpty ? 'Kode kampus wajib diisi' : null,
                          ),
                          const SizedBox(height: 16),

                          // Username / NIM
                          const Text(
                            'NIM / NIDN / EMAIL',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: SicaColors.textMutedLight,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _usernameController,
                            decoration: const InputDecoration(
                              hintText: '2201010045 atau dosen@kampus.ac.id',
                              prefixIcon: Icon(Icons.person_rounded, color: SicaColors.primary, size: 20),
                            ),
                            validator: (val) => val == null || val.isEmpty ? 'Identitas akun wajib diisi' : null,
                          ),
                          const SizedBox(height: 16),

                          // Password
                          const Text(
                            'KATA SANDI',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: SicaColors.textMutedLight,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            decoration: InputDecoration(
                              hintText: '••••••••••••',
                              prefixIcon: const Icon(Icons.lock_rounded, color: SicaColors.primary, size: 20),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                                  color: SicaColors.textMutedLight,
                                  size: 20,
                                ),
                                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                              ),
                            ),
                            validator: (val) => val == null || val.isEmpty ? 'Kata sandi wajib diisi' : null,
                          ),
                          const SizedBox(height: 24),

                          if (authState.errorMessage != null)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: Text(
                                authState.errorMessage!,
                                style: const TextStyle(color: SicaColors.danger, fontSize: 12),
                                textAlign: TextAlign.center,
                              ),
                            ),

                          // Submit Button
                          ElevatedButton(
                            onPressed: isLoading ? null : _submitLogin,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: SicaColors.primary,
                              foregroundColor: Colors.white,
                              minimumSize: const Size.fromHeight(48),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            child: isLoading
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                  )
                                : const Text('Masuk ke Portal', style: TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),
                  const Text(
                    'SICA Mobile • Kepatuhan SN-Dikti & Feeder PDDIKTI',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 11, color: SicaColors.textMutedLight),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
