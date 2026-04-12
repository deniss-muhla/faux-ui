// Re-export React's JSX runtime functions unchanged.  The custom JSX namespace
// below restricts intrinsic elements to the two faux-ui host types.

export { jsx, jsxs, Fragment } from "react/jsx-runtime";

import type { JSX as ReactJSX, Ref } from "react";
import type { TextProps, UINodeHandle, ViewProps } from "./index.js";

type ViewElementProps = ViewProps & { ref?: Ref<UINodeHandle> };
type TextElementProps = TextProps & { ref?: Ref<UINodeHandle> };

/**
 * Restricted JSX namespace for faux-ui.
 *
 * Internal packages can set `"jsxImportSource": "@faux-ui/reconciler"` in
 * their tsconfig. Public app code should use `@faux-ui/ui`, which re-exports
 * the same intrinsic restrictions. In both cases, only `<view>` and `<text>`
 * are accepted as host tags — standard HTML tags like `<div>` or `<span>`
 * become compile-time errors.
 */
export namespace JSX {
  export type Element = ReactJSX.Element;
  export type ElementType = ReactJSX.ElementType;

  export interface IntrinsicAttributes extends ReactJSX.IntrinsicAttributes {}

  export interface IntrinsicClassAttributes<
    T,
  > extends ReactJSX.IntrinsicClassAttributes<T> {}

  export interface ElementChildrenAttribute
    extends ReactJSX.ElementChildrenAttribute {}

  export interface IntrinsicElements {
    view: ViewElementProps;
    text: TextElementProps;
  }
}
