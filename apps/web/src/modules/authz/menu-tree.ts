/**
 * Definisi pohon menu sebagai data — eksekusi register `BLUEPRINT_ROLE_BY_ROLE §12`
 * (kunci 1:1 daun menu R-1/R-2, permintaan pemilik 2026-10-24).
 *
 * Berkas ini adalah **satu-satunya definisi** yang dibaca seed (`menu-seed.ts`) untuk
 * menulis baris `menu_items` + `menu_permissions`. Yang dirender aplikasi berasal dari
 * tabel, bukan dari daftar di sini, sehingga "menu sebagai data" benar-benar berlaku;
 * kecocokan keduanya dijaga `.tools/menu-drift.mjs`.
 *
 * Tiga aturan yang membuat daftar ini tetap jujur (`API_SPEC §4.17` norma 2–4):
 *  1. **Daun tanpa `permission` = tidak dikirim.** `menu_permissions` bersifat allowlist,
 *     jadi barisnya tetap ada (register pemilik utuh 39 daun) dengan `is_visible = false`.
 *     Ini bukan menyembunyikan fitur dari orang yang berhak — ini menolak menawarkan
 *     layar yang belum punya pemegang hak terdaftar. Vonis `§12` menandai daun `BELUM`
 *     dan `DITOLAK` persis karena izin pengendalinya masih `pending`/`usulan`.
 *  2. **Daun dengan `permission` tetapi tanpa `routeKey` = terlihat sebagai "Segera".**
 *     Hak sudah ada, layarnya belum — label non-klik, bukan tautan 404.
 *  3. **Grup (punya `children`) tidak punya grant.** Visibilitasnya diturunkan dari anak:
 *     grup tanpa satu pun anak terlihat ikut terpotong. `route_key` kosong di sini memang
 *     sah untuk header/pemisah non-klik.
 *
 * `module` adalah gerbang **entitlement** (ADR-13). `null` berarti modulnya digate oleh
 * peran, bukan dilangganan — persis registri `PRD §5.12.3`/`UI_UX §17.2.6` (M-01 dan M-02
 * tidak punya SKU). `labelKey` hanya ada untuk daun yang sudah punya kunci i18n statis;
 * sisanya memakai `label`/`label_en` dari kolom DB (`AGENTS §3.5` tetap terpenuhi karena
 * string itu data yang dapat dirawat kampus, bukan string yang di-hardcode di komponen).
 */
import type { ModuleCode, PermissionCode } from '@sica/contracts';

export interface MenuSeedNode {
  readonly code: string;
  /** Nomor baris register `BLUEPRINT_ROLE_BY_ROLE §12` (`1.1`…`6.4`) yang dikunci daun ini. */
  readonly lock?: string;
  readonly label: string;
  readonly labelEn: string;
  /** Kunci statis `navigation.*` di `src/locales`; diprioritaskan di atas `label` DB. */
  readonly labelKey?: string;
  /** Kunci registri rute (`route-keys.ts`); kosong = header/grup atau layar belum ada. */
  readonly routeKey?: string;
  readonly module?: ModuleCode | null;
  readonly permission?: PermissionCode;
  /** Daun yang boleh muncul karena SALAH SATU izin (mis. pembaca parameter lintas kelas). */
  readonly anyOf?: readonly PermissionCode[];
  readonly icon?: string;
  readonly sortOrder?: number;
  readonly requiresMfa?: boolean;
  readonly children?: readonly MenuSeedNode[];
}

/** `menu_items.layer` — hari ini hanya Web yang punya konsumen; Mobile menyusul `§3.4`. */
export const MENU_LAYER = 'WEB';

/** Kumpulkan `code → navigation.*` dari dua pohon; lihat `MENU_LABEL_KEYS` di akhir berkas. */
function collectLabelKeys(trees: readonly (readonly MenuSeedNode[])[]): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (nodes: readonly MenuSeedNode[]): void => {
    for (const node of nodes) {
      if (node.labelKey) out[node.code] = node.labelKey;
      if (node.children) walk(node.children);
    }
  };
  for (const tree of trees) walk(tree);
  return out;
}

/** Kumpulkan `code → route_key` (hanya daun yang kuncinya terisi). */
function collectRouteKeys(trees: readonly (readonly MenuSeedNode[])[]): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (nodes: readonly MenuSeedNode[]): void => {
    for (const node of nodes) {
      if (node.routeKey) out[node.code] = node.routeKey;
      if (node.children) walk(node.children);
    }
  };
  for (const tree of trees) walk(tree);
  return out;
}

