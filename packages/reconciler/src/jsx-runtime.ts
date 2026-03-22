// Re-export React's JSX runtime functions unchanged.  The custom JSX namespace
// below restricts intrinsic elements to the two faux-ui host types.

export { jsx, jsxs, Fragment } from "react/jsx-runtime";

import type { JSX as ReactJSX } from "react";
import type { ViewProps, TextProps } from "./index.js";

/**
 * Restricted JSX namespace for faux-ui.
 *
 * When consumers set `"jsxImportSource": "@faux-ui/reconciler"` in their
 * tsconfig, TypeScript resolves JSX types from this module instead of from
 * React's built-in JSX namespace. This means only `<view>` and `<text>` are
 * accepted as intrinsic tags — standard HTML tags like `<div>` or `<span>`
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
    view: ViewProps;
    text: TextProps;
  }
}
