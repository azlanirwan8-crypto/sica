/**
 * Layanan master organisasi & program studi — Fase 1B item 4 (`R-2`, M-03/M-17).
 *
 * Mengapa layarnya ada di Fase 1: seluruh lingkup penugasan `ORG` dan `PROGRAM`
 * menunjuk baris di dua tabel ini. Tanpa master ini, "hak hanya di fakultas X" tidak
 * pernah bisa diucapkan — dan tanpa prodi, angka akademik nasional (beban SKS, masa
 * studi, ambang IPK) tidak punya rumah selain konstanta di kode, yang dilarang
 * AGENTS §3.10.
 *
 * Aturan yang ditegakkan di sini:
 *  - **Anti-IDOR:** `id` dari klien diselesaikan ke barisnya DI DALAM transaksi
 *    (`WHERE tenant_id = ctx.tenantId AND id = $1`) sebelum apa pun diubah; baris
 *    institusi lain menjawab 404, bukan 403, supaya keberadaan lintas-tenant tidak
 *    menjadi oracle.
 *  - **Siklus ditolak di aplikasi DAN di DB.** `0002` tidak memasang constraint
 *    penutup siklus, jadi perjalanan `parent_id` dinaiki sampai akar; kalau simpul
 *    yang sedang diubah muncul lagi, permintaan ditolak. Ini bukan hiasan: hierarki
 *    yang melingkar membuat resolusi lingkup `ORG` tidak pernah berhenti.
 *  - **Tidak ada DELETE.** Organisasi/prodi yang masih dirujuk tidak bisa dihapus
 *    tanpa memutus jejak historis; yang tersedia adalah ubah (nama/kode/indukan) dan
 *    nonaktif di slice berikutnya. Setiap tulis dicatat ke `audit_logs` dengan alasan.
 */
import { randomUUID } from 'node:crypto';
import { and, asc, eq, sql, organizations, studyPrograms, withTenantContext, type TenantTx } from '@sica/database';
import { appendAuditEntry } from '@/modules/audit/services/audit.service';
import type {
  AdminOrganizationRow,
  AdminStudyProgramRow,
  CreateOrganizationRequest,
  CreateStudyProgramRequest,
  OrganizationKind,
  StudyProgramLevel,
  UpdateOrganizationRequest,
  UpdateStudyProgramRequest,
} from '@sica/contracts';

export type OrganizationError =
  | { readonly kind: 'ORG_NOT_FOUND' }
  | { readonly kind: 'PARENT_NOT_FOUND' }
  | { readonly kind: 'PARENT_CYCLE' }
  | { readonly kind: 'ORG_CODE_TAKEN' }
  | { readonly kind: 'PROGRAM_NOT_FOUND' }
  | { readonly kind: 'PROGRAM_CODE_TAKEN' };

export type WriteResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: OrganizationError };

interface Actor {
  readonly tenantId: string;
  readonly userId: string;
}

/** `code` unik per tenant bila terisi; NULL boleh berulang (Postgres tidak menganggap NULL sama). */
async function codeTaken(tx: TenantTx, id: string | null, tenantId: string, code: string | null | undefined): Promise<boolean> {
  if (!code) return false;
  const rows = await tx
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(eq(organizations.tenantId, tenantId), eq(organizations.code, code)))
    .limit(1);
  return rows.length > 0 && rows[0]?.id !== id;
}

/** Naik ke akar lewat `parent_id`; `stopAt` membuat perjalanan berhenti bila simpul berulang. */
async function parentChain(tx: TenantTx, tenantId: string, startId: string): Promise<readonly string[]> {
  const seen: string[] = [];
  let cursor: string | null = startId;
  while (cursor) {
    if (seen.includes(cursor)) return seen;
    seen.push(cursor);
    const rows = await tx
      .select({ parentId: organizations.parentId })
      .from(organizations)
      .where(and(eq(organizations.tenantId, tenantId), eq(organizations.id, cursor)))
      .limit(1);
    cursor = rows[0]?.parentId ?? null;
  }
  return seen;
}

