-- 0095: Cabut kode baca per-record yang tidak satu pun baris §6 tulis untuk perannya.
--
-- Dua peran, satu alasan: visibilitas menu adalah proyeksi hak, jadi kode baca yang tidak
-- dipakai baris manapun untuk peran itu tetap menyalakan daun layar pemilik domain.
--
--   * `STUDENT` — `academic.student.view`, `academic.studentstatus.view`.
--     §6.4 baris 1606–1616 tidak menyebut keduanya; status dirinya terbaca lewat proyeksi
--     `/auth/me`, dan "mengapa KRS terkunci" adalah tugas `academic.denialreason.view`
--     (FR-ADM-11, §4.5) yang sudah dipegang lewat keluarga self-service.
--     Daun yang padam: `akademik.studentstatus` (layar daftar se-tenant, §6.2 baris 1514).
--   * `LEADER` — `academic.studentstatus.view`, `assessment.grade.view`,
--     `enrollment.krs.view`, `teaching.class.view`, `attendance.summary.view`.
--     §5 menandai keempat modul itu **A** untuk pimpinan, dan §1.2 mendefinisikan A sebagai
--     "baca agregat/anonim (tidak per-record)". Baris §6.2 pimpinan (1539–1543) hanya
--     menuliskan dashboard eksekutif, keputusan strategis, SK yudisium, mutu, dan IKU.
--     Agregat yang sah (`academic.report.view`, `finance.report.view`) tidak disentuh.
--
-- Nol konsumen: `grep -rn "academicStudentView|academicStudentStatusView|enrollmentKrsView|
-- teachingClassView|attendanceSummaryView|assessmentGradeView" apps/web/src` tidak pernah
-- memakai kode ini sebagai gerbang untuk sesi mahasiswa/pimpinan — yang memakai kode sama
-- adalah peran lain dengan penugasannya sendiri (`ADMIN_ACADEMIC`, `ADVISER`, `LECTURER`).
-- `user_role_assignments` dan `audit_logs` tidak disentuh.

BEGIN;

-- (1) Mahasiswa.
DELETE FROM public.role_permissions rp
 USING public.permissions p, public.roles r
 WHERE rp.permission_id = p.id
   AND rp.role_id = r.id
   AND p.code IN ('academic.student.view', 'academic.studentstatus.view')
   AND r.code = 'STUDENT'
   AND r.is_system;

-- (2) Pimpinan — §5 A (agregat), bukan baca per-record.
DELETE FROM public.role_permissions rp
 USING public.permissions p, public.roles r
 WHERE rp.permission_id = p.id
   AND rp.role_id = r.id
   AND p.code IN (
     'academic.studentstatus.view',
     'assessment.grade.view',
     'enrollment.krs.view',
     'teaching.class.view',
     'attendance.summary.view'
   )
   AND r.code = 'LEADER'
   AND r.is_system;

COMMIT;
