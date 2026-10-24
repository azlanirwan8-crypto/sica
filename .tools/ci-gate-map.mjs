/**
 * ci-gate-map.mjs — pemilik pertanyaan: "gerbang CI (huruf) mana yang punya definisi, dan mana yang punya pemeriksa".
 *
 * Alasan ada (RD-102). Dokumen berjanji kepada dua puluh empat "gerbang CI" bernomor huruf — (a)…(f)
 * di ROADMAP §2.5.0, (g)…(l)+(q),(r) di ARCHITECTURE §12.12, (m)…(p) di DATA_MODEL §20.5, dan
 * (s)…(x) di ARCHITECTURE §13.7 — dan norma `AGENTS §3.8`/`§3.9`/`§3.10` menegaskannya sebagai
 * "CI menolak". Tidak ada satu pun alat yang memiliki daftar itu, sehingga sitasi huruf bisa menunjuk
 * udara. `ref-audit.mjs` sudah menyelesaikan kelas yang sama untuk NOMOR bagian; ini versi huruf.
 *
 * Percobaan pertama alat ini (disimpan sebagai pelajaran, bukan dibuang diam-diam): ia mencari butir
 * `- (x)` di SEMUA berkas dan menemukan "24 huruf terdefinisi". Itu salah — huruf (a)…(f) dipakai
 * sebagai enumerasi lokal di API_SPEC, BENCHMARK_SEVIMA, INTEGRATIONS, RBAC, SECURITY, DATA_MODEL
 * untuk hal yang bukan gerbang. Aturan yang benar: hanya JANGKAR yang terdaftar di bawah yang boleh
 * mendefinisikan huruf gerbang, dan kalau jangkar itu berpindah, alat ini berhenti dengan kode 1
 * supaya pendaftarnya ikut diperbarui, bukan supaya verdict jadi hijau.
 *
 * Keluar: daftar huruf, sumber definisinya, baris register `AUDIT_READINESS §19`, dan pemeriksa yang
 * dinyatakan. MERAH bila: ada jangkar hilang · ada sitasi yatim · ada huruf tanpa baris register ·
 * ada baris register berstatus TERPASANG/SEBAGIAN yang menunjuk berkas pemeriksa yang tidak ada.
 * Keluar dengan kode 2 bila perhitungannya bukan bilangan bulat — senyap-hijau karena `NaN` adalah
 * kelas kegagalan yang barusan saya temukan di alat ini sendiri pada penyusunan pertama (`.size`
 * di atas `Array`).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const ANCHORS = [
  { id: 'A1', label: 'ROADMAP §2.5.0 — "Gerbang CI dokumentasi" (a…f)', file: 'docs/ROADMAP_TASKS.md', find: /Gerbang CI dokumentasi/, inline: true },
  { id: 'A2', label: 'ARCHITECTURE §12.12 — gerbang CI tambahan (g…l, q, r)', file: 'docs/ARCHITECTURE.md', find: /^### 12\.12\b/, inline: false },
  { id: 'A3', label: 'ARCHITECTURE §13.7 — gerbang CI tambahan (s…x)', file: 'docs/ARCHITECTURE.md', find: /^### 13\.7\b/, inline: false },
  { id: 'A4', label: 'DATA_MODEL §20 — empat gerbang mesin data master (m…p)', file: 'docs/DATA_MODEL.md', find: /Empat gerbang, semuanya dapat dijalankan di CI/, inline: false },
];

const files = ['AGENTS.md', ...readdirSync('docs').filter((f) => f.endsWith('.md')).map((f) => 'docs/' + f)];
const text = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
const linesOf = (f) => text.get(f).split('\n');

const defined = new Map();
const anchorsMissing = [];

for (const a of ANCHORS) {
  const lines = linesOf(a.file);
  let start = -1;
  for (let i = 0; i < lines.length; i++) if (a.find.test(lines[i])) { start = i; break; }
  if (start < 0) { anchorsMissing.push(a.id + ' (' + a.label + ')'); continue; }
  const bucket = [];
  if (a.inline) {
    let l = lines[start];
    for (let i = start + 1; i < Math.min(lines.length, start + 8); i++) {
      if (/^\s*(?:[-*]\s|\d+\.\s|#{2,5}\s)/.test(lines[i])) break;
      l += ' ' + lines[i];
    }
    for (const m of l.matchAll(/\(([a-z])\)/g)) if (!bucket.includes(m[1])) bucket.push(m[1]);
  } else {
    for (let i = start; i < lines.length; i++) {
      const l = lines[i];
      if (i > start && /^#{2,5}\s/.test(l)) break;
      const m = l.match(/^[\s>]*(?:[-*]|\d+\.)\s*\*{0,2}\(([a-z])\)\*{0,2}\s/);
      if (m) bucket.push(m[1]);
    }
  }
  for (const x of bucket) if (!defined.has(x)) defined.set(x, a.id);
  if (!bucket.length) anchorsMissing.push(a.id + ' (jangkar ada tetapi tidak satu huruf pun terparse)');
}

const cited = new Map();
for (const f of files) {
  linesOf(f).forEach((l, i) => {
    if (!/gerbang/i.test(l)) return;
    for (const m of l.matchAll(/\(([a-z])\)/g)) {
      const key = f + ':' + (i + 1);
      if (!cited.has(m[1])) cited.set(m[1], []);
      cited.get(m[1]).push(key);
    }
  });
}

const ar = linesOf('docs/AUDIT_READINESS.md');
const s19 = ar.findIndex((l) => /^## 19\./.test(l));
const register = new Map();
if (s19 >= 0) {
  const end = ar.findIndex((l, i) => i > s19 && /^## [0-9]/.test(l));
  let ownerCol = -1;
  for (const l of ar.slice(s19, end < 0 ? ar.length : end)) {
    if (!l.startsWith('|')) continue;
    const c = l.split('|').slice(1, -1).map((x) => x.trim());
    if (ownerCol < 0 && /Pemilik hari ini/i.test(l)) { ownerCol = c.findIndex((x) => /Pemilik hari ini/i.test(x)); continue; }
    const letter = (c[0] || '').replace(/\*\*/g, '').replace(/[()]/g, '').trim();
    if (!/^[a-z]$/.test(letter)) continue;
    // Hanya kolom "Pemilik hari ini" yang dibaca mesin. Kalau seluruh baris dipindai, alamat
    // tiket yang disebut di kolom vonis (mis. `scripts/ui-guards/` yang justru BELUM ada)
    // terbaca sebagai pemeriksa yang hilang — tuduhan palsu terhadap dokumen, kelas RD-91.
    const ownerCell = ownerCol >= 0 ? (c[ownerCol] || '') : '';
    const joined = c.join(' ');
    register.set(letter, {
      status: (joined.match(/TERPASANG|SEBAGIAN|BELUM/) || ['(tanpa status)'])[0],
      checkers: [...ownerCell.matchAll(/(?:\.tools|scripts)\/[A-Za-z0-9_\-./]+/g)].map((x) => x[0]),
    });
  }
}

const yatim = [...cited.keys()].filter((x) => !defined.has(x)).sort();
const tanpaRegister = [...defined.keys()].filter((x) => !register.has(x)).sort();
const registerYatim = [...register.keys()].filter((x) => !defined.has(x)).sort();
const alatHilang = [...register.entries()].filter(([, v]) => v.status !== 'BELUM' && v.checkers.some((p) => !existsSync(p)));

console.log('jangkar definisi yang dibaca            = ' + (ANCHORS.length - anchorsMissing.length) + '/' + ANCHORS.length);
for (const m of anchorsMissing) console.log('  MERAH jangkar: ' + m);
console.log('huruf GERBANG terdefinisi (dari jangkar) = ' + defined.size + ' :: ' + [...defined.keys()].sort().join(' '));
console.log('huruf yang dikutip dalam konteks gerbang  = ' + cited.size + ' :: ' + [...cited.keys()].sort().join(' '));
console.log('dikutip tanpa definisi (YATIM)            = ' + yatim.length + (yatim.length ? ' :: ' + yatim.join(' ') : ''));
for (const x of yatim) console.log('  yatim (' + x + ') di: ' + cited.get(x).slice(0, 5).join(', '));
console.log('terdefinisi tanpa baris register §19      = ' + tanpaRegister.length + (tanpaRegister.length ? ' :: ' + tanpaRegister.join(' ') : ''));
console.log('baris register tanpa definisi             = ' + registerYatim.length + (registerYatim.length ? ' :: ' + registerYatim.join(' ') : ''));
console.log('status TERPASANG/SEBAGIAN tapi pemeriksanya tidak ada = ' + alatHilang.length);
for (const [x, v] of alatHilang) console.log('  (' + x + ') kehilangan: ' + v.checkers.filter((p) => !existsSync(p)).join(', '));

const bad = anchorsMissing.length + yatim.length + tanpaRegister.length + registerYatim.length + alatHilang.length;
if (!Number.isInteger(bad) || bad < 0) { console.log('MERAH — perhitungan vonis = ' + bad + ' (bukan bilangan bulat). Tidak ada verdict dari angka yang hilang.'); process.exit(2); }
console.log(bad
  ? 'ci-gate-map: MERAH — ' + bad + ' penolak (rinciannya di atas)'
  : 'ci-gate-map: HIJAU — ' + defined.size + ' huruf gerbang punya definisi di jangkar DAN satu baris register §19, dan setiap yang mengaku TERPASANG punya berkas pemeriksa di disk');
process.exit(bad ? 1 : 0);
