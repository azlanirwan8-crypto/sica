# SICA — Data Model & Row-Level Security

| | |
|---|---|
| Versi | 0.1 |
| Engine | PostgreSQL 16, skema tunggal multi-tenant (pooled) dengan RLS |
| Konvensi | TypeScript di `packages/db/schema.ts` ↔ SQL di bawah adalah **satu sumber** (Drizzle), dokumen ini menampilkan SQL untuk auditabilitas |
| Dokumen terkait | [INDEX.md](file:///c:/SICA/docs/INDEX.md) · [PRD.md](file:///c:/SICA/docs/PRD.md) · [ARCHITECTURE.md](file:///c:/SICA/docs/ARCHITECTURE.md) · [SECURITY_COMPLIANCE.md](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md) · [GLOSSARY.md](file:///c:/SICA/docs/GLOSSARY.md) |

---

## 1. Konvensi (berlaku untuk semua tabel, tanpa pengecualian)

| Aspek | Aturan | Alasan |
|---|---|---|
| Primary key | `id uuid PRIMARY KEY` — UUIDv7 dibangkitkan **aplikasi** | time-ordered → index tidak berfragmentasi; tidak membocorkan volume; PG16 belum punya `uuid7()` |
| Tenancy | `tenant_id uuid NOT NULL REFERENCES tenants(id)` di **semua** tabel domain & log | RLS tidak bisa menegakkan tanpa kolom; join yang lupa filter tetap terbendung |
| Waktu | `timestamptz` UTC (`created_at`, `updated_at`, `occurred_at`) | job lintas zona, audit, dan replikasi tidak ambigu |
| Tanggal akademik | `date` (bukan timestamptz) untuk jendela KRS/calendar + `tenant_settings.timezone` | "batas 23:59 WIB" adalah tanggal lokal, bukan momen UTC |
| Uang | `bigint` **rupiah utuh**, `CHECK (… > 0)`; ledger memakai nilai bertanda | IDR tidak punya sub-unit; `float`/`double` untuk uang = bug rekonsiliasi |
| SKS | `numeric(4,1)` | sebagian prodi memakai 0,5 SKS |
| Soft delete | **tidak ada** `deleted_at` untuk data akademik/keuangan; gunakan status | rekaman akademik wajib tersimpan & dapat direkonstruksi |
| Penamaan | `snake_case`, tabel bentuk jamak, FK `<table>_id`, index `idx_<table>_<cols>`, unique `uq_<table>_<cols>` | les SQL generik & migration readable |
| Enum | `CREATE TYPE … AS ENUM` untuk state yang sedikit & stabil; `text + CHECK` bila tenant boleh menambah nilai | `ALTER TYPE` di tabel besar itu operasi mahal |
| JSONB | hanya untuk parameter yang benar-benar bebas bentuk (`academic_rules.params`) — **bukan** pengganti kolom yang di-query | integritas & indexability |
| Audit | semua tabel mutable memiliki pemicu penulisan `audit_logs` via outbox dalam transaksi yang sama | tidak ada jejak yang tertinggal sendirian |
| Kolom pelacak | `created_by uuid`, `updated_by uuid`, `version integer` (optimistic lock untuk KRS/nilai/tarif) | cegah lost-update saat dua admin bekerja paralel |

---

## 2. ERD (inti)

```
TENANT & PLATFORM                                IDENTITAS & AKSES
┌────────────┐1┌────────────────┐   ┌────────┐1┌───────────────────┐1┌────────────────────┐
│  tenants   │─┤ tenant_domains │   │ users  │─┤ tenant_memberships│─┤user_role_assignments│
│ status     │ │ (host→tid)     │   │ global │ │ (uid,tid, nim/    │ │ (uid,tid,role_id,   │
│ timezone   │ └────────────────┘   │ identity│  email, status)    │ │  scope_*, valid_*)  │
└─────┬──────┘                      └───┬────┘ └────────┬──────────┘ └─────────┬───────────┘
      │1                                │               │                      │N
┌─────┴──────────┐   ┌────────────┐    │N        ┌─────┴──────┐          ┌─────┴────┐
│ subscriptions  │───│    plans   │    │    ┌────┴─────┐ ┌────┴─────┐    │  roles   │N┌────────┐
│ (tid,plan,seat,│   │(tier by    │    │    │ sessions │ │mfa_factors│    │(per tid) │─┤role_-  │
│  period,seats) │   │ student #) │    │    └──────────┘ └───────────┘    └──────────┘ │permissions
└────────────────┘   └────────────┘    │N                                     N      └──┬───────┘
┌────────────────┐  ┌───────────────┐  │                                            ┌───┴─────────┐
│ tenant_usage / │  │  audit_logs   │  │                                       ┌────┴────┐ ┌────┴─────┐
│ tenant_quotas  │  │ partitioned by│  │                                       │permission│ │  roles   │
└────────────────┘  │ month, hash-  │  │                                       │ catalog  │ └──────────┘
                    │ chained       │  │                                       └──────────┘
                    └───────────────┘  │
DOMAIN AKADEMIK                        │
┌──────────┐1┌─────────────┐1┌─────────┴──┐1┌────────┐1┌──────────┐   ┌──────────────────┐
│academic_ ││academic_    ││organizations││study_  ││curricula │───│courses (matakuliah)│
│years     ││periods      ││(fak/prodi)  ││programs││(versioned)│   │ sks, semester ideal│
└──────────┘└──────┬──────┘└─────────────┘└────────┘└────┬─────┘   └─────────┬──────────┘
                 │N                                ┌─────┴──────────┐  ┌─────┴───────────┐
        ┌────────▼─────────┐                       │course_prereq_  │  │  grade_scales   │
        │ academic_rules   │  ← band SKS, jendela  │ rules (A→B)    │  │  + grade_scale_ │
        │ (tid,prodi,      │    KRS, denda, syarat  └────────────────┘  │  bands (angka→  │
        │  period, params) │                                            │  huruf+bobot)   │
        └──────────────────┘                                            └─────────────────┘
┌──────────┐1┌───────────┐N┌────────────┐1┌────────────┐1┌────────────┐N┌───────────┐
│ students ││student_     ││  classes   ││class_      ││ enrollments│││ attendances│
│(tid,psm, ││status_      ││(prodi,mk,  ││assignments ││(student,   ││ │(session,   │
│ nim uniq)││history      ││ period,    ││(lecturer,   ││ class,     ││ │ student,   │
└────┬─────┘│(AKTIF/CUTI/ ││ kuota)     ││ role koor/  ││ status)    ││ │ present)   │
     │      │ DO/LULUS)   │└─────┬──────┘│ member)     │└─────┬──────┘└─────────────┘
     │      └─────────────┘      │N      └─────────────┘      │1
     │                  ┌────────▼─────────┐            ┌─────┴────────┐  ┌──────────────┐
     │                  │  class_sessions  │            │    grades    │──│grade_-       │
     │                  │ (tanggal, materi)│            │ (enrollment, │  │ corrections  │
     │                  └──────────────────┘            │  angka,huruf,│  │ (workflow +  │
┌────┴───────────┐   ┌──────────────────┐               │  status)     │  │ alasan wajib)│
│clearances      │   │ thesis_/proposal │               └──────────────┘  └──────────────┘
│(keuangan/perpu-│   │ (Phase 2)        │
│stakaan)        │   └──────────────────┘
DOMAIN KEUANGAN
┌──────────────┐1┌─────────────┐1┌────────────┐1┌─────────────┐   ┌──────────┐  ┌──────────┐
│fee_tariff_   ││fee_components││  invoices  ││invoice_items│───│payments  │──│ ledger   │
│groups (UKT/  ││(tarif per    ││(tid,stud,  ││(component,  │   │(provider,│   │(append-  │
│ kelompok)    ││ prodi,angkatan││ period,    ││ amount,     │   │ ref uniq,│   │ only,    │
└──────────────┘│ versioned)   ││ status)    ││ due_date)   │   │ idempot.)│   │ balanced)│
                              └────────────┘ └─────────────┘   └──────────┘  └──────────┘
PELAPORAN & PLATFORM
┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
│pddikti_mappings  │ │pddikti_sync_runs │ │ notifications│ │ outbox / idempo- │
│(entitas,field→   │ │(periode,accepted,│ │ + templates  │ │ tency_keys /     │
│ kode PDDIKTI)    │ │  rejected rows)  │ │ + delivery   │ │ files / feature_ │
└──────────────────┘ └──────────────────┘ └──────────────┘ │ flags / quotas   │
                                                            └──────────────────┘
```

---

## 3. DDL — Platform & Identity Core

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- digest() untuk audit hash-chain
CREATE EXTENSION IF NOT EXISTS citext;         -- email case-insensitive
CREATE EXTENSION IF NOT EXISTS btree_gist;     -- exclusion constraint (overlap jendela)

-- ── ENUM ────────────────────────────────────────────────────────────────────
CREATE TYPE tenant_status     AS ENUM ('ONBOARDING','ACTIVE','SUSPENDED','ARCHIVED');
CREATE TYPE member_status     AS ENUM ('PENDING','ACTIVE','SUSPENDED','LEFT');
CREATE TYPE subscription_status AS ENUM ('TRIAL','ACTIVE','PAST_DUE','CANCELLED');
CREATE TYPE student_status    AS ENUM ('CANDIDATE','ACTIVE','ON_LEAVE','GRADUATED',
                                       'DROPPED','STOPPED','TRANSFERRED','EXPELLED');
CREATE TYPE enrollment_status AS ENUM ('DRAFT','SUBMITTED','APPROVED','REJECTED',
                                       'EFFECTIVE','WITHDRAWN','CANCELLED');
CREATE TYPE grade_status      AS ENUM ('EMPTY','DRAFT','SUBMITTED','LOCKED','CORRECTING','CORRECTED');
-- display → istilah lapangan (jangan pakai boolean is_paid):
--   ISSUED=Belum Bayar · PARTIAL(paid=0)=Belum Lunas · PARTIAL(paid>0)=Bayar & Belum Lunas · PAID=Lunas
CREATE TYPE invoice_status    AS ENUM ('DRAFT','ISSUED','PARTIAL','PAID','OVERDUE','WAIVED','VOID');
CREATE TYPE payment_status    AS ENUM ('INITIATED','PENDING','SETTLED','FAILED','REFUNDED');
CREATE TYPE period_status     AS ENUM ('DRAFT','OPEN','CLOSING','CLOSED');
CREATE TYPE academic_year_term AS ENUM ('GANJIL','GENAP','ANTAR');

-- ── TENANT ──────────────────────────────────────────────────────────────────
CREATE TABLE tenants (
  id                uuid PRIMARY KEY,
  slug              text NOT NULL UNIQUE,
  legal_name        text NOT NULL,
  status            tenant_status NOT NULL DEFAULT 'ONBOARDING',
  timezone          text NOT NULL DEFAULT 'Asia/Jakarta',
  taxonomy          text,                     -- PT / Vokasi / Islam / dll (menentukan aturan)
  settings          jsonb NOT NULL DEFAULT '{}'::jsonb,   -- mfa_policy, gate_krs_payment, denda
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tenant_domains (
  id         uuid PRIMARY KEY,
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  hostname   citext NOT NULL UNIQUE,          -- portal.kampus.ac.id dsb (resolusi host → tenant)
  is_primary boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  UNIQUE (tenant_id, hostname)
);
CREATE INDEX idx_tenant_domains_tenant ON tenant_domains(tenant_id);

-- ── PACKAGING / BILLING (tier berbasis jumlah mahasiswa, lihat ARCHITECTURE §6) ──
CREATE TABLE plans (
  id              uuid PRIMARY KEY,
  code            text NOT NULL UNIQUE,       -- lite|growth|business|professional|premium|enterprise
  display_name    text NOT NULL,
  max_active_students int,                    -- NULL = unlimited (enterprise)
  entitlements    jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {"enrollment":true,"thesis":false,...}
  price_rupiah_month bigint NOT NULL CHECK (price_rupiah_month >= 0),
  is_active       boolean NOT NULL DEFAULT true
);

CREATE TABLE subscriptions (
  id             uuid PRIMARY KEY,
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  plan_id        uuid NOT NULL REFERENCES plans(id),
  status         subscription_status NOT NULL DEFAULT 'TRIAL',
  seats_student  int NOT NULL DEFAULT 0,      -- metering untuk overage & peringatan
  billing_anchor date NOT NULL,
  starts_at      timestamptz NOT NULL,
  ends_at        timestamptz,
  trial_ends_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_subscriptions_active ON subscriptions(tenant_id)
  WHERE status IN ('TRIAL','ACTIVE','PAST_DUE');   -- satu langganan aktif per tenant

CREATE TABLE tenant_quotas (      -- pencegahan noisy-neighbor: batas keras per tenant
  tenant_id    uuid PRIMARY KEY REFERENCES tenants(id),
  max_concurrent_ow_requests int NOT NULL DEFAULT 300,
  max_api_rps              int NOT NULL DEFAULT 50,
  max_storage_mb           bigint NOT NULL DEFAULT 204800,
  max_export_rows          int NOT NULL DEFAULT 100000,
  max_batch_invoice_rows   int NOT NULL DEFAULT 20000
);

CREATE TABLE tenant_usage (
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  bucket_month     date NOT NULL,             -- awal bulan
  active_students  int NOT NULL DEFAULT 0,
  api_calls        bigint NOT NULL DEFAULT 0,
  storage_bytes    bigint NOT NULL DEFAULT 0,
  jobs_run         bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, bucket_month)
);

-- ── IDENTITAS GLOBAL ────────────────────────────────────────────────────────
-- Keputusan desain: user = identitas GLOBAL (satu orang), keanggotaan per tenant.
-- Konsekuensi: dosen yang pindah/kolaborasi antar kampus tidak dibuat akun ganda,
-- dan revocation bersifat satu titik. Campus A TIDAK bisa melihat keanggotaan di B
-- (RLS pada tenant_memberships membatasi; tidak ada endpoint pencarian global).
CREATE TABLE users (
  id                uuid PRIMARY KEY,
  email             citext NOT NULL UNIQUE,
  phone             text,
  full_name         text NOT NULL,
  password_hash     text,                     -- Argon2id (+pepper); NULL bila tenant pakai IdP
  password_updated_at timestamptz,
  mfa_required      boolean NOT NULL DEFAULT false,
  status            text NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE','LOCKED','DISABLED')),
  failed_attempts   int NOT NULL DEFAULT 0,
  locked_until      timestamptz,
  last_login_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE password_history (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pw_hist ON password_history(user_id, created_at DESC);

CREATE TABLE tenant_memberships (
  id           uuid PRIMARY KEY,
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  user_id      uuid NOT NULL REFERENCES users(id),
  member_code  text,                          -- NIM untuk mahasiswa / NIP-NIDN untuk dosen
  status       member_status NOT NULL DEFAULT 'PENDING',
  joined_at    timestamptz NOT NULL DEFAULT now(),
  left_at      timestamptz,
  UNIQUE (tenant_id, user_id),
  UNIQUE (tenant_id, member_code)
);
CREATE INDEX idx_memberships_user ON tenant_memberships(user_id);

-- ── SESI & FAKTOR ───────────────────────────────────────────────────────────
CREATE TABLE sessions (
  id            uuid PRIMARY KEY,              -- = klaim `sid` di access token
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  user_id       uuid NOT NULL REFERENCES users(id),
  role_ctx      jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {assignmentId, roleId, scope…}
  auth_method   text NOT NULL,                 -- password+totp | password | oidc | passkey
  ip_hash       bytea,                         -- SHA-256(ip || daily-pepper), bukan IP mentah
  user_agent_hash bytea,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  revoked_reason text
);
CREATE INDEX idx_sessions_active ON sessions(tenant_id, user_id) WHERE revoked_at IS NULL;

CREATE TABLE refresh_tokens (
  id           uuid PRIMARY KEY,
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  user_id      uuid NOT NULL REFERENCES users(id),
  session_id   uuid NOT NULL REFERENCES sessions(id),
  token_hash   bytea NOT NULL UNIQUE,          -- SHA-256 dari opaque token
  family_id    uuid NOT NULL,                  -- reuse detection mencabut seluruh family
  rotated_from uuid REFERENCES refresh_tokens(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  revoked_at   timestamptz
);
CREATE INDEX idx_refresh_family ON refresh_tokens(family_id);

CREATE TABLE mfa_factors (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  kind        text NOT NULL CHECK (kind IN ('totp','webauthn','sms')),
  label       text,                            -- "Passkey MacBook", "Authenticator kantor"
  credential_encrypted bytea NOT NULL,          -- AES-256-GCM via KMS envelope
  verified_at timestamptz,
  last_used_at timestamptz,
  revoked_at  timestamptz
);

CREATE TABLE login_events (
  id         uuid PRIMARY KEY,
  tenant_id  uuid,                              -- NULL bila email tidak dikenal (tetap dicatat)
  user_id    uuid,
  email_attempted citext,
  outcome    text NOT NULL CHECK (outcome IN ('SUCCESS','BAD_PASSWORD','MFA_FAIL','MFA_MISSING',
                                              'LOCKED','UNKNOWN_USER','TENANT_SUSPENDED')),
  ip_hash bytea, user_agent_hash bytea, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_events_time ON login_events(occurred_at DESC);

-- ── AUTHZ: RBAC ber-scope ───────────────────────────────────────────────────
CREATE TABLE permissions (                      -- katalog global, kode stabil, tidak diubah tenant
  id    uuid PRIMARY KEY,
  code  text NOT NULL UNIQUE,                   -- 'enrollment.krs.submit'
  module text NOT NULL,                          -- 'enrollment'
  description text NOT NULL
);

CREATE TABLE roles (
  id         uuid PRIMARY KEY,
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  code       text NOT NULL,                     -- 'STUDENT','LECTURER','HEAD_OF_PROGRAM', …
  display_name text NOT NULL,
  is_system  boolean NOT NULL DEFAULT false,     -- role preset: tidak boleh dihapus tenant
  scope_kind text NOT NULL CHECK (scope_kind IN ('TENANT','ORG','PROGRAM','CLASS','PERIOD','SELF')),
  UNIQUE (tenant_id, code)
);

CREATE TABLE role_permissions (
  role_id       uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ⚑ Tabel terpenting dalam sistem ini. Satu user bisa memegang role yang sama
--   di beberapa scope, dengan masa berlaku. Role TIDAK pernah global-temporal-abadi.
CREATE TABLE user_role_assignments (
  id             uuid PRIMARY KEY,
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  user_id        uuid NOT NULL REFERENCES users(id),
  role_id        uuid NOT NULL REFERENCES roles(id),
  scope_org_id   uuid REFERENCES organizations(id),
  scope_program_id uuid REFERENCES study_programs(id),
  scope_class_id uuid REFERENCES classes(id),
  scope_period_id uuid REFERENCES academic_periods(id),
  scope_student_id uuid REFERENCES students(id),   -- untuk pembimbing/PA per mahasiswa
  valid_from     timestamptz NOT NULL DEFAULT now(),
  valid_to       timestamptz,
  assigned_by    uuid NOT NULL REFERENCES users(id),
  reason         text,
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  UNIQUE (user_id, role_id, COALESCE(scope_org_id,'00000000-0000-0000-0000-000000000000'::uuid),
          COALESCE(scope_program_id,'00000000-0000-0000-0000-000000000000'::uuid),
          COALESCE(scope_class_id,'00000000-0000-0000-0000-000000000000'::uuid),
          COALESCE(scope_period_id,'00000000-0000-0000-0000-000000000000'::uuid))
);
CREATE INDEX idx_ura_lookup ON user_role_assignments(tenant_id, user_id, role_id)
  WHERE valid_to IS NULL OR valid_to > now();

CREATE TABLE access_change_requests (           -- empat-mata: tidak ada self-escalation
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  requester_id uuid NOT NULL REFERENCES users(id),
  target_user_id uuid NOT NULL REFERENCES users(id),
  role_id uuid NOT NULL REFERENCES roles(id),
  scope jsonb NOT NULL, reason text NOT NULL CHECK (length(reason) >= 10),
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  approver_id uuid REFERENCES users(id),
  CHECK (approver_id IS NULL OR approver_id <> requester_id),   -- ⚑ self-approval mustahil di DB
  created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz
);
```

---

## 4. DDL — Audit Log, Outbox, Idempotency

```sql
-- Append-only, hash-chained, dipartisi bulanan.
CREATE TABLE audit_logs (
  id            uuid NOT NULL,
  tenant_id     uuid NOT NULL,                  -- tidak FK: tetap tersimpan bila tenant diarsip
  actor_user_id uuid,
  actor_role_ctx jsonb,
  target_entity text NOT NULL,
  target_id     uuid,
  action        text NOT NULL,                   -- 'grade.correct','invoice.void','role.assign'
  before        jsonb, after jsonb,
  reason        text,                            -- wajib untuk aksi sensitif (dienforce di app)
  request_id    uuid,
  ip_hash       bytea, user_agent_hash bytea,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  prev_hash     bytea,                           -- 32 byte
  hash          bytea NOT NULL,                  -- digest(prev_hash || canonical(payload))
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE TABLE audit_logs_2026_10 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
-- buat partisi berikutnya via job bulanan (docs/runbook/audit-partition.md)
CREATE INDEX idx_audit_tenant_time ON audit_logs(tenant_id, occurred_at DESC);
CREATE INDEX idx_audit_target      ON audit_logs(tenant_id, target_entity, target_id);

-- Proteksi: tidak ada UPDATE/DELETE, bahkan oleh pemilik tabel yang lalai.
CREATE OR REPLACE FUNCTION audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (%, % not permitted)', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END $$;
CREATE TRIGGER trg_audit_no_update BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_immutable();

-- Rantai hash TIDAK dibuat dengan trigger naif (butuh baris sebelumnya & serialisasi).
-- Implementasi benar: satu baris `audit_chain_head` per (tenant, partition) yang di-lock
-- dengan SELECT … FOR UPDATE, hash dihitung di dalamnya → penulisan berurut & tamper-evident.
CREATE TABLE audit_chain_head (
  tenant_id uuid NOT NULL, partition_start date NOT NULL,
  last_hash bytea NOT NULL, last_audit_id uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, partition_start)
);

-- Outbox: event ditulis dalam transaksi yang sama dengan perubahan domain.
CREATE TABLE outbox (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  aggregate text NOT NULL, aggregate_id uuid NOT NULL,
  event_type text NOT NULL, payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz, attempts int NOT NULL DEFAULT 0,
  last_error text
);
CREATE INDEX idx_outbox_unpublished ON outbox(occurred_at) WHERE published_at IS NULL;

-- Idempotensi untuk POST berisiko (kirim pembayaran, generate tagihan, kirim feeder).
CREATE TABLE idempotency_keys (
  tenant_id uuid NOT NULL, key text NOT NULL,
  request_fingerprint bytea NOT NULL,            -- SHA-256(method+path+body) → tolak reuse beda isi
  response_status int, response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  PRIMARY KEY (tenant_id, key)
);
```

---

## 5. DDL — Domain Akademik & Keuangan (inti, ringkas namun mengikat)

```sql
CREATE TABLE academic_years    (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  label text NOT NULL,                       -- '2025/2026'
  UNIQUE (tenant_id, label));

CREATE TABLE academic_periods  (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  academic_year_id uuid NOT NULL REFERENCES academic_years(id),
  term academic_year_term NOT NULL, status period_status NOT NULL DEFAULT 'DRAFT',
  starts_on date NOT NULL, ends_on date NOT NULL,
  CHECK (ends_on > starts_on), UNIQUE (tenant_id, academic_year_id, term));

CREATE TABLE academic_calendar_events (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, period_id uuid NOT NULL REFERENCES academic_periods(id),
  kind text NOT NULL,
    -- akademik  : 'OW_OPEN','OW_CLOSE','KRS_CUTOFF','UTS','UAS','GRADE_CUTOFF',
    --             'CORRECTION_OPEN','CORRECTION_CLOSE','YUDISIUM','WISUDA','BATCH_SHORT_TERM'
    -- keuangan  : 'BILLING_ISSUE','BILLING_DUE','PENALTY_START','WAIVER_CUTOFF'
    -- ⚑ BR-R9 (wajib, jangan sampai terlewat):
    --             'PDDIKTI_STUDY_PLAN_DUE'   ≤ 2 bulan setelah kuliah mulai
    --             'PDDIKTI_STUDY_RESULT_DUE' ≤ 2 bulan setelah kuliah selesai
    --             'PDDIKTI_BETWEEN_DUE'      ≤ 1 bulan setelah semester antara selesai
  starts_at timestamptz NOT NULL, ends_at timestamptz,
  is_mandatory boolean NOT NULL DEFAULT false,     -- agenda regulasi → tidak boleh dihapus admin
  UNIQUE (tenant_id, period_id, kind, starts_at));
CREATE INDEX idx_calendar_due ON academic_calendar_events(tenant_id, kind, starts_at);

CREATE TABLE organizations (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  parent_id uuid REFERENCES organizations(id),
  kind text NOT NULL CHECK (kind IN ('FACULTY','DEPARTMENT','UNIT','LIBRARY','HQ')),
  name text NOT NULL, code text, UNIQUE (tenant_id, code));

-- ⚑ Kolom plafon & minimum di bawah adalah PENEGAK ATURAN NASIONAL (BR-R2/R3/R4/R7).
--   Nilainya di-set otomatis dari `level`; admin hanya boleh mengencangkan (≤), bukan melonggarkan.
CREATE TABLE study_programs (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  org_id uuid REFERENCES organizations(id), name text NOT NULL, code text,
  pddikti_code text,                          -- kode prodi 5 digit (diverifikasi ke PDDIKTI, tidak ditebak)
  level text NOT NULL CHECK (level IN ('D1','D2','D3','D4','S1','S2','S3','PROFESI','SPESIALIS')),
  min_total_sks numeric(5,1) NOT NULL,        -- nasional: D1 36 · D2 72 · D3 108 · S1/D4 144 · S2 ≥36
  nominal_study_semesters int NOT NULL,       -- masa tempuh: D1 2 · D2 4 · D3 6 · S1 8 · S2 3+ · S3 6
  max_study_semesters int NOT NULL,           -- BR-R4: maks 2× masa tempuh utk penuh-waktu (S1 → 16)
  sks_cap_lower_semesters numeric(4,1) NOT NULL DEFAULT 20,   -- BR-R2: sem 1–2 ≤ 20
  sks_cap_upper_semesters numeric(4,1) NOT NULL DEFAULT 24,   -- BR-R2: sem ≥3 ≤ 24
  sks_cap_between_term numeric(4,1) NOT NULL DEFAULT 9,       -- BR-R2: semester antara ≤ 9
  graduation_min_ipk numeric(3,2) NOT NULL DEFAULT 2.00,      -- BR-R6: 2.00 sarjana/diploma, 3.00 profesi/S2/S3
  accreditation_status text CHECK (accreditation_status IN
    ('UNGGUL','BAIK_SANGAT','BAIK','CUKUP','BELUM_AKREDITASI','TIDAK_AKREDITASI','KEDALUWARSA')),
  accreditation_expires_on date,              -- ⚑ BR-R7: prodi tidak boleh meluluskan/menerbitkan ijazah
  -- Penyelenggaraan Kampus (Onsite vs Online vs Hybrid) & Kebijakan Kelas Otomatis
  delivery_mode text NOT NULL DEFAULT 'ONSITE' CHECK (delivery_mode IN ('ONSITE','ONLINE','HYBRID')),
  allow_auto_class boolean NOT NULL DEFAULT true,
  waitlist_threshold_min int NOT NULL DEFAULT 15,    -- Ambang batas antrean untuk auto-generate kelas baru
  max_parallel_classes int NOT NULL DEFAULT 4,       -- Plafon kelas paralel (A, B, C, D)
  is_active boolean NOT NULL DEFAULT true,    --   bila status/ tanggal ini tidak valid → gate menolak
  UNIQUE (tenant_id, code));

CREATE TABLE curricula (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  program_id uuid NOT NULL REFERENCES study_programs(id),
  name text NOT NULL, version int NOT NULL DEFAULT 1, effective_from date NOT NULL,
  grade_scale_id uuid REFERENCES grade_scales(id),   -- ⚑ skala nilai per kurikulum, bukan global
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, program_id, version));

CREATE TABLE courses (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  curriculum_id uuid NOT NULL REFERENCES curricula(id), code text NOT NULL, name text NOT NULL,
  sks numeric(4,1) NOT NULL CHECK (sks > 0), semester_ideal int CHECK (semester_ideal BETWEEN 1 AND 14),
  UNIQUE (tenant_id, curriculum_id, code));

CREATE TABLE course_prerequisites (
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  prerequisite_course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  prerequisite_type text NOT NULL CHECK (prerequisite_type IN ('PREREQUISITE_PASSED','PREREQUISITE_TAKEN','CO_REQUISITE')) DEFAULT 'PREREQUISITE_PASSED',
  min_grade_code text NOT NULL DEFAULT 'D',
  PRIMARY KEY (course_id, prerequisite_course_id),
  CHECK (course_id <> prerequisite_course_id));   -- anti self-prerequisite

-- Skala nilai: objek konfigurasi, bukan konstanta kode.
-- BR-R5: skala nasional A=4 B=3 C=2 D=1 E=0 (intermediate dibolehkan); **ambang lulus per matakuliah
-- ditetapkan PT** → `is_passing` ada di baris band, tidak boleh diasumsikan di kode (mis. "C = lulus").
CREATE TABLE grade_scales (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  scale_type text NOT NULL CHECK (scale_type IN ('POINT4','POINT4_WITH_MINUS','PASS_FAIL','NUMERIC_100')),
  is_national_baseline boolean NOT NULL DEFAULT false,   -- seed: A/B/C/D/E = 4/3/2/1/0
  UNIQUE (tenant_id, name));
CREATE TABLE grade_scale_bands (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, scale_id uuid NOT NULL REFERENCES grade_scales(id) ON DELETE CASCADE,
  min_score numeric(5,2) NOT NULL,                       -- batas bawah inklusif, angka mentah dosen
  letter_code text NOT NULL,                             -- 'A','A-','B+','B','C','D','E','K','T'
  point_value numeric(3,2) NOT NULL,                     -- 4.00 / 3.70 / … / 0.00
  is_passing boolean NOT NULL,
  is_default_when_blank boolean NOT NULL DEFAULT false,   -- apa yang terisi bila dosen tidak input
  CHECK (min_score >= 0 AND min_score <= 100),
  UNIQUE (scale_id, letter_code), EXCLUDE USING gist (scale_id WITH =,
    int4range(floor(min_score)::int, floor(min_score)::int) WITH &&));  -- tumpang tindih band ditolak

-- Komposisi nilai: bobot komponen. Aturan "harus 100%" ditegakkan SEBELUM input nilai dibuka.
CREATE TABLE grade_components (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  course_id uuid REFERENCES courses(id),                     -- NULL bila override per kelas (lihat class_id)
  class_id  uuid REFERENCES classes(id),                     -- NULL = default prodi; isi = override per kelas
  code text NOT NULL, name text NOT NULL,                    -- 'TUGAS','PRAKTIKUM','UTS','UAS','PROYEK'
  weight_pct numeric(5,2) NOT NULL CHECK (weight_pct BETWEEN 0 AND 100),
  is_mandatory boolean NOT NULL DEFAULT true,
  position int NOT NULL DEFAULT 1,
  CHECK (course_id IS NOT NULL OR class_id IS NOT NULL),     -- minimal salah satu harus diisi
  UNIQUE (class_id, code), UNIQUE (course_id, code)
);
-- ⚑ Tidak bisa CHECK agregat dalam tabel yang sama → ditegakkan dua arah:
--   (a) service menolak aktivasi input nilai bila SUM(weight_pct) <> 100 (AC-NIL-4),
--   (b) constraint deferrable + trigger BEFORE INSERT/UPDATE memvalidasi jumlah per grup.
-- Perubahan komposisi setelah sebagian nilai terisi → status 'RECALC_REQUIRED' + approval + audit.

-- Cekal: blokir multi-jenis yang ditegakkan pada aksi, bukan hanya ditampilkan.
CREATE TABLE blockades (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  student_id uuid NOT NULL REFERENCES students(id), period_id uuid NOT NULL REFERENCES academic_periods(id),
  kind text NOT NULL CHECK (kind IN ('ACADEMIC','FINANCE','LIBRARY','STUDENT_AFFAIRS','ADMINISTRATIVE')),
  blocks jsonb NOT NULL,            -- ["krs.view","krs.submit","krs.short_term","exam.uts","exam.uas","khs.view","yudisium","student.generate"]
  reason text NOT NULL CHECK (length(reason) >= 5),
  source_entity text, source_id uuid,          -- mis. invoice yang menunggau → taut balik
  severity text NOT NULL DEFAULT 'BLOCK' CHECK (severity IN ('WARN','BLOCK')),
  imposed_by uuid NOT NULL, lifted_by uuid, lifted_at timestamptz, lift_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (lifted_by IS NULL OR lifted_by <> imposed_by)     -- penaruh & penuntas tidak boleh orang yang sama
);
CREATE INDEX idx_blockades_active ON blockades(tenant_id, student_id, period_id) WHERE lifted_at IS NULL;

-- Aturan akademik per prodi/periode — parameter, bukan kode (BR-* di PRD)
CREATE TABLE academic_rules (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  program_id uuid NOT NULL REFERENCES study_programs(id), period_id uuid NOT NULL REFERENCES academic_periods(id),
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- {
  --  "max_sks_by_ip":[{"min_ip":3.50,"max_sks":24},{"min_ip":3.00,"max_sks":21},
  --                   {"min_ip":2.50,"max_sks":18},{"min_ip":2.00,"max_sks":15},{"min_ip":0,"max_sks":12}],
  --  "min_sks_per_semester":12, "first_semester_packed_sks":24,   -- "kuliah paket" utk maba
  --  "gates":[{"action":"krs.submit","requires":"invoice_settled"},{"action":"khs.view","requires":"survey_done"},
  --            {"action":"exam.uts","requires":["invoice_settled","attendance_min"]}],   -- ⚑ banyak gerbang, bukan satu flag
  --  "gate_blockade_kinds":["FINANCE","LIBRARY"], "late_krs_mode":"APPROVAL_REQUIRED",
  --  "penalty":{"mode":"NONE|FLAT|PERCENT_OF_TARIFF","rupiah":0,"percent":0,"grace_days":0,"frequency":"MONTHLY"},
  --  "min_attendance_pct_for_exam":75, "attendance_edit_window_days":7,
  --  "grade_correction_window_days":5, "require_survey_before_khs":true,
  --  "warning_ip_threshold":2.00,"drop_out_ip_threshold":2.00,"drop_out_consecutive_semesters":2,
  --  "thesis":{"min_sks":100,"min_ipk":2.50}, "graduation":{"min_ipk":2.00,"no_grade":"E,K"} }
  effective_from timestamptz NOT NULL DEFAULT now(), superseded_at timestamptz,
  approved_by uuid,                                  -- perubahan aturan = keputusan institusi
  UNIQUE (tenant_id, program_id, period_id, effective_from));

CREATE TABLE students (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  membership_id uuid NOT NULL REFERENCES tenant_memberships(id),
  program_id uuid NOT NULL REFERENCES study_programs(id), curriculum_id uuid REFERENCES curricula(id),
  nim text NOT NULL,      -- ⚑ TIDAK ada format NIM nasional (Ps 8i 59/2018 hanya menuntut keunikan &
                          --   stabilitas). Jangan membuat CHECK pola yang menolak data impor legacy.
  full_name text NOT NULL, entry_year int NOT NULL,
  entry_route text, status student_status NOT NULL DEFAULT 'ACTIVE',
  personal_nik_encrypted bytea,               -- field-level encryption (kelas PII sensitif)
  UNIQUE (tenant_id, nim), UNIQUE (tenant_id, membership_id));
CREATE INDEX idx_students_program ON students(tenant_id, program_id, status);

CREATE TABLE student_status_history (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, student_id uuid NOT NULL REFERENCES students(id),
  from_status student_status, to_status student_status NOT NULL,
  reason text NOT NULL, effective_on date NOT NULL, approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE classes (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  program_id uuid NOT NULL REFERENCES study_programs(id), period_id uuid NOT NULL REFERENCES academic_periods(id),
  course_id uuid NOT NULL REFERENCES courses(id), name text NOT NULL,
  capacity int NOT NULL CHECK (capacity > 0), enrolled_count int NOT NULL DEFAULT 0 CHECK (enrolled_count >= 0),
  CHECK (enrolled_count <= capacity),        -- ⚑ DB menolak over-subscribe walau aplikasi salah
  status text NOT NULL DEFAULT 'OPEN',
  -- Dukungan Dual Delivery Mode & Dynamic Auto-Class Splitting
  delivery_mode text NOT NULL DEFAULT 'ONSITE' CHECK (delivery_mode IN ('ONSITE','ONLINE_SYNC','ONLINE_ASYNC')),
  virtual_meeting_provider text CHECK (virtual_meeting_provider IN ('ZOOM','GOOGLE_MEET','TEAMS','BUILTIN_LMS')),
  virtual_meeting_url text,
  is_auto_generated boolean NOT NULL DEFAULT false,
  parent_class_id uuid REFERENCES classes(id),           -- Merujuk ke Kelas A bila terbentuk dari auto-split
  teaching_assistant_id uuid REFERENCES tenant_memberships(id), -- Tutor pendamping untuk kampus online
  UNIQUE (tenant_id, period_id, course_id, name));
CREATE INDEX idx_classes_open ON classes(tenant_id, period_id, program_id);

-- Daftar Tunggu Pengambilan Kelas Penuh (BR-A10 / AC-KRS-3)
CREATE TABLE class_waitlists (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  academic_period_id uuid NOT NULL REFERENCES academic_periods(id),
  course_id uuid NOT NULL REFERENCES courses(id),
  target_class_id uuid REFERENCES classes(id),
  student_id uuid NOT NULL REFERENCES students(id),
  queue_number integer NOT NULL,
  held_credits numeric(4,1) NOT NULL,                    -- SKS dikunci sementara mencegah over-limit
  status text NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING','PROMOTED','EXPIRED','CANCELLED')),
  promoted_class_id uuid REFERENCES classes(id),         -- Kelas baru (misal Kelas B) saat threshold tercapai
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, academic_period_id, course_id, student_id)
);
CREATE INDEX idx_waitlists_queue ON class_waitlists(tenant_id, academic_period_id, course_id, status, queue_number);

CREATE TABLE class_assignments (id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  lecturer_membership_id uuid NOT NULL REFERENCES tenant_memberships(id),
  role_in_class text NOT NULL CHECK (role_in_class IN ('COORDINATOR','LECTURER','LAB_ASSIST','EXAMINER','ADVISER')),
  UNIQUE (class_id, lecturer_membership_id, role_in_class));

-- Sesi Perkuliahan Terstruktur (Pertemuan 1 s.d. 16 - EdLink Architecture)
CREATE TABLE class_sessions (id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES classes(id), held_on date NOT NULL, seq int NOT NULL,
  topic text,
  delivery_type text NOT NULL DEFAULT 'ONSITE' CHECK (delivery_type IN ('ONSITE','SYNC_LIVE','ASYNC_MODULE')),
  virtual_room_url text,                                 -- Link Zoom/Meet pertemuan spesifik
  duration_minutes int NOT NULL DEFAULT 100,
  is_attendance_open boolean NOT NULL DEFAULT false,
  min_watch_pct int NOT NULL DEFAULT 80,                 -- Syarat tonton modul asinkron agar terhitung hadir
  UNIQUE (class_id, seq), CHECK (seq > 0));

-- Modul Pembelajaran Daring (LMS Materials, Discussions & Assignments)
CREATE TABLE lms_materials (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  session_id uuid NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  title text NOT NULL, content_type text NOT NULL CHECK (content_type IN ('VIDEO','DOCUMENT','LINK','EMBED')),
  resource_url text NOT NULL, duration_seconds int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lms_assignments (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_id uuid REFERENCES class_sessions(id),
  title text NOT NULL, instructions text NOT NULL,
  max_score numeric(5,2) NOT NULL DEFAULT 100.00,
  due_date timestamptz NOT NULL,
  grade_component_id uuid REFERENCES grade_components(id), -- Auto-sinkron ke buku nilai SIAKAD
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lms_submissions (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  assignment_id uuid NOT NULL REFERENCES lms_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id),
  file_url text NOT NULL, student_notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  score numeric(5,2), graded_by uuid REFERENCES users(id), graded_at timestamptz,
  feedback text,
  UNIQUE (assignment_id, student_id)
);

-- Ruang kuliah & laboratorium (FR-AKA-15)
CREATE TABLE rooms (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  code text NOT NULL, name text NOT NULL,
  building text NOT NULL, floor int NOT NULL DEFAULT 1,
  capacity int NOT NULL CHECK (capacity > 0),
  room_type text NOT NULL CHECK (room_type IN ('CLASSROOM','LAB','AUDITORIUM','STUDIO')),
  facilities jsonb NOT NULL DEFAULT '[]'::jsonb,   -- ['PROJECTOR','AC','AUDIO','COMPUTERS']
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, code)
);
CREATE INDEX idx_rooms_active ON rooms(tenant_id, building, is_active);

-- Penjadwalan mingguan kelas & pencegahan bentrok (AC-JDW-1)
CREATE TABLE class_schedules (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  room_id uuid REFERENCES rooms(id),
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),  -- 1=Senin ... 7=Minggu
  start_time time NOT NULL, end_time time NOT NULL,
  CHECK (end_time > start_time),
  UNIQUE (class_id, day_of_week, start_time)
);
CREATE INDEX idx_schedules_lookup ON class_schedules(tenant_id, room_id, day_of_week, start_time, end_time);
-- ⚑ Bentrok ruangan & bentrok dosen dicegah di level service transaksi + query EXCLUDE/overlap

-- Enrollment: baris yang paling sering dirusak concurrency.
CREATE TABLE enrollments (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  student_id uuid NOT NULL REFERENCES students(id), class_id uuid NOT NULL REFERENCES classes(id),
  period_id uuid NOT NULL REFERENCES academic_periods(id),
  status enrollment_status NOT NULL DEFAULT 'DRAFT',
  submitted_at timestamptz, approved_by uuid, rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(), version int NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, student_id, class_id),                    -- anti dobel ambil
  UNIQUE (tenant_id, student_id, period_id, class_id));
CREATE INDEX idx_enroll_period ON enrollments(tenant_id, period_id, student_id);

CREATE TABLE attendances (id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES class_sessions(id), student_id uuid NOT NULL REFERENCES students(id),
  present boolean NOT NULL, marked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id));

CREATE TABLE grades (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id), period_id uuid NOT NULL,
  raw_score numeric(5,2) CHECK (raw_score BETWEEN 0 AND 100),
  letter_code text, point_value numeric(3,2),
  status grade_status NOT NULL DEFAULT 'DRAFT',
  locked_at timestamptz, locked_by uuid, version int NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, enrollment_id));
CREATE INDEX idx_grades_period ON grades(tenant_id, period_id, status);

CREATE TABLE grade_corrections (id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  grade_id uuid NOT NULL REFERENCES grades(id),
  requested_by uuid NOT NULL, reason text NOT NULL CHECK (length(reason) >= 15),
  old_letter text, new_letter text, old_point numeric(3,2), new_point numeric(3,2),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','APPLIED')),
  approved_by uuid REFERENCES users(id),
  CHECK (approved_by IS NULL OR approved_by <> requested_by),   -- penolak tidak boleh peminta
  created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz);

-- ── KEUANGAN ────────────────────────────────────────────────────────────────
CREATE TABLE fee_tariff_groups (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  code text NOT NULL, name text NOT NULL,           -- 'UKT-1'…'UKT-9', 'SPP-DIKTI', 'BEASISWA'
  scheme text NOT NULL CHECK (scheme IN ('FLAT_UKT','PER_SKS','MIXED')),
  UNIQUE (tenant_id, code));

CREATE TABLE fee_components (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  program_id uuid NOT NULL REFERENCES study_programs(id),
  code text NOT NULL, name text NOT NULL,            -- 'UKT','BIAYA_SKS','UJIAN','WISUDA','KTM'
  amount_rupiah bigint NOT NULL CHECK (amount_rupiah >= 0),
  applies_to_term academic_year_term,                -- NULL = kedua term
  valid_from date NOT NULL, valid_to date, version int NOT NULL DEFAULT 1,
  approved_by uuid NOT NULL,                          -- ⚑ perubahan tarif selalu ada penyetuju
  UNIQUE (tenant_id, program_id, code, valid_from));

CREATE TABLE invoices (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  student_id uuid NOT NULL REFERENCES students(id), period_id uuid NOT NULL REFERENCES academic_periods(id),
  number text NOT NULL, status invoice_status NOT NULL DEFAULT 'DRAFT',
  issued_at timestamptz, due_at timestamptz NOT NULL,
  total_rupiah bigint NOT NULL DEFAULT 0 CHECK (total_rupiah >= 0),
  paid_rupiah bigint NOT NULL DEFAULT 0 CHECK (paid_rupiah >= 0),
  generation_run_id uuid,                             -- audit batch & jaminan idempotensi
  waived_reason text, void_reason text, voided_by uuid, version int NOT NULL DEFAULT 0,
  CHECK (paid_rupiah <= total_rupiah),
  UNIQUE (tenant_id, number), UNIQUE (tenant_id, student_id, period_id));
CREATE INDEX idx_invoices_status ON invoices(tenant_id, period_id, status, due_at);

CREATE TABLE invoice_items (id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES fee_components(id),
  quantity numeric(6,2) NOT NULL DEFAULT 1, amount_rupiah bigint NOT NULL,
  UNIQUE (invoice_id, component_id));

CREATE TABLE payments (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  provider text NOT NULL,                             -- 'doku','mandiri_va','qris','manual'
  provider_ref text NOT NULL,                         -- ⚑ unique → replay/`webhook` ganda tertahan
  va_number_encrypted bytea,
  amount_rupiah bigint NOT NULL CHECK (amount_rupiah > 0),
  status payment_status NOT NULL DEFAULT 'INITIATED',
  idempotency_key text NOT NULL, settled_at timestamptz,
  raw_callback jsonb, recorded_by uuid,               -- untuk rekonsiliasi manual
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, provider_ref), UNIQUE (tenant_id, idempotency_key));

