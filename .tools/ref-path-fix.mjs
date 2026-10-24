import fs from 'node:fs';

const edits = [
  ['docs/UI_UX_DESIGN.md', '/* apps/web/src/styles/velzon-theme.css — potongan :root */', '/* apps/web/src/app/globals.css — potongan :root */'],
  ['docs/UI_UX_DESIGN.md', '| `apps/web/src/styles/velzon-theme.css` |', '| `apps/web/src/app/globals.css` |'],
  ['docs/ROADMAP_TASKS.md', '`apps/web/src/app/globals.css`, `apps/web/src/styles/velzon-theme.css`,', '`apps/web/src/app/globals.css` (design system digabung ke sini, lihat UI_UX_DESIGN §1.2),'],
  ['docs/PROGRESS_REPORT.md', '[`velzon-theme.css`](file:///c:/SICA/apps/web/src/styles/velzon-theme.css)', '[design system di `globals.css`](file:///c:/SICA/apps/web/src/app/globals.css)'],
  ['docs/PROGRESS_REPORT.md', 'di `velzon-theme.css` + `tailwind', 'di design system `globals.css` + `tailwind'],
  ['docs/PROGRESS_REPORT.md', 'blok "Jembatan migrasi token" di `velzon-theme.css` **DIHAPUS**', 'blok "Jembatan migrasi token" **DIHAPUS**'],
  ['docs/AUDIT_READINESS.md', '(nyata `styles/velzon-theme.css`)', '(nyata `src/app/globals.css` setelah penggabungan 2026-10-19)'],
];

for (const [file, from, to] of edits) {
  const text = fs.readFileSync(file, 'utf8');
  const count = text.split(from).length - 1;
  if (count === 0) {
    console.log('LEWAT (tidak cocok) ' + file + ' :: ' + from.slice(0, 60));
    continue;
  }
  fs.writeFileSync(file, text.split(from).join(to), 'utf8');
  console.log('OK ' + count + 'x  ' + file + ' :: ' + from.slice(0, 60));
}
