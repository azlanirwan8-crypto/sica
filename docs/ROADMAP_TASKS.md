# SICA Implementation Roadmap & Engineering Task Tracker
**Status:** Active Execution Plan  
**Architecture Reference:** [ARCHITECTURE.md](file:///c:/SICA/docs/ARCHITECTURE.md), [PRD.md](file:///c:/SICA/docs/PRD.md), [TECH_CONVENTIONS.md](file:///c:/SICA/docs/TECH_CONVENTIONS.md)  
**Methodology:** Top-Down Role-Based Development (R0–R9, §0) — Phase 1–4 menjadi Lampiran A (riwayat)  
**Baseline Kompetitif:** [BENCHMARK_SEVIMA.md](file:///c:/SICA/docs/BENCHMARK_SEVIMA.md) — hasil studi dokumentasi Sevima (peran, menu, modul, data master, flow) + peta selisih SICA

> **⚠️ KOREKSI STATUS — Audit Principal Lead Architect (2026-10-18).** Centang `[x]` di bawah sebelumnya menandai "kerangka/placeholder selesai", bukan "fitur production". Berdasarkan verifikasi `tsc` & `vitest`: **kontrak Zod, UI Velzon/shadcn, dan engine aturan bisnis (GPA/IPS, SKS-quota, conflict-detector) nyata & teruji**; namun **route handler backend masih mock** (tanpa DB/RLS runtime, `Math.random()`), **login & middleware auth belum memverifikasi JWT**, dan **dependensi belum ter-install penuh** (proyek gagal build sampai `pnpm install`). Item mock kini ditandai `[~]` (partial). Detail: [PROGRESS_REPORT.md §5](file:///c:/SICA/docs/PROGRESS_REPORT.md) & [ISSUE_RESOLUTION.md](file:///c:/SICA/docs/ISSUE_RESOLUTION.md).

> **🔁 Aturan Berkelanjutan (Standing DoD) — diberlakukan Principal Lead Architect.** Setiap task yang dikerjakan **WAJIB** (1) memperbarui status `[ ]`/`[~]`/`[x]` di file ini, (2) menambah baris di [PROGRESS_REPORT.md](file:///c:/SICA/docs/PROGRESS_REPORT.md), dan (3) menuangkan **detail spesifikasi** ke dokumen terkait (DATA_MODEL/API_SPEC/SECURITY/UI_UX/TECH_CONVENTIONS) — karena aplikasi ini sangat besar, spesifikasi field-level, kontrak Zod, aturan bisnis (BR-*), dan traceability test harus lengkap **sebelum** kode. Tidak ada progress tanpa catatan dokumen.

---

<!-- SICA-47:BEGIN roadmap -->

## 0. Urutan Eksekusi Top-Down Role-Based (berlaku mulai 2026-10-20)

> Cakupan: 47 modul + SuperApp ([PRD.md §10](file:///c:/SICA/docs/PRD.md)). Urutan dibangun dari role tertinggi ke role layanan mandiri: setiap gelombang menyiapkan data/konfigurasi yang dibutuhkan gelombang berikutnya. Phase 1–4 di bawah tetap dipertahankan sebagai **Lampiran A — Riwayat & status implementasi** (tidak dihapus agar jejak audit utuh). Setiap sub-task mengikuti aturan AGENTS.md: dokumen dulu, lalu kode, lalu tes, lalu update ROADMAP + PROGRESS_REPORT.

### R0. Penguncian Dokumentasi (selesai pada PR audit 47 modul)

- [x] R0.1 Audit 360° seluruh `/docs`; temuan ARC-01…ARC-07 ([ARCHITECTURE.md §11.6](file:///c:/SICA/docs/ARCHITECTURE.md)).
- [x] R0.2 Katalog 47 modul + APP, rantai integrasi I-1…I-10, simulasi S-1…S-6 (PRD §10).
- [x] R0.3 Model data per modul + kebijakan zero-hardcoding + AUD-09 diselesaikan (DATA_MODEL §15, §5).
- [x] R0.4 Endpoint per modul + kontrak WebSocket (API_SPEC §6).
- [x] R0.5 Ontologi 11 aksi + matriks role × modul (SECURITY_COMPLIANCE §10, RBAC_MATRIX §12).
- [x] R0.6 Dashboard grid dinamis per role (UI_UX_DESIGN §10); integrasi & kebijakan zero paid API key (INTEGRATIONS §5).
- [ ] R0.7 Sign-off pemilik produk atas keputusan PD-01…PD-04 (PRD §10.7) — tidak memblokir R1.

### R1.0 Fondasi Lintas Modul (prasyarat semua gelombang)

- [ ] **R1.0.1 (SUB-TASK PERTAMA SIAP EKSEKUSI)** Konversi ENUM/CHECK bisnis → lookup dinamis: tulis migrasi `0007_dynamic_lookups` yang membuat `lookup_categories`, `lookup_values`, `parameter_definitions`, `system_parameters`, `parameter_restrictions` (DATA_MODEL §15.1–15.3 & §15.6.2) + RLS, seed kategori dari enum lama dengan kode identik, backfill kolom `*_id`, lalu drop enum. **Definisi selesai:** `pnpm db:lint` hijau; kueri verifikasi §8 = 0 pelanggaran; tes RLS lintas-tenant 0 baris bocor; tidak ada `CREATE TYPE ... AS ENUM` bisnis tersisa.
- [ ] R1.0.2 Rule Parameter Resolver + cache Redis + event `parameter.versioned` (M-02).
- [ ] R1.0.3 Ontologi 11 aksi: kategori sistem `permission_action`, kolom `role_permissions.action_mask`, guard `<Can>`/`requirePermission` (SECURITY §10.1).
- [ ] R1.0.4 Outbox relay → Redis Streams + `processed_events` + `dead_letter_events` (ARCHITECTURE §11.2).
- [ ] R1.0.5 Layanan `apps/realtime` (WebSocket) + kontrak API_SPEC §6.3 + kontrak event Zod `packages/contracts/src/events`.
- [ ] R1.0.6 Shell dashboard: `GET /me/dashboard`, tabel `dashboard_profiles` + seed 6 profil, grid kartu Velzon (UI_UX §10.1–10.3).
- [ ] R1.0.7 Pulihkan `scripts/validate-roadmap.js` (dirujuk `package.json`, berkas hilang — ARC-07).
- [ ] R1.0.8 Selaraskan dokumen lama: ARCHITECTURE §3/§5 (RS256, Next route handlers), GUC `app.current_tenant`.


### R1. Super Admin & Admin IT — fondasi platform

- [ ] **R1.1 M-01 SaaS Foundation** — role: `PLATFORM_OPERATOR`, `COMPLIANCE_OFFICER`
  - [ ] Migrasi + RLS: `tenants`, `tenant_subscriptions`, `sla_policies`, `sla_measurements`, `tenant_shard_map` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (tenant_status, billing_cycle, sla_metric, sla_window) & parameter (platform.ring.virtual_nodes, platform.sla.availability_target, platform.provision.default_modules).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: CREATE, EXPORT, LOCK, UNLOCK.
  - [ ] Engine lokal: Consistent Hashing (ring 256 virtual node) untuk penempatan tenant ke shard/pool koneksi + Redis keyspace — unit test deterministik + golden dataset.
  - [ ] Event outbox: `tenant.provisioned`, `tenant.suspended`, `sla.breached`; konsumen idempoten untuk `*.audit.appended`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Tenant aktif, SLA bulan ini, Insiden terbuka, Pemakaian seat; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:platform_saas`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R1.2 M-02 Master Parameter** — role: `TENANT_ADMIN`, `IT_ADMIN`
  - [ ] Migrasi + RLS: `lookup_categories`, `lookup_values`, `system_parameters`, `parameter_definitions`, `eav_attributes`, `eav_values`, `nim_sequences` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (lookup_domain, data_type, scope_level, entity_type) & parameter (nim.pattern, nim.reset_scope, param.cache_ttl_seconds).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: CREATE, PARAM_EDIT, READ, TOGGLE_ACTIVE, UPDATE.
  - [ ] Engine lokal: Rule Parameter Resolver (hierarki TENANT→ORG→PROGRAM→PERIOD, effective-dated) + NIM Pattern Compiler (tokenizer {kodeFak}{tahun}{seq}) — unit test deterministik + golden dataset.
  - [ ] Event outbox: `parameter.versioned`, `lookup.changed`, `nim.generated`, `academic.student.activated`, `academic.student.status_changed`; konsumen idempoten untuk `pmb.registration.completed`, `finance.invoice.paid`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Kategori lookup, Parameter berubah 7 hari, NIM terbit periode ini, Atribut EAV; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:identity`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R1.3 M-03 Hak Akses & RBAC** — role: `TENANT_ADMIN`, `IT_ADMIN`
  - [ ] Migrasi + RLS: `roles`, `permissions`, `role_permissions`, `user_role_assignments`, `parameter_restrictions`, `rls_policy_map`, `access_change_requests` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (permission_action, scope_kind, policy_kind, dashboard_profile) & parameter (rbac.cache_ttl_seconds, rbac.four_eyes_required).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, READ, REJECT.
  - [ ] Engine lokal: Bitwise Permission Masking (10-bit action mask per resource; 64-bit word per 6 resource) — unit test deterministik + golden dataset.
  - [ ] Event outbox: `rbac.assignment.changed`, `rbac.role.changed`; konsumen idempoten untuk `hr.employee.terminated`, `academic.student.status_changed`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Role aktif, Permintaan akses menunggu, Assignment kedaluwarsa 30 hari, Pelanggaran SoD; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:identity`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R1.4 M-05 Keamanan & Audit** — role: `COMPLIANCE_OFFICER`, `IT_ADMIN`
  - [ ] Migrasi + RLS: `audit_logs`, `audit_anchors`, `pii_masking_rules`, `security_violations`, `data_subject_requests` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (mask_strategy, violation_kind, severity, dsr_type, dsr_status) & parameter (audit.anchor_cron, pdp.breach_notify_hours, pii.default_mask).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, READ.
  - [ ] Engine lokal: Merkle Tree SHA-256 + Hash Chaining (hash_n = SHA256(hash_{n-1} || canonical_json(row))) — unit test deterministik + golden dataset.
  - [ ] Event outbox: `security.violation.detected`, `audit.chain.broken`, `pdp.dsr.due`; konsumen idempoten untuk `*.* (semua event domain via outbox)`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Integritas rantai, Pelanggaran 24 jam, DSR jatuh tempo, Kolom PII ter-mask; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:audit`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R1.5 M-04 IT Helpdesk** — role: `IT_ADMIN`, `ALL_USERS`
  - [ ] Migrasi + RLS: `helpdesk_tickets`, `helpdesk_ticket_events`, `helpdesk_sla_rules` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (ticket_category, ticket_priority, ticket_status, ticket_event_type) & parameter (helpdesk.max_tier, helpdesk.auto_close_days).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, UNLOCK, UPDATE.
  - [ ] Engine lokal: Priority Queue (binary heap) dengan skor = bobot_prioritas × sisa_SLA + Escalation Timer (timing wheel) — unit test deterministik + golden dataset.
  - [ ] Event outbox: `helpdesk.ticket.created`, `helpdesk.ticket.escalated`, `helpdesk.sla.breached`; konsumen idempoten untuk `sla.breached`, `security.violation.detected`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Tiket saya, Tiket terbuka, SLA breach, Rata-rata resolusi; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:helpdesk`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.

### R2. Rektorat/Eksekutif — konfigurasi tata kelola & target

- [ ] **R2.1 M-32 Dashboard IKU** — role: `LEADER`, `DEAN`, `QUALITY_OFFICER`
  - [ ] Migrasi + RLS: `iku_definitions`, `iku_counters`, `iku_targets`, `iku_alerts` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (alert_level) & parameter (iku.full_recompute_cron).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: EXPORT, READ, UPDATE.
  - [ ] Engine lokal: Incremental IKU Calculator — unit test deterministik + golden dataset.
  - [ ] Event outbox: `iku.threshold.breached`; konsumen idempoten untuk `tracer.response.submitted`, `career.hired`, `mbkm.conversion.approved`, `lppm.output.validated`, `ipr.granted`, `intl.conversion.approved`, `achievement.recorded`, `hr.employee.hired`.
  - [ ] UI Velzon (UI_UX §10.4): kartu IKU 1–8, Alert ambang, Capaian vs target, Tren 3 tahun; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:tracer_iku`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R2.2 M-47 Endowment Fund** — role: `ENDOWMENT_MANAGER`, `DONOR`, `ADMIN_FINANCE`, `LEADER`
  - [ ] Migrasi + RLS: `donors`, `donor_campaigns`, `donations`, `fund_instruments`, `fund_yields`, `fund_allocation_rules`, `fund_allocations` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (instrument_type, compounding, restricted_purpose, allocation_target) & parameter (endowment.spend_rate_max_bp).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, REJECT, UPDATE.
  - [ ] Engine lokal: Compound Investment Yield Engine — unit test deterministik + golden dataset.
  - [ ] Event outbox: `endowment.yield.posted`, `endowment.allocation.approved`; konsumen idempoten untuk —.
  - [ ] UI Velzon (UI_UX §10.4): kartu Total pokok, Imbal hasil YTD, Alokasi tertunda, Donasi kampanye; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:endowment`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R2.3 M-45 CRM PMB & Marketing** — role: `MARKETING_PMB`, `PMB_AGENT`, `SCHOOL_COUNSELOR`, `LEADER`
  - [ ] Migrasi + RLS: `crm_leads`, `crm_lead_activities`, `crm_funnel_rules`, `crm_campaigns`, `crm_events`, `crm_agents`, `crm_commission_rules`, `crm_commissions` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (lead_source, lead_stage, marketing_channel, crm_activity_type, agent_type, commission_basis) & parameter (crm.lead_dedupe_threshold, crm.score.retrain_cron, crm.consent_required).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, REJECT, UPDATE.
  - [ ] Engine lokal: Probabilistic Lead Funnel Scorer — unit test deterministik + golden dataset.
  - [ ] Event outbox: `crm.lead.created`, `crm.lead.converted`, `crm.commission.approved`; konsumen idempoten untuk `pmb.registration.completed`, `finance.invoice.paid`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Lead baru 7 hari, Konversi funnel, CAC per kanal, Komisi tertunda; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:crm_marketing`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.

### R3. Kaprodi/Dekan — kurikulum, mutu, akreditasi

- [ ] **R3.1 M-12 Kurikulum OBE** — role: `HEAD_OF_PROGRAM`, `DEAN`, `LECTURER`
  - [ ] Migrasi + RLS: `curricula`, `graduate_profiles`, `plos`, `courses`, `course_prerequisites`, `clos`, `clo_plo_maps`, `rps_documents`, `obe_rubrics`, `plo_attainments`, `rpl_conversions` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (plo_domain, course_type, prereq_rule_type, rps_status) & parameter (obe.plo_pass_threshold, curriculum.min_total_sks).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, LOCK, READ, REJECT, UNLOCK.
  - [ ] Engine lokal: DAG Topological Sort (Kahn) atas prasyarat mata kuliah + CPL Attainment Matrix (CPMK→CPL berbobot) — unit test deterministik + golden dataset.
  - [ ] Event outbox: `curriculum.locked`, `rps.approved`, `obe.plo.computed`, `rpl.conversion.approved`; konsumen idempoten untuk `grading.khs.published`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Kurikulum aktif, RPS menunggu, Capaian CPL rata-rata, Mata kuliah tanpa CPMK; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:academic`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R3.2 M-37 SPMI & Quality** — role: `QUALITY_OFFICER`, `INTERNAL_AUDITOR`, `HEAD_OF_PROGRAM`, `LEADER`
  - [ ] Migrasi + RLS: `quality_standards`, `ami_cycles`, `ami_assignments`, `ami_checklists`, `ami_findings`, `ami_corrective_actions` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (ppepp_stage, finding_category, finding_status) & parameter (ami.rtl_due_days).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, LOCK, REJECT.
  - [ ] Engine lokal: PPEPP Audit State Machine (Penetapan→Pelaksanaan→Evaluasi→Pengendalian→Peningkatan) dengan guard transisi berbasis bukti — unit test deterministik + golden dataset.
  - [ ] Event outbox: `spmi.finding.opened`, `spmi.finding.closed`; konsumen idempoten untuk —.
  - [ ] UI Velzon (UI_UX §10.4): kartu Temuan terbuka, RTL lewat tenggat, Siklus AMI, Standar per tahap PPEPP; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:spmi`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R3.3 M-31 Akreditasi LKPS** — role: `HEAD_OF_PROGRAM`, `DEAN`, `QUALITY_OFFICER`, `LEADER`
  - [ ] Migrasi + RLS: `lkps_templates`, `lkps_snapshots`, `led_documents`, `ratio_checks` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (accreditation_instrument, ratio_code) & parameter (lkps.ts_years).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: CREATE, EXPORT, LOCK.
  - [ ] Engine lokal: 9-Criteria LKPS Extractor — unit test deterministik + golden dataset.
  - [ ] Event outbox: `accreditation.snapshot.frozen`; konsumen idempoten untuk `*.read_model.refreshed`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Kelengkapan 9 kriteria, Rasio gagal, Snapshot terakhir, LED progres; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:accreditation`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R3.4 M-38 Kampus Merdeka / MBKM** — role: `HEAD_OF_PROGRAM`, `STUDENT`, `MBKM_SUPERVISOR`
  - [ ] Migrasi + RLS: `mbkm_programs`, `mbkm_participants`, `mbkm_logbooks`, `mbkm_conversions` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (mbkm_scheme, logbook_source) & parameter (mbkm.max_sks_outside).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, CREATE, EXPORT, REJECT.
  - [ ] Engine lokal: DAG Credit Conversion — unit test deterministik + golden dataset.
  - [ ] Event outbox: `mbkm.conversion.approved`; konsumen idempoten untuk `fieldwork.score.submitted`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Peserta MBKM, Logbook terverifikasi, Konversi menunggu, SKS terkonversi; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:mbkm`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.

### R4. Staff BAAK/BAUK/Sarpras — operasi admisi, keuangan, jadwal, aset

- [ ] **R4.1 M-09 PMB & OCR** — role: `PMB_OPERATOR`, `APPLICANT`
  - [ ] Migrasi + RLS: `pmb_periods`, `pmb_tracks`, `form_schemas`, `pmb_applicants`, `pmb_documents`, `cbt_question_banks`, `cbt_questions`, `cbt_sessions`, `pmb_selection_results` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (pmb_track_type, pmb_doc_type, applicant_status, selection_decision, rpl_type, question_type) & parameter (pmb.ocr.match_threshold, pmb.ocr.langs, pmb.max_program_choices).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, REJECT, UPDATE.
  - [ ] Engine lokal: Local Tesseract OCR (tesseract.js WASM / tesseract-ocr worker, traineddata ind+eng dibundel) + Levenshtein Fuzzy Matching terhadap data isian — unit test deterministik + golden dataset.
  - [ ] Event outbox: `pmb.applicant.submitted`, `pmb.selection.decided`, `pmb.registration.completed`; konsumen idempoten untuk `crm.lead.converted`, `finance.invoice.paid`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Pendaftar per jalur, Dokumen menunggu verifikasi, Lulus seleksi, Daftar ulang; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:pmb`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R4.2 M-10 Keuangan & Billing** — role: `ADMIN_FINANCE`, `TREASURER`, `STUDENT`, `LEADER`
  - [ ] Migrasi + RLS: `fee_components`, `tariff_rules`, `invoices`, `invoice_lines`, `payments`, `finance_journals`, `finance_journal_lines`, `budget_lines`, `financial_holds` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (payment_channel, invoice_status, hold_reason, ukt_group, gl_account_type) & parameter (finance.va.expiry_hours, finance.hold.krs_block, finance.installment.max).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, CREATE, EXPORT, LOCK, UNLOCK.
  - [ ] Engine lokal: Multi-Variable Billing Matrix — unit test deterministik + golden dataset.
  - [ ] Event outbox: `finance.invoice.issued`, `finance.invoice.paid`, `finance.hold.changed`, `finance.journal.posted`, `finance.budget.committed`; konsumen idempoten untuk `pmb.selection.decided`, `enrollment.krs.approved`, `scholarship.award.approved`, `procurement.po.approved`, `lppm.disbursement.approved`, `hr.payroll.locked`, `endowment.yield.posted`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Tagihan terbit, Terbayar hari ini, Piutang > 30 hari, Serapan anggaran; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:finance`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R4.3 M-11 KIP-K & Beasiswa** — role: `SCHOLARSHIP_ADMIN`, `STUDENT`
  - [ ] Migrasi + RLS: `scholarship_programs`, `scholarship_applications`, `scholarship_awards`, `scholarship_monitoring`, `allowance_disbursements` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (sponsor, scholarship_status, warning_level) & parameter (scholarship.min_gpa, scholarship.freeze_after_warnings, scholarship.cr_max).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, LOCK, REJECT, UNLOCK, UPDATE.
  - [ ] Engine lokal: Weighted Sum + AHP Economic Scorer — unit test deterministik + golden dataset.
  - [ ] Event outbox: `scholarship.award.approved`, `scholarship.award.frozen`; konsumen idempoten untuk `grading.khs.published`, `endowment.allocation.approved`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Pendaftar, Penerima aktif, Peringatan IPK, Dana tersalur; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:scholarship`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R4.4 M-46 E-Procurement PBJ** — role: `PROCUREMENT_COMMITTEE`, `PPK_OFFICER`, `VENDOR`, `ADMIN_FINANCE`
  - [ ] Migrasi + RLS: `procurement_requests`, `procurement_items`, `vendors`, `rfq_bids`, `procurement_approvals`, `procurement_contracts`, `goods_receipts` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (procurement_method, procurement_status, vendor_status, unit_of_measure, approval_decision) & parameter (pbj.approval_levels, pbj.low_price_threshold, pbj.direct_procurement_ceiling_idr).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, REJECT, UPDATE.
  - [ ] Engine lokal: AHP Vendor Evaluator (harga, kualitas, waktu, rekam jejak, TKDN) + validasi HPS (penawaran ≤ HPS, deteksi harga tidak wajar < 80% HPS) — unit test deterministik + golden dataset.
  - [ ] Event outbox: `procurement.request.submitted`, `procurement.po.approved`, `procurement.goods.received`; konsumen idempoten untuk `finance.budget.committed`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Pengajuan aktif, Menunggu PPK, Nilai kontrak, Barang diterima; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:procurement`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R4.5 M-40 Aset & Inventaris** — role: `ASSET_ADMIN`, `IT_ADMIN`
  - [ ] Migrasi + RLS: `asset_categories`, `assets`, `asset_depreciations`, `asset_movements` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (asset_status) & parameter (asset.depreciation_cron, asset.tag_prefix).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, CREATE, EXPORT, LOCK, UPDATE.
  - [ ] Engine lokal: Straight-Line Depreciation — unit test deterministik + golden dataset.
  - [ ] Event outbox: `asset.registered`, `asset.depreciated`; konsumen idempoten untuk `procurement.goods.received`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Total aset, Nilai buku, Belum ter-tag, Penyusutan bulan ini; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:assets`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R4.6 M-14 Jadwal & Ruang** — role: `SCHEDULER`, `LAB_STAFF`
  - [ ] Migrasi + RLS: `rooms`, `time_slots`, `schedule_constraints`, `schedule_runs`, `class_meetings`, `room_bookings` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (room_type, day_of_week, shift, constraint_kind, constraint_hardness) & parameter (schedule.solver_timeout_seconds, schedule.min_break_minutes).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, CREATE, EXPORT, LOCK, UNLOCK.
  - [ ] Engine lokal: CSP Solver — unit test deterministik + golden dataset.
  - [ ] Event outbox: `schedule.published`, `schedule.meeting.changed`; konsumen idempoten untuk `enrollment.krs.approved`, `emergency.room.locked_out`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Konflik jadwal, Utilisasi ruang, Run terakhir, Booking hari ini; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:scheduling`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R4.7 M-15 Moda Perkuliahan** — role: `ADMIN_ACADEMIC`, `LECTURER`
  - [ ] Migrasi + RLS: `learning_modes`, `lecture_sessions`, `online_meetings`, `shift_allocations`, `reconciliation_rules` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (learning_mode, feeder_mode, shift, meeting_provider, evidence_type) & parameter (mode.online_min_join_ratio, mode.meeting_provider).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: CREATE, EXPORT, LOCK, UPDATE.
  - [ ] Engine lokal: Hybrid Reconciliation Matrix — unit test deterministik + golden dataset.
  - [ ] Event outbox: `teaching.session.mode_changed`, `teaching.session.closed`; konsumen idempoten untuk `schedule.published`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Sesi hari ini per moda, Rapat daring siap, Sesi belum ditutup, Distribusi F/O/M; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:teaching`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R4.8 M-33 Jadwal Darurat** — role: `SCHEDULER`, `SARPRAS_ADMIN`
  - [ ] Migrasi + RLS: `incidents`, `room_lockouts`, `reroute_plans` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (incident_kind, severity) & parameter (emergency.max_walk_m).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, LOCK, UNLOCK, UPDATE.
  - [ ] Engine lokal: Edmonds-Karp max-flow — unit test deterministik + golden dataset.
  - [ ] Event outbox: `emergency.room.locked_out`, `emergency.reroute.applied`; konsumen idempoten untuk —.
  - [ ] UI Velzon (UI_UX §10.4): kartu Insiden aktif, Ruang terkunci, Kelas terdampak, Rencana menunggu; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:scheduling`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.

### R5. Dosen — SDM, pengajaran, penilaian, riset

- [ ] **R5.1 M-06 HRIS & Payroll** — role: `HR_ADMIN`, `ADMIN_FINANCE`, `LECTURER`, `EMPLOYEE`
  - [ ] Migrasi + RLS: `employees`, `leave_requests`, `employee_attendance`, `kpi_scorecards`, `payroll_runs`, `payroll_lines`, `tax_brackets`, `ptkp_rates` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (employment_type, functional_rank, leave_type, pay_component, tax_scheme, ter_category) & parameter (payroll.cutoff_day, payroll.rounding, leave.annual_quota_days).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, LOCK, REJECT, UNLOCK, UPDATE.
  - [ ] Engine lokal: PPh 21 Dynamic Bracket Calculator — unit test deterministik + golden dataset.
  - [ ] Event outbox: `hr.employee.hired`, `hr.employee.terminated`, `hr.payroll.locked`, `hr.leave.approved`; konsumen idempoten untuk `bkd.report.approved`, `attendance.lecturer.session_closed`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Pegawai aktif, Cuti menunggu, Status payroll bulan ini, KPI rata-rata unit; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:hr_bkd`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R5.2 M-07 BKD Dosen** — role: `LECTURER`, `HEAD_OF_PROGRAM`, `BKD_ASSESSOR`, `HR_BKD_OFFICER`
  - [ ] Migrasi + RLS: `bkd_periods`, `bkd_activities`, `bkd_assessments`, `ewmp_rubrics` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (dharma, bkd_activity_type, bkd_verdict) & parameter (bkd.min_sks, bkd.max_sks, bkd.min_dharma_pendidikan_sks).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, LOCK, READ, REJECT, UPDATE.
  - [ ] Engine lokal: Interval Tree Overlap Detection pada (start_at, end_at) seluruh kegiatan tridharma + jadwal mengajar — unit test deterministik + golden dataset.
  - [ ] Event outbox: `bkd.activity.recorded`, `bkd.report.approved`; konsumen idempoten untuk `attendance.lecturer.session_closed`, `lppm.output.validated`, `journal.article.published`, `ipr.granted`, `thesis.supervision.logged`.
  - [ ] UI Velzon (UI_UX §10.4): kartu SKS terklaim, Bentrok terdeteksi, Asesmen menunggu, Status periode; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:hr_bkd`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R5.3 M-08 SISTER Sync** — role: `LECTURER`, `HR_BKD_OFFICER`
  - [ ] Migrasi + RLS: `sister_mappings`, `sister_sync_items`, `sister_sync_runs` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (sister_entity_type, sync_status) & parameter (sister.base_url, sister.batch_size, sister.retry_max).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: CREATE, EXPORT, READ, UPDATE.
  - [ ] Engine lokal: Delta Hash Sync — unit test deterministik + golden dataset.
  - [ ] Event outbox: `sister.item.pushed`, `sister.item.failed`; konsumen idempoten untuk `bkd.report.approved`, `lppm.output.validated`, `hr.employee.hired`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Antrean push, Gagal 24 jam, Terakhir sinkron, Delta tertunda; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:hr_bkd`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R5.4 M-16 LMS Digital** — role: `LECTURER`, `STUDENT`
  - [ ] Migrasi + RLS: `lms_courses`, `lms_materials`, `lms_progress`, `xapi_statements`, `lms_assignments`, `lms_submissions`, `lms_quizzes`, `lms_discussions`, `search_index_terms` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (material_type, xapi_verb) & parameter (lms.video_complete_ratio, lms.max_upload_mb).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: CREATE, EXPORT, READ, UPDATE.
  - [ ] Engine lokal: TF-IDF Local Vector Search (indeks invers + cosine) atas materi/diskusi; xAPI LRS lokal — unit test deterministik + golden dataset.
  - [ ] Event outbox: `lms.progress.updated`, `lms.submission.graded`, `lms.quiz.completed`; konsumen idempoten untuk `enrollment.krs.approved`, `teaching.session.closed`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Kelas aktif, Tugas jatuh tempo, Progres materi, Diskusi baru; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:lms`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R5.5 M-18 Presensi Smart** — role: `LECTURER`, `STUDENT`, `ADMIN_ACADEMIC`
  - [ ] Migrasi + RLS: `geofences`, `attendance_sessions`, `attendance_records`, `attendance_corrections`, `lecturer_attendance` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (attendance_method, attendance_status, feeder_mode) & parameter (attendance.qr_step_seconds, attendance.qr_tolerance_steps, attendance.geofence_radius_m, attendance.min_presence_ratio).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, CREATE, EXPORT, LOCK, READ, REJECT.
  - [ ] Engine lokal: HMAC-SHA256 TOTP (step 5 s, toleransi ±1 step) + Haversine distance ≤ radius geofence (default 30 m) + cek akurasi GPS — unit test deterministik + golden dataset.
  - [ ] Event outbox: `attendance.session.opened`, `attendance.recorded`, `attendance.lecturer.session_closed`; konsumen idempoten untuk `teaching.session.mode_changed`, `teaching.session.closed`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Sesi terbuka, Kehadiran hari ini, Di bawah 75%, Koreksi menunggu; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:attendance`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R5.6 M-17 Ujian & Proctoring** — role: `INVIGILATOR`, `LECTURER`, `STUDENT`
  - [ ] Migrasi + RLS: `exams`, `exam_attempts`, `proctoring_profiles`, `proctoring_flags`, `biometric_consents` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (exam_kind, flag_type, severity) & parameter (proctor.flag_threshold, proctor.face_check_interval_s).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, CREATE, EXPORT, LOCK, REJECT, UNLOCK.
  - [ ] Engine lokal: Local OpenCV / MediaPipe Face Mesh WASM di perangkat — unit test deterministik + golden dataset.
  - [ ] Event outbox: `cbt.attempt.flagged`, `cbt.attempt.submitted`; konsumen idempoten untuk `finance.hold.changed`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Ujian berlangsung, Flag real-time, Attempt selesai, Persetujuan biometrik; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:cbt`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R5.7 M-19 Nilai & KHS** — role: `LECTURER`, `HEAD_OF_PROGRAM`, `STUDENT`
  - [ ] Migrasi + RLS: `grade_scales`, `grade_scale_items`, `grade_components`, `grade_formulas`, `grade_values`, `final_grades`, `khs`, `grade_change_requests` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (grade_component_type, grade_change_status) & parameter (grading.publish_requires_lock, grading.rounding_digits).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, LOCK, READ, REJECT, UNLOCK, UPDATE.
  - [ ] Engine lokal: AST Math Evaluator — unit test deterministik + golden dataset.
  - [ ] Event outbox: `grading.final.locked`, `grading.khs.published`, `grading.transcript.updated`; konsumen idempoten untuk `lms.submission.graded`, `lms.quiz.completed`, `attendance.recorded`, `fieldwork.score.submitted`, `mbkm.conversion.approved`, `rpl.conversion.approved`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Kelas belum kunci nilai, Perubahan menunggu, IPS rata-rata, KHS terbit; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:assessment`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R5.8 M-20 Tugas Akhir & RAMA** — role: `STUDENT`, `THESIS_SUPERVISOR`, `EXAMINER`, `HEAD_OF_PROGRAM`
  - [ ] Migrasi + RLS: `theses`, `thesis_supervisors`, `thesis_logbooks`, `thesis_defenses`, `thesis_examiners`, `thesis_scores`, `repository_items` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (thesis_status, supervisor_role, defense_kind, topic_area) & parameter (thesis.min_logbook_entries, thesis.plagiarism_max, thesis.winnow.k).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, LOCK, READ, REJECT, UPDATE.
  - [ ] Engine lokal: Winnowing fingerprint (k-gram, window w) + Jaccard similarity terhadap korpus lokal tenant; OAI-PMH 2.0 XML serializer (oai_dc) — unit test deterministik + golden dataset.
  - [ ] Event outbox: `thesis.supervision.logged`, `thesis.defense.scored`, `thesis.repository.published`; konsumen idempoten untuk `grading.khs.published`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Mahasiswa bimbingan, Logbook menunggu tanda tangan, Sidang minggu ini, Terbit di RAMA; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:thesis`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R5.9 M-44 SIM-LPPM / LITABMAS** — role: `LECTURER`, `GRANT_REVIEWER`, `LPPM_ADMIN`, `ADMIN_FINANCE`, `LEADER`
  - [ ] Migrasi + RLS: `grant_schemes`, `grant_proposals`, `grant_proposal_members`, `grant_reviews`, `grant_contracts`, `grant_disbursements`, `research_outputs` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (funding_source, grant_member_role, output_type, review_recommendation, grant_status) & parameter (lppm.reviewers_per_proposal, lppm.nb.enabled, lppm.tranches).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, REJECT, UPDATE.
  - [ ] Engine lokal: Naive Bayes Proposal Scorer (multinomial, dilatih lokal dari proposal historis tenant) sebagai skor pendamping — keputusan tetap oleh reviewer buta — unit test deterministik + golden dataset.
  - [ ] Event outbox: `lppm.proposal.funded`, `lppm.disbursement.approved`, `lppm.disbursement.paid`, `lppm.output.validated`; konsumen idempoten untuk `endowment.allocation.approved`, `ipr.granted`, `journal.article.published`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Proposal dibuka, Review menunggu, Dana tersalur, Luaran tervalidasi (IKU 5); tombol aksi tergating izin; topik WebSocket `tenant:{tid}:litabmas`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R5.10 M-21 Jurnal & OJS** — role: `JOURNAL_MANAGER`, `LECTURER`
  - [ ] Migrasi + RLS: `journals`, `journal_articles`, `article_authors`, `apc_invoices` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (sinta_rank, article_status) & parameter (journal.harvest_cron, journal.apc_default_idr).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, CREATE, EXPORT.
  - [ ] Engine lokal: OAI-PMH Harvester inkremental (resumptionToken, from/until) dari OJS self-hosted + dedupe DOI — unit test deterministik + golden dataset.
  - [ ] Event outbox: `journal.article.published`; konsumen idempoten untuk `finance.invoice.paid`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Jurnal terkelola, Artikel baru, APC tertunda, Peringkat SINTA; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:journal`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R5.11 M-22 Inkubator & HAKI** — role: `IPR_MANAGER`, `LECTURER`, `STUDENT`
  - [ ] Migrasi + RLS: `ipr_filings`, `ipr_inventors`, `startups`, `startup_milestones`, `seed_fundings` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (ipr_type, ipr_status, startup_stage, milestone_type) & parameter (ipr.iku5_counted_types).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, REJECT.
  - [ ] Engine lokal: State machine pendaftaran HAKI + agregator IKU 5 (dedupe per luaran-dosen) — unit test deterministik + golden dataset.
  - [ ] Event outbox: `ipr.granted`, `incubator.milestone.achieved`; konsumen idempoten untuk `lppm.output.validated`.
  - [ ] UI Velzon (UI_UX §10.4): kartu HAKI diajukan, HAKI granted, Startup aktif, Dana seed; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:ipr_incubator`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.

### R6. Mahasiswa — layanan mandiri & kemahasiswaan

- [ ] **R6.1 M-13 KRS Online & Perwalian** — role: `ADVISER`, `STUDENT`, `ADMIN_ACADEMIC`
  - [ ] Migrasi + RLS: `advising_sessions`, `advising_logs`, `krs_headers`, `krs_items`, `krs_war_windows`, `sks_limit_rules` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (krs_status, advising_status) & parameter (krs.reservation_ttl_seconds, krs.war.rate_limit_per_min, krs.require_adviser_approval).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, CREATE, EXPORT, LOCK, REJECT, UNLOCK, UPDATE.
  - [ ] Engine lokal: Redis Redlock + Lua atomic seat decrement (DECR jika >0) dengan token antrean FIFO — unit test deterministik + golden dataset.
  - [ ] Event outbox: `enrollment.seat.reserved`, `enrollment.krs.submitted`, `enrollment.krs.approved`, `enrollment.krs.rejected`; konsumen idempoten untuk `finance.hold.changed`, `academic.student.activated`, `schedule.published`.
  - [ ] UI Velzon (UI_UX §10.4): kartu KRS saya / mahasiswa wali, Menunggu ACC, Kursi tersisa, Antrean war; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:enrollment`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R6.2 M-26 Simulasi Lulus** — role: `STUDENT`, `ADVISER`
  - [ ] Migrasi + RLS: `graduation_simulations` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (tidak ada) & parameter (study.max_semesters, simulation.max_sks_per_term).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: CREATE, EXPORT.
  - [ ] Engine lokal: Critical Path Method di atas DAG prasyarat × ketersediaan penawaran semester (ganjil/genap) — unit test deterministik + golden dataset.
  - [ ] Event outbox: —; konsumen idempoten untuk `grading.khs.published`, `curriculum.locked`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Sisa SKS, Semester lulus proyeksi, Mata kuliah kritis, Risiko lewat masa studi; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:academic`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R6.3 M-24 Kemahasiswaan & SKKM** — role: `STUDENT_AFFAIRS_ADMIN`, `STUDENT`
  - [ ] Migrasi + RLS: `skkm_rules`, `skkm_claims`, `achievements`, `student_organizations` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (skkm_activity_type, achievement_level, participation_role, achievement_rank) & parameter (skkm.min_points_graduation, skkm.duplicate_check).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, REJECT.
  - [ ] Engine lokal: SKKM Rule Scorer — unit test deterministik + golden dataset.
  - [ ] Event outbox: `skkm.claim.approved`, `achievement.recorded`; konsumen idempoten untuk —.
  - [ ] UI Velzon (UI_UX §10.4): kartu Klaim menunggu, Poin SKKM saya, Prestasi nasional/internasional, Ormawa aktif; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:student_affairs`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R6.4 M-25 KKN, PKL & Magang** — role: `STUDENT`, `FIELD_SUPERVISOR`, `PARTNER_MENTOR`, `LPPM_ADMIN`
  - [ ] Migrasi + RLS: `fieldwork_programs`, `fieldwork_sites`, `fieldwork_groups`, `fieldwork_members`, `fieldwork_logbooks`, `fieldwork_scores`, `partners` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (fieldwork_kind, partner_type, scorer_kind) & parameter (fieldwork.logbook_geofence_required, fieldwork.score_weights).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, LOCK, REJECT, UPDATE.
  - [ ] Engine lokal: K-Means spatial clustering (koordinat domisili/lokasi, k = jumlah lokasi) + balancing kapasitas + aturan heterogenitas prodi — unit test deterministik + golden dataset.
  - [ ] Event outbox: `fieldwork.logbook.verified`, `fieldwork.score.submitted`; konsumen idempoten untuk `enrollment.krs.approved`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Peserta aktif, Logbook belum diverifikasi, Nilai mitra masuk, Lokasi terisi; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:fieldwork`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R6.5 M-28 Career Center** — role: `CAREER_ADMIN`, `ALUMNI`, `EMPLOYER`, `STUDENT`
  - [ ] Migrasi + RLS: `employers`, `job_vacancies`, `job_applications`, `career_fairs` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (application_status, skill_tag) & parameter (career.min_match_score).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, READ.
  - [ ] Engine lokal: Bipartite graph matching (Hopcroft-Karp) kandidat↔lowongan dengan bobot skor skill (Jaccard tag kompetensi) — unit test deterministik + golden dataset.
  - [ ] Event outbox: `career.hired`; konsumen idempoten untuk `tracer.response.submitted`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Lowongan aktif, Lamaran, Rekrut tercatat, Mitra terverifikasi; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:career`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R6.6 M-29 KUI & Mobilitas** — role: `INTL_OFFICE_ADMIN`, `STUDENT`, `LEADER`
  - [ ] Migrasi + RLS: `mobility_programs`, `mobility_participants`, `immigration_documents`, `credit_conversion_factors`, `credit_conversions` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (mobility_direction, credit_system, immigration_doc_type) & parameter (intl.visa_alert_days).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, REJECT.
  - [ ] Engine lokal: ECTS Conversion Matrix — unit test deterministik + golden dataset.
  - [ ] Event outbox: `intl.conversion.approved`, `intl.visa.expiring`; konsumen idempoten untuk —.
  - [ ] UI Velzon (UI_UX §10.4): kartu Inbound/outbound, Visa < 30 hari, Konversi menunggu, Kelas BIPA; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:international`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R6.7 M-39 e-Library** — role: `LIBRARIAN`, `STUDENT`, `LECTURER`
  - [ ] Migrasi + RLS: `library_items`, `library_copies`, `library_loans`, `library_fines`, `library_clearances` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (copy_status, library_location) & parameter (library.loan_days, library.fine_per_day_idr, library.bm25_k1).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, CREATE, EXPORT, READ.
  - [ ] Engine lokal: BM25 local ranker (k1, b berparameter) atas indeks invers katalog MARC21/Dublin Core — unit test deterministik + golden dataset.
  - [ ] Event outbox: `library.clearance.granted`, `library.loan.overdue`; konsumen idempoten untuk `thesis.repository.published`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Pinjaman aktif, Terlambat, Denda tertunggak, Bebas pustaka hari ini; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:library`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R6.8 M-41 Klinik Kampus** — role: `CLINIC_DOCTOR`, `COUNSELOR`, `STUDENT`
  - [ ] Migrasi + RLS: `clinic_patients`, `medical_records`, `clinic_queue`, `counseling_bookings` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (triage_level, booking_status) & parameter (clinic.record_retention_years).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: EXPORT, UNLOCK, UPDATE.
  - [ ] Engine lokal: AES-256-GCM envelope encryption per rekam medis (DEK per record, KEK di KMS) + virtual queue (priority queue triase) — unit test deterministik + golden dataset.
  - [ ] Event outbox: `clinic.queue.called`; konsumen idempoten untuk —.
  - [ ] UI Velzon (UI_UX §10.4): kartu Antrean saat ini, Kunjungan hari ini, Booking konseling, Akses break-glass; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:clinic`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R6.9 M-42 Asrama & Kantin** — role: `DORM_MANAGER`, `STUDENT`
  - [ ] Migrasi + RLS: `dorm_rooms`, `dorm_allocations`, `shuttle_routes`, `wallet_accounts`, `wallet_ledger` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (gender, wallet_entry_kind) & parameter (wallet.max_balance_idr).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, CREATE, EXPORT, UPDATE.
  - [ ] Engine lokal: 3D Bin Packing (First-Fit Decreasing multi-dimensi — unit test deterministik + golden dataset.
  - [ ] Event outbox: `dorm.allocated`, `wallet.reconciled`; konsumen idempoten untuk `finance.invoice.paid`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Okupansi, Menunggu alokasi, Saldo beredar, Selisih rekonsiliasi; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:dormitory`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R6.10 M-43 Humas & Event** — role: `PR_EVENT_ADMIN`, `EVENT_PARTICIPANT`, `STUDENT`
  - [ ] Migrasi + RLS: `events`, `event_registrations`, `event_checkins`, `signage_schedules` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (event_status, registration_status) & parameter (event.waitlist_enabled).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, CREATE, EXPORT.
  - [ ] Engine lokal: Event Registration Scorer (prioritas berbobot — unit test deterministik + golden dataset.
  - [ ] Event outbox: `event.checked_in`; konsumen idempoten untuk `emergency.room.locked_out`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Event mendatang, Registrasi, Check-in live, Signage aktif; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:events`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.

### R7. Penutupan siklus lintas-role — kelulusan, regulasi, alumni

- [ ] **R7.1 M-30 Yudisium & SKPI** — role: `ADMIN_ACADEMIC`, `DEAN`, `STUDENT`, `UNIT_CLEARANCE_OFFICER`
  - [ ] Migrasi + RLS: `clearance_rules`, `clearance_states`, `yudisium_batches`, `yudisium_members`, `skpi_documents` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (clearance_requirement, graduation_predicate, yudisium_status) & parameter (yudisium.predicate_rules).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, LOCK, READ, REJECT.
  - [ ] Engine lokal: DFA Clearance Engine — unit test deterministik + golden dataset.
  - [ ] Event outbox: `yudisium.clearance.changed`, `yudisium.batch.approved`; konsumen idempoten untuk `finance.hold.changed`, `library.clearance.granted`, `skkm.claim.approved`, `thesis.repository.published`, `grading.transcript.updated`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Mahasiswa layak, Clearance tertahan, Batch menunggu, SKPI terbit; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:graduation`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R7.2 M-35 PIN & SIVIL** — role: `ADMIN_ACADEMIC`, `FEEDER_OPERATOR`, `PUBLIC`
  - [ ] Migrasi + RLS: `pin_quotas`, `pin_reservations`, `diplomas`, `signing_keys` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (pin_status) & parameter (diploma.qr_ttl_days, diploma.public_fields).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, CREATE, EXPORT, LOCK, READ.
  - [ ] Engine lokal: RSA-PSS / Ed25519 digital signature atas payload e-ijazah + HMAC token QR verifikasi publik (rotasi kunci berversi) — unit test deterministik + golden dataset.
  - [ ] Event outbox: `pin.reserved`, `diploma.issued`, `diploma.revoked`; konsumen idempoten untuk `yudisium.batch.approved`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Kuota PIN tersisa, Ijazah terbit, Verifikasi publik 7 hari, Pencabutan; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:graduation`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R7.3 M-23 Wisuda & Toga** — role: `GRADUATION_COMMITTEE`, `STUDENT`, `ADMIN_ACADEMIC`
  - [ ] Migrasi + RLS: `convocations`, `convocation_registrants`, `convocation_seats`, `gown_inventory`, `stage_call_logs` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (gown_size, registrant_status, seating_strategy) & parameter (graduation.guest_max, graduation.seating_strategy).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: CREATE, EXPORT, LOCK, UPDATE.
  - [ ] Engine lokal: Hungarian Algorithm (Kuhn-Munkres) untuk penugasan kursi berdasarkan biaya (urutan prodi, prestasi, aksesibilitas) — unit test deterministik + golden dataset.
  - [ ] Event outbox: `graduation.registered`, `graduation.stage_called`; konsumen idempoten untuk `yudisium.batch.approved`, `pin.reserved`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Pendaftar wisuda, Kursi terplot, Toga terdistribusi, Antrean panggung; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:graduation`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R7.4 M-27 Tracer Study** — role: `ALUMNI_ADMIN`, `ALUMNI`
  - [ ] Migrasi + RLS: `tracer_surveys`, `tracer_responses`, `alumni_profiles`, `blast_jobs` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (job_field, blast_channel) & parameter (tracer.waves_years, tracer.blast_rate_per_min).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: EXPORT, UPDATE.
  - [ ] Engine lokal: Survey longitudinal (gelombang 1/3/5 tahun) + alignment chart bidang kerja vs prodi (cosine similarity kode KBLI/KBJI) — unit test deterministik + golden dataset.
  - [ ] Event outbox: `tracer.response.submitted`; konsumen idempoten untuk `yudisium.batch.approved`, `pin.reserved`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Response rate, Bekerja < 6 bulan (IKU 1), Alumni terdata, Blast berjalan; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:tracer_iku`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R7.5 M-34 Feeder PDDikti** — role: `FEEDER_OPERATOR`, `IT_ADMIN`
  - [ ] Migrasi + RLS: `feeder_staging`, `feeder_rules`, `feeder_sync_jobs`, `feeder_corrections` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (feeder_entity_type, feeder_status) & parameter (feeder.fuzzy_threshold, feeder.retry_max).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: APPROVE, EXPORT, LOCK, REJECT, UPDATE.
  - [ ] Engine lokal: Local Fuzzy String Matcher (Jaro-Winkler + normalisasi) untuk koreksi referensi (wilayah, sekolah, nama ibu) + pre-sync rule engine — unit test deterministik + golden dataset.
  - [ ] Event outbox: `feeder.item.synced`, `feeder.item.failed`; konsumen idempoten untuk `academic.student.activated`, `enrollment.krs.approved`, `grading.khs.published`, `attendance.lecturer.session_closed`, `yudisium.batch.approved`, `teaching.session.mode_changed`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Staging error, Antrean sync, Sukses 24 jam, Koreksi menunggu; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:feeder_pddikti`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.
- [ ] **R7.6 M-36 Portal PPKS** — role: `PPKS_TASKFORCE`, `PPKS_REPORTER`, `LEADER`
  - [ ] Migrasi + RLS: `ppks_reports`, `ppks_cases`, `ppks_case_events`, `ppks_ministry_reports` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (ppks_case_status, ppks_event_type, risk_level) & parameter (ppks.response_days).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: CREATE, EXPORT, LOCK, READ.
  - [ ] Engine lokal: AES-256-GCM zero-knowledge vault — unit test deterministik + golden dataset.
  - [ ] Event outbox: `ppks.case.opened`; konsumen idempoten untuk —.
  - [ ] UI Velzon (UI_UX §10.4): kartu Kasus baru, Melewati batas respon, Kasus ditangani, Konseling terjadwal; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:ppks`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.

### R8. SuperApp Mobile

- [ ] **R8.1 APP SuperApp Mobile** — role: `STUDENT`, `LECTURER`
  - [ ] Migrasi + RLS: `devices`, `sync_cursors`, `push_tokens` (DATA_MODEL §15.6) — `pnpm db:lint` & tes RLS lintas-tenant hijau.
  - [ ] Seed lookup (device_platform, push_provider) & parameter (mobile.max_devices_per_user, mobile.offline_checkin_max_minutes, mobile.min_app_version).
  - [ ] Kontrak Zod + endpoint (API_SPEC §6.5) termasuk CRUD/TOGGLE_ACTIVE/EXPORT dan aksi: CREATE, LOCK, READ.
  - [ ] Engine lokal: SQLite (Drift) Differential Sync — unit test deterministik + golden dataset.
  - [ ] Event outbox: `mobile.device.bound`; konsumen idempoten untuk `attendance.session.opened`, `enrollment.krs.approved`, `grading.khs.published`, `finance.invoice.issued`, `thesis.supervision.logged`.
  - [ ] UI Velzon (UI_UX §10.4): kartu Jadwal hari ini, QR presensi, Tagihan, Notifikasi; tombol aksi tergating izin; topik WebSocket `tenant:{tid}:mobile_superapp`.
  - [ ] Matriks izin (SECURITY §10.4) diuji per role: allow + deny.


### R9. Hardening Enterprise

- [ ] R9.1 Tes E2E rantai I-1…I-10 & simulasi S-1…S-6 (PRD §10.5) di CI.
- [ ] R9.2 Uji beban 1.000 koneksi WebSocket + KRS war; p95 event→UI ≤ 2 s.
- [ ] R9.3 DPIA (biometrik, kesehatan, PPKS, lokasi) & uji penetrasi vault.
- [ ] R9.4 Golden dataset seluruh engine ARCHITECTURE §11.4.

---

# Lampiran A — Riwayat Phase 1–4 (status implementasi sebelum 2026-10-20)

<!-- SICA-47:END roadmap -->

## Ringkasan Fase Pengerjaan

```
[Phase 1: Foundation & Identity] ──> [Phase 2: Core Academic Web] ──> [Phase 3: Mobile MVP & Attendance] ──> [Phase 4: Hardening & Testing]
  (PostgreSQL RLS, Monorepo,           (KRS Online, KHS, Grading,             (Flutter Material 3, Riverpod,           (80% Coverage, Penetration,
   JWT Auth, Velzon UI Tokens)          Batas SKS, Master Data)                Dynamic QR, Haversine GPS)              CI/CD Pipeline, Staging)
```

---

## Phase 1: Foundation, Multi-Tenant Database & Identity (Minggu 1 - 2)

Fokus utama fase ini adalah membangun pondasi monorepo pnpm, skema database PostgreSQL 16 dengan Row-Level Security (RLS), sistem otentikasi mandiri (Argon2id + JWT RS256), dan design token Velzon pada Next.js Web Portal.

### 1.1 Inisialisasi Repositori Monorepo & Tooling
- [x] Inisialisasi pnpm workspace monorepo dengan struktur `apps/web`, `apps/mobile`, `packages/database`, `packages/contracts`, dan `packages/logger`.
  - *Target file:* `pnpm-workspace.yaml`, `package.json`, `turbo.json`
- [x] Konfigurasi TypeScript root dan path aliases `@/` untuk seluruh workspace.
  - *Target file:* `tsconfig.base.json`, `apps/web/tsconfig.json`
- [x] Pasang ESLint, Prettier, dan Husky git pre-commit hooks (lint-staged).
  - *Target file:* `.eslintrc.js`, `.prettierrc`, `.husky/pre-commit`

### 1.2 Database Schema & Drizzle ORM Setup
- [x] Konfigurasi koneksi PostgreSQL dan Drizzle Client dengan dukungan session GUC `app.current_tenant_id`.
  - *Target file:* `packages/database/src/client.ts`, `packages/database/drizzle.config.ts`
- [x] Tulis skema DDL tabel dasar: `tenants`, `users`, `sessions`, `refresh_tokens`, dan `tenant_memberships`.
  - *Target file:* `packages/database/src/schema/auth.ts`, `packages/database/src/schema/tenants.ts`
- [x] Tulis migrasi SQL penegakan PostgreSQL Row-Level Security (RLS) dan default deny policies.
  - *Target file:* `packages/database/migrations/0001_init_rls_policies.sql`
- [x] Buat migration runner script untuk Drizzle yang menerapkan lock timeout dan transaksi atomic.
  - *Target file:* `packages/database/src/migrate.ts`

### 1.3 Shared Validation Contracts (Zod)
- [x] Buat definisi skema validasi Envelope Standar (`success`, `data`, `meta`, `error`).
  - *Target file:* `packages/contracts/src/envelope.ts`
- [x] Buat skema Zod otentikasi: `LoginRequestSchema`, `MfaVerifySchema`, dan `RefreshTokenSchema`.
  - *Target file:* `packages/contracts/src/auth.ts`

### 1.4 Web Foundation & Autentikasi (Next.js App Router)
- [x] Terapkan CSS Design Tokens Velzon (`#3577f1`, `#0ab39c`, `#f7b84b`, `#f06548`), Tailwind CSS, shadcn/ui primitives, dan font Google **Plus Jakarta Sans** (web; `font-sans` di `tailwind.config.ts`, dimuat via `<link>` di `layout.tsx`). *(Sebelumnya Inter — lihat PROGRESS §5.20→§5.21.)*
  - *Target file:* `apps/web/src/app/globals.css`, `apps/web/src/styles/velzon-theme.css`, `apps/web/tailwind.config.ts`, `apps/web/src/lib/utils.ts`
- [x] Pasang komponen UI dasar: `Button`, `Input`, `Card`, Lucide Icons, dan Sonner Toast Provider.
  - *Target file:* `apps/web/src/components/ui/button.tsx`, `apps/web/src/components/ui/input.tsx`, `apps/web/src/components/ui/card.tsx`, `apps/web/src/components/ui/toaster.tsx`
- [x] Buat middleware Next.js untuk ekstraksi subdomain tenant, **verifikasi tanda tangan JWT RS256 (Edge/WebCrypto)**, dan proteksi rute (fail-secure).
  - *Target file:* `apps/web/src/middleware.ts` → `apps/web/src/lib/edge-auth.ts` → `apps/web/src/lib/jwt-edge.ts`
  - **AUD-02: CLOSED** — cookie tak lagi dipercaya buta; rute terproteksi `/dashboard` & `/academic` menolak token cacat/kedaluwarsa/unconfigured (redirect login + bersihkan cookie). Header `x-tenant-id`/`x-user-id` di-set dari klaim `tid`/`sub`. Butuh `JWT_PUBLIC_KEY_JWK` (+`JWT_ISSUER`/`JWT_AUDIENCE`) di-set.
- [~] Bangun API Route Handlers otentikasi backend:
  - [~] `POST /api/v1/auth/login` (*Target file:* `apps/web/src/app/api/v1/auth/login/route.ts`) — **DIPERBAIKI (Foundation Auth):** kini men-*sign* **JWT RS256 nyata** (fail-secure 500 bila `JWT_PRIVATE_KEY` unset). **Sisa AUD-03:** lookup user & verifikasi hash dari DB masih stub; sesi tak dipersist ke `sessions`.
  - [x] `POST /api/v1/auth/mfa/verify` (*Target file:* `apps/web/src/app/api/v1/auth/mfa/verify/route.ts`)
  - [x] `POST /api/v1/auth/refresh` (*Target file:* `apps/web/src/app/api/v1/auth/refresh/route.ts`)
  - [x] `POST /api/v1/auth/logout` (*Target file:* `apps/web/src/app/api/v1/auth/logout/route.ts`)
- [x] **Foundation Auth — primitif kriptografi (terverifikasi `tsc` + `vitest` 30 test lulus):**
  - `apps/web/src/modules/auth/services/jwt.service.ts` (RS256 sign/verify via Node `crypto`).
  - `apps/web/src/modules/auth/services/password.service.ts` (interface `PasswordHasher`; `ScryptPasswordHasher` peppered aktif, adapter `Argon2id` siap-aktif pasca-`argon2` terpasang).
  - `apps/web/src/modules/auth/services/token.service.ts` (opaque token + SHA-256 hash + family id + `safeEqualHex`).
  - `apps/web/src/lib/api-response.ts::extractRequestContext` kini **memverifikasi JWT** (fail-closed) — menutup AUD-02 pada jalur API.
  - Env baru `JWT_ISSUER`/`JWT_AUDIENCE` (config/env.ts, ENV_CONTRACT, SECURITY §2.4).
- [~] **Auth — sisa integrasi:** Argon2id aktif; lookup `users`/`tenant_memberships` + cek hash + persist `sessions`/`refresh_tokens`; revocation set `sid` (butuh `pnpm install` + PostgreSQL + Redis). **Verifikator JWT Edge/JWK — SELESAI & teruji:** `apps/web/src/lib/jwt-edge.ts` (`verifyJwtEdge` WebCrypto RS256) + helper `apps/web/src/lib/edge-auth.ts` (`verifyAccessToken`/`parseJwkPublicKey`) dirangkai ke `middleware.ts` + unit test `tests/unit/{jwt-edge,edge-auth}.test.ts`. **Sisa:** provider tenant untuk guard API + aktifkan `JWT_PUBLIC_KEY_JWK` di environment.
- [x] Bangun halaman Landing Page & Login Portal berbasis Velzon Card layout dengan interaksi Sonner Toast.
  - [x] **Login split-screen ala Velzon** (PROGRESS §5.19): panel kiri gelap (brand + ilustrasi produk CSS/SVG + heading + 3 badge trust) / panel kanan form; `LoginForm` + toggle lihat sandi + SSO Google/Microsoft. Perbaikan bug global `h1` color (judul gelap jadi terbaca) & bug layout collapse (ilustrasi terpotong saat zoom 100% → kini flow-normal, terukur aman).
    - [x] **Refactor total CSS/Font/Layout** (PROGRESS §5.21, "Principal Lead UI/UX Engineer"): font web → **Plus Jakarta Sans**; `login-form.tsx` & `page.tsx` ditulis ulang dengan kelas Tailwind eksplisit sesuai kontrak [UI_UX_DESIGN §4.3](file:///c:/SICA/docs/UI_UX_DESIGN.md) (root `h-screen overflow-hidden`, panel `w-1/2`, gradient `slate-950→blue-950`, label `uppercase tracking-wider`, tombol `velzon-primary`). Spec `blue-600` direkonsiliasi ke token Velzon. `tsc` 0, `lint` bersih, terverifikasi browser.
  - [x] **Katalog 19 modul per-peran** di landing (`module-catalog.tsx`) dari seed entitlement nyata + filter peran/kategori; **seksi Benchmark** (`benchmark.tsx`) diferensiator arsitektur + cakupan pasar. Copy i18n id/en.
  - *Target file:* `apps/web/src/app/page.tsx`, `apps/web/src/app/(auth)/login/page.tsx`, `apps/web/src/modules/auth/components/login-form.tsx`
- [x] Bangun layout dashboard web responsif — **Velzon "layout horizontal"** (baris 1: brand + pencarian + ikon utilitas + kartu profil; baris 2: menu navigasi berikon + dropdown). Sidebar vertikal & `header.tsx` lama **dihapus** sesuai koreksi user.
  - *Target file:* `apps/web/src/app/(dashboard)/layout.tsx`, `apps/web/src/components/layout/top-nav.tsx`
  - Menu hanya menunjuk rute nyata (`/dashboard`, `/academic/krs|khs|advisor`); item tanpa halaman diberi badge "Segera" (tak ada link mati). Responsif: menu→hamburger <1024px, search <1280px, util/profil <768px. Tanpa overflow horizontal (terverifikasi browser @495px).
- [x] **Dashboard DB-backed & role-aware** (§5.18 PROGRESS) — `modules/academic/services/dashboard.service.ts` (`loadDashboard` via `withTenantContext`/RLS + `calculateIpk`); `page.tsx` async RSC baca identitas dari header JWT-middleware. Menutup **AUD-01 jalur baca dashboard**. + `GET /api/v1/auth/me` (`me.service.ts`) untuk profil navigasi.
- [x] **Seed data akademik dev** — `apps/web/src/scripts/dev-seed-academic.ts` (`pnpm --filter @sica/web seed:academic`, idempoten) mengisi periode/prodi/kurikulum/matakuliah/ruang/kelas/sesi/mahasiswa/dosen/enrollment/nilai/presensi tenant `demo` supaya efek tiap role terlihat saat uji lokal.
- [x] **Landing page marketing lengkap + brand** — `app/page.tsx` (Nav sticky scroll-spy, Hero entrance + mockup, Stats CountUp, Modul, Deep-dive, Peran tab, Keamanan, Integrasi, Harga, Testimoni, FAQ, CTA, Footer) dengan copy i18n `id`/`en`; motion `components/landing/motion.tsx` hormat `prefers-reduced-motion`. Logo transparan + emblem (`scripts/make-logo-transparent.mjs`, `scripts/crop-logo-emblem.mjs`), lockup "SICA — System Integration Central Academic".

---

### 1.5 Modular Entitlement & Add-on Gating (Packaging SaaS — ADR-13, DATA_MODEL §12)
> Menjawab kebutuhan "kampus beli sebagian modul" (mis. sudah punya PMB → cukup SIAKAD; atau butuh LMS saja).
- [x] Skema Drizzle entitlement — `modules`, `module_dependencies`, `plan_modules`, `tenant_modules` (+ enum `module_category`/`module_license_metric`/`tenant_module_status`). **Terverifikasi `tsc` package database: 0 error schema.** (*Target file:* `packages/database/src/schema/modules.ts`)
- [x] Kontrak Zod `packages/contracts/src/entitlement.ts` (`ModuleCodeSchema`, `TenantModuleSchema`, `ActivateModuleSchema`, `DeactivateModuleSchema`) — diekspor via `index.ts`; terverifikasi `tsc`.
- [~] Skema SQL migrasi `packages/database/migrations/0004_entitlement_modules.sql` + seed katalog 19 modul + graf dependensi + RLS `tenant_modules` — **ditulis lengkap**, belum dieksekusi (butuh instance PostgreSQL). `tenant_modules` ikut pola RLS §6.2 (`app.tenant_id()`).
- [~] Resolver `apps/web/src/lib/entitlement.ts` + guard HOF `withModule(code, …)` — **logika graf dependensi murni + guard terimplementasi & teruji (vitest)**. **Provider `ModuleCheck` DB — SELESAI:** `apps/web/src/modules/entitlement/entitlement.repository.ts` (`createTenantModuleCheck` + `createDrizzleEntitlementRepository` dengan `withTenantContext`/RLS). **Sisa:** cache Redis 60s + invalidasi.
- [~] Enforcement dependensi di service (`422 MODULE_DEPENDENCY_UNMET`, `409 MODULE_IN_USE`) + endpoint — **SELESAI & teruji** (`entitlement.service.ts`, `tests/unit/entitlement-service.test.ts`). **Sisa:** terapkan `withModule(...)` ke **seluruh** route domain `api/v1/<domain>` (butuh provider aktif + DB) + tulis event audit aktivasi/deaktivasi.
- [x] Endpoint `GET /tenant/modules` & `POST /tenant/modules/:code/activate|deactivate` (API_SPEC §4.5) — route handler dibuat (`apps/web/src/app/api/v1/tenant/modules/**`), validasi Zod (`ModuleCodeSchema`/`Activate`/`Deactivate`), gating peran admin, peta 422/409. Runtime butuh DB (Supabase/§4.5); orkestrasi tervalidasi via unit test.
- [ ] Navigasi Web (`components/layout/top-nav.tsx` — **`sidebar.tsx` sudah dihapus**, diganti layout Velzon horizontal) & Bottom-nav Mobile (`custom_bottom_nav.dart`) disaring dari modul aktif (parity §3.4) + layout/route guard 404. **Dikerjakan di Slice ADM-1** (ROADMAP §2.5.1).
- [ ] Halaman marketplace/self-service add-on + metering `PER_SEAT` ke `tenant_usage`.
- [ ] Provisioning otomatis modul Core saat pembuatan tenant; default `finance`/`feeder_pddikti` ON namun dapat di-OFF.

---

## Phase 2: Core Academic Engine & Web Portal (Minggu 3 - 5)

Fokus fase ini adalah menyelesaikan seluruh alur transaksi akademik inti: manajemen kurikulum, pengisian KRS online, approval DPA, penjadwalan kuliah, presensi dosen, dan penerbitan KHS/Transkrip.

### 2.1 Database Academic Models
- [x] Tulis skema Drizzle untuk tabel master akademik: `faculties`, `departments`, `study_programs`, `curricula`, `courses`, `academic_periods`, `rooms`.
  - *Target file:* `packages/database/src/schema/academic-master.ts`
- [x] Tulis skema Drizzle untuk tabel operasional kuliah: `classes`, `class_schedules`, `enrollments`, `grades`, `grade_components`.
  - *Target file:* `packages/database/src/schema/classes.ts`, `packages/database/src/schema/enrollments.ts`
- [x] Eksekusi migrasi tabel master dan pasang RLS per-tenant di seluruh tabel baru.
  - *Target file:* `packages/database/migrations/0002_academic_core.sql`
- [~] **Lengkapi Field Data Biodata/Feeder (GAP Sevima/PDDikti — lihat [DATA_MODEL.md §11](file:///c:/SICA/docs/DATA_MODEL.md)).** Ditentukan saat audit field-data (Tahap 2): `students` belum punya atribut wajib feeder (sex/TTL/agama/alamat/wilayah/ortu/id_pd/foto); **belum ada tabel `lecturers` & `staff`** (NIDN/NUPTK/jabatan fungsional/rumpun/homebase); `courses` belum pecah SKS (teori/praktik/kerja/lab); `attendances` belum punya status H/I/S/A + GPS; `tenants`/`prodi` belum ada kode feeder PT/SK.
  - *Target file:* `packages/database/src/schema/*.ts` (biodata & lecturer baru), `migrations/0003_biodata_feeder.sql`
  - *Prasyarat:* refactor defek AUD-09 (`graduation_records` rangkap dua) sebelum migrasi.
  - **Progres eksekusi (Tahap 5, terverifikasi `tsc` package database: 0 error schema):** dibuat `schema/people.ts` (`lecturers`, `staff`, `studentAddresses`, `studentGuardians`), kolom biodata feeder ditambahkan ke `students` (`sex`, `birthPlace/Date`, `citizenship`, `religion`, `childOrder`, `fundingSource`, `photoUrl`, `pddiktiIdPpd`, `nisn`, `feederStatusCode`), enums baru (`sex_type`, `income_band`, `lecturer_job_rank`, `employment_type`, `attendance_status`), dan `index.ts` meng-ekspor `people`.
  - **Progres lanjutan (sesi field-data, `tsc` 0 error + `vitest` lulus):** `attendances` diperkaya (status `attendance_status`, `source` `attendance_source`, GPS `latitude/longitude`, `distance_meters`, `is_mock_location`, `marked_by`, `notes`, `created_at`); `courses` dipecah SKS (`sks_teori`, `sks_praktik`, `course_type`), indeks analitik `(tenant,student,marked_at)`; enum baru `attendance_source`/`course_type`; **kontrak Zod** `attendance.ts` **dan** `people.ts` (`StudentBiodataSchema`/`StudentGuardianSchema`/`LecturerSchema` + enum) teruji; **migrasi** `0005_field_data_attendance_courses.sql` ditulis (idempoten, expand-only, belum dieksekusi).
  - **Sisa (belum `[x]`):** migrasi SQL + RLS utk tabel `people` (biodata) saat DB ready; kolom kode feeder `tenants`/`organizations`/`study_programs` + `courses.sks_praktik_kerja`/`sks_lab`/`bahasa_pengantar`/`kode_rumpun` + `attendances.meeting_seq`/`device_id`/`accuracy_m`; form UI biodata lengkap; refactor defek AUD-09.

### 2.2 Academic Business Rule Engine
- [x] Implementasikan kalkulator IPK/IPS deterministik pembulatan 2 desimal half-up.
  - *Target file:* `apps/web/src/modules/academic/services/gpa-calculator.service.ts`
- [x] Implementasikan validator kuota batas SKS (BR-R2 & BR-A2) berdasarkan IPS semester sebelumnya.
  - *Target file:* `apps/web/src/modules/academic/services/sks-quota-validator.service.ts`
- [x] Implementasikan matrix detektor bentrok jadwal kuliah (Collision Detection) dosen dan ruang.
  - *Target file:* `apps/web/src/modules/academic/services/schedule-conflict-detector.service.ts`


### 2.3 API Route Handlers Akademik
> **Gap audit (AUD-01):** semua handler di bawah adalah **stub/mock** — memvalidasi Zod & memakai engine aturan bisnis nyata, tetapi **tidak memanggil Drizzle/`withTenantContext`** dan memakai `Math.random()` untuk kuota/kapasitas. RLS `tenant_id` **belum ditegakkan saat runtime**. Diperlukan integrasi DB penuh sebelum dapat ditandai `[x]`.
- [~] Buat handler daftar penawaran kelas KRS mahasiswa:
  - *Target file:* `apps/web/src/app/api/v1/academic/krs/open-classes/route.ts`
- [~] Buat handler submit pengajuan KRS mahasiswa dengan validasi kuota atomic:
  - *Target file:* `apps/web/src/app/api/v1/academic/krs/submit/route.ts`
- [~] Buat handler verifikasi dan approval KRS oleh Dosen Pembimbing Akademik (DPA):
  - *Target file:* `apps/web/src/app/api/v1/academic/krs/approve/route.ts`
- [~] Buat handler pengambilan KHS semester dan transkrip nilai kumulatif:
  - *Target file:* `apps/web/src/app/api/v1/academic/khs/[periodId]/route.ts`, `apps/web/src/app/api/v1/academic/transcript/route.ts`
- [~] Buat handler input dan approval nilai dosen dengan validasi komposisi 100%:
  - *Target file:* `apps/web/src/app/api/v1/academic/grading/route.ts` — **MOCK** (AUD-01), belum persistensi `grades`.

### 2.4 Antarmuka Web Akademik (Velzon UI Components)
- [x] Buat komponen Velzon Reusable: `VelzonDataGrid` (sorting, pagination, filtering) dan `StatCard`.
  - *Target file:* `apps/web/src/components/ui/velzon-data-grid.tsx`, `apps/web/src/components/ui/stat-card.tsx`
- [x] Bangun modul Pengisian KRS Mahasiswa dengan panel deteksi sisa SKS live.
  - *Target file:* `apps/web/src/app/(dashboard)/academic/krs/page.tsx`, `apps/web/src/modules/academic/components/krs-course-picker.tsx`
- [x] Bangun modul Approval KRS untuk Dosen Pembimbing Akademik.
  - *Target file:* `apps/web/src/app/(dashboard)/academic/advisor/page.tsx`
- [x] Bangun halaman Kartu Hasil Studi (KHS) dan cetak dokumen PDF (KRS & KHS).
  - *Target file:* `apps/web/src/app/(dashboard)/academic/khs/page.tsx`, `apps/web/src/modules/academic/services/pdf-generator.service.ts`

---

### 2.5 Area Administrasi & Data Master (keputusan urutan 2026-10-19)
> **Keputusan pemilik produk:** pengerjaan berikutnya **Admin dulu, mulai dari master data**, bukan loop KRS-read lebih dulu. Dasar: seluruh transaksi (KRS, nilai, presensi, tagihan, feeder) punya FK ke master data; hari ini master data **hanya** bisa diisi skrip seed, sehingga kampus tidak bisa mengelola sendiri — padahal "mandiri kelola tanpa vendor" adalah titik jual terhadap SIAKAD legacy.
> **Rujukan wajib sebelum kode:** [BENCHMARK_SEVIMA.md](file:///c:/SICA/docs/BENCHMARK_SEVIMA.md) (§2, §2A, §3–§7), [PRD §5.8](file:///c:/SICA/docs/PRD.md) (FR-ADM-07…13, FR-IDT-04, FR-DOC-02, dll.), [DATA_MODEL §14](file:///c:/SICA/docs/DATA_MODEL.md), [API_SPEC §4.6](file:///c:/SICA/docs/API_SPEC.md), [UI_UX_DESIGN §9](file:///c:/SICA/docs/UI_UX_DESIGN.md).

#### 2.5.0 Prasyarat dokumen-sudah-selesai (siklus ini)
- [x] Studi dokumentasi Sevima (menu admin, `Data Pelengkap` 6 kategori, `Setting Prodi` 9 tab, 20 pemetaan sumber Feeder, model hak akses 6 aksi, portofolio 20+ modul, model harga & hosting) dituangkan sebagai catatan resmi.
- [x] PRD: 13 FR baru + koreksi out-of-scope persuratan + usulan perluasan katalog modul (`litabmas`, `documents`, `kerjasama`).
- [x] DATA_MODEL §14: matriks status objek admin + DDL baru (`reference_items`/`reference_kinds`, `tenant_settings`, `enrollment_schemes`, `course_equivalencies`, `student_status_history` revisi, `permission_verb`).
- [x] API_SPEC §4.6: pola CRUD seragam, 23 objek, transisi status periode, aksi massal, impor & rekonsiliasi, 12 kode error baru.
- [x] UI_UX_DESIGN §9: IA Area Admin + pola daftar→drawer + kontrak visual 8 gugus + i18n kunci `admin.*`.
- [x] SECURITY_COMPLIANCE §3.3: matriks izin Admin 6 aksi + 4 lapis penegakan `/admin/*` + aturan impersonation & reset kredensial (anti-pattern Sevima).
- [x] TECH_CONVENTIONS §1.1.1: pohon file & aturan penamaan kode Area Admin (disesuaikan realita `(dashboard)/`, bukan pohon target yang masih drift).
- [x] **RBAC_MATRIX.md diadopsi & didaftarkan** sebagai dokumen #19 (sumber kebenaran hak akses, 22 peran + ~160 permission); §11 rekonsiliasi ditambahkan; **G-08 CLOSED** (`.cursor/rules/02-security.mdc` disinkron EdDSA→RS256).
- [ ] **Celah `G-01`–`G-07` + `G-09` (RBAC_MATRIX §8.2) menjadi pekerjaan ADM-1/ADM-8** — terverifikasi di kode: substring `isAdminRole` [guards.ts:6-11](file:///C:/SICA/apps/web/src/modules/entitlement/guards.ts#L6-L11), `TODO` verifikasi role ADVISER [krs/approve/route.ts:31](file:///C:/SICA/apps/web/src/app/api/v1/academic/krs/approve/route.ts#L31), top-nav statis [top-nav.tsx:89-112](file:///C:/SICA/apps/web/src/components/layout/top-nav.tsx#L89-L112). `G-09` = tambah kolom `permissions.resource` + `permissions.verb` pada migrasi ADM-8. **`G-08` CLOSED.**
- [ ] **AUD-09 (blocking, harus selesai sebelum migrasi ADM):** refactor `graduation_records` yang terdefinisi dua kali di [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md) (baris ±811 dan ±872).

#### 2.5.1 Slice ADM-1 — Kerangka Admin (fondasi semua slice)
- [ ] Skema + migrasi `0012_audit_outbox.sql`: `audit_logs` (partisi, hash-chain), `audit_chain_head`, `outbox`, `idempotency_keys`, `login_events`.
- [ ] Guard rute `/admin/*` 4 lapis: JWT → role+scope → `withModule` → `withTenantContext` (helper `requireAdmin(ctx, resource, verb, scope)`).
- [ ] Kontrak Zod `packages/contracts/src/admin-shell.ts` (list query, `IdempotencyKey`, envelope error admin) + `master-data.ts` (kerangka).
- [ ] Layout `/admin` (sub-nav grouped collapsible + context strip Periode/Prodi/Status) Velzon horizontal; filter menu dari entitlement aktif (menutup ROADMAP §1.5 item "sidebar disaring").
- [ ] Komponen `empty-state.tsx` (sebab + tautan perbaikan) & `impact-dialog.tsx` (pratinjau dependensi sebelum hapus).
- [ ] i18n `admin.menu.*`, `admin.errors.*` di `id.json` + `en.json` (bentuk identik).
- [ ] Unit + integration test: tolak akses lintas tenant & lintas scope; `VALIDATE` tidak bisa dipakai `UPDATE`.

#### 2.5.2 Slice ADM-2 — Tahun Akademik · Periode · Kalender
- [ ] Skema Drizzle `academic_calendar_events` + migrasi `0007_admin_calendar_reference.sql` + RLS generator §6.2.
- [ ] Kontrak Zod + OpenAPI untuk `academic-years`, `academic-periods`, `calendar-events` (enum `kind` termasuk `PDDIKTI_*_DUE`).
- [ ] API CRUD seragam §4.6 + `POST /admin/periode/:id/status` dengan matriks transisi (DRAFT/OPEN/CLOSED) + `403 CALENDAR_REGULATORY_EVENT` + `403 REOPEN_REQUIRES_APPROVAL`.
- [ ] Penegakan `423 PERIOD_CLOSED` pada **semua** rute tulis domain (middleware/helper satu titik, bukan cek tersebar).
- [ ] UI: 3 halaman master (daftar→drawer), tab `Band`/`Libur`, kolom Status, nonaktif-soft dulu.
- [ ] Test: buka periode belum siap → `422 PERIOD_NOT_READY` lengkap dengan sebab; tutup lalu tulis → `423`; hapus agenda wajib → `403`.

#### 2.5.3 Slice ADM-3 — Struktur & Kurikulum
- [ ] CRUD `organizations` (hierarki, tolak siklus) & `study_programs` (validasi plafon nasional BR-R2/R3/R4; `422 NATIONAL_CAP_TIGHTEN_ONLY`).
- [ ] CRUD `curricula`, `courses` (SKS pecah), `grade_scales` + `grade_scale_bands` (`422 BAND_OVERLAP`), `grade_components` (`422 WEIGHT_SUM_NOT_100`, AC-NIL-4).
- [ ] Tabel + migrasi `0008_curriculum_prereq_equivalency.sql`: `course_prerequisites` (anti self/siklus) & `course_equivalencies`.
- [ ] Kamus `reference_kinds`/`reference_items` + layar "Data Referensi" bertab (menggantikan ±30 layar master Sevima).
- [ ] UI + test: prodi tanpa fakultas induk; matakuliah duplikat kode per kurikulum; prasyarat melingkar ditolak.

#### 2.5.4 Slice ADM-4 — Ruang
- [ ] CRUD `rooms` (+ `capacity > 0`, `roomType`, fasilitas, nonaktif-soft) + `GET /admin/ruang/:id/utilisasi` pratinjau bentrok.
- [ ] Test: hapus ruang yang dipakai jadwal → `409 REFERENCE_IN_USE`.

#### 2.5.5 Slice ADM-5 — Kelas, Pengampu, Jadwal, Pertemuan
- [ ] `POST /admin/kelas/generate` (idempoten, nama A/B/C, hormati `maxParallelClasses`) + salin kelas antar periode.
- [ ] Penugasan dosen + `422 LECTURER_WORKLOAD_EXCEEDED` (BR-A11, maks 16 SKS) memakai `schedule-conflict-detector` yang sudah teruji.
- [ ] Jadwal mingguan + matriks hari×jam + `POST /admin/jadwal/validate` (AC-JDW-1, hard block).
- [ ] `POST /admin/pertemuan/generate` melewati hari libur dari kalender; `PATCH` sesi tunggal.
- [ ] Integrasi live: generate 12 kelas × 16 pertemuan = 192 sesi, jalankan ulang → `created:0, skipped:192`.

#### 2.5.6 Slice ADM-6 — Pengaturan Akademik (objek paling menentukan di multi-tenant)
- [ ] Tabel `academic_rules` + `blockades` + `enrollment_schemes` + `tenant_settings` (migrasi `0009_…`, `0010_…`).
- [ ] Skema `params` jsonb berversi + validasi Zod (plafon nasional tak terlampaui — NFR-R2 uji properti) + simpan sebagai versi baru (bukan `UPDATE` in-place).
- [ ] Wizard 4 langkah + diff + pratinjau dampak (menggantikan 9 tab switch Sevima).
- [ ] Gerbang ditegakkan di service (bukan UI): jendela KRS, `min_attendance_pct_for_exam` (BR-A15), cekal 4 dimensi (FR-AKA-10/AC-CEK-1), `late_krs_mode`, kuesioner pra-KHS (BR-A8).
- [ ] `tenant_settings.nim_format` untuk pencetakan/pembangkitan NIM; `document_numbering` (dipakai FR-DOC-02 nanti).

#### 2.5.7 Slice ADM-7 — Personel
- [ ] CRUD `students` + biodata feeder + `student_addresses` + `student_guardians` (layar bertab; masking PII per izin).
- [ ] CRUD `lecturers`/`staff` (NIDN/NUPTK unik per tenant; `Dosen Non-NIDN` didukung, padanan Sevima).
- [ ] `student_status_history` + `POST /admin/status-mahasiswa/change|bulk` (alasan wajib + approval + empat-mata).
- [ ] Pasang dosen-wali per angkatan/prodi (syarat loop approval KRS yang kini masih mock).
- [ ] Ekspor/impor tunggal + `Login As` berjustifikasi (FR-ADM-13) **dengan** audit.

#### 2.5.8 Slice ADM-8 — Pengguna & Hak Akses
- [ ] Migrasi `0011_rbac_scoped.sql`: `permissions` (+`resource`, `verb permission_verb`), `roles`, `role_permissions`, `user_role_assignments` (scope prodi/periode/kelas/org), `access_change_requests`.
- [ ] Matriks izin `resource × verb` (6 aksi) + penugasan ber-scope + riwayat izin (FR-IDT-04).
- [ ] Ganti pemindaian enum 5 nilai di `apps/web/src/lib/*` dengan resolver izin (satu titik).
- [ ] Viewer `audit_logs` + filter aktor/entitas/periode (read-only mutlak, AC-AUD-1).

#### 2.5.9 Slice ADM-9 — Impor massal & Kesehatan Data
- [ ] `POST /admin/impor/validate|commit` + `GET /admin/impor/:id` (templat per objek, batch 500 baris/transaksi, tanpa state setengah-jadi — NFR-U1).
- [ ] Panel **Kesehatan Data** (FR-ADM-10): NIM duplikat, dosen tanpa NIDN, prodi tanpa akreditasi/masa akreditasi habis (BR-R7), matakuliah tanpa kurikulum, kelas tanpa jadwal/jam, mahasiswa tanpa dosen-wali, komposisi bobot ≠ 100%.
- [ ] Gerbang status tenant `LIVE` tidak boleh aktif sebelum panel bersih (PRD J1, metrik ≤ 14 hari kerja).

#### 2.5.10 Definition of Done per slice (berulang, wajib)
- [ ] Kontrak Zod di `packages/contracts` + OpenAPI ter-generate (AGENTS §3.3).
- [ ] RLS: `tenant_id` + ENABLE/FORCE + policy + **uji 2-tenant silang ditolak** (NFR-S1).
- [ ] `tsc` 0 error · `lint --max-warnings 0` · `vitest` hijau (unit + integrasi Supabase live, self-cleaning).
- [ ] Audit event tercatat untuk tiap tulis; idempotensi terbukti untuk aksi massal.
- [ ] UI Velzon (UI_UX §2.0 & §9) terverifikasi di browser; i18n `id`+`en` bentuk identik.
- [ ] ROADMAP (file ini) + [PROGRESS_REPORT.md](file:///c:/SICA/docs/PROGRESS_REPORT.md) diperbarui pada commit yang sama.

---

## Phase 3: Mobile MVP & Dynamic QR Attendance (Minggu 6 - 7)

Fokus fase ini adalah membangun aplikasi Flutter untuk Mahasiswa dan Dosen dengan arsitektur Feature-First, Riverpod, Drift offline storage, serta modul Presensi QR Dinamis (TTL 30 detik) dengan validasi Haversine Geofencing GPS.

### 3.1 Mobile Core & Architecture Setup (Flutter)
- [x] Inisialisasi proyek Flutter 3.24+ dengan struktur direktori Feature-First (`lib/core`, `lib/features`).
  - *Target file:* `apps/mobile/pubspec.yaml`, `apps/mobile/lib/main.dart`
- [x] Konfigurasi `SicaTheme` (Material 3) mengadopsi Design Tokens Velzon (Primary `#3577F1`, Radius 8px & 12px).
  - *Target file:* `apps/mobile/lib/core/theme/sica_theme.dart`, `apps/mobile/lib/core/theme/color_tokens.dart`
- [x] Konfigurasi Dio HTTP Client dengan Interceptor: auto-inject Bearer JWT, `X-Tenant-ID`, dan token refresh handling.
  - *Target file:* `apps/mobile/lib/core/network/api_client.dart`
- [x] Konfigurasi Flutter Secure Storage untuk persistensi access token dan user credentials.
  - *Target file:* `apps/mobile/lib/core/security/secure_storage_service.dart`
- [x] Setup Drift SQLite untuk cache lokal jadwal dan profil mahasiswa.
  - *Target file:* `apps/mobile/lib/core/database/local_database.dart`

### 3.2 Mobile Features: Auth & Dashboard
- [x] Buat modul otentikasi login mobile dengan form validation dan tenant selector.
  - *Target file:* `apps/mobile/lib/features/auth/presentation/screens/login_screen.dart`, `apps/mobile/lib/features/auth/presentation/controllers/auth_notifier.dart`
- [x] Buat Custom Bottom Navigation Bar khas Velzon dengan Floating Action Button (FAB) scan QR di tengah.
  - *Target file:* `apps/mobile/lib/features/dashboard/presentation/screens/main_shell_screen.dart`, `apps/mobile/lib/features/dashboard/presentation/widgets/custom_bottom_nav.dart`
- [x] Bangun kartu identitas Digital KTM dengan badge prodi dan efek visual hologram.
  - *Target file:* `apps/mobile/lib/features/profile/presentation/widgets/digital_ktm_card.dart`
- [x] Bangun widget Kartu Jadwal Kuliah Hari Ini (*Today's Schedule Card*).
  - *Target file:* `apps/mobile/lib/features/dashboard/presentation/widgets/schedule_card.dart`

### 3.3 Dynamic QR Attendance & Geofencing System
> **Catatan audit:** logika HMAC-SHA256 + Haversine **nyata dan teruji**; namun kedua handler **tidak mempersistensikan sesi & kehadiran ke DB** dan **belum menyimpan nonce untuk anti-replay** server-side. **AUD-05 diperbaiki**: fallback HMAC hard-coded dihapus → fail-secure.
- [~] Bangun Backend Handler pembuat QR Dinamis Dosen (HMAC signed payload, rotasi setiap 30 detik):
  - *Target file:* `apps/web/src/app/api/v1/attendance/qr/generate/route.ts` — **belum** simpan sesi ke `class_sessions`.
- [~] Bangun Backend Handler verifikasi presensi scan mahasiswa (Haversine distance calculation, radius maks 50m, anti-mock GPS):
  - *Target file:* `apps/web/src/app/api/v1/attendance/qr/scan/route.ts` — **diperbaiki (Tahap 5):** kini mewajibkan `ctx.userId` (otorisasi mahasiswa) & mengembalikan `studentId`. Masih **belum** INSERT `attendances`; anti-replay nonce belum persisten.
- [x] Bangun layar Dosen untuk memancarkan QR Code yang berputar otomatis setiap 30 detik dengan progress ring countdown:
  - *Target file:* `apps/mobile/lib/features/attendance/presentation/screens/lecturer_qr_broadcast_screen.dart`
- [x] Bangun layar Scanner Mahasiswa (kamera overlay sudut melengkung, laser scanning animation, dan validasi koordinat GPS native):
  - *Target file:* `apps/mobile/lib/features/attendance/presentation/screens/qr_scanner_screen.dart`, `apps/mobile/lib/features/attendance/presentation/controllers/attendance_notifier.dart`

---

## Phase 4: Hardening, Testing, Security Audit & CI/CD (Minggu 8)

Fokus fase terakhir adalah mencapai batas minimal 80% code coverage, audit keamanan SAST/DAST, stress testing konkurensi KRS, dan otomasi pipeline deployment Vercel & Firebase.

### 4.1 Automated Testing Suite
> **Koreksi audit (AUD-04):** Unit & Security test sebelumnya **tidak dapat dikompilasi** (meng-import API fiktif `determineMaxSksByIps`, `detectScheduleConflicts`, `ScheduleItem`, field `RequestContext` tak dikenal). Sudah **direalign ke API nyata**; terverifikasi `vitest run` → **16/16 LULUS**. Klaim "95% line coverage" tidak pernah diukur dan tidak akurat (suite hanya menguji engine aturan bisnis, bukan cakupan penuh).
- [x] Buat Unit Tests kalkulasi IPK/IPS + alokasi kuota SKS + deteksi bentrok jadwal (terverifikasi lulus; **bukan** 95% cakupan penuh — angka cakupan belum diukur).
  - *Target file:* `apps/web/tests/unit/academic-calculation.test.ts`
- [x] Buat Security Tests pelindung API (401/403/422) — terverifikasi lulus.
  - *Target file:* `apps/web/tests/security/api-security-guards.test.ts`
- [~] Buat Integration Tests PostgreSQL Row-Level Security (RLS) tenant isolation.
  - *Target file:* `apps/web/tests/integration/tenant-rls.test.ts` — kompilasi bersih, tetapi **belum dieksekusi** (butuh instance PostgreSQL; belum tersedia di lingkungan audit ini).
- [~] Buat Widget & Notifier Tests untuk presensi QR mobile menggunakan `mocktail`.
  - *Target file:* `apps/mobile/test/features/attendance/attendance_notifier_test.dart` — **belum tervalidasi** (Flutter SDK tidak tersedia di lingkungan ini).
- [~] Jalankan k6 load testing untuk simulasi perebutan kuota kelas (150 concurrent users, sisa kuota 1).
  - *Target file:* `tests/load/krs-concurrency.js` — skrip ada; **belum dijalankan** (k6 + endpoint ber-DB belum tersedia).

### 4.2 Security Hardening & Observability
- [x] Konfigurasi Pino Logger dengan redaction filter otomatis untuk PII (NIK, email, token, password).
  - *Target file:* `packages/logger/src/index.ts`
- [x] Integrasikan Sentry SDK pada Next.js Web dan Flutter Mobile.
  - *Target file:* `apps/web/sentry.server.config.ts`, `apps/mobile/lib/core/monitoring/sentry_service.dart`
- [x] Lakukan audit kerentanan static analysis (SAST) menggunakan Semgrep dan Snyk.

### 4.3 CI/CD Deployment Automation
- [x] Siapkan file konfigurasi environment variables (`.env.example`) untuk Web, Mobile, dan DB migrator.
  - *Target file:* `apps/web/.env.example`, `apps/mobile/.env.example`, `packages/database/.env.example`
- [x] Buat GitHub Actions workflow terpadu (`lint`, `security-scan`, `test-coverage`, `deploy-web`, `deploy-mobile`).
  - *Target file:* `.github/workflows/main-pipeline.yml`
- [x] Konfigurasi Vercel Production Deployment untuk Web App.
- [x] Konfigurasi Firebase App Distribution untuk rilis staging APK Android tester.
- [x] Jalankan seed data realistis untuk staging demo kampus ("Universitas Nusantara").
  - *Target file:* `packages/database/src/seeds/seed-runner.ts`

### 4.4 Infrastruktur High-Concurrency & High Availability (1.000+ concurrent users)
> Spesifikasi ditetapkan di ARCHITECTURE §9–10, DEPLOYMENT_DEVOPS §4, DATA_MODEL §13. Status = **design locked**, implementasi infra **belum** (butuh environment cloud + `pnpm install`).
- [x] **Dokumentasi topologi multi-layer** — Cloudflare CDN/WAF(L7 LB+DDoS) → Web/API Cluster (auto-scale) → Redis Cluster → BullMQ Engine → PgBouncer → PostgreSQL Cluster (Primary+Replica). (ARCHITECTURE §9)
- [x] **Strategi antrian asinkron KRS War & presensi massal** — seat reservation atomic di Redis (Lua), DB finalis via worker + advisory lock per kelas + idempotensi + DLQ; anti row-lock. (ARCHITECTURE §10)
- [x] **Read/Write Splitting + composite indexing** jalur panas (open-classes, jadwal hari ini, roster, presensi) dengan `tenant_id` leading + `INCLUDE`, partisi per periode, gate `EXPLAIN ANALYZE`. (DATA_MODEL §13)
- [x] **Auto-scaling (HPA/Serverless Execution Limits)** berbasis CPU 60%/MEM 75%/RPS/queue-depth + PDB + graceful drain. (DEPLOYMENT_DEVOPS §4.1)
- [x] **Health check endpoints** `/api/v1/health` (liveness) & `/health/ready` (readiness, cek DB-primary/replica/Redis/queue/storage). (DEPLOYMENT_DEVOPS §4.2)
- [x] **Failover otomatis** (Patroni/repmgr PG, Redis Sentinel, LB ejection, circuit breaker) + **zero-downtime deploy** (canary→progressive, Expand-and-Contract migration, feature flag). (DEPLOYMENT_DEVOPS §4.3–4.4)
- [ ] Implementasi `apps/api`/`apps/worker` container + manifest HPA/PDB (Terraform/Helm) — butuh provisioning infra.
- [ ] Setup PgBouncer (transaction mode) + router `db.$primary()`/`db.$replica()` di `packages/database/src/client.ts`.
- [ ] Bangun Redis Cluster/Sentinel + modul seat-reservation Lua + BullMQ queues (`krs.enroll`, `attendance.flush`) + worker concurrency/limiter.
- [ ] Provision PostgreSQL Primary+Replica (streaming replikasi) + Patroni auto-failover + WAL-G PITR.
- [x] Implement `/api/v1/health` & `/health/ready` route handlers + integrasi probe LB. (handler dibuat: liveness selalu 200; readiness probe DB(required)/Redis/storage(degradable) via `aggregateHealth`; `readinessHttpStatus` → 503 saat down. Sisa: integrasi probe LB/Cloudflare saat infra ready.)
- [ ] Konfigurasi Cloudflare (WAF rules, rate-limit OW-window per tenant, Under Attack mode, cache/asset).
- [ ] Load test k6 **skenario OW-war 2.000–3.000 RPS tulis** → validasi tak ada row-lock, p95 & queue-depth dalam SLI. (*Target file:* `tests/load/krs-concurrency.js`)

### 4.5 Integrasi Supabase + Vercel (Dev → Deploy) — pasca `pnpm install`
> Status lingkungan dev: **`pnpm install` ✅; `apps/web` `tsc` 0 error; `vitest` 76/76 lulus; Supabase DB hidup — migrasi 0001→0005 diterapkan & RLS terverifikasi.** Keputusan stack dev user: **Supabase (Postgres, `ap-northeast-1`) + Vercel**.
- [x] Pulihkan toolchain build: jalankan `pnpm install` memakai pnpm bundled (`.tools/node`), `.tools/` & `*.tsbuildinfo` di-gitignore.
- [x] **Provision Supabase project** (Postgres). Ref `wngdmslvcmnjroyblolj`, region **`ap-northeast-1` (Tokyo)**. ⚠️ **Gotcha:** host direct `db.<ref>.supabase.co` **IPv6-only** → tak ter-resolve/dituju dari lingkungan IPv4 (dev lokal **dan** Vercel). WAJIB pakai **pooler IPv4**: *session* `aws-0-ap-northeast-1.pooler.supabase.com:5432` (migrasi DDL) & *transaction* `:6543?...&pgbouncer=true&pool_mode=transaction` (runtime serverless). **DB_USER pooler = `postgres.wngdmslvcmnjroyblolj`** (bukan `postgres`).
- [x] **Adaptasi migrasi untuk Supabase (RESOLVED & TERUJI DI DB NYATA):** `CREATE ROLE` non-superuser (Supabase `postgres`) gagal `insufficient_privilege` (42501), bukan `duplicate_object`. Solusi: blok role/grant di `0001` & `0004` kini `EXCEPTION WHEN others` (RAISE NOTICE skip) & policy `TO public` (konsisten dgn generator 0001). Runtime dev memakai role **pemilik tabel** dengan `FORCE ROW LEVEL SECURITY` + `set_config('app.current_tenant', …, true)`. Self-hosted (superuser) tetap membuat & grant `sica_app`. (MIGRATION_SOP §2.5)
- [x] Isi `apps/web/.env`: `DIRECT_DATABASE_URL` (session pooler) + `DATABASE_URL` (transaction pooler) sudah dipointing ke Supabase; `JWT_*` (RS256) + `PASSWORD_HASH_PEPPER` + `ATTENDANCE_HMAC_SECRET` terisi (dev). **Sisa:** `REDIS_URL` (Upstash) & storage/payment creds utk fitur non-core.
- [x] Jalankan migrasi 0001→0005 terhadap Supabase **SESUAI**; verifikasi: `modules`=19, `module_dependencies`=23, `tenant_isolation` policy=32, **`tenant_modules` tanpa `app.current_tenant` → 0 baris (RLS default-deny TERBUKTI)**. Temuan & perbaikan saat eksekusi: (a) `0002` memakai 5 enum yg tak pernah dibuat → ditambahkan bootstrap `CREATE TYPE` idempoten; (b) **`0003_people_biodata.sql` dibuat** (tabel lecturers/staff/addresses/guardians + kolom biodata `students` + RLS) — tadinya hilang (schema/DB drift); (c) **BUG FIX `client.ts`:** `SET LOCAL = $1` invalid (SET tak menerima bind param) → `set_config(..., true)`; `withTenantContext` kini jalan di PgBouncer transaction-mode.
- [ ] **Vercel:** `vercel link`, set Environment Variables (Production/Preview/Development) = env contract; pastikan `DATABASE_URL` pakai transaction pooler (serverless tidak boleh koneksi session langsung). Deploy preview → cek `/api/v1/health`.
- [~] **Login + siklus token DB-backed (AUD-03):** `authenticate` (users/memberships email|NIM → verify hash → persist `sessions`+`refresh_tokens` → JWT RS256), `rotateRefreshToken` (rotasi single-use + **reuse-detection family**), `revokeSession`/`revokeByRefreshToken` (logout) — **teruji e2e live Supabase** (login 12/12, lifecycle 8/8). RBAC per-tenant `tenant_memberships.role` (migrasi `0006`). **Sisa:** `argon2` native belum terpasang → `ScryptPasswordHasher` interim; tukar ke Argon2id + notifikasi user saat reuse-detection.
- [ ] (Opsional) Vercel Cron untuk job BullMQ/feeder, atau worker di luar Vercel (karena long-running) — selaraskan ADR-9/ADR-10.
