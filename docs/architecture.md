# faux-ui Architecture Notes

This note captures the current implementation shape so a fresh chat can recover useful context quickly.

## Repository State

- Package manager: Bun
- Language/tooling: TypeScript project references + Vitest
- Primary packages in active use:
  - `@faux-ui/core`
  - `@faux-ui/reconciler`
  - `@faux-ui/dom`
  - `@faux-ui/tui`
  - `@faux-ui/schema`

## Core Model

`@faux-ui/core` is the semantic source of truth.

- `UINode` is the mutable semantic/layout tree used by reconciliation and caching.
- Layout is cached by constraints plus subtree revision.
- Paint invalidation is tracked separately with `dirtyPaint` and now bubbles to ancestors.
- Scroll offset is render-phase state, not layout state.

## Render Tree

The render tree sits above layout output and below renderers.

- Built with `buildRenderTree()`.
- Stores absolute frames, clip rects, content size, and render-phase scroll offsets.
- Fully clipped descendants are omitted. The render tree is intentionally visible-only.
- Hit testing is done against render nodes with `hitTestRenderTree()` and returns a path for bubbling.
- Render-tree rebuilds are cached behind paint dirtiness, subtree revision, constraints, and scroll offsets.

## Event Dispatch

Core event helpers operate on render hits.

- `collectDispatchActions()` walks the render-hit path from target outward.
- `dispatchBindingAtPoint()` combines hit testing and bubbling action collection.
- `resolveFocusTarget()` and `resolveFocusTargetAtPoint()` pick the nearest focusable view in the hit path.
- Binding tokens in core are numeric.

## Reconciler

`@faux-ui/reconciler` currently provides the first working React bridge.

- Custom renderer host types are `"view"` and `"text"`.
- Public JSX-facing wrappers are `View` and `Text`.
- Wrapper props support shorthand binding props like `onClick`, `onPress`, `onKeyDown`, and so on.
- Shorthand binding props are converted into core `bindings` tokens during reconciliation.
- Raw text is allowed only inside `Text`.
- The root API currently exposes:
  - `createReconciler()`
  - `createRoot()`
  - `root.render()`
  - `root.unmount()`
  - `root.getChildren()`
  - `root.getMountedNode()`

## DOM Renderer

`@faux-ui/dom` now covers both model projection and a first live mounting runtime.

- `renderToDomModel()` projects the shared render tree into absolute-positioned DOM model nodes.
- `mountDomRoot()` turns the DOM model into live nodes inside a host container and preserves render-phase scroll semantics.
- `dispatchDomBinding()` maps DOM-space coordinates into core dispatch actions.
- `resolveDomFocusTarget()` resolves the focus target from DOM-space coordinates.
- The mounting runtime tracks focusable nodes, routes browser-style pointer and keyboard input into binding dispatch, and leaves token handling application-owned.
- DOM tests include structural snapshots plus live mounting and input-routing coverage.

## TUI Renderer

`@faux-ui/tui` is a framebuffer renderer.

- `renderToFrameBuffer()` paints from the shared render tree.
- `dispatchTuiBinding()` maps cell coordinates into core dispatch actions.
- `resolveTuiFocusTarget()` resolves the focus target from cell coordinates.
- TUI tests include framebuffer snapshots.

## Schema

`@faux-ui/schema` already has readable validation plus compact encode/decode support.

## Verified Commands

- `bun run typecheck`
- `bun run vitest run packages/reconciler/test/reconciler.test.ts packages/core/test/ui-node.test.ts packages/core/test/layout.test.ts packages/core/test/render-tree.test.ts packages/core/test/events.test.ts packages/dom/test/dom.test.ts packages/tui/test/tui.test.ts`

## Recommended Next Steps

1. Add a TUI interaction loop for keyboard, focus, pointer, and scroll input.
2. Define the application-side action dispatch contract for binding tokens.
3. Add browser-level visual regression on top of the DOM mounting layer.
4. Expand DOM runtime coverage for hover transitions, wheel-to-scroll state updates, and external focus synchronization.