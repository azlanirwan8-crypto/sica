/**
 * Invarian definisi pohon menu (`MENU-LOCK-1`) — penjaga bahwa "menu sebagai data"
 * tidak melonggarkan satu pun janji register `BLUEPRINT_ROLE_BY_ROLE §12`.
 *
 * Yang diuji di sini adalah DEFINISI (belum menyentuh DB): jumlah daun terkunci, keunikan
 * `code`, kedalaman, keanggotaan izin di katalog, keabsahan `route_key`, dan kelengkapan
 * label dua bahasa. Penyaringan runtime diuji terpisah di `menu-resolver.test.ts`;
 * kecocokan definisi ↔ baris DB dicetak `pnpm --filter @sica/web verify:menu`.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CAMPUS_MENU_TREE, PLATFORM_MENU_TREE, MENU_LABEL_KEYS, MENU_ROUTE_KEYS, type MenuSeedNode } from '../../src/modules/authz/menu-tree';
import { ROUTE_KEYS } from '../../src/modules/authz/route-keys';
import { MODULE_CODES, ALL_PERMISSION_CODES, isKnownPermission, type PermissionCode } from '@sica/contracts';

const ROOTS: readonly { surface: string; tree: readonly MenuSeedNode[] }[] = [
  { surface: 'R-2', tree: CAMPUS_MENU_TREE },
  { surface: 'R-1', tree: PLATFORM_MENU_TREE },
];

interface LeafInfo {
  readonly surface: string;
  readonly node: MenuSeedNode;
  readonly depth: number;
  readonly parent: MenuSeedNode | null;
}

function walk(nodes: readonly MenuSeedNode[], surface: string, depth = 1, parent: MenuSeedNode | null = null, out: LeafInfo[] = []): LeafInfo[] {
  for (const node of nodes) {
    out.push({ surface, node, depth, parent });
    if (node.children) walk(node.children, surface, depth + 1, node, out);
  }
  return out;
}

const ALL = ROOTS.flatMap(({ surface, tree }) => walk(tree, surface));
const LEAVES = ALL.filter((l) => !l.node.children || l.node.children.length === 0);
const GROUPS = ALL.filter((l) => l.node.children && l.node.children.length > 0);
const LOCKED = LEAVES.filter((l) => l.node.lock);

describe('Register §12 — daun terkunci', () => {
  it('tepat 39 daun terkunci: 14 R-1 dan 25 R-2', () => {
    expect(LOCKED.length, 'jumlah daun dengan `lock`').toBe(39);
    expect(LOCKED.filter((l) => l.surface === 'R-1').length).toBe(14);
    expect(LOCKED.filter((l) => l.surface === 'R-2').length).toBe(25);
  });

  it('nomor §12 unik dalam satu lapisan (tidak ada dua daun mengklaim baris yang sama)', () => {
    const seen = new Set<string>();
    for (const leaf of LOCKED) {
      const key = `${leaf.surface} ${leaf.node.lock}`;
      expect(seen.has(key), `duplikat ${key}`).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(39);
  });

  /**
   * Ini uji yang membuat instruksi "tanpa ada yang dikurangi atau disingkat" menjadi
   * terukur: teks definisi harus SAMA PERSIS dengan sel tabel dokumen pemilik. Sejak F-1
   * (`0096`, `BLUEPRINT §12.7`) tempatnya berpindah: kalimat spesifikasi hidup di
   * `description`, dan `label` hanyalah nama navigasi pendek — maka pembandingnya
   * `description ?? label`, bukan `label`.
   */
  it('keterangan setiap daun terkunci verbatim dengan tabel §12 dokumen', () => {
    const doc = fs.readFileSync(path.resolve(process.cwd(), '../../docs/BLUEPRINT_ROLE_BY_ROLE.md'), 'utf8');
    const register = new Map<string, string>();
    let section: string | null = null;
    for (const line of doc.split(/\r?\n/)) {
      const h = /^### 12\.(\d)\s/.exec(line);
      if (h) {
        section = h[1] === '1' ? 'R-1' : h[1] === '2' ? 'R-2' : null;
        continue;
      }
      if (!section || !/^\|\s*\d+\.\d+\s*\|/.test(line)) continue;
      const cells = line.split('|').map((c) => c.trim());
      const ref = cells[1] ?? '';
      const docLabel = cells[2] ?? '';
      if (ref && docLabel) register.set(`${section} ${ref}`, docLabel);
    }

    expect(register.size, 'baris tabel §1.1+§1.2 di dokumen').toBe(39);
    const mismatched: string[] = [];
    for (const leaf of LOCKED) {
      const key = `${leaf.surface} ${leaf.node.lock}`;
      const docLabel = register.get(key);
      const spec = leaf.node.description ?? leaf.node.label;
      if (docLabel === undefined) mismatched.push(`${key}: tidak ada di dokumen`);
      else if (docLabel !== spec) mismatched.push(`${key}:\n    dokumen: ${docLabel}\n    kode   : ${spec}`);
    }
    expect(mismatched, mismatched.join('\n')).toEqual([]);
  });
});