export async function listOrganizations(tenantId: string): Promise<readonly AdminOrganizationRow[]> {
  return withTenantContext(tenantId, async (tx) => {
    const rows = await tx
      .select({
        id: organizations.id,
        parentId: organizations.parentId,
        kind: organizations.kind,
        name: organizations.name,
        code: organizations.code,
        childCount: sql<number>`(select count(*)::int from public.organizations c where c.parent_id = public.organizations.id)`,
        programCount: sql<number>`(select count(*)::int from public.study_programs p where p.org_id = public.organizations.id)`,
      })
      .from(organizations)
      .where(eq(organizations.tenantId, tenantId))
      .orderBy(asc(organizations.kind), asc(organizations.name));
    // `kind` dan `level` bertipe `text` di Drizzle karena domainnya dijaga `CHECK` di
    // DDL (`0002`), bukan oleh enum PostgreSQL. Cast ini menyatakan fakta itu.
    return rows.map((r) => ({ ...r, kind: r.kind as OrganizationKind }));
  });
}

export async function createOrganization(actor: Actor, req: CreateOrganizationRequest): Promise<WriteResult<AdminOrganizationRow>> {
  const id = randomUUID();
  return withTenantContext(actor.tenantId, async (tx) => {
    if (req.parentId && !(await organizationExists(tx, actor.tenantId, req.parentId))) {
      return { ok: false, error: { kind: 'PARENT_NOT_FOUND' } } as const;
    }
    if (await codeTaken(tx, null, actor.tenantId, req.code)) {
      return { ok: false, error: { kind: 'ORG_CODE_TAKEN' } } as const;
    }
    await tx.insert(organizations).values({
      id,
      tenantId: actor.tenantId,
      parentId: req.parentId ?? null,
      kind: req.kind,
      name: req.name,
      code: req.code ?? null,
    });
    await appendAuditEntry(tx, {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      targetEntity: 'organizations',
      targetId: id,
      action: 'academic.organization.create',
      after: { kind: req.kind, name: req.name, code: req.code ?? null, parentId: req.parentId ?? null },
      reason: req.reason,
    });
    return {
      ok: true,
      value: {
        id,
        parentId: req.parentId ?? null,
        kind: req.kind as OrganizationKind,
        name: req.name,
        code: req.code ?? null,
        childCount: 0,
        programCount: 0,
      },
    } as const;
  });
}

export async function updateOrganization(
  actor: Actor,
  id: string,
  req: UpdateOrganizationRequest
): Promise<WriteResult<AdminOrganizationRow>> {
  return withTenantContext(actor.tenantId, async (tx) => {
    const current = await tx
      .select({ id: organizations.id, parentId: organizations.parentId, kind: organizations.kind, name: organizations.name, code: organizations.code })
      .from(organizations)
      .where(and(eq(organizations.tenantId, actor.tenantId), eq(organizations.id, id)))
      .limit(1);
    const row = current[0];
    if (!row) return { ok: false, error: { kind: 'ORG_NOT_FOUND' } } as const;

    if (req.code !== undefined && (await codeTaken(tx, id, actor.tenantId, req.code))) {
      return { ok: false, error: { kind: 'ORG_CODE_TAKEN' } } as const;
    }

    const nextParent = req.parentId === undefined ? row.parentId : req.parentId;
    if (nextParent) {
      if (!(await organizationExists(tx, actor.tenantId, nextParent))) {
        return { ok: false, error: { kind: 'PARENT_NOT_FOUND' } } as const;
      }
      // Siklus: indukan baru tidak boleh berada di bawah simpul ini sendiri.
      const chain = await parentChain(tx, actor.tenantId, nextParent);
      if (chain.includes(id)) return { ok: false, error: { kind: 'PARENT_CYCLE' } } as const;
    }

    const next = {
      parentId: nextParent ?? null,
      kind: req.kind ?? row.kind,
      name: req.name ?? row.name,
      code: req.code === undefined ? row.code : req.code,
    };
    await tx.update(organizations).set(next).where(and(eq(organizations.tenantId, actor.tenantId), eq(organizations.id, id)));
    await appendAuditEntry(tx, {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      targetEntity: 'organizations',
      targetId: id,
      action: 'academic.organization.update',
      before: { kind: row.kind, name: row.name, code: row.code, parentId: row.parentId },
      after: next,
      reason: req.reason,
    });
    return {
      ok: true,
      value: { id, ...next, kind: next.kind as OrganizationKind, childCount: 0, programCount: 0 },
    } as const;
  });
}

