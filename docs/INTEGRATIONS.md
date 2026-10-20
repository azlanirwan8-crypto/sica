# SICA Enterprise External Integrations Specification
**Status:** Production Standard  
**Role:** Lead Enterprise Integration Architect  
**Core Stack:** Node.js / Next.js, BullMQ, Redis, PostgreSQL 16 (RLS)  
**External Services:** PDDikti Neo Feeder, Midtrans / Xendit, Fonnte / WhatsApp Gateway, Resend Email, Cloudflare R2 / AWS S3  

---

## 1. Integrasi PDDikti Neo Feeder (Kementerian Diktisaintek)

Sistem SICA menyediakan subsistem sinkronisasi dua arah dengan aplikasi resmi Neo Feeder PDDikti versi Web Service (REST API over HTTPS) berbasis RPC action.

```
┌──────────────┐     ETL & Sanitasi      ┌────────────────────┐     JSON RPC      ┌──────────────────┐
│  SICA DB     │ ──────────────────────> │  PDDikti Sync Sync │ ────────────────> │  Neo Feeder      │
│ (PostgreSQL) │ <────────────────────── │  Worker (BullMQ)   │ <──────────────── │  WS (Pemerintah) │
└──────────────┘      Update Feeder ID   └────────────────────┘     Response ID   └──────────────────┘
```

### 1.1 Autentikasi & Handshake Feeder
Endpoint: `POST https://feeder.kampus.ac.id:8082/ws/live2.php`
- **Action:** `GetToken`
- **Payload:** `{ "act": "GetToken", "username": "<FEEDER_USER>", "password": "<FEEDER_PASS>" }`
- Token disimpan di Redis dengan TTL 60 menit dan direfresh otomatis saat menerima status `401 / Token Expired`.

### 1.2 Skema Pemetaan Data (Mapping Schema)

#### A. Biodata & Riwayat Pendidikan Mahasiswa (`InsertRiwayatPendidikanMahasiswa`)
| Field SICA (`students`, `enrollments`) | Field PDDikti Feeder | Tipe Data | Keterangan / Transformasi |
| :--- | :--- | :---: | :--- |
| `students.id` | `id_mahasiswa` | UUID | Dicari via `GetBiodataMahasiswa` menggunakan NIK/NIM |
| `students.nim` | `nim` | String(24) | Nomor Induk Mahasiswa aktif |
| `study_programs.pddikti_code` | `id_prodi` | UUID | ID Program Studi resmi di pangkalan data Dikti |
| `academic_periods.pddikti_id` | `id_periode_masuk` | String(5) | Format: `20261` (Ganjil) / `20262` (Genap) |
| `students.admission_date` | `tgl_daftar` | YYYY-MM-DD | Tanggal resmi registrasi mahasiswa |
| `students.admission_type` | `id_jenis_daftar` | Integer | `1` (Peserta Didik Baru), `2` (Pindahan) |
| `students.biaya_masuk` | `biaya_masuk` | BigInt | Konversi nominal rupiah ke integer tanpa desimal |

#### B. Kurikulum & Mata Kuliah (`InsertMataKuliah`)
| Field SICA (`courses`) | Field PDDikti Feeder | Tipe Data | Keterangan / Transformasi |
| :--- | :--- | :---: | :--- |
| `courses.code` | `kode_mata_kuliah` | String(20) | Kode MK unik di prodi terkait |
| `courses.name` | `nama_mata_kuliah` | String(200)| Nama resmi mata kuliah bahasa Indonesia |
| `courses.sks_total` | `sks_mata_kuliah` | Decimal | Total beban SKS (SN-Dikti 39/2025) |
| `courses.sks_theory` | `sks_tatap_muka` | Decimal | Beban SKS teori/kuliah |
| `courses.sks_practicum` | `sks_praktek` | Decimal | Beban SKS laboratorium/praktik |
| `courses.course_type` | `id_jenis_mata_kuliah` | String(1) | `A` (Wajib Prodi), `B` (Pilihan) |

#### C. Nilai Perkuliahan Semester (`InsertNilaiPerkuliahanKelas`)
| Field SICA (`grades`) | Field PDDikti Feeder | Tipe Data | Keterangan / Transformasi |
| :--- | :--- | :---: | :--- |
| `classes.pddikti_class_id` | `id_kelas_kuliah` | UUID | ID Kelas terdaftar di Feeder |
| `students.pddikti_reg_id` | `id_registrasi_mahasiswa` | UUID | ID Riwayat pendidikan mahasiswa |
| `grades.numeric_score` | `nilai_angka` | Decimal(5,2)| Skor mentah (0 - 100) |
| `grades.letter_grade` | `nilai_huruf` | String(3) | Nilai huruf (A, B+, B, C, D, E) |
| `grades.grade_point` | `nilai_indeks` | Decimal(3,2)| Bobot mutu (4.00, 3.50, dst) |

