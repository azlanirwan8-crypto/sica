-- 0084_mfa_hardening.sql — penyelarasan mfa_factors ke kanonik + tantangan MFA sekali-pakai
-- Sumber: DATA_MODEL §3 (amandemen 2026-10-23), API_SPEC §2.3 baris 144 syarat pencabutan 501,
-- penutup SEC-14 (mfa_factors tanpa tenant_id/RLS). Registry: MIGRATION_SOP §5.2.
-- KEJUJURAN: `credential_encrypted bytea` hari ini menyimpan secret base32 MENTAH. Pembungkusan
-- AES-256-GCM menunggu KMS/`0035` (`TENANT_ENCRYPTION_MASTER_KEY` belum ada di env) — dilarang
-- menyebut kolom ini terenkripsi sebelum pembungkusan nyata.
-- Expand-only (drop `secret`/`is_primary` = kontraksi kolom yang belum dibaca kode mana pun;
-- diukur via grep `factor_type|is_primary|\.secret` di apps/web + packages sebelum menulis ini).
--
-- Pernyataan verifikasi:
--   SELECT column_name FROM information_schema.columns WHERE table_name='mfa_factors'
--     ORDER BY column_name;   -- credential_encrypted, id, kind, label, last_used_at, revoked_at,
--                             --   tenant_id, user_id, verified_at  (TANPA secret/is_primary/factor_type)
--   SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('mfa_factors','mfa_challenges'); -- t/t
--   SELECT count(*) FROM pg_policies WHERE tablename IN ('mfa_factors','mfa_challenges');  -- >= 2

BEGIN;

-- ── 1. mfa_factors → bentuk kanonik §3 ──────────────────────────────────────────────
ALTER TABLE mfa_factors RENAME COLUMN factor_type TO kind;

ALTER TABLE mfa_factors ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE mfa_factors ADD COLUMN IF NOT EXISTS last_used_at timestamptz;
ALTER TABLE mfa_factors ADD COLUMN IF NOT EXISTS revoked_at  timestamptz;
ALTER TABLE mfa_factors ADD COLUMN IF NOT EXISTS tenant_id   uuid;

-- Backfill tenant dari keanggotaan pertama; baris tanpa keanggotaan tidak punya pemilik
-- dan tidak boleh tersisa setelah kolom jadi NOT NULL (diukur: 0 baris di DB dev).
UPDATE mfa_factors m
SET tenant_id = (
  SELECT tm.tenant_id FROM tenant_memberships tm
  WHERE tm.user_id = m.user_id
  ORDER BY tm.joined_at NULLS LAST, tm.id
  LIMIT 1
)
WHERE m.tenant_id IS NULL;
DELETE FROM mfa_factors WHERE tenant_id IS NULL;

DO $$ BEGIN
  ALTER TABLE mfa_factors ALTER COLUMN tenant_id SET NOT NULL;
  ALTER TABLE mfa_factors ADD CONSTRAINT mfa_factors_tenant_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE mfa_factors ADD CONSTRAINT mfa_factors_kind_check
    CHECK (kind IN ('totp','webauthn','sms'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- secret text → credential_encrypted bytea (isi dipindah utuh, base32 apa adanya — lihat kepala).
ALTER TABLE mfa_factors ADD COLUMN IF NOT EXISTS credential_encrypted bytea;
UPDATE mfa_factors SET credential_encrypted = convert_to(secret, 'UTF8') WHERE credential_encrypted IS NULL;
ALTER TABLE mfa_factors ALTER COLUMN credential_encrypted SET NOT NULL;
ALTER TABLE mfa_factors DROP COLUMN IF EXISTS secret;
ALTER TABLE mfa_factors DROP COLUMN IF EXISTS is_primary;

ALTER TABLE mfa_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_factors FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON mfa_factors;
CREATE POLICY tenant_isolation ON mfa_factors AS PERMISSIVE FOR ALL TO public
  USING (tenant_id = app.tenant_id()) WITH CHECK (tenant_id = app.tenant_id());

-- ── 2. mfa_challenges — tantangan sekali-pakai (syarat ke-4 baris 144) ───────────────
CREATE TABLE IF NOT EXISTS mfa_challenges (
  id             uuid PRIMARY KEY,
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  user_id        uuid NOT NULL REFERENCES users(id),
  challenge_hash text NOT NULL UNIQUE,            -- SHA-256(hex random), bukan token mentah
  factor_id      uuid REFERENCES mfa_factors(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  consumed_at    timestamptz,
  attempts       int NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  outcome        text NOT NULL DEFAULT 'PENDING' CHECK (outcome IN ('PENDING','SUCCESS','FAILED','EXPIRED')),
  CHECK (expires_at > created_at),
  CHECK (expires_at <= created_at + interval '10 minutes')
);
CREATE INDEX IF NOT EXISTS idx_mfa_challenges_user ON mfa_challenges(user_id, created_at DESC);

ALTER TABLE mfa_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_challenges FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON mfa_challenges;
CREATE POLICY tenant_isolation ON mfa_challenges AS PERMISSIVE FOR ALL TO public
  USING (tenant_id = app.tenant_id()) WITH CHECK (tenant_id = app.tenant_id());

COMMIT;
