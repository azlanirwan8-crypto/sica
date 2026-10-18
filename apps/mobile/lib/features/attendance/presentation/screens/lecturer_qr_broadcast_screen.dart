import 'dart:async';
import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../../core/theme/color_tokens.dart';

class LecturerQrBroadcastScreen extends StatefulWidget {
  final String courseName;
  final String className;
  final String sessionId;
  final String classId;

  const LecturerQrBroadcastScreen({
    super.key,
    this.courseName = 'Kecerdasan Buatan & Machine Learning',
    this.className = 'IF-A',
    this.sessionId = '11111111-2222-3333-4444-555555555555',
    this.classId = '66666666-7777-8888-9999-000000000000',
  });

  @override
  State<LecturerQrBroadcastScreen> createState() => _LecturerQrBroadcastScreenState();
}

class _LecturerQrBroadcastScreenState extends State<LecturerQrBroadcastScreen> {
  static const int _rotationSeconds = 30;
  int _secondsRemaining = _rotationSeconds;
  Timer? _timer;
  String _currentQrPayload = '';
  int _studentsPresentCount = 28;
  final int _totalStudentsCount = 40;

  @override
  void initState() {
    super.initState();
    _generateNextQr();
    _startCountdownTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _generateNextQr() {
    final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final exp = now + _rotationSeconds;

    // Payload dinamis dengan koordinat ruang kelas kampus
    _currentQrPayload =
        '{"tId":"demo","sId":"${widget.sessionId}","cId":"${widget.classId}","iat":$now,"exp":$exp,"non":"${now.toRadixString(16)}","sig":"simulated_hmac_signature_$now","geo":{"lat":-6.175392,"lng":106.827153,"rad":50}}';
  }

  void _startCountdownTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() {
        if (_secondsRemaining > 1) {
          _secondsRemaining--;
        } else {
          _secondsRemaining = _rotationSeconds;
          _generateNextQr();
        }
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final progress = _secondsRemaining / _rotationSeconds;

    return Scaffold(
      backgroundColor: SicaColors.canvasLight,
      appBar: AppBar(
        title: const Text('Presensi Dinamis Dosen'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Rotasi QR Sekarang',
            onPressed: () {
              setState(() {
                _secondsRemaining = _rotationSeconds;
                _generateNextQr();
              });
            },
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Course & Class Banner
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: SicaColors.borderLight),
                ),
                child: Column(
                  children: [
                    Text(
                      widget.courseName,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: SicaColors.textHeadingLight,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Kelas ${widget.className} • Pertemuan Tatap Muka ke-8',
                      style: const TextStyle(
                        fontSize: 12,
                        color: SicaColors.textMutedLight,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // QR Code Card Container with Progress Ring
              Card(
                color: Colors.white,
                elevation: 2,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                  side: const BorderSide(color: SicaColors.borderLight),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
                  child: Column(
                    children: [
                      // Circular Countdown Timer
                      Stack(
                        alignment: Alignment.center,
                        children: [
                          SizedBox(
                            width: 64,
                            height: 64,
                            child: CircularProgressIndicator(
                              value: progress,
                              strokeWidth: 5,
                              backgroundColor: SicaColors.canvasLight,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                progress < 0.25 ? SicaColors.danger : SicaColors.primary,
                              ),
                            ),
                          ),
                          Text(
                            '${_secondsRemaining}s',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: SicaColors.textHeadingLight,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),

                      // QR Code Render
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: SicaColors.borderLight),
                        ),
                        child: QrImageView(
                          data: _currentQrPayload,
                          version: QrVersions.auto,
                          size: 240,
                          eyeStyle: const QrEyeStyle(
                            eyeShape: QrEyeShape.square,
                            color: SicaColors.primary,
                          ),
                          dataModuleStyle: const QrDataModuleStyle(
                            dataModuleShape: QrDataModuleShape.square,
                            color: Color(0xFF212529),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.shield_outlined, size: 16, color: SicaColors.success),
                          SizedBox(width: 6),
                          Text(
                            'HMAC-SHA256 • TTL Rotasi 30 Detik',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: SicaColors.textMutedLight,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Live Attendance Counter
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: SicaColors.borderLight),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.people_alt_rounded, color: SicaColors.primary, size: 22),
                        SizedBox(width: 10),
                        Text(
                          'Mahasiswa Hadir',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    Text(
                      '$_studentsPresentCount / $_totalStudentsCount Mhs',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: SicaColors.success,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Geofence Information Box
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: SicaColors.infoLight,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: SicaColors.info.withOpacity(0.3)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.location_on_rounded, color: SicaColors.info, size: 20),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Radius Validasi GPS: Maksimal 50 meter dari Ruang Kuliah. Anti-Fake GPS aktif.',
                        style: TextStyle(fontSize: 11, color: SicaColors.info, fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