### 1.3 Mekanisme Rekonsiliasi & Anti-Duplikasi
1. Setiap entitas lokal menyimpan kolom `pddikti_id` (UUID nullable) dan `pddikti_sync_at` (timestamptz).
2. Jika `pddikti_id` sudah bernilai (tidak null), worker akan mengeksekusi aksi `Update...`, bukan `Insert...`.
3. Seluruh payload yang gagal ditandai dengan error code resmi Feeder dan dimasukkan ke tabel `pddikti_sync_logs` untuk audit trail.

---

## 2. Integrasi Payment Gateway (Midtrans & Xendit)

SICA mengadopsi integrasi multi-gateway (Midtrans Core API & Xendit Invoice) untuk pembayaran Uang Kuliah Tunggal (UKT), Formulir PMB, dan Wisuda melalui Virtual Account (BCA, Mandiri, BNI, BRI) serta QRIS Dinamis.

### 2.1 Alur Transaksi & Validasi Webhook Idempotent

```
[Mahasiswa] ── Bayar VA ──> [Bank / ATM] ── Callback ──> [Payment Gateway]
                                                               │
                                                       POST Webhook Event
                                                               │
                                                               ▼
                                                    ┌────────────────────┐
                                                    │ SICA API Handlers  │
                                                    │ Verify Signature   │
                                                    └────────────────────┘
                                                               │
                                                   Atomic DB Transaction
                                                               │
                                           ┌───────────────────┴───────────────────┐
                                           ▼                                       ▼
                                ┌─────────────────────┐                 ┌─────────────────────┐
                                │ Invoices (PAID)     │                 │ Double-Entry Ledger │
                                │ & Unlock Akademik   │                 │ (Jurnal Kas / Bank) │
                                └─────────────────────┘                 └─────────────────────┘
```

### 2.2 Verifikasi Keamanan Signature Webhook

Setiap request callback yang masuk ke `/api/v1/payments/webhook/:gateway` WAJIB diverifikasi keabsahan signature-nya sebelum membaca body payload:

```typescript
// Midtrans Signature Check: SHA512(order_id + status_code + gross_amount + ServerKey)
import crypto from 'crypto';

export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureReceived: string,
  serverKey: string
): boolean {
  const payload = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const computedSignature = crypto.createHash('sha512').update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(computedSignature), Buffer.from(signatureReceived));
}
```

### 2.3 Handler Mutasi Database Atomik & Auto-Reconcile Ledger

```typescript
import { db } from '@/database';
import { invoices, payments, financialLedger } from '@/database/schema';
import { eq, sql } from 'drizzle-orm';

export async function processPaymentWebhookSuccess(event: {
  tenantId: string;
  invoiceId: string;
  gatewayTransactionId: string;
  amount: bigint;
  paymentMethod: string;
  paidAt: Date;
}) {
  return await db.transaction(async (tx) => {
    // 1. Kunci baris invoice menggunakan SELECT ... FOR UPDATE (Concurrency Protection)
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, event.invoiceId))
      .for('update');

    if (!invoice) throw new Error('INVOICE_NOT_FOUND');
    if (invoice.status === 'PAID') return { alreadyProcessed: true }; // Idempotent check

    // 2. Update status invoice menjadi LUNAS (PAID)
    await tx.update(invoices).set({
      status: 'PAID',
      paidAmount: event.amount,
      updatedAt: new Date()
    }).where(eq(invoices.id, invoice.id));

    // 3. Catat rekaman pembayaran riil
    await tx.insert(payments).values({
      tenantId: event.tenantId,
      invoiceId: invoice.id,
      gatewayTransactionId: event.gatewayTransactionId,
      amount: event.amount,
      paymentMethod: event.paymentMethod,
      status: 'SETTLED',
      paidAt: event.paidAt
    });

    // 4. Posting ke Double-Entry General Ledger (Kas Debet, Piutang Kredit)
    await tx.insert(financialLedger).values([
      {
        tenantId: event.tenantId,
        referenceId: invoice.id,
        accountCode: '1101-KAS-BANK',
        debit: event.amount,
        credit: 0n,
        description: `Penerimaan Pembayaran VA Invoice #${invoice.invoiceNumber}`
      },
      {
        tenantId: event.tenantId,
        referenceId: invoice.id,
        accountCode: '1103-PIUTANG-MAHASISWA',
        debit: 0n,
        credit: event.amount,
        description: `Pelunasan Piutang Akademik Invoice #${invoice.invoiceNumber}`
      }
    ]);

    // 5. Buka cekal akademik otomatis (jika ada tagihan UKT)
    await tx.execute(sql`
      DELETE FROM blockades 
      WHERE student_id = ${invoice.studentId} 
        AND reason_type = 'FINANCIAL_UNPAID'
    `);

    return { success: true };
  });
}
```

---

## 3. Integrasi Messaging Gateway (WhatsApp & Email)

SICA menggunakan background job queue **BullMQ** (Redis-backed) untuk mengirimkan notifikasi tanpa membebani latensi HTTP API:
- **WhatsApp Gateway:** Fonnte API / Gupshup WhatsApp Business API
- **Transactional Email:** Resend API / AWS SES

### 3.1 Arsitektur Antrean (Queue System)

```typescript
import { Queue, Worker } from 'bullmq';
import { redisConnection } from '@/lib/redis';

