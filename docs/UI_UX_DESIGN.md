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
        Primary (#0ab39c)          Success (#0ab39c)          Warning (#f7b84b)
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
| **Primary** | `#0ab39c` | Tombol CTA utama, tab aktif, link interaktif, focus ring, indikator proses berjalan. | `colorScheme.primary`, AppBar aksi utama, FloatingActionButton. |
| **Secondary / Accent** | `#405189` | Warna sidebar default (dark navy), badge status modul, avatar inisial. | `colorScheme.secondary`, card header tint, divider penanda. |
| **Success** | `#0ab39c` *(sama dengan primary — sengaja)* | Status pembayaran `LUNAS`, KRS disetujui, kehadiran hadir. | `colorScheme.tertiary`, icon checklist, status lunas badge. |
| **Info** | `#299cdb` | Notifikasi jadwal kuliah, status KRS draft, pengumuman. | Badge jadwal hari ini, alert box akademik, banner status. |
| **Warning** | `#f7b84b` | Tagihan mendekati jatuh tempo, peringatan batas presensi, kursi hampir penuh. | Status tagihan cicilan, peringatan evaluasi SKS. |
| **Danger** | `#f06548` | Tagihan *Overdue*, cekal aktif, kelas penuh, tolak KRS. | Banner cekal, alert penolakan transaksi, indikator bentrok. |
| **Dark Base (Navy)** | `#212529` | Background Dark Mode (`#14171a`), teks heading utama. | `colorScheme.surface` Dark, header background. |
| **Light Base (Slate)** | `#f4f6fa` | Background body Light Mode, table header zebra. | `colorScheme.surface` Light, canvas background. |

> **Catatan tabrakan hue (diputuskan 2026-10-19).** Velzon memakai teal sebagai primary, sehingga `primary` dan `success` berbagi hexa yang sama. Itu **boleh** di SICA karena status "sukses" memang hasil dari aksi utama (setujui, lunas, hadir) — tetapi konsekuensinya wajib dijaga: **jangan** mengandalkan hue untuk membedakan arti. Pembeda keadaan memakai **nada** (soft/label/solid), **ikon** (`StatusBadge` selalu berdot), dan **teks label**. Kalau sebuah layar butuh memisahkan "aksi" dari "status" secara visual, gunakan `primary` untuk aksi dan `success` **hanya** pada badge — tidak keduanya di elemen yang bersebelahan.

### 1.2 Skema Warna Mode Terang & Gelap (*Light & Dark Mode Tokens*)

Berkas kanonik: **`apps/web/src/app/globals.css`**. Riwayat jalurnya perlu dicatat supaya tidak ada yang menulis berkas ketiga: `apps/web/styles/tokens.css` **tidak pernah ada**, lalu token tinggal di `apps/web/src/styles/velzon-theme.css`, dan sejak 2026-10-19 **digabung ke `globals.css`**. Penggabungan itu bukan selera: pipeline CSS Next.js memproses tiap berkas CSS sebagai modul berdiri sendiri dan `postcss.config.mjs` tidak memuat `postcss-import`, sehingga `@layer base`/`@layer components` di berkas yang di-`@import` tidak pernah melihat pasangan `@tailwind base`/`@tailwind components` — build produksi gagal dengan `"@layer base" is used but no matching "@tailwind base" directive is present`. Bentuk nyata sekarang memakai **kanal RGB** agar utilitas Tailwind bisa memakai opasitas (`bg-slate-50/50`) sekaligus ikut tema:

```css
/* apps/web/src/app/globals.css — potongan :root */
:root {
  --sica-primary: #0ab39c;              /* + --sica-rgb-primary: 10 179 156 */
  --sica-primary-hover: #089e85;
  --sica-primary-soft: #e6f7f5;
  --sica-surface-canvas: #f4f6fa;
  --sica-surface-card: #ffffff;
  --sica-surface-header: rgb(255 255 255 / 0.86);   /* + backdrop-filter blur */
  --sica-surface-inset: #f7f9fc;
  --sica-surface-hover: #f1f4f9;
  --sica-surface-sidebar: var(--sica-secondary);
  --sica-surface-input: #fbfcfe;
  --sica-text-heading: rgb(15 23 42);
  --sica-text-body: rgb(71 85 105);
  --sica-text-muted: #74788d;
  --sica-border-color: #e9ebec;
  --sica-divider: rgb(241 245 249);
  --sica-ring: rgb(var(--sica-rgb-primary) / 0.16); /* focus-visible 0 0 0 4px */
  --sica-rgb-slate-50: 248 250 252;                 /* ramp netral, dibalik per tema */
  --sica-shadow-card: 0 1px 2px rgb(56 65 74 / 0.06), 0 4px 16px rgb(56 65 74 / 0.05);
}

[data-theme='dark'] {
  color-scheme: dark;
  --sica-surface-canvas: #14171a;
  --sica-surface-card: #1e2227;
  --sica-surface-inset: #1a1e23;
  --sica-surface-hover: #262b32;
  --sica-border-color: #292e35;
  /* ramp slate DIBALIK: slate-50 jadi gelap, slate-900 jadi terang */
  --sica-rgb-slate-50: 23 27 33;
  --sica-rgb-slate-900: 241 245 249;
  --sica-primary-soft: rgb(10 179 156 / 0.14);
}
```

**Lima kombinasi tema** yang didukung, semuanya hanya menimpa variabel (nol kelas `dark:` per komponen):

| Atribut | Nilai | Efek |
|---|---|---|
| `data-theme` | `light` | default; canvas terang, kartu putih, bayangan lembut |
| `data-theme` | `dark` | "Enterprise Night"; slate dibalik, soft color jadi translusen |
| `data-theme` | `semi-dark` | chrome (header/sidebar) gelap, area konten tetap terang |
| `data-layout` | `solid` | latar polos — aman untuk layar kerja padat data |
| `data-layout` | `gradient` | radial-gradient teal/indigo sangat halus di canvas dashboard, bukan gradien pada teks |
| `data-layout` | `minimal` | bayangan digantikan hairline, radius melonggar ke 10px, canvas putih |

Preferensi disimpan di `localStorage['sica.ui.theme']`, diterapkan **sebelum** paint pertama lewat skrip inline di `app/layout.tsx` (`themeInitScript`) sehingga tidak ada kedip terang→gelap, dan diganti lewat `ThemeSwitcher` di header.

**Permukaan publik.** Landing (`/`) dan login (`/login`) selalu memakai tema `light` + tata letak `solid`, tanpa mengikuti preferensi tersimpan. Halaman aplikasi terautentikasi tetap memakai pilihan tema pengguna.

### 1.3 Tipografi & Skala Hirarki

- **Primary Web Font**: `Plus Jakarta Sans`, `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`. Dimuat via Google Fonts `<link>` di `app/layout.tsx` (weight **400/500/600/700 saja** — 800 dihapus dari `<link>` sejak §11.2, `display=swap`) dan dipetakan ke `theme.extend.fontFamily.sans` di `tailwind.config.ts` agar utilitas `font-sans` konsisten. *(Menggantikan `Inter` — keputusan refactor login "Principal Lead UI/UX Engineer", lihat [PROGRESS_REPORT.md §5.21](file:///c:/SICA/docs/PROGRESS_REPORT.md).)*
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
> **Setiap komponen antarmuka (tombol, input, kartu, badge, form, navigasi, dsb.) WAJIB memakai design system Velzon** — token warna/radius/shadow di `apps/web/src/app/globals.css` (satu sumber, §11.1) + primitif bersama `components/ui/*` (`Button`, `Input`, `Card`) — **bukan** gaya Tailwind mentah hasil "AI look" (mis. `rounded-xl shadow-lg`, label `uppercase tracking-wider` yang dipaksakan). Bila butuh varian baru, tambah ke primitif/token Velzon, jangan mengarang kelas lokal.
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
- Auto-save draft lewat API domain ber-scope; penyimpanan lokal hanya data non-sensitif sesuai kebijakan retensi. Sesi autentikasi berada di PostgreSQL, bukan Redis; cache draft tidak menjadi sumber kebenaran transaksi.

### 2.4 Modal Konfirmasi & Drawer Aksi Cepat
- **Modal Berbahaya (*Destructive Action*)**: Wajib menggunakan aksen warna Danger (`#f06548`), menyertakan input konfirmasi teks (misal mengetikkan kata *"BATALKAN"* untuk void tagihan), dan tombol approval ganda.
- **Side Drawer**: Digunakan untuk melihat detail log audit baris, preview silabus RPS mata kuliah, atau mutasi ledger tanpa meninggalkan halaman aktif.

### 2.5 Ekosistem Komponen UI & Animasi Web (shadcn/ui + Lucide + Sonner + Framer Motion)
- **Tailwind CSS & CSS Variables**: Mengintegrasikan seluruh token Velzon ke dalam konfigurasi utilitas Tailwind CSS (`theme.extend.colors`).
- **shadcn/ui Base**: Komponen berbasis Radix UI primitives yang di-style dengan Velzon tokens (`Button`, `Input`, `Dialog`, `DropdownMenu`, `Card`, `Badge`, `Tabs`, `Skeleton`).
- **Lucide React Icons**: **ralat 2026-10-24** — aturan lama "seluruh ikon wajib `lucide-react`" dibatasi. Kerangka aplikasi (menu atas, utility, pengalih tema) memakai **Remix Icon** sesuai kosakata Velzon (§2.6); `lucide-react` tinggal di layar yang belum dimigrasi dan **tidak boleh** ditambah pemakaiannya di layar yang sudah. Satu layar = satu set ikon.
- **Sonner Toast**: Umpan balik notifikasi asinkron menggunakan library `sonner` dengan styling Velzon (Success: Hijau `#0ab39c`, Error: Merah `#f06548`, Info: Biru `#299cdb`).
- **Framer Motion**: Micro-interaction lembut (fade in, slide-up modal, hover lift, card stagger animations) dengan durasi 0.2s - 0.3s.

### 2.6 Kontrak kerangka Velzon di atas fondasi open-source (keputusan pemilik, 2026-10-24)

**Keputusan.** Permintaan "pakai Velzon seluruhnya" dieksekusi melalui **jalur B**: struktur, kosakata kelas, dan atribut tata letak Velzon dibangun di atas fondasi berlisensi bebas — `bootstrap@5.3.6` (MIT), `remixicon@4.5.0` (Apache-2.0), `sass@1.83.4` (MIT). Aset template komersial (CSS/SCSS/JS/185+ halaman hasil pembelian) **tidak** disalin ke repo: tidak ada paket terlisensi di tree (terukur 2026-10-24: tidak ada `vendor/`, `themes/`, `velzon*`; `bootstrap`/`apexcharts`/`flatpickr`/`select2`/`datatables` = 0 dependensi). Karena itu dokumen ini **tidak boleh** menulis "memakai template Velzon"; yang benar adalah "mengikuti struktur & kosakata Velzon di atas Bootstrap".

**Enam tata letak Velzon vs kenyataan kita.** Velzon mengenal `vertical`, `horizontal`, `detached`, `two-column`, `semi-box`, `hovered`. Yang hari ini ada dan dijanjikan hanya **`horizontal`** (menu utama di baris atas — sesuai IA `§9`), dan itu nilai baku `data-layout` pada rute aplikasi. `vertical` **tidak** dipasang sebagai tombol palsu: ia menjadi task sendiri (`UI-VLN-6`) begitu pohon menu-as-data `GET /me/menu` nyata, karena sidebar tanpa sumber menu berscope adalah affordance menyesat yang sudah kita vonis (`RD-154`).

**Ralat `horizontal` 2026-10-24 — "horizontal" Velzon itu DUA baris, bukan satu.** Bagian ini sebelumnya menormalkan `horizontal` sebagai "menu utama di baris atas", dan kode membacanya secara harfiah: brand, menu kerja, pencarian, utility dan profil berdesakan dalam **satu** bar 64px. Rujukan visual pemilik (tangkapan layar Velzon, siklus 10) menunjukkan bentuk aslinya: **baris 1** = merek + pencarian + utility + akun; **baris 2** = `.navbar-nav-main` berisi menu kerja, rata kiri, dengan garis pemisah halus di atasnya. Yang dipasang sekarang:

| Konsekuensi | Bentuk di kode | Catatan |
|---|---|---|
| Dua `<nav>` dalam satu `.topnav` | `.navbar-header` (baris 1) + `.navbar-nav-main` (baris 2) | kelas Velzon, bukan kelas karangan |
| Yang sticky adalah **keseluruhan** `.topnav`, bukan `.navbar-header` | `position: sticky` pindah dari `globals.css .navbar-header` ke `.topnav` | kalau hanya baris 1 yang sticky, navigasi utama hilang saat pengguna membaca tabel panjang — itu regresi, bukan penghematan |
| Tinggi baris menu = token | `--sica-menu-row-height: 46px` (bar 2 lebih rendah dari bar 1 = 64px) | hierarki "identitas / navigasi" terbaca dari tingginya |
| Layar < `lg` | `.navbar-nav-main` dinolkan (`min-height:0`, tanpa garis) dan isinya pindah ke panel `.navbar-collapse` di bawah hamburger | tanpa aturan ini, strip kosong bergaris menggantung sebelum menu dibuka |
| Item panjang boleh **membungkus**, tidak boleh digulir horizontal | `.app-menu { flex-wrap: wrap }` | `overflow-x` membuat konteks kliping yang **memotong `.dropdown-menu`** (posisinya absolut di dalam `li`) — ini jebakan yang saya masukinya sendiri sebelum diperbaiki |

**Satu sumber kebenaran warna.** Palet merek tetap `--sica-*` di `app/globals.css`; token `--bs-*` adalah **proyeksi** padanya (`--bs-body-bg: var(--sica-surface-card)`, `--bs-border-color: var(--sica-border-color)`, `--bs-primary-rgb: var(--sica-rgb-primary)`, dst.) sehingga pengalih tema tetap satu lapis dan `bg-slate-50/50` tidak kehilangan makna. Konsekuensi yang **wajib** dijaga: nilai heksa yang dipakai untuk mengkonfigurasi SCSS Bootstrap (`$primary: #0ab39c` dan kawan-kawan) adalah salinan build-time dari `:root`. Salinan itu bukan izin untuk divergen — dijaga oleh gerbang `.tools/palette-drift.mjs` yang membandingkan heksa konfigurasi SCSS dengan token `globals.css`; berbeda = gate merah.

**Peta berkas.**

| Berkas | Isi | Aturan |
|---|---|---|
| `src/styles/_velzon-config.scss` | `$primary/$info/$warning/$danger/$success/$secondary` = heksa merek SICA, `$border-radius*` = 8/10/14px, `$font-family-sans-serif` = Plus Jakarta Sans, `$enable-negative-margins: false` | satu-satunya tempat heksa **di luar** `globals.css`; wajib setara dengannya (gerbang `palette-drift`) |
| `src/styles/theme.scss` | **titik masuk** yang mendaftarkan layer: `@layer bootstrap { @import 'bootstrap-parts'; }` lalu `@layer velzon { @import 'velzon-skeleton'; @import 'velzon-auth'; }` | *(ralat 2026-10-24: tabel ini sebelumnya menyebut `src/styles/bootstrap.scss` dan `src/styles/velzon.scss` — dua berkas yang **tidak pernah ada**; nama nyata terukur dari `ls src/styles/`)* |
| `src/styles/_bootstrap-parts.scss` | parsial Bootstrap yang diizinkan `TECH_CONVENTIONS §6(6)`: `functions/variables/variables-dark/maps/mixins/utilities/root/images/containers/tables/forms/buttons/dropdown/nav/navbar/card/badge/alert/progress/list-group/close/modal/pagination` | **tanpa** `reboot`, `type`, `grid`, `utilities/api`, dan **tanpa** `bootstrap.js`. `grid` sengaja tidak dimuat dan tidak ada satu pun TSX yang memakai `.row`/`.col-*` (terukur 2026-10-24: 4 kemunculan `row` semuanya Tailwind `flex-row`/`table-row`), jadi tata letak halaman memang milik Tailwind — bukan Bootstrap yang hilang diam-diam |
| `src/styles/_velzon-skeleton.scss` | kerangka yang bukan milik Bootstrap: `.topnav` dua baris (`.navbar-header` + `.navbar-nav-main`), `.app-menu`, `.dropdown-item` menu utama, `.navbar-actions`/`.navbar-btn`/`.navbar-profile`, `.page-title`, `.footer`, `.btn-soft-*` | kelas aplikasi lama di `globals.css` **tidak** dihapus sebelum layarnya dimigrasi — lihat urutan migrasi |
| `src/styles/_velzon-auth.scss` | kerangka layar autentikasi (`.auth-fluid*`) | layar ini **tidak** memakai `.topnav`, jadi pemisahan berkas menjaga gerbang `verify-css-artifact` tetap per-ranah |
| `src/app/globals.css` | `:root` + `[data-bs-theme]`/`[data-layout-style]`/`[data-layout-width]`/`[data-topbar]`, kelas komponen lama | tetap otoritas warna & tipografi; tidak ada hexa baru di berkas lain |

**Preferensi tata letak = kosakata Velzon.** `ThemeProvider` sekarang menulis empat atribut pada `<html>`: `data-bs-theme` (`light`/`dark`), `data-layout` (`horizontal` — nilai baku rute aplikasi; tidak dipasang pada halaman publik `/` dan `/login`), `data-layout-style` (`default`/`gradient`/`separated`), `data-layout-width` (`fluid`/`boxed`), plus `data-topbar` (`light`/`dark`). Pemetaan dari kosakata lama: `solid→default`, `gradient→gradient`, `minimal→separated`, mode `semi-dark→` `data-bs-theme=light` + `data-topbar=dark`. Bentuk penyimpanan `localStorage['sica.ui.theme']` berubah; nilai lama yang tidak dikenali **jatuh ke default** (satu-kali reset preferensi, bukan migrasi dua kosakata).

**Kerangka wajib rute aplikasi** (struktur, bukan hiasan — `§9.2` tetap mengatur isi halaman):

```
<div id="layout-wrapper" class="layout-wrapper">
  <header class="topnav">
    <nav class="navbar navbar-header navbar-expand-lg ...">
      <div class="container-fluid">
        <ul class="navbar-nav ...">          <li class="nav-item"><a class="nav-link">…</a></li></ul>
        <ul class="navbar-nav ms-auto">      <li class="nav-item dropdown">…<div class="dropdown-menu">…</div></li></ul>
      </div>
    </nav>
  </header>
  <main class="main-content"><div class="page-content">…</div></main>
  <footer class="footer">…</footer>
</div>
```

**Preferensi lapisan CSS — dibaca sebelum menyalahkan tampilan.** Bootstrap berada di `@layer bootstrap`, kerangka Velzon di `@layer velzon` (`bootstrap` lebih dulu), dan **Preflight Tailwind diikat ke `@layer reset` yang berperingkat paling rendah** (`@layer reset, bootstrap, velzon;` + `@layer reset { @tailwind base; }` di kepala `globals.css`). Seluruh aturan aplikasi + utilitas Tailwind tetap **tidak ber-layer**, dan menurut spesifikasi CSS gaya tak-bertingkat selalu mengalahkan yang bertingkat. Artinya: (a) kelas Tailwind lama tetap menang atas Bootstrap — itulah sebabnya migrasi per layar aman; (b) bila sebuah layar terlihat "setengah Velzon", itu status migrasi yang diharapkan, bukan bug lapisan; (c) **dilarang** menaikkan `!important` untuk mengalahkan layer — yang benar adalah memigrasikan layarnya.

**Dua fakta terukur yang memaksa bentuk di atas (ralat 2026-10-24, `RD-171`).** Sebelum ralat ini, norma di atas tertulis benar tetapi **tidak berjalan**, dan dua pengukuran pada artefak nyata menjelaskan kenapa:

1. **Urutan impor TIDAK mengontrol urutan CSS.** `app/layout.tsx` mengimpor `theme.scss` sebelum `globals.css`, tetapi keluaran `/_next/static/css/app/layout.css` menempatkan `.card-body` aplikasi di baris 608 dan `.card-body` Bootstrap di baris 9612 — terbalik, dan tetap terbalik setelah `next dev` dihentikan-dan-dinyalakan ulang. Karena itu "yang belakangan menang" tidak boleh dipakai sebagai mekanisme prioritas; hanya layer yang menjaminnya. (Percobaan membuang layer dan mengandalkan urutan sumber mengembalikan cacat: 45 `.card` di aplikasi langsung berubah bentuk karena `.card-body` Bootstrap 16px menang atas 24px milik aplikasi.)
2. **Dua reset universal hidup berdampingan.** Preflight Tailwind (`*,::before,::after { box-sizing; margin:0; padding:0 }`) dan salinan tangan `* { box-sizing; padding:0; margin:0 }` di bagian bawah `globals.css`. Karena keduanya **tanpa layer** dan kerangka Bootstrap/Velzon **ber-layer**, reset itu meniadakan SETIAP `padding`/`margin` di dalam `@layer bootstrap`/`@layer velzon` berapa pun spesifikitasnya. Bukti browser: `.auth-fluid-sidebg` dihitung `padding: 0px` sementara `gap` pada elemen yang sama `40px` — panel kiri `/login` terpotong sampai ke tepi layar persis seperti dikeluhkan pemilik produk.

**Yang dilakukan:** Preflight diikat ke `@layer reset` (satu baris dikepung layer, bukan menyalin ulang preflight), salinan tangan `*` **dihapus** (satu hal = satu sumber), dan `verify-css-artifact.mjs` kini mengasersi (i) urutan pendaftaran layer, (ii) preflight benar-benar di dalam `@layer reset`, (iii) `.auth-fluid-sidebg` membawa `padding`, dan (iv) **tidak ada** aturan `* { padding: 0 }` tanpa layer — penahan regresi agar salinan kedua tidak kembali. **Larangan baru:** jangan pernah menulis reset universal di luar `@layer reset`, dan jangan memindahkan `@tailwind base` keluar dari layer itu tanpa pengukuran ulang pada artefak build.

**Catatan metode.** Layar autentikasi hanya bisa diukur pada viewport ≥1024px karena kolom duanya hidup di media query. Browser tertanam Qoder 510px, jadi pengukuran dilakukan dengan **iframe sebaris 1440×900 yang menunjuk rute yang sama** (media query di dalam iframe memakai viewport iframe, dan karena same-origin hasil `getComputedStyle` dapat dibaca) — bukan dengan menebak dari CSS. Tangkapan layar desktop penuh memakai `chrome.exe --headless=new --window-size=1440,900 --screenshot`.

**Ikon.** Kerangka (menu, pita atas, pengalih, utility) memakai **Remix Icon** `<i class="ri-*-*-line">`; `lucide-react` dipertahankan hanya di layar yang belum dimigrasi dan **dilarang** menambah pemakaian baru di layar yang sudah. Satu layar = satu set ikon; dua set dalam satu bar navigasi adalah temuan audit, bukan gaya.

**Badge & tombol.** Kosakata Velzon `bg-warning-subtle` + `text-warning-emphasis` (setara 5.3) menjadi bentuk kanonik baru; `.badge-soft-*`/`.btn-soft-*` kita tetap sah sebagai implementasi lokal dengan nada yang sama — **satu** keluarga per layar, jangan dicampur dalam satu sel tabel. **Ralat kilau tombol (2026-10-24):** `.btn-sweep::after` memakai `background-size: 100% 2px` + `background-position: -100% 0` untuk menyembunyikan garis kilau saat diam — rumus posisi persentase CSS mengalikan `(lebar kontainer − lebar gambar)`, yang **nol** bila keduanya sama, jadi garis putih 2px justru terlihat permanen di tepi atas tombol "Masuk Sekarang". Bentuk sekarang: posisi diam `0 0` dengan `transform: translate3d(-100%,0,0)`, hover/fokus `translate3d(100%,0,0)`, dan `overflow: hidden` pada `.btn-sweep` agar kilau tidak keluar; `prefers-reduced-motion` tetap `display: none`.

**Kerangka autentikasi (dipasang 2026-10-24, `/login`).** Struktur Velzon `auth-signin-cover`: `.auth-fluid` → `.auth-fluid-sidebg` (panel kiri) + `.auth-fluid-content` → `.auth-logo` → `.auth-content > .auth-inner > .card > .card-body` → `.auth-fluid-footer`. Kelasnya ada di `@layer velzon` (`src/styles/_velzon-auth.scss`); kontennya tetap pernyataan lingkup SICA (47 layanan = data registri), bukan tangkapan layar fitur palsu. Tautan "lupa kata sandi?" pindah ke sebaris label (`.auth-field-head` + `.auth-field-link`) seperti Velzon, bukan menggantung di bawah form.

**Bentuk field & tombol kanonik (terukur 2026-10-24).** `.velzon-input` = padanan `.form-control` Velzon: latar `--sica-surface-input` (hampir putih di terang, `#21262c` di gelap — **bukan** putih paksa), border `--sica-border-color`, **radius 8px** (`--sica-radius-md`), `font-size .8125rem`, fokus = border primary + `0 0 0 4px rgb(primary / .25)`. Sebelumnya 12px + latar `slate-50/50`, yang melanggar §2.0 sendiri ("radius kanonik Velzon: `rounded-md` = 8px tombol & input"). `Button` dasar ikut `rounded-md`; `.field-label` = `.form-label` Velzon (13px/600).

**Panel kustomiser (design panel).** `components/layout/design-panel.tsx` = tombol melayang `.customizer-toggle` + laci `.customizer-panel` (Escape/klik-luar menutup), dipasang di `app/layout.tsx` **di dalam** `ThemeProvider`. Ia satu-satunya permukaan untuk `data-topbar`/`data-layout-style`/`data-layout-width`; baris atas hanya menyisakan `.navbar-btn` alih gelap/terang (`ThemeModeToggle`) supaya tidak ada dua UI untuk satu knob. Pil menawarkan **hanya nilai yang dirender**: `Vertikal` tampil ber-`disabled` dengan alasan (`UI-VLN-6`), dan di `/` + `/login` knob tata letak ikut `disabled` + keterangan — mode warna tetap hidup. Pelajaran pemasangan: letak komponen menentukan konteks; `DesignPanel` di luar `ThemeProvider` menghasilkan knob yang tampak hidup tetapi tidak menulis apa pun.

**Cara mengukur di browser tanpa tertipu.** Permukaan in-app melaporkan `visibilityState=hidden`; browser membekukan transisi di halaman tersembunyi, sehingga `getComputedStyle` mengembalikan nilai AWAL transisi (mis. field tetap tampak terang sesudah `data-bs-theme=dark`). Suntik `*{transition:none!important}` sebelum membaca, atau baca variabelnya, sebelum menuduh cacak produk — `--sica-surface-input` di elemen sudah benar saat nilai tersubstitusi terlihat basi.

**Urutan migrasi (`UI-VLN-1…6`, ROADMAP §2.36).** PR-1 kerangka + token → PR-2 `/login` & landing → PR-3 `/admin/**` (R-2) → PR-4 `/platform/**` (R-1) → PR-5 layar akademik/mahasiswa → PR-6 `vertical` (menunggu menu-as-data). Setiap PR **wajib** menutup `tsc --noEmit`, `pnpm --filter @sica/web test`, `node .tools/gate-run.mjs` FAIL=0, dan bukti DOM runtime (`--bs-*` hadir, `navbar-nav` > 0, `i[class^="ri-"]` > 0, `data-layout="horizontal"`), sebelum satu layar berikutnya disentuh.

---

### 2.7 Audit kerangka Velzon & penamaan menu — 2026-10-24 (permintaan pemilik, siklus 12)

**Dasar.** Pemilik mengirim tangkapan layar baris menu Operator Platform (dropdown *Manajemen SaaS & Tenant Licensing* terbuka) dan menilai hasilnya **"kaku dan belum full memakai styling Velzon"**, lalu meminta audit nama menu + desain + UI. Audit ini tidak membaca kesan: setiap temuan di bawah punya angka dari kode/CSS/DOM, dan setiap vonis menyebut siapa pemiliknya.

| # | Temuan (terukur) | Vonis & pemilik keputusan | Status |
|---|---|---|---|
| F-1 | **38 dari 56 daun** dua pohon menu memakai **kalimat spesifikasi** sebagai nama, bukan nama menu: terpanjang `platform.licensing.addons` **138 karakter**, lalu `admin.parameters.reference` 115, `admin.identity.accounts` 105, `admin.identity.rbac` 88, `platform.master.lookup` 87. Polanya seragam: `Nama (Daftar, Isian, Yang, Panjang)` | Ini **bukan** kesalahan implementasi — ini konsekuensi langsung instruksi pemilik 2026-10-24 ("gunakan seluruh menu tanpa ada yang dikurangi atau disingkat") yang dikunci sebagai label verbatim `BLUEPRINT §12`. Pembanding nyata: Sevima menamai hal yang sama **"User"**, **"Role"**, **"Hak Akses"**, **"Log Login"**, **"Data Backup"**, **"Kustomisasi Form"**, **"Plugin/Addon"** (`BENCHMARK_SEVIMA §7B.1`, [KUAT]); Velzon memakai satu–dua kata. **Ralat angka:** baris ini awalnya mencetak "24 dari 55"; itu dihitung dengan ambang 33 karakter dan jumlah daun yang salah — terukur ulang dengan ambang **> 30 karakter** pada `menu-tree.ts` = **38 dari 56** (dicatat di `BLUEPRINT §12.7`, `PROGRESS_REPORT §5.89`) | **DIPERBAIKI** (keputusan pemilik 2026-10-24: "sudah di fixing dan lakukan perbaikan"). Rantai lengkap: `DATA_MODEL §21.7` butir 4 + migrasi `0096`, `BLUEPRINT §12.7`, baris kontrak `§4.17.1` di API_SPEC, lalu kode. Nama nav pendek di `label`, teks panjang pindah ke `description` |
| F-2 | Item dropdown dirender sebagai `<a class="dropdown-item">{teks}<i gembok></a>` di dalam flex container `align-items: center`. Teks telanjang menjadi *anonymous flex item* yang tidak bisa menyusut, sehingga gembok MFA dan lencana **SEGERA melayang di tengah** blok teks 5–6 baris — persis yang terlihat pada tangkapan layar | Cacat render nyata. Perbaikan: teks dibungkus `.menu-item-label` (`flex: 1 1 auto; min-width: 0`), gembok masuk `.menu-item-meta` (`flex: 0 0 auto; margin-top: 2px`), item `align-items: flex-start`, lencana `data-soon` ikut ke atas | **DIPERBAIKI** — `top-nav.tsx` + `_velzon-skeleton.scss`, terverifikasi di DOM (`labelSpan: true` pada kelima item, `meta: true` pada dua item ber-MFA) |
| F-3 | `.nav-link:hover { background-color: var(--sica-surface-hover) }` memberi **pil hijau muda** pada item baris menu yang sedang dibuka ("Manajemen SaaS & Tenant Licensing" di tangkapan layar). Velzon horizontal tidak pernah mempil item baris atas — penandanya warna teks + garis bawah; pil adalah kosakata `.dropdown-item` | Ini sumber rasa "kaku" yang paling terasa: item navigasi terlihat seperti tombol tertekan. Perbaikan: hover hanya mengubah warna, dan garis bawah aktif kini **juga** tampil saat dropdown terbuka (`[aria-expanded='true']::after`) | **DIPERBAIKI** |
| F-4 | Item dropdown aktif memakai kelas utilitas (`bg-primary-soft text-primary-hover`) alih-alih kelas kerangka | Dua rumah untuk satu keadaan (pola `RD-32`). Kini `.dropdown-item.active` dimiliki `_velzon-skeleton.scss`, warna tetap dari token | **DIPERBAIKI** |
| F-5 | `§2.6` "Peta berkas" menyebut `src/styles/bootstrap.scss` dan `src/styles/velzon.scss` — **dua berkas yang tidak pernah ada**; nyata: `theme.scss`, `_bootstrap-parts.scss`, `_velzon-skeleton.scss`, `_velzon-auth.scss`, `_velzon-config.scss` | Dokumen yang salah nama berkas membuat agen berikutnya mengedit angin. Tidak ada gerbang yang menangkap kelas ini (nama berkas bukan `BERKAS §nomor`, jadi `ref-audit` buta terhadapnya) | **DIPERBAIKI** di tabel §2.6, plus catatan bahwa `grid` memang tidak dimuat dan **nol** TSX memakai `.row`/`.col-*` (4 kemunculan `row` = Tailwind `flex-row`/`table-row`), jadi tata letak halaman memang milik Tailwind — bukan Bootstrap yang hilang diam-diam |
| F-6 | Kosakata kartu campur: **55** pemakaian `.card` vs **30** permukaan tangan `rounded-* border:*`; struktur Velzon jarang dipakai lengkap — `card-header` 9, `card-body` 13, `card-footer` 3, `card-title` 6, `card-subtitle` 3 | Vonis jujur setelah melacak lokasinya: 30 pola tangan itu **mayoritas landing/auth/primitif UI** (`app/page.tsx`, `landing-shell`, `hero-mockup`, `drawer`, `velzon-chart`) — sah, karena itu bukan kartu halaman. Yang kartu halaman dan sudah benar memakai `.card`/`CardHeader`/`CardTitle` (Dashboard, Aksi Cepat memakai `card card-hover`). Jadi ini **bukan** cacat sistemik; aturannya dinormakan di §2.7.2 supaya tidak meluas | **DINORMAKAN**, tidak "diperbaiki" — tidak ada temuan kartu halaman yang salah rumah |
| F-7 | Proses: commit `b3fb91e` yang baru saya kirim mengandung **error tipe** di `tests/unit/menu-tree.test.ts` (`Property 'href' does not exist on type 'MenuSeedNode'`), lolos karena sapuan verifikasi terakhir menjalankan `vitest` + `lint` + `gate-run` tetapi **`tsc` terakhir dijalankan sebelum suntingan uji itu** | Kesalahan saya, bukan alat: `tsconfig` sudah meng-`include` `**/*.ts`, jadi `turbo run typecheck` menangkapnya — saya yang tidak menjalankannya pada titik itu. Normanya sekarang: **setelah suntingan berkas uji, `turbo run typecheck` wajib sebelum klaim hijau**, bukan hanya vitest | **DIPERBAIKI** (perbaikan `!l.node.routeKey`); `turbo run typecheck` **7/7**, vitest **257/257** |

#### 2.7.1 Penamaan F-1 — diputus dan dijalankan (ralat atas "menunggu keputusan")

Prinsip yang dilaksanakan: **nav menampilkan nama, layar menampilkan keterangan.** Register §12 tidak dibuang — teks panjangnya pindah menjadi `description` (tooltip `title` + subjudul layar), sementara `label` menjadi nama menu satu–dua kata ala Sevima. Pemetaan lengkap 38 baris tinggal di **`BLUEPRINT_ROLE_BY_ROLE §12.7`** — bagian ini tidak menyalinnya (`RD-55`: angka/daftar yang perlu dikutip menunjuk pemiliknya). Bentuk contoh:

| `code` | nama nav (`label`) | keterangan (`description`, teks §12 yang sudah ada) |
|---|---|---|
| `platform.licensing.addons` | Add-on & Lisensi | Management Add-on Entitlement (PMB OCR, Multi-VA, LMS Teams Vicon, HRIS BKD, E-Procurement, e-Library, Klinik, AI Retention, Multi-Branch) |
| `platform.licensing.quotas` | Kuota & Masa Berlaku | Pengaturan Expiry Date Lisensi & Limit Kuota (Max Active Students, Max Storage) |
| `platform.master.lookup` | Kamus Baku Dikti | Master Lookup Baku Dikti (Agama, Status Marital, Disabilitas, Transportasi, Pembiayaan) |
| `platform.monitoring.resource` | Monitor Sumber Daya | Live Resource Monitor (CPU, RAM, DB Connection Pool, Redis Cluster Global) |
| `admin.parameters.reference` | Referensi Operasional | Parameter Referensi Operasional Lokal (Atribut Fisik Almamater, Toga, Ukuran Kaos, Gedung/Ruang, Ormawa, Poin SKKM) |
| `admin.identity.accounts` | Akun Sivitas | Manajemen Akun Sivitas Akademika (Import/Export/Disable Staf BAAK, BAUK, HRD, Keuangan, Dosen, Mahasiswa) |
| `admin.identity.rbac` | Matriks Hak Akses | Matriks Hak Akses RBAC Granular (CREATE, READ, UPDATE, DELETE, APPROVE, EXPORT per Role) |
| `admin.identity.sso` | Single Sign-On | Integrasi Single Sign On (Google Workspace, Microsoft 365, LDAP Local) |

Tiga konsekuensi yang saya prediksi di versi awal bagian ini dan ternyata benar-benar harus dibayar — dicatat supaya prediksi berikutnya dinilai dari sini, bukan dari nadanya: **(a)** saya menulis "`§12.1`/`§12.2` harus ditulis ulang dengan kolom `Label nav` + `Deskripsi`" — ternyata **tidak**: yang benar adalah register §12.1/§12.2 dibiarkan utuh (ia pemilik *keterangan*) dan nama nav diberi rumahnya sendiri di §12.7; menulis ulang 39 baris verbatim hanya untuk menambah kolom akan menyentuh teks yang dijanjikan "tidak dikurangi" ke pemilik. **(b)** kolom `description` memang perlu migrasi (`0096`) — itu satu-satunya ramalan yang tepat. **(c)** klaim "label verbatim" di `§12.6`/`PROGRESS_REPORT §5.86` memang harus diralat, bukan dihapus — ia masih benar untuk **isi** register, hanya bukan lagi untuk **kolom** `label`.

**Aturan render yang berlaku sekarang.** `menuLabel(node)` = `dict.navigation[labelKey] ?? (bahasa === 'en' ? labelEn : label)`; `description` **tidak pernah** masuk jalur itu — ia hanya `title` pada item dropdown. Nama kelompok (§12.6) tidak ikut dipangkas apa pun panjangnya, karena ia adalah judul yang pemilik kunci verbatim.


#### 2.7.2 Aturan kartu yang berlaku

Satu permukaan kartu halaman = `.card` (+ `.card-header`/`.card-body` bila ada judul/aksi; `.card-footer` hanya bila ada aksi penutup). Utilitas `rounded-*`/`border-*` tangan **boleh** untuk chip, tile kecil, kerangka landing, dan primitif UI — bukan untuk kartu yang memuat data. Alasannya bukan selera: `.card` adalah satu-satunya tempat `--sica-shadow-card` + `--sica-radius-lg` + `card-hover` bertemu, jadi kartu tangan otomatis kehilangan elevasi dan ritme hover yang membuat Velzon terasa "hidup".

#### 2.7.3 Batas bagian ini

Bagian ini adalah **audit yang kemudian dieksekusi**, bukan klaim selesai dari sejak awal. Yang saya perbaiki (F-2…F-5, F-7) murni kecacatan implementasi dan tidak menyentuh kontrak data apa pun. Yang terbesar dan paling menentukan rasa "kaku" — **F-1, nama menu** — pada awalnya sengaja **tidak** saya ubah sendiri karena ia membalas instruksi pemilik yang masih tercatat; setelah pemilik menyetujuinya (siklus 12) F-1 berjalan lewat rantai dokumen penuh (`DATA_MODEL §21.7` butir 4 + `0096` → `BLUEPRINT §12.7` → `API_SPEC §4.17.1` → bagian ini → kode), bukan lewat suntingan langsung di `menu-tree.ts`. Jumlah daun, grant, `code`, `layer` dan `route_key` tetap; yang berubah hanya `label` (memendek) dan kolom baru `description` (menerima teks lama). Konsekuensi penjaga dinyatakan apa adanya: `verify:menu`/`menu-tree.test.ts` tidak lagi membuktikan "label verbatim", tetapi **"keterangan verbatim"**. Konfirmasi visual tetap terhalang: browser in-app tidak punya surface visible (viewport 0×0), jadi perbaikan F-2/F-3 diverifikasi dari DOM + CSS terkompilasi, bukan dari tangkapan layar.


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
- **Emblem** (`public/sica-emblem.png`, background transparan, hasil `scripts/make-logo-transparent.mjs` + `scripts/crop-logo-emblem.mjs`) dipakai berdampingan dengan wordmark **"SICA"**.
- Jangan menambahkan kepanjangan atau slogan pada lockup tanpa keputusan nama produk yang terdokumentasi. Varian `dark` dipakai di atas latar gelap; favicon dan metadata memakai aset merek yang sama.

### 4.2 Sistem Motion (Web)
- Landing & transisi memakai **IntersectionObserver + animasi CSS** (`components/landing/motion.tsx`: `Reveal`, `CountUp`; keyframes di `globals.css`), bukan hanya Framer Motion, agar ringan di server component.
- Wajib menghormati **`prefers-reduced-motion: reduce`** (semua animasi non-esensial dinonaktifkan).
- Animasi masuk dibatasi pada opacity/transform; tidak memakai gerak mengambang terus-menerus. Tombol utama boleh memakai sapuan garis tipis satu kali saat hover/fokus dan terangkat maksimum 1 px; tanpa animasi berulang, tanpa menutupi teks, dan seluruh efek dinonaktifkan pada reduced-motion.
- Pilihan peran tampil dalam satu baris dan dapat digeser mendatar saat tidak cukup lebar. Perubahan panel peran dan pembukaan rincian katalog memakai transisi singkat; konten tetap langsung tersedia bagi pengguna yang mematikan gerakan.
- Header landing: sticky + scroll-spy (menandai menu aktif) + bilah progres baca yang diperbarui per animation frame + shadow saat digulir. Navigasi memakai tautan jangkar satu halaman: saat dipilih, bagian tujuan digulir ke awal tepat di bawah header; bagian lain tetap menjadi bagian landing dan dapat dijelajahi dengan gulir normal. Jangan mengganti pola ini dengan panel tersembunyi atau rute terpisah tanpa keputusan produk.
- Pada katalog 47 layanan, kartu tidak menampilkan kode internal `M-xx`; judul memakai nama yang mudah dipahami dan peran sasaran tampil sebagai label. Sediakan pencarian nama/kata kunci, filter peran, dan filter kategori layanan. Label `Paket inti` dan `Add-on` hanya untuk entitlement yang terdaftar; gerbang peran ditandai `Akses berbasis peran`, sedangkan entitlement `usulan:` ditandai `Usulan belum dipetakan`. Sertakan keterangan bahwa kategori ini bukan janji harga, ketersediaan, atau paket kampus tertentu. Nama katalog tetap tersedia di data untuk penelusuran internal, dan penjelasannya dapat dibuka satu per satu atau sekaligus. Grid menjadi dua kolom mulai lebar 360 px dan tiga kolom pada desktop lebar.
- Teks landing dan login ditujukan untuk pembaca umum: hindari rujukan dokumen, singkatan yang tidak dijelaskan, dan istilah teknis bila ada padanan sederhana. Bedakan dengan jelas antara rencana dan layanan yang sudah tersedia.

### 4.3 Halaman Login
- Desktop memakai panel informasi dan formulir dalam kolom 55:45; pada layar kecil, formulir ditampilkan lebih dahulu dan panel informasi menyusul. Halaman boleh bergulir pada viewport pendek agar field dan footer tidak terpotong.
- Kartu formulir memakai permukaan terang, border tipis, lebar maksimum 26rem, dan kontrol input/tombol dari komponen bersama. Font mengikuti Plus Jakarta Sans serta skala tipografi global.
- Placeholder memakai token teks muted (bukan subtle) agar tetap terbaca pada latar input; teks sekunder panel gelap memakai opasitas minimum yang memenuhi kontras AA.
- Panel informasi hanya menyatakan status pengembangan dan jumlah layanan yang direncanakan. Formulir login tidak mengulang petunjuk kode kampus di bawah input. Tautan "Lupa kata sandi?" membuka dialog email yang aksesibel; sebelum layanan pemulihan terhubung, tombol kirim hanya menampilkan keterangan bahwa permintaan belum dikirim dan tidak boleh memberi kesan email berhasil terkirim.

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
- Provide explicit `data-theme='dark'` token overrides (see §1.2 — berkas kanoniknya `apps/web/src/app/globals.css`; `tokens.css` tidak pernah ada, lihat §11.1).

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
2. **Menu = peran × entitlement × status data.** Menu transaksi modul yang tidak berlisensi tidak muncul; guard `withModule` di API tetap wajib. **Katalog read-only terpisah** boleh menampilkan kartu terkunci/usulan dengan sebab dan tanpa aksi beli/aktivasi yang belum sah (§9.14). Target yang belum punya backend diberi status spec-only, bukan dipresentasikan sebagai transaksi aktif.
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
| **C. Personel** | grid + tab detail (Biodata, Alamat, Wali, Dokumen, Riwayat status) | PII ter-masking untuk peran non-pemegang `INSERT`/`UPDATE` |
| **D. Penyelenggaraan** | grid + **matriks jadwal** (hari x jam) dengan sel bentrok merah + drawer "Generate Kelas" | conflict-detector service sudah ada; tampilkan konflik per sel |
| **E. Pengaturan Akademik** | **wizard 4 langkah** (Jendela -> Kuota & Prasyarat -> Gerbang & Cekal -> Nilai & Kuesioner) + **diff sebelum simpan** + pratinjau dampak | pengganti langsung 9 tab kali puluhan switch Sevima (§2.8 D-6) |
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
- Istilah Indonesia konsisten: **Periode**, **Mata Kuliah**, **Ruang**, **Pengaturan Akademik**, **Cekal**, **Presensi**, **Nilai**, **Yudisium** — selaras [GLOSSARY.md](file:///c:/SICA/docs/GLOSSARY.md). Padanan istilah Sevima dicatat agar admin yang pindah tidak bingung (`Sistem Kuliah` -> *Skema Penerimaan*; `Unsur Nilai` -> *Komponen Nilai*; `Status Semester` -> *Status Akademik per Semester*).

### 9.6 Paritas Mobile (AGENTS §3.4)
Admin tidak perlu layar penuh di Flutter, tetapi tiga aksi wajib ada di mobile (kasus nyata: kaprodi/dekan bergerak): (1) **persetujuan** (KRS, koreksi nilai, perubahan status, keringanan), (2) **monitoring pengisian nilai** per kelas, (3) **buka/tutup presensi** dan QR sesi. Data hanya lewat rute `/api/v1/*` yang sama; tidak ada endpoint khusus mobile.

### 9.7 Inventaris modal & strip status dari state machine (2026-10-19)
Rujukan detail: [BLUEPRINT_ENTERPRISE.md §3.4](file:///c:/SICA/docs/BLUEPRINT_ENTERPRISE.md) (21 modal, nama, perilaku wajib, aksi API) dan §5 (8 state machine). Yang di bawah ini adalah **konsekuensi visualnya**, agar modal tidak dikarang ulang per layar.

**Aturan modal (berlaku untuk 21 modal yang terdaftar):**
- **Drawer, bukan dialog bertumpuk.** Form master & transaksi memakai drawer kanan (Velzon `offcanvas`) — satu drawer aktif; modal di dalam drawer dilarang (sumber bug fokus & scroll).
- **Modal keputusan (`approve`/`reject`/`unlock`/`dispense`)** selalu memuat: ringkasan objek (3 baris maksimum), kolom `reason` wajib (min 10 karakter, `422` bila kosong), dan tombol bahaya memakai varian Velzon `btn-danger`/`btn-warning` — bukan `btn-primary`.
- **Konfirmasi berbasis angka, bukan kata.** Tulis destruktif atau berdampak luas menampilkan dampak terhitung dari `impact` API (`§4.6`), mis. "42 mahasiswa kehilangan kelas ini". Tombol baru aktif setelah angka terbaca (`AC-AKA-1`/FR-ADM-12).
- **Tidak ada optimistic UI untuk tulis master.** Mutasi data master/nilai/keuangan menunggu respons server; spinner inline + baris tetap `pending`. Optimistic hanya untuk preferensi tampilan.
- **Empat-mata di UI.** Bila aksi memerlukan persetujuan kedua, layar menampilkan **status permintaan** (`PENDING/APPROVED/REJECTED`), bukan tombol "selesai". Pengguna yang sama tidak pernah melihat tombol approve untuk permintaannya sendiri.

**Strip status state-machine (komponen baru `StateMachineStrip`):**
Setiap halaman transaksi (KRS, nilai, tagihan, yudisium, feeder) menampilkan satu strip horizontal yang memetakan state objek ke SM terkait (SM-1..SM-8) — **diambil dari field `state` + `allowedTransitions` respons API, bukan ditebak UI**. Isinya:
1. state sekarang (chip Velzon, warna token `success/warning/danger/secondary`),
2. transisi yang **boleh** dijalankan pengguna itu saat ini (tombol; sisanya tidak dirender, sesuai §9.1),
3. sebab bila transisi tidak tersedia (pesan `admin.errors.<KODE>` dari §4.6.5/§4.6.6 — ini FR-ADM-11 "mengapa terkunci"),
4. tautan ke pemegang kewenangan berikutnya (mis. "menunggu persetujuan TREASURER").

Alasan strip ini wajib: pada pembanding, kegagalan operasi hampir selalu berupa pesan umum tanpa sebab dan tanpa jalan keluar (BENCHMARK D-4/D-6). Strip ini mengubah 403/409/423 menjadi **instruksi**, dan karena daftarnya dihitung server, UI tidak dapat menawarkan aksi yang akan ditolak guard.

**Paritas label & i18n.** Kunci modal: `admin.modal.<nama>.title/confirm/cancel/reasonLabel`; kunci strip: `admin.sm.<SM-id>.<state>` + `admin.sm.transition.<aksi>`. Label aksi memakai 6 verba yang diterjemahkan konsisten: READ→*Lihat*, INSERT→*Tambah*, UPDATE→*Sunting*, DELETE→*Hapus*, VALIDATE→*Sahkan/Tolak/Buka kunci/Dispensasi* (tergantung konteks, bukan satu kata untuk semua), OTHER→*Proses* (lihat §0.4 [BLUEPRINT](file:///c:/SICA/docs/BLUEPRINT_ENTERPRISE.md)).


### 9.8 Aturan masking, state per layar, dan inventaris kunci (2026-10-19)
Dasar: [AUDIT_READINESS.md](file:///c:/SICA/docs/AUDIT_READINESS.md) `RD-19` (kunci i18n tidak ada & paritas bocor), `RD-28`, `RD-34`, dan [BLUEPRINT_ROLE_BY_ROLE.md §0.3/§5.1.4](file:///c:/SICA/docs/BLUEPRINT_ROLE_BY_ROLE.md).

**1. Masking adalah state data, bukan styling.** Kolom yang tidak berhak dilihat suatu peran dirender `••••` dengan tooltip sebab ("dibatasi kebijakan — akses atas permintaan via audit"), **bukan** disembunyikan dari DOM dan bukan sel kosong. Nilai sudah dipotong di server sebelum respons keluar; kalau UI bisa melihatnya di DevTools, itu temuan keamanan. Empat kelompok wajib: NIK & nama ibu (DUKCAPIL), penghasilan/pekerjaan penjamin, koordinat GPS presensi (coarse + retensi), dan nominal keuangan untuk peran non-keuangan (BAAK hanya melihat "tertahan/tidak" + sebab).

**2. Matriks state per layar (yang belum pernah ditulis, sekarang diwajibkan).** Setiap layar daftar/detail wajib punya enam keadaan terdefinisikan, bukan hanya loading sukses:

| Keadaan | Wajib ditampilkan | Contoh nyata |
|---|---|---|
| kosong | sebab + tindakan pertama | "Belum ada kelas — buat dari Generate Kelas" |
| loading | skeleton baris, bukan spinner penuh | `VelzonDataGrid` skeleton |
| error server | kode + pesan `admin.errors.<KODE>` + tautan perbaikan | `423 PERIOD_CLOSED` → "periode ditutup, ajukan reopen" |
| ditolak (403/404) | **siapa** yang memegang hak berikutnya | "menunggu persetujuan TREASURER" |
| dibatasi gerbang | strip state + penjaga yang gagal | KRS tertutup tagihan/cekal/AKM |
| offline / sesi kedaluwarsa | read-only cache + tombol ulang autentikasi | mobile: nilai ter-cache, submit ditolak |

**3. Inventaris kunci i18n.** Namespace wajib `admin.*` (`admin.menu.*`, `admin.master.<objek>.title/columns/actions`, `admin.modal.<nama>.*`, `admin.sm.<SM-id>.<state>`, `admin.errors.<KODE>`) **belum ada** di `locales/id.json`/`en.json`; kondisi hari ini `id` 574 daun vs `en` 518 (56 yatim) sudah melanggar aturan paritas. Aturan: layar tidak boleh ditulis sebelum kuncinya masuk inventaris `docs/I18N_KEYS.md` (didaftarkan di ROADMAP), dan diff jumlah kunci menjadi gerbang CI.

**4. Pemetaan status→chip.** Satu kolom status = satu peta chip; jangan pakai tiga chip untuk `invoice_status` yang bernilai tujuh. Peta kanonik (DRAFT→secondary, ISSUED→info, PARTIAL→warning, PAID→success, OVERDUE→danger, WAIVED→secondary, VOID→dark) dipakai identik oleh Web dan Mobile. `empty-state.tsx` dan `impact-dialog.tsx` yang dirujuk dokumen ini **belum ada** di `components/ui/` — keduanya adalah bagian dari slice ADM-1, bukan asumsi.

---

### 9.9 Cluster Platform (`M-01`, `PLATFORM_OPERATOR`) — layar lintas tenant (2026-10-21)

**Dasar.** Tujuh menu `RBAC §6.1 Cluster Platform` dan kartu `M-01` di §17.2.6 menuntut layar sendiri; sebelumnya bagian ini hanya mendefinisikan area Admin **tingkat tenant** (§9.1–§9.8), sehingga operator platform tidak punya rumah visual sama sekali. Kontrak targetnya `API_SPEC §4.20`, bukan jumlah handler hidup; inventaris rekursif dan status parsial dijelaskan di §9.13. Nomornya `RBAC §4.5.3` (baris 302–318), arahnya `BLUEPRINT_ROLE_BY_ROLE` lapisan **R-1**. Bagian ini tidak mengulang angka di berkas itu (`RD-55`) dan tidak menetapkan warna yang bukan bagiannya (§11).

| Menu | Rute layar | Komposisi Velzon yang sah (§11.3) | Sumber data | Penjaga yang terlihat di layar |
|---|---|---|---|---|
| Platform → Provisioning Tenant | `/platform/tenants/new` | wizard 4 langkah = `Card` + `Progress` (bukan stepper baru; tidak ada primitif stepper di inventaris) + `Field`/`Select`; langkah akhir **diff** sebelum komit | `POST /platform/tenants` (303) | MFA sebelum komit; `409 TENANT_PROVISION_FAILED` (150) dirender sebagai `Alert` berisi **langkah yang gugur**, bukan pesan "gagal"; karena transaksinya tunggal, layar tidak pernah menampilkan tenant setengah jadi (**AC-PLT-1**) |
| Platform → Daftar Tenant | `/platform/tenants` | `VelzonDataGrid` + `PageHeader` + `StatusBadge` (`tenant_status`: `ONBOARDING`/`ACTIVE`/`SUSPENDED`/`ARCHIVED`) | `GET /platform/tenants` (302) | paginasi `cursor` dari server; kolom harga hanya muncul bila pemegang punya `platform.plan.view`; tidak ada kolom PII per-record (**AC-PLT-3**) |
| Platform → Paket & Modul | `/platform/plans` | `Table` + `Drawer` (pola daftar → drawer §9.2) untuk isi `plan_modules`; `Badge tone=soft` per SKU | `GET/POST /platform/plans`, `PUT /platform/plans/:planId` (305/306) | menurunkan isi paket yang masih dipakai tenant menampilkan `affectedTenants[]` dari `409 REFERENCE_IN_USE` (19); `expectedVersion` salah → `409` dan layar minta muat-ulang, tidak menimpa |
| Platform → Kuota & Flag | `/platform/tenants/[id]/kuota` | `StatCard` (pemakaian vs batas) + `Input` numerik dengan **rentang sah dari server** (`CHECK` di `DATA_MODEL §3.1`), `Toaster` untuk simpan | `PUT .../quotas`, `PUT .../flags` (307/308) | kunci kuota asing → `422 PLATFORM_QUOTA_KEY_UNKNOWN` (153) dengan sebab terbaca; bendera rilis **tidak** memiliki layar parameter sendiri (satu kolom satu sumber, `PRD §5.11.2` butir 13) |
| Platform → Statistik Agregat | `/platform/usage` | `VelzonChart` + `Sparkline` per `bucket_month`; `Skeleton` saat muat (§11.4), bukan spinner | `GET /platform/usage` (302) | agregat saja; `noisy-neighbour` ditampilkan apa adanya termasuk keadaan `degraded`, tidak dirapikan menjadi angka bulat |
| Platform → Dukungan Terawasi | `/platform/dukungan` | `Drawer` + `ConfirmDialog` (satu lapis); sisa TTL ditulis sebagai **teks** (`12 menit lagi`), bukan warna dan bukan primitif baru — tidak ada `Countdown` di inventaris §11.3; `Avatar` dua orang (peminta & pengesah) | `POST/DELETE /platform/impersonation-grants` (317/318) | TTL ≤ 30 menit **terbaca sebelum** dieksekusi; grant kedaluwarsa → `410 IMPERSONATION_GRANT_EXPIRED` (152); tenant sasaran dapat melihat daftar yang sama (§6.1) |
| Platform → Break-Glass | `/platform/darurat` | `ConfirmDialog` dua langkah (alasan + identitas kedua) — **tidak** memakai `interactive` pada `Card` (§11.3) | `POST /platform/breakglass` (309) | layar menolak render bila `reason` kosong; jejak buka **dan** tutup ditampilkan; dua orang harus terlihat; ini bukan satu-satunya aksi empat-mata platform — settlement manual dan void SaaS juga memisahkan penerbit dari penyetuju (**AC-PLT-4**) |

**Empat aturan yang berlaku untuk seluruh baris di atas.** (1) Cluster ini **hanya** tampil untuk pemegang izin baris terkait; penyaringan menu di sini **bukan** kontrol akses (`AGENTS §3.8`) — penolakannya terjadi di server dan layar wajib dapat menampilkan `403`/`404` dengan sebab. (2) Tidak ada satu pun kosakata status yang dikarang di komponen: `tenant_status`, `subscription_status`, `tenant_module_status` dibaca dari kosakata kanonik dan diterjemahkan `StatusBadge`/`labelForStatus` (§11.3), karena enum adalah kelas A (`AGENTS §3.10`). (3) Kunci i18n `platform.*` wajib ada di `id.json` **dan** `en.json` sebelum layar dianggap jadi (`i18n-parity`). (4) Mobile **tidak** memiliki Cluster Platform: vonisnya operator platform bekerja dari Web, dan keputusan itu dinyatakan di `PRD §5.13`, bukan dibiarkan sebagai perbedaan tak tertulis.


### 9.10 Cluster Data Master & Parameter (M-02) — `/admin/master/**` dan `/admin/pengaturan/**` — 2026-10-21

**Kenapa gugus ini ditulis sekarang.** Benchmark Sevima menaruh kekuatan terbesarnya pada `Data Pelengkap` (enam kategori master) dan `Setting Prodi` (sembilan tab per prodi-per-periode) — [BENCHMARK_SEVIMA §2.3 & §2.4(a)](file:///c:/SICA/docs/BENCHMARK_SEVIMA.md). Setelah dipindai, M-02 punya 16 tabel berlabel, 43 baris katalog, dan 52 rute — tetapi **nol spesifikasi layar** untuk Kamus dan Atribut Kustom, dan meta-konfigurasi (FR-ADM-09) tidak punya alamat layar sama sekali. Mesin tanpa layar tidak bisa diuji oleh pengguna pertama, dan itu yang membuat modul ini "siap spesifikasi" tetapi tidak bisa diterima saat review.

**Aturan komposisi.** Semua komponen di bawah adalah nama yang nyata ada di inventaris §11.3 (`PageHeader`, `VelzonDataGrid`, `Drawer`, `ConfirmDialog`, `Alert`, `Accordion`, `Field`/`Select`, `StatusBadge`, `Skeleton`, `StatCard`, `Toaster`). Yang tidak ada dinyatakan sebagai kekurangan, bukan dipakai seolah ada: **primitif tab belum ada** sehingga "satu layar bertab" (FR-ADM-19) hari ini dirender sebagai `Accordion` per gugus, dan **primitif sakelar belum ada** sehingga nyalakan/matikan parameter memakai `Button` + `StatusBadge` dengan konfirmasi. Membuat `tabs.tsx`/`switch.tsx` adalah task develop (`MDP-0` di [ROADMAP_TASKS.md](file:///c:/SICA/docs/ROADMAP_TASKS.md) §2.28), bukan klaim.

| Layar | Alamat | Peran & aksi | Komposisi Velzon | State yang wajib ada | Penjaga yang terlihat di layar |
|---|---|---|---|---|---|
| Data Referensi bertab | `/admin/master/kamus` | `TENANT_ADMIN` C R U D · `ADMIN_ACADEMIC` C R U D · `HEAD_OF_PROGRAM` R U (kamus prodi) | `PageHeader` + `Accordion` per gugus (§20.4) → `VelzonDataGrid` (`ColumnDef` dari `reference_kinds`), `Drawer` detail berisi nilai + jendela berlaku + `feederCode`, `Field`/`Select` untuk `input_kind`, `ConfirmDialog` untuk `merge` | kosong ("gugus ini belum punya nilai"), muat (`Skeleton` grid), gagal (`Alert` + `offeredRemedy`), turun (`degraded` saat `reference_kind_usage` belum terbaca) | nonaktif ≠ hapus (AC-MD-3); dampak dibaca sebelum hapus (AC-MD-9) dengan daftar permukaan; `merge` butuh alasan + penyetuju berbeda (AC-MD-8); kode kelas B terkunci, label boleh dipetakan (AC-MD-7) |
| Atribut Kustom | `/admin/master/atribut-kustom` | `TENANT_ADMIN` C R U D · peran lain hanya R/U nilai sesuai `role_view`/`role_edit` | `PageHeader` + `StatCard` (jumlah atribut aktif / terspesialisasi / ber-PII) → `VelzonDataGrid` definisi, `Drawer` form definisi (tipe, regex, wajib, `options_kind`, scope, PII), tab riwayat sebagai `Accordion` | kosong, muat, gagal (`CUSTOM_ATTR_REGEX_FAILED`, `CUSTOM_ATTR_LIMIT_EXCEEDED`, `CUSTOM_ATTR_READONLY_FOR_ROLE`), batas tercapai (plafon 40 terspesialisasi) | atribut tidak dapat menciptakan keadaan mesin (AC-MD-5); berpilihan wajib menunjuk kamus; aktivasi butuh empat-mata + MFA; nilai `SERVER_ONLY` tidak pernah diterima dari body (AC-MD-10) |
| Parameter Sistem | `/admin/pengaturan/parameter` | Admin IT mengikat konfigurasi teknis; persetujuan REGULATORY/SECURITY memakai kode 375/376 (`RBAC §4.5.10`), pemilik domain menyetujui kebijakan NIM/SKS/presensi/keuangan; grant lama masih perlu migrasi (§6.8) | `PageHeader` + filter kelas (`Select` enam nilai enum) + `q` + `VelzonDataGrid` (key, nilai berlaku, unit, rentang `min/max`, modul pemilik, `parameter_version`) → `Drawer` riwayat hanya-tambah + pratinjau dampak | kosong, muat, **`pending`** (badge "menunggu persetujuan" — nilainya tidak dipakai pembaca mana pun), gagal dengan sebab `BR-PG1` ("rumahnya bukan di sini"), turunkan versi (`?at=`) | ambang keamanan tidak dapat dilonggarkan melewati rentang `CHECK` (AC-PG-4); MFA + penyetuju kedua untuk `REGULATORY`/`SECURITY` (AC-PG-3); berlaku tanpa rilis < 60 detik (AC-PG-1) dan itu yang dijanjikan di layar, bukan angka lain |
| Meta Konfigurasi Form & Laporan | `/admin/pengaturan/meta` (alamat baru, sebelumnya tidak ada di dokumen mana pun) | `TENANT_ADMIN` R U · `ADMIN_ACADEMIC` R U (objek wilayahnya) | `PageHeader` + `Accordion` per entitas → daftar kolom (`VelzonDataGrid`: kolom, label ID/EN, urutan, visibilitas per peran), blok tanda tangan & template laporan sebagai `Drawer` | kosong (belum ada meta terspesialisasi → tampilkan bawaan), muat, gagal (`400` bila mencoba membuka kolom `SERVER_ONLY`), berhasil (preview dua bahasa) | visibilitas adalah **proyeksi server**, bukan sembunyikan sel (AC-MD-10); perubahan kolom PII tercatat before/after + dibacakan ke peran subjek data; paritas Web↔Flutter diuji dari satu sumber baca |
| Impor Data Master | `/admin/impor` | `TENANT_ADMIN`/`ADMIN_ACADEMIC` R V C (dua aksi berbeda: `master.import.validate` 319 lalu `.commit` 320) | `PageHeader` + tiga langkah (`StepIndicator` ditulis sebagai `Accordion` tertutup sampai primitif stepper ada) → `StatCard` baris valid/tidak-valid → `VelzonDataGrid` temuan (`row_number`, `check_code`, `suggested_fix`) → `ConfirmDialog` komit | unggah, memeriksa (progress), **BLOCK ditemukan → tombol Komit nonaktif dengan sebab**, komit ganda ditolak `Idempotency-Key` | all-or-nothing pada temuan BLOCK (AC-ADM-2); nol baris tertulis sebelum komitmen; 11 pemeriksaan Feeder ditampilkan apa adanya |
| Editor Menu & Grant | `/admin/pengaturan/menu` | `TENANT_ADMIN` C R U D · `PLATFORM_OPERATOR` R U lintas-tenant (hanya lewat permukaan M-01) | `PageHeader` + `Drawer` pohon dua lapis (WEB/MOBILE) dengan `Badge` per platform, `VelzonDataGrid` grant (`ALLOW`/`DENY`), `Alert` dampak peran sebelum simpan | kosong (tenant baru = pohon bawaan), muat, siklus ditolak, kedalaman > 4 ditolak | **menu bukan kontrol akses** — deny menang dan gerbang server tetap `requireDataPrincipal` + scope (AC-PG-8); kedalaman maksimum empat, tanpa siklus (FR-ADM-26) |

**Yang sengaja tidak dijanjikan di gugus ini.** (a) Pratinjau "dua panel" untuk template laporan — butuh primitif split-view yang belum ada; (b) penyunting pohon menu dengan drag-drop — belum ada primitif `sortable`, dan urutan kolom kamus sudah aman dengan `sort_order` + tombol naik/turun; (c) pencarian global di header — rutenya belum ada (§11.4), jadi layar ini tidak memakainya seolah sudah hidup.


### 9.11 Cluster Pengguna & Hak Akses (M-03) — `/admin/pengguna`, `/admin/pengguna/hak-akses`, `/admin/permintaan-hak`, `/me/profil-keamanan` — 2026-10-22

Empat layar ini adalah **satu alur**: lihat orang → lihat hak → ajukan perubahan → putuskan oleh orang kedua. Tidak ada layar yang boleh menulis hak secara langsung; tombol simpan pada matriks izin adalah **tombol pengajuan**, bukan tombol simpan. Kontrak path & izin: [API_SPEC §4.6.9](file:///c:/SICA/docs/API_SPEC.md); norma empat-mata: [PRD AC-ADM-6](file:///c:/SICA/docs/PRD.md); DDL: [DATA_MODEL §14.3.3](file:///c:/SICA/docs/DATA_MODEL.md).

| Layar | Komponen Velzon wajib | Aksi yang terlihat | Aksi yang **tidak** dirender |
|---|---|---|---|
| `/admin/pengguna` | `VelzonDataGrid` + `offcanvas` detail + tab (Profil, Keanggotaan, Peran & Penugasan, Sesi, Riwayat) + chip status | `Tambah pengguna`, `Nonaktifkan`, `Reset sandi`, `Ajukan perubahan hak` | `Hapus` (tidak ada hard delete pengguna); `Reset sandi` bila aktor tidak ber-MFA |
| `/admin/pengguna/hak-akses` | matriks `resource × verb` (6 kotak: R I U D V O) + pemilih role + pemilih scope eksplisit (TENANT/ORG/PROGRAM/CLASS/PERIOD; SITE target belum tersedia sampai migrasi scope/kampus) + `valid_to` + panel diff | `Ajukan perubahan` (bukan `Simpan`), `Bandingkan dengan kondisi berlaku` | kotak centang pada role `is_system=true` (terkunci + tooltip sebab); tombol `Setujui` (itu layar antrean) |
| `/admin/permintaan-hak` | inbox `VelzonDataGrid` + badge `GRANT`/`REVOKE`/`SCOPE_CHANGE`/`ROLE_PERMISSION_CHANGE` + drawer detail + diff before/after | `Setujui`, `Tolak` (alasan ≥ 10 karakter), `Buka audit` | `Setujui` pada baris milik sendiri / yang targetnya aktor / yang sudah terminal — server tetap penegak, UI hanya tidak menawarkan jalan buntu |
| `/me/profil-keamanan` | kartu profil + daftar sesi + kartu MFA + recovery code + form sandi | `Cabut sesi`, `Tambah faktor`, `Rotasi recovery code`, `Ganti sandi` | aksi admin apa pun; kolom `SERVER_ONLY` (NIM, status akademik, status nilai) tampil sebagai teks terkunci, bukan input |

**Enam keadaan wajib per layar** (§9.8 butir 2), bukan hanya loading–sukses:
1. **Kosong** — sebab + tindakan pertama. Contoh `/admin/permintaan-hak`: `Tidak ada permintaan menunggu. Pengajuan grant/revoke/scope akan muncul di sini.` dengan tautan `Buka matriks hak akses`.
2. **Memuat** — skeleton baris grid, bukan spinner penuh layar; filter tetap dapat diubah.
3. **Sukses** — untuk pengajuan, **bukan** toast "tersimpan": `Permintaan #REQ-… diajukan. Menunggu persetujuan orang kedua.` + chip amber `MENUNGGU` pada baris; matriks tetap menampilkan izin lama sampai keputusan.
4. **Kosong karena filter** — `Tidak ada hasil untuk filter ini` + `Hapus filter`, membedakan dari kosong sejati.
5. **Galat** — memakai `admin.errors.<KODE>`; empat kode yang wajib punya copy spesifik: `SELF_APPROVAL_FORBIDDEN`, `ADMIN_SCOPE_MISMATCH`, `MFA_REQUIRED`, `DECISION_ALREADY_MADE`.
6. **Offline / degraded** — grid menampilkan data terakhir + banner `Tidak dapat memuat hak terbaru. Jangan menyetujui berdasarkan data ini.`; tombol `Setujui` dinonaktifkan sampai refresh berhasil (keputusan hak tidak boleh diambil dari cache).

**Copy penolakan (bukan "Terjadi kesalahan").** `SELF_APPROVAL_FORBIDDEN` → `Anda tidak dapat menyetujui permintaan yang Anda ajukan atau yang menyasar akun Anda. Minta admin lain meninjau.` · `ADMIN_SCOPE_MISMATCH` → `Scope yang diminta melebihi kewenangan Anda di unit/kampus ini.` · `MFA_REQUIRED` → `Sesi Anda belum melewati MFA. Selesaikan verifikasi untuk melanjutkan.` · `DECISION_ALREADY_MADE` → `Permintaan ini sudah diputuskan dan tidak dapat diubah.` · `CONFLICT` (role sistem) → `Role sistem dikunci oleh kontrak; buat role kustom bila komposisi berbeda diperlukan.` · `REFERENCE_IN_USE` → `Role masih dipakai N pengguna. Cabut penugasan lebih dulu.`

**Matriks izin, bukan daftar centang.** Setiap baris = satu `resource`; kolom = enam verba kanonik; sel kosong berarti verba itu **tidak punya kode** dan tidak boleh dirender sebagai kotak yang dapat dicentang (tombol tanpa izin tidak dirender, §4.7c). Perubahan yang diajukan ditampilkan sebagai diff `+`/`−` terhadap kondisi berlaku, dengan catatan `berlaku setelah disetujui`. Role `is_system=true` menampilkan ikon kunci + sebab; `DELETE` pada role yang masih dipakai menghasilkan `409 REFERENCE_IN_USE` dan modal merinci pengguna yang memegangnya.

**Hak tingkat field pada layar ini.** Nominal keuangan dan PII tidak pernah masuk grid pengguna untuk peran yang tidak berhak (SoD BAAK↔BAUK, `BLUEPRINT_ROLE_BY_ROLE §0.3`): server memproyeksikan kolom, UI tidak menyembunyikan sel. Kolom `mfa` hanya menampilkan boolean `aktif/tidak` + jumlah faktor; `mfa_factors.secret` tidak pernah ada di respons. NIM dan status akademik **selalu read-only** di `/admin/pengguna`, termasuk bagi pemegang izin akademik; izin tersebut hanya membuka aksi transisi domain, tidak membuat kedua field diterima dalam body sunting pengguna. Penerbitan NIM milik M-09 dan transisi status milik domain akademik, bukan keputusan M-03/Admin IT; M-05 adalah keamanan/audit.

**Paritas Web ↔ Flutter (`AGENTS §3.4`).** Matriks izin `resource × verb × scope` adalah **fitur khusus Web** (lebar kolom, kerapatan informasi, dan konteks audit); di Mobile, padanan fungsionalnya adalah: (a) `/me/profil-keamanan` penuh — profil, sandi, sesi, MFA, recovery code; (b) pengajuan perubahan hak untuk diri sendiri lewat form ringkas yang memanggil endpoint yang sama; (c) penyetuju menerima deep link ke `/admin/permintaan-hak/:id` versi mobile dengan diff ringkas + `Setujui`/`Tolak` + MFA. Tidak ada fitur Web yang hilang tanpa padanan; yang berbeda hanya kedalaman tampilan.

**Aksesibilitas & i18n.** Semua label/aksi dari `locales/id.json` & `en.json` dengan kunci `admin.identity.*`, `admin.identity.errors.<KODE>`, `admin.identity.requestKind.*` (`AGENTS §3.5`); badge tidak boleh bergantung pada warna saja (tambahkan teks); fokus keyboard berpindah ke panel diff setelah pengajuan; `aria-live="polite"` untuk hasil keputusan; target sentuh mobile ≥ 44 dp; kontras chip amber `MENUNGGU` diuji pada tema gelap Velzon.

### 9.12 Pemaketan KRS cohort (M-13/M-14; `FR-AKA-16`)

**Rujukan kontrak:** [PRD `AC-AKA-16`](file:///c:/SICA/docs/PRD.md), [DATA_MODEL §26.8](file:///c:/SICA/docs/DATA_MODEL.md), [API_SPEC §4.2.15–§4.2.17](file:///c:/SICA/docs/API_SPEC.md), [RBAC_MATRIX §4.2/§4.5.6](file:///c:/SICA/docs/RBAC_MATRIX.md). Endpoint saat ini `spec-only`; aksi create/publish tetap usulan RBAC dan tidak boleh dirender sebagai aktif sebelum promosi izin.

| Layar | Komponen & field terlihat | Aksi yang dirender | Batas server |
|---|---|---|---|
| `/admin/pengaturan/akademik/paket-krs` | `VelzonDataGrid`; filter prodi, periode, rentang angkatan, keadaan; kolom kode, nama, target SKS, jumlah baris, versi, penulis/perubahan terakhir | `Buat draf`, `Sunting draf`, `Publikasikan` (empat-mata + MFA), `Arsipkan` | `ADMIN_ACADEMIC` tenant / `HEAD_OF_PROGRAM` program; menu dan tombol ditahan selama izin create/publish masih usulan |
| Drawer `Buat/Sunting paket` | prodi, periode, `entryYearFrom`/`entryYearTo`, kode, nama, `isAutoFill`, pencari kelas; tabel baris kelas, `seq`, wajib/opsional, SKS snapshot; ringkasan `packedSks` dan plafon BR-R2 | simpan DRAFT dengan `If-Match`; tambah/hapus baris pada draft | `packedSks`/`sksSnapshot` read-only hasil hitung server; kelas hanya dari distribusi aktif dan periode/cohort yang cocok; total di atas BR-R2 tidak dapat dipublikasikan |
| `/academic/krs` panel `Paket cohort` | paket sesuai prodi/angkatan/periode mahasiswa dari sesi; target SKS vs plafon; setiap baris menampilkan matakuliah, jadwal, ruang, kuota, wajib/opsional | `Prapilih paket` hanya mengisi formulir lokal; mahasiswa meninjau lalu `Ajukan KRS` melalui alur yang sama | tidak ada `studentId` di query/body; preview tidak menahan kursi atau membuat enrollment; submit mengulang seluruh cek KRS di server |

**Keadaan layar:** loading memakai skeleton setinggi grid/daftar kelas; empty Admin menjelaskan belum ada paket cohort dan memberi `Buat draf` hanya bila grant tersedia; empty mahasiswa menampilkan `Belum ada paket untuk angkatan/periode ini` lalu tetap menawarkan daftar kelas reguler; invalid/degraded menampilkan sebab seperti distribusi kelas atau jadwal tidak lengkap, bukan paket 0 SKS; sukses simpan berarti `DRAFT`, bukan paket aktif; gagal publish mempertahankan draf dan menampilkan konflik/penyebab.

**Keamanan & i18n:** seluruh copy melalui `academic.krsPackage.*` di `id.json`/`en.json`; state, versi, tenant, creator, requester, approver, dan `packedSks` tidak pernah menjadi input bebas. `PUBLISHED` tidak menampilkan kontrol edit; revisi membuat versi baru. Tidak ada hard-delete; pengarsipan tetap terbaca untuk audit. Mobile menampilkan pratinjau paket yang sama dan mengirim melalui endpoint KRS yang sama, bukan kontrak mobile kedua.

**Konsolidasi dua blok lama §9.12.** Keduanya tidak identik: alamat berbeda dan blok kedua menambah pengurutan baris, pemulihan konflik versi, serta arti `isAutoFill`. Semantik itu dipertahankan di sini: baris DRAFT boleh ditambah/diurut/dilepas; konflik `If-Match` wajib memuat ulang versi server; `isAutoFill` hanya prapilih, tidak pernah auto-submit. Alamat kanonik target tetap `/admin/pengaturan/akademik/paket-krs` dan panel `/academic/krs` di tabel di atas; alamat alternatif `/admin/penyelenggaraan/paket-krs` dan `/mahasiswa/krs` hanya boleh menautkan/redirect, bukan menjadi layar pemilik kedua. Ini keputusan IA spesifikasi, bukan klaim redirect sudah ada.

### 9.13 Cluster Lisensi Add-on & Penagihan Berlangganan (M-01) — `/platform/lisensi`, `/platform/penagihan` — 2026-10-23

**Status bagian ini: spesifikasi layar, bukan klaim tampilan.** Endpoint lisensi/tagihan belum ada. Inventaris platform **rekursif** berisi 8 `route.ts`/9 metode DB-backed, termasuk `PUT /platform/tenants/:id/quotas`; glob satu tingkat yang dahulu menghasilkan 3 bukan total. Flags/trials juga belum memiliki endpoint. Komponen dan penerimaan kedua layar ini belum terbukti. Baris RBAC 389–394 tetap `usulan`, tidak dipromosikan oleh dokumen UI.

| Unsur | Aturan | Alasannya |
|---|---|---|
| Gerbang render | `/platform/lisensi` hanya dirender bila `entitlement.license.view` (389) **normatif**; hari ini barisnya `usulan`, jadi layar **tidak boleh** muncul walau rute ditambahkan | §3.8: masking UI bukan penegakan, tapi menampilkan layar yang dijaga izin belum-promosi = menyembunyikan 403 di balik tombol aktif |
| Daftar lisensi per tenant | satu baris per `tenant_modules`: `module_code`, `status`, `seats`, `valid_to`, penanda prasyarat; **kolom nominal tagihan tidak ada di layar ini** | SoD BAAK↔BAUK (§12.2 butir 6): lisensi dan uang adalah dua objek, dua layar |
| Sunting lisensi | hanya `seats` & `validTo` pada `LicensePatch` boleh disunting melalui modal Velzon dengan `reason` dan token `expectedUpdatedAt`; `status` **bukan input**. Aksi `Aktifkan`/`Nonaktifkan` ditahan sampai kontrak transisi lisensi platform dan grant-nya tersedia, bukan memakai jalur aktivasi tenant legacy | `SERVER_ONLY` untuk keadaan (`FR-IDT-04`); izin normatif activate/deactivate tidak membuktikan pemisahan grant platform dan preferensi tenant sudah berjalan |
| Batas plan | nilai di luar plafon `plan_modules`/`subscriptions.ends_at` ditandai **sebelum** kirim dengan angka batas yang sah; respons `422 LICENSE_EXCEEDS_PLAN_CEILING` (156) menampilkan `field` + batas | Agar pengguna melihat **mengapa**, bukan sekadar gagal — pola yang sama dengan `SEAT_LIMIT_BELOW_ACTIVE_USAGE` |
| Toggle fitur tenant | saklar untuk modul tidak berlisensi dirender **nonaktif dengan sebab** ("modul X tidak dilisensikan untuk tenant ini"), bukan disembunyikan; server menjawab `403 MODULE_NOT_ENTITLED` (155) | §3.10 kejujuran mode turun: fitur yang terkunci harus terbaca sebagai terkunci |
| `/platform/penagihan` | grid memakai `PlatformInvoiceView` (`API_SPEC §4.20.1`): nominal camelCase termasuk `amountRupiah`/`taxRupiah`/`paidRupiah` berupa **string**, format Rp di klien. v1 menerbitkan langsung `ISSUED` dengan satu agregat/deskripsi, tanpa editor draft, `components[]` atau `issueNow`. Settle manual menghasilkan `PARTIAL`/`PAID`; void aksi terpisah | tombol settle/void mengikuti `canSettle`/`canVoid` dari server, bukan identitas penerbit di klien. Keduanya false bagi penerbit; server memeriksa ulang izin/MFA/scope/SoD/state. Aksi membawa `expectedVersion`, `reason`, `Idempotency-Key`; retry identik memakai key lama dan menampilkan respons awal, konflik versi memuat ulang. Target DDL `ck_pi_void_actor` belum terpasang; proyeksi tagihan tenant sendiri mengikuti §9.14 |
| Keadaan terminal | `PAID`/`VOID` tidak menampilkan tombol edit atau pembalikan state; tidak ada tombol refund/koreksi aktif sebelum kontraknya tersedia | terminal tidak dibalik (BR-R12); koreksi harus menjadi objek baru berjejak, bukan menimpa nominal |
| Wujud state layar | loading / empty / error / offline mengikuti enam wujud §9.8, memakai `admin.loadingList` + `admin.loadFailed` (paritas `id`/`en`) | pola yang sama yang menyelamatkan drawer RBAC dari "kosong bohong" (`RD-150`) |

### 9.14 Dua konsol IT dan perluasan Fase 1 — target penerimaan

**Batas:** dua tingkat tata kelola IT adalah R-1 platform dan R-2 tenant, bukan pengganti R-1…R-6 atau T-1…T-8. Area `/admin/**` menggabungkan navigasi beberapa tugas, **bukan gabungan grant**. Semua keputusan KRS, nilai, pembayaran, dan kebijakan akademik tetap milik domain; konteks tenant/org/program/class/period/self harus eksplisit. Batas izin dan status menu mengikuti `RBAC_MATRIX §6.8` dan `BLUEPRINT_ROLE_BY_ROLE §11`, kebutuhan `FR-ITG-01…06`/`AC-ITG-1…6` di PRD. Target tanpa backend tetap diterima sebagai **spec-only/permission pending**, bukan ditolak atau diberi tombol transaksi palsu.

| Konsol / menu target | Komposisi dan state aman |
|---|---|
| Platform: CPU/RAM/DB/Redis, coarse GeoIP, anomali | Kartu metrik dengan waktu sampel, peta agregat dari GeoIP database lokal, panel alasan anomali ALG-25 IF/LOF per tenant; no-data/degraded terlihat, tanpa pelacakan individu/egress atau vonis otomatis. Statistik login/sesi berasal dari PostgreSQL. Detail telemetry/peta/anomali masih spec-only/permission pending. |
| Platform: lisensi, kuota seats/storage, SaaS billing, flags, kamus nasional | Pisahkan masa berlaku modul dari tenant `SUSPENDED`; keadaan modul `ACTIVE/TRIAL/DISABLED/EXPIRED/PENDING_PAYMENT`. Kuota sudah memiliki PUT; lisensi/billing/flags/trials spec-only. Diff versi kamus nasional dan dampak sebelum terbit. Sembilan bundle tidak menambah 19 kode modul; kartu usulan tidak menjual/mengaktifkan SKU yang belum sah. Audit tamper-evident, bukan tamper-proof. |
| Tenant: profil, branding, kampus, domain & SSL | Form metadata + pratinjau; domain lewat permintaan → bukti kepemilikan/challenge → eksekusi operator → status sertifikat. Bukan shell/DNS editor bebas. Kemampuan di luar organisasi/meta yang terverifikasi tetap spec-only/permission pending. |
| Tenant: katalog, on/off lokal, tagihan SaaS sendiri | Katalog read-only dengan badge berlisensi/terkunci/usulan; opt-out lokal tidak membuat/memperpanjang lisensi. Jalur activate/deactivate lama masih menulis `tenant_modules`: gap migrasi, bukan bukti pemisahan sudah berjalan. Baca tagihan tenant sendiri diterima sebagai target **permission pending**, bukan memakai `platform.billing.view` atau `finance.invoice.view`. |
| Tenant: kamus dan parameter domain | Almamater/toga/organisasi/SKKM adalah definisi lokal, bukan persetujuan transaksi. Pola NIM, band SKS dan presensi menampilkan pemilik domain, versi, pengusul/pengesah serta dampak; Admin IT hanya binding/penerapan teknis. 75% contoh kebijakan tenant, bukan ambang hukum universal. |
| Tenant: directory, RBAC, SSO, DSAR, audit lokal | Directory/RBAC parsial mengikuti §9.11; SSO target permission pending; DSAR ke DPO dengan minimisasi. Sesi/revokasi memakai PostgreSQL, bukan Redis. Panel audit hanya data dalam scope, tidak membuka semua PII karena label admin. |
| Tenant: konektor Feeder/SISTER/Teams/Zoom, PIN/SIVIL | Hanya `credential_ref` dan status uji yang disanitasi; rahasia tidak di body, parameter, respons atau log. Izin belum normatif tetap usulan/pending. PIN/SIVIL adalah rekam/keputusan kelulusan domain, bukan wewenang IT. |
| Tenant: backup/restore, cache, antrean, staging errors | Target spec-only/permission pending. Restore menampilkan scope tenant, dry-run, approver kedua, quiesce, rencana rollback dan rekonsiliasi audit. Cache hanya invalidasi namespace (tanpa `FLUSHALL`). Monitor BullMQ redacted; retry DLQ idempoten ber-audit, tanpa purge. Galat staging disanitasi, tidak memuat payload rahasia/PII. |

**Rantai Fase 1 diperluas** (`PRD §5.1.1`, `AC-PH1-1…4`): M-01/02/03/05 → M-09 PMB, OCR lokal design-only, NIM → M-10 pembayaran → M-12 OBE DAG → M-13 KRS → M-14 CSP/AC-3 → M-15/18 QR/geofence → M-16 LMS/Teams → M-19 AST → M-34 Feeder fuzzy. KRS membedakan reservasi lease/TTL/fencing, antrean dan finalisasi; tidak menampilkan `202` sebagai enrollment sah. Target Redis Lua/BullMQ belum terpasang (`bullmq`/`ioredis` tidak ada dependensi); jalur sinkron advisory lock hanya pengecualian sementara, bukan jaminan Redlock O(1).

**Kejujuran engine dan kanal:** OBE/scheduler menampilkan siklus/konflik/budget/degraded; AST bertipe tanpa `eval`/`new Function`, bobot 10.000 bp. Teams kanal transport, M-18 menetapkan satu fakta hadir dari bukti dan kebijakan durasi tenant; `CHANNEL_UNAVAILABLE` tidak menjadi angka hadir parsial. Feeder menampilkan skor, margin, alasan, snapshot dan antrean reviu; ambigu/stale tidak auto-apply atau auto-kirim. EWS/retention merujuk ALG-10, bukan ALG-11/12.

**Gerbang selesai:** enam state layar, i18n ID/EN, keyboard/mobile, API+DB nyata (bukan mock RD-154), L3 sebelum validasi body pada tulis admin (tanpa izin tetap 403), scope dari row DB, RLS ENABLE/FORCE, MFA/SoD, grant dicabut/JWT lama, tenant benar/periode salah, dan uji hanya-IT tidak dapat memutus bisnis. Sisa migrasi, backend dan pengujian membuat Fase 1 **belum selesai**, bukan diselesaikan oleh spesifikasi ini.

## 10. Presensi Mobile Anti-Spoofing (QR dinamis + geofence + Wi-Fi + deteksi lokasi palsu) (2026-10-19)

> Dasar: [AGENTS.md §3.4/§3.7/§3.8](file:///c:/SICA/AGENTS.md), register enum [`DATA_MODEL.md §15`](file:///c:/SICA/docs/DATA_MODEL.md) (`attendance_status` · `attendance_source`), [API_SPEC.md §2.3](file:///c:/SICA/docs/API_SPEC.md) baris 8, 9, 60–64 (kode kesalahan presensi), [API_SPEC.md §2.5](file:///c:/SICA/docs/API_SPEC.md) (`allowedTransitions`), §9.6/§9.7/§9.8 dokumen ini, [AUDIT_READINESS.md](file:///c:/SICA/docs/AUDIT_READINESS.md) `RD-13` dan `G-05`. **Status: spesifikasi UX/state, belum dibangun.**
>
> **Kepemilikan kontrak.** Bentuk body `request`/`response` adalah milik `API_SPEC.md`; bagian ini **tidak** menulis ulang body, hanya menetapkan apa yang dilihat pengguna, keadaan layar, komponen, dan kunci i18n. Rute yang dirujuk: `POST /api/v1/attendance/scan` (path yang hidup di kode dan API_SPEC §4.3.2 hari ini: `POST /api/v1/attendance/qr/scan`) dan `POST /api/v1/attendance/qr/generate` (§4.3.1).
>
> **Ketergantungan yang belum ada (dicatat, tidak ditutupi).** `API_SPEC §4.3.6–§4.3.9` **dirujuk oleh register kode kesalahan tetapi belum ditulis** (nol heading dengan nomor itu) — kode 60–64 sudah sah, bentuk field-nya menunggu pemilik kontrak. `attendance_appeals` belum punya migrasi (rencana `0017_teaching_attendance.sql`, ADM-12). `rooms` ([`academic-master.ts:206-226`](file:///C:/SICA/packages/database/src/schema/academic-master.ts)) **tidak punya kolom koordinat, radius, maupun BSSID**, sehingga titik acuan geofence hari ini datang dari body klien ([`qr/generate/route.ts:29`](file:///C:/SICA/apps/web/src/app/api/v1/attendance/qr/generate/route.ts)) — itu `SEC-03`, bukan dasar desain.

### 10.0 Prinsip desain

1. **Kamera mahasiswa bukan alat bukti tunggal.** Satu presensi sah = irisan empat bahan yang **dihitung server**: (a) token QR ber-nonce dengan jendela waktu pendek, (b) koordinat + akurasi + umur fix, (c) sampel integritas perangkat, (d) konteks relasi (mahasiswa itu terdaftar di kelas itu, sesi itu milik ruang itu, periode `OPEN`). Tidak ada satu bahan pun yang boleh ditampilkan sebagai vonis tunggal di UI, dan tidak ada satu bahan pun yang boleh diterima server sebagai vonis tunggal.
2. **UI menampilkan hasil, bukan resep.** Aturan verifikasi (nilai radius, ambang akurasi, lebar jendela `windowIndex`, daftar BSSID, keberadaan flag root) **dilarang** muncul kepada pihak yang sedang diuji. Yang tampil: *di dalam / luar area*, *akurasi kurang, silakan ulangi*, *hingga 5 kali percobaan*, bukan *radius 250 m* atau *toleransi 1 window*.
   **Bukti pelanggaran hari ini yang wajib dihapus saat layar ini dibangun:** [`lecturer_qr_broadcast_screen.dart:262`](file:///C:/SICA/apps/mobile/lib/features/attendance/presentation/screens/lecturer_qr_broadcast_screen.dart) mencetak `Radius Validasi GPS: Maksimal 50 meter dari Ruang Kuliah. Anti-Fake GPS aktif.` dan baris 199 mencetak `HMAC-SHA256 • TTL Rotasi 30 Detik`. Keduanya adalah kebocoran resep + hardcode Bahasa Indonesia (langgar AGENTS §3.5).
3. **Versi material keamanan hanya di panel info peran berhak.** `keyVersion`, `algorithmVersion`, `rotationSeconds`, `windowIndex` **tidak boleh** tertanam dalam gambar QR maupun payload yang bisa di-screenshot; QR hanya membawa id sesi + nonce + tanda tangan. Server yang menyelesaikan geofence dari `sessionId`, bukan klien (menutup `SEC-03`).
4. **Klien mengirim bahan, server yang memutuskan.** Klien tidak pernah mengirim status akhir, tidak pernah mengirim `PRESENT`; dan tidak pernah menyimpulkan "tolak" untuk dirinya sendiri di offline mode (lihat §10.4.4 dan §10.8 butir 3).

**Pemisahan tegas apa yang dilihat siapa:**

| Audiens | Yang boleh terlihat | Yang tidak boleh terlihat | Saluran tampilan |
|---|---|---|---|
| **Dosen penerbit (challenge)** | Pita QR + countdown, status sesi, hitungan `HADIR` / `TERTAHAN` / `BELUM`, roster kelasnya sendiri beserta **sebab** tiap penolakan, panel info versi kunci | Daftar BSSID allowlist, ambang akurasi tenant, koordinat mentah mahasiswa lain, jarak mahasiswa lain satu sama lain | `/attendance/session/:id` (Web) · `LecturerQrBroadcastScreen` (Flutter) |
| **Mahasiswa (scan)** | Vonis satu dari 5 enum `attendance_status`, waktu tercatat, nama kelas + nomor pertemuan, persentase kehadiran **miliknya sendiri**, "di dalam/luar area", jarak miliknya sendiri, tombol banding | Radius, ambang akurasi, nilai `windowIndex`, apakah root/mock terdeteksi, kehadiran mahasiswa lain, identitas perangkat milik orang lain | `QrScannerScreen` hasil (Flutter) — Web tidak punya kamera |
| **Admin / BAAK / kaprodi** | Rekonsiliasi per sesi, semua bahan yang tersimpan, rantai sebab berveb audit, kebijakan tenant `BLOCK` / `WARN_AND_LOG`, riwayat banding lintas kelas dalam scope-nya | Kunci HMAC aktif, bahan milik tenant lain (RLS memotong lebih dulu) | `/admin/attendance/**` `VelzonDataGrid` + drawer |
| **Auditor internal / orang tua** | Rekap kehadiran per periode + status banding anak/ward-nya | Bahan mentah (koordinat presisi, BSSID, `deviceProfile`) — hanya hasil dan sebab, sesuai kelas PII §9.8 butir 1 (koordinat GPS = coarse + retensi) | laporan rekap + `GET /api/v1/attendance/history` |

### 10.1 Layar dosen penerbit (challenge)

**Pita countdown QR.** Token berganti tiap **5 detik** sebagai target desain; angka `rotationSeconds` **dibaca dari respons server** dan tidak boleh di-hardcode di dua platform. Kontradiksi tercatat yang harus diselesaikan pemilik kontrak (lihat §10.9 butir K-1): kode dan copy landing hari ini memakai **30 detik** ([`qr/generate/route.ts:5`](file:///C:/SICA/apps/web/src/app/api/v1/attendance/qr/generate/route.ts), `lecturer_qr_broadcast_screen.dart:199`, katalog modul `id.json` "berganti tiap 30 detik").

- Render: **cincin progres** SVG (`stroke-dashoffset`, 5 s linear, bukan ease) + angka sisa detik `tabular-nums` 22px di tengah cincin; gambar QR di-redraw saat token berganti. **Dilarang**: text-flash, blink per detik, animasi opacity berulang — pemicu masalah a11y dan fotosensitivitas.
- Aksesibilitas countdown: angka ticker `aria-hidden="true"`; cincin `role="img"` dengan `aria-label` yang **hanya** berubah saat token berganti (bukan tiap detik); transisi status (sesi dibuka / dijeda / ditutup) diumumkan sekali lewat `role="status"` `aria-live="polite"`. `prefers-reduced-motion: reduce` → cincin statis, ticker angka tetap, tanpa sapuan animasi (§4.2, §7.1).
- Anti-replay screenshot: (1) radius/koordinat/versi **tidak** berada di dalam QR (prinsip §10.0.3); (2) nonce sekali pakai → token yang sama menghasilkan `409 SCAN_REPLAY_DETECTED` (baris 62); (3) Android memasang `FLAG_SECURE` pada layar penerbit sehingga tangkapan layar diblokir; iOS **tidak** punya padanan untuk view biasa → ditandai `[TIDAK-TERVERIFIKASI]` dan mitigasinya watermark NIM dosen + TTL pendek, bukan klaim "anti-screenshot".

**State sesi (4 keadaan layar):**

| State | Pita QR | Aksi primer | Aksi sekunder | Yang dilarang dirender |
|---|---|---|---|---|
| `belum dimulai` | placeholder + sebab bila ruang belum lengkap | `Buka sesi` | — | QR kosong / QR sesi lain |
| `terbuka` | cincin 5 s + QR aktif | — | `Tutup sesi sekarang`, `Tandai manual`, `Jeda` | menonaktifkan tombol Tutup |
| `jeda` | cincin beku + label `Dijeda` + hitungan bahan tertahan | `Lanjutkan` | `Tutup sesi sekarang` | QR lama masih ter-render (harus dihapus) |
| `ditutup` | kanvas hitam + label `Sesi ditutup` | `Lihat rekap` | `Buka sesi pengganti` (bila diizinkan kebijakan) | tombol `Lanjutkan` |

**Catatan representasi:** `belum dimulai` (PLANNED) dan `jeda` (PAUSED) **tidak punya padanan di basis data hari ini** — `class_sessions.status` hanya `OPEN`/`CLOSED`/`CANCELLED` ([`classes.ts:88`](file:///C:/SICA/packages/database/src/schema/classes.ts)). Menambah nilai = perubahan register enum `DATA_MODEL §15` → keputusan K-3, bukan kebebasan UI.

**`Tutup sesi sekarang`.** Varian `btn-danger` + konfirmasi **berbasis angka, bukan kata** (§9.7): `38 mahasiswa · 24 hadir · 6 tertahan · 8 belum tercatat. Menutup sesi akan mencatat 8 sebagai ABSENT pada rekonsiliasi.` Angka diambil dari rekap sesi; tombol baru aktif setelah angka tiba. Pasca-tutup, layar berganti ke daftar hasil dan QR hilang dari DOM.

**Indikator hitungan.** Tiga chip: `HADIR n` · `TERTAHAN n` (HELD) · `BELUM n`. `HELD` adalah **keadaan tayang, bukan nilai enum DB** — mengikuti preseden `NOT_RECORDED` di [API_SPEC §4.4.1](file:///C:/SICA/docs/API_SPEC.md): bahan sudah diterima server tetapi keputusan belum keluar (akurasi di bawah ambang, antrian finalisasi, `WARN_AND_LOG`). Chip dapat ditekan → `offcanvas` drawer roster ter-filter (bukan modal bertumpuk, §9.7).

**Peringatan otoritas waktu server.** Bila selisih jam perangkat terhadap `serverTime` respons melebihi 3 detik, tampil banner peringatan (varian `warning`) `attendance.mobile.lecturer.clockWarning` dan hitungan mundur **tetap** dihitung dari `expiresAt - serverTime` lalu di-tick dengan clock monotonic perangkat, re-anchor pada setiap respons. Sisi server tidak pernah mempercayai `clientTimestamp` (deviasi maksimum sudah ditetapkan kontrak); dosen tidak perlu "memperbaiki jam tablet" untuk sesi yang sah, tetapi harus tahu bahwa tablet-nya tidak bisa dipakai sebagai bukti waktu.

**Panel info (peran dosen penerbit saja).** Menampilkan `keyVersion`, `algorithmVersion`, `rotationSeconds`, dan status kanal bukti (geo aktif / wifi tersedia / integritas aktif) sebagai **boolean kapabilitas**, bukan ambang numerik.

**Tandai manual (jalur mitigasi, bukan jalan belakang yang diam).** Aksi per baris roster dengan `reason` wajib (min 10 karakter, `422` bila kosong), tercatat `source = MANUAL` dan `marked_by` = dosen; baris hasil menampilkan chip sumber sehingga rekonsiliasi dapat dibedakan dari self-scan.

### 10.2 Layar mahasiswa (scan) — matriks 6 state per layar

Setiap sub-layar wajib punya enam keadaan terdefinisikan (§9.8 butir 2), bukan hanya loading-sukses:

| Layar | idle | loading | sukses | kosong | error | offline / degraded |
|---|---|---|---|---|---|---|
| **Kamera** | `Buka pemindai` (FAB tengah, 56×56 dp) | pratinjau blur + cincin cari | frame terkunci + haptic bip (§3.5) | — (tidak ada keadaan kosong pada kamera) | izin kamera ditolak → sebab + `Buka pengaturan`, bukan layar hitam | kamera dipakai aplikasi lain → hints + jalur banding |
| **Pemindaian** | hint arahkan ke layar dosen | deteksi frame + garis laser | satu token terbaca → lanjut verifikasi | — | kode tidak dikenal / sesi bukan milik kelas ini → hasil `unknown` tanpa membocorkan identitas sesi lain | tanpa jaringan → bahan disimpan di antrian lokal (§10.8.3) |
| **Verifikasi** | — | `Memverifikasi…` skeleton + spinner inline, tombol nonaktif | vonis server tiba → layar hasil | — | `4xx`/`5xx` → satu sebab per kode (§10.4.5) + aksi | request menggantung > 8 s → tampilkan status `bahan tertahan`, jangan putuskan `ABSENT` |
| **Hasil** | — | — | chip status + waktu + kelas + pertemuan + persentase | — (hasil selalu ada setelah vonis) | vonis `ABSENT_LATE` / `ABSENT` = tetap "hasil", bukan error banner | hasil dibaca dari cache dengan penanda "terakhir tersinkron" |
| **Percobaan berulang** | hint normal | — | — | — | `429 RATE_LIMIT_EXCEEDED` → "coba lagi dalam {retryIn} detik", hitung mundur backoff, **tanpa menyebut batasnya** | backoff tetap berjalan saat offline; submit ditahan lokal |

**Kosakata hasil (enum kanonik, bukan karangan layar).** Hanya lima nilai `attendance_status`: `PRESENT` · `EXCUSED` · `SICK` · `ABSENT_LATE` · `ABSENT` ([`enums.ts:128`](file:///C:/SICA/packages/database/src/schema/enums.ts), register `DATA_MODEL §15`). Ejaan lama `present`/`late`/`absent` **dilepas** (`RD-13`). Scan langsung hanya dapat menghasilkan empat nilai; `ABSENT` adalah **turunan rekonsiliasi akhir sesi** (API_SPEC §4.3.2 response) — karena itu layar hasil mahasiswa tidak pernah menampilkan `ABSENT` segera setelah memindai, melainkan setelah sesi ditutup. Toleransi keterlambatan ditentukan server (`GRACE`), tidak pernah dihitung di klien, dan tidak pernah ditampilkan sebagai angka.

**Aturan microcopy hasil.** Vonis disampaikan dalam satu kalimat bernada netral (tidak menghakimi), disertai **waktu** dan **satu aksi berikutnya** (`Ajukan banding` / `Tandai ke dosen`). NadaDanger hanya untuk penolakan perangkat/kebijakan, bukan untuk `EXCUSED`/`SICK` yang justru legal.

### 10.3 Inventaris kunci i18n `attendance.mobile.*` (dua file)

**Kondisi hari ini (terukur, bukan asumsi).** `apps/web/src/locales/` hanya punya namespace top-level `auth`, `dashboard`, `navigation`, `landing`; namespace `admin.*` (inventaris §9.8) dan `attendance.*` **belum terdaftar** — tiga kemunculan kata `attendance` yang ada hanyalah label navigasi/landing, bukan kunci layar. Daun terukur hari ini: **`id.json` 148 · `en.json` 148** (seimbang). Angka `id` 574 vs `en` 518 yang tercatat di §9.8 **tidak cocok** dengan isi berkas saat pengukuran 2026-10-19 dan perlu divalidasi ulang oleh pemiliknya sebelum dijadikan gerbang CI. Sisi Flutter lebih buruk: kedua layar presensi memakai string Indonesia **hardcode** (`lecturer_qr_broadcast_screen.dart`, `qr_scanner_screen.dart`) — langgar AGENTS §3.5; kunci di bawah harus diadopsi dua-duanya (`intl` ARB untuk Flutter, JSON untuk Web) **dengan bentuk kunci identik**, bukan dua kosakata terpisah.

```
# gugus dosen penerbit — 25 daun
attendance.mobile.lecturer.title
attendance.mobile.lecturer.state.planned
attendance.mobile.lecturer.state.open
attendance.mobile.lecturer.state.paused
attendance.mobile.lecturer.state.closed
attendance.mobile.lecturer.start
attendance.mobile.lecturer.pause
attendance.mobile.lecturer.resume
attendance.mobile.lecturer.closeNow
attendance.mobile.lecturer.closeConfirm.title
attendance.mobile.lecturer.closeConfirm.impact
attendance.mobile.lecturer.count.present
attendance.mobile.lecturer.count.held
attendance.mobile.lecturer.count.unrecorded
attendance.mobile.lecturer.qr.rotating
attendance.mobile.lecturer.qr.stopped
attendance.mobile.lecturer.clockWarning
attendance.mobile.lecturer.infoPanel.title
attendance.mobile.lecturer.infoPanel.keyVersion
attendance.mobile.lecturer.infoPanel.algorithmVersion
attendance.mobile.lecturer.manualMark
attendance.mobile.lecturer.manualMark.reasonLabel
attendance.mobile.lecturer.roster.empty
attendance.mobile.lecturer.noRoom.title
attendance.mobile.lecturer.noRoom.desc
# gugus mahasiswa scan — 46 daun
attendance.mobile.student.title
attendance.mobile.student.idle
attendance.mobile.student.openScanner
attendance.mobile.student.camera.denied.title
attendance.mobile.student.camera.denied.desc
attendance.mobile.student.camera.denied.retry
attendance.mobile.student.camera.openSettings
attendance.mobile.student.scanning.hint
attendance.mobile.student.scanning.lamp
attendance.mobile.student.scan.unknown.title
attendance.mobile.student.scan.unknown.desc
attendance.mobile.student.verifying.title
attendance.mobile.student.verifying.hint
attendance.mobile.student.result.PRESENT
attendance.mobile.student.result.ABSENT_LATE
attendance.mobile.student.result.EXCUSED
attendance.mobile.student.result.SICK
attendance.mobile.student.result.ABSENT
attendance.mobile.student.result.recordedAt
attendance.mobile.student.result.meeting
attendance.mobile.student.result.percentage
attendance.mobile.student.geo.inArea
attendance.mobile.student.geo.outsideArea
attendance.mobile.student.geo.distance
attendance.mobile.student.geo.lowAccuracy.title
attendance.mobile.student.geo.lowAccuracy.desc
attendance.mobile.student.geo.lowAccuracy.retry
attendance.mobile.student.wifi.denied.title
attendance.mobile.student.wifi.denied.desc
attendance.mobile.student.wifi.unavailable
attendance.mobile.student.integrity.blocked.title
attendance.mobile.student.integrity.blocked.desc
attendance.mobile.student.integrity.warn.title
attendance.mobile.student.integrity.warn.desc
attendance.mobile.student.rateLimited.title
attendance.mobile.student.rateLimited.desc
attendance.mobile.student.rateLimited.retryIn
attendance.mobile.student.offline.queued
attendance.mobile.student.offline.queueAge
attendance.mobile.student.offline.submitNow
attendance.mobile.student.offline.tooOld
attendance.mobile.student.appeal.cta
attendance.mobile.student.appeal.reasonLabel
attendance.mobile.student.appeal.attachment
attendance.mobile.student.appeal.history.empty
attendance.mobile.student.appeal.approver
# gugus presensi massal — 8 daun
attendance.mobile.bulk.title
attendance.mobile.bulk.preview
attendance.mobile.bulk.selectedCount
attendance.mobile.bulk.confirm
attendance.mobile.bulk.inFlight
attendance.mobile.bulk.result.created
attendance.mobile.bulk.result.skipped
attendance.mobile.bulk.result.rejected
# gugus label chip status + sumber — 11 daun
attendance.mobile.status.PRESENT
attendance.mobile.status.EXCUSED
attendance.mobile.status.SICK
attendance.mobile.status.ABSENT_LATE
attendance.mobile.status.ABSENT
attendance.mobile.status.HELD
attendance.mobile.source.QR
attendance.mobile.source.GEOFENCE
attendance.mobile.source.MANUAL
attendance.mobile.source.APP_BULK
attendance.mobile.source.FEEDER_SYNC
# gugus kalimat remedi mahasiswa — 4 daun (pesan utama tetap admin.errors.<KODE>, lihat catatan di bawah)
attendance.mobile.help.OUT_OF_GEOFENCE
attendance.mobile.help.LOW_ACCURACY
attendance.mobile.help.DEVICE_INTEGRITY_FAILED
attendance.mobile.help.RATE_LIMIT_EXCEEDED
```

**Total yang dispesifikasi: 94 daun per bahasa** (94 di `id.json` + 94 di `en.json`; 188 daun gabungan), **belum ada satu pun yang dibuat** — blok ini adalah **spesifikasi yang akan diimplementasikan**, bukan catatan kondisi. Aturan: (1) teks utama penolakan memakai `admin.errors.<KODE>` yang sama agar strip `StateMachineStrip`, toast, dan layar presensi konsisten (§9.7, API_SPEC §2.5 aturan 3) — gugus `attendance.mobile.help.*` hanya menambah **kalimat remedi untuk mahasiswa**, tidak membuat sumber kebenaran kedua; (2) parameter bernama `{count}`/`{retryIn}`/`{distance}` untuk seluruh angka, tanpa konkatenasi kalimat; (3) jumlah daun `id` = `en` sebagai gerbang CI; (4) inventaris ini masuk `docs/I18N_KEYS.md` yang **juga belum ada** (§9.8 butir 3).

### 10.4 Bahan bukti lokasi & jaringan yang diminta klien

#### 10.4.1 GPS / Haversine
- **Titik acuan dan radius adalah milik server**, diselesaikan dari `sessionId` → `class_sessions` → `roomId` → `rooms.koordinat + allowedRadiusMeters` tenant (baris 60). Klien **tidak** mengirim dan **tidak** menerima radius. Hari ini kolomnya belum ada (§preambul 10) → layar ini tidak bisa diklaim "siap" sebelum DDL.
- UI mahasiswa hanya menampilkan **hasil**: `attendance.mobile.student.geo.inArea` / `outsideArea`, plus **jarak miliknya sendiri** sebagai angka bulat meter (`distance`) — angka boleh dilihat mahasiswa pemilik data dan peran berhak audit; **tidak** boleh dilihat sesama mahasiswa.
- **State akurasi buruk (`accuracyMeters` di atas ambang): minta ulangi, jangan auto-tolak diam-diam.** Layar `geo.lowAccuracy.*` menampilkan sebab "sinyal lokasi belum cukup akurat", bukan penolakan; bila setelah 2 percobaan tetap buruk → status `HELD` + tawaran `Ajukan banding`/`Tandai ke dosen`. Penolakan senyap adalah akar keluhan "kenapa saya tidak hadir" (§2.8 D-4).
- Kontrak saat ini mengirim `accuracyMeters` dengan plafon 100 (API_SPEC §4.3.2). Bila ambang tenant lebih kecil dari plafon kontrak, ambang tidak ditampilkan.

#### 10.4.2 Wi-Fi BSSID
- **Android 12+**: butuh izin runtime `NEARBY_WIFI_DEVICES` (dan lokasi presisi untuk BSSID non-koneksi). Alur izin yang wajib: (1) layar pemindai berjalan tanpa wifi dan **tidak** mengganggu hasil geo; (2) saat tenant mengaktifkan bukti wifi, munculkan rasional satu baris sebelum memanggil dialog sistem; (3) ditolak → `wifi.denied.*` + panduan tombol pengaturan + jalur banding; (4) **tidak pernah** mengunci aplikasi.
- **iOS**: tidak ada API untuk membaca BSSID jaringan sekitar. **Jalur fallback jujur**: di iOS bukti wifi **tidak tersedia**, dan sesi itu dinilai dengan geo + device attestation + kebijakan tenant. UI tidak boleh menampilkan "izinkan wifi" di iOS (dialog mati = kebocoran + kebingungan), dan spesifikasi lintas-perangkat **dilarang** berpura-pura iOS dapat membaca BSSID.
- Karena kapabilitas berbeda per OS, bahan wifi dikirim sebagai **tiga nilai** (`AVAILABLE` / `DENIED` / `UNSUPPORTED`) supaya server dapat membedakan "ditolak pengguna" dari "tidak mungkin secara OS". Penolakan karena `DENIED` tidak boleh memicu `WIFI_NOT_ALLOWED` (baris 64) pada perangkat yang `UNSUPPORTED`.

| Kapabilitas | Android | iOS | Status verifikasi |
|---|---|---|---|
| Flag lokasi simulasi (`isMockLocation`) | terbaca dari penyedia lokasi simulasi (butuh izin akses debug pada beberapa ROM) | tidak tersedia sebagai flag; hanya deteksi tidak langsung | `[TIDAK-TERVERIFIKASI]` — wajib uji perangkat nyata |
| BSSID jaringan | Android 12+ `NEARBY_WIFI_DEVICES` + lokasi presisi; di bawah 12 butuh izin lokasi | **tidak ada API** | `[TIDAK-TERVERIFIKASI]` kapabilitas iOS; fallback wajib §10.4.2 |
| Device attestation | Play Integrity (butuh proyek + layanan Google) | App Attest / DeviceCheck (butuh Apple Developer) | `[TIDAK-TERVERIFIKASI]` — belum diuji pada tenant uji |
| Blokir tangkapan layar | `FLAG_SECURE` | tidak ada padanan untuk view biasa | `[TIDAK-TERVERIFIKASI]` sisi iOS; mitigasi = TTL + nonce + watermark |
| Waktu tersinkron | NTP sistem | NTP sistem | `[TIDAK-TERVERIFIKASI]` ambang drift 3 s; nilai akhir milik kontrak |

Setiap baris `[TIDAK-TERVERIFIKASI]` di atas adalah **keputusan yang wajib diuji di perangkat nyata sebelum layar ini di-klaim selesai** (DoD §10.9 butir D-9), bukan asumsi yang boleh diimplementasikan diam-diam.

#### 10.4.3 Fake-GPS / mock-location & root/jailbreak
- **UI saat terdeteksi**: dua varian, dipilih oleh **kebijakan tenant**, dan UI menjelaskan bahwa keputusan berasal dari kebijakan kampus (bukan sepihak aplikasi):

| Kebijakan tenant | Perilaku server | Yang dilihat mahasiswa | Yang dilihat dosen |
|---|---|---|---|
| `BLOCK` | bahan ditolak; baris presensi **tidak** terbentuk | `integrity.blocked.*` — penolakan + sebab umum + satu jalur banding | roster menampilkan `DITOLAK · integritas perangkat`, tanpa nilai ambang |
| `WARN_AND_LOG` | presensi tetap diproses, baris `is_mock_location` / flag tercatat + audit | vonis normal **tanpa** kalimat "kamu tertipu" (tidak membocorkan) | chip `TERTAHAN` + penanda audit, keputusan akhir tetap rekonsiliasi dosen/admin |

- **Tanpa SDK berpembayaran sebagai asumsi.** Tidak ada satu pun dependensi berbayar yang boleh dianggap sudah dibayar tenant. Yang dispesifikasi adalah **kontrak adaptornya** (satu interface, implementasi boleh diganti/ditiadakan):

```typescript
// packages/contracts/src/attendance-integrity.ts — status: dispesifikasi, belum ada
export interface DeviceIntegrityProbe {
  readonly os: 'android' | 'ios';
  read(): Promise<DeviceIntegritySample>;            // tidak pernah melempar; gagal = sampel hampa + alasan
}

export type DeviceIntegritySample = {
  isMockLocation: boolean;
  isRooted: boolean;                                  // iOS: jailbreak heuristic; lihat catatan penamaan
  deviceProfile: { modelId: string; osVersion: string; buildHash: string };
  wifi: { capability: 'AVAILABLE' | 'DENIED' | 'UNSUPPORTED'; bssid: string | null };
  location: { latitude: number; longitude: number; accuracyMeters: number; fixAgeSeconds: number };
  clockDriftSeconds: number;
  capturedAt: string;
};
```
  Implementasi yang boleh ditukar: `NullIntegrityProbe` (dev/test, selalu `false` + `UNSUPPORTED`), `NativeIntegrityProbe` (hari ini; kolom `is_mock_location` sudah ada di `attendances`, kolom `isRooted`/`deviceProfile` **belum ada**), `PlayIntegrityProbe` / `AppAttestProbe` (opsional, hanya bila keputusan komersial K-6 diambil). Aturan: **probe gagal ≠ presensi ditolak**; kegagalan probe menurunkan ke `WARN_AND_LOG` atau bahan tanpa bukti tersebut, dan tercatat di audit.
  **Catatan penamaan (jangan buat sinonim kedua):** kontrak §4.3.2 hari ini memakai `isRootedOrJailbroken` sedangkan sampel di atas memakai `isRooted`; pemilik kontrak wajib memilih satu sebelum kode ditulis. Kolom `deviceProfile`, `wifiBssid`, `accuracyMeters`, dan `fixAgeSeconds` belum ada padanannya di `attendances` → perluasan DDL, bukan kebebasan UI.

#### 10.4.4 Replay & clock
- Klien **tidak pernah** mengirim status akhir; klien mengirim bahan (token + lokasi + sampel integritas + `clientTimestamp`), server yang memetakan ke `attendance_status`.
- Satu nonce/`windowIndex` hanya layak satu kali per (mahasiswa, sesi). Scan ulang **tidak** menambah baris (`uq_attendances_session_student` tetap satu) dan menghasilkan `409 SCAN_REPLAY_DETECTED` (baris 62); UI menerjemahkannya menjadi "sudah tercatat" (nada netral, bukan error merah) agar tidak memancing percobaan berulang.
- Deviasi jam dibatasi server terhadap `clientTimestamp`; klien men-*tick* countdown dari `serverTime` (monotonic), bukan jam perangkat; ambang drift = keputusan K-1.

#### 10.4.5 Pemetaan kode → tampilan

| Kode (API_SPEC §2.3) | Layar | Nada | Aksi yang ditawarkan | Yang **tidak** ditampilkan |
|---|---|---|---|---|
| `QR_TOKEN_INVALID` (8) | mahasiswa: pemindaian | netral | `Pindai QR terbaru` | nilai window, nama algoritma |
| `RATE_LIMIT_EXCEEDED` (9) | mahasiswa: percobaan berulang | netral | `attendance.mobile.help.RATE_LIMIT_EXCEEDED` + backoff `{retryIn}` | jumlah batas |
| `OUT_OF_GEOFENCE` (60) | mahasiswa: hasil | `warning` | `attendance.mobile.help.OUT_OF_GEOFENCE` + ulangi + banding | radius dalam meter |
| `DEVICE_INTEGRITY_FAILED` (61) | mahasiswa: hasil | `danger` | banding + hubungi pengampu kelas | flag mana yang menyala |
| `SCAN_REPLAY_DETECTED` (62) | mahasiswa: hasil | sukses netral | lihat hasil yang sudah ada | — |
| `ROOM_GEO_UNAVAILABLE` (63) | **dosen: sebelum buka sesi** | `warning` | drawer "lengkapi koordinat ruang" (`noRoom.*`) | nilai ambang akurasi |
| `WIFI_NOT_ALLOWED` (64) | mahasiswa: hasil | `warning` | `wifi.denied.*` + banding | daftar BSSID |

### 10.5 Alur banding (appeal) — mahasiswa mengajukan, pengampu kelas memutuskan

- **Pengajuan (mahasiswa).** Dari layar hasil, satu tap: form drawer berisi `reason` wajib (min 10 karakter), pilihan jenis alasan terukur (sakit/izin/jaringan/akurasi/ruang tanpa koordinat), dan **lampiran** lewat alur unggah presigned yang sudah ada (`attachmentId`, bukan base64 di body, bukan endpoint khusus). Lampiran masuk kelas PII: pratinjau ter-mask untuk peran non-pemutus.
- **Strip status.** Setiap kartu banding memakai `StateMachineStrip` (§9.7) yang dirender **dari `state` + `allowedTransitions` respons** (API_SPEC §2.5), bukan dari tebakan UI: `PENDING` → `APPROVED` / `REJECTED` (satu arah; keputusan kedua menghasilkan `409 DECISION_ALREADY_MADE`, baris 55). Pemohon **tidak pernah** melihat tombol approve untuk bandingnya sendiri (§9.7 butir empat-mata).
- **Penyetuju = pengampu kelas itu saja** (scope `CLASS`, sesuai [API_SPEC §4.6](file:///c:/SICA/docs/API_SPEC.md) gugus Presensi: mahasiswa `INSERT`, dosen pengampu `VALIDATE`). Layar dosen/wali menampilkan antrean banding **per kelas yang ia ampu**, bukan per tenant; usaha memutus kelas lain tidak dirender sama sekali.
- **Riwayat banding per sesi.** Daftar `VelzonDataGrid` (Web) / kartu tumpuk (Flutter): sesi, pertemuan, status vonis awal, status banding, pemutus, waktu, ringkasan sebab. Menolak karena lewat jendela kalender menghasilkan `409 APPEAL_WINDOW_CLOSED`; UI menampilkan sisa hari jendela (angka kebijakan yang **boleh** dilihat karena menguntungkan pengguna, bukan resep verifikasi).
- **Ketergantungan:** tabel `attendance_appeals` **belum ada migrasinya** (rencana `0017`, ADM-12) dan id mesin state untuk kehadiran (`SM-9`, [AUDIT_READINESS.md](file:///C:/SICA/docs/AUDIT_READINESS.md)) **tidak tercakup** `StateMachineViewSchema.machine` yang hanya `SM-1`..`SM-8` — strip banding presensi tidak bisa dirender sampai kedua hal itu diputuskan (K-4, K-5).

### 10.6 Presensi massal (`APP_BULK`) — dosen/admin

Alur lima langkah, satu layar dengan drawer (`offcanvas`), tanpa modal bertumpuk:

1. **Pilih sesi + sumber.** Hanya sesi dalam scope peran; baris ber-sumber lain (`QR`, `MANUAL`) tampil teredup dengan alasan.
2. **Pratinjau.** Proyeksi sebelum tulis: `N mahasiswa terdaftar · M sudah punya baris · K akan dibuat`. Daftar dipotong server (`GET` proyeksi), bukan disaring di klien.
3. **Checkbox + konfirmasi ganda.** Centang per baris atau per kelompok; tombol lanjut baru aktif setelah kotak **konfirmasi dampak** dicentang, dan angka dampak terbaca (§9.7 "berbasis angka, bukan kata").
4. **Kirim.** Header `Idempotency-Key` diikat ke percobaan ini; **tombol `disabled` + spinner inline selama in-flight** dan tetap `disabled` sampai respons tiba (§5 butir 4). Menekan ulang memakai kunci yang sama → hasil identik, bukan baris ganda. Tidak ada optimistic UI (§9.4: mutasi massal menunggu server).
5. **Hasil.** Ringkasan `{created, skipped}` sebagai dua chip terpisah + daftar baris yang ditolak **beserta sebab** (kode §2.3, satu baris per alasan) dan tautan per baris ke layar detail. Toast sukses tidak pernah berbunyi "selesai" saja. Presensi massal di-*batch flush* (AGENTS §3.7); baris tercatat `source = APP_BULK` + `marked_by`.

### 10.7 Komponen, token, dan paritas (WAJIB Velzon)

- **Token yang berlaku** (§1.1, §2.0): primary **hijau teal `#0ab39c`** (hover `#089e85`), radius **8 px** (`rounded-md`), tipografi **Plus Jakarta Sans**, spacing **grid 8 pt**, label form `text-sm font-semibold` normal-case, tombol datar `shadow-sm` `active:scale-[0.98]`. **Tidak ada gaya lokal.**
  Ketidaksesuaian yang harus dibayar saat layar ini dibangun (bukan rahasia baru): sisi Flutter masih memakai `primaryBlue #3577f1` sebagai aksen utama dan FAB ([`sica_theme.dart:43`](file:///C:/SICA/apps/mobile/lib/core/theme/sica_theme.dart)) serta `borderRadius.circular(12)` pada card dan `20`/`24`/`30` pada layar scanner — melanggar radius kanonik 8 px dan primary Velzon; sisi Web §1.3 juga mencatat font mobile belum `Plus Jakarta Sans`.
- **Komponen daftar = `VelzonDataGrid`; detail/aksi = `offcanvas` drawer kanan**, bukan modal bertumpuk (§9.7). Roster sesi, daftar `HELD`, dan riwayat banding semuanya drawer dengan deep-link (`/attendance/session/:id?held=1`).
- **Peta chip status + sumber** (satu kolom = satu peta, §9.8 butir 4). Warna **tidak pernah** sendirian: setiap chip membawa **ikon + teks**; `HELD` memakai ikon jam pas + teks karena ia keadaan tayang, bukan enum.

| Nilai | Label Indonesia | Token chip | Ikon wajib (Lucide / M3) | Catatan kontras |
|---|---|---|---|---|
| `PRESENT` | Hadir | `success` | `CircleCheck` / `check_circle` | teks gelap di atas tint, AA 4.5:1 |
| `EXCUSED` | Izin | `secondary` | `FileText` / `description` | jangan pakai warna primary |
| `SICK` | Sakit | `info` | `Medical` / `medical_information` | kontras `#299cdb` di light perlu teks gelap |
| `ABSENT_LATE` | Terlambat | `warning` | `ClockAlert` / `clock_loader_40` | **emas `#f7b84b` gagal AA bila dipakai sebagai teks di latar putih** → wajib latar tint + teks gelap |
| `ABSENT` | Tidak hadir | `danger` | `CircleX` / `cancel` | jangan disalahpahami sebagai error sistem |
| `HELD` (tayang) | Tertahan | `secondary` | `Hourglass` / `hourglass_top` | bedakan visual dari `ABSENT` |
| sumber `QR` | Pindai QR | outline netral | `QrCode` / `qr_code_2` | — |
| sumber `GEOFENCE` | Lokasi | outline netral | `MapPin` / `location_on` | — |
| sumber `MANUAL` | Manual dosen | outline netral | `PencilLine` / `edit` | tautkan ke `marked_by` |
| sumber `APP_BULK` | Massal | outline netral | `ListChecks` / `playlist_add_check` | §10.6 |
| sumber `FEEDER_SYNC` | Feeder | outline netral | `RefreshCw` / `sync` | hanya admin yang bisa melihat |

- **Skeleton, bukan spinner penuh** (§7.1); `EmptyState` menyebut sebab + tautan perbaikan (§9.1.4) — `empty-state.tsx` masih **belum ada** di `components/ui/`, jadi ia prasyarat slice ini.

**Paritas komponen Web ↔ Flutter (AGENTS §3.4):**

| Layar | Web Velzon | Padanan Flutter M3 | Paritas | Catatan |
|---|---|---|---|---|
| Pita QR dosen | halaman `/attendance/session/:id` + Card + ring SVG | `LecturerQrBroadcastScreen` | wajib dua platform | Web **belum punya** layar penerbit; Flutter punya tapi membocorkan radius (§10.0.2) |
| Scanner mahasiswa | **tidak dibangun** (kamera laptop tidak dapat dipercaya) | `QrScannerScreen` + `mobile_scanner` | pengecualian platform yang sah §3.4 | fungsi tidak boleh hilang: sediakan jalur `Tandai manual` + banding di Web |
| Hasil + riwayat presensi | `VelzonDataGrid` rekap | kartu tumpuk + chip | wajib | proyeksi server identik, satu peta chip §10.7 |
| Banding (ajukan) | drawer form | bottom sheet + form | wajib | satu kontrak, satu `attachmentId` |
| Banding (putus) | drawer keputusan + reason wajib | sheet keputusan | wajib (§9.6 aksi 1) | penyetuju hanya pengampu kelas |
| Presensi massal | `VelzonDataGrid` + checkbox kolom | list selection + FAB | wajib | kunci idempotensi di sisi Web dan Mobile |
| Penolakan/audit | drawer "Riwayat penolakan" | halaman riwayat baca-saja | wajib | bahan mentah ter-mask untuk peran non-audit |

**Catatan paritas menantang yang masih terbuka:** tombol QR di **bottom-nav Flutter tidak pernah disaring entitlement** (hari ini statis) — `G-05` Web sudah tertutup, Mobile belum ([RBAC_MATRIX §G-05](file:///c:/SICA/docs/RBAC_MATRIX.md)). FAB scan harus hilang untuk peran tanpa izin `READ` presensi dan untuk tenant non-`ACTIVE`/`TRIAL` (`404 MODULE_NOT_AVAILABLE` di server, menu tidak dirender di UI); menyaring menu **bukan** penegakan (§3.8) — gerbang `withModule` tetap wajib di rute.

### 10.8 Edge case yang wajib tercover

1. **Sesi dibuka tanpa ruang/koordinat valid.** Fail-closed sesuai baris 63 (`ROOM_GEO_UNAVAILABLE`) — jangan pernah meloloskan scan "karena data lokasi tidak ada". Karena `rooms` belum punya kolom koordinat, UI harus **mencegah sebelum submit** (`noRoom.*` drawer + tautan lengkapi), bukan menolak mahasiswa di depan kelas.
2. **Mahasiswa pindah kelas/sebaran di tengah sesi.** Keanggotaan diselesaikan server dari `enrollments` aktif pada saat scan, bukan dari kelas yang sedang terbuka di layar mahasiswa. Scan lintas kelas → ditolak dengan sebab "anda tidak terdaftar di sesi ini" **tanpa** mengonfirmasi keberadaan sesi lain (anti enumerasi).
3. **Offline saat scan.** Bahan (token + koordinat + sampel + waktu perangkat) disimpan di antrian lokal terenkripsi, submit otomatis saat online, dengan **batas umur** (target 15 menit; angka final milik kontrak K-1) dan **alasan wajib** saat lewat umur. Bahan kedaluwarsa tidak pernah berubah menjadi `PRESENT` diam-diam: ia menjadi `HELD` lalu `ABSENT` pada rekonsiliasi, dengan hak banding yang dijelaskan. Antrian yang sudah tersimpan **tidak** menampilkan vonis (klien tidak memutuskan, §10.0.4).
4. **Device sharing (satu akun dua perangkat).** Penampilan `deviceProfile` dari perangkat yang belum terdaftar/berbeda dari profil kelas → diperlakukan sebagai sinyal integritas, bukan sebagai alasan penolakan otomatis; efeknya mengikuti kebijakan tenant `BLOCK`/`WARN_AND_LOG`. Kebijakan "satu akun satu perangkat" vs "boleh dua" adalah **putusan produk (K-7)**; tanpa putusan itu UI hanya boleh menampilkan chip "perangkat tidak dikenal" kepada dosen/admin, bukan kepada mahasiswa.
5. **QR kadaluarsa di tengah antrean.** Mahasiswa mengantre dan token berganti 5 kali sebelum gilirannya → hasil **bukan error**, cukup "QR sudah berganti, pindai ulang" dengan satu tap; jangan memakai bahasa "gagal" dan jangan menghitungnya sebagai percobaan rate-limit.
6. **Aksesibilitas.** Urutan baca logis (status → sebab → aksi); ticker countdown `aria-hidden` dan cincin tanpa flashing; `prefers-reduced-motion` mematikan sapuan cincin dan garis laser; target sentuh 44×44 dp (§8.1); vonis disampaikan `role="alert"` **hanya** pada hasil akhir, loading memakai `role="status"`; chip AA dan selalu ikon + teks.
7. **Audit yang bisa dibela.** Setiap penolakan — geofence, akurasi, wifi, integritas, replay, rate-limit, jendela banding — **wajib** menghasilkan satu baris penolakan berisi: waktu server, kode §2.3, bahan yang dinilai (ter-mask per kelas PII), versi kebijakan tenant yang berlaku saat itu, `sessionId`, `student_id`, dan `actor` peran yang memutuskan. Tanpa baris ini, klaim "sistem menolak" tidak dapat dibela ketika orang tua atau kaprodi menuntut alasan kehadiran. **Objeknya belum ada** (`attendance_denials` tidak termuat di migrasi maupun `DATA_MODEL §4.6`) → keputusan K-5; tabel ini bukan asumsi desain.

### 10.9 Definition of Done lapisan ini

- [ ] **D-1** Enam state (idle, loading, sukses, kosong, error, offline/degraded) terisi untuk **semua** sub-layar §10.2 (kamera, pemindaian, verifikasi, hasil, percobaan berulang) — bukan hanya jalur happy.
- [ ] **D-2** 94 kunci `attendance.mobile.*` masuk ke **dua** berkas dengan bentuk dan jumlah daun identik (`id.json` = `en.json`), plus migrasi dua layar Flutter dari string hardcode ke ARB; diff jumlah kunci jadi gerbang CI.
- [ ] **D-3** Kontras WCAG 2.1 AA terverifikasi otomatis per pasangan latar/teks chip (khususnya `warning` emas dan `info` sky di light mode), dan setiap status punya ikon + teks, bukan warna saja.
- [ ] **D-4** Nol teks UI hardcode di Web dan Flutter (AGENTS §3.5); nol gaya Tailwind lokal di luar primitif Velzon (AGENTS §3.4 + `UI_UX_DESIGN §11.5`); radius 8 px dan primary `#0ab39c` di kedua platform.
- [ ] **D-5** Nol kebocoran aturan verifikasi ke UI: tidak ada angka radius, ambang akurasi, `windowIndex`, daftar BSSID, atau label flag integritas pada layar mahasiswa; `keyVersion`/`algorithmVersion` hanya di panel info peran berhak dan **tidak** berada di dalam gambar QR; dua string lama di `lecturer_qr_broadcast_screen.dart` (baris 199, 262) terhapus.
- [ ] **D-6** Paritas Flutter dinyatakan per layar pada tabel §10.7, termasuk pengecualian platform yang diakui (scanner) beserta jalur penggantinya di Web.
- [ ] **D-7** Satu uji snapshot untuk QR countdown: cincin pada `t = 0`, `t = 2.5 s`, `t = 4.9 s` dan saat pergantian token — memverifikasi **tidak ada** text-flash dan tidak ada `aria-label` yang berubah tiap detik.
- [ ] **D-8** Bottom-nav / FAB presensi Mobile disaring `tenant_modules × peran aktif` (menutup sisa `G-05` Mobile) dengan uji snapshot menu per peran.
- [ ] **D-9** Setiap baris `[TIDAK-TERVERIFIKASI]` di §10.4.2 sudah diuji di perangkat nyata atau secara eksplisit di-degradasi ke jalur fallback; hasil pengujian dicatat di `PROGRESS_REPORT.md` oleh pemilik siklus.
- [ ] **D-10** State machine `StateMachineStrip` banding dirender dari `allowedTransitions` server; nol tombol yang menawarkan transisi tanpa baris izin.

**Keputusan yang saya tolak desain karena butuh putusan produk (bukan kewenangan desain):**

- **K-1** Turunkan TTL rotasi dari 30 s (hari ini) ke 5 s (target): mengubah kontrak `generate`/`scan`, konsumsi baterai, dan kuota data kelas besar; pemilik: `API_SPEC` + produk. Nilai `rotationSeconds`, batas umur antrian offline, dan ambang drift jam ikut ditentukan di sini.
- **K-2** Menaruh koordinat + `allowedRadiusMeters` + allowlist BSSID di `rooms` (DDL) sehingga geofence menjadi milik server; hari ini nilainya datang dari body klien (`SEC-03`). Pemilik: `DATA_MODEL`.
- **K-3** Menambah `PLANNED`/`PAUSED` pada `class_sessions.status` (register enum §15) agar state "belum dimulai" dan "jeda" sah; tanpa ini kedua state layar dosen tidak dapat dipertahankan.
- **K-4** Jendela banding: berapa hari, boleh diajukan berapa kali, dan apakah `EXCUSED`/`SICK` boleh diajukan retroaktif; juga `attendance_appeals` belum bermigrasi (ADM-12).
- **K-5** DDL penolakan (`attendance_denials`) + id mesin state kehadiran (`SM-9` di luar enum `SM-1`..`SM-8` kontrak §2.5).
- **K-6** Komersial integritas perangkat: mengaktifkan Play Integrity / App Attest (butuh akun layanan + biaya) atau berhenti pada `NativeIntegrityProbe`; dan nilai default kebijakan tenant (`BLOCK` vs `WARN_AND_LOG`) untuk setiap kelas sinyal.
- **K-7** Kebijakan device sharing (satu akun satu perangkat atau boleh lebih), karena ia menentukan efek `deviceProfile` yang tidak boleh saya putuskan sebagai desainer.
- **K-8** Nomor `API_SPEC §4.3.6–§4.3.9` yang dirujuk register tetapi belum ditulis; seluruh bentuk field di §10.4 menggantung di sana dan tidak bisa saya tetapkan dari dokumen UI.

---

## 11. Implementasi design system Velzon di `apps/web` (realita kode, 2026-10-19)

Sub-bagian ini adalah **kontrak implementasi** hasil overhaul lapisan tampilan. Aturan di §1–§10 sebelumnya bersifat niat; di sini tercatat bagaimana niat itu ditegakkan di berkas, sehingga agen berikutnya tidak kembali menulis gaya lokal.

### 11.1 Satu sumber token

| Berkas | Isi | Aturan |
|---|---|---|
| `apps/web/src/app/globals.css` | seluruh token (`:root` + `[data-theme]` + `[data-layout]`), kanal RGB, ramp netral, elevasi, ring fokus, palet grafik, plus kelas komponen Velzon (`.card`, `.card-header/body/footer`, `.page-content`, `.main-content`, `.navbar-header`, `.badge-soft-*`, `.badge-label-*`, `.btn-soft-*`, `.btn-label-*`, `.avatar-*`, `.progress`, `.skeleton`, `.dropdown-menu/.dropdown-item`, `.table-head/.table-row`, `.velzon-input`, `.field-*`, `.overlay-backdrop`, `.elevated-panel`, `.eyebrow`, `.section-label`, `.page-title/.page-description`) | **satu-satunya** tempat hexa. Komponen tidak boleh menulis hexa |
| `apps/web/src/app/globals.css` | reset, kelas motion landing (`sica-*`), perilaku top-nav responsif, `:focus-visible` global | tidak ada warna baru di sini |
| `apps/web/tailwind.config.ts` | memetakan `primary/secondary/success/info/warning/danger` + `slate` (dan `gray` sebagai jembatan) ke `rgb(var(--sica-rgb-*))` dengan `<alpha-value>`, radius/bayangan/ketelitian/animasi dari token | warna Tailwind **tidak** lagi hardcode |

Konsekuensi yang disengaja: `bg-slate-50/50` di tema gelap otomatis menjadi gelap, karena `slate-50` adalah variabel, bukan hexa. Karena itu **dilarang** menambah varian `dark:` per komponen — tema digeser di satu tempat.

**Lapisan baru 2026-10-24.** Sejak `§2.6`, ada berkas tema kedua di `apps/web/src/styles/` (`_velzon-config.scss`, `bootstrap.scss`, `velzon.scss`). Ia **tidak** menambah palet: `--bs-*` adalah proyeksi `--sica-*`, dan heksa konfigurasinya dijaga setara oleh `.tools/palette-drift.mjs`. Peta berkas & aturan lapisan hanya ada di `§2.6` — tabel di atas tidak mengulangnya (`RD-55`).

**Alias lama — SUDAH DIHAPUS (2026-10-19).** `--sica-color-primary`, `--sica-bg-*`, `--sica-border`, `--sica-radius-pill` pernah dialihkan lewat blok "Jembatan migrasi token". Kondisinya tercapai dan blok itu diangkat: pengukuran `grep -- "--sica-color-"` di `apps/web/src` = **0**, `--sica-radius-pill` dan rujukan lama lain dikodemod ke nama baru (`--sica-radius-full`), dan `--sica-text-sidebar-active` ternyata **bukan** alias — ia token sah di `:root` yang hanya kehilangan utilitas Tailwind-nya (kunci `sica.text.active` kini ada). Komponen baru **wajib** memakai nama baru (`--sica-primary`, `--sica-primary-soft`, `--sica-border-color`, `--sica-radius-full`); memakai nama lama sekarang berarti membuat kelas yang tidak pernah dikompilasi.

**Kelas design-system dapat ter-purge — dan itu tidak terdengar oleh `tsc`/`vitest`/`lint`.** Karena `@layer components` diperlakukan Tailwind seperti utilitas, kelas yang dirangkai dinamis (`avatar-${size}`, `status-dot-${status}`) **hilang dari CSS produksi**: terukur **25 dari 59** kelas tidak teremit pada artefak `.next/static/css`, termasuk seluruh ukuran avatar, seluruh titik status, dan seluruh nada badge. Dua tindakan dipasang: (1) `safelist` lima pola di `tailwind.config.ts` sehingga keluarga kelas itu tidak mungkin hilang lagi, dan (2) `Badge` tidak lagi meniru warnanya sendiri dengan utilitas inline — `soft`/`label` mendelegasikan ke `badge-soft-*`/`badge-label-*` dengan **nama kelas ditulis utuh**. `Badge` sebelumnya justru menjadi jalan masuk kembali kombinasi kontras rendah (`text-primary-hover` di atas `bg-primary/12` = 3,04:1) tepat setelah §11.10 mengukurnya. Gerbang penangkapnya: periksa artefak CSS hasil build, bukan hanya source — lihat §11.9.

### 11.2 Disiplin tipografi (anti-gemuk)

- Font dimuat di `app/layout.tsx`: **Plus Jakarta Sans 400/500/600/700 saja**. Weight 800 dihapus dari `<link>` — permintaan apa pun ke 800 tidak lagi tersedia, jadi tidak bisa "diam-diam" gemuk.
- Heading global (`@layer base`): `font-weight: 600`, `line-height: 1.25`, `letter-spacing: -0.021em`. Body `400`/`1.6`, paragraf `leading-relaxed2` (1.7), warna body `--sica-text-body`.
- Label & badge: `text-xs`/`11px`, `font-semibold`, `uppercase tracking-wider2` — **hanya** untuk label kecil, jangan untuk judul.
- Angka: `.tabular` (`font-variant-numeric: tabular-nums`) wajib untuk NIM, SKS, IPK, Rupiah, jam, dan sel angka grid.
- Penegakan di lapisan CSS: `.font-black`/`.font-extrabold` dinormalkan ke `font-weight: 600` (pelindung), tetapi kelasnya tetap harus dibersihkan dari JSX — pelindung bukan izin. **Ralat 2026-10-24 (`RD-170`):** aturan ini dulunya duduk di dalam `@layer base` dan TERBUKTI tidak pernah keluar ke artefak build (`grep font-black` pada `.next/static/css` = 0) karena Tailwind mem-purge selector berbasis kelas di dalam `@layer` yang tidak dipakai JSX mana pun; ia dipindah ke CSS tanpa layer sehingga selalu terkompilasi, dan `verify-css-artifact` kini mengasersinya (sebelumnya asersi itu MISS dan tak seorang pun membacanya). Pelajaran yang berlaku umum: **pelindung berbasis kelas hanya nyata kalau artefak build yang membuktikan.**

### 11.3 Inventaris primitif `components/ui`

| Komponen | Ekspor penting | Peran |
|---|---|---|
| `button.tsx` | `Button`, `buttonVariants` | varian `default/soft/label/secondary/success/info/warning/destructive/outline/ghost/link`, ukuran `xs…xl/icon/icon-sm`, `block`; fokus `ring-4 ring-primary/15`, `active:scale-[0.985]` |
| `card.tsx` | `Card` (+ `interactive`), `CardHeader/Heading/Title/Description/Content/Footer` | wadah semua blok; `interactive` → `card-hover` (angkat 2px) |
| `badge.tsx` | `Badge` (`tone`, `look`: `soft/label/solid/outline`, `dot`) | status & penanda modul |
| `status-badge.tsx` | `StatusBadge`, `toneForStatus`, `labelForStatus` | **satu-satunya** penerjemah enum kanonik (`docs/DATA_MODEL §15`) → nada + label Indonesia; fallback netral, tidak pernah menebak warna |
| `table.tsx` | `Table/THead/TH/TBody/TR/TD` | head uppercase tipis, row hairline + hover, `TH sortable` |
| `input.tsx` | `Input` (`startIcon`/`endIcon`), `Textarea`, `Select`, `Field` | `.velzon-input` (latar `slate-50/50` → putih saat fokus, ring primary) |
| `stat-card.tsx` | `StatCard` | `label/value:string/hint/trend/trendValue/trendSemantic/spark/icon:ReactNode/loading` |
| `skeleton.tsx` | `Skeleton/Text/Card/Table/Stats` | shimmer `.skeleton::after`; **pengganti spinner** di semua state loading |
| `progress.tsx` | `Progress`, `ProgressStack` | kursi kelas, pemakaian SKS, komposisi pembayaran |
| `dropdown.tsx` | `Dropdown/DropdownItem/Separator/Label` | tanpa Radix (belum terpasang — lihat `TECH_CONVENTIONS §6`); tutup via klik-luar/Escape |
| `drawer.tsx` | `Drawer`, `ConfirmDialog` | pola **daftar → drawer** (§9.2); `ConfirmDialog` satu lapis saja, `overlay-backdrop` blur |
| `alert.tsx` | `Alert` | sebab + remedi, `tone` soft, ikon lucide; bukan blok merah keras |
| `accordion.tsx` | `Accordion` | detail per gugus di katalog modul/benchmark |
| `page-header.tsx` | `PageHeader`, `MetaRow` | breadcrumb + judul + aksi; menghapus heading `font-black` inline |
| `velzon-chart.tsx` | `VelzonChart`, `Sparkline` | lihat §11.5 |
| `avatar.tsx` | `Avatar` (`xxs…xl`, `status`), `AvatarGroup` | inisial dari nama, dot status; tanpa hexa |
| `theme-provider.tsx` | `ThemeProvider`, `ThemeSwitcher`, `themeInitScript` | lima kombinasi tema (§1.2), persist `localStorage`, anti-kedip |
| `toaster.tsx` | `Toaster` (Sonner) | border hairline, `shadow-dropdown`, strip kiri per tipe, `closeButton` |
| `velzon-data-grid.tsx` | `VelzonDataGrid`, `ColumnDef` | grid enterprise (head/row/skeleton/paginasi) yang dipakai roster, KHS, KRS |

### 11.4 Pola halaman & chrome

- **Dashboard**: `app/(dashboard)/layout.tsx` merender `TopNav` (baris 1 brand/pencarian/utilitas/profil, baris 2 navigasi horizontal) lalu `main.main-content` > `div.page-content`. Judul layar memakai `PageHeader`; meta ringkas (periode aktif, tenant, peran aktif) memakai `MetaRow`, bukan paragraf bebas.
- **Pencarian global** di header hanya sebuah input (belum punya rute); sampai `GET /api/v1/search` ada, ia **tidak** boleh berpura-pura berfungsi — disembunyikan atau diberi status "segera" eksplisit.
- **Pemilih tema** nyata (`ThemeSwitcher`) menggantikan tombol "Mode gelap" hiasan; tombol bahasa/modul/layar-penuh masih hiasan dan wajib ditandai begitu di kode agar tidak disangka fitur.
- **Daftar → drawer**: baris grid memuat ringkasan, drawer memuat detail + riwayat + aksi; perubahan izin/nilai/keuangan menampilkan `StateMachineStrip` (§9.7) yang dirender dari `allowedTransitions` server (§2.5 API_SPEC), bukan dari tebakan klien.

### 11.5 Grafik premium tanpa dependensi

`apps/web/package.json` **tidak** memuat `apexcharts` maupun `recharts`, dan `TECH_CONVENTIONS §6` melarang dokumen menyebut kemampuan seolah paketnya ada. Karena itu grafik dibangun sebagai primitif SVG sendiri:

- kurva **monotone cubic (Fritsch–Carlson)** — halus dan tidak *overshoot* di bawah/atas data titik;
- area fill gradient dua stop dengan **opacity 0.15 → 0** (tema gelap 0.22 karena kontras);
- tooltip **glassmorphism** (`backdrop-filter: blur(10px) saturate(150%)`, `--sica-chart-tooltip-bg/border`, `shadow-dropdown`), titik terdekat dari posisi pointer;
- animasi render **sekali saat mount** (`stroke-dashoffset` 1100 ms + opacity area), tunduk `prefers-reduced-motion`;
- legenda bulat kecil + label `slate-500`, sumbu memakai `--sica-chart-grid/--sica-chart-axis`, dan `useId` untuk mencegah tabrakan id gradient antar-instance.

Aturan: palet grafik hanya `--sica-chart-1…5`; satu seri = satu warna token; **jangan** memakai warna status (`danger`) untuk seri netral, dan jangan pula dua seri berdekatan memakai teal yang identik.

### 11.6 Ritme, jarak, dan kedalaman

- `.page-content` = padding 24px (mobile 16px) + `max-width: var(--sica-content-max)` + `gap: 24px` antar blok. Halaman tidak lagi mengatur padding sendiri.
- Kartu: `card-body` 24px; grid metrik `gap-4`, blok besar `gap-6`; section landing `py-20 sm:py-28`.
- Depth = **hairline + bayangan lembut**, bukan border tebal: `border-[color:var(--sica-border-color)]` dengan `shadow-card`, naik ke `shadow-raised` saat hover/fokus. Di layout `minimal`, bayangan digantikan hairline.
- Scrollbar global tipis (6px, `slate-300` → `slate-400` saat hover, track transparan).
- Micro-interaction: `transition-all duration-200 ease-velzon`; angkat kartu maksimum 2–4px; tanpa parallax di layar kerja (khusus landing).

### 11.7 Daftar tolak (yang membuat antarmuka terasa "buatan AI")

Dilarang dan akan ditolak saat review:

1. Hexa mentah atau kelas `gray-*` di komponen (pakai `slate-*`/token).
2. `#ff0000`/`#0000ff`/abu `#cccccc`; gradien ungu→biru generik; teks bergradien.
3. `font-black`/`font-extrabold`, atau `bold` untuk body.
4. `bg-white`/`text-black` yang mengunci tema gelap.
5. Spinner bulat biasa untuk state loading (skeleton wajib).
6. Toast merah polos tanpa sebab/remedi.
7. Warna status yang diputuskan per-komponen (harus `StatusBadge`).
8. Modal bertumpuk di Area Admin (drawer, §9.2).
9. Memberi `outline-none` tanpa `focus-visible:ring` pengganti.
10. Menampilkan resep keamanan di UI (radius, TTL, window tolerance) — lihat §10.0.

### 11.8 Paritas i18n: angka yang benar

Terukur hari ini dengan penghitungan daun rekursif atas `src/locales/*.json`: **`id.json` = 574 daun, `en.json` = 518 daun** — selisih 56 kunci, seluruhnya di `landing.roles.tabs.4…10` (tiap tab = 4 daun + 4 poin). `en.json` **tidak** punya kunci yang tidak ada di `id.json`. Klaim "148 vs 148 seimbang" yang pernah muncul di catatan siklus ini **salah** (metodenya tidak menghitung daun bersarang) dan tidak dipakai sebagai acuan. Gerbang yang diusulkan (RD-19): skrip pembanding daun + tipe kamus agar `typeof idDict` menolak kekurangan kunci saat `tsc`.

### 11.9 Validasi lapisan tampilan

- `tsc --noEmit` (`apps/web`) **0 error**; `vitest run` tetap lulus seluruhnya (lapisan tampilan tidak menyentuh service).
- `next build` sebagai bukti bahwa kelas Tailwind/token resolve dan tidak ada `undefined` var.
- Artefak CSS, bukan hanya source: `.tools/purge-check.mjs` membaca `apps/web/.next/static/css` dan memastikan keluarga kelas `@layer components` benar-benar teremit (insiden 25/59 di §11.1 tidak terlihat oleh `tsc`).
- Cek manual tema `light` + `solid` pada landing dan login; pastikan keduanya tetap sama meski preferensi tersimpan pengguna berbeda. Cek matriks penuh (light/dark/semi-dark × solid/gradient/minimal) pada dashboard, KRS, KHS, dan pembimbing akademik.
- Kontras: `.tools/contrast-audit.mjs apps/web/src/app/globals.css` **WAJIB FAILS = 0** setiap kali token warna bertambah (§11.10).

**Gerbang pemindai kelas (`scanner`).** Penjaga mekanisnya `.tools/ui-guards.mjs` dijalankan pada `apps/web/src`; kolom "terukur" adalah hasil jalan 2026-10-20, bukan target.

| Pola terlarang | Target | Terukur 2026-10-20 | Dasar norma |
|---|---|---|---|
| `--sica-color-` (alias lama) | 0 | **0** | §11.1 (blok jembatan dihapus) |
| `font-black` / `font-extrabold` di `src/**/*.tsx` | 0 | **0** (satu-satunya kemunculan: aturan normalisasi di `globals.css` baris 376–377, yang memang pelindung bukan izin) | §11.2, §11.7 butir 3 |
| `blue-[0-9]00` / `indigo-[0-9]00` / `sky-[0-9]00` / `violet-[0-9]00` / `purple-[0-9]00` (kelas warna literal) di `src` | 0 | **0** | §11.11.2 |
| `focus:border-<literal>` / `focus:ring-<literal>` (biru, indigo, violet, sky, ungu) | 0 | **0** | §11.11.2 |
| `font-black` / `font-extrabold` di `apps/mobile/lib/**` (`FontWeight.w800`/`w900`) | tidak naik dari hari ini | 1 (`digital_ktm_card.dart:79`) | §11.2 — paritas dua platform, **utang tercatat** |
| `options={[` / `const *_OPTIONS` / `<option value="…">` pada field kelas C/D | 0 untuk kind yang terdaftar `reference_kind_usage` | 0 · 2 · 0 (kedua deklarasi = data contoh & label kelas A′; `reference_kind_usage` belum berisi baris) | §13.2, DATA_MODEL §20.1 gerbang (m)/(n) |
| `gray-[0-9]00` | 0 | **0** | §11.7 butir 1 |
| `apexcharts` / `recharts` / `echarts` di `apps/web/package.json` + `package.json` | 0 | **0** | §11.5, §11.11.1, `TECH_CONVENTIONS §6` |
| `bg-white` / `text-black` | tidak naik dari hari ini | 6 + 1 (sisa lama: `page.tsx` landing 5, `velzon-data-grid.tsx` 1) | §11.7 butir 4 — **utang tercatat**, pengurangannya task, penambahannya temuan |
| hexa mentah di komponen | tidak naik | 18 (`pdf-generator.service.ts` 8, `login-form.tsx` 8, `layout.tsx` 1, `top-nav.tsx` 1) | §11.1 "satu-satunya tempat hexa" |
| `animate-spin` | tidak naik | 3 (`krs/page.tsx` 1, `login-form.tsx` 2) | §11.7 butir 5 — target = skeleton §11.3 |

**Empat pemeriksaan yang ditambahkan pada 2026-10-20.** Kondisi alat terukur hari ini: `.tools/ui-guards.mjs` menjalankan **8 checker** (`--sica-color-`, `font-black|font-extrabold`, `gray-[0-9]00`, `bg-white`, `text-black`, hexa `#rrggbb`, `outline-none` tanpa ring, `animate-spin`) atas 87 berkas `.ts`/`.tsx` di `apps/web/src`. Empat baris di bawah **belum** ada di skrip itu — menambah regexnya adalah task pemilik `.tools/` (`E-5`), dan sebelum skrip berubah tidak boleh ada dokumen yang menyebutnya "sudah ditegakkan".

1. **Pemindai warna literal.** Pola `blue-[0-9]00`, `indigo-[0-9]00`, `sky-[0-9]00`, `violet-[0-9]00`, `purple-[0-9]00` di `apps/web/src/**` **dan** varian `focus:`/`hover:`-nya → target **0**; terukur 2026-10-20 = **0**. Tambahan yang menutup celah yang sama dari sisi primitif: `hexa|rgb(` di `apps/web/src/components/ui/**` → target **0** (keputusan warna hanya di token, §11.11.2). Alasannya: satu kelas literal = satu sumber kebenaran warna kedua.
2. **Pemindai bobot gemuk.** `font-black|font-extrabold` di `apps/web/src/**/*.tsx` → target **0** (sudah ditegakkan checker ke-2 di atas; terukur **0**, satu-satunya kemunculan = aturan normalisasi di `globals.css` yang memang pelindung, bukan izin). Karena §11.2 adalah norma dua platform, cakupannya ikut **`apps/mobile/lib/**`** untuk `FontWeight.w800`/`FontWeight.w900` → terukur **1** (`digital_ktm_card.dart:79`): **utang tercatat**, sama seperti baris `bg-white` — pengurangannya task, penambahannya temuan.
3. **Syarat layar engine punya copy `degraded`.** Setiap layar `engine.*` (daftar di §12.10) wajib punya cabang render untuk `degraded` dan cabang untuk `PARTIAL`/`parsial`. Cara mengujinya bukan dibaca mata: uji komponen dengan respons tertiru `degraded: "NO_PREREQ_DATA"` (dan tiap bendera lain di §12.2) yang **harus** memunculkan lencana + teks penjelas, dan uji kedua bahwa angka utamanya **tidak** dirender sebagai angka percaya-diri saat bendera terpasang. Layar engine tanpa cabang `degraded` ditolak di review, meskipun angkanya benar.
4. **Pemindai array opsi literal (gerbang `m`/`n` DATA_MODEL §20.1).** Pola `options={[`, `const *_OPTIONS`, `<option value="…"`, dan `z.enum(` yang menempel pada field kelas **C/D** → target **0 temuan untuk field yang terdaftar di `reference_kind_usage`**; dan kebalikannya: setiap `kind` yang dibaca UI **wajib** punya baris `reference_kind_usage` (norma §13.1). Terukur 2026-10-20: `options={[` di `apps/web/src` = **0**, `<option value="…">` literal = **0**, deklarasi `const *_OPTIONS` = **2** — `SEMESTER_OPTIONS` (`(dashboard)/academic/khs/page.tsx:197`, nilai tempel dari data contoh `SAMPLE_KHS_DATA`; seharusnya baris `academic_periods`) dan `CLASS_STATUS_FILTER_OPTIONS` (`modules/academic/components/krs-course-picker.tsx:89`, kode `DRAFT/OPEN/CLOSING/CLOSED`). Yang kedua **kelas A** (`period_status`, enum tertutup — kodenya memang tidak boleh menjadi data), tetapi empat label Indonesia-nya **sudah punya pemilik lain**: `labelForStatus` di `status-badge.tsx:106` (§11.3, satu-satunya penerjemah enum → nada + label). Jadi temuannya adalah **duplikasi label**, bukan kelas yang salah — perbaikannya memakai `labelForStatus`, dan ini persis kasus yang ditangkap norma §13.3. Keduanya task slice ADM-1/ADM-3 (layar `khs` masih fixture), bukan temuan yang memblokir pemindai: `reference_kind_usage` hari ini belum berisi baris sama sekali (`0047` belum diterapkan).

**Empat pemeriksaan lagi yang ditambahkan pada 2026-10-20 (gelombang §14–§16).** Seluruhnya masih **norma dokumen**, bukan checker: `.tools/ui-guards.mjs` hari ini berisi 8 pemeriksaan (kolom "terukur" di atas) dan tidak memuat satu pun pola di bawah — jadi tidak boleh ada tulisan "sudah ditegakkan CI" sebelum skripnya berubah (satu daftar dengan task `E-5`/`F-3`).

5. **Nol input angka tanpa batas dari metadata.** Setiap `type="number"` di layar §14/§15/§16 **wajib** menerima `min`/`max`/`step` yang **berasal dari baris parameter** (`min_value`/`max_value`/`allowedValues` pada respons `API_SPEC §4.16.1`), bukan konstanta di JSX. Target **0** layar berbatas tempel. Terukur 2026-10-20: **0 pemakai** — `find apps/web/src/app/api/v1 -name route.ts` = 18 berkas dan direktorinya hanya `academic`, `attendance`, `auth`, `health`, `tenant`, sehingga prefix `/admin/**` dan `/settings/**` belum pernah ada. Artinya gerbang ini dipasang **bersamaan** dengan layar pertamanya, tidak sesudahnya. Yang dinilai di review: `422 PARAM_OUT_OF_RANGE` (107) punya cabang render + copy risiko (§14.3), bukan `.field-error` merah tanpa sebab.
6. **Nol tombol yang disembunyikan dengan CSS saja.** `hidden`, `invisible`, `sr-only`, `opacity-0`, `pointer-events-none`, atau `display:none` pada tombol **aksi tulis** = temuan review, bukan penyembunyian yang sah. Proyeksi hak terjadi di **server** (aksi tidak dirender karena tidak pernah dikirim), sesuai §9.8 butir 1, §13.5, §13.8, dan norma RBAC_MATRIX "menu & tombol yang tidak diizinkan tidak dirender" (AGENTS §3.8). Uji yang diterima: asersi bahwa kunci/aksi **tidak ada di payload** (pola DF-5), bukan bahwa tombolnya tidak terlihat di DOM.
7. **Tiga hal wajib pada setiap layar parameter: copy risiko + riwayat + dampak.** Sebuah kunci tidak boleh punya tombol simpan tanpa (a) `description` dari DB dirender **utuh** dan menyebut efek bila diubah (`DATA_MODEL §21.2` mewajibkan kalimat itu di kolomnya), (b) tautan panel riwayat §14.5, (c) tautan panel dampak §14.6. Uji komponen atas **satu** kunci kelas `SECURITY` dan **satu** baris pointer: ketiganya harus muncul, dan baris `source_of_truth <> 'PARAM'` **tidak boleh** menampilkan angka salinan (pola `RD-32`).
8. **`requires_restart = true` selalu menampilkan peringatan deviasi.** Setiap tempat yang membaca atau menyimpan kunci dengan bendera itu wajib merender `Alert tone="warning"` berisi sebab deviasi + rujukan gerbang rilis, dan memetakan `409 PARAM_RESTART_REQUIRED` (112) sebagai **"belum berlaku"**, bukan "gagal". Terukur 2026-10-20: `grep -rn "requires_restart\|requiresRestart" apps/web/src packages/contracts` = **0** → belum ada pemakai sama sekali. Karena normanya kolom itu dipaksa `false` (`DATA_MODEL §21.2`), kemunculannya di layar adalah **penyimpangan yang harus bersuara keras**, bukan keadaan normal yang boleh dirender sebagai informasi biasa.

**Enam pemeriksaan lagi yang ditambahkan pada 2026-10-20 (gelombang §17–§18).** Sama seperti enam butir sebelumnya, seluruhnya masih **norma dokumen**: `.tools/ui-guards.mjs` hari ini memuat **8 checker** (`--sica-color-`, `font-black|font-extrabold`, `gray-[0-9]00`, `bg-white`, `text-black`, hexa `#rrggbb`, `outline-none` tanpa ring, `animate-spin`) atas 87 berkas `.ts`/`.tsx` di `apps/web/src` dan **tidak** memuat satu pun pola di bawah. Tidak boleh ada dokumen atau PR yang menyebutnya "ditegakkan CI" sebelum regex-nya masuk skrip (task pemilik `.tools/`, pola `E-5`/`F-3`). Kolom terukur adalah hasil jalan 2026-10-20 dengan `grep` biasa, bukan target.

9. **Nol kartu modul tanpa `moduleCode` terdaftar.** Setiap item grid dashboard §17 wajib membawa `moduleCode` yang nilainya berasal dari **`MODULE_CODES` di `packages/contracts/src/entitlement.ts`** (19 kode) **dan** kolom `menu_items.module_code`; kartu dengan `moduleCode` di luar 19 itu, atau `null` untuk modul yang registri PRD §5.12.1 punya kode entitlement, adalah temuan. Pola pemindai: `moduleCode:` di `apps/web/src/**` dibandingkan dengan daftar 19 + `null` sah untuk gerbang peran (M-01, M-02, M-04, M-35, `APP`). Terukur 2026-10-20: `moduleCode|module_code` di `apps/web/src` = **20** kemunculan, seluruhnya di dua berkas service (`lib/entitlement.ts`, `modules/entitlement/entitlement.repository.ts`) dan **0** di lapisan tampilan; `grep moduleCode apps/web/src/app/\(dashboard\)/dashboard/page.tsx` = **0** — grid kartu §17 belum ada sama sekali, jadi gerbang ini dipasang **bersamaan** dengan layar pertamanya.
10. **Nol teks UI literal di lapisan tampilan.** Setiap string yang dirender harus lewat `t('…')`/`formatMessage` dengan kunci yang ada di `id.json` **dan** `en.json` (AGENTS §3.5). Pola pemindai yang sah: literal huruf kecil-berawalan-spasi di dalam JSX (children elemen), label `placeholder=`/`aria-label=`/`title=` yang bukan variabel, dan array string di konstanta modul; target **0** untuk berkas baru, dan **tidak naik** untuk berkas lama. Terukur 2026-10-20: `apps/web/src/app/(dashboard)/academic/khs/page.tsx:197` (`SEMESTER_OPTIONS`) dan `modules/academic/components/krs-course-picker.tsx:89` (`CLASS_STATUS_FILTER_OPTIONS`) masih menjadi dua kemunculan yang sama seperti butir 4, dan `dashboard/page.tsx` sendiri berisi judul kartu hard-coded ("Jadwal Kuliah Hari Ini" baris 146) — keduanya **utang tercatat**, bukan contoh yang boleh disalin.
11. **Nol kartu yang ditampilkan lalu dinonaktifkan.** `disabled`, `opacity-`, `pointer-events-none`, `hidden`, `sr-only` pada **kartu/CTA modul** = temuan: kartu yang tidak berhak **tidak dirender** (§17.2 vonis, §11.9 butir 6 untuk tombol). Uji yang diterima: asersi kartu **absen dari payload render** untuk peran tanpa hak, bukan asersi `aria-disabled`. Terukur 2026-10-20: 0 pemakai pada konteks kartu (grid §17 belum ada); pemeriksaan ini lahir bersama layarnya, bukan sesudahnya.
12. **Nol angka akademik dihitung di lapisan tampilan.** Pemindai `.reduce(`, `Math.sum`/penjumlahan manual, dan pembagian rasio di `apps/web/src/app/**` dan `apps/web/src/**/components/**`: target **0** untuk modul §17/§18 (ARCHITECTURE §13.2 vonis 2, PRD §5.12.2 butir c). Terukur 2026-10-20 = **1**: `apps/web/src/app/(dashboard)/academic/krs/page.tsx:93` menghitung `usedSks` dari `selected.reduce(...)` di klien. Ini **utang tercatat** yang konsisten dengan pengecualian berjangka AGENTS §3.8 (jalur KRS hari ini sinkron, `krs.service.ts:371`) — pengurangannya task bersama penyelesaian antrean, penambahannya temuan; layar baru (§17, §18) **tidak** boleh menambah instans kedua dengan dalih "meniru KRS".
13. **Nol `layout` animation pada grid real-time.** `layout=`/`layoutId=` dari framer-motion di berkas grid kartu = temuan §17.3 (kartu tidak boleh berpindah karena peristiwa tiba). Terukur 2026-10-20: `grep -rn "layout={" apps/web/src` = **0** — pemeriksaan ini menjaga keadaan yang sudah benar, bukan memperbaikinya.
14. **Nol layar §18 yang mengarang path atau `route_key`.** Setiap tautan kartu/daftar wajib menunjuk `route_key` yang terdaftar di registri kunci rute (pola §14.8.3 `MENU_ROUTE_KEY_UNKNOWN` 118), bukan string path yang dirakit di JSX (`href={`/`push(` dengan template literal). Terukur 2026-10-20: `routeKey|route_key` di `apps/web/src` = **0** kemunculan — kolom `menu_items.route_key` (DATA_MODEL §21.7) belum punya padanan di klien, jadi registri kunci rute adalah **syarat** sebelum grid §17 dan 12 blok §18 boleh dikode, bukan sesuatu yang muncul sendiri.

### 11.10 Kontras & keterbacaan (WCAG AA sebagai bagian design system, bukan audit akhir)

"Terlihat premium" tidak berarti apa-apa kalau teks 10 px tidak terbaca. Standar ini **diukur** dengan `.tools/contrast-audit.mjs` yang membaca `:root` dan `[data-theme='dark']` langsung dari `apps/web/src/app/globals.css` (berkas asal `velzon-theme.css` sudah digabung ke sana, §1.2/§11.1), menggabungkan warna translucent di atas permukaan kartu, lalu membandingkan tiap pasangan terhadap ambang WCAG (teks besar = ≥ 24 px, atau ≥ 18,66 px dengan bobot ≥ 700; selain itu **4,5:1**). Hasil terukur terbaru: **29 pasangan, FAILS = 0 pada kedua tema**.

**Aturan yang mengikat.**
1. **Teks kecil selalu ≥ 4,5:1.** Badge, eyebrow, `.section-label`, `.table-head`, `.field-hint`, `.field-error` semuanya 10–12 px, jadi tidak ada keringanan "teks besar".
2. **Aksen ≠ isian.** `--sica-primary` (`#0ab39c`) adalah warna **merek**: border, cincin fokus, chart, progres, titik status. Teks atau isian solid yang menampung teks putih memakai **`--sica-primary-solid` / `--sica-primary-ink`**. Velzon upstream menempatkan teks putih di atas `#0ab39c` (2,64:1) dan `#f06548` (3,15:1) — itu **cacat hulu**, dan SICA menyimpang darinya secara sadar. Jalur balik: cukup ganti satu variabel, lalu terima konsekuensi kontrasnya dan catat di sini.
3. **Latar `soft` punya warna teksnya sendiri.** `--sica-on-<tone>-soft` per tema. Varian `on-*` untuk isian solid **tidak** boleh dipakai di atas `soft` — angkanya jatuh.
4. **Warna tidak pernah sendirian sebagai pembawa makna.** Status memakai `StatusBadge` (label teks + bentuk), bukan hanya warna; `color-scheme` diset per tema supaya kontrol native ikut.
5. **Ulangi pengukuran setiap kali menambah token warna.** Audit adalah gerbang, bukan dokumentasi hiasan.

**Angka sebelum → sesudah (terang / gelap).**

| Pasangan | Sebelum | Sesudah |
|---|---|---|
| `.badge-soft-primary` (10 px) | 3,04 / 4,87 | **5,76 / 8,71** |
| `.badge-soft-success` | 2,39 / 4,87 | **5,76 / 8,71** |
| `.badge-soft-info` | 3,57 / 4,11 | **5,37 / 6,96** |
| `.badge-soft-warning` (`#a97a2c` hardcode) | 3,50 / 10,75 | **6,14 / 7,80** |
| `.badge-soft-danger` | 3,70 / 4,09 | **5,93 / 6,79** |
| `.eyebrow` | 3,04 | **5,76 / 8,71** |
| `.dropdown-item:hover` | 3,04 (tebal 13 px) | **5,78 / 9,63** |
| Tombol solid primary (teks putih) | 2,64 | **4,55** |
| Tombol solid danger (teks putih) | 3,15 | **4,92** |
| Tombol solid info (teks putih) | — (biru hardcode) | **4,88** |
| Tombol solid warning (gelap) | 1,68 (`--sica-on-warning` nyaris putih) | **6,66** |
| `.section-label` / `.field-hint` (`--sica-text-muted`) | 4,36 | **≥ 4,5** (#6b6f82) |
| `.table-head` (muted di atas `slate-50/85`) | 4,20 | **≥ 4,5** |
| `.field-error` (`--sica-danger-hover`) | 4,18 / 3,83 | **5,09 / 6,40** |

**Hasil akhir: 0 kegagalan dari 29 pasangan pada kedua tema.** Nilai hexares yang lahir dari audit ini (`--sica-primary-solid #078574`, `--sica-primary-ink #046c5a`, `--sica-danger-solid #c04a32`, `--sica-info-solid #1e78a8`, `--sica-danger-ink #c1442b`/`#f8826e`, tujuh `--sica-on-*-soft`) bukan selera — masing-masing adalah **titik gelap paling terang** pada hue aslinya yang masih lolos 4,5:1, sehingga identitas Velzon bertahan tanpa mengorbankan keterbacaan.

### 11.11 Penegakan Velzon vs permintaan yang masuk (vonis, 2026-10-20)

Pola bagian ini: sebuah resep datang lengkap dengan nama paket dan kelas Tailwind-nya, dan **sudah kalah** oleh keputusan yang terkunci di §1–§11 serta terbukti di kode. Vonis ditulis penuh supaya agen berikutnya tidak mengajukan ulang permintaan yang sama sebagai "peningkatan". Kedua resep di bawah diminta pengguna pada 2026-10-20 dan keduanya **DITOLAK**.

#### 11.11.1 `ApexCharts: smooth spline + gradient fill + glassmorphism tooltip` — DITOLAK

| Aspek | Kenyataan terukur | Konsekuensi |
|---|---|---|
| Dependensi | `apexcharts`, `recharts`, `echarts` tidak ada di `apps/web/package.json` maupun `package.json` root (terukur 2026-10-20: 0 kemunculan) | Memasangnya = keputusan dependensi baru, bukan keputusan desain; `TECH_CONVENTIONS §6` melarang dokumen mengklaim kemampuan yang paketnya belum ada — dan melarang pula menyisipkannya lewat catatan desain |
| Bundel | Pustaka grafik membawa ratusan kB ke jalur klien yang harus menanggung layar kerja 1.000+ pengguna serentak (AGENTS §3.7) | Anggaran bundel dibakar untuk hal yang sudah ada |
| Determinisme | Renderer pihak ketiga menyusun DOM/id sendiri per versi; id gradient dan path berubah antar rilis | Uji snapshot + golden vector jadi rapuh; primitives kita justru memakai `useId` supaya id gradient tidak bertabrakan antar-instance |
| SSR | Komponen grafik pihak ketiga wajib `client-only` | Bertabrakan dengan pola server component §4.2 |
| **Hasil visual yang diminta** | **sudah dicapai tanpa pustaka** | Empat baris di bawah |

Alasan penolakannya adalah bahwa ketiga permintaan visual itu **sudah ada** di primitif `apps/web/src/components/ui/velzon-chart.tsx` (§11.5):

1. *smooth spline* — kurva **monotone cubic Fritsch–Carlson**: halus **dan** tidak `overshoot` di luar titik data, sesuatu yang tidak dijamin spline Cardinal/Catmull-Rom bawaan pustaka;
2. *gradient fill* — isi area gradien dua stop `--sica-chart-*` dengan opasitas `0.15 → 0` (tema gelap `0.22` karena kontras); gradien **di area**, tidak pernah pada teks (§11.7 butir 2);
3. *glassmorphism tooltip* — `backdrop-filter: blur(10px) saturate(150%)` + `--sica-chart-tooltip-bg` / `--sica-chart-tooltip-border` + `shadow-dropdown`, simpul terdekat dari posisi pointer;
4. animasi render **sekali saat mount** (`stroke-dashoffset` 1100 ms) yang tunduk `prefers-reduced-motion`.

**Yang diminta → padanan yang dipakai** (kolom ketiga adalah lokasi terukur, bukan niat; resep ApexCharts di kolom kiri tidak pernah dipasang):

| Opsi ApexCharts yang diminta | Padanan yang dipakai | Lokasi terukur |
|---|---|---|
| `chart.type: "area"` + `stroke.curve: "smooth"` | kurva monotone cubic **Fritsch–Carlson** pada `<path>` SVG | `apps/web/src/components/ui/velzon-chart.tsx` (§11.5) |
| `fill: { type: "gradient", opacityFrom: 0.3, opacityTo: 0 }` | `linearGradient` dua stop `--sica-chart-*` dengan opasitas `0.15 → 0` (tema gelap `0.22`) | primitif yang sama; id gradien anti-tabrakan lewat `useId` |
| `tooltip: { enabled: true, theme: "dark" }` + gaya kaca | tooltip `backdrop-filter: blur(10px) saturate(150%)` + `--sica-chart-tooltip-bg` / `--sica-chart-tooltip-border` + `shadow-dropdown` | token di `apps/web/src/app/globals.css`, simpul terdekat dari pointer |
| `animations.enabled: true` | `stroke-dashoffset` 1100 ms + opacity area, sekali saat mount | tunduk `prefers-reduced-motion` (§7.1) |
| `noDataText`, `toolbar`, `legend` bawaan pustaka | legenda bulat kecil + label `slate-500`, sumbu `--sica-chart-grid/--sica-chart-axis`, `empty` dilayani `Skeleton`/`Alert` (§11.3) | `velzon-chart.tsx` + `skeleton.tsx` |
| dependensi `apexcharts` / `react-apexcharts` | **tidak dipasang** | `grep` di `apps/web/package.json` + `package.json` root = 0 (tabel §11.9) |

**Aturan pakai.** Butuh bentuk grafik baru (bar, stacked, donut, heatmap) → **tambah varian pada primitif SVG itu**, bukan mencari pustaka. Palet hanya `--sica-chart-1…5`; satu seri satu warna token; warna status (`danger`) tidak dipakai untuk seri netral (§11.5). Klaim seperti "pasang ApexCharts supaya premium" juga salah arah: yang premium itu **ketelitian**, bukan impornya.

**Paritas Mobile (AGENTS §3.4).** Di Flutter pun pustaka grafik tidak dipasang dan tidak diminta: terukur 2026-10-20 `fl_chart` / `syncfusion` / `graphic` di `apps/mobile/pubspec.yaml` = 0 dan `extends CustomPainter` di `apps/mobile/lib` = 0. Jadi belum ada grafik di mobile sama sekali; ketika sebuah layar mobile butuh seri visual, bentuknya adalah **`CustomPainter` baru yang memindahkan logika primitif Web** (Fritsch–Carlson + opasitas dua stop), bukan impor paket — dan itu slice kode, bukan catatan desain.

#### 11.11.2 `focus:border-blue-600 focus:ring-blue-500/10` — DITOLAK

Fokus **hanya** memakai token primary. Resep kanonik satu baris yang boleh disalin developer (keadaan diam + keadaan fokus, tanpa satu pun warna literal):

```
bg-slate-50/50 border-slate-200 rounded-xl
focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-sica-card
```

- **Kepingan yang diminta lalu dibuang: `focus:bg-white`.** Niatnya benar (isian menjadi rata dan terang saat disentuh), bentuknya salah. Di tema gelap `bg-white` mengunci panel putih di atas kanvas gelap — itulah §11.7 butir 4, dan §11.9 mengukurnya sebagai **utang tercatat** (6 `bg-white` + 1 `text-black` yang tidak boleh bertambah). Padanan bertema-sadar dari utilitas yang sama: `focus:bg-sica-card` → `var(--sica-surface-card)` = `#ffffff` di tema terang dan `#1e2227` di tema gelap (terukur di `apps/web/src/app/globals.css` baris 127 & 251). Satu kelas menggantikan dua keadaan, jadi tidak ada `dark:` yang perlu dirangkai (§11.1).
- `blue-600` (`#2563eb`) **bukan** bagian design system SICA dan tidak dipetakan di `apps/web/tailwind.config.ts`. Menuliskannya berarti membuat **sumber kebenaran warna kedua** di luar `globals.css` (§11.1) — persis penyebab "AI look" yang sudah dibongkar (§11.7 butir 1–2), dan persis yang sudah dikoreksi pada siklus refactor login (§2.0 butir primary hijau).
- Bentuk kanonik di CSS hari ini (terukur `globals.css` baris 694–699): `.velzon-input:focus-visible, .velzon-input:focus { background-color: var(--sica-surface-card); border-color: var(--sica-primary); box-shadow: var(--sica-shadow-focus) }`, dengan keadaan diam baris 676–688 = latar `rgb(var(--sica-rgb-slate-50) / 0.5)`, border `rgb(var(--sica-rgb-slate-200) / 0.9)`, radius `var(--sica-radius-lg)` = **12 px** (= `rounded-xl` pada skala Tailwind). Resep utilitas di atas hanyalah proyeksi keadaan itu; kalau `.velzon-input` sudah menangani fokus, layar **tidak** menambahkan kelas fokus sendiri — butuh bentuk lain berarti minta varian ke primitif, bukan menulis kelas lokal (§2.0).
- `--sica-shadow-focus: 0 0 0 4px var(--sica-ring)` dan `--sica-ring: rgb(var(--sica-rgb-primary) / 0.16)`; `focus:ring-primary/10` setara secara visual untuk mata, **tetapi alpha tidak boleh dikarang per layar** — lewat CSS pakai `--sica-ring`, lewat utilitas pakai nilai yang sudah dipakai primitif (`ring-4 ring-primary/15` di `button.tsx`, §11.3). Memilih satu dan konsisten itu wajib; memilih angka baru di layar ketiga itu temuan review.
- Biru `#299cdb` tetap tinggal **hanya** sebagai aksen `info` (§1.1): bukan untuk fokus, border, tombol primer, atau seri grafik netral.
- Yang **tidak** berubah karena aturan ini: kontras. Cincin fokus adalah objek non-teks (ambang 3:1 terhadap latar), dan teks kecil tetap 4,5:1 (§11.10).

**Garis larangan yang dapat dipindai.** Empat pola dijalankan di `apps/web/src` (`.tsx`/`.ts`); target seluruhnya **0** dan kolom terukur adalah hasil jalan 2026-10-20 (tabel §11.9), bukan target:

```
blue-[0-9]00 | indigo-[0-9]00 | sky-[0-9]00 | violet-[0-9]00 | purple-[0-9]00   target 0  terukur 0
(font varian focus: dan hover: ikut tercakup oleh pola di atas)
font-black | font-extrabold                                                     target 0  terukur 0
var(--sica-color- | --sica-color-            (alias lama)                       target 0  terukur 0
hexa / rgb() / nama warna di dalam components/ui/**                              target 0  terukur 0
```

Butir keempat punya arti yang ketat dan bukan kiasan: **keputusan warna hanya ada di design token**. Di dalam `apps/web/src/components/ui/**` tidak boleh ada satu pun hexa, `rgb()` literal, atau kelas warna bernomor; primitif hanya menyebut nama semantik (`primary`, `slate-*`) atau variabel token. 18 kemunculan hexa yang terukur hari ini seluruhnya berada **di luar** primitif (`pdf-generator.service.ts` 8, `login-form.tsx` 8, `layout.tsx` 1, `top-nav.tsx` 1) dan dicatat sebagai utang — pengurangannya task, penambahannya temuan.

Tolok ukurnya sederhana: **satu-satunya warna yang boleh disebut namanya di komponen adalah nama semantik Velzon** (`primary`, `secondary`, `success`, `info`, `warning`, `danger`, `slate`). Sebut nama warna dasar (biru/ungu/hijau) di kelas = tanda bahwa token sedang dilewati.

---

## 12. Pola layar engine (ALG-8…ALG-14) — spesifikasi UI, 2026-10-20

> **Dasar & pemilikan.** Mekanika engine (algoritma, *budget*, mode turun) = [ARCHITECTURE.md §11–§12](file:///c:/SICA/docs/ARCHITECTURE.md); objek & kolom = [DATA_MODEL.md §17–§18](file:///c:/SICA/docs/DATA_MODEL.md); path & kode error = [API_SPEC.md §6 + §2.3](file:///c:/SICA/docs/API_SPEC.md); kode izin = [RBAC_MATRIX.md §4.5](file:///c:/SICA/docs/RBAC_MATRIX.md). Bagian ini **hanya** menetapkan yang dilihat dan ditekan pengguna: komponen, state, copy, aksesibilitas. Nomor layar di bawah adalah yang dirujuk ARCHITECTURE §12 ("pola layar = UI_UX_DESIGN §12").
>
> **Status: spesifikasi.** Terukur 2026-10-20, `grep -r "engine" apps/web/src/app/api` = 0 dan namespace `engine.*` belum ada di `src/locales/*.json`. Tidak satu pun layar di bawah boleh disebut "sudah dibangun".

### 12.0 Enam prinsip yang berlaku di semua pola

1. **Angka tanpa konteks adalah kebohongan.** Setiap angka engine tampil bersama **penyebut** (`n`), **`coverage`** atau **batas bawah**, dan **bendera `degraded`** bila ada. Yang tidak lengkap dikirim sebagai temuan, bukan sebagai kemenangan (§12.2, §12.4).
2. **Mesin mengusulkan, manusia menyetujui.** Tidak ada tombol engine yang menulis record resmi. Penerapan selalu `VALIDATE` (verba, bukan nama izin) lewat service domain yang sudah ada; keluaran engine berstatus **draf** sampai itu terjadi (AGENTS §3.9).
3. **Masking menu di UI bukan kontrol akses.** Menyembunyikan tab "Jadwal Otomatis" tidak menegakkan apa pun. Gerbang server (§3.8 AGENTS: identitas dari token, izin dari tabel penugasan, `withModule`, state, RLS) tetap wajib; UI hanya **mempercepat** pengguna yang berhak, dan harus tetap benar kalau URL dibuka langsung.
4. **DILARANG spinner tanpa angka.** Proses engine tidak pernah ditandai dengan lingkaran berputar tanpa informasi (ini juga larangan umum §11.7 butir 5). Yang ada adalah **kartu progres beraangka** §12.1.
5. **Copy jujur di depan.** Ketika data prasyarat belum ada, layar **tidak** boleh tampil meyakinkan. Kalimat penjelas lebih prioritas daripada memperindah angka.
6. **Resep tetap resep.** Aturan verifikasi presensi (radius, ambang akurasi, `windowIndex`, bobot `fraud_score_bp`) tidak ditampilkan kepada pihak yang sedang diuji (§10.0.2); bahan review operator justru **boleh** melihat skor & margin karena keputusan ada di tangannya (§12.3).

### 12.1 Pemanggilan engine: tombol → `202 { runId }` → kartu progres

**Alur.** `Button` (varian `default`, label aksi + ikon lucide) → `POST …/runs` dengan `Idempotency-Key` terikat ke percobaan itu → `202 { runId, status:"QUEUED", engineVersion, parameterVersion, inputSnapshotHash, budget, pollAfterMs }` → kartu progres menggantikan area hasil. Tombol menjadi `disabled` dengan label berganti ("Meminta hasil…") selama permintaan belum dijawab — **tidak** memakai spinner, dan penekanan ulang memakai kunci yang sama sehingga tidak menghasilkan *run* kedua.

```
┌─ Penjadwalan otomatis · run 0196e2b7 ──────────────────────────────┐
│ Status: QUEUED · antrian ke-3 dari 5 · menunggu 04 s               │
│ ████████░░░░░░░░░░░░  node 1.240 / maks 200.000 · 08 dari 30 s     │
│ engine 1.0.0 · parameter academic_rules#timetable/2026.02          │
│ snapshot sha256:9f1c…                                              │
│ [Batalkan run]                                                     │
└────────────────────────────────────────────────────────────────────┘
```

**Isi wajib kartu.** Nama *run* + `runId` pendek (boleh disalin), status dari enum kanonik `QUEUED/RUNNING/SUCCEEDED/FAILED/CANCELLED/NEEDS_REVIEW` sebagai `Badge` (teks + ikon, bukan warna saja), **posisi antrian**, waktu berjalan, pemakaian *budget* (`nodesVisited` / `maxNodes`, detik / `maxSeconds`), `engineVersion` + `parameterVersion` + `inputSnapshotHash` dipotong (footer `text-xs`), dan tombol `Batalkan` (`variant="outline"`, aksi `cancel`, terisi hanya selama non-terminal).

**Progres: SSE dengan polling sebagai fallback.** SSE adalah **kenyamanan**, polling `GET …/runs/{runId}` adalah **sumber kebenaran** (API_SPEC §6.2 butir 2):

- klien membuka stream, dan pada setiap event menyimpan `id` terakhir; reconnect memakai `Last-Event-ID`;
- **`Retry-After` adalah interval pertama, bukan tebakan klien.** Setiap `202` engine mengirim `Location` + `Retry-After` (1..30 detik, API_SPEC §6.2), dan `429`/`503` ikut mengirimnya; klien memakainya sebagai jeda poll awal, lalu `pollAfterMs` dari body sebagai pembaruan, baru *backoff* — urutan itu tidak boleh dibalik dan tidak boleh ada konstanta interval di JSX;
- stream terputus, diam > 2 × `pollAfterMs`, atau `readyState` tidak normal → **jatuh ke polling** dengan interval di atas dan *backoff* ke plafon 30 s; polling berhenti begitu status terminal tiba;
- **tidak boleh** menyimpulkan sukses dari hilangnya event: tanpa status terminal, klien membaca respons `GET` otoritatif (pola yang sama API_SPEC §4.2.12 untuk `krs/stream`);
- tab tidak aktif → polling ditahan, disambung lagi saat `visibilitychange`;
- **angka posisi antrian wajib datang dari server.** Kontrak §6.2 hari ini belum menerbitkan field posisi; sampai ia ada (keputusan `E-1`), kartu menampilkan status + waktu berjalan + `pollAfterMs` dan **tidak mengarang** "antrian ke-N". Mengarangnya = melanggar prinsip 1.

**State.** `loading` = kartu progres itu sendiri (bukan `Skeleton` penuh, karena ada angka yang hidup); `empty` = belum ada *run* → `EmptyState` dengan penjelasan engine ini menghitung apa dan data apa yang dibutuhkan lebih dulu; `error` = pemetaan kode §2.3 ke pesan + remedi (tabel di bawah); `degraded` = hasil tiba dengan bendera → §12.2.

| Respons | Yang dirender | Aksi yang ditawarkan |
|---|---|---|
| `422 ENGINE_BUDGET_EXCEEDED` | `Alert tone="warning"` + `stats.nodesVisited` yang tetap dikirim | naikkan *budget* (butuh peran berhak) atau perkecil cakupan *run* |
| `409 ENGINE_STALE_SNAPSHOT` | `Alert tone="warning"` "data berubah setelah run selesai" | jalankan ulang; **jangan** tawarkan `apply` |
| `409 ENGINE_RUN_NOT_APPLICABLE` | chip status + sebab dari server | tunggu status sukses / buka periode |
| `403 FORBIDDEN` | baris "siapa pemegang hak berikutnya" (§9.8 butir 2), bukan 403 telanjang | ajukan permintaan |
| `404 MODULE_NOT_AVAILABLE` | menu tidak dirender; akses langsung → halaman "modul belum aktif" dengan tautan langganan | — |

**Aksesibilitas.** Kartu = `Card` dengan `role="status" aria-live="polite"`; yang diumumkan **hanya** perubahan status dan pencapaian angka penting (selesai / gagal / parsial), bukan setiap tick — angka ticker `aria-hidden="true"` dan di-*tick* visual saja; judul kartu menjadi `aria-labelledby`; target sentuh `Batalkan` ≥ 44 px; `prefers-reduced-motion` mematikan sapuan bar tetapi **tidak** menghilangkan angkanya.

### 12.2 Lencana `degraded` — copy yang jujur per bendera

Satu lencana per *run* (di header hasil) dan satu baris penjelas di bawah angka yang dipengaruhi. `Badge` `look="soft"` `tone="warning"` (bukan `danger`: ini keterbatasan data, bukan kegagalan sistem) + ikon + **teks**, tidak pernah warna saja (§10.7). Nilai bendera milik ARCHITECTURE §12; bagian ini memiliki **kalimatnya**.

| Bendera | Layar | Copy Indonesia (kunci `engine.degraded.*`) | Yang **tidak** boleh dirender |
|---|---|---|---|
| `NO_PREREQ_DATA` | ALG-1/ALG-9 | "Graf prasyarat belum diisi, jadi jalur dihitung tanpanya. Estimasi bisa lebih optimistis daripada kenyataannya." | angka semester lulus tanpa catatan; status "aman" |
| `PARTIAL_BUDGET_EXHAUSTED` | ALG-8/ALG-2 | "Pencarian berhenti pada batas {maxSeconds} s. {unscheduled} permintaan belum terjadwal — ini draf parsial, bukan jadwal selesai." | label "selesai"/"sukses"; jadwal parsial yang tampil penuh |
| `MODEL_STALE` | ALG-10 | "Perbedaan distribusi data model ({psi}) melewati ambang. Skor ini peringatan dini, bukan dasar keputusan; pelatihan ulang perlu disahkan." | tombol apa pun yang mengubah status akademik |
| `NO_ATTENDANCE_FEED` | ALG-10 | "Kehadiran belum masuk ke fitur risiko, jadi komponennya **tidak dihitung** — bukan dihitung nol." | kontribusi kehadiran bernilai 0 |
| `NO_INDICATOR_DATA` | ALG-13 | "Rubrik/indikator penilaian belum lengkap. Capaian belum dapat dihitung; yang ada baru {n_evaluated} dari {n_enrolled} mahasiswa." | angka capaian; "capaian 0" |
| `NO_LECTURER_AVAILABILITY` | ALG-8 | "Ketersediaan harian pengampu belum diisi, jadi hanya bentrok antar-sesi yang diperiksa." | klaim kendala H-3 ditegakkan |
| `LOW_SAMPLE` | ALG-9/ALG-13 | "Sampel komponen ini {n}, di bawah minimum — peringkatnya tidak dipakai untuk menyimpulkan." | peringkat yang tampil setara data lengkap |

**Tiga aturan turunan.** (1) Saat bendera terpasang, angka utama dirender **teredam** (`text-muted`) atau `—` bila angka itu sendiri tidak berarti, dengan penjelas di bawahnya — tidak pernah angka penuh percaya-diri plus catatan kecil yang mudah terlewat. (2) Lencana wajib punya tautan **sebab → tempat perbaikan** yang kanonik (satu jalur per objek, §9.1.1): "isi graf prasyarat", "lengkapi rubrik indikator". (3) Rekap *run* yang sama tidak boleh memanggil dirinya "SUCCEEDED" tanpa menyebut benderanya: `SUCCEEDED` + `degraded` = **sukses dengan catatan**, dan catatan itu ikut di ekspor/PDF.

**Aksesibilitas.** Lencana dieja teks (`aria-label` penuh: "Peringatan: data prasyarat belum ada"), kontras AA di dua tema (`warning` emas **tidak** dipakai sebagai teks di latar putih — §10.7), dan penjelas terhubung ke lencana dengan `aria-describedby`.

### 12.3 Antrean review untuk keluaran `proposal_only`

Dipakai ALG-11 (Feeder *auto-fix*) dan bentuk yang sama untuk ALG-4/ALG-7. Prinsip: **usulan tidak pernah diam-diam menjadi nilai**.

**Tata letak.** `Card` header berisi ringkasan tiga tingkat + filter tab per tingkat (angka pada label tab), `VelzonDataGrid` baris usulan, dan `Drawer` kanan per baris (satu drawer, tanpa modal bertumpuk §9.7). Toolbar kiri = aksi massal §12.3.3; kanan = Ekspor (butuh peran berhak).

**Tiga tingkat keyakinan (§12.3.1).** Pembedanya **bukan skor mentah**, melainkan skor **dan** selisih ke kandidat kedua — karena itu keduanya wajib terlihat.

| Tingkat | Kapan | Yang dirender | Hak bertindak |
|---|---|---|---|
| `AUTO` | skor tinggi **dan** margin tebal **dan** tepat satu kandidat | bar margin penuh, diff siap, checkbox **tercentang tapi belum diterapkan** | masuk kelompok "Terapkan semua FORMAT" hanya bila `kind` = FORMAT |
| `REVIEW` | skor menengah **atau** margin tipis | kandidat 1…3 sebagai radio, masing-masing dengan skor + margin + nilai aslinya; pilihan eksplisit **"Tidak cocok"** | keputusan manusia wajib; tanpa pilihan, baris tidak bisa disahkan |
| `NO_MATCH` | di bawah ambang **atau** multi-kandidat setara | kolom tujuan **kosong** + tautan bukti + `Input` pencarian manual | tidak ada nilai yang diusulkan; mengosongkan adalah jawaban yang sah |

**Bar margin.** Garis horizontal dua segmen dalam `ProgressStack`: segmen pertama = skor (0–1), segmen kedua = margin ke kandidat kedua, dengan penanda ambang. Fungsinya: dua baris sama-sama 0,93 terlihat berbeda kalau marginnya 0,22 vs 0,02. `role="img"` + `aria-label` yang menyebut kedua angka, dan **teks** angka di sebelahnya (bar tidak pernah sendirian).

```
nama_feeder   ± bar margin 0.93 / margin 0.02   sebelum: "Rahmat  Hidayat "  sesudah: "Rahmat Hidayat"
```

**Diff per kolom (`before → after`).** Satu baris diff per **kolom** yang berubah, bukan per record: nilai lama `strikethrough` redup, nilai baru `tone="success"`, karakter ruang/kontrol yang hilang ditandai dengan simbol tampak (`␣` untuk spasi ganda, `⏎` untuk karakter kontrol) supaya "perubahan tak terlihat" tetap terlihat. Diff memakai `.tabular`/mono untuk kolom berkode (NIK, NIM, `id_reg`). **Dilarang** merender hanya nilai baru. Aturan khusus: perubahan yang menyentuh **identitas** (nama, tanggal lahir, NIK) tidak pernah bisa disahkan dari tingkat `AUTO` — ia didorong ke `REVIEW` apa pun skornya.

**Aksi "Terapkan semua FORMAT".** Tombol `variant="soft"` `tone="success"` dengan **angka dampak** sebelum bisa ditekan, dibuka lewat `ConfirmDialog` (§11.3):

```
Terapkan 148 perbaikan FORMAT pada 62 baris.
Bukan bagian ini: 12 ENRICH, 5 IDENTITY, 9 SEMANTIC, 3 BLOCKING (tetap perlu keputusan Anda).
Perubahan dapat dibalik per baris dan tercatat atas nama Anda.
```

Jaminan UI yang harus ada: (1) hanya `kind = FORMAT` yang tersapu — `ENRICH`, `IDENTITY`, `SEMANTIC`, `BLOCKING` **tidak pernah** ikut tombol ini; (2) hasil = toast Sonner + ringkasan `{diterapkan, dilewati, gagal}` dengan satu baris per sebab (§9.4), bukan "sukses" saja; (3) baris yang diterapkan **tetap tinggal** di antrean dengan status "Diterapkan" + `applied_by` + waktu — antrean ini adalah catatan, bukan tempat sampah; (4) setiap baris tunggal punya "batalkan", dan pengulangan *run* tidak menggandakan perbaikan (kunci idempoten per `(run, record, aturan)` — mekanikanya milik API_SPEC/DATA_MODEL); (5) gerbang kirim Feeder tetap **dua orang** dan UI tidak pernah menampilkan tombol "setujui" untuk permintaan sendiri (§9.7 butir empat-mata).

**State.** `loading` = `Skeleton.Table`; `empty` = "Tidak ada usulan — data sudah lolos aturan" (bukan "error"); `error` = kode §2.3 dengan tautan ke baris penyebab; `degraded` = bendera §12.2 di header (mis. aturan kamus kedaluwarsa → antrean tidak boleh dibuka untuk penerapan).

**Aksesibilitas.** Kotak centang per baris `aria-label` lengkap ("Pilih perbaikan nama baris 14"), diff tidak boleh bermakna warna saja (ikon `−`/`+` + teks), tab filter memakai pola `Tabs` yang dapat dibuka dengan panah, target sentuh 44 px, dan seluruh copy lewat `engine.review.*` (§12.11) — bukan string di JSX.

### 12.4 Kartu penjelasan lintas-engine: penyebab, penyebut, batas bawah

Aturan umum yang dipakai ALG-9, ALG-10 (§12.6) dan ALG-13 (§12.8): **lencana/kartu menampilkan penyebab, bukan hanya skor.**

- **TOP-3 faktor wajib ikut.** Setiap skor membawa sampai tiga faktor kontribusi, masing-masing dengan arah (mendorong naik/turun) dan nilai mentahnya ("kehadiran 68 % dari 12 sesi", bukan "kehadiran rendah"). Untuk model linier kontribusinya eksak; untuk pohon dangkal jalurnya ditampilkan. Kalau engine tidak mengembalikan faktor, angkanya **tidak** ditampilkan sebagai kesimpulan.
- **Penyebut selalu tampil.** `n_evaluated / n_enrolled`, `n_train`, `auc`, `brier` pada model — di footer kartu (`text-xs`), bukan disembunyikan di tooltip. Angka tanpa `n` adalah temuan review.
- **Batas bawah, bukan klaim optimum.** Biaya/estimasi selalu berpasangan ("biaya lunak 1.240 · batas bawah 1.180"). Kata "optimal" dilarang; yang boleh "terbaik yang ditemukan dalam *budget*".
- **Pratinjau vs resmi.** Angka dari `what-if`/simulasi diberi pita `Badge tone="secondary"` "Simulasi" — tidak pernah tampil seperti record resmi.
- **A11y.** Faktor dirender sebagai daftar (bukan grafik saja) agar dapat dibaca alat baca; ikon arah + teks, kontras AA dua tema; `aria-describedby` dari `Field` dipakai bila kartu berisi masukan.

### 12.5 Papan jadwal ALG-8 (Smart Timetabling)

**Struktur.** Grid **hari × slot jam** (`time_slots` sebagai baris, hari sebagai kolom). Sisi kanan: panel temuan (inti konflik, kendala yang tidak ditegakkan, biaya lunak + batas bawah). Di atas grid: strip konteks periode + *run* aktif + tombol `Terapkan draf` dan `Jalankan ulang`.

```
          08:00        10:00        12:00        14:00        16:00
SEN  [IF201-B ▓1]   [empty]      [CHM102-A ▓3]  [LAB-K1 ▓5]  [empty]
RAB  [IF201-B ▓1] ⚠ BENTROK: ruang LAB-K1 dipakai MKS103-C pada slot yang sama
```

**Aturan sel.** Satu sesi = satu kartu `Card` kompak (kode MK, kelas, ruang, pengampu) dengan **latar** dari `--sica-chart-1…5` per **jenis kegiatan** (teori/laboratorium/seminar/praktikum) plus **label teks** jenisnya — warna tidak pernah sendirian (§10.7). Dua kartu bersebelahan tidak boleh memakai teal yang identik (§11.5).

**Bentrok ditandai `EXCLUDE`, bukan dinormalisasi.** Pelanggaran kendala keras (irisan `int4range`) diberi garis luar `danger` + badge `BENTROK` + ikon, dan **sel-nya tetap terbaca isinya**. Tidak ada kartu yang dihapus diam-diam: menghilangkan bentrok dari layar sama dengan menghilangkan buktinya.

**Inti konflik ditampilkan sebagai daftar.** Kalau *run* tidak menemukan solusi, panel **tidak** berhenti di "tidak ada slot". Isinya dari `explain.conflictCore`: daftar permintaan × kendala yang saling menutup (mis. "IF201-B butuh 48 kursi; tiga ruang tersisa berkapasitas 40"), masing-masing dengan tautan ke **satu** jalur perbaikan kanonik (kapasitas ruang, ketersediaan pengampu, prasyarat ruangan). Permintaan `UNFEASIBLE_REQUEST` dari tahap propagasi masuk daftar yang sama dengan alasan unarinya — ini jawaban, bukan kegagalan.

**Terapkan draf = `VALIDATE` dua orang.** Tombol hanya aktif bila hasil tidak `PARTIAL` tanpa persetujuan eksplisit; dialog konfirmasi berisi angka dampak ("terjadwal 118 dari 120 permintaan · 2 dipindah dari semester lalu"); pasca-klik status strip menjadi `PENDING` dan **pemohon tidak melihat tombol sahkan untuk permintaannya sendiri**. Penulisan ke `class_schedules` terjadi di service domain dengan penjaga penuh; UI tidak pernah mengklaim "jadwal tersimpan" sebelum respons.

**State.** `loading` = grid `Skeleton` 5 × 8 sel; `empty` = "Belum ada permintaan terjadwal — impor distribusi kelas lebih dulu" + tautan; `error` = pemetaan §12.1; `degraded` = bendera §12.2 di header + daftar kendala yang **tidak ditegakkan** (H-4/H-5 tanpa data) yang dirender sebagai peringatan terbuka, bukan hilangnya kotak centang.

**Aksesibilitas.** Papan sebagai tabel dengan `caption` + kepala baris/kolom (`scope`), navigasi panah antar sel, setiap sel punya teks lengkap ("Senin 08:00, IF201 kelas B, ruang LAB-K1") sehingga pembaca layar tidak bergantung pada posisi warna; alternatif **tanpa seret** wajib ada: aksi "pindahkan" lewat `Dropdown` per kartu dengan pemilihan slot (seret mouse hanya kenyamanan); target sentuh ≥ 44 px; `prefers-reduced-motion` mematikan animasi kartu berpindah, bukan informasinya.

### 12.6 Papan risiko EWS (ALG-10)

**Kartu risiko** satu per mahasiswa, lima wajib: pita band (rendah/sedang/tinggi) sebagai `Badge`, **skor hanya bila gerbang mutu model tercapai**, TOP-3 faktor (§12.4), **penyebut `n`** (`n_scored / n_enrolled` Kohort, `.tabular`) dan **`coverage`** Kohort/program studi yang sama sebagai `ProgressStack` dua segmen, lalu versi model + `psi` di footer. `coverage` **tidak pernah** pindah ke tab lain atau ke tooltip: angka risiko 0,82 dengan `coverage` 0,35 adalah temuan, bukan prestasi (aturan yang sama §12.8 untuk OBE). Baris penutup selalu ada:

> `engine.ews.disclaimer` — "Ini peringatan untuk pencegahan. Bukan keputusan, bukan sanksi, dan tidak mengubah status akademik."

**Yang dilarang keras di layar ini.** Tidak ada kontrol apa pun yang menyentuh `students.status_akademik`, gerbang KRS, cekal, atau tagihan. Aksi yang tersedia hanya: melihat detail faktor, membuka riwayat temuan mahasiswa itu, dan **mencatat tindak lanjut** pada alur `study_warnings` (`OPEN → CONTACTED → RESOLVED / ESCALATED`) yang memang milik peran tersebut. Tombol "aktifkan cekal" atau "kunci KRS" di sini adalah temuan keamanan, bukan fitur.

**Saat gerbang mutu tidak tercapai** layar berubah bentuk, bukan berpakaian: tanpa kata "prediksi" dan tanpa skor — hanya daftar **aturan keras** yang terpenuhi ("kehadiran di bawah 75 %", "KRS kosong 2 periode", "tunggakan > 30 hari", "delta IPK −0,35") sebagai temuan. Ini alasan `MODEL_STALE`/ambang tidak lolos ada di §12.2: kampus tidak boleh mendapat angka yang tampak meyakinkan padahal tidak lebih baik dari tebakan.

**Privasi.** Hak baca = wali yang ditugaskan, BAAK scoped, dan mahasiswa sendiri; proyeksi dilakukan server (§9.8 butir 1). Peran tanpa hak melihat `—` dan sebab, bukan `•••` untuk angka yang memang tidak pernah dikirim.

**State & a11y.** `loading` = `Skeleton.Stats`; `empty` = "Belum ada temuan pada periode ini" + tanggal *run* terakhir ( kosong ≠ tidak dihitung ); `error` = pemetaan §12.1; `degraded` = bendera §12.2 di header papan. Band conveyed dengan ikon + teks, kontras AA dua tema, sorter kolom aksesibel keyboard.

### 12.7 Presensi ALG-12 (QR berotasi + tantangan + sinyal perangkat)

Lanjutan langsung §10.1/§10.2; yang baru di sini adalah **tantang-balas 6 digit** dan skor kecurangan (mekanikanya ARCHITECTURE §12.7). Copy vonis tetap netral sesuai §1.2/§7 — vonis bukan vonis moral.

**Layar dosen (Web).** Pita QR berotasi (§10.1) + **panel tantangan**: nomor tantangan ke-{round}, enam digit `tabular-nums` 40 px, cincin hitung mundur (umur dibaca dari server, target 5 s), dan catatan bahwa tantangan berikutnya otomatis berganti. Di bawahnya hitungan: `HADIR n` · `TERTAHAN n` · `BELUM n` (§10.1) + **hitungan pemindahan**: `DITOLAK·GANDA n` (nonce/`counter` sudah dipakai) dan chip `ANOMALY_IMPOSSIBLE_TRAVEL` per baris roster bila ada. Semua chip dapat ditekan → `Drawer` roster ter-filter. QR dan tantangan **tidak pernah** masuk payload yang bisa di-*screenshot* mahasiswa (prinsip §10.0.3).

**Layar mahasiswa (Flutter).** Tiga langkah, satu aksi berikutnya di tiap langkah:

1. **Pindai** — kamera + garis laser (§3.5, §10.2).
2. **Masukkan tantangan** — `Field` + `Input` `inputmode="numeric"` `autocomplete="one-time-code"` `maxlength=6`, 6 kotak digit; **`aria-invalid` + `aria-describedby` diwarisi dari `Field`** (§11.3) dengan pesan `"Enam digit di layar dosen sudah berganti. Pindai ulang."`; sisa waktu 15 s ditampilkan sebagai angka; salah = field `invalid` merah + sebab, tanpa membocorkan mengapa tantangan itu sah.
3. **Vonis** — chip status kanonik (§10.2) + waktu + kelas/pertemuan + hasil lokasi dalam bentuk **keputusan** ("di dalam area", "akurasi belum cukup, ulangi") + **jarak & akurasi miliknya sendiri** + **satu aksi berikutnya** (`Ajukan banding` / `Tandai ke dosen`). `fraud_score_bp` **tidak pernah** ditampilkan kepada mahasiswa; `PENDING_REVIEW` diterjemahkan jadi "perlu diperiksa pengampu kelas Anda" + hak banding; `REJECTED_FRAUD_SUSPECT` memakai `tone="danger"` dengan sebab umum, bukan flag mana yang menyala.

**Degraded.** `503` (sekali-pakai/kunci tidak terjangkau) = **presensi ditolak**, dan layar harus mengatakannya apa adanya: "Pencatatan sedang tidak dapat dipastikan. Coba lagi beberapa saat." — tidak pernah tombol "simpan lokal dan anggap hadir". Antrian offline mengikuti §10.8 butir 3 (bahan tertahan, bukan vonis).

**Aksesibilitas.** Tantangan tersedia juga dalam bentuk teks yang dapat disalin/`aria-live="polite"` satu kali saat berganti (bukan tiap detik), ticker `aria-hidden`, `role="alert"` hanya pada vonis akhir, target sentuh 44 dp, kontras AA dua tema, `prefers-reduced-motion` mematikan laser dan sapuan cincin.

### 12.8 Papan capaian OBE (ALG-13)

**Drill-down tujuh tingkat, satu arah breadcrumb:** universitas → prodi → matakuliah → CPL → indikator → item penilaian → sampel mahasiswa. Setiap tingkat adalah baris `VelzonDataGrid` yang menautkan ke tingkat berikutnya (deep-link `?cpl=…&mk=…`), dengan `PageHeader` breadcrumb yang bisa diklik mundur — bukan tombol "kembali" buta. Angka di tingkat atas **tidak pernah** dirender tanpa jejak turunnya.

**`coverage` selalu berdampingan dengan capaian.** Aturan tata letak: satu kartu = capaian (besar) + `coverage = n_evaluated / n_enrolled` (setara secara visual, `ProgressStack` dua segmen) + `n_missing_evidence`. Capaian 0,85 dengan `coverage` 0,40 dirender sebagai **temuan** (badge `warning` "cakupan rendah"), bukan sebagai prestasi. Rumus dan penyebutnya milik ARCHITECTURE §12.8; **tata letaknya milik bagian ini**, dan ia tidak boleh memisahkan keduanya ke tab berbeda.

**Kartu loop tertutup.** Per `(kurikulum, CPL, angkatan)` satu kartu lima kolom yang seluruhnya tertanggal:

```
target 7.000 bp → capaian 6.320 bp → gap −680 bp → tindakan (disahkan Kaprodi 12 Sep) → siklus berikut 6.910 bp
```

`OBE_TARGET_MISSED` membuka usulan tindak lanjut yang **terikat ke objek penyebab** (matakuliah/indikator, contoh: "CPL-4 rendah pada Sub-CPMK 2 karena indikator laporan hanya punya 12 sampel") — bukan kalimat umum. Pengesahan = `VALIDATE` dengan empat-mata; efeknya dipantau di siklus berikutnya dan kartu menampilkan perbandingan otomatis `sebelum → sesudah`.

**Angka turunan tidak dapat diketik.** Kolom capaian dirender `readonly` dengan tooltip "koreksi = hitung ulang, bukan ketik ulang"; yang boleh disunting hanya **parameter** (bobot, target) dan itu lewat wizard dengan diff + empat-mata (§9.3 gugus E). `422 WEIGHT_SUM_NOT_100` ditempel **di bawah baris matriks** yang jumlahnya tidak menutup (via `Field` error), bukan sebagai toast.

**State.** `loading` = `Skeleton.Stats` + `Skeleton.Table`; `empty` = "Rubrik/indikator belum diisi" → tautan ke pengisian indikator (jangan tampilkan capaian 0); `error` = §12.1; `degraded` = `NO_INDICATOR_DATA` ( §12.2 ) dan `LOW_SAMPLE` per baris.

**Aksesibilitas.** Semua angka `.tabular`; bar capaian + coverage punya `aria-label` bernilai; breadcrumb `nav aria-label="Drill-down capaian"`; warna + teks; kontras AA dua tema (khususnya `warning` emas); target sentuh 44 px.

### 12.9 Panel verifier rantai audit (ALG-14)

**Isi panel** (hanya-baca, peran auditor/internal):

- satu **status besar**: `VERIFIED` (`tone="success"` + ikon centang) atau `COMPROMISED` (`tone="danger"` + ikon peringatan) — tidak ada status ketiga, tidak ada "hampir bersih";
- cakupan verifikasi: partisi/stream yang diperiksa, jumlah daun, `head_seq` + `head_hash` terpotong dengan tombol salin (`aria-label` "salin hash"), `sealed_at` jangkar terakhir, kapan verifier dijalankan oleh siapa;
- daftar temuan bila ada: `CHAIN_GAP` (celah `seq`), `CHAIN_BRANCH` (`prev_hash` tidak cocok), `HASH_MISMATCH` (isi diubah) — masing-masing dengan stream, `seq`, dan tautan ke baris auditnya;
- **alarm**: `COMPROMISED` menaikkan `Alert tone="danger"` di header dan menandai partisi **hanya-baca** di seluruh layar (banner "partisi dibekukan"), dengan tautan ke prosedur insiden.

**Tidak ada satu pun tombol "perbaiki hash" di UI mana pun.** Tidak "sinkronkan ulang", "rebuild chain", "normalisasi", "tandai aman". Menghitung ulang hash adalah bentuk pemalsuan yang ingin dideteksi; prosedurnya membekukan partisi, menandai `compromised_at`, menginvestigasi, dan melaporkan — bukan membuat angka hijau kembali. Ini larangan desain yang mengikat: penemunya di review = tolak.

**Detail baris nilai.** Diff `old → new` (huruf/poin/status), `actor`, `occurred_at`, `ip`, `reason` (wajib terisi), `approved_by` dengan penanda SoD bila `approved_by === actor` (harus mustahil, dan kalau muncul ia temuan, bukan data), `request_id`, dan hash baris + hash sebelumnya.

**Aksesibilitas.** Hash = mono, terpotong dengan teks lengkap di `title` dan tombol salin ber-`aria-label`; status conveyed dengan ikon + teks; tabel temuan sortable keyboard; kontras AA dua tema; target sentuh 44 px; panel tidak memakai `aria-live` (statis) agar tidak berbicara sendiri.

### 12.10 Matriks komponen, state, dan aksesibilitas per pola

| Pola | Primitif yang dipakai | State wajib | Aksesibilitas kunci |
|---|---|---|---|
| Pemanggilan engine §12.1 | `Button` · `Card` · `Badge` · `ProgressStack` · `Alert` · `toast` (Sonner) | loading · empty · error · degraded | `role="status"` `aria-live="polite"` hanya saat status berubah · ticker `aria-hidden` · target 44 px |
| Lencana `degraded` §12.2 | `Badge` `look="soft"` · `Alert` · tautan | menempel di semua pola | ikon + teks · kontras AA dua tema · `aria-describedby` ke penjelas |
| Review queue §12.3 | `Table`/`VelzonDataGrid` · `Badge` · `Drawer` · `Input`/`Field` · `Button` · `ConfirmDialog` · `toast` | loading · empty · error · degraded | `aria-invalid` + `aria-describedby` dari `Field` · diff tidak warna-saja · 44 px |
| Kartu penjelasan §12.4 | `Card` · `Badge` · `StatCard` · daftar | degraded · empty | daftar teks, bukan grafik-saja · `.tabular` |
| Papan jadwal ALG-8 §12.5 | `Card` · `Badge` · `Table` · `Dropdown` · `ConfirmDialog` · `StateMachineStrip` | loading · empty · error · degraded | tabel `caption` + `scope` · navigasi panah · alternatif "pindahkan" tanpa seret |
| EWS ALG-10 §12.6 | `Card` · `Badge` · `StatCard` · `Table` · `Alert` | loading · empty · error · degraded | teks disclaimer terbaca alat baca · tanpa kontrol status akademik |
| Presensi ALG-12 §12.7 | `Card` · `Badge` · `Field`/`Input` · `Button` · `Drawer` · `toast` | idle · loading · sukses · error · degraded/offline | tantangan sekali-umumkan · `inputmode="numeric"` · vonis `role="alert"` · 44 dp |
| OBE ALG-13 §12.8 | `PageHeader` (breadcrumb) · `VelzonDataGrid` · `StatCard` · `ProgressStack` · `Badge` · `Field` | loading · empty · error · degraded | breadcrumb `nav aria-label` · bar capaian+coverage ber-`aria-label` · error di bawah field |
| Verifier ALG-14 §12.9 | `Card` · `Badge` · `Table` · `Alert` · tombol salin | empty (belum diverifikasi) · error · `COMPROMISED` | hash dengan `aria-label` · status ikon+teks · sortable keyboard |

**Paritas Web ↔ Flutter (AGENTS §3.4).** ALG-12 punya dua sisi (dosen Web, mahasiswa Flutter). Papan ALG-8, review queue, dan OBE = Web + aksi **persetujuan**-nya tersedia di Flutter (§9.6: kaprodi/dekan bergerak); kartu EWS dibaca di kedua platform. Yang **tidak** punya padanan mobile: panel verifier ALG-14 (kebutuhan audit, layar kerja) — pengecualian platform yang sah, dan ia harus tercatat sebagai pengecualian, bukan hilang diam-diam. Data engine hanya lewat `/api/v1/*` yang sama; tidak ada endpoint khusus mobile.

### 12.11 Kunci i18n `engine.*` (belum ada satu pun)

Terukur 2026-10-20: `src/locales/id.json` hanya punya namespace `auth`, `dashboard`, `navigation`, `landing`; `engine.*` **nol**. Gugus yang dispesifikasi (bentuk kunci identik untuk Web JSON dan Flutter ARB; total ±64 daun per bahasa, semuanya spesifikasi bukan catatan kondisi):

```
engine.run.button.{run,rerun,cancel}            engine.run.state.{QUEUED,RUNNING,SUCCEEDED,FAILED,CANCELLED,NEEDS_REVIEW}
engine.run.progress.{queueAhead,elapsed,budget} engine.run.meta.{engineVersion,parameterVersion,snapshot}
engine.run.error.{budget,staleSnapshot,notApplicable,forbidden,moduleOff}
engine.degraded.{NO_PREREQ_DATA,PARTIAL_BUDGET_EXHAUSTED,MODEL_STALE,NO_ATTENDANCE_FEED,NO_INDICATOR_DATA,NO_LECTURER_AVAILABILITY,LOW_SAMPLE}
engine.degraded.link.{prereq,rubric,availability}
engine.review.{title,tab.AUTO,tab.REVIEW,tab.NO_MATCH,marginBar,applyAllFormat,impactLine,applied,revert}
engine.timetable.{board,conflict,conflictCore,feasibleList,softCost,lowerBound,applyDraft,partialWarning}
engine.ews.{title,band.low,band.mid,band.high,topFactors,sampleN,modelVersion,disclaimer,hardRulesOnly,followUp}
engine.attendance.{challenge.label,challenge.round,challenge.input,challenge.expired,tally.replay,verdict.PRESENT,verdict.HELD,unavailable}
engine.obe.{drill.univ,drill.prodi,drill.course,drill.cpl,drill.indicator,drill.item,drill.sample,attainment,coverage,missingEvidence,loopCard.gap,loopCard.action,nextCycle,readonlyHint}
engine.audit.{status.VERIFIED,status.COMPROMISED,scope,headHash,sealedAt,finding.GAP,finding.BRANCH,finding.MISMATCH,frozen,copyHash}
```

Aturan: (1) parameter bernama `{count}`/`{n}`/`{maxSeconds}` untuk semua angka, tanpa konkatenasi kalimat; (2) daun `id` = daun `en` sebagai gerbang CI (RD-19); (3) inventaris masuk `docs/I18N_KEYS.md` yang masih belum ada (§9.8 butir 3); (4) nol string UI di JSX/Dart (AGENTS §3.5).

### 12.12 Definition of Done lapisan engine

- [ ] **DE-1** Setiap layar §12.10 punya cabang render untuk **setiap** bendera §12.2, dibuktikan uji komponen (bukan dibaca mata): respons tertiru `degraded` memunculkan lencana + teks, dan angka utama tidak tampil sebagai angka percaya-diri.
- [ ] **DE-2** Nol spinner tanpa angka di jalur engine; kartu progres §12.1 tampil dengan minimal satu angka otoritatif dari server.
- [ ] **DE-3** Klaim engine selalu berpasangan: biaya ↔ batas bawah, capaian ↔ `coverage`, skor ↔ `n` + TOP-3 faktor. Pencarian grep/AST untuk komponen engine yang me-render metrik tanpa pendamping = temuan.
- [ ] **DE-4** Nol tombol yang menyentuh status akademik/keuangan/penilaian dari layar engine; penerapan draf hanya lewat `VALIDATE` dua orang dengan status `PENDING` yang terlihat.
- [ ] **DE-5** Nol aksi "perbaiki hash"/"rebuild chain"/"sinkronkan ulang" di seluruh `apps/web/src` (grep penjaga, target 0).
- [ ] **DE-6** Review queue: `FORMAT`-only untuk aksi massal, baris diterapkan tetap tersimpan dengan `applied_by`, baris `BLOCKING` tidak pernah bisa disapu.
- [ ] **DE-7** Papan ALG-8 dapat dioperasikan penuh lewat keyboard dan punya jalur "pindahkan" tanpa seret; bentrok `EXCLUDE` terbaca sebagai teks.
- [ ] **DE-8** Kontras AA dua tema untuk semua lencana/band/chip engine; warna tidak pernah sendirian membawa makna; target sentuh ≥ 44 px.
- [ ] **DE-9** Kunci §12.11 masuk dua berkas dengan jumlah daun identik + gerbang CI; layar tidak ditulis sebelum kuncinya terdaftar.
- [ ] **DE-10** Gerbang §11.9 (pemindai warna literal + `font-extrabold`/`font-black` + syarat `degraded` + pemindai array opsi literal) hijau sebelum slice ini dianggap selesai.

**Butuh keputusan pemilik lain (bukan kewenangan desain):**

- **E-1** Field posisi antrian (`queueAhead`/`queuePosition`) pada `GET …/runs/{runId}` — tanpa ini kartu §12.1 tidak boleh mengarang angka. Pemilik: `API_SPEC §6`.
- **E-2** Rute SSE khusus engine (kontrak reconnect/`Last-Event-ID` dan kelas pengecualian amplop). Pemilik: `API_SPEC §6` (preseden §4.2.12).
- **E-3** Ambang keyakinan `AUTO/REVIEW/NO_MATCH` dan ambang skor kecurangan per tenant — angkanya konfigurasi berversi, bukan keputusan UI. Pemilik: `ARCHITECTURE §12` + `DATA_MODEL` (parameter berversi).
- **E-4** Label band risiko EWS yang boleh dipakai di laporan akreditasi (kata "risiko/prediksi/waspada) — sensitif secara kebijakan. Pemilik: `PRD`.
- **E-5** Menambah regex pemindai warna literal + array opsi literal ke `.tools/ui-guards.mjs` (terukur hari ini: 8 checker, belum memuat `blue-`/`indigo-`/`sky-` dan belum memuat `options={[` / `const *_OPTIONS`). Pemilik: `.tools/`.


---

## 13. Dynamic Form Generator (zero-hardcoding) — norma layar, 2026-10-20

> **Dasar & pemilikan.** Norma + DDL + kelas A/A′/B/C/D = [DATA_MODEL.md §20.1–§20.8](file:///c:/SICA/docs/DATA_MODEL.md) (`0047_master_lookup_engine.sql`, `0048_custom_attributes.sql`); kebutuhan produk = PRD FR-ADM-07 & FR-ADM-09; kode izin = RBAC_MATRIX §4 (`academic.reference.*` untuk perawatan kamus, `settings.meta.view`/`settings.meta.update` untuk layar meta-konfigurasi); transport & cache = API_SPEC (nomor §4.14 masih diperebutkan dengan `documents/print/:type` — keputusan pemilik `API_SPEC`, bagian ini menunjuk **path**-nya saja). Yang dimiliki **bagian ini**: komponen apa yang dirender, dari mana nilainya dibaca, bagaimana validasi klien diturunkan, apa yang terlihat saat kamus kosong, dan apa yang **tidak** boleh dikirim ke klien.
>
> **Status: spesifikasi.** Terukur 2026-10-20: `grep -r "master/lookups" apps/web/src packages/contracts` = **0**, dan `ls apps/web/src/components/ui` = 19 berkas tanpa primitif `checkbox`/`radio`/`tree`. Tidak satu pun layar di bawah boleh disebut "sudah dibangun"; yang sudah ada hanya primitif di §11.3 yang akan memakainya.

### 13.1 Klausa inti

Satu layar formulir **tidak boleh** tahu daftar pilihan. Ia tahu **`group`** (alias stabil `api_group_code`) dan **`input_kind`**, sisanya data. Kalau sebuah kampus dapat menamai ulang atau menambah nilai itu tanpa rilis kode, maka nilai itu **tidak boleh** ditulis di TypeScript maupun Dart.

| Kelas (DATA_MODEL §20.1) | Contoh | Sumber nilai di UI | Boleh ada konstanta di komponen? |
|---|---|---|---|
| **A** — protokol & mesin state | `enrollments.status`, `permission_verb`, `pddikti_domain` | enum tertutup + `StatusBadge`/`labelForStatus` (§11.3) | **Ya**, dan wajib tercatat di register enum DATA_MODEL §15 |
| **A′** — keadaan tetap, label kampus | predikat kelulusan, jenis cuti | kode dari enum, **label** dari `/master/lookups?group=…` | Kode ya, **label tidak** |
| **B** — nilai ditetapkan negara | agama, jenis kelamin, wilayah 5 level | `/master/lookups?group=…` (kamus global berversi, `is_system=true`) | **Tidak**, dan item-nya hanya bisa dinonaktifkan, tidak dihapus |
| **C** — kamus rawat kampus | pekerjaan, penghasilan, jenis matakuliah, status hadir, slot waktu | `/master/lookups?group=…` per tenant | **Tidak** |
| **D** — field tanpa kolom di model | atribut khas kampus | `/master/lookups?group=…` untuk pilihan + definisi `tenant_custom_attributes` untuk bentuk | **Tidak** |

**Larangan yang dapat dipindai** (gerbang (m)/(n) DATA_MODEL §20.1, terpasang sebagai pemeriksaan §11.9 butir 4):

```
options={[                              di apps/web/src/**          target 0
const *_OPTIONS = [ … ]                  di apps/web/src/**          terukur 2 (fixture KHS & label duplikat — task, §11.9 butir 4)
<option value="…">                       literal di JSX              target 0
ListTile + const <nama>Options           di apps/mobile/lib/**       target 0 untuk kelas C/D
z.enum([...]) pada field kelas C/D       di packages/contracts       target 0
```

Dan kebalikannya, yang lebih sering dilupakan: **setiap `kind` yang dibaca UI wajib punya baris `reference_kind_usage`.** Tanpa baris itu, generator tidak tahu sumber datanya dan kegagalan baru muncul saat runtime di layar pengguna — karena itu ia digate di CI, bukan saat demo.

### 13.2 Pembacaan kamus: satu jalur, satu bentuk

Setiap kontrol berpilihan memanggil `GET /api/v1/master/lookups?group={GROUP_CODE}` — **satu** fungsi pembacaan bersama di layer data Web dan **satu** service `Dio` di Flutter (AGENTS §3.4: tidak ada endpoint khusus mobile). Aturan yang menempel pada pembacaan itu:

- **Urutan datang dari server**: `ORDER BY sort_order, code`. UI **dilarang** menyortir ulang secara lokal dan **dilarang** memakai urutan `id` — UUIDv7 berubah saat tenant menambah item, sehingga layar tampak "acak setelah impor".
- **Item non-aktif tidak hilang diam-diam.** `is_active=false` tetap dapat dibaca lewat `?at=YYYY-MM-DD` supaya dokumen periode lama menampilkan label yang benar pada waktunya (BR-R12). Pada form aktif, item non-aktif **tidak ditawarkan**, tetapi nilai lama yang sudah terpilih **tetap terbaca** dengan penanda `Badge` "tidak lagi tersedia" — bukan kolom kosong.
- **Cache**: etiket `private, max-age=60` + `ETag` + `X-Lookup-Version`. Klien menyimpan versi dan mengirim `If-None-Match`; `304` = pakai salinan lokal tanpa render ulang. Tanpa mekanisme ini, satu layar biodata dapat mengirim 12 permintaan identik (biaya tersembunyi yang dicatat DATA_MODEL §20.8).
- **`parent_id` diikutkan** dalam respons, karena TREE dirender dari hierarki itu (bukan dari banyak panggilan).
- **Nilai kiriman klien selalu kode**, label hanya untuk mata. Server menyelesaikan `code` → baris kamus miliknya sendiri (`WHERE tenant_id = ctx.tenantId AND kind = $1 AND code = $2 AND is_active`); label, `id` klien, atau angka `points` dari body **tidak pernah** dipercaya (anti-IDOR AGENTS §3.8 + L5 state).

### 13.3 `input_kind` → komponen (hanya yang nyata ada di repo ini)

| `input_kind` | Yang dirender | Catatan implementasi |
|---|---|---|
| `SELECT` | `Select` dari `input.tsx` (native `<select>` berkelas `.velzon-input`) | satu-satunya bentuk yang sudah punya primitif penuh hari ini |
| `MULTI` | daftar `Input type="checkbox"` di dalam `Field` (default); `Select multiple` **hanya** untuk pilihan yang muat dibaca sekaligus | `max_selections`/`min_selections` ditegakkan inline, bukan saat submit; native multi-select dihindari karena target sentuh 44 px sulit dipenuhi |
| `RADIO` | `<fieldset>` + `<legend>` + `Input type="radio"` | primitif `RadioGroup` **belum ada** (terukur); penambahannya task slice ADM-1, bukan asumsi |
| `CHECKBOX` | `Input type="checkbox"` dalam baris ber-min-height 44 px | sama: tanpa primitif baru yang dikarang di dokumen ini |
| `TREE` | daftar bertingkat dari `parent_id` di dalam `Card`, `Accordion` untuk per gugus | primitif tree **belum ada**; `role="tree"`/`"treeitem"` + navigasi panah; jangan meniru tree dengan `<select>` berindentasi spasi |
| `NUMBER` / `DECIMAL` | `Input` `inputMode="numeric"` + `.tabular` | `decimal_scale` menentukan digit; nominal uang **tidak** lewat jalur ini (tetap `bigint` di DB, AGENTS §3.9) |
| `DATE` | `Input type="date"` | jendela `effective_from`/`effective_to` kamus menjadi `min`/`max` |
| `TEXT` / `TEXTAREA` | `Input` / `Textarea` | `max_length` → `maxLength` **dan** penghitung karakter inline |
| `FILE` | `Input type="file"` | **keadaan hari ini**: penyimpanan presigned belum terpasang (`@aws-sdk/*` = ❌ di TECH_CONVENTIONS §6) → field `FILE` dirender **non-aktif dengan sebab**, bukan tombol yang kelihatan hidup lalu gagal 500. Copy: "Pengunggahan berkas belum aktif di lingkungan ini." |

Kelas A dan A′ punya bentuk khusus: **kodenya tetap enum, labelnya punya satu pemilik.** Untuk A′ label datang dari kamus; untuk A label datang dari `labelForStatus`/`toneForStatus` di `status-badge.tsx` (§11.3) — bukan dari array di layar. Contoh terukur 2026-10-20: `CLASS_STATUS_FILTER_OPTIONS` (`krs-course-picker.tsx:89`) menulis "Dibuka / Tutup bersamaan / Ditutup / Draf" sementara `status-badge.tsx:106` sudah menerjemahkan `CLOSING` menjadi "Tutup Bersamaan". Dua tempat = dua kebenaran; yang dimenangkan adalah penerjemah enum, dan array itu dihapus (task ADM-1/ADM-3, tercatat di §11.9 butir 4).

### 13.4 Validasi klien diturunkan dari metadata, bukan dari kode layar

Satu generator skema (Zod di Web, padanannya di Flutter) membaca definisi dan menghasilkan aturan; layar tidak menulis `if` per field.

| Sumber (kolom `reference_kinds` / `tenant_custom_attributes`) | Aturan klien | Bentuk umpan balik |
|---|---|---|
| `is_required` | wajib isi | `Field` `invalid` + `.field-error`, `aria-invalid="true"` |
| `min_selections` / `max_selections` | jumlah pilihan dalam rentang | penghitung inline "3 dari maks 5", error saat melewati plafon |
| `validation_regex` | pola bentuk (NIM, kodepos) | pesan berisi **aturan manusiawi**, bukan regex mentah |
| `effective_from` / `effective_to` | hanya nilai yang berlaku pada tanggal transaksi | item kedaluwarsa tidak ditawarkan + catatan di riwayat |
| `requires_document` | pilihan ini menuntut lampiran | baris lampiran muncul otomatis, status "belum lengkap" menempel di stepper §2.3 |
| `max_length`, `min_value`/`max_value`, `decimal_scale`, `unit` | batas & skala | unit ditampilkan sebagai sufiks teks biasa, bukan placeholder yang hilang saat mengetik |
| `pii_level` non-`NONE` | menolak isi-mandiri dari klien | field tidak dapat disunting di layar mahasiswa; hanya tautan "ajukan ke admin". Batasnya terukur di DDL: `CHECK (pii_level = 'NONE' OR student_self_editable = false)` (`0048`) — jadi **ORDINARY maupun SPECIFIC** sama-sama menutup isian mandiri, meski AGENTS §3.10 menyebut `SPECIFIC` sebagai garis normanya |

Tiga batas yang harus dibaca developer sebelum mengkode:

1. **Regex dari DB adalah data.** Ia boleh memvalidasi bentuk, **tidak boleh** menjadi otoritas (server menegakkan ulang), panjangnya dibatasi, dan tidak pernah dieksekusi sebagai kode. Aturan lintas kolom ("bila penghasilan ≤ 1 juta maka wajib surat") **bukan** metadata — itu L5 di service; kamus hanya menyediakan `requires_document` (DATA_MODEL §20.8).
2. **Atribut kustom tidak boleh menciptakan keadaan.** Bila kampus minta "status khusus", jawabannya label atas kode yang ada (A′), bukan field baru. Ini garis yang mencegah `attributes->'status'` menjadi sumber kebenaran kedua.
3. **Nominal keuangan tidak lewat jalur ini.** Uang tetap kolom bertipe `bigint`/`numeric` dengan proyeksi server per peran (SoD BAAK↔BAUK, AGENTS §3.8); peran tanpa hak menerima "tertahan/tidak" + sebab, bukan angka.

### 13.5 Atribut kustom di formulir yang sama

Seksi **"Atribut tambahan"** dirender **setelah** seksi inti, urut `sort_order`, hanya berisi atribut `status='ACTIVE'` yang **lulus tiga saringan** — dan seluruh saringan dieksekusi server, klien tidak pernah menyaring sendiri:

- **`applies_to`** — prodi, angkatan, jenis program, site. Mahasiswa prodi A angkatan 2023 tidak melihat atribut prodi B; kalau saringan ini lolos sampai klien, ia menjadi kebocoran metadata organisasi.
- **`role_view`** — menentukan atribut mana yang **ada di payload baca**. Kolom yang tidak boleh dilihat peran lain **tidak dirender dan tidak dikirim**: proyeksi server, **bukan** `display:none` dan **bukan** `disabled`. Uji yang diterima di review adalah asersi bahwa **kunci JSON tersebut tidak ada di respons**, bukan bahwa selnya tersembunyi. Perbedaannya dengan §9.8 butir 1: nilai yang *boleh dilihat tapi tidak boleh diedit* dirender `readonly` + sebab; nilai yang *tidak boleh dilihat* tidak pernah meninggalkan server.
- **`role_edit`** — bila peran **boleh membaca tetapi tidak boleh menyunting**: field muncul read-only dengan baris "hak sunting: peran X" (§9.8 butir 2), bukan kotak abu-abu tanpa penjelasan.

Empat konsekuensi yang ikut ditampilkan:

- `student_self_editable` hanya mungkin untuk `pii_level='NONE'` (CHECK `0048`) → atribut ber-PII **tidak dapat** disunting sendiri di layar mahasiswa; field-nya menjadi **tautan ajukan**, bukan isian.
- `is_tracked=true` → ikon riwayat di label yang membuka `Drawer` isi `custom_attribute_history` (`old → new`, siapa, kapan, `source`, `reason`).
- `feeder_mapping IS NULL` → di layar Admin ada penanda "tidak ikut kirim Feeder"; di layar pengguna biasa penanda itu **tidak** muncul (ia metadata, bukan informasi mahasiswa).
- Atribut `RETIRED` → tidak ditawarkan untuk input baru, nilai lama tetap terbaca redup + label "sudah dipensiunkan" (BR-R12: laporan periode lalu harus dapat direkonstruksi).

Plafon yang harus dihormati UI: 40 atribut `is_searchable` per entitas. Saat admin mendekati plafon, layar meta `settings.meta.*` menampilkan kuota terpakai **sebelum** penyimpanan ditolak, bukan setelah (pola §8.3).

### 13.6 Lima keadaan wajib per kontrol (bukan hanya "loading")

| Keadaan | Yang dirender | Larangan |
|---|---|---|
| loading | `.skeleton` setinggi kontrol asli (`Skeleton` §11.3), jumlah baris = tinggi dropdown | layout shift; spinner bulat (§11.7 butir 5) |
| **kamus belum di-seed** (`items` kosong) | pesan jujur di dalam `Alert tone="warning"` + **tautan ke layar Admin** (`/admin/master/referensi`, W-02.1) + sebab ("nilai untuk grup `AGAMA` belum diisi") | **dropdown kosong**; field yang tampak "tidak wajib" padahal wajib; submit yang menyimpan string kosong |
| galat jaringan / `5xx` | `Alert` + tombol **Coba lagi** yang mengulang panggilan yang sama (bukan reload seluruh form), pertahankan isian lain | menghapus data yang sudah diketik pengguna |
| `304` / `X-Lookup-Version` sama | pakai salinan lokal tanpa menggambar ulang; tidak ada indikator "memuat" | flash skeleton pada setiap navigasi |
| ditolak (`403`/modul non-`ACTIVE`) | baris "siapa pemegang hak berikutnya" §9.8 atau halaman "modul belum aktif" dengan tautan langganan | menolak dengan 403 telanjang, atau menyembunyikan field tanpa sebab |

Keadaan "kamus kosong" adalah keadaan **produk**, bukan kebetulan: ia terjadi di setiap tenant baru sebelum SEED_DATA dijalankan. Karena itu copy-nya wajib menyebut **grup apa** dan **ke mana harus pergi**, dan wajib lewat kunci i18n (`form.dynamic.state.emptyDictionary` dengan parameter `{group}`), bukan string di JSX (AGENTS §3.5).

### 13.7 Aksesibilitas layar dinamis (ditegakkan pada primitif yang ada)

- **Label selalu terkait `id`.** `Field` + `useFieldProps` di `input.tsx` sudah menyambungkan `id`, `aria-describedby`, `aria-invalid` otomatis ke `Input`/`Textarea`/`Select` (terukur `input.tsx:19-22`); generator **memakai** sambungan itu dan **tidak** mengulang `htmlFor` manual. Kontrol tanpa label terlihat = temuan, bukan gaya.
- **Grup berpilihan** memakai `<fieldset>` + `<legend>` (bukan `div` + teks bebas); pesan validasi tunggal per kelompok, bukan per radio.
- **Target sentuh ≥ 44 px** untuk setiap opsi (radio/checkbox/tree row), termasuk di Web (ini juga §8.1 untuk Mobile).
- **Kontras AA di dua tema** untuk label, `.field-hint`, `.field-error` dan teks placeholder; diukur dengan `.tools/contrast-audit.mjs` **FAILS = 0** (§11.10) setiap kali token baru dipakai komponen form.
- **Pengumuman.** Progres engine diumumkan dengan `aria-live="polite"` (§12.1); muat kamus dan error server diumumkan di simpul `role="status"` yang sama per field, **bukan** `role="alert"` (hanya untuk vonis akhir §10.7) — alat baca tidak boleh membacakan seluruh form setiap kali satu karakter diketik.
- Warna tidak pernah sendirian membawa makna (`StatusBadge`, ikon + teks); `aria-invalid` tidak cukup tanpa teks sebab.

### 13.8 Penegakan: masking di UI bukan kontrol akses

Generator menambah satu jebakan baru yang wajib disebut di sini. Menyembunyikan field, menyembunyikan menu, atau tidak merender seksi **tidak menegakkan apa pun** — lihat AGENTS §3.8 dan §12.0 butir 3. Yang menegakkan, dan tetap wajib lengkap di setiap rute tulis form dinamis:

1. **L1 transport** — Zod memvalidasi **key whitelist**: kunci `attributes` yang tidak terdaftar di `tenant_custom_attributes` `ACTIVE` **ditolak**, bukan diabaikan diam-diam (kalau diabaikan, nilai liar masuk `jsonb` dan tak pernah terbaca lagi).
2. **L2 identitas** — `tenant_id` hanya dari token terverifikasi; `x-tenant-id`/`x-user-id` kiriman klien dihapus middleware (`SEC-07`).
3. **L3–L4 izin & scope** — `role_view`/`role_edit` dibaca dari tabel penugasan ber-scope (`requireDataPrincipal`/`holdsScoped`), bukan dari label peran global atau perluasan carrier (`SEC-10`, `SEC-11`).
4. **L5 state** — jendela `effective_from/to`, `is_active`, `status='ACTIVE'`, ambang `min/max_selections`, dan aturan lintas kolom ditegakkan service.
5. **L6 RLS** — `reference_items` per tenant (`ENABLE`+`FORCE`); `reference_kind_usage` global = pengecualian tercatat §6.2; view kamus wajib `security_invoker = true`.
6. **Anti-IDOR** — setiap `code`/`itemId` dari klien diselesaikan ke barisnya **di dalam transaksi** dan dibuktikan milik tenant itu sebelum mutate.
7. **Entitlement lebih dulu dari role** — grup kamus milik modul non-`ACTIVE` → `404 MODULE_NOT_AVAILABLE` walau izin ada.

Perawatan kamus itu sendiri (layar Admin) memakai `academic.reference.view/.create/.update/.delete`; RBAC_MATRIX **G-14** mencatat katalog hari ini baru `view`+`manage`, jadi layar tulis kamus tidak boleh diklaim selesai sebelum katalog dan seed `permissions` disamakan (`gen-rbac-seed.mjs` dijalankan ulang).

### 13.9 Kunci i18n `form.dynamic.*` (belum ada satu pun)

Terukur 2026-10-20: `src/locales/id.json` hanya punya `auth`, `dashboard`, `navigation`, `landing`; namespace `admin.*` (yang dirujuk §9.8 butir 3) dan `form.dynamic.*` = **nol**. Gugus yang dispesifikasi (identik untuk Web JSON dan Flutter ARB):

```
form.dynamic.state.{loading,emptyDictionary,networkError,forbidden,moduleOff,expiredValue}
form.dynamic.action.{retry,openAdminLookup,attachRequested,requestAdminEdit}
form.dynamic.rule.{required,selectionRange,format,window,filePending,trackedHistory,notSentToFeeder,searchQuota}
form.dynamic.section.customAttributes
form.dynamic.pii.marker.{none,ordinary,specific}
```

Aturan sama seperti §12.11: parameter bernama (`{group}`, `{min}`, `{max}`, `{count}`), tanpa konkatenasi kalimat, daun `id` = daun `en` sebagai gerbang CI (RD-19), dan nol string UI di JSX/Dart.

### 13.10 Definition of Done lapisan formulir dinamis

- [ ] **DF-1** Nol `options={[` / `const *_OPTIONS` / `<option value="…">` / `z.enum([...])` untuk field kelas C/D yang punya baris `reference_kind_usage` (pemindai §11.9 butir 4, target 0).
- [ ] **DF-2** Setiap `kind` yang dibaca UI punya baris `reference_kind_usage`; CI menjalankan query kebalikannya (DATA_MODEL §20.7) dan menolak 0 baris.
- [ ] **DF-3** Kontrol berpilihan hanya membaca `/master/lookups?group=…`; urutan dari server (`sort_order, code`); `X-Lookup-Version`/`If-None-Match` terbukti dipakai (uji jaringan: navigasi kedua menghasilkan `304`, bukan 12 permintaan identik).
- [ ] **DF-4** Lima keadaan §13.6 teruji komponen untuk **satu** field `SELECT` dan **satu** field `TREE`, termasuk keadaan "kamus belum di-seed" yang menghasilkan tautan Admin, bukan dropdown kosong.
- [ ] **DF-5** Field tanpa `role_view` dibuktikan **tidak ada di payload** (asersi kunci JSON), bukan sekadar tidak terlihat di DOM.
- [ ] **DF-6** `attributes` yang tidak terdaftar ditolak L1 dengan `422`, dan tes membuktikan nilai liar tidak bisa masuk `jsonb`.
- [ ] **DF-7** Label A′ dibaca dari kamus dan label kelas A dari `labelForStatus` — keduanya bukan string di JSX; dua deklarasi `const *_OPTIONS` yang terukur 2026-10-20 (`SEMESTER_OPTIONS`, `CLASS_STATUS_FILTER_OPTIONS`) sudah dibersihkan atau tercatat sebagai task.
- [ ] **DF-8** Target sentuh ≥ 44 px, `fieldset`/`legend` untuk grup, `aria-describedby`/`aria-invalid` dari `Field`, kontras AA dua tema (`.tools/contrast-audit.mjs` FAILS = 0).
- [ ] **DF-9** Field `FILE` dirender non-aktif **dengan sebab** selama penyimpanan presigned belum terpasang; tidak ada tombol yang gagal 500 secara senyap.
- [ ] **DF-10** Paritas: bentuk fungsional yang sama tersedia di Flutter dengan `input_kind` yang sama; bila sebuah keadaan tidak punya padanan mobile, ia tercatat sebagai pengecualian (§12.10), bukan hilang diam-diam.

**Butuh keputusan pemilik lain (bukan kewenangan desain):**

- **F-1** Kontrak transport `/master/lookups` (amplop, `X-Lookup-Version`, `?at=`, nomor §) — pemilik `API_SPEC`; hari ini penomoran §4.14 masih berisi catatan `documents/print/:type`.
- **F-2** Primitif `Checkbox`, `RadioGroup`, dan tree di `components/ui` + padanan Material di Flutter — pemilik `ADM-1` (slice kode), bukan dokumen ini.
- **F-3** Penambahan regex `options={[` / `const *_OPTIONS` ke `.tools/ui-guards.mjs` — pemilik `.tools/` (satu daftar dengan `E-5`).
- **F-4** Ambang plafon & antarmuka meta-konfigurasi (`settings.meta.*`): apakah `TENANT_ADMIN` boleh menyalakan atribut `is_required` tanpa empat-mata — pemilik `RBAC_MATRIX` + `PRD` (FR-ADM-09).

---

## 14. Tata kelola parameter sistem & menu dinamis (layar Admin IT) — spesifikasi UI, 2026-10-20

> **Dasar & pemilikan.** Kolom, `CHECK`, riwayat insert-only, katalog 25 baris parameter, kosakata `data_type`/`risk_class`/`applies_to`/`source_of_truth`, serta `menu_items` + `menu_permissions` + `parameter_permissions` = [DATA_MODEL.md §21.1–§21.7](file:///c:/SICA/docs/DATA_MODEL.md) (`0049_system_parameters.sql`, `0050_menu_parameter_permissions.sql` — **DDL ditulis, berkas migrasi belum ada**). Path, amplop, skema Zod, header cache, `X-Parameter-Version`, dan kode error 107–118 = [API_SPEC.md §4.16–§4.17](file:///c:/SICA/docs/API_SPEC.md). Kode izin `settings.param.view.<class>` · `.edit.<class>` · `.approve.<class>` · `.register` · `.history.view` · `.impact.view` · `.pattern.manage` (baris 146–157) dan `platform.menu.view` · `.manage` · `.grant` · `.revoke` (158–161, status **usulan**) = [RBAC_MATRIX.md §4.5/§4.7](file:///c:/SICA/docs/RBAC_MATRIX.md); alamat `/admin/pengaturan/parameter` dan `/admin/pengaturan/menu` dari §6.5 gugus E. Yang dimiliki **bagian ini**: kolom mana yang wajib terlihat, kontrol apa yang dirender per `data_type`, copy risiko, alur pengajuan–penyetujuan, keadaan versi basi, bentuk pohon menu, dan apa yang tidak boleh dikirim ke klien.
>
> **Status: spesifikasi.** Terukur 2026-10-20: `find apps/web/src/app/api/v1 -name route.ts` = **18** berkas dengan direktori hanya `academic`, `attendance`, `auth`, `health`, `tenant` → **nol** rute `/admin/**` dan `/settings/**`; `ls apps/web/src/components/ui` = **19** berkas **tanpa** primitif `switch`, `slider`, `tree`, pemilih rentang tanggal, editor JSON berwarnai, dan tanpa satu pun pustaka virtualisasi atau seret-lepas di `apps/web/package.json`; `src/locales/id.json` hanya berisi `auth`, `dashboard`, `navigation`, `landing` → namespace `admin.*` **nol**. Tidak satu pun layar di bawah boleh disebut "sudah dibangun", dan tidak satu pun layar boleh dibuka sebelum §11.9 butir 5–8 ikut terpasang.

### 14.0 Enam prinsip yang berlaku di semua layar tata kelola

1. **Angka tanpa penjelas adalah tombol bunuh yang diam.** `description` DB — yang kolomnya **wajib** menyebut efek bila diubah (`DATA_MODEL §21.2`) — dirender **utuh di atas kontrol**, tidak pernah dipotong ke tooltip, tidak pernah diganti kalimat hasil karya layar. Kunci tanpa `description` yang menyebut efek adalah temuan data, bukan kekurangan copy.
2. **Batas datang dari baris, bukan dari JSX.** `min_value`/`max_value`/`allowedValues`/`unit`/`data_type` adalah muatan respons; layar **tidak** punya konstanta angka (§11.9 butir 5). Menurunkan batas di layar = membuat sumber kebenaran kedua, persis pola `RD-32`.
3. **Non-aktif selalu beralasan.** Tidak ada `disabled` tanpa sebab: setiap kontrol mati membawa **sebab + pemilik hak + tautan** (§9.8 butir 2, §13.5). Yang mati karena pointer, karena kelas risiko, dan karena modul belum aktif adalah tiga keadaan berbeda dan harus terbaca berbeda.
4. **Perubahan belum berlaku sampai orang kedua menyahkan.** `effectiveValue` dan `proposedValue` selalu tampil **berdampingan** (`effectiveValue` ≠ `proposedValue` adalah inti kontrak §4.16.2). Menyajikan `proposedValue` sebagai "sudah berlaku" = berbohong ke operator.
5. **Penyaringan menu bukan kontrol akses.** Kalimat ini bukan hanya norma dokumen: ia **dirender di layar grant** (§14.8.5). Yang menegakkan tetap enam lapis L1–L6 di rute; layar hanya mengatur terlihat/tidak.
6. **Hanya primitif yang ada (§11.3, §2.0).** Tidak ada paket baru (vonis ApexCharts §11.11.1 adalah presedennya). Kontrol yang belum punya primitif memakai bentuk yang tersedia (`Input`, `Textarea`, `Select`, `Progress`, checkbox native berkelas) dan **sisanya dicatat sebagai task** di §14.13 — bukan dijanjikan sebagai sudah ada.

### 14.1 Daftar parameter — `/admin/pengaturan/parameter`

**Kerangka** (§9.2, tanpa variasi): `PageHeader` (judul + deskripsi satu baris + aksi primer "Daftarkan kunci baru" yang hanya dirender bila pemegang `settings.param.register`) + `MetaRow` konteks (`tenant`, modul aktif, 8 hex pertama `X-Parameter-Version`, keadaan `aktif` atau `rekonstruksi <tanggal>`) + `VelzonDataGrid` + `Drawer` kanan per baris (satu drawer, tanpa modal bertumpuk §9.7).

List admin dijawab `Cache-Control: no-store` (§4.16.1): ini **read-your-writes**, jadi pembacaan selalu ke Primary — tidak ada keadaan "nilai saya belum muncul" yang boleh dijawab dengan spinner kedua.

**Saringan — hanya yang ada di kontrak query; Zod `strict()` menolak parameter tak dikenal, jadi layar tidak boleh menambah saringan sendiri:**

| Saringan | Kontrol | Nilai sah | Aturan render |
|---|---|---|---|
| Modul | `Select` | 8 enum `attendance · krs · grading · feeder · finance · pmb · lms · platform` | bukan string bebas (kolomnya `text` + `CHECK`, pemilik `DATA_MODEL`); kosong = seluruh modul |
| Kelas risiko | `Select` | 6 enum `TECHNICAL · OPS · ACADEMIC · FINANCIAL · REGULATORY · SECURITY` | pilihan dari enum kanonik, **bukan** array di layar (§13.1) |
| Kata kunci | `Input` dengan `startIcon` | 1–80 karakter | ILIKE atas `parameter_key` + `description`; debounce 300 ms; skeleton baris saat menunggu, isian filter tidak boleh hilang |
| Sertakan non-aktif | `Input type="checkbox"` | `includeInactive` | default mati; saat dinyalakan baris non-aktif dirender **redup + label "non-aktif"**, bukan disisipkan tanpa penanda |
| Hanya yang bisa disunting | `Input type="checkbox"` | `editableOnly` | terjemahan persis dari server: `is_editable = true` **dan** `source_of_truth = 'PARAM'` |
| Keadaan pada tanggal | `Input type="date"` | `at` (ISO) | mode **hanya-baca** — lihat §14.1.3 |

**Kolom wajib per baris** (satu baris tanpa salah satunya tidak layak-review, karena kontrak §4.16.1 mengirim semuanya):

| Kolom grid | Sumber respons | Bentuk Velzon |
|---|---|---|
| Kunci | `parameterKey` | mono, `text-xs`, seluruh segmen terlihat, tombol salin ber-`aria-label` (pola hash §12.9) |
| Modul | `module` | `Badge tone="secondary"` + nama modul Indonesia (bukan kode mentah) |
| Nilai berjalan | `currentValue` (kawat) + `value` (kolom *generated* bertipe) | `.tabular` + **sufiks `unit` sebagai teks biasa** (`s`, `m`, `%`, `bp`), bukan placeholder yang hilang saat mengetik (§13.4) |
| Baku | `defaultValue` | redup (`text-muted`) + penanda teks `sama` / `berbeda` — bukan warna saja |
| Rentang & nilai sah | `min`, `max`, `allowedValues` | "5–30 s · sah: 5 · 10 · 15" atau "10–500 m"; bila tidak ada batas → teks `tanpa batas` **plus** penanda `warning` kecil (batas yang hilang adalah temuan §11.9 butir 5) |
| Kelas risiko | `riskClass` | lencana §14.1.1 |
| Berlaku & cakupan | `effective.*`, `appliesTo` | tanggal `from`→`to` + cakupan ringkas ("seluruh tenant" / "2 prodi" / "site Bintaro") |
| Versi | `version` | `.tabular`, "v3" |
| Status | `isActive`, `isEditable`, `requiresSecondApprover`, `sourceOfTruth` | `StatusBadge` untuk aktif/non-aktif (§11.3, satu-satunya penerjemah enum → nada + label); ikon gembok + teks untuk `isEditable = false`; penanda pointer §14.1.2 |

`meta.pagination` dipakai apa adanya (server `limit` maks 100, §4.16.1) — `VelzonDataGrid` **tidak** boleh menyortir atau memotong ulang di klien; `sortBy`/`sortDir` dikirim sebagai query.

#### 14.1.1 Lencana `risk_class` — yang mencolok adalah yang bisa salah

Urutan penonjolan mengikuti konsekuensi, bukan estetika. Kelas `SECURITY` dan `REGULATORY` memakai varian **`label`** (isian solid berlabel) karena keduanya menuntut penyetuju kedua; empat kelas lain memakai **`soft`**. Semua lencana **ikon + teks** — warna tidak pernah sendirian (§11.10 butir 4) — dan kontrasnya diukur `.tools/contrast-audit.mjs` FAILS = 0 pada dua tema.

| `risk_class` | Kelas lencana | Nada | Ikon lucide | Teks label | Konsekuensi yang harus terbaca |
|---|---|---|---|---|---|
| `SECURITY` | `Badge look="label"` | `danger` | `shield-alert` | `KEAMANAN` | nilai di bawah `CHECK` tidak dapat disimpan; empat-mata + MFA; SoD anti-pelonggaran |
| `REGULATORY` | `Badge look="label"` | `warning` | `landmark` | `REGULASI` | angka yang dilaporkan ke negara atau keputusan yang sudah terjadi |
| `FINANCIAL` | `Badge look="soft"` | `warning` | `banknote` | `KEUANGAN` | ambang skalar saja; nominal tidak pernah lewat jalur ini |
| `ACADEMIC` | `Badge look="soft"` | `info` | `graduation-cap` | `AKADEMIK` | gerbang akademik dibaca service, bukan dihitung UI |
| `OPS` | `Badge look="soft"` | `primary` | `settings-2` | `OPERASIONAL` | ambang harian yang dibacakan banyak modul |
| `TECHNICAL` | `Badge look="soft"` | `secondary` | `wrench` | `TEKNIS` | perilaku integrasi, bukan hak pengguna |

Di dalam **drawer editor**, lencana yang sama diulang satu kali di baris pertama drawer — operator tidak boleh perlu kembali ke daftar untuk tahu kelas kunci yang sedang ia pegang.

#### 14.1.2 `is_editable = false` bukan kotak abu-abu tanpa sebab

Empat sebab, empat copy, empat aksi. Kolom `updateDisabledReason` dari server yang menentukan cabang; layar **tidak** menyimpulkan dari `isEditable` saja.

| Sebab | Copy Indonesia (kunci `admin.param.disabled.*`) | Yang ditawarkan |
|---|---|---|
| Pointer ke rumah lain (`NOT_A_PARAM_SOURCE`) | "Nilai sebenarnya tinggal di `tenant_settings.nim_format`. Ubah dari layar Pengaturan, bukan dari baris indeks ini." | tombol **Buka rumah kanonik** (satu jalur per objek, §9.1.1) |
| Kelas risiko tanpa hak sunting pemegang | "Kelas `SECURITY` hanya dapat diubah `TENANT_ADMIN` yang tidak memegang objek yang dijaga ambang ini, dengan penyetuju kedua dan sesi MFA." | **Ajukan permintaan** (§14.4) + baris "siapa pemegang hak berikutnya" (§9.8 butir 2) |
| Batas ditegakkan `CHECK` di DB | "Nilai di bawah {min} {unit} ditolak basis data, jadi tidak dapat disimpan dari layar mana pun." | tidak ada aksi tulis; hanya riwayat + dampak |
| Modul non-`ACTIVE`/`TRIAL` | "Modul {module} belum aktif di langganan ini." | halaman "modul belum aktif" + tautan langganan (entitlement memotong lebih dulu dari role, AGENTS §3.8) |

Aturan yang mengikat: kontrol yang mati **tetap menampilkan nilai berjalan** (read-only, `.tabular`) dan **sebabnya**; yang disembunyikan hanya hak tulisnya. Menghilangkan seluruh baris karena tidak bisa disunting menghilangkan informasi "aturan mana yang sedang berlaku" — justru itu yang dicari lewat `?at=` dan riwayat.

#### 14.1.3 Baris pointer dan mode rekonstruksi `?at=`

**Pointer bukan salinan.** Baris dengan `sourceOfTruth <> 'PARAM'` dirender dengan `currentValue = null` → sel nilai menampilkan `—` (bukan `0`, bukan kosong, bukan `•••`) + `Badge look="soft" tone="secondary"` bertuliskan **`INDEKS PENEMUAN`** + panah ke rumah kanonik (`academic_rules`, `reference_items`, `tenant_settings`). Menampilkan angka salinan di sini = dua sumber kebenaran untuk satu fakta (pola `RD-32`), dan kontrak §4.16.1 memang mengirim `null` supaya klien tidak bisa mengarang.

**Mode rekonstruksi.** Saat `at` terisi: `Alert tone="info"` lengket di bawah `MetaRow` — `admin.param.mode.readonlyReconstruct` = "Anda membaca keadaan pada {at}. Hanya-baca: perubahan tidak dapat disimpan dari mode ini." — seluruh kontrol editor `readonly`, tombol simpan **tidak dirender** (bukan dinonaktifkan), dan `MetaRow` menampilkan tanggal itu. Ini keadaan normal auditor, bukan galat.

### 14.2 Editor per `data_type` — tipe menentukan kontrol, kontrol tidak pernah menentukan tipe

Satu generator kontrol (pola §13.3; sumber metadata di sini adalah baris parameter, bukan `reference_kinds`): layar membaca `dataType` + `min`/`max` + `allowedValues` + `enumKind` + `unit`, dan dari situ bentuk kontrol muncul. Tidak ada `if (key === 'attendance.…')` di JSX — itu akan menjadi rumah kedua untuk aturan.

| `data_type` | Kontrol yang dirender (primitif nyata §11.3) | Batas yang wajib terlihat sebelum mengetik | Galat & pemetaan |
|---|---|---|---|
| `STRING` | `Input`, atau `Textarea` bila `description` menandakan isian panjang | batas 4000 karakter kawat; karakter kontrol ditolak `CHECK` | `422 PARAM_INVALID_TYPE` (109) |
| `REGEX` | `Input` mono + **tester inline**: satu `Field` "nilai contoh" → "cocok / tidak cocok" dihitung lokal | sumber kebenaran pola = server; tester hanya kenyamanan, tidak pernah jadi otoritas | pola tidak dapat dikompilasi → (109) dengan sebab manusiawi, bukan regex mentah (§13.4) |
| `INT` / `DECIMAL` | `Input inputMode="numeric"` + `.tabular` + sufiks `unit` | `min`/`max` sebagai atribut **dan** satu baris teks "boleh {min}–{max} {unit}"; `step` dari skala | di luar rentang → `422 PARAM_OUT_OF_RANGE` (107), copy §14.3 |
| `PCT` | `Input inputMode="numeric"` 0–100 + **baris `Progress`** yang menampilkan posisi nilai di dalam rentang (primitif `Slider` **belum ada** → §14.13 `G-2`; `Progress` yang ada di §11.3 menyampaikan hal yang sama tanpa paket baru) | plafon 100 ditegakkan dua sisi; bila `allowedValues` terisi → `Select` nilai sah, bukan angka bebas | (107); `PCT` > 100 → (109) |
| `BP` (basis poin) | `Input inputMode="numeric"` 0–10.000 + baris bantu "= {pct} %" dihitung dari integer | integer saja; **tidak pernah** `float`/`double` (aritmetika kanonik AGENTS §3.9, paritas §3.4) | (107) dengan dua angka sekaligus (bp dan persentasenya) |
| `SECONDS` / `METERS` | `Input inputMode="numeric"` + sufiks `s` / `m` | rentang + daftar sah bila ada ("sah: 5 · 10 · 15") | (107) |
| `BOOL` | `Input type="checkbox"` dalam baris `min-height` 44 px + **label dua baris**: apa arti nyala, apa arti mati | tidak ada batas angka — yang wajib adalah konsekuensi kedua nilai | (109) bila kawat bukan `true`/`false` |
| `JSON` | `Textarea` mono (`text-xs`, `spellCheck={false}`) + tombol "Format" yang hanya menjalankan `JSON.parse` → `JSON.stringify(…, null, 2)` **lokal** | diff per kunci tingkat atas `old → new`; editor berwarnai belum ada → §14.13 `G-3` | tidak bisa di-*parse* → (109); diff memakai pola baris §12.3 (`−`/`+` + teks, bukan warna saja) |
| `DATE` / `TIME` | `Input type="date"` / `type="time"` (`color-scheme` diset per tema, §11.10 butir 4) | `min`/`max` dari metadata + jendela `effective_from/to` sebagai batas kedua | (107) "tanggal harus antara {min} dan {max}" |
| `CRON` | `Input` mono + baris pratinjau lima kejadian berikutnya | pratinjau **harus** berasal dari fungsi yang sama dipakai scheduler; sampai ia ada (§14.13 `G-4`), baris menampilkan `admin.param.cron.previewUnavailable` dan nilai tetap divalidasi server | tidak sah → (109) dengan sebab per kolom, bukan "format salah" |
| apa pun + `enumKind` terisi | `Select` yang opsinya **hanya** dari `GET /master/lookups?group={enumKind}` (§13.2: urutan `sort_order, code`, cache `ETag`, item non-aktif tidak ditawarkan) | sumber daftar = kamus; **tidak pernah** konstanta di layar dan tidak pernah dikirim di body (§4.16.2 melarang `allowedValues`/`values` di badan) | kind tidak ada → `404 LOOKUP_GROUP_NOT_FOUND` (92); nilai bukan anggota → `422 PARAM_ENUM_UNKNOWN` (110) — server tidak menambah item kamus agar nilai "lulus" |

**Tiga batas yang tidak boleh dilanggar editor.** (1) Struktur kunci (`parameter_key`, `module_code`, `data_type`, `unit`, `default_value`, `min_value`/`max_value`, `risk_class`, `enum_kind`, `description`, `is_secret`, `source_of_truth`, `requires_restart`, `version`) adalah **`SERVER_ONLY`** (§4.16.2): ia tidak pernah muncul sebagai field yang bisa diketik, dan kehadirannya di body dijawab `422` — jadi tidak ada godaan "sekalian rapikan labelnya". (2) Nilai yang menyerupai kredensial (`secret`, `password`, `token`, `Authorization:`, blok kunci privat, DSN ber-password) ditolak `422 PARAM_SECRET_FORBIDDEN` (111); layar menyebut sebabnya ("parameter tidak pernah memegang rahasia") dan **tidak** menawarkan tempat lain untuk mengetiknya. (3) Daftar nilai tidak pernah menjadi isian bebas di layar parameter: bila kampus perlu menambah **nilai**, itu pekerjaan kamus (`reference_items`, §13), bukan pekerjaan editor ini.

### 14.3 Ambang keamanan: batas + copy risiko, bukan validasi merah

Kelas `SECURITY` dan `REGULATORY` adalah tempat satu klik dapat melemahkan rotasi token atau memperlebar radius geofence. Normanya: **layar menolak sebelum pengguna sempat menyimpan, dan menjelaskan risikonya dalam kalimat sebab-akibat**, bukan hanya membuat border merah.

**Empat syarat wajib editor kelas `SECURITY`/`REGULATORY`.**

1. **Rentang tampil sebelum mengetik**, bukan setelah gagal: baris "Sah: {min}–{max} {unit}" + daftar sah bila ada. Bila `allowedValues` terisi, kontrol yang dirender adalah **pilihan dari daftar itu** — bukan bidang angka bebas, dan bukan slider tanpa batas (larangan eksplisit pembuka `API_SPEC §4.16`: layar Admin tidak menampilkan slider tanpa batas untuk kunci `risk_class = 'SECURITY'`).
2. **Copy arah risiko.** Nilai harus dibaca sebagai konsekuensi, bukan selera. Contoh acuan (semuanya lewat kunci i18n, bukan string di JSX):
   - `attendance.totp_rotate_seconds` turun → "Semakin pendek periode rotasi, semakin sempit jendela penyalinan token. Nilai di bawah 5 detik ditolak basis data dan tidak dapat disimpan dari layar mana pun."
   - `attendance.geofence_default_radius_m` naik → "Radius yang lebih longgar mengurangi penolakan yang sah, tetapi memperbesar peluang mahasiswa tercatat hadir di luar ruang. Batas per ruang tetap `rooms.allowed_radius_m`."
   - `attendance.gps_max_accuracy_m` turun → "Ambang akurasi yang lebih ketat akan menolak lebih banyak pembacaan sah di dalam gedung."
   - `finance.webhook_max_clock_skew_s` naik → "Selisih jam yang lebih longgar memperbesar penerimaan peristiwa yang bukan berasal dari waktu sekarang."
3. **Penolakan memakai sebab, bukan kode mentah.** `422 PARAM_OUT_OF_RANGE` (107) dirender di dalam `Field` terkait **dan** `Alert` berisi `details[]` (`sentValue`, `min`, `max`, `unit`) — pengguna melihat angka yang ia kirim berdampingan dengan batasnya.
4. **Batas `CHECK` tidak dapat dinegosiasi UI.** Bila yang menolak adalah `CHECK` basis data (bukan izin), copy menyebut itu: "Ditolak basis data (`CHECK` pada `0049`)" — supaya admin tidak mengira ada layar lain yang lebih berkuasa darinya.

**Penanda SoD anti-pelonggaran (RBAC_MATRIX `G-19`, baris 157).** Bila pemegang `settings.param.edit.security` juga memegang izin atas objek yang dijaga ambangnya (`attendance.qr.generate`, `attendance.record.create`/`.update`, `teaching.session.update`, `grading.value.write`, `finance.payment.confirm`), layar **tidak** menampilkan tombol simpan sama sekali; yang tampil `Alert tone="danger"`: "Anda memegang izin atas objek yang dijaga ambang ini. Perubahan harus diajukan admin lain dan disahkan penyetuju kedua (SoD `G-19`)." Aksi "Ajukan permintaan" (§14.4) tetap tersedia, karena mengajukan ≠ melonggarkan sendiri.

### 14.4 Alur pengajuan → penyetuju kedua → sahkan/tolak

**Dua jalur, satu bentuk formulir.** Kunci `TECHNICAL`/`OPS`/`ACADEMIC`/`FINANCIAL` dengan hak sunting cukup → `PUT …/system-parameters/{key}` (nilai berlaku setelah respons). Kunci `REGULATORY`/`SECURITY` → nilai disimpan sebagai **draf** dan server menjawab `409 PARAM_APPROVAL_REQUIRED` (113) dengan `approvalId`. Karena itu layar **tidak** punya dua formulir; yang berbeda hanya kalimat hasil dan kartu keadaan yang muncul setelah kirim.

**Isi formulir (hanya tiga hal dapat diketik):**

| Field | Kontrol | Aturan |
|---|---|---|
| Nilai | generator §14.2 | wajib; batas dari metadata |
| Cakupan `applies_to` | `Select` multi dari kamus prodi/site/jenis program/periode (§13.2) + baris "kosong = warisi nilai tenant" | nilai dibaca **hanya** bila cocok scope; scope dikirim sebagai id dan diselesaikan ke barisnya di transaksi (anti-IDOR) |
| Alasan `reason` | `Textarea` 10–500 + penghitung karakter | **wajib** untuk setiap tulis, termasuk revert dan `toggle-active`; tanpa alasan tidak ada rekonstruksi (BR-R12) |

Di bawah field: **diff `old → new`** (pola §12.3: nilai lama `strikethrough` redup, nilai baru `tone="success"`, ikon `−`/`+` + teks) + **ringkasan dampak** satu baris dari §14.6 ("dibaca oleh {screens} layar dan {processes} proses") + **nilai efektif saat ini** yang tetap tampil meskipun `proposedValue` sudah diketik.

**MFA untuk kelas `SECURITY`/`REGULATORY`.** MFA adalah **syarat sesi**, bukan field body. Alur layar: sebelum kirim, bila faktor kedua belum terbukti → alihkan ke verifikasi MFA milik autentikasi lalu kembali ke drawer dengan isian utuh; copy `admin.param.mfa.gate`: "Perubahan kelas {riskClass} menuntut sesi bermulti-faktor. Isian Anda disimpan di layar ini sampai verifikasi selesai." Jika server tetap menjawab `403` karena faktor belum terbukti, **jangan** tampilkan "silakan coba lagi" — tampilkan jalur "Verifikasi faktor kedua" beserta sebabnya.

**Kartu "menunggu penyetuju kedua"** (`Card` dengan `role="status" aria-live="polite"`, keadaan dari enum `access_request_status` lewat `StatusBadge` §11.3 sehingga `PENDING`/`APPROVED`/`REJECTED`/`CANCELLED` tidak punya warna karangan). Isinya:

- `approvalId` pendek + tombol salin;
- **dua angka sekaligus**: `effectiveValue` (yang masih berlaku) dan `proposedValue` (yang menunggu), dengan kalimat `admin.param.pending.effective`: "Yang berlaku masih nilai lama sampai permintaan ini disahkan.";
- siapa pemohon (`requestedBy` + nama) dan kapan diajukan;
- **daftar pemegang hak berikutnya** dari `allowedActors` — "siapa pemegang hak berikutnya" (§9.8 butir 2), bukan 403 telanjang;
- penanda tegas: "Anda tidak dapat menyetujui permintaan Anda sendiri (`403 SELF_APPROVAL_FORBIDDEN`, baris 56)";
- aksi **Sahkan** / **Tolak** hanya untuk pemegang `settings.param.approve.regulatory|.security` yang bukan pemohon, menunjuk `…/system-parameter-approvals/{id}/…` (bukan `…/{key}/approve` — `{id}` dan `{key}` dua identitas berbeda, §4.16.3);
- **alasan wajib** pada `reject` (min 10) sebagai `Textarea` di dalam `ConfirmDialog`;
- keadaan terminal: `409 DECISION_ALREADY_MADE` (55) → kartu beralih ke keadaan akhir + tautan riwayat, bukan pesan "gagal".

**Yang dilarang di alur ini.** Tidak ada optimistic UI (§9.4: tulis master menunggu respons); tidak ada tombol "terapkan semua" untuk parameter (satu kunci satu keputusan); tidak ada tampilan `proposedValue` sebagai nilai efektif; pemohon tidak pernah melihat tombol sahkan untuk dirinya. Setelah `approve`, klien **wajib** membaca ulang dengan `If-None-Match` yang sengaja gagal agar resolver mengambil Primary (§4.16.5 read-your-writes, AGENTS §3.7) — bukan menampilkan angka hasil tebakan.

### 14.5 Panel riwayat dan revert

**Bentuk.** Tab "Riwayat" di dalam drawer kunci, tinggi dibatasi dengan gulir tipis (§11.6), satu baris per entri `master_system_parameter_history`, urutan `occurred_at DESC` dari server, filter `from`/`to` (`Input type="date"`; `to < from` → `422 VALIDATION_FAILED` (6) dengan pesan di bawah field).

**Isi per baris** (proyeksi `API_SPEC §4.16.3 history`): diff `old_value → new_value` (mono untuk `REGEX`/`JSON`/pola, `.tabular` + sufiks `unit` untuk numerik), `old_version → new_version`, siapa (`changed_by` + nama), kapan (waktu tenant, `.tabular`), `reason` **utuh**, `source` (`UI · API · IMPORT · MIGRATION · SEED`) sebagai `Badge look="soft" tone="secondary"`, `approver_id` + penanda SoD bila `approver_id === changed_by` (harus mustahil; kalau muncul itu temuan, bukan data — pola §12.9), `request_id`/`auditId` sebagai tautan penelusuran, dan `ip`.

**Dua kolom hanya untuk pemegang izin riwayat.** `ip` dan identitas `changed_by` lengkap hanya dikirim ke pemegang `settings.param.history.view`; peran lain melihat baris riwayat **tanpa dua kolom itu** + satu kalimat `admin.param.history.redactedNotice`: "Identitas lengkap dan alamat IP hanya ditampilkan ke pemegang izin riwayat." Proyeksinya di server: yang tidak berhak tidak menerima kuncinya sama sekali (§13.5, pola DF-5) — bukan di-`hidden` dengan CSS (§11.9 butir 6).

**Revert = entri baru, bukan penghapusan.** Aksi per baris → `ConfirmDialog` (§11.3, satu lapis) berisi: diff terbalik `{new} → {old}`, `reason` wajib min 10 dengan awalan "Revert ke v{version}: ", `expectedVersion` dari baris yang dibaca, dan penanda kelas risiko. Revert pada `REGULATORY`/`SECURITY` **ikut butuh empat-mata** (§4.16.3: "kembali" bukan alasan untuk lolos persetujuan), jadi hasilnya bisa berupa kartu §14.4, bukan langsung berlaku. Riwayat insert-only: **tidak ada** tombol ubah/hapus riwayat di layar mana pun (READ-only mutlak, AC-AUD-1); penemunya di review = tolak.

**Keadaan.** `loading` = `Skeleton.Table`; `empty` = "Belum ada perubahan tercatat pada rentang ini" (bukan galat) + tombol "Perlebar rentang"; `error` = pemetaan §2.3 dengan tautan sebab; `degraded` = riwayat boleh dibaca dari **Replica** (§4.16.3) → footer `text-xs` "Riwayat dibaca dari salinan baca; entri terbaru dapat tertinggal sesaat." + aksi "Muat ulang (primer)". Tautan "lihat keadaan tanggal itu" ke §14.1.3 selalu tersedia, karena `?at=` direkonstruksi dari tabel ini.

### 14.6 Panel dampak — "layar atau proses mana yang membaca kunci ini"

Dari `GET …/system-parameters/{key}/impact` (§4.16.3). Tiga sumber digabung server dan dirender sebagai **satu daftar tanpa duplikat**, dikelompokkan per tipe permukaan, masing-masing dengan alamat kanoniknya (§9.1.1):

| Kelompok | Isi | Cara render |
|---|---|---|
| Layar | `menu_items` × grant (`parameter_permissions`, `menu_permissions`) yang cocok | `Badge look="soft" tone="primary"` tipe `MENU` + nama menu + `layer` (Web/Mobile) + tautan `/admin/pengaturan/menu?code=…` |
| Proses & service | registri statis `parameterKey → call site` (target `packages/contracts/src/parameter-keys.ts`) | baris `file:symbol` mono `text-xs`; ini jawaban yang paling dicari dan tidak boleh masuk tooltip |
| Kamus | `reference_kind_usage` bila `enum_kind` terisi | baris `kind` + tautan `/admin/master/referensi` (W-02.1) |
| Grant pola | baris `parameter_permissions` yang mencocokkan kunci ini | efek `ALLOW`/`DENY` dengan bentuk §14.8.5 + pemilik pola |

**Dua keadaan yang wajib dibedakan dan tidak boleh dibulatkan.**

- **Daftar kosong.** `Alert tone="warning"`: "Tidak ada konsumen terdaftar untuk kunci ini. Ia tidak membaca apa pun — periksa sebelum menyimpan." Inilah **parameter hantu** (`API_SPEC §4.16.4` menolak `register` tanpa `consumerEvidence`); menampilkannya sebagai daftar rapi adalah cara memperoleh layar Admin yang menulis angka yang tidak dibaca siapa pun.
- **`orphanKeys[]` tidak kosong.** Penanda `Badge look="soft" tone="warning"` "konsumen belum terdaftar" per item + kalimat `admin.param.impact.ciDebt`: "Item tanpa baris registri adalah **tunggakan CI**, bukan fitur."

Panel ini hanya-baca (boleh Replica), tidak menawarkan aksi selain tautan. Kalimat pembuka selalu ada di atas daftar: **"Kalau angka ini berubah, yang berubah adalah {ringkasan satu baris}."** — disusun dari data, bukan dikarang UI.

### 14.7 Keadaan versi efektif — form yang tidak boleh menyimpan aturan basi

Kontrak: `X-Parameter-Version` (`<tenant8>-<h8>`) + `ETag` + `Cache-Control: private, max-age=60` + `If-None-Match`/`304` (`API_SPEC §4.16.5`). Drawer editor menyimpan **versi tenant dan `version` baris** saat dibuka dan membandingkannya pada setiap pembacaan ulang.

| Kondisi | Yang dirender | Yang dilarang |
|---|---|---|
| versi sama (`304`) | tidak ada indikator "memuat"; form tetap seperti adanya | flash skeleton (§13.6) |
| **versi naik saat form terbuka** | `Alert tone="warning"` lengket di kepala drawer: `admin.param.stale.title` = "Aturan berubah — muat ulang nilai" + dua aksi (**Muat ulang nilai** dengan mempertahankan `reason` yang sudah diketik, **Batalkan perubahan**); tombol simpan tidak dapat ditekan selama banner terpasang, dengan sebab yang terbaca | submit memakai versi basi; reload diam-diam yang menimpa isian pengguna; `disabled` tanpa sebab (§14.1.2) |
| `409 CONFLICT` (12) karena `expectedVersion` tidak cocok saat kirim | banner yang sama + `currentVersion` dari server; isian pengguna **dipertahankan** | menimpa suntingan admin lain; toast merah tanpa remedi (§11.7 butir 6) |
| `?fresh` setelah `PUT`/`approve` | klien sengaja mengirim `If-None-Match` yang gagal → resolver Primary; nilai efektif baru tampil setelah respons tiba | membaca nilai yang baru ditulis dari Replica (AGENTS §3.7) |
| kunci `SECURITY`/`REGULATORY` diminta peran tanpa hak baca | `value = null` + `masked: true` + `maskedReason = READ_ROLE_NOT_ALLOWED` → sel `—` + sebab dalam teks | `•••` untuk angka yang memang tidak pernah dikirim (§12.6); `403` untuk seluruh permintaan — satu kunci sensitif tidak menjatuhkan satu layar |
| mode `?at=` terisi | seluruh editor `readonly`, tombol simpan tidak dirender, `MetaRow` menyebut tanggal | menampilkan "simpan" yang pasti ditolak |
| `requiresRestart = true` (deviasi) | `Alert tone="warning"` di kepala drawer **dan** baris daftar: perubahan belum berlaku sampai restart terbukti; `409 PARAM_RESTART_REQUIRED` (112) dipetakan ke "disimpan, menunggu gerbang rilis {deployRef}", bukan "gagal" | menyebutnya "berhasil" (§11.9 butir 8) |

**Satu kalimat yang harus ada di layar ini** (kunci `admin.param.clientNotice`): "Angka-angka ini dibaca server pada titik keputusan; layar dan aplikasi mobile hanya menampilkannya, tidak pernah menjadikannya dasar keputusan akses." — mengikuti norma §4.16.5 (ambang keamanan dibaca server-side) dan §4.16.7 butir 7 (Flutter dilarang memutuskan akses dari angka itu).

### 14.8 Layar menu dinamis — `/admin/pengaturan/menu`

Objek: `menu_items` + `menu_permissions` (`0050`). Kontrak: `GET /api/v1/me/menu`, `GET`/`POST`/`PATCH`/`DELETE /api/v1/admin/platform/menus`, `GET`/`PUT …/{id}/permissions`, `GET …/menus/impact` (§4.17). Izin: `platform.menu.view` (158) · `.manage` (159) · `.grant` (160, `INSERT`) · `.revoke` (161, `DELETE`) — status **usulan**; sebelum menjadi baris katalog, layar ini tidak boleh diklaim selesai (AGENTS §3.8).

**Tata letak.** Dua panel: **pohon** (kiri ±40 %) + **detail/grant** (kanan, `Drawer` §9.2 — bukan form di bawah pohon, supaya deep link `?code=…` tetap bisa dibagikan). Tab `layer` di atas pohon: **Web · Mobile · Both**; satu pohon per platform, bukan dua sumber kebenaran.

#### 14.8.1 Pohon

Dua lapis ditampilkan terbuka (root + anak) adalah bentuk default yang diminta; kedalaman maksimum **4** ditegakkan server (`422 MENU_CYCLE` 115 + CI `DATA_MODEL §21.8(3)`), sehingga layar **menolak** membuat anak pada kedalaman 5 dengan sebab yang terbaca, bukan diam-diam.

- **Sampai primitif `tree` ada** (§14.13 `G-1`), daftar dirender sebagai **grup per root, urut `sort_order` lalu `code` dari server** — tanpa indentasi spasi dan tanpa `<select>` ber-spasi (§13.3). Baris = `role="treeitem"` dengan `aria-level`, ikon dari kolom `icon`, label (`labelKey` i18n didahulukan, fallback `label`/`label_en`), `Badge layer`, dan penanda `requiresMfa`.
- **Navigasi keyboard wajib sejak hari pertama**: panah atas/bawah pindah baris, `→` buka anak, `←` tutup/naik, `Enter` buka detail, gulir ke baris terpilih (`scrollIntoView`, `block: "nearest"`).
- **Empat keadaan per baris**, semuanya ikon + teks (tidak pernah warna saja): terlihat (`is_visible = true`), tersembunyi (`false` + teks "tersembunyi"), **modul belum aktif** (`Badge tone="warning"` "modul {module} belum aktif" — bedakan dari tersembunyi, penyebabnya entitlement), dan **kedaluwarsa** (`effective_to < hari ini` + tanggalnya).
- Baris **header/pemisah non-klik** (`routeKey = null`, sah) dirender tanpa tautan dan **tanpa** penanda "rusak".

#### 14.8.2 Urutan — `sort_order` dengan alternatif tanpa seret

Seret hanya kenyamanan; **dua jalur lain wajib ada**: (a) `Input inputMode="numeric"` 0–9999, (b) sepasang tombol naik/turun per baris (`Button` `size="icon-sm"` `variant="ghost"`, ikon `chevron-up`/`chevron-down`, `aria-label` menyebut nama menu). Karena server mengurutkan `ORDER BY sort_order, code`, layar **wajib** memberitahu konsekuensi nilai sama: "Nilai sama → urutan mengikuti `code`." UI dilarang menyortir ulang lokal (§13.2); setelah simpan, daftar dibaca ulang dari server. Copy bantuan menyarankan kelipatan 10 (`10 · 20 · 30`) supaya menyelipkan tidak menuntut penomoran ulang massal.

#### 14.8.3 Field detail menu (bentuk `MenuUpsertSchema` §4.17.2)

| Field | Kontrol | Aturan & kode |
|---|---|---|
| `code` | `Input` | `^[a-z][a-z0-9_.]{1,96}$`; `UNIQUE (tenant, layer, code)` → `409 CONFLICT` (12); label stabil — `code` tidak diganti hanya untuk memaksa terjemahan baru (§9.5) |
| `label` / `labelEn` | dua `Input` | dua wujud; menu statis tetap lewat `id.json`/`en.json`, menu rawat kampus adalah **data** (§13.1) |
| `routeKey` | `Select` dari registri kunci rute statis | **bukan** input bebas: `422 MENU_ROUTE_KEY_UNKNOWN` (118); `registry.unknownRouteKeys` wajib kosong (gerbang CI); `null` sah untuk pemisah |
| `layer` | `Select` `WEB · MOBILE · BOTH` | paritas AGENTS §3.4 |
| `moduleCode` | `Select` 19 modul entitlement (`packages/contracts/src/entitlement.ts`) | gerbang entitlement memotong lebih dulu dari role; `null` = menu tanpa gerbang modul |
| `icon` | `Select` nama ikon design system | **temuan yang harus diselesaikan §14.13 `G-5`**: kontrak mencontohkan nama `ri-*` (Remix) sementara `apps/web` hanya memuat `lucide-react` (`remixicon` tidak terpasang, grep = 0). Sampai ada satu peta `icon → komponen`, pratinjau menampilkan **nama ikon + kotak netral**, bukan ikon yang ditebak |
| `sortOrder` | lihat §14.8.2 | 0–9999, default 100 |
| `isVisible` | `Input type="checkbox"` | default `false` dan **tidak dapat** dinyalakan sebelum grant pertama ada ("tidak ada menu tanpa hak", §4.17.2); layar menampilkan sebab + tautan ke panel grant, bukan checkbox yang mati sendiri |
| `requiresMfa` | `Input type="checkbox"` | lihat §14.8.4 |
| `effectiveFrom` / `effectiveTo` | dua `Input type="date"` | `to > from`; jendela berlaku = keadaan **tampil tapi terkunci**, bukan hilang |
| `reason` | `Textarea` 10–500 | wajib setiap tulis menu/grant → `422 VALIDATION_FAILED` (6) bila kosong |
| `expectedVersion` | tersembunyi, diisi dari baris | `409 CONFLICT` (12) → banner muat ulang §14.7 |

**Hapus.** `DELETE` hanya bila tidak punya anak dan tidak dirujuk grant; `409 REFERENCE_IN_USE` (19) dirender sebagai **daftar `affectedSurfaces[]`** (anak mana, grant siapa) + dua pilihan sah: pindahkan anak lebih dulu, atau **`is_visible = false`** sebagai jalan keluar resmi (hapus lunak, pola RBAC baris 132). Untuk node yang punya riwayat, hard delete memang tidak tersedia dan itu **dijelaskan**, bukan disembunyikan.

#### 14.8.4 `requires_mfa` per menu — penanda, bukan penegakan

Dicentang pada menu tulis-admin (FR-IDT-01). Copy bantuan wajib menyebut status nyata: `admin.menu.mfa.note` = "Menu ini menuntut sesi bermulti-faktor. Yang menegakkan adalah guard di rute; kolom ini menandai dan menampilkan gembok. Penegakan MFA di rute hari ini masih terbuka (`G-07`)." Menuliskannya sebagai "menu ini sudah terkunci MFA" adalah klaim yang belum ditegakkan kode (AGENTS §3.8). Di pohon, menu `requiresMfa` menampilkan ikon gembok **dan** teks "MFA" (§11.10 butir 4).

#### 14.8.5 Grant menu (`menu_permissions`) — DENY harus terlihat berbeda dari ALLOW

`PUT …/{id}/permissions` menulis **seluruh set**; grant yang tidak dikirim = **dihapus** (§4.17.2, dan `PATCH` sebagian memang tidak disediakan). Konsekuensi UI: drawer menampilkan hitungan sebelum bisa disimpan — "Grant yang hilang bila Anda menyimpan: {count}" — dan `ConfirmDialog` wajib untuk set yang menghapus lebih dari nol baris.

| Elemen | Bentuk |
|---|---|
| `permissionCode` | `Select` dari katalog `permissions` (222 kode) — **bukan** input bebas; kode tak dikenal → `422 MENU_PERMISSION_UNKNOWN` (116) dengan `suggestions[]` kemiripan lokal, **tanpa egress** (AGENTS §3.9) |
| `effect` | dua pilihan. **ALLOW** = `Badge look="soft" tone="success"` + ikon `check` + teks `IZINKAN`. **DENY** = `Badge look="label" tone="danger"` + ikon `ban` + teks `SANGGALKAN` — varian `label` dipilih justru supaya keduanya tidak bisa tertukar oleh mata; di daftar, baris DENY tetap memakai ikon **dan** kata, bukan warna saja |
| `scopeKind` | `Select` `'' · TENANT · ORG · SITE · PROGRAM · CLASS`; nilai `''` berlabel manusiawi "warisi penugasan peran" (bukan "tanpa batas") |
| `note` | `Textarea` min 10 **wajib untuk DENY**; DENY tanpa catatan = temuan review, dan layar menolaknya sebelum kirim |
| `reason` | wajib untuk seluruh tulis grant |
| Urutan evaluasi | satu baris tetap: "Sanggalkan menang atas Izinkan → pola ter-spesifik menang → keputusan servis atas keadaan (periode `LOCKED`, gerbang, cekal) tetap lebih tinggi" |
| `revoke` | terjemahan `platform.menu.revoke` (verba `DELETE`) sebagai **aksi terpisah** dari menambah grant; setelah dicabut menu tidak tampil untuk peran itu — dengan catatan keras bahwa rutenya tetap dijaga |

**Peringatan eksplisit di layar (wajib dirender, bukan tooltip).** Di kepala panel grant, `Alert tone="warning"` dengan kunci `admin.menu.maskingNotice`:

> "Penyaringan menu hanya mengatur **terlihat atau tidak**. Rutenya tetap dijaga enam lapis (transport · identitas dari token · izin dari tabel penugasan · scope · keadaan · RLS). Menyembunyikan menu **tidak** mencabut hak siapa pun, dan menu yang tersembunyi tetap menjawab `403`/`404 MODULE_NOT_AVAILABLE` bila dibuka langsung."

Kalimat yang sama dipakai lagi di panel grant parameter §14.9 dan di kisi §15 — **tiga tempat, satu kunci, satu ejaan** (bukan tiga salinan: pola `RD-03`/`RD-12`).

#### 14.8.6 Pratinjau per peran

Pratinjau **dihitung dari hasil `GET …/{id}/permissions` yang menyertakan peran tersintesis** (server yang mensintesis, bukan klien yang menebak) dan **bukan** dari memanggil `/me/menu` sebagai orang lain — rute itu tidak menerima identitas orang lain dan tidak boleh menjadi jalan belakang.

Bentuk: tabel tiga kolom tetap (Peran · Hasil · Sebab), semuanya ikon + teks:

| Hasil | Kapan | Sebab yang ditampilkan |
|---|---|---|
| **Tampil** | grant `ALLOW` lolos, modul `ACTIVE`/`TRIAL`, penugasan peran aktif | — |
| **Terkunci** | cabang dikirim `disabled: true` + `blockedBy[]` | sebab dari server (`PERIOD_CLOSED`, `GATE_BLOCKED`) + `remedyHref` — "ada tapi terkunci" adalah informasi sah |
| **Tidak dikirim** | dipotong entitlement atau izin | **nama cabang yang dipotong tidak pernah ditampilkan**; yang tersedia hanya angka agregat `prunedCounts` (`byEntitlement`, `byPermission`) + `admin.menu.prunedNote`: "Jumlah potongan ditampilkan sebagai angka, tanpa daftar nama." |

Sakelar `layer` pada panel pratinjau memakai nilai yang sama dengan pohon, plus satu catatan paritas yang tertulis di layar: **bottom-nav Mobile adalah subset ber-elasi dari pohon yang sama; tidak ada daftar menu kedua di Dart.**

#### 14.8.7 Dampak menu

`GET /admin/platform/menus/impact?menuId=…` → "cabang mana hilang untuk peran mana", dirender sebagai daftar per peran beserta hitungan; hanya-baca, boleh Replica, dan **tanpa** nama cabang milik tenant/peran lain yang tidak tersaring untuk peminta (anti-oracle §4.17.1 butir 2).

### 14.9 Layar grant parameter (`parameter_permissions`)

Path `GET`/`PUT /api/v1/admin/system-parameters/patterns` (§4.16.4); izin `settings.param.pattern.manage` — **izin menulis pola, bukan izin mengubah nilai**, dan layar harus mengatakannya di baris pertama.

| Field | Kontrol | Aturan |
|---|---|---|
| `parameterPattern` | `Input` mono | divalidasi pola `^[a-z][a-z0-9_]*(\.[a-z0-9_*$]+)+$` (CHECK `0050`); tidak sah → `422 PARAM_PATTERN_INVALID` (114) dengan pola yang tadi diketik ditampilkan kembali; contoh sah di baris bantuan: `finance.*`, `attendance.totp_*`, `grading.publish_deadline` |
| Kunci yang dicocokkan | daftar read-only | diambil **langsung dari server** atas kunci yang kena pola (10 baris pertama + "dan {count} lainnya"); penangkal rujukan hantu — CI `DATA_MODEL §21.8(4)` menolak pola non-wildcard yang tidak menunjuk kunci nyata, dan layar menampilkan kosong **sebelum** menyimpan |
| `permissionCode` | `Select` katalog | tak dikenal → `422 MENU_PERMISSION_UNKNOWN` (116), kode yang sama dengan grant menu karena keadaannya identik |
| `effect` | `ALLOW`/`DENY` dengan bentuk §14.8.5 | DENY menang atas ALLOW — digambar di baris evaluasi, bukan diasumsikan |
| `minScope` | `Select` `TENANT · ORG · SITE · PROGRAM` | scope pemegang harus **setidaknya** seketat ini; dibuktikan `holdsScoped` (L4, `SEC-11`) |
| `requiresMfa` | `Input type="checkbox"` | boleh dinyalakan; tidak pernah boleh dimatikan untuk kelas yang menuntutnya |
| `requiresSecondApprover` | **bukan checkbox**: `Badge look="label" tone="danger"` "WAJIB KELAS" untuk `SECURITY`/`REGULATORY`, redup + sebab, dan tidak terkirim (turunan server, `SERVER_ONLY` §4.16.6) | `admin.grant.secondApproverMandatory`: "Untuk kelas `SECURITY` dan `REGULATORY`, penyetuju kedua adalah turunan `risk_class` — tidak dapat dimatikan dari layar ini." |
| `note` | `Textarea` 10–500 | **wajib**: pola tanpa catatan ditolak (CHECK + review) |
| `validFrom` / `validTo` | dua `Input type="date"` | grant punya jendela; grant kedaluwarsa tidak dihitung dan itu tampil sebagai penanda di daftar |
| `reason` | `Textarea` | wajib untuk tulis; `Idempotency-Key` di belakang setiap kirim |

**Panel prediksi evaluasi** (harus ada, karena pola adalah tempat kebingungan). Untuk satu kunci contoh yang dipilih pengguna, layar menampilkan hasil deterministik: `ALLOW` dari pola mana yang menang, `DENY` mana yang memotong, dan **kalahnya pola terhadap `CHECK` servis untuk kelas `SECURITY`** (§4.16.4 butir evaluasi 3) — `admin.grant.securityOverride`: "Kelas `SECURITY`: grant apa pun tidak dapat melonggarkan batas basis data. Nilai di bawah {min} tetap ditolak." Prediksinya dihitung **server** (satu jalur evaluasi), bukan disimulasikan klien — simulasi lokal = sumber kebenaran kedua.

**Konflik dua baris `ACTIVE`** dengan spesifisitas sama adalah konfigurasi rusak: `409 CONFLICT` (12) menampilkan **kedua kandidat** + `remedyHref`, bukan "yang terakhir menang".

### 14.10 Matriks komponen, keadaan, dan aksesibilitas per layar

| Layar | Primitif yang dipakai | Keadaan wajib | Aksesibilitas kunci |
|---|---|---|---|
| Daftar parameter §14.1 | `PageHeader` · `MetaRow` · `VelzonDataGrid` · `Badge` · `StatusBadge` · `Input`/`Select` · `Skeleton` · `Alert` | loading · empty · error · rekonstruksi · pointer | label filter terkait `id` lewat `Field` · baris terbuka lewat keyboard · `.tabular` · `aria-live` hanya saat hasil saringan berubah |
| Editor per tipe §14.2–§14.3 | `Drawer` · `Card` · `Field`/`Input`/`Textarea`/`Select` · `Progress` · `Badge` · `ConfirmDialog` | loading · idle · galat batas · ditolak `CHECK` · gerbang MFA · tunggu restart | `aria-invalid` + `aria-describedby` dari `Field` · pesan sebab-akibat, bukan kode · target ≥ 44 px |
| Alur persetujuan §14.4 | `Card`/`StatCard` · `StatusBadge` · `Badge` · `Textarea` · `Button` · `ConfirmDialog` · `toast` | PENDING · APPROVED · REJECTED · CANCELLED · sudah terminal · self-approval | `role="status" aria-live="polite"` **hanya** saat keadaan berubah · pemohon tidak melihat tombol sahkan · kontras AA dua tema |
| Riwayat & revert §14.5 | `Table` · `Badge` · `ConfirmDialog` · `Input type="date"` · `Alert` | loading · empty · error · salinan baca tertinggal · kolom tereduksi | diff `−`/`+` + teks · `requestId` mono dengan `aria-label` salin · gulir tipis |
| Dampak §14.6 | `Alert` · `Badge` · `Table` · tautan | loading · empty (parameter hantu) · error · `orphanKeys` | daftar teks, bukan grafik-saja · tautan dapat dibuka keyboard |
| Keadaan versi §14.7 | `Alert` lengket · `Button` · `Badge` | fresh · stale · conflict · masked · tunggu restart | penolakan submit selalu disertai sebab terbaca · `prefers-reduced-motion` tidak menghilangkan banner |
| Pohon menu §14.8 | `Card` · `Badge` · `Input`/`Select` · `Dropdown` · `Accordion` (sementara) · `Button` icon · `toast` | loading · empty · error · siklus ditolak · kedalaman penuh · tersembunyi · kedaluwarsa · modul nonaktif | navigasi panah + `aria-level` · alternatif tanpa seret · ikon + teks |
| Grant menu & parameter §14.9 | `Drawer` · `Table` · `Badge` (ALLOW/DENY) · `Field`/`Select`/`Textarea` · `ConfirmDialog` · `Alert` | loading · empty · pola tidak sah · kode tak dikenal · konflik set · penghapusan menunggu konfirmasi | `note` wajib lewat `Field` error · peringatan masking bukan tooltip · 44 px |

**Paritas Web ↔ Flutter (AGENTS §3.4).** Layar **tulis** parameter, pohon menu, kisi §15, dan panel grant adalah **Web-only** — pengecualian platform yang sah dan tercatat (pola §12.10), bukan hilang diam-diam: Flutter tidak punya layar tata kelola. Yang **wajib** ada di Flutter hanyalah (1) **persetujuan** permintaan parameter yang menunggu (`…/system-parameter-approvals/{id}/approve`/`reject` di alur §9.6) dan (2) **membaca** `GET /settings/effective` untuk ambang tampilan (mis. persen kehadiran di kartu presensi §16.3), dengan larangan memakai angka itu sebagai dasar keputusan akses. Daftar menu Mobile dibaca dari rute yang sama dengan `layer=MOBILE`.

### 14.11 Kunci i18n `admin.param.*`, `admin.menu.*`, `admin.grant.*` (belum ada satu pun)

Terukur 2026-10-20: `id.json` hanya memuat `auth`, `dashboard`, `navigation`, `landing`. Gugus yang dispesifikasi (bentuk kunci identik untuk Web JSON dan Flutter ARB; semuanya **spesifikasi**, bukan catatan kondisi):

```
admin.param.list.{title,description,colKey,colModule,colValue,colDefault,colRange,colRisk,colScope,colVersion,colStatus}
admin.param.filter.{module,riskClass,q,includeInactive,editableOnly,at}
admin.param.risk.{TECHNICAL,OPS,ACADEMIC,FINANCIAL,REGULATORY,SECURITY}
admin.param.status.{active,inactive,hiddenModule,expired,pointerIndex,unboundedRange}
admin.param.disabled.{notParamSource,noEditGrant,checkLocked,moduleInactive}
admin.param.editor.{reasonLabel,reasonCounter,appliesTo,inheritedScope,impactLine,effectiveNow,proposedValue,diffTitle}
admin.param.range.{between,allowedValues,unitSuffix,noLimit,pctHint,bpHint,cronPreview,cronPreviewUnavailable}
admin.param.riskCopy.{totpRotate,geofenceRadius,gpsAccuracy,clockSkew,onlineMinJoin,multiSourcePolicy}
admin.param.pending.{submitted,effective,approvers}
admin.param.error.{outOfRange,readOnly,invalidType,enumUnknown,secretForbidden,restartRequired,approvalRequired,patternInvalid,permissionUnknown,conflictVersion,selfApproval,alreadyDecided,notFound}
admin.param.mfa.gate
admin.param.sod.{grantHolder,securityClass}
admin.param.stale.{title,reload,cancel,detail}
admin.param.mode.{readonlyReconstruct,clientNotice}
admin.param.history.{title,empty,rangeFrom,rangeTo,source,approver,redactedNotice,replicaLag,revert,revertConfirm,revertReason}
admin.param.impact.{title,empty,orphan,ciDebt,groupMenu,groupService,groupDictionary,groupPattern,openingLine}
admin.param.register.{title,consumerHint,consumerMissing,dataTypeUnit,riskClassHint}
admin.menu.tree.{title,layerWeb,layerMobile,layerBoth,depthLimit,cycleRejected,sortStep,sortTie}
admin.menu.field.{code,label,labelEn,routeKey,layer,module,icon,sortOrder,isVisible,requiresMfa,reason}
admin.menu.state.{visible,hidden,expired,moduleOff,divider}
admin.menu.maskingNotice
admin.menu.mfa.note
admin.menu.grant.{allow,deny,scope,noteRequired,wholeSetWarning,removedCount,evaluateOrder,revoke,grantFirst}
admin.menu.preview.{title,shown,locked,pruned,prunedNote,roleColumn,cause}
admin.menu.impact.{title,children,grants}
admin.menu.delete.{blocked,affected,deactivateInstead}
admin.grant.pattern.{title,pathExample,matchedKeys,matchedEmpty,minScope,secondApproverMandatory,mfa,validWindow,prediction,securityOverride,conflictPair}
admin.errors.{107,108,109,110,111,112,113,114,115,116,118}
```

Aturan sama seperti §12.11 dan §13.9: parameter bernama (`{min}`, `{max}`, `{unit}`, `{value}`, `{count}`, `{at}`, `{n}`, `{deployRef}`, `{riskClass}`), **tanpa konkatenasi kalimat**, daun `id` = daun `en` sebagai gerbang CI (`RD-19`), nol string UI di JSX/Dart (AGENTS §3.5), dan baris `admin.errors.*` **wajib** memuat **sebab + langkah perbaikan** (§4.16.5 i18n) — pesan generik "data belum lengkap" adalah kegagalan layar, bukan kegagalan pengguna.

### 14.12 Definition of Done lapisan tata kelola parameter & menu

- [ ] **GP-1** Daftar parameter menampilkan **seluruh** kolom kontrak §4.16.1 (`min`, `max`, `defaultValue`, `currentValue` kawat + `value` bertipe, `effective.*`, `riskClass`, `version`, `isEditable`, `requiresSecondApprover`); satu kolom hilang = layar ditolak.
- [ ] **GP-2** Nol batas hardcoded: semua `min`/`max`/`step`/`unit`/daftar sah bersumber dari respons (§11.9 butir 5). Uji komponen memberi respons `min: 5, max: 30` dan membuktikan tidak ada angka itu di JSX.
- [ ] **GP-3** Kelas `SECURITY`/`REGULATORY` tidak pernah punya kontrol tanpa batas; nilai di luar rentang ditolak **dengan copy risiko** (§14.3) dan penolakan `CHECK` disebut sebagai penolakan basis data.
- [ ] **GP-4** Setiap `is_editable = false` memakai salah satu dari empat sebab + pemilik hak + tautan; tidak ada `disabled` tanpa kalimat (§14.1.2).
- [ ] **GP-5** Baris pointer dirender `—` + penanda `INDEKS PENEMUAN` + tautan rumah kanonik; uji: `currentValue` tidak pernah ada di payload baris pointer dan tidak ada angka salinan di DOM.
- [ ] **GP-6** Alur §14.4: `reason` wajib, diff `old → new` + `effectiveValue`/`proposedValue` berdampingan, gerbang MFA sebelum kirim untuk dua kelas, kartu PENDING dengan `aria-live="polite"`, dan **pemohon tidak pernah melihat tombol sahkan untuk dirinya** (56) — dibuktikan uji peran, bukan dibaca mata.
- [ ] **GP-7** Riwayat: insert-only (nol tombol ubah/hapus), revert menghasilkan **entri baru** beralasan, `ip`/`changed_by` hanya untuk pemegang izin riwayat (proyeksi server, §11.9 butir 6).
- [ ] **GP-8** Dampak: cabang "daftar kosong = parameter hantu" dan `orphanKeys` sebagai tunggakan CI teruji; setiap item menaut ke **satu** jalur kanonik per objek.
- [ ] **GP-9** Keadaan basi: `X-Parameter-Version`/`ETag`/`If-None-Match` terbukti dipakai (uji jaringan: navigasi kedua `304`; `409 CONFLICT` mempertahankan isian); submit dengan versi basi mustahil.
- [ ] **GP-10** Pohon menu: navigasi keyboard penuh, alternatif `sort_order` tanpa seret, kedalaman > 4 dan siklus ditolak dengan sebab, `isVisible` tidak bisa menyala tanpa grant pertama, `routeKey` hanya dari registri (118).
- [ ] **GP-11** Grant: DENY terlihat berbeda dari ALLOW (varian + ikon + teks), `note` wajib untuk DENY, `PUT` whole-set mengumumkan jumlah penghapusan, `requiresSecondApprover` **tidak dapat** dimatikan untuk dua kelas, dan peringatan "penyaringan menu bukan kontrol akses" **terbukti dirender** di layar.
- [ ] **GP-12** Mutu & a11y seluruh §14: kontras AA dua tema (`contrast-audit.mjs` FAILS = 0), target sentuh ≥ 44 px, `aria-live` untuk keadaan penyetujuan, label terkait `id` dari `Field`, nol `font-black`/`font-extrabold` (§11.2), nol paket baru (§11.11.1), dan nol komponen karangan — yang belum ada ditandai task §14.13 dan dirender dengan primitif nyata.

### 14.13 Butuh keputusan pemilik lain (bukan kewenangan desain)

- **G-1** Primitif `tree` (atau perluasan `Accordion`) + padanan Material di Flutter — pemilik slice `ADM-1` (satu daftar dengan `F-2`). Sampai ada, §14.8.1 dirender sebagai grup urut `sort_order, code` dengan `aria-level`; itu **keadaan sementara yang tercatat**, bukan bentuk final.
- **G-2** Primitif `Switch` dan `Slider` di `components/ui` — pemilik `TECH_CONVENTIONS §6` + slice `ADM-1`. Hari ini keduanya **tidak ada**, jadi §14.2 memakai `Input type="checkbox"` dan `Progress`: itu konsekuensi §11.3, bukan kemunduran visual.
- **G-3** Editor JSON berwarnai/diff struktural — harus diputus **tanpa paket baru** (vonis §11.11.1). `Textarea` + `JSON.parse` + diff baris (§12.3) memadai untuk v1; sisanya slice kode.
- **G-4** Pemeta `CRON` → lima kejadian berikutnya + penjelasan manusia. Pemilik: `packages/contracts` (fungsi murni, **satu** sumber untuk scheduler dan layar). Tanpa satu sumber itu, pratinjau **tidak** ditampilkan — mengarang jadwal di klien = sumber kebenaran kedua.
- **G-5** Penamaan `menu_items.icon`. Kontrak mencontohkan `ri-*` (Remix) sementara `apps/web` hanya memuat `lucide-react` dan `remixicon` tidak terpasang (grep = 0). Pemilik: `TECH_CONVENTIONS §6` + `API_SPEC §4.17`. Yang tidak boleh terjadi: memasang paket ikon kedua demi satu kolom.
- **G-6** Field keadaan persetujuan pada `GET …/system-parameter-approvals/{id}` (`approvalId`, `allowedActors`, `expiresAt`) — pemilik `API_SPEC §4.16.3`; kartu §14.4 tidak boleh mengarang angka kedaluwarsa.
- **G-7** Promosi baris izin 146–161 dari **usulan** menjadi katalog `PERMISSION_SPECS` + seed `permissions` (`gen-rbac-seed.mjs` dijalankan ulang) — pemilik `RBAC_MATRIX §4.5`. Sebelum itu, §14 hanya boleh dibangun sebagai **spec** (AGENTS §3.8).
- **G-8** `Idempotency-Key` dan gerbang rilis untuk `requires_restart` (pipeline `DEPLOYMENT_DEVOPS §4`) — pemilik DevOps; copy §14.7 menyebut "gerbang rilis" tanpa mengklaimnya berjalan.
- **G-9** Konsumer statis `parameter_key` (registri `parameter-keys.ts`) — pemilik `DATA_MODEL §21`/CI gerbang (n). Tanpa registri, panel dampak §14.6 hanya dapat menampilkan dua dari tiga sumber dan **wajib** menyebut sumber yang belum ada, bukan menyamar lengkap.

---

## 15. Kisi otorisasi sub-detail (RBAC grid) — peran × modul × menu × sub-menu × parameter × tombol, 2026-10-20

> **Dasar & pemilikan.** Katalog peran, 222 izin `resource × verb`, matriks Role × Modul × Menu × Aksi, aturan SoD/ABAC/PII = [RBAC_MATRIX.md §2/§4/§6](file:///c:/SICA/docs/RBAC_MATRIX.md); hak tingkat field & tujuh normanya = [BLUEPRINT_ROLE_BY_ROLE.md §0.3](file:///c:/SICA/docs/BLUEPRINT_ROLE_BY_ROLE.md) (mekanisme `FIELD_RULES`, `SERVER_ONLY`); objek `menu_items`/`menu_permissions`/`parameter_permissions` = `DATA_MODEL §21.7`; transport = `API_SPEC §4.17` (menu) + §4.6/§4.16 (grant & parameter). Yang dimiliki **bagian ini**: bentuk kisi, cara baris banyak dirender tanpa paket baru, bentuk lencana verba, penanda asal keputusan, peringatan SoD, dan apa yang tidak boleh dikirim ke klien.
>
> **Status: spesifikasi.** Terukur 2026-10-20 di [`packages/contracts/src/authz.ts`](file:///C:/SICA/packages/contracts/src/authz.ts): `PERMISSION_VERBS` enam nilai sudah ada (baris 87), `PERM`/`PERMISSION_SPECS`/`ALL_PERMISSION_CODES` sudah ada (376–383), `SCOPE_KINDS` ada (56), `MUTUALLY_EXCLUSIVE_ROLES` berisi **satu** pasangan (`ADMIN_FINANCE`/`TREASURER`, baris 659) dan `violatesSoD()` ada (674); **`FIELD_RULES` belum ada** (grep = 0) sehingga kisi kolom hari ini tidak punya sumber; `holdsScoped` terdefinisi di [`rbac-resolver.ts:122`](file:///C:/SICA/apps/web/src/modules/authz/rbac-resolver.ts) dengan **nol pemanggil di rute tulis** (`SEC-11`); tidak ada pustaka virtualisasi di `apps/web/package.json`.

### 15.1 Enam sumbu, satu bentuk: kisi bertingkat, bukan matriks raksasa

| Sumbu | Kontrol pemilih | Sumber nilai | Aturan |
|---|---|---|---|
| Peran | `Select` (22 peran normatif + usulan **terdaftar**) | `ROLE_CODES` di `authz.ts` | bukan string bebas, bukan label carrier (`member_role` hanya pembawa login — AGENTS §3.8); pilihan usulan diberi penanda `Badge` "usulan" |
| Modul | `Select` 19 modul entitlement | `packages/contracts/src/entitlement.ts` | modul non-`ACTIVE`/`TRIAL` ditandai **entitlement**, bukan izin: sel-nya tampil sebagai "modul belum dibeli", bukan "tidak diizinkan" |
| Menu (root) | daftar `menu_items` layer terpilih | `GET /admin/platform/menus?layer=` | urutan dari server (`sort_order, code`, §13.2); tautan ke §14.8 untuk merawatnya |
| Sub-menu (leaf) | expander per root | respons yang sama (`children`) | kedalaman > 4 tidak mungkin (115); leaf tanpa `routeKey` = pemisah, tidak punya sel aksi |
| Tombol/aksi | **kolom tetap enam verba** §15.3 | `PERMISSION_VERBS` | 10 aksi pengguna dipetakan ke 6 verba (BLUEPRINT §0.4): `LOCK`/`UNLOCK`/`EXPORT` = `OTHER` terdaftar, `PARAM_EDIT` = `UPDATE` pada `resource='settings'` ber-pola, `APPROVE`/`REJECT` = dua hasil dari satu verba `VALIDATE`. **Verba baru dilarang** |
| Parameter & kolom | expander ketiga: kelas risiko + daftar field | §14 (parameter) + `FIELD_RULES` (kolom, **belum ada**) | sel hanya menampilkan hak, **tidak** pernah nilai parameter; menulis nilai tetap lewat §14.4 |

**Tata letak.** Baris = peran (atau satu pengguna bila mode "penugasan orang"), kolom = enam verba. Setiap baris punya **expander** ke rantai modul → menu → sub-menu → parameter, sehingga satu layar menjawab "kenapa tombol ini tidak muncul untuk saya" tanpa berpindah dokumen. Di kepala kisi: `MetaRow` (§11.4) berisi scope aktif (`TENANT`/`ORG`/`PROGRAM`/`SITE`/`CLASS` + nama objeknya), `valid_to` penugasan, dan tanggal pembacaan.

**Dua keadaan sel yang harus beda dan wajib terbaca berbeda:** "tidak diizinkan" (deny/absent) dan "tidak berlaku di scope ini" (bukan salah konfigurasi). Sel kosong tanpa sebab adalah pertanyaan yang berakhir sebagai permintaan SQL manual ke tim platform — persis BENCHMARK D-4 yang dihindari §9.1.

### 15.2 Kapasitas: baris tervirtualisasi tanpa menambah paket

Angka yang harus diterima lebih dulu: 222 izin × 22 peran ≈ **4.900 sel**, dan rantai menu menambah dua tingkat lagi. Yang **dilarang**: merender semuanya sekaligus, dan yang **dilarang** pula: memasang `react-window`/`@tanstack/react-virtual`/pustaka apa pun demi satu layar (vonis §11.11.1 berlaku di sini — keputusan dependensi bukan keputusan desain).

**Empat mekanisme yang ditetapkan, berurutan:**

1. **Server pagination sebagai tulang punggung.** Pembacaan kisi memakai amplop `§2.4` dengan `page`/`limit` (plafon 100 seperti §4.16.1). Kisi **tidak** pernah menerima katalog penuh.
2. **Expand-per-sumbu (lazy).** Rantai modul/menu/parameter untuk satu baris diambil **saat expander dibuka**, dan hasil per baris disimpan di cache klien (`@tanstack/react-query` sudah terpasang — `apps/web/package.json:18`). Menutup expander tidak membuang hasil; membukanya lagi tidak memanggil ulang bila versi sama (`ETag`, pola §14.7).
3. **Windowing lokal sebagai task, bukan asumsi.** Untuk daftar panjang di dalam satu expander (mis. 90 kolom field), spesifikasi meminta jendela render ±40 baris dengan `overscan` dan posisi gulir yang dipertahankan. Karena primitifnya belum ada, ini menjadi **`RG-*` → task `H-1`** (pemilik slice `ADM-1`, satu daftar dengan `G-1`/`F-2`); sebelum task itu selesai, yang dipakai adalah paginasi (1) dan itu **tidak** boleh ditulis sebagai "sudah virtual".
4. **Read path sadar topologi.** Kisi hanya-baca → boleh ke **Replica**; **kecuali** tepat setelah tulis grant/penugasan, maka wajib Primary + `If-None-Match` yang sengaja gagal (AGENTS §3.7 read-your-writes; pola §14.7). Cache izin TTL 5 menit dari `RBAC_MATRIX §4.5` **tidak** boleh dipakai untuk layar ini: kisi yang menampilkan izin ter-cache tetapi sudah dicabut adalah empat titik kegagalan wajib-uji yang disebut AGENTS §3.8.

**Stabilitas saat baris banyak.** Kepala kolom `sticky`; `caption` + `scope="col"`/`scope="row"`; `keyExtractor` = `permissionCode` (stabil), **bukan** indeks baris — baris yang bergerak setiap saringan berubah membuat pembaca layar dan jari pengguna kehilangan tempat. Setelah simpan, baris yang disunting **selalu** tampil (halaman pertama + `Badge` "baru disimpan"), bukan hilang ke halaman 3.

### 15.3 Lencana enam verba kanonik — kolom aksi tidak pernah berupa teks bebas

Label dibaca dari kamus verba (satu pemilik, pola `labelForStatus` §11.3/§13.3) — bukan string per layar. Kontras diukur untuk varian `label` (teks solid) di dua tema (§11.10 butir 1).

| Verba | Label Indonesia | Kelas lencana | Nada | Ikon | Arti sel |
|---|---|---|---|---|---|
| `READ` | Lihat | `look="soft"` | `primary` | `eye` | boleh membaca proyeksi |
| `INSERT` | Tambah | `look="soft"` | `success` | `plus` | boleh membuat baris baru |
| `UPDATE` | Sunting | `look="soft"` | `warning` | `pencil` | boleh mengubah nilai (termasuk `PARAM_EDIT`) |
| `DELETE` | Hapus | `look="soft"` | `danger` | `trash-2` | termasuk hapus lunak/`deactivate` sesuai katalog |
| `VALIDATE` | Sahkan / Tolak | `look="label"` | `info` | `shield-check` | persetujuan; **selalu** berdampingan dengan penanda empat-mata §15.5 |
| `OTHER` | Proses | `look="soft"` | `secondary` | `settings-2` | hanya aksi yang **terdaftar eksplisit** (`LOCK`, `UNLOCK`, `EXPORT`) — bukan tempat sisa (AGENTS §3.8) |

**Tiga keadaan sel non-izin**, semuanya ikon + teks, tidak pernah warna saja:

| Keadaan | Bentuk | Copy |
|---|---|---|
| Tidak diizinkan | `Badge look="soft" tone="secondary"` + ikon `minus` + teks `TIDAK` | "Tidak ada baris grant untuk verba ini." + tautan "ajukan permintaan" (`access_change_requests`) |
| Ditolak eksplisit | lihat §15.4 (DENY) | menyebut baris mana yang menolak |
| Tidak berlaku | `—` (tanda pisah em) tanpa lencana | "Objek ini tidak punya aksi {verb}." — bukan "tidak", supaya tidak disalahbaca sebagai pencabutan |

### 15.4 Asal keputusan: katalog · didelegasikan oleh pola · ditolak DENY

Satu sel boleh **hanya** dipercaya kalau tahu dari mana angkanya. Kolom "Asal" (selalu tampil, tidak pernah masuk tooltip) punya empat bentuk:

| Asal | Penanda | Muatan yang wajib terlihat |
|---|---|---|
| Katalog peran | ikon `database` + teks `KATALOG` | `permissionCode`, sumber `SYSTEM_ROLE_GRANTS`/`role_permissions`, penugasan + `scope_kind` + `valid_to` |
| **Didelegasikan** (pola) | ikon `git-branch` + `Badge look="soft" tone="info"` teks `DELEGASI` | `parameter_pattern`/grant yang memicunya (mis. `pmb.*` ke `PMB_OPERATOR`), pemilik baris, `min_scope`, jendela `valid_from`/`valid_to`, dan **kelas** yang didelegasikan |
| **Ditolak** (DENY) | `Badge look="label" tone="danger"` teks `DITOLAK — DENY` + ikon `ban` | baris DENY mana (pola + `note` wajib + siapa pembuatnya) + kalimat "Sanggalkan menang atas Izinkan" |
| Basi / kedaluwarsa | `Badge look="soft" tone="warning"` teks `DICABUT` atau `KEDALUARSA` | `valid_to` atau `expires_at` yang membuat hak tidak berlaku **hari ini** — ini keadaan yang diuji, bukan diasumsikan (AGENTS §3.8: "izin ter-cache tapi sudah dicabut") |

**Konflik** (dua baris `ACTIVE` dengan spesifisitas sama) dirender sebagai **kedua kandidat** + `remedyHref`, mengikuti norma `409 CONFLICT` §4.16.4 — bukan "yang terakhir menang". **Kalah terhadap servis:** untuk kunci kelas `SECURITY`, sel `UPDATE` tetap tampak granted (hak memang ada), tetapi di bawahnya selalu ada satu baris penjelasan `rbac.grid.securityCeiling`: "Walau hak ada, nilai di bawah {min} {unit} ditolak basis data." Keadaan ini nyata (`API_SPEC §4.16` pembuka, `DATA_MODEL §21.8` butir 2) dan wajib tertulis supaya kisi tidak menjanjikan lebih banyak daripada yang sistem menegakkan.

### 15.5 Peringatan SoD di layar — sebelum tulis, bukan sesudah laporan

Empat penegakan yang jadi tanggung jawab layar ini:

1. **Pasangan peran saling eksklusif** (BR-K2). Sebelum grant/peran kedua ditulis, kisi menjalankan sumber kebenaran `MUTUALLY_EXCLUSIVE_ROLES` dari `authz.ts` (hari ini satu pasangan: `ADMIN_FINANCE` × `TREASURER`). Bila calon pemegang sudah punya satu peran, penugasan kedua **tidak dapat dipilih** dan alasannya ditampilkan; layar **dilarang** menyimpan daftar pasangan sendiri di JSX (itu sumber kebenaran kedua — §13.1).
2. **Satu orang = pemohon sekaligus penyetuju.** Kolom khusus "risiko SoD" pada setiap baris `VALIDATE` menghitung pengguna di scope yang memegang **kedua** kode (permohonan dan persetujuan) untuk pasangan aksi yang sama: `finance.invoice.void`, `finance.waiver.approve`, `grading.unlock`, `settings.param.approve.regulatory`, `settings.param.approve.security`, `parameter_permissions` (empat-mata `CHECK approved_by <> requested_by`). Bila hitungannya > 0: `Alert tone="danger"` + daftar (nama + peran + scope) + dua remedi yang sah ("cabut salah satu", "beri tugas ke orang lain"), dan tombol simpan **tidak** muncul sebelum konflik nol — karena `SELF_APPROVAL_FORBIDDEN` (56) akan menolaknya di belakang dan itu berarti layar menawarkan aksi yang pasti gagal.
3. **SoD anti-pelonggaran kelas `SECURITY`** (`G-19`): pemegang `settings.param.edit.security` yang juga memegang izin atas objek yang dijaga ambangnya ditandai di kisi, dan dari sana hanya ada satu jalan: §14.3 (ajukan, bukan longgarkan sendiri).
4. **Empat titik kegagalan wajib diuji, tidak diasumsikan** (AGENTS §3.8): izin cukup tapi data prodi lain · izin ter-cache tapi sudah dicabut · `tenant_id` benar tapi periode salah · filter di query tapi RLS tidak aktif. Kisi menyediakan **satu aksi "uji proyeksi"** per baris grant yang sedang dibuka (bukan per sel — 4.900 tombol bukan layar, itu beban): pemanggil memilih peran + scope + tanggal, sistem memanggil `GET` proyeksi untuk kombinasi itu dan melaporkan apa yang **benar-benar** terbaca, bukan apa yang seharusnya. Hasilnya dirender sebagai baris temuan (`rbac.grid.test.finding`), bukan sebagai centang hijau; dan aksi ini hanya-baca, tidak pernah menulis apa pun.

### 15.6 Proyeksi server untuk hak tingkat field

Aturan induk: **field yang tidak boleh dilihat tidak pernah meninggalkan server** (§13.5, AGENTS §3.8). Kisi menampilkan sub-axis kolom hanya untuk pemegang izin grant, dengan empat keadaan per field:

| Keadaan field | Yang dirender kisi | Yang dikirim API ke peran terkait |
|---|---|---|
| Lihat + sunting | dua lencana (`Lihat`, `Sunting`) + jendela `valid_to` | field ada di payload tulis whitelist L1 |
| Lihat saja | `Lihat` + baris "hak sunting: peran {X}" (§9.8 butir 2) | field hanya di payload baca |
| **`SERVER_ONLY`** | `Badge look="label" tone="secondary"` `SERVER_ONLY` + sebab "hanya berubah lewat transisi state" | field **tidak pernah** diterima dari body; kehadirannya di body = `422` (`grades.status`, `grades.letter`, `invoices.status`, `payments.status`, `ledger.*`, `enrollments.status`, `students.nim`, `students.status_akademik`, `mfa_factors.secret`, `pddikti_*_id` + daftar tambahan §4.16.6) |
| **Tidak dikirim** | `—` + sebab + peran yang berhak | kunci JSON **tidak ada** di respons. Contoh kanonik: `advisor_notes.visibility = 'ADVISOR_ONLY'` tidak pernah diproyeksikan ke peran `STUDENT` (`DATA_MODEL §18.3`) |

**Nominal keuangan** memakai aturan SoD BAAK ↔ BAUK: peran akademik tanpa hak menerima boolean **tertahan/tidak** beserta sebab, bukan angka (`AGENTS §3.8`, `§14.7` pola `masked`); kisi menandai field itu `MASKED` dengan rujukan kelas izinnya, bukan menampilkan nol.

**Bentuk uji yang diterima di review**: asersi bahwa kunci field **tidak ada di payload** (pola DF-5), bukan bahwa selnya `hidden` — menyembunyikan kolom dengan CSS adalah temuan §11.9 butir 6, dan menandai `readOnly` di klien untuk field `SERVER_ONLY` adalah cara cepat mengirimnya kembali di body.

### 15.7 Keadaan dan aksesibilitas kisi

| Keadaan | Yang dirender | Larangan |
|---|---|---|
| loading | `Skeleton.Table` dengan jumlah baris = tinggi kisi, expander tetap non-interaktif | spinner bulat (§11.7 butir 5) |
| empty (peran tanpa grant) | `Alert tone="info"` "Peran {X} tidak memegang izin pada modul {Y}" + tautan `role_permissions` kanonik | menampilkan kisi penuh bernilai "TIDAK" yang menyerupai pencabutan |
| error | pemetaan §2.3 dengan `Field`-level cause: `422 MENU_PERMISSION_UNKNOWN` (116) menempel ke input kode, `422 PARAM_PATTERN_INVALID` (114) ke input pola | toast merah tanpa remedi |
| `403` saat membuka kisi peran lain | baris "siapa pemegang hak berikutnya" (§9.8 butir 2) | menolak telanjang |
| konflik /SoD §15.5 | banner + daftar pemegang + remedi; simpan terkunci sampai nol | menawarkan tombol yang pasti ditolak 56 |
| salinan baca tertinggal | footer `text-xs` + aksi "Muat ulang (primer)" (§14.5 pola sama) | menyimpulkan "izin sudah dicabut" dari angka basi |

**A11y.** Navigasi keyboard penuh antar sel (`Tab` per baris, panah antar kolom, `Enter` membuka expander); kepala kolom `sticky` dengan `scope`; setiap lencana punya teks (verba tidak pernah diwakili warna saja — §11.10 butir 4); target sentuh ≥ 44 px termasuk tombol expander dan checkbox grant; `aria-expanded`/`aria-controls` pada expander; pengumuman hasil simpan lewat `role="status" aria-live="polite"` **satu kali** per aksi; `prefers-reduced-motion` mematikan sapuan expander, tidak menghilangkan isinya; kontras AA dua tema untuk keenam verba (varian `label` `info`/`danger` adalah yang paling rawan — §11.10); `.tabular` untuk tanggal `valid_to` dan hitungan pemegang.

### 15.8 Kunci i18n `rbac.grid.*` dan Definition of Done

```
rbac.grid.axis.{role,module,menu,submenu,action,parameter,field}
rbac.grid.verb.{READ,INSERT,UPDATE,DELETE,VALIDATE,OTHER}
rbac.grid.state.{granted,notGranted,denied,delegated,revoked,expired,notApplicable,masked,serverOnly}
rbac.grid.origin.{catalog,pattern,denyHint,securityCeiling}
rbac.grid.conflict.{twoActive,bothCandidates}
rbac.grid.sod.{exclusivePair,selfApprover,approverList,fixGrantOther,fixRevoke,securityAntiLoosen}
rbac.grid.scope.{TENANT,ORG,PROGRAM,SITE,CLASS,SELF}
rbac.grid.entitlement.{moduleOff,moduleTrial}
rbac.grid.test.{runButton,finding,passLine,failLine}
```

- [ ] **RG-1** Kisi tidak pernah merender katalog penuh: `page`/`limit` server terbukti dipakai (uji jaringan: permintaan awal ≤ 100 baris), expander mengambil per baris, dan tidak ada satu pun paket virtualisasi baru.
- [ ] **RG-2** Enam verba kanonik saja; nol string aksi bebas di JSX; label dibaca dari kamus verba yang sama dipakai `§9.7`.
- [ ] **RG-3** Setiap sel punya **Asal** (katalog · delegasi pola · DENY · cabut/kedaluwarsa). Uji: satu grant pola `pmb.*` dan satu DENY menampilkan bentuknya masing-masing, dan DENY tidak dapat dibedakan dari "tidak diizinkan" oleh pengguna buta warna (karena teks + ikon, bukan warna).
- [ ] **RG-4** Peringatan SoD §15.5 terpasang **sebelum** tulis: pasangan dari `MUTUALLY_EXCLUSIVE_ROLES` (kontrak, bukan array layar), dan daftar pemegang pemohon+penyetuju menghitung pengguna nyata dalam scope; simpan terkunci saat konflik > 0.
- [ ] **RG-5** Field `SERVER_ONLY` tidak punya kendali sunting dan tidak pernah masuk body; field "tidak dikirim" dibuktikan **absen dari payload** (DF-5), bukan `hidden`.
- [ ] **RG-6** Nominal keuangan untuk peran akademik tanpa hak dirender boolean + sebab, bukan angka (`MASKED`).
- [ ] **RG-7** Empat titik kegagalan AGENTS §3.8 punya **satu aksi uji per baris grant** (§15.5 butir 4) dan hasilnya dirender sebagai temuan; kisi tidak pernah melaporkan "aman" tanpa menjalankan uji, dan aksi uji tidak pernah menulis apa pun.
- [ ] **RG-8** Mutu & a11y: navigasi keyboard penuh, `aria-expanded`, target ≥ 44 px, kontras AA dua tema, `.tabular`, nol `font-black`/`font-extrabold`, nol komponen karangan (windowing ditandai task `H-1`, bukan diklaim).

**Butuh keputusan pemilik lain:**

- **H-1** Windowing baris (atau perluasan `VelzonDataGrid`) + primitif expander baris — pemilik slice `ADM-1`; **tanpa paket baru** (vonis §11.11.1).
- **H-2** `FIELD_RULES` di `packages/contracts/src/authz.ts` (mekanisme, bukan baris DB) — pemilik `RBAC_MATRIX §12` + `BLUEPRINT_ROLE_BY_ROLE §0.3`. Tanpa itu sub-axis kolom §15.6 tidak punya sumber dan **tidak boleh** dibangun dari array lokal.
- **H-3** Rute proyeksi "apa yang benar-benar terbaca peran ini" untuk tombol uji RG-7 — pemilik `API_SPEC`; hari ini tidak ada padanannya.
- **H-4** Penomoran baris izin `platform.menu.*` / `settings.param.*` (usulan 146–161) dan perluasan `MUTUALLY_EXCLUSIVE_ROLES` untuk pasangan `VALIDATE` lain — pemilik `RBAC_MATRIX §4.5`.

---

## 16. Layar presensi multi-modus (dosen · mahasiswa · admin) — spesifikasi UI, 2026-10-20

> **Dasar & pemilikan.** Kosakata `learning_modality` (`ONSITE` · `ONLINE` · `BLENDED`) dan `session_kind` (`REGULAR` · `SYNC_LIVE` · `ASYNC_MODULE` · `PRAKTIKUM` · `UTS` · `UAS` · `SUSULAN`), lima kebijakan `kebijakan_rekonsiliasi`, `attendance_evidence` insert-only + dua nilai baru `attendance_source`, `CHECK`, dan register enum = [DATA_MODEL.md §21.4–§21.6](file:///c:/SICA/docs/DATA_MODEL.md) (`0049`). Path, badan, kunci idempotensi logis, urutan rekonsiliasi, dan kode error (107–118 + vonis lama 60–64) = [API_SPEC.md §4.18](file:///c:/SICA/docs/API_SPEC.md). Kode izin = `RBAC_MATRIX §4` (`attendance.qr.generate`/`.scan`, `attendance.record.*`, `attendance.call.*`, `attendance.summary.view`; usulan `attendance.event.ingest`, `attendance.reconciliation.view`, `attendance.reconciliation.decide`). Yang dimiliki **bagian ini**: lencana modus, cara bukti ditampilkan, salinan vonis yang netral, pemilih kebijakan + pratinjau dampaknya, dan daftar tombol yang **tidak boleh** ada.
>
> **Status: spesifikasi.** Lanjutan §10 dan §12.7, bukan pengganti. Terukur 2026-10-20: rute yang hidup hanya `attendance/qr/generate` dan `attendance/qr/scan` (`find apps/web/src/app/api/v1 -name route.ts` = 18 berkas; `/attendance/events/**`, `/attendance/{sessionId}/reconciliation`, dan prefix `/webhooks/**` **belum pernah ada**); `packages/database/migrations/` = 7 berkas (`0001`–`0006`, `0011`) sehingga `attendance_evidence` + `0049` **belum berberkas**; `grep -rn "ratio\|evidence" packages/database/src/schema/enrollments.ts` = **0** → tidak ada satu pun kolom durasi/bukti hari ini. Tidak ada layar di bawah yang boleh disebut sudah dibangun.

### 16.0 Empat hal yang tidak boleh lupa di layar mana pun

1. **Satu baris `attendances` per (sesi, mahasiswa)** — `uq_attendances_session_student` (nyata hari ini) adalah invariance akhir **apa pun** kebijakannya. Jadi **tidak ada** layar yang menampilkan dua baris untuk satu mahasiswa pada satu sesi; bukti tambahan tampil sebagai **daftar bukti di dalam satu baris** (§16.2), bukan sebagai baris kedua. Kalimat ini juga tertulis di layar admin (§16.4) supaya operator tidak mengira "kehadiran ganda" adalah fitur.
2. **`PENDING_REVIEW` bukan enum keenam.** Kontrak mengirim `decision.status = null` + `pendingReview.*`; kolom `attendances.status` tetap lima nilai `attendance_status` (`enums.ts:128`). Karena itu **lencana tunggu dirender dari `pendingReview`, bukan dari warna status baru**, dan tidak ada tempat di UI yang boleh menulis "ABSENT" untuk keadaan ini. Perluasan enum adalah keputusan `DATA_MODEL §15` (pola §10.2, §4.18.6 butir 11), bukan kebebasan layar.
3. **Rasio dan vonis dihitung server.** Angka dari kanal/perangkat masuk sebagai **klaim diagnostik** (`ratioClaimed`) dan ditampilkan **hanya** berdampingan dengan hasil hitung ulang (`ratioComputed`, `discrepancy`) di layar peran berhak — tidak pernah sebagai dasar keputusan klien (`DATA_MODEL §21.5`).
4. **Vendor bukan oracle tunggal, dan tidak ada rahasia di layar.** Bukti `WEBHOOK_EVENT` selalu berlabel **pendukung** (`sufficiency = SUPPORTING_ONLY`); `credentialRef` yang tampil adalah **nama kunci**, bukan nilainya; tidak ada `joinUrl`, nama peserta versi vendor, email, atau isi pertemuan (anti-oracle §4.18.4).

### 16.1 Lencana kosakata modus dan sumber bukti

Kosakata kelas **A-prime** (`DATA_MODEL §20.1`): **kode = enum tertutup, label = kamus/`labelForStatus`**. Layar tidak punya array label sendiri (§13.3, §11.9 butir 4). Semua lencana ikon + teks, kontras AA dua tema.

| Kosakata | Nilai | Bentuk lencana | Label yang tampil | Ikon | Catatan |
|---|---|---|---|---|---|
| `learning_modality` | `ONSITE` | `Badge look="soft" tone="primary"` | `LURING` | `map-pin` | alias lama `offline` **tidak dirender** lagi (dilepas §21.4) |
| | `ONLINE` | `Badge look="soft" tone="info"` | `DARING` | `monitor` | alias `online` lower-case tidak dipakai |
| | `BLENDED` | `Badge look="soft" tone="secondary"` | `CAMPURAN` | `layers` | **wajib** muncul bersama `session_kind` — kelas campuran punya ketiga bentuk sesi |
| `session_kind` | tujuh nilai `REGULAR` · `SYNC_LIVE` · `ASYNC_MODULE` · `PRAKTIKUM` · `UTS` · `UAS` · `SUSULAN` | `Badge look="outline" tone="secondary"` | label per nilai dari kamus (`labelForStatus` §11.3) | `video` · `book-open` · `clipboard-list` | bukan sinonim modus; satu kelas BLENDED punya ketiganya, jadi layar **tidak boleh** menyimpulkan modus dari jenis sesi |
| `attendance_source` | `QR` | `Badge look="soft" tone="primary"` + teks | `QR` | `scan-line` | bukti luring otoritatif |
| | `GEOFENCE` | `Badge look="soft" tone="primary"` + teks | `GPS` | `map-pin` | bukti luring otoritatif; jarak & akurasi hanya ke pemilik data (§16.3) |
| | `LMS_ACTIVITY` | `Badge look="soft" tone="info"` + teks | `LMS` | `monitor-play` | otoritatif daring **hanya** kanal internal self-hosted (`bbb`/`jitsi`) |
| | `WEBHOOK_EVENT` | `Badge look="soft" tone="secondary"` + penanda `Badge look="label" tone="warning"` | `WEBHOOK` + `PENDUKUNG` | `plug` | **tidak pernah** cukup sendiri untuk hadir (`422 EVIDENCE_INSUFFICIENT` 117) |
| | `MANUAL` | `Badge look="soft" tone="warning"` + teks | `Manual` | `pen-line` | selalu menyebut `marked_by` + `reason` (§10.1) |
| | `APP_BULK` | `Badge look="soft" tone="warning"` + teks | `Massal` | `users` | jalur presensi massal §10.6 (batch flush) |
| | `FEEDER_SYNC` | `Badge look="soft" tone="secondary"` + teks | `Feeder` | `refresh-cw` | **tidak** pernah jadi dasar vonis lokal; label sumber eksternal |
| gabungan (mis. `MERGE_ANY`) | `QR + LMS` | dua ikon + satu teks gabungan | `QR + LMS` | `scan-line` + `monitor-play` | **satu** baris presensi dengan dua sumber — bukan dua baris (§16.0 butir 1) |

### 16.2 Layar dosen — roster satu sesi dengan sumber bukti per mahasiswa

**Kepala sesi** (`Card` + `MetaRow`): lencana `learning_modality` + `session_kind` (dua-duanya, §16.1), ruang & jadwal, pita QR/tantangan (§10.1/§12.7 tidak diulang di sini), dan **chip kebijakan** satu baris: `attendance.multi_source_policy` = `ONSITE_PRIMARY` · v1 · sumber `TENANT_PARAM`. Versi ikut selalu — laporan yang menyebut kebijakan tanpa `parameter_version` tidak dapat direproduksi (pola harness §6.2).

**Baris roster** (`VelzonDataGrid`, paginasi server per mahasiswa — bukan per bukti, §4.18.4 kapasitas): NIM `.tabular`, nama, vonis (`StatusBadge` lima nilai + lencana tunggu dari `pendingReview`), lalu **kolom bukti** yang dirender sebagai daftar ringkas per sumber:

```
QR 08:01:12 · LMS 08:03:40 8.280 dtk rasio 0,920 (klaim 0,910 · selisih 0,010) · WEBHOOK(ZOOM) pendukung
```

- Setiap sumber: **ikon + waktu + durasi + rasio** (rasio hanya untuk kanal internal), `.tabular`, dan penanda **otoritatif/pendukung** sebagai teks (`OTORITATIF` / `PENDUKUNG`), bukan warna. `vendor` (mis. `ZOOM`, `SELF_HOSTED_BBB`) ditampilkan karena itu informasi integritas bukti; `credentialRef` **tidak** pernah ditampilkan ke dosen (milik admin/platform).
- `discrepancy` > 0 hanya boleh tampil sebagai **penanda diperiksa**, dengan tautan ke detail bukti, bukan sebagai tuduhan. Copy arah: "Selisih klaim kanal dengan hitungan kami {discrepancy}." — bukan "mahasiswa ini berbohong".
- Baris dapat dibuka → `Drawer` kanan berisi seluruh `attendance_evidence[]` (`digest` terpotong + tombol salin, `device_digest`, `occurred_at` server, `eventWindow`), riwayat banding mahasiswa itu, dan aksi §16.2.1.

**16.2.1 Aksi yang tersedia bagi dosen** (hanya ini):

| Aksi | Kapan | Efek |
|---|---|---|
| **Buka sesi / Jeda / Tutup** | sesuai §10.1, dengan konfirmasi berbasis angka | tidak diubah bagian ini |
| **Tandai manual** | selalu dengan `reason` min 10 | `source = MANUAL` + `marked_by`; bukan jalan belakang tanpa jejak |
| **Lihat bukti & rekonsiliasi** | baris `pendingReview` atau `discrepancy` | hanya-baca |
| **Minta bukti** | `REQUIRE_BOTH` dengan satu bukti, atau `EVIDENCE_INSUFFICIENT` (117) | **permintaan kepada mahasiswa**, tidak mengubah vonis apa pun. Catatan jujur: rute untuk aksi ini **belum ada** di kontrak → keputusan `M-1`; sampai ada, tombolnya **tidak dirender** dan dosen diarahkan ke dua jalur yang nyata: banding milik mahasiswa (`pendingReview.appealHref`) dan `Tandai manual` beralasan |
| **Putuskan (`decide`)** | pemegang hak `VALIDATE` (`attendance.reconciliation.decide`, usulan) | lihat §16.2.2 |

**16.2.2 Aksi putuskan** (`POST …/reconciliation/{studentId}/decide`). Body = `decision` (salah satu lima nilai `attendance_status`), `reason` 10–500, `evidenceIds[]`. Penegakan yang harus tercermin di layar, dengan sebab yang terbaca bila gagal: hanya pengampu kelas (scope `CLASS` dari `class_assignments`) atau `ADMIN_ACADEMIC` ber-scope · **≠** pemohon banding (`56 SELF_APPROVAL_FORBIDDEN`) · sudah diputus (`55 DECISION_ALREADY_MADE`) · periode `LOCKED`/`CLOSED` (`25 PERIOD_CLOSED` — vonis manual ditolak, meski **bukti** tetap diterima §4.18.2) · `STRICT_LATEST` **hanya** lewat aksi ini dengan alasan, tidak pernah otomatis. Efek ditulis sebagai `marked_by`, `source = 'MANUAL'`, `notes`, riwayat + `auditId` — **bukan** `UPDATE` status bebas.

**Yang dilarang ada di layar dosen** (temuan review, bukan selera): tombol apa pun yang menyentuh `students.status_akademik`, gerbang KRS, cekal, tagihan, atau nilai (pola §12.6); tombol "hapus presensi"; tombol "tandai hadir semua" tanpa dasar bukti; tampilan `fraud_score_bp`, daftar flag, radius, ambang akurasi, atau `windowIndex` (§10.0.2); dan tombol "minta bukti" yang dibangun sebelum `M-1` ada.

**Keadaan.** `loading` = `Skeleton.Table`; `empty` = "Belum ada bukti masuk untuk sesi ini" + status kanal (luring aktif / kanal internal terhubung / webhook vendor tidak dipakai); `error` = pemetaan §2.3 (41 `NOT_YOUR_CLASS`, 48 `NOT_YOUR_STUDENT`, 25, 55, 56, 117); `degraded` = `AWAITING_CLOSURE` dan melewati `finance.webhook_reconcile_timeout_s` → lencana `warning` "rekonsiliasi belum selesai; sesi dilaporkan apa adanya" dan **angka tidak ditebak** (pola §12.2).

### 16.3 Layar mahasiswa (Flutter) — vonis, jarak/akurasi miliknya, satu aksi berikutnya

Salinan mengikuti §10.2 butir "Aturan microcopy hasil" dan §12.7: **satu kalimat netral**, tidak menghakimi, tanpa menyebut resep.

| Keadaan | Yang ditampilkan | Yang **tidak** ditampilkan | Satu aksi berikutnya |
|---|---|---|---|
| Tercatat hadir | chip status + waktu tercatat + kelas + nomor pertemuan + sumber miliknya (`QR`, `LMS`) | ambang, flag, `device_digest` milik orang lain | "Lihat rekap kehadiran saya" |
| **Di dalam / luar area** | keputusan dalam bentuk kata ("di dalam area", "akurasi belum cukup, ulangi") + **jarak miliknya sendiri** + **akurasi pembacaannya sendiri** + umur fix | **nilai radius tenant, ambang akurasi, `windowIndex`, apakah root/mock terdeteksi** (§10.0.2) | "Coba lagi" atau "Tandai ke dosen" |
| Kehadiran daring miliknya | "Anda tercatat mengikuti {ratio} durasi sesi" sebagai persentase **miliknya sendiri**, dihitung server | angka ambang (mis. 0,75), `ratioClaimed` vs `ratioComputed` milik internal, kebijakan perbandingan | "Lihat rinciannya" |
| Perlu diperiksa (`decision.status = null` + `pendingReview`) | "Kehadiran Anda perlu diperiksa pengampu kelas Anda" + **sebab dalam bahasa manusiawi** dari `pendingReview.reason` + hak banding + jendela banding | flag mentah, nama bukti yang menjadi dasar kecurigaan | **Ajukan banding** (`appealHref`) |
| Bukti kurang (`422 EVIDENCE_INSUFFICIENT` 117) | pesan yang **wajib** menyebut sumber yang ada dan sumber yang kurang (`admin.errors` pola §4.18.6 butir 7) | daftar aturan internal | "Lengkapi bukti" / "Ajukan banding" |
| Ditolak karena perangkat/kebijakan | `tone="danger"` + sebab umum | flag mana yang menyala, skor kecurangan | "Ajukan banding" |
| Jendela banding lewat (`29 APPEAL_WINDOW_CLOSED`) | penolakan + tanggalnya + jalur ke pengampu | — | "Hubungi pengampu kelas" |
| Offline / bahan tertahan | "Bahan tersimpan, belum terkirim" + antrean lokal (§10.8.3) | kesimpulan hadir | "Kirim sekarang" |

**Nada.** Vonis bukan vonis moral: `EXCUSED` dan `SICK` adalah keadaan **legal** dan tidak pernah dirender `danger` (§10.2). `ABSENT` tidak pernah muncul segera setelah memindai — ia turunan rekonsiliasi akhir sesi (§10.2), jadi layar hasil hanya berjanji apa yang bisa ditepati. **A11y Mobile:** target 44 dp, `role="alert"` hanya untuk vonis akhir, status antara lewat `Semantics` `liveRegion` sekali, angka `.tabular` via `fontFeature`/mono, `prefers-reduced-motion` mematikan laser & sapuan cincin tetapi tidak menghilangkan angka (§7.2, §10.1). **Paritas:** Flutter **tidak pernah** memakai `ratioComputed` sebagai kebenaran lokal dan **tidak** punya "kebijakan versi mobile" — endpoint sama, kunci i18n sama.

### 16.4 Layar admin — pemilih kebijakan rekonsiliasi + konsekuensi + pratinjau dampak

Kunci `attendance.multi_source_policy` adalah **parameter kelas `ACADEMIC` dengan `enum_kind = kebijakan_rekonsiliasi`** (`DATA_MODEL §21.3` butir 24), jadi layarnya adalah **§14.2 `enumKind` + §14.4 + §14.7**, bukan layar khusus. Yang spesifik gugus ini: pilihan harus menjelaskan konsekuensi, bukan hanya nama.

| Nilai `enum_kind` | Konsekuensi satu kalimat (kunci `attendance.multi.policy.*`) | Akibat ke `attendances` | Yang **tidak** pernah dihasilkannya |
|---|---|---|---|
| `ONSITE_PRIMARY` (baku) | "Bukti di ruang menang; bukti daring tetap disimpan sebagai bukti, tidak menjadi dasar vonis." | satu baris, vonis dari bukti luring | kehadiran daring tunggal menjadi `PRESENT` |
| `ONLINE_PRIMARY` | "Rasio join kanal internal yang menjadi dasar; QR menjadi bukti tambahan." | satu baris, `ratioComputed` + ambang + versi ikut di baris | klaim durasi dari klien menjadi dasar |
| `MERGE_ANY` | "Salah satu bukti cukup; sumber dicatat gabungan (`QR+LMS`) pada baris yang sama." | satu baris, sumber gabungan | baris kedua untuk bukti kedua |
| `REQUIRE_BOTH` | "Dua bukti wajib. Satu bukti saja **belum** hadir dan **belum** absent: keadaan tunggu + banding." | satu baris berkeadaan tunggu | `ABSENT` untuk yang belum lengkap; `PRESENT` untuk yang separuh |
| `STRICT_LATEST` | "Bukti terakhir menang, **hanya** lewat keputusan beralasan — tidak pernah otomatis." | satu baris, `rule = MANUAL_OVERRIDE` + actor + tautan riwayat | perubahan diam-diam tanpa `VALIDATE` |

**Cakupan ("per modul").** Pembacaan memakai `applies_to` (prodi / site / jenis program / periode) persis §14.4: satu layar, dua tingkat — nilai tenant dan override ber-scope — dengan penanda `SCOPE_PARAM` vs `TENANT_PARAM` vs `DEFAULT` dari field `source` §4.16.5. Dua baris `ACTIVE` berspesifisitas sama = `409 CONFLICT` (12) dan dirender sebagai **kedua kandidat** + `remedyHref`; copy: "Konfigurasi rusak: dua aturan berlaku untuk cakupan yang sama." Mengubah kebijakan **kelas `ACADEMIC`** yang berdampak luas tetap menuntut alasan, riwayat, dan — bila `parameter_permissions` menuntutnya — penyetuju kedua; layar **tidak** menghapus keadaan `PENDING` dari kartu §14.4 hanya karena kebijakannya terasa "miliknya".

**Pratinjau dampak — apa yang boleh dan tidak boleh dihitung.**

- **Yang dirender** (semuanya data nyata): panel §14.6 (layar/proses mana membaca kunci ini), dan agregat bukti per sesi terpilih dari `GET …/reconciliation` — "42 QR · 38 LMS · 12 webhook · 30 mahasiswa berhak hadir", dibaca dari `evidence[]` per baris, hanya-baca, boleh Replica.
- **Yang belum ada dan jangan dihitung sendiri:** perkiraan "berapa mahasiswa berubah vonis bila kebijakan diganti" adalah **what-if server**; kontrak §4.18.4 secara eksplisit **menolak** filter `policy` ("kebijakan dibaca dari parameter, bukan dipilih pemanggil") dan rute preview tidak ada → keputusan **`M-2`** (pemilik `API_SPEC` + `DATA_MODEL`). Sebelum `M-2` ada, layar menampilkan kalimat `attendance.multi.previewUnavailable`: "Perkiraan perubahan vonis belum dapat dihitung. Kebijakan berlaku untuk sesi yang dibuka setelah penyetujuan." — dan **dilarang** mensimulasikan perhitungan vonis di klien: itu sumber kebenaran kedua sekaligus melanggar satu-jalur-evaluasi (§15.4).
- **Setelah berlaku**, cara yang sah untuk memeriksa dampaknya adalah rekonstruksi: `?at=` pada daftar parameter (§14.1.3) dan `?at=` pada rekonsiliasi (§4.18.4) — bukan menebak mundur.

**Invariance yang tertulis di layar** (kunci `attendance.multi.invariant`): "Apa pun kebijakannya, satu sesi hanya punya satu baris presensi per mahasiswa; bukti tambahan disimpan sebagai bukti, bukan sebagai baris kedua."

**Panel kesehatan kanal** (admin/platform, hanya-baca): status webhook terpasang (`bbb`/`jitsi` = kanal internal, `zoom`/`google_meet`/`microsoft_teams` = pendukung), keadaan penolakan yang **ACK tanpa simpan** (`ignored = CLOCK_SKEW`, `PAYLOAD_NOT_ALLOWEDLIST`, `IDENTITY_UNBOUND`) dan, untuk `IDENTITY_UNBOUND`, tautan "pengikatan identitas belum tersedia" — dengan catatan jujur bahwa **objek penampung `userRef → mahasiswa` belum didefinisikan** di `DATA_MODEL §21` (keputusan `M-3`), jadi kanal vendor hari ini hanya dapat menyimpan `event_digest` audit transport dan **tidak dapat** menghasilkan bukti kehadiran (§4.18.3 butir 4). Meter `webhook_rejects_total` = **design-only**; angka penolakan tidak boleh ditampilkan sebelum metrinya ada.

**Yang dilarang ada di layar admin ini** (pola §12.6 dan DE-4): tombol apa pun yang mengubah status akademik, gerbang KRS, cekal, atau tagihan; tombol hapus/ubah riwayat; tombol yang menaikkan atau menurunkan nilai efektif `SECURITY` (`attendance.totp_rotate_seconds`, `attendance.gps_max_accuracy_m`, `attendance.geofence_default_radius_m`) — ambang keamanan hanya lewat §14.3/§14.4 dengan empat-mata; dan tombol "tandai vendor sebagai hadir" (`422 EVIDENCE_INSUFFICIENT` 117).

### 16.5 Matriks komponen, keadaan, dan aksesibilitas

| Layar | Primitif | Keadaan wajib | Aksesibilitas kunci |
|---|---|---|---|
| Kepala sesi & roster §16.2 | `Card` · `MetaRow` · `Badge` · `StatusBadge` · `VelzonDataGrid` · `Drawer` · `ConfirmDialog` · `Alert` | loading · empty · error · `AWAITING_CLOSURE` · tunggu-review · periode terkunci | daftar bukti disampaikan sebagai teks (ikon + label) · `digest` mono + `aria-label` salin · target ≥ 44 px · `.tabular` |
| Aksi putuskan §16.2.2 | `Drawer` + `Field`/`Textarea`/`Select` + `Button` + `toast` (satu lapis, `ConfirmDialog` untuk keputusan akhir — §9.7) | reason kosong · 55 · 56 · 25 · sukses | `aria-invalid` + `aria-describedby` dari `Field` · pengumuman hasil `role="status"` sekali |
| Hasil mahasiswa §16.3 | `Badge`/chip · `Semantics` · `Button` · `EmptyStateWidget` Flutter (padanan Web `empty-state.tsx` belum ada — §9.1 butir 4) | idle · tercatat · perlu diperiksa · ditolak · offline · jendela banding lewat | vonis `role="alert"` hanya di akhir · nada netral untuk `EXCUSED`/`SICK` · 44 dp · `prefers-reduced-motion` |
| Kebijakan & dampak §16.4 | `Select` (kamus) · `Card` · `Badge` · `Alert` · `Table` · `ConfirmDialog` | loading · konflik cakupan · PENDING approval · stale version · previewUnavailable | penjelasan konsekuensi terbaca alat baca (daftar, bukan grafik) · `aria-live="polite"` untuk keadaan penyetujuan · kontras AA dua tema |
| Kesehatan kanal §16.4 | `Card` · `Badge` · `Table` · `Alert` | empty · degraded (`503`, `0049` belum ada) · ACK-reject | status ikon + teks · `credentialRef` nama kunci saja · tanpa angka meter yang belum ada |

**Degradasi yang harus disebut apa adanya.** Selama `attendance_evidence` belum berberkas, ingestion menjawab `503` + `Retry-After` dan **tidak menyimpan apa pun** — layar menyebutnya "pencatatan sedang tidak dapat dipastikan" dan tidak pernah menawarkan "simpan lokal lalu anggap hadir" (§12.7). Presensi massal tetap ikut §10.6/§10.8 (batch flush, bahan tertahan), dan jalur KRS/antrean engine tetap tunduk pengecualian tercatat AGENTS §3.8/§3.9 — bukan alasan membalik jalur.

### 16.6 Kunci i18n `attendance.multi.*` dan Definition of Done

```
attendance.multi.modality.{ONSITE,ONLINE,BLENDED}
attendance.multi.kind.{REGULAR,SYNC_LIVE,ASYNC_MODULE,PRAKTIKUM,UTS,UAS,SUSULAN}
attendance.multi.source.{QR,GEOFENCE,LMS_ACTIVITY,WEBHOOK_EVENT,MANUAL,APP_BULK,FEEDER_SYNC,combined}
attendance.multi.sufficiency.{authoritative,supporting}
attendance.multi.policy.{ONSITE_PRIMARY,ONLINE_PRIMARY,MERGE_ANY,REQUIRE_BOTH,STRICT_LATEST}
attendance.multi.scope.{tenantParam,scopeParam,default,conflictTwoActive}
attendance.multi.invariant
attendance.multi.previewUnavailable
attendance.multi.evidence.{time,duration,ratio,ratioClaimed,discrepancy,digest,copyDigest}
attendance.multi.state.{awaitingClosure,reconcileTimeout,pendingReview,alreadyDecided,selfApprover,periodClosed,vendorNotEnough}
attendance.multi.action.{requestEvidence,openAppeal,decide,markManual,viewReconciliation}
attendance.multi.student.{insideArea,accuracyRetry,ownRatio,needReview,appealWindow,contactLecturer}
attendance.multi.channel.{internal,vendor,clockSkew,payloadRejected,identityUnbound,noMeter}
```

- [ ] **MM-1** Tidak ada satu pun layar yang menampilkan dua baris presensi untuk satu (sesi, mahasiswa); bukti selalu daftar di dalam satu baris (§16.0 butir 1).
- [ ] **MM-2** `PENDING_REVIEW` dirender dari `pendingReview`, **bukan** dari enum keenam; teksnya tidak pernah "ABSENT" dan tidak pernah "HADIR".
- [ ] **MM-3** Lencana `learning_modality` + `session_kind` selalu berpasangan di kepala sesi; label dibaca dari kamus/`labelForStatus`, nol array label di JSX/Dart (pola §11.9 butir 4, DF-7).
- [ ] **MM-4** Mahasiswa melihat vonis netral + jarak/akurasi **miliknya** + satu aksi berikutnya; nol angka resep keamanan di layar itu (`radius`, ambang akurasi, `windowIndex`, `fraud_score_bp`, daftar flag) — dibuktikan uji komponen yang meminta string terlarang tidak ada di keluaran render.
- [ ] **MM-5** Pesan `EVIDENCE_INSUFFICIENT` (117) menyebut **sumber yang ada** dan **sumber yang kurang** (kunci `admin.errors`), bukan "data belum lengkap".
- [ ] **MM-6** Aksi `decide` hanya lewat `VALIDATE` dengan `reason` + `evidenceIds[]`, dan empat penolakan (55/56/25/117) punya cabang render sendiri; tidak ada `UPDATE` status bebas dari UI.
- [ ] **MM-7** Pemilih kebijakan = layar parameter §14 (enum dari kamus `kebijakan_rekonsiliasi`, `PARAM_ENUM_UNKNOWN` 110 dipetakan), dengan konsekuensi lima nilai tertulis, cakupan `applies_to`, dan kartu penyetuju kedua; **nol** simulasi vonis di klien (`M-2` belum ada → `previewUnavailable` dirender).
- [ ] **MM-8** Nol tombol yang mengubah status akademik/gerbang/cekal/tagihan dari layar presensi mana pun (grep penjaga + uji peran, pola DE-4/DE-5).
- [ ] **MM-9** Degradasi jujur: `503` saat penampung belum ada, `AWAITING_CLOSURE` sebelum rasio dihitung, `ignored` untuk ACK, meter yang belum ada tidak menampilkan angka.
- [ ] **MM-10** Mutu & a11y dua platform: kontras AA dua tema, target ≥ 44 px/dp, `aria-live` untuk keadaan penyetujuan dan status rekonsiliasi, `role="alert"` hanya untuk vonis akhir, label terkait `id` dari `Field`, nol `font-black`/`font-extrabold`, nol paket baru, nol komponen karangan — dan setiap keadaan tanpa padanan mobile tercatat sebagai pengecualian (§12.10), bukan hilang diam-diam.

**Butuh keputusan pemilik lain:**

- **M-1** Rute "minta bukti" untuk dosen (permintaan kepada mahasiswa tanpa mengubah vonis) — pemilik `API_SPEC §4.18`; sampai ada, tombolnya tidak dirender.
- **M-2** What-if server untuk pratinjau dampak kebijakan (`?policy=` atau rute `…/reconciliation/preview`) — pemilik `API_SPEC` + `DATA_MODEL`; §4.18.4 hari ini sengaja menolak filter kebijakan.
- **M-3** Objek pengikatan identitas vendor (`userRef → mahasiswa`, `UNIQUE (tenant, provider, user_ref_hash)` + RLS) — pemilik `DATA_MODEL §21`; tanpanya kanal vendor tidak dapat menghasilkan bukti kehadiran (§4.18.3 butir 4).
- **M-4** Promosi usulan `attendance.event.ingest` (301) / `attendance.reconciliation.view` (297) / `attendance.reconciliation.decide` (300) dan `settings.param.*` / `platform.menu.*` menjadi katalog + seed (`gen-rbac-seed.mjs`) — pemilik `RBAC_MATRIX §4.5`; keenamnya **sudah menjadi baris katalog** sejak 2026-10-21 (`RD-73`), yang belum adalah **promosi ke `PERMISSION_SPECS`** (AGENTS §3.8: tanpa baris katalog, layar tidak boleh diklaim selesai — dan tanpa promosi, gerbang server belum ada di kode).
- **M-5** Penyelesaian tiga angka batas akurasi GPS yang berbeda di tiga tempat (§4.18.6 butir 10) dan kontradiksi periode rotasi QR (5 s vs 30 s, §10.1 butir K-1) — pemilik `DATA_MODEL` + `API_SPEC` + implementasi. Layar **tidak** mengambil salah satu diam-diam: copy menyebut "ambang dibaca server" sampai angkanya satu.

---

## 17. Dashboard dinamis berbasis peran — grid kartu modul (Velzon, 2026-10-20)

> **Dasar & pemilikan.** Registri modul `M-01`…`M-47` + `APP`, status `PENUH`/`SEBAGIAN`/`NOL`, dan kode entitlement adalah milik [PRD §5.12](file:///c:/SICA/docs/PRD.md) (terukur di sana: 48 baris · 11 `PENUH` · 21 `SEBAGIAN` · 16 `NOL` · 19 kode nyata + 18 `usulan`). Vonis siapa-penulis-angka milik [PRD §5.13](file:///c:/SICA/docs/PRD.md). Kosakata peristiwa dan vonis jalur real-time milik [ARCHITECTURE §13.1–§13.2](file:///c:/SICA/docs/ARCHITECTURE.md). Kode izin `resource × verb` milik [RBAC_MATRIX §4 dan §4.5](file:///c:/SICA/docs/RBAC_MATRIX.md). Bagian ini **hanya** menetapkan bentuk layar, isi kartu, dan apa yang terjadi ketika angka belum ada.
>
> **Status: spesifikasi.** Terukur 2026-10-20: `apps/web/src/app/(dashboard)/dashboard/page.tsx` merender **satu** dashboard statis (StatCard + "Jadwal Kuliah Hari Ini" + aksi cepat dari array `quickActions` di berkas itu), direktori `(dashboard)/` hanya berisi `dashboard` dan `academic`, dan `grep moduleCode apps/web/src/app/(dashboard)/dashboard/page.tsx` = **0**. Tidak ada satu pun baris §17 yang boleh disebut "sudah dibangun". Namespace `dashboard.modules.*` yang bagian ini minta juga **belum ada** (lihat §17.8).

### 17.1 Anatomi layar

Rangka halaman tetap milik §11.4 dan §4; yang baru di sini hanya **isi kolom kiri**.

```
main.main-content
 +-- div.page-content                      (padding 24 / mobile 16, max-width var(--sica-content-max), gap 24 - §11.6)
      +-- PageHeader + MetaRow             (judul, periode aktif, tenant, peran aktif - §11.3, §11.4)
      +-- div (grid kartu modul)           (kolom kiri, fleks 1 - §17.2 daftar kartunya, §17.3 bentuknya)
      +-- aside (right rail aksi)          (lebar 320 px pada xl; runtuh ke bawah grid pada lg ke bawah)
```

- **Header** adalah `TopNav` Velzon dua baris yang sudah ada (§4, §11.4): baris satu brand · pencarian · utilitas · **kartu profil (avatar + nama + peran)**, baris dua navigasi + pill institusi + **tombol keluar**. Tidak ada header kedua di dalam `page-content`; kartu profil **tidak** mengulang `PageHeader`.
- **Baris peran pada kartu profil** menampilkan **penugasan aktif hasil server** (`user_role_assignments` + scope), bukan enum `member_role` carrier login (AGENTS §3.8). Satu orang dengan dua penugasan melihat pemilih konteks, bukan satu label yang salah.
- **Kolom kiri** = grid kartu modul. **Right rail** = daftar pendek "butuh tindakan" (persetujuan tertunda, tenggat, hasil engine yang menunggu `VALIDATE`), bukan salinan kartu; ia dirender dari proyeksi server yang sama, jadi angkanya tidak dapat berbeda dari kartu (§17.6 butir 3).
- **Pemilik token**: seluruh warna, radius, bayangan, tipografi, spacing, motion dirujuk dari §1–§4 dan ditegakkan §11.1–§11.6. Bagian ini **tidak** mendefinisikan token baru dan tidak menulis hexa. Butuh bentuk yang belum ada → varian baru di primitif (`Card`, `Badge`, `StatusBadge`, `StatCard`), bukan kelas lokal (§2.0).
- **Resep fokus kanonik** tetap satu-satunya yang boleh disalin (§11.11.2): `bg-slate-50/50 border-slate-200 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-sica-card`. Tautan/`CTA` kartu memakai `Button` varian `soft` dengan `ring-4 ring-primary/15` dari primitif (§11.3) — **tidak** ada `focus:border-blue-600`, dan `blue-*` adalah temuan pemindai (§11.9 butir 1).
- **Primer satu token hijau** `--sica-primary` `#0ab39c` (§1.1, §2.0 butir resolved). Biru `#299cdb` hanya aksen `info`: boleh pada badge keadaan "draft/jadwal", tidak pada tombol primer kartu, tidak pada seri grafik netral (§11.5, §11.11.2).

### 17.2 Matriks peran → kartu

**Vonis yang tidak dapat dibalik.** Enam daftar di bawah adalah **default penataan awal** (urutan & isi grid pada rilis pertama), **bukan kontrol akses**. Yang berhak atas kartu ditentukan server, tiga gerbang berurutan: (1) entitlement — `tenant_modules.status` `ACTIVE`/`TRIAL`; modul non-aktif **memotong lebih dulu dari peran** dan menjadi `404 MODULE_NOT_AVAILABLE` (baris 26 API_SPEC §2.3), (2) izin atas baris `user_role_assignments` dengan `scope` + `valid_to` (bukan label peran global), (3) `menu_items` × `menu_permissions` (`0050`, allowlist **tampilan** saja — RBAC baris 158–161). Kartu yang tidak berhak **tidak dirender** — bukan `disabled`, bukan `opacity-0`, bukan `sr-only` (§11.9 butir 6; AGENTS §3.8 "masking menu di UI bukan kontrol akses"). Pengguna yang mengetik URL langsung tetap kena L1–L6.

Kolom "alasan kartu" di bawah menyebut **kode izin** yang membuka kartunya. Nomor dalam kurung adalah baris [RBAC_MATRIX §4.5](file:///c:/SICA/docs/RBAC_MATRIX.md); kata **usulan** berarti kodenya belum menjadi baris katalog — kartunya tetap dirancang, tetapi layarnya tidak boleh diklaim selesai (AGENTS §3.8) dan hari ini tidak dapat dirender oleh peran mana pun.

#### 17.2.1 Dosen (13 kartu)

| M | Modul | Entitlement | Alasan kartu muncul (izin) | Mode turun bila modul non-`ACTIVE` |
|---|---|---|---|---|
| M-04 | IT Helpdesk | `—` gerbang peran (SKU ditolak PRD §5.12.3) | usulan `helpdesk.ticket.create` — satu tiket satu nomor, bukan banding akademik | gerbangnya peran, bukan SKU: tanpa penugasan staf, kartu tetap tampil sebagai "ajukan tiket"; hilangnya kartu hanya bila identitas tidak terbaca |
| M-06 | HRIS & Payroll | usulan: `hris` | usulan `hr.profile.view` (kartu pegawai milik dosen yang sama) | `404 MODULE_NOT_AVAILABLE`; kartu hilang, hak aksesnya (izin nyata di M-03) tidak ikut hilang |
| M-07 | BKD Dosen | `hr_bkd` | `hr.bkd.submit` — dosen menghitung dirinya sendiri | kartu digantikan baris "modul BKD belum aktif" di right rail hanya bila tenant punya izin tapi SKU mati (state 2 §17.4) |
| M-08 | SISTER Sync | usulan: `sister` | usulan `sister.portfolio.push` — M-08 transport, tidak memiliki angka (vonis 7) | tidak ada kartu sama sekali sampai vonis PRD §5.13 no 7 punya objek; tidak ada tombol kirim yang "sudah ada" |
| M-13 | KRS dan Perwalian | `enrollment` | `enrollment.krs.approve` (wali) dan `teaching.roster.view` (pengampu) | kartu tidak dirender; roster kelas lain tetap tidak dapat dibuka walau URL diketik |
| M-16 | LMS Digital | `lms` | `lms.assignment.grade` · `lms.progress.update` | nilai LMS tidak pernah resmi: tanpa `assessment` aktif, kartu M-19 tetap menunjukkan "sinyal belum masuk" (state 3) |
| M-18 | Presensi Smart | `attendance` | `attendance.qr.generate` · `attendance.fraud.view` (91) | sesi dosen lain tetap tertutup (L4 scope), jadi mode turun tidak mengubah keterbatasan itu |
| M-19 | Nilai dan KHS | `assessment` | `assessment.gradeformula.insert` (38) · `assessment.grade.publish` | gerbang angka: tanpa `teaching` aktif, formula tidak punya kelas ampuan untuk ditempel |
| M-20 | Tugas Akhir dan RAMA | `thesis` | `thesis.logbook.endorse` · `thesis.projectoutput.create` (119) | `thesis.projectkind.view` (115) sudah mensyaratkan modul `thesis` aktif; kartunya mengikuti, tidak melonggarkan |
| M-21 | Jurnal dan OJS | usulan: `publication` | usulan `publication.article.view` — APC ditagih M-10 (vonis 5) | tidak ada kartu; tidak ada tautan "segera" yang menjanjikan angka tridharma |
| M-22 | Inkubator dan HAKI | usulan: `publication` | usulan `ip.application.view` — gerbang jual sama, partisi izin beda (PRD §5.14) | dua modul satu SKU: satu non-aktif menyembunyikan keduanya, dan copy harus menyebut itu (state 2) |
| M-39 | e-Library | usulan: `library` | usulan `library.loan.view` — bebas pustaka hanyalah sinyal ke M-30 (vonis 3) | kartu tanpa SKU: copy "bebas pustaka dihitung M-30", bukan status sendiri |
| M-44 | SIM-LPPM dan LITABMAS | usulan: `research` | usulan `research.grant.view` — pencairan menjadi jurnal M-10 | `SEBAGIAN` di registri: kartu tampil dengan angka kosong, bukan angka contoh |

#### 17.2.2 Mahasiswa (20 kartu, termasuk `APP`)

| M | Modul | Entitlement | Alasan kartu muncul (izin) | Mode turun bila modul non-`ACTIVE` |
|---|---|---|---|---|
| M-04 | IT Helpdesk | `—` gerbang peran | usulan `helpdesk.ticket.create` (scope `SELF`) | tetap tampil untuk semua identitas terbaca; bukan jalur banding (M-18) maupun laporan (M-36) |
| M-10 | Keuangan dan Billing | `finance` | `finance.invoice.view` scope `SELF` — nominal hanya untuk dirinya; peran akademik menerima boolean (state 6) | cekal/tagihan tetap dihitung server; kartu hilang tidak membuka gerbang |
| M-11 | KIP-K dan Beasiswa | usulan: `scholarship` | usulan `scholarship.award.view` (scope `SELF`) | kartu beasiswa non-aktif tidak menghapus tagihan yang sudah terbit |
| M-13 | KRS dan Perwalian | `enrollment` | `enrollment.krs.view` · `enrollment.krs.submit` · `enrollment.waitlist.join` | leasing/lease KRS milik server; klien tidak menahan kursi (AGENTS §3.7) |
| M-16 | LMS Digital | `lms` | `lms.material.view` · `lms.submission.submit` | progres LMS adalah bukti, bukan vonis kehadiran (§16, vonis 9) |
| M-17 | Ujian dan Proctoring | `cbt` | `cbt.exam.start` · `cbt.exam.submit` | satu-satunya kartu WebSocket bersama M-43 (§17.5); tanpa jalur itu, kartu tetap membaca hasil lewat `GET` |
| M-18 | Presensi Smart | `attendance` | `attendance.qr.scan` · `attendance.record.view` (scope `SELF`) | vonis tetap `M-18`; kartu tidak pernah menampilkan resep keamanan (§10.0.2) |
| M-19 | Nilai dan KHS | `assessment` | `assessment.khs.view` (scope `SELF`) | `LOCKED` dirender dari `allowedTransitions` server (§9.7), bukan dari asumsi klien |
| M-20 | Tugas Akhir dan RAMA | `thesis` | `thesis.seminar.register` · `academic.graduation.path.view` (4, scope `SELF`) | nilai sidang ditulis lewat M-19 (vonis 2); kartu M-20 tidak menampilkan kolom nilai |
| M-24 | Kemahasiswaan dan SKKM | usulan: `student_affairs` | usulan `student_affairs.points.view` (scope `SELF`) — celah `G-11` di registri | poin belum teragregasi: state 3 dengan sebab, bukan angka 0 |
| M-25 | KKN, PKL dan Magang | usulan: `fieldwork` | usulan `fieldwork.logbook.write` — konversi SKS milik ALG-16/M-38 (vonis 1) | tidak ada kolom `sks_diakui` yang dapat disunting; percobaan tulis dari layar ini ditolak `403`, dan kartu tidak menampilkan tombol itu |
| M-26 | Simulasi Lulus | `enrollment` | `academic.graduation.sim.run` (3) · `academic.graduation.path.view` (4, scope `SELF`) | read-model: tanpa `course_prerequisites` terisi, hasil **wajib** berlabel `NO_PREREQ_DATA` (§12.2) |
| M-27 | Tracer Study | `tracer_iku` | `tracer.profile.update` | survei kosong = belum ada respons, bukan angka IKU; angka IKU milik M-32 |
| M-28 | Career Center | usulan: `career` | usulan `career.application.view` (scope `SELF`) — CV adalah PII berkonsen (FR-CRD-01) | tanpa consent tercatat, kartu menampilkan "berkas belum dapat dibagikan", bukan daftar mitra |
| M-38 | Kampus Merdeka dan MBKM | `mbkm` | `mbkm.conversion.request` · `mbkm.application.submit` | vonis + margin dari engine; tanpa peta ekivalensi → `NO_PREREQ_DATA`, bukan nol SKS |
| M-39 | e-Library | usulan: `library` | usulan `library.loan.view` (scope `SELF`) | denda adalah angka M-39, piutang lahir di M-10 (vonis 5): kartu peminjam tidak menyunting tarif |
| M-41 | Klinik Kampus | usulan: `clinic` | usulan `clinic.record.view` (scope `SELF`) — kelas rahasia UU PDP | peran tanpa hak **tidak** menerima nominal maupun isi klinis; lihat §18.7 |
| M-42 | Asrama dan Kantin | usulan: `residence` | usulan `residence.wallet.view` (scope `SELF`) | saldo dompet bukan piutang akademik: kartu ini tidak pernah memblokir KRS |
| M-43 | Humas dan Event | usulan: `event` | usulan `event.registration.checkin` — tidak memakai jalur presensi M-18 | check-in memakai WebSocket khusus (vonis §13.2); tanpa jalur itu, pendaftaran tetap lewat `POST` dan hasil dibaca ulang |
| APP | SuperApp Mobile | `—` permukaan, bukan SKU (PRD §5.12.2) | tanpa izin sendiri: ia merender modul yang sama dari `menu_items` `layer` MOBILE/BOTH | nol `tenant_modules.code` untuk mobile; paritas angka terjadi pada proyeksi server (§3.4) |

#### 17.2.3 Kaprodi dan Dekan (12 kartu)

| M | Modul | Entitlement | Alasan kartu muncul (izin) | Mode turun bila modul non-`ACTIVE` |
|---|---|---|---|---|
| M-07 | BKD Dosen | `hr_bkd` | `hr.bkd.approve` — persetujuan Recap per prodi | persetujuan tidak dapat dijalankan atas nama prodi lain (L4 scope `PROGRAM`) |
| M-12 | Kurikulum OBE | `academic` | `academic.obe.target.insert` (97) · `academic.obe.closing.propose` (102) | capaian tanpa rubrik terisi = `NO_INDICATOR_DATA` (§12.2), bukan "capaian 0" |
| M-13 | KRS dan Perwalian | `enrollment` | `enrollment.krs.approve` · `enrollment.krs.batchapprove` · `enrollment.advisor.recommendation.run` (64) | batch approve menuntut MFA penulis-admin; kartu tidak menawarkan aksi tanpa MFA di sesi |
| M-14 | Jadwal dan Ruang | `teaching` | `teaching.timetable.apply` (59) · `teaching.laballocation.apply` (9) · `teaching.class.view` | `apply` oleh orang yang sama dengan penjalur `run` (57) ditolak `403 SELF_APPROVAL_FORBIDDEN` (56) — kartu menampilkan status permintaan, bukan tombol selesai (§9.7) |
| M-19 | Nilai dan KHS | `assessment` | `assessment.grade.publish` · `assessment.grade.lock` (MFA + SoD BR-G4) | periode `LOCKED`/`CLOSED`: kartu terkunci dengan `academic.denialreason.view` (FR-ADM-11), bukan tombol mati tanpa sebab |
| M-20 | Tugas Akhir dan RAMA | `thesis` | `thesis.projectkind.approve` (117) · `thesis.projectoutput.validate` (120) | `PASSED` tanpa luaran wajib ditolak server; kartu tidak menyembunyikan syarat itu |
| M-25 | KKN, PKL dan Magang | usulan: `fieldwork` | usulan `fieldwork.placement.approve` (DPL koordinator) — peran DPL belum dinormakan (`RBAC_MATRIX §2`) | tanpa peran normatif, kartu tidak dirender sama sekali; tidak ada pengganti substring `role.includes('dpl')` (celah G-01) |
| M-30 | Yudisium dan SKPI | `graduation` | `academic.clearance.update` · `graduation.yudisium.issue` | sinyal clearance per dimensi boleh hilang (M-39/M-24 non-aktif) tanpa menghapus vonis M-30 |
| M-31 | Akreditasi LKPS | `spmi` | `spmi.instrumen.export` — borang adalah proyeksi, bukan salinan data | modul `spmi` satu SKU untuk M-31 dan M-37: keduanya hilang bersamaan, copy wajib menyebut itu |
| M-37 | SPMI dan Quality | `spmi` | `academic.obe.attainment.view` (99) · `academic.obe.closing.approve` (103) | temuan AMI tanpa tindak lanjut = state 3 dengan jumlah baris, bukan dashboard kosong |
| M-38 | Kampus Merdeka dan MBKM | `mbkm` | `mbkm.application.approve` · `academic.equivalency.manage` | `course_equivalencies` kosong → ALG-16 `NO_PREREQ_DATA`; kartu menampilkan bendera, bukan nol |
| M-44 | SIM-LPPM dan LITABMAS | usulan: `research` | usulan `research.grant.review` (reviewer) — telaah buta menuntut pemisah identitas | transisi usulan-ke-kontrak tanpa `VALIDATE` dua orang adalah temuan, bukan keadaan kartu |

#### 17.2.4 Staff BAAK, BAUK dan Sarpras (11 kartu)

| M | Modul | Entitlement | Alasan kartu muncul (izin) | Mode turun bila modul non-`ACTIVE` |
|---|---|---|---|---|
| M-09 | PMB dan OCR | `pmb` | `pmb.selection.announce` · `pmb.nim.generate` · `pmb.document.verify` | OCR lokal belum terpasang (`TECH_CONVENTIONS §6`): kartu menunjukkan "menunggu berkas terverifikasi", bukan hasil palsu |
| M-10 | Keuangan dan Billing | `finance` | `finance.invoice.create` · `finance.reconcile.run` · `finance.waiver.request` | BAAK tidak memegang kelas `FINANCIAL` (RBAC 152/153): nominal peran akademik = boolean + sebab |
| M-11 | KIP-K dan Beasiswa | usulan: `scholarship` | usulan `scholarship.award.approve` — pencairan tetap jurnal M-10 (vonis 5) | tanpa SKU, pencairan tidak punya layar: **tidak** ada jalur tulis alternatif di M-10 |
| M-14 | Jadwal dan Ruang | `teaching` | `teaching.session.generate` · `teaching.class.create` · `teaching.waitlist.manage` | sesi massal di-*batch flush* (§3.7); kartu tidak pernah mengklaim "langsung" untuk 200 baris |
| M-15 | Moda Perkuliahan | `teaching` | `teaching.availability.view` (60) · `teaching.roomutilization.view` | satu SKU dengan M-14: keduanya aktif atau keduanya hilang, dan kartu tidak menyiratkan SKU terpisah |
| M-23 | Wisuda dan Toga | `graduation` | usulan `graduation.ceremony.arrange` — logistik saja; **tidak** memutuskan lulus (registri M-23) | kartu tidak menampilkan kolom "lulus"; keputusan milik M-30, dan copy itu wajib ada |
| M-30 | Yudisium dan SKPI | `graduation` | `academic.clearance.update` (operator) · `academic.transcript.issue` | BAAK memproses, Dekan menetapkan: satu actor tidak boleh pemohon sekaligus penyetuju |
| M-33 | Jadwal Darurat | `teaching` | `academic.roomincident.declare` (31, sarpras) · `academic.roomreroute.view` (35) | deklarasi insiden bukan re-routing: `approve` (32) milik orang kedua, jadi kartu tidak punya keduanya sekaligus |
| M-35 | PIN dan SIVIL | `—` gerbang peran | `graduation.legalisir.approve` · `graduation.diploma.issue` | terbit ditolak bila clearance M-30 belum lengkap — kartu menampilkan sebab M-30, bukan error generik |
| M-40 | Aset dan Inventaris | usulan: `asset` | usulan `asset.card.view` (sarpras) — perolehan berasal dari M-46, tidak diketik ulang | kartu tidak punya tombol "tambah perolehan"; itu milik M-46 (lihat §18.9) |
| M-46 | E-Procurement PBJ | usulan: `procurement` | usulan `procurement.po.view` — komitmen anggaran dibaca M-10 (vonis 6) | tidak ada jurnal kedua: kartu menunjuk M-10, bukan menampilkan buku besar sendiri |

#### 17.2.5 Rektorat dan Eksekutif (9 kartu)

| M | Modul | Entitlement | Alasan kartu muncul (izin) | Mode turun bila modul non-`ACTIVE` |
|---|---|---|---|---|
| M-10 | Keuangan dan Billing | `finance` | `finance.report.view` · `finance.ledger.view` — agregat, bukan baris operasi | angka agregat tetap terbaca walau BAUK belum `INSERT` di sesi itu; kartu tidak menawarkan tulis |
| M-29 | KUI dan Mobilitas | usulan: `mobility` | usulan `mobility.program.view` — penyetaraan SKS tetap lewat M-38 (vonis 1) | kartu tidak dapat menampilkan konversi kredit: tidak ada izin tulis ke tabel kredit di gugus ini |
| M-31 | Akreditasi LKPS | `spmi` | `spmi.standard.manage` · `spmi.instrumen.export` | borang adalah read-model: menjual "dashboard" tanpa fakta sumber sudah ditolak (PRD §5.12.3) |
| M-32 | Dashboard IKU | `tracer_iku` | `tracer.iku.report.view` — read-model, tidak mengoreksi fakta sumber | jalur dorong = SSE/polling (§13.2); **WebSocket dilarang** di sini meskipun terlihat menarik |
| M-36 | Portal PPKS | usulan: `ppks` | usulan `ppks.case.view` — **nol visibilitas isi** bagi `TENANT_ADMIN` (Permendikbudristek 30/2021, vonis 14) | kartu hanya boleh berisi **bahwa ada** kasus; tidak ada judul, pelapor, terlapor, atau payload (`ARCHITECTURE §13.1` catatan 2) |
| M-37 | SPMI dan Quality | `spmi` | `academic.obe.target.approve` (98) · `academic.obe.attainment.view` (99) | `LEADER` menyetujui target yang bukan usulannya; SoD dirender sebagai status permintaan (§9.7) |
| M-44 | SIM-LPPM dan LITABMAS | usulan: `research` | usulan `research.grant.approve` (empat-mata kontrak) | `SEBAGIAN` di registri: tidak ada satu pun angka pencairan sebelum objek dinomori `DATA_MODEL` |
| M-45 | CRM PMB dan Marketing | usulan: `crm` | usulan `crm.lead.view` — konversi lead **hanya** lewat service M-09 (vonis 12) | kartu CAC tidak menampilkan nominal ke peran non-keuangan; lihat §18.11 |
| M-47 | Endowment Fund | usulan: `endowment` | usulan `endowment.allocation.approve` (empat-mata, vonis 5) | alokasi adalah sumber dana berversi, bukan invoice kedua: kartu tidak punya tombol "terbitkan tagihan" |

#### 17.2.6 Super Admin dan Admin IT (8 kartu)

| M | Modul | Entitlement | Alasan kartu muncul (izin) | Mode turun bila modul non-`ACTIVE` |
|---|---|---|---|---|
| M-01 | SaaS Foundation | `—` peran `PLATFORM_OPERATOR` | `platform.tenant.view` · `platform.plan.manage` · `platform.quota.manage` | gerbangnya peran + break-glass ber-MFA, bukan langganan (PRD §5.12.3): tidak ada SKU `platform` |
| M-02 | Master Parameter | `—` gerbang peran `TENANT_ADMIN` | `master.kind.manage` (128) · `settings.param.view.technical` (146) · `settings.customattr.view` (137) | satu-satunya penulis kamus (registri M-02): kartu modul lain **hanya membaca**, jadi hilangnya SKU tidak menghentikan tulis di sini |
| M-03 | Hak Akses dan RBAC | `identity` | `identity.assignment.grant` · `identity.assignment.revoke` · `identity.role.update` | pencabutan izin memicu state 6 (§17.5) pada sesi ter-cache: **bukan** hanya hilangnya kartu |
| M-04 | IT Helpdesk | `—` gerbang peran | usulan `helpdesk.ticket.claim` (staf) — antrean per kategori, bukan per peran global; pemohon memakai `helpdesk.ticket.create` scope `SELF` | `PENUH` di registri; kartu tetap dirender tanpa bergantung SKU, dan antrean kosong memakai state kosong yang menyebut sebab, bukan fixture |
| M-05 | Keamanan dan Audit | `audit` | `audit.log.view` · `audit.verify.view` (107) · `audit.anchor.view` (104) | pembaca audit (`audit.log.view`) **tidak** otomatis boleh menjalankan verifier (106) — dua kartu/dua aksi |
| M-34 | Feeder PDDikti | `feeder_pddikti` | `feeder.watermark.view` (85) · usulan `attendance.event.ingest` tidak ada di sini — gugus ini nyata | `forced_full_at` (86) hanya `TENANT_ADMIN` dan ter-audit ganda: kartu menampilkan risiko sebelum kirim |
| M-35 | PIN dan SIVIL | `—` gerbang peran | `graduation.diploma.issue` — reservasi PIN | `Admin IT` punya kartu ini **tanpa** isi kasus M-36; pemisahan itu diuji, bukan diasumsikan (state 6 §17.4) |
| M-40 | Aset dan Inventaris | usulan: `asset` | usulan `asset.card.manage` — QR tagging & penyusutan | kartu tidak dapat membuat baris aset dari M-46: baris aset lahir dari service pemiliknya (vonis 6) |

**Status terukur 2026-10-24 (`RD-175`).** Sebagian bagian ini **mulai berjalan**: `/dashboard` kini mengenal `surface` (`akademik`/`platform`/`it`) yang dibaca server dari `user_role_assignments` × `roles.code`, grid kartunya berbeda per permukaan, dan kartu jadwal kuliah tidak lagi dirender untuk peran IT. Yang terpasang = **4 kartu per permukaan IT**: platform → registri tenant (aktif · onboarding · suspen · total, dari `tenants`); IT → akun sivitas ACTIVE · permintaan hak `PENDING` · parameter sistem aktif · kegagalan login 24 jam. Empat kartu sisanya (M-04, M-34, M-35, M-40) **masih menunggu baris `usulan` menjadi katalog**, persis sesuai aturan bagian ini sendiri. Dua kebohongan yang sengaja tidak dilakukan: kartu platform **tidak** menampilkan "modul aktif" atau "kejadian audit" walau §17.2.6 memintanya, karena `tenant_modules`/`audit_logs` ber-RLS `FORCE` mengembalikan nol baris di luar konteks tenant — nol itu angka palsu, bukan data kosong; dan pintasan "Pengisian KRS" **dihapus** dari permukaan IT karena grant `enrollment.krs.submit` hanya dimiliki STUDENT (`403` terbukti bagi `admin2`) di atas layar yang masih mock (`RD-154`). Judul pintasan dibaca dari `navigation.*`, bukan lagi dari `dashboard.krsOnline`, supaya satu konsep punya satu label.

### 17.3 Spesifikasi kartu Velzon

Satu kartu = satu `Card` (§11.3) dengan `interactive` hanya bila seluruh kartu adalah tautan; kalau ada CTA di dalamnya, `interactive` **dilarang** (dua target klik pada satu area melanggar a11y).

| Bagian | Aturan | Primitif |
|---|---|---|
| Ikon | 20 px, `strokeWidth={2}`, `aria-hidden`; **hanya** `lucide-react` (`remixicon` belum ada — §14.8 `G-5`) | `<Icon size={20} aria-hidden />` |
| Judul | `CardTitle` 16 px / 500 (§1.3), normal-case, satu baris dengan ellipsis + `title` | `CardHeading` |
| Subjudul | `CardDescription` 12 px, `--sica-text-muted`, berisi **konteks** (periode, prodi scope, `n` penyebut), bukan slogan | — |
| Angka utama | `StatCard` `value: string` (§11.3) dengan `.tabular`; `null` dirender `—`, **bukan** `0` | `StatCard` |
| Badge | `Badge` `look="soft"` `tone` sesuai §11.3 dengan kelas utuh (`badge-soft-*`, safelist §11.1); **selalu** dot + teks, warna tidak pernah sendirian (§11.10 butir 4) | `Badge`, `StatusBadge` untuk enum kanonik |
| CTA | `Button` varian `soft-*` (lihat §17.4 daftar nada) ukuran `xs`, satu CTA primer per kartu; aksi sekunder masuk `Dropdown` | `Button`, `Dropdown` |
| Deep link | judul + ikon menaut ke `route_key` (§17.7), bukan ke `href` yang dirakit di JSX; label dari i18n (§17.8) | `<Link>` Next.js |
| Skeleton | `Skeleton.Card` saat read pertama; **bukan** `animate-spin` (§11.7 butir 5) | `Skeleton` |
| Empty state | `Alert` + CTA pertama, menyebut **sebab** dan **tautan perbaikan** (§9.1 butir 4) | `Alert` |
| Strip `degraded` | baris `Badge tone="warning"` + satu kalimat copy §12.2, terisi dari field `degraded` respons | `Badge`, `Alert` |
| Kontras | seluruh pasangan diuji `.tools/contrast-audit.mjs` (FAILS = 0 dua tema, §11.10); teks 10–12 px selalu ≥ 4,5:1 | — |

**Nada CTA (bukan warna acak).** Aksi biasa `btn-soft-primary`; aksi menunggu keputusan manusia `btn-soft-info`; bahaya/penarikan `btn-soft-danger` dengan konfirmasi `ConfirmDialog` (§11.3, §2.4). `btn-soft-warning` hanya untuk keterbatasan data, bukan kegagalan (pola §12.2). Tidak ada tombol solid di grid kartu: solid adalah untuk satu aksi final per drawer, bukan untuk 20 kartu sekaligus.

**Aturan grid.**
- `grid gap-4` (16 px, §11.6); `grid-cols-1` di `sm`, `2` di `md` (768 px, §4), `3` di `lg` (1024 px), `3` + right rail 320 px di `xl` (1280 px). Baris kartu **tidak pernah** meniru `table`; ia tetap `Card`.
- **Urutan ditentukan frekuensi aksi, bukan alfabet dan bukan `M-xx`.** Server mengirim `sort_order` dari `menu_items` (RBAC 159) dengan default berikut, dan klien **dilarang** menyortir ulang lokal (§13.2):
  1. kartu dengan tenggat aktif (tagihan jatuh tempo, jendela KRS `OPEN`, sesi berlangsung),
  2. kartu dengan antrian `VALIDATE` milik peran itu,
  3. kartu dengan aktivitas terbaca 30 hari terakhir (dihitung server dari riwayat akses, bukan localStorage),
  4. sisanya menurut `sort_order` lalu `code` deterministik.
- Kartu **tidak berpindah tempat karena data real-time tiba** (§17.5 aturan 4): urutan dihitung saat muat dan hanya berubah setelah aksi pengguna (tombol "muat ulang") atau navigasi ulang.
- **Motion** (§7, §11.6): masuk `fade-in-up` dengan jeda 40 ms per baris maksimum 200 ms total, `ease-velzon`, `duration-200`; hover mengangkat maksimum 2 px (`shadow-card` → `shadow-raised`). **Tanpa** `layout`/`layoutId` Framer pada grid: transisi layout memindahkan kartu saat peristiwa tiba, dan itu adalah cara termudah membuat pengguna kehilangan posisi klik yang sedang diincarnya. `prefers-reduced-motion` mematikan masuk dan hover sekaligus.

### 17.4 Enam keadaan wajib per kartu

Setiap kartu punya keenamnya; **keadaan yang tidak dirancang akan dirender sebagai keadaan lain secara diam-diam**. Matriks ini adalah daftar periksa review, dan kolom terakhir adalah apa yang dilakukan **server** (karena penyembunyian sisi klien bukan penegakan).

| # | Keadaan | Pemicu terukur | Yang dirender | Yang dilakukan server |
|---|---|---|---|---|
| 1 | Normal | `200` dengan angka terisi | angka + penyebut `n` + CTA | read biasa; read-only non-transaksional boleh ke Replica (§3.7) |
| 2 | Modul non-`ACTIVE` | `404 MODULE_NOT_AVAILABLE` (baris 26) | kartu **tidak dirender**; bila penyebabnya SKU dan bukan izin, right rail menampilkan satu baris "modul {nama} belum aktif" + tautan katalog `GET /tenant/modules` | entitlement memotong **sebelum** peran; gerbang `withModule` wajib jadi call site nyata (temuan `SEC-09`), bukan hanya fungsi |
| 3 | Belum ada data | `200` kosong, `degraded:"LOOKUP_GROUP_EMPTY"`, atau `NO_PREREQ_DATA`/`NO_INDICATOR_DATA` (§12.2) | `Alert` sebab + CTA pertama (mis. "isi kamus jenis koleksi"); angka `—` | group yang **ada** tapi kosong = `200` + `degraded` + `details[].remedyHref`; group yang tidak ada = `404 LOOKUP_GROUP_NOT_FOUND` (92). Membedakan keduanya adalah cara layar tidak menyamar jadi "fitur rusak" |
| 4 | Proses berjalan | `202 { runId, status:"QUEUED" }` + stream §10.6.3/§13.2 | kartu progres **beraangka** (§12.1): `position`, `estimatedWaitMs`, `runId` pendek; **nol** spinner tanpa angka | `Idempotency-Key` terikat percobaan; penekanan ulang memakai kunci sama; state tetap di `queue_operations`, stream hanya sinyal |
| 5 | Gagal dengan sebab | `4xx`/`5xx` dengan kode terdaftar | `Alert tone="danger"` berisi **kode + sebab + remedi** dari `admin.errors.<KODE>`; CTA ulangi hanya bila idempoten | penyebab tidak pernah "terjadi kesalahan"; kegagalan worker terekam `attempts` + DLQ (§13.2 butir 6) |
| 6 | Akses tercabut, sesi ter-cache | `403` setelah kartu sempat tampil; atau penugasan lewat `valid_to` | angka hilang dan diganti satu kalimat "hak Anda atas modul ini sudah berakhir" + tautan profil (M-03); **bukan** skeleton abstrak | izin dibaca ulang dari `user_role_assignments` (scope + `valid_to`) pada setiap permintaan tulis; cache sesi **tidak** pernah jadi dasar keputusan — empat titik kegagalan AGENTS §3.8 diuji, termasuk "izin ter-cache tapi sudah dicabut" |

**Dua larangan yang lahir dari tabel ini.** (1) Keadaan 2 tidak boleh dirender sebagai keadaan 3: "belum dibeli" dan "belum ada isinya" adalah kalimat berbeda dan tautan perbaikannya berbeda. (2) Keadaan 6 tidak boleh dirender sebagai keadaan 5 dengan `403` polos: pengguna perlu tahu **siapa** pemegang hak berikutnya (§9.8 butir 2), dan itu dikirim server.

### 17.5 Peta peristiwa → perubahan kartu

Kosakata peristiwa kanonik adalah milik [ARCHITECTURE §13.1](file:///c:/SICA/docs/ARCHITECTURE.md) (kanon `modul.entitas.aksi`, satu baris `outbox` dalam transaksi yang sama). Yang bagian ini tetapkan hanya **kartu mana yang berubah** ketika peristiwa tiba. Jalur dorong mengikuti vonis §13.2: **SSE satu arah untuk semuanya; WebSocket hanya M-17 dan M-43**; antrean berbasis DB (`queue_operations`) adalah spine.

| Peristiwa (ARCHITECTURE §13.1) | Kartu | Perubahan yang boleh dilakukan | Batas yang tidak boleh dilewati |
|---|---|---|---|
| `attendance.record.verdict` (BATCH) | M-18 | menaikkan hitungan "sesi butuh keputusan" dan menandai badge; **tanpa refetch penuh** grid lain | vonis tetap dibaca ulang dari Primary untuk detail; angka kehadiran **tidak** dihitung klien |
| `enrollment.krs.approved` · `enrollment.seat.released` | M-13 · M-14 | badge "menunggu" berkurang; kursi "tersedia" hanya angka dari server | promosi waitlist dihitung ulang dari DB dengan `ORDER BY` deterministik, **bukan** dari urutan kedatangan event (§13.2 butir 5) |
| `finance.invoice.issued` · `finance.payment.settled` | M-10 | badge tenggat; nominal **hanya** bila proyeksi server mengirimnya | kolom uang tidak mengalir ke peran akademik: peran lain dapat boolean + sebab (catatan 1 §13.1) |
| `assessment.grade.locked` · `academic.khs.published` | M-19 | strip status berdasar `allowedTransitions` (§9.7) | `LOCKED` tidak pernah disunting dari kartu; koreksi hanya lewat jalur beralasan |
| `graduation.clearance.evaluated` · `graduation.yudisium.decided` | M-30 · M-23 · M-35 | jumlah dimensi belum bersih (daftar, bukan "lulus") | M-23 tidak memutuskan lulus; sinyal per dimensi **bukan** vonis gabungan (alias ditolak §13.1) |
| `academic.obe.attainment.recomputed` | M-12 · M-37 | capaian + `coverage` + `n_missing_evidence` berdampingan (99) | angka turunan: koreksi = hitung ulang, bukan ketik; tanpa rubrik → `NO_INDICATOR_DATA` |
| Hasil run engine: `SUCCEEDED`/`NEEDS_REVIEW` dengan bendera `PARTIAL_BUDGET_EXHAUSTED`/`NO_PREREQ_DATA` (state `queue_operations`, §13.2) | semua kartu bermesin (M-13, M-14, M-19, M-26, M-33, M-38) | kartu progres → hasil + lencana `degraded` (§12.2) | stream **bukan** satu-satunya jalur keputusan: setiap hasil terminal diikuti satu `GET` read-your-writes (§13.2 butir 4) |
| `teaching.roomincident_declared` → `academic.roomincident.declare` | M-33 · M-14 | daftar sesi terdampak + jumlah | deklarasi fakta bukan re-routing; `approve` (32) orang kedua |
| `library.loan.cleared` · `finance.dunning.cleared` · `student_affairs.points.cleared` | M-39 · M-10 · M-24 | status clearance per dimensi (**sinyal**) | konsumen sah mengabaikan + wajib ada jalur baca-ulang; tidak ada modul non-pemilik yang boleh menyatakan "lulus" |
| `attendance.session.opened` (EPHEMERAL) | M-18, `APP` | menandai sesi terbuka tanpa memuat roster penuh | EPHEMERAL harus punya padanan baca (`statusUrl`); klien yang kehilangan koneksi tidak kehilangan keadaan |
| `cbt.incident.detected` (WebSocket, dua-arah) | M-17 | daftar sinyal + badge `NEEDS_REVIEW` | tidak pernah membatalkan ujian otomatis; setiap sinyal mendarat di tabel bukti walau tampilan mengabaikannya |
| `event.registration.checked_in` (WebSocket) | M-43 | counter check-in langsung | poin SKKM hanyalah usulan sampai `VALIDATE` kemahasiswaan (M-24) |
| `ppks.case.registered` | M-36 | satu angka: ada berapa kasus | **payload kosong oleh desain**; tidak ada judul, pelapor, terlapor di kartu, stream, atau log |

**Empat aturan turunan yang menutup celah "dashboard terlihat real-time".**
1. **Tidak ada angka akademik yang dihitung di klien.** KRS War, vonis presensi, NIM, capaian CPL, tarif UKT, IKU, BKD, dan skor mesin adalah proyeksi server (AGENTS §3.4/§3.8, PRD §5.12.2 butir c, ARCHITECTURE §13.2 vonis 2) — berlaku juga untuk `APP` yang berjalan luring.
2. **Peristiwa tidak mengubah state hanya karena komponen React memanggil `onEvent`** (§13.2 vonis 3); baris `outbox`/`queue_operations` adalah bukti.
3. **Read-your-writes wajib ke Primary** untuk angka yang baru ditulis (kartu yang baru menyetujui, kuota pasca-submit, `tenant_modules` pasca-aktivasi) — AGENTS §3.7.
4. **Kartu tidak bergerak saat data tiba** (§17.3 aturan grid): lencana boleh berubah, posisi tidak. Tanpa `layout` animation; `AnimatePresence` hanya untuk masuk/keluar kartu akibat navigasi, bukan akibat peristiwa.

### 17.6 Grafik di grid kartu — vonis ApexCharts dipertahankan (2026-10-20)

Permintaan pemilik datang lagi, jadi vonisnya diulang **terbuka** di sini dan bukan disembunyikan di §11.11.

**Yang ditolak.** `ApexCharts` (beserta `recharts`/`echarts`) **tidak** dipasang dan tidak akan dipasang atas dasar catatan desain. Alasan yang masih berlaku hari ini, semuanya terukur:

| Aspek | Kenyataan terukur | Konsekuensi di grid kartu |
|---|---|---|
| Dependensi | `grep` `apexcharts`/`recharts`/`echarts` di `apps/web/package.json` dan `package.json` akar = **0** kemunculan (tabel §11.9); di `apps/mobile/pubspec.yaml` `fl_chart`/`syncfusion`/`graphic` = **0** dan `extends CustomPainter` = **0** | memasang = keputusan dependensi (`TECH_CONVENTIONS §6`), bukan keputusan desain; sisi Flutter bahkan belum punya primitif grafik, jadi tidak ada paritas yang bisa dirusak maupun dipenuhi |
| Bundel | jalur klien untuk 1.000+ pengguna serentak (AGENTS §3.7) | 20 kartu per layar × satu pustaka = anggaran bundel terbakar untuk hal yang sudah ada |
| Determinisme | renderer pihak ketiga menyusun id/path sendiri per versi | uji snapshot dan golden vector (§12.12) jadi rapuh; primitif kita memakai `useId` supaya id gradien anti-tabrakan |
| SSR | komponen grafik pihak ketiga wajib `client-only` | bertabrakan dengan pola server component §4.2 dan dashboard yang harus tetap terrender tanpa JS |
| Hasil visual yang diminta | **sudah dicapai tanpa pustaka** | §11.5 butir 1–4 (Fritsch–Carlson, gradien dua stop 0,15 → 0, tooltip kaca `blur(10px) saturate(150%)`, animasi `stroke-dashoffset` 1100 ms sekali saat mount) |

**Pemetaan ulang untuk bentuk yang diminta pemilik khusus di dashboard.** Kolom kanan adalah padanan yang dipakai, bukan niat:

| Bentuk yang diminta | Padanan yang dipakai | Aturan pakai |
|---|---|---|
| `chart.type:"area"` halus di kartu tren | `Sparkline` di `velzon-chart.tsx` + kurva monotone cubic Fritsch–Carlson (§11.5) | satu seri satu warna `--sica-chart-*`; opasitas 0,15 → 0 |
| Donut komposisi pembayaran | varian baru `ProgressStack` (`progress.tsx`, §11.3) **atau** cincin SVG satu `<path>` | tidak menambah paket; kalau belum ada varian, itu task primitif, bukan alasan memakai pustaka |
| Bar/stacked utilisasi ruang (M-14) | varian `VelzonChart` baru (bar = `<rect>` ber-`role="img"` + `aria-label`) | tinggi dari skala linear server-side; sumbu `--sica-chart-grid/--sica-chart-axis` |
| Heatmap capaian CPL (M-12) | grid `<rect>` dengan skala `--sica-chart-1…5` | warna status (`danger`) **tidak** untuk seri netral (§11.5); sel selalu punya teks angka, warna bukan satu-satunya pembawa makna (§11.10 butir 4) |
| `noDataText`, `toolbar`, `legend` bawaan | legenda bulat + label `slate-500`; kosong dilayani `Skeleton`/`Alert` (§11.3) | `empty` tidak pernah dirender sebagai sumbu kosong |

**Bila pemilik tetap memaksa.** Jalurnya bukan catatan desain ini, dan bukan "sudah terpasang": (1) PRD menambah kebutuhan + konsekuensinya, (2) `TECH_CONVENTIONS §6` menerima paket sebagai dependensi nyata dengan **versi**, (3) `apps/web/package.json` + lockfile berubah pada satu commit, (4) **gerbang anggaran bundel** ikut commit itu — ambang kenaikan gzipped per rute dashboard ditetapkan dan dibandingkan di CI sebelum/ sesudah, dan melewati ambang memblokir merge, (5) hanya setelah itu dokumen boleh menyebutnya ada. Sampai keempat langkah itu terpenuhi, seluruh layar §17/§18 dirender dengan primitif SVG §11.5, dan tidak ada layar yang boleh diklaim "menunggu ApexCharts".

### 17.7 Tautan dalam dan `route_key`

- Kartu menaut ke **`route_key`** (kolom `menu_items.route_key`, DATA_MODEL §21.7) yang dipetakan ke path lewat registri kunci rute statis — **bukan** string path bebas yang dirakit di JSX (`422 MENU_ROUTE_KEY_UNKNOWN` 118, §14.8.3). **Terpasang 2026-10-24 (`RD-176`):** registri itu adalah `apps/web/src/modules/authz/route-keys.ts` — 12 kunci, dan hanya halaman yang benar-benar punya `page.tsx` di `(dashboard)/**` yang boleh masuk; uji `tests/unit/menu-tree.test.ts` memindai berkas halaman dan menolak kunci yatim, sehingga menambah path karangan menjadi gagal build, bukan gagal saat diklik.
- **Sumber navigasi bukan lagi konstanta.** `top-nav.tsx` membaca `GET /api/v1/me/menu` (`API_SPEC §4.17.1`); `PRIMARY_NAV`/`buildNav` dihapus. Tiga kedalaman data (`admin` → `admin.identity` → daun) dirender di dua kedalaman layar: grup tingkat-2 memakai primitif yang sudah ada, `DropdownLabel` (`.section-label`: 11px/600/uppercase, padding `8px 10px 4px`, sejajar item `8px 10px`) — bukan `dropdown-header` Bootstrap yang berbeda ritme spacing, dan bukan dropdown bersarang yang menuntut `bootstrap.js` (dilarang `TECH_CONVENTIONS §6` aturan 8).
- Nama rute baru mengikuti pola yang sudah ada hari ini: `/dashboard`, `/academic/krs`, `/academic/khs`, `/academic/advisor` (terukur: itulah satu-satunya halaman di `(dashboard)/`). Untuk modul §18: `/helpdesk`, `/hris`, `/sister`, `/jurnal`, `/haki`, `/kemahasiswaan`, `/kkn`, `/karir`, `/kui`, `/ppks`, `/perpustakaan`, `/aset`, `/klinik`, `/asrama`, `/acara`, `/lppm`, `/crm`, `/pengadaan`, `/dana-abadi` — **usulan**, belum dinormakan di `menu_items` maupun `API_SPEC`.
- Deep link state: `?edit=<id>` untuk drawer (§9.2), `?run=<runId>` untuk kartu progres engine (§12.1), `?period=<id>` untuk konteks periode lain (selalu read-your-writes ke Primary bila periode itu baru diubah).
- Kartu yang targetnya belum punya halaman ditandai badge **"Segera"** seperti navigasi saat ini (§4), **tanpa** `href` mati dan **tanpa** skeleton yang berpura-pura memuat data. Di navigasi atas, bentuknya `data-soon` + `aria-disabled` + `cursor: not-allowed` (terpasang); daun `requires_mfa` mendapat gembok `ri-lock-2-line` **sebagai penanda**, bukan sebagai penguncian layar — gerbang MFA tetap di aksi tulis (`admin-guard` 401 `MFA_REQUIRED`), dan `§4.17.1` tahap 3 hanya memakai `disabled` untuk keadaan periode.
- **Satu kelompok kerja = satu item pada baris menu. Tidak ada mega dropdown.** (ralat siklus 10, `RD-181`.) Aturan render `top-nav.tsx`: akar yang merupakan **wadah murni** — `href`-nya `null` dan seluruh anaknya adalah grup bertingkat dua (`platform`, `admin`) — **dipromosikan**, sehingga tiap grup menjadi item nav tingkat pertama dan dropdown-nya hanya berisi daun grup itu. Akar yang anaknya daun langsung (`akademik`, `more`, dan seluruh layar peran operasional) tetap satu dropdown seperti semula. Sebelum aturan ini, enam kelompok Admin IT dirender sebagai `DropdownLabel` di dalam satu dropdown "Area Admin": tiga kedalaman data dipaksa muat di dua kedalaman dengan mengorbankan hierarki yang dikunci pemilik di `BLUEPRINT §12` ("kita kan sudah urutkan menu berdasarkan sub menu, kenapa ini digabung semua"). Terukur setelah ralat: Admin IT = **9 item pada baris menu kedua** (Dashboard, Akademik, 6 kelompok, Lainnya), Operator Platform = **4** (Dashboard + tiga kelompok yang punya daun terlihat; `Master System Reference` terpotong karena resolver memang membuang grup tanpa anak — vonis §12, bukan menu hilang).
- **Yang tampil di nav adalah `label`; yang verbatim terhadap §12 sekarang `description`.** `§4.17.1` mengenal dua sumber label dengan satu aturan (`labelKey` statis menang atas `label` DB). Ternyata aturan itu **membatalkan register**: delapan daun terkunci (`admin.identity.accounts`, `.rbac`, `.audit`, `admin.institution.profile`, `.catalog`, `admin.parameters.system`, `platform.licensing.directory`, `platform.governance.chain`) membawa `labelKey` sehingga layar mencetak "Pengguna" alih-alih teks register. `labelKey` pada daun **ber-`lock`** dihapus (terukur: 27 → 19 `labelKey` di `menu-tree.ts`, **nol** daun §12 membawanya); ia tetap untuk akar/pintasan non-register (`dashboard`, `akademik`, `more.*`, `admin.identity.requests`) yang memang bukan bagian dari 39 daun. **Ralat siklus 13 (F-1, `§2.7`/`BLUEPRINT §12.7`):** kalimat yang tadi dikutip sebagai "label register" tidak lagi tinggal di `label` — `label` kini nama nav pendek ("Akun Sivitas") dan kalimat utuhnya tinggal di `description` (tooltip). Jadi yang dijaga `verify:menu`/`menu-tree.test.ts` adalah `description ?? label`, dan aturan "jangan potong dengan ellipsis" pindah maknanya: yang tidak boleh terpotong adalah **teks register di kolom DB**, bukan teks yang dirender di baris menu. Dropdown tetap melebar `min-width: 340px / max-width: 460px` + `white-space: normal` karena item lain (nama kelompok, daun bernama panjang yang sah) masih perlu membungkus.
- **Pemicu dropdown tidak boleh lenyap hanya karena anaknya belum ber-rute** (ralat siklus 9, `RD-180`). Aturan render `top-nav.tsx` adalah `isEmptyTrigger` = **tanpa target DAN tanpa anak**, bukan "tanpa target": grup hasil §6.2 yang anak-anaknya masih `BELUM` (impor data master, persetujuan parameter) harus tetap terbuka supaya daunnya terlihat sebagai "Segera"; yang disembunyikan hanya akar yang benar-benar kosong. Daun tanpa rute dirender `<span aria-disabled="true" data-soon>`, bukan `<a href>` mati, dan grup tanpa target memakai `aria-disabled` pada tombolnya — **bukan** `display: none`. Alasan desainnya pengguna, bukan estetika: pada siklus sebelumnya pemicu kosong membuat enam daun baru §6.2 **tidak dapat dibuka sama sekali**, dan "menu tidak muncul" dibaca sebagai fitur hilang.
- **Urutan baris menu = urutan register, bukan urutan tabel.** (ralat siklus 11.) Promosi grup pada butir sebelumnya sudah benar isinya tetapi salah rakit: keluarannya mengikuti urutan akar di DB (`dashboard`, `akademik`, `admin`, `more`) sehingga `Akademik` menyela di antara `Dashboard` dan kelompok 1, dan penomoran §12.2 tidak lagi terbaca. Aturan sekarang tiga ember: **tautan pendaratan** (akar ber-`href` tanpa anak) → **seluruh grup terpromosikan berdampingan menurut `sortOrder`** → **akar lain** (`akademik`, `more`). Terukur `admin2`: Dashboard · Dashboard IT Kampus · Konfigurasi Tenant, Branding & Active Add-ons · Master Parameter & Aturan Kampus · Pengguna & Access Control · Gateway & Integrasi Server · Pemeliharaan & Maintenance Tools · Akademik · Lainnya (9 item, kelompok 1–6 contiguous). Operator Platform: 4 item (`platform.master` terpotong resolver karena nol daun terlihat). Peran tanpa grup terpromosikan (dosen/mahasiswa) tidak berubah urutan.
- **Penjaga data untuk kedua cacat `RD-181`** (vitest, `tests/unit/menu-tree.test.ts`): **nol** daun ber-`lock` boleh membawa `labelKey`; akar wadah yang dipromosikan harus tepat `admin` + `platform`, `sortOrder` grup-nya naik, tanpa duplikat, mulai dari 10, dan bersarang persis dua tingkat; nama kelompok wajib persis tabel §12.6. Ini menutup lubang yang tidak dilihat `verify:menu` (ia membandingkan kolom DB, bukan teks yang dirender). Yang **masih** belum berjaga: perbandingan langsung teks DOM terhadap `menu_items.label` — butuh RTL/render test, tercatat sebagai pekerjaan lanjutan. Aturan render `top-nav.tsx` adalah `isEmptyTrigger` = **tanpa target DAN tanpa anak**, bukan "tanpa target": grup hasil §6.2 yang anak-anaknya masih `BELUM` (impor data master, persetujuan parameter) harus tetap terbuka supaya daunnya terlihat sebagai "Segera"; yang disembunyikan hanya akar yang benar-benar kosong. Daun tanpa rute dirender `<span aria-disabled="true" data-soon>`, bukan `<a href>` mati, dan grup tanpa target memakai `aria-disabled` pada tombolnya — **bukan** `display: none`. Alasan desainnya pengguna, bukan estetika: pada siklus sebelumnya pemicu kosong membuat enam daun baru §6.2 **tidak dapat dibuka sama sekali**, dan "menu tidak muncul" dibaca sebagai fitur hilang.
- **Nama glif diperiksa dari pustakanya, bukan dipercaya.** `.tools/icon-check.mjs` (gerbang `gate-run` sejak siklus ini) membandingkan setiap `ri-*` di `apps/web/src/**` dengan `remixicon.css` 4.5.0. Ia langsung menemukan lima nama salah, termasuk `ri-scroll-text-line` pada pintasan KHS yang sudah terpasang di layar — `tsc`, `vitest` dan `gate-run` sebelumnya tidak punya cara melihat kotak kosong itu.

### 17.8 Kunci i18n grid kartu (diukur, belum ada satu pun)

Terukur 2026-10-20 dengan penghitungan daun rekursif atas `apps/web/src/locales/*.json`: **`id.json` 574 daun · `en.json` 518 daun** (utang paritas 56 kunci, seluruhnya `landing.roles.tabs.*`, §11.8), dan namespace tingkat atas **hanya** `auth`, `dashboard`, `navigation`, `landing`. `dashboard.*` berisi 10 daun (`title`, `welcome`, `activePeriod`, `quickActions`, `krsOnline`, `khsTranscript`, `attendance`, `billing`, `profile`, `logout`). **Tidak ada** satu pun daun untuk `helpdesk`, `hris`, `sister`, `journal`, `incubator`, `skkm`, `career`, `international`, `iku`, `library`, `asset`, `clinic`, `residence`, `humas`, `research`, `crm`, `procurement`, `endowment`, `ppks` (semuanya diukur 0). Jadi semua kunci di bawah ini adalah **permintaan baru**, bukan daftar yang sudah ada:

```
dashboard.modules.title                       dashboard.modules.reload
dashboard.modules.sortNote                    dashboard.modules.empty
dashboard.modules.state.{queued,failed,revoked,moduleOff,noData}
dashboard.modules.degraded.{lookup,prereq,budget,sample}
dashboard.modules.count.{pending,dueSoon,waitingValidation}
dashboard.modules.card.open                   dashboard.modules.card.cta.<aksi>
dashboard.modules.footer.<M-xx>               navigation.module.<M-xx>
```

Aturan: satu kunci per keadaan, **nol** teks UI literal di komponen (AGENTS §3.5); nama modul Indonesia diambil dari `navigation.module.<M-xx>` supaya satu istilah tidak punya dua terjemahan (§9.5); setiap kunci baru **wajib** masuk `id.json` **dan** `en.json` pada commit yang sama, dan gerbang `RD-19` (pembanding daun + tipe kamus) menolak kekurangan kunci saat `tsc`. Paritas Mobile (AGENTS §3.4): Flutter membaca `intl` dengan kunci bernamespace sama; kartu tanpa padanan wajib dicatat sebagai pengecualian (§12.10 pola), bukan hilang diam-diam.

### 17.9 Definition of Done lapisan dashboard dinamis

- [ ] **DB-1** Grid dirender dari **tiga** gerbang server (`tenant_modules` × izin dari `user_role_assignments` × `menu_items`); uji peran membuktikan kartu yang tidak berhak **absen dari payload**, bukan `hidden` di DOM (§11.9 butir 6, pola DF-5).
- [ ] **DB-2** Keadaan 2 dan keadaan 3 punya copy berbeda dan dapat dibedakan oleh uji komponen (`404 MODULE_NOT_AVAILABLE` baris 26 versus `degraded:"LOOKUP_GROUP_EMPTY"`).
- [ ] **DB-3** Keadaan 6 diuji: penugasan `valid_to` lewat → sesi lama → kartu hilang dan pesan menyebut pemegang hak berikutnya; tidak ada jalur tulis yang lolos karena cache.
- [ ] **DB-4** Nol angka akademik dihitung di klien: grep penjaga menolak `reduce(`/`sum(`/perhitungan rasio di lapisan tampilan untuk kartu mana pun; angka hanya proyeksi server (§13.2 vonis 2).
- [ ] **DB-5** Nol `layout` animation pada grid; peristiwa mengubah lencana tanpa memindahkan kartu (uji: kirim `attendance.record.verdict` tertiru lalu assert bahwa posisi DOM tidak berubah).
- [ ] **DB-6** Nol dependensi grafik baru; setiap bentuk visual adalah varian `velzon-chart.tsx`/`ProgressStack` (§17.6) dan palet hanya `--sica-chart-1…5`.
- [ ] **DB-7** Fokus seluruh CTA memakai resep §11.11.2 (primer hijau, `focus:bg-sica-card`), nol `blue-*`, nol `bg-white` baru, nol `font-black`/`font-extrabold`, `next build` + `.tools/purge-check.mjs` lulus (kelas `badge-soft-*` teremit).
- [ ] **DB-8** Semua kunci §17.8 ada di `id.json` **dan** `en.json`; selisih daun tidak bertambah dari 56.
- [ ] **DB-9** Kontras dua tema FAILS = 0 setelah lencana/strip baru; target sentuh ≥ 44 px; `.tabular` untuk semua angka.
- [ ] **DB-10** Setiap baris §17.2 yang bersandi **usulan** ditandai begitu di kode dan tidak diklaim selesai; promosi `RBAC_MATRIX §4.5` → `PERMISSION_SPECS` → `gen-rbac-seed.mjs` adalah syarat sebelum kartunya bisa dianggap bisa dipakai (AGENTS §3.8/§3.11).

---

## 18. Pola layar untuk modul `NOL` dan yang permukaannya belum ada (2026-10-20)

> **Cakupan dan alasan penggabungan.** Registri [PRD §5.12.1](file:///c:/SICA/docs/PRD.md) mengukur **15** baris `NOL` (M-06, M-08, M-21, M-22, M-24, M-28, M-29, M-36, M-40, M-41, M-42, M-43, M-45, M-46, M-47); M-04 sudah naik ke `PENUH` pada 2026-10-22 dan blok §18.1 dipertahankan sebagai rujukan pola layar penuh, bukan lagi pola modul `NOL`. Tiga modul lain ikut di bagian ini karena permukaannya **nol berkas** meskipun statusnya `SEBAGIAN`: M-25 (logbook disebut, penempatan belum), M-39 (bebas pustaka disebut, sirkulasi belum), M-44 (hibah disebut satu kalimat). Total 19 modul, **12 blok**: tujuh blok menggabungkan dua modul yang berbagi fisik layar, karena 19 blok identik hanya akan menghasilkan 19 salinan aturan yang tidak bisa berbeda ketika perlu. Pasangan dan alasannya: M-06 dengan M-08 (satu objek pegawai; M-08 hanyalah transport, vonis 7), M-21 dengan M-22 (satu gerbang jual `publication`, partisi izin berbeda), M-24 dengan M-43 (satu mata rantai poin SKKM: `event.registration.checked_in` mengusulkan, kemahasiswaan menyetujui), M-25 dengan M-28 (sama-sama pencocokan bipartit "usulan lalu manusia"), M-36 dengan M-41 (sama-sama rahasia kelas khusus UU PDP dengan vonis nol visibilitas), M-39 dengan M-42 (sama-sama sirkulasi dengan jatuh tempo dan tarif yang rumahnya M-10), M-40 dengan M-46 (satu arah: perolehan melahirkan kartu aset, vonis 6).
>
> **Kepemilikan.** FR/AC per modul = PRD §5.14 (namespace `FR-HLP`, `FR-HRS`, `FR-SIS`, `FR-PUB`, `FR-IPR`, `FR-KBM`, `FR-FLW`, `FR-CRD`, `FR-MBL`, `FR-PPK`, `FR-LIB`, `FR-AST`, `FR-CLN`, `FR-RSD`, `FR-EVT`, `FR-LPP`, `FR-CRM`, `FR-PBJ`, `FR-DNF`). Nama objek + DDL + nomor migrasi = `DATA_MODEL`. Kode izin = `RBAC_MATRIX §4/§4.5` (terukur: katalog normatif **222**; §4.5 memuat **161** baris dan **111** di antaranya berstatus `usulan`). Path + kode error = `API_SPEC`. Bagian ini **hanya** pola layar.
>
> **Status: spesifikasi.** Terukur 2026-10-20, berkas sumber (`.ts`, `.tsx`, `.dart`, `.sql`, keluaran bangun dikecualikan) untuk `helpdesk`, `payroll`, `scholarship`, `inkubator`, `lowongan`, `asrama`, `kantin`, `humas`, `procurement`, `endowment`, `proctor` = **0 berkas**, dan `apps/web/src/app/(dashboard)/` hanya berisi `dashboard` + `academic`. Namespace i18n seluruh modul di bagian ini juga **0 daun** (diukur §17.8). Tidak satu pun blok di bawah boleh disebut sudah dibangun.

### 18.0 Aturan yang berlaku di semua blok §18

1. **Komposisi halaman selalu** `PageHeader` + `MetaRow` (konteks: `Periode aktif` · `Prodi/site scope` · `Status periode`) + `VelzonDataGrid` + **satu** `Drawer` kanan 60 %, lalu `ConfirmDialog` hanya untuk aksi destruktif (§9.2, §11.4, §11.6). Modal bertumpuk di Area Admin ditolak (§11.7 butir 8).
2. **Nol angka yang dihitung di klien** — termasuk rasio, denda, poin, CAC, imbal hasil, dan penyusutan. Proyeksi server mengirimnya sebagai kolom jadi (PRD §5.12.2 butir c, ARCHITECTURE §13.2 vonis 2). Kartu §17 menaut ke layar ini, tidak menghitung ulang isinya.
3. **`SERVER_ONLY` adalah keadaan, bukan styling.** Kolom yang hanya berubah lewat transisi state **tidak pernah** diterima dari body dan **tidak** punya kendali sunting di klien; `readOnly` untuk field `SERVER_ONLY` justru temuan (§15.6, pola uji RG-5/DF-5: kunci **absen dari payload**).
4. **Nominal keuangan tidak bocor ke peran akademik.** Peran non-keuangan menerima boolean "tertahan/tidak" + sebab (SoD BAAK-BAUK: baris 123 `finance.tuitionmatrix.view` dan baris 152 melarang `ADMIN_ACADEMIC`). Berlaku identik untuk denda M-39, CAC M-45, HPS M-46, imbal hasil M-47, dan tarif APC M-21.
5. **Jejak empat-mata dirender dari baris transisi**, bukan dari tombol: `requested_by`/`approved_by`/`reason`/`approved_at` + status `PENDING/APPROVED/REJECTED`, dan pemohon **tidak pernah** melihat tombol sahkan untuk permintaannya sendiri (§9.7, `403 SELF_APPROVAL_FORBIDDEN` 56, `409 DECISION_ALREADY_MADE` 55). Komponennya satu: `ApprovalTrail` (§18.13).
6. **Nol hardcoding kelas C/D.** Setiap opsi yang dapat dinamai ulang kampus dibaca dari `GET /api/v1/master/lookups?group={GROUP_CODE}` dan dirender Dynamic Form Generator §13; urutan dari server `sort_order, code` (§13.2). Setiap `kind` yang dibaca layar **wajib** punya baris `reference_kind_usage` (DF-2, gerbang (n)).
7. **i18n**: namespace `<modul>.list.*`, `<modul>.detail.*`, `<modul>.action.*`, `<modul>.state.*`, `<modul>.errors.*` — **belum ada satu pun** di `id.json`/`en.json` (diukur §17.8); kunci wajib masuk dua berkas pada commit yang sama, dan tidak ada teks UI literal (AGENTS §3.5).
8. **Fokus, tipografi, grafik** mengikuti §11.11.2, §11.2, §11.5/§17.6: primer hijau tunggal, bobot 400–700, nol paket grafik.
9. **Izin `usulan` tidak boleh dijadikan alasan menyembunyikan layar secara diam-diam**: blok yang izinnya belum masuk katalog menampilkan **panel "belum dapat ditegakkan"** (penjelasan + rujukan baris `RBAC_MATRIX §4.5`) dan tidak lulus DoD sampai promosi terjadi (DB-10, AGENTS §3.8).

### 18.1 M-04 IT Helpdesk — `/helpdesk` (sendiri: gerbang peran, bukan SKU)

- **Rute dan `route_key`**: `/helpdesk` "Tiket Saya" · `/helpdesk?ticket=<nomor>` drawer detail · `/helpdesk/antrean` "Antrean Tiket" (agen) · `/helpdesk/kategori`, `/helpdesk/sla`, `/helpdesk/basis-pengetahuan` (konfigurasi Admin IT). `route_key` usulan `helpdesk.ticket.list`, `helpdesk.ticket.detail`, `helpdesk.queue.list`, `helpdesk.category.list`, `helpdesk.sla.list`, `helpdesk.kb.list`. `module_code` = **`null`** (PRD §5.12.3 menarik `helpdesk` dari kolom entitlement: gerbangnya peran, bukan SKU), jadi **tidak ada** `404 MODULE_NOT_AVAILABLE` untuk modul ini — yang ada hanya `403`.
- **Komposisi Velzon**: `PageHeader` (judul + `Button variant="default"` "Ajukan tiket") · `MetaRow` (site aktif, panjang antrean per kategori) · `VelzonDataGrid` · `Drawer` 60 % · `Alert` kebijakan SLA hanya untuk pemegang izin antrean · `ApprovalTrail` §18.13 pada layar SLA dan basis pengetahuan.
- **Kolom grid**: `nomor_tiket` (`.tabular`, tautan drawer) · `judul` · `kategori` (label dari kamus `reference_items(kind='jenis_tiket')`, **kelas C**, bukan array JSX; SLA-nya dibaca dari `helpdesk_sla_policies`) · `keadaan` (`StatusBadge`, enum kelas A: `OPEN`, `IN_PROGRESS`, `PENDING_USER`, `RESOLVED`, `CLOSED`, `CANCELLED` per FR-HLP-01) · `prioritas` (A′: enum `LOW/NORMAL/HIGH/URGENT`, label dari `reference_items(kind='prioritas_tiket')`) · `pemohon` · `penanggung_jawab` (`Avatar` + inisial) · `sla_tanggapan_sisa` (`.tabular`, merah hanya untuk pemegang izin antrean) · `updated_at`.
- **Form pengajuan** (DF §13): `judul` `TEXT` wajib · `kategori` `SELECT` dari kamus · `deskripsi` `TEXTAREA` · `attachment` `FILE` **non-aktif dengan sebab** selama penyimpanan presigned belum ada (DF-9) · `dampak` `SELECT` kamus `tingkat_dampak` · atribut kelas D lewat `tenant_custom_attributes`. `prioritas` **tidak ada** di form pemohon: ia diturunkan server dan hanya dapat diubah agen lewat `PATCH`.
- **Tombol dan izin penutupnya**: "Ajukan tiket" = usulan `helpdesk.ticket.create` · "Tangkap antrean" = usulan `helpdesk.ticket.claim` · "Minta informasi" = usulan `helpdesk.ticket.update` (state `PENDING_USER`) · "Tandai selesai" = usulan `helpdesk.ticket.resolve` · "Tutup" = usulan `helpdesk.ticket.close` (`VALIDATE`, empat-mata dengan resolver) · "Buka kembali" = usulan `helpdesk.ticket.reopen` dengan `reason` wajib · "Batalkan" = usulan `helpdesk.ticket.cancel` dengan `reason` wajib · "Sunting kategori" = usulan `helpdesk.category.update` · "Versi SLA baru" = usulan `helpdesk.sla.create` + `helpdesk.sla.approve` (`VALIDATE`, empat-mata) · "Terbitkan artikel" = usulan `helpdesk.kb.publish` (`VALIDATE`, penulis ≠ penerbit). **Status katalog:** 3 baris ber-nomor (288–290: `view`, `create`, `close`) dan 20 usulan di `RBAC_MATRIX §4.5.6`; layar memakai `usulan` sampai baris itu dipromosikan ke `PERMISSION_SPECS`, dan itu dinyatakan di panel §18.0 butir 9 — bukan disembunyikan.
- **`SERVER_ONLY`**: `nomor_tiket` (satu nomor urut per tenant, tidak dapat didaur ulang — FR-HLP-01), `keadaan`, `sla_due_at`, `first_response_at`, `closed_by`, dan `prioritas` bagi pemohon. Nomor, jam SLA, dan transisi tidak pernah diterima dari body; percobaan mengirimnya = `422 VALIDATION_FAILED` (6).
- **Edge case wajib tercover**: tiket akademik **ditolak masuk** dengan rujuk silang ("banding presensi memakai M-18, laporan PPKS memakai M-36") — penolakan dirender sebagai `Alert` dengan tautan, bukan `403` dingin; SLA berhenti saat `PENDING_USER` (jam kerja kalender kampus dihitung server, FR-HLP-02); penutupan otomatis setelah `N` hari dibaca dari kunci `helpdesk.auto_close_after_days` (§21.3, kelas `TECHNICAL`), bukan konstanta JSX; versi SLA `ACTIVE` tidak dapat disunting in-place — versi baru disahkan dan versi lama ditutup; artikel `PUBLISHED` tanpa judul/isi Inggris ditolak, dan penerbit yang sama dengan penulis → `403`; lampiran PII di-masking untuk peran tanpa hak; pemohon melihat antreannya sendiri tanpa membaca isi tiket orang lain (RLS + scope `SELF`).
- **DoD**: **HD-1** keenam keadaan §17.4 punya cabang render · **HD-2** nol `options={[` untuk `kategori`/`dampak` dan baris `reference_kind_usage` ada (DF-2) · **HD-3** `nomor_tiket` tidak pernah muncul di body uji (DF-5) · **HD-4** salin-silang M-18/M-36 teruji sebagai penolakan dengan sebab · **HD-5** izin `usulan` tercatat dan panel §18.0 butir 9 dirender · **HD-6** kunci `helpdesk.*` lengkap di dua berkas · **HD-7** versi SLA `ACTIVE` tidak dapat ditimpa (uji 409) dan satu `ACTIVE` per kategori · **HD-8** terbit artikel dua bahasa + penulis ≠ penerbit teruji (AC-HLP-2).

### 18.2 M-06 HRIS dan Payroll dan M-08 SISTER Sync — `/pegawai` dan `/sister` (digabung: M-08 hanya transport)

Dua alamat, satu objek pegawai: M-06 memiliki fakta kepegawaian, M-08 hanyalah adapter yang memproyeksikannya. Digabung karena bentuk layarnya sama-sama "kartu orang plus masa kerja dan riwayat", dan karena vonis 7 melarang M-08 memiliki angka — memisahkan bloknya akan mengundang M-08 membuat kolom kedua yang dilarang.

#### 18.2.1 M-06 HRIS dan Payroll — `/pegawai`

- **Rute**: `/pegawai` daftar · `/pegawai?employee=<id>` drawer · `/pegawai/cuti` antrean cuti · `/pegawai/kebijakan-cuti` pita hak cuti · `/pegawai/kpi` bobot & hasil KPI · `/pegawai/gaji` run penggajian · `/pegawai/gaji/{runId}` drawer run · `/pegawai/slip` slip saya (SELF) · `/pegawai/jaminan-sosial` papan iuran. `route_key` kanonik (disetel siklus M-06): `hris.employee.list`, `hris.leave.list`, `hris.leavepolicy.list`, `hris.kpi.list`, `hris.payroll.list`, `hris.payslip.self`, `hris.insurance.board`. Entitlement `usulan: hris`.
- **Komposisi**: `PageHeader` + tab di dalam drawer (`Identitas` · `Jabatan dan Golongan` · `Cuti` · `Gaji dan PPh 21` · `Dokumen` · `Riwayat status`) sesuai pola objek lebar §9.2; tab `Gaji dan PPh 21` hanya dirender untuk pemegang izin baca finansial.
- **Kolom grid**: `nip_internal` · `nama` · `jabatan_fungsional` (kamus kelas C) · `golongan` (A′) · `unit` · `site` · `tanggal_masuk` · `status_pegawai` (enum kelas A) · `hak_cuti_sisa` (`.tabular`, dihitung server dari `leave_policies` berversi, FR-HRS-02) · `skor_kpi` (basis-poin server).
- **Kolom finansial** (grup terpisah, `Badge tone="info"` + `reason` wajib): `pokok` · `tunjangan` · `potongan_pph` · `take_home` · `status_posting`. Semuanya **angka M-10**: M-06 mengusulkan, pembayaran diterbitkan lewat service keuangan (vonis 5); tidak ada jurnal kedua di layar ini.
- **Tombol dan izin (kode ber-nomor sejak siklus M-06 — `RBAC §4.5.9`; nama bayangan `hr.*` tidak dipakai lagi)**: "Tambah pegawai" = `hris.employee.insert` (163) · "Nonaktifkan pegawai" = `hris.employee.deactivate` (165, transisi terminal: modal wajib `reason` + `jenis_pemberhentian` dari kamus + bukti PHK, dan **tidak pernah** muncul sebagai tombol "Hapus") · "Ajukan cuti" = `hris.leave.request` (166) · "Sahkan/Tolak cuti" = `hris.leave.approve` (167, **empat-mata**: atasan bukan pemohon) · "Ubah kebijakan cuti" = `hris.leavepolicy.insert/.update` (354/355) dengan tombol terpisah "Ajukan persetujuan" = `hris.leavepolicy.approve` (356) · "Hitung periodik" = `hris.payroll.run` (169, `OTHER` → `202 { runId }` + kartu berjalan) · "Sahkan run" = `hris.payroll.release` (170) · "Posting jurnal" = `hris.payroll.post` (360, label jelas: **usulan** ke M-10, bukan jurnal kedua) · "Balikkan run" = `hris.payroll.void` (361, alasan ≥ 15 karakter + MFA + penyetuju kedua) · "Susun KPI" = `hris.kpi.insert` (370) / "Setujui bobot" = `hris.kpi.approve` (371) / "Nilai pegawai" = `hris.kpi.assess` (374) / "Telaah hasil" = `hris.kpi.review` (373). Catatan historis yang sengaja ditinggalkan di sini: `hr.profile.manage` adalah kode **nyata** di `§4.3` yang hari ini menjadi gerbang sunting identitas — ia tetap berlaku sampai `PERMISSION_SPECS` memindahkan gerbang ke 164, dan layar tidak boleh berpura-pura sudah memakai kode baru yang belum dipromosikan (`G-15`).
- **Layar kebijakan cuti** (`/pegawai/kebijakan-cuti`): grid pita per (jenis × golongan × pita masa kerja) dengan kolom `effective_from`/`effective_to`/`version` dan badge versi aktif; `Form` memakai `Select` kamus untuk `jenis_cuti` (**nol array opsi di JSX**, §13/§20); mencoba menyimpan di atas pita yang tumpang tindih menampilkan `409` dari `EXCLUDE` sebagai sebab terbaca ("pita 0–3 tahun sudah terisi oleh versi 4"), bukan "terjadi kesalahan".
- **Layar KPI** (`/pegawai/kpi`): dua tab — `Definisi bobot` (baris bobot dalam **basis-poin** dengan baris jumlah; jumlah ≠ 10.000 menampilkan `Alert tone="warning"` "sisa 1.200 bp belum dialokasikan" dan tombol simpan mati) dan `Hasil penilaian` (skor per komponen + bukti lampiran + status `DRAFT/ASSESSED/APPROVED`). **Nol kolom BKD** di kedua tab (HR-2), hanya tautan "Lihat di BKD".
- **Layar run penggajian** (`/pegawai/gaji/{runId}`): stepper keadaan `DRAFT → CALCULATED → REVIEWED → APPROVED → POSTED → PAID → VOID` (satu-satunya kosakata = enum `payroll_run_status`, dirender dari respons, tidak dihitung di klien), panel reproducibility (`parameter_version`, `input_snapshot_hash`, `tax_rule_version`, `degraded`), dan daftar `payslip_lines` dengan nominal yang **disaring server** untuk peran non-keuangan. Run `VOID` menampilkan baris pembalik + siapa + alasan, **tidak pernah** kehilangan slip.
- **Slip saya (SELF)** (`/pegawai/slip`): kartu per periode dengan `take_home` milik sendiri, tautan unduh (reading-only, tanpa `EXPORT` baru), dan copy bila role tidak berhak: "Nominal gaji hanya terlihat untuk Anda dan BAUK." — angka orang lain **absen dari payload**, bukan `••••` di DOM.
- **`SERVER_ONLY`**: `status_pegawai`, `take_home`, `potongan_pph`, `posting_ref` (id jurnal M-10), `hak_cuti_sisa` (turunan kebijakan). Nomor rekening pegawai adalah PII `SPECIFIC`: hanya terbaca oleh peran `role_view`-nya, dan kunci di luar hak **absen dari payload** (pola baris 142).
- **Vonis yang mengikat layar**: **M-07** satu-satunya yang menghitung 12 sks tridharma — layar ini **tidak** punya kolom BKD, hanya tautan "Lihat di BKD"; **M-10** satu-satunya penerbit tagihan dan jurnal (vonis 5).
- **Edge case**: satu orang satu kartu (`user_id` dari token, FR-HRS-01; kartu kedua atas identitas sama = `409 CONFLICT` 12) · kebijakan cuti berubah di tengah periode: versi yang berlaku dihitung dari tanggal pengajuan di server, **bukan** versi aktif hari ini · pegawai ganda di dua site: scope `SITE` (baris 112) dibuktikan, tidak dibaca dari body · PPh 21 memakai tarif kelas B dari kamus nasional (kode tidak dapat disunting tenant — baris 128).
- **DoD**: **HR-1** nominal hanya tampil untuk peran berhak, dibuktikan assert kunci absen · **HR-2** nol kolom BKD di layar ini (grep penjaga) · **HR-3** pengajuan dan persetujuan cuti tidak pernah satu actor · **HR-4** `hak_cuti_sisa` tidak ada di body · **HR-5** izin `usulan` tercatat dan panel §18.0 butir 9 dirender · **HR-6** kunci `hris.*` dua berkas · **HR-7** (baru, siklus M-06) tidak ada satu pun tombol "Hapus pegawai"/"Hapus run": yang ada `Nonaktifkan` (165) dan `Balikkan` (361), dan keduanya wajib membuka modal beralasan · **HR-8** bobot KPI tampil basis-poin dengan jumlah hidup; simpan mati saat ≠ 10.000 · **HR-9** stepper run membaca `payroll_run_status` dari server — tidak ada kosakata keadaan kedua di komponen.

#### 18.2.2 M-08 SISTER Sync — `/sister`

- **Rute**: `/sister` status kirim · `/sister?batch=<id>` drawer rincian. `route_key` usulan `sister.sync.status`. Entitlement `usulan: sister`.
- **Komposisi**: empat `StatCard` (portofolio siap · tertolak · terkirim · `watermark` terakhir) + `VelzonDataGrid` **per item delta** + panel antrean (`queue_operations` state `QUEUED/PROCESSING/SUCCEEDED/FAILED/EXPIRED`) + `ApprovalTrail` §18.13 untuk perubahan peta identitas. **Tidak ada** form sunting data dosen di sini: layar membaca **proyeksi** modul sumber (FR-SIS-01) dan menolak setiap percobaan tulis (kodenya masih **usulan**, pemiliknya `API_SPEC`; sampai ada barisnya layar memakai `405` pola "hanya-baca" dan menyebut modul sumbernya, bukan pesan generik).
- **Kolom grid**: `portofolio_ref` (sumber: M-07 pendidikan, M-20 luaran, M-44 hibah) · `jenis_luaran` (kamus kelas C) · `hash_delta` (12 karakter pertama, `monospace`) · `keadaan` (enum kelas A `READY/REJECTED/PUSHED/RETRY`) · `sebab_tolak` · `watermark_before` · `watermark_after`.
- **Tombol dan izin**: "Bangun delta" = usulan `sister.sync.run` (`OTHER`, `Idempotency-Key`) · "Kirim" = usulan `sister.push.execute` · "Ulangi yang gagal" = usulan `sister.push.retry` (idempoten: watermark hanya maju atas baris sukses, peristiwa `sister.portfolio.pushed`) · "Sahkan peta identitas" = usulan `sister.identity.map` (`VALIDATE`, empat-mata — salah peta berarti salah laporan ke negara).
- **`SERVER_ONLY`**: `watermark_before`, `watermark_after`, `keadaan`, `pushed_at`, `failed_items_ref`. Semua angka tridharma **tidak dimiliki layar ini** (vonis 7: M-08 transport, tidak memiliki angka) — tidak ada satu pun `Input type="number"` di `/sister`.
- **Edge case**: kirim sebagian (`failed_items_ref` = daftar, bukan angka bulat) · antrean penuh → state 4 §17.4 dengan `position` · sumber berubah setelah snapshot → `409 ENGINE_STALE_SNAPSHOT` (pola §12.1) · data dosen tenant lain tidak pernah terbaca (RLS + `SET LOCAL app.current_tenant`).
- **DoD**: **SS-1** nol field yang dapat disunting di `/sister` (grep) · **SS-2** watermark tidak pernah maju atas baris gagal (uji) · **SS-3** kirim ulang dengan kunci sama menghasilkan batch tunggal · **SS-4** izin `usulan` tercatat · **SS-5** kunci `sister.*` dua berkas.

### 18.3 M-21 Jurnal dan OJS dan M-22 Inkubator dan HAKI — `/jurnal` dan `/haki` (digabung: satu gerbang jual `publication`)

Kedua modul berbagi kandidat SKU `usulan: publication` tetapi **partisi izinnya berbeda** (PRD §5.14), jadi keduanya berbagi kerangka layar (daftar objek terbitan dengan keadaan mesin dan bukti) sementara kolom, tombol, dan gerbangnya tetap masing-masing.

#### 18.3.1 M-21 Jurnal dan OJS — `/jurnal`

- **Rute**: `/jurnal` daftar jurnal · `/jurnal/terbitan?issue=<id>` · `/jurnal/artikel?article=<id>` drawer. `route_key` usulan `journal.list`, `journal.article.detail`.
- **Komposisi**: pemilih jurnal (dari data, bukan konstanta) + `StatusBadge` siklus FR-PUB-01 + `VelzonDataGrid` artikel + `Drawer` bertab (`Identitas` · `Review` · `Berkas` · `Biaya` · `Indeksing`) + `ApprovalTrail` §18.13 untuk keputusan terbit.
- **Kolom grid**: `judul` · `penulis_korespondensi` · `status` (enum kelas A: `SUBMITTED`, `UNDER_REVIEW`, `REQUIRED_REVISION`, `ACCEPTED`, `REJECTED`, `IN_PRESS`, `PUBLISHED` — keadaan **mesin**, bukan kamus) · `issue` · `reviewer_count` · `similarity_ref` · `apc_status` (boolean untuk peran editorial; nominal hanya untuk pemegang izin `finance` — §18.0 butir 4) · `terbit_at`.
- **Tombol dan izin**: "Terima naskah" = usulan `publication.article.insert` · "Tugaskan reviewer" = usulan `publication.review.assign` · "Rekomendasikan keputusan" = usulan `publication.review.submit` (`OTHER`, reviewer hanya boleh rekomendasi) · "Sahkan terbit" = usulan `publication.article.publish` (`VALIDATE`, empat-mata dengan reviewer) · "Usulkan biaya APC" = usulan `publication.apc.propose` — **tidak pernah** menagih sendiri: usulan menjadi invoice hanya lewat service M-10 (vonis 5, FR-PUB-02) · "Kirim luaran ke BKD" = usulan `publication.portfolio.emit` (sinyal ke M-07, bukan angka kedua — vonis 7).
- **`SERVER_ONLY`**: `status`, `published_at`, `doi`, `apc_status`, `review_deadline` (dari kunci `journal.review_window_days`, kelas `OPS`), `volume_issue`. Peran editorial **tidak** menerima `amount_rupiah`; yang dikirim server adalah boolean beserta sebab.
- **Edge case**: artikel dengan `embargo_until` → sel tetap tampil, isian berkas dikunci dengan sebab · reviewer tanpa kelas ampuan → `403` dengan rujukan · revisi lewat batas → `423 PERIOD_CLOSED` pola (25) **tidak** dipakai di sini: layar menampilkan `status` `REQUIRED_REVISION` + tanggal, tanpa tombol sunting untuk penulis yang menangguhkan · naskah **wajib** diperiksa terhadap permohonan HKI aktif penulis yang sama (FR-IPR-02): temuannya **sinyal peringatan** dengan tautan keputusan manusia, bukan pemblokiran otomatis.
- **DoD**: **JB-1** nol tombol "Bayar APC" di `/jurnal` (grep; penagihan milik M-10) · **JB-2** reviewer tidak pernah bisa mempublikasikan rekomendasinya sendiri (uji SoD) · **JB-3** `status` tidak pernah masuk body · **JB-4** sinyal anti-kebocoran HKI dirender sebagai peringatan, bukan pembatalan status publikasi · **JB-5** kunci `journal.*` dua berkas dan izin `usulan` tercatat.

#### 18.3.2 M-22 Inkubator dan HAKI — `/haki`

- **Rute**: `/haki` daftar permohonan · `/haki?ip=<id>` drawer. `route_key` usulan `ip.application.list`.
- **Komposisi**: `VelzonDataGrid` + drawer tab (`Identitas` · `Klasifikasi` · `Bukti` · `Lisensi` · `Riwayat`) + `ApprovalTrail` §18.13 · kartu "wirausaha rintisan" terpisah (modul ini mencakup inkubator, FR-IPR-01).
- **Kolom grid**: `nomor_permohonan` · `jenis_hki` (**kelas B** — paten, paten sederhana, merek, desain industri; kodenya milik negara, tenant hanya memetakan label, baris 128) · `judul_invensi` · `penemu[]` (`AvatarGroup`) · `status` (enum kelas A `DRAFT/FILED/PUBLISHED/GRANTED/REJECTED/WITHDRAWN`) · `tanggal_lembar` (grace period) · `lisensi_status` · `luaran_ref`.
- **Tombol dan izin**: "Daftar permohonan" = usulan `ip.application.insert` · "Unggah bukti" = usulan `ip.evidence.create` · "Sahkan pengajuan ke DJKI" = usulan `ip.application.file` (`VALIDATE`, empat-mata + MFA penulis-admin) · "Catat lisensi" = usulan `ip.license.record` · "Tarik permohonan" = usulan `ip.application.withdraw` (`reason` wajib).
- **`SERVER_ONLY`**: `nomor_permohonan`, `status`, `published_at_djki`, `granted_at`, `license royalty terms` (kolom nominal royalti: angka **M-10**, layar ini hanya status — §18.0 butir 4).
- **Edge case**: penemu ganda lintas prodi (scope `PROGRAM` membuktikan legalitas) · permohonan yang belum diumumkan menahan tautan artikel **dengan sebab**, bukan diam · jenis HKI tidak dapat ditambah kampus (kelas B) dan layar menuliskannya, bukan menyembunyikannya (DF-7 pola label) · `embargo_until` belum lewat → berkas tidak dapat diunduh publik dan pesan menyebut tanggalnya.
- **DoD**: **HK-1** nol `z.enum` untuk `jenis_hki` di kontrak (kelas B, baris 128) · **HK-2** royalti tidak pernah tampil sebagai nominal di `/haki` · **HK-3** `status` hanya lewat transisi `VALIDATE` · **HK-4** gerbang naskah-terbit terbukti (uji pasangan M-21 dan M-22) · **HK-5** izin `usulan` tercatat + kunci `ip.*` dua berkas.

### 18.4 M-24 Kemahasiswaan dan SKKM dan M-43 Humas dan Event — `/kemahasiswaan` dan `/acara` (digabung: satu mata rantai poin)

Poin SKKM lahir dari kegiatan, dan M-43 adalah salah satu sumbernya: peristiwa `event.registration.checked_in` mengirim `skkm_proposal_points` yang **hanya usulan sampai `VALIDATE` kemahasiswaan** (ARCHITECTURE §13.1). Digabung karena keduanya wajib menampilkan keadaan "usulan bukan vonis" yang sama; terpisah, layar acara akan menggoda perannya menghitung poin sendiri (dilarang: M-24 tidak boleh menciptakan keadaan mesin akademik, registri M-24).

#### 18.4.1 M-24 Kemahasiswaan dan SKKM — `/kemahasiswaan`

- **Rute**: `/kemahasiswaan` daftar aktivitas · `/kemahasiswaan/poin` rekap · `/kemahasiswaan?student=<id>` drawer riwayat mahasiswa. `route_key` usulan `student_affairs.activity.list`.
- **Komposisi**: `StatCard` (poin per mahasiswa terpilih, jumlah menunggu pengesahan) + `VelzonDataGrid` + drawer tab (`Aktivitas` · `Bukti` · `Poin` · `Sanksi`) + `Alert` "sumber poin" daftar (mis. 2 dari M-43, 1 dari M-25).
- **Kolom grid**: `tanggal` · `jenis_aktivitas` (kamus kelas C) · `tingkat` (kamus kelas C: kampus, regional, nasional, internasional) · `peran` (kamus kelas C) · `poin_usulan` (basis-poin, teredam) · `poin_sah` (hanya untuk pemegang izin) · `keadaan` (enum kelas A `PROPOSED/VERIFIED/REJECTED`) · `sumber_ref` (tautan objek M-43/M-25/M-16) · `bukti[]`.
- **Tombol dan izin**: "Catat aktivitas" = usulan `student_affairs.activity.insert` · "Sahkan poin" = usulan `student_affairs.points.verify` (`VALIDATE`, pengesah bukan pencatat) · "Ajukan sanksi" = usulan `student_affairs.sanction.request` · "Sahkan sanksi" = usulan `student_affairs.sanction.approve` (empat-mata + MFA) · "Lihat dampak clearance" = `academic.clearancerule.view` (21, nyata) — **baca saja**: dimensi kemahasiswaan hanyalah sinyal ke M-30 (vonis 3).
- **`SERVER_ONLY`**: `keadaan`, `poin_sah`, `clearance_dimension`, `sanction_state`, `points_total`. Aturan konversi jenis kali tingkat kali peran dimiliki server (FR-KBM-04); klien tidak menjumlahkan apa pun (§18.0 butir 2).
- **Edge case**: aktivitas dari sumber non-aktif (M-43 belum dibeli) → rekap menampilkan "sumber tidak tersedia" dengan jumlah nol beserta sebab, bukan baris hilang · poin diajukan untuk mahasiswa lain (anti-IDOR: `student_id` diselesaikan dalam transaksi) · sanksi `ACTIVE` menahan clearance dan menunjuk **sebab** (`academic.denialreason.view`) · pengesahan oleh pencatat yang sama → `403 SELF_APPROVAL_FORBIDDEN` (56) dengan copy siapa pemegang hak berikutnya.
- **DoD**: **KM-1** nol penjumlahan poin di klien (grep + uji) · **KM-2** `PROPOSED` versus `VERIFIED` selalu punya teks pembeda, bukan warna saja · **KM-3** nol keadaan mesin akademik baru diciptakan modul ini (daftar transisi diverifikasi) · **KM-4** sanksi lewat `VALIDATE` beralasan · **KM-5** izin `usulan` tercatat + kunci `student_affairs.*` dua berkas.

#### 18.4.2 M-43 Humas dan Event — `/acara`

- **Rute**: `/acara` daftar · `/acara?event=<id>` detail · `/acara/checkin` modul gerbang (WebSocket, satu-satunya bersama M-17). `route_key` usulan `event.list`, `event.checkin.gate`.
- **Komposisi**: `VelzonDataGrid` acara + drawer tab (`Identitas` · `Kuota` · `Pendaftaran` · `Check-in` · `Publikasi`) + **kanvas signage** (SVG statis/CSS, bukan paket grafik, §17.6) + panel gerbang khusus `role="status"` `aria-live="polite"`.
- **Kolom grid**: `judul` · `kategori_acara` (kamus kelas C) · `tanggal_mulai` · `kuota` · `terdaftar` · `checked_in` (dibaca dari peristiwa check-in, **bukan** dihitung klien) · `sumber_gambar` (publik atau internal) · `poin_skkm_usulan` (kolom **sinyal**: nilainya milik M-24).
- **Tombol dan izin**: "Terbitkan acara" = usulan `event.publish` (`VALIDATE`) · "Buka pendaftaran" = usulan `event.registration.open` · "Daftar" = usulan `event.registration.create` · "Check-in peserta" = usulan `event.checkin.record` (jalur WebSocket) · "Cabut check-in" = usulan `event.checkin.revert` (`reason` wajib) · "Pasang signage" = usulan `event.signage.manage`.
- **`SERVER_ONLY`**: `keadaan_pendaftaran`, `checked_in`, `skkm_proposal_points`, `capacity_snapshot`, `signature_qr`. **Larangan keras** yang harus ada di layar: check-in **tidak** menulis `attendances` dan tidak memakai jalur presensi kelas M-18 (registri M-43).
- **Edge case**: WebSocket putus → panel jatuh ke `POST` + `GET` read-your-writes dan **menyebut** penurunan itu (design-only: handler belum ada, diukur §13.2 "nol" kemunculan `ws`/`socket.io`) · peserta duplikat → kunci idempoten menolak `429`/`409` dengan sebab · kuota habis → `CLASS_FULL` pola 36 **tidak** berlaku; layar memakai sebab "kuota acara habis" dan tidak pernah daftar kosong · acara publik tampil tanpa login (`layer` publik, bukan modul) · signage tidak menampilkan data peserta lain (PII).
- **DoD**: **EV-1** nol jalur tulis ke `attendances` dari `/acara` · **EV-2** poin selalu `PROPOSED` dengan tautan ke M-24 · **EV-3** penurunan WebSocket dirender sebagai keadaan dengan copy jujur · **EV-4** check-in reversibel beralasan · **EV-5** izin `usulan` tercatat + kunci `event.*` dua berkas.

### 18.5 M-25 KKN, PKL dan Magang dan M-28 Career Center — `/kkn` dan `/karir` (digabung: pencocokan yang mengusulkan)

Keduanya mempertemukan **preferensi** dengan **kapasitas mitra** dan keduanya wajib berhenti di "usulan" sebelum manusia mengesahkan: penempatan kerja praktik lewat pagar engine lalu disahkan DPL (FR-FLW-01), lowongan dan lamaran lewat pencocokan bipartit yang disetujui peran karir (FR-CRD-01). Bentuk layar yang sama menghindari dua implementasi berbeda dari satu prinsip.

#### 18.5.1 M-25 KKN, PKL dan Magang — `/kkn`

- **Rute**: `/kkn` daftar penempatan · `/kkn/lokasi` paket mitra · `/kkn/logbook` harian · `/kkn?student=<id>` drawer. `route_key` usulan `fieldwork.placement.list`.
- **Komposisi**: `MetaRow` (periode penempatan, site, kuota mitra) + `VelzonDataGrid` + drawer tab (`Penempatan` · `Preferensi` · `Logbook` · `Nilai Mitra` · `Usulan Konversi`) + kartu progres engine (§12.1) untuk pencocokan + `ApprovalTrail` §18.13 untuk pengesahan DPL.
- **Kolom grid**: `nama` · `nim` (`SERVER_ONLY`) · `jenis_kerja_praktik` (**kelas C**: reguler, tematik, MBKM, independen) · `mitra` · `lokasi` · `dpl` · `status` (enum kelas A `SUBMITTED/PROPOSED/PLACED/RUNNING/COMPLETED/WITHDRAWN`) · `minggu_logbook` · `jam_keterlibatan` (server) · `nilai_mitra_ref` (**rujukan** ke rubrik, bukan kolom nilai kedua).
- **Form**: `preferensi[]` (drag **atau** numerik, seperti §14.8.2), `mitra_usul`, `periode`, `alasan` bila jendela lewat.
- **Tombol dan izin**: "Susun preferensi" = usulan `fieldwork.preference.insert` (mahasiswa, `SELF`, terkunci setelah jendela) · "Jalankan pencocokan" = usulan `fieldwork.match.run` (`OTHER`, harness §12.1 penuh) · "Sahkan penempatan" = usulan `fieldwork.placement.validate` (`VALIDATE`, **DPL bukan pelaksana run**) · "Isi logbook" = usulan `fieldwork.logbook.write` (geofence: bukti milik M-18 untuk kehadiran, vonis 9) · "Nilai dari mitra" = usulan `fieldwork.partner.grade` · "Usulkan konversi SKS" = usulan `fieldwork.conversion.request` — konverter satu-satunya **ALG-16 di M-38** (vonis 1).
- **`SERVER_ONLY`**: `nim`, `status`, `sks_diakui` (**kolomnya tidak boleh disunting dari layar ini**; percobaan tulis = `403`, FR-FLW-04), `nilai_mitra` (hanya lewat service penilaian M-19, vonis 2), `geofence_distance`, `logbook_minutes`.
- **Edge case**: kuota mitra habis → **sebab berhenti yang dapat dibaca** (FR-ADM-11), bukan daftar kosong · mitra tidak layak (dokumen kedaluwarsa) → filter dengan sebab · `NO_PREREQ_DATA`: peta ekivalensi kosong berarti **belum dapat dihitung**, bukan nol SKS · logbook di luar radius → masuk `PENDING_REVIEW`, bukan `ABSENT` · konversi setelah nilai `LOCKED` → hanya jalur koreksi beralasan M-19 · penilaian mitra memakai **rubrik milik M-25** tetapi angka final masuk `grades` lewat M-19 (FR-FLW-03).
- **DoD**: **FLW-1** `/kkn` tidak menampilkan satu pun `Input` untuk `sks_diakui` (grep + assert absen dari body) · **FLW-2** `403` teruji ketika rute M-25 menulis SKS · **FLW-3** pencocokan berhenti pada `proposal_only` sampai `VALIDATE` DPL · **FLW-4** nol kolom nilai kedua di tabel kerja praktik · **FLW-5** izin `usulan` tercatat + kunci `fieldwork.*` dua berkas.

#### 18.5.2 M-28 Career Center — `/karir`

- **Rute**: `/karir/lowongan` · `/karir/lamaran?application=<id>` · `/karir/pameran` sesi virtual. `route_key` usulan `career.job.list`, `career.application.list`.
- **Komposisi**: `VelzonDataGrid` dua tab (lowongan dan lamaran) + drawer dengan **bilah persetujuan PII** di atas berkas + panel bilik wawancara (antrean server) + `ApprovalTrail` §18.13 untuk publikasi mitra.
- **Kolom grid**: lowongan — `perusahaan` · `sektor` (kamus kelas C `sektor_usaha`) · `jenis_lowongan` (kamus kelas C) · `kuota` · `masa_tayang` · `status` · `legalitas_verified`. Lamaran — `pelamar` · `posisi` · `status` (enum kelas A `SUBMITTED/SCREENING/INTERVIEW/OFFERED/CLOSED/REJECTED`) · `cv_version` · `consent_at`.
- **Tombol dan izin**: "Daftarkan mitra" = usulan `career.partner.create` · "Sahkan mitra" = usulan `career.partner.verify` (`VALIDATE`, empat-mata) · "Terbitkan lowongan" = usulan `career.posting.publish` (masa tayang dari kunci `career.posting_expiry_days`) · "Lamar" = usulan `career.application.create` (**ditolak sebelum consent tercatat**) · "Pindahkan status lamaran" = usulan `career.application.update` (transisi kelas A) · "Susun sesi pameran" = usulan `career.expo.schedule` (bilik, kapasitas, antrean check-in adalah objek M-28 sendiri, FR-CRD-03, **bukan** jalur M-43).
- **`SERVER_ONLY`**: `status`, `cv_version`, `consent_at`, `retention_expires_at` (dari kunci `career.cv_retention_days`, kelas `REGULATORY`), `partner_verified_by`.
- **Edge case**: consent dicabut → CV versi lama tetap terbaca oleh pelamar, hilang dari sisi mitra, dengan tanggal retensi · masa tayang lewat → lamaran ditolak dengan sebab (bukan 404) · pelamar alumni versus mahasiswa aktif (peran berbeda; `ALUMNI_MANAGER` usulan) · satu lowongan dengan kuota habis tidak menawarkan tombol "lamar" dan tetap menampilkan tanggal penutupan · **tidak ada** angka IKU di layar ini: IKU 1/2 milik M-32, respons survei milik M-27 (vonis 13).
- **DoD**: **CR-1** nol berkas terbagi ke mitra tanpa consent tercatat (uji) · **CR-2** `status` lamaran hanya lewat transisi · **CR-3** layar tidak menghitung/menampilkan IKU · **CR-4** retensi CV dibaca dari parameter, bukan konstanta · **CR-5** izin `usulan` tercatat + kunci `career.*` dua berkas.

### 18.6 M-29 KUI dan Mobilitas — `/kui` (sendiri: berkas luar dan vonis milik M-38)

- **Rute**: `/kui/program` · `/kui/penempatan` · `/kui/berkas?doc=<id>` drawer · `/kui/mobilitas?student=<id>`. `route_key` usulan `mobility.program.list`. Entitlement `usulan: mobility`.
- **Komposisi**: `PageHeader` + dua `VelzonDataGrid` (program dan penempatan) + drawer tab (`Program` · `Peserta` · `Berkas Imigrasi` · `Mata Kuliah Luar` · `Konversi`) + `ApprovalTrail` §18.13 + `Alert` retensi berkas paspor/visa (PII).
- **Kolom grid program**: `pt_mitra` · `negara` (kamus kelas B: wilayah nasional, kode tidak dapat diedit tenant) · `skema` (kelas C) · `kuota` · `jendela_daftar` · `status` (enum kelas A `DRAFT/OPEN/CLOSED/ARCHIVED`) · `ects_sks_snapshot`. Peserta: `nama` · `nim` (`SERVER_ONLY`) · `arah` (`INBOUND`/`OUTBOUND`) · `periode` · `status_penempatan` · `visa_status` · `konversi_status`.
- **Form**: `mobility_programs` (FR-MBL-01) dengan `kuota`, jendela, dan skema; penempatan peserta dengan daftar mata kuliah luar + transkrip mitra (berkas, bukan salinan nilai).
- **Tombol dan izin**: "Terbitkan program" = usulan `mobility.program.publish` (`VALIDATE`) · "Daftar peserta" = usulan `mobility.placement.create` · "Sahkan penempatan" = usulan `mobility.placement.validate` (empat-mata) · "Unggah berkas visa" = usulan `mobility.document.upload` · "Catat kelulusan visa" = usulan `mobility.visa.record` · "Kirim usulan konversi" = usulan `mobility.conversion.submit` — **hanya mengirim usulan**: yang memutuskan SKS hasil adalah ALG-16 di M-38 (vonis 1).
- **`SERVER_ONLY`**: `status_penempatan`, `visa_status`, `konversi_status`, `sks_hasil` (tidak ada kolomnya di layar ini), `approved_by`. Berkas paspor/visa adalah PII `SPECIFIC` dengan retensi dan riwayat insert-only.
- **Edge case**: kuota habis dengan peserta cadangan (sebab, bukan daftar kosong) · negara mitra tanpa kamus wilayah → `LOOKUP_GROUP_EMPTY` state 3 §17.4 · penyetaraan ECTS ke SKS tidak dapat diketik manual (ditolak `403`) · peserta inbound mengambil kelas di prodi lain → scope `PROGRAM` membuktikan legalitas · berkas kedaluwarsa sebelum berangkat → peringatan dengan tanggal, bukan pemblokiran diam-diam.
- **DoD**: **MB-1** nol kolom `sks_hasil` di layar ini (grep) · **MB-2** konversi selalu `SUBMITTED` sampai vonis M-38 · **MB-3** berkas visa tidak terbaca peran non-KUI (assert absen payload) · **MB-4** kode negara kelas B tidak dapat disunting (uji 128) · **MB-5** izin `usulan` tercatat + kunci `mobility.*` dua berkas.

### 18.7 M-36 Portal PPKS dan M-41 Klinik Kampus — `/ppks` dan `/klinik` (digabung: rahasia kelas khusus, layar harus punya keadaan "isi tidak dapat ditampilkan")

Kandidat `usulan: ppks` dan `usulan: clinic`. Digabung karena keduanya memiliki satu bentuk layar yang tidak dimiliki modul lain: **bagian dari kontennya secara desain tidak boleh muncul** untuk peran yang biasanya melihat segalanya (Admin IT, Rektorat, bahkan auditor umum). Vonis PRD §5.13 no 14 dan Permendikbudristek 30/2021 menuntut **nol visibilitas isi** bagi `TENANT_ADMIN`; UU PDP 27/2022 menuntut hal yang sama untuk rekam medis dan konseling. Konsekuensinya: layar **tidak boleh** menyisakan sel kosong yang membuat orang bertanya "apa yang disembunyikan di sini?" — ia menampilkan **bahwa ada**, disertai alasannya, tanpa isi.

#### 18.7.1 M-36 Portal PPKS — `/ppks`

- **Rute**: `/ppks` kanal pelaporan (publik, `module_code` boleh `null` untuk form laporan) · `/ppks/kasus?case=<id>` **hanya** satgas. `route_key` usulan `ppks.report.intake`, `ppks.case.list`.
- **Komposisi kanal laporan** (satu-satunya yang dilihat pelapor): satu `Card` penuh lebar berisi pengantar, pilihan **apakah ingin tetap anonim**, form bertahap (§2.3 wizard, tiga langkah: kronologi · berkas · konfirmasi nomor laporan), dan **tidak ada** daftar kasus siapa pun. Tautan bantuan eksternal dirender sebagai data, bukan konstanta.
- **Komposisi satgas**: daftar **nomor saja** (`nomor_laporan`, `dibuat_pada`, `keadaan`, `penanggung_jawab`) — **kolom isi tidak ada di grid**, bukan dikosongkan. Detail memakai `Drawer`, dan satu-satunya tindakan massal adalah `VALIDATE` per kasus dengan MFA.
- **Keadaan wajib "isi tidak dapat ditampilkan kepada peran Anda"** (`ppks.state.hiddenByDesign`, dirancang bukan error): dirender ketika peran lain membuka `/ppks/kasus` — `Card` dengan ikon gembok + teks "Kasus ada, isinya tidak dapat dibuka untuk peran Anda" + **siapa** yang memegangnya (satgas) + rujukan aturan; **tanpa** jumlah korban, **tanpa** nama, **tanpa** nomor yang bisa ditebak urutannya. Server tidak mengirim kunci konten sama sekali (peristiwa `ppks.case.registered` ber-payload kosong oleh desain, ARCHITECTURE §13.1 catatan 2), sehingga DevTools tidak membuktikan apa pun.
- **Kolom**: `nomor_laporan` (`SERVER_ONLY`) · `dibuat_pada` · `keadaan` (enum kelas A `REPORTED/ASSIGNED/INVESTIGATING/PROTECTED/CLOSED/ESCALATED`) · `penanggung_jawab` (`Avatar` inisial, boleh kosong untuk anonim) · `catatan_satgas` (enkripsi at-rest, hanya satgas).
- **Tombol dan izin**: "Lapor" = usulan `ppks.report.create` (anonim sah) · "Tetapkan satgas" = usulan `ppks.case.assign` · "Putuskan langkah perlindungan" = usulan `ppks.protection.decide` (`VALIDATE` + MFA, manusia selalu) · "Rujuk ke layanan" = usulan `ppks.referral.create` (ke M-41 atau M-04 **tanpa** membawa isi kasus) · "Tutup kasus" = usulan `ppks.case.close` (empat-mata, `reason` wajib) · "Jejak akses" = `audit.log.view` (nyata, M-05) — **hanya jejak akses**, bukan isi.
- **`SERVER_ONLY`**: seluruh kolom; tidak ada satu pun field yang dapat disunting klien selain keputusan satgas melalui `VALIDATE`. Nama pelapor dan terlapor **tidak pernah** masuk outbox, stream, log, atau toast.
- **Edge case**: pelapor anonim ingin menarik laporan → hanya dengan nomor + token satu-kali · akses satgas dicabut di tengah kasus → kasus tetap ada, penanggung jawab dipindah oleh peran yang lebih tinggi, dengan jejak · percobaan ekspor massal → ditolak `403` dan tercatat di M-05 · rujukan ke klinik tidak memindahkan isi (hanya "ada kebutuhan layanan").
- **DoD**: **PP-1** keadaan `hiddenByDesign` punya uji komponen (render untuk peran non-satgas **tanpa** satu pun kunci konten di payload) · **PP-2** grep penjaga menolak `title`, `reporter`, `respondent` muncul di payload uji · **PP-3** tidak ada jumlah kasus di kartu §17 selain angka "ada berapa" · **PP-4** `VALIDATE` selalu ber-MFA dan bukan pelapor · **PP-5** izin `usulan` tercatat + kunci `ppks.*` dua berkas.

#### 18.7.2 M-41 Klinik Kampus — `/klinik`

- **Rute**: `/klinik/kamar` antrean · `/klinik/rekam?encounter=<id>` drawer (dokter/konselor) · `/klinik/konseling` jadwal. `route_key` usulan `clinic.encounter.list`.
- **Komposisi**: `StatCard` (antrean, konseling tertunda) + `VelzonDataGrid` **tanpa kolom diagnosis** + drawer bertab (`Identitas` · `Tanda Vital` · `Konseling` · `Rujukan` · `Tagihan`) + `Alert` retensi rekam medis. Tab `Tagihan` hanya berisi **ringkasan nominal yang sudah menjadi invoice M-10** (FR-CLN: ringkasan ke M-10 tanpa isi klinis).
- **Kolom grid**: `nomor_kunjungan` (`SERVER_ONLY`) · `pasien` (nama + `Avatar`) · `keluhan_utama` (**dibaca dari ringkasan non-diagnostik**; detail klinis hanya di tab khusus untuk pemeran izin) · `keadaan` (enum kelas A `QUEUED/IN_CONSULT/DOCUMENTED/CLOSED` — kanonik `CLOSED`) · `dokter` · `rujukan_ref` · `billing_status` (boolean untuk peran non-keuangan).
- **Tombol dan izin**: "Daftar kunjungan" = usulan `clinic.encounter.create` (mahasiswa `SELF`) · "Catat tanda vital" = usulan `clinic.vital.record` · "Tulis catatan konseling" = usulan `clinic.counseling.write` · "Sahkan diagnosis" = usulan `clinic.diagnosis.validate` (`VALIDATE`, hanya dokter) · "Rujuk ke RS" = usulan `clinic.referral.create` · "Kirim ringkasan tagihan" = usulan `clinic.billing.propose` — tagihan tetap diterbitkan M-10 (vonis 5).
- **Keadaan "isi tidak dapat ditampilkan"**: per **field**, bukan per layar — sel catatan konseling untuk peran administrasi dirender `••••` dengan `clinic.state.restrictedTo` menyebut peran pemegang (pola §9.8 butir 1: masking adalah **state data**, dan server memang tidak mengirimnya). Rekam medis **tidak pernah** ikut ekspor, tidak pernah masuk payload notifikasi, dan `pii_level='SPECIFIC'` menolak isi-mandiri klien (AGENTS §3.10).
- **Edge case**: pasien di bawah umur memerlukan wali (kanal `parent_portal`, nyata) · konseling lintas jadwal tidak terlihat oleh konselor lain · data klinis yang diminta DSAR lewat gerbang M-05 · obat/rujukan ke apotek luar = data kelas D, bukan kolom baru di kode · riwayat alergi harus tetap terbaca di tab Identitas untuk clinician yang bertugas saja.
- **DoD**: **CL-1** diagnosis tidak pernah muncul di grid daftar (uji) · **CL-2** ringkasan ke M-10 tidak memuat teks klinis (assert) · **CL-3** field terbatas dirender sebagai sebab, bukan kolom kosong · **CL-4** `VALIDATE` diagnosis hanya dokter ber-scope · **CL-5** izin `usulan` tercatat + kunci `clinic.*` dua berkas.

### 18.8 M-39 e-Library dan M-42 Asrama dan Kantin — `/perpustakaan` dan `/asrama` (digabung: sirkulasi dengan jatuh tempo)

Kandidat `usulan: library` dan `usulan: residence`. Keduanya adalah mesin **sirkulasi**: objek dipinjam/ditempatkan, ada jatuh tempo, ada tarif, dan uang **selalu** lahir di M-10 (vonis 5). Digabung supaya satu aturan tarif-vs-tagihan tidak ditulis dua kali dengan bentuk berbeda.

#### 18.8.1 M-39 e-Library — `/perpustakaan`

- **Rute**: `/perpustakaan/katalog` (publik) · `/perpustakaan/sirkulasi` (pustakawan) · `/perpustakaan/akun?student=<id>` pinjaman mahasiswa. `route_key` usulan `library.catalog.list`, `library.circulation.list`.
- **Komposisi**: katalog = `Input` pencarian + `FacetFilter` (kamus `jenis_koleksi`, `lokasi_rak` kelas C) + hasil `Card` grid · sirkulasi = `VelzonDataGrid` + drawer (`Eksemplar` · `Peminjam` · `Jatuh Tempo` · `Denda` · `Bebas Pustaka`).
- **Kolom grid**: `judul` · `eksemplar_kode` (`.tabular`) · `jenis_koleksi` (kamus kelas C) · `rak` (kamus kelas C) · `peminjam` · `tanggal_pinjam` · `jatuh_tempo` · `keadaan` (enum kelas A `ON_LOAN/DUE/OVERDUE/RETURNED/LOST/CLAIM_RETURNED`) · `denda_status` (boolean untuk peminjam non-keuangan) · `perpanjangan_ke`.
- **Tombol dan izin**: "Cari katalog" = `master.lookup.consume` pola (baca publik) · "Pinjam" = usulan `library.loan.create` · "Kembalikan" = usulan `library.loan.return` · "Perpanjang" = usulan `library.loan.renew` (plafon `loan_policies` berversi, FR-LIB-01) · "Tandai hilang" = usulan `library.item.markLost` (`reason` wajib) · "Reservasi" = usulan `library.reservation.create` · "Terbitkan bebas pustaka" = **bukan tombol**: sistem mengirim `library.loan.cleared` sebagai **sinyal** dan vonis gabungan tetap M-30 (vonis 3) — layar hanya menampilkan "dikirim sebagai sinyal" + waktu.
- **`SERVER_ONLY`**: `keadaan`, `jatuh_tempo`, `denda_rupiah` (dihitung server dari tarif `loan_policies` dan kunci `library.fine_per_day_idr`), `fine_ceiling`, `cleared_at`, `renewal_count`. Tarif **tidak dapat disunting dari layar peminjam** (FR-LIB-02): tarif tinggal di tabel kebijakan berversi, perannya pustakawan dengan `VALIDATE`.
- **Edge case**: `CLAIM_RETURNED` (klaim sudah mengembalikan) → keadaan khusus dengan bukti dan keputusan manusia, bukan hilang tagihan · peminjam dengan denda tertahan → peringatan dengan **sebab** + tautan M-10, dan **tidak** pernah status "lulus/tidak" · `OVERDUE` massal → `batch flush` (§3.7) bukan `UPDATE` per baris · jenis koleksi belum di-seed → `LOOKUP_GROUP_EMPTY` state 3 §17.4 dengan tautan admin · eksemplar terakhir di rak yang tidak aktif → tetap terbaca lewat `?at=` (BR-R12).
- **DoD**: **LB-1** nol tombol "nyatakan lulus/bebas akademik" di `/perpustakaan` · **LB-2** tarif hanya lewat tabel berversi dengan `VALIDATE` · **LB-3** denda tidak pernah dihitung klien (grep) · **LB-4** keenam keadaan pinjaman punya label dari `labelForStatus`, nol array label JSX · **LB-5** izin `usulan` tercatat + kunci `library.*` dua berkas.

#### 18.8.2 M-42 Asrama dan Kantin — `/asrama`

- **Rute**: `/asrama/penempatan` · `/asrama/kantin` (outlet dan menu) · `/asrama/dompet?student=<id>`. `route_key` usulan `residence.placement.list`, `residence.wallet.detail`.
- **Komposisi**: penempatan = `VelzonDataGrid` hunian (kamar, lantai, kapasitas, terisi) + drawer penghuni + kartu hasil bin-packing (§12.1) dengan **`degraded` strip** · kantin = daftar outlet + menu (kamus kelas C) · dompet = `StatCard` saldo + mutasi ledger internal.
- **Kolom grid**: hunian — `kamar` · `lantai` · `jenis_kelamin` (kamus kelas B) · `kapasitas` · `terisi` · `keadaan` (`DRAFT/OPEN/ASSIGNED/VACANT/CLOSED`) · `tanggal_masuk_keluar`. Dompet — `tanggal` · `tipe_mutasi` (debet/kredit) · `nominal` (hanya peran keuangan dan pemilik saldo) · `sisa` · `kanal` (kamus kelas C).
- **Tombol dan izin**: "Hitung penempatan" = usulan `residence.placement.run` (`OTHER`; FFD multi-dimensi **tidak dijamin optimum** dan itu wajib dilaporkan, AGENTS §3.9) · "Sahkan penempatan" = usulan `residence.placement.validate` (`VALIDATE`, orang kedua) · "Pindah hunian" = usulan `residence.move` (`reason` wajib) · "Isi ulang dompet" = usulan `residence.wallet.topup` · "Catat transaksi kantin" = usulan `residence.txn.record` · "Ubah plafon cicilan dompet" = milik layar parameter §14 (`settings.param.*` kelas `OPS`/`FINANCIAL`), **bukan** tombol di sini.
- **`SERVER_ONLY`**: `keadaan`, `sisa`, `nominal`, `assigned_by`, `capacity_snapshot`. **Saldo dompet bukan piutang akademik** (registri M-42): tidak ada satu pun gerbang akademik/KRS yang membaca saldo ini, dan copy di `/asrama` menuliskannya secara eksplisit.
- **Edge case**: kamar melebihi kapasitas → ditolak server, dan layar menampilkan sisa kapasitas, bukan angka negatif · mode turun solver → `PARTIAL_BUDGET_EXHAUSTED` dengan jumlah penghuni belum terhubung (§12.2) · penghenti layanan (tunggakan kantin) **tidak boleh** menyentuh presensi/kelas · mutasi dompet tanpa `Idempotency-Key` → `409 DUPLICATE_SUBMIT` (46) · jenis kelamin sebagai kunci penempatan: kode kelas B, tidak dapat diedit, label bisa dipetakan.
- **DoD**: **RS-1** nol tautan dari saldo asrama ke gerbang akademik (grep + uji peran) · **RS-2** hasil penempatan selalu menampilkan status optimal/parsial dengan batasnya · **RS-3** nominal tidak terkirim ke peran non-keuangan dan non-pemilik · **RS-4** mutasi idempoten · **RS-5** izin `usulan` tercatat + kunci `residence.*` dua berkas.

### 18.9 M-40 Aset dan Inventaris dan M-46 E-Procurement — `/aset` dan `/pengadaan` (digabung: satu arah, vonis 6)

Kandidat `usulan: asset` dan `usulan: procurement`. Vonis 6: **M-40 pemilik kartu aset, M-10 pemilik komitmen dan pembayaran, M-46 pemilik proses pengadaan**; baris aset lahir dari service pemiliknya lewat `procurement.goods.received` → `asset.card.created`. Digabung karena satu mata rantai tidak boleh punya dua titik tulis.

#### 18.9.1 M-46 E-Procurement PBJ — `/pengadaan`

- **Rute**: `/pengadaan/rencana` · `/pengadaan/paket?po=<id>` drawer · `/pengadaan/bast?acceptance=<id>`. `route_key` usulan `procurement.plan.list`, `procurement.po.detail`.
- **Komposisi**: `VelzonDataGrid` paket + drawer bertab (`Rencana` · `HPS` · `Klarifikasi` · `Kontrak` · `BAST`) + `ApprovalTrail` §18.13 **di atas** tab (syarat tugas: jejak empat-mata harus terlihat sebelum angka) + `Alert` komitmen anggaran yang menunjuk M-10.
- **Kolom grid**: `nomor_paket` · `nama_paket` · `unit_pengusul` · `sumber_dana` (kamus kelas C, dan untuk dana abadi menunjuk M-47 sebagai **sumber dana berversi**) · `hps_rupiah` (peran terbatas) · `penawaran_terbaik` · `keadaan` (enum kelas A `PLANNED/ANNOUNCED/EVALUATED/AWARDED/CONTRACTED/RECEIVED/CANCELLED`) · `kontrak_ref` · `bast_at`.
- **Tombol dan izin**: "Susun rencana" = usulan `procurement.plan.create` · "Sahkan HPS" = usulan `procurement.hps.approve` (`VALIDATE`, **empat-mata**: PPK bukan penyusun HPS) · "Umumkan tender/RFQ" = usulan `procurement.tender.publish` · "Tetapkan pemenang" = usulan `procurement.award` (`VALIDATE` + MFA) · "Terbitkan kontrak" = usulan `procurement.contract.issue` · "Sahkan BAST" = usulan `procurement.receipt.validate` (`VALIDATE`, BAST adalah aksi persetujuan — peristiwa `procurement.goods.received`) · "Catat komitmen anggaran" = **bukan tombol di sini**: pembacaan komitmen milik M-10 (vonis 5/6), layar hanya menampilkan status.
- **`SERVER_ONLY`**: `keadaan`, `nomor_paket`, `hps_rupiah` saat `AWARDED`, `committed_budget_id`, `bast_at`, `vendor_id`. Tidak ada **jurnal kedua** di M-46: nominal hanya menjadi piutang/pembayaran lewat service M-10.
- **Edge case**: vendor tunggal (tender gagal) → keadaan `CANCELLED` dengan sebab, bukan penghapusan · HPS diubah setelah penetapan → penolakan `409 DECISION_ALREADY_MADE` (55) · BAST sebagian → beberapa `line_items_ref`, dan kartu aset yang lahir mengikuti jumlah diterima · komitmen melebihi pagu → sebab dari proyeksi M-10, bukan `422` tanpa arti · dokumen penawaran = berkas dengan retensi (§3.9 aturan input tak-tepercaya) dan **tidak pernah** menjadi instruksi.
- **DoD**: **PB-1** `ApprovalTrail` tampil untuk HPS, penetapan pemenang, dan BAST dengan `requested_by` berbeda dari `approved_by` (uji) · **PB-2** nol jalur tulis ke jurnal/ledger dari `/pengadaan` (grep) · **PB-3** BAST adalah satu-satunya pemicu kartu aset, dan itu diuji dari hulu ke hilir (usulkan: uji integrasi) · **PB-4** nominal `hps_rupiah` tidak terkirim ke peran tanpa hak · **PB-5** izin `usulan` tercatat + kunci `procurement.*` dua berkas.

#### 18.9.2 M-40 Aset dan Inventaris — `/aset`

- **Rute**: `/aset` register · `/aset/ruang` pemanfaatan per ruang · `/aset?asset=<id>` drawer kartu aset · `/aset/penyusutan` jalanan massal. `route_key` usulan `asset.register.list`, `asset.card.detail`, `asset.depreciation.run`.
- **Komposisi**: `PageHeader` (Aksi: "Tempel QR" untuk sarpras) · `MetaRow` (site, gedung, lantai) · `VelzonDataGrid` + drawer bertab (`Kartu` · `Sirkulasi` · `Pemeliharaan` · `Penyusutan` · `Riwayat lokasi`) + `StatCard` (jumlah kartu, nilai buku agregat untuk peran berhak, tertagih penyusutan berjalan) + `ApprovalTrail` §18.13 untuk posting massal.
- **Kolom grid**: `kode_aset` (`SERVER_ONLY`, dari `asset.card.created`) · `nama` · `kelas_aset` (kamus kelas C, dan `class_reference_code` untuk kode pusat sebagai kelas B) · `lokasi_room_id` · `perolehan_rupiah` (peran terbatas) · `nilai_buku` · `keadaan` (enum kelas A `REGISTERED/IN_USE/IN_MAINTENANCE/TRANSFERRED/DISPOSED`) · `qr_tag_status` · `penanggung_jawab` · `last_counted_at`.
- **Form kartu** (baca-saja untuk bidang turunan): hanya `penanggung_jawab`, `lokasi`, `catatan` dan atribut kelas D yang dapat disunting. **Angka perolehan tidak dapat diketik di sini** — ia datang dari BAST M-46 (FR-AST, registri M-40: "perolehan berasal dari M-46, bukan diketik ulang").
- **Tombol dan izin**: "Tempel/cetak QR" = usulan `asset.qr.issue` · "Catat sirkulasi" = usulan `asset.circulation.record` · "Pindahkan lokasi" = usulan `asset.location.update` (`reason` wajib) · "Jalankan penyusutan garis lurus" = usulan `asset.depreciation.run` (`OTHER`, worker + `BATCH`) · "Sahkan posting penyusutan" = usulan `asset.depreciation.validate` (`VALIDATE`, empat-mata BAUK, peristiwa `asset.depreciation.posted`) · "Retire" = usulan `asset.dispose` (`VALIDATE`, `reason` wajib) · "Lihat dampak ke laporan" = `master.impact.view` pola (135) untuk peran mutu.
- **`SERVER_ONLY`**: `kode_aset`, `perolehan_rupiah`, `akuisisi_at`, `nilai_buku`, `accumulated_depreciation`, `method_code`, `schedule_run_id`, `keadaan`. Metode dan umur ekonomis dibaca dari **tabel kebijakan berversi** milik M-02, bukan konstanta JSX; nominal hanya untuk peran keuangan dan auditor aset.
- **Edge case**: kartu lahir ganda dari BAST yang sama → kunci idempoten `(po_id, line_no)` menolak `409 DUPLICATE_SUBMIT` (46) · lokasi menunjuk ruang yang dinonaktifkan → penolakan dengan rujukan `409 REFERENCE_IN_USE` (19) pola · QR belum ditempel → keadaan `qrtag=false` dengan CTA cetak, bukan baris merah · penyusutan parsial karena budget worker habis → `PARTIAL_BUDGET_EXHAUSTED` dengan jumlah kartu selesai dan tersisa (§12.2) · aset hilang/`DISPOSED` tetap terbaca untuk laporan periode lama (`?at=`, BR-R12).
- **DoD**: **AS-1** `/aset` tidak punya `Input` untuk `perolehan_rupiah` (grep + assert absen dari body) · **AS-2** posting penyusutan selalu `VALIDATE` dua orang dan massal (BATCH), bukan `UPDATE` per baris dari UI · **AS-3** satu kartu satu kode, tidak dapat dibuat ulang dari layar · **AS-4** nilai buku tidak terkirim ke peran akademik · **AS-5** izin `usulan` tercatat + kunci `asset.*` dua berkas.

### 18.10 M-44 SIM-LPPM dan LITABMAS — `/lppm` (sendiri: skema hibah dan telaah buta)

Kandidat `usulan: research`; status registri `SEBAGIAN` (hibah hanya disebut satu kalimat di FR-P2). Layar wajib **jujur** soal itu: tidak ada satu pun objek `grant_schemes` hari ini (`DATA_MODEL` belum menomori), jadi blok ini adalah spesifikasi pola, bukan laporan fitur.

- **Rute**: `/lppm/skema` · `/lppm/usulan` · `/lppm/telaah?proposal=<id>` · `/lppm/kontrak?grant=<id>` · `/lppm/monev` · `/lppm/luaran`. `route_key` usulan `research.scheme.list`, `research.proposal.review`, `research.grant.contract`.
- **Komposisi**: `PageHeader` dengan pemilih skema (data, bukan konstanta) · `MetaRow` (tahun anggaran, rumpun, plafond aktif) · `VelzonDataGrid` usulan/kontrak · drawer bertab (`Usulan` · `Telaah` · `Kontrak` · `Monev` · `Luaran` · `Pencairan`) · `ApprovalTrail` §18.13 untuk **setiap** transisi keadaan · panel "sinyal ke BKD" yang hanya menunjuk M-07.
- **Kolom grid**: `nomor_usulan` · `judul` · `pengusul` (nama; **disamarkan di tab Telaah** untuk telaah buta) · `rumpun` (kamus yang sudah dinormakan FR-ADM-07, dipakai ulang) · `skema` · `usulan_rupiah` · `disetujui_rupiah` · `keadaan` (enum kelas A `DRAFT/OPEN/REVIEW/CONTRACTED/MONITORING/CLOSED`, FR-LPP-01) · `reviewer_count` · `luaran_count` · `cairan_stage`.
- **Form skema**: `nama_skema` · `rumpun` (kamus) · `periode` · `plafond` **sebagai tabel batas** `scheme_funding_limits` (pita tahun × jenjang × nilai maksimum) yang dirender sebagai grid baris, **bukan** satu `Input` angka (FR-LPP-01 menolak bentuk key-value karena versi dan jejaknya hilang).
- **Tombol dan izin**: "Terbitkan skema" = usulan `research.scheme.publish` (`VALIDATE`, empat-mata + MFA) · "Usulkan penelitian" = usulan `research.proposal.submit` (peneliti) · "Tugaskan reviewer" = usulan `research.review.assign` (**tanpa** menampilkan identitas pengusul ke reviewer) · "Kirim hasil telaah" = usulan `research.review.submit` (`OTHER`, rekomendasi saja) · "Sahkan penetapan" = usulan `research.grant.award` (`VALIDATE`, orang kedua ≠ reviewer) · "Terbitkan kontrak" = usulan `research.contract.issue` · "Catat monev" = usulan `research.monitoring.record` · "Ajukan pencairan" = usulan `research.disbursement.request` · "Sahkan pencairan" = usulan `research.disbursement.validate` (`VALIDATE`, dua orang; nominal menjadi **jurnal M-10**, peristiwa `research.grant.disbursed`) · "Sahkan luaran" = usulan `research.output.validate` (sebelum masuk BKD).
- **`SERVER_ONLY`**: `keadaan`, `nomor_usulan`, `disetujui_rupiah`, `contract_no`, `stage_no`, `amount_rupiah`, `id_pengusul_samaran` (pseudonim yang menegakkan telaah buta tidak pernah dikirim ke klien untuk dibuka). Tidak ada **kolom tridharma kedua**: luaran **menunjuk** objek M-21/M-22/M-19 dan angka BKD dihitung M-07 (FR-LPP-04, vonis 7).
- **Edge case**: **tidak ada lompat dari usulan ke kontrak tanpa `VALIDATE` dua orang berbeda** dan setiap transisi menulis baris audit pada rantai M-05 (FR-LPP-01) — transisi paksa dari UI ditolak `403 SELF_APPROVAL_FORBIDDEN` (56) · reviewer merangkap pengusul pada rumpun yang sama → penolakan dengan sebab konflik kepentingan (daftar konflik = kamus kelas C) · plafon terlampaui → sebab dari `scheme_funding_limits`, bukan `422` tanpa arti · pencairan sebagian karena tahun anggaran bergeser → `stage_no` dengan sisa · luaran belum punya bukti (`evidence_attachment_id` kosong) → tidak dapat disahkan · skema `CLOSED` tetap terbaca untuk laporan (BR-R12).
- **DoD**: **LP-1** tidak ada transisi `OPEN → CONTRACTED` yang dapat dijalankan satu actor (uji SoD dua orang) · **LP-2** tab Telaah tidak mengirim `pengusul` (assert absen dari payload) · **LP-3** nol kolom nilai tridharma dan nol jalur tulis ke `ledger` dari `/lppm` (grep) · **LP-4** plafond dirender dari tabel batas, tidak dari satu field angka · **LP-5** setiap baris `ApprovalTrail` punya `reason` · **LP-6** izin `usulan` tercatat + kunci `research.*` dua berkas.

### 18.11 M-45 CRM PMB dan Marketing — `/crm` (sendiri: corong lead, vonis 12)

Kandidat `usulan: crm`. Vonis 12: **M-09 pemilik pendaftaran dan seleksi, M-45 pemilik lead dan kampanye**; konversi lead **hanya** lewat service PMB dengan peristiwa `crm.lead.converted`. Tugas layar: **jejak persetujuan empat-mata wajib terlihat** (permintaan pemilik) — di sini ia menempel pada dua titik: penetapan anggaran kampanye dan pembukaan kanal yang menyimpan PII calon mahasiswa.

- **Rute**: `/crm/lead` · `/crm/kampanye?campaign=<id>` · `/crm/rujukan` · `/crm/analytics`. `route_key` usulan `crm.lead.list`, `crm.campaign.detail`.
- **Komposisi**: `PageHeader` + `MetaRow` (gelombang PMB aktif, kanal) · `StatCard` baris (lead baru, konversi, `cac_rupiah` untuk peran berhak, kampanye berjalan) · `VelzonDataGrid` lead dengan bilah kanal + drawer tab (`Lead` · `Kanal` · `Interaksi` · `Konversi` · `Konsen`) + `ApprovalTrail` §18.13 + **kartu penyetuju kedua** di atas form anggaran (pola §11.9 butir 7).
- **Kolom grid**: `nama_lead` · `kanal` (kamus kelas C `kanal_akuisisi`) · `kampanye` · `status` (enum kelas A `NEW/NURTURING/CONVERTED/DUPLICATE/LOST`) · `skor_prospek` (basis-poin **server**, dengan `explain` singkat) · `application_ref` (tautan M-09, boleh kosong) · `consent_at` · `cac_rupiah` (peran keuangan dan ketua marketing saja).
- **Form kampanye**: `nama` · `periode` · `sumber_dana` · `anggaran_rupiah` (peran terbatas) · `kanal[]` (kamus) · `target_prodi[]` (data) · `consent_text` (i18n, bukan literal) · `segmentasi` (kamus).
- **Tombol dan izin**: "Impor lead" = usulan `crm.lead.import` (stepper §9.3 gugus G: Unggah, Validasi, Rekonsiliasi, Terapkan) · "Catat interaksi" = usulan `crm.interaction.create` · "Sahkan kanal baru" = usulan `crm.channel.approve` (`VALIDATE`, **empat-mata**: kanal menyimpan PII, jadi penyusun kanal bukan penyetuju) · "Sahkan anggaran kampanye" = usulan `crm.campaign.approve` (`VALIDATE`, penyetuju ≠ pengusul, MFA penulis-admin) · "Konversi menjadi pendaftaran" = usulan `crm.lead.convert` — **tidak pernah** menulis `pmb_*` sendiri; ia memanggil service M-09 dan membaca `application_id` kembali · "Ekspor segmen" = usulan `crm.segment.export` dengan `EXPORT_LIMIT_EXCEEDED` (59) punya cabang render.
- **`SERVER_ONLY`**: `status`, `application_ref`, `skor_prospek`, `cac_rupiah`, `converted_at`, `consent_at`. Skor prospek **tidak** dapat disunting (mesin mengusulkan, manusia memutuskan, AGENTS §3.9) dan nominal CAC tidak pernah dibaca peran akademik (§18.0 butir 4).
- **Edge case**: lead yang sudah punya NIM → **tidak** masuk corong (penolakan dengan sebab, bukan duplikat) · kanal tanpa consent tercatat → ekspor ditolak dan layar menyebut alasannya (sebab `consent` belum tercatat; kode errornya **usulan**, pemilik `API_SPEC`) · konversi ganda dengan `Idempotency-Key` sama → satu pendaftaran · lead lintas gelombang → `periode` menentukan kepemilikan baris (usulan: `crm` tidak boleh membaca tenant lain; RLS) · angka CAC nol saat data biaya iklan belum ada → `LOOKUP_GROUP_EMPTY` state 3 §17.4, bukan nol.
- **DoD**: **CM-1** `ApprovalTrail` wajib tampil untuk kanal dan anggaran dengan dua identitas berbeda (uji) · **CM-2** nol jalur tulis langsung ke objek M-09 dari `/crm` (grep + uji) · **CM-3** ekspor menolak tanpa konsen, dengan copy sebab · **CM-4** `skor_prospek` tidak punya kendali sunting · **CM-5** izin `usulan` tercatat + kunci `crm.*` dua berkas.

### 18.12 M-47 Endowment Fund — `/dana-abadi` (sendiri: alokasi berversi, vonis 5)

Kandidat `usulan: endowment`. Vonis 5: alokasi adalah **sumber dana berversi, bukan invoice kedua**; peristiwa `endowment.yield.allocated` membiayai M-11 dan M-44. **Jejak persetujuan empat-mata** di sini adalah inti layarnya: tanpa itu, satu tombol "alokasi" bisa mengubah dua modul sekaligus.

- **Rute**: `/dana-abadi` ringkas · `/dana-abadi/donasi` · `/dana-abadi/portofolio?pf=<id>` · `/dana-abadi/alokasi` · `/dana-abadi/kebijakan` (versi). `route_key` usulan `endowment.overview`, `endowment.allocation.list`.
- **Komposisi**: `PageHeader` · `MetaRow` (tahun fiskal, kebijakan aktif + `version`) · `StatCard` baris (dana kelola, imbal hasil periode, dialokasikan, tersisa) · `VelzonDataGrid` alokasi · drawer (`Donasi` · `Portofolio` · `Imbal Hasil` · `Alokasi` · `Laporan`) · **`ApprovalTrail` §18.13 sebagai bagian tetap drawer Alokasi** (bukan tab opsional) + `Alert` "ini bukan tagihan" yang menunjuk M-10/M-11/M-44.
- **Kolom grid alokasi**: `nomor_alokasi` · `tahun_fiskal` · `portfolio_id` · `peruntukan` (`SCHOLARSHIP` atau `GRANT`, enum kelas A) · `allocated_rupiah` (peran keuangan) · `keadaan` (`PROPOSED/APPROVED/REJECTED/ALLOCATED`) · `requested_by` · `approved_by` · `approved_at` · `policy_version`.
- **Form alokasi**: `tahun_fiskal` · `peruntukan` (kamus kelas A′: label dapat dinamai, kode tertutup) · `jumlah` · `dasar_perhitungan` (teks wajib) · `rincian_penerima` (rujukan objek M-11/M-44, bukan angka salinan — pola `RD-32`).
- **Tombol dan izin**: "Catat donasi" = usulan `endowment.donation.record` · "Hitung imbal hasil" = usulan `endowment.yield.run` (`OTHER`, worker, hasil ke tabel miliknya dengan `proposal_only`) · "Sahkan kebijakan alokasi" = usulan `endowment.policy.approve` (`VALIDATE`, **penyetuju ≠ penyusun**, versi dengan `effective_from/to`) · "Usulkan alokasi" = usulan `endowment.allocation.request` · "Sahkan alokasi" = usulan `endowment.allocation.validate` (`VALIDATE`, **dua orang**, MFA penulis-admin, peristiwa `endowment.yield.allocated` menuntut empat-mata) · "Sahkan laporan donatur" = usulan `endowment.report.publish`. **Tidak ada** tombol "terbitkan invoice"/"catat pembayaran": nominal menjadi jurnal hanya di M-10.
- **`SERVER_ONLY`**: `nomor_alokasi`, `keadaan`, `allocated_rupiah`, `yield_amount`, `policy_version`, `approved_by`, `approved_at`. Imbal hasil tidak dapat diketik; hanya dihitung dari portofolio dengan harness §12.1 (`engine_code`, `input_snapshot_hash`, `Idempotency-Key`, `budget`, `explain`).
- **Edge case**: alokasi melampaui pagu kebijakan → sebab dari baris `policy_version`, bukan `422` hampa · penyetuju = pemohon → `403 SELF_APPROVAL_FORBIDDEN` (56) dengan copy siapa yang boleh · alokasi dibatalkan setelah mencairkan beasiswa → **tidak** dapat dihapus; jalur koreksi beralasan (insert-only) · portofolio belum punya data pasar → `NO_PREREQ_DATA` dan **angka tidak dirender sebagai final** (§12.2) · donatur anonim tetap tercatat untuk laporan (kelas D atribut, bukan kolom baru).
- **DoD**: **EF-1** `ApprovalTrail` selalu tampil di tab Alokasi dan Kebijakan (uji render per peran) · **EF-2** nol jalur tulis ke invoice/ledger dari `/dana-abadi` · **EF-3** imbal hasil hanya dari run berversi, tidak dari `Input` · **EF-4** pembatalan alokasi adalah insert-only beralasan · **EF-5** izin `usulan` tercatat + kunci `endowment.*` dua berkas.

### 18.13 `ApprovalTrail` — satu komponen untuk seluruh jejak empat-mata

Objek baru di `apps/web/src/components/ui/` (bukan primitif yang ada hari ini; `drawer.tsx` baru punya `Drawer` dan `ConfirmDialog`, §11.3). Dipakai wajib oleh §18.11, §18.12, §18.9.1, §18.10, §18.2.1, §18.4, §18.5, §18.6, §18.7, §18.8 dan layar §14.4.

- **Isi** (semua dari server, tidak pernah dirakit klien): `requested_by` + `requested_at` · `reason` pemohon · `impact` terhitung · daftar penyetuju yang **sah** (proyeksi peran, bukan nama peran global) · `approved_by` + `approved_at` + `decision_note` · keadaan `PENDING/APPROVED/REJECTED`.
- **Bentuk**: daftar dua kolom tipis (`table.tsx`, head tipis uppercase) di dalam `Card`; keadaan memakai `StatusBadge`; **tidak** ada panah warna-warni atau timeline gradient (§11.7 butir 2).
- **Aturan**: pemohon **tidak pernah** melihat tombol sahkan untuk barisnya sendiri (§9.7) · `MFA` ditunjukkan sebagai gembok + teks, bukan hanya ikon · penolakan `55`/`56` punya cabang render sendiri · field identitas (`approved_by`) `SERVER_ONLY` · teks `admin.approval.*` (kunci usulan) bukan literal · kontras dua tema lolos §11.10 · tidak ada `font-black`, tidak ada paket baru.

### 18.14 Inventaris kunci i18n §18 (semuanya **belum ada**)

Terukur 2026-10-20 dengan penghitungan daun rekursif: `id.json` **574** daun, `en.json` **518** daun, namespace tingkat atas hanya `auth`, `dashboard`, `navigation`, `landing`; `helpdesk`, `hris`, `sister`, `journal`, `incubator`, `student_affairs`, `fieldwork`, `career`, `mobility`, `ppks`, `library`, `asset`, `clinic`, `residence`, `event`, `research`, `crm`, `procurement`, `endowment` masing-masing **0 daun**. Pola kunci yang diminta bagian ini, seragam per modul:

```
<modul>.list.title            <modul>.list.columns.<kolom>
<modul>.list.empty            <modul>.detail.title
<modul>.detail.tabs.<tab>     <modul>.action.<aksi>
<modul>.state.<keadaan>       <modul>.degraded.<bendera>
<modul>.errors.<KODE>         <modul>.restricted.<sebab>
<modul>.approval.trail        <modul>.approval.waitingOn
<modul>.money.hidden          <modul>.sibling.link
```

Nama kunci persis (`helpdesk.state.closed`, `ppks.state.hiddenByDesign`, `crm.approval.channel`, `endowment.approval.allocation`, `asset.money.hidden`, dan seterusnya) dibuat saat layar diimplementasikan, **dua berkas sekaligus** (`id.json` dan `en.json`), tanpa daun yatim baru di atas 56 (DB-8, §11.8).

### 18.15 Definition of Done lintas §18

- [ ] **N-1** Setiap layar §18 menaut dari kartu §17 dengan `route_key` terdaftar (usulan `menu_items`), bukan path yang dirakit di JSX.
- [ ] **N-2** Setiap tombol §18 menunjuk **satu** kode `resource × verb`; yang belum ada di katalog ditandai `usulan` di dokumen dan di kode, dan layarnya tidak lulus DoD sebelum promosi (AGENTS §3.8/§3.11).
- [ ] **N-3** Setiap field `SERVER_ONLY` §18 dibuktikan **absen dari body** pada uji tulis, bukan hanya `readOnly` (RG-5, DF-5).
- [ ] **N-4** Setiap layar rahasia (M-36, M-41) punya keadaan "isi tidak dapat ditampilkan kepada peran Anda" yang teruji dan tidak menghasilkan sel kosong tanpa sebab.
- [ ] **N-5** Setiap layar bernal (M-21, M-28, M-39, M-40, M-45, M-46, M-47) tidak pernah menerima atau menampilkan nominal untuk peran tanpa hak; yang terkirim hanyalah boolean + sebab.
- [ ] **N-6** Setiap layar ber-engine (M-25, M-40, M-42, M-44, M-47) punya cabang `degraded` nyata (§11.9 butir 3) dan berhenti pada `proposal_only` sampai `VALIDATE`.
- [ ] **N-7** Nol kosakata kelas C/D di kode: semua opsi dari `/master/lookups?group=` + baris `reference_kind_usage` (DF-1, DF-2).
- [ ] **N-8** Nol dependensi baru (grafik, ikon, penanggalan); bentuk visual apa pun adalah varian primitif §11.5/§17.6.
- [ ] **N-9** Kunci §18.14 lengkap di dua berkas; `tsc` bersih; `vitest` lulus; `.tools/contrast-audit.mjs` FAILS = 0; `.tools/purge-check.mjs` lulus pada artefak CSS.
- [ ] **N-10** Paritas Mobile dinyatakan per modul: daftar keadaan yang **tidak** punya padanan Flutter dicatat sebagai pengecualian (pola §12.10), bukan hilang diam-diam (AGENTS §3.4).
- [ ] **N-11** Enam vonis yang menyentuh lapisan tampilan tetap utuh dan dapat dipindai di bagian ini: nol angka akademik dihitung di klien, nol izin di luar katalog `RBAC_MATRIX`, nol masking yang dianggap penegakan, nol kosakata kamus yang di-hardcode, nol pustaka grafik, nol teks UI literal.

### 18.16 M-02 Kanal vicon + M-18 Rekonsiliasi kehadiran daring — `/admin/kanal-vicon` dan `/presensi/rekonsiliasi/:sesi` (2026-10-21)

Layar ini menjawab `RBAC_MATRIX §6.7.6` (baris izin 292–297) dan `PRD §5.15`. Dua hal yang membuatnya berbeda dari layar master data biasa: **rahasia tidak pernah tampil**, dan **kegagalan kanal harus tampil sebagai keadaan, bukan sebagai angka nol**.

**Blok A — `/admin/kanal-vicon` (Velzon, kartu dalam grid dua kolom).**

- Header: judul "Kanal kelas daring" + tombol `Daftarkan kanal` (`settings.conference.manage`, 293) — tombol tidak dirender tanpa izin, dan penyaring menu **bukan** penegakan (gerbang server tetap wajib).
- Satu kartu per kanal: nama provider (label dari enum, bukan teks hardcode), sakelar aktif, badge keadaan probe (`OK · DEGRADED · FAILED · UNKNOWN`) dengan titik warna Velzon (`success/warning/danger/secondary`), dan baris "kredensial: `vault pointer`" — **tidak ada** field yang menampilkan nilai rahasia, bahkan yang ter-*mask*.
- Kartu default ditandai `default` dan hanya boleh ada satu; mencoba men-set default kedua → server menolak, pesan memakai kunci i18n `admin.kanalVicon.defaultAlreadySet`.
- Panel kanan "Rantai fallback": daftar tersortir dengan pegangan geser; simpan memicu **dua** hal — `PUT /admin/conference/settings` lewat mesin parameter (§4.16) dan modal konfirmasi empat-mata (alasan + dampak + IP). Nilai di luar enum → inline error dari `422 PARAM_VALUE_NOT_ALLOWED` (baris 145), tanpa toast generik.
- Tombol `Uji koneksi` (294) menampilkan spinner + hasil `last_probe_*`; hasil `FAILED` menampilkan **sebab kelas** (`SCOPE_DENIED`, `AUTH`, `TIMEOUT`) dan bukan body vendor.

**Blok B — `/presensi/rekonsiliasi/:sesi` (tabel + drawer).**

- Tabel §2.4: mahasiswa, kanal, `ratio` (dibulatkan ke 1 desimal untuk tampil; nilai kanonik tetap `numeric(6,5)`), ambang yang berlaku + `parameter_version`, vonis, dan dua flag: `degraded` (ikon peringatan + tooltip sebab) serta `reviewState` (`NONE/PENDING/GRANTED/REJECTED` sebagai badge, bukan teks mentah).
- Keadaan wajib: `CHANNEL_UNAVAILABLE` (kanal mati seluruhnya — baris kosong dengan pesan dan tombol "coba kanal lain", bukan tabel kosong tanpa sebab), `LOADING skeleton`, `ERROR + Retry`, `EMPTY (belum ada bukti)`; keadaan `hiddenByDesign` **tidak** berlaku di sini karena datanya milik pengampu sesi yang sah.
- Drawer bukti: daftar baris `attendance_channel_evidence` (sumber, `join_seconds`, `session_seconds`, waktu), dengan catatan tetap di kaki: "vonis dihitung server; laporan kanal adalah bukti pendukung" (`BR-VIC-02`).
- Aksi banding (`CREATE`/`APPROVE`/`REJECT`) memakai komponen `ApprovalTrail` §18.13; pemohon banding tidak dapat melihat tombol setujui pada baris yang sama (SoD, `409 ATTENDANCE_REVIEW_STATE_CONFLICT`).

**Kunci i18n baru yang dibutuhkan bagian ini (terukur belum ada satu pun).** Namespace `admin.kanalVicon.*` (`title`, `register`, `probe`, `probeFailed.SCOPE_DENIED`, `probeFailed.AUTH`, `probeFailed.TIMEOUT`, `fallbackChain`, `defaultAlreadySet`, `credentialPointer`) dan `attendance.reconciliation.*` (`title`, `ratio`, `threshold`, `degraded`, `channelUnavailable`, `reviewState.NONE|PENDING|GRANTED|REJECTED`, `evidenceSource`). Ditambahkan ke **`id.json` dan `en.json` sekaligus** — utang paritas yang sudah terukur (`en` tertinggal 15 kunci dari `id`) tidak boleh bertambah oleh layar baru.

**Definition of Done lapisan kanal.** (1) enam provider tampil dari enum, nol string hardcode; (2) `credential_ref` tidak pernah muncul di respons mana pun; (3) keempat keadaan tabel teruji dengan data tiruan; (4) `422`/`409`/`502` kanal punya pesan sebab + langkah perbaikan di kedua bahasa; (5) mode turun saat kanal mati menampilkan `degraded`, bukan angka 0 hadir.


---

### 18.17 M-05 Keamanan & Audit — `/admin/audit`, `/admin/jangkar-audit`, `/admin/verifikasi-audit`, `/admin/permintaan-subjek-data` (2026-10-22, hasil kajian pakar M-05)

**Panel verifier rantai audit sudah punya rumahnya di §12.9 dan tidak diulang di sini (`RD-55`).** Blok ini menambah layar jejak audit, jangkar, dan DSAR yang sebelumnya **tidak punya spesifikasi layar sama sekali** meski menunya sudah ada di `RBAC §6` (Pengaturan → Jejak Audit / Permintaan Subjek Data / Audit) — kelas cacat yang sama dengan yang ditemukan pada M-02 dan M-04: objek lengkap, izin terdaftar, layar tidak digambar sehingga tidak dapat di-DoD-kan.

- **Rute dan `route_key`**: `/admin/audit` "Jejak Audit" · `/admin/audit?eventId=` drawer satu baris · `/admin/audit/partisi` "Status Partisi & Segel" · `/admin/jangkar-audit` "Jangkar Audit" · `/admin/verifikasi-audit` "Verifikasi Rantai" · `/admin/permintaan-subjek-data` "Antrean DSAR" · `/admin/permintaan-subjek-data/{id}` drawer keputusan. Padanan Mobile: **baca-saja** (jejak + hasil verifikasi + antrean DSAR dengan decision sheet); seluruh aksi tulis (seal, jalankan verifier, putuskan DSAR, ekspor) **Web-only** karena menuntut MFA sesi + alasan panjang — dan itu dinyatakan di layar, bukan disembunyikan.
- **Kolom grid `/admin/audit`** (sumber `GET /api/v1/admin/audit-events`, §4.21): `occurred_at` (`.tabular`, urutan baku DESC, **tidak pernah** diurutkan `id`) · `actor` (nama + `actor_role_ctx` ringkas) · `action` (label kamus, bukan teks mentah DB) · `target` (`target_entity` + `target_id` sebagai tautan ke layar modul sumber bila peran berhak; bila tidak → teks "objek tersembunyi", **bukan** 404 palsu) · `reason` (chip `WAJIB` bila kosong pada aksi sensitif = temuan, bukan data) · `rantai` (chip `UTUH` `tone=success` / `TERGANGGU` `tone=danger` dari hasil verifier terakhir, **bukan** dihitung di klien — aturan §18.0 butir 2) · kolom `before`/`after` **tidak dirender** untuk peran yang tidak berhak atas objek sumbernya (proyeksi server, §11 masking).
- **Drawer baris jejak**: `hash` dan `prev_hash` mono + tombol salin ber-`aria-label` (pola §12.9), `ip_hash`/`user_agent_hash` ditampilkan sebagai "ternilai" tanpa nilai mentah, `request_id` sebagai tautan ke log teknis, dan diff lama→baru memakai `ApprovalTrail` §18.13 bila barisnya hasil transisi empat-mata. **Tidak ada satu pun tombol ubah/hapus/sinkron** di layar ini; permintaannya pun tidak punya izin (§4.21).
- **Layar partisi & segel** (`GET /admin/audit/partitions`): baris per bulan dengan `jumlah_daun`, `last_hash` terpotong, `updated_at`, status `AKTIF`/`DITUTUP`/`BEKU`, dan tombol `Segel partisi` (`Button variant="outline"`) yang muncul **hanya** bila pemegang `audit.chain.validate`; konfirmasi wajib alasan ≥ 10 karakter + MFA; segel kedua pada baris yang sama menjawab `409 DECISION_ALREADY_MADE` (55) dengan copy "Partisi ini sudah tertutup dan tidak dapat disegel ulang." dan **tidak** menampilkan hash yang "akan dihitung ulang".
- **Layar jangkar** (`/admin/jangkar-audit`): grid `stream`, `partition_start`, `leaf_from`–`leaf_to`, `root_hash` terpotong, `prev_anchor_root` (rantai antar-akar, chip `AKAR PERTAMA` bila NULL), `sealed_at`, `sealed_by`; kolom `storage_key` **tidak ada di DOM** (SERVER_ONLY). Panel kanan menampilkan keterangan nol-TSA dengan kalimat yang diizinkan laporan: "dapat diverifikasi; jangkar disimpan di luar kendali tenant" — **dilarang** menulis "distempel waktu resmi" (`ARCHITECTURE §12.9`).
- **Layar verifier**: form `mode` sebagai **tiga radio, bukan dropdown kamus** (kelas A — keadaan mesin, bukan nama kampus), `stream`/`partitionStart` opsional; kirim → `202` + `verificationId` → layar beralih ke kartu "berjalan" (skeleton + `Alert` bila `degraded`), lalu hasil per §12.9. `COMPROMISED` menaikkan banner partisi beku di **seluruh** layar jejak, bukan hanya di layar verifier.
- **Antrean DSAR** (`/admin/permintaan-subjek-data`): grid `diajukan` (relatif) · `subjek` (samar untuk peran non-DPO: inisial + `user_id` terpotong) · `kind` chip `AKSES`/`KOREKSI`/`HAPUS-TERBATAS` (label dari `dsr_kind`, enum tertutup §15) · `status` · `SLA` (chip `TERLAMBAT` `tone=warning` dari `responded_by_due`, angka dihitung server) · `outcome`. Drawer: isi permintaan **dipotong di server** — layar menampilkan kelas data yang diminta, bukan isinya; tombol `Setujui`/`Tolak` dengan alasan wajib + MFA; `Tolak` pada `HAPUS-TERBATAS` yang menabrak retensi punya copy sendiri: "Arsip ini wajib disimpan N tahun menurut kebijakan retensi kampus. Yang dapat kami lakukan adalah menyamarankan tampilannya." dan **tidak pernah** menawarkan jalan tengah "hapus sebagian".
- **Ekspor bukti** (tombol di `/admin/audit` dan `/admin/verifikasi-audit`): modal dengan `reason` (wajib), `from`/`to` (wajib), `format` `csv|json`, lalu plafon baris ditampilkan **sebelum** kirim ("berkas dibatasi sampai N baris — perpendek jendela waktunya"); tombol mati bila filter kosong agar tidak ada unduhan seluruh tenant diam-diam.
- **Keadaan wajib** (enam, §18.0): idle · loading · sukses · kosong ("belum ada jejak pada jendela ini" — bukan "tidak ada anomali") · error per kode §4.21 · **degraded** (verifier tidak dapat dijalankan: worker/token store/penyimpanan WORM tidak tersedia → `Alert tone=warning` + bagian `findings` tidak ditampilkan sama sekali, bukan ditampilkan kosong).
- **Izin usulan:** seluruh kode 104–107 + `audit.dsar.*` + `audit.log.view`/`audit.export` belum masuk `PERMISSION_SPECS`; layar tetap dirender dengan **panel "belum dapat ditegakkan"** (§18.0 butir 9) yang menunjuk `ROADMAP §2.31 AUDT-0` — penyaringan menu bukan kontrol akses, dan tidak ada layar yang berpura-pura sudah ditegakkan.
- **Kunci i18n baru (belum ada di `id.json`/`en.json`)**: `audit.list.*`, `audit.detail.*`, `audit.action.seal`, `audit.action.runVerification`, `audit.action.export`, `audit.state.chainIntact`, `audit.state.chainBroken`, `audit.state.partitionFrozen`, `audit.errors.chainCompromised`, `audit.errors.repairForbidden`, `audit.errors.retentionBlocksErase`, `dsar.list.*`, `dsar.decision.*`, `anchor.list.*`, `verification.*`.
- **DoD layar**: (a) nol tombol yang mengubah jejak; (b) `HASH_MISMATCH` pada fixture → banner beku muncul di `/admin/audit` **dan** `/admin/verifikasi-audit`; (c) copy penolakan DSAR menyebut retensi, bukan "terjadi kesalahan"; (d) hash & status conveyed dengan ikon + teks, kontras AA dua tema; (e) padanan Mobile dibaca-saja dan aksi tulis menolak dengan sebab yang sama seperti Web.

## 19. Kontrak gerak, skeleton, CLS nol, tema adaptif, dan widget peta sebaran (2026-10-21)

**Kenapa bagian ini ada, dan apa yang tidak diklaim.** Brief menuntut "UI premium 1000 % clean" dengan micro-interaction, skeleton, glassmorphism, CLS 0.0, dan tema adaptif. `node .tools/dimension-audit.mjs` mengukur sebelum bagian ini ditulis: `micro-interaction` **hanya** muncul di laporan kemajuan (1 berkas), `CLS` hanya di berkas seed, `Glassmorphism` **0**, `prefers-color-scheme`/tema gelap **tidak** disebut di berkas mana pun. Artinya: tidak ada satu pun norma gerak yang bisa ditegakkan, dan "sudah rapi" hari ini adalah opini. Yang ditulis di bawah adalah **norma + cara ukur**, bukan janji visual; kualitas estetika tetap hanya terbukti setelah aplikasi dijalankan, dan itu masih di balik larangan menulis kode.

### 19.1 Token gerak, bukan angka di komponen

| Token | Nilai | Dipakai untuk | Aturan |
|---|---|---|---|
| `--sica-dur-instant` | 0 ms | saat `prefers-reduced-motion` | wajib dipakai untuk seluruh transisi non-esensial |
| `--sica-dur-micro` | 120 ms | hover tombol, fokus input, toggle | hanya perubahan properti murah (`opacity`, `transform`, warna) |
| `--sica-dur-enter` | 180 ms + `cubic-bezier(.16,1,.3,1)` | kartu, modal, drawer masuk | masuk lebih cepat daripada keluar |
| `--sica-dur-exit` | 140 ms + `ease-in` | penutupan | tidak pernah > masuk |
| `--sica-dur-view` | 220 ms | pertukaran tab/rute ringan | satu bahasa per layar, bukan campur |
| `--sica-shift-1` | `translateY(4px)` | offset masuk daftar | **satu-satunya** offset yang boleh dipakai; angka lain = temuan |

Larangan: durasi/heks/easing literal di komponen (dijaga `ui-guards.mjs`, hari ini mencatat **19 heks literal** dan **1 `text-black`** di `apps/web` — keduanya temuan yang harus di-nol-kan, bukan gaya). Tidak ada `transition: all` — daftar properti eksplisit, karena `all` menggerakkan `width`/`height` dan itulah sumber layout shift.

### 19.2 Skeleton sebagai kontrak tinggi, bukan dekorasi

Skeleton **wajib** punya tinggi yang sama dengan konten akhirnya (`min-height` tetap, bukan `aspect-ratio` yang dihitung setelah font masuk). Empat keadaan setiap widget: `idle · loading(skeleton) · success · error/sebab · degraded`. Yang terakhir wajib ada karena `ARCHITECTURE §13.8` dan `PRD §5.17` menuntut kejujuran saat Redis/GeoIP/kanal belum tersedia: widget **tidak** menampilkan nol, melainkan keadaan terakhir yang diketahui + sebabnya. `skeleton` dengan animasi shimmer **non-transform** (gradients bergerak) dilarang bila memaksa re-layout; hanya `background-position`/`opacity`.

Ukurannya: `CLS = 0.00` di Lighthouse pada **5 layar** (dashboard eksekutif, KRS, presensi, tagihan, admin parameter) × **2 viewport** (1366×768 dan 390×844), dengan gambar/ikon ber-`width`/`height` eksplisit dan font `display: swap` yang metric-compatible. Angka CLS ditulis di `PROGRESS_REPORT` per siklus; tanpa laporan itu, layar dianggap belum selesai — bukan "belum diukur".

### 19.3 Widget peta sebaran sesi (dashboard eksekutif M-32 & Super Admin M-01)

- **Isi yang tampil**: chorople/peta gelembung per (negara, provinsi/kota) dari **view bucket** `session_geo_live_buckets`, bukan titik per orang; sampingnya daftar "wilayah dengan sesi aktif" + **satu** badge sumber.
- **Badge sumber wajib** dan tidak boleh dihilangkan oleh preferensi pengguna: `GEOIP_DB` ("perkiraan kota dari alamat IP"), `CLIENT_GEO` ("koordinat perangkat, ± X m"), `SITE_GEO` ("koordinat kampus"), `UNKNOWN` ("tanpa data lokasi"). Ini bukan hiasan: `AGENTS §3.9` menuntut angka yang tidak melebihi klaimnya, dan menyamakan GeoIP dengan GPS adalah penipuan visual yang berakibat keputusan rektorat.
- **Akses**: hanya peran yang memegang izin peta (`RBAC §4.5.4`, masih usulan). `HEAD_OF_PROGRAM` ke bawah **tidak** melihat peta; `Dosen`/`Mahasiswa`/`Staff` tidak melihat widget sama sekali (bukan disembunyikan CSS — tidak dirender dan tidak diminta).
- **Keadaan turun**: `analytics.map.enabled=false` atau `GEOIP_DB_PATH` kosong → widget menampilkan panel sebab + tautan `remedyHref` ke layar parameter, dan **tidak** menggambar peta kosong. Angka "aktif sekarang" tetap muncul bila Primary terbaca, dengan catatan jendela waktu.
- **Tanpa data dummy** (larangan brief): tidak ada titik contoh, tidak ada seed lokasi untuk demo. Kalau DB kosong, yang tampil adalah keadaan kosong yang jujur.
- **Aksesibilitas**: peta adalah **pelengkap**; seluruh isi peta tersedia sebagai tabel wilayah (sama baris, sama angka) dengan `aria-live="polite"` untuk pembaruan, kontras AA (`contrast-audit`), dan navigasi keyboard tanpa hover-only.

### 19.4 Tema, kaca, dan batasnya

Tema gelap/terang adalah **satu set token** (`data-bs-theme` + variabel Velzon), bukan berkas CSS kedua. Semua pasangan warna lolos AA di **kedua** tema — hari ini `contrast-audit` mencetak `FAILS = 0` untuk himpunan yang ada, dan himpunan itu wajib diperluas saat token peta, warna tambah, dan ukuran kecil ditambahkan. Efek kaca (`backdrop-filter: blur()` + lapisan translusen) **hanya** di overlay di atas permukaan solid, tidak pernah di form input, tidak pernah di atas teks < 18px, dan **wajib** punya fallback warna solid saat `backdrop-filter` tidak didukung atau `prefers-reduced-transparency`. Glassmorphism bukan alasan untuk menurunkan kontras.

### 19.5 Definisi selesai bagian ini

`ui-guards.mjs` mencetak `heks literal = 0` dan `text-black = 0` · `contrast-audit` tetap `FAILS = 0` setelah token peta masuk · `dimension-audit.mjs` tidak lagi mencetak `Glassmorphism = 0` / `CLS tipis` / `micro-interaction tipis` · Lighthouse `CLS = 0.00` pada 5×2 pengukuran tercatat di `PROGRESS_REPORT` · `prefers-reduced-motion` punya uji visual · dan tidak satu pun layar memalsukan keadaan degradasi. **Sampai aplikasi dijalankan, seluruh butir di bagian ini adalah spesifikasi, bukan hasil.**

### 19.6 Toggle berdampak dan kartu analitik lokal

**Toggle berdampak (`TOGGLE_ACTIVE`, lihat `DATA_MODEL §25.3`).** Semua sakelar `is_active` di SICA — kamus §4.14.2, atribut kustom §4.14.3, parameter §4.16.2, domain deteksi `§25` — dirender sebagai **konfirmasi berdampak**, bukan switch senyap. Bentuknya: (1) label keadaan sekarang; (2) satu baris "yang berubah bila ini dinyalakan/dimatikan" yang dibaca dari data (jumlah item aktif di bawahnya, jumlah layar yang memakai kamus itu, `reviewRole` yang akan menelaah); (3) tombol primer ber-ikon sesuai aksi + teks konsekuensi; (4) sesudah tulis, toast **plus** baris riwayat yang langsung terlihat di panel yang sama. Untuk kelas `REGULATORY`/`SECURITY`, dialog kedua menuntut **penyetuju berbeda + MFA** dan menampilkan `requestedBy` (bukan kolom yang bisa dikirim klien). Kalau server menolak karena empat-mata, layar **tidak** pura-pura berhasil: toggle kembali ke keadaan semula beserta sebab (`remedyHref`).

**Kartu analitik lokal (ALG-25, ALG-10, ALG-13).** Setiap kartu wajib menampilkan empat hal dalam satu kesatuan visual: angka, **`degraded_mode`** bila ada (badge, bukan catatan kaki), `model_version` + `parameter_version` (teks kecil, tetap terbaca AA), dan waktu run. Aturan yang tidak bisa ditawar: angka parsial **tidak pernah** tampil sebagai angka final — `PARTIAL_BUDGET_EXHAUSTED`/`NO_PREREQ_DATA`/`NO_BASELINE`/`SINGLE_MODEL_AGREEMENT` menempel di angka, dan tombol "terima sebagai temuan" nonaktif sampai verdict manusia (`BR-AI-3`). Peran yang berbeda melihat kartu yang berbeda (`FR-AI-05`): Rektorat agregat per domain, BAAK `ATTENDANCE`, BAUK `FINANCE`, dan **tidak ada kartu temuan orang lain** untuk Dosen/Mahasiswa — penyaringannya di proyeksi server, bukan `display: none` (`AGENTS §3.8`).

**Preview WASM.** Slider "apa yang terjadi bila ambang dinaikkan" boleh dihitung di perangkat (preview), dan karena itu **hanya** mengubah angka di kartu itu — tidak ada panah naik-turun yang mengirim angka ke API, dan setiap perubahan ambang yang ingin disimpan tetap lewat rute `PUT /admin/anomaly/domains/:domain` dengan `expectedVersion`. Kalau hasil perangkat dan server berbeda, server menang dan perbedaan itu **ditampilkan**, tidak ditutupi (`AC-AI-4`).
