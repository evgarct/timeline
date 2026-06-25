import { neon } from "@neondatabase/serverless";
import { loadEnvFile } from "./env.mjs";

loadEnvFile();

const requiredPublicTables = [
  "events",
  "task_schedules",
  "mcp_tokens",
  "media_assets",
  "storage_policies"
];

const requiredMigrations = [
  1782143245859,
  1782163256374,
  1782237866247
];

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for db:verify");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const tableRows = await sql`
  select table_schema, table_name
  from information_schema.tables
  where (
    table_schema = 'public'
    and table_name = any(${requiredPublicTables})
  )
  or (
    table_schema = 'drizzle'
    and table_name = '__drizzle_migrations'
  )
`;

const tableSet = new Set(tableRows.map((row) => `${row.table_schema}.${row.table_name}`));
const missingTables = [
  ...requiredPublicTables.map((name) => `public.${name}`),
  "drizzle.__drizzle_migrations"
].filter((name) => !tableSet.has(name));

const migrationRows = tableSet.has("drizzle.__drizzle_migrations")
  ? await sql`
      select created_at
      from drizzle.__drizzle_migrations
      where created_at = any(${requiredMigrations})
    `
  : [];
const migrationSet = new Set(migrationRows.map((row) => Number(row.created_at)));
const missingMigrations = requiredMigrations.filter((createdAt) => !migrationSet.has(createdAt));

if (missingTables.length || missingMigrations.length) {
  console.error("Database verification failed");
  if (missingTables.length) console.error(`Missing tables: ${missingTables.join(", ")}`);
  if (missingMigrations.length) console.error(`Missing migrations: ${missingMigrations.join(", ")}`);
  process.exit(1);
}

console.log(`Database verification passed (${requiredPublicTables.length} runtime tables, ${requiredMigrations.length} migrations).`);
