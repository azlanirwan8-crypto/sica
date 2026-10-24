import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const T = 'docs/PRD.md';
let text = readFileSync(T, 'utf8');
const must = (needle, value, label) => {
  const n = text.split(needle).length - 1;
  if (n !== 1) { console.error('MERAH - jangkar ' + label + ' cocok ' + n + ' kali. Berkas tidak ditulis.'); process.exit(1); }
  text = text.replace(needle, value);
};

must('| M-03 | Hak Akses & RBAC · Admin IT | `identity` | SEBAGIAN | FR-IDT-01…04, FR-ADM-06, §5.8 |',
  '| M-03 | Hak Akses & RBAC · Admin IT | `identity` | SEBAGIAN | FR-IDT-01…04, FR-ADM-06, §5.8 · AC-ADM-6 |',
  'sel registri M-03');

const ac = [
'**AC-ADM-6 🔒 (perubahan hak selalu empat-mata, ber-scope, dan berlaku pada permintaan berikutnya)**',
'Given `TENANT_ADMIN` A mengajukan `access_change_requests` untuk memberi, mencabut, atau mengubah scope peran pengguna B (termasuk dirinya sendiri), dengan `request_kind` `GRANT`/`REVOKE`/`SCOPE_CHANGE` dan alasan',
'When (a) A menyetujui permintaannya sendiri, (b) B menyetujui grant untuk dirinya sendiri, (c) permintaan memberi scope di luar himpunan scope yang dipegang A, (d) permintaan menyentuh role sistem (`is_system = true`), (e) permintaan yang sudah terminal disetujui ulang, atau (f) permintaan disetujui tanpa MFA pada sesi penyetuju',
'Then (a)/(b) ditolak `403 SELF_APPROVAL_FORBIDDEN` (56) — dan bukan hanya tombol yang disembunyikan; `CHECK (approver_id <> requester_id)` serta `CHECK (approver_id <> target_user_id)` di DB adalah penegak kedua; (c) ditolak `403 ADMIN_SCOPE_MISMATCH` (16) karena grant tidak boleh menaikkan hak pemberi (L4: scope yang diberikan harus himpunan bagian dari scope pemberi); (d) ditolak `409 CONFLICT` (12) dengan sebab "role sistem tidak dapat diubah/dihapus", dan `DELETE /admin/hak-akses/peran/:id` untuk `is_system = true` selalu gagal di service layer; (e) ditolak `409 DECISION_ALREADY_MADE` (55); (f) ditolak `403 MFA_REQUIRED` sebelum baris assignment ditulis. Sesudah keputusan yang sah: assignment baru/berubah **berlaku pada pemeriksaan izin berikutnya** — token akses yang beredar tidak dapat menghidupkan kembali grant yang dicabut karena setiap permintaan membaca `user_role_assignments` + `valid_to` (bukan label peran di carrier), `refresh` untuk sesi yang haknya dicabut ditolak, dan cache izin per pengguna dibuang; pencabutan tidak menghapus baris (status/`valid_to` berubah) sehingga jejak tetap terbaca. Setiap pengajuan, persetujuan, dan penolakan menulis `audit_logs` berisi actor, target, before/after, alasan, IP, dan `request_id`; penolakan wajib `reason` (FR-IDT-05, AC-AKA-2). _Rujukan: FR-ADM-06, FR-IDT-01/03/05, BR-K2, [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md) §3/§14.3.3, [API_SPEC.md](file:///c:/SICA/docs/API_SPEC.md) §4.6.9, [RBAC_MATRIX.md](file:///c:/SICA/docs/RBAC_MATRIX.md) §4.2/§4.5.8/§6.2, [UI_UX_DESIGN.md](file:///c:/SICA/docs/UI_UX_DESIGN.md) §9.8._',
'',
'',
];
must(NL + '**AC-PLT-1 (provisioning adalah satu transaksi, tidak ada tenant yatim)**',
  NL + ac.join(NL) + '**AC-PLT-1 (provisioning adalah satu transaksi, tidak ada tenant yatim)**', 'blok AC-PLT-1');

if (!/^\*\*AC-ADM-6/m.test(text) || (text.match(/FR-ADM-06/g) || []).length < 3) {
  console.error('MERAH - AC-ADM-6 atau rujukan FR-ADM-06 tidak lengkap.'); process.exit(1);
}
writeFileSync(T, text, 'utf8');
console.log('HIJAU - PRD: AC-ADM-6 ditulis, registri M-03 menunjuk AC-nya.');
