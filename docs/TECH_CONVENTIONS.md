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

### 1.1 Struktur Direktori (*Feature-Sliced Monolith*, model target)

Pohon berikut ilustrasi target, **bukan inventaris checkout**. Source nyata memakai `apps/web/src/app` dan `apps/web/src/modules`; jangan membuat direktori baru hanya untuk menyamakan diagram. Contoh kode di dokumen ini adalah pola, bukan bukti helper/guard sudah diterapkan seluruhnya.

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

### 1.1.1 Konvensi penempatan kode Area Admin (ADM-1…ADM-9)
> Disesuaikan dengan **kenyataan pohon kode saat ini** (`apps/web/src/app/(dashboard)/…`, `apps/web/src/modules/…`) — pohon di §1.1 di atas adalah model target dan **masih drift** (mis. `(portal)/[tenant]/` belum ada). Jangan membuat pola baru untuk Admin; pakai pola yang sudah terbukti di `modules/academic`.

```
apps/web/src/app/(dashboard)/admin/
├─ layout.tsx                        # sub-nav Admin + context strip (Periode/Prodi/Status)
├─ page.tsx                          # Kesehatan Data & ringkasan tenant
├─ master/{tahun-akademik,periode,kalender,organisasi,prodi,kurikulum,
│          matakuliah,prasyarat,skala-nilai,komposisi-nilai,ruang,referensi}/page.tsx
├─ personel/{mahasiswa,dosen,staf,status-mahasiswa,dosen-wali}/page.tsx
├─ penyelenggaraan/{kelas,pengampu,jadwal,pertemuan}/page.tsx
├─ pengaturan/{akademik,cekal,tenant,modul}/page.tsx
├─ pengguna/{index,hak-akses,sesi}/page.tsx
├─ impor/page.tsx
└─ audit/page.tsx

apps/web/src/app/api/v1/admin/<objek>/route.ts            # list + create (pattern API_SPEC §4.6)
apps/web/src/app/api/v1/admin/<objek>/[id]/route.ts       # detail + PATCH + DELETE
apps/web/src/app/api/v1/admin/<objek>/[id]/{impact,deactivate}/route.ts
apps/web/src/app/api/v1/admin/<objek>/generate/route.ts   # aksi massal idempoten (bila ada)

apps/web/src/modules/admin/
├─ components/     # master-drawer.tsx, master-form-*.tsx, impact-dialog.tsx, health-panel.tsx
├─ services/       # <objek>.service.ts  ← satu-satunya tempat aturan bisnis & transaksi
├─ repository/     # <objek>.repository.ts ← signature wajib (ctx, …), tanpa ctx = compile error
├─ guards/         # require-admin.ts (JWT→role+scope→withModule→withTenantContext)
└─ types.ts        # tipe turunan (`$inferSelect`/`$inferInsert`) + DTO lokal

packages/contracts/src/master-data.ts   # SEMUA skema Zod CRUD master (satu sumber kebenaran)
packages/database/src/schema/academic-master.ts | reference.ts (baru) | settings.ts (baru)
```

