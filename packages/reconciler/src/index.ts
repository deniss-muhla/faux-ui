import { createContext, createElement, type Key, type ReactNode } from "react";
import Reconciler from "react-reconciler";
import {
  ConcurrentRoot,
  DefaultEventPriority,
} from "react-reconciler/constants.js";
import {
  type ActionIdentifier,
  type ActivationEvent,
  type FocusEvent,
  type KeyEvent,
  type PointerEvent,
  type ScrollEvent,
  createTextNode,
  createViewNode,
  replaceChildren,
  setNodeBindings,
  updateTextNode,
  updateViewNode,
  type BoundActions,
  type NodeId,
  type NormalizedTextSpec,
  type NormalizedViewSpec,
  type ScrollAxis,
  type StyleValue,
  type TextNode,
  type TrackShorthand,
  type UINode,
  type ViewNode,
} from "@faux-ui/core";

export interface ReconcilerOptions {
  debug?: boolean;
  onRecoverableError?: (error: unknown) => void;
}

export interface RootOptions {
  identifierPrefix?: string;
  onCommit?: () => void;
}

export interface UINodeHandle {
  readonly id: number;
  readonly kind: "view" | "text";
}

export type EventBindingValue<TEvent = unknown> =
  | ActionIdentifier
  | ((event: TEvent) => void);

export interface EventBindingProps {
  onFocus?: EventBindingValue<FocusEvent>;
  onBlur?: EventBindingValue<FocusEvent>;
  onKeyDown?: EventBindingValue<KeyEvent>;
  onKeyUp?: EventBindingValue<KeyEvent>;
  onPress?: EventBindingValue<ActivationEvent>;
  onClick?: EventBindingValue<PointerEvent>;
  onMouseDown?: EventBindingValue<PointerEvent>;
  onMouseUp?: EventBindingValue<PointerEvent>;
  onMouseEnter?: EventBindingValue<PointerEvent>;
  onMouseLeave?: EventBindingValue<PointerEvent>;
  onMouseMove?: EventBindingValue<PointerEvent>;
  onDragStart?: EventBindingValue<PointerEvent>;
  onDrag?: EventBindingValue<PointerEvent>;
  onDragEnd?: EventBindingValue<PointerEvent>;
  onScroll?: EventBindingValue<ScrollEvent>;
}

export interface ViewProps extends EventBindingProps {
  key?: Key | null;
  rows?: TrackShorthand[] | null;
  columns?: TrackShorthand[] | null;
  scroll?: ScrollAxis | null;
  style?: StyleValue | null;
  styleHover?: StyleValue | null;
  styleFocus?: StyleValue | null;
  focusable?: boolean;
  bindings?: BoundActions | null;
  children?: ReactNode;
}

export interface TextProps extends EventBindingProps {
  key?: Key | null;
  wrap?: boolean;
  style?: StyleValue | null;
  bindings?: BoundActions | null;
  children?: ReactNode;
}

export interface FauxRoot {
  render(node: ReactNode): void;
  unmount(): void;
  getChildren(): readonly UINode[];
  getMountedNode(): UINode | null;
}

export interface FauxReconciler {
  createRoot(options?: RootOptions): FauxRoot;
}

export const VIEW_TYPE = "view";
export const TEXT_TYPE = "text";

export function View(props: ViewProps): ReactNode {
  return createElement(VIEW_TYPE, props);
}

export function Text(props: TextProps): ReactNode {
  return createElement(TEXT_TYPE, props);
}

type Props = Record<string, unknown>;

type HostContext = {
  isInsideText: boolean;
};

type RootContainer = {
  children: HostInstance[];
  debug: boolean;
  identifierPrefix: string;
  onCommit?: () => void;
  pendingError: unknown;
};

type HostParent = RootContainer | ViewInstance | TextInstance;

type BaseInstance<TNode extends UINode, TKind extends "view" | "text"> = {
  kind: TKind;
  node: TNode;
  handle: UINodeHandle;
  parent: HostParent | null;
};

