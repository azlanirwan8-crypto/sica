import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const rd = (f) => readFileSync('C:/SICA/docs/' + f, 'utf8');
const L = (f) => rd(f).split(NL);
const out = [];
const say = (s) => out.push(s);

/* 1. izin per M di SELURUH katalog RBAC (§4.1–4.4 normatif + §4.5/§4.5.1 usulan) */
{
  const b = L('RBAC_MATRIX.md');
  const codes = new Set();
  for (const l of b) {
    const m = l.match(/\|\s*`?([a-z_]+(?:\.[a-z_]+)+)`?\s*\|/g);
    if (!m) continue;
    for (const x of m) { const k = x.match(/[a-z_]+(?:\.[a-z_]+)+/)[0]; codes.add(k); }
  }
  say('kode izin unik yang muncul di RBAC_MATRIX = ' + codes.size);
  const normRows = b.filter((l) => /^\|\s*\d+\s*\|\s*`[a-z_]+\.[a-z_]/.test(l)).length;
  say('baris bernomor di katalog §4 = ' + normRows + ' (normatif 222 + usulan 50+76+19+16+130 = 291 → 513 target)');
}

/* 2. peran: ROLE_CODES nyata vs yang dirujuk dokumen */
{
  const authz = readFileSync('C:/SICA/packages/contracts/src/authz.ts', 'utf8');
  const m = authz.match(/ROLE_CODES = \[([\s\S]*?)\]/);
  const real = new Set((m ? m[1].match(/'[A-Z][A-Z_0-9]*'/g) || [] : []).map((x) => x.replace(/'/g, '')));
  const doc = rd('RBAC_MATRIX.md') + rd('BLUEPRINT_ROLE_BY_ROLE.md');
  const refd = new Set((doc.match(/\b[A-Z][A-Z_0-9]{3,}\b/g) || []).filter((x) => /_(ADMIN|OFFICER|STAFF|MANAGER|LEADER|LECTURER|AUDITOR|OPERATOR|RECTOR|DEAN|COORDINATOR|SECRETARY|TREASURER|ASSURER)$/.test(x) || real.has(x)));
  const missing = [...refd].filter((r) => !real.has(r) && /^[A-Z_]+$/.test(r)).sort();
  say('ROLE_CODES nyata = ' + real.size + ' :: ' + [...real].sort().join(','));
  say('disebut dokumen tapi TIDAK ada di ROLE_CODES (' + missing.length + '): ' + missing.join(','));
}

/* 3. parameter: register DATA_MODEL §21.2 + kunci PRD §5.14 */
{
  const dm = rd('DATA_MODEL.md');
  const s = dm.search(/^#{2,4} 21\.2 /m);
  const e = dm.search(/^#{2,4} 21\.3 /m);
  const sec = dm.slice(s, e);
  const keys = new Set((sec.match(/`([a-z][a-z0-9_]*(?:\.[a-z0-9_]+){1,4})`/g) || []).map((x) => x.replace(/`/g, '')));
  say('kunci parameter di DATA_MODEL §21.2 = ' + keys.size);
  say('contoh 12: ' + [...keys].slice(0, 12).join(', '));
  const prd = rd('PRD.md');
  const s5 = prd.search(/^#{2,4} 5\.14 /m);
  const tail5 = prd.slice(s5, prd.search(/^## 6\./m, s5));
  const fr = new Set((tail5.match(/\bFR-[A-Z]{2,5}-\d{2,3}\b/g) || []));
  say('FR yang disebut PRD §5.14 = ' + fr.size);
  const br = new Set((tail5.match(/\bBR-[A-Z]{1,4}\d{1,3}\b/g) || []));
  const ac = new Set((tail5.match(/\bAC-[A-Z]{2,5}-\d{1,2}\b/g) || []));
  say('BR disebut = ' + br.size + ' · AC disebut = ' + ac.size);
}

/* 4. rute per M di SELURUH API_SPEC (bukan hanya §7) */
{
  const b = L('API_SPEC.md');
  const per = new Map();
  let curHead = '';
  for (const l of b) {
    if (/^#{3,5} \d/.test(l)) { curHead = l; continue; }
    if (!/^\|\s*`?(GET|POST|PATCH|PUT|DELETE|WS)`?/.test(l)) continue;
    const ms = curHead.match(/M-\d{2}/g) || [];
    for (const m of ms) per.set(m, (per.get(m) ?? 0) + 1);
    if (!ms.length) { const path = (l.match(/`(\/[a-z0-9{}/._-]+)`/) || [])[1]; if (path) per.set('__tanpa_label__', (per.get('__tanpa_label__') ?? 0) + 1); }
  }
  const labeled = [...per.entries()].filter(([k]) => k !== '__tanpa_label__');
  say('M dengan rute berlabel di heading API_SPEC = ' + labeled.length + ' · baris rute tanpa M di heading = ' + (per.get('__tanpa_label__') ?? 0));
}

/* 5. keterwakilan M di UI (seluruh berkas, tiap M disebut berapa kali) */
{
  const ui = rd('UI_UX_DESIGN.md');
  const cnt = new Map();
  for (const m of ui.match(/M-\d{2}/g) || []) cnt.set(m, (cnt.get(m) ?? 0) + 1);
  const thin = [...cnt.entries()].filter(([, v]) => v <= 2).sort((a, b) => a[1] - b[1]);
  say('M yang hanya disebut ≤2 kali di UI_UX (' + thin.length + '): ' + thin.map(([k, v]) => k + '=' + v).join(','));
}

console.log(out.join(NL));
