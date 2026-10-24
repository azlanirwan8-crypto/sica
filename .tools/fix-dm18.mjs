import { readFileSync, writeFileSync } from 'node:fs';

const file = 'C:/SICA/docs/DATA_MODEL.md';
let s = readFileSync(file, 'utf8');

const jobs = [
  { n: 'typo-kenapa', a: 'Kenapi kolom `text`', b: 'Kenapa kolom `text`' },
  { n: 'typo-ususan', a: 'menyentuh kolom sumber akademik (ususan staging hanya)', b: 'menyentuh kolom sumber akademik (kolom staging saja)' },
  { n: 'typo-memberikannya', a: 'tanpa DDL — gugus ini memberikannya:', b: 'tanpa DDL — gugus ini menuliskannya:' },
  {
    n: 'fix-weight-check',
    a: "  weight_bp int CHECK (kind = 'SOFT' AND weight_bp BETWEEN 1 AND 10000 OR kind = 'HARD'),",
    b: "  weight_bp int CHECK ((kind = 'SOFT' AND weight_bp BETWEEN 1 AND 10000) OR (kind = 'HARD')),",
  },
  {
    n: 'fix-autofix-checks',
    a: "  CHECK (kind IN ('SEMANTIC','BLOCKING') OR fix_expr IS NOT NULL),\n  CHECK (kind IN ('SEMANTIC','BLOCKING') AND fix_expr IS NULL OR kind NOT IN ('SEMANTIC','BLOCKING')),",
    b: "  CHECK ((kind IN ('SEMANTIC','BLOCKING','IDENTITY') AND fix_expr IS NULL) OR (kind IN ('FORMAT','ENRICH') AND fix_expr IS NOT NULL)),",
  },
  {
    n: 'drop-notes-unique',
    a: "  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,\n  UNIQUE (tenant_id, student_id, advisor_membership_id, created_at)\n);",
    b: "  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz\n);\nCREATE INDEX idx_advnote_student ON advisor_notes(tenant_id, student_id, created_at DESC);",
  },
  {
    n: 'typo-pemersatu',
    a: 'karena itu dua baris', b: 'karena itu dua baris',
  },
];

const report = [];
for (const j of jobs) {
  const found = s.includes(j.a);
  if (found) s = s.replace(j.a, j.b);
  report.push(`${j.n}: ${found ? 'OK' : 'TIDAK KETEMU'}`);
}

writeFileSync(file, s, 'utf8');
console.log(report.join('\n'));

const lines = s.split('\n');
const bad = [];
lines.forEach((line, i) => {
  for (let c = 0; c < line.length; c += 1) {
    const code = line.codePointAt(c);
    const hit =
      (code >= 0x3040 && code <= 0x30ff) ||
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0x0e00 && code <= 0x0e7f) ||
      (code >= 0x0400 && code <= 0x04ff);
    if (hit) {
      bad.push(`${i + 1} U+${code.toString(16).toUpperCase()} :: ${line.slice(Math.max(0, c - 45), c + 45)}`);
      break;
    }
  }
});
console.log('non-Latin sisa:', bad.length);
bad.forEach((b) => console.log(b));