/** Semua `code` dalam urutan DFS (grup lebih dulu dari anaknya). */
function collectCodes(trees: readonly (readonly MenuSeedNode[])[]): string[] {
  const out: string[] = [];
  const walk = (nodes: readonly MenuSeedNode[]): void => {
    for (const node of nodes) {
      out.push(node.code);
      if (node.children) walk(node.children);
    }
  };
  for (const tree of trees) walk(tree);
  return out;
}

/** R-1 — Admin SICA (`PLATFORM_OPERATOR`): 14 daun `§12.1` + 1 daun operasi yang sudah berjalan. */
export const PLATFORM_MENU_TREE: readonly MenuSeedNode[] = [
  {
    code: 'dashboard',
    label: 'Dashboard',
    labelEn: 'Dashboard',
    labelKey: 'dashboard',
    routeKey: 'app.dashboard',
    module: 'identity',
    permission: 'identity.profile.view',
    icon: 'ri-dashboard-2-line',
    sortOrder: 10,
  },
  {
    code: 'platform',
    label: 'Platform',
    labelEn: 'Platform',
    labelKey: 'platform',
    icon: 'ri-shield-check-line',
    sortOrder: 20,
    children: [
      {
        code: 'platform.monitoring',
        label: 'Dashboard & Infrastructure Health',
        labelEn: 'Dashboard & infrastructure health',
        icon: 'ri-pulse-line',
        sortOrder: 10,
        children: [
          // 1.1 BELUM (`RD-11`): tanpa telemetri Redis/DB pool nyata, panelnya akan jadi fixture.
          {
            code: 'platform.monitoring.resource',
            lock: '1.1',
            label: 'Live Resource Monitor (CPU, RAM, DB Connection Pool, Redis Cluster Global)',
            labelEn: 'Live Resource Monitor (CPU, RAM, DB pool, global Redis cluster)',
            icon: 'ri-server-line',
            sortOrder: 10,
          },
          // 1.2 spec-only + GeoIP2 DITOLAK sebagai sumber: tanpa objek & tanpa izin terdaftar.
          {
            code: 'platform.monitoring.gis',
            lock: '1.2',
            label: 'Peta Sebaran User GIS Real-Time (GeoIP2 / W3C Geolocation)',
            labelEn: 'Real-time user distribution GIS map',
            icon: 'ri-map-2-line',
            sortOrder: 20,
          },
          // 1.3 berjalan sebagian: log = layar /platform/audit; deteksi anomali masih spec-only.
          {
            code: 'platform.monitoring.security_log',
            lock: '1.3',
            label: 'Log Keamanan Platform & Isolation Forest Anomaly Alert',
            labelEn: 'Platform security log & anomaly alerts',
            routeKey: 'platform.audit',
            module: 'audit',
            permission: 'audit.log.view',
            icon: 'ri-shield-cross-line',
            sortOrder: 30,
          },
        ],
      },
      {
        code: 'platform.licensing',
        label: 'Manajemen SaaS & Tenant Licensing',
        labelEn: 'SaaS & tenant licensing management',
        icon: 'ri-medal-line',
        sortOrder: 20,
        children: [
          // 2.1 berjalan.
          {
            code: 'platform.licensing.directory',
            lock: '2.1',
            label: 'Direktori Perguruan Tinggi & Status Langganan',
            labelEn: 'Institution directory & subscription status',
            routeKey: 'platform.tenants',
            module: null,
            permission: 'platform.tenant.view',
            icon: 'ri-building-4-line',
            sortOrder: 10,
          },
          // 2.2 berjalan sebagian: API aktivasi ada, layarnya belum; E-Procurement & Multi-Branch
          // tidak dapat menjadi SKU sampai `0044`/enum SITE nyata (PRD §5.12.5).
          {
            code: 'platform.licensing.addons',
            lock: '2.2',
            label:
              'Management Add-on Entitlement (PMB OCR, Multi-VA, LMS Teams Vicon, HRIS BKD, E-Procurement, e-Library, Klinik, AI Retention, Multi-Branch)',
            labelEn: 'Add-on entitlement management',
            module: null,
            permission: 'entitlement.module.activate',
            icon: 'ri-box-3-line',
            sortOrder: 20,
            requiresMfa: true,
          },
          // 2.3 berjalan di server (`tenant_quotas`), layarnya masih bagian direktori.
          {
            code: 'platform.licensing.quotas',
            lock: '2.3',
            label: 'Pengaturan Expiry Date Lisensi & Limit Kuota (Max Active Students, Max Storage)',
            labelEn: 'Licence expiry & quota limits',
            module: null,
            permission: 'platform.quota.manage',
            icon: 'ri-dashboard-3-line',
            sortOrder: 30,
            requiresMfa: true,
          },
          // 2.4 spec-only: `0091`–`0092` belum menjadi berkas + 391–394 masih usulan → MENU-LOCK-4.
          {
            code: 'platform.licensing.billing',
            lock: '2.4',
            label: 'Global Subscription Billing & Invoicing',
            labelEn: 'Global subscription billing & invoicing',
            icon: 'ri-bank-line',
            sortOrder: 40,
          },
          // 2.5 berjalan sebagian: flag nyata di tenant_settings, "rilis" belum.
          {
            code: 'platform.licensing.flags',
            lock: '2.5',
            label: 'Feature Toggles Rilis Global',
            labelEn: 'Global release feature toggles',
            module: null,
            permission: 'platform.flag.manage',
            icon: 'ri-toggle-line',
            sortOrder: 50,
            requiresMfa: true,
          },
        ],
      },
      {
        code: 'platform.master',
        label: 'Master System Reference',
        labelEn: 'Master system reference',
        icon: 'ri-bookmark-3-line',
        sortOrder: 30,
        children: [
          // 3.1 berjalan sebagian: label per-tenant sudah ada (daun R-2 3.1); jalur terbit nasional
          // = MENU-LOCK-2 dan izin penerbitnya masih `usulan`. Daun ini sengaja TANPA grant:
          // `master.kind.view` adalah izin kamus TENANT (baris 127) — memakainya sebagai gerbang
          // konsol nasional membuat daun R-1 terbaca oleh peran kampus yang tidak berhak, dan
          // tetap tidak terlihat bagi pemiliknya (`PLATFORM_OPERATOR` tidak memegang 127).
          {
            code: 'platform.master.lookup',
            lock: '3.1',
            label: 'Master Lookup Baku Dikti (Agama, Status Marital, Disabilitas, Transportasi, Pembiayaan)',
            labelEn: 'National master lookup (religion, marital status, disability, transport, funding)',
            icon: 'ri-book-open-line',
            sortOrder: 10,
          },
          // 3.2 spec-only: ingest wilayah nasional belum ada dan izinnya belum bernomor.
          {
            code: 'platform.master.region',
            lock: '3.2',
            label: 'Data Wilayah BPS & Kemendagri (Provinsi, Kota/Kab, Kecamatan, Kode Pos)',
            labelEn: 'National region dictionary (BPS / Kemendagri)',
            icon: 'ri-earth-line',
            sortOrder: 20,
          },
          // 3.3 DITOLAK sebagai layar sunting (`AGENTS §3.10`: kosakata kelas A bukan data runtime).
          {
            code: 'platform.master.core_rules',
            lock: '3.3',
            label: 'Kamus Kode System & Core System Rules',
            labelEn: 'System code dictionary & core rules',
            icon: 'ri-code-s-slash-line',
            sortOrder: 30,
          },
        ],
      },
      {
        code: 'platform.governance',
        label: 'Keamanan & Platform Control',
        labelEn: 'Security & platform control',
        icon: 'ri-scales-3-line',
        sortOrder: 40,
        children: [
          // 4.1 berjalan sebagian: rantai terbaca; layar verifier masih spec-only.
          {
            code: 'platform.governance.chain',
            lock: '4.1',
            label: 'Audit Trail SHA-256 Global (Merkle Tree Hash Chaining)',
            labelEn: 'Global SHA-256 audit trail (hash chaining)',
            module: 'audit',
            permission: 'audit.chain.verify',
            icon: 'ri-links-line',
            sortOrder: 10,
          },
          // 4.2 DITOLAK sebagai editor terpusat: FIELD_RULES adalah kode + proyeksi server.
          {
            code: 'platform.governance.pii',
            lock: '4.2',
            label: 'Konfigurasi Global PII Masking & Privacy Rules (UU PDP 27/2022)',
            labelEn: 'Global PII masking & privacy rules',
            icon: 'ri-eye-off-line',
            sortOrder: 20,
          },
          // 4.3 spec-only: tidak ada parser/plafon terukur; UI hanya status, bukan knob runtime.
          {
            code: 'platform.governance.gateway',
            lock: '4.3',
            label: 'Global API Gateway & Rate Limiter Configuration',
            labelEn: 'Global API gateway & rate limiter',
            icon: 'ri-route-line',
            sortOrder: 30,
          },
          // Daun operasi yang sudah berjalan (di luar 14 daun §12, tetap dijaga supaya tidak hilang).
          {
            code: 'platform.governance.support',
            label: 'Dukungan Terawasi (Impersonation)',
            labelEn: 'Supervised support (impersonation)',
            labelKey: 'platformSupport',
            routeKey: 'platform.support',
            module: 'identity',
            permission: 'identity.impersonation.grant',
            icon: 'ri-lifebuoy-line',
            sortOrder: 40,
            requiresMfa: true,
          },
        ],
      },
    ],
  },
];

