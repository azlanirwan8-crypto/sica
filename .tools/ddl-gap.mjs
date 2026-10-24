// ddl-gap.mjs — membandingkan nama objek yang SUDAH punya nomor migrasi di register MIGRATION_SOP §5
// dengan objek yang benar-benar tertulis di DATA_MODEL. Output: nama yang terdaftar tapi DDL-nya tidak ada.
//
// Revisi 2026-10-21 (`RD-96`). Dua cacat diperbaiki sebelum angkanya dikutip lagi:
//  · penyebut dulu dicetak sebagai jumlah nama PADA GUGUS YANG PUNYA LUBANG, sehingga totalnya mengecil
//    setiap lubang ditutup (49 -> 44 -> 27) dan terbaca seperti kemajuan. Penyebut sekarang = seluruh nama
//    ter-registrasi; ia tidak berubah karena keberhasilan.
//  · daftar pengecualian berupa set tanpa alasan, sehingga alat bisa "menutup" lubang diam-diam.
//    Setiap ALIAS_KALAH sekarang membawa alasan yang menunjuk bagian dokumen.
//
// Revisi 2026-10-23 (kelas kegagalan yang sama, wajah baru: `RD-145`). Register §5 menyebut tiga
// jenis nama, dan alat ini sebelumnya hanya mengenal satu ("CREATE TABLE/VIEW"):
//  · **kolom** — dulu hanya dikenali lewat sufiks + empat kata yang saya karang; sekarang setiap
//    nama yang TERUKUR muncul sebagai definisi kolom di dalam blok `CREATE TABLE` DATA_MODEL
//    ikut classified KOLOM. Aturan sufiks tinggal jatuh-bangun, bukan satu-satunya bukti.
//  · **objek non-tabel** — `CREATE TYPE` (enum), `CREATE INDEX` (`idx_*`), `CREATE POLICY`
//    (`global_read`, `tenant_isolation`), `CREATE ROLE` (`sica_app`), `CREATE SEQUENCE`,
//    `CREATE FUNCTION`. Ini objek nyata dengan DDL nyata; sebelumnya dituduh "tanpa DDL".
//  · **nama yang dinyatakan BELUM** — register menulis `academic_calendars` dengan kata "BELUM"
//    dan "tidak dibuat" di sel yang sama. Itu vonis, bukan lubang. Kelas baru ini TETAP dicetak
//    (baris `belum …` + nomor migrasinya) supaya tidak bisa dipakai menyembunyikan gap: vonis
//    harus tertulis di dokumen, bukan disenyapkan di alat.
import { readFileSync } from 'node:fs';
const sop = readFileSync('docs/MIGRATION_SOP.md', 'utf8').split('\n');
const dm = readFileSync('docs/DATA_MODEL.md', 'utf8');

// ── (1) objek yang benar-benar punya DDL di DATA_MODEL ──────────────────────────────────
const created = new Set();
for (const m of dm.matchAll(/CREATE (?:TABLE|FOREIGN TABLE|OR REPLACE VIEW|VIEW)(?: IF NOT EXISTS)?\s+(?:public\.)?([a-z_][a-z0-9_]*)/g)) created.add(m[1]);
const otherObjects = new Set();
for (const m of dm.matchAll(/CREATE TYPE\s+(?:public\.)?([a-z_][a-z0-9_]*)/g)) otherObjects.add(m[1]);
for (const m of dm.matchAll(/CREATE (?:UNIQUE )?INDEX(?: CONCURRENTLY)?(?: IF NOT EXISTS)?\s+(?:[\w.]+\.)?([a-z_][a-z0-9_]*)/g)) otherObjects.add(m[1]);
for (const m of dm.matchAll(/CREATE POLICY\s+([a-z_][a-z0-9_]*)/g)) otherObjects.add(m[1]);
for (const m of dm.matchAll(/CREATE (?:OR REPLACE )?(?:FUNCTION|PROCEDURE)\s+(?:public\.)?(?:app\.)?([a-z_][a-z0-9_]*)/g)) otherObjects.add(m[1]);
for (const m of dm.matchAll(/CREATE SEQUENCE(?: IF NOT EXISTS)?\s+(?:public\.)?([a-z_][a-z0-9_]*)/g)) otherObjects.add(m[1]);
for (const m of dm.matchAll(/CREATE ROLE\s+([a-z_][a-z0-9_]*)/g)) otherObjects.add(m[1]);