-- Cicilan: satu invoice bisa dipecah; status invoice mengikuti akumulasi, bukan flag manual.
CREATE TABLE invoice_installments (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, invoice_id uuid NOT NULL REFERENCES invoices(id),
  seq int NOT NULL CHECK (seq > 0),
  due_on date NOT NULL, amount_rupiah bigint NOT NULL CHECK (amount_rupiah > 0),
  paid_rupiah bigint NOT NULL DEFAULT 0 CHECK (paid_rupiah >= 0),
  CHECK (paid_rupiah <= amount_rupiah), UNIQUE (invoice_id, seq)
);
-- Deposit: saldo prepaid milik mahasiswa, dipakai mesin tagih saat lunas (vektor rekonsiliasi!).
CREATE TABLE deposits (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, student_id uuid NOT NULL REFERENCES students(id),
  amount_rupiah bigint NOT NULL CHECK (amount_rupiah <> 0),   -- top-up +, pemakaian -
  kind text NOT NULL CHECK (kind IN ('TOPUP','APPLIED','REFUND','REVERSAL')),
  reference_id uuid, created_at timestamptz NOT NULL DEFAULT now(), recorded_by uuid NOT NULL
);
CREATE INDEX idx_deposit_student ON deposits(tenant_id, student_id, created_at DESC);

