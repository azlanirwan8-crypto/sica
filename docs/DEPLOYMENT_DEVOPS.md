# SICA DevOps, Deployment & CI/CD Pipeline
**Status:** Production Standard  
**Environments:** Development, Staging, Production  
**Cloud Infrastructure:** Supabase/Neon PostgreSQL, Redis Cloud, Vercel Enterprise (Web), Firebase App Distribution / Google Play (Mobile)  

---

## 1. Spesifikasi Environment Variables (`.env.example`)

Konfigurasi runtime dipisahkan secara tegas berdasarkan layer arsitektur guna mencegah kebocoran secret backend ke dalam bundel client-side.

### 1.1 Web Application & API (`apps/web/.env.example`)

```ini
# ==========================================
# SICA WEB & NEXT.JS SERVER RUNTIME CONFIG
# ==========================================
NODE_ENV=production
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_APP_NAME="SICA Academic Cloud"
NEXT_PUBLIC_BASE_URL="https://sica.ac.id"
NEXT_PUBLIC_API_URL="https://sica.ac.id/api/v1"

# Database Connection (Pooled via PgBouncer)
DATABASE_URL="postgresql://sica_app:STRONG_PASSWORD_HERE@pg-pooler.internal:6543/sica_prod?sslmode=require&pgbouncer=true"
# Direct connection for Drizzle Migrations (Bypasses PgBouncer session mode)
DIRECT_DATABASE_URL="postgresql://sica_migrator:STRONG_MIGRATOR_PASSWORD_HERE@pg-primary.internal:5432/sica_prod?sslmode=require"

# Distributed In-Memory Cache & Session Lock (Upstash / Redis 7)
REDIS_URL="rediss://default:STRONG_REDIS_SECRET@redis.internal:6379"

# Authentication & Cryptographic Keys (RS256 Public/Private Keypair)
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...\n-----END PUBLIC KEY-----"
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----"
JWT_ACCESS_TOKEN_TTL_SEC=900
JWT_REFRESH_TOKEN_TTL_SEC=604800

# Rate Limiting & Security
RATE_LIMIT_MAX_REQUESTS_PER_MIN=120
CORS_ALLOWED_ORIGINS="https://*.sica.ac.id,https://sica.ac.id"

# Observability & Monitoring
NEXT_PUBLIC_SENTRY_DSN="https://abcdef123456@o0.ingest.sentry.io/1234567"
SENTRY_AUTH_TOKEN="sntrys_secret_token_here"
LOG_LEVEL="info"
```

---

### 1.2 Mobile Client (`apps/mobile/.env.example`)

Variabel aplikasi Flutter diinjeksi saat build time melalui skrip `--dart-define` atau plugin `flutter_dotenv`. Jangan pernah menyimpan private key atau master password di dalam environment mobile!

```ini
# ==========================================
# SICA FLUTTER MOBILE CLIENT CONFIG
# ==========================================
APP_FLAVOR=production
APP_PACKAGE_NAME="id.ac.sica.mobile"
API_BASE_URL="https://api.sica.ac.id/api/v1"
WS_NOTIFICATION_URL="wss://api.sica.ac.id/realtime"

# Security & Mobile Integrity
ENABLE_ROOT_DETECTION=true
ENABLE_SSL_PINNING=true
API_CERTIFICATE_SHA256_FINGERPRINT="4a:5b:6c:7d:8e:9f:01:23:45:67:89:ab:cd:ef:01:23:45:67:89:ab:cd:ef:01:23:45:67:89:ab:cd:ef"

# Crashlytics & Analytics
SENTRY_DSN="https://mobile_key@o0.ingest.sentry.io/7654321"
```

---

### 1.3 Database & Migrator Engine (`packages/database/.env.example`)

```ini
# ==========================================
# POSTGRESQL & DRIZZLE MIGRATION CREDENTIALS
# ==========================================
POSTGRES_USER=sica_admin
POSTGRES_PASSWORD=EXTREMELY_SECURE_PASSWORD
POSTGRES_DB=sica_production
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432

# Multi-Tenant Master Encryption Key (AES-256-GCM for tenant database secrets)
TENANT_ENCRYPTION_MASTER_KEY="hex_64_characters_aes_master_key_here"
```

---

## 2. Strategi Zero-Downtime Database Migration

Sistem akademik beroperasi 24/7 dan tidak boleh mengalami kegagalan akses saat tabel diperbarui. SICA menerapkan metodologi **Expand and Contract (Dual-Writing)** untuk seluruh skema migrasi database menggunakan Drizzle ORM.

### 2.1 Siklus 3 Fase Expand-and-Contract

```
[Fase 1: Expand]
- Tambah kolom baru opsional (nullable) atau tabel baru.
- Aplikasi versi lama tetap berjalan normal tanpa error SQL.

[Fase 2: Deploy & Dual-Write]
- Deploy aplikasi versi baru (Next.js server).
- Aplikasi mulai membaca & menulis ke kolom/tabel baru.
- Jalankan script background untuk backfill data lama ke data baru.

[Fase 3: Contract]
- Setelah 100% data terisi dan aplikasi lama dimatikan:
- Hapus kolom lama yang sudah deprecated (DROP COLUMN).
- Pasang constraint NOT NULL pada kolom baru.
```

