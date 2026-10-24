/**
 * Unit tests — Registri kunci parameter sistem (`AGENTS §3.10` gerbang (n), `SPE-2`,
 * `API_SPEC §4.16.7` butir 2).
 *
 * Kenapa berkas ini ada: mesin parameter hanya jujur kalau **bukti konsumen diperiksa**,
 * bukan ditulis. Katalog yang mengklaim punya pembaca di berkas yang tidak ada = layar Admin
 * yang mengubah angka yang tidak dibaca siapa pun — kegagalan yang persis sama yang ditolak
 * §4.16.7. Uji ini menjalankan penolakan itu: satu callSite palsu saja membuat suite merah.
 *
 * Murni (FS + kontrak), tanpa DB — supaya ia bisa lari di CI tanpa Supabase.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  ALL_SYSTEM_PARAMETER_DEFINITIONS,
  DB_ENFORCED_ALLOWED_KEYS,
  DEFERRED_PARAMETER_KEYS,
  PARAMETER_ENUM_SEEDS,
  PARAMETER_HOME_HREF,
  PARAMETER_MODULE_CODES,
  PARAMETER_MODULE_TO_ENTITLEMENT,
  SYSTEM_PARAMETER_CATALOG,
  SYSTEM_PARAMETER_DEFERRED,
  SYSTEM_PARAMETER_POINTERS,
  WIRED_PARAMETER_KEYS,
  findParameterDefinition,
  guardParameterWrite,
  isKeyPrefixedByModule,
  parameterImpactOf,
  requiresSecondApprover,
  type ParameterModuleCode,
} from '@sica/contracts';

/** Basis semua `callSite`/`testRef` registri = akar repo (bukan cwd proses). */
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));

const pathOf = (callSite: string): string => callSite.slice(0, callSite.lastIndexOf(':') > 0 ? callSite.lastIndexOf(':') : callSite.length);
const exists = (rel: string): boolean => existsSync(resolve(repoRoot, rel));

describe('bukti konsumen katalog terpasang', () => {
  it('setiap callSite menunjuk berkas yang nyata ada di branch ini', () => {
    const broken = SYSTEM_PARAMETER_CATALOG.flatMap((def) =>
      def.consumers
        .map((c) => ({ key: def.parameterKey, site: c.callSite, ok: exists(pathOf(c.callSite)) }))
        .filter((row) => !row.ok)
    );
    expect(broken, `callSite palsu: ${JSON.stringify(broken)}`).toEqual([]);
  });

  it('setiap konsumen menunjuk uji yang nyata ada', () => {
    const broken = SYSTEM_PARAMETER_CATALOG.flatMap((def) =>
      def.consumers
        .map((c) => ({ key: def.parameterKey, test: c.testRef, ok: exists(c.testRef) }))
        .filter((row) => !row.ok)
    );
    expect(broken, `testRef palsu: ${JSON.stringify(broken)}`).toEqual([]);
  });

  it('nol kunci tanpa konsumen — kunci tanpa pembaca ditolak sejak registri', () => {
    const orphan = SYSTEM_PARAMETER_CATALOG.filter((def) => def.consumers.length === 0).map((d) => d.parameterKey);
    expect(orphan).toEqual([]);
  });

  it('isi callSite cocok dengan berkas yang ditunjuknya (bukan hanya ada)', () => {
    // Bukti "dibaca" harus ditemukan di berkasnya: kunci yang disebut dalam registri
    // wajib muncul sebagai string di callSite. Menunjuk berkas lain yang kebetulan ada
    // bukan bukti konsumen.
    const unmatched = SYSTEM_PARAMETER_CATALOG.flatMap((def) =>
      def.consumers
        .filter((c) => !readFileSync(resolve(repoRoot, pathOf(c.callSite)), 'utf8').includes(def.parameterKey))
        .map((c) => `${def.parameterKey} → ${c.callSite}`)
    );
    expect(unmatched, `kunci tidak disebut di berkas konsumennya: ${JSON.stringify(unmatched)}`).toEqual([]);
  });

  it('proyeksi dampak mengembalikan konsumen untuk kunci terpasang dan kosong untuk kunci tak dikenal', () => {
    expect(parameterImpactOf('attendance.totp_rotate_seconds').length).toBeGreaterThan(0);
    expect(parameterImpactOf('attendance.tidak.ada')).toEqual([]);
  });
});