async function organizationExists(tx: TenantTx, tenantId: string, id: string): Promise<boolean> {
  const rows = await tx
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(eq(organizations.tenantId, tenantId), eq(organizations.id, id)))
    .limit(1);
  return rows.length > 0;
}

export async function listStudyPrograms(tenantId: string): Promise<readonly AdminStudyProgramRow[]> {
  return withTenantContext(tenantId, async (tx) => {
    const rows = await tx
      .select({
        id: studyPrograms.id,
        orgId: studyPrograms.orgId,
        orgName: organizations.name,
        name: studyPrograms.name,
        code: studyPrograms.code,
        pddiktiCode: studyPrograms.pddiktiCode,
        level: studyPrograms.level,
        minTotalSks: sql<string>`public.study_programs.min_total_sks::text`,
        nominalStudySemesters: studyPrograms.nominalStudySemesters,
        maxStudySemesters: studyPrograms.maxStudySemesters,
        graduationMinIpk: sql<string>`public.study_programs.graduation_min_ipk::text`,
        accreditationStatus: studyPrograms.accreditationStatus,
      })
      .from(studyPrograms)
      .leftJoin(organizations, and(eq(organizations.id, studyPrograms.orgId), eq(organizations.tenantId, tenantId)))
      .where(eq(studyPrograms.tenantId, tenantId))
      .orderBy(asc(studyPrograms.level), asc(studyPrograms.name));
    return rows.map((r) => ({ ...r, level: r.level as StudyProgramLevel }));
  });
}

export async function createStudyProgram(actor: Actor, req: CreateStudyProgramRequest): Promise<WriteResult<AdminStudyProgramRow>> {
  const id = randomUUID();
  return withTenantContext(actor.tenantId, async (tx) => {
    if (req.orgId && !(await organizationExists(tx, actor.tenantId, req.orgId))) {
      return { ok: false, error: { kind: 'PARENT_NOT_FOUND' } } as const;
    }
    if (await programCodeTaken(tx, id, actor.tenantId, req.code)) {
      return { ok: false, error: { kind: 'PROGRAM_CODE_TAKEN' } } as const;
    }
    await tx.insert(studyPrograms).values({
      id,
      tenantId: actor.tenantId,
      orgId: req.orgId ?? null,
      name: req.name,
      code: req.code ?? null,
      pddiktiCode: req.pddiktiCode ?? null,
      level: req.level,
      minTotalSks: String(req.minTotalSks),
      nominalStudySemesters: req.nominalStudySemesters,
      maxStudySemesters: req.maxStudySemesters,
      graduationMinIpk: req.graduationMinIpk.toFixed(2),
      accreditationStatus: req.accreditationStatus ?? null,
    });
    await appendAuditEntry(tx, {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      targetEntity: 'study_programs',
      targetId: id,
      action: 'academic.program.create',
      after: {
        level: req.level,
        name: req.name,
        code: req.code ?? null,
        pddiktiCode: req.pddiktiCode ?? null,
        minTotalSks: req.minTotalSks,
        nominalStudySemesters: req.nominalStudySemesters,
        maxStudySemesters: req.maxStudySemesters,
        graduationMinIpk: req.graduationMinIpk,
      },
      reason: req.reason,
    });
    return { ok: true, value: programRow(id, req, null) } as const;
  });
}