### 2.2 Aturan Baku DDL PostgreSQL SICA

1. **Dilarang keras memakai `LOCK TABLE` eksklusif.**
2. **Penambahan Index Wajib Non-Blocking:** Selalu gunakan sintaks `CREATE INDEX CONCURRENTLY idx_name ON table_name (column_name);`.
3. **Lock Timeout Protection:** Selalu deklarasikan limit waktu tunggu lock sebelum mengeksekusi DDL agar tidak memblokir antrean transaksi runtime:
   ```sql
   SET lock_timeout = '3000ms';
   SET statement_timeout = '15000ms';
   ```
4. **Isolasi RLS Wajib Aktif:** Setiap tabel baru yang dibuat wajib segera dijalankan perintah:
   ```sql
   ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
   ALTER TABLE table_name FORCE ROW LEVEL SECURITY;
   ```

---

## 3. Pipeline Otomasi CI/CD (GitHub Actions)

File konfigurasi workflow terpadu SICA diletakkan pada `.github/workflows/main-pipeline.yml`.

```yaml
name: SICA Enterprise CI/CD Pipeline

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ====================================================================
  # JOB 1: CODE QUALITY, LINTING & SECURITY SCANS
  # ====================================================================
  quality-and-security:
    name: Lint, Static Analysis & SAST Scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Flutter SDK
        uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.24.x'
          channel: 'stable'
          cache: true

      - name: Install Web Dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint Next.js & TypeScript
        run: pnpm --filter @sica/web lint

      - name: Lint Flutter Mobile Code
        working-directory: apps/mobile
        run: |
          flutter pub get
          flutter analyze --fatal-infos

      # Static Application Security Testing (SAST)
      - name: Run Semgrep Security Audit
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/owasp-top-ten
            p/javascript
            p/typescript

      - name: Run Snyk Open-Source Vulnerability Scanner
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

  # ====================================================================
  # JOB 2: AUTOMATED TESTING (UNIT, RLS, COVERAGE CHECK)
  # ====================================================================
  automated-tests:
    name: Vitest & Flutter Test Automation
    needs: [quality-and-security]
    runs-on: ubuntu-latest
    services:
      postgres-test:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: password123
          POSTGRES_DB: sica_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js & pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Setup Flutter SDK
        uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.24.x'
          channel: 'stable'

      - name: Install Dependencies
        run: pnpm install --frozen-lockfile

      - name: Run Drizzle Test Migrations & RLS Policies
        env:
          DATABASE_URL: postgresql://postgres:password123@localhost:5432/sica_test
        run: pnpm --filter @sica/database migrate

      - name: Run Vitest (Web & API Integration Tests) with Coverage Check
        env:
          TEST_DATABASE_URL: postgresql://postgres:password123@localhost:5432/sica_test
        run: pnpm --filter @sica/web test:coverage --coverage.thresholds.100=false --coverage.thresholds.lines=80

      - name: Run Flutter Mobile Tests
        working-directory: apps/mobile
        run: |
          flutter pub get
          flutter test --coverage

  # ====================================================================
  # JOB 3: DEPLOY WEB TO VERCEL (STAGING & PRODUCTION)
  # ====================================================================
  deploy-web:
    name: Deploy Web Application (Vercel)
    needs: [automated-tests]
    if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging')
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: ${{ github.ref == 'refs/heads/main' && '--prod' || '' }}
          working-directory: apps/web

  # ====================================================================
  # JOB 4: BUILD & DISTRIBUTE MOBILE APK (FIREBASE APP DISTRIBUTION)
  # ====================================================================
  deploy-mobile-staging:
    name: Build & Distribute Android APK (Staging)
    needs: [automated-tests]
    if: github.event_name == 'push' && github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Java 17
        uses: actions/setup-java@v3
        with:
          distribution: 'zulu'
          java-version: '17'

      - name: Setup Flutter SDK
        uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.24.x'
          channel: 'stable'

      - name: Build Android APK (Staging Flavor)
        working-directory: apps/mobile
        run: |
          flutter pub get
          flutter build apk --flavor staging -t lib/main_staging.dart

      - name: Upload to Firebase App Distribution
        uses: wzieba/Firebase-Distribution-Github-Action@v1
        with:
          appId: ${{ secrets.FIREBASE_ANDROID_APP_ID }}
          serviceCredentialsFileContent: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_KEY }}
          groups: academic-beta-testers
          file: apps/mobile/build/app/outputs/flutter-apk/app-staging-release.apk
```

---

## 4. High-Availability & Auto-Scaling (Target 1.000+ Concurrent Users)

**Rekonsiliasi provider (INFRA-D1):** ADR-10 memilih **ECS Fargate** untuk API/Worker; §3 memakai **Vercel** untuk web. Keputusan: **web Next.js** boleh di Vercel/serverless (edge), namun **`apps/api` + `apps/worker`** berjalan di **container ter-orchestrasi (ECS Fargate/Kubernetes)** karena beban *long-running* (BullMQ, batch tagihan/feeder) tidak cocok untuk function time-limit. Auto-scaling dideskripsikan untuk **kedua model** (HPA utk kube/ECS, Serverless Execution Limits utk Vercel/Cloud Run).

