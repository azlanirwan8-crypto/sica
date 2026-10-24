import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';
const rep = [];

const sub = (file, label, a, b) => {
  const p = D + file;
  const s = readFileSync(p, 'utf8');
  const n = s.split(a).length - 1;
  if (n === 0) { rep.push(file + ' ' + label + ': MISS'); return; }
  if (n > 1) { rep.push(file + ' ' + label + ': AMBIG (' + n + ')'); return; }
  writeFileSync(p, s.replace(a, b), 'utf8');
  rep.push(file + ' ' + label + ': OK');
};

/* 1 — ROADMAP: heading §2.17 pernah menjadi serpihan di ujung paragraf §2.16,
      sehingga gugus `SPE-1…SPE-15` tidak punya rumah dan tiga berkas menunjuk §2.17 yang "tidak ada" */
sub('ROADMAP_TASKS.md', 'roadmap-217-heading',
  ' register yang benar tetapi terbaca salah. + tata kelola menu di Fase 1B (`R-2`) — parameter, menu dinamis, presensi multi-modus — 2026-10-20',
  ' register yang benar tetapi terbaca salah.' + NL + NL +
  '### 2.17 Dynamic Parameter Engine + tata kelola menu di Fase 1B (`R-2`) — parameter, menu dinamis, presensi multi-modus — 2026-10-20' + NL +
  ' *(heading ini dipulihkan 2026-10-21 oleh audit rujukan silang `.tools/ref-audit.mjs`; sejak gelombang 3 ia tertulis sebagai serpihan di paragraf penutup §2.16 sehingga §2.17 tidak dapat ditemukan oleh alat maupun oleh navigasi, padahal `SPE-1`…`SPE-15` dan tiga berkas lain menunjuknya.)*');

/* 2 — UI_UX: rujukan `AGENTS §2.0` (nomor yang tidak pernah ada) */
sub('UI_UX_DESIGN.md', 'agents-20',
  'nol gaya Tailwind lokal di luar primitif Velzon (AGENTS §2.0)',
  'nol gaya Tailwind lokal di luar primitif Velzon (AGENTS §3.4 + `UI_UX_DESIGN §11.5`)');

/* 3 — AUDIT_READINESS: `BLUEPRINT §4.11` — BLUEPRINT_ENTERPRISE berhenti di §4.10; objek PMB tinggal di §4.4 */
sub('AUDIT_READINESS.md', 'blueprint-411',
  'PRD FR-P2-01 diurai; BLUEPRINT §4.11',
  'PRD FR-P2-01 diurai; `BLUEPRINT_ENTERPRISE §4.4` (Modul B — registrasi, tarif, penagihan; `§4.11` tidak pernah ada — ralat audit rujukan silang 2026-10-21)');

/* 4+5 — ENV_CONTRACT §6.x dan MIGRATION_SOP §5.x: nomor bagian ditulis sebagai tebak-tebakan
   tebal (`**6.3 …**`) sehingga tidak terlihat oleh alat maupun oleh daftar isi. Dipromosikan
   menjadi heading nyata; isinya tidak berubah satu kata pun. */
const promote = (file, prefix) => {
  const p = D + file;
  const lines = readFileSync(p, 'utf8').split(NL);
  let n = 0;
  const out = lines.map((l) => {
    const m = l.match(new RegExp('^\\*\\*(' + prefix + '(?:\\.\\d+){1,2})\\s+([^*]*(?:\\([^)]*\\)[^*]*)*?)[:.]?\\*\\*(.*)$'));
    if (!m) return l;
    n++;
    const rest = m[3].trim();
    return '### ' + m[1] + ' ' + m[2].trim() + NL + NL + (rest ? rest : '');
  }).filter((l, i, arr) => !(l === '' && arr[i - 1] === ''));
  if (n) writeFileSync(p, out.join(NL), 'utf8');
  rep.push(file + ' promote-' + prefix.replace('\\', '') + ': ' + (n ? n + ' heading' : 'MISS'));
};
promote('ENV_CONTRACT.md', '6');
promote('MIGRATION_SOP.md', '5');

console.log(rep.join(NL));
