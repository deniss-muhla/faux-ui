# faux-ui Agent Notes

## Purpose

Use this file as the quick workspace instruction source when working in this repository.

## Project Docs

- Use [docs/roadmap.md](docs/roadmap.md) as the default source of next implementation steps unless the user gives a different priority.
- Use [docs/architecture.md](docs/architecture.md) to understand package boundaries, runtime layers, and the intended data flow.
- Use [docs/spec.md](docs/spec.md) when behavior or semantics are unclear; the spec wins over convenience.

## While Implementing

- Keep `@faux-ui/core` as the only source of semantic layout, render-tree, and dispatch rules.
- Do not move renderer-specific behavior into core unless it is truly renderer-neutral.
- Keep DOM and TUI packages as projections over shared core semantics.
- Prefer small, verifiable changes that preserve the current package boundaries.

## While Updating Docs

- Keep [docs/architecture.md](docs/architecture.md) descriptive and relatively stable.
- Put evolving delivery state, gaps, and milestone ordering in [docs/roadmap.md](docs/roadmap.md).
- When finishing a meaningful roadmap item or changing priorities, update [docs/roadmap.md](docs/roadmap.md).

## Verification

- Run the smallest relevant verification for the change.
- Use workspace commands from the root when broader validation is needed: `bun run typecheck`, `bun run test`, `bun run build`.