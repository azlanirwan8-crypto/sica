import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
const NL = String.fromCharCode(10);

const DOCS = readdirSync('docs').filter((f) => f.endsWith('.md'));
const read = (f) => readFileSync('docs/' + f, 'utf8');

const maxNum = (file, re) => {
  const s = read(file);
  let m = 0;
  for (const x of s.matchAll(re)) m = Math.max(m, Number(x[1]));
  return m;
};

console.log('== dokumen ==', DOCS.length + 1, '(docs + AGENTS.md)');

console.log('-- angka silang (harus konsisten antar-berkas) --');
console.log('FR families:', [...new Set((read('PRD.md').match(/FR-[A-Z0-9]+-/g) || []))].sort().join(' '));
console.log('FR unik   :', new Set(read('PRD.md').match(/FR-[A-Z0-9]+-[0-9]+/g) || []).size);
console.log('BR unik   :', new Set(read('PRD.md').match(/BR-[A-Z0-9]+[0-9]*/g) || []).size);
console.log('AC unik   :', new Set(read('PRD.md').match(/AC-[A-Z0-9]+-[0-9]+/g) || []).size);
console.log('API error max  :', maxNum('API_SPEC.md', /^\| ([0-9]{2,3}) \| [45][0-9]{2} \|/gm));
console.log('RBAC izin max  :', maxNum('RBAC_MATRIX.md', /^\| ([0-9]{2,3}) \| `[a-z]/gm));
console.log('ALG ids        :', [...new Set((read('ARCHITECTURE.md').match(/ALG-[0-9]+/g) || []))].sort((a, b) => Number(a.slice(4)) - Number(b.slice(4))).join(','));
console.log('SC-G kontrol   :', new Set(read('SECURITY_COMPLIANCE.md').match(/SC-G[0-9]-[0-9]+/g) || []).size);
console.log('RD max         :', maxNum('AUDIT_READINESS.md', /RD-([0-9]{2})/g));
console.log('G   max        :', maxNum('RBAC_MATRIX.md', /G-([0-9]{2})/g));
console.log('SEC- max       :', maxNum('SECURITY_COMPLIANCE.md', /SEC-([0-9]{2})/g));

console.log('-- nomor migrasi terdaftar vs berkas nyata --');
const reg = new Set((read('DATA_MODEL.md').match(/\b00[0-9]{2}_[a-z0-9_]+\.sql/g) || []));
const nums = [...reg].map((x) => x.slice(0, 4)).sort();
console.log('terdaftar :', nums.length, 'nomor; tertinggi', nums[nums.length - 1]);
const files = existsSync('packages/database/migrations') ? readdirSync('packages/database/migrations') : [];
console.log('berkas    :', files.length, JSON.stringify(files));

console.log('-- ukuran --');
for (const f of [...DOCS, '../AGENTS.md']) {
  const s = f.startsWith('../') ? readFileSync(f.replace('../', ''), 'utf8') : read(f);
  console.log(String(f).padEnd(26), s.split(NL).length);
}

console.log('-- frasa rujukan basi (harus 0 kecuali sengaja) --');
for (const f of DOCS) {
  const s = read(f);
  for (const pat of ['berhenti di', 'rujukan hantu', 'belum ditulis', 'bagian itu belum ada', 'pernah ada di', 'TODO', 'TBD']) {
    let n = 0;
    s.split(NL).forEach((l, i) => {
      if (l.includes(pat)) { n++; }
    });
    if (n) console.log('  ', f, JSON.stringify(pat), n);
  }
}