CREATE TABLE ledger (                                 -- append-only; koreksi = reversing entry
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, invoice_id uuid NOT NULL REFERENCES invoices(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  entry_type text NOT NULL CHECK (entry_type IN ('CHARGE','PAYMENT','WAIVER','PENALTY','REVERSAL')),
  amount_rupiah bigint NOT NULL CHECK (amount_rupiah <> 0),   -- bertanda: +/-
  reference_id uuid, reason text,
  sequence bigserial NOT NULL);
CREATE INDEX idx_ledger_invoice ON ledger(invoice_id, sequence);

CREATE TABLE payment_waivers (id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  invoice_id uuid NOT NULL REFERENCES invoices(id), amount_rupiah bigint NOT NULL CHECK (amount_rupiah > 0),
  basis text NOT NULL,                              -- 'BEASISWA','KERINGANAN','KESALAHAN_ADMIN'
  requested_by uuid NOT NULL, approved_by uuid NOT NULL,
  CHECK (approved_by <> requested_by), created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE clearances (id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES students(id), period_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('FINANCE','LIBRARY','LAB','ADMINISTRATION')),
  passed boolean NOT NULL DEFAULT false, checked_at timestamptz, evidence jsonb,
  UNIQUE (tenant_id, student_id, period_id, kind));

-- Rekaman Kelulusan & Yudisium (FR-AKA-13, BR-R6, BR-R7, BR-R12)
CREATE TABLE graduation_records (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  student_id uuid NOT NULL REFERENCES students(id),
  period_id uuid NOT NULL REFERENCES academic_periods(id),
  decree_number text NOT NULL,                       -- Nomor SK Yudisium Dekan/Rektor
  graduation_date date NOT NULL,
  total_sks numeric(5,1) NOT NULL CHECK (total_sks >= 36),
  final_gpa numeric(3,2) NOT NULL CHECK (final_gpa BETWEEN 0 AND 4),
  predicate text NOT NULL,                           -- 'CUMLAUDE','SANGAT_MEMUASKAN','MEMUASKAN' (BR-R6)
  national_diploma_number text,                      -- Nomor PIN / PISN (Permenristekdikti 59/2018)
  pddikti_reported_at timestamptz,
  is_locked boolean NOT NULL DEFAULT true,           -- BR-R12: arsip kelulusan permanen & immutable
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, student_id),                    -- satu kelulusan per mahasiswa per jenjang
  UNIQUE (tenant_id, decree_number, student_id)
);
CREATE INDEX idx_grad_period ON graduation_records(tenant_id, period_id, graduation_date);

