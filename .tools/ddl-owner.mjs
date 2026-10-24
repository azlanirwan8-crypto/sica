import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';
const dm = readFileSync(D + 'DATA_MODEL.md', 'utf8');
const bp = readFileSync(D + 'BLUEPRINT_ENTERPRISE.md', 'utf8');

const ddl = [...dm.matchAll(/CREATE (?:OR REPLACE )?TABLE (?:IF NOT EXISTS )?([a-z][a-z0-9_]*)/g)].map((m) => m[1]);
const dup = [...new Set(ddl.filter((v, i) => ddl.indexOf(v) !== i))];

/* nama entitas yang dipakai sebagai baris di seluruh dokumen (kolom pertama \`name\`) */
const owners = new Map();
for (const m of ddl) owners.set(m, (owners.get(m) ?? 0) + 1);

const bpNames = new Set();
for (const l of bp.split(NL)) { const m = l.match(/^\|\s*`([a-z][a-z0-9_]*)`\s*\|/); if (m) bpNames.add(m[1]); }
const collide = [...bpNames].filter((n) => owners.has(n)).sort();
const hasNorm = /\*\*Pemilik nama/.test(bp);

console.log('DATA_MODEL CREATE TABLE: pernyataan=' + ddl.length + ' unik=' + new Set(ddl).size);
console.log('duplikasi nama: ' + (dup.length ? dup.join(',') : 'TIDAK ADA'));
console.log('BLUEPRINT baris entitas=' + bpNames.size + ' · bersinggungan dengan DDL=' + collide.length);
console.log('norma pemilik nama di §4.1: ' + (hasNorm ? 'ADA' : 'TIDAK ADA'));

let fail = 0;
if (dup.length) { console.log('GAGAL: satu nama didefinisikan dua kali (' + dup.join(',') + ')'); fail = 1; }
if (!hasNorm) { console.log('GAGAL: §4 BLUEPRINT tidak menyatakan bahwa DATA_MODEL pemilik kolom'); fail = 1; }
console.log(fail ? 'ddl-owner: MERAH' : 'ddl-owner: HIJAU');
process.exit(fail);
