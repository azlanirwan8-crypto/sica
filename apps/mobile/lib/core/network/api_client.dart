import 'package:dio/dio.dart';
import '../config/app_env.dart';
import '../security/secure_storage_service.dart';

/// HTTP API Client menggunakan Dio dengan auto-interceptor token & tenancy
class ApiClient {
  late final Dio _dio;
  final SecureStorageService _storage;

  ApiClient({SecureStorageService? storage})
      : _storage = storage ?? SecureStorageService() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppEnv.apiBaseUrl,
        connectTimeout: const Duration(milliseconds: AppEnv.connectTimeoutMs),
        receiveTimeout: const Duration(milliseconds: AppEnv.receiveTimeoutMs),
        headers: <String, dynamic>{
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // 1. Suntikkan Access Token JWT jika ada
          final token = await _storage.getAccessToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }

          // 2. Suntikkan Header Isolasi Tenant
          final tenantId = await _storage.getTenantId();
          if (tenantId != null && tenantId.isNotEmpty) {
            options.headers['X-Tenant-ID'] = tenantId;
          }

          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          // Tangani token kadaluarsa (HTTP 401)
          if (error.response?.statusCode == 401) {
            final refreshToken = await _storage.getRefreshToken();
            if (refreshToken != null && refreshToken.isNotEmpty) {
              try {
                // Request refresh token
                final refreshResponse = await _dio.post<Map<String, dynamic>>(
                  '/api/v1/auth/refresh',
                  data: <String, dynamic>{'refreshToken': refreshToken},
                );

                if (refreshResponse.statusCode == 200 &&
                    refreshResponse.data?['data']?['accessToken'] != null) {
                  final newAccessToken =
                      refreshResponse.data!['data']['accessToken'] as String;
                  await _storage.saveAccessToken(newAccessToken);

                  // Ulangi request awal dengan token baru
                  final opts = Options(
                    method: error.requestOptions.method,
                    headers: error.requestOptions.headers,
                  );
                  opts.headers?['Authorization'] = 'Bearer $newAccessToken';

                  final clonedRequest = await _dio.request<dynamic>(
                    error.requestOptions.path,
                    options: opts,
                    data: error.requestOptions.data,
                    queryParameters: error.requestOptions.queryParameters,
                  );
                  return handler.resolve(clonedRequest);
                }
              } catch (_) {
                await _storage.clearSession();
              }
            }
          }
          return handler.next(error);
        },
      ),
    );
  }

  Dio get client => _dio;
}
