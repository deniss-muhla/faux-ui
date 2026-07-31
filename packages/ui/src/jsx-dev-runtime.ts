export { Fragment, jsxDEV } from "react/jsx-dev-runtime";

import type { JSX as ReactJSX } from "react";

export namespace JSX {
  export type Element = ReactJSX.Element;
  export type ElementType = ReactJSX.ElementType;
  export interface IntrinsicAttributes extends ReactJSX.IntrinsicAttributes {}
  export interface IntrinsicClassAttributes<T>
    extends ReactJSX.IntrinsicClassAttributes<T> {}
  export interface ElementChildrenAttribute
    extends ReactJSX.ElementChildrenAttribute {}
  export type LibraryManagedAttributes<C, P> =
    ReactJSX.LibraryManagedAttributes<C, P>;
  export interface IntrinsicElements {}
}