/** R-2 — Admin IT Kampus (`TENANT_ADMIN`): 25 daun `§12.2` + daun operasional yang sudah berjalan. */
export const CAMPUS_MENU_TREE: readonly MenuSeedNode[] = [
  {
    code: 'dashboard',
    label: 'Dashboard',
    labelEn: 'Dashboard',
    labelKey: 'dashboard',
    routeKey: 'app.dashboard',
    module: 'identity',
    permission: 'identity.profile.view',
    icon: 'ri-dashboard-2-line',
    sortOrder: 10,
  },
  {
    code: 'akademik',
    label: 'Akademik',
    labelEn: 'Academic',
    labelKey: 'academic',
    icon: 'ri-graduation-cap-line',
    sortOrder: 20,
    children: [
      {
        code: 'akademik.krs',
        label: 'KRS Online',
        labelEn: 'Online KRS',
        labelKey: 'krs',
        routeKey: 'academic.krs',
        module: 'enrollment',
        permission: 'enrollment.krs.view',
        icon: 'ri-draft-line',
        sortOrder: 10,
      },
      {
        code: 'akademik.khs',
        label: 'KHS / Nilai',
        labelEn: 'Grade report',
        labelKey: 'khs',
        routeKey: 'academic.khs',
        module: 'assessment',
        permission: 'assessment.grade.view',
        // Alumni tidak memegang `assessment.grade.view` tetapi memegang `academic.transcript.view`
        // (§6.4 baris 1617: "Alumni → Ijazah & Transkrip"). Daun ini yang membacanya — bukan
        // daun kedua dengan layar sama, yang akan menjadi menu dobel (`RD-32`).
        anyOf: ['assessment.grade.view', 'academic.transcript.view'],
        icon: 'ri-book-2-line',
        sortOrder: 20,
      },
      {
        code: 'akademik.dpa',
        label: 'Approval DPA',
        labelEn: 'Advisor approval',
        labelKey: 'dpa',
        routeKey: 'academic.advisor',
        module: 'enrollment',
        permission: 'enrollment.krs.approve',
        icon: 'ri-user-received-line',
        sortOrder: 30,
        requiresMfa: true,
      },
      {
        code: 'akademik.schedule',
        label: 'Jadwal Kuliah',
        labelEn: 'Class schedule',
        labelKey: 'schedule',
        module: 'teaching',
        permission: 'teaching.session.view',
        icon: 'ri-calendar-line',
        sortOrder: 40,
      },
      {
        code: 'akademik.attendance',
        label: 'Presensi QR',
        labelEn: 'QR attendance',
        labelKey: 'attendance',
        module: 'attendance',
        permission: 'attendance.summary.view',
        icon: 'ri-qr-scan-2-line',
        sortOrder: 50,
      },
      // §6.2 baris 1514 (`TENANT_ADMIN`) + baris 1547 (`ADMIN_FINANCE`): status akademik
      // mahasiswa adalah menu yang documented tetapi layarnya belum dibangun — "Segera",
      // bukan halaman kosong. Aksi `student.status.change` tetap lewat approval pemilik domain.
      {
        code: 'akademik.studentstatus',
        label: 'Status Mahasiswa',
        labelEn: 'Student status',
        module: 'academic',
        permission: 'academic.studentstatus.view',
        icon: 'ri-user-search-line',
        sortOrder: 60,
      },
    ],
  },
  {
    code: 'admin',
    label: 'Area Admin',
    labelEn: 'Admin area',
    labelKey: 'admin',
    icon: 'ri-shield-user-line',
    sortOrder: 30,
    children: [
      {
        code: 'admin.monitoring',
        label: 'Dashboard IT Kampus',
        labelEn: 'Campus IT dashboard',
        icon: 'ri-pulse-line',
        sortOrder: 10,
        children: [
          // 1.1 BELUM: tenant tidak punya "server lokal" pada model SaaS ini.
          {
            code: 'admin.monitoring.health',
            lock: '1.1',
            label: 'Pemantau Local Server & Database Health',
            labelEn: 'Local server & database health monitor',
            icon: 'ri-server-line',
            sortOrder: 10,
          },
          // 1.2 spec-only, coarse, tanpa PII individu.
          {
            code: 'admin.monitoring.gis',
            lock: '1.2',
            label: 'Peta Sebaran User Aktif Kampus (Geospatial GIS Map)',
            labelEn: 'Campus active-user distribution map',
            icon: 'ri-map-2-line',
            sortOrder: 20,
          },
          // 1.3 berjalan sebagian: `login_events` nyata, proyeksi anomali belum.
          {
            code: 'admin.monitoring.login_alert',
            lock: '1.3',
            label: 'Alert Anomali Sesi Login & Security Warnings',
            labelEn: 'Login anomaly & security warnings',
            module: 'identity',
            permission: 'identity.loginstats.view',
            icon: 'ri-alarm-warning-line',
            sortOrder: 30,
          },
        ],
      },
      {
        code: 'admin.institution',
        label: 'Konfigurasi Tenant, Branding & Active Add-ons',
        labelEn: 'Tenant configuration, branding & active add-ons',
        icon: 'ri-building-line',
        sortOrder: 20,
        children: [
          // 2.1 berjalan sebagian: organisasi nyata; cabang/SITE butuh `0044` (BELUM).
          {
            code: 'admin.institution.profile',
            lock: '2.1',
            label: 'Profil Instansi & Cabang Kampus',
            labelEn: 'Institution profile & campuses',
            routeKey: 'admin.organization',
            module: 'academic',
            permission: 'academic.organization.view',
            icon: 'ri-home-smile-line',
            sortOrder: 10,
          },
          // 2.2 spec-only: objek `tenant_domains` belum ada; IT mengajukan, operator menerbitkan.
          {
            code: 'admin.institution.domain',
            lock: '2.2',
            label: 'Custom Domain & Sertifikat SSL',
            labelEn: 'Custom domain & SSL certificate',
            icon: 'ri-global-line',
            sortOrder: 20,
          },
          // 2.3 berjalan sebagian: baca + toggle dalam batas lisensi; opt-out lokal masih gap.
          {
            code: 'admin.institution.catalog',
            lock: '2.3',
            label: 'Katalog Modul Aktif & Status Lisensi Add-ons Kampus',
            labelEn: 'Active module catalogue & add-on licence status',
            module: null,
            permission: 'entitlement.catalog.view',
            icon: 'ri-apps-2-line',
            sortOrder: 30,
          },
          // 2.4 DITOLAK sebagai hak tulis tenant: flag rilis adalah hak R-1 (`platform.flag.manage`).
          {
            code: 'admin.institution.flags',
            lock: '2.4',
            label: 'Feature Toggles Operasional Lokal',
            labelEn: 'Local operational feature toggles',
            icon: 'ri-toggle-line',
            sortOrder: 40,
          },
          // 2.5 spec-only (baca-saja, izin masih pending; bukan 391 dan bukan finance.invoice.view).
          {
            code: 'admin.institution.saas_billing',
            lock: '2.5',
            label: 'Status Lisensi & Tagihan SaaS Kampus',
            labelEn: 'Campus SaaS licence & billing status',
            icon: 'ri-bank-line',
            sortOrder: 50,
          },
        ],
      },
      {
        code: 'admin.parameters',
        label: 'Master Parameter & Aturan Kampus',
        labelEn: 'Master parameters & campus rules',
        icon: 'ri-tools-line',
        sortOrder: 30,
        children: [
          // 3.1 berjalan sebagian: kamus referensi nyata; gedung/ruang/lab butuh `0013`.
          {
            code: 'admin.parameters.reference',
            lock: '3.1',
            label:
              'Parameter Referensi Operasional Lokal (Atribut Fisik Almamater, Toga, Ukuran Kaos, Gedung/Ruang, Ormawa, Poin SKKM)',
            labelEn: 'Local reference parameters (attributes, gowns, rooms, SKKM points)',
            module: null,
            permission: 'master.item.view',
            icon: 'ri-bookmark-line',
            sortOrder: 10,
          },
          // 3.2 spec-only: pola NIM aturan struktural, sengaja tidak dipindah ke parameter key-value.
          {
            code: 'admin.parameters.nim_pattern',
            lock: '3.2',
            label: 'Generator Pola NIM Otomatis',
            labelEn: 'Automatic student-id pattern generator',
            icon: 'ri-id-card-line',
            sortOrder: 20,
          },
          // 3.3 berjalan: `master_system_parameters` + empat-mata + rentang CHECK.
          {
            code: 'admin.parameters.system',
            lock: '3.3',
            label: 'Batas Maksimal SKS & Threshold Presensi Minimum (75%)',
            labelEn: 'Max SKS & minimum attendance threshold',
            routeKey: 'admin.parameters',
            module: null,
            permission: 'settings.param.view.technical',
            anyOf: [
              'settings.param.view.technical',
              'settings.param.view.ops',
              'settings.param.view.academic',
              'settings.param.view.financial',
              'settings.param.view.regulatory',
              'settings.param.view.security',
            ],
            icon: 'ri-equalizer-2-line',
            sortOrder: 30,
          },
          // §6.2 baris 1520 — empat-mata parameter. Daun ini ada karena `§6.2` menuliskan
          // menunya untuk R-2 dan izin 327/328 sudah normatif; layarnya (`/api/v1/admin/
          // system-parameter-approvals`) sudah ada di server, belum di rute → "Segera".
          {
            code: 'admin.parameters.approvals',
            label: 'Persetujuan Parameter',
            labelEn: 'Parameter approvals',
            module: null,
            anyOf: ['settings.param.approve.regulatory', 'settings.param.approve.security'],
            icon: 'ri-checkbox-multiple-line',
            sortOrder: 40,
            requiresMfa: true,
          },
          // 3.4 BELUM: nol konsumen notifikasi; dilarang membuat layar gateway tanpa pemanggil.
          {
            code: 'admin.parameters.gateway',
            lock: '3.4',
            label: 'Notification Gateway (WhatsApp Gateway, Email SMTP, SMS OTP)',
            labelEn: 'Notification gateway (WhatsApp, SMTP, SMS OTP)',
            icon: 'ri-send-plane-line',
            sortOrder: 50,
          },
          // §6.2 baris 1521 — atribut kustom (M-02, tanpa SKU).
          {
            code: 'admin.parameters.customattr',
            label: 'Atribut Kustom',
            labelEn: 'Custom attributes',
            module: null,
            permission: 'settings.customattr.view',
            icon: 'ri-file-settings-line',
            sortOrder: 60,
          },
          // §6.2 baris 1522 — meta konfigurasi form, laporan, dan blok tanda tangan.
          {
            code: 'admin.parameters.meta',
            label: 'Meta Konfigurasi Form & Laporan',
            labelEn: 'Form & report meta-configuration',
            module: null,
            permission: 'settings.meta.view',
            icon: 'ri-file-copy-line',
            sortOrder: 70,
          },
          // §6.2 baris 1523 — impor data master. Izin 319/320 masih `usulan` dan belum masuk
          // `PERMISSION_SPECS`, jadi barisnya ada (register utuh) dengan `is_visible=false`:
          // tidak dikirim ke siapa pun sampai MENU-LOCK-3 mempromosikannya lewat rantai dokumen.
          {
            code: 'admin.parameters.import',
            label: 'Impor Data Master',
            labelEn: 'Master data import',
            icon: 'ri-import-line',
            sortOrder: 80,
          },
        ],
      },
      {
        code: 'admin.identity',
        label: 'Pengguna & Access Control',
        labelEn: 'Users & access control',
        icon: 'ri-team-line',
        sortOrder: 40,
        children: [
          // 4.1 berjalan sebagian: CRUD + nonaktif nyata; impor/ekspor = MENU-LOCK-3.
          {
            code: 'admin.identity.accounts',
            lock: '4.1',
            label: 'Manajemen Akun Sivitas Akademika (Import/Export/Disable Staf BAAK, BAUK, HRD, Keuangan, Dosen, Mahasiswa)',
            labelEn: 'Academic account management (import/export/disable)',
            routeKey: 'admin.users',
            module: 'identity',
            permission: 'identity.user.view',
            icon: 'ri-user-3-line',
            sortOrder: 10,
            requiresMfa: true,
          },
          // 4.2 berjalan; kosakata aksi wajib enam verba kanonik.
          {
            code: 'admin.identity.rbac',
            lock: '4.2',
            label: 'Matriks Hak Akses RBAC Granular (CREATE, READ, UPDATE, DELETE, APPROVE, EXPORT per Role)',
            labelEn: 'Granular RBAC matrix per role',
            routeKey: 'admin.rbac',
            module: 'identity',
            permission: 'identity.role.view',
            icon: 'ri-key-2-line',
            sortOrder: 20,
            requiresMfa: true,
          },
          // 4.3 BELUM: nol callback SSO; trust domain & verifikasi callback wajib lebih dulu.
          {
            code: 'admin.identity.sso',
            lock: '4.3',
            label: 'Integrasi Single Sign On (Google Workspace, Microsoft 365, LDAP Local)',
            labelEn: 'Single sign-on integration',
            icon: 'ri-passport-line',
            sortOrder: 30,
          },
          // 4.4 spec-only: DPO yang memutuskan, bukan R-2; izin `.dsar.*` masih usulan.
          {
            code: 'admin.identity.dsar',
            lock: '4.4',
            label: 'Konsol Privasi Data & Permohonan Hak Subjek Data UU PDP',
            labelEn: 'Data privacy console & subject requests',
            icon: 'ri-file-user-line',
            sortOrder: 40,
          },
          // 4.5 berjalan (baca); layar viewer lokal belum dirutekan.
          {
            code: 'admin.identity.audit',
            lock: '4.5',
            label: 'Log Audit Trail Aktivitas Pengguna Lokal',
            labelEn: 'Local user activity audit trail',
            module: 'audit',
            permission: 'audit.log.view',
            icon: 'ri-history-line',
            sortOrder: 50,
          },
          // Daun operasional di luar 25 daun §12 tetapi sudah berjalan — dijaga agar tidak hilang.
          {
            code: 'admin.identity.requests',
            label: 'Permintaan Hak Akses',
            labelEn: 'Access requests',
            labelKey: 'adminRequests',
            routeKey: 'admin.requests',
            module: 'identity',
            permission: 'identity.accessrequest.view',
            icon: 'ri-inbox-archive-line',
            sortOrder: 60,
          },
          // §6.2 baris 1524 + FR-ADM-26 — pohon menu sebagai data yang dapat dirawat tenant.
          // Gerbangnya sengaja keluarga TATA KELOLA (159/160/161), bukan `platform.menu.view`
          // (158): baris 158 memang "semua peran tugas", tapi yang mereka baca adalah pohon
          // mereka sendiri lewat `/me/menu` — bukan layar editor. Menaruh 158 di daun ini akan
          // menyematkan tombol "Menu & Grant" ke navigasi dosen dan mahasiswa.
          {
            code: 'admin.identity.menu',
            label: 'Menu & Grant Aplikasi',
            labelEn: 'Application menu & grants',
            module: null,
            anyOf: ['platform.menu.manage', 'platform.menu.grant'],
            icon: 'ri-node-tree',
            sortOrder: 70,
          },
        ],
      },
      {
        code: 'admin.integrations',
        label: 'Gateway & Integrasi Server',
        labelEn: 'Gateway & server integrations',
        icon: 'ri-plug-line',
        sortOrder: 50,
        children: [
          // 5.1 spec-only; hanya `credential_ref`, rahasia tetap ENV (§3.12).
          {
            code: 'admin.integrations.feeder',
            lock: '5.1',
            label: 'Server Connection PDDikti Feeder Lokal',
            labelEn: 'Local PDDikti feeder connection',
            module: 'feeder_pddikti',
            permission: 'feeder.credential.manage',
            icon: 'ri-database-2-line',
            sortOrder: 10,
            requiresMfa: true,
          },
          // 5.2 spec-only; 174–176 masih usulan.
          {
            code: 'admin.integrations.sister',
            lock: '5.2',
            label: 'API Binding SISTER 2.0 Local Tenant',
            labelEn: 'SISTER 2.0 API binding',
            icon: 'ri-user-star-line',
            sortOrder: 20,
          },
          // 5.3 spec-only; kanal = transport, bukan pemilik fakta kehadiran.
          {
            code: 'admin.integrations.vicon',
            lock: '5.3',
            label: 'Auth Provider & Webhook MS Teams / Zoom',
            labelEn: 'Teams / Zoom auth provider & webhook',
            icon: 'ri-vidicon-line',
            sortOrder: 30,
          },
          // 5.4 spec-only; milik pelaksana kelulusan (M-35), IT hanya binding.
          {
            code: 'admin.integrations.sivil',
            lock: '5.4',
            label: 'Pengaturan Verifikasi PIN SIVIL',
            labelEn: 'SIVIL PIN verification settings',
            icon: 'ri-award-line',
            sortOrder: 40,
          },
        ],
      },
      {
        code: 'admin.operations',
        label: 'Pemeliharaan & Maintenance Tools',
        labelEn: 'Maintenance tools',
        icon: 'ri-settings-3-line',
        sortOrder: 60,
        children: [
          // 6.1 DITOLAK sebagai tombol restore: prosedur operasional, bukan layar.
          {
            code: 'admin.operations.backup',
            lock: '6.1',
            label: 'Backup & Restore Basis Data Lokal',
            labelEn: 'Local database backup & restore',
            icon: 'ri-download-2-line',
            sortOrder: 10,
          },
          // 6.2 DITOLAK sebagai FLUSHALL; target = invalidasi namespace tenant + pratinjau dampak.
          {
            code: 'admin.operations.cache',
            lock: '6.2',
            label: 'Cache Flusher & Redis In-Memory Monitor (KRS War Health)',
            labelEn: 'Cache flusher & Redis monitor',
            icon: 'ri-flashlight-line',
            sortOrder: 20,
          },
          // 6.3 DITOLAK hari ini: monitor menunggu antrean + idempotensi + DLQ yang nyata.
          {
            code: 'admin.operations.queue',
            lock: '6.3',
            label: 'Job Queue & Background Worker Monitor (BullMQ)',
            labelEn: 'Job queue & worker monitor',
            icon: 'ri-stack-line',
            sortOrder: 30,
          },
          // 6.4 spec-only; ter-sanitasi, tanpa PII mentah/kredensial/stack internal.
          {
            code: 'admin.operations.feeder_queue',
            lock: '6.4',
            label: 'Staging Feeder Queue & Error Viewer Log',
            labelEn: 'Staging feeder queue & error log viewer',
            module: 'feeder_pddikti',
            permission: 'feeder.sync.view',
            icon: 'ri-bug-line',
            sortOrder: 40,
          },
        ],
      },
    ],
  },
  {
    code: 'more',
    label: 'Lainnya',
    labelEn: 'More',
    labelKey: 'more',
    icon: 'ri-apps-2-line',
    sortOrder: 40,
    children: [
      {
        code: 'more.finance',
        label: 'Keuangan & UKT',
        labelEn: 'Finance & tuition',
        labelKey: 'finance',
        module: 'finance',
        permission: 'finance.invoice.view',
        icon: 'ri-bank-card-line',
        sortOrder: 10,
      },
      {
        code: 'more.settings',
        label: 'Pengaturan Akun',
        labelEn: 'Account settings',
        labelKey: 'settings',
        module: 'identity',
        permission: 'identity.profile.update',
        icon: 'ri-user-settings-line',
        sortOrder: 20,
      },
    ],
  },
];

