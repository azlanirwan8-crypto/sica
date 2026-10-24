import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);

function appendOrInsert(target, frag, mode, anchor) {
  let t = readFileSync(target, 'utf8');
  const head = readFileSync(frag, 'utf8').trim();
  const marker = head.split(NL)[0].slice(0, 40);
  if (t.includes(marker)) { console.log('dilewati (sudah ada): ' + target + ' :: ' + marker); return; }
  if (mode === 'before') {
    const i = t.indexOf(anchor);
    if (i < 0) { console.error('ANCHOR hilang di ' + target + ': ' + anchor.slice(0, 50)); return; }
    t = t.slice(0, i) + head + NL + NL + t.slice(i);
  } else if (mode === 'beforeHeadingAfter') {
    const ai = t.indexOf(anchor);
    if (ai < 0) { console.error('ANCHAR hilang: ' + anchor.slice(0, 40)); return; }
    const rest = t.slice(ai);
    const m = rest.slice(4).search(/^## /m);   // heading `## ` berikutnya setelah anchor
    if (m < 0) { console.error('tidak ada heading ## setelah anchor'); return; }
    const pos = ai + 4 + m;
    t = t.slice(0, pos) + head + NL + NL + t.slice(pos);
  } else {
    t = t.replace(/\s+$/, NL + NL) + head + NL;
  }
  writeFileSync(target, t, 'utf8');
  console.log('ditulis ' + target + ' :: ' + marker);
}

appendOrInsert('docs/ARCHITECTURE.md', '.tools/frag-arch138.md', 'beforeHeadingAfter', '### 13.7 Gerbang CI tambahan');
appendOrInsert('docs/PRD.md', '.tools/frag-prd517.md', 'before', '## 6. Acceptance Criteria (terukur)');
appendOrInsert('docs/UI_UX_DESIGN.md', '.tools/frag-ui19.md', 'append', null);