// ── (2) kolom TERUKUR: nama kolom di dalam blok CREATE TABLE + ALTER … ADD COLUMN ────────
const columns = new Set();
const TIPE_SQL = String.raw`(?:text|citext|integer|int2|int4|int8|smallint|bigint|boolean|bool|uuid|numeric|decimal|jsonb|json|date|timestamptz|timestamp|time|inet|cidr|varchar|character|serial|bigserial|bytea|interval|enum)`;
{
  const lines = dm.split('\n');
  let kedalaman = 0;
  for (const baris of lines) {
    // `ALTER TABLE x ADD COLUMN y …` juga definisi kolom: `0047` menambahkan `api_group_code`
    // dan `feeder_dict_path` lewat jalur ini, bukan lewat blok CREATE TABLE.
    for (const a of baris.matchAll(new RegExp(`ADD (?:COLUMN|IF NOT EXISTS COLUMN)\\s+([a-z_][a-z0-9_]*)`, 'gi'))) columns.add(a[1]);
    if (/CREATE (?:TABLE|FOREIGN TABLE)(?: IF NOT EXISTS)?\s/.test(baris)) { kedalaman = 1; continue; }
    if (kedalaman === 0) continue;
    for (const ch of baris) {
      if (ch === '(') kedalaman += 1;
      else if (ch === ')') kedalaman -= 1;
    }
    // SATU baris boleh memuat beberapa kolom (`label text NOT NULL, label_en text, route_key text`);
    // memetik hanya kolom pertama adalah sebab `route_key` dituduh tanpa DDL pada 2026-10-23.
    for (const m of baris.matchAll(new RegExp(`([a-z_][a-z0-9_]*)\\s+${TIPE_SQL}\\b`, 'gi'))) {
      const nama = m[1];
      if (/^(constraint|primary|unique|foreign|check|create|alter|exclude|like|not|null|default)$/.test(nama)) continue;
      columns.add(nama);
    }
  }
}

// UJI NEGATIF: DDL_GAP_REMOVE=a,b menghapusbaca nama dari himpunan "sudah punya DDL" tanpa menyentuh dokumen.
// Dipakai untuk membuktikan gerbang ini benar-benar bisa menuduh, bukan selalu mencetak HIJAU.
for (const n of (process.env.DDL_GAP_REMOVE || '').split(',').map((s) => s.trim()).filter(Boolean)) created.delete(n);

// KOLOM: aturan sufiks (`_*_id`/`_*_ref`/…) tinggal sebagai jatuh-bangun; bukti utamanya adalah
// kolom yang terukur di blok CREATE TABLE. Sebelum aturan ini, alat saya menuduh baris `0013`
// Lubang karena menyebut `concentration_ref` — kolom, bukan objek. Itu temuan cacat alat (`RD-97`).
const COLUMN_SUFFIX = /(?:_id|_ref|_at|_bp|_ok)$/;
const COLUMN_WORDS = new Set(['week_pattern', 'status', 'kind', 'state', 'label', 'version', 'note']);
const isColumn = (n) =>
  !created.has(n) &&
  (COLUMN_SUFFIX.test(n) || COLUMN_WORDS.has(n) || columns.has(n));

// ALIAS_KALAH: vonisnya "nama ini tidak pernah dibuat" — hilang dari register, bukan kurang DDL.
const ALIAS_KALAH = new Map([
  ['student_activities', '§22.10 kalah ke activity_participations'],
  ['files', '§22.10 kalah ke attachments / documents'],
  ['lms_sessions', '§22.10 kalah ke class_sessions + conference_*'],
  ['ip_documents', '§22.10 kalah ke attachments(owner_entity = ip)'],
  ['hki_files', '§22.10 kalah ke attachments(owner_entity = hki)'],
  ['concentrations', '§26 keputusan 1: pemiliknya kamus reference_items(konsentrasi); children menyimpan concentration_ref'],
  ['laboratories', '§26 keputusan 1: pemiliknya rooms(room_type = LAB) + lab_resource_capabilities + lab_allocation_items'],
  ['learning_products', '§26 keputusan 1: pemiliknya course_outcomes/program_outcomes + final_project_outputs'],
  ['payment_plans', '§26 keputusan 1: pemiliknya invoice_installments(invoice_id, seq, due_on, amount_rupiah)'],
  ['platform_support_grants', '§26.12 + komentar `0083`: vonis RD-32 — satu mekanisme satu tabel, pemiliknya impersonation_grants yang dibedakan grant_kind'],
  ['factor_type', '`0084` + DATA_MODEL:345 — nama lama kolom `mfa_factors`, sudah DI-RENAME menjadi `kind`; kolom bernama factor_type tidak ada lagi'],
]);

