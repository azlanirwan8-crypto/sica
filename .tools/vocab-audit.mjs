import { readFileSync, readdirSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';

/*
 * Penilik kosakata tertutup — version 2 (dewan 2026-10-21).
 * Versi 1 salah vonis: ia menggabungkan SEMUA daftar yang memuat token serupa menjadi
 * satu "konsep" lalu menuntut tiap daftar memuat gabungan nilainya. Akibatnya kamus
 * `campus_sites.kind` (MAIN/BRANCH/SATELLITE/ONLINE_ONLY) dilaporkan sebagai
 * "kosakata modus keempat", dan empat ejaan yang memang beda objek dianggap konflik.
 *
 * Versi 2 membandingkan daftar **berdasarkan namanya** dengan register kanonik
 * DATA_MODEL §21.4 + §21.10.1. Nama di luar register tidak dinilai (ia konsep lain),
 * dan nama yang terdaftar sebagai alias kalah dilaporkan sebagai pelanggaran.
 */
const KANON = {
  'provider vicon (§21.10.1)': {
    names: /^(conference_provider|provider|virtual_meeting_provider|default_provider)$/i,
    nilai: ['BUILTIN_LMS', 'BBB', 'JITSI', 'GOOGLE_MEET', 'MICROSOFT_TEAMS', 'ZOOM'],
  },
  'modus pembelajaran (§21.4)': {
    names: /^(learning_modality|learningModality|delivery_mode|deliveryMode|work_mode|workMode)$/i,
    nilai: ['ONSITE', 'ONLINE', 'BLENDED'],
  },
  'bentuk pertemuan (§21.4 sumbu kedua)': {
    names: /^(session_kind|sessionKind)$/i,
    nilai: ['REGULAR', 'SYNC_LIVE', 'ASYNC_MODULE', 'PRAKTIKUM', 'UTS', 'UAS', 'SUSULAN'],
  },
  'status presensi (§15.1)': {
    names: /^(attendance_status|attendanceStatus)$/i,
    nilai: ['PRESENT', 'EXCUSED', 'SICK', 'ABSENT', 'ABSENT_LATE'],
    /* keadaan tayang = proyeksi laporan, BUKAN nilai DB; hanya boleh muncul di kontrak
       respons (DATA_MODEL §15.4 / UI_UX §11.7), tidak pernah di CHECK atau body tulis. */
    tayang: ['NOT_RECORDED', 'HELD'],
  },
  'keadaan tinjau presensi (§21.10)': {
    names: /^(review_state|reviewState)$/i,
    nilai: ['NONE', 'PENDING', 'GRANTED', 'REJECTED'],
  },
};
const ALIAS_KALAH = {
  delivery_type: 'session_kind (§21.4)', deliveryType: 'sessionKind (§21.4)',
  ONLINE_SYNC: 'ONLINE + SYNC_LIVE', ONLINE_ASYNC: 'ONLINE + ASYNC_MODULE',
  HYBRID: 'BLENDED', TEAMS: 'MICROSOFT_TEAMS', BUILTIN: 'BUILTIN_LMS',
  PENDING_REVIEW: 'review_state + attendance_appeals (RD-70)',
};

function daftar(text) {
  const out = [];
  for (const m of text.matchAll(/CHECK\s*\(\s*([a-z_]+)\s+IN\s*\(([\s\S]*?)\)/gi))
    out.push({ nama: m[1], sumber: 'CHECK DB', nilai: [...m[2].matchAll(/'([A-Za-z0-9_]+)'/g)].map((x) => x[1]) });
  for (const m of text.matchAll(/CREATE TYPE ([a-z_]+) AS ENUM \(([\s\S]*?)\)/gi))
    out.push({ nama: m[1], sumber: 'enum DB', nilai: [...m[2].matchAll(/'([A-Za-z0-9_]+)'/g)].map((x) => x[1]) });
  for (const m of text.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*z\.enum\(\[([\s\S]*?)\]/g))
    out.push({ nama: m[1], sumber: 'kontrak Zod', nilai: [...m[2].matchAll(/'([A-Za-z0-9_]+)'/g)].map((x) => x[1]) });
  return out.filter((d) => d.nilai.length);
}

const files = readdirSync(D).filter((f) => f.endsWith('.md'));
const all = [];
for (const f of files) for (const d of daftar(readFileSync(D + f, 'utf8'))) all.push({ ...d, f });

let selisih = 0, aliasHitam = 0, dinilai = 0;
for (const [konsep, cfg] of Object.entries(KANON)) {
  const hit = all.filter((d) => cfg.names.test(d.nama));
  const kanon = new Set(cfg.nilai);
  console.log('=== ' + konsep + ' — ' + hit.length + ' daftar bernama, kanonik ' + cfg.nilai.join('|'));
  for (const d of hit) {
    dinilai++;
    const set = new Set(d.nilai.map((v) => v.toUpperCase()));
    const kanon2 = new Set([...cfg.nilai, ...((cfg.tayang || []).map((v) => v.toUpperCase()))]);
    const kurang = cfg.nilai.filter((v) => !set.has(v));
    const lebih = [...set].filter((v) => !kanon2.has(v));
    const tayang = [...set].filter((v) => !kanon.has(v) && (cfg.tayang || []).includes(v));
    if (tayang.length && d.sumber !== 'kontrak Zod') { lebih.push(...tayang); }
    const alias = [...set].filter((v) => ALIAS_KALAH[v]);
    if (!kurang.length && !lebih.length && !alias.length) {
      console.log('    COKOK  ' + d.f + ' [' + d.sumber + '] ' + d.nama + (tayang.length && d.sumber === 'kontrak Zod' ? '  (+tayang=' + tayang.join(',') + ' — proyeksi, bukan nilai DB)' : ''));
      continue;
    }
    selisih++;
    const bagian = [];
    if (kurang.length) bagian.push('kurang=' + kurang.join(','));
    if (lebih.length) bagian.push('asing=' + lebih.join(','));
    if (alias.length) bagian.push('ALIAS_KALAH=' + alias.map((v) => v + '->' + ALIAS_KALAH[v]).join(' '));
    console.log('    SELISIH ' + d.f + ' [' + d.sumber + '] ' + d.nama + ' = (' + [...set].sort().join(',') + ') :: ' + bagian.join(' :: '));
  }
  if (!hit.length) console.log('    (tidak ada daftar dengan nama ini)');
}

console.log(NL + '=== Nama daftar yang sudah kalah / alias terdaftar');
const NAMA_ALIAS = {
  teachingMethod: 'ALIAS TERDAFTAR — `API_SPEC §4.4.1` (rute lama §4.3.1 hanya menerima bentuk ini; lepas saat rute pindah)',
  deliveryType: 'ALIAS TERDAFTAR — `API_SPEC §4.4.1` butir 1-2, satu rilis, sumber kebenaran `sessionKind`',
};
let terdaftar = 0;
for (const d of all) {
  if (NAMA_ALIAS[d.nama]) {
    terdaftar++;
    console.log('    ' + d.f + ' [' + d.sumber + '] ' + d.nama + ' -> ' + NAMA_ALIAS[d.nama]);
  } else if (ALIAS_KALAH[d.nama]) {
    aliasHitam++;
    console.log('    HITAM ' + d.f + ' [' + d.sumber + '] ' + d.nama + ' -> ' + ALIAS_KALAH[d.nama] + ' (tidak ada di register alias)');
  }
}
if (!aliasHitam && !terdaftar) console.log('    nol');

console.log(NL + 'vocab-audit: daftar bernama = ' + dinilai + ' · selisih = ' + selisih + ' · alias terdaftar = ' + terdaftar + ' · nama hitam = ' + aliasHitam);
console.log(selisih === 0 && aliasHitam === 0 ? 'vocab-audit: HIJAU (nol selisih; alias yang hidup semuanya tercatat di register)' : 'vocab-audit: MERAH (lihat baris SELISIH/HITAM di atas)');
