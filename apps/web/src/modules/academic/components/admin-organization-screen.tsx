'use client';

/**
 * Layar "Organisasi & Program Studi" area Admin kampus — Fase 1B item 4.
 *
 * Dua tab, satu alasan: keduanya adalah master yang dipanggil oleh LAYER lain.
 *  - `organizations` adalah tanah tempat lingkup penugasan `ORG` berpijak;
 *  - `study_programs` memegang angka akademik (beban SKS, masa studi, ambang IPK)
 *    yang hari ini tidak boleh jadi konstanta di kode (AGENTS §3.10).
 *
 * Yang sengaja TIDAK ada di layar ini: tombol hapus. Menghapus organisasi atau prodi
 * memutus titik rujukan penugasan dan laporan yang sudah terbit; keadaan "tidak aktif"
 * menjadi slice tersendiri, bukan shortcut di drawer.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, GraduationCap } from 'lucide-react';
import {
  OrganizationKindSchema,
  StudyProgramLevelSchema,
  type AdminOrganizationRow,
  type AdminStudyProgramRow,
  type OrganizationKind,
  type StudyProgramLevel,
} from '@sica/contracts';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';
import { PageHeader } from '@/components/ui/page-header';
import { VelzonDataGrid, type ColumnDef } from '@/components/ui/velzon-data-grid';
import { getDictionary } from '@/lib/i18n';
import { apiRequest, issuesByField } from '@/lib/api-client';

type Tab = 'org' | 'prodi';

const ORG_ENDPOINT = '/api/v1/admin/organisasi';
const PRODI_ENDPOINT = '/api/v1/admin/master/prodi';

interface OrgForm {
  parentId: string;
  kind: OrganizationKind;
  name: string;
  code: string;
  reason: string;
}

interface ProdiForm {
  orgId: string;
  name: string;
  code: string;
  pddiktiCode: string;
  level: StudyProgramLevel;
  minTotalSks: string;
  nominalStudySemesters: string;
  maxStudySemesters: string;
  graduationMinIpk: string;
  accreditationStatus: string;
  reason: string;
}

const EMPTY_ORG: OrgForm = { parentId: '', kind: 'FACULTY', name: '', code: '', reason: '' };
const EMPTY_PRODI: ProdiForm = {
  orgId: '',
  name: '',
  code: '',
  pddiktiCode: '',
  level: 'S1',
  minTotalSks: '',
  nominalStudySemesters: '',
  maxStudySemesters: '',
  graduationMinIpk: '',
  accreditationStatus: '',
  reason: '',
};

const blank = (v: string | null | undefined) => v ?? '';

export function AdminOrganizationScreen() {
  const t = getDictionary('id').admin.org;
  const kinds = useMemo(() => OrganizationKindSchema.options, []);
  const levels = useMemo(() => StudyProgramLevelSchema.options, []);

  const [tab, setTab] = useState<Tab>('org');
  const [orgs, setOrgs] = useState<readonly AdminOrganizationRow[]>([]);
  const [prodis, setProdis] = useState<readonly AdminStudyProgramRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: 'success' | 'danger'; body: string } | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [orgForm, setOrgForm] = useState<OrgForm>(EMPTY_ORG);
  const [prodiForm, setProdiForm] = useState<ProdiForm>(EMPTY_PRODI);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const [o, p] = await Promise.all([
      apiRequest<readonly AdminOrganizationRow[]>(ORG_ENDPOINT),
      apiRequest<readonly AdminStudyProgramRow[]>(PRODI_ENDPOINT),
    ]);
    if (o.ok) setOrgs(o.data);
    if (p.ok) setProdis(p.data);
    if (!o.ok) setLoadError(o.message);
    else if (!p.ok) setLoadError(p.message);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const orgNameById = useMemo(() => new Map(orgs.map((o) => [o.id, o.name])), [orgs]);

  const openCreateOrg = () => {
    setEditingId(null);
    setOrgForm({ ...EMPTY_ORG, parentId: '' });
    setFieldErrors({});
    setBanner(null);
    setDrawerOpen(true);
  };

  const openEditOrg = (row: AdminOrganizationRow) => {
    setEditingId(row.id);
    setOrgForm({
      parentId: row.parentId ?? '',
      kind: row.kind,
      name: row.name,
      code: blank(row.code),
      reason: '',
    });
    setFieldErrors({});
    setBanner(null);
    setDrawerOpen(true);
  };

  const openCreateProdi = () => {
    setEditingId(null);
    setProdiForm({ ...EMPTY_PRODI, orgId: '' });
    setFieldErrors({});
    setBanner(null);
    setDrawerOpen(true);
  };

  const openEditProdi = (row: AdminStudyProgramRow) => {
    setEditingId(row.id);
    setProdiForm({
      orgId: row.orgId ?? '',
      name: row.name,
      code: blank(row.code),
      pddiktiCode: blank(row.pddiktiCode),
      level: row.level,
      minTotalSks: row.minTotalSks,
      nominalStudySemesters: String(row.nominalStudySemesters),
      maxStudySemesters: String(row.maxStudySemesters),
      graduationMinIpk: row.graduationMinIpk,
      accreditationStatus: blank(row.accreditationStatus),
      reason: '',
    });
    setFieldErrors({});
    setBanner(null);
    setDrawerOpen(true);
  };

  async function submit(): Promise<void> {
    setIsSubmitting(true);
    setFieldErrors({});
    const isOrg = tab === 'org';
    const endpoint = isOrg ? ORG_ENDPOINT : PRODI_ENDPOINT;
    const body: Record<string, unknown> = isOrg
      ? {
          parentId: orgForm.parentId.length > 0 ? orgForm.parentId : null,
          kind: orgForm.kind,
          name: orgForm.name,
          code: orgForm.code.length > 0 ? orgForm.code : null,
          reason: orgForm.reason,
        }
      : {
          orgId: prodiForm.orgId.length > 0 ? prodiForm.orgId : null,
          name: prodiForm.name,
          code: prodiForm.code.length > 0 ? prodiForm.code : null,
          pddiktiCode: prodiForm.pddiktiCode.length > 0 ? prodiForm.pddiktiCode : null,
          level: prodiForm.level,
          minTotalSks: Number(prodiForm.minTotalSks),
          nominalStudySemesters: Number(prodiForm.nominalStudySemesters),
          maxStudySemesters: Number(prodiForm.maxStudySemesters),
          graduationMinIpk: Number(prodiForm.graduationMinIpk),
          accreditationStatus: prodiForm.accreditationStatus.length > 0 ? prodiForm.accreditationStatus : null,
          reason: prodiForm.reason,
        };

    const url = editingId ? `${endpoint}/${editingId}` : endpoint;
    const result = await apiRequest(url, { method: editingId ? 'PATCH' : 'POST', body });
    if (result.ok) {
      setDrawerOpen(false);
      setBanner({ tone: 'success', body: t.saved });
      await load();
    } else {
      setFieldErrors(issuesByField(result.issues ?? []));
      setBanner({ tone: 'danger', body: result.message });
    }
    setIsSubmitting(false);
  }

  const orgColumns: readonly ColumnDef<AdminOrganizationRow>[] = [
    { key: 'name', header: t.colName, sortable: true },
    { key: 'kind', header: t.colKind, sortable: true, render: (r) => t[(('kind' + r.kind) as keyof typeof t)] as string },
    { key: 'code', header: t.colCode, render: (r) => r.code ?? '—' },
    {
      key: 'parent',
      header: t.colParent,
      sortValue: (r) => (r.parentId ? orgNameById.get(r.parentId) ?? '' : ''),
      render: (r) => (r.parentId ? orgNameById.get(r.parentId) ?? '—' : '—'),
    },
    { key: 'children', header: t.colChildren, align: 'right', valueType: 'number', render: (r) => String(r.childCount) },
    { key: 'programs', header: t.colPrograms, align: 'right', valueType: 'number', render: (r) => String(r.programCount) },
  ];

  const prodiColumns: readonly ColumnDef<AdminStudyProgramRow>[] = [
    { key: 'name', header: t.colName, sortable: true },
    { key: 'level', header: t.colLevel, sortable: true },
    { key: 'org', header: t.colParent, render: (r) => r.orgName ?? '—' },
    { key: 'code', header: t.colCode, render: (r) => r.code ?? '—' },
    { key: 'pddiktiCode', header: t.colPddikti, render: (r) => r.pddiktiCode ?? '—' },
    { key: 'minTotalSks', header: t.colSks, align: 'right', valueType: 'number', render: (r) => r.minTotalSks },
    { key: 'nominal', header: t.colNominal, align: 'right', valueType: 'number', render: (r) => `${r.nominalStudySemesters}` },
    { key: 'max', header: t.colMax, align: 'right', valueType: 'number', render: (r) => `${r.maxStudySemesters}` },
    { key: 'ipk', header: t.colIpk, align: 'right', valueType: 'number', render: (r) => r.graduationMinIpk },
    { key: 'akre', header: t.colAccreditation, render: (r) => r.accreditationStatus ?? '—' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t.title}
        description={t.subtitle}
        actions={
          <Button size="sm" onClick={tab === 'org' ? openCreateOrg : openCreateProdi}>
            {tab === 'org' ? t.createOrg : t.createProdi}
          </Button>
        }
      />

      {banner ? <Alert tone={banner.tone} title={banner.tone === 'success' ? t.saved : 'Gagal'}><p>{banner.body}</p></Alert> : null}
      <Alert tone="info" title={t.tabOrg}><p>{t.note}</p></Alert>

      <div role="tablist" aria-label={t.title} className="flex gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'org'}
          className={tab === 'org' ? 'btn btn-primary btn-sm' : 'btn btn-light btn-sm'}
          onClick={() => setTab('org')}
        >
          <Building2 size={14} strokeWidth={2} aria-hidden />
          {t.tabOrg}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'prodi'}
          className={tab === 'prodi' ? 'btn btn-primary btn-sm' : 'btn btn-light btn-sm'}
          onClick={() => setTab('prodi')}
        >
          <GraduationCap size={14} strokeWidth={2} aria-hidden />
          {t.tabProdi}
        </button>
      </div>

      {tab === 'org' ? (
        <VelzonDataGrid
          columns={orgColumns}
          data={orgs}
          keyExtractor={(r) => r.id}
          ariaLabel={t.tabOrg}
          searchable
          searchKeys={['name', 'code']}
          isLoading={isLoading}
          error={loadError ? { message: loadError, onRetry: () => void load() } : null}
          emptyMessage={t.noOrgs}
          onRowOpen={openEditOrg}
        />
      ) : (
        <VelzonDataGrid
          columns={prodiColumns}
          data={prodis}
          keyExtractor={(r) => r.id}
          ariaLabel={t.tabProdi}
          searchable
          searchKeys={['name', 'code', 'pddiktiCode']}
          isLoading={isLoading}
          error={loadError ? { message: loadError, onRetry: () => void load() } : null}
          emptyMessage={t.noProdis}
          onRowOpen={openEditProdi}
        />
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={tab === 'org' ? (editingId ? t.editOrg : t.createOrg) : editingId ? t.editProdi : t.createProdi}
        description={tab === 'prodi' ? t.hintNumbers : undefined}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDrawerOpen(false)}>
              {getDictionary('id').admin.close}
            </Button>
            <Button size="sm" disabled={isSubmitting} onClick={() => void submit()}>
              {isSubmitting ? getDictionary('id').admin.busy : getDictionary('id').admin.save}
            </Button>
          </div>
        }
      >
        {tab === 'org' ? (
          <div className="flex flex-col gap-4">
            <Field label={t.fName} htmlFor="og-name" required error={fieldErrors['name']}>
              <Input id="og-name" value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} />
            </Field>
            <Field label={t.fKind} htmlFor="og-kind" required error={fieldErrors['kind']}>
              <select
                id="og-kind"
                className="form-select"
                value={orgForm.kind}
                onChange={(e) => setOrgForm({ ...orgForm, kind: e.target.value as OrganizationKind })}
              >
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {t[(('kind' + k) as keyof typeof t)] as string}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t.fParent} htmlFor="og-parent" error={fieldErrors['parentId'] ?? (fieldErrors['orgId'] as string | undefined)}>
              <select
                id="og-parent"
                className="form-select"
                value={orgForm.parentId}
                onChange={(e) => setOrgForm({ ...orgForm, parentId: e.target.value })}
              >
                <option value="">{t.fNoParent}</option>
                {orgs
                  .filter((o) => o.id !== editingId)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={t.fCode} htmlFor="og-code" hint={t.hintCode} error={fieldErrors['code']}>
              <Input id="og-code" value={orgForm.code} onChange={(e) => setOrgForm({ ...orgForm, code: e.target.value })} />
            </Field>
            <Field label={t.fReason} htmlFor="og-reason" required error={fieldErrors['reason']}>
              <Textarea
                id="og-reason"
                value={orgForm.reason}
                onChange={(e) => setOrgForm({ ...orgForm, reason: e.target.value })}
              />
            </Field>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Field label={t.fName} htmlFor="pr-name" required error={fieldErrors['name']}>
              <Input id="pr-name" value={prodiForm.name} onChange={(e) => setProdiForm({ ...prodiForm, name: e.target.value })} />
            </Field>
            <Field label={t.fLevel} htmlFor="pr-level" required error={fieldErrors['level']}>
              <select
                id="pr-level"
                className="form-select"
                value={prodiForm.level}
                onChange={(e) => setProdiForm({ ...prodiForm, level: e.target.value as StudyProgramLevel })}
              >
                {levels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t.fParent} htmlFor="pr-org" error={fieldErrors['orgId']}>
              <select
                id="pr-org"
                className="form-select"
                value={prodiForm.orgId}
                onChange={(e) => setProdiForm({ ...prodiForm, orgId: e.target.value })}
              >
                <option value="">{t.noParentOption}</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t.fCode} htmlFor="pr-code" hint={t.hintCode} error={fieldErrors['code']}>
                <Input id="pr-code" value={prodiForm.code} onChange={(e) => setProdiForm({ ...prodiForm, code: e.target.value })} />
              </Field>
              <Field label={t.fPddikti} htmlFor="pr-pddikti" hint={t.hintPddikti} error={fieldErrors['pddiktiCode']}>
                <Input
                  id="pr-pddikti"
                  value={prodiForm.pddiktiCode}
                  onChange={(e) => setProdiForm({ ...prodiForm, pddiktiCode: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t.fMinSks} htmlFor="pr-sks" required error={fieldErrors['minTotalSks']}>
                <Input
                  id="pr-sks"
                  inputMode="decimal"
                  value={prodiForm.minTotalSks}
                  onChange={(e) => setProdiForm({ ...prodiForm, minTotalSks: e.target.value })}
                />
              </Field>
              <Field label={t.fIpk} htmlFor="pr-ipk" required error={fieldErrors['graduationMinIpk']}>
                <Input
                  id="pr-ipk"
                  inputMode="decimal"
                  value={prodiForm.graduationMinIpk}
                  onChange={(e) => setProdiForm({ ...prodiForm, graduationMinIpk: e.target.value })}
                />
              </Field>
              <Field label={t.fNominal} htmlFor="pr-nom" required error={fieldErrors['nominalStudySemesters']}>
                <Input
                  id="pr-nom"
                  inputMode="numeric"
                  value={prodiForm.nominalStudySemesters}
                  onChange={(e) => setProdiForm({ ...prodiForm, nominalStudySemesters: e.target.value })}
                />
              </Field>
              <Field label={t.fMax} htmlFor="pr-max" required error={fieldErrors['maxStudySemesters']}>
                <Input
                  id="pr-max"
                  inputMode="numeric"
                  value={prodiForm.maxStudySemesters}
                  onChange={(e) => setProdiForm({ ...prodiForm, maxStudySemesters: e.target.value })}
                />
              </Field>
            </div>
            <Field label={t.fAccreditation} htmlFor="pr-akre" error={fieldErrors['accreditationStatus']}>
              <Input
                id="pr-akre"
                value={prodiForm.accreditationStatus}
                onChange={(e) => setProdiForm({ ...prodiForm, accreditationStatus: e.target.value })}
              />
            </Field>
            <Field label={t.fReason} htmlFor="pr-reason" required error={fieldErrors['reason']}>
              <Textarea
                id="pr-reason"
                value={prodiForm.reason}
                onChange={(e) => setProdiForm({ ...prodiForm, reason: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Drawer>
    </div>
  );
}
