# SICA Git Workflow & Version Control Standard
**Status:** Mandatory Engineering Standard  
**Role:** DevOps Lead & Release Architect  
**Branching Model:** Git Flow Adaptif (Trunk-Leaning dengan Staging & Production Protection)  

---

## 0. Repositori Remote (Source of Truth)

| | |
|---|---|
| **Remote origin** | `https://github.com/azlanirwan8-crypto/sica` |
| **Cabang utama** | `main` (protected), `staging`, branch fitur `feat/*`, `fix/*` |
| **Aturan rahasia** | `.env`, `.env.local` **WAJIB di-gitignore** (sudah di `.gitignore`). Hanya `.env.example` (placeholder) yang di-commit. `git push` wajib melewati pemeriksaan tak ada secret nyata di file ter-stage. |
| **Sebelum push** | `git status` + verifikasi `.env` tak ter-track + lint/test gate + Conventional Commits. Push ke remote = aksi shared/ireversibel → butuh konfirmasi eksplisit operator. |
| **Status awal** | ✅ **Initial push selesai 2026-10-18** (commit `0ae41ea`, 144 file). Riwayat remote (README seed `d11972c`) di-*merge* (`--allow-unrelated-histories`), **bukan** force-push. `.tools/` (toolchain node/pnpm lokal, 137MB) & `*.tsbuildinfo` di-gitignore. |

---

## 1. Aturan Branching Strategy

**Batas fakta dan rancangan (audit 2026-10-23).** Struktur branch, proteksi remote, deployment otomatis dan hook di bawah adalah **standar target**; keberadaannya harus dibuktikan pada remote/runner, bukan dari diagram. Perubahan `/docs` tidak mengaktifkan modul, menerapkan migrasi, mengubah grant atau menerbitkan rilis. Commit dan push hanya dilakukan setelah diminta secara eksplisit; jangan memasukkan perubahan kerja milik sesi lain.

Untuk sinkronisasi Fase 1, review harus mengikat FR/AC → DDL/register migrasi → permission berstatus normatif → DTO → UI → roadmap. Jalankan `node .tools/gate-run.mjs`, tetapi kelulusan alat bukan bukti seluruh kontrak semantik benar. PR rilis wajib menyertakan bukti RLS/SoD/IDOR, uji UI per peran, migrasi staging, failover dan rollback sesuai lingkupnya; usulan izin dan hasil uji yang belum dijalankan tidak boleh dilabeli selesai. Lima sudut pandang audit internal bukan persetujuan lima pakar eksternal.

Struktur percabangan repositori SICA diatur secara hierarkis guna menjamin stabilitas deployment multi-tenant:

```
[feature/krs-concurrency] ──┐
                            │ (Pull Request & CI Pass)
[feature/qr-attendance]   ──┼────────────────────────> [staging] ──(Auto-Deploy: Staging Web & APK)──┐
                            │                                                                          │ (Release PR)
[bugfix/invoice-race]     ──┘                                                                          ▼
                                                                                                    [main] ──(Auto-Deploy: Vercel Prod)
```

### 1.1 Deskripsi & Hak Akses Branch

| Nama Branch | Target Lingkungan | Karakteristik & Proteksi |
| :--- | :--- | :--- |
| `main` | **Production (`sica.ac.id`)** | **Protected.** Dilarang push langsung. Wajib melalui Pull Request (PR) dari `staging` dengan minimal 2 approval (Lead Architect + DevOps) dan 100% CI Pipeline hijau. |
| `staging` | **Staging (`staging.sica.ac.id`)** | **Protected.** Integrasi fitur sebelum rilis produksi. Terhubung ke auto-deploy Vercel Staging dan Firebase App Distribution (APK). |
| `feature/<nama-fitur>` | Lokal / Sandbox | Dibuat dari `staging`. Penamaan menggunakan kebab-case deskriptif (contoh: `feature/krs-collision-detection`). |
| `bugfix/<nama-issue>` | Lokal / Sandbox | Dibuat dari `staging` untuk perbaikan bug non-kritis (contoh: `bugfix/pdf-watermark-overlap`). |
| `hotfix/<nama-insiden>` | Production Urgent | Dibuat langsung dari `main` hanya untuk insiden Severity 1 (contoh: `hotfix/jwt-signature-bypass`). Wajib di-merge balik ke `main` dan `staging`. |

---

