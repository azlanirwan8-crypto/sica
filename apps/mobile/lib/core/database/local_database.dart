import 'package:drift/drift.dart';

// Definisi Tabel Cache Lokal Mahasiswa
class CachedStudents extends Table {
  TextColumn get id => text()();
  TextColumn get nim => text()();
  TextColumn get fullName => text()();
  TextColumn get studyProgram => text()();
  IntColumn get currentSemester => integer()();
  RealColumn get cumulativeIpk => real()();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

// Definisi Tabel Cache Jadwal Kuliah Hari Ini
class CachedSchedules extends Table {
  TextColumn get classId => text()();
  TextColumn get courseCode => text()();
  TextColumn get courseName => text()();
  TextColumn get className => text()();
  IntColumn get sks => integer()();
  TextColumn get dayOfWeek => text()();
  TextColumn get startTime => text()();
  TextColumn get endTime => text()();
  TextColumn get roomName => text().nullable()();
  TextColumn get lecturerName => text()();

  @override
  Set<Column> get primaryKey => {classId};
}

// Data holder sederhana untuk local caching tanpa code generator
class LocalDatabaseStore {
  static final Map<String, dynamic> _inMemoryProfileCache = <String, dynamic>{};
  static final List<Map<String, dynamic>> _inMemoryScheduleCache = <Map<String, dynamic>>[];

  static void cacheStudentProfile(Map<String, dynamic> profile) {
    _inMemoryProfileCache.clear();
    _inMemoryProfileCache.addAll(profile);
  }

  static Map<String, dynamic>? getCachedStudentProfile() {
    if (_inMemoryProfileCache.isEmpty) return null;
    return Map<String, dynamic>.unmodifiable(_inMemoryProfileCache);
  }

  static void cacheSchedules(List<Map<String, dynamic>> schedules) {
    _inMemoryScheduleCache.clear();
    _inMemoryScheduleCache.addAll(schedules);
  }

  static List<Map<String, dynamic>> getCachedSchedules() {
    return List<Map<String, dynamic>>.unmodifiable(_inMemoryScheduleCache);
  }

  static void clearAllCache() {
    _inMemoryProfileCache.clear();
    _inMemoryScheduleCache.clear();
  }
}