**Aturan penamaan & struktur (mengikat):**
1. **Satu objek master = satu pasangan kontrak + service + repository + 2 file rute.** Tidak ada service anonim di dalam `page.tsx` (RSC hanya memanggil service, tidak menulis SQL).
2. Nama rute URL memakai **bahasa Indonesia** (`matakuliah`, `tahun-akademik`) karena menjadi menu yang dibaca staf kampus; **nama simbol kode tetap Inggris** (`courses`, `academicYears`) — AGENTS §3.6. Pemetaan dua bahasa ini disimpan di `admin/menu.ts` sebagai satu tabel, bukan tersebar di JSX.
3. Kontrak Zod CRUD wajib berformat seragam: `XSchema` (bentuk penuh), `XUpsertSchema` (create), `XUpdateSchema = XUpsertSchema.partial()`, `XListQuerySchema` (memakai `PaginationQuerySchema` yang sudah ada). Tidak ada skema "khusus halaman".
4. Service mengembalikan **discriminated union outcome** (`{ok:true,…} | {ok:false,kind:'…'}`) seperti `krs.service.ts` hari ini; rute hanya memetakan `kind` → HTTP + kode error (API_SPEC §4.6.5). Rute **tidak** berisi logika bisnis.
5. Aksi massal wajib menerima `Idempotency-Key` dan menulis hasil `{created, skipped}`; generator harus aman dijalankan ulang (pola AC-KEU-2).
6. Setiap mutasi service memanggil `emitAdminAudit(...)` (satu helper) alih-alih menulis baris audit manual, supaya bentuk `audit_logs` tidak bercabang.
7. Komponen UI admin **hanya** dari primitif Velzon (`components/ui/*`) + `VelzonDataGrid`; tidak ada kelas Tailwind lokal untuk warna/radius (UI_UX_DESIGN §2.0 & §9.1 butir 5).
8. Semua teks layar lewat `locales/{id,en}.json` dengan kunci `admin.*`; bentuk kedua file wajib identik (dijaga `tsc` lewat tipe kamus, seperti kegagalan `TS2719` yang sudah pernah terjadi).