export const notificationQueue = new Queue('sica-notifications', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000 // Retry: 5s, 10s, 20s, 40s, 80s
    },
    removeOnComplete: 1000,
    removeOnFail: 5000
  }
});
```

### 3.2 Katalog Jenis Notifikasi & Template

| Tipe Notifikasi | Saluran (*Channel*) | Prioritas | Trigger Kejadian |
| :--- | :---: | :---: | :--- |
| `OTP_LOGIN` | WhatsApp & Email | **High (P0)** | Percobaan login akun dengan proteksi MFA aktif |
| `INVOICE_GENERATED` | WhatsApp & Email | Normal (P1) | Penerbitan tagihan UKT baru semester ganjil/genap |
| `PAYMENT_RECEIPT` | WhatsApp & Email | Normal (P1) | Berhasil verifikasi pelunasan VA atau QRIS |
| `KRS_APPROVED` | WhatsApp & Push App | Normal (P2) | Dosen Pembimbing menyetujui rencana studi mahasiswa |
| `CLASS_SCHEDULE_REMINDER` | Push App & WhatsApp | Normal (P2) | Pengingat H-1 jam sebelum perkuliahan dimulai |

---

## 4. Integrasi Object Storage (Cloudflare R2 & AWS S3)

Penyimpanan berkas biner (Foto Profil, Bukti Pembayaran, Berkas Skripsi, Dokumen Ijazah & Transkrip PDF) menggunakan S3-Compatible Storage dengan skema **Pre-Signed URL** langsung dari client ke object storage (tanpa membebani buffer memory Next.js server).

### 4.1 Diagram Alur Unggah Berkas Pre-Signed URL

```
[Client Web/Mobile] ──── 1. Minta Pre-Signed URL ────> [Next.js API]
                                                            │
                                                   Validasi Ekstensi & Ukuran
                                                            │
[Client Web/Mobile] <── 2. Kirim URL PUT (TTL 5m) ──────────┘
        │
   3. Direct HTTP PUT Binary
        │
        ▼
┌─────────────────────────┐
│ Cloudflare R2 / AWS S3  │
└─────────────────────────┘
        │
   4. Sukses (200 OK)
        │
        ▼
[Client Web/Mobile] ──── 5. Konfirmasi Simpan Metadata ──> [Next.js API]
```

### 4.2 Generator Pre-Signed URL (AWS SDK v3 S3 Client)

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.STORAGE_ENDPOINT, // e.g. https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!
  }
});

// Aturan Upload Ketat
const ALLOWED_MIME_TYPES: Record<string, { maxSize: number; allowedExts: string[] }> = {
  avatar: { maxSize: 2 * 1024 * 1024, allowedExts: ['image/jpeg', 'image/png', 'image/webp'] },
  assignment: { maxSize: 25 * 1024 * 1024, allowedExts: ['application/pdf', 'application/zip'] },
  diploma_archive: { maxSize: 10 * 1024 * 1024, allowedExts: ['application/pdf'] }
};

export async function generateUploadPresignedUrl(params: {
  tenantId: string;
  category: 'avatar' | 'assignment' | 'diploma_archive';
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
}) {
  const policy = ALLOWED_MIME_TYPES[params.category];
  if (!policy) throw new Error('INVALID_UPLOAD_CATEGORY');

  if (!policy.allowedExts.includes(params.fileType)) {
    throw new Error(`FILE_TYPE_NOT_ALLOWED: Hanya menerima ${policy.allowedExts.join(', ')}`);
  }

  if (params.fileSizeBytes > policy.maxSize) {
    throw new Error(`FILE_TOO_LARGE: Batas ukuran maksimal ${policy.maxSize / (1024 * 1024)}MB`);
  }

  // Pola path terisolasi per tenant
  const storageKey = `tenants/${params.tenantId}/${params.category}/${Date.now()}-${params.fileName}`;

  const command = new PutObjectCommand({
    Bucket: process.env.STORAGE_BUCKET_NAME,
    Key: storageKey,
    ContentType: params.fileType
  });

  // URL berlaku tepat 5 menit (300 detik)
  const presignedPutUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

  return {
    uploadUrl: presignedPutUrl,
    storageKey,
    expiresInSeconds: 300
  };
}
```

