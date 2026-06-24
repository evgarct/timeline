# Fitness Timeline repository rules

- Keep Today and Timeline in one scroll document; do not create a separate Timeline route or navigation item.
- New product capabilities must be represented as Timeline event types unless the user explicitly changes this product rule.
- Treat progress photos and InBody originals as private data. Never place real user uploads or medical reports under `public/` or in test fixtures.
- Verify photo and report uploads with iPhone-compatible HEIC/HEIF, JPEG, PNG, camera capture, and PDF inputs.
- Persist managed media asset IDs and R2 object keys only; never store presigned URLs in event payloads.
- Normalize progress photos to metadata-free JPEG full/thumbnail objects, while retaining InBody uploads in their original supported format.
- Create the private R2 bucket through Dashboard or Wrangler with explicit EU jurisdiction; the Cloudflare MCP bucket API cannot pass the required jurisdiction header.
- Keep all visible UI text in the RU/EN/CS message dictionaries.
- Before UI or visual design work, read `docs/DESIGN.md` and use it as the repo design source of truth; after the user approves a UI result, add durable principles or accepted examples there.
- When the user provides an explicit design specification for implemented UI, update `docs/DESIGN.md` in the same change with the durable product/design principles unless the user labels it as a temporary experiment.
- For reviewable implementation work, finish by committing, pushing, opening a PR, and verifying the PR head unless the user explicitly asks not to create a PR.
- Run Playwright with `E2E_DEMO_MODE=true`; E2E must never send real Neon OTP emails or write test events to the linked Neon database.
- Generate Drizzle schema changes with `npm run db:generate` and keep the generated SQL plus `drizzle/meta` snapshot together; do not hand-add migrations without matching metadata.
- After Next.js build/dev commands, do not commit incidental `next-env.d.ts` route-type import churn unless typed-route configuration intentionally changed.
- Do not run `npm run typecheck` in parallel with `npm run build`; Next.js can regenerate `.next/types` during build and make `tsc --noEmit` fail on transient missing route-type files.