type ViewInstance = BaseInstance<ViewNode, "view"> & {
  children: HostInstance[];
};

type TextInstance = BaseInstance<TextNode, "text"> & {
  children: TextValueInstance[];
};

type HostInstance = ViewInstance | TextInstance;

type TextValueInstance = {
  kind: "text-value";
  parent: TextInstance | null;
  text: string;
};

type ChildInstance = HostInstance | TextValueInstance;

const NO_CONTEXT: HostContext = { isInsideText: false };
const noop = (): void => {};
const BINDING_PROP_NAMES = {
  onFocus: "focus",
  onBlur: "blur",
  onKeyDown: "keyDown",
  onKeyUp: "keyUp",
  onPress: "press",
  onClick: "click",
  onMouseDown: "mouseDown",
  onMouseUp: "mouseUp",
  onMouseEnter: "mouseEnter",
  onMouseLeave: "mouseLeave",
  onMouseMove: "mouseMove",
  onDragStart: "dragStart",
  onDrag: "drag",
  onDragEnd: "dragEnd",
  onScroll: "scroll",
} as const satisfies Record<keyof EventBindingProps, keyof BoundActions>;

let currentUpdatePriority = DefaultEventPriority;

function createInternalReconciler(options: ReconcilerOptions) {
  return Reconciler({
    isPrimaryRenderer: false,
    warnsIfNotActing: false,
    supportsMutation: true,
    supportsPersistence: false,
    supportsHydration: false,
    supportsMicrotasks: true,
    scheduleMicrotask: queueMicrotask,
    noTimeout: -1,
    scheduleTimeout: setTimeout,
    cancelTimeout: clearTimeout,
    createInstance(
      type: string,
      props: Props,
      _container: RootContainer,
      hostContext: HostContext,
    ): HostInstance {
      return createHostInstance(type, props, hostContext);
    },
    createTextInstance(
      text: string,
      _container: RootContainer,
      hostContext: HostContext,
    ): TextValueInstance {
      if (!hostContext.isInsideText) {
        throw new Error(
          `Text string \"${text}\" must be rendered inside <text>.`,
        );
      }

      return {
        kind: "text-value",
        parent: null,
        text,
      };
    },
    appendInitialChild(parent: HostInstance, child: ChildInstance): void {
      appendChildInstance(parent, child);
    },
    appendChild(parent: HostInstance, child: ChildInstance): void {
      appendChildInstance(parent, child);
    },
    appendChildToContainer(
      container: RootContainer,
      child: HostInstance,
    ): void {
      appendChildToContainerInstance(container, child);
    },
    insertBefore(
      parent: HostInstance,
      child: ChildInstance,
      beforeChild: ChildInstance,
    ): void {
      insertBeforeInstance(parent, child, beforeChild);
    },
    insertInContainerBefore(
      container: RootContainer,
      child: HostInstance,
      beforeChild: HostInstance,
    ): void {
      insertBeforeContainerInstance(container, child, beforeChild);
    },
    removeChild(parent: HostInstance, child: ChildInstance): void {
      removeChildInstance(parent, child);
    },
    removeChildFromContainer(
      container: RootContainer,
      child: HostInstance,
    ): void {
      removeChildFromContainerInstance(container, child);
    },
    clearContainer(container: RootContainer): boolean {
      container.children = [];
      return false;
    },
    finalizeInitialChildren(): boolean {
      return false;
    },
    commitMount(): void {},
    commitUpdate(
      instance: HostInstance,
      type: string,
      oldProps: Props,
      newProps: Props,
    ): void {
      commitHostUpdate(instance, type, oldProps, newProps);
    },
    commitTextUpdate(
      textInstance: TextValueInstance,
      _oldText: string,
      newText: string,
    ): void {
      textInstance.text = newText;
      if (textInstance.parent !== null) {
        syncTextChildren(textInstance.parent);
      }
    },
    resetTextContent(instance: HostInstance): void {
      if (instance.kind === "text") {
        instance.children = [];
        syncTextChildren(instance);
      }
    },
    hideInstance(): void {},
    unhideInstance(): void {},
    hideTextInstance(textInstance: TextValueInstance): void {
      textInstance.text = "";
      if (textInstance.parent !== null) {
        syncTextChildren(textInstance.parent);
      }
    },
    unhideTextInstance(textInstance: TextValueInstance, text: string): void {
      textInstance.text = text;
      if (textInstance.parent !== null) {
        syncTextChildren(textInstance.parent);
      }
    },
    shouldSetTextContent(): boolean {
      return false;
    },
    prepareForCommit(): null {
      return null;
    },
    resetAfterCommit(container: RootContainer): void {
      container.onCommit?.();
    },
    preparePortalMount(): null {
      return null;
    },
    getRootHostContext(): HostContext {
      return NO_CONTEXT;
    },
    getChildHostContext(
      parentHostContext: HostContext,
      type: string,
    ): HostContext {
      const isInsideText = type === TEXT_TYPE;
      if (parentHostContext.isInsideText === isInsideText) {
        return parentHostContext;
      }

      return { isInsideText };
    },
    getPublicInstance(instance: HostInstance): UINodeHandle {
      return instance.handle;
    },
    beforeActiveInstanceBlur(): void {},
    afterActiveInstanceBlur(): void {},
    detachDeletedInstance(): void {},
    prepareScopeUpdate(): void {},
    getInstanceFromNode(): null {
      return null;
    },
    getInstanceFromScope(): null {
      return null;
    },
    getCurrentUpdatePriority(): number {
      return currentUpdatePriority;
    },
    setCurrentUpdatePriority(newPriority: number): void {
      currentUpdatePriority = newPriority;
    },
    resolveUpdatePriority(): number {
      return currentUpdatePriority;
    },
    maySuspendCommit(): false {
      return false;
    },
    preloadInstance(): true {
      return true;
    },
    suspendInstance(): void {},
    startSuspendingCommit(): null {
      return null;
    },
    waitForCommitToBeReady(): null {
      return null;
    },
    shouldAttemptEagerTransition(): false {
      return false;
    },
    requestPostPaintCallback(): void {},
    trackSchedulerEvent(): void {},
    resolveEventType(): null {
      return null;
    },
    resolveEventTimeStamp(): number {
      return -1.1;
    },
    maySuspendCommitOnUpdate(): false {
      return false;
    },
    maySuspendCommitInSyncRender(): false {
      return false;
    },
    NotPendingTransition: null,
    HostTransitionContext: createContext(null) as never,
    resetFormInstance(): void {},
    rendererPackageName: "@faux-ui/reconciler",
    rendererVersion: "0.1.0",
    applyViewTransitionName(): void {},
    restoreViewTransitionName(): void {},
    cancelViewTransitionName(): void {},
    cancelRootViewTransitionName(): void {},
    restoreRootViewTransitionName(): void {},
    createViewTransitionInstance(): null {
      return null;
    },
    createFragmentInstance(): null {
      return null;
    },
    updateFragmentInstanceFiber(): void {},
    commitNewChildToFragmentInstance(): void {},
    deleteChildFromFragmentInstance(): void {},
    measureClonedInstance(): null {
      return null;
    },
    cloneMutableInstance(instance: HostInstance): HostInstance {
      return instance;
    },
    cloneMutableTextInstance(instance: TextValueInstance): TextValueInstance {
      return instance;
    },
    cloneRootViewTransitionContainer(): null {
      return null;
    },
    removeRootViewTransitionClone(): void {},
    getCurrentGestureOffset(): number {
      return 0;
    },
    startGestureTransition(): null {
      return null;
    },
    stopViewTransition(): void {},
    startViewTransition(): null {
      return null;
    },
    stopGestureTransition(): void {},
    getSuspendedCommitReason(): null {
      return null;
    },
    suspendOnActiveViewTransition(): void {},
    supportsResources: false,
    supportsSingletons: false,
  } as never);
}

