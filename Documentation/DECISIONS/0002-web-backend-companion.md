# ADR 0002: Preserve the Web Backend and MCP

## Status

Accepted.

## Decision

The existing Next.js application remains the authenticated Neon/R2 backend, MCP surface, and optional web companion. Native and web clients share the current Timeline event schema and owner-scoped storage.

## Consequences

Backend routes derive ownership from verified Neon Auth sessions. Native additions must preserve web/MCP compatibility and must not introduce a second database or media store.
