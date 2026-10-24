import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const T = 'docs/DATA_MODEL.md';
let text = readFileSync(T, 'utf8');
const must = (needle, value, label) => {
  const n = text.split(needle).length - 1;
  if (n !== 1) { console.error('MERAH - jangkar ' + label + ' cocok ' + n + ' kali. Berkas tidak ditulis.'); process.exit(1); }
  text = text.replace(needle, value);
};

const block = [
'#### 14.3.3 Alur perubahan hak empat-mata — `access_change_requests` (M-03, migrasi `0082`)',
'',
'Blok kanonik tabel ini tetap §3 (dibuat bersama `0011_rbac_scoped.sql`). Yang ditambahkan di sini adalah **kosakata yang hilang**: tanpa `request_kind`, tabel hanya dapat menyatakan "beri peran" dan tidak dapat menyatakan "cabut peran" atau "ubah scope" — padahal ketiganya adalah perubahan hak yang sama-sama menuntut empat-mata (FR-ADM-06). Migrasi `0082_access_request_kind.sql` bersifat *expand-only*: kolom baru `NOT NULL DEFAULT \'GRANT\'` dapat ditulis sebelum kode lama berhenti; penghapusan default dilakukan pada siklus kontrak setelah seluruh pemanggil menulis jenisnya.',
'',
'```sql',
"-- 0082_access_request_kind.sql — kosakata jenis perubahan + penjaga empat-mata kedua (M-03)",
"CREATE TYPE access_request_kind AS ENUM ('GRANT','REVOKE','SCOPE_CHANGE');",
'',
'ALTER TABLE access_change_requests',
"  ADD COLUMN request_kind access_request_kind NOT NULL DEFAULT 'GRANT',",
'  ADD COLUMN decision_reason text;',
'',
'-- Penolakan wajib beralasan; keputusan terminal tidak boleh dibuka kembali.',
'ALTER TABLE access_change_requests',
"  ADD CONSTRAINT chk_acr_decision_reason",
"    CHECK (status <> 'REJECTED' OR (decision_reason IS NOT NULL AND length(decision_reason) >= 10)) NOT VALID,",
"  ADD CONSTRAINT chk_acr_approver_not_target",
"    CHECK (approver_id IS NULL OR approver_id <> target_user_id) NOT VALID;",
'',
'-- Satu permintaan PENDING per (tenant, target, role, jenis, scope). Dua admin yang mengajukan',
'-- hal yang sama tidak boleh menghasilkan dua baris yang masing-masing dapat disetujui.',
'CREATE UNIQUE INDEX uq_acr_pending_scope',
'  ON access_change_requests (tenant_id, target_user_id, role_id, request_kind, md5(scope::text))',
"  WHERE status = 'PENDING';",
'',
'-- Setelah backfill baris lama (decision_reason dari audit_logs bila ada):',
'-- ALTER TABLE access_change_requests VALIDATE CONSTRAINT chk_acr_decision_reason;',
'-- ALTER TABLE access_change_requests VALIDATE CONSTRAINT chk_acr_approver_not_target;',
'```',
'',
'**Vonis model.** (a) `request_kind` adalah kelas A (kosakata tertutup) — bukan kamus yang dapat dirawat kampus, karena ia mengubah mesin state persetujuan; (b) `SCOPE_CHANGE` memakai kolom `scope jsonb` yang sudah ada, sehingga tidak ada tabel kedua untuk penugasan ber-scope; (c) pencabutan **tidak** menghapus baris `user_role_assignments`: ia menulis `valid_to`/status lewat service yang sama, dan baris permintaan tetap tersimpan sebagai bukti; (d) `data_subject_requests` (DSAR, §23) **bukan** tabel ini dan tidak pernah memakai izin `identity.accessrequest.*` — pemisahan itu ditegakkan di [RBAC_MATRIX.md](file:///c:/SICA/docs/RBAC_MATRIX.md) §4.5.6 dan celah `G-31`; (e) RLS `ENABLE` + `FORCE` + policy `tenant_id = current_setting(\'app.current_tenant\')::uuid` wajib ikut di `0082`, dengan `sica_app` `NOBYPASSRLS`; (f) approval hanya sah bila `approver_id` berbeda dari `requester_id` **dan** `target_user_id`, serta sesi penyetuju ber-MFA (FR-IDT-01).',
'',
'**State machine.** `PENDING → APPROVED | REJECTED`; terminal tidak dapat diputus ulang (`409 DECISION_ALREADY_MADE`, 55). Permintaan `PENDING` yang targetnya sudah tidak aktif, role-nya sudah dihapus, atau scope-nya tidak lagi subset scope penyetuju ditolak saat keputusan — bukan dibiarkan menggantung. Idempotensi keputusan memakai `Idempotency-Key` + status baris, bukan `UPDATE` buta.',
'',
'',
];
must(NL + '### 14.4 Matriks izin (FR-IDT-04) — padanan konkret dari model Sevima',
  NL + block.join(NL) + '### 14.4 Matriks izin (FR-IDT-04) — padanan konkret dari model Sevima', 'heading 14.4');

if (!/0082_access_request_kind\.sql/.test(text) || !/request_kind/.test(text)) {
  console.error('MERAH - blok 14.3.3 tidak lengkap.'); process.exit(1);
}
writeFileSync(T, text, 'utf8');
console.log('HIJAU - DATA_MODEL: 14.3.3 + migrasi 0082 (request_kind, decision_reason, unique pending, checks) ditulis.');