export function createReconciler(
  options: ReconcilerOptions = {},
): FauxReconciler {
  const reconciler = createInternalReconciler(options);

  return {
    createRoot(rootOptions: RootOptions = {}): FauxRoot {
      const containerInfo: RootContainer = {
        children: [],
        debug: options.debug ?? false,
        identifierPrefix: rootOptions.identifierPrefix ?? "",
        pendingError: null,
        ...(rootOptions.onCommit !== undefined
          ? { onCommit: rootOptions.onCommit }
          : {}),
      };

      const captureError = (error: unknown): void => {
        containerInfo.pendingError = error;
        options.onRecoverableError?.(error);
      };

      const fiberRoot = (reconciler as any).createContainer(
        containerInfo,
        ConcurrentRoot,
        null,
        false,
        null,
        containerInfo.identifierPrefix,
        captureError,
        captureError,
        captureError,
        noop,
        null,
      );

      return {
        render(node: ReactNode): void {
          updateContainer(reconciler, fiberRoot, containerInfo, node);
        },
        unmount(): void {
          updateContainer(reconciler, fiberRoot, containerInfo, null);
        },
        getChildren(): readonly UINode[] {
          return containerInfo.children.map((child) => child.node);
        },
        getMountedNode(): UINode | null {
          return containerInfo.children.length === 1
            ? (containerInfo.children[0]?.node ?? null)
            : null;
        },
      };
    },
  };
}

