import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Service enkripsi kredensial & session token berbasis FlutterSecureStorage
class SecureStorageService {
  static const FlutterSecureStorage _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
    ),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock,
    ),
  );

  static const String _keyAccessToken = 'sica_access_token';
  static const String _keyRefreshToken = 'sica_refresh_token';
  static const String _keyTenantId = 'sica_tenant_id';
  static const String _keyTenantSlug = 'sica_tenant_slug';
  static const String _keyUserId = 'sica_user_id';
  static const String _keyUserRole = 'sica_user_role';

  // Access Token
  Future<void> saveAccessToken(String token) async {
    await _storage.write(key: _keyAccessToken, value: token);
  }

  Future<String?> getAccessToken() async {
    return _storage.read(key: _keyAccessToken);
  }

  // Refresh Token
  Future<void> saveRefreshToken(String token) async {
    await _storage.write(key: _keyRefreshToken, value: token);
  }

  Future<String?> getRefreshToken() async {
    return _storage.read(key: _keyRefreshToken);
  }

  // Tenancy
  Future<void> saveTenantInfo({required String tenantId, required String tenantSlug}) async {
    await _storage.write(key: _keyTenantId, value: tenantId);
    await _storage.write(key: _keyTenantSlug, value: tenantSlug);
  }

  Future<String?> getTenantId() async {
    return _storage.read(key: _keyTenantId);
  }

  Future<String?> getTenantSlug() async {
    return _storage.read(key: _keyTenantSlug);
  }

  // Clear Session on Logout
  Future<void> clearSession() async {
    await _storage.delete(key: _keyAccessToken);
    await _storage.delete(key: _keyRefreshToken);
    await _storage.delete(key: _keyUserId);
    await _storage.delete(key: _keyUserRole);
  }
}
