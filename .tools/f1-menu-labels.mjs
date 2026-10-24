/**
 * Satu-kali (F-1, 2026-10-24): pindahkan kalimat spesifikasi daun menu dari `label` ke
 * `description`, lalu beri daun itu nama navigasi pendek ala Velzon/Sevima.
 *
 * Register pemetaannya ada di `docs/BLUEPRINT_ROLE_BY_ROLE.md §12.7`; angka dan ambangnya
 * diukur (`> 30 karakter`, 38 dari 56 daun). Nama KELOMPOK sengaja tidak disentuh — itu
 * judul yang pemilik kunci verbatim di §12.6, termasuk yang panjangnya 45 karakter.
 *
 * Script ini meninggalkan jejak di `.tools/` sebagai provenansi (sama seperti `gen-0093.mjs`),
 * bukan sebagai penjaga CI: penjaganya `verify:menu` + `tests/unit/menu-tree.test.ts` yang
 * membandingkan teks §12 terhadap `description ?? label`.
 */
import fs from 'node:fs';

const FILE = 'apps/web/src/modules/authz/menu-tree.ts';

/** code → [nama nav id, nama nav en]. Teks lama pindah utuh ke description/descriptionEn. */
const MAP = {
  'platform.monitoring.resource': ['Monitor Sumber Daya', 'Resource Monitor'],
  'platform.monitoring.gis': ['Sebaran Pengguna', 'User Distribution'],
  'platform.monitoring.security_log': ['Log Keamanan', 'Security Log'],
  'platform.licensing.directory': ['Direktori Perguruan Tinggi', 'Institution Directory'],
  'platform.licensing.addons': ['Add-on & Lisensi', 'Add-ons & Licences'],
  'platform.licensing.quotas': ['Kuota & Masa Berlaku', 'Quotas & Expiry'],
  'platform.licensing.billing': ['Tagihan Langganan', 'Subscription Billing'],
  'platform.master.lookup': ['Kamus Baku Dikti', 'National Dictionary'],
  'platform.master.region': ['Wilayah BPS & Kemendagri', 'Region Dictionary'],
  'platform.master.core_rules': ['Aturan Inti Sistem', 'Core System Rules'],
  'platform.governance.chain': ['Rantai Audit Global', 'Global Audit Chain'],
  'platform.governance.pii': ['Aturan PII & Privasi', 'PII & Privacy Rules'],
  'platform.governance.gateway': ['API Gateway & Rate Limiter', 'API Gateway & Rate Limiter'],
  'platform.governance.support': ['Dukungan Terawasi', 'Supervised Support'],
  'admin.monitoring.health': ['Kesehatan Server', 'Server Health'],
  'admin.monitoring.gis': ['Sebaran Pengguna', 'User Distribution'],
  'admin.monitoring.login_alert': ['Alert Sesi Login', 'Login Alerts'],
  'admin.institution.profile': ['Profil Instansi', 'Institution Profile'],
  'admin.institution.catalog': ['Katalog Modul', 'Module Catalogue'],
  'admin.institution.flags': ['Toggle Operasional', 'Local Toggles'],
  'admin.institution.saas_billing': ['Tagihan SaaS', 'SaaS Billing Status'],
  'admin.parameters.reference': ['Referensi Operasional', 'Operational References'],
  'admin.parameters.system': ['Ambang SKS & Presensi', 'SKS & Attendance Limits'],
  'admin.parameters.gateway': ['Gateway Notifikasi', 'Notification Gateway'],
  'admin.parameters.meta': ['Meta Form & Laporan', 'Form & Report Meta'],
  'admin.identity.accounts': ['Akun Sivitas', 'Academic Accounts'],
  'admin.identity.rbac': ['Matriks Hak Akses', 'Access Matrix'],
  'admin.identity.sso': ['Single Sign-On', 'Single Sign-On'],
  'admin.identity.dsar': ['Konsol Privasi', 'Privacy Console'],
  'admin.identity.audit': ['Log Aktivitas', 'Activity Log'],
  'admin.integrations.feeder': ['Feeder PDDikti', 'PDDikti Feeder'],
  'admin.integrations.sister': ['Binding SISTER', 'SISTER Binding'],
  'admin.integrations.vicon': ['Kanal Teams / Zoom', 'Teams / Zoom Channel'],
  'admin.integrations.sivil': ['PIN SIVIL', 'SIVIL PIN'],
  'admin.operations.backup': ['Cadangan Data', 'Backup & Restore'],
  'admin.operations.cache': ['Pemantau Cache', 'Cache Monitor'],
  'admin.operations.queue': ['Monitor Antrean', 'Queue Monitor'],
  'admin.operations.feeder_queue': ['Antrean Feeder', 'Feeder Queue'],
};

const src = fs.readFileSync(FILE, 'utf8');
const marks = [...src.matchAll(/code:\s*'([^']+)'/g)];
const labelRe = /label:\s*(?:\r?\n\s*)?'((?:[^'\\]|\\.)*)'/;
const labelEnRe = /labelEn:\s*(?:\r?\n\s*)?'((?:[^'\\]|\\.)*)'/;

const edits = [];
for (let i = 0; i < marks.length; i += 1) {
  const code = marks[i][1];
  const next = i + 1 < marks.length ? marks[i + 1].index : src.length;
  const bodyStart = marks[i].index + marks[i][0].length;
  const plan = MAP[code];
  if (!plan) continue;
  const body = src.slice(bodyStart, next);
  const l = labelRe.exec(body);
  const le = labelEnRe.exec(body);
  if (!l || !le) throw new Error(`${code}: label/labelEn tidak ditemukan`);
  if (l[1].length <= 30) throw new Error(`${code}: ambang F-1 (>30) tidak cocok dengan label terukur (${l[1].length})`);
  if (plan[0].length > 30) throw new Error(`${code}: nama nav usulan masih > 30 karakter`);
  const lineStartInBody = body.lastIndexOf('\n', le.index) + 1;
  const indent = /^[ \t]*/.exec(body.slice(lineStartInBody))?.[0] ?? '            ';
  const lineStart = bodyStart + le.index;
  const lineEnd = lineStart + le[0].length;
  const tail = `\n${indent}description: '${l[1]}',\n${indent}descriptionEn: '${le[1]}'`;
  edits.push({ code, from: bodyStart + l.index, to: lineEnd, text: `label: '${plan[0]}',\n${indent}labelEn: '${plan[1]}',${tail}` });
}

const mapped = new Set(edits.map((e) => e.code));
for (const code of Object.keys(MAP)) if (!mapped.has(code)) throw new Error(`${code}: tidak ditemukan di pohon`);
if (edits.length !== Object.keys(MAP).length) throw new Error(`Jumlah suntingan ${edits.length} ≠ pemetaan ${Object.keys(MAP).length}`);

let out = src;
for (const e of edits.sort((a, b) => b.from - a.from)) out = out.slice(0, e.from) + e.text + out.slice(e.to);
fs.writeFileSync(FILE, out);
console.log(`✅ F-1 diterapkan pada ${edits.length} daun: nama nav pendek di \`label\`, teks spesifikasi pindah ke \`description\`.`);
