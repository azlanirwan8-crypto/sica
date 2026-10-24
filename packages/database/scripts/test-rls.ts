import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

interface PostgresError extends Error {
  readonly code: string;
}

function isPostgresError(error: unknown): error is PostgresError {
  return error instanceof Error && 'code' in error && typeof error.code === 'string';
}

async function main(): Promise<void> {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'TEST_DATABASE_URL wajib diisi dengan koneksi langsung ke database PostgreSQL uji.'
    );
  }

  const sql = postgres(connectionString, {
    max: 1,
    connect_timeout: 10,
    prepare: false,
  });

  // Penjagaan sendiri: satu sesi yang tertinggal `idle in transaction` (mis. proses
  // ini dihentikan di tengah jalan) akan MEMBLOKIR insert berikutnya lewat jalur
  // ON CONFLICT, dan gejalanya bukan error melainkan diam. Dengan dua timeout ini
  // kejadian itu menjadi kegagalan yang terbaca dalam hitungan detik.
  await sql`SET lock_timeout = '8s'`;
  await sql`SET idle_in_transaction_session_timeout = '15s'`;

  const suffix = randomUUID();
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  const membershipA = randomUUID();
  const membershipB = randomUUID();
  let fixturesCreated = false;

  try {
    const appliedMigration = await sql<{ name: string }[]>`
      SELECT name
      FROM public._sica_migrations
      WHERE name = '0001_init_rls_policies.sql'
    `;
    if (appliedMigration.length !== 1) {
      throw new Error('Migrasi 0001_init_rls_policies.sql belum tercatat pada database uji.');
    }

    const [table] = await sql<{ enabled: boolean; forced: boolean }[]>`
      SELECT c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'tenant_memberships'
    `;
    if (!table?.enabled || !table.forced) {
      throw new Error('tenant_memberships harus mengaktifkan ENABLE dan FORCE ROW LEVEL SECURITY.');
    }

    const policy = await sql<{ policyname: string }[]>`
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'tenant_memberships'
        AND policyname = 'tenant_isolation'
    `;
    if (policy.length !== 1) {
      throw new Error('Policy tenant_isolation tidak ditemukan pada tenant_memberships.');
    }

    const [appRole] = await sql<{ bypass: boolean; superuser: boolean }[]>`
      SELECT rolbypassrls AS bypass, rolsuper AS superuser
      FROM pg_roles
      WHERE rolname = 'sica_app'
    `;
    if (!appRole || appRole.bypass || appRole.superuser) {
      throw new Error('Role sica_app harus tersedia, NOBYPASSRLS, dan bukan superuser.');
    }

    await sql`
      INSERT INTO public.tenants (id, slug, legal_name)
      VALUES
        (${tenantA}, ${`rls-a-${suffix}`}, 'SICA RLS Test Tenant A'),
        (${tenantB}, ${`rls-b-${suffix}`}, 'SICA RLS Test Tenant B')
    `;
    fixturesCreated = true;
    await sql`
      INSERT INTO public.users (id, email, full_name)
      VALUES
        (${userA}, ${`rls-a-${suffix}@test.invalid`}, 'SICA RLS Test User A'),
        (${userB}, ${`rls-b-${suffix}@test.invalid`}, 'SICA RLS Test User B')
    `;

    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE sica_app`;
      await tx`SELECT set_config('app.current_tenant', ${tenantA}, true)`;
      await tx`
        INSERT INTO public.tenant_memberships (id, tenant_id, user_id)
        VALUES (${membershipA}, ${tenantA}, ${userA})
      `;
    });

    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE sica_app`;
      await tx`SELECT set_config('app.current_tenant', ${tenantB}, true)`;
      await tx`
        INSERT INTO public.tenant_memberships (id, tenant_id, user_id)
        VALUES (${membershipB}, ${tenantB}, ${userB})
      `;
    });

    const visibleToTenantA = await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE sica_app`;
      await tx`SELECT set_config('app.current_tenant', ${tenantA}, true)`;
      return tx<{ id: string; tenant_id: string }[]>`
        SELECT id, tenant_id
        FROM public.tenant_memberships
        WHERE id IN (${membershipA}, ${membershipB})
      `;
    });
    if (visibleToTenantA.length !== 1 || visibleToTenantA[0]?.id !== membershipA) {
      throw new Error('RLS gagal: Tenant A tidak dibatasi ke baris miliknya sendiri.');
    }

    const visibleWithoutTenant = await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE sica_app`;
      await tx`SELECT set_config('app.current_tenant', '', true)`;
      return tx<{ id: string }[]>`
        SELECT id
        FROM public.tenant_memberships
        WHERE id IN (${membershipA}, ${membershipB})
      `;
    });
    if (visibleWithoutTenant.length !== 0) {
      throw new Error('RLS gagal: query tanpa tenant context mengembalikan baris.');
    }

    let crossTenantInsertDenied = false;
    try {
      await sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE sica_app`;
        await tx`SELECT set_config('app.current_tenant', ${tenantA}, true)`;
        await tx`
          INSERT INTO public.tenant_memberships (id, tenant_id, user_id)
          VALUES (${randomUUID()}, ${tenantB}, ${userB})
        `;
      });
    } catch (error) {
      crossTenantInsertDenied = isPostgresError(error) && error.code === '42501';
      if (!crossTenantInsertDenied) throw error;
    }
    if (!crossTenantInsertDenied) {
      throw new Error('RLS gagal: insert Tenant B diterima saat tenant context Tenant A aktif.');
    }

    // ── Gugus 0012 (audit/outbox/idempotency/login_events) — bukti nyata di DB ──
    const auditObjects = await sql<{ name: string }[]>`
      SELECT relname AS name
      FROM pg_class
      WHERE relname IN ('audit_logs','audit_chain_head','outbox','idempotency_keys','login_events')
        AND relkind IN ('r','p')
    `;
    if (auditObjects.length !== 5) {
      throw new Error(
        `Gugus 0012 tidak lengkap (dapat ${auditObjects.length}/5): ` +
          auditObjects.map((o) => o.name).join(', ')
      );
    }

    const [partitionCount] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pg_tables WHERE tablename LIKE 'audit_logs_%'
    `;
    if (!partitionCount || partitionCount.n < 6) {
      throw new Error('Partisi bulanan audit_logs kurang dari enam (jalannya migrasi 0012).');
    }

    // AC-AUD-1: UPDATE audit_logs ditolak DI DATABASE, bukan di mock (trigger + REVOKE).
    const auditId = randomUUID();
    let auditUpdateDenied = false;
    try {
      await sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE sica_app`;
        await tx`SELECT set_config('app.current_tenant', ${tenantA}, true)`;
        await tx`UPDATE public.audit_logs SET action = 'tamper' WHERE id = ${auditId}`;
      });
    } catch (error) {
      auditUpdateDenied = isPostgresError(error) && error.code === '42501';
      if (!auditUpdateDenied) throw error;
    }
    if (!auditUpdateDenied) {
      throw new Error('AC-AUD-1 gagal: UPDATE audit_logs diterima oleh sica_app.');
    }

    // INSERT audit milik tenant sendiri boleh (GRANT INSERT, SELECT di 0012).
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE sica_app`;
      await tx`SELECT set_config('app.current_tenant', ${tenantA}, true)`;
      await tx`
        INSERT INTO public.audit_logs (id, tenant_id, target_entity, action, hash)
        VALUES (${auditId}, ${tenantA}, 'tenant.test', 'rls.test', ${Buffer.from('00'.repeat(32), 'hex')})
      `;
    });

    // Tenant lain tidak boleh membaca baris audit tenant A.
    const auditVisibleToOther = await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE sica_app`;
      await tx`SELECT set_config('app.current_tenant', ${tenantB}, true)`;
      return tx<{ id: string }[]>`SELECT id FROM public.audit_logs WHERE id = ${auditId}`;
    });
    if (auditVisibleToOther.length !== 0) {
      throw new Error('RLS gagal: baris audit Tenant A terbaca oleh Tenant B.');
    }

    // login_events: baris tanpa tenant (email tak terkenali) boleh ditulis, tidak terbaca tenant.
    const loginEventId = randomUUID();
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE sica_app`;
      await tx`SELECT set_config('app.current_tenant', '', true)`;
      await tx`
        INSERT INTO public.login_events (id, outcome, email_attempted)
        VALUES (${loginEventId}, 'UNKNOWN_USER', ${`unknown-${suffix}@test.invalid`})
      `;
    });
    const loginEventVisible = await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE sica_app`;
      await tx`SELECT set_config('app.current_tenant', ${tenantA}, true)`;
      return tx<{ id: string }[]>`SELECT id FROM public.login_events WHERE id = ${loginEventId}`;
    });
    if (loginEventVisible.length !== 0) {
      throw new Error('login_events gagal: baris ber-tenant NULL terbaca oleh konteks tenant.');
    }

    // ── Gugus R-2 (0007/0010/0047/0048/0049/0050) — isolasi + CHECK pembawa norma ──
    const r2Objects = await sql<{ name: string }[]>`
      SELECT relname AS name FROM pg_class
      WHERE relname IN (
        'reference_kinds','reference_items','reference_kind_usage','tenant_settings',
        'tenant_custom_attributes','custom_attribute_history','master_system_parameters',
        'master_system_parameter_history','menu_items','menu_permissions','parameter_permissions')
        AND relkind = 'r'
    `;
    if (r2Objects.length !== 11) {
      throw new Error(
        `Gugus R-2 tidak lengkap (dapat ${r2Objects.length}/11): ` + r2Objects.map((o) => o.name).join(', ')
      );
    }

    // `reference_items.kind` adalah FK ke tabel GLOBAL → satu jenis uji dipakai bersama.
    const testKind = `rls_kind_${suffix.slice(0, 8)}`;
    await sql`
      INSERT INTO public.reference_kinds (kind, label, domain, is_system)
      VALUES (${testKind}, 'Jenis Uji RLS', 'BIODATA', false)
      ON CONFLICT (kind) DO NOTHING
    `;

    const permissionRow = await sql<{ code: string }[]>`
      SELECT code FROM public.permissions WHERE code = 'master.item.create' LIMIT 1
    `;
    if (permissionRow.length !== 1) {
      throw new Error('Katalog `permissions` kosong — 0011/0085 belum diterapkan di database uji.');
    }
    const permissionCode = permissionRow[0].code as string;

    const menuId = randomUUID();

    /** Hitung baris yang TERLIHAT oleh `sica_app` dalam konteks satu tenant (0 = terisolasi). */
    const txCount = async (table: string, tenant: string): Promise<number> =>
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE sica_app`;
        await tx`SELECT set_config('app.current_tenant', ${tenant}, true)`;
        const rows = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM public.${tx(table)}`;
        return Number(rows[0]?.n ?? 0);
      });

    const r2Inserts: ReadonlyArray<{ table: string; write: (tx: typeof sql, tenant: string) => Promise<unknown> }> = [
      {
        table: 'reference_items',
        write: (tx, tenant) => tx`
          INSERT INTO public.reference_items (id, tenant_id, kind, code, name)
          VALUES (${randomUUID()}, ${tenant}, ${testKind}, ${`r-${tenant.slice(0, 4)}`}, 'Nilai Uji')`,
      },
      {
        table: 'tenant_settings',
        write: (tx, tenant) => tx`
          INSERT INTO public.tenant_settings (tenant_id) VALUES (${tenant})
          ON CONFLICT (tenant_id) DO NOTHING`,
      },
      {
        table: 'tenant_custom_attributes',
        write: (tx, tenant) => tx`
          INSERT INTO public.tenant_custom_attributes
            (id, tenant_id, entity_type, code, label, input_kind, data_type, requested_by)
          VALUES (${randomUUID()}, ${tenant}, 'student', ${`attr-${tenant.slice(0, 4)}`}, 'Atribut Uji', 'TEXT', 'STRING', ${userA})`,
      },
      {
        table: 'custom_attribute_history',
        write: (tx, tenant) => tx`
          INSERT INTO public.custom_attribute_history
            (id, tenant_id, entity_type, entity_id, attribute_code, new_value, changed_by, source)
          VALUES (${randomUUID()}, ${tenant}, 'student', ${userA}, 'attr', '{"v":1}'::jsonb, ${userA}, 'UI')`,
      },
      {
        table: 'master_system_parameters',
        write: (tx, tenant) => tx`
          INSERT INTO public.master_system_parameters
            (id, tenant_id, module_code, parameter_key, parameter_value, data_type, description, default_value, risk_class)
          VALUES (${randomUUID()}, ${tenant}, 'attendance', ${`p.${tenant.slice(0, 4)}`}, '30', 'SECONDS',
                  'Rotasi TOTP (uji)', '30', 'TECHNICAL')`,
      },
      {
        table: 'master_system_parameter_history',
        write: (tx, tenant) => tx`
          INSERT INTO public.master_system_parameter_history
            (id, tenant_id, parameter_key, module_code, new_value, new_version, changed_by, reason, ip, source)
          VALUES (${randomUUID()}, ${tenant}, 'p.test', 'attendance', '30', 1, ${userA}, 'uji RLS', '127.0.0.1', 'UI')`,
      },
      {
        table: 'menu_items',
        write: (tx, tenant) => tx`
          INSERT INTO public.menu_items (id, tenant_id, code, label)
          VALUES (${menuId}, ${tenant}, ${`m-${tenant.slice(0, 4)}`}, 'Menu Uji')`,
      },
      {
        table: 'parameter_permissions',
        write: (tx, tenant) => tx`
          INSERT INTO public.parameter_permissions
            (id, tenant_id, parameter_pattern, permission_code, note, requested_by)
          VALUES (${randomUUID()}, ${tenant}, ${`attendance.totp_${tenant.slice(0, 4)}`}, ${permissionCode}, 'pola uji', ${userA})`,
      },
    ];

    for (const spec of r2Inserts) {
      const [forced] = await sql<{ enabled: boolean; forced: boolean }[]>`
        SELECT c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = ${spec.table}
      `;
      if (!forced?.enabled || !forced.forced) {
        throw new Error(`${spec.table} wajib ENABLE + FORCE ROW LEVEL SECURITY.`);
      }

      await sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE sica_app`;
        await tx`SELECT set_config('app.current_tenant', ${tenantA}, true)`;
        await spec.write(tx, tenantA);
      });

      const leaked = await txCount(spec.table, tenantB);
      if (leaked !== 0) {
        throw new Error(`RLS gugus R-2 gagal: ${spec.table} milik Tenant A terbaca oleh Tenant B (${leaked} baris).`);
      }
    }

    // `menu_permissions` butuh baris `menu_items` tenant A → ditulis setelah loop di atas.
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE sica_app`;
      await tx`SELECT set_config('app.current_tenant', ${tenantA}, true)`;
      await tx`
        INSERT INTO public.menu_permissions (id, tenant_id, menu_id, permission_code)
        VALUES (${randomUUID()}, ${tenantA}, ${menuId}, ${permissionCode})
        ON CONFLICT (menu_id, permission_code, scope_kind) DO NOTHING`;
    });
    if ((await txCount('menu_permissions', tenantB)) !== 0) {
      throw new Error('RLS gugus R-2 gagal: menu_permissions Tenant A terbaca oleh Tenant B.');
    }

    // Katalog GLOBAL: ber-RLS oleh default platform, karena itu wajib punya policy
    // BACA dan TANPA policy tulis — dibuktikan dengan query nyata, bukan asumsi.
    const globalPolicyShape = await sql<{ relname: string; writes: number }[]>`
      SELECT c.relname,
             count(*) FILTER (WHERE pol.polcmd <> 'r')::int AS writes
      FROM pg_class c
      JOIN pg_policy pol ON pol.polrelid = c.oid
      WHERE c.relname IN ('permissions','modules','reference_kinds','reference_kind_usage')
      GROUP BY c.relname
    `;
    if (globalPolicyShape.length !== 4) {
      throw new Error(
        `Katalog global tanpa policy baca eksplisit (${globalPolicyShape.length}/4): ` +
          'sica_app yang NOBYPASSRLS tidak akan bisa membacanya.'
      );
    }
    if (globalPolicyShape.some((g) => g.writes !== 0)) {
      throw new Error('Katalog global tidak boleh punya policy tulis (INSERT/UPDATE/DELETE).');
    }

    // sica_app boleh membaca jenis kamus, tidak boleh menambahnya dari jalur tenant.
    const globalRead = await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE sica_app`;
      await tx`SELECT set_config('app.current_tenant', ${tenantA}, true)`;
      return tx<{ n: number }[]>`SELECT count(*)::int AS n FROM public.reference_kinds`;
    });
    if (Number(globalRead[0]?.n ?? 0) < 1) {
      throw new Error('Katalog global tidak terbaca oleh sica_app — policy global_read tidak berlaku.');
    }
    let globalWriteDenied = false;
    try {
      await sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE sica_app`;
        await tx`SELECT set_config('app.current_tenant', ${tenantA}, true)`;
        await tx`
          INSERT INTO public.reference_kinds (kind, label, domain, is_system)
          VALUES ('kinds_tenant_write', 'Harusnya Ditolak', 'BIODATA', false)`;
      });
    } catch (error) {
      globalWriteDenied = isPostgresError(error) && error.code === '42501';
      if (!globalWriteDenied) throw error;
    }
    if (!globalWriteDenied) {
      throw new Error('Tulis katalog global dari jalur tenant diterima — seharusnya 42501.');
    }

    // CHECK pembawa norma — tiap bentuk menyimpang harus DITOLAK database.
    //
    // `CONNECTION_CLOSED` ditangani khusus karena pooler Supavisor menutup backend
    // setelah percobaan `SET LOCAL ROLE` yang berakhir penolakan hak (42501). Itu
    // perilaku jalur koneksi, bukan isi assertion: koneksi baru dibuat transparan
    // oleh driver, jadi satu percobaan ulang membuktikan hal yang sama.
    const rejected = async (
      label: string,
      expectedCode: string,
      statement: (tx: typeof sql) => Promise<unknown>
    ): Promise<void> => {
      for (let percobaan = 0; percobaan < 2; percobaan += 1) {
        try {
          await sql.begin(async (tx) => {
            await tx`SET LOCAL ROLE sica_app`;
            await tx`SELECT set_config('app.current_tenant', ${tenantA}, true)`;
            await statement(tx);
          });
        } catch (error) {
          if (isPostgresError(error) && error.code === expectedCode) return;
          if (isPostgresError(error) && error.code === 'CONNECTION_CLOSED' && percobaan === 0) continue;
          throw new Error(
            `${label}: salah ${isPostgresError(error) ? error.code : 'non-db'}, harapan ${expectedCode} ` +
              `(detail: ${String((error as Error).message).slice(0, 160)})`
          );
        }
      }
      throw new Error(`${label}: database MENERIMA nilai yang dilarang norma.`);
    };

    await rejected('atribut berpilihan wajib menunjuk kamus', '23514', (tx) => tx`
      INSERT INTO public.tenant_custom_attributes
        (id, tenant_id, entity_type, code, label, input_kind, data_type, requested_by)
      VALUES (${randomUUID()}, ${tenantA}, 'room', 'tanpa_kamus', 'X', 'SELECT', 'ENUM', ${userA})`);

    await rejected('PII spesifik tidak dapat diisi sendiri oleh mahasiswa', '23514', (tx) => tx`
      INSERT INTO public.tenant_custom_attributes
        (id, tenant_id, entity_type, code, label, input_kind, data_type, pii_level, student_self_editable, requested_by)
      VALUES (${randomUUID()}, ${tenantA}, 'student', 'pii_bebas', 'X', 'TEXT', 'STRING', 'SPECIFIC', true, ${userA})`);

    await rejected('aktivasi atribut menuntut empat-mata', '23514', (tx) => tx`
      INSERT INTO public.tenant_custom_attributes
        (id, tenant_id, entity_type, code, label, input_kind, data_type, status, requested_by, approved_by)
      VALUES (${randomUUID()}, ${tenantA}, 'student', 'aktif_sepihak', 'X', 'TEXT', 'STRING', 'ACTIVE', ${userA}, ${userA})`);

    await rejected('parameter tidak pernah memegang rahasia', '23514', (tx) => tx`
      INSERT INTO public.master_system_parameters
        (id, tenant_id, module_code, parameter_key, parameter_value, data_type, description, default_value, risk_class, is_secret)
      VALUES (${randomUUID()}, ${tenantA}, 'platform', 'p.rahasia', 'x', 'STRING', 'd', 'x', 'TECHNICAL', true)`);

    await rejected('parameter tidak boleh menjadi pointer ENV', '23514', (tx) => tx`
      INSERT INTO public.master_system_parameters
        (id, tenant_id, module_code, parameter_key, parameter_value, data_type, description, default_value, risk_class, source_of_truth)
      VALUES (${randomUUID()}, ${tenantA}, 'platform', 'p.pointer_env', 'x', 'STRING', 'd', 'x', 'TECHNICAL', 'ENV')`);

    await rejected('kelas SECURITY menuntut penyetuju kedua', '23514', (tx) => tx`
      INSERT INTO public.master_system_parameters
        (id, tenant_id, module_code, parameter_key, parameter_value, data_type, description, default_value, risk_class, requested_by)
      VALUES (${randomUUID()}, ${tenantA}, 'attendance', 'p.tanpa_penyetuju', '30', 'SECONDS', 'd', '30', 'SECURITY', ${userA})`);

    await rejected('pola izin parameter wajib lowercase bertitik', '23514', (tx) => tx`
      INSERT INTO public.parameter_permissions
        (id, tenant_id, parameter_pattern, permission_code, note, requested_by)
      VALUES (${randomUUID()}, ${tenantA}, 'Attendance.TOTP', ${permissionCode}, 'pola salah', ${userA})`);

    await rejected('menu_permissions tidak boleh menciptakan kosakata izin', '23503', (tx) => tx`
      INSERT INTO public.menu_permissions (id, tenant_id, menu_id, permission_code)
      VALUES (${randomUUID()}, ${tenantA}, ${menuId}, 'izin.karang.sendiri')`);

    await rejected('merge kamus tidak boleh menunjuk dirinya', '23514', (tx) => {
      const selfId = randomUUID();
      return tx`
        INSERT INTO public.reference_items (id, tenant_id, kind, code, name, merged_into_id)
        VALUES (${selfId}, ${tenantA}, ${testKind}, 'self_merge', 'X', ${selfId})`;
    });

    // ── Penjaga empat-mata `0082` — DB harus menolak walaupun layanan punya bug ──
    const acrRoleId = randomUUID();
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE sica_app`;
      await tx`SELECT set_config('app.current_tenant', ${tenantA}, true)`;
      await tx`
        INSERT INTO public.roles (id, tenant_id, code, display_name, scope_kind, is_system)
        VALUES (${acrRoleId}, ${tenantA}, 'UJI_EMPAT_MATA', 'Peran uji 0082', 'TENANT', false)`;
    });

    await rejected('penyetuju tidak boleh menjadi pemohon', '23514', (tx) => tx`
      INSERT INTO public.access_change_requests
        (id, tenant_id, requester_id, target_user_id, role_id, request_kind, scope, reason, status, approver_id)
      VALUES (${randomUUID()}, ${tenantA}, ${userA}, ${userB}, ${acrRoleId}, 'GRANT', '{}'::jsonb,
              'alasan uji yang panjangnya cukup', 'APPROVED', ${userA})`);

    await rejected('penyetuju tidak boleh menjadi target grant', '23514', (tx) => tx`
      INSERT INTO public.access_change_requests
        (id, tenant_id, requester_id, target_user_id, role_id, request_kind, scope, reason, status, approver_id)
      VALUES (${randomUUID()}, ${tenantA}, ${userA}, ${userB}, ${acrRoleId}, 'GRANT', '{}'::jsonb,
              'alasan uji yang panjangnya cukup', 'APPROVED', ${userB})`);

    await rejected('penolakan wajib beralasan >= 10 karakter', '23514', (tx) => tx`
      INSERT INTO public.access_change_requests
        (id, tenant_id, requester_id, target_user_id, role_id, request_kind, scope, reason, status, approver_id, decision_reason)
      VALUES (${randomUUID()}, ${tenantA}, ${userA}, ${userB}, ${acrRoleId}, 'GRANT', '{}'::jsonb,
              'alasan pengajuan yang cukup panjang', 'REJECTED', ${userB}, 'tidak')`);

    await rejected('ROLE_PERMISSION_CHANGE tidak boleh menunjuk target', '23514', (tx) => tx`
      INSERT INTO public.access_change_requests
        (id, tenant_id, requester_id, target_user_id, role_id, request_kind, scope, reason, status)
      VALUES (${randomUUID()}, ${tenantA}, ${userA}, ${userB}, ${acrRoleId}, 'ROLE_PERMISSION_CHANGE',
              '{"grant":[],"revoke":[]}'::jsonb, 'alasan pengajuan yang cukup panjang', 'PENDING')`);

    await rejected('GRANT wajib menunjuk target', '23514', (tx) => tx`
      INSERT INTO public.access_change_requests
        (id, tenant_id, requester_id, target_user_id, role_id, request_kind, scope, reason, status)
      VALUES (${randomUUID()}, ${tenantA}, ${userA}, NULL, ${acrRoleId}, 'GRANT', '{}'::jsonb,
              'alasan pengajuan yang cukup panjang', 'PENDING')`);

    await sql`DELETE FROM public.roles WHERE id = ${acrRoleId}`;

    // ── Tata kelola parameter `0088` + `0090` — dinding database, bukan hanya transport ──
    // Gugus ini menjawab temuan siklus ini: plafon keamanan, keadaan terminal approval,
    // dan "riwayat hanya-tambah" sebelumnya hanya berupa komentar di migrasi. Di sini mereka
    // dibuktikan ditolak POSTGRES, termasuk oleh pemilik tabel.
    const paramProbeId = randomUUID();
    const approvalProbeId = randomUUID();
    const pointerProbeId = randomUUID();

    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE sica_app`;
      await tx`SELECT set_config('app.current_tenant', ${tenantA}, true)`;
      await tx`
        INSERT INTO public.master_system_parameters
          (id, tenant_id, module_code, parameter_key, parameter_value, data_type, description, default_value, risk_class)
        VALUES (${paramProbeId}, ${tenantA}, 'attendance', 'attendance.uji_rls', '5', 'SECONDS',
                'probe tata kelola 0088', '5', 'TECHNICAL')`;
    });

    interface ApprovalProbe {
      readonly id: string;
      readonly state: 'PENDING' | 'APPROVED' | 'REJECTED';
      readonly parameterKey: string;
      readonly proposed: string;
      readonly version: number;
      readonly reason: string;
      readonly approver: string | null;
      readonly decidedAt: boolean;
      readonly decisionReason: string | null;
      readonly tenant?: string;
    }

    const insertApproval = (tx: typeof sql, p: ApprovalProbe): Promise<unknown> => tx`
      INSERT INTO public.master_system_parameter_approvals
        (id, tenant_id, parameter_id, parameter_key, module_code, state, proposed_value, previous_value,
         previous_version, reason, requested_by, approver_id, decided_at, decision_reason, ip)
      VALUES (${p.id}, ${p.tenant ?? tenantA}, ${paramProbeId}, ${p.parameterKey}, 'attendance',
              ${p.state}, ${p.proposed}, '5', ${p.version}, ${p.reason}, ${userA}, ${p.approver},
              ${p.decidedAt ? new Date() : null}, ${p.decisionReason}, '127.0.0.1')`;

    const draft = (over: Partial<ApprovalProbe>): ApprovalProbe => ({
      id: approvalProbeId,
      state: 'PENDING',
      parameterKey: 'attendance.uji_rls',
      proposed: '10',
      version: 1,
      reason: 'alasan draf uji yang panjangnya cukup',
      approver: null,
      decidedAt: false,
      decisionReason: null,
      ...over,
    });

    await rejected('draf tidak dapat disetujui pemohonnya sendiri', '23514', (tx) =>
      insertApproval(tx, draft({ state: 'APPROVED', approver: userA, decidedAt: true }))
    );

    await rejected('keadaan terminal wajib punya decided_at', '23514', (tx) =>
      insertApproval(tx, draft({ state: 'APPROVED', approver: userB, decidedAt: false }))
    );

    await rejected('penolakan draf wajib beralasan >= 10 karakter', '23514', (tx) =>
      insertApproval(tx, draft({ state: 'REJECTED', approver: userB, decidedAt: true, decisionReason: 'tidak' }))
    );

    await rejected('pengajuan draf wajib beralasan 10..500', '23514', (tx) =>
      insertApproval(tx, draft({ reason: 'pendek' }))
    );

    await rejected('plafon keamanan berlaku atas DRAF (rotasi 7 detik)', '23514', (tx) =>
      insertApproval(tx, draft({ parameterKey: 'attendance.totp_rotate_seconds', proposed: '7' }))
    );

    await rejected('versi dasar draf wajib > 0', '23514', (tx) => insertApproval(tx, draft({ version: 0 })));

    await rejected('module_code parameter adalah kosakata tertutup', '23514', (tx) => tx`
      INSERT INTO public.master_system_parameters
        (id, tenant_id, module_code, parameter_key, parameter_value, data_type, description, default_value, risk_class)
      VALUES (${randomUUID()}, ${tenantA}, 'inventaris', 'inventaris.uji', '5', 'SECONDS', 'd', '5', 'TECHNICAL')`);

    await rejected('rotasi TOTP 20 detik ditolak DB meski berada dalam rentang 5..30', '23514', (tx) => tx`
      INSERT INTO public.master_system_parameters
        (id, tenant_id, module_code, parameter_key, parameter_value, data_type, description, default_value,
         risk_class, requested_by, approved_by)
      VALUES (${randomUUID()}, ${tenantA}, 'attendance', 'attendance.totp_rotate_seconds', '20', 'SECONDS', 'd', '5',
              'SECURITY', ${userA}, ${userB})`);

    await rejected('rumah konfigurasi asing ditolak ck_param_source_home', '23514', (tx) => tx`
      INSERT INTO public.master_system_parameters
        (id, tenant_id, module_code, parameter_key, parameter_value, data_type, description, default_value, risk_class, source_of_truth)
      VALUES (${randomUUID()}, ${tenantA}, 'finance', 'finance.uji_rumah', '', 'STRING', 'd', '', 'FINANCIAL', 'kamar_lain')`);

    // Riwayat hanya-tambah dibuktikan pada dua dinding. `WHERE false` sengaja: pemicunya
    // FOR EACH STATEMENT, jadi ia tetap memicu tanpa menyentuh satu baris pun — probe yang
    // memakai `WHERE true` akan MENGHAPUS riwayat bila pemicunya regresi.
    const rejectedAsOwner = async (label: string, statement: (tx: typeof sql) => Promise<unknown>): Promise<void> => {
      try {
        await sql.begin(async (tx) => {
          await statement(tx);
        });
      } catch (error) {
        if (isPostgresError(error) && error.code === '42501') return;
        throw new Error(
          `${label}: salah ${isPostgresError(error) ? error.code : 'non-db'}, harapan 42501 ` +
            `(detail: ${String((error as Error).message).slice(0, 160)})`
        );
      }
      throw new Error(`${label}: pemilik tabel menerima mutasi pada objek append-only.`);
    };

    await rejectedAsOwner('riwayat parameter tidak dapat di-UPDATE pemilik tabel', (tx) => tx`
      UPDATE public.master_system_parameter_history SET reason = 'disunting' WHERE false`);
    await rejectedAsOwner('riwayat parameter tidak dapat di-DELETE pemilik tabel', (tx) => tx`
      DELETE FROM public.master_system_parameter_history WHERE false`);
    await rejectedAsOwner('riwayat atribut kustom tidak dapat di-DELETE pemilik tabel', (tx) => tx`
      DELETE FROM public.custom_attribute_history WHERE false`);
    await rejected('riwayat parameter tidak dapat di-UPDATE sica_app', '42501', (tx) => tx`
      UPDATE public.master_system_parameter_history SET reason = 'disunting' WHERE false`);

    // Draf PENDING lahir → wajib hanya ada satu per kunci, dan wajib tidak terbaca tenant lain.
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE sica_app`;
      await tx`SELECT set_config('app.current_tenant', ${tenantA}, true)`;
      await insertApproval(tx, draft({}));
    });

    await rejected('satu kunci tidak boleh menunggu dua persetujuan', '23505', (tx) =>
      insertApproval(tx, draft({ id: randomUUID(), proposed: '15', reason: 'draf kedua untuk kunci yang sama' }))
    );

    // Tulis lintas tenant pada objek approval: WITH CHECK menolak (bukan sekadar tidak terbaca).
    await rejected('draf parameter milik tenant lain ditolak WITH CHECK', '42501', (tx) =>
      insertApproval(tx, draft({ id: randomUUID(), tenant: tenantB }))
    );

    if ((await txCount('master_system_parameter_approvals', tenantB)) !== 0) {
      throw new Error('RLS gagal: draf persetujuan parameter Tenant A terbaca oleh Tenant B.');
    }

    // Positif: `domain_table` adalah rumah penemuan yang SAH sejak 0090 (tiga butir §21.3
    // tinggal di tabel domain). Tanpa baris ini, CHECK baru cuma teori.
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE sica_app`;
      await tx`SELECT set_config('app.current_tenant', ${tenantA}, true)`;
      await tx`
        INSERT INTO public.master_system_parameters
          (id, tenant_id, module_code, parameter_key, parameter_value, data_type, description, default_value,
           risk_class, source_of_truth, is_editable)
        VALUES (${pointerProbeId}, ${tenantA}, 'finance', 'finance.uji_pointer', '', 'STRING',
                'indeks penemuan 0090', '', 'FINANCIAL', 'domain_table', false)`;
    });
    const pointerRows = await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE sica_app`;
      await tx`SELECT set_config('app.current_tenant', ${tenantA}, true)`;
      return tx<{ n: number }[]>`
        SELECT count(*)::int AS n FROM public.master_system_parameters
        WHERE id = ${pointerProbeId} AND source_of_truth = 'domain_table' AND is_editable = false`;
    });
    if (Number(pointerRows[0]?.n ?? 0) !== 1) {
      throw new Error('Baris penemuan berrumah domain_table tidak terbentuk — 0090 tidak berlaku.');
    }

    await sql`DELETE FROM public.master_system_parameters WHERE id IN (${paramProbeId}, ${pointerProbeId})`;

    console.info(
      'LULUS: migrasi 0001+0012+gugus R-2 (0007/0010/0047/0048/0049/0050) + 0082 + 0088/0090 — ENABLE/FORCE RLS, isolasi baca, ' +
        'default-deny, penolakan insert lintas-tenant, AC-AUD-1 (UPDATE audit_logs → 42501), login_events NULL-tenant, ' +
        '11 objek R-2 terisolasi, empat katalog global terbaca-tetapi-tak-tertulis oleh sica_app, ' +
        'empat belas CHECK pembawa norma ditolak database — termasuk lima penjaga empat-mata akses, ' +
        'enam penahan draf parameter (empat-mata, keadaan terminal, alasan, plafon keamanan atas draf, versi dasar, ' +
        'satu draf per kunci), tiga dinding append-only riwayat yang berlaku bahkan atas pemilik tabel, ' +
        'kosakata module_code/rumah konfigurasi tertutup, dan baris penemuan domain_table yang diterima.'
    );
  } finally {
    try {
      if (fixturesCreated) {
        await sql`DELETE FROM public.tenant_memberships WHERE id IN (${membershipA}, ${membershipB})`;
        await sql`DELETE FROM public.users WHERE id IN (${userA}, ${userB})`;
        // Konsekuensi 0088 yang TERUKUR, bukan diasumsikan: `ON DELETE CASCADE` dari `tenants`
        // ikut menjalankan pemicu statement-level pada tabel riwayat, jadi menyapu fixture —
        // dan nanti, melepas tenant — mustahil selama dinding itu terpasang. Penegakannya
        // sudah dibuktikan di atas; di sini dinding dibuka sebentar di dalam satu transaksi
        // dan ditutup lagi (prosedur decommission yang sama dicatat DATA_MODEL §21.2.1).
        try {
          await sql.begin(async (tx) => {
            await tx`ALTER TABLE public.custom_attribute_history DISABLE TRIGGER trg_ca_hist_immutable`;
            await tx`ALTER TABLE public.master_system_parameter_history DISABLE TRIGGER trg_sysparam_hist_immutable`;
            await tx`DELETE FROM public.tenants WHERE id IN (${tenantA}, ${tenantB})`;
          });
        } finally {
          await sql`ALTER TABLE public.custom_attribute_history ENABLE TRIGGER trg_ca_hist_immutable`;
          await sql`ALTER TABLE public.master_system_parameter_history ENABLE TRIGGER trg_sysparam_hist_immutable`;
        }
      }
    } finally {
      await sql.end();
    }
  }
}

main().catch((error: unknown) => {
  console.error('GAGAL: verifikasi PostgreSQL RLS tidak selesai.', error);
  process.exitCode = 1;
});