-- ── PDDIKTI ─────────────────────────────────────────────────────────────────
CREATE TABLE pddikti_mappings (id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  entity text NOT NULL,                             -- 'mahasiswa','kelas','nilai','dosen','riwayat'
  local_field text NOT NULL, pddikti_field text NOT NULL, transform jsonb,
  active_version int NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, entity, local_field, active_version));
CREATE TABLE pddikti_sync_runs (id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  period_id uuid NOT NULL, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
  total_rows int, accepted_rows int, rejected_rows int, error_breakdown jsonb,
  status text NOT NULL DEFAULT 'VALIDATING'
    CHECK (status IN ('VALIDATING','READY','PARTIAL','SENT','FAILED')),
  dry_run boolean NOT NULL DEFAULT true,            -- ⚑ tidak pernah menulis ke PDDIKTI tanpa dry-run
  operator_id uuid NOT NULL);
```

-- ── KEWAJIBAN REGULATORI (BR-R7 / R9 / R10 / R12 / R15) ────────────────────
-- BR-R10: data PDDikti tidak dapat dihapus; ubah semester lalu butuh persetujuan kementerian.
-- Karena itu "ubah data periode lampau" BUKAN edit — ia objek kerja ber-status.
CREATE TABLE period_reopen_requests (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  period_id uuid NOT NULL REFERENCES academic_periods(id),
  reason text NOT NULL CHECK (length(reason) >= 15),
  affected_actions jsonb NOT NULL,            -- ["grade.correct","enrollment.add", …]
  requested_by uuid NOT NULL, approved_by uuid,
  ministry_reference text,                    -- nomor persetujuan PDDikti bila disyaratkan
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED','EXPIRED','USED')),
  opens_at timestamptz, closes_at timestamptz,   -- window sempit: reopened bukan berarti "selamanya"
  CHECK (approved_by IS NULL OR approved_by <> requested_by),
  created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE pddikti_correction_requests (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, sync_run_id uuid REFERENCES pddikti_sync_runs(id),
  entity text NOT NULL, local_record_id uuid NOT NULL,
  rejection_code text, rejection_message text,
  proposed_fix jsonb, status text NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','FIXED','RESUBMITTED','ACCEPTED','ABANDONED')),
  resolved_by uuid, resolved_at timestamptz,
  UNIQUE (tenant_id, entity, local_record_id, rejection_code));

-- BR-R12: rekaman kelulusan adalah arsip negara/kampus → disimpan sebagai snapshot final.
-- Nilai tidak "dibiarkan hidup"; nilai dibekukan supaya transkrip 20 tahun lagi bisa direkonstruksi
-- persis, termasuk bila kurikulum atau skala nilai berubah setelahnya.
CREATE TABLE graduation_records (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  student_id uuid NOT NULL REFERENCES students(id),
  conferred_on date NOT NULL, ipk_final numeric(3,2) NOT NULL,
  honors text,                                  -- predikat: parameter PT (BR-R6), bukan tabel nasional
  total_sks numeric(5,1) NOT NULL,
  diploma_number text,                          -- PIN 15 digit: prodi(5)+tahun(4)+urut(5)+checksum(1)
  pin_batch_id uuid,                            -- generate dibatasi per batch (praktik PISN ≤1.000)
  pisn_verification_ref text,                   -- verifikasi PISN/SIVIL = pengesahan (BR-R8)
  snapshot jsonb NOT NULL,                      -- transkrip definitif: mk, sks, huruf, titik
  snapshot_hash bytea NOT NULL,                 -- digest → bukti dokumen tidak berubah
  program_accreditation_at_conferment text NOT NULL,  -- ⚑ bukti BR-R7 terpenuhi saat lulus
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, student_id));
-- TIDAK ada UPDATE/DELETE untuk sica_app pada tabel ini; koreksi = catatan baru berversi + alasan.

CREATE TABLE document_signatures (              -- BR-R15: TTE tersertifikasi (PSrE/BSSN)
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, document_kind text NOT NULL,
  document_ref uuid NOT NULL, provider text NOT NULL, provider_signature_id text,
  signer_user_id uuid NOT NULL, signed_at timestamptz NOT NULL,
  digest_hash bytea NOT NULL, certificate_serial text, validation_evidence jsonb);

CREATE TABLE data_processing_bases (            -- UU PDP Ps 20(2): dasar pemrosesan, per kategori
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, category text NOT NULL,
  basis text NOT NULL CHECK (basis IN ('LEGAL_OBLIGATION','CONTRACT','CONSENT','VITAL_INTEREST')),
  purpose text NOT NULL, jra_ref text,           -- acuan Jadwal Retensi Arsip kampus
  consent_withdrawable boolean NOT NULL DEFAULT (basis = 'CONSENT'),
  last_reviewed_at timestamptz);

CREATE TABLE retention_rules (                  -- JRA-driven, BUKAN angka hardcode di kode
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  data_class text NOT NULL,                       -- 'graduation_record','status_change_note','app_log', …
  retention text NOT NULL,                        -- 'PERMANENT','P10Y','P5Y','P90D' (ISO 8601 duration)
  disposition text NOT NULL CHECK (disposition IN ('KEEP','ARCHIVE','ANONYMIZE','DESTROY')),
  legal_basis text, is_locked boolean NOT NULL DEFAULT false,   -- BR-R12: permanen tidak boleh diturunkan
  approved_by uuid);

CREATE TABLE data_subject_requests (            -- hak subjek: akses, salinan, koreksi, keberatan (Ps 6–12)
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, requester_membership_id uuid,
  kind text NOT NULL, status text NOT NULL DEFAULT 'RECEIVED',
  received_at timestamptz NOT NULL DEFAULT now(), responded_by_due timestamptz,
  completed_at timestamptz, outcome text, handler_id uuid, notes text);

---

## 6. Row-Level Security

### 6.1 Helper (fail-closed)
```sql
CREATE OR REPLACE FUNCTION app.tenant_id() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION app.user_id() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$;

