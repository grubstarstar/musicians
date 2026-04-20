import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import postgres from 'postgres';

/**
 * Idempotent setup for the e2e test database (MUS-71). Connects to the
 * default `postgres` admin database, creates `musicians_test` if it doesn't
 * exist, then applies all Drizzle migrations against it. Safe to run twice in
 * a row — the second run is a no-op (CREATE DATABASE is conditional, and
 * `migrate` is idempotent by design).
 *
 * Lives next to `migrate.ts` rather than under a `scripts/` folder so it
 * benefits from the same `tsx`-based ESM-with-TypeScript ergonomics as the
 * existing migrate script.
 */

const ADMIN_DATABASE_URL =
  process.env.E2E_ADMIN_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres';

const TEST_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/musicians_test';

const TEST_DB_NAME = 'musicians_test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(__dirname, '..', 'drizzle');

async function main(): Promise<void> {
  // Step 1: connect to the admin DB and create musicians_test if absent.
  // `postgres()` doesn't expose a built-in "create database if not exists" so
  // we do it the standard way: probe pg_database, then issue CREATE DATABASE
  // unconditionally if it's missing. CREATE DATABASE can't run inside a
  // transaction, so we use `unsafe()` to send it raw.
  //
  // `onnotice: () => {}` swallows the NOTICE blocks Postgres emits for
  // "schema already exists" / "table already exists" on repeat runs — the
  // script is intentionally idempotent and those notices spook devs. The
  // explicit "already exists / created" log lines below are the real signal.
  const adminClient = postgres(ADMIN_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    const existing = await adminClient<{ datname: string }[]>`
      SELECT datname FROM pg_database WHERE datname = ${TEST_DB_NAME}
    `;
    if (existing.length === 0) {
      // `CREATE DATABASE` requires an unparametrised identifier; the name is a
      // hard-coded constant above so there's no injection risk.
      await adminClient.unsafe(`CREATE DATABASE "${TEST_DB_NAME}"`);
      console.log(`Created database: ${TEST_DB_NAME}`);
    } else {
      console.log(`Database ${TEST_DB_NAME} already exists — skipped CREATE.`);
    }
  } finally {
    await adminClient.end();
  }

  // Step 2: connect to the test DB and apply migrations. drizzle's `migrate`
  // checks the migrations table and skips already-applied entries, so this is
  // idempotent. Same `onnotice` suppression — drizzle's first migration emits
  // a NOTICE for the `drizzle.__drizzle_migrations` schema/table on re-runs.
  const migrationClient = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(migrationClient), { migrationsFolder });
    console.log('Migrations applied to musicians_test.');
  } finally {
    await migrationClient.end();
  }
}

main().catch((err) => {
  console.error('e2e:db-setup failed:', err);
  process.exit(1);
});