describe('registri penundaan (`SYSTEM_PARAMETER_DEFERRED`)', () => {
  it('tiap kunci tertunda membawa alasan yang dapat ditagih', () => {
    const thin = SYSTEM_PARAMETER_DEFERRED
      .filter((d) => d.reason.trim().length < 20)
      .map((d) => d.parameterKey);
    expect(thin, `alasan terlalu kosong: ${JSON.stringify(thin)}`).toEqual([]);
  });

  it('kunci tertunda TIDAK ada di katalog terpasang maupun baris penemuan', () => {
    const seeded = new Set(ALL_SYSTEM_PARAMETER_DEFINITIONS.map((d) => d.parameterKey));
    const overlap = DEFERRED_PARAMETER_KEYS.filter((k) => seeded.has(k));
    expect(overlap, `kunci tertunda ikut disseed: ${JSON.stringify(overlap)}`).toEqual([]);
  });

  it('kunci tertunda tidak punya definisi, jadi `findParameterDefinition` menjawab null', () => {
    for (const key of DEFERRED_PARAMETER_KEYS) expect(findParameterDefinition(key)).toBeNull();
  });

  it('modul yang disebut daftar tertunda adalah anggota kosakata kelas A', () => {
    const vocabulary = new Set<ParameterModuleCode>(PARAMETER_MODULE_CODES);
    const liar = SYSTEM_PARAMETER_DEFERRED.filter((d) => !vocabulary.has(d.moduleCode));
    expect(liar).toEqual([]);
  });

  it('jumlah terpasang + tertunda = seluruh gugus yang dipetakan §21.3', () => {
    expect(WIRED_PARAMETER_KEYS.length + DEFERRED_PARAMETER_KEYS.length).toBe(24);
  });
});

describe('invarian bentuk registri', () => {
  it('tidak ada kunci duplikat di seluruh registri', () => {
    const all = [...ALL_SYSTEM_PARAMETER_DEFINITIONS.map((d) => d.parameterKey), ...DEFERRED_PARAMETER_KEYS];
    expect(new Set(all).size).toBe(all.length);
  });

  it('setiap kunci berawalan modulnya (§4.16.4)', () => {
    const melanggar = ALL_SYSTEM_PARAMETER_DEFINITIONS
      .filter((d) => !isKeyPrefixedByModule(d.parameterKey, d.moduleCode))
      .map((d) => d.parameterKey);
    expect(melanggar).toEqual([]);
  });

  it('setiap modul yang dipakai registri punya peta entitlement (gerbang §4.16.5)', () => {
    const used = new Set(ALL_SYSTEM_PARAMETER_DEFINITIONS.map((d) => d.moduleCode));
    const missing = [...used].filter((m) => PARAMETER_MODULE_TO_ENTITLEMENT[m] === undefined);
    expect(missing).toEqual([]);
  });

  it('setiap nilai baku katalog lolos penjaga miliknya sendiri', () => {
    const rejected = SYSTEM_PARAMETER_CATALOG.map((def) => ({
      key: def.parameterKey,
      verdict: guardParameterWrite(def, def.defaultValue, def.enumKind ? (PARAMETER_ENUM_SEEDS[def.enumKind]?.entries ?? []).map((e) => e.code) : null),
    })).filter((row) => typeof row.verdict !== 'string');
    expect(rejected, `defaultValue katalog ditolak guard: ${JSON.stringify(rejected)}`).toEqual([]);
  });

  it('kunci ber-`allowedValues` yang dijaga CHECK DB punya himpunan di dalam min/max', () => {
    const guarded = SYSTEM_PARAMETER_CATALOG.filter((d) => DB_ENFORCED_ALLOWED_KEYS.has(d.parameterKey));
    expect(guarded.length).toBeGreaterThan(0);
    for (const def of guarded) {
      expect(def.allowedValues, `${def.parameterKey} wajib punya himpunan sah`).not.toBeNull();
      for (const value of def.allowedValues ?? []) {
        const n = Number(value);
        if (def.minValue !== null) expect(n).toBeGreaterThanOrEqual(Number(def.minValue));
        if (def.maxValue !== null) expect(n).toBeLessThanOrEqual(Number(def.maxValue));
      }
    }
  });

  it('deskripsi tiap kunci menjelaskan akibat perubahan (bukan hanya apa itu)', () => {
    const tipis = SYSTEM_PARAMETER_CATALOG.filter((d) => !/Menurun|Menaik|menurun|menaik|semakin|berarti|memblokir|dijaga|ditolak/i.test(d.description)).map((d) => d.parameterKey);
    expect(tipis, `deskripsi tanpa akibat: ${JSON.stringify(tipis)}`).toEqual([]);
  });

  it('kelas SECURITY/REGULATORY katalog memang menuntut orang kedua', () => {
    for (const def of SYSTEM_PARAMETER_CATALOG) {
      if (def.riskClass === 'SECURITY' || def.riskClass === 'REGULATORY') expect(requiresSecondApprover(def.riskClass)).toBe(true);
    }
  });
});

