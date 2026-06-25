# Private media storage

Timeline stores private user uploads in a non-public Cloudflare R2 bucket. Progress photos are
normalized in the browser to metadata-free JPEG files before upload:

- full image: longest side up to 3000 px, JPEG quality 90%;
- thumbnail: longest side up to 720 px, JPEG quality 90%;
- accepted sources: HEIC, HEIF, JPEG, and PNG;
- InBody uploads retain their original PDF, HEIC, HEIF, JPEG, or PNG bytes.

The database stores object keys and managed asset IDs, not signed URLs. Progress image reads use
one-hour presigned URLs. InBody originals are streamed through the authenticated application route
with `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, and no-store caching.

## Cloudflare setup

1. Enable R2 in the Cloudflare dashboard. The Cloudflare API cannot perform the initial product and
   billing activation.
2. Create the private bucket `timeline-private-media` with EU jurisdiction and Standard storage.
3. Keep the managed `r2.dev` domain disabled. The application uses the S3 API endpoint only.
4. Create an R2 token scoped to object read/write for this bucket.
5. Configure this CORS policy, replacing the production origin with the deployed application URL:

```json
{
  "rules": [
    {
      "id": "timeline-browser-uploads",
      "allowed": {
        "origins": [
          "https://timeline.example.com",
          "http://localhost:3000",
          "http://127.0.0.1:3000"
        ],
        "methods": ["PUT", "GET", "HEAD"],
        "headers": ["Content-Type"]
      },
      "exposeHeaders": ["ETag"],
      "maxAgeSeconds": 3600
    }
  ]
}
```

## Environment

Configure these values independently in every local, preview, and production environment:

```dotenv
R2_ACCOUNT_ID=
R2_ENDPOINT=https://<account-id>.eu.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=timeline-private-media
CRON_SECRET=
```

Preview and development deployments should use a separate bucket such as
`timeline-private-media-staging`, created with the same EU jurisdiction and CORS policy. Do not point
browser upload smoke tests at the production bucket until staging has passed.

The daily Vercel cron calls `/api/uploads/cleanup`. It removes pending uploads older than 24 hours
and retries objects left in the `deleting` state. Vercel supplies `Authorization: Bearer
<CRON_SECRET>` to cron requests.

## Deployment order

1. Enable R2 and create/configure the bucket.
2. Add R2 and cron secrets to the target deployment environment.
3. Apply Drizzle migrations.
4. Run `npm run db:verify` against the target database.
5. Deploy the application.
6. Verify a real upload, page reload, gallery open, and event deletion against the target bucket.
