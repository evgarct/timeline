# ADR 0001: Native iPhone App Is Primary

## Status

Accepted.

## Decision

Form's primary client is a native SwiftUI iPhone application targeting iOS 26+. XcodeGen and `project.yml` define the project. Native Apple controls, HealthKit, accessibility, localization, and Liquid Glass are preferred over cross-platform UI abstractions.

## Consequences

SwiftUI previews and iOS tests are the native visual workflow. The mobile web interface is no longer the design authority.