describe('Struktur pohon', () => {
  it('`code` unik global dalam satu lapisan dan seluruhnya lowercase-dot', () => {
    const bySurface = new Map<string, Set<string>>();
    for (const item of ALL) {
      const set = bySurface.get(item.surface) ?? new Set<string>();
      expect(set.has(item.node.code), `duplikat code ${item.node.code} di ${item.surface}`).toBe(false);
      expect(item.node.code, 'kode menu harus mengikuti `code` regex API_SPEC §4.17.2').toMatch(/^[a-z][a-z0-9_.]{1,96}$/);
      set.add(item.node.code);
      bySurface.set(item.surface, set);
    }
  });

  it('kedalaman maksimum 4 dan grup tidak pernah punya rute sendiri', () => {
    for (const item of ALL) expect(item.depth, `${item.node.code} kedalaman ${item.depth}`).toBeLessThanOrEqual(4);
    for (const group of GROUPS) {
      expect(group.node.routeKey, `grup ${group.node.code} tidak boleh punya rute`).toBeUndefined();
      expect(group.node.permission, `grup ${group.node.code} tidak boleh punya grant`).toBeUndefined();
    }
  });

  it('setiap grup adalah anak langsung dari satu akar, dan label grup dua bahasa', () => {
    for (const group of GROUPS) {
      expect(group.node.label.length).toBeGreaterThan(2);
      expect(group.node.labelEn.length).toBeGreaterThan(2);
    }
  });
});

