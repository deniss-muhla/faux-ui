# faux-ui agent notes

## Release status

- The repository contains an unreleased `@faux-ui/ui` 1.0 candidate; it has not been merged to `main`, tagged, or published.
- Public names may break before the first release. Follow the pending language decision in `docs/refactors/2026-08-01-api-language-review/` and do not add compatibility aliases.
- The current exports remain source truth until that decision is implemented end to end.
- The selected cutover retains components, tracks, `padding`, `gap`, `x` / `y`, `/dom`, and `/tui`; it only fixes `hotkey`, focus/hover style ordering, and ineffective `Box` alignment props. Do not add outer spacing.
- Do not reintroduce deleted prototype package names or compatibility aliases.
- `/home/den/Source/g-calendar-cleanup` is a historical one-time evidence case study. Do not modify or upgrade it.

## Product boundary

- TUI semantics are canonical; DOM mirrors the same logical cell scene and interaction trace.
- `@faux-ui/ui` is the only app-author package.
- Keep React state and direct handlers ordinary. Do not add action registries, manual rerenders, public node IDs, or user-wired runtime bridges.
- Keep the public foundation small. Specialized tool layouts begin as recipes.
- Generic renderer, schema, CLI, MCP, and editor surfaces require new real-use evidence and may not compromise the one-package host path.
- Prefer zero additional runtime dependencies. `react-reconciler` is the one required implementation dependency; justify any addition against an internal/platform implementation.

## Documentation authority

- [docs/README.md](docs/README.md): documentation map, status rules, and development timeline.
- [docs/spec.md](docs/spec.md): normative implemented behavior; it wins when semantics are unclear.
- [docs/architecture.md](docs/architecture.md): implemented package/modules/data flow.
- [docs/strategy.md](docs/strategy.md): product choices and scope filter.
- [docs/roadmap.md](docs/roadmap.md): release state and future candidates.
- [docs/testing.md](docs/testing.md): quality gates and behavior matrix.
- [docs/recipes.md](docs/recipes.md): higher-level UI compositions.
- [docs/refactors/2026-07-31-tui-first-reset/](docs/refactors/2026-07-31-tui-first-reset/README.md): implemented reset history.
- [docs/refactors/2026-08-01-api-language-review/](docs/refactors/2026-08-01-api-language-review/README.md): selected public-language/spacing direction; implementation pending.
- [docs/improvements.md](docs/improvements.md): unstructured small fixes only.

Update documentation in the same change when public behavior, architecture, release state, or commands change.

## Implementation rules

- Preserve boundaries between reconciliation, semantic tree, preferred size/layout, controller, canonical scene, and host adapters.
- The semantic engine always receives an explicit non-negative integer root size. Host fitting resolves it before layout.
- Layout/text must not depend on DOM flow, child measurement, Flexbox, Grid, or canvas text measurement.
- Never use UTF-16 `string.length` as display-cell width.
- Base text does not auto-wrap. Shared scene code owns clipping and ellipsis.
- Prefer nested sequential rows/columns over general grids, named placement, percentages, or CSS-like negotiation.
- Gap, padding, border, alignment, and scroll geometry are integer cell semantics.
- Paint glyphs, borders, dividers, focus/hover, and clipping once in the canonical scene.
- Focus, press, key routing, pointer targeting, hover, and scroll remain in one renderer-neutral controller.
- DOM/TUI entrypoints are thin projection/input/lifecycle adapters.
- Do not add caches before a reproducible benchmark demonstrates a bottleneck.

## Unicode

- Runtime Unicode behavior is dependency-free and pinned to generated Unicode 17.0.0 tables.
- Regenerate only with `bun run unicode:generate` and review the generated diff.
- A Unicode version/data change is semantic: update the spec, metadata constants, official conformance fixture, and golden width tests together.
- Keep ambiguous width narrow, four-cell tab stops, control replacement, and wide continuation behavior cross-host identical unless intentionally versioned.

## Public API rules

- Shared app code imports from `@faux-ui/ui`.
- During the pending naming cutover, replace old names directly; never retain dual exports, aliases, or deprecated props.
- Browser entry code imports only `@faux-ui/ui/dom`.
- Terminal entry code imports only `@faux-ui/ui/tui`.
- Tests inspect through `@faux-ui/ui/testing`.
- Internal host tags, reconciler instances, semantic IDs, mutable nodes, and host projectors are not public app APIs.
- A public addition needs specified TUI behavior, DOM parity, direct-handler types, and cross-host tests.
- Keep DOM imports browser-safe; packed Bun/Vite bundle checks must reject every `node:` leak.

## Verification

Run the smallest relevant check while editing. Before considering a change complete:

```bash
bun run typecheck
bun run test
bun run test:browser
bun run test:package
bun run build
```

Or run all gates:

```bash
bun run check
```

Tests are typechecked through `tsconfig.test.json`; transpile-only Vitest success is insufficient. Clean generated `test-results/` before committing if it was recreated.
