/**
 * fr-ac-gap.mjs — mengukur penahan yang belum dimiliki alat mana pun: FR yang diklaim sebuah modul
 * di registri `PRD §5.12` tetapi TIDAK pernah berpasangan dengan sebuah acceptance criteria.
 *
 * Kenapa ini lahir: M-02 dilaporkan `SPESIFIKASI SIAP` oleh `module-readiness`, padahal enam penahan
 * fungsional tidak melihat AC sama sekali. Definisi "berpasangan" dipakai apa adanya dari cara
 * repository ini menulis: sebuah FR dianggap terjawab oleh AC bila keduanya muncul pada baris yang
 * sama di dokumen mana pun (pola `ROADMAP §2.5.x`: `FR-ADM-17, AC-ADM-3, BR-R20` satu sel).
 * Ini sengaja konservatif: satu kemunculan bersama sudah dihitung terjangkau, jadi angka "belum"
 * adalah batas bawah, bukan tuduhan.
 *
 * Known-answer (dipatok supaya scanner tidak hijau-sia-sia):
 *   · `FR-ADM-17` wajib terbaca terjangkau (`ROADMAP` memasangnya dengan `AC-ADM-3`);
 *   · `FR-VIC-01` wajib terbaca terjangkau (baris 292 RBAC + PRD §5.15 memasangnya dengan AC vicon);
 *   · jumlah FR registri yang terbaca WAJIB sama dengan jumlah baris `FR-` di tabel kebutuhan PRD
 *     yang punya pasangan — kalau salah satu nol, pemindaian berhenti.
 */
import { readFileSync, readdirSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'docs/';
const FR = /\bFR-[A-Z]{2,5}-\d+\b/g;
const AC = /\bAC-[A-Z]{2,5}-\d+\b/g;
const prdName = D + 'PRD.md';
const prd = readFileSync(prdName, 'utf8').split(NL);

const expand = (line) => {
  const found = new Set();
  for (const m of line.matchAll(FR)) found.add(m[0]);
  /* bentuk rentang yang ditulis manusia ada tiga, dan semua harus dibaca:
     `FR-ADM-19…29` (satu prefiks), `FR-ADM-19 … FR-ADM-29` (prefiks diulang), `FR-ADM-07/09/12` (daftar).
     Yang terakhir ini dulu lolos diam-diam: registri M-02 menulis `FR-ADM-07/09/12/19…29` dan alat saya
     hanya membaca sampai 19, sehingga FR-ADM-20…29 — mesin kamus & parameter — tidak pernah terhitung
     milik modulnya. Kelas cacat `RD-109` (scanner menyalahsimpulkan isi dokumen). */
  for (const m of line.matchAll(/\bFR-([A-Z]{2,5})-(\d{1,3})\s*[…–\-\.]{1,3}\s*(?:FR-[A-Z]{2,5}-)?(\d{1,3})\b/g)) {
    const a = Number(m[2]), b = Number(m[3]);
    if (b >= a && b - a < 60) for (let i = a; i <= b; i++) found.add('FR-' + m[1] + '-' + String(i).padStart(2, '0'));
  }
  for (const m of line.matchAll(/\bFR-([A-Z]{2,5})-((?:\d{1,2}[\/,]\s*)+\d{1,2})\b/g)) {
    for (const n of m[2].split(/[\/,]/)) {
      const v = Number(String(n).trim());
      if (Number.isInteger(v)) found.add('FR-' + m[1] + '-' + String(v).padStart(2, '0'));
    }
  }
  return [...found];
};

/* 1. registri modul: baris `| M-xx | nama | sku | status | kebutuhan | tanggung-jawab |`.
   Token `M-xx` muncul di lebih dari satu tabel registri (§5.12 dan partisi §5.12.3), jadi
   baris pertama untuk satu modul yang dipakai dan sisanya di-dedupe — kalau tidak, jumlah
   baris terbaca 94 dan known-answer menjatuhkan pemindaian (cacat kelas `RD-108`). */
const byId = new Map();
for (const l of prd) {
  const m = l.match(/^\|\s*(M-\d\d)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|/);
  if (!m) continue;
  if (!byId.has(m[1])) byId.set(m[1], { id: m[1], nama: m[2].trim().slice(0, 30), frs: [...new Set(expand(l))] });
}
const mods = [...byId.values()];
if (mods.length !== 47) { console.error('MERAH — registri modul terbaca ' + mods.length + ' modul unik; diharapkan 47 (M-01…M-47).'); process.exit(1); }

/* 2. FR yang pernah berpasangan dengan AC di berkas /docs mana pun */
const paired = new Map();
for (const f of readdirSync(D).filter((x) => x.endsWith('.md'))) {
  const txt = readFileSync(D + f, 'utf8').split(NL);
  txt.forEach((l, i) => {
    if (!/\bAC-[A-Z]{2,5}-\d+\b/.test(l)) return;
    const acs = [...l.matchAll(AC)].map((x) => x[0]);
    for (const fr of new Set(expand(l))) {
      if (!paired.has(fr)) paired.set(fr, new Set());
      acs.forEach((a) => paired.get(fr).add(a + '@' + f + ':' + (i + 1)));
    }
  });
}

/* 3. known-answer */
const ka = ['FR-ADM-17', 'FR-VIC-01'];
const hilang = ka.filter((f) => !paired.has(f));
if (hilang.length) { console.error('MERAH — known-answer gagal: ' + hilang.join(', ') + ' tidak terbaca berpasangan dengan AC. Pemindaian dihentikan, tidak ada vonis dicetak.'); process.exit(1); }

const rows = mods.map((x) => {
  const belum = x.frs.filter((f) => !paired.has(f));
  return { ...x, terjangkau: x.frs.length - belum.length, belum };
});
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ rows: rows.map((r) => ({ id: r.id, frs: r.frs.length, paired: r.terjangkau, belum: r.belum })), totalFr: rows.reduce((a, x) => a + x.frs.length, 0) }));
  process.exit(0);
}
const totalFr = rows.reduce((a, x) => a + x.frs.length, 0);
const zero = rows.filter((x) => x.terjangkau === 0);
console.log('| M | Modul | FR diklaim | ber-AC | BELUM ada AC |');
console.log('|---|---|---:|---:|---|');
for (const r of rows) console.log('| ' + r.id + ' | ' + r.nama + ' | ' + r.frs.length + ' | ' + r.terjangkau + ' | ' + (r.belum.length ? r.belum.join(' ') + ' (' + r.belum.length + ')' : '—') + ' |');
console.log(NL + 'FR registri terpetakan = ' + totalFr + ' · pasangan AC unik = ' + paired.size + ' · modul TANPA satu pun FR ber-AC = ' + zero.length + ' (' + zero.map((x) => x.id).join(', ') + ')');
for (const id of ['M-01', 'M-02', 'M-13']) {
  const r = rows.find((x) => x.id === id);
  console.log(id + ': ' + r.frs.join(', '));
  console.log('   ber-AC: ' + (r.frs.filter((f) => paired.has(f)).map((f) => f + '→' + [...paired.get(f)][0].split('@')[0]).join(', ') || '—'));
  console.log('   BELUM : ' + (r.belum.join(', ') || '—'));
}
