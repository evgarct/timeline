# Fitness Timeline repository rules

- Keep Today and Timeline in one scroll document; do not create a separate Timeline route or navigation item.
- New product capabilities must be represented as Timeline event types unless the user explicitly changes this product rule.
- Treat progress photos and InBody originals as private data. Never place real user uploads or medical reports under `public/` or in test fixtures.
- Verify photo and report uploads with iPhone-compatible HEIC/HEIF, JPEG, PNG, camera capture, and PDF inputs.
- Keep all visible UI text in the RU/EN/CS message dictionaries.
- Run Playwright with `E2E_DEMO_MODE=true`; E2E must never send real Neon OTP emails or write test events to the linked Neon database.
