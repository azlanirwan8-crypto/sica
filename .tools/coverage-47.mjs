import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const rd = (f) => readFileSync('C:/SICA/docs/' + f, 'utf8').split(NL);

const mset = (s) => [...new Set((s.match(/M-\d{2}/g) || []))];

/* basis: 48 kode registri */
const prd = rd('PRD.md');
const regStart = prd.findIndex((l) => /^#### 5\.12\.1/.test(l));
const regEnd = prd.findIndex((l) => /^#### 5\.12\.2/.test(l));
const registry = [];
for (const l of prd.slice(regStart, regEnd)) {
  const m = l.match(/^\|\s*(M-\d{2}|APP)\s*\|/);
  if (!m) continue;
  const c = l.split('|').slice(1, -1).map((x) => x.trim());
  registry.push({ code: m[1], name: c[1].split('·')[0].trim(), ent: c[2], status: c[3], frHome: c[4] });
}

/* DDL: heading §22 */
const dm = rd('DATA_MODEL.md').join(NL);
const dmSec = dm.slice(dm.search(/^### 22\.1 /m));
const ddlM = new Set(mset(dmSec.slice(0, dmSec.search(/^### 22\.9/))));

/* API_SPEC §7 gugus → M codes + rows */
const api = rd('API_SPEC.md');
const s7 = api.findIndex((l) => /^### 7\.1\b/.test(l));
const e7 = api.findIndex((l) => /^### 7\.23\b/.test(l));
const routesByM = new Map();
let cur = null;
for (let i = s7; i < e7; i++) {
  const h = api[i].match(/^#{3,4} (7\.\d+)(.*)$/);
  if (h) { cur = h[0]; continue; }
  if (!cur) continue;
  const r = api[i].match(/^\|\s*`?(GET|POST|PATCH|PUT|DELETE|WS)`?/);
  if (!r) continue;
  for (const m of mset(cur)) routesByM.set(m, (routesByM.get(m) ?? 0) + 1);
}

/* UI §17.2 kartu + §18 blok layar */
const ui = rd('UI_UX_DESIGN.md');
const u17 = ui.slice(ui.findIndex((l) => /^### 17\.2/.test(l)), ui.findIndex((l) => /^### 17\.3/.test(l)));
const cards = new Set();
for (const l of u17) { const m = l.match(/^\|\s*(M-\d{2}|APP)\s*\|/); if (m) cards.add(m[1]); }
const u18 = ui.slice(ui.findIndex((l) => /^## 18\./.test(l)), ui.length);
const screens = new Set();
for (const l of u18) { if (/^### 18\.(1[0-2]|[1-9])\b/.test(l)) for (const m of mset(l)) screens.add(m); }

/* RBAC §4.5.1 per M */
const rb = rd('RBAC_MATRIX.md');
const r451 = rb.slice(rb.findIndex((l) => /^#### 4\.5\.1/.test(l)), rb.findIndex((l) => /^### 4\.6 /.test(l)));
const perms = new Map();
for (const l of r451) {
  if (!/^\|\s*\d+\s*\|/.test(l)) continue;
  const c = l.split('|').slice(1, -1).map((x) => x.trim());
  for (const m of mset(c[5])) perms.set(m, (perms.get(m) ?? 0) + 1);
}

/* parameter & kamus: PRD §5.14 */
const prdTxt = prd.join(NL);
const s514 = prdTxt.search(/^#{2,4} 5\.14 /m);
const e514 = prdTxt.slice(s514).search(/^## 6\./m);
const sec514 = prdTxt.slice(s514, s514 + e514);
const paramKeys = new Set((sec514.match(/\b[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){1,3}\b/g) || []).filter((k) => /param|threshold|tolerans|limit|window|radius|rotate|ratio|ttl/i.test(k)));
const frIds = new Set((sec514.match(/\bFR-[A-Z]{2,5}-\d{2}\b/g) || []));

const rows = [];
let zeroDdl = 0, zeroRoute = 0, zeroCard = 0, zeroScreen = 0, zeroPerm = 0;
for (const r of registry) {
  const hasDdl = ddlM.has(r.code);
  const nRoute = routesByM.get(r.code) ?? 0;
  const hasCard = cards.has(r.code);
  const hasScreen = screens.has(r.code);
  const nPerm = perms.get(r.code) ?? 0;
  if (!hasDdl) zeroDdl++;
  if (!nRoute) zeroRoute++;
  if (!hasCard) zeroCard++;
  if (!hasScreen) zeroScreen++;
  if (!nPerm) zeroPerm++;
  rows.push([r.code, r.name, r.status, hasDdl ? 'DDL' : '—', nRoute || '—', hasCard ? 'kartu' : '—', hasScreen ? 'layar' : '—', nPerm || '—'].join(' | '));
}
console.log('| M | Modul | Status | DDL §22 | rute §7 | kartu §17 | blok §18 | izin §4.5.1 |');
console.log('|---|---|---|---|---|---|---|---|');
console.log(rows.join(NL));
console.log(NL + 'REGISTRY=' + registry.length + ' tanpa-DDL-§22=' + zeroDdl + ' tanpa-rute-§7=' + zeroRoute +
  ' tanpa-kartu=' + zeroCard + ' tanpa-blok-layar=' + zeroScreen + ' tanpa-izin-§4.5.1=' + zeroPerm);
console.log('FR di §5.14=' + frIds.size + ' paramKey-cand=' + paramKeys.size);
console.log('parameter keys (maks 40): ' + [...paramKeys].slice(0, 40).join(','));
