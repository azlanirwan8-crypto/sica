# SICA — Konvensi Teknis & Standar Rekayasa Perangkat Lunak (Web & Mobile)

Dokumen ini mendefinisikan aturan rekayasa perangkat lunak, arsitektur kode, struktur direktori, konvensi penamaan, dan manajemen *state* untuk aplikasi **SICA Web (Next.js 15)** dan **SICA Mobile (Flutter)**.

| | |
|---|---|
| **Versi** | 1.0 (Enterprise Specification) |
| **Stack Web** | Next.js 15 (App Router), TypeScript (Strict), TanStack Query v5, Zustand, React Hook Form, Zod |
| **Stack Mobile**| Flutter 3.x, Dart 3.x, Riverpod 2.x, Freezed, Drift (SQLite), Dio |
| **Dokumen Terkait** | [INDEX.md](file:///c:/SICA/docs/INDEX.md) · [ARCHITECTURE.md](file:///c:/SICA/docs/ARCHITECTURE.md) · [API_SPEC.md](file:///c:/SICA/docs/API_SPEC.md) |

---

## 1. Konvensi Aplikasi Web (Next.js 15 App Router)

### 1.1 Struktur Direktori (*Feature-Sliced Monolith*)

Aplikasi web SICA berlokasi di `apps/web/` dan mengikuti pemisahan modular berbasis domain:

```
apps/web/
├─ app/                                # Next.js App Router (Routing, Layouts, Pages)
│  ├─ layout.tsx                       # Root Layout (Fonts, Providers, HTML Lang)
│  ├─ page.tsx                         # Landing / Redirector
│  ├─ (auth)/                          # Route Group: Autentikasi
│  │  ├─ login/page.tsx
│  │  ├─ mfa/page.tsx
│  │  └─ reset-password/page.tsx
│  ├─ (portal)/[tenant]/               # Route Group: Portal Multitenant Terisolasi
│  │  ├─ layout.tsx                    # Tenant Shell (Sidebar, Header, Breadcrumbs)
│  │  ├─ dashboard/page.tsx
│  │  ├─ krs/page.tsx
│  │  ├─ khs/page.tsx
│  │  ├─ tagihan/page.tsx
│  │  └─ presensi/page.tsx
│  └─ api/                             # Internal Route Handlers / Proxies
├─ components/                         # Komponen UI Global & Design System
│  ├─ ui/                              # Primitif shadcn / Velzon (Button, Card, Modal, Input)
│  ├─ data-table/                      # Komponen Tabel Terkelola Bersama
│  └─ layout/                          # Header, Sidebar, TenantSwitcher, ThemeToggle
├─ modules/                            # Logika Domain Khusus per Fitur
│  ├─ enrollment/                      # Domain KRS & Kelas
│  │  ├─ components/                   # Komponen Khusus KRS (CoursePicker, QuotaBadge)
│  │  ├─ hooks/                        # Custom Hooks (useKrsEnrollment, useClassSearch)
│  │  ├─ services/                     # Kueri API & Mutasi (krsApi.ts)
│  │  └─ types/                        # Tipe Lokal Tambahan
│  ├─ finance/                         # Domain Tagihan & Pembayaran
│  └─ grading/                         # Domain Pengisian Nilai & KHS
├─ contracts/                          # Symlink / Import dari packages/contracts (Skema Zod)
├─ lib/                                # Utilitas Bersama
│  ├─ api-client.ts                    # Instance Fetch / Axios dengan Interceptor JWT
│  ├─ query-client.ts                  # Inisialisasi TanStack Query Default
│  └─ utils.ts                         # Formatting Rupiah, Tanggal Indonesia, Class Merger
└─ styles/                             # tokens.css, globals.css (Tailwind CSS)
```

### 1.2 Manajemen State: Pemisahan Server State vs Client State

SICA secara ketat membedakan antara **Server State** (data yang bersumber dari database API) dan **Client State** (status UI murni):

#### A. Server State: TanStack Query v5
Digunakan untuk seluruh pengambilan data (*data fetching*), *caching*, sinkronisasi background, dan mutasi optimistik.

```typescript
// apps/web/modules/enrollment/hooks/use-krs-classes.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { KrsSubmitPayloadSchema, type KrsClassItem } from '@/contracts/academic';

export function useKrsOpenClasses(periodId: string) {
  return useQuery<KrsClassItem[]>({
    queryKey: ['academic', 'krs', 'classes', periodId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/v1/academic/krs/open-classes?periodId=${periodId}`);
      return response.data.data;
    },
    staleTime: 1000 * 60 * 3, // 3 menit (KRS kuota dinamis)
  });
}

