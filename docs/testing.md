# Testing and release gates

faux-ui treats logical parity and packed-consumer behavior as primary evidence. Screenshots are secondary.

## Behavior matrix

| Contract                                                                                                                                      | Primary coverage                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Unicode 17 extended grapheme boundaries                                                                                                       | `vnext-unicode-conformance.test.ts` against the complete official fixture            |
| ASCII/CJK/combining/emoji/control/tab widths                                                                                                  | `vnext-unicode.test.ts`                                                              |
| Fixed/auto/fraction allocation and overflow                                                                                                   | `vnext-kernel.test.ts`                                                               |
| Integer/non-negative/stable fraction geometry                                                                                                 | `vnext-layout.property.test.ts` (1,000 generated cases)                              |
| Public custom-layout geometry validation                                                                                                      | `vnext-layout-extension.test.tsx`                                                    |
| Standalone Grid placement, spans, implicit tracks, interaction, and `Text`/`ScrollView` composition                                           | `packages/grid/test/grid.test.tsx`                                                   |
| Randomized non-overlapping deterministic Grid auto-placement                                                                                  | `packages/grid/test/grid.property.test.tsx` (500 generated cases)                    |
| Border, ellipsis, clipping, continuation cells                                                                                                | `vnext-kernel.test.ts`                                                               |
| Compact text index metrics against the eager oracle                                                                                           | `vnext-text-store.test.tsx`                                                          |
| `TextSource` contract, snapshotting, structural sharing, errors, React updates, packed types                                                  | `vnext-text-source.test.tsx`, `public-api.typecheck.tsx`, `scripts/test-package.mjs` |
| Batched compatible source commits, mixed suffix rebuild, retained-history work bounds                                                         | `vnext-text-store.test.tsx`                                                          |
| Prepared-window bounds, eviction, cell-slot and glyph-payload accounting, work counters                                                       | `vnext-large-text-work.test.tsx`                                                     |
| Eager oracle for preferred trees, frames, extents, cells, ownership, offsets, event traces                                                    | `vnext-large-text-oracle.test.tsx`                                                   |
| Long-line overflow, alignment, Unicode, CRLF, and checkpoint reuse                                                                            | `vnext-large-text-rendering.test.tsx`                                                |
| Axis-specific `followEnd`                                                                                                                     | `vnext-scroll-follow-end.test.tsx`                                                   |
| Replacement invalidation, source release, mount cleanup, separate mounts                                                                      | `vnext-text-lifecycle.test.tsx`                                                      |
| Static, fake-TUI, and Chromium large-text parity                                                                                              | `vnext-large-text-host-parity.test.tsx`, `vnext-large-text-host-parity.pw.spec.ts`   |
| Stable-frame single scene pass, corrected follow-end scene, and hit testing                                                                   | `vnext-scene-reconciliation.test.tsx`                                                |
| Ordinary terminal row refresh without full-screen clears                                                                                      | `vnext-tui-refresh.test.ts`                                                          |
| Versioned benchmark fixture shapes, sizes, and update counts                                                                                  | `large-text-benchmark-v1.test.ts`                                                    |
| Benchmark inventory, counter checks, reference gate, and options                                                                              | `large-text-benchmark-v1-report.test.ts`                                             |
| Seed event-to-host-frame stage profile                                                                                                        | `seed-large-text-profile.pw.spec.ts`                                                 |
| Scroll as paint transform, not layout input                                                                                                   | `vnext-kernel.test.ts`                                                               |
| Focus, bubbling, global keys, activation, scroll, follow-end suspension/resume                                                                | `vnext-kernel.test.ts` and `vnext-react.test.ts`                                     |
| DOM/TUI logical command/scene/event parity                                                                                                    | `vnext-host-parity.test.ts`                                                          |
| Ordinary React state and restricted text nesting                                                                                              | `vnext-react.test.ts`                                                                |
| DOM fit/pixel conversion                                                                                                                      | `vnext-dom-spike.test.ts`                                                            |
| DOM wheel-notch/trackpad normalization                                                                                                        | `vnext-dom-spike.pw.spec.ts` in Chromium                                             |
| Grouped DOM projection, terminal-graphics font runs, exact fitting/background seams, and accessibility                                        | `vnext-dom-spike.pw.spec.ts` in Chromium                                             |
| Serious browser authoring/input/resize path                                                                                                   | `apps/example/test/example-dom.pw.spec.ts`                                           |
| Standalone Grid through the public DOM host                                                                                                   | `packages/grid/test/grid.pw.spec.ts`                                                 |
| Terminal input, ANSI, Unicode cursor anchoring, right-margin/autowrap safety, fake IO, cleanup                                                | `vnext-tui.test.ts`                                                                  |
| Public JSX exposes `Rows` / `Columns` and rejects HTML, named tracks, removed singular layouts, old style/hint props, and inert Box alignment | `public-api.typecheck.tsx` through `tsconfig.test.json`                              |
| Packed foundation tarball install/types/skill/plugin manifests/Bun/Vite/TUI                                                                   | `scripts/test-package.mjs`                                                           |
| Packed Grid + UI tarballs, source/skill/plugin manifests, public-import isolation, Bun/Vite/TUI                                               | `scripts/test-grid-package.mjs`                                                      |

## Commands

Typecheck package, example, unit tests, Playwright tests, and negative type assertions:

```bash
bun run typecheck
```

Run unit, conformance, property, React, and fake-host tests:

```bash
bun run test
```

Run real Chromium tests:

```bash
bun run test:browser
```