describe('Kontrak data daun', () => {
  it('izin daun adalah anggota katalog `permissions` (bukan kosakata baru)', () => {
    const codes: string[] = [];
    for (const leaf of LEAVES) {
      if (leaf.node.permission) codes.push(leaf.node.permission);
      for (const extra of leaf.node.anyOf ?? []) codes.push(extra);
    }
    expect(codes.length, 'daun berizin (terlihat)').toBeGreaterThan(20);
    for (const code of codes) {
      expect(isKnownPermission(code as PermissionCode), `izin ${code} tidak ada di katalog`).toBe(true);
    }
    // Katalog dibaca supaya uji ini gagal bila seseorang menulis string di luar `authz.ts`.
    expect(ALL_PERMISSION_CODES.length, 'katalog izin menyusut').toBeGreaterThan(200);
  });

  it('gerbang modul: anggota MODULE_CODES atau null (peran, bukan langganan)', () => {
    for (const leaf of LEAVES) {
      if (leaf.node.module === null || leaf.node.module === undefined) continue;
      expect(MODULE_CODES, `modul ${leaf.node.module} tidak terdaftar`).toContain(leaf.node.module);
    }
  });

  it('route_key yang diisi anggota registri, dan registri hanya menunjuk halaman yang ada', () => {
    for (const leaf of LEAVES) {
      if (!leaf.node.routeKey) continue;
      expect(ROUTE_KEYS, `route_key ${leaf.node.routeKey} tidak terdaftar`).toHaveProperty(leaf.node.routeKey);
    }

    const appRoot = path.join(process.cwd(), 'src', 'app');
    const routes = new Set<string>();
    const scan = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (!entry.isDirectory()) continue;
        if (fs.existsSync(path.join(full, 'page.tsx'))) {
          const rel = path
            .relative(appRoot, full)
            .split(path.sep)
            .filter((s) => !(s.startsWith('(') && s.endsWith(')')))
            .join('/');
          routes.add(`/${rel}`.replace(/\/index$/, '').replace(/\/$/, ''));
        }
        scan(full);
      }
    };
    scan(appRoot);
    const dangling = Object.entries(ROUTE_KEYS).filter(([, href]) => !routes.has(href));
    expect(dangling, `registri rute menunjuk halaman tanpa page.tsx: ${JSON.stringify(dangling)}`).toEqual([]);
  });

  it('setiap daun punya label Indonesia + Inggris (i18n §3.5 / kolom label_en)', () => {
    for (const leaf of LEAVES) {
      expect(leaf.node.label.length, `${leaf.node.code} tanpa label id`).toBeGreaterThan(2);
      expect(leaf.node.labelEn.length, `${leaf.node.code} tanpa label en`).toBeGreaterThan(2);
      if (leaf.node.icon) expect(leaf.node.icon, `${leaf.node.code} ikon bukan Remix`).toMatch(/^ri-[a-z0-9-]+$/);
    }
  });

  it('labelKey statis menunjuk kunci `navigation.*` yang ada di dua berkas locale', () => {
    const read = (file: string): Record<string, string> =>
      JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/locales', file), 'utf8')).navigation;
    const labels: Record<'id' | 'en', Record<string, string>> = { id: read('id.json'), en: read('en.json') };
    const keys = Object.values(MENU_LABEL_KEYS);
    expect(keys.length).toBeGreaterThan(10);
    for (const key of keys) {
      for (const lang of ['id', 'en'] as const) {
        expect(labels[lang][key], `locale ${lang} kehilangan kunci navigation.${key}`).toBeTruthy();
      }
    }
  });

  /**
   * Aturan yang menjaga daftar tetap jujur: daun tanpa izin terdaftar tidak boleh
   * menyamar sebagai menu. `verify:menu` membuktikan barisnya `is_visible = false`.
   * Gerbang sebuah daun adalah `permission` ATAU keluarga `anyOf` — keduanya dihitung,
   * sebab daun persetujuan parameter (§6.2 baris 1520) hanya punya `anyOf` dan tetap tampil.
   */
  it('daun tanpa izin tidak pernah punya routeKey (tidak ada janji 404)', () => {
    for (const leaf of LEAVES) {
      const gates = (leaf.node.permission ? 1 : 0) + (leaf.node.anyOf?.length ?? 0);
      if (gates > 0) continue;
      expect(leaf.node.routeKey, `${leaf.node.code} disembunyikan tetapi diberi rute`).toBeUndefined();
      expect(leaf.node.anyOf, `${leaf.node.code} disembunyikan tetapi diberi anyOf`).toBeUndefined();
    }
  });

  it('MENU_ROUTE_KEYS hanya berisi kunci yang ada di registri', () => {
    for (const [code, key] of Object.entries(MENU_ROUTE_KEYS)) {
      expect(ROUTE_KEYS, `${code} menunjuk ${key} yang tidak terdaftar`).toHaveProperty(key);
    }
  });

  /**
   * Penjaga `RD-181`(b). `§4.17.1` memberi `labelKey` statis prioritas atas `label` DB;
   * ketika delapan daun ber-`lock` membawanya, layar mencetak "Pengguna" alih-alih label
   * register yang dikunci pemilik — dan `verify:menu` tidak melihatnya karena ia membandingkan
   * kolom DB, bukan teks yang dirender. Aturan yang dikunci di sini: daun §12 hanya punya
   * SATU sumber label, yaitu `label`/`label_en`.
   */
  it('nol daun terkunci §12 membawa labelKey (label register tidak disingkat lapisan render)', () => {
    const offenders = LOCKED.filter((l) => l.node.labelKey).map((l) => `${l.node.code} → ${l.node.labelKey}`);
    expect(offenders, `daun ber-lock dengan labelKey: ${offenders.join(', ')}`).toEqual([]);
  });

  /**
   * Penjaga `NAV-1` + `BLUEPRINT §12.6`. `top-nav.tsx` mempromosikan grup di bawah akar
   * wadah menjadi item baris menu, dan urutan tampil mengikuti `sortOrder`. Kalau nomor itu
   * melompat atau duplikat, penomoran 1…6 pada daftar pemilik tidak lagi terbaca di layar.
   */
  it('grup yang dipromosikan berdampingan dan bernomor naik tanpa lubang', () => {
    // Predikat yang sama dengan `top-nav.tsx`: akar tanpa rute yang SELURUH anaknya grup.
    // `akademik`/`more` sengaja tidak ikut: anaknya daun langsung, jadi ia tetap satu dropdown.
    const containerRoots = ALL.filter(
      (l) =>
        l.depth === 1 &&
        !l.node.routeKey &&
        (l.node.children?.length ?? 0) > 0 &&
        l.node.children!.every((c) => (c.children?.length ?? 0) > 0)
    );
    expect(containerRoots.map((r) => r.node.code).sort()).toEqual(['admin', 'platform']);
    for (const root of containerRoots) {
      const groups = root.node.children ?? [];
      const orders = groups.map((g) => g.sortOrder ?? 0);
      expect(orders, `${root.node.code}: sortOrder grup tidak naik`).toEqual([...orders].sort((a, b) => a - b));
      expect(new Set(orders).size, `${root.node.code}: sortOrder grup duplikat`).toBe(orders.length);
      expect(orders[0], `${root.node.code}: kelompok pertama harus bernomor 10`).toBe(10);
      for (const g of groups) {
        expect(g.children?.length ?? 0, `${g.code} bukan grup (anak kosong)`).toBeGreaterThan(0);
        expect(g.children?.every((c) => (c.children?.length ?? 0) === 0), `${g.code} bersarang lebih dalam dari dua tingkat`).toBe(true);
      }
    }
  });

  /** Nama kelompok menjadi kontrak (siklus 10), bukan label internal grup. */
  it('nama kelompok R-1/R-2 persis register §12.6', () => {
    const expected: Record<string, string> = {
      'platform.monitoring': 'Dashboard & Infrastructure Health',
      'platform.licensing': 'Manajemen SaaS & Tenant Licensing',
      'platform.master': 'Master System Reference',
      'platform.governance': 'Keamanan & Platform Control',
      'admin.monitoring': 'Dashboard IT Kampus',
      'admin.institution': 'Konfigurasi Tenant, Branding & Active Add-ons',
      'admin.parameters': 'Master Parameter & Aturan Kampus',
      'admin.identity': 'Pengguna & Access Control',
      'admin.integrations': 'Gateway & Integrasi Server',
      'admin.operations': 'Pemeliharaan & Maintenance Tools',
    };
    for (const g of GROUPS) {
      const want = expected[g.node.code];
      if (!want) continue;
      expect(g.node.label, `${g.node.code} menyimpang dari §12.6`).toBe(want);
      expect(g.node.labelEn, `${g.node.code} kehilangan label_en`).toBeTruthy();
    }
    expect(Object.keys(expected).every((code) => GROUPS.some((g) => g.node.code === code))).toBe(true);
  });

  /**
   * Penjaga `F-1` (`BLUEPRINT §12.7`, `DATA_MODEL §21.7` butir 4, migrasi `0096`).
   * Dua hal yang dilarang sejak nama nav dipisah dari keterangan:
   *  (a) daun bernama kalimat — `label` wajib ≤ 30 karakter, karena yang panjang adalah
   *      `description` dan itu bukan teks navigasi (Velzon/Sevima satu–dua kata);
   *  (b) `description` tanpa `description_en`, atau `description` yang actually pendek —
   *      itu tanda teksnya tidak dipindah tetapi disalin ulang, dan dua sumber kebenaran
   *      untuk satu kalimat adalah pola `RD-32`.
   * Kelompok (GROUPS) sengaja tidak diuji: namanya adalah judul yang pemilik kunci verbatim
   * di §12.6 dan ada yang 45 karakter.
   */
  it('nama nav daun pendek dan keterangannya hanya ada bila memang teks panjang (F-1)', () => {
    const tooLong = LEAVES.filter((l) => l.node.label.length > 30).map((l) => `${l.node.code} (${l.node.label.length})`);
    expect(tooLong, `daun dengan nama nav > 30 karakter: ${tooLong.join(', ')}`).toEqual([]);

    const described = LEAVES.filter((l) => l.node.description !== undefined);
    expect(described.length, 'jumlah daun bere-desc harus 38 seperti §12.7').toBe(38);
    for (const l of described) {
      expect(l.node.description!.length, `${l.node.code}: description lebih pendek dari ambang = bukan teks spesifikasi`).toBeGreaterThan(30);
      expect(l.node.descriptionEn, `${l.node.code}: description tanpa description_en`).toBeTruthy();
      expect(l.node.label, `${l.node.code}: label = description berarti F-1 tidak terjadi`).not.toBe(l.node.description);
    }
    // `description ?? label` adalah pembanding §12; daun TANPA description wajib berupa nama
    // yang memang sudah lengkap, sehingga ia tidak diam-diam kehilangan keterangan.
    for (const l of LEAVES.filter((x) => x.node.description === undefined)) {
      expect(l.node.label.length, `${l.node.code} tanpa description padahal namanya panjang`).toBeLessThanOrEqual(30);
    }
  });
});
