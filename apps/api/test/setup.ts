// Test bootstrap: provisions an isolated MySQL database per `bun test` run
// (dropped + recreated at start), applies drizzle migrations, creates the
// external shared `users` table, and drops everything after the run.
// Preloaded via bunfig.toml so it runs before any source module reads
// DATABASE_URL.
//
// Zero-config goal: `bun test` works from a clean checkout. The admin DB
// connection is derived from DATABASE_URL unless TEST_DATABASE_ADMIN_URL is
// set, and every env var validated at module load time gets a test default
// below (real .env values still win locally, since bun loads .env first).
//
// Database layout
// ---------------
// - App DB (`TEST_DATABASE_NAME`, default `shenicest_test`): drizzle-managed
//   schema. Fully dropped + recreated at start.
// - Shared users table (`TEST_SHARED_DATABASE_NAME.users`, default
//   `${APP_DB}.users`): mirrors the external auth system's schema. The app
//   requires `SHARED_USERS_TABLE` in `db.table` form, so by default we
//   co-locate the shared `users` table inside the app DB — MySQL resolves
//   `db.table` fine and we sidestep needing extra CREATE DATABASE grants.
//   Override `TEST_SHARED_DATABASE_NAME` to a separate DB (matching prod
//   topology) if the admin user has grants there.
import { migrate } from 'drizzle-orm/mysql2/migrator'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Derive the admin URL from DATABASE_URL by stripping the database segment
// (mysql://user:pass@host:port/db -> mysql://user:pass@host:port). String
// surgery instead of URL round-tripping so passwords with special characters
// survive untouched.
function deriveAdminUrl(databaseUrl: string): string | undefined {
  const match = databaseUrl.match(/^([a-z][a-z0-9+.-]*:\/\/[^/]+?)\/[^/]+\/?$/)
  return match ? match[1] : undefined
}

const ADMIN_URL =
  process.env.TEST_DATABASE_ADMIN_URL ??
  (process.env.DATABASE_URL ? deriveAdminUrl(process.env.DATABASE_URL) : undefined)
if (!ADMIN_URL) {
  throw new Error(
    'Could not determine the test database admin URL. Set TEST_DATABASE_ADMIN_URL ' +
      '(e.g. mysql://shenicest:pw@localhost:3306, without a database segment), or set ' +
      'DATABASE_URL and it will be derived. See apps/api/.env.example.',
  )
}

const adminUrl = new URL(ADMIN_URL)
if (adminUrl.pathname && adminUrl.pathname !== '/') {
  throw new Error(
    `TEST_DATABASE_ADMIN_URL must not include a database path, got: ${adminUrl.pathname}`,
  )
}

const APP_DB = process.env.TEST_DATABASE_NAME ?? 'shenicest_test'
// Default to co-locating the shared users table inside the app DB so no
// extra grants are required. Override for prod-topology tests.
const SHARED_DB = process.env.TEST_SHARED_DATABASE_NAME ?? APP_DB
const SHARED_TABLE = `${SHARED_DB}.users`
const SHARED_IN_APP_DB = SHARED_DB === APP_DB

const buildUrl = (database?: string) => {
  const u = new URL(adminUrl.toString())
  u.pathname = database ? `/${database}` : '/'
  return u.toString()
}

// Admin connection stays open through the run so DROP at teardown time
// isn't racing the app's connection pool.
const admin = await mysql.createConnection(buildUrl())
const q = (sql: string) => admin.query(sql)