-- NULL bila tidak diset → perbandingan `tenant_id = NULL` → NULL → policy TIDAK terpenuhi
-- → akses DITOLAK. Tidak pernah ada default "melihat semua".
```

### 6.2 Penerapan (generator: jalankan untuk SEMUA tabel domain, tanpa kecuali)
```sql
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.table_schema, c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables  x ON x.table_name = c.table_name
                                     AND x.table_schema = c.table_schema
    WHERE c.table_name = 'tenant_id' AND x.table_type = 'BASE TABLE'
      AND c.table_schema IN ('public')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', t.table_schema, t.table_name);
    EXECUTE format('ALTER TABLE %I.%I FORCE  ROW LEVEL SECURITY', t.table_schema, t.table_name);
    EXECUTE format($f$CREATE POLICY tenant_isolation ON %I.%I
        AS PERMISSIVE FOR ALL TO sica_app
        USING      (tenant_id = app.tenant_id())
        WITH CHECK (tenant_id = app.tenant_id())$f$, t.table_schema, t.table_name);
  END LOOP;
END $$;
```
Catatan penting:
- **`FORCE ROW LEVEL SECURITY`** diperlukan karena pemilik tabel kebal terhadap RLS secara default — tanpa FORCE, akun migrasi yang lupa di-`SET ROLE` bisa membaca seluruh tenant.
- `WITH CHECK` mencegah **penulisan** lintas tenant, bukan hanya pembacaan (kasus: admin memindahkan `student_id` ke tenant lain lewat payload).
- Bacaan lintas-tenant platform (agregat pemakaian) **tidak** lewat policy ini — dibuat sebagai view khusus + `GRANT SELECT` ke `sica_platform` dengan policy sendiri, tanpa akses baris domain.
- Tabel kamus global (`plans`, `permissions`) tidak punya `tenant_id` → di-`RLS OFF` + `GRANT SELECT` saja.

### 6.3 Peran database
```sql
CREATE ROLE sica_app     NOLOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER;  -- API & worker
CREATE ROLE sica_owner   NOLOGIN BYPASSRLS;                          -- migrasi saja (CI)
CREATE ROLE sica_readonly NOLOGIN NOBYPASSRLS;                       -- dashboard/report replica
CREATE ROLE sica_platform NOLOGIN NOBYPASSRLS;                       -- agregat lintas tenant
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sica_app;
GRANT INSERT, SELECT ON audit_logs TO sica_app;      -- tanpa UPDATE/DELETE
REVOKE ALL ON audit_logs           FROM sica_readonly, sica_platform;
REVOKE UPDATE, DELETE, TRUNCATE ON ledger FROM sica_app;   -- ledger hanya INSERT
```
Aplikasi **tidak pernah** memakai satu kredensial serbaguna. API & worker = `sica_app`; migrasi = `sica_owner` (hanya di pipeline, kredensial terpisah, tidak ada di runtime).

---

## 7. Indeks, Partisi, Retensi

```sql
-- Concurrency & integritas
CREATE UNIQUE INDEX uq_memberships_active ON tenant_memberships(tenant_id, member_code)
  WHERE status <> 'LEFT';
-- anti dobel KRS periode lalu/berjalan sudah tercakup di enrollments
CREATE INDEX idx_enroll_class_slot ON enrollments(class_id, status);   -- rekap kuota
CREATE INDEX idx_grades_pending    ON grades(tenant_id, period_id, status)
  WHERE status IN ('DRAFT','SUBMITTED');                                -- laporan nilai terlambat