**Kontrak `emitAdminAudit` (satu-satunya penulis baris `audit_logs` — menutup `RD-15`).** Daftar kolom mengikuti [DATA_MODEL §4](file:///c:/SICA/docs/DATA_MODEL.md) apa adanya; dokumen lain tidak boleh menambah varian.

```ts
// Ilustrasi kontrak audit; periksa helper source aktual, bukan inventaris file/migrasi.
export type AdminAuditInput = {
  readonly tenantId: string;                 // uuid, wajib; sama dengan GUC yang sedang aktif
  readonly actorUserId: string | null;       // null hanya untuk actor sintetis sistem (lihat catatan kanal)
  readonly actorRoleCtx: Readonly<Record<string, unknown>>;  // snapshot { roleCode, scope } pada saat aksi
  readonly targetEntity: string;             // 'invoices' | 'grades' | 'user_role_assignments' | …
  readonly targetId: string | null;
  readonly action: string;                   // terikat katalog: 'grade.correct' | 'invoice.void' | 'role.assign'
  readonly before: unknown | null;           // null saat INSERT
  readonly after: unknown | null;            // null saat DELETE
  readonly reason: string | null;            // wajib terisi untuk aksi sensitif (dientforce service, bukan UI)
  readonly requestId: string | null;         // = traceId amplop respons (API_SPEC §2.2)
  readonly ipHash: Uint8Array | null;        // 32 byte, JANGAN simpan IP mentah
  readonly userAgentHash: Uint8Array | null;
};

// Digest rantai: hash = SHA-256( prev_hash || canonicalJson(payload) ); `canonicalJson` = kunci
// terurut, tanpa spasi, angka sebagai string — bila kanonikalisasi berubah, rantai audit lama
// tidak dapat diverifikasi, jadi fungsinya ikut versi dan disimpan di header berkas.
export async function emitAdminAudit(tx: DbTransaction, input: AdminAuditInput): Promise<string>;
```

Empat aturan yang menempel: (1) helper dipanggil **dalam transaksi yang sama** dengan mutasi bisnis — audit di luar transaksi berarti baris audit bisa hilang saat rollback; (2) `auditId` yang dikembalikan **wajib** dipantulkan di `meta.auditId` respons (API_SPEC §2.2) sehingga klien dapat membuktikan aksinya tercatat; (3) tidak ada `UPDATE`/`DELETE` pada `audit_logs` — koreksi ditulis sebagai baris baru yang menunjuk baris lama; (4) actor kanal pembayaran memakai `channelActorId`, bukan `ctx.actorId` (INTEGRATIONS §2.3), supaya `CHECK (lifted_by <> imposed_by)` tetap bermakna.

---

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
Drizzle ORM di `packages/database` bertindak sebagai jembatan translasi resmi antara `camelCase` TypeScript dan `snake_case` PostgreSQL:

```typescript
// packages/database/src/schema/academic.ts
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

Norma ADR-13 / DATA_MODEL §12: satu resolver shared untuk menu, route dan endpoint. Contoh lama bukan bukti semua titik penegakan sudah identik atau lengkap; diperlukan tes negatif lintas tenant dan layer.

### 5.1 Resolver (server, single source of truth)
Hak efektif = **lisensi platform ∩ release availability ∩ dependency readiness ∩ tenant opt-in ∩ izin scoped**. Purchased entitlement, release flag dan tenant opt-out bukan satu boolean. Hanya platform dapat memberikan/mengubah lisensi; tenant menonaktifkan lalu mengaktifkan kembali tidak boleh menciptakan hak baru. Trial juga harus granted oleh platform, bukan jalan pintas self-service.

Cache resolver memakai tenant/context/version dalam key; perubahan hak harus menginvalidasi namespace tenant terkait. TTL 60 s hanyalah budget cache usulan, bukan izin mempertahankan akses yang sudah dicabut pada mutasi sensitif. Revalidasi otoritatif tetap server-side.

### 5.2 Guard endpoint (HOF) — lapisan API
Setiap route domain mendeklarasikan modul pemilik. Urutan pemeriksaan wajib: sesi dan tenant → entitlement/release/dependency → permission scoped → validasi Zod body/param sesuai kontrak. Entitlement mendahului permission bisnis; permission mendahului parse. Menu tersembunyi bukan otorisasi. Domain core juga memakai guard; kode HTTP dan schema tetap di API_SPEC/packages/contracts, bukan katalog baru di dokumen ini.

### 5.3 Penegakan dependensi & perubahan status (service layer)
- `activate(code)` tidak hanya mengecek dependency ACTIVE/TRIAL: lisensi platform, handler/migrasi/worker terpasang dan release availability harus terpenuhi. Tenant opt-out hanya mengurangi akses.
- `deactivate(code)` harus memeriksa dependents dan job in-flight; tidak ada force bypass tanpa otorisasi, dry-run, alasan/approval sesuai risiko dan audit. Core tidak dimatikan self-service.
- Perubahan mencatat audit/outbox dalam transaksi dan invalidasi cache scoped tenant. Query key klien juga membawa tenant; jangan menginvalidasi cache global tenant lain.
- **Tanpa redeploy hanya untuk kode/migrasi yang sudah predeployed dan kompatibel.** Handler/dependency baru tetap deploy; flag tidak memasang paket atau menutup gap migrasi. ZDD/schema/job compatibility di DEPLOYMENT_DEVOPS §4.4.

### 5.4 Penyaringan UI (jangan render yang tak dibeli)
Web/mobile mengambil keputusan dari resolver yang sama secara normatif; role label saja tidak cukup, izin scoped tetap berlaku. UI menyembunyikan modul tak berhak, rute langsung dan API tetap ditolak. Skeleton/degraded state tidak boleh membocorkan menu/data tenant sebelumnya atau menampilkan sukses palsu.

### 5.5 Kontrak bersama
`packages/contracts/src/entitlement.ts` (`TenantModuleSchema`, `ActivateModuleSchema`, `DeactivateModuleSchema`) adalah sumber kebenaran TS↔Dart (lihat API_SPEC §4.5). **Sudah ada dan terpasang**; yang salah adalah **API_SPEC** yang sempat menamai skema permintaan `ActivateModuleRequestSchema` — itu nama **tipe hasil infer** (`ActivateModuleRequest`, entitlement.ts:61), bukan nama skema (`RD-22`, diralat 2026-10-19).

---

## 6. Kontrak dependensi (`RD-11` tetap terbuka)

Norma kemampuan dibedakan dari bukti paket/source. Pemeriksaan manifest workspace dan `pnpm-lock.yaml` menemukan `bullmq`, `ioredis`, Tesseract, argon2 dan coverage-v8 belum tercantum; `@sica/logger` justru sudah tercantum pada web/database dan lockfile. Tidak ada instalasi atau test run pada sinkronisasi dokumen ini. Jumlah paket/hasil tes 2026-10-19 adalah snapshot historis, bukan status checkout sekarang.

| Kemampuan yang dinormakan | Paket | Status | Boleh dipasang pada | Rujukan yang menuntutnya |
|---|---|---|---|---|
| Queue & worker (KRS finaliser, Feeder, notifikasi) | `bullmq`, `ioredis` | ❌ belum | `R-2`/`R-6` — **hanya** bersama keputusan `P-6` (jalur sinken KRS interim vs asinkron) | AGENTS §3.7, ARCHITECTURE §4.5, INTEGRATIONS §1/§3 |
| Penyimpanan objek (presigned upload) | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` | ❌ belum | `ADM-9`/`R-5` (lampiran & berkas impor) | API_SPEC §4.8, INTEGRATIONS §4 |
| Hashing sandi target | `argon2` | ❌ belum — **interim Scrypt peppered** di `password.service.ts` | slice auth lanjutan, setelah uji migrasi hash berjalan | SECURITY §2.4, ENV_CONTRACT |
| Driver PG untuk tes RLS | `pg` (diperlukan cuplikan `TESTING_STRATEGY.md:123` yang memakai `Pool`) | ❌ belum — kenyataan repo: migrasi berjalan di **`postgres`** (`packages/database/src/migrate.ts:1`), jadi contoh tes itu **tidak dapat dijalankan apa adanya** | `SEC-0` gerbang V-2 — putuskan satu driver sebelum menulis tes | TESTING_STRATEGY §3.2, MIGRATION_SOP §5 |
| Tes RLS terhadap DB nyata | `postgres`, script `packages/database/scripts/test-rls.ts`; Testcontainers belum terpasang | Script DB nyata sudah ada; keberadaannya bukan hasil uji sesi ini. Klaim lama hanya filter array adalah historis | Uji role runtime NOBYPASSRLS pada DB terisolasi | TESTING_STRATEGY §3.2.1, MIGRATION_SOP §2.5 |
| Mock HTTP integrasi | `msw`, `@testing-library/*`, `@vitest/coverage-v8` | ❌ belum — **tidak ada gerbang cakupan yang dapat ditegakkan** | sebelum klaim coverage apa pun | TESTING_STRATEGY §4 |
| Primitif Velzon (dialog, popover, tooltip, toast) | `@radix-ui/*` | ❌ belum — komponen hari ini buatan sendiri di `components/ui/*` | `ADM-1` (drawer/modal Area Admin) | UI_UX_DESIGN §2.0/§9.1 |
| **Fondasi kerangka Velzon** (token `--bs-*`, komponen `card/nav/navbar/dropdown/forms/tables/badge/buttons`) | `bootstrap` **5.3.6** (MIT) — dipakai lewat SCSS parsial, **bukan** `bootstrap.js` | ✅ dipasang 2026-10-24 (`apps/web`, commit dependency terpisah) | sudah dipakai — lihat UI_UX_DESIGN §2.6 | UI_UX_DESIGN §2.0/§2.6, AUDIT_READINESS `RD-168` jalur B |
| Ikon kerangka & menu | `remixicon` **4.5.0** (Apache-2.0, CSS + font, tanpa API key, tanpa egress) | ✅ dipasang 2026-10-24; dipakai di kerangka (`topnav`/tema/utility). Penggantian `lucide-react` di layar isi terjadi **per layar**, bukan sekaligus | layar yang sudah dimigrasi **dilarang** menambah ikon `lucide` baru | UI_UX_DESIGN §2.5/§2.6 |
| Kompilasi SCSS templat | `sass` **1.83.4** (devDependency, MIT) | ✅ dipasang 2026-10-24 — diperlukan agar parsial SCSS Bootstrap dapat dikonfigurasi dari palet SICA | tidak ada aturan tambahan | UI_UX_DESIGN §2.6 |
| Plugin layar Lanjutan (Flatpickr, Choices.js, ApexCharts, Grid.js/DataTables) | `flatpickr`, `choices.js`, `apexcharts`/`react-apexcharts`, `gridjs` | ❌ **belum** — sengaja tidak dipasang sekarang; pemasangannya hanya sah pada PR tempat layarnya benar-benar memakai, agar tidak ada dependensi menganggur | saat layar pemakainya dikerjakan (ROADMAP `UI-VLN-3…5`) | UI_UX_DESIGN §2.6/§11.11 |
| Kriptografi kolom PII (CE-5.6) | **tidak ada paket baru** — `node:crypto` `createCipheriv('aes-256-gcm')` + `createHash` untuk blind index & `ip_hash`; **`pgcrypto` TIDAK dipakai** | ❌ belum — `pg`/`postgres` saja tidak menyediakan GCM ter-envelop; `crypto` adalah modul bawaan Node, jadi tidak perlu lockfile | `R-1`/CE-5.6, **setelah** `TENANT_ENCRYPTION_MASTER_KEY` sah di `env.ts` | SECURITY_COMPLIANCE §3.7.2, ENV_CONTRACT §6.3, ROADMAP §4.2.1 |
| Chart premium Velzon | **tidak ada paket baru** — primitif SVG buatan sendiri (`components/ui/velzon-chart.tsx`, spline monotone Fritsch–Carlson) | ✅ dipasang sebagai kode, **bukan** dependensi; `apexcharts`/`recharts` **sengaja tidak** dipasang | tidak perlu — sudah jadi | UI_UX_DESIGN §11.5 |
| `@sica/logger` | workspace package | Sudah dideklarasikan di manifest web/database dan pnpm-lock.yaml; TS2307 pada snapshot lama bukan temuan dependency saat ini | Typecheck harus dijalankan terpisah sebelum klaim lulus | PROGRESS §5.29 adalah riwayat |

**Keputusan tercatat untuk baris kriptografi (penutup `CE-5.7`, 2026-10-19).** Enkripsi dilakukan **di lapisan service Node**, bukan di database. Alasan: (1) `pgcrypto` menyimpan kunci di dalam sesi DB sehingga rotasi per-tenant dan pemisahan tugas DBA/aplikasi jadi kabur, sementara bentuk ciphertext `format_version ‖ key_version ‖ iv ‖ tag ‖ ciphertext` menuntut versi kunci menempel pada data; (2) GCM butuh **IV acak unik per pemakaian** — di SQL ini mudah salah dan sulit diuji; (3) blind index (`*_bidx char(64)`) harus dapat dihitung dari plaintext oleh layanan yang berhak tanpa membuka dekripsi, dan itu lebih terbaca di TypeScript; (4) konsekuensi yang **wajib** diterima: filter/pencarian pada kolom terenkripsi hanya lewat blind index, **tidak** lewat `LIKE` — laporan yang butuh rentang nilai pada kolom S1/S2 tidak dapat dibuat dan itu keputusan produk, bukan bug. Master key per tenant berasal dari **KMS/Vault**, bukan dari env produksi (`TENANT_ENCRYPTION_MASTER_KEY` hari ini hanya sah untuk dev dan **belum ada di `env.ts`**).

**Aturan.** (1) Kode baru yang membutuhkan paket dari tabel ini **membuka perubahan `package.json` + lockfile sebagai commit terpisah**, tidak menyelipkannya ke PR fitur. (2) Dokumen tidak boleh menulis "sudah dipakai" untuk baris berstatus ❌ — yang boleh ditulis adalah "dinormakan, belum dipasang". (3) `pnpm-workspace.yaml` belum punya katalog versi; sampai ada, versi paket dicatat di `package.json` paket pemakainya dan di baris tabel ini. (4) Hasil tsc/Vitest 15 berkas/128 uji dan kegagalan logger pada 2026-10-19 adalah **riwayat**, bukan hasil validasi checkout sekarang. Laporkan perintah, commit dan keluaran terbaru sebelum klaim lulus/gagal. (5) Baris baru di tabel ini **wajib** menyebut rujukan yang menuntutnya — tanpa itu, audit berikutnya akan menyangkanya paket hantu. (6) **Bootstrap tidak pernah diimpor utuh.** Yang diimpor hanya parsial yang terdaftar di `UI_UX_DESIGN §2.6` (`root`, komponen kerangka, `forms`, `buttons`, `badge`, `card`, `tables`, `dropdown`, `nav`, `navbar`, `progress`, `list-group`, `pagination`, `close`, `modal`, `alert`, `images`, `containers`) dan semuanya dibungkus `@layer bootstrap`. `utilities/api` dan `grid` **dilarang** karena kelas `.p-3/.row/.col-*/.text-primary` Bootstrap bertabrakan namanya dengan utilitas Tailwind yang sudah dipakai ±34 berkas; `.bg-*-subtle`/`.text-*-emphasis` yang dibutuhkan Velzon dicetak sendiri dari peta `$theme-colors-*` sehingga tidak ada utilitas ganda. (7) Aset template Velzon yang **berbayar** (CSS/SCSS/JS/halaman hasil pembelian ThemeForest atau themesbrand) tidak boleh disalin ke repo ini sampai pemilik produk menyediakan paket terlisensi dan barisnya tercatat di tabel ini; yang dibangun sekarang adalah **struktur dan kosakata kelas** Velzon di atas fondasi MIT/Apache — klaim "memakai template Velzon" tetap dilarang. (8) `bootstrap.js` tidak dipasang: seluruh perilaku interaktif (dropdown, modal, pengalih tema) tetap primitif React kita yang sudah diuji, karena runtime DOM pihak ketiga bertarung dengan hidrasi App Router.

---

## 7. Dependensi design-only & gerbang CI nol-API-key / nol-hardcoding — 2026-10-20

Norma pemilik: **AGENTS §3.9** (nol-API-key) dan **AGENTS §3.10** (nol-hardcoding data master). Tabel ini adalah daftar **yang belum terpasang** — pola pencatatannya sama dengan §6. Tidak ada satu pun baris di bawah yang boleh dikutip sebagai kemampuan berjalan.

| Kemampuan | Yang akan dipakai | Status terukur di repo | Gerbang sebelum boleh diklaim |
|---|---|---|---|
| Solver penjadwalan (ALG-8) | OR-Tools CP-SAT (Apache-2.0, tanpa API key) di container worker sendiri | belum terpasang; jalur utama = backtracking + propagasi TypeScript (ARCHITECTURE §12.2.3) | commit package.json/lockfile atau image worker terpisah + bukti hasil tidak lebih buruk dari jalur TS pada instance fixtured yang sama |
| Model ML EWS (ALG-10) v2 | ONNX Runtime atau worker Python (scikit-learn/XGBoost hanya untuk pelatihan offline) | belum terpasang; v1 = koefisien/pohon JSONB berversi diskor evaluator deterministik (§12.2.4) | keputusan produk P-11 tercatat + ambang v1 terbukti tidak mencapai AUC/Brier §12.5.5 |
| OCR dokumen (ALG-7) | Tesseract v5 di container milik sendiri (eng+ind) | belum terpasang; Lapis 1 (medan formulir + layer teks PDF) adalah rancangan tanpa OCR, bukan bukti pipeline ekstraksi sudah berjalan | image + kuota CPU per tenant + uji dokumen pindai; tulisan tangan tetap tidak didukung |
| Antrean & Redis (KRS War, engine) | bullmq, ioredis | bukan dependensi (RD-11/P-6); antrean engine_runs + SKIP LOCKED juga desain, bukan runtime sekarang. KRS nyata masih service sinkron advisory-lock; queue_operations/0030 dan harness masih gerbang | commit paket + runbook DLQ + uji beban ARCHITECTURE §10.8 |
| Hash & HMAC di sisi DB | pgcrypto digest() | extension diizinkan di Supabase; kanonisasi SENGAJA tetap di aplikasi | jangan memindahkan kanonisasi ke pemicu tanpa vektor uji yang sama (paritas Flutter) |

**Snapshot historis utang nol-hardcoding 2026-10-20** (bukan inventaris checkout sekarang):

| Area | Berkas | z.enum( | <option> literal | options={[ | font-black/extrabold | biru literal | var(--sica-color- |
|---|---|---|---|---|---|---|---|
| apps/web/src | 87 | 3 | 1 | 0 | 0 | 0 | 0 |
| apps/mobile/lib | 17 | 0 | 0 | 0 | 0 | 0 | 0 |
| packages/contracts/src | 8 | 29 | 0 | 0 | 0 | 0 | 0 |

Cara membacanya, supaya satu angka tidak dipakai untuk dua klaim: **29 `z.enum(` di `packages/contracts/src` kemungkinan besar kelas A/A-prime** (verba izin, keadaan antrean, status transaksi) dan karena itu sah — tetapi belum ada dokumen yang memisahkan mana kelas A dan mana kelas C/D. Itu dicatat sebagai gap `RD-41` dan menjadi tugas `MDE-*` di ROADMAP §2.13, bukan pekerjaan yang boleh dianggap beres karena angkanya kecil. Tiga `z.enum(` dan satu `<option>` di sisi web adalah kandidat kuat pelanggaran kelas C (pilihan yang seharusnya dibaca dari `/api/v1/master/lookups`) dan wajib di-triage **sebelum** gerbang CI (m) dipasang, kalau tidak gerbang itu merah sejak hari pertama dan akan dimatikan orang.

**Gerbang CI yang dinormakan siklus ini** (norma; implementasinya adalah task ROADMAP, bukan fakta hari ini):

| # | Gerbang | Sumber norma |
|---|---|---|
| (g) | egress scan: `fetch(` / `axios` / `https.request` di dalam direktori engine membuat build merah | AGENTS §3.9, ARCHITECTURE §11.1 |
| (h) | golden vector: tiap `engine_code` menghasilkan keluaran byte-identik dari input fixtured; seed PRNG tersimpan di `engine_runs` | ARCHITECTURE §11.2, §12.3 |
| (i) | paritas numerik TypeScript ↔ Dart untuk semua pembobotan (basis poin, bukan float) | AGENTS §3.4, ARCHITECTURE §12.12 |
| (j) | empat titik kegagalan RBAC + uji bahwa keluaran engine tidak dapat menulis tabel domain | AGENTS §3.8, DATA_MODEL §18.9 |
| (k) | verifier rantai audit: satu baris fixture diubah wajib menghasilkan `HASH_MISMATCH` | ARCHITECTURE §12.9, SECURITY §3.6.6 |
| (l) | daftar-terlarang atribut model ML tidak pernah muncul di `ml_model_versions.features` | ARCHITECTURE §12.5, DATA_MODEL §18.9(6) |
| (m) | scanner kosakata literal untuk field kelas C/D (array opsi, `<option>`, `z.enum` pada field berkamus) | AGENTS §3.10, DATA_MODEL §20.1 |
| (n) | setiap `kind` yang dibaca UI wajib punya baris `reference_kind_usage` | DATA_MODEL §20.3 |
| (o) | `CHECK (col IN …)` hanya untuk kolom yang tercatat di register enum §15.1/§15.2/§15.3 | DATA_MODEL §20.1 |
| (p) | scanner nama menolak tabel kamus kembar berbetuk `(code, name)` | DATA_MODEL §14.8, §20.2 |
| (q) | **ambang tidak boleh menjadi konstanta**: engine/service yang memutuskan berdasarkan ambang wajib membaca nilainya dari `master_system_parameters`/`academic_rules`; nilai literal di kode adalah temuan (contoh temuan historis 2026-10-20: `>= 75` di dashboard; bukan klaim baris tersebut masih ada) | AGENTS §3.10, DATA_MODEL §21.1–§21.3, SECURITY §12.7 |
| (r) | **golden vector deret** untuk generator berurutan (NIM ALG-18, nomor surat, nomor kwitansi): pola + urutan permintaan yang sama wajib menghasilkan deret yang sama; `MAX()+1` dilarang, `sequence` per prefix wajib | ARCHITECTURE §12.17, §12.20 |

## 8. Perluasan Phase 1, operasi aman dan bukti rilis

Nama/ID modul tetap PRD §5.12.1; peta engine dan bukti Phase 1A/R-1 serta 1B/R-2 di ARCHITECTURE §13.9. Jangan membuat katalog FR/RBAC/API atau dokumen arsitektur/staging paralel.

- Bedakan **target**, **source tersedia**, **uji lulus**, dan **deployed**; tiap klaim menyebut artefak/lingkungan/versi. Dependency atau migrasi ada bukan bukti engine berjalan. Jangan menjanjikan Redlock O(1), kapasitas 10k–100k, zero table locks atau zero downtime tanpa pengukuran.
- Pertahankan Lua atomic reservation, hash-slot colocation Cluster, lease/fencing durable, finalizer idempoten, DLQ dan DB constraints sebagai satu desain. Sentinel HA bukan sharding. At-least-once worker membutuhkan recovery/commit-unknown reconciliation dan budget; KRS sync tetap interim RD-11/P-6.
- Sesi dan hash refresh token durable PostgreSQL. Stateless app/shared Redis cache atau revocation index tidak memindahkan auth/audit source of truth. Cache clear hanya namespace tenant yang diotorisasi, tidak FLUSHALL/FLUSHDB atau penghapusan lease/queue/sesi.
- Portal job read-only default; retry/cancel melalui server allowlist, RBAC scoped/MFA/approval sesuai risiko, alasan/audit serta pemeriksaan epoch/state/idempotency/budget. Tidak ada SQL console/shell atau raw credential/payload. CPU/RAM/DB/Redis telemetry harus redacted.
- Export/restore tenant memerlukan izin/approval, checksum + manifest tersamarkan, staging terisolasi tanpa egress, FK/totals/audit-chain/outbox reconciliation. Tidak ada arbitrary cluster restore; SOP di MIGRATION_SOP §4 dan DEPLOYMENT_DEVOPS §6.2.
- Engine tanpa API-key/egress: seed, stable ordering, snapshot/version, budget dan golden vectors; proposal memerlukan persetujuan manusia. Currency integer/basis poin sesuai DATA_MODEL. Tesseract belum dipasang; jangan menampilkan draft OCR sebagai hasil resmi.
- GeoIP offline hanya lokasi kasar berlabel, bukan pelacakan tepat. Isolation Forest/LOF lokal adalah exploratory anomaly score; tidak menjamin malicious classifier atau auto-block tanpa policy, approval dan review/banding.
- ZDD target blue-green/rolling: readiness dependensi/versi, graceful drain worker/SSE, schema/API/job N/N-1, expand-contract, concurrent index di luar transaksi, bounded timeouts. Tidak deploy saat destructive DDL. Jalankan smoke/failure/rollback dengan latency/error/oversell/recovery acceptance di DEPLOYMENT_DEVOPS §6.3 sebelum klaim produksi.

**Catatan proses historis.** Siklus 2026-10-20 adalah siklus dokumen: tidak ada paket yang dipasang, tidak ada migrasi yang ditulis, dan `next build` tidak dijalankan ulang untuk membuktikan kode. Yang diverifikasi ulang adalah alat yang memang ada dan masih relevan: `contrast-audit.mjs` menghasilkan **FAILS = 0** pada dua tema dan `purge-check.mjs` menghasilkan **0 dari 59** kelas design-system hilang dari artefak CSS (67.412 byte). Keduanya harus dijalankan dari **akar repo**; dijalankan dari `apps/web` menghasilkan ENOENT pada `globals.css` dan `.next/static/css`, yaitu kegagalan alat, bukan kegagalan desain (terjadi dua kali sebelum dibaca benar).
