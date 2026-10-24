/**
 * m02-ddl-headings.mjs — scratch kajian: untuk setiap `CREATE TABLE` milik objek yang dipakai M-02,
 * cetak heading terdekat dan apakah heading itu sudah menyebut modul. Ini yang menentukan apakah
 * kolom `Tabel` di laporan naik setelah pelabelan, atau tetap 0 karena label ditaruh di tempat yang
 * tidak dibaca alat (`module-provenance` hanya melihat heading terdekat yang menyebut `M-xx`).
 */
import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const dm = readFileSync('docs/DATA_MODEL.md', 'utf8').split(NL);
const OBJ = ['reference_kinds', 'reference_items', 'reference_dictionary_entries', 'reference_kind_usage',
  'master_lookup_groups', 'master_lookup_items', 'tenant_custom_attributes', 'custom_attribute_history',
  'master_system_parameters', 'parameter_history', 'menu_items', 'menu_permissions', 'parameter_permissions',
  'academic_rules', 'tenant_settings', 'nim_patterns', 'reference_item_values'];
const heads = dm.map((l, i) => (/^#{2,6}\s+\d/.test(l) ? i : -1)).filter((i) => i >= 0);
const near = (n) => { let b = -1; for (const h of heads) if (h < n) b = h; else break; return b; };
for (const o of OBJ) {
  dm.forEach((l, i) => {
    if (!new RegExp('^\\s*CREATE TABLE (IF NOT EXISTS )?[\\w.]*\\b' + o + '\\b', 'i').test(l)) return;
    const h = near(i);
    const label = h >= 0 ? dm[h].replace(/^#+\s*/, '') : '(tanpa heading)';
    const mods = (label.match(/(?<![A-Za-z0-9])M-\d\d(?![0-9])/g) || []).join(',') || 'TANPA LABEL';
    console.log((mods === 'TANPA LABEL' ? '  BUTUH ' : '  sudah ') + o.padEnd(30) + 'L' + (i + 1) + ' · heading ' + (h + 1) + ': ' + label.slice(0, 74) + ' · modul=' + mods);
  });
}