### 4.1 Auto-Scaling Horizontal
**Model A — ECS/Kubernetes (HPA) untuk `apps/api` & `apps/worker`:**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: sica-api-hpa }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: sica-api }
  minReplicas: 3
  maxReplicas: 24
  metrics:
    - type: Resource
      resource: { name: cpu,    target: { type: Utilization, averageUtilization: 60 } }
    - type: Resource
      resource: { name: memory, target: { type: Utilization, averageUtilization: 75 } }
    - type: External
      external: { metric: { name: rps }, target: { type: AverageValue, averageValue: "400" } }
  behavior:
    scaleUp:   { stabilizationWindowSeconds: 15, policies: [{ type: Percent, value: 100, periodSeconds: 30 }] }  # cepat naik saat OW
    scaleDown: { stabilizationWindowSeconds: 300, policies: [{ type: Pods, value: 2, periodSeconds: 60 }] }       # turun hati-hati
```
- **PodDisruptionBudget** `minAvailable: 2` — mencegah scaling/eviction menghabiskan kapasitas.
- Sizing pod: `requests` cpu 500m / mem 512Mi, `limits` cpu 1000m / mem 1Gi; `terminationGracePeriodSeconds: 30` + **graceful drain** (stop accept new, selesai in-flight).
- `apps/worker` HPA berbasis **queue depth** (`bull_queue_waiting > 200`) bukan CPU, agar drain KRS-war proporsional.

**Model B — Serverless (Vercel/Cloud Run) untuk web & API ringan:**
- `maxDuration`/execution-time-out, `memory` 1024MB, `min=3 / max=50` instances, concurrency/instance `≈10` (isolasi cold-start & tail-latency).
- Autoscale by concurrent executions & RPS; `provisioned concurrency` dipasang **menjelang jendela OW** (skala pra-warm per-tenant).

### 4.2 Health Check Endpoint
`GET /api/v1/health` (liveness) & `GET /api/v1/health/ready` (readiness) — dipakai LB/ALB/Cloudflare/Liveness+Readiness probes.
```jsonc
// /health/ready 200 (semua green) — kalau salah satu down → 503 (out-of-rotation)
{
  "status": "ok",
  "checks": {
    "db_primary":   { "ok": true, "latencyMs": 4 },   // SELECT 1 ke Primary (write-capable)
    "db_replica":   { "ok": true, "latencyMs": 6 },   // SELECT 1 ke replica (read)
    "redis":        { "ok": true, "latencyMs": 2 },   // PING
    "queue":        { "ok": true, "waitingJobs": 0 }, // BullMQ metadata
    "storage":      { "ok": true },                    // HEAD ke bucket
    "version": "2026.10.18+sha.abcd", "uptimeSec": 4210
  }
}
```
Aturan: **liveness** murah (proses hidup) → restart bila macet; **readiness** menguji dependensi → tarik dari rotasi LB tanpa restart. Timeout probe 2s, `failureThreshold` 3, `periodSeconds` 5.

### 4.3 Failover Otomatis
- **PostgreSQL:** Patroni/repmgr + etcd → bila Primary hilang, replica dipromosikan (RTO ≤ 30 s); PgBouncer otomatis mengarah ulang ke new primary via DNS/service. WAL-G PITR untuk restore.
- **Redis:** Sentinel/Cluster failover; AOF utk data kritis (session/kuota). Kuota OW dibangun-ulang (re-seed) dari DB bila node pemilik hilang (idempotent).
- **App/LB:** health-check melepas pod/instance sakit; **retry + circuit breaker** di client internal; multi-AZ.
- **Region:** (opsional fase lanjut) active-passive antar region; DNS/Cloudflare steer. RPO/RTO target didokumentasikan di [ISSUE_RESOLUTION.md](file:///c:/SICA/docs/ISSUE_RESOLUTION.md).

### 4.4 Zero-Downtime Deployment Pipeline
```
Build image → push registry → migrate (Expand, §2) → deploy canary 5%
  → gate: /health/ready + error-rate < SLI + p95 OK ?
    ├─ ya → progressive 25% → 50% → 100% (RollingUpdate maxSurge=1,maxUnavailable=0 / Blue-Green)
    └─ tidak → auto-rollback (screenshot Sentry + on-call page)
→ Contract phase migrasi DDL (DROP) di jendela terpisah setelah stabil 1 periode.
```
- **RollingUpdate** `maxUnavailable: 0, maxSurge: 1` + readiness gate = tak ada pot kosong.
- **Migrasi Expand-and-Contract** (§2) agar skema selalu mundur-kompatibel saat dua versi app hidup bareng.
- **Feature flag / tenant_modules** (§DATA_MODEL 12) memisahkan *deploy* dari *release* — kode terpasang, modul di-*enable* bertahap.

