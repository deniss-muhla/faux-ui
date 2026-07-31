# faux-ui agent notes

## Current reset

- The project is unreleased. Break and delete prototype APIs freely; do not add aliases, shims, deprecations, or migration work.
- `refactor/tui-first-reset` is the vNext implementation branch.
- The current multi-package source is behavioral reference, not a public compatibility contract.
- `/home/den/Source/g-calendar-cleanup` is a one-time evidence case study. Do not modify or upgrade it.

## Product boundary

- TUI semantics are canonical; DOM mirrors the same logical cell scene and interaction trace.
- Target one app-author package: `@faux-ui/ui` with isolated `/dom`, `/tui`, and `/testing` entrypoints.
- Keep React state and direct handlers ordinary. Do not introduce framework action registries, manual rerenders, public node IDs, or runtime bridges.
- Keep the initial public foundation small. Specialized tool layouts start as recipes.
- Do not resume generic renderer, compact schema, CLI, MCP, or editor work before the one-package TUI/DOM path passes its serious fixture.

## Documentation sources

Read these before implementation:

- [docs/strategy.md](docs/strategy.md): product choices and scope filter.
- [docs/spec.md](docs/spec.md): normative vNext behavior; it wins when semantics are unclear.
- [docs/refactor/report.md](docs/refactor/report.md): evidence and target architecture rationale.
- [docs/refactor/tasks.md](docs/refactor/tasks.md): ordered implementation checklist and acceptance criteria.
- [docs/refactor/analisis.md](docs/refactor/analisis.md): intermediate evidence and context-recovery checkpoints.
- [docs/roadmap.md](docs/roadmap.md): milestone status and current priority.
- [docs/architecture.md](docs/architecture.md): current implemented architecture only; update it as old layers are replaced.
- [docs/improvements.md](docs/improvements.md): unstructured small fixes only.

When making an important decision or completing a milestone, update the relevant docs in the same change.

## Implementation rules

- Preserve conceptual boundaries between reconciliation, semantic tree, preferred-size/layout, interaction controller, canonical scene, and host adapters even when they live in one package.
- The semantic engine always receives an explicit integer root size. Host fitting resolves that size before layout.
- Layout and text behavior must not depend on DOM child measurement or browser flow.
- Do not use JavaScript UTF-16 `string.length` as display-cell width.
- Base text does not auto-wrap. Shared scene code owns clipping/ellipsis.
- Prefer nested sequential rows/columns over general grids, named placement, or CSS-like negotiation.
- Gap, padding, border, and alignment are integer cell semantics.
- Paint borders, dividers, scroll chrome, focus, and text into one shared scene; hosts do not independently invent glyph output.
- Focus, press, key routing, pointer targeting, and scrolling belong to one renderer-neutral controller.
- DOM/TUI packages or entrypoints are host adapters only.
- Do not add caching until the serious fixture demonstrates a measured need.

## Public API rules

- Normal app code imports components/types from `@faux-ui/ui`.
- Browser entry code imports only `@faux-ui/ui/dom`.
- Terminal entry code imports only `@faux-ui/ui/tui`.
- Internal host tags, reconciler handles, semantic node IDs, layout nodes, and renderer adapters are not public app APIs.
- A public addition must have specified TUI behavior and cross-host scene/event tests.

## Verification

Run the smallest relevant check during implementation. Before completing a milestone, run from the workspace root:

```bash
bun run typecheck
bun run test
bun run build
```

As the new package harness lands, also require:

- packed-package clean install;
- typechecked consumer fixture;
- Bun and Vite browser bundles with no TUI/Node leakage;
- fake-terminal execution;
- cross-host scene and event-trace parity.

Tests must be typechecked; Vitest transpilation alone is not sufficient.
