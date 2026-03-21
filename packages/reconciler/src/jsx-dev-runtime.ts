// Dev-mode counterpart of jsx-runtime.ts. Re-exports React's development JSX
// functions while sharing the restricted JSX namespace.

export { jsxDEV, Fragment } from "react/jsx-dev-runtime";

import type { JSX as ReactJSX } from "react";
import type { ViewProps, TextProps } from "./index.js";

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
