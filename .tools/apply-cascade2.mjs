import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);

// 1. pecah frag-cascade.txt menjadi blok per-tujuan
const raw = readFileSync('.tools/frag-cascade.txt', 'utf8');
const parts = {};
let cur = null;
for (const line of raw.split(NL)) {
  const m = line.match(/^@@@BLOCK (\w+)$/);
  if (m) { cur = m[1]; parts[cur] = []; continue; }
  if (cur) parts[cur].push(line);
}
const text = (k) => parts[k].join(NL).trim();

function insertBefore(target, anchor, block) {
  let t = readFileSync(target, 'utf8');
  if (t.includes(block.split(NL)[0].slice(0, 44))) { console.log('dilewati: ' + target); return; }
  const i = t.indexOf(anchor);
  if (i < 0) { console.error('ANCHOR hilang di ' + target + ': ' + anchor.slice(0, 40)); return; }
  t = t.slice(0, i) + block + NL + NL + t.slice(i);
  writeFileSync(target, t, 'utf8');
  console.log('sisip ' + target + ' sebelum "' + anchor.slice(0, 26) + '"');
}
function appendTo(target, block) {
  let t = readFileSync(target, 'utf8');
  if (t.includes(block.split(NL)[0].slice(0, 44))) { console.log('dilewati: ' + target); return; }
  t = t.replace(/\s+$/, NL + NL) + block + NL;
  writeFileSync(target, t, 'utf8');
  console.log('tempel ' + target);
}

insertBefore('docs/RBAC_MATRIX.md', '### 4.6 Scope SITE', text('rbac'));
appendTo('docs/SECURITY_COMPLIANCE.md', text('security'));
insertBefore('docs/ROADMAP_TASKS.md', '## Phase 3: Mobile MVP & Dynamic QR Attendance', text('roadmap'));
appendTo('docs/API_SPEC.md', text('apispec'));
appendTo('docs/ARCHITECTURE.md', readFileSync('.tools/frag-arch138.md', 'utf8').trim());