function updateContainer(
  reconciler: ReturnType<typeof createInternalReconciler>,
  fiberRoot: unknown,
  container: RootContainer,
  node: ReactNode,
): void {
  const internal = reconciler as any;
  container.pendingError = null;

  try {
    if (typeof internal.updateContainerSync === "function") {
      internal.updateContainerSync(node, fiberRoot, null, noop);
      internal.flushSyncWork?.();
    } else {
      internal.updateContainer(node, fiberRoot, null, noop);
    }
  } finally {
    if (container.pendingError !== null) {
      const error = container.pendingError;
      container.pendingError = null;
      throw error;
    }
  }
}

function createHostInstance(
  type: string,
  props: Props,
  hostContext: HostContext,
): HostInstance {
  if (type === VIEW_TYPE) {
    if (hostContext.isInsideText) {
      throw new Error("<view> cannot be nested inside <text>.");
    }

    const node = createViewNode({
      bindings: readBindings(props),
      spec: readInitialViewSpec(props),
    });

    return {
      kind: "view",
      node,
      handle: createHandle(node.id, node.kind),
      parent: null,
      children: [],
    };
  }

  if (type === TEXT_TYPE) {
    if (hostContext.isInsideText) {
      throw new Error("Nested <text> elements are not supported yet.");
    }

    const node = createTextNode({
      bindings: readBindings(props),
      spec: {
        text: "",
        style: readStyle(props),
      },
    });

    return {
      kind: "text",
      node,
      handle: createHandle(node.id, node.kind),
      parent: null,
      children: [],
    };
  }

  throw new Error(`Unsupported faux-ui element type: ${type}`);
}

function appendChildInstance(parent: HostInstance, child: ChildInstance): void {
  if (parent.kind === "view") {
    assertHostInstance(child, parent);
    detachChild(child);
    child.parent = parent;
    parent.children.push(child);
    syncViewChildren(parent);
    return;
  }

  assertTextValueInstance(child, parent);
  detachChild(child);
  child.parent = parent;
  parent.children.push(child);
  syncTextChildren(parent);
}

function appendChildToContainerInstance(
  container: RootContainer,
  child: HostInstance,
): void {
  detachChild(child);
  child.parent = container;
  container.children.push(child);
}

