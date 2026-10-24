import fs from 'node:fs';
import path from 'node:path';

const dir = 'apps/web/.next/static/css';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.css'));
const css = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');

const families = [
  'badge-soft-primary', 'badge-soft-secondary', 'badge-soft-success', 'badge-soft-info',
  'badge-soft-warning', 'badge-soft-danger', 'badge-soft-neutral',
  'badge-label-primary', 'badge-label-warning', 'badge-label-danger', 'badge-label-success',
  'badge-label-info', 'badge-label-secondary',
  'btn-soft-primary', 'btn-soft-secondary', 'btn-soft-info', 'btn-soft-warning', 'btn-soft-danger',
  'btn-label-primary',
  'avatar-xxs', 'avatar-xs', 'avatar-sm', 'avatar-md', 'avatar-lg', 'avatar-xl',
  'avatar', 'avatar-title',
  'status-dot', 'status-dot-online', 'status-dot-busy', 'status-dot-away', 'status-dot-offline',
  'progress', 'progress-bar', 'progress-sm', 'progress-lg',
  'skeleton', 'card', 'card-header', 'card-body', 'card-footer', 'card-title',
  'main-content', 'page-content', 'navbar-header', 'page-title', 'section-label', 'eyebrow',
  'velzon-input', 'field-label', 'field-hint', 'field-error', 'table-head', 'table-row',
  'dropdown-menu', 'dropdown-item', 'overlay-backdrop', 'elevated-panel', 'card-hover',
];

const missing = [];
for (const cls of families) {
  const re = new RegExp('\\.' + cls.replace(/[-]/g, '\\-') + '(?![a-zA-Z0-9_-])');
  if (!re.test(css)) missing.push(cls);
}
console.log('CSS build = ' + css.length + ' byte, diperiksa ' + families.length + ' kelas komponen');
console.log('HILANG di-purge (' + missing.length + '):');
console.log('  ' + (missing.join(', ') || '(tidak ada)'));