/**
 * Kunci statis `navigation.*` per `code` menu. Kolom `label_key` TIDAK ada di `0050`
 * (`DATA_MODEL §21.7` hanya menyimpan `label`/`label_en`), jadi pemetaan kunci i18n memang
 * registri kode — sesuai aturan "labelKey dulu, label DB fallback" (`API_SPEC §4.17.1`).
 * Didefinisikan di akhir berkas karena menghitungnya membutuhkan kedua pohon sudah ada.
 */
export const MENU_LABEL_KEYS: Readonly<Record<string, string>> = collectLabelKeys([CAMPUS_MENU_TREE, PLATFORM_MENU_TREE]);

/**
 * `code` menu → `route_key`. Sama seperti `MENU_LABEL_KEYS`, kunci rute disimpan di kolom
 * `route_key` (bukan registri terpisah), jadi peta ini hanya dipakai konsumen non-HTTP yang
 * butuh tahu "layar mana yang sudah ada" tanpa membaca DB — misalnya pintasan Dashboard.
 * Path final tetap dihitung lewat `route-keys.ts`, tidak pernah dari peta ini.
 */
export const MENU_ROUTE_KEYS: Readonly<Record<string, string>> = collectRouteKeys([CAMPUS_MENU_TREE, PLATFORM_MENU_TREE]);

/**
 * Semua `code` yang didefinisikan (grup + daun, terlihat maupun tidak). Dipakai konsumen
 * yang perlu membuktikan "kode ini bagian register" tanpa membaca DB — misalnya daftar
 * pintasan Dashboard. Daftar yang dirender pengguna tetap berasal dari `menu_items`.
 */
export const ALL_MENU_CODES: readonly string[] = collectCodes([CAMPUS_MENU_TREE, PLATFORM_MENU_TREE]);