## 2. Standar Pesan Komit (Conventional Commits 1.0.0)

Setiap commit wajib mematuhi format terstruktur untuk mempermudah pelacakan changelog otomatis dan audit sistem:

```
<type>(<scope>): <subject singkat, imperatif, huruf kecil, tanpa titik di akhir>

[opsional body penjelasan latar belakang dan keputusan desain]

[opsional footer: Closes #123 atau BREAKING CHANGE: ...]
```

### 2.1 Jenis-Jenis Tipe Komit (`type`)

| Tipe | Kapan Digunakan | Contoh Pesan Komit |
| :--- | :--- | :--- |
| `feat` | Penambahan fitur baru yang berdampak ke pengguna | `feat(krs): tambahkan deteksi bentrok jadwal kuliah pada form krs` |
| `fix` | Perbaikan bug atau penanganan kesalahan logika | `fix(auth): cegah race condition saat rotasi refresh token` |
| `docs` | Perubahan dokumentasi saja (tanpa menyentuh kode bisnis) | `docs(api): perbarui spesifikasi response envelope endpoint presensi` |
| `refactor`| Restrukturisasi kode tanpa mengubah perilaku fitur | `refactor(database): optimasi query join rls pada modul akademik` |
| `test` | Penambahan atau perbaikan unit/integration tests | `test(grading): tambahkan skenario pembulatan ipk half-up vitest` |
| `perf` | Optimasi performa dan pengurangan waktu latensi kueri | `perf(attendance): pasang cache redis pada dynamic qr broadcast` |
| `ci` | Modifikasi pipeline GitHub Actions atau skrip rilis | `ci(github): tambahkan automated SAST semgrep audit pada pull request` |
| `chore` | Pembaruan dependencies, konfigurasi linter, atau gitignore | `chore(deps): update drizzle-orm ke versi 0.33.0` |

### 2.2 Aturan Scope (`scope`)
Gunakan nama modul atau arsitektur target, misalnya:
- `auth`, `krs`, `khs`, `attendance`, `payment`, `feeder`, `database`, `mobile`, `web`.

---

## 3. Checklist Pre-Commit Hook untuk AI Agent & Developer

Sebelum membuat commit di git, seluruh AI Agent dan engineer **WAJIB memastikan perintah-perintah validasi lokal berstatus PASS (Exit Code 0)**.

### 3.1 Skrip Verifikasi Mandiri Lokal (Pre-Commit Command Matrix)

```bash
# 1. Pastikan Kode Bersih dari Pelanggaran Tipe dan Linting
pnpm lint
# Khusus mobile Flutter:
cd apps/mobile && flutter analyze --fatal-infos && cd ../..

# 2. Pastikan Seluruh Unit & Security Tests Berstatus HIJAU (PASS)
pnpm test:unit

# 3. Pastikan Tidak Ada Format Kode yang Rusak
pnpm prettier --check "**/*.{ts,tsx,json,md}"
```

### 3.2 Implementasi Husky Pre-Commit (`.husky/pre-commit`)

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔍 [1/3] Menjalankan Linter & Type Check..."
pnpm lint-staged || exit 1

echo "🛡️ [2/3] Memeriksa Kebocoran Secret & PII di Berkas Git..."
# Cegah commit file .env asli
if git diff --cached --name-only | grep -E '\.env$|\.env\.local$'; then
  echo "❌ DITOLAK: File .env dilarang di-commit ke repositori git!"
  exit 1
fi

echo "🧪 [3/3] Menjalankan Unit Tests Cepat..."
pnpm test:unit:staged || exit 1

echo "✅ Pre-commit checklist lolos! Melanjutkan commit..."
```

---

## 4. Standar Pengajuan Pull Request (PR)

1. **Judul PR:** Mematuhi Conventional Commits (contoh: `feat(mobile): integrasi scanner qr presensi dengan validasi haversine`).
2. **Template Deskripsi PR:**
   - **Latar Belakang & Motivasi:** Masalah atau tiket apa yang diselesaikan?
   - **Perubahan Utama:** Daftar file atau arsitektur yang dimodifikasi.
   - **Bukti Pengujian:** Screenshot UI (Light/Dark mode) atau log eksekusi terminal unit test.
   - **Checklist Keamanan:** Apakah ada migrasi DB? Apakah RLS sudah terpasang? Apakah PII sudah disanitasi?