export function useSubmitKrs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: unknown) => {
      const validPayload = KrsSubmitPayloadSchema.parse(payload);
      const response = await apiClient.post('/api/v1/academic/krs/submit', validPayload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic', 'krs'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] });
    },
  });
}
```

#### B. Client State: Zustand
Digunakan murni untuk status UI sementara yang tidak memerlukan persistensi server (misal: status sidebar terbuka/tertutup, modal filter, tema tampilan, draft pemilihan kartu):

```typescript
// apps/web/lib/stores/ui-store.ts
import { create } from 'zustand';

interface UiState {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  theme: 'light',
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTheme: (theme) => set({ theme }),
}));
```

### 1.3 Manajemen Formulir (*Form Handling*): React Hook Form + Zod

Setiap formulir masukan wajib divalidasi menggunakan Zod resolver yang bersumber dari kontrak bersama di `packages/contracts`:

```typescript
// apps/web/modules/grading/components/grade-correction-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { GradeCorrectionPayloadSchema, type GradeCorrectionPayload } from '@/contracts/academic';

export function GradeCorrectionForm({ gradeId, onSuccess }: { gradeId: string; onSuccess: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GradeCorrectionPayload>({
    resolver: zodResolver(GradeCorrectionPayloadSchema),
    defaultValues: { gradeId, reason: '' },
  });

  const onSubmit = async (data: GradeCorrectionPayload) => {
    // Eksekusi mutasi API
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Alasan Resmi Koreksi Nilai</label>
        <textarea
          {...register('reason')}
          className="mt-1 w-full rounded-md border p-2 text-sm"
          placeholder="Jelaskan alasan kekeliruan input sesuai berkas ujian fisik..."
        />
        {errors.reason && <p className="mt-1 text-xs text-red-500">{errors.reason.message}</p>}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {isSubmitting ? 'Memproses...' : 'Kirim Pengajuan Koreksi'}
      </button>
    </form>
  );
}
```

---

## 2. Konvensi Aplikasi Mobile (Flutter Material 3)

### 2.1 Arsitektur Berbasis Fitur (*Feature-First Architecture*)

Aplikasi mobile SICA di `apps/mobile/` menerapkan struktur modular berlapis yang mengisolasi UI, domain logic, dan akses data:

```
apps/mobile/lib/
├─ app.dart                            # Root MaterialApp & Theme Registration
├─ main.dart                           # Entry Point (Inisialisasi Database, Sentry)
├─ core/                               # Infrastruktur Global & Utilitas
│  ├─ network/                         # Dio Client, Interceptor JWT, Error Envelope Handler
│  ├─ theme/                           # SicaTheme (Material 3 Tokens Velzon)
│  ├─ storage/                         # Drift SQLite Database Helper
│  └─ utils/                           # Format Currency Rupiah, Date Converter
└─ features/                           # Modul Fitur Mandiri
   ├─ auth/                            # Fitur Autentikasi & Sesi
   ├─ krs/                             # Fitur Pemilihan KRS & Jadwal Kuliah
   │  ├─ data/                         # Data Layer: Model DTO, Remote API, Local DAO
   │  │  ├─ datasources/krs_api.dart
   │  │  ├─ models/krs_item_model.dart
   │  │  └─ repositories/krs_repository_impl.dart
   │  ├─ domain/                       # Domain Layer: Entity Murni & Use Cases
   │  │  ├─ entities/krs_class.dart
   │  │  └─ repositories/krs_repository.dart
   │  └─ presentation/                 # Presentation Layer: Riverpod Notifiers & Widgets
   │     ├─ controllers/krs_controller.dart
   │     ├─ screens/krs_screen.dart
   │     └─ widgets/course_item_card.dart
   ├─ attendance/                      # Fitur Scanner QR & Riwayat Presensi
   └─ profile/                         # Profil Mahasiswa & KTM Digital Hologram
```

### 2.2 Manajemen State: Riverpod 2.x (AsyncNotifier)

Seluruh logika state mobile dikendalikan menggunakan `AsyncNotifier` dari Riverpod untuk manajemen siklus hidup async (loading, data, error) secara deklaratif:

```dart
// lib/features/attendance/presentation/controllers/attendance_controller.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sica_mobile/features/attendance/data/datasources/attendance_api.dart';
import 'package:sica_mobile/features/attendance/domain/entities/attendance_result.dart';

final attendanceControllerProvider =
    AutoDisposeAsyncNotifierProvider<AttendanceController, AttendanceResult?>(() {
  return AttendanceController();
});

class AttendanceController extends AutoDisposeAsyncNotifier<AttendanceResult?> {
  @override
  Future<AttendanceResult?> build() async {
    return null; // Initial state tidak ada scan
  }

  Future<void> submitQrScan({required String qrToken, required double lat, required double lng}) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final api = ref.read(attendanceApiProvider);
      final result = await api.scanQrCode(
        qrToken: qrToken,
        latitude: lat,
        longitude: lng,
      );
      return result;
    });
  }
}
```

### 2.3 Immutability & Model Data: Freezed + JsonSerializable

Model data Flutter wajib bersifat immutable dengan pembentukan otomatis fungsi `copyWith`, serialization JSON, dan equality checks:

```dart
// lib/features/krs/domain/entities/krs_class.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'krs_class.freezed.dart';
part 'krs_class.g.dart';