function insertBeforeInstance(
  parent: HostInstance,
  child: ChildInstance,
  beforeChild: ChildInstance,
): void {
  if (parent.kind === "view") {
    assertHostInstance(child, parent);
    assertHostInstance(beforeChild, parent);
    detachChild(child);
    child.parent = parent;
    insertAt(parent.children, child, beforeChild);
    syncViewChildren(parent);
    return;
  }

  assertTextValueInstance(child, parent);
  assertTextValueInstance(beforeChild, parent);
  detachChild(child);
  child.parent = parent;
  insertAt(parent.children, child, beforeChild);
  syncTextChildren(parent);
}

function insertBeforeContainerInstance(
  container: RootContainer,
  child: HostInstance,
  beforeChild: HostInstance,
): void {
  detachChild(child);
  child.parent = container;
  insertAt(container.children, child, beforeChild);
}

function removeChildInstance(parent: HostInstance, child: ChildInstance): void {
  if (child.parent !== parent) {
    return;
  }

  detachChild(child);
}

function removeChildFromContainerInstance(
  container: RootContainer,
  child: HostInstance,
): void {
  if (child.parent !== container) {
    return;
  }

  detachChild(child);
}

function detachChild(child: ChildInstance): void {
  const parent = child.parent;
  if (parent === null) {
    return;
  }

  if (isRootContainer(parent)) {
    removeFromArray(parent.children, child as HostInstance);
    child.parent = null;
    return;
  }

  if (parent.kind === "view") {
    removeFromArray(parent.children, child as HostInstance);
    child.parent = null;
    syncViewChildren(parent);
    return;
  }

  removeFromArray(parent.children, child as TextValueInstance);
  child.parent = null;
  syncTextChildren(parent);
}

function syncViewChildren(parent: ViewInstance): void {
  replaceChildren(
    parent.node,
    parent.children.map((child) => child.node),
  );
}

function syncTextChildren(parent: TextInstance): void {
  updateTextNode(parent.node, {
    text: parent.children.map((child) => child.text).join(""),
  });
}

function commitHostUpdate(
  instance: HostInstance,
  type: string,
  oldProps: Props,
  newProps: Props,
): void {
  if (type === VIEW_TYPE) {
    if (instance.kind !== "view") {
      throw new Error("Received a view update for a non-view instance.");
    }

    updateViewNode(instance.node, buildViewPatch(oldProps, newProps));
    setNodeBindings(instance.node, readBindings(newProps));
    return;
  }

  if (type === TEXT_TYPE) {
    if (instance.kind !== "text") {
      throw new Error("Received a text update for a non-text instance.");
    }

    updateTextNode(instance.node, buildTextPatch(oldProps, newProps));
    setNodeBindings(instance.node, readBindings(newProps));
    return;
  }

  throw new Error(`Unsupported faux-ui element type: ${type}`);
}

function buildViewPatch(
  oldProps: Props,
  newProps: Props,
): Partial<NormalizedViewSpec> {
  return {
    ...(oldProps.rows !== newProps.rows
      ? { rows: readTrackList(newProps.rows) }
      : {}),
    ...(oldProps.columns !== newProps.columns
      ? { columns: readTrackList(newProps.columns) }
      : {}),
    ...(oldProps.scroll !== newProps.scroll
      ? { scroll: readScroll(newProps.scroll) }
      : {}),
    ...(oldProps.style !== newProps.style
      ? { style: readStyle(newProps) }
      : {}),
    ...(oldProps.styleHover !== newProps.styleHover
      ? { styleHover: readNamedStyle(newProps.styleHover) }
      : {}),
    ...(oldProps.styleFocus !== newProps.styleFocus
      ? { styleFocus: readNamedStyle(newProps.styleFocus) }
      : {}),
    ...(oldProps.focusable !== newProps.focusable
      ? { focusable: readFocusable(newProps) }
      : {}),
  };
}

function buildTextPatch(
  oldProps: Props,
  newProps: Props,
): Partial<NormalizedTextSpec> {
  return {
    ...(oldProps.style !== newProps.style
      ? { style: readStyle(newProps) }
      : {}),
  };
}

