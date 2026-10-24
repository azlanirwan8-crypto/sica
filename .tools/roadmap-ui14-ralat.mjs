import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const p = 'C:/SICA/docs/ROADMAP_TASKS.md';
let s = readFileSync(p, 'utf8');
const rep = [];
const job = (label, a, b) => {
  const i = s.indexOf(a);
  if (i === -1) { rep.push(label + ': MISS'); return; }
  if (s.lastIndexOf(a) !== i) { rep.push(label + ': AMBIG'); return; }
  s = s.slice(0, i) + b + s.slice(i + a.length);
  rep.push(label + ': OK');
};

job('roadmap-228',
  'dan `UI_UX_DESIGN.md` **berhenti di §13** sehingga pola layar parameter/menu (`§14`) yang ditunjuk DATA_MODEL §21.9 & PRD §5.11.7 **masih rujukan hantu** — temuan tulis-tersua, bukan pekerjaan file ini.',
  'dan `UI_UX_DESIGN.md` **ketika temuan ini dibuat berhenti di §13**, sehingga pola layar parameter/menu yang ditunjuk DATA_MODEL §21.9 & PRD §5.11.7 sempat menjadi rujukan hantu. **RALAT 2026-10-20 (siklus 5.38): §14 (tata kelola parameter & menu), §15 (kisi RBAC sub-detail) dan §16 (presensi multi-modus) sudah ditulis** — terukur `grep -n "^## 1[456]\\."` pada berkas itu, yang kini 2133 baris. Yang tetap belum nyata adalah **lapisan kodenya**: `grep route_key apps/web/src` = 0, kunci i18n `admin.param.*`/`admin.menu.*` = 0 (UI_UX §14.11).');

job('roadmap-849',
  '**UI_UX §14 = belum ditulis** (rujukan hantu)',
  'UI_UX §14.1–§14.5 (tertulis; kode nol)');

job('roadmap-869',
  'UI_UX_DESIGN.md **berhenti di §13** sehingga pola layar §14 yang ditunjuk DATA_MODEL §21.9/API_SPEC §4.16.7/API_SPEC §5.15 adalah **rujukan hantu** (pola `G-16`).',
  'UI_UX_DESIGN.md §14 yang ditunjuk DATA_MODEL §21.9/API_SPEC §4.16.7/API_SPEC §5.15 **pernah** rujukan hantu (pola `G-16`) dan **sudah ditutup pada 2026-10-20** — §14/§15/§16 tertulis, tetapi nol implementasi (`grep route_key apps/web/src` = 0).');

job('roadmap-891',
  'layar (`SPE-8`, `SPE-11`) sengaja terakhir: `UI_UX §14` masih rujukan hantu dan `G-18` belum punya primitifnya.',
  'layar (`SPE-8`, `SPE-11`) sengaja terakhir: spesifikasi layarnya **sudah ada** (UI_UX §14, diralat 2026-10-20) tetapi `G-18` belum punya primitifnya, jadi layar di atas `allowedActions` yang tidak ada hanya akan menjadi kulit.');

writeFileSync(p, s, 'utf8');
console.log(rep.join(NL));
