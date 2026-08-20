# Documentation map and development timeline

The repository keeps **current authority** at stable paths under `docs/` and keeps investigations/refactors in dated dossiers under `docs/refactors/`.

## Current authoritative documents

Read these for the source tree as it exists now:

1. [Specification](spec.md) defines normative behavior and wins when semantics are unclear.
2. [Architecture](architecture.md) records implemented modules and data flow.
3. [Strategy](strategy.md) defines the product boundary and scope filter.
4. [Roadmap](roadmap.md) records release state and next work.
5. [Testing](testing.md) defines the behavior matrix and release gates.
6. [Recipes](recipes.md) provides higher-level compositions over the foundation.
7. The [`@faux-ui/grid` package guide](../packages/grid/README.md) documents the optional CSS-grid-like layout and third-party component example.
8. [Cross-agent Skill packaging](agent-skill-packaging.md) records Agent Skills, Pi, Codex/ChatGPT, and Claude Code discovery and distribution.
9. [Small improvements](improvements.md) is reserved for unstructured minor fixes.

A dated refactor decision is not implemented reality until the source, specification, architecture, examples, tests, and package checks have been changed together. Until then, the root specification and architecture remain authoritative.

## Timeline

| Date       | Milestone                                                     | Status                                    | Evidence                                                                                                 |
| ---------- | ------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 2026-07-31 | TUI-first clean-break reset                                   | Implemented on `refactor/tui-first-reset` | [Dossier](refactors/2026-07-31-tui-first-reset/README.md), commits `7758468` and `91eef1d`               |
| 2026-08-01 | DOM/TUI rendering stabilization                               | Implemented                               | Commits `740333f` through `fa852c9`; [changelog](../CHANGELOG.md) and [testing matrix](testing.md)       |
| 2026-08-01 | Public-language and spacing review                            | Implemented in 0.9.1 candidate            | [Dossier](refactors/2026-08-01-api-language-review/README.md)                                            |
| 2026-08-01 | Standalone CSS-grid-like extension and public layout contract | Implemented; unreleased                   | [Dossier](refactors/2026-08-01-standalone-grid/README.md), [`@faux-ui/grid`](../packages/grid/README.md) |
| 2026-08-02 | Cross-agent package Skill packaging                           | Implemented; unreleased                   | [Packaging reference](agent-skill-packaging.md)                                                          |

## Refactor dossier convention

Each folder is named `YYYY-MM-DD-topic` so lexical order is chronological. Inside a dossier:

1. `README.md` gives status, scope, and reading order.
2. `01-*` records observations/evidence.
3. `02-*` compares alternatives or states the proposal.
4. `03-*` records the decision/execution result.

Historical documents may mention APIs that no longer exist. Their folder README identifies what was implemented, superseded, or still pending.
