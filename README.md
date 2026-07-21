# Form

Form is a private, native iPhone body timeline. The SwiftUI app is the primary product; the existing Next.js application remains the authenticated Neon/R2 backend, MCP surface, and web companion.

Start with [`Documentation/README.md`](Documentation/README.md). Generate and verify the iOS project on a Mac with:

```bash
./scripts/bootstrap-mac.sh
make build-ios
make test-ios
```

Private user media is stored in Cloudflare R2 and referenced from Neon by managed asset IDs. See
[`docs/R2_STORAGE.md`](docs/R2_STORAGE.md) for bucket, CORS, environment, and cleanup configuration.
