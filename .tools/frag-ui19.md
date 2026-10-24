
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

### 19.3 Widget peta sebaran sesi (`M-37`/dashboard eksekutif & Super Admin)

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