@freezed
class KrsClass with _$KrsClass {
  const factory KrsClass({
    required String id,
    required String courseCode,
    required String courseName,
    required double sks,
    required String className,
    required String roomCode,
    required String scheduleTime,
    required int capacity,
    required int enrolledCount,
    @Default(false) bool isEnrolled,
  }) = _KrsClass;

  factory KrsClass.fromJson(Map<String, dynamic> json) => _$KrsClassFromJson(json);
}
```

### 2.4 Penyimpanan Lokal Terkelola: Drift (Type-Safe SQLite)

Untuk menjamin ketersediaan data saat mahasiswa berada di area minim sinyal (*offline capability*), data jadwal kuliah dan KTM di-cache secara relasional menggunakan **Drift**:

```dart
// lib/core/storage/local_database.dart
import 'package:drift/drift.dart';

part 'local_database.g.dart';

class CachedSchedules extends Table {
  TextColumn get id => text()();
  TextColumn get classId => text()();
  TextColumn get courseName => text()();
  TextColumn get roomName => text()();
  IntColumn get dayOfWeek => integer()();
  TextColumn get startTime => text()();
  TextColumn get endTime => text()();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

@DriftDatabase(tables: [CachedSchedules])
class LocalDatabase extends _$LocalDatabase {
  LocalDatabase(QueryExecutor e) : super(e);

