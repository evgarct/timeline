# Architecture

## Application shape

- `Form/`: SwiftUI iPhone app, iOS 26+, Swift 6 strict concurrency.
- `project.yml`: authoritative XcodeGen project definition.
- `src/app/api`: Next.js production backend and Neon Auth proxy.
- Neon PostgreSQL: owner-scoped events and media metadata.
- private Cloudflare R2: normalized progress photos and original InBody files.

## Native boundaries

`AppRuntime` owns authentication and the Today store. SwiftUI views receive narrow dependencies. `AuthenticationClient`, `TimelineRepository`, and `StepCountProviding` isolate network and HealthKit behavior from presentation and tests.

`StepCountProviding` accepts a selected date and returns a local weekly activity snapshot: daily HealthKit step totals from Monday through Sunday plus the selected day's walking/running distance. Today queries end at the current instant; historical day queries end at the next midnight. `TodayStore` keeps snapshots in memory without backend persistence. Health activity is intentionally not a Timeline event because HealthKit remains the device-local source of truth for this single-iPhone product phase.

The shared `URLSession` cookie store establishes an email OTP session through `/api/auth`, then calls `/api/events`. The server derives the owner from the verified session; the native client never supplies a user ID.

Timeline JSON is decoded into a closed native enum. Unknown future event types are retained as unsupported records rather than failing the entire response. Presigned URLs exist only in memory.

## Configuration

`FORM_AUTH_BASE_URL` and `FORM_API_BASE_URL` are supplied through ignored `Config/Form.local.xcconfig`. Because `//` starts a comment in xcconfig syntax, HTTPS values must escape the first slash as `https:/$()/host`. The signed app must be inspected to prove both resulting Info.plist values are complete HTTPS URLs before device delivery. Production signing values and secrets remain outside Git.
