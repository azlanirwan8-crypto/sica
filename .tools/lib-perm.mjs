// lib-perm.mjs — pustaka bersama pengukuran izin.
// Kenapa satu berkas untuk dua alat: perm-phantom (apakah kode pernah dinamai) dan perm-normalize
// (kelas perbaikan kode) wajib memakai DEFINISI yang sama. Dua pemindai independen atas berkas yang
// sama bisa menuduh hal yang berbeda — itu kelas kegagalan RD-95, jadi pembagiannya ada di sini.
import { readFileSync } from 'node:fs';

export const CODE_RE = /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+$/;

// Verba kanonik enam (FR-IDT-04). Token aksi di bawah adalah EJAAN yang dipakai pada kode, dipetakan
// ke verba sesuai vonis RBAC §4.1/§4.5.1 ("10 aksi tombol -> 6 verba"), bukan karangan alat ini.
export const TOKEN_VERB = {
  view: 'READ', read: 'READ', get: 'READ', list: 'READ', check: 'READ', verify: 'READ', rank: 'READ', search: 'READ',
  create: 'INSERT', insert: 'INSERT', add: 'INSERT', submit: 'INSERT', record: 'INSERT', request: 'INSERT',
  apply: 'INSERT', issue: 'INSERT', enroll: 'INSERT', schedule: 'INSERT', upload: 'INSERT', deposit: 'INSERT',
  respond: 'INSERT', send: 'INSERT', mark: 'INSERT', post: 'INSERT', ingest: 'INSERT', generate: 'INSERT',
  update: 'UPDATE', edit: 'UPDATE', patch: 'UPDATE', manage: 'UPDATE', assign: 'UPDATE', unassign: 'UPDATE',
  reorder: 'UPDATE', sync: 'UPDATE', merge: 'UPDATE', reset: 'UPDATE', close: 'UPDATE', open: 'UPDATE',
  lock: 'UPDATE', unlock: 'UPDATE', hold: 'UPDATE', activate: 'UPDATE', deactivate: 'UPDATE', clear: 'UPDATE',
  delete: 'DELETE', remove: 'DELETE', void: 'DELETE', archive: 'DELETE', restore: 'DELETE', retire: 'DELETE',
  validate: 'VALIDATE', approve: 'VALIDATE', decide: 'VALIDATE', endorse: 'VALIDATE', release: 'VALIDATE',
  confirm: 'VALIDATE', review: 'VALIDATE', announce: 'VALIDATE', score: 'VALIDATE', grant: 'VALIDATE',
  revoke: 'VALIDATE', reject: 'FORBIDDEN_REJECT',
  run: 'OTHER', export: 'FORBIDDEN_EXPORT', import: 'OTHER', cancel: 'OTHER', publish: 'OTHER', withdraw: 'OTHER',
  consume: 'OTHER', register: 'OTHER', seal: 'OTHER', scan: 'OTHER', pay: 'OTHER', dispense: 'OTHER',
  toggle: 'UPDATE',
  // Ditambah 2026-10-21 (`RD-98`): 23 token yang TERBUKTI dipakai baris bernomor katalog tetapi belum ada
  // di peta, sehingga pemindai lama membuang 40 baris sah. Verba di bawah BUKAN karangan alat — tiap nilai
  // diambil dari kolom `verba` baris yang memakainya (mis. `ppks.sanction.propose` = INSERT, nomor 211;
  // `library.clearance.override` = VALIDATE, nomor 233; `hr.bkd.calc` = OTHER, nomor 172).
  propose: 'INSERT', declare: 'INSERT', train: 'INSERT',
  revert: 'UPDATE', scope: 'UPDATE', return: 'UPDATE',
  override: 'VALIDATE', adjust: 'VALIDATE', waive: 'VALIDATE', disclose: 'VALIDATE', contract: 'VALIDATE',
  emit: 'OTHER', test: 'OTHER', parse: 'OTHER', extract: 'OTHER', force: 'OTHER', recompute: 'OTHER',
  calc: 'OTHER', push: 'OTHER', resync: 'OTHER', evaluate: 'OTHER', provision: 'OTHER', pull: 'OTHER',
  commit: 'OTHER', // `platform.import.commit` — dua langkah impor (preview lalu commit) adalah aksi ber-izin, bukan READ.
  reconcile: 'OTHER', // `hris.insurance.reconcile` — dibuktikan rute `POST /hris/insurance/periods/:periodMonth/reconcile` (`API_SPEC:4982`), intent ke `queue_operations`.
  // Siklus M-04 (`RD-120`): empat token helpdesk yang dipvonis RBAC §4.5.6 (20 usulan) tetapi tidak
  // ada di peta ini, sehingga perm-phantom membuang barisnya dan melapor HANTU=0 palsu. Verba diambil
  // dari kolom verba baris usulan, bukan karangan: comment=INSERT (keluarga post/respond),
  // claim/resolve/reopen=UPDATE (transisi keadaan tiket, seangkatan assign/close).
  comment: 'INSERT', claim: 'UPDATE', resolve: 'UPDATE', reopen: 'UPDATE',
  // Siklus M-04 (pengukuran 350 vs 352): dua baris KATALOG BERNOMOR terbuang dari `numbered` karena
  // token aksinya tidak dikenal — 304 `platform.tenant.suspend` (verba UPDATE, dua arah ACTIVE⇄SUSPENDED)
  // dan 309 `platform.breakglass.use` (OTHER, aksi terdaftar eksplisit). Verba diambil dari kolom katalog,
  // bukan karangan; tanpa ini pemindai menghitung katalog 350 padahal pemilik angkanya (rbac-count) 352.
  suspend: 'UPDATE', use: 'OTHER',
};

// Kelas parameter pada `settings.param.view.<kelas>`: segmen TERAKHIR bukan aksi, melainkan pemetaan
// kelas parameter §21. Enam nilai ini diambil dari kolom kelas di baris katalog 146–157, bukan daftar tangan.
export const CLASS_SUFFIX = new Set(['security', 'technical', 'ops', 'academic', 'financial', 'regulatory']);

// Sebuah string dihitung KODE IZIN bila segmen aksinya dikenali: aksi kanonik di ujung, atau kelas
// parameter yang aksinya ditulis satu segmen sebelum ujung (`settings.param.view.security` = READ).
export function actionOf(code) {
  const seg = code.split('.');
  const last = seg[seg.length - 1];
  if (Object.prototype.hasOwnProperty.call(TOKEN_VERB, last)) return { token: last, verb: TOKEN_VERB[last] };
  if (seg.length >= 4 && CLASS_SUFFIX.has(last)) {
    const prev = seg[seg.length - 2];
    if (Object.prototype.hasOwnProperty.call(TOKEN_VERB, prev)) return { token: prev, verb: TOKEN_VERB[prev] };
  }
  return null;
}

// Pengembangan shorthand dilakukan PER TOKEN backtick, bukan dengan memecah teks pada `/`, `·`, `,`.
// Versi lama memecah lebih dulu dan itu merusak kutipan API_SPEC: URL seperti `/admin/krs/dispense`
// memotong pasangan backtick, sehingga 392 kandidat terukur menyusut jadi 94 (angka yang salah, dan
// salah ke arah "terlihat hampir bersih"). Revisi tercatat sebagai `RD-99`.
export function expandTokens(text) {
  const out = [];
  let stem = null;
  let prevEnd = -1;
  for (const m of text.matchAll(/`([^`]+)`/g)) {
    const t = m[1].trim();
    // Shorthand (`.create`) hanya boleh mewarisi batang kata dari kode penuh yang MENEMPEL padanya —
    // dipisahkan paling jauh oleh `·`, `/`, koma, atau spasi. Tanpa syarat ini, kalimat prosa seperti
    // "... namespace `academic.bkd.*` ... serta verba `.reject`/`.export` ..." melahirkan dua "kode"
    // yang tidak pernah diminta rute mana pun (terukur, RD-99).
    const adjacent = prevEnd >= 0 && /^[\s·\/,\-–—]*(?:dan|atau)?[\s·\/,\-–—]*$/.test(text.slice(prevEnd, m.index));
    if (/^\.[a-z0-9_]+(?:\.[a-z0-9_]+)*$/.test(t)) {
      if (!stem || !adjacent) { if (!adjacent) stem = null; continue; }
      for (const part of t.slice(1).split('.')) {
        const code = stem + '.' + part;
        stem = code.slice(0, code.lastIndexOf('.'));
        push(code);
      }
      prevEnd = m.index + m[0].length;
      continue;
    }
    if (/\.\*$/.test(t)) { stem = t.replace(/\.\*$/, ''); prevEnd = m.index + m[0].length; continue; }
    if (CODE_RE.test(t)) { stem = t.slice(0, t.lastIndexOf('.')); push(t); prevEnd = m.index + m[0].length; continue; }
    const dotted = t.match(/^([a-z0-9_.]+)\.[a-z0-9_]+$/);
    if (dotted) stem = dotted[1];
    else stem = null;
    prevEnd = m.index + m[0].length;
  }
  // Revisi 2026-10-21 (`RD-98`): hanya token yang ber-aksi yang boleh dihitung sebagai KODE. Versi lama
  // menghitung semua sel, termasuk kolom "menu/titik aksi" katalog (`admin.engine`, `admin.master.prodi`,
  // `admin.konsentrasi`). Akibatnya `admin` tampak sebagai namespace yang "dikenal" sebanyak 25 nama
  // padahal nol kode, dan sebuah HANTU sungguhan bisa lolos hanya karena kebetulan sama dengan slug menu.
  // Aturan ini searah dengan kejujuran: ia hanya MENGURANGI daftar dikenal, tidak pernah menambah.
  function push(code) {
    if (actionOf(code)) out.push(code);
  }
  return out;
}

const expandCell = expandTokens;

// Kosakata prefiks dibangun dari DATA (katalog bernomor + authz), bukan dari daftar yang saya rawat
// sendiri: daftar tangan akan menyimpang dari katalog begitu gelombang berikutnya menambah namespace.
export function loadRbac(path = 'docs/RBAC_MATRIX.md', textOverride = null) {
  const lines = (textOverride !== null ? textOverride : readFileSync(path, 'utf8')).split('\n');
  const numbered = new Map();   // code -> {roles, module}
  const named = new Set();
  const usulan = new Map();     // code -> {module, verb, roles, objek} dari tabel §4.5.4+ (sengaja tanpa nomor)
  const prefixes = new Map();   // prefiks -> jumlah baris bernomor
  const pairVerbs = new Map();  // "prefiks.resource" -> Map(token -> {verb, roles})
  let inCatalog = false;
  let sub = '';
  for (const line of lines) {
    if (line.startsWith('### 4.5 Katalog')) inCatalog = true;
    else if (line.startsWith('### 4.6 ') || line.startsWith('## 5.')) inCatalog = false;
    const h = line.match(/^#{4}\s+4\.5\.(\d)/);
    if (h) sub = h[1];
    // Heading lain MENUTUP bagian usulan. Tanpa ini `sub` tetap '6' sampai akhir berkas dan seluruh tabel
    // peran/objek di §4.6 dst. dihitung sebagai nama usulan — `named` membengkak dan hantu bisa lolos.
    else if (/^#{2,4}\s/.test(line)) sub = '';
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map((s) => s.trim());
    const hasNum = /^\d+$/.test(cells[1] || '');
    // Tabel §4.5.4/4.5.5/4.5.6 menaruh NAMA USULAN di kolom pertama dan SENGAJA tidak memberi nomor:
    // itu "kebutuhan nama" yang perannya belum diputus manusia. Nama ini DIKENAL (rute boleh mengutipnya)
    // tetapi tidak BERNOMOR dan tidak boleh dihitung sebagai izin — dipisahkan di peta di sini supaya
    // perm-phantom tidak pernah melaporkan "HANTU = 0" sebagai "selesai".
    if (Number(sub) >= 4 && !hasNum) {
      const u = (cells[1] || '').match(/^`([a-z0-9_.]+)`$/);
      if (u && actionOf(u[1])) {
        usulan.set(u[1], { module: cells[4] || '', verb: cells[3] || '', roles: cells[5] || '', objek: cells[6] || '' });
        named.add(u[1]);
      }
    }
    // Semua sel dibaca, termasuk sel pertama. §4.5.4 dan §4.5.5 menaruh NAMA USULAN di kolom pertama
    // (sengaja, karena belum punya nomor baris); pemindai lama mulai dari sel kedua sehingga 16 usulan
    // itu dihitung HANTU — temuan palsu atas nama saya sendiri (kelas RD-62).
    for (let i = 1; i < cells.length; i++) {
      for (const code of expandCell(cells[i])) {
        named.add(code);
        if (hasNum && i === 2 && inCatalog) {
          // Kolom baris katalog: 1=nomor 2=kode 3=modul 4=menu/titik aksi 5=verba 6=peran 7=catatan.
          numbered.set(code, { module: cells[3] || '', surface: cells[4] || '', verb: cells[5] || '', roles: cells[6] || '', note: cells[7] || '' });
          const seg = code.split('.');
          const act = actionOf(code);
          const p = seg[0];
          prefixes.set(p, (prefixes.get(p) || 0) + 1);
          // Kunci pairVerbs = "prefiks.sumber daya" + token aksi. Untuk kode 4 segmen yang berkelas
          // (settings.param.view.security) sumber dayanya adalah segmen 1..n-2, jadi pasangan peran
          // tetap ditemukan; token dihitung dari actionOf, bukan dari segmen ketiga buta.
          const res = act && CLASS_SUFFIX.has(seg[seg.length - 1]) ? seg.slice(1, seg.length - 2).join('.') : seg[1];
          const key = p + '.' + res;
          if (!pairVerbs.has(key)) pairVerbs.set(key, new Map());
          pairVerbs.get(key).set(act ? act.token : seg[seg.length - 1], { verb: act ? act.verb : 'UNKNOWN', roles: cells[6] || '' });
        }
      }
    }
  }
  const authz = readFileSync('packages/contracts/src/authz.ts', 'utf8');
  for (const m of authz.matchAll(/([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)\s*:\s*\{/g)) named.add(m[1]);
  // Modul sah dibaca dari dua tempat di authz: daftar PERMISSION_MODULES (kutipan tanpa titik) dan
  // MODULE_PREFIX_ALIASES (prefiks warisan -> modul). Versi lama memakai regex `'nama':` yang tidak
  // cocok dengan isi array PERMISSION_MODULES, sehingga hanya 2 modul terbaca dan 48 kode dituduh
  // "prefiks asing" — termasuk `feeder_pddikti.*` yang justru modul sah (RD-62 lagi).
  const modList = authz.match(/export const PERMISSION_MODULES = \[([\s\S]*?)\] as const;/);
  if (modList) for (const m of modList[1].matchAll(/'([a-z_]+)'/g)) if (!prefixes.has(m[1])) prefixes.set(m[1], 0);
  const aliasBlock = authz.match(/export const MODULE_PREFIX_ALIASES[^=]*=\s*\{([\s\S]*?)\};/);
  if (aliasBlock) for (const m of aliasBlock[1].matchAll(/(\w+):\s*'([a-z_]+)'/g)) { if (!prefixes.has(m[1])) prefixes.set(m[1], 0); }
  // Namespace yang sah juga termasuk yang dinyatakan di tabel partisi §4.5.1 (`| \`library\` (usulan) |`).
  // Tanpa ini `lms.*`/`cbt.*` (modul nyata, sengaja nol baris gelombang 4) dituduh prefiks asing.
  for (const line of lines) {
    const m = line.match(/^\|\s*`([a-z_][a-z0-9_]*)`\s*\((?:nyata|usulan)\)/);
    if (m && !prefixes.has(m[1])) prefixes.set(m[1], 0);
  }
  return { numbered, named, usulan, prefixes, pairVerbs };
}

// Kutipan dibaca dari daftar baris, bukan dari berkas, supaya alat bisa menguji teks HASIL perbaikan
// di memori sebelum satu berkas pun ditulis.
export function citeLines(apiLines) {
  const cited = new Map();
  let section = '(depan)';
  for (let i = 0; i < apiLines.length; i++) {
    const h = apiLines[i].match(/^#{2,4}\s+(.+)$/);
    if (h) section = h[1].slice(0, 46);
    // Revisi 2026-10-21 (`RD-99`): kutipan dibaca lewat expandTokens yang sama dengan RBAC. Versi lama
    // mengambil token backtick mentah sehingga SHORTHAND rute ("usulan `ipr.application.view` · `.create`
    // · `.update`") tidak pernah diperiksa — izin yang benar-benar diminta rute lolos dari gate.
    for (const code of expandTokens(apiLines[i])) {
      if (!isCodeShape(code)) continue;
      if (!cited.has(code)) cited.set(code, { count: 0, first: i + 1, section });
      cited.get(code).count++;
    }
  }
  return cited;
}

export function loadCited(path = 'docs/API_SPEC.md') {
  return citeLines(readFileSync(path, 'utf8').split('\n'));
}

export const isCodeShape = (t) => {
  if (!CODE_RE.test(t)) return false;
  if (/\.(sql|ts|tsx|dart|json|md|mjs|yml|yaml|env|example|graphql|py|sh)$/.test(t)) return false;
  if (/^(app|public|pg|next|process|z|t|id|en|http|https)\./.test(t)) return false;
  return actionOf(t) !== null;
};