// VONIS BELUM: sel register yang MENYATAKAN nama itu belum dibuat. Tidak dihitung sebagai lubang,
// tetapi wajib tercetak lengkap dengan nomor migrasinya supaya tidak bisa disalahgunakan.
const BELUM = /\bBELUM\b|tidak dibuat|belum dibuat|DITOLAK sementara/i;

const gapRows = [];
const aliasRows = [];
const columnRows = [];
const belumRows = [];
let totalNames = 0, totalMissing = 0, cntAlias = 0, cntColumn = 0, cntBelum = 0;
// Penjaga aturan: kalau ada CREATE TABLE yang namanya lolos isColumn, sufiks saya yang salah, bukan dokumennya.
for (const t of created) if (isColumn(t)) columnRows.push('PERINGATAN: objek bernama tabel `' + t + '` tercampur aturan kolom');
for (const line of sop) {
  const c = line.split('|').map((s) => s.trim());
  if (c.length < 4 || !/^\`0\d{3}\`$/.test(c[1] || '')) continue;
  const raw = [...c[2].matchAll(/`([a-z_][a-z0-9_]*)`/g)].map((m) => m[1]);
  const cols = raw.filter(isColumn);
  const alias = raw.filter((n) => !isColumn(n) && ALIAS_KALAH.has(n));
  const belum = raw.filter((n) => !isColumn(n) && !ALIAS_KALAH.has(n) && BELUM.test(c[2]) && !created.has(n) && !otherObjects.has(n));
  const names = raw.filter((n) => !isColumn(n) && !ALIAS_KALAH.has(n) && !belum.includes(n));
  totalNames += names.length; cntAlias += alias.length; cntColumn += cols.length; cntBelum += belum.length;
  const missing = names.filter((n) => !created.has(n) && !otherObjects.has(n));
  totalMissing += missing.length;
  if (missing.length) gapRows.push(`${c[1]}: ${missing.length}/${names.length} tanpa DDL — ${missing.join(', ')}`);
  if (alias.length) aliasRows.push(`${c[1]} (alias kalah): ${alias.map((a) => a + ' <- ' + ALIAS_KALAH.get(a)).join(' ; ')}`);
  if (cols.length) columnRows.push(`${c[1]}: ${cols.join(', ')}`);
  if (belum.length) belumRows.push(`${c[1]} (dinyatakan BELUM di register): ${belum.join(', ')}`);
}
for (const r of gapRows) console.log('GAP ' + r);
for (const r of aliasRows) console.log('ok  ' + r);
for (const r of columnRows) console.log('kol ' + r);
for (const r of belumRows) console.log('belum ' + r);
console.log(`\nobjek bernama di register MIGRATION_SOP §5 = ${totalNames} · TANPA DDL = ${totalMissing} · TERDAPAT = ${totalNames - totalMissing}`);
console.log(`dikecualikan dengan alasan: KOLOM = ${cntColumn} · ALIAS KALAH = ${cntAlias} · VONIS BELUM = ${cntBelum}`);
console.log(`CREATE TABLE/VIEW terukur di DATA_MODEL = ${created.size} · objek non-tabel (type/index/policy/function/sequence/role) = ${otherObjects.size} · kolom terukur = ${columns.size}`);
const PROBES = ['student_cards', 'tracer_survey', 'commencement_batches', 'import_runs', 'virtual_accounts', 'attendance_appeals', 'exam_schedules', 'reference_dictionary'];
const blind = PROBES.filter((p) => ![...created].some((t) => t.includes(p)));
if (blind.length) { console.log(`MERAH — alat BUTA terhadap nama yang nyata ada di DDL: ${blind.join(', ')}`); process.exit(1); }
console.log(`known-answer: ${PROBES.length}/${PROBES.length} nama yang pasti ada di DDL terlihat oleh alat (penolak buta, kelas kegagalan RD-97)`);
// Known-answer kelas BARU: objek non-tabel dan kolom tidak boleh lagi dituduh.
const NEW_PROBES = ['reference_domain', 'idx_imperson_active', 'global_read', 'sica_app'];
for (const n of NEW_PROBES) {
  const dikenali = otherObjects.has(n) || columns.has(n) || isColumn(n);
  if (!dikenali) { console.log(`MERAH — alat buta kelas objek non-tabel/kolom: ${n}`); process.exit(1); }
}
console.log(`known-answer non-tabel: ${NEW_PROBES.length}/${NEW_PROBES.length} (enum, indeks, policy, role) dikenali sebagai objek berdada`);
console.log(gapRows.length ? 'MERAH — masih ada nama terdaftar tanpa DDL' : 'HIJAU — setiap nama di register §5 punya DDL, vonis kalah, atau dinyatakan BELUM di register itu sendiri');
