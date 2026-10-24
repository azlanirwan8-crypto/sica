-- 0012_audit_outbox.sql — gugus audit & outbox (M-05/M-01)
-- Sumber kebenaran DDL: DATA_MODEL.md §3 (login_events), §4.1 (audit_logs + audit_chain_head),
-- §4.2 (outbox, idempotency_keys); pola RLS §6.2; pola insert-only §16.3.3.
-- Prasyarat seluruh state machine (I-1): setiap perpindahan keadaan menulis satu baris audit.
-- Expand-only. Reversibel: DROP balik manual (lihat MIGRATION_SOP §5.1).
--
-- Pernyataan verifikasi (MIGRATION_SOP §5.4 butir 4 — jalankan setelah apply):
--   SELECT count(*) FROM pg_class WHERE relname IN ('audit_logs','audit_chain_head','outbox',
--         'idempotency_keys','login_events') AND relkind IN ('r','p');            -- harus = 5
--   SELECT count(*) FROM pg_tables WHERE tablename LIKE 'audit_logs_%';           -- harus >= 6 (partisi 2026-10..2027-03)
--   SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='audit_logs';  -- t/t
--   UPDATE audit_logs SET action='x' WHERE 1=1;                                   -- ERROR insufficient_privilege (AC-AUD-1)
--   SELECT polname FROM pg_policies WHERE tablename IN ('outbox','idempotency_keys','audit_chain_head'); -- 3x tenant_isolation

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;