CREATE INDEX idx_invoices_overdue  ON invoices(tenant_id, due_at)
  WHERE status IN ('ISSUED','PARTIAL','OVERDUE');                       -- penagihan
```
| Kebijakan | Nilai | Catatan |
|---|---|---|
| Partisi | `audit_logs` per bulan; `enrollments`, `attendances`, `grades`, `invoices`, `payments` per `period_id` (RANGE) | retensi & vacuum ringan; query periode berjalan tidak menyentuh sejarah |
| Retensi rekaman kelulusan | ijazah, transkrip, SKPI, `graduation_records`: **permanen** (BR-R12) | arsip ini satu-satunya dasar hukum surat pengganti & pengesahan fotokopi; `retention_rules.is_locked = true` |
| Retensi catatan status | cuti / DO / pindah / stop: **floor 5 tahun** (rujukan Perka ANRI 13/2014) lalu musnah **hanya bila JRA kampus mengizinkan** | angka ANRI adalah *floor sectoral*; JRA yang disetujui ANRI-lah yang mengikat — jangan pakai angka ini sebagai izin memusnahkan transkrip |
| Retensi nilai & tagihan | mengikuti JRA institusi; default aman: permanen untuk nilai, ≥10 th untuk dokumen tagihan | sengketa keuangan bisa muncul bertahun-tahun kemudian |
| Retensi audit | ≥5 tahun (SOC2/ISO + audit internal kampus) | ekspor ke storage immutable tiap bulan |
| Retensi log app | 30–90 hari, ter-redaksi | jangan menyimpan body PII |
| Retensi session/token | baris `sessions` & `refresh_tokens` di-purge setelah `expires_at` + 7 hari | untuk forensik singkat |
| PITR/backup | WAL arsip + snapshot harian; retensi snapshot ≥35 hari; **rekaman akademik di backup terpisah ber-retain lama** | benchmark pasar: backup 3×/hari, retensi 90 hari — cukup untuk operasional, tidak cukup untuk rekaman akademik |

---

## 8. Query Verifikasi (dipakai sebagai tes CI, bukan dokumentasi)

```sql
-- 1) RLS benar-benar menolak tanpa tenant context → harus 0 baris, bukan error, bukan semua baris
BEGIN;  -- tanpa SET LOCAL app.tenant_id
  SELECT count(*) FROM students;             -- ⚑ hasil harus 0
ROLLBACK;

-- 2) Kebijakan menolak tulis lintas tenant → harus gagal
BEGIN; SET LOCAL app.tenant_id = '<tenant_A>';
  INSERT INTO invoices (id, tenant_id, student_id, period_id, number, due_at)
  VALUES (gen_random_uuid(), '<tenant_B>', '<student_of_A>', '<p>', 'X', now()+interval '1 day');
  -- ⚑ expected: violates WITH CHECK → ERROR
ROLLBACK;

-- 3) Enrollment tidak bisa menembus kuota, walau aplikasi lupa cek
BEGIN; SET LOCAL app.tenant_id = '<tenant_A>';
  INSERT INTO enrollments (id, tenant_id, student_id, class_id, period_id)
  VALUES (gen_random_uuid(), '<tenant_A>', '<s>', '<full_class>', '<p>');
  -- ⚑ expected: CHECK enrolled_count<=capacity / trigger lock menunda
ROLLBACK;

-- 4) Audit log tidak dapat diubah dari peran aplikasi
SET ROLE sica_app; DELETE FROM audit_logs WHERE true;   -- ⚑ expected: insufficient_privilege
```

```sql
-- 5) CI gate: tidak ada tabel domain tanpa RLS (harus mengembalikan 0 baris)
SELECT c.relname FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' AND c.relkind='r'
  AND EXISTS (SELECT 1 FROM pg_attribute a
              WHERE a.attrelid=c.oid AND a.attname='tenant_id')
  AND c.relrowsecurity = false;
```
Tiga query yang **harus mengembalikan 0 baris** di setiap PR yang menyentuh migrasi: tabel tanpa RLS, tabel `tenant_id` tanpa index `(tenant_id, …)` pada kolom yang di-query, dan policy tanpa `WITH CHECK` untuk tabel dengan INSERT.

---

## 9. Seed Minimum (bootstrap tenant baru, transaksi tunggal + audit)

```sql
BEGIN;
SET LOCAL app.tenant_id = '<baru>';
INSERT INTO roles (id, tenant_id, code, display_name, scope_kind, is_system) VALUES
  ('…','<baru>','STUDENT','Mahasiswa','SELF',true),
  ('…','<baru>','LECTURER','Dosen Pengampu','CLASS',true),
  ('…','<baru>','ADVISER','Dosen PA','PERIOD',true),
  ('…','<baru>','HEAD_OF_PROGRAM','Kaprodi','PROGRAM',true),
  ('…','<baru>','ADMIN_ACADEMIC','Admin Akademik','ORG',true),
  ('…','<baru>','ADMIN_FINANCE','Admin Keuangan','TENANT',true),
  ('…','<baru>','FINANCE approver','Bendahara','TENANT',true),
  ('…','<baru>','LEADER','Pimpinan','ORG',true),
  ('…','<baru>','FEEDER_OPERATOR','Operator Feeder','TENANT',true),
  ('…','<baru>','ALUMNI','Alumni','SELF',true);