Run the external package gate:

```bash
bun run test:package
```

Build declarations/JavaScript and the production browser example:

```bash
bun run build
```

Run all release gates:

```bash
bun run check
```

## Large-text benchmark

`large-text-benchmark-v1` measures cold indexing and first frame, unchanged repaint, resize, midpoint and end scrolling on each axis, fixed-size line append, one growing line, and correlated segment replacement over the exact 100,000, 667,633, and 2,000,000-code-unit fixture sizes at a 120 by 30 viewport. Every update uses `TextSource`, and no report prints fixture or transcript content.

Run a diagnostic pass:

```bash
bun run benchmark
```

Diagnostic runs accept `--warmups=<count>`, `--runs=<count>`, `--only-size=<size>`, and `--build-mode=source|production`. They report `referenceGate.status: "diagnostic-only"` and never claim the reference gate.

Run the reference protocol from a clean command boundary:

```bash
bun install --frozen-lockfile
bun run build
bun run benchmark -- --reference --build-mode=production
```

The reference protocol requires a maintained physical, non-virtual machine, a supported operating system, stable Bun 1.4.0 or later, an unchanged frozen lockfile, and the production build. It runs three unrecorded warm-ups and five fresh-process measured runs over all three sizes with 100 samples per warm measurement. Wall-clock gates are both 667,633-code-unit cold medians at most 500 ms, every pooled 500-sample warm p95 at most 50 ms, and the maximum measured warm event-loop delay at most 100 ms. Deterministic counter checks also compare all three sizes.

The runner fails the reference gate and exits 1 for a narrowed protocol, a missing or duplicate matrix entry, the wrong sample count, an incomplete three-size counter result, a non-reference runtime, a virtual or unknown machine, an unsupported operating system, changed or unlocked dependencies, a source build, the wrong run counts, a repeated worker process, a mismatched worker environment, or any failed timing or counter check. `--reference --only-size=<size>` exits 1 before any worker starts. A result from another machine or protocol stays diagnostic and must not be described as a reference pass.

### Recorded reference environment

A reference run recorded on 2026-09-15 on the maintained physical machine passed every gate after the post-bump review changed renderer behavior. The full JSON report stays outside the repository, and this table records the environment and structural results. An earlier 2026-09-14 run covered the pre-review renderer before batched source reconciliation, the single scene pass, the single prepared-cell store, window intersection reuse, and terminal row refresh; this rerun covers the reviewed revision.

| Field                         | Value                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| Runtime                       | stable Bun 1.4.0                                                                      |
| Machine                       | AMD Ryzen 5 3600 6-Core Processor, 12 logical processors, 32,780,304 KiB memory       |
| Operating system              | CachyOS on Linux 7.2.4-3-cachyos, x86_64                                              |
| Virtualization                | `systemd-detect-virt` reports `none` (physical)                                       |
| Build                         | production (`bun run build`)                                                          |
| Lockfile                      | `bun.lock` SHA-256 `6a28b62df6261443b3f6294ad463d784776ef48c9d28f88963d79514b0de133b` |
| Protocol                      | three unrecorded warm-ups, five distinct fresh-process runs, all three fixture sizes  |
| Cold medians at 667,633       | 416.497 ms many-line, 403.466 ms single-line (gate 500 ms)                            |
| Worst pooled warm p95         | 21.190 ms (`correlated-replacement`, many-line, 2,000,000; gate 50 ms)                |
| Maximum warm event-loop delay | 44.202 ms (gate 100 ms)                                                               |
| Counters                      | all five deterministic checks passed across all three sizes                           |
| Gate                          | passed; every eligibility entry true, no inventory problems                           |

The fixture and report suites run in `bun run test`. Elapsed-time assertions stay out of ordinary tests; the reference protocol owns wall-clock gates.

CI installs the pinned Bun version and matching Playwright Chromium before running `bun run check`.

## Packed-consumer gate

`test-package.mjs` builds and packs `packages/ui`, then creates a clean temporary project which:

1. installs the tarball and React;
2. imports root, DOM, TUI, testing, and JSX runtime declarations;
3. typechecks a shared application and separate host entries with TypeScript 7;
4. bundles the DOM entry with Bun and Vite;
5. rejects `node:` and terminal-control markers in browser output;
6. executes the packed TUI entry with fake input/output under both Bun and Node;
7. verifies `@faux-ui/ui` is the only installed faux-ui package in the foundation-only fixture;
8. verifies the canonical `faux-ui` skill and synchronized Pi/Codex/Claude metadata.

`test-grid-package.mjs` separately packs both UI and Grid, installs them together as an external consumer, typechecks and bundles a spanning Grid, executes static/TUI paths, verifies the shipped source, canonical Agent Skill, and synchronized Pi/Codex/Claude metadata, and rejects every internal UI path or browser target leak.

Workspace source aliases therefore cannot hide a broken package manifest, peer boundary, missing skill/source artifact, internal import, or target leak.

## Adding behavior

A renderer-neutral behavior change needs, at minimum:

- a specification update;
- a pure kernel/controller test;
- DOM and TUI adapter coverage when input/projection changes;
- deterministic work counters or benchmark coverage when repeated work, memory bounds, or latency gates change;
- packed-consumer coverage when exports or dependencies change.

Unicode updates also require regenerated tables and the matching official conformance fixture. Public type changes require positive and negative assertions in the typecheck fixture.

## Test artifact policy

`test-results/`, `.playwright-mcp/`, loose logs, coverage, tarballs, and build output are ignored and must not be committed.
