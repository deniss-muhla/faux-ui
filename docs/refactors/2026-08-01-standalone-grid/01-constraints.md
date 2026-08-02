# Constraints

## Requested outcome

- Full table/CSS-grid-like two-axis layout.
- A separate package usable and publishable like an outside component library.
- A reference implementation for future component authors.
- A small end-user Agent Skill.
- No shortcut through UI internals.

## Why nested sequences were insufficient

A table without spans can be composed as `Rows` of repeated `Columns`. That shares source vocabulary but not a true two-axis layout engine.

Column span can sometimes merge fixed tracks, but it cannot preserve arbitrary mixed `auto`/fraction sizing and internal gaps. Row span cannot escape the clipping frame of its source row. General spans and overlap therefore cannot be implemented faithfully by wrappers alone.

A text-only pre-rendered table would permit geometry but lose semantic children, ordinary React state, focus, events, accessibility, and shared hit testing. Importing semantic nodes or internal layout functions would make the package impossible to publish safely against the public contract.

## Required extension boundary

An external layout component needs only:

1. preferred sizes of its semantic children;
2. the concrete content-frame size;
3. a way to return one local integer rectangle per child.

It does not need nodes, IDs, mutable trees, controller state, scenes, DOM, terminal IO, or host projectors.

That led to the narrow browser-safe `@faux-ui/ui/layout` contract. The shared engine still owns validation, ancestor clipping, recursive child layout, canonical painting, ownership, hit testing, scrolling, and host projection.

## Risks and controls

- **Host divergence:** callbacks receive and return cells only; both hosts consume the resulting canonical layout.
- **Invalid geometry:** frame count and every coordinate/size are checked at runtime.
- **Core expansion:** `Layout` lives on an advanced subpath and Grid remains outside root exports.
- **Internal coupling:** packed tests reject internal/source-path imports.
- **Speculative scope:** Grid deliberately omits CSS parsing, minmax, named lines, subgrid, masonry, sticky behavior, and virtualization.