describe('kamus `enum_kind` yang dirujuk registri', () => {
  it('setiap enumKind punya item terdaftar (FK 0049 tidak boleh menggigit saat seed)', () => {
    const used = ALL_SYSTEM_PARAMETER_DEFINITIONS.map((d) => d.enumKind).filter((k): k is string => k !== null);
    for (const kind of used) {
      expect(PARAMETER_ENUM_SEEDS[kind], `kind ${kind} tidak terdaftar`).toBeDefined();
      expect((PARAMETER_ENUM_SEEDS[kind]?.entries ?? []).length).toBeGreaterThan(0);
    }
  });

  it('nol kind mati: setiap kind terdaftar dirujuk sebuah definisi', () => {
    const referenced = new Set(ALL_SYSTEM_PARAMETER_DEFINITIONS.map((d) => d.enumKind).filter((k): k is string => k !== null));
    const dead = Object.keys(PARAMETER_ENUM_SEEDS).filter((kind) => !referenced.has(kind));
    expect(dead, `kamus tanpa pemakai: ${JSON.stringify(dead)}`).toEqual([]);
  });

  it('kode dalam satu kind unik dan ber-urutan deterministik (`sort_order, code`)', () => {
    for (const [kind, spec] of Object.entries(PARAMETER_ENUM_SEEDS)) {
      const codes = spec.entries.map((e) => e.code);
      expect(new Set(codes).size, `kode ganda di ${kind}`).toBe(codes.length);
      const orders = spec.entries.map((e) => e.order);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    }
  });
});

describe('baris penemuan (`SYSTEM_PARAMETER_POINTERS`)', () => {
  it('bukan rumah PARAM dan tidak mengklaim nilai', () => {
    for (const def of SYSTEM_PARAMETER_POINTERS) {
      expect(def.sourceOfTruth).not.toBe('PARAM');
      expect(def.defaultValue).toBe('');
    }
  });

  it('punya alamat layar tempat nilai dirawat (`remedyHref` §4.16.2 langkah 1)', () => {
    for (const def of SYSTEM_PARAMETER_POINTERS) {
      expect(PARAMETER_HOME_HREF[def.sourceOfTruth], `${def.parameterKey} tanpa rumah`).not.toBeNull();
    }
  });

  it('callSite-nya menunjuk berkas dokumen yang ada', () => {
    const broken = SYSTEM_PARAMETER_POINTERS.flatMap((d) =>
      d.consumers.map((c) => c.callSite.split(' ')[0] ?? c.callSite).filter((p) => !exists(p))
    );
    expect(broken, `rujukan dokumen palsu: ${JSON.stringify(broken)}`).toEqual([]);
  });
});
