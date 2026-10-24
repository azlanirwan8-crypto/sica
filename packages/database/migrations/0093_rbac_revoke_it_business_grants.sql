-- 0093: Batas R-2 ditegakkan — cabut grant bisnis dari Admin IT dan antrean hak dari DPO.
--
-- Sumber norma (terukur 2026-10-24):
--   * RBAC_MATRIX §2 baris 78: "NIM/SKS/presensi memerlukan pemilik domain, KRS/nilai/
--     pembayaran tidak diwariskan" dan "grant lama yang lebih luas dan self-service lisensi
--     adalah gap migrasi (§6.8), bukan sudah dicabut".
--   * RBAC_MATRIX §6.8 baris 1790/1798/1805: label administrator tidak mengizinkan
--     KRS/nilai/pembayaran; R-2 tidak membuat lisensi/seats/expiry; binding Feeder tidak
--     otomatis `feeder.period.send`.
--   * RBAC_MATRIX §6.1 + §4.5 baris 351-352 + vonis §9.5: `COMPLIANCE_OFFICER` bukan
--     pemegang `identity.accessrequest.*` (penutup `G-31`).
--   * RBAC_MATRIX §4.5 baris 317: `identity.impersonation.grant` khusus R-1; baris 318
--     membiarkan `.revoke` untuk tenant sendiri.
--
-- Ini langkah "inventaris + cabut" dari urutan §6.8. `user_role_assignments` dan
-- `audit_logs` tidak disentuh: jejak penugasan dan riwayat tetap ada, hanya grant sistem
-- yang menyusut. Tidak satu pun kode di bawah menjadi gerbang rute `/admin/**` (terukur
-- dari `PERM.*` yang dipakai rute admin: identitas, organisasi, program, periode,
-- entitlement.module, settings.param).

BEGIN;

-- (1) R-2 `TENANT_ADMIN` - 81 kode warisan `...ADMIN_ACADEMIC_GRANTS`.
WITH revoked(code) AS (
  VALUES
    ('academic.blockade.create'),
    ('academic.blockade.release'),
    ('academic.blockade.view'),
    ('academic.clearance.update'),
    ('academic.clearance.view'),
    ('academic.course.create'),
    ('academic.course.delete'),
    ('academic.course.update'),
    ('academic.course.view'),
    ('academic.curriculum.view'),
    ('academic.document.print'),
    ('academic.document.view'),
    ('academic.equivalency.manage'),
    ('academic.equivalency.view'),
    ('academic.export.bulk'),
    ('academic.feedercode.update'),
    ('academic.feedercode.view'),
    ('academic.gate.view'),
    ('academic.guardian.create'),
    ('academic.guardian.update'),
    ('academic.guardian.view'),
    ('academic.health.run'),
    ('academic.health.view'),
    ('academic.impact.view'),
    ('academic.lecturer.create'),
    ('academic.lecturer.update'),
    ('academic.lecturer.view'),
    ('academic.monitoring.view'),
    ('academic.prerequisite.create'),
    ('academic.prerequisite.delete'),
    ('academic.prerequisite.view'),
    ('academic.reference.manage'),
    ('academic.reference.view'),
    ('academic.report.view'),
    ('academic.room.create'),
    ('academic.room.delete'),
    ('academic.room.update'),
    ('academic.room.view'),
    ('academic.student.archive'),
    ('academic.student.create'),
    ('academic.student.update'),
    ('academic.student.view'),
    ('academic.transcript.issue'),
    ('academic.transcript.view'),
    ('academic.transfer.approve'),
    ('academic.transfer.request'),
    ('assessment.export.bulk'),
    ('assessment.grade.view'),
    ('assessment.recompute'),
    ('attendance.record.update'),
    ('attendance.record.view'),
    ('attendance.summary.view'),
    ('document.numbering.manage'),
    ('enrollment.krs.view'),
    ('enrollment.krsedit.approve'),
    ('enrollment.krsedit.request'),
    ('enrollment.pack.apply'),
    ('enrollment.pack.view'),
    ('enrollment.scheme.view'),
    ('entitlement.seat.manage'),
    ('entitlement.seat.view'),
    ('feeder.correction.approve'),
    ('feeder.period.send'),
    ('identity.impersonation.grant'),
    ('teaching.assignment.create'),
    ('teaching.assignment.update'),
    ('teaching.assignment.view'),
    ('teaching.class.create'),
    ('teaching.class.delete'),
    ('teaching.class.update'),
    ('teaching.class.view'),
    ('teaching.roomutilization.view'),
    ('teaching.schedule.create'),
    ('teaching.schedule.update'),
    ('teaching.schedule.view'),
    ('teaching.session.generate'),
    ('teaching.session.update'),
    ('teaching.session.view'),
    ('teaching.waitlist.manage'),
    ('teaching.waitlist.view'),
    ('teaching.workload.view')
)
DELETE FROM public.role_permissions rp
 USING public.permissions p, public.roles r, revoked cv
 WHERE rp.permission_id = p.id
   AND rp.role_id = r.id
   AND p.code = cv.code
   AND r.code = 'TENANT_ADMIN'
   AND r.is_system;

-- (2) DPO `COMPLIANCE_OFFICER` - antrean perubahan hak bukan miliknya (§6.1, baris 351-352).
DELETE FROM public.role_permissions rp
 USING public.permissions p, public.roles r
 WHERE rp.permission_id = p.id
   AND rp.role_id = r.id
   AND p.code IN ('identity.accessrequest.view', 'identity.accessrequest.approve')
   AND r.code = 'COMPLIANCE_OFFICER'
   AND r.is_system;

COMMIT;
