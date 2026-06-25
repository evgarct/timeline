# Release and staging gates

Timeline uses production Neon and R2 only for live user data. Development and preview verification must use isolated
staging resources before production is changed.

## Environments

- Production Neon branch: `main` in project `timeline`.
- Staging Neon branch: create from production before release verification, then run migrations there first.
- Production R2 bucket: `timeline-private-media`.
- Staging R2 bucket: `timeline-private-media-staging`, created with EU jurisdiction and private access.

Do not point Preview deployments at the production database. Do not run upload smoke tests against production until
staging has passed the same checks.
Do not create the staging R2 bucket through the current Cloudflare MCP wrapper: it can return `location: WEUR` while
still creating `jurisdiction: default`. Use Dashboard or `wrangler r2 bucket create timeline-private-media-staging
--jurisdiction eu`, then verify the bucket jurisdiction before using it.

## Database gates

Run these commands against staging first:

```bash
npm run db:migrate
npm run db:verify
npm run db:seed:staging
```

`npm run db:verify` checks the runtime tables and Drizzle migration records required by the upload and timeline paths.
It must pass before the app is considered ready for preview or production.

After staging passes and before production deploy, run:

```bash
npm run db:migrate
npm run db:verify
```

against the production database. Production deployment is not ready if either command fails.

## Staging seed users

The staging seed creates app-level data for these opaque user IDs:

- `staging-owner-user`: owner/unlimited quota allowlist value.
- `staging-normal-user`: normal quota policy.
- `staging-near-quota-user`: low quota policy for upload rejection checks.
- `staging-media-user`: progress photo event with managed media references.

These users are for database and API verification. Real browser login still depends on the configured Neon Auth
environment and should be verified separately with a test account.

## Upload smoke

Before merging or deploying upload-related changes:

1. Run CI checks locally or in GitHub Actions.
2. Apply migrations to staging and run `npm run db:verify`.
3. Verify Preview uses staging Neon and staging R2.
4. Upload a progress photo in a browser: presign, R2 PUT, complete, event save, reload, gallery open.
5. Apply migrations to production and run `npm run db:verify`.
6. Deploy production and repeat the browser upload smoke with a real account.
7. Check Vercel logs for fresh `5xx` entries on `/api/uploads/presign`, `/api/uploads/complete`, and `/api/media/*`.