export async function updateStudyProgram(
  actor: Actor,
  id: string,
  req: UpdateStudyProgramRequest
): Promise<WriteResult<AdminStudyProgramRow>> {
  return withTenantContext(actor.tenantId, async (tx) => {
    const current = await tx
      .select({
        id: studyPrograms.id,
        orgId: studyPrograms.orgId,
        name: studyPrograms.name,
        code: studyPrograms.code,
        pddiktiCode: studyPrograms.pddiktiCode,
        level: studyPrograms.level,
        minTotalSks: sql<string>`public.study_programs.min_total_sks::text`,
        nominalStudySemesters: studyPrograms.nominalStudySemesters,
        maxStudySemesters: studyPrograms.maxStudySemesters,
        graduationMinIpk: sql<string>`public.study_programs.graduation_min_ipk::text`,
        accreditationStatus: studyPrograms.accreditationStatus,
      })
      .from(studyPrograms)
      .where(and(eq(studyPrograms.tenantId, actor.tenantId), eq(studyPrograms.id, id)))
      .limit(1);
    const row = current[0];
    if (!row) return { ok: false, error: { kind: 'PROGRAM_NOT_FOUND' } } as const;

    if (req.orgId && !(await organizationExists(tx, actor.tenantId, req.orgId))) {
      return { ok: false, error: { kind: 'PARENT_NOT_FOUND' } } as const;
    }
    if (req.code !== undefined && (await programCodeTaken(tx, id, actor.tenantId, req.code))) {
      return { ok: false, error: { kind: 'PROGRAM_CODE_TAKEN' } } as const;
    }

    const next = {
      orgId: req.orgId === undefined ? row.orgId : req.orgId,
      name: req.name ?? row.name,
      code: req.code === undefined ? row.code : req.code,
      pddiktiCode: req.pddiktiCode === undefined ? row.pddiktiCode : req.pddiktiCode,
      level: req.level ?? row.level,
      minTotalSks: req.minTotalSks === undefined ? row.minTotalSks : String(req.minTotalSks),
      nominalStudySemesters: req.nominalStudySemesters ?? row.nominalStudySemesters,
      maxStudySemesters: req.maxStudySemesters ?? row.maxStudySemesters,
      graduationMinIpk: req.graduationMinIpk === undefined ? row.graduationMinIpk : req.graduationMinIpk.toFixed(2),
      accreditationStatus: req.accreditationStatus === undefined ? row.accreditationStatus : req.accreditationStatus,
    };
    await tx
      .update(studyPrograms)
      .set({
        orgId: next.orgId ?? null,
        name: next.name,
        code: next.code ?? null,
        pddiktiCode: next.pddiktiCode ?? null,
        level: next.level,
        minTotalSks: next.minTotalSks,
        nominalStudySemesters: next.nominalStudySemesters,
        maxStudySemesters: next.maxStudySemesters,
        graduationMinIpk: next.graduationMinIpk,
        accreditationStatus: next.accreditationStatus ?? null,
      })
      .where(and(eq(studyPrograms.tenantId, actor.tenantId), eq(studyPrograms.id, id)));
    await appendAuditEntry(tx, {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      targetEntity: 'study_programs',
      targetId: id,
      action: 'academic.program.update',
      before: {
        level: row.level,
        name: row.name,
        minTotalSks: row.minTotalSks,
        nominalStudySemesters: row.nominalStudySemesters,
        maxStudySemesters: row.maxStudySemesters,
        graduationMinIpk: row.graduationMinIpk,
      },
      after: {
        level: next.level,
        name: next.name,
        minTotalSks: next.minTotalSks,
        nominalStudySemesters: next.nominalStudySemesters,
        maxStudySemesters: next.maxStudySemesters,
        graduationMinIpk: next.graduationMinIpk,
      },
      reason: req.reason,
    });
    return {
      ok: true,
      value: { id, ...next, level: next.level as StudyProgramLevel, orgName: null },
    } as const;
  });
}

async function programCodeTaken(tx: TenantTx, id: string, tenantId: string, code: string | null | undefined): Promise<boolean> {
  if (!code) return false;
  const rows = await tx
    .select({ id: studyPrograms.id })
    .from(studyPrograms)
    .where(and(eq(studyPrograms.tenantId, tenantId), eq(studyPrograms.code, code)))
    .limit(1);
  return rows.length > 0 && rows[0]?.id !== id;
}

function programRow(id: string, req: CreateStudyProgramRequest, orgName: string | null): AdminStudyProgramRow {
  return {
    id,
    orgId: req.orgId ?? null,
    orgName,
    name: req.name,
    code: req.code ?? null,
    pddiktiCode: req.pddiktiCode ?? null,
    level: req.level,
    minTotalSks: String(req.minTotalSks),
    nominalStudySemesters: req.nominalStudySemesters,
    maxStudySemesters: req.maxStudySemesters,
    graduationMinIpk: req.graduationMinIpk.toFixed(2),
    accreditationStatus: req.accreditationStatus ?? null,
  };
}
