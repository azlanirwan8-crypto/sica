# SICA — Pedoman Desain UI/UX & Standar Komponen (Web & Mobile)

Dokumen ini mendefinisikan standar desain antarmuka (*User Interface*) dan pengalaman pengguna (*User Experience*) untuk ekosistem **SICA (Sistem Informasi Campus Akademik)** pada platform Web (Next.js) dan Mobile (Flutter).

| | |
|---|---|
| **Versi** | 1.1 (Enterprise Fullstack Specification) |
| **Desain Web** | Velzon Enterprise Dashboard (Next.js 15+ App Router / React 19) + **Tailwind CSS** + **shadcn/ui** + **Lucide Icons** + **Sonner Toast** + **Framer Motion** + Skeleton Loading |
| **Desain Mobile** | Flutter Material 3 (Design Tokens terpetakan ke Velzon Theme) + **shadcn_ui Flutter** + **Delightful Toast** + **Awesome Dialog** + **Skeletonizer** |
| **Dokumen Terkait** | [INDEX.md](file:///c:/SICA/docs/INDEX.md) · [PRD.md](file:///c:/SICA/docs/PRD.md) · [TECH_CONVENTIONS.md](file:///c:/SICA/docs/TECH_CONVENTIONS.md) |

---

## 1. Fondasi Desain & Sistem Warna (Design Tokens)

SICA mengadopsi tema **Velzon Theme Suite** dengan penyesuaian khusus untuk domain institusi pendidikan tinggi Indonesia: estetika modern, kontras rasio WCAG 2.1 AA (≥ 4.5:1), dan dukungan penuh *Dark Mode* serta multi-branding per tenant kampus.

### 1.1 Palet Warna Baku (Velzon Theme Tokens)

```
        Primary (#3577f1)          Success (#0ab39c)          Warning (#f7b84b)
     ┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
     │  Aksi Utama / Brand  │   │ Lunas / KRS Disetujui│   │  Tagihan Menunggak   │
     └──────────────────────┘   └──────────────────────┘   └──────────────────────┘
        Danger (#f06548)            Info (#299cdb)            Accent (#405189)
     ┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
     │ Cekal / Kuota Penuh  │   │  Informasi Kalender  │   │  Sidebar & Header    │
     └──────────────────────┘   └──────────────────────┘   └──────────────────────┘
```

| Token Warna | Hex Code | Penggunaan di Web (Next.js) | Penggunaan di Mobile (Flutter) |
|---|---|---|---|
| **Primary** | `#3577f1` | Tombol CTA utama, tab aktif, link interaktif, focus ring. | `colorScheme.primary`, AppBar aksi utama, FloatingActionButton. |
| **Secondary / Accent** | `#405189` | Warna sidebar default (dark navy), badge status modul. | `colorScheme.secondary`, card header tint, divider penanda. |
| **Success** | `#0ab39c` | Status pembayaran `LUNAS`, KRS disetujui, kehadiran hadir. | `colorScheme.tertiary`, icon checklist, status lunas badge. |
| **Info** | `#299cdb` | Notifikasi jadwal kuliah, status KRS draft, pengumuman. | Badge jadwal hari ini, alert box akademik, banner status. |
| **Warning** | `#f7b84b` | Tagihan mendekati jatuh tempo, peringatan batas presensi. | Status tagihan cicilan, peringatan evaluasi SKS. |
| **Danger** | `#f06548` | Tagihan *Overdue*, cekal aktif, kelas penuh, tolak KRS. | Banner cekal, alert penolakan transaksi, indikator bentrok. |
| **Dark Base (Navy)** | `#212529` | Background Dark Mode (`#1a1d21`), teks heading utama. | `colorScheme.surface` Dark, header background. |
| **Light Base (Slate)**| `#f3f3f9` | Background body Light Mode, table header zebra. | `colorScheme.surface` Light, canvas background. |

### 1.2 Skema Warna Mode Terang & Gelap (*Light & Dark Mode Tokens*)

```css
/* apps/web/styles/tokens.css */
:root {
  /* Mode Terang (Default) */
  --sica-bg-body: #f3f3f9;
  --sica-bg-card: #ffffff;
  --sica-bg-sidebar: #405189;
  --sica-text-sidebar: #abb9e8;
  --sica-text-sidebar-active: #ffffff;
  --sica-text-primary: #495057;
  --sica-text-heading: #212529;
  --sica-text-muted: #878a99;
  --sica-border: #e9ebec;
  --sica-input-bg: #ffffff;
}

[data-theme='dark'] {
  /* Mode Gelap (Enterprise Night) */
  --sica-bg-body: #14171a;
  --sica-bg-card: #1e2227;
  --sica-bg-sidebar: #171a1e;
  --sica-text-sidebar: #878a99;
  --sica-text-sidebar-active: #ffffff;
  --sica-text-primary: #ced4da;
  --sica-text-heading: #f3f6f9;
  --sica-text-muted: #798399;
  --sica-border: #292e35;
  --sica-input-bg: #262a2f;
}
```

### 1.3 Tipografi & Skala Hirarki

- **Primary Web Font**: `Plus Jakarta Sans`, `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`. Dimuat via Google Fonts `<link>` di `app/layout.tsx` (weight 400–800, `display=swap`) dan dipetakan ke `theme.extend.fontFamily.sans` di `tailwind.config.ts` agar utilitas `font-sans` konsisten. *(Menggantikan `Inter` — keputusan refactor login "Principal Lead UI/UX Engineer", lihat [PROGRESS_REPORT.md §5.21](file:///c:/SICA/docs/PROGRESS_REPORT.md).)*
- **Primary Mobile Font**: `Poppins` (Headings & Badges), `Inter` (Data Body & Numbers). *(Belum diubah — sisi Flutter belum masuk sprint ini.)*
- **Tabular Numbers Font**: `font-variant-numeric: tabular-nums` (wajib untuk seluruh kolom angka: NIM, IPK, SKS, Rupiah, dan Jam Perkuliahan).

| Tingkat Hirarki | Ukuran / Line Height | Bobot (*Weight*) | Penggunaan |
|---|---|---|---|
| **Display / H1** | 28px / 36px | Semi-Bold (600) | Judul Halaman Dashboard, Banner Saldo UKT. |
| **Heading / H2** | 22px / 28px | Semi-Bold (600) | Judul Section Kartu Rencana Studi, Roster Kelas. |
| **Title / H3** | 16px / 24px | Medium (500) | Judul Card Komponen, Modal Header. |
| **Body Regular** | 14px / 20px | Regular (400) | Teks Konten Utama, Nilai Tabel, Input Form. |
| **Body Small** | 12px / 16px | Regular (400) / Medium (500) | Helper Text Form, Timestamp Log, Sub-label. |
| **Micro / Badge** | 10px / 14px | Semi-Bold (600) | Status Badge (`LUNAS`, `CUTI`, `AKREDITASI A`). |

---

## 2. Standar Komponen Web (Next.js / Velzon Suite)

### 2.0 ATURAN WAJIB — Seluruh UI Wajib Memakai Design System Velzon
> **Setiap komponen antarmuka (tombol, input, kartu, badge, form, navigasi, dsb.) WAJIB memakai design system Velzon** — token warna/radius/shadow di `styles/velzon-theme.css` + primitif bersama `components/ui/*` (`Button`, `Input`, `Card`) — **bukan** gaya Tailwind mentah hasil "AI look" (mis. `rounded-xl shadow-lg`, label `uppercase tracking-wider` yang dipaksakan). Bila butuh varian baru, tambah ke primitif/token Velzon, jangan mengarang kelas lokal.
- **Radius kanonik Velzon**: `rounded-md` = **8px** (tombol & input). Bukan 12/16px.
- **Tombol primer** (`.btn-primary` / `Button variant="default|success"`): datar (`shadow-sm`), `font-semibold`, `active:scale-[0.98]`, focus-ring lembut.
- **Input** (`.velzon-input`): latar **putih**, border tipis `#e9ebec`, radius 8px, `padding 10px 14px`, fokus = border primary + ring `0 0 0 3px` warna primary @15%.
- **Label form**: `text-sm font-semibold`, **normal-case** (BUKAN uppercase), warna `slate-700`.
- **🎨 Warna PRIMARY Velzon = HIJAU TEAL `#0ab39c`** (dibuktikan halaman `auth-signin-cover` resmi Velzon: tombol "Sign In" hijau). **✅ RESOLVED (2026-10-19):** token `--sica-color-primary` & `velzon.primary` **sudah dipindah ke hijau `#0ab39c`** (hover `#089e85`) menyeluruh — dashboard, header, tautan, fokus, tombol, `themeColor` — agar 100% Velzon. Biru `#299cdb` kini dipertahankan hanya sebagai aksen **info** sekunder.

### 2.1 Kartu Statistik Indikator (*Stat Cards with Delta*)
Digunakan pada dashboard Mahasiswa, Dosen, Kaprodi, dan Pimpinan untuk menyajikan KPI ringkas.

```
┌────────────────────────────────────────────────────────┐
│ TOTAL SKS DITEMPUH                        [Icon Book]  │
│ 118 / 144 SKS                                          │
│ ────────────────────────────────────────────────────── │
│ [▲ +18 SKS] Semester Genap 2025/2026      Target: 144  │
└────────────────────────────────────────────────────────┘
```
- **Spesifikasi**: Border radius 8px, background `--sica-bg-card`, box-shadow soft (`0 1px 2px rgba(56,65,74,0.15)`).
- **Elemen Wajib**: Label metrik (uppercase 11px), angka utama (tabular-nums bold 22px), badge delta status (+/- persentase atau SKS), dan icon konteks.

### 2.2 Tabel Data Terkelola (*Enterprise Data Grid*)
Digunakan untuk Roster Mahasiswa, Rencana Studi (KRS), Riwayat Nilai (KHS), dan Buku Besar Keuangan.

- **Header**: Sticky header dengan background ter-shading, tombol sorting per kolom, filter dropdown, dan pencarian cepat real-time.
- **Paginasi**: Baris per halaman (10, 25, 50, 100), indikator range data ("Menampilkan 1-25 dari 1.420 data"), navigasi halaman dinamis.
- **Tindakan Massal (*Batch Actions*)**: Muncul otomatis di baris atas saat checkbox baris dicentang (misal: "Pilih Semua (200 Mahasiswa) → Setujui KRS Massal").
- **Aksesibilitas**: Keyboard navigation (`Tab`, `Arrow Up/Down`), ARIA table roles lengkap.

### 2.3 Wizard Formulir Bertahap (*Multi-Step Wizard Form*)
Diterapkan pada alur registrasi mahasiswa baru (PMB), pengajuan yudisium, dan pendaftaran proposal skripsi.

```
  ( 1. Data Diri ) ──▶ ( 2. Berkas Syarat ) ──▶ [ 3. Pembayaran ] ──▶ ( 4. Selesai )
      [Active]              [Active]                [Current]             [Pending]
```
- Indikator progres visual bernomor dengan persentase penyelesaian.
- Validasi instan di setiap langkah menggunakan Zod resolver sebelum mengizinkan tombol *"Lanjut ke Langkah Berikutnya"*.
- Penyimpanan draft otomatis (*auto-save*) ke LocalStorage / Redis Session.

### 2.4 Modal Konfirmasi & Drawer Aksi Cepat
- **Modal Berbahaya (*Destructive Action*)**: Wajib menggunakan aksen warna Danger (`#f06548`), menyertakan input konfirmasi teks (misal mengetikkan kata *"BATALKAN"* untuk void tagihan), dan tombol approval ganda.
- **Side Drawer**: Digunakan untuk melihat detail log audit baris, preview silabus RPS mata kuliah, atau mutasi ledger tanpa meninggalkan halaman aktif.

### 2.5 Ekosistem Komponen UI & Animasi Web (shadcn/ui + Lucide + Sonner + Framer Motion)
- **Tailwind CSS & CSS Variables**: Mengintegrasikan seluruh token Velzon ke dalam konfigurasi utilitas Tailwind CSS (`theme.extend.colors`).
- **shadcn/ui Base**: Komponen berbasis Radix UI primitives yang di-style dengan Velzon tokens (`Button`, `Input`, `Dialog`, `DropdownMenu`, `Card`, `Badge`, `Tabs`, `Skeleton`).
- **Lucide React Icons**: Seluruh icon navigasi, status, dan aksi wajib menggunakan icon pack konsisten dari `lucide-react`.
- **Sonner Toast**: Umpan balik notifikasi asinkron menggunakan library `sonner` dengan styling Velzon (Success: Hijau `#0ab39c`, Error: Merah `#f06548`, Info: Biru `#299cdb`).
- **Framer Motion**: Micro-interaction lembut (fade in, slide-up modal, hover lift, card stagger animations) dengan durasi 0.2s - 0.3s.

---

## 3. Standar Desain Aplikasi Mobile (Flutter Material 3)

Antarmuka mobile SICA dibangun di atas framework **Flutter** dengan paradigma **Material 3 (M3)** yang dipetakan secara simetris terhadap Design Tokens Velzon.

### 3.1 Pemetaan Token ke Flutter `ThemeData`

```dart
// lib/core/theme/sica_theme.dart
import 'package:flutter/material.dart';

class SicaTheme {
  static const Color primaryBlue = Color(0xFF3577F1);
  static const Color accentNavy  = Color(0xFF405189);
  static const Color successTeal = Color(0xFF0AB39C);
  static const Color warningGold = Color(0xFFF7B84B);
  static const Color dangerCoral = Color(0xFFF06548);
  static const Color infoSky     = Color(0xFF299CDB);

  static ThemeData lightTheme = ThemeData(
    useMaterial3: true,
    fontFamily: 'Inter',
    colorScheme: const ColorScheme(
      brightness: Brightness.light,
      primary: primaryBlue,
      onPrimary: Colors.white,
      secondary: accentNavy,
      onSecondary: Colors.white,
      error: dangerCoral,
      onError: Colors.white,
      surface: Color(0xFFFFFFFF),
      onSurface: Color(0xFF212529),
      surfaceContainerLowest: Color(0xFFF3F3F9), // Canvas Background
    ),
    cardTheme: CardTheme(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFFE9EBEC), width: 1),
      ),
      color: Colors.white,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: Color(0xFF212529),
      elevation: 0,
      scrolledUnderElevation: 1,
      centerTitle: false,
    ),
  );

  static ThemeData darkTheme = ThemeData(
    useMaterial3: true,
    fontFamily: 'Inter',
    colorScheme: const ColorScheme(
      brightness: Brightness.dark,
      primary: Color(0xFF5B93F7),
      onPrimary: Colors.white,
      secondary: Color(0xFF7B8BB2),
      onSecondary: Colors.white,
      error: Color(0xFFF4856E),
      onError: Colors.white,
      surface: Color(0xFF1E2227),
      onSurface: Color(0xFFF3F6F9),
      surfaceContainerLowest: Color(0xFF14171A),
    ),
  );
}
```

### 3.2 Navigasi Bawah Khusus (*Custom Bottom Navigation Bar*)
Navigasi mobile dirancang ramah satu tangan (*one-hand usability*):

```
┌────────────────────────────────────────────────────────┐
│  [Home]      [Jadwal]       ( QR Scan )     [KRS]      [Profil]│
│    🏠           📅             📷           📝           👤  │
└────────────────────────────────────────────────────────┘
```
- **Tombol Tengah Melayang (*Floating QR Action*)**: Berada di tengah dengan ukuran 56×56px bergradasi Primary Blue, digunakan mahasiswa untuk scan QR Presensi Kelas atau dosen untuk men-generate token pertemuan.
- **Badge Indikator**: Menampilkan badge merah angka untuk tagihan baru atau tugas belum dinilai.

### 3.3 Kartu Tanda Mahasiswa Digital (*Digital KTM Hologram Badge*)
Komponen identitas digital resmi di dalam aplikasi mobile:
- **Tampilan Muka**: Foto mahasiswa berbingkai rasio 3:4, Nama Lengkap, NIM (font tabular), Program Studi, Jenjang, Status Aktif Semester berjalan, dan Watermark Logo Institusi Kampus.
- **Efek Visual**: Lapisan shader gradasi holografik yang bergeser dinamis mengikuti gyroscope/sensor kemiringan smartphone untuk mencegah pemalsuan tangkapan layar (*anti-screenshot fraud*).
- **Tampilan Balik / Barcode**: Dilengkapi QR code terenkripsi dan Barcode Code-128 standar perpustakaan kampus untuk integrasi pintu gerbang (*turnstile gate*) dan sirkulasi buku.

### 3.4 Kartu Jadwal Kuliah Hari Ini (*Schedule Timeline Cards*)
- Menampilkan rentang jam (misal `08:00 - 09:40 WIB`), kode mata kuliah, nama kelas paralel (misal `IF201 - Kelas B`), nama dosen pengampu, dan kode ruang kuliah (`LAB-KOMP-02`).
- **Garis Status Waktu Riil**: Kartu perkuliahan yang sedang berlangsung ditandai dengan border kiri tebal berwarna Primary Blue (`#3577f1`) dan badge *"Sedang Berlangsung"*, sedangkan kelas yang selesai ditandai dengan warna netral teredup (*muted*).

### 3.5 Overlay Scanner QR Presensi (*Camera Scanner Overlay*)
- Menggunakan library `mobile_scanner` dengan frame jendela pemindaian 260×260px di tengah layar.
- Garis laser pemindai animasi vertikal bolak-balik dengan sudut bingkai bundar (radius 16px).
- Haptic feedback (getaran lembut) dan konfirmasi suara bip instan saat QR token berhasil terbaca.

---

## 4. Standar Responsivitas & Breakpoints Grid

> **Keputusan layout (2026-10-19):** SICA memakai **Velzon "layout horizontal"** — **menu utama mendatar di baris kedua header**, BUKAN sidebar vertikal. Komponen `sidebar.tsx`/`header.tsx` lama telah dihapus dan digantikan `components/layout/top-nav.tsx`.

**Struktur header horizontal (2 baris):**
- **Baris 1:** brand (emblem + lockup) · pencarian · ikon utilitas (bahasa, modul, layar penuh, mode gelap, notifikasi ber-badge) · kartu profil (avatar + nama + peran).
- **Baris 2:** menu navigasi berikon dengan dropdown (Dashboard · Akademik ▾ · Lainnya ) · pill institusi aktif · tombol keluar. Item tanpa halaman ditandai badge **"Segera"** (bukan link mati).

| Breakpoint | Rentang Lebar | Mode Layout SICA Web |
|---|---|---|
| **Mobile (`sm`)** | `< 768px` | Baris menu (baris 2) collapse ke **hamburger/offcanvas**; utilitas & kartu profil disembunyikan; tabel jadi tumpukan kartu. |
| **Tablet (`md`)** | `768px – 1024px` | Hamburger aktif (menu baris 2 masih tersembunyi < 1024px); pencarian tampil ≥ 1280px; grid widget menyesuaikan. |
| **Desktop (`lg` / `xl`)**| `> 1024px` | Header 2 baris penuh; menu mendatar + dropdown hover; data grid multi-kolom; widget dashboard 3–4 kolom. |

```
Desktop (>1024px) — Velzon horizontal layout:
┌──────────────────────────────────────────────────────────────────────┐
│ [Logo]  [ Search… ]                     [🌐][▦][][🌙][🔔³] (Avatar) │  Baris 1
├──────────────────────────────────────────────────────────────────────┤
│ ⊞ Dashboard   🎓 Akademik ▾   ▦ Lainnya ▾            (•) Kampus  ⎋ Keluar │  Baris 2 (menu)
├──────────────────────────────────────────────────────────────────────┤
│ [Stat Card 1]  [Stat Card 2]  [Stat Card 3]  [Stat Card 4]            │
├──────────────────────────────────┬───────────────────────────────────┤
│ Main Content (Data Table)        │ Side Widget (Kalender)            │
└──────────────────────────────────┴───────────────────────────────────┘
```

### 4.1 Lockup Brand SICA
- **Emblem** (`public/sica-emblem.png`, background transparan, hasil `scripts/make-logo-transparent.mjs` + `scripts/crop-logo-emblem.mjs`) dipakai berdampingan dengan tipografi asli: **"SICA"** (extrabold) di atas **"SYSTEM INTEGRATION CENTRAL ACADEMIC"** (uppercase, letter-spacing lebar).
- Varian `dark` untuk latar gelap (halaman login); `priority` untuk LCP; dipakai sebagai favicon & OG image.

### 4.2 Sistem Motion (Web)
- Landing & transisi memakai **IntersectionObserver + animasi CSS** (`components/landing/motion.tsx`: `Reveal`, `CountUp`; keyframes di `globals.css`), bukan hanya Framer Motion, agar ringan di server component.
- Wajib menghormati **`prefers-reduced-motion: reduce`** (semua animasi non-esensial dinonaktifkan).
- Header landing: sticky + scroll-spy (menandai menu aktif) + bilah progres baca + shadow saat digulir.

### 4.3 Halaman Login Split-Screen (Velzon) — Kontrak Tipografi
Refactor "Principal Lead UI/UX Engineer" menetapkan kelas Tailwind eksplisit (bukan komponen Card/Button abstrak) agar bentuk huruf & proporsi **identik di zoom 80% vs 100%**. Font: **Plus Jakarta Sans**.
- **Root**: `flex h-screen max-h-screen w-full overflow-hidden` — mengunci viewport, cegah scroll/liar; panel kanan punya `overflow-y-auto` sendiri untuk layar pendek.
- **Panel kiri (50%, `lg:flex`/`hidden` di bawah)**: `bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-12 flex flex-col justify-between relative`. Heading `text-3xl lg:text-4xl font-extrabold leading-tight tracking-tight text-white` (warna eksplisit `text-white` — atasi aturan global `h1..h6`). Ilustrasi `login-showcase.tsx` (CSS/SVG murni, warna token Velzon, ikon Lucide).
- **Panel kanan (50%)**: latar `bg-slate-50/50`, form ter-center. Kartu `w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/50`.
- **Hirarki teks form**: judul `text-2xl font-bold tracking-tight text-slate-900`; subjudul `text-sm font-medium text-slate-600`; label `text-xs font-semibold uppercase tracking-wider text-slate-700`; input `text-sm font-medium text-slate-900 placeholder:text-slate-400`; footer `text-xs font-medium text-slate-500`.
- **Field/aksi**: input `rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-velzon-primary focus:ring-2 focus:ring-velzon-primary/20 transition-all duration-200`; tombol primer `bg-velzon-primary hover:bg-velzon-primary-hover text-white font-semibold text-sm rounded-xl py-3.5 shadow-lg shadow-velzon-primary/30`; SSO `border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm shadow-sm rounded-xl py-2.5`. **Catatan rekonsiliasi:** spesifikasi menyebut `blue-600/700`; dipetakan ke token merek Velzon (`velzon-primary`/`-hover`) demi konsistensi design system (aturan standing "selalu Velzon").

---

## 5. Aksesibilitas & Standar Kualitas Pengalaman Pengguna (UX Best Practices)

1. **Kejelasan Status Transaksional**: Mahasiswa tidak boleh dibuat bingung oleh status tagihan. Gunakan chip warna tegas: `LUNAS` (Hijau), `BELUM_LUNAS` (Merah), `CICILAN` (Kuning).
2. **Umpan Balik Instan (*Optimistic Updates & Toast*)**: Setiap aksi (seperti submit KRS atau input presensi) memberikan umpan balik visual instan via komponen Toast notifikasi di sudut kanan atas sebelum respons server tuntas direkonsiliasi.
3. **Empty States yang Membimbing**: Halaman tanpa data (misal: "Belum Ada Jadwal Kuliah") tidak boleh dibiarkan kosong melompong; wajib menyertakan ilustrasi SVG tematik dan tombol aksi navigasi yang memandu pengguna.
4. **Perlindungan Double-Click**: Seluruh tombol pembayaran dan submit formulir wajib menerapkan status `disabled` dan animasi spinner loading saat request sedang diproses guna mencegah submit ganda.

## 6. Visual Hierarchy & Clean Layout Rules
### 6.1 Spacing System
- **8pt Grid**: All padding and margin values must be multiples of **8 px** (8, 16, 24, 32). Use these tokens consistently for gutters, card padding, and container margins.
- **Whitespace**: Ensure breathable layouts – minimum 24 px vertical breathing room between major sections, and at least 16 px between rows in tables or cards.

### 6.2 Typography Scale
| Level | Font Size / Line‑Height | Weight | Usage |
|------|------------------------|--------|-------|
| **Page Title (H1)** | 28 px / 36 px | Semi‑Bold 600 | Dashboard primary headline |
| **Section Heading (H2)** | 22 px / 28 px | Semi‑Bold 600 | Major section titles |
| **Card Title (H3)** | 16 px / 24 px | Medium 500 | Card headers, modal titles |
| **Body Text** | 14 px / 20 px | Regular 400 | Main content, tables, forms |
| **Caption / Muted** | 12 px / 16 px | Regular 400 / Medium 500 | Helper text, timestamps, footnotes |

### 6.3 Dark/Light Mode Polish
- Contrast ratios must meet **WCAG 2.1 AA** (≥ 4.5:1 for normal text, ≥ 3:1 for large text).
- Verify every foreground‑background pair with automated contrast tests in CI.
- Provide explicit `data-theme='dark'` token overrides (see `tokens.css`).

## 7. Animation & Motion Design Specifications
### 7.1 Web Motion (Next.js + Framer Motion / Tailwind Animate)
- **Page Transitions**: Fade‑in + slide‑up (duration 0.2‑0.3 s, `ease-out`).
- **Modals & Dropdowns**: Scale from 95 % → 100 % while fading in (0.15 s).
- **Skeleton Loading**: All tables and cards use a **pulse skeleton** (no spinner) to avoid CLS. Implement via `@/components/ui/skeleton.tsx`.
- **Buttons & Interactive Elements**: Hover lifts `translateY(-1px)` / `-2px`; active press scales to `0.98` with a subtle shadow.

### 7.2 Mobile Motion (Flutter)
- **Navigation**: Use `PageRouteBuilder` with `FadeThrough` or `SharedAxis` transitions (Material Motion spec).
- **Shared‑Element Transitions**: Hero animations for schedule cards and Digital KTM badge when navigating to detail screens.
- **Feedback Animations**: Ripple (`InkWell`) on touch targets, `AnimatedContainer` for state changes, and Lottie/CustomPainter for success actions (e.g., QR scan confirmed).

## 8. Usability & Micro‑Interactions (Professional Touch)
### 8.1 Touch Targets (Mobile)
- Minimum tappable area **44 × 44 dp** (≈ 48 px) with sufficient padding around icons/buttons.

### 8.2 Empty States
- Every empty table/list view must display a minimalist SVG illustration, friendly copy, and a primary **Call‑to‑Action** button.
- Use the `EmptyState` component (`apps/web/components/ui/empty-state.tsx` and Flutter widget `EmptyStateWidget`).

### 8.3 Instant Feedback
- All data‑mutating actions (Save KRS, Input Nilai, Scan QR) trigger a **Toast** (success or error) and set the action button to a loading state.
- Toasts appear in the top‑right (Web) or bottom‑center (Mobile) and auto‑dismiss after 4 s.

---

## 9. Arsitektur Informasi Area Admin & Pola Halaman (Web)
> Dasar: [BENCHMARK_SEVIMA.md](file:///c:/SICA/docs/BENCHMARK_SEVIMA.md) §2.1–§2.4 (struktur menu Sevima) + §2.8/§2A.8 (kelemahan yang harus kita hindari: menu overflow, duplikasi jalur, "kenapa tidak muncul") + kebutuhan [PRD §5.8](file:///c:/SICA/docs/PRD.md). Berlaku untuk seluruh layar `/admin/**`. **Status: spesifikasi, belum dibangun.**

### 9.1 Prinsip IA Area Admin (anti-pattern yang kita tolak)
1. **Satu jalur per objek.** Objek master hanya punya satu alamat kanonik (`/admin/master/prodi`). Duplikasi ala Sevima (`Data Kelas > Tahun Ajaran` vs `Data Kurikulum > Tahun Ajaran` vs `Setting > Periode Akademik`) dilarang; halaman lain menautkan, bukan menyalin layar.
2. **Menu = peran × entitlement × status data.** Item yang tidak boleh tampil karena modul belum dibeli **tidak** muncul (bukan sekadar di-disable) — sesuai guard `withModule` di API (API_SPEC §4.6 butir 1c). Item yang belum punya halaman memakai badge "Segera" seperti navigasi saat ini.
3. **Konteks kerja terlihat.** Setiap halaman Admin menampilkan strip konteks: `Periode aktif` + `Prodi scope` + `Status periode (DRAFT/OPEN/CLOSED)`. Penyebab utama kebingungan di SIAKAD lama adalah filter periode yang diam (bukti: artikel troubleshooting Sevima, §2.8 D-4).
4. **Kosong bukan berarti diam.** `EmptyState` wajib menyebut **sebab** dan **tautan perbaikan** (mis. "Belum ada kelas karena kurikulum 2026 belum punya mata kuliah -> Tambah mata kuliah"). Komponen `components/ui/empty-state.tsx` disebut §8.2 tetapi **belum ada di kode** -> masuk slice ADM-1.
5. **Velzon, selalu** (§2.0). Tidak ada gaya lokal: `rounded-md` 8px, tombol datar, input putih, label normal-case, primary hijau `#0ab39c`.

### 9.2 Kerangka halaman
```
+-----------------------------------------------------------------------------------+
| header 2 baris Velzon horizontal (components/layout/top-nav.tsx - sudah ada)       |
| baris 2 + "context strip": Periode v | Prodi v | Status: OPEN                      |
+----------------+------------------------------------------------------------------+
| sub-nav Admin  | judul H1 + aksi primer kanan (Tambah / Import / Generate)         |
| (grouped,      +------------------------------------------------------------------+
|  collapsible)  | [tab bila objek punya anak: mis. Skala Nilai | Band]              |
|                | VelzonDataGrid (cari, sorting, paginasi 25, aksi baris)           |
+----------------+------------------------------------------------------------------+
   form = Side Drawer kanan 60% | destructive = Modal (2.4) | dampak = Drawer "Kesehatan Data"
```
- **Daftar lalu drawer form** (bukan halaman baru) untuk semua CRUD master: memotong 23 objek menjadi 1 pola; deep-link `/admin/master/prodi?edit=<id>` tetap bisa dibagikan.
- Drawer form bertab untuk objek lebar (`Prodi`: Identitas | Kurikulum & Plafon | Akreditasi | Feeder; `Matakuliah`: SKS & Tipe | Prasyarat | Ekivalensi).
- **Dirty-state guard**: menutup drawer dengan perubahan wajib dikonfirmasi; jangan pernah menghilangkan isian panjang secara diam-diam.
- Field wajib ditandai `*` + pesan Zod **di bawah field** (bukan toast saja); error 422 server menempel ke field terkait (`error.details[].path`).

### 9.3 Kontrak visual tiap gugus menu
| Gugus | Komponen wajib | Catatan |
|---|---|---|
| **A. Umum / Kesehatan Data** | kartu kelompok masalah (Kritis / Perlu Tindakan / Info) + CTA "perbaiki" | gerbang sebelum tenant `LIVE` (FR-ADM-10) |
| **B. Data Master** | `VelzonDataGrid` + drawer + kolom `Status` (aktif/nonaktif) + aksi `Nonaktifkan` sebelum `Hapus` | `409 REFERENCE_IN_USE` -> tampilkan daftar rujukan di modal |
| **C. Personel** | grid + tab detail (Biodata | Alamat | Wali | Dokumen | Riwayat status) | PII ter-masking untuk peran non-pemegang `INSERT`/`UPDATE` |
| **D. Penyelenggaraan** | grid + **matriks jadwal** (hari x jam) dengan sel bentrok merah + drawer "Generate Kelas" | conflict-detector service sudah ada; tampilkan konflik per sel |
| **E. Pengaturan Akademik** | **wizard 4 langkah** (Jendela -> Kuota & Prasyarat -> Gerbang & Cecal -> Nilai & Kuesioner) + **diff sebelum simpan** + pratinjau dampak | pengganti langsung 9 tab kali puluhan switch Sevima (§2.8 D-6) |
| **F. Pengguna & Hak Akses** | matriks `resource x verb` (6 aksi, FR-IDT-04) + penugasan ber-scope + riwayat izin | setiap simpan -> `access_change_requests` (empat-mata) |
| **G. Impor** | stepper Unggah -> Validasi -> Rekonsiliasi -> Terapkan + unduh templat per objek | tampilkan deviasi IP/IPK <= 0,00 (AC-MIG-1) |
| **H. Feeder** | kartu pemetaan 20 sumber daya + pra-validasi inline + log kirim per periode | error feeder ditampilkan **saat input**, bukan saat kirim (D-5) |

### 9.4 Aturan micro-interaction Admin
- Aksi massal (`Generate Kelas`, `Generate Pertemuan`, `Kunci Nilai massal`) -> modal konfirmasi berisi **angka dampak** ("12 kelas x 16 pertemuan = 192 baris") + `Idempotency-Key` di belakang; hasil = toast + ringkasan `created/skipped`, bukan hanya "sukses".
- Simpan master: optimistic UI **dilarang** (sumber kebenaran = aturan nasional + dependensi); tunggu 201, sisipkan baris, perbarui `meta.total`.
- Semua tabel memberi tautan "Lihat juga di..." bila objek dipakai domain lain (satu jalur kanonik, tetap dapat dinavigasi).
- `prefers-reduced-motion` tetap dihormati; animasi drawer 180-220 ms ease-out, tidak lebih.

### 9.5 i18n & penamaan
- Seluruh label menu/kolom/aksi dari `locales/id.json` & `en.json` (AGENTS §3.5); kunci baru: `admin.menu.*`, `admin.master.<objek>.title/columns/actions`, `admin.rules.wizard.*`, `admin.errors.<KODE>`.
- Istilah Indonesia konsisten: **Periode**, **Mata Kuliah**, **Ruang**, **Pengaturan Akademik**, **Cegal**, **Presensi**, **Nilai**, **Yudisium** — selaras [GLOSSARY.md](file:///c:/SICA/docs/GLOSSARY.md). Padanan istilah Sevima dicatat agar admin yang pindah tidak bingung (`Sistem Kuliah` -> *Skema Penerimaan*; `Unsur Nilai` -> *Komponen Nilai*; `Status Semester` -> *Status Akademik per Semester*).

### 9.6 Paritas Mobile (AGENTS §3.4)
Admin tidak perlu layar penuh di Flutter, tetapi tiga aksi wajib ada di mobile (kasus nyata: kaprodi/dekan bergerak): (1) **persetujuan** (KRS, koreksi nilai, perubahan status, keringanan), (2) **monitoring pengisian nilai** per kelas, (3) **buka/tutup presensi** dan QR sesi. Data hanya lewat rute `/api/v1/*` yang sama; tidak ada endpoint khusus mobile.

---

<!-- SICA-47:BEGIN enterprise-47 -->

## 10. Dashboard Grid Dinamis per Role & Layar 47 Modul (dikunci 2026-10-20)

### 10.1 Shell Pasca-Login

```
┌──────────────────────────── Header biru (--sica-topbar-bg) ────────────────────────────┐
│ Logo tenant · nama kampus · switcher konteks (periode/prodi)   🔔  Avatar ▾ (Profil, Ganti Role, Logout) │
├───────────────────────────┬──────────────────────────────────────────────────────────────┤
│ DAFTAR MODUL (kiri)       │ Area kerja: dashboard modul aktif / ringkasan lintas modul   │
│ [kartu][kartu][kartu]     │ (KPI widget, tugas menunggu, feed real-time)                 │
│ [kartu][kartu][kartu]     │                                                              │
│ ▸ Modul Lain (collapsible)│                                                              │
└───────────────────────────┴──────────────────────────────────────────────────────────────┘
```

| Elemen | Spesifikasi |
|---|---|
| Header | tinggi 70 px; latar token `--sica-topbar-bg` (default biru Velzon `#405189`, dapat diubah per tenant via parameter `ui.theme.topbar_bg`); teks putih; menu avatar berisi Profil, Ganti Role (bila user punya >1 assignment), Logout (mencabut sesi, §2 SECURITY) |
| Warna aksen | tombol primer tetap hijau `#0ab39c` (§1); header biru hanya untuk bilah atas — keputusan PRD §10.7 PD-03 |
| Daftar Modul | panel kiri; grid kartu: ≥1400 px 3 kolom, 992–1399 px 2 kolom, 768–991 px 2 kolom dan panel menjadi drawer, <768 px 1 kolom layar penuh |
| Sumber kartu | `GET /api/v1/me/dashboard` → `{profile, modules:[{code,name,icon,badge,kpi[],route,permissions[]}]}` dihitung server: (profil seed ∪ modul ber-izin READ) ∩ entitlement aktif ∩ izin efektif (PRD §10.3) |
| Urutan | sesuai `dashboard_profiles` (CRUD di M-03); user dapat menyematkan (pin) kartu — disimpan di `user_preferences` |
| Pencarian | filter kartu by nama/kode (`/` shortcut) |

### 10.2 Anatomi Kartu Modul

Ikon Lucide + kode (`M-13`) + nama; badge angka tugas menunggu (mis. "5 KRS menunggu ACC"); satu KPI utama; status entitlement. State: **loading** (skeleton), **kosong** (ilustrasi + aksi pertama yang diizinkan, mis. "Buat Periode"), **error** (pesan + `X-Request-ID` + tombol coba lagi), **terkunci** (modul aktif tetapi periode `LOCK` → ikon gembok + alasan), **tidak berlangganan** (tidak dirender sama sekali). Badge & KPI diperbarui via WebSocket (topik `tenant:{tid}:{entitlement}` dan `user:{uid}`) dengan animasi pulse 600 ms; tidak ada polling.

### 10.3 Gating Tombol Aksi & UX Real-Time

- Komponen `<Can action="APPROVE" resource="enrollment.krs">` merender tombol hanya bila izin efektif ada; server tetap menegakkan (UI bukan kontrol keamanan).
- Tombol destruktif (`DELETE`, `LOCK`, `UNLOCK`, `REJECT`) membuka modal konfirmasi dengan *impact analysis* (§9) dan kolom alasan wajib.
- `PARAM_EDIT` membuka drawer editor parameter: nilai saat ini, versi, `effectiveFrom`, batas regulasi, pratinjau dampak.
- Event masuk untuk entitas yang sedang dibuka: bila tidak ada perubahan lokal → refetch diam-diam + toast Sonner "Diperbarui oleh {aktor}"; bila ada perubahan lokal → banner konflik (pakai `VERSION_CONFLICT`).
- Halaman list memakai pola §9 (data grid, filter, side drawer); semua label status berasal dari lookup (warna badge dari `lookup_values.extra.color`).


### 10.4 Spesifikasi Layar per Modul

| Kode | Modul | Kartu dashboard (KPI widget) | Menu kiri (urutan) | Tombol aksi (dirender hanya bila izin ada) | Kanal real-time (WebSocket topic) |
|---|---|---|---|---|---|
| M-01 | SaaS Foundation | Tenant aktif, SLA bulan ini, Insiden terbuka, Pemakaian seat | Tenant Mgmt, SaaS Licensing, SLA, Global Audit | CREATE, DELETE, EXPORT, LOCK, TOGGLE_ACTIVE, UNLOCK, UPDATE | `tenant:{tid}:platform_saas` |
| M-02 | Master Parameter | Kategori lookup, Parameter berubah 7 hari, NIM terbit periode ini, Atribut EAV | Master Lookups, System Params, Dynamic EAV, Auto-NIM | CREATE, DELETE, EXPORT, PARAM_EDIT, READ, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:identity` |
| M-03 | Hak Akses & RBAC | Role aktif, Permintaan akses menunggu, Assignment kedaluwarsa 30 hari, Pelanggaran SoD | Role Mgmt, Permission Grid, Parameter Restrictions | APPROVE, CREATE, DELETE, EXPORT, READ, REJECT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:identity` |
| M-04 | IT Helpdesk | Tiket saya, Tiket terbuka, SLA breach, Rata-rata resolusi | Service Desk Portal, Ticket Mgmt, SLA Rules | APPROVE, CREATE, DELETE, EXPORT, TOGGLE_ACTIVE, UNLOCK, UPDATE | `tenant:{tid}:helpdesk` |
| M-05 | Keamanan & Audit | Integritas rantai, Pelanggaran 24 jam, DSR jatuh tempo, Kolom PII ter-mask | Hash Chain Audit Log, PII Masking, Security Violations | APPROVE, CREATE, DELETE, EXPORT, READ, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:audit` |
| M-06 | HRIS & Payroll | Pegawai aktif, Cuti menunggu, Status payroll bulan ini, KPI rata-rata unit | Data Pegawai, Presensi/Cuti, KPI, Remunerasi | APPROVE, CREATE, DELETE, EXPORT, LOCK, REJECT, TOGGLE_ACTIVE, UNLOCK, UPDATE | `tenant:{tid}:hr_bkd` |
| M-07 | BKD Dosen | SKS terklaim, Bentrok terdeteksi, Asesmen menunggu, Status periode | BKD Portfolio, Overlap Detector, EWMP Rubric | APPROVE, CREATE, DELETE, EXPORT, LOCK, READ, REJECT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:hr_bkd` |
| M-08 | SISTER Sync | Antrean push, Gagal 24 jam, Terakhir sinkron, Delta tertunda | Sync Dashboard, Schema Mapping, Push Queue | CREATE, DELETE, EXPORT, READ, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:hr_bkd` |
| M-09 | PMB & OCR | Pendaftar per jalur, Dokumen menunggu verifikasi, Lulus seleksi, Daftar ulang | Portal Camaba, Jalur PMB, Verification, CBT Exam | APPROVE, CREATE, DELETE, EXPORT, REJECT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:pmb` |
| M-10 | Keuangan & Billing | Tagihan terbit, Terbayar hari ini, Piutang > 30 hari, Serapan anggaran | Tariff Component Master, Billing Generator, Reconciler | APPROVE, CREATE, DELETE, EXPORT, LOCK, TOGGLE_ACTIVE, UNLOCK, UPDATE | `tenant:{tid}:finance` |
| M-11 | KIP-K & Beasiswa | Pendaftar, Penerima aktif, Peringatan IPK, Dana tersalur | Application Verification, IPK Monitor, Allowance | APPROVE, CREATE, DELETE, EXPORT, LOCK, REJECT, TOGGLE_ACTIVE, UNLOCK, UPDATE | `tenant:{tid}:scholarship` |
| M-12 | Kurikulum OBE | Kurikulum aktif, RPS menunggu, Capaian CPL rata-rata, Mata kuliah tanpa CPMK | Kurikulum Master, Profil Lulusan & CPL, CPMK Mapping | APPROVE, CREATE, DELETE, EXPORT, LOCK, READ, REJECT, TOGGLE_ACTIVE, UNLOCK, UPDATE | `tenant:{tid}:academic` |
| M-13 | KRS Online & Perwalian | KRS saya / mahasiswa wali, Menunggu ACC, Kursi tersisa, Antrean war | Sesi Perwalian Akademik, Bimbingan DPA, KRS Portal, KRS War Queue | APPROVE, CREATE, DELETE, EXPORT, LOCK, REJECT, TOGGLE_ACTIVE, UNLOCK, UPDATE | `tenant:{tid}:enrollment` |
| M-14 | Jadwal & Ruang | Konflik jadwal, Utilisasi ruang, Run terakhir, Booking hari ini | Timetabling Generator, Facility Master, CSP Solver | APPROVE, CREATE, DELETE, EXPORT, LOCK, TOGGLE_ACTIVE, UNLOCK, UPDATE | `tenant:{tid}:scheduling` |
| M-15 | Moda Perkuliahan | Sesi hari ini per moda, Rapat daring siap, Sesi belum ditutup, Distribusi F/O/M | Learning Mode Control, Shift Allocator, Lecture Session | CREATE, DELETE, EXPORT, LOCK, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:teaching` |
| M-16 | LMS Digital | Kelas aktif, Tugas jatuh tempo, Progres materi, Diskusi baru | Course Classroom, SCORM/Video Material, Discussion | CREATE, DELETE, EXPORT, READ, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:lms` |
| M-17 | Ujian & Proctoring | Ujian berlangsung, Flag real-time, Attempt selesai, Persetujuan biometrik | Online Exam Portal, Proctoring Rules, Incident Feed | APPROVE, CREATE, DELETE, EXPORT, LOCK, REJECT, TOGGLE_ACTIVE, UNLOCK, UPDATE | `tenant:{tid}:cbt` |
| M-18 | Presensi Smart | Sesi terbuka, Kehadiran hari ini, Di bawah 75%, Koreksi menunggu | Presensi Kelas, Dynamic QR Generator, Geofence Master | APPROVE, CREATE, DELETE, EXPORT, LOCK, READ, REJECT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:attendance` |
| M-19 | Nilai & KHS | Kelas belum kunci nilai, Perubahan menunggu, IPS rata-rata, KHS terbit | Gradebook Entry, Grading Scale, AST Evaluator, KHS | APPROVE, CREATE, DELETE, EXPORT, LOCK, READ, REJECT, TOGGLE_ACTIVE, UNLOCK, UPDATE | `tenant:{tid}:assessment` |
| M-20 | Tugas Akhir & RAMA | Mahasiswa bimbingan, Logbook menunggu tanda tangan, Sidang minggu ini, Terbit di RAMA | Pengajuan TA/Skripsi, Bimbingan TA Digital, Pendaftaran Sidang, Repositori RAMA | APPROVE, CREATE, DELETE, EXPORT, LOCK, READ, REJECT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:thesis` |
| M-21 | Jurnal & OJS | Jurnal terkelola, Artikel baru, APC tertunda, Peringkat SINTA | Journal Directory, APC Billing, Article Indexing | APPROVE, CREATE, DELETE, EXPORT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:journal` |
| M-22 | Inkubator & HAKI | HAKI diajukan, HAKI granted, Startup aktif, Dana seed | HAKI Portal, DJKI Integration, Startup Milestones | APPROVE, CREATE, DELETE, EXPORT, REJECT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:ipr_incubator` |
| M-23 | Wisuda & Toga | Pendaftar wisuda, Kursi terplot, Toga terdistribusi, Antrean panggung | Convocation Register, Seating Plotter, Stage Call Queue | CREATE, DELETE, EXPORT, LOCK, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:graduation` |
| M-24 | Kemahasiswaan & SKKM | Klaim menunggu, Poin SKKM saya, Prestasi nasional/internasional, Ormawa aktif | Pengajuan SKKM, SIMKATMAWA Scorer, Prestasi | APPROVE, CREATE, DELETE, EXPORT, REJECT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:student_affairs` |
| M-25 | KKN, PKL & Magang | Peserta aktif, Logbook belum diverifikasi, Nilai mitra masuk, Lokasi terisi | Alokasi Lokasi KP/PKL/KKN, Penugasan DPL, Bimbingan & Logbook Geofenced, Penilaian Mitra | APPROVE, CREATE, DELETE, EXPORT, LOCK, REJECT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:fieldwork` |
| M-26 | Simulasi Lulus | Sisa SKS, Semester lulus proyeksi, Mata kuliah kritis, Risiko lewat masa studi | Graduation Simulator, Prerequisite Graph, CPM Analysis | CREATE, DELETE, EXPORT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:academic` |
| M-27 | Tracer Study | Response rate, Bekerja < 6 bulan (IKU 1), Alumni terdata, Blast berjalan | Survey Tracer, Blast Communication, Alumni Directory | CREATE, DELETE, EXPORT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:tracer_iku` |
| M-28 | Career Center | Lowongan aktif, Lamaran, Rekrut tercatat, Mitra terverifikasi | Employer Portal, Job Vacancy Board, Virtual Career Fair | APPROVE, CREATE, DELETE, EXPORT, READ, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:career` |
| M-29 | KUI & Mobilitas | Inbound/outbound, Visa < 30 hari, Konversi menunggu, Kelas BIPA | International Mobility, Visa/ITAS Tracker, BIPA Class | APPROVE, CREATE, DELETE, EXPORT, REJECT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:international` |
| M-30 | Yudisium & SKPI | Mahasiswa layak, Clearance tertahan, Batch menunggu, SKPI terbit | Clearance Check, DFA Inference Engine, Batch Yudisium | APPROVE, CREATE, DELETE, EXPORT, LOCK, READ, REJECT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:graduation` |
| M-31 | Akreditasi LKPS | Kelengkapan 9 kriteria, Rasio gagal, Snapshot terakhir, LED progres | LKPS Data Extractor, LED Report Builder, Compliance | CREATE, DELETE, EXPORT, LOCK, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:accreditation` |
| M-32 | Dashboard IKU | IKU 1–8, Alert ambang, Capaian vs target, Tren 3 tahun | Executive Dashboard, IKU Metric Detail 1-8, Reports | CREATE, DELETE, EXPORT, READ, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:tracer_iku` |
| M-33 | Jadwal Darurat | Insiden aktif, Ruang terkunci, Kelas terdampak, Rencana menunggu | Incident Room Manager, Re-Routing Solver, Distance | APPROVE, CREATE, DELETE, EXPORT, LOCK, TOGGLE_ACTIVE, UNLOCK, UPDATE | `tenant:{tid}:scheduling` |
| M-34 | Feeder PDDikti | Staging error, Antrean sync, Sukses 24 jam, Koreksi menunggu | Staging Buffer Manager, Error Validation, Sync Queue | APPROVE, CREATE, DELETE, EXPORT, LOCK, REJECT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:feeder_pddikti` |
| M-35 | PIN & SIVIL | Kuota PIN tersisa, Ijazah terbit, Verifikasi publik 7 hari, Pencabutan | PIN Reservation, SIVIL Adapter, E-Ijazah Generator | APPROVE, CREATE, DELETE, EXPORT, LOCK, READ, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:graduation` |
| M-36 | Portal PPKS | Kasus baru, Melewati batas respon, Kasus ditangani, Konseling terjadwal | Encrypted Whistleblower, Case Mgmt, Counseling | CREATE, DELETE, EXPORT, LOCK, READ, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:ppks` |
| M-37 | SPMI & Quality | Temuan terbuka, RTL lewat tenggat, Siklus AMI, Standar per tahap PPEPP | Mutu Repository, Audit Mutu Internal, Temuan/RTL | APPROVE, CREATE, DELETE, EXPORT, LOCK, REJECT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:spmi` |
| M-38 | Kampus Merdeka / MBKM | Peserta MBKM, Logbook terverifikasi, Konversi menunggu, SKS terkonversi | Program MBKM Portal, Bimbingan MBKM, Kampus Merdeka Sync | APPROVE, CREATE, DELETE, EXPORT, REJECT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:mbkm` |
| M-39 | e-Library | Pinjaman aktif, Terlambat, Denda tertunggak, Bebas pustaka hari ini | OPAC Catalog Master, Circulation & Fines, Repository | APPROVE, CREATE, DELETE, EXPORT, READ, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:library` |
| M-40 | Aset & Inventaris | Total aset, Nilai buku, Belum ter-tag, Penyusutan bulan ini | Asset Directory, Tagging & Barcoding, Depreciation | APPROVE, CREATE, DELETE, EXPORT, LOCK, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:assets` |
| M-41 | Klinik Kampus | Antrean saat ini, Kunjungan hari ini, Booking konseling, Akses break-glass | Encrypted Health Records, Virtual Clinic Queue, Bimbingan Konseling | CREATE, DELETE, EXPORT, TOGGLE_ACTIVE, UNLOCK, UPDATE | `tenant:{tid}:clinic` |
| M-42 | Asrama & Kantin | Okupansi, Menunggu alokasi, Saldo beredar, Selisih rekonsiliasi | Dormitory Allocation, Shuttle Transport, E-Wallet | APPROVE, CREATE, DELETE, EXPORT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:dormitory` |
| M-43 | Humas & Event | Event mendatang, Registrasi, Check-in live, Signage aktif | Event Management, Gate Check-in QR, Digital Signage | APPROVE, CREATE, DELETE, EXPORT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:events` |
| M-44 | SIM-LPPM / LITABMAS | Proposal dibuka, Review menunggu, Dana tersalur, Luaran tervalidasi (IKU 5) | Skema Hibah, Selection, Contract, Monev & Luaran | APPROVE, CREATE, DELETE, EXPORT, REJECT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:litabmas` |
| M-45 | CRM PMB & Marketing | Lead baru 7 hari, Konversi funnel, CAC per kanal, Komisi tertunda | Leads Management, School Roadshow, Referral/Agent Network, Drip Campaign | APPROVE, CREATE, DELETE, EXPORT, REJECT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:crm_marketing` |
| M-46 | E-Procurement PBJ | Pengajuan aktif, Menunggu PPK, Nilai kontrak, Barang diterima | Pengajuan PBJ, Tender/RFQ, E-Katalog Kampus, Kontrak | APPROVE, CREATE, DELETE, EXPORT, REJECT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:procurement` |
| M-47 | Endowment Fund | Total pokok, Imbal hasil YTD, Alokasi tertunda, Donasi kampanye | Donor Campaign, Fund Portfolio, Investment Return, Grant Allocator | APPROVE, CREATE, DELETE, EXPORT, REJECT, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:endowment` |
| APP | SuperApp Mobile | Jadwal hari ini, QR presensi, Tagihan, Notifikasi | Mobile Dashboard, Fast KRS War, Dynamic QR Attendance, LMS, Bimbingan Logbook Mobile | CREATE, DELETE, EXPORT, LOCK, READ, TOGGLE_ACTIVE, UPDATE | `tenant:{tid}:mobile_superapp` |

### 10.5 Paritas Mobile (SuperApp)

SuperApp merender kartu dari endpoint `/me/dashboard` yang sama (grid 2 kolom, Material 3 §3) dengan subset modul mobile: M-10, M-13 (Fast KRS War), M-16, M-17 (lihat jadwal; ujian berjalan di web lockdown), M-18 (scan QR + GPS), M-19, M-20/M-25/M-38 (logbook), M-39, M-41, M-42, M-43, notifikasi. Data disimpan di SQLite (Drift) untuk offline; check-in offline ditandatangani kunci perangkat (APP, ARCHITECTURE §11.4).

<!-- SICA-47:END enterprise-47 -->
