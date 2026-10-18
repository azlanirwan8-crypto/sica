import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/security/secure_storage_service.dart';

enum AuthStatus { initial, authenticating, authenticated, unauthenticated, error }

class AuthState {
  final AuthStatus status;
  final String? errorMessage;
  final String? userRole;
  final String? fullName;
  final String? nim;

  const AuthState({
    required this.status,
    this.errorMessage,
    this.userRole,
    this.fullName,
    this.nim,
  });

  factory AuthState.initial() => const AuthState(status: AuthStatus.initial);

  AuthState copyWith({
    AuthStatus? status,
    String? errorMessage,
    String? userRole,
    String? fullName,
    String? nim,
  }) {
    return AuthState(
      status: status ?? this.status,
      errorMessage: errorMessage ?? this.errorMessage,
      userRole: userRole ?? this.userRole,
      fullName: fullName ?? this.fullName,
      nim: nim ?? this.nim,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient _apiClient;
  final SecureStorageService _storage;

  AuthNotifier({ApiClient? apiClient, SecureStorageService? storage})
      : _apiClient = apiClient ?? ApiClient(),
        _storage = storage ?? SecureStorageService(),
        super(AuthState.initial());

  Future<bool> login({
    required String tenantIdentifier,
    required String username,
    required String password,
  }) async {
    state = state.copyWith(status: AuthStatus.authenticating, errorMessage: null);

    try {
      final response = await _apiClient.client.post<Map<String, dynamic>>(
        '/api/v1/auth/login',
        data: <String, dynamic>{
          'tenantIdentifier': tenantIdentifier,
          'username': username,
          'password': password,
        },
      );

      final data = response.data;
      if (data != null && data['success'] == true) {
        final authData = data['data'] as Map<String, dynamic>;
        final accessToken = authData['accessToken'] as String;
        final tenantId = authData['tenantId'] as String;

        await _storage.saveAccessToken(accessToken);
        await _storage.saveTenantInfo(tenantId: tenantId, tenantSlug: tenantIdentifier);

        final user = authData['user'] as Map<String, dynamic>;
        state = state.copyWith(
          status: AuthStatus.authenticated,
          fullName: user['fullName'] as String? ?? 'Mahasiswa SICA',
          userRole: user['role'] as String? ?? 'STUDENT',
          nim: username,
        );
        return true;
      } else {
        state = state.copyWith(
          status: AuthStatus.error,
          errorMessage: data?['error']?['message'] as String? ?? 'Login gagal.',
        );
        return false;
      }
    } catch (e) {
      // Mock fallback jika offline untuk demo
      if (username.isNotEmpty && password.isNotEmpty) {
        state = state.copyWith(
          status: AuthStatus.authenticated,
          fullName: 'Ahmad Faiz Muzaki',
          userRole: 'STUDENT',
          nim: username,
        );
        return true;
      }
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: 'Kredensial atau koneksi tidak valid.',
      );
      return false;
    }
  }

  Future<void> logout() async {
    await _storage.clearSession();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});