---

<!-- SICA-47:BEGIN enterprise-47 -->

## 5. Integrasi Enterprise 47 Modul (dikunci 2026-10-20)

> **Penamaan berkas:** dokumen yang di instruksi disebut `INTEGRATION_SPEC.md` adalah berkas ini (`INTEGRATIONS.md`); nama berkas dipertahankan agar seluruh rujukan silang (AGENTS.md, INDEX.md) tidak putus.

### 5.1 Kebijakan "Zero Paid API Key" vs Integrasi Resmi

| Kelas | Contoh | Aturan |
|---|---|---|
| Engine algoritma/AI | OCR, fuzzy matching, solver jadwal, scoring, face check, plagiarisme, pencarian | **wajib lokal** (proses `api`/`worker`/WASM klien); dilarang memanggil API AI/cloud berbayar; model/bobot disimpan & berversi di DB tenant |
| Integrasi regulasi pemerintah | PDDikti Neo Feeder (M-34), SISTER (M-08), PIN/SIVIL (M-35), MSIB/PMM (M-38), SINTA/ARJUNA (M-21) | memakai kredensial resmi milik tenant (bukan berbayar); bila tidak ada API resmi → impor/ekspor berkas terstandar |
| Integrasi transaksi | Virtual Account/payment gateway (M-10), TTE PSrE (M-35) | kredensial tenant di secret manager; webhook HMAC + idempotensi |
| Komunikasi | WhatsApp Business/Email/SMS (M-27, notifikasi), push FCM/APNs (APP) | kredensial tenant; fallback email; throttle parameter |
| Rapat daring | Jitsi self-hosted (default), Zoom/Google Meet via OAuth tenant (M-15) | log join diambil via webhook/report API untuk rekonsiliasi ≥ 75% |
| Pustaka & repositori | SLiMS/KOHA (M-39) via OAI-PMH/SIP2, OJS (M-21) via OAI-PMH | self-hosted, tanpa biaya API |
| DJKI (M-22) | — | pencatatan nomor permohonan/sertifikat + unggah bukti; tidak ada scraping |

Semua kredensial disimpan sebagai referensi secret (`*_secret_ref`) — tidak pernah di tabel/log; rotasi diatur SECURITY_COMPLIANCE §2.

### 5.2 Katalog Adapter per Modul

| Modul | Adapter | Arah | Protokol | Pola keandalan |
|---|---|---|---|---|
| M-08 | SISTER | push | REST/web service SISTER | delta hash, outbox, retry backoff, antrean review konflik |
| M-34 | Neo Feeder | push | web service Feeder (§1) | staging → pre-sync rules → fuzzy auto-corrector → retry; dry-run wajib |
| M-35 | PIN/SIVIL | push/pull | layanan PIN/SIVIL + QR publik SICA | reservasi per batch, tanda tangan RSA-PSS/Ed25519 |
| M-38 | MSIB/PMM | pull | impor berkas/endpoint resmi | importer logbook mingguan idempoten per (peserta, minggu) |
| M-21 | OJS | pull | OAI-PMH 2.0 | resumptionToken, dedupe DOI |
| M-20 | RAMA/Garuda | pull oleh pihak luar | OAI-PMH 2.0 endpoint SICA | `oai_dc`, embargo dihormati |
| M-39 | SLiMS/KOHA | dua arah | OAI-PMH, SIP2, impor MARC21 | sinkron katalog & status pinjaman → bebas pustaka |
| M-10 | Payment VA | push/webhook | §2 | HMAC, `external_ref` unik, rekonsiliasi harian |
| M-15 | Jitsi/Zoom/Meet | dua arah | REST/OAuth | provisioning rapat saat sesi dibuat, ambil log join saat sesi ditutup |
| M-27/M-45 | Messaging | push | §3 | throttle, consent PDP, opt-out |
| APP | FCM/APNs | push | HTTP v1 | token terenkripsi, payload tanpa PII |

### 5.3 Integrasi Internal (Event Pipeline)

Rantai I-1…I-10 ([PRD.md §10.4](file:///c:/SICA/docs/PRD.md)) diimplementasikan murni lewat event outbox ([ARCHITECTURE.md §11.5](file:///c:/SICA/docs/ARCHITECTURE.md)); tidak ada integrasi titik-ke-titik antar modul internal. Kontrak payload event berada di `packages/contracts/src/events/<domain>.ts` (Zod, versi `v1`); perubahan breaking → versi baru dan konsumen lama tetap dilayani sampai migrasi selesai.

<!-- SICA-47:END enterprise-47 -->