// App DB: full drop+create every run.
await q(`DROP DATABASE IF EXISTS \`${APP_DB}\``)
await q(`CREATE DATABASE \`${APP_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)

// Shared DB: skip if co-located with app DB (already recreated above).
// Otherwise CREATE IF NOT EXISTS — may be a pre-granted DB the user
// doesn't have DROP DATABASE rights on. The `users` table is always
// dropped+recreated so each run starts clean.
if (!SHARED_IN_APP_DB) {
  try {
    await q(`CREATE DATABASE IF NOT EXISTS \`${SHARED_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Failed to create shared test database \`${SHARED_DB}\`: ${msg}\n\n` +
        `The MySQL user in TEST_DATABASE_ADMIN_URL needs CREATE on \`${SHARED_DB}\`.\n` +
        `Fix locally by running as MySQL root (once):\n` +
        `  CREATE DATABASE \\\`${SHARED_DB}\\\`;\n` +
        `  GRANT ALL PRIVILEGES ON \\\`${SHARED_DB}\\\`.* TO '<user>'@'localhost';\n` +
        `  FLUSH PRIVILEGES;\n` +
        `Or unset TEST_SHARED_DATABASE_NAME to co-locate the shared table in the app DB.`,
    )
  }
}
await q(`DROP TABLE IF EXISTS \`${SHARED_DB}\`.\`users\``)
await q(`CREATE TABLE \`${SHARED_DB}\`.\`users\` (
  id int NOT NULL AUTO_INCREMENT,
  email varchar(255) DEFAULT NULL,
  phone varchar(20) DEFAULT NULL,
  nickname varchar(100) DEFAULT NULL,
  avatar_url varchar(500) DEFAULT NULL,
  social_links json DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  onboarding_completed datetime DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY email (email),
  UNIQUE KEY uk_users_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

// Publish env vars before any source module (which reads them at import
// time) is loaded by test files. bunfig preload guarantees ordering.
//
// This file is the single source of truth for the test environment: every
// variable validated at module load time gets a test default here, so
// `bun test` works from a clean checkout with no .env file (as in CI).
// Locally, bun auto-loads apps/api/.env first, so real values win.
process.env.DATABASE_URL = buildUrl(APP_DB)
process.env.SHARED_USERS_TABLE = SHARED_TABLE
process.env.SHENICEST_JWT_SECRET ??= 'test-secret-do-not-use-in-prod'
process.env.SHENICEST_RATE_LIMIT_SECRET ??= 'test-rate-limit-secret-do-not-use-in-prod'
process.env.SHENICEST_API_BASE ??= 'https://shenicest.test/platform/api'
// Dummy COS credentials: presigning is a local HMAC computation, so tests
// never touch the network — but the upload service validates presence at
// module load time.
process.env.COS_SECRET_ID ??= 'test-cos-secret-id'
process.env.COS_SECRET_KEY ??= 'test-cos-secret-key'
// The COS SDK validates bucket format locally (name-<numeric appid>).
process.env.COS_BUCKET ??= 'test-bucket-1250000000'
process.env.COS_REGION ??= 'ap-shanghai'
process.env.COS_ENDPOINT ??= 'https://cos.ap-shanghai.myqcloud.com'
process.env.COS_PUBLIC_BASE_URL ??= 'https://assets.shenicest.test'
process.env.COS_UPLOAD_PREFIX ??= 'projects/'
process.env.SHENICEST_CONTACT_ENCRYPTION_KEY ??= 'test-contact-encryption-key-at-least-32-chars'

// Apply drizzle migrations against the freshly created app DB.
const migrationPool = mysql.createPool(buildUrl(APP_DB))
const migrationDb = drizzle(migrationPool)
await migrate(migrationDb, { migrationsFolder: resolve(__dirname, '../drizzle') })
await migrationPool.end()

// Teardown: drop the app DB. If the shared users table lives in a separate
// DB, drop just that table (we don't drop the shared DB itself because the
// admin user may not have that grant).
let cleaned = false
const cleanup = async () => {
  if (cleaned) return
  cleaned = true
  try {
    await admin.query(`DROP DATABASE IF EXISTS \`${APP_DB}\``)
    if (!SHARED_IN_APP_DB) {
      await admin.query(`DROP TABLE IF EXISTS \`${SHARED_DB}\`.\`users\``)
    }
  } finally {
    await admin.end().catch(() => {})
  }
}

process.on('beforeExit', () => {
  void cleanup()
})
process.on('SIGINT', async () => {
  await cleanup()
  process.exit(130)
})
process.on('SIGTERM', async () => {
  await cleanup()
  process.exit(143)
})
