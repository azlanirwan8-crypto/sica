import { readFileSync, readdirSync, existsSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';
const SCHEMA = 'C:/SICA/apps/web/src/config/env.ts';

/* Perbandingan tiga himpunan variabel, karena ketiganya selama ini dikutip sebagai
   satu kebenaran padahal berbeda rumah:
   (a) YANG DEKLARASI di skema validasi runtime (fail-fast bila hilang),
   (b) YANG DIDATAKAN di ENV_CONTRACT (kontrak yang dibaca manusia),
   (c) YANG DIRUJUK dokumen lain (INTEGRATIONS/SECURITY/PRD/ARCHITECTURE).
   Arah temuan: (c)−(a) = rujukan yatim; (b)−(a) = kontrak mendahului kode (boleh,
   tetapi wajib berstatus design-only); (a)−(b) = variabel yang diverifikasi tanpa dokumen. */

const VAR = /\b([A-Z][A-Z0-9_]{3,})\b/g;
const RESERVED = new Set(['ENV', 'DEV', 'PROD', 'STAGING', 'NEXT_PUBLIC_BASE_URL', 'ID', 'UUID', 'SQL', 'HTTP', 'HTTPS', 'JWT', 'API', 'JSON', 'YAML', 'JSONB', 'TEXT', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'READ', 'VALIDATE', 'OTHER', 'TRUE', 'FALSE', 'NULL', 'MFA', 'SSO', 'PDDIKTI', 'SIAKAD', 'TTL', 'QR', 'OK', 'HIGH', 'CRITICAL', 'LOW', 'P0', 'P1', 'P2', 'P3']);

const schemaSrc = existsSync(SCHEMA) ? readFileSync(SCHEMA, 'utf8') : '';
/* skema menuliskan prop sebagai `NAME: z.string()` — itulah nama variabel environment-nya */
const declared = new Set();
const props = [...schemaSrc.matchAll(/(?:^|[\s{,])([A-Z][A-Z0-9_]{3,})\s*:\s*z\./g)].map((m) => m[1]);
for (const p of props) declared.add(p);

const contract = new Set();
{
  const s = readFileSync(D + 'ENV_CONTRACT.md', 'utf8');
  for (const m of s.matchAll(/`([A-Z][A-Z0-9_]{3,})(?:`|`?\s*(?:dan|,)\s*`)/g)) if (!RESERVED.has(m[1]) && !/^\d/.test(m[1])) contract.add(m[1]);
  for (const m of s.matchAll(/\b([A-Z][A-Z0-9_]{4,})\b/g)) if (/_(KEY|SECRET|TOKEN|URL|REF|ENDPOINT|ID|STATE|TTL|MODE|PASS|PHRASE|SALT)$/.test(m[1]) && m[1] !== 'X_TENANT_ID') contract.add(m[1]);
}

const referrers = ['INTEGRATIONS.md', 'SECURITY_COMPLIANCE.md', 'PRD.md', 'ARCHITECTURE.md', 'DEPLOYMENT_DEVOPS.md', 'DATA_MODEL.md', 'API_SPEC.md'];
const referenced = new Map();
for (const f of referrers) {
  const s = readFileSync(D + f, 'utf8');
  s.split(NL).forEach((line) => {
    if (line.includes('env-drift-quoted')) return;   /* kutipan nama yang sudah kalah — bukan rujukan hidup */
    for (const m of line.matchAll(/`([A-Z][A-Z0-9_]{4,})`/g)) {
      const v = m[1];
      if (RESERVED.has(v)) continue;
      if (!/_(KEY|SECRET|TOKEN|URL|REF|ENDPOINT|ID|STATE|TTL|MODE|SALT|PHRASE)$/.test(v) && !/^NEXT_PUBLIC_/.test(v) && !/^DATABASE_|^REDIS_|^JWT_|^S3_|^MAIL_/.test(v)) continue;
      if (!referenced.has(v)) referenced.set(v, []);
      if (referenced.get(v).length < 3) referenced.get(v).push(f.replace('.md', ''));
    }
  });
}

/* Nama kode error (mis. `INVALID_TOKEN`, `FAILED_TOKEN`) bukan variabel environment —
   dipindai dari register API_SPEC §2.3 supaya tidak ikut dilaporkan sebagai yatim. */
const errorNames = new Set([...readFileSync(D + 'API_SPEC.md', 'utf8').matchAll(/^\|\s*\d{1,3}\s*\|[^|]*\|\s*`([A-Z0-9_]+)`/gm)].map((m) => m[1]));

/* (i) token status yang kebetulan berbentuk seperti nama env (`INVALID_TOKEN` di muatan
   verifikasi, `FAILED_TOKEN` di catatan webhook) — bukan variabel environment;
   (ii) variabel yang membacanya lewat `process.env` langsung dan karena itu sudah punya
   temuan sendiri (`SEC-29`): tetap dilaporkan, tetapi sebagai "sudah tercatat". */
const NAMA_STATUS = new Set(['INVALID_TOKEN', 'FAILED_TOKEN']);
const DIKETAHUI = { ATTENDANCE_HMAC_SECRET: 'SEC-29 (dibaca via `process.env` di qr/generate:71 dan qr/scan:140, melewati kontrak boot)' };

const yatim = [...referenced.keys()].filter((v) => !declared.has(v) && !contract.has(v) && !errorNames.has(v) && !NAMA_STATUS.has(v) && !DIKETAHUI[v]);
const tercatat = [...referenced.keys()].filter((v) => !declared.has(v) && DIKETAHUI[v]);
const kontrakTanpaDeklarasi = [...contract].filter((v) => !declared.has(v) && referenced.has(v));
const deklarasitanpaKontrak = [...declared].filter((v) => !contract.has(v));
console.log('nama kode error yang dikecualikan dari pemindaian = ' + errorNames.size);

console.log('deklarasi skema (`' + SCHEMA.replace('C:/SICA/', '') + '`) = ' + declared.size);
console.log('didaftarkan ENV_CONTRACT = ' + contract.size);
console.log('dirujuk dokumen lain = ' + referenced.size);
console.log('');
console.log('RUJUKAN YATIM (dokumen menyebut, skema tidak mendeklarasi, TIDAK tercatat di ENV_CONTRACT) = ' + yatim.length);
yatim.slice(0, 30).forEach((v) => console.log('  ! ' + v + '  ← ' + referenced.get(v).join(', ')));
console.log('YATIM YANG SUDAH PUNYA TEMUAN (bukan temuan baru, tetapi belum tertutup) = ' + tercatat.length);
tercatat.forEach((v) => console.log('  # ' + v + '  ← ' + DIKETAHUI[v]));
console.log('');
console.log('KONRAK MENDAHULUI KODE (design-only; wajib disebut apa adanya) = ' + kontrakTanpaDeklarasi.length);
kontrakTanpaDeklarasi.slice(0, 30).forEach((v) => console.log('  ~ ' + v));
console.log('');
console.log('DEKLARATIF TANPA PENDAFTARAN DI ENV_CONTRACT = ' + deklarasitanpaKontrak.length);
deklarasitanpaKontrak.slice(0, 20).forEach((v) => console.log('  - ' + v));
console.log('');
console.log(yatim.length === 0
  ? 'env-drift: HIJAU untuk rujukan yatim — setiap variabel yang disebut dokumen sudah terdaftar di ENV_CONTRACT (desain mendahului kode = sah, ditandai `~`) atau deklarasi di skema'
  : 'env-drift: MERAH — ' + yatim.length + ' variabel dirujuk dokumen, tidak dideklarasikan skema, dan tidak didaftarkan ENV_CONTRACT');