function readInitialViewSpec(props: Props): Partial<NormalizedViewSpec> {
  return {
    rows: readTrackList(props.rows),
    columns: readTrackList(props.columns),
    scroll: readScroll(props.scroll),
    style: readStyle(props),
    styleHover: readNamedStyle(props.styleHover),
    styleFocus: readNamedStyle(props.styleFocus),
    focusable: readFocusable(props),
  };
}

function readTrackList(value: unknown): TrackShorthand[] | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (!Array.isArray(value)) {
    throw new Error("Track props must be arrays of track shorthands.");
  }

  return [...(value as TrackShorthand[])];
}

function readScroll(value: unknown): ScrollAxis | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (value === "x" || value === "y" || value === "both") {
    return value;
  }

  throw new Error(`Unsupported scroll axis: ${String(value)}`);
}

function readStyle(props: Props): StyleValue | null {
  return readNamedStyle(props.style);
}

function readNamedStyle(value: unknown): StyleValue | null {
  if (value === undefined || value === null) {
    return null;
  }

  return value as StyleValue;
}

function readFocusable(props: Props): boolean {
  return props.focusable === true;
}

function readBindings(props: Props): BoundActions | null {
  const explicitBindings = readExplicitBindings(props.bindings);
  const mergedBindings: BoundActions =
    explicitBindings === null ? {} : explicitBindings;

  for (const [propName, bindingName] of Object.entries(
    BINDING_PROP_NAMES,
  ) as Array<
    [
      keyof typeof BINDING_PROP_NAMES,
      (typeof BINDING_PROP_NAMES)[keyof typeof BINDING_PROP_NAMES],
    ]
  >) {
    const token = props[propName];
    if (token === undefined) {
      continue;
    }

    if (!isBoundAction(token)) {
      throw new Error(
        `${String(propName)} must be a non-empty string action identifier or event handler function.`,
      );
    }

    mergedBindings[bindingName] = token;
  }

  return Object.keys(mergedBindings).length === 0 ? null : mergedBindings;
}

function createHandle(id: NodeId, kind: "view" | "text"): UINodeHandle {
  return { id, kind };
}

function assertHostInstance(
  child: ChildInstance,
  parent: ViewInstance,
): asserts child is HostInstance {
  if (child.kind === "text-value") {
    throw new Error(
      `Text string \"${child.text}\" must be rendered inside <text>, not under view ${parent.node.id}.`,
    );
  }
}

function assertTextValueInstance(
  child: ChildInstance,
  parent: TextInstance,
): asserts child is TextValueInstance {
  if (child.kind !== "text-value") {
    throw new Error(
      `Only raw text children are supported inside <text> for now; received <${child.kind}> under text ${parent.node.id}.`,
    );
  }
}

function insertAt<T>(array: T[], child: T, beforeChild: T): void {
  const index = array.indexOf(beforeChild);
  if (index === -1) {
    array.push(child);
    return;
  }

  array.splice(index, 0, child);
}

function removeFromArray<T>(array: T[], child: T): void {
  const index = array.indexOf(child);
  if (index !== -1) {
    array.splice(index, 1);
  }
}

function isRootContainer(parent: HostParent): parent is RootContainer {
  return !("kind" in parent);
}

function readExplicitBindings(value: unknown): BoundActions | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("bindings must be an object when provided.");
  }

  const next: BoundActions = {};
  for (const [bindingName, action] of Object.entries(value as BoundActions)) {
    if (action === undefined) {
      continue;
    }

    if (!isBoundAction(action)) {
      throw new Error(
        `bindings.${bindingName} must be a non-empty string action identifier or event handler function.`,
      );
    }

    next[bindingName as keyof BoundActions] = action;
  }

  return Object.keys(next).length === 0 ? null : next;
}

function isBoundAction(
  value: unknown,
): value is BoundActions[keyof BoundActions] {
  return (
    (typeof value === "string" && value.length > 0) ||
    typeof value === "function"
  );
}