-- role_permissions mengikuti katalog PERM di packages/domain (sumber kebenaran yang sama)
-- academic_rules diisi default dari template + WAJIB direview admin PT sebelum OW pertama.
COMMIT;
```

---

## 10. Status Cakupan & Rencana Tabel Lanjutan

| # | Item / Domain | Catatan Kebutuhan & Implikasi Skema | Target Fase | Status |
|---|---|---|---|---|
| 1 | **Tabel Phase 2 Ekosistem** | PMB, CBT, Bimbingan TA/Skripsi, MBKM, SPMI/Akreditasi, Kepegawaian (BKD/SISTER), Litabmas, Seremoni Wisuda, dan SKPI dwibahasa | Phase 2 (Sprint 9–16) | 📋 Backlog |
| 2 | **Proyeksi Turunan Definitif** | Keputusan persistensi IP, IPK, KHS, dan piutang. Hasil final disimpan definitif (immutable snapshot) di `academic_results` / `transcripts`; hitung ulang hanya diizinkan via workflow koreksi resmi | Phase 1 (Sprint 4) | 🟡 In Design |
| 3 | **Data Dictionary & PII Catalog** | Spesifikasi field-level (~90 kolom), tipe data presisi, aturan enkripsi (KMS field-level), dan masking UI untuk data sensitif UU PDP | Phase 1 (Sprint 2) | 🟡 In Progress |
| 4 | **Strategi Migrasi Data Legacy** | Script & staging table migrasi dari portal lama: pemetaan kolom, rekonsiliasi NIM, penanganan status K historis, dan rollback verification | Phase 1 (Sprint 3) | 🟡 In Design |
| 5 | **Format Nomor & Penomoran Lokal** | Format NIM per kampus (disimpan di `tenant_settings`), format nomor SK/surat, dan pemetaan Jadwal Retensi Arsip (JRA) per tenant | Phase 1 (Sprint 2) | 🟡 In Design |
| 6 | **Sinkronisasi Neo Feeder 2026/2027** | Verifikasi dictionary API Neo Feeder Kemendiktisaintek terbaru, operational window, dan endpoint batch sync | Phase 1 (Sprint 5) | 📋 Backlog |
| 7 | **Metrik IKU 1 & Tracer Study** | Struktur field kuesioner tracer: masa tunggu kerja, band gaji vs UMP, kategori pemberi kerja, dan kelanjutan studi (Kepmendiktisaintek 358/M/KEP/2026) | Phase 2 (Sprint 12) | 📋 Backlog |

---

## 11. Addendum Kelengkapan Field Data (Audit Sevima/PDDikti Neo Feeder, 2026-10-18)

Bagian ini menutup **celah field data** yang ditemukan saat membandingkan `students`/`courses`/`attendances` di §5 dan skema Drizzle (`packages/database/src/schema/*.ts`) terhadap **standar entitas wajib Neo Feeder PDDikti** (SIVIL) & Sevima SIAKAD Enterprise. Temuan: banyak atribut **regulatori wajib** belum tersimpan sama sekali, dan **tidak ada tabel master Dosen/Tendik**. Ini bukan fitur Phase 2 — tanpa field ini, pelaporan nasional (BR-R9/R10) **mustahil** dan data legacy tidak bisa diimpor lengkap.

### 11.1 Temuan Celah Field (doc + kode)

| # | Entitas | Field wajib PDDikti/Sevima yang HILANG | Dampak bila tak dilengkapi |
|---|---|---|---|
| G-01 | `students` | `jenis_kelamin`, `tempat_lahir`, `tanggal_lahir`, `kewarganegaraan`, `agama`, `anak_ke`, `no_hp`, `email_pribadi`, `sumber_dana`, `foto_url`, `id_pd` (PDDikti), `nisn`, `npsn_asal`, `jalur_masuk_kode` | Gagal validasi pra-kirim feeder mahasiswa; impor legacy hilang kolom |
| G-02 | `students` (alamat) | `alamat`, `kode_pos`, `kode_provinsi`, `kode_kabupaten`, `kode_kecamatan`, `kode_kelurahan` (Kode Wilkemendagri) | PDDikti butuh alamat + kode wilayah; Dapodik-lik |
| G-03 | `students` (ortu) | `nama_ayah`, `nama_ibu`, `pekerjaan_ayah`, `pekerjaan_ibu`, `penghasilan_ayah`, `penghasilan_ibu`, `tanggungan_ayah`, `tanggungan_ibu` | Atribut ekonomi keluarga = field wajib feeder & beasiswa |
| G-04 | **Dosen (TIDAK ADA TABEL)** | seluruh: `nidn`, `nuptk`, `kode_dosen_pd`, `gelar_depan/belakang`, `jabatan_fungsional`, `golongan_penat`, `rumpun_ilmu`, `homebase`, `status_kepegawaian`, `pendidikan_terakhir`, `tgl_lahir`, `agama`, `sex`, `tmt_angkat`, `kebutuhan_khusus`, `negara_asal`, `nomor_sertifikasi` | Feeder dosen, BKD/SISTER (FR-SDM), KTM dosen — tidak dapat diimplementasi |
| G-05 | Tendik/staf (TIDAK ADA) | `nip`, `nama_peg`, `unit_kerja`, `jabatan_struktural`, `golongan`, `status_pegawai` | Pelaporan SDM & akreditasi (jumlah tendik/mahasiswa) |
| G-06 | `courses` | `sks_teori`, `sks_praktik`, `sks_praktik_kerja`, `sks_lab`, `course_type` (WAJIB/PILIHAN/MULOK), `bahasa_pengantar`, `kode_rumpun`, `id_pd` | Feeder **memecah SKS per jenis** — kolom `sks` tunggal tidak cukup |
| G-07 | `attendances` | `status` (HADIR/IZIN/SAKIT/ALPHA terlambat), `meeting_seq`, `method` (QR/GPS/MANUAL), `latitude`, `longitude`, `accuracy_m`, `is_mock_location`, `device_id` | Presensi saat ini hanya boolean → tidak dapat merekam &/atau laporan akreditasi (kehadiran per pertemuan) & audit anti-fraud |
| G-08 | `enrollments` / riwayat akademik | `akademic_status_kode` (1 AKTIF/2 TDK AKTIF/3 DO/4 PINDAH/5 LULUS), `ip_per_periode`, `sps_kumulatif`, `id_pd` | Feeder "Riwayat Akademik" butuh status kode + IP per periode |
| G-09 | `tenants`/`organizations`/`study_programs` (kode feeder) | `kode_pt_pddikti`, `nomor_sk_pt`, `tgl_berdiri`, `nama_kepala`, `alamat_pt`, `kode_fakultas_pd`, `nomor_sk_prodi`, `kode_gelar` | Pemetaan entitas→kode nasional (`pddikti_mappings`) tidak punya sumber nilai |

### 11.2 DDL Penambahan — Biodata Mahasiswa & Ortu (PII)
```sql
CREATE TYPE sex_type AS ENUM ('M','F');
CREATE TYPE income_band AS ENUM ('LEB_300','L300_500','L500_1JT','L1_2JT','GT_2JT','TIDAK_BERWORK');

-- Penambahan kolom pada students (pecah dari blok agar mudah di-migrate)
ALTER TABLE students
  ADD COLUMN sex           sex_type,
  ADD COLUMN birth_place   text,
  ADD COLUMN birth_date    date,
  ADD COLUMN citizenship   text NOT NULL DEFAULT 'WNI',        -- 'WNI' / 'WNA:<negara>'
  ADD COLUMN religion      text CHECK (religion IN ('ISLAM','KRISTEN','KATOLIK','HINDU','BUDDHA','KONGHU','ALIRAN_KREDIT','TIDAK_ADA')),
  ADD COLUMN child_order   int CHECK (child_order > 0),
  ADD COLUMN mobile_phone  text,
  ADD COLUMN personal_email citext,
  ADD COLUMN funding_source text CHECK (funding_source IN ('MANDIRI','BEASISWA','BIA_ADIK','KERJA_SAMA','LAIN')),
  ADD COLUMN photo_url     text,                               -- utk KTM digital
  ADD COLUMN pddikti_id_pd uuid,                                -- id_pd dari SIVIL (diisi pasca-sinkron)
  ADD COLUMN nisn          text,
  ADD COLUMN feeder_status_code text NOT NULL DEFAULT '1'       -- status akademik aktif saat ini (G-08)
    CHECK (feeder_status_code IN ('1','2','3','4','5'));

-- Alamat & wilayah (Kode Wilkemendagri) — dipisah agar dapat di-enkripsi/masking per kolom
CREATE TABLE student_addresses (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  student_id uuid NOT NULL REFERENCES students(id),
  kind text NOT NULL CHECK (kind IN ('DOMICILE','ORIGIN','INVOICE')),
  address text, postal_code text,
  province_code text, regency_code text, district_code text, village_code text,
  is_preferred boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, student_id, kind)
);
CREATE INDEX idx_student_addr ON student_addresses(tenant_id, student_id);

-- Orang tua / penanggung (field ekonomi wajib feeder & dasar beasiswa/UKT)
CREATE TABLE student_guardians (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  student_id uuid NOT NULL REFERENCES students(id),
  relation text NOT NULL CHECK (relation IN ('AYAH','IBU','WALI')),
  full_name text NOT NULL, birth_date date,
  education text, occupation_code text, occupation_name text,
  income_band income_band, income_rupiah bigint CHECK (income_rupiah >= 0),
  phone text, email citext,
  is_financial_guarantor boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, student_id, relation)
);
```

### 11.3 DDL Baru — Master Dosen & Tendik (menutup G-04/G-05)
```sql
CREATE TYPE lecturer_job_rank AS ENUM
  ('GURU_BESAR','LEKTOR_KEPALA','LEKTOR','ASISTEN_AHLI','TENAGA_PENGAJAR','NONE');
CREATE TYPE employment_type AS ENUM
  ('PNS','PPPK_PENUH','PPPK_PARUH','DOSEN_TETAP_YAYASAN','DOSEN_LUAR_BIASA','DOSEN_TIDAK_TETAP','TENAGA_HONORER');

-- Satu dosen = 1 user global + 1 keanggotaan tenant; tabel ini MENAMBAH atribu feeder, bukan pengganti users.
CREATE TABLE lecturers (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  membership_id uuid NOT NULL REFERENCES tenant_memberships(id),
  program_id uuid REFERENCES study_programs(id),      -- homebase prodi (default)
  nidn text,                                          -- Nomor Induk Dosen Nasional (NIDN)
  nuptk text,                                         -- utk sertifikasi/BKD
  pddikti_id_dosen uuid,                              -- id_pd dosen dari SIVIL
  code text,                                          -- kode dosen internal kampus
  title_prefix text, title_suffix text,               -- gelar depan & belakang
  specialization text,                                -- bidang keahlian
  academic_rank lecturer_job_rank NOT NULL DEFAULT 'NONE',
  employment_type employment_type NOT NULL DEFAULT 'DOSEN_TETAP_YAYASAN',
  is_primary_lecturer boolean NOT NULL DEFAULT true,  -- homebase vs dosen luar biasa
  homebase_org_id uuid REFERENCES organizations(id),
  science_cluster text,                               -- rumpun ilmu (kode rumpun SISTER)
  last_degree_country text, last_degree_university text, last_degree_year int,
  start_service_date date,                            -- TMT
  gender sex_type, birth_place text, birth_date date, religion text, nationality text DEFAULT 'WNI',
  disability_type text,                               -- kebutuhan khusus (feeder)
  mobile_phone text, official_email citext, address text,
  certifier_number text, certification_date date,     -- no. sertifikat pendidik
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, membership_id),
  CHECK (nidn IS NULL OR length(nidn) BETWEEN 8 AND 20)
);
CREATE INDEX idx_lecturer_nidn ON lecturers(tenant_id, nidn) WHERE nidn IS NOT NULL;
CREATE INDEX idx_lecturer_homebase ON lecturers(tenant_id, homebase_org_id);

-- Tenaga kependidikan (FR-SDM, rasio akreditasi)
CREATE TABLE staff (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  membership_id uuid NOT NULL REFERENCES tenant_memberships(id),
  org_id uuid REFERENCES organizations(id),
  nip text, code text, full_name text NOT NULL,
  position_type text CHECK (position_type IN ('STRUKTURAL','FUNGSIONAL','TERTENTU')),
  structural_title text, functional_title text,
  employment_type employment_type NOT NULL DEFAULT 'TENAGA_HONORER',
  education_last text, start_date date, gender sex_type, birth_date date,
  mobile_phone text, official_email citext,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, membership_id)
);
```

### 11.4 DDL Penambahan — Course (SKS per jenis), Attendance (status), Feeder codes
```sql
ALTER TABLE courses
  ADD COLUMN sks_theory int NOT NULL DEFAULT 0 CHECK (sks_theory >= 0),
  ADD COLUMN sks_practice int NOT NULL DEFAULT 0 CHECK (sks_practice >= 0),
  ADD COLUMN sks_field_work int NOT NULL DEFAULT 0 CHECK (sks_field_work >= 0),  -- praktik kerja/lapangan
  ADD COLUMN sks_lab int NOT NULL DEFAULT 0 CHECK (sks_lab >= 0),
  ADD COLUMN course_type text NOT NULL DEFAULT 'WAJIB'
    CHECK (course_type IN ('WAJIB','PILIHAN','MUATAN_LOKAL','MPK')),
  ADD COLUMN medium_language text NOT NULL DEFAULT 'ID',   -- 'ID' | 'EN' | 'AR'
  ADD COLUMN science_cluster text,
  ADD COLUMN pddikti_id_mk uuid;
-- Konsistensi: sks = sks_theory+sks_practice+sks_field_work+sks_lab → ditegakkan service + trigger.

CREATE TYPE attendance_status AS ENUM ('PRESENT','EXCUSED','SICK','ABSENT_LATE','ABSENT');
ALTER TABLE attendances
  ADD COLUMN status attendance_status NOT NULL DEFAULT 'PRESENT',
  ADD COLUMN method text NOT NULL DEFAULT 'QR' CHECK (method IN ('QR','GPS','MANUAL','ONLINE_WATCH')),
  ADD COLUMN latitude double precision, longitude double precision,
  ADD COLUMN accuracy_m numeric(6,1),
  ADD COLUMN is_mock_location boolean NOT NULL DEFAULT false,
  ADD COLUMN device_id text;
-- 'present' boolean lama didepresikan (turunan dari status) — migrasi map boolean->enum.

-- Kode feeder entitas institusi (sumber nilai utk pddikti_mappings)
ALTER TABLE tenants
  ADD COLUMN pddikti_code_pt text,          -- kode PT 6 digit (diverifikasi, bukan ditebak)
  ADD COLUMN establishment_decree text,      -- nomor SK pendirian PT
  ADD COLUMN founded_on date,
  ADD COLUMN leader_name text,               -- rektor/direktur/pimpinan
  ADD COLUMN province_code text, regency_code text, address text,
  ADD COLUMN accreditation_institution text
    CHECK (accreditation_institution IN ('UNGGUL','BAIK_SANGAT','BAIK','CUKUP','BELUM','TIDAK_AKREDITASI','KEDALUWARSA'));
ALTER TABLE organizations   ADD COLUMN pddikti_id_fakultas uuid;
ALTER TABLE study_programs  ADD COLUMN establishment_decree text, ADD COLUMN degree_code text;
-- study_programs.pddikti_code (sudah ada) kini menjadi target pemetaan; degree_code = kode gelar kementerian.
```

### 11.5 Catatan Defek DSK Dokumen (AUD-09)
§5 mendefinisikan `CREATE TABLE graduation_records` **dua kali** (blok pertama sederhana + blok kedua dengan `snapshot_hash`, `pin_batch_id`, `pisn_verification_ref`). Dua `CREATE TABLE` dengan nama yang sama membuat replay migrasi **gagal**. Keputusan arsitek: blok kedua menjadi definitif; blok pertama dihapus/di-`ALTER` (kolom `decree_number`,`predicate`,`national_diploma_number` digabung ke `graduation_records` definitif). Perlu direfaktori pada §5 sebelum skema Drizzle `schema/graduation.ts` dibuat.

### 11.6 Konsekuensi ke Lapis Kontrak & UI
- `packages/contracts` perlu `StudentBiodataSchema`, `LecturerSchema`, `AttendanceStatusSchema` agar form registrasi/biodata punya **field lengkap** (Guardrail §3.3, §3.5).
- `UI_UX_DESIGN.md`: form biodata mahasiswa & dosen wajib menampilkan field di §11.2–11.4 dengan masking PII (NIK/alamat) sesuai `SECURITY_COMPLIANCE.md`; KTM digital memakai `students.photo_url`.
- **Status implementasi (audit field-data 2026-10-18):**
  - ✅ Drizzle diselaraskan: `schema/people.ts` (lecturers/staff/addresses/guardians), biodata `students`, **`attendances`** (G-07: `status`, `source`, `latitude/longitude`, `distance_meters`, `is_mock_location`, `marked_by`, `notes`), **`courses`** (G-06 parsial: `sks_teori`, `sks_praktik`, `course_type`). Enum `attendance_source`/`course_type` baru.
  - ✅ Kontrak Zod: `packages/contracts/src/attendance.ts` (`AttendanceStatusSchema`, `AttendanceSourceSchema`, `CourseTypeSchema`, `AttendanceRecordSchema`, `MarkAttendanceSchema`, `CourseSksSchema`) + `packages/contracts/src/people.ts` (`StudentBiodataSchema`, `StudentGuardianSchema`, `LecturerSchema`, `SexSchema`, `LecturerJobRankSchema`, `EmploymentTypeSchema`, `IncomeBandSchema`, `FundingSourceSchema`) — keduanya teruji.
  - ✅ Migrasi ditulis: `migrations/0005_field_data_attendance_courses.sql` (expand-only, idempoten) — belum dieksekusi (butuh DB).
  - ⏳ Sisa: kolom feeder institusi (`kode_pt`/`kode_prodi`/`id_pd`), `courses.sks_praktik_kerja`/`sks_lab`/`bahasa_pengantar`/`kode_rumpun`, `attendances.meeting_seq`/`device_id`/`accuracy_m`, migrasi+RLS tabel `people`, dan form UI (§11.2–11.4).


---

## 12. Entitlement Modul & Gerbang Add-on (SaaS Multi-tenant)

**Masalah produk:** kampus boleh membeli sebagian modul — "SIAKAD saja" (PMB/LMS OFF), "SIAKAD + LMS saja", dsb. Perlu model *packaging* yang **data-driven** (tanpa fork kode) + **gerbang (gating)** agar modul yang tidak dibeli tidak muncul & tidak dapat diakses.

**Prinsip:** semua tabel modul **tetap ada** di skema walau modul OFF (baris kosong tidak mengganggu). Yang berubah hanyalah: (a) status aktif per tenant, (b) visibilitas menu, (c) izin endpoint. Ini **modular-monolith**, bukan microservice terpisah.

### 12.1 Skema (di-implementasi di `packages/database/src/schema/modules.ts` — terverifikasi `tsc`)
```sql
CREATE TYPE module_category        AS ENUM ('CORE','ADDON');
CREATE TYPE module_license_metric  AS ENUM ('INCLUDED','PER_SEAT','FLAT');
CREATE TYPE tenant_module_status   AS ENUM ('ACTIVE','TRIAL','DISABLED','EXPIRED','PENDING_PAYMENT');

-- Katalog modul GLOBAL (tanpa tenant_id → RLS OFF, GRANT SELECT ke sica_app)
CREATE TABLE modules (
  id uuid PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL,
  category module_category NOT NULL, is_core boolean NOT NULL DEFAULT false,
  license_metric module_license_metric NOT NULL DEFAULT 'INCLUDED',
  description text, icon text, sort_order int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now());

-- Graf dependensi antar modul (addon butuh prasyarat)
CREATE TABLE module_dependencies (
  id uuid PRIMARY KEY,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  depends_on_module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  is_required boolean NOT NULL DEFAULT true,
  UNIQUE (module_id, depends_on_module_id));

-- Pemetaan paket → modul (packaging yang bisa di-query)
CREATE TABLE plan_modules (
  id uuid PRIMARY KEY, plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  included boolean NOT NULL DEFAULT true, seat_limit int, price_rupiah_month bigint,
  UNIQUE (plan_id, module_id));

-- Activation per-tenant (TENANT-SCOPED → RLS + FORCE, seperti tabel domain lain)
CREATE TABLE tenant_modules (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE RESTRICT,
  status tenant_module_status NOT NULL DEFAULT 'ACTIVE',
  seats int, valid_from timestamptz NOT NULL DEFAULT now(), valid_to timestamptz,
  activated_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, module_id));
```
RLS: `tenant_modules` ikut generator §6.2 (punya `tenant_id` → ENABLE+FORCE+policy `tenant_isolation`). `modules`/`module_dependencies`/`plan_modules` = katalog global → `RLS OFF` + `GRANT SELECT` saja (mirip `plans`/`permissions`).

### 12.2 Katalog Modul (seed) & Keputusan Core vs Addon
| code | category | is_core | license | keterangan |
|---|---|---|---|---|
| `identity` | CORE | true | INCLUDED | Auth, tenant, RBAC scoped |
| `academic` | CORE | true | INCLUDED | Master data (prodi/kurikulum/MK/periode/ruang) |
| `teaching` | CORE | true | INCLUDED | Kelas, penjadwalan, penugasan dosen |
| `enrollment` | CORE | true | INCLUDED | KRS + approval DPA + kuota |
| `attendance` | CORE | true | INCLUDED | Presensi QR/GPS |
| `assessment` | CORE | true | INCLUDED | Nilai, KHS, transkrip, IPS/IPK |
| `finance` | CORE | true | INCLUDED* | Tagih/bayar/ledger/cekal (gerbang KRS) |
| `feeder_pddikti` | CORE | true | INCLUDED* | Kepatuhan pelaporan nasional |
| `audit` | CORE | true | INCLUDED | Audit trail append-only |

> `*` **finance** & **feeder_pddikti** default ON namun **dapat dinonaktifkan per tenant**: kampus ber-sistem keuangan sendiri → `finance` DISABLED dan gerbang KRS memakai *feed status lunas eksternal* (webhook/import). Feeder bisa OFF utk PT non-pelapor, tetapi **disarankan ON**.

**ADDON (default OFF, opt-in):**
| code | butuh prasyarat (module_dependencies) | license |
|---|---|---|
| `pmb` | identity, academic | FLAT |
| `cbt` | identity, academic | FLAT |
| `lms` | teaching, enrollment | PER_SEAT |
| `mbkm` | enrollment, assessment, academic | FLAT |
| `thesis` | enrollment, assessment | PER_SEAT |
| `spmi` | academic, assessment, feeder_pddikti | FLAT |
| `hr_bkd` | identity, teaching | PER_SEAT |
| `parent_portal` | enrollment, assessment, finance | INCLUDED |
| `graduation` | assessment, feeder_pddikti | FLAT |
| `tracer_iku` | graduation, feeder_pddikti | FLAT |

### 12.3 Aturan validasi enablement (ditegakkan di service, bukan DB)
1. Modul `is_core=true` **selalu** dibuat `tenant_modules(ACTIVE)` saat provision tenant.
2. Menambah addon: **wajib** semua `depends_on_module_id` sudah `ACTIVE`/`TRIAL` untuk tenant itu; jika tidak → `422 MODULE_DEPENDENCY_UNMET`.
3. Menonaktifkan modul: **wajib** tidak ada modul lain yang aktif bergantung padanya → `409 MODULE_IN_USE` (cascade eksplisit bila dipaksa + audit).
4. `status ∈ {DISABLED,EXPIRED,PENDING_PAYMENT}` → dianggap **tidak aktif** oleh resolver.
5. Perubahan `tenant_modules` = write finansial/akademik sensitif → **audit_log** + (opsional) `access_change_requests` four-eyes untuk self-service > limit paket.

### 12.4 Resolver (sumber kebenaran runtime)
`isModuleActive(tenantId, moduleCode) := EXISTS tenant_modules WHERE tenant_id, module.code, status IN ('ACTIVE','TRIAL') AND (valid_to IS NULL OR valid_to > now())`. Di-cache per tenant (Redis/TTL 60s), di-invalidate saat `tenant_modules` berubah. Lihat ARCHITECTURE ADR-06 & TECH_CONVENTIONS.

---

## 13. Read/Write Splitting & Composite Indexing (High-Concurrency)

Selaras ARCHITECTURE §9. Tujuannya: memisahkan beban **baca jadwal/KRS/dashboard** yang sangat sering ke **replica**, agar **Primary** fokus pada **mutasi** (enrollment, nilai, tagihan, presensi) — prasyarat menahan 1.000+ concurrent users.

### 13.1 Topologi koneksi
| Peran | Endpoint (via PgBouncer) | Dipakai oleh | Aturan |
|---|---|---|---|
| **Primary (WRITE)** | `pg-primary:5432` | semua `INSERT/UPDATE/DELETE`, transaksi akademik/keuangan | satu-satunya target write; RLS `FORCE` aktif |
| **Replica (READ-ONLY)** | `pg-replica{1..n}:5432` | query read: roster/jadwal, dashboard, transkrip, report, pencarian | hanya `SET TRANSACTION READ ONLY`; **tanpa** tulis |

Replikasi **streaming asynchronous** + `hot_standby=on`. **RLS tetap berlaku di replica** — kebijakan & `app.tenant_id` ikut ter-replikasi, sehingga pemisahan read tidak melonggarkan isolasi tenant.

### 13.2 Routing (koneksi mana untuk query mana)
- **Default → Primary.** Route ke replica **hanya** query **read-only, non-transaksional, dan toleran staleness**.
- **Staleness budget:** replica lag target `< 100ms` normal, `< 500ms` saat OW-war. Query yang **harus membaca tulisannya sendiri** (read-your-writes) — mis. cek kuota SKS tepat sebelum submit, status `tenant_modules` pasca-aktivasi, hasil KRS sesaat setelah submit — **WAJIB ke Primary**. Diimplementasi via `db.$primary()` vs `db.$replica()`; router menolak replica bila `inTransaction()` atau `requiresFreshRead`.
- **Kunci: semua jalur MUTASI KRS/nilai/keuangan tak pernah menyentuh replica.**

```ts
// pseudocode router
const tx = db.transaction();            // → Primary
if (q.kind === 'read' && !tx && q.tolerantStale) use replica; else use primary;
```

### 13.3 Composite Indexing untuk query frekuensi tinggi
Prinsip urutan kolom indeks: **kolom equality → range → ORDER/cover**; `INCLUDE` utk kolom proyeksi (hindari heap fetch). RLS menyaring `tenant_id`, sehingga **`tenant_id` selalu jadi kolom pertama** pada indeks domain.

| Query panas (API) | Pola WHERE | Indeks (CONCURRENTLY) |
|---|---|---|
| `GET krs/open-classes` (daftar kelas periode+prodi + sesi) | `classes WHERE tenant_id=? AND period_id=? AND program_id IN (...)` | `CREATE INDEX CONCURRENTLY idx_classes_lookup ON classes(tenant_id, period_id, program_id, status);` |
| join jadwal per kelas | `class_schedules WHERE tenant_id=? AND class_id=ANY(...)` order day,start | `CREATE INDEX CONCURRENTLY idx_sched_class ON class_schedules(tenant_id, class_id, day_of_week, start_time) INCLUDE (end_time, room_id);` |
| cek bentrok ruang (jadwal) | overlap `room_id, day_of_week, time` | `EXCLUDE USING gist` per ruang (lihat `class_schedules`) + `idx_schedules_lookup(tenant_id, room_id, day_of_week, start_time, end_time)` |
| "jadwal hari ini" mahasiswa | `enrollments ⋈ classes ⋈ class_schedules` filter `tenant, student, day_of_week` | `CREATE INDEX CONCURRENTLY idx_enroll_student ON enrollments(tenant_id, student_id, period_id, status) INCLUDE (class_id);` |
| roster dosen per kelas | `class_assignments WHERE tenant_id, lecturer_membership_id` | `CREATE INDEX CONCURRENTLY idx_assign_lect ON class_assignments(tenant_id, lecturer_membership_id, role_in_class);` |
| nilai/KHS per periode | `grades WHERE tenant_id, period_id, enrollment_id` | `idx_grades_period(tenant_id, period_id, status)` (ada) + `uq` enrollment; tambah `INCLUDE (letter_code, point_value)` bila dashboard sering proyeksi |
| presensi per sesi | `attendances WHERE tenant_id, session_id` (+student) | `CREATE INDEX CONCURRENTLY idx_attend_session ON attendances(tenant_id, session_id) INCLUDE (student_id, status);` |
| waitlist promotion | `class_waitlists ... (tenant, period, course, status, queue_number)` | sudah di §5; **partial** `WHERE status='WAITING'` untuk pangkas ukuran |
| tagihan overdue (bendahara) | `invoices WHERE tenant_id, status IN (...) AND due_at<?` | `idx_invoices_status` (partial, sudah) — pertahankan |
| session/revocation auth | `sessions WHERE tenant_id,user_id AND revoked_at IS NULL` | `idx_sessions_active` (partial, sudah di §3) |

**Catatan operasional:**
- Semua `CREATE INDEX` **`CONCURRENTLY`** (non-blocking) — lihat DEPLOYMENT_DEVOPS §2.2.
- Tabel besar dipartisi per `period_id`/bulan (§7) → indeks **lokal per partisi**; scan hanya partisi aktif saat OW.
- Hindari **over-indexing** pada tabel write-heavy (`enrollments`, `grades`, `attendances`, `ledger`): tiap indeks menambah biaya `INSERT/UPDATE`. Audit utilisasi via `pg_stat_user_indexes.idx_scan` (buang yang tak pernah dipakai).
- `EXPLAIN (ANALYZE, BUFFERS)` tiap jalur panas jadi gate CI (regresi plan → PR ditolak).

### 13.4 Kuota atomic di Redis (ringkas) — lihat ARCHITECTURE §10
Kapasitas kursi/kuota SKS saat OW **tidak** dibaca/ditulis per-request ke DB (mencegah row-lock). Sumber kebenaran runtime = Redis Lua atomic; DB (`enrollments`, `classes.enrolled_count`) hanyalah **finalis** via worker. `enrolled_count` dijaga `CHECK (enrolled_count <= capacity)` + job reconcile periodik (proyeksi konsisten).


