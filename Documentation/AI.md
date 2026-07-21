# AI Contributor Contract

- Read this directory before changing product or native architecture.
- Keep user-facing strings in `Localizable.xcstrings` for RU/EN/CS.
- Use repository/service boundaries; never perform network or HealthKit work from a SwiftUI `body`.
- Keep previews and tests deterministic and disconnected from production services.
- Never store client-supplied owner IDs, signed media URLs, credentials, or private uploads.
- Update documentation in the same change as behavior.
- Verify native changes on the configured Mac; verify device-specific behavior on the paired iPhone.