-- ── 1. login_events — jejak percobaan login (§3:272) ─────────────────────────────────
-- tenant_id boleh NULL: email/tenant tidak dikenal tetap dicatat (§4.9 UU PDP: hash, bukan plaintext).
CREATE TABLE IF NOT EXISTS login_events (
  id              uuid PRIMARY KEY,
  tenant_id       uuid,
  user_id         uuid,
  email_attempted citext,
  outcome         text NOT NULL CHECK (outcome IN ('SUCCESS','BAD_PASSWORD','MFA_FAIL','MFA_MISSING',
                                                   'LOCKED','UNKNOWN_USER','TENANT_SUSPENDED')),
  ip_hash         bytea,
  user_agent_hash bytea,
  occurred_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_events_time ON login_events(occurred_at DESC);

-- login_events TIDAK masuk generator §6.2 (kolom tenant_id nullable → WITH CHECK generator
-- akan menolak baris NULL). Policy eksplisit mengikuti pola §16.3.3: tulis boleh ber-tenant
-- NULL (percobaan tak terkenali), baca hanya milik tenant konteks.
ALTER TABLE login_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_events FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS le_insert ON login_events;
CREATE POLICY le_insert ON login_events AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (tenant_id IS NULL OR tenant_id = app.tenant_id());
DROP POLICY IF EXISTS le_read ON login_events;
CREATE POLICY le_read ON login_events AS PERMISSIVE FOR SELECT TO public
  USING (tenant_id = app.tenant_id());

-- ── 2. audit_logs — append-only, hash-chained, dipartisi bulanan (§4.1) ───────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id              uuid NOT NULL,
  tenant_id       uuid NOT NULL,                 -- tidak FK: tetap tersimpan bila tenant diarsip
  actor_user_id   uuid,
  actor_role_ctx  jsonb,
  target_entity   text NOT NULL,
  target_id       uuid,
  action          text NOT NULL,                 -- 'grade.correct','invoice.void','role.assign'
  before          jsonb,
  after           jsonb,
  reason          text,                          -- wajib untuk aksi sensitif (dienforce di service)
  request_id      uuid,
  ip_hash         bytea,
  user_agent_hash bytea,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  prev_hash       bytea,                         -- 32 byte
  hash            bytea NOT NULL,                -- digest(prev_hash || canonical(payload))
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- Partisi menutup kuartal berjalan + satu kuartal ke depan; job bulanan (runbook DEPLOYMENT_DEVOPS §4,
-- tugas tercatat DATA_MODEL §16.6) melanjutkan. Gerbang CI §8 nomor 10 menolak bulan tanpa partisi.
DO $$
DECLARE
  d date := date '2026-10-01';
  stmt text;
BEGIN
  WHILE d < date '2027-04-01' LOOP
    stmt := format(
      'CREATE TABLE IF NOT EXISTS audit_logs_%s PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L)',
      to_char(d, 'YYYY_MM'), d, (d + interval '1 month')::date);
    EXECUTE stmt;
    d := (d + interval '1 month')::date;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON audit_logs(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target      ON audit_logs(tenant_id, target_entity, target_id);

-- Dinding pertama: HAK (AC-AUD-1 nyata di DB, bukan mock). Toleran managed DB: role boleh tak ada.
DO $$ BEGIN
  REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM sica_app;
  GRANT  INSERT, SELECT           ON audit_logs TO sica_app;
EXCEPTION WHEN others THEN RAISE NOTICE 'grant audit_logs sica_app dilewati (managed DB): %', SQLERRM; END $$;

-- Dinding terakhir (menjangkau owner/CI/BYPASSRLS): pemicu. Berlaku untuk seluruh partisi anak.
CREATE OR REPLACE FUNCTION audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (%, % not permitted)', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END $$;
DROP TRIGGER IF EXISTS trg_audit_no_update ON audit_logs;
CREATE TRIGGER trg_audit_no_update BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_immutable();

-- RLS untuk tabel INDUK partisi dipasang eksplisit (generator §6.2 tidak menyentuh relkind 'p'),
-- bentuk mengikuti blok `audit_logs` di DATA_MODEL §6.2: PERMISSIVE, nama tenant_isolation, TO public.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON audit_logs;
CREATE POLICY tenant_isolation ON audit_logs AS PERMISSIVE FOR ALL TO public
  USING (tenant_id = app.tenant_id()) WITH CHECK (tenant_id = app.tenant_id());

-- Kepala rantai hash: satu baris per (tenant, partisi), di-lock SELECT ... FOR UPDATE oleh emitter
-- sehingga penulisan berurut & tamper-evident (bukan trigger naif — alasan tercatat §4.1).
CREATE TABLE IF NOT EXISTS audit_chain_head (
  tenant_id       uuid NOT NULL,
  partition_start date NOT NULL,
  last_hash       bytea NOT NULL,
  last_audit_id   uuid NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, partition_start)
);

-- ── 3. outbox — peristiwa ditulis satu transaksi dengan perubahan domain (§4.2) ───────
CREATE TABLE IF NOT EXISTS outbox (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL,
  aggregate     text NOT NULL,
  aggregate_id  uuid NOT NULL,
  event_type    text NOT NULL,
  payload       jsonb NOT NULL,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz,
  attempts      int NOT NULL DEFAULT 0,
  last_error    text
);
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox(occurred_at) WHERE published_at IS NULL;

-- ── 4. idempotency_keys — POST berisiko (kirim pembayaran, generate tagihan, feeder) ──
CREATE TABLE IF NOT EXISTS idempotency_keys (
  tenant_id           uuid NOT NULL,
  key                 text NOT NULL,
  request_fingerprint bytea NOT NULL,            -- SHA-256(method+path+body) → tolak reuse beda isi
  response_status     int,
  response_body       jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  completed_at        timestamptz,
  PRIMARY KEY (tenant_id, key)
);

-- ── 5. RLS (bentuk generator §6.2 / keputusan K-2: PERMISSIVE, nama tenant_isolation, TO public) ──
ALTER TABLE audit_chain_head ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_chain_head FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON audit_chain_head;
CREATE POLICY tenant_isolation ON audit_chain_head AS PERMISSIVE FOR ALL TO public
  USING (tenant_id = app.tenant_id()) WITH CHECK (tenant_id = app.tenant_id());

ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON outbox;
CREATE POLICY tenant_isolation ON outbox AS PERMISSIVE FOR ALL TO public
  USING (tenant_id = app.tenant_id()) WITH CHECK (tenant_id = app.tenant_id());

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON idempotency_keys;
CREATE POLICY tenant_isolation ON idempotency_keys AS PERMISSIVE FOR ALL TO public
  USING (tenant_id = app.tenant_id()) WITH CHECK (tenant_id = app.tenant_id());

COMMIT;
