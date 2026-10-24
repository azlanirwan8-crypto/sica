import fs from 'node:fs';

const file = 'apps/web/src/styles/velzon-theme.css';
const lines = fs.readFileSync(file, 'utf8').split('\n');

const openRe = /\.(btn|badge)-(soft|label)-(primary|secondary|success|info|warning|danger|neutral)\b/;
const eyebrowRe = /\.eyebrow\b/;
const colorRe = /(^|[;{\s])(color:\s*)(?:var\(--sica-[a-z0-9-]+\)|#[0-9a-fA-F]{6})(\s*;)/;

let tone = null;
let changed = 0;
const report = [];

lines.forEach((line, idx) => {
  const open = line.match(openRe);
  if (open) {
    tone = open[3];
  } else if (eyebrowRe.test(line)) {
    tone = 'primary';
  }

  if (tone && colorRe.test(line)) {
    const next = line.replace(colorRe, (_m, p1, p2, p3) => p1 + p2 + 'var(--sica-on-' + tone + '-soft)' + p3);
    if (next !== line) {
      lines[idx] = next;
      changed++;
      report.push(idx + 1 + ': ' + next.trim().slice(0, 130));
    }
  }

  if (line.trim() === '}') tone = null;
});

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log(report.join('\n'));
console.log('changed=' + changed);
