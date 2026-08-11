# 2026-07-31 — TUI-first clean-break reset

Status: **implemented** on `refactor/tui-first-reset`.

This dossier records the investigation and destructive replacement of the unreleased multi-package prototype with one terminal-first package, one canonical cell scene/controller, and isolated browser/terminal hosts.

## Reading order

1. [Analysis notebook](01-analysis.md) — repository, Git/PR, external-consumer, and framework evidence.
2. [Consolidated proposal](02-proposal.md) — product and architecture recommendation.
3. [Execution record](03-execution.md) — completed phases and acceptance gates.

## Result

The reset produced the source described by the current [architecture](../../architecture.md) and [specification](../../spec.md), primarily in commits:

- `7758468` — documentation/direction reset;
- `91eef1d` — destructive one-package implementation.

Later rendering fixes did not change the semantic kernel; see the timeline in [docs/README.md](../../README.md).

## Supersession note

The package/host boundaries and TUI-first semantics remain current. The public component/prop vocabulary proposed here was reopened and replaced by the implemented [2026-08-01 public-language review](../2026-08-01-api-language-review/README.md), because no package version was published. Although this historical dossier records the original 1.0.0 target, current manifests intentionally use 0.9.1 while more evidence is gathered before 1.0.
