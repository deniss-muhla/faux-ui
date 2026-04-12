export { jsxDEV, Fragment } from "react/jsx-dev-runtime";

import type { JSX as ReactJSX, Ref } from "react";
import type { TextProps, UINodeHandle, ViewProps } from "@faux-ui/reconciler";

type ViewElementProps = ViewProps & { ref?: Ref<UINodeHandle> };
type TextElementProps = TextProps & { ref?: Ref<UINodeHandle> };

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
