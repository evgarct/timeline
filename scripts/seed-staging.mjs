import { neon } from "@neondatabase/serverless";
import { loadEnvFile } from "./env.mjs";

loadEnvFile();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for db:seed:staging");
  process.exit(1);
}

if (process.env.ALLOW_PRODUCTION_SEED !== "true") {
  const host = new URL(process.env.DATABASE_URL).hostname;
  const expectedHostPattern = process.env.STAGING_DATABASE_HOST_PATTERN ?? "staging";
  if (!host.includes(expectedHostPattern) && !host.includes("staging")) {
    console.error("Refusing to seed a database that does not look like the staging branch.");
    console.error(`Expected host to include "${expectedHostPattern}" or "staging"; got "${host}".`);
    console.error("Set ALLOW_PRODUCTION_SEED=true only for an intentional one-off override.");
    process.exit(1);
  }
}

const sql = neon(process.env.DATABASE_URL);

const users = {
  owner: "staging-owner-user",
  normal: "staging-normal-user",
  nearQuota: "staging-near-quota-user",
  media: "staging-media-user"
};

await sql`
  insert into storage_policies (user_id, limit_bytes, plan)
  values
    (${users.normal}, ${250 * 1024 * 1024}, 'staging-normal'),
    (${users.nearQuota}, ${1024}, 'staging-near-quota'),
    (${users.media}, ${250 * 1024 * 1024}, 'staging-media')
  on conflict (user_id) do update set
    limit_bytes = excluded.limit_bytes,
    plan = excluded.plan,
    updated_at = now()
`;

await sql`
  insert into media_assets (
    id,
    user_id,
    event_id,
    kind,
    object_key,
    thumbnail_object_key,
    mime_type,
    original_file_name,
    width,
    height,
    size_bytes,
    thumbnail_size_bytes,
    status
  )
  values (
    '73e167ac-67fe-4ffa-9ad3-4beee18a0e8a',
    ${users.media},
    '315db881-a742-45f6-a801-447808fffe6e',
    'progress_photo',
    'users/staging-media-user/progress/73e167ac-67fe-4ffa-9ad3-4beee18a0e8a/full.jpg',
    'users/staging-media-user/progress/73e167ac-67fe-4ffa-9ad3-4beee18a0e8a/thumbnail.jpg',
    'image/jpeg',
    'staging-progress.jpg',
    1200,
    1600,
    100,
    20,
    'ready'
  )
  on conflict (id) do update set
    user_id = excluded.user_id,
    event_id = excluded.event_id,
    kind = excluded.kind,
    object_key = excluded.object_key,
    thumbnail_object_key = excluded.thumbnail_object_key,
    mime_type = excluded.mime_type,
    original_file_name = excluded.original_file_name,
    width = excluded.width,
    height = excluded.height,
    size_bytes = excluded.size_bytes,
    thumbnail_size_bytes = excluded.thumbnail_size_bytes,
    status = excluded.status,
    updated_at = now()
`;

await sql`
  insert into events (id, user_id, type, occurred_at, timezone, note, payload)
  values (
    '315db881-a742-45f6-a801-447808fffe6e',
    ${users.media},
    'progress_photo',
    '2026-06-24T12:00:00.000Z',
    'Europe/Prague',
    'Staging seeded progress photo event',
    ${JSON.stringify({
      photos: [{
        id: "front",
        assetId: "73e167ac-67fe-4ffa-9ad3-4beee18a0e8a",
        alt: "Staging progress photo",
        palette: {
          background: "#15120f",
          accent: "#d6a15f",
          foreground: "#f8f3ec"
        }
      }]
    })}
  )
  on conflict (id) do update set
    user_id = excluded.user_id,
    type = excluded.type,
    occurred_at = excluded.occurred_at,
    timezone = excluded.timezone,
    note = excluded.note,
    payload = excluded.payload,
    updated_at = now()
`;

console.log(`Seeded staging users: ${Object.values(users).join(", ")}`);
