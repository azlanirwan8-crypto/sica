import fs from 'node:fs';

const files = process.argv.slice(2);
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  console.log('=== ' + f);
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (/badge-soft|badge-label|btn-soft|btn-label|avatar-|status-dot|progress-|-' \+|-`/.test(l)) {
      console.log('  ' + (i + 1) + ': ' + l.trim().slice(0, 150));
    }
  });
}
