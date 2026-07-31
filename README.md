# faux-ui

Terminal-first UI for agents, humans, and text-oriented tools—with a browser mirror.

## Status: unreleased architecture reset

The current source tree is the pre-refactor prototype. It proved deterministic cell layout and React authoring, but its package graph and public API are being replaced before the first release.

Do not treat existing package names or APIs as stable. No compatibility aliases or migration layer will be kept.

Start here:

- Product strategy: [docs/strategy.md](docs/strategy.md)
- vNext semantics: [docs/spec.md](docs/spec.md)
- Current implementation architecture: [docs/architecture.md](docs/architecture.md)
- Delivery milestones: [docs/roadmap.md](docs/roadmap.md)
- Refactor evidence: [docs/refactor/analisis.md](docs/refactor/analisis.md)
- Refactor recommendation: [docs/refactor/report.md](docs/refactor/report.md)
- Implementation tasks: [docs/refactor/tasks.md](docs/refactor/tasks.md)

## Product direction

faux-ui is being reset around one promise:

> Author a deterministic character-cell interface with React, run it in a terminal, and render the same logical cells and interactions in the browser.

The intended foundation is deliberately small:

- `Text`
- `Box`
- `Row` / `Column`
- `Fill` and its thin `Divider` convenience
- `ScrollView`
- `Button`
- shared key/focus handling
- one semantic palette

Higher-level app shells, panels, action bars, status surfaces, and split layouts should initially be compositions of that foundation.

## Target package experience

The refactor targets one public package with isolated host entrypoints:

```tsx
// Shared app
import { Box, Button, Column, Row, Text } from "@faux-ui/ui";
```

```tsx
// Browser entry
import { render } from "@faux-ui/ui/dom";
render(<App />, { fit: "viewport" });
```

```tsx
// Terminal entry
import { render } from "@faux-ui/ui/tui";
render(<App />);
```

The browser entry must not load terminal/Node code. Neither entry should require a runtime bridge, manual rerender, internal renderer package, or app CSS.

## Current prototype

The checked-in implementation currently contains shared core layout/render-tree logic, React reconciliation, DOM/TUI runtimes, schema/CLI experiments, and UI components. It is retained temporarily as behavioral reference while vNext is built.

See [docs/architecture.md](docs/architecture.md) for an accurate description of what exists today and [docs/refactor/report.md](docs/refactor/report.md) for what will replace it.

## Workspace commands

```bash
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run build
```

Combined type and unit checks:

```bash
bun run check
```

Production builds remain a separate required check:

```bash
bun run build
```

The current first-party browser builds still expose a known target-isolation warning; removing that is a vNext milestone, not an accepted release state.
