import 'package:flutter_test/flutter_test.dart';
import 'package:sica_mobile/features/attendance/presentation/controllers/attendance_notifier.dart';

void main() {
  group('AttendanceNotifier Mobile Unit & State Tests', () {
    test('Inisialisasi awal AttendanceNotifier harus berstatus idle', () {
      final notifier = AttendanceNotifier();
      expect(notifier.state.status, AttendanceProcessStatus.idle);
      expect(notifier.state.message, isNull);
    });

    test('Reset state harus mengembalikan status ke idle', () {
      final notifier = AttendanceNotifier();
      notifier.reset();
      expect(notifier.state.status, AttendanceProcessStatus.idle);
    });

    test('AttendanceState copyWith mempertahankan field yang tidak diubah', () {
      const initial = AttendanceState(
        status: AttendanceProcessStatus.idle,
        message: 'Awal',
        distanceMeters: 10,
      );

      final updated = initial.copyWith(status: AttendanceProcessStatus.verifying);

      expect(updated.status, AttendanceProcessStatus.verifying);
      expect(updated.message, 'Awal');
      expect(updated.distanceMeters, 10);
    });
  });
}
