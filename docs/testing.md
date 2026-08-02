# Testing and release gates

faux-ui treats logical parity and packed-consumer behavior as primary evidence. Screenshots are secondary.

## Behavior matrix

| Contract | Primary coverage |
| --- | --- |
| Unicode 17 extended grapheme boundaries | `vnext-unicode-conformance.test.ts` against the complete official fixture |
| ASCII/CJK/combining/emoji/control/tab widths | `vnext-unicode.test.ts` |
| Fixed/auto/fraction allocation and overflow | `vnext-kernel.test.ts` |
| Integer/non-negative/stable fraction geometry | `vnext-layout.property.test.ts` (1,000 generated cases) |
| Border, ellipsis, clipping, continuation cells | `vnext-kernel.test.ts` |
| Scroll as paint transform, not layout input | `vnext-kernel.test.ts` |
| Focus, bubbling, global keys, activation, scroll | `vnext-kernel.test.ts` and `vnext-react.test.ts` |
| DOM/TUI logical command/scene/event parity | `vnext-host-parity.test.ts` |
| Ordinary React state and restricted text nesting | `vnext-react.test.ts` |
| DOM fit/pixel conversion | `vnext-dom-spike.test.ts` |
| DOM wheel-notch/trackpad normalization | `vnext-dom-spike.pw.spec.ts` in Chromium |
| Grouped DOM projection, terminal-graphics font runs, exact fitting/background seams, and accessibility | `vnext-dom-spike.pw.spec.ts` in Chromium |
| Serious browser authoring/input/resize path | `apps/example/test/example-dom.pw.spec.ts` |
| Terminal input, ANSI, Unicode cursor anchoring, right-margin/autowrap safety, fake IO, cleanup | `vnext-tui.test.ts` |
| Public JSX exposes `Rows` / `Columns` and rejects HTML, named tracks, removed singular layouts, old style/hint props, and inert Box alignment | `public-api.typecheck.tsx` through `tsconfig.test.json` |
| Packed tarball install/types/Bun/Vite/TUI | `scripts/test-package.mjs` |

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

Re-run the uncached serious-fixture mount benchmark before adding caches:

```bash
bun run benchmark
```

The reset checkpoint measured roughly 5.5 ms per 100×30 fixture mount on the development machine; treat that number as a local baseline, not a cross-machine assertion.

CI installs the pinned Bun version and matching Playwright Chromium before running `bun run check`.

## Packed-consumer gate

`test-package.mjs` builds and packs `packages/ui`, then creates a clean temporary project which:

1. installs the tarball and React;
2. imports root, DOM, TUI, testing, and JSX runtime declarations;
3. typechecks a shared application and separate host entries with TypeScript 7;
4. bundles the DOM entry with Bun and Vite;
5. rejects `node:` and terminal-control markers in browser output;
6. executes the packed TUI entry with fake input/output under both Bun and Node;
7. verifies `@faux-ui/ui` is the only installed faux-ui package.

Workspace source aliases therefore cannot hide a broken package manifest or target leak.

## Adding behavior

A renderer-neutral behavior change needs, at minimum:

- a specification update;
- a pure kernel/controller test;
- DOM and TUI adapter coverage when input/projection changes;
- packed-consumer coverage when exports or dependencies change.

Unicode updates additionally require regenerated tables and the matching official conformance fixture. Public type changes require positive and negative assertions in the typecheck fixture.

## Test artifact policy

`test-results/`, `.playwright-mcp/`, loose logs, coverage, tarballs, and build output are ignored and must not be committed.
