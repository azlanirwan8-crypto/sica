// Cetak sekali `migrations/0093_rbac_revoke_it_business_grants.sql` dari diff terukur
// grant TENANT_ADMIN sebelum/sesudah pemotongan batas R-2 (PROGRESS_REPORT §5.85).
// Simpan keluaran sebagai teks commit; skrip ini tidak dijalankan ulang oleh pipeline.
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const before = [...new Set(readFileSync(join(root, '.tools/_ta_before.txt'), 'utf8').split(/\r?\n/).filter(Boolean))];
const after = [...new Set(readFileSync(join(root, '.tools/_ta_after.txt'), 'utf8').split(/\r?\n/).filter(Boolean))];
const revoked = before.filter((code) => !after.includes(code)).sort();

const HEADER = `-- 0093: Batas R-2 ditegakkan — cabut grant bisnis dari Admin IT dan antrean hak dari DPO.
--
-- Sumber norma (terukur 2026-10-24):
--   * RBAC_MATRIX §2 baris 78: "NIM/SKS/presensi memerlukan pemilik domain, KRS/nilai/
--     pembayaran tidak diwariskan" dan "grant lama yang lebih luas dan self-service lisensi
--     adalah gap migrasi (§6.8), bukan sudah dicabut".
--   * RBAC_MATRIX §6.8 baris 1790/1798/1805: label administrator tidak mengizinkan
--     KRS/nilai/pembayaran; R-2 tidak membuat lisensi/seats/expiry; binding Feeder tidak
--     otomatis \`feeder.period.send\`.
--   * RBAC_MATRIX §6.1 + §4.5 baris 351-352 + vonis §9.5: \`COMPLIANCE_OFFICER\` bukan
--     pemegang \`identity.accessrequest.*\` (penutup \`G-31\`).
--   * RBAC_MATRIX §4.5 baris 317: \`identity.impersonation.grant\` khusus R-1; baris 318
--     membiarkan \`.revoke\` untuk tenant sendiri.
--
-- Ini langkah "inventaris + cabut" dari urutan §6.8. \`user_role_assignments\` dan
-- \`audit_logs\` tidak disentuh: jejak penugasan dan riwayat tetap ada, hanya grant sistem
-- yang menyusut. Tidak satu pun kode di bawah menjadi gerbang rute \`/admin/**\` (terukur
-- dari \`PERM.*\` yang dipakai rute admin: identitas, organisasi, program, periode,
-- entitlement.module, settings.param).

BEGIN;

-- (1) R-2 \`TENANT_ADMIN\` - ${revoked.length} kode warisan \`...ADMIN_ACADEMIC_GRANTS\`.
WITH revoked(code) AS (
  VALUES
`;

const rows = revoked.map((code, i) => `    ('${code}')${i === revoked.length - 1 ? '' : ','}`).join('\n');

const FOOTER = `
)
DELETE FROM public.role_permissions rp
 USING public.permissions p, public.roles r, revoked cv
 WHERE rp.permission_id = p.id
   AND rp.role_id = r.id
   AND p.code = cv.code
   AND r.code = 'TENANT_ADMIN'
   AND r.is_system;

-- (2) DPO \`COMPLIANCE_OFFICER\` - antrean perubahan hak bukan miliknya (§6.1, baris 351-352).
DELETE FROM public.role_permissions rp
 USING public.permissions p, public.roles r
 WHERE rp.permission_id = p.id
   AND rp.role_id = r.id
   AND p.code IN ('identity.accessrequest.view', 'identity.accessrequest.approve')
   AND r.code = 'COMPLIANCE_OFFICER'
   AND r.is_system;

COMMIT;
`;

const out = join(root, 'packages', 'database', 'migrations', '0093_rbac_revoke_it_business_grants.sql');
writeFileSync(out, HEADER + rows + FOOTER);
console.log(`${revoked.length} kode dicabut; ${out} ditulis.`);
