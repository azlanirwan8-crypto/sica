// apply-api-420.mjs — menyisipkan §4.20 (M-01) ke API_SPEC dan lima baris kode error 150–154 ke §2.3.
// Berbasis asersi: anchor harus unik; kalau tidak, berhenti tanpa menulis.
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const P = 'docs/API_SPEC.md';
const L = readFileSync(P, 'utf8').split(NL);
const frag = readFileSync('.tools/frag-api420.md', 'utf8').replace(/\r\n/g, NL).split(NL);

const count = (re) => L.filter((l) => re.test(l)).length;
if (count(/^### 4\.20 /) > 0) { console.log('§4.20 sudah ada — tidak ada yang ditulis.'); process.exit(0); }
if (count(/^## 5\. Inventaris Endpoint Lengkap\s*$/) !== 1) { console.error('ASERSI GAGAL — heading `## 5.` tidak unik (' + count(/^## 5\. Inventaris/) + ').'); process.exit(1); }
if (count(/^### 5\.1 Otentikasi/) !== 1) { console.error('ASERSI GAGAL — `### 5.1` tidak unik.'); process.exit(1); }
if (count(/^\| 149 \| 409 \| `ATTENDANCE_REVIEW_STATE_CONFLICT`/) !== 1) { console.error('ASERSI GAGAL — baris register 149 tidak unik.'); process.exit(1); }

const errRows = [
  '| 150 | 409 | `TENANT_PROVISION_FAILED` | Salah satu langkah provisioning tenant gugur (domain sudah dipakai, seed 22 peran sistem gagal, `plan_id` tidak aktif, `uq_subscriptions_active` menolak langganan kedua) sehingga **seluruh** transaksi dibatalkan dan tidak ada tenant yatim (`PRD AC-PLT-1`, `DATA_MODEL §9`). Sebab yang ditampilkan = langkah yang gugur, bukan isi badan permintaan | Tidak — perbaiki sebab lalu kirim ulang dengan `Idempotency-Key` yang sama | `admin.errors.TENANT_PROVISION_FAILED` | `spec` §4.20 — belum pernah dipancarkan |',
  '| 151 | 403 | `TENANT_SUSPENDED` | Permintaan tulis tingkat tenant diajukan sedangkan `tenants.status` = `SUSPENDED` (atau `ARCHIVED`). `GET` tetap diizinkan supaya bahan penagihan dan jejak periode lama terbaca (`BR-R12`); kosakata keadaan ada di `DATA_MODEL §15.1` dan arah transisinya di §3.1 | Tidak — sampai `platform.tenant.suspend` diarahkan balik (`RBAC §4.5.3` baris 304) | `admin.errors.TENANT_SUSPENDED` | `spec` §4.20 (`login_events` sudah memuat penanda yang sama, `DATA_MODEL §3.2`) — belum pernah dipancarkan |',
  '| 152 | 410 | `IMPERSONATION_GRANT_EXPIRED` | Grant dukungan/impersonation dipakai setelah TTL ≤ 30 menit lewat atau setelah dicabut oleh `TENANT_ADMIN` tenant sasaran (`PRD AC-PLT-4`, `RBAC §4.5.3` baris 318). Baris jejaknya tetap ada — yang kedaluwarsa adalah haknya, bukan buktinya | Tidak — ajukan grant baru dengan alasan baru | `admin.errors.IMPERSONATION_GRANT_EXPIRED` | `spec` §4.20 — belum pernah dipancarkan |',
  '| 153 | 422 | `PLATFORM_QUOTA_KEY_UNKNOWN` | `platform.quota.manage` mengirim kunci di luar kolom `tenant_quotas` (`DATA_MODEL §3.1`). Kuota adalah kolom bertipe dengan `CHECK`, bukan pasangan kunci-nilai bebas, jadi kunci asing adalah kesalahan pemanggil, bukan nilai yang bisa dilonggarkan | Tidak — kunci harus ada di register §3.1 | `admin.errors.PLATFORM_QUOTA_KEY_UNKNOWN` | `spec` §4.20 — belum pernah dipancarkan |',
  '| 154 | 409 | `SEAT_LIMIT_BELOW_ACTIVE_USAGE` | Menurunkan batas `PER_SEAT` di bawah pemakaian aktif pada tenant (`entitlement.seat.manage`, `RBAC §4.5.3` baris 315). Penolakannya menyatakan angka terpakai; memutus pengguna yang sudah ada **bukan** efek dari kode ini | Tidak — naikkan batas atau kurangi pemakaian lebih dulu | `admin.errors.SEAT_LIMIT_BELOW_ACTIVE_USAGE` | `spec` §4.20 — belum pernah dipancarkan |',
];

const i5 = L.findIndex((l) => /^## 5\. Inventaris Endpoint Lengkap\s*$/.test(l));
const out = [...L];
out.splice(i5, 0, ...frag);
const i149 = out.findIndex((l) => /^\| 149 \| 409 \| `ATTENDANCE_REVIEW_STATE_CONFLICT`/.test(l));
out.splice(i149 + 1, 0, ...errRows);
writeFileSync(P, out.join(NL), 'utf8');
const t = out.join(NL);
console.log('§4.20 disisipkan sebelum baris ' + (i5 + 1) + ' · baris register 150–154 disisipkan setelah 149');
console.log('jumlah kode error ber-nomor di §2.3 = ' + (t.match(/^\|\s*1[0-9]{2}\s*\|\s*\d{3}\s*\|\s*`/gm) || []).length);
console.log('jumlah heading `### 4.20` = ' + (t.match(/^### 4\.20 /gm) || []).length + ' · rute §4.20 = ' + (frag.filter((l) => /^\| (GET|POST|PUT|PATCH|DELETE) \|/.test(l)).length));