  @override
  int get schemaVersion => 1;
}
```

---

## 3. Standar Penamaan Ketat (*Strict Naming Conventions*)

Konsistensi penamaan wajib ditaati di seluruh repositori untuk memastikan integrasi mulus antara TypeScript, Dart, REST API, dan PostgreSQL:

| Kategori Target | Bahasa / Lapisan | Konvensi Penamaan | Contoh Baku SICA |
|---|---|---|---|
| **File Web** | Next.js / TypeScript | `kebab-case.ext` | `course-picker.tsx`, `use-krs-classes.ts` |
| **File Mobile** | Flutter / Dart | `snake_case.dart` | `krs_controller.dart`, `digital_ktm_badge.dart` |
| **Class / Type / Enum** | TS & Dart | `PascalCase` | `EnrollmentStatus`, `StudentRepository`, `KrsClassItem` |
| **Variabel / Fungsi** | TS & Dart | `camelCase` | `calculateGpa()`, `enrolledCount`, `submitPayment()` |
| **Konstanta Global** | TS & Dart | `SCREAMING_SNAKE_CASE` | `DEFAULT_PAGE_SIZE`, `MAX_SKS_LIMIT` |
| **REST API Route** | URL Web & Mobile | `kebab-case` plural | `/api/v1/academic/class-schedules`, `/api/v1/attendance/qr/scan` |
| **Payload JSON Property**| Network Wire | `camelCase` | `{ "courseCode": "IF101", "totalSks": 18.0 }` |
| **Database Table & Column**| PostgreSQL DDL | `snake_case` | `study_programs`, `grade_components.weight_pct` |

### Pemetaan Otomatis Properti Kode ke Basis Data (Drizzle ORM)
Drizzle ORM di `packages/db` bertindak sebagai jembatan translasi resmi antara `camelCase` TypeScript dan `snake_case` PostgreSQL:

```typescript
// packages/db/schema/academic.ts
import { pgTable, uuid, text, numeric, integer } from 'drizzle-orm/pg-core';

export const classes = pgTable('classes', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  courseId: uuid('course_id').notNull(),
  name: text('name').notNull(),
  capacity: integer('capacity').notNull(),
  enrolledCount: integer('enrolled_count').notNull().default(0),
});
```

---

## 4. Standar Mutasi Data & Penanganan Galat (*Error Handling*)

1. **Prinsip Validasi Dua Arah**:
   - Lapisan Klien (Web/Mobile) memvalidasi format dan kelengkapan dasar via Zod / Form validation untuk memberikan respons instan kepada pengguna.
   - Lapisan Server API tetap memvalidasi ulang seluruh payload secara menyeluruh (*never trust client*).
2. **Kesesuaian Amplop Respons**:
   - Seluruh panggilan API wajib menghasilkan atau menerima struktur amplop baku sesuai spesifikasi [API_SPEC.md](file:///c:/SICA/docs/API_SPEC.md).
3. **Pengelolaan State Loading & Skeleton**:
   - Setiap komponen data grid atau kartu statistik wajib menampilkan animasi *Skeleton Shimmer* berdimensi presisi selama request data sedang berlangsung, bukan teks sederhana atau spinner putar di tengah layar.

---

## 5. Konvensi Gerbang Modul (Entitlement Gating)

Implementasi ADR-13 / DATA_MODEL §12. Satu **resolver** menjadi sumber kebenaran; tiga titik penegakan memakai resolver yang sama (DRY, tanpa flag boolean tersebar).

### 5.1 Resolver (server, single source of truth)
```ts
// apps/web/src/lib/entitlement.ts
import { db, withTenantContext } from '@sica/database';
import { modules, tenantModules } from '@sica/database/schema';
import { eq } from 'drizzle-orm';

// Cache per-tenant TTL 60s; invalidasi saat tenant_modules berubah.
export async function getActiveModuleCodes(tenantId: string): Promise<Set<string>> { /* … */ }

export async function isModuleActive(tenantId: string, code: string): Promise<boolean> {
  return (await getActiveModuleCodes(tenantId)).has(code);
}
```

### 5.2 Guard endpoint (HOF) — lapisan API
```ts
// Route handler DILAPISI guard modul; bukan cek `if` manual yang tersebar.
export const POST = withModule('lms', async (req, ctx) => { /* submit assignment */ });
// withModule: 401 tanpa sesi → 404 MODULE_NOT_AVAILABLE bila OFF → baru panggil handler.
```
Aturan: **setiap** route di `apps/web/src/app/api/v1/<domain>` **wajib** mendeklarasikan modul pemiliknya. Domain core (enrollment/assessment/…) selalu guard modul core-nya sendiri.

### 5.3 Penegakan dependensi & perubahan status (service layer)
- `activate(code)`: muat `module_dependencies`, pastikan semua prasyarat `ACTIVE/TRIAL`; jika tidak → `MODULE_DEPENDENCY_UNMET` (422).
- `deactivate(code)`: cari addon lain yang aktif & bergantung padanya → `MODULE_IN_USE` (409) bila tidak di-*force*.
- Tiap perubahan → `audit_logs` + **invalidasi cache** resolver + `invalidateQueries(['tenant-modules'])` di klien.
- Modul `is_core` tidak dapat dinonaktifkan lewat self-service (hanya platform/contract change).

### 5.4 Penyaringan UI (jangan render yang tak dibeli)
- **Web**: `sidebar.tsx` & halaman mengambil nav dari `useActiveModules()` (TanStack Query, staleTime 60s); item modul non-aktif **tidak dirender** (bukan `disabled`), dan rute langsung → layout guard redirect 404.
- **Mobile**: filter `custom_bottom_nav.dart` & menu dari daftar modul aktif yang sama (parity dual-platform, Guardrail §3.4).
- Skeleton saat resolver dimuat; jangan "flash" menu lalu hilang.

### 5.5 Kontrak bersama
Tambah `packages/contracts/src/entitlement.ts` (`TenantModuleSchema`, `ActivateModuleSchema`) sebagai sumber kebenaran TS↔Dart (lihat API_SPEC §4.5).
