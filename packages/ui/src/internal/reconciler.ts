import { createContext, type ReactNode } from "react";
import Reconciler from "react-reconciler";
import {
  ConcurrentRoot,
  DefaultEventPriority,
} from "react-reconciler/constants.js";

import { INTERNAL_BOX_TYPE, INTERNAL_TEXT_TYPE } from "../components.js";
import {
  type BoxNode,
  type BoxSpec,
  type SemanticNode,
  type TextNode,
  type TextSpec,
  createBoxNode,
  createTextNode,
  replaceChildren,
  updateBoxNode,
  updateTextNode,
} from "./model.js";

export interface ReconcilerRoot {
  render(node: ReactNode): void;
  unmount(): void;
  getMountedNode(): SemanticNode | null;
}

export interface ReconcilerRootOptions {
  readonly onCommit?: () => void;
  readonly onRecoverableError?: (error: unknown) => void;
}

type Props = Record<string, unknown>;
type HostContext = { readonly insideText: boolean };
type RootContainer = {
  children: HostInstance[];
  readonly onCommit?: () => void;
  pendingError: unknown;
};
type HostParent = RootContainer | BoxInstance | TextInstance;
type BaseInstance<TNode extends SemanticNode> = {
  readonly node: TNode;
  parent: HostParent | null;
};
type BoxInstance = BaseInstance<BoxNode> & {
  readonly kind: "box";
  children: HostInstance[];
};
type TextInstance = BaseInstance<TextNode> & {
  readonly kind: "text";
  children: TextValueInstance[];
};
type HostInstance = BoxInstance | TextInstance;
type TextValueInstance = {
  readonly kind: "text-value";
  parent: TextInstance | null;
  text: string;
};
type ChildInstance = HostInstance | TextValueInstance;

const ROOT_CONTEXT: HostContext = { insideText: false };
const noop = (): void => {};
let currentUpdatePriority = DefaultEventPriority;

export function createReconcilerRoot(
  options: ReconcilerRootOptions = {},
): ReconcilerRoot {
  let nextNodeId = 1;
  const reconciler = Reconciler({
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
      context: HostContext,
    ): HostInstance {
      if (context.insideText) {
        throw new Error(`<${type}> cannot be nested inside <Text>.`);
      }
      if (type === INTERNAL_BOX_TYPE) {
        return {
          kind: "box",
          node: createBoxNode(nextNodeId++, props as BoxSpec),
          parent: null,
          children: [],
        };
      }
      if (type === INTERNAL_TEXT_TYPE) {
        return {
          kind: "text",
          node: createTextNode(nextNodeId++, props as TextSpec),
          parent: null,
          children: [],
        };
      }
      throw new Error(`Unsupported faux-ui element type: ${type}.`);
    },
    createTextInstance(
      text: string,
      _container: RootContainer,
      context: HostContext,
    ): TextValueInstance {
      if (!context.insideText) {
        throw new Error(`Text string ${JSON.stringify(text)} must be inside <Text>.`);
      }
      return { kind: "text-value", parent: null, text };
    },
    appendInitialChild(parent: HostInstance, child: ChildInstance): void {
      appendChild(parent, child);
    },
    appendChild(parent: HostInstance, child: ChildInstance): void {
      appendChild(parent, child);
    },
    appendChildToContainer(
      container: RootContainer,
      child: HostInstance,
    ): void {
      detach(child);
      child.parent = container;
      container.children.push(child);
    },
    insertBefore(
      parent: HostInstance,
      child: ChildInstance,
      before: ChildInstance,
    ): void {
      insertChild(parent, child, before);
    },
    insertInContainerBefore(
      container: RootContainer,
      child: HostInstance,
      before: HostInstance,
    ): void {
      detach(child);
      child.parent = container;
      insertAt(container.children, child, before);
    },
    removeChild(parent: HostInstance, child: ChildInstance): void {
      if (child.parent === parent) detach(child);
    },
    removeChildFromContainer(
      container: RootContainer,
      child: HostInstance,
    ): void {
      if (child.parent === container) detach(child);
    },
    clearContainer(container: RootContainer): boolean {
      for (const child of container.children) child.parent = null;
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
      _oldProps: Props,
      newProps: Props,
    ): void {
      if (type === INTERNAL_BOX_TYPE && instance.kind === "box") {
        updateBoxNode(instance.node, newProps as BoxSpec);
        syncBox(instance);
        return;
      }
      if (type === INTERNAL_TEXT_TYPE && instance.kind === "text") {
        updateTextNode(instance.node, newProps as TextSpec);
        syncText(instance);
        return;
      }
      throw new Error(`Invalid update for faux-ui element type: ${type}.`);
    },
    commitTextUpdate(
      instance: TextValueInstance,
      _oldText: string,
      newText: string,
    ): void {
      instance.text = newText;
      if (instance.parent !== null) syncText(instance.parent);
    },
    resetTextContent(instance: HostInstance): void {
      if (instance.kind === "text") {
        instance.children = [];
        syncText(instance);
      }
    },
    hideInstance(): void {},
    unhideInstance(): void {},
    hideTextInstance(instance: TextValueInstance): void {
      instance.text = "";
      if (instance.parent !== null) syncText(instance.parent);
    },
    unhideTextInstance(instance: TextValueInstance, text: string): void {
      instance.text = text;
      if (instance.parent !== null) syncText(instance.parent);
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
      return ROOT_CONTEXT;
    },
    getChildHostContext(
      parent: HostContext,
      type: string,
    ): HostContext {
      const insideText = type === INTERNAL_TEXT_TYPE;
      return parent.insideText === insideText ? parent : { insideText };
    },
    getPublicInstance(): null {
      return null;
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
    setCurrentUpdatePriority(priority: number): void {
      currentUpdatePriority = priority;
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
    rendererPackageName: "@faux-ui/ui",
    rendererVersion: "0.9.1",
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

  const container: RootContainer = {
    children: [],
    pendingError: null,
    ...(options.onCommit === undefined ? {} : { onCommit: options.onCommit }),
  };
  const captureError = (error: unknown): void => {
    container.pendingError = error;
    options.onRecoverableError?.(error);
  };
  const internal = reconciler as any;
  const fiberRoot = internal.createContainer(
    container,
    ConcurrentRoot,
    null,
    false,
    null,
    "",
    captureError,
    captureError,
    captureError,
    noop,
    null,
  );

  return {
    render(node: ReactNode): void {
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
    },
    unmount(): void {
      if (typeof internal.updateContainerSync === "function") {
        internal.updateContainerSync(null, fiberRoot, null, noop);
        internal.flushSyncWork?.();
      } else {
        internal.updateContainer(null, fiberRoot, null, noop);
      }
    },
    getMountedNode(): SemanticNode | null {
      if (container.children.length === 0) return null;
      if (container.children.length > 1) {
        throw new Error("A faux-ui application must have exactly one semantic root.");
      }
      return container.children[0]?.node ?? null;
    },
  };
}

function appendChild(parent: HostInstance, child: ChildInstance): void {
  if (parent.kind === "box") {
    assertHost(child);
    detach(child);
    child.parent = parent;
    parent.children.push(child);
    syncBox(parent);
    return;
  }
  assertTextValue(child);
  detach(child);
  child.parent = parent;
  parent.children.push(child);
  syncText(parent);
}

function insertChild(
  parent: HostInstance,
  child: ChildInstance,
  before: ChildInstance,
): void {
  if (parent.kind === "box") {
    assertHost(child);
    assertHost(before);
    detach(child);
    child.parent = parent;
    insertAt(parent.children, child, before);
    syncBox(parent);
    return;
  }
  assertTextValue(child);
  assertTextValue(before);
  detach(child);
  child.parent = parent;
  insertAt(parent.children, child, before);
  syncText(parent);
}

function detach(child: ChildInstance): void {
  const parent = child.parent;
  if (parent === null) return;
  if (isRoot(parent)) {
    remove(parent.children, child as HostInstance);
    child.parent = null;
    return;
  }
  if (parent.kind === "box") {
    remove(parent.children, child as HostInstance);
    child.parent = null;
    syncBox(parent);
    return;
  }
  remove(parent.children, child as TextValueInstance);
  child.parent = null;
  syncText(parent);
}

function syncBox(instance: BoxInstance): void {
  replaceChildren(
    instance.node,
    instance.children.map((child) => child.node),
  );
}

function syncText(instance: TextInstance): void {
  instance.node.text = instance.children.map((child) => child.text).join("");
}

function assertHost(child: ChildInstance): asserts child is HostInstance {
  if (child.kind === "text-value") {
    throw new Error("Raw strings must be rendered inside <Text>.");
  }
}

function assertTextValue(
  child: ChildInstance,
): asserts child is TextValueInstance {
  if (child.kind !== "text-value") {
    throw new Error("Only raw string/number children are allowed inside <Text>.");
  }
}

function insertAt<T>(array: T[], value: T, before: T): void {
  const index = array.indexOf(before);
  if (index < 0) array.push(value);
  else array.splice(index, 0, value);
}

function remove<T>(array: T[], value: T): void {
  const index = array.indexOf(value);
  if (index >= 0) array.splice(index, 1);
}

function isRoot(parent: HostParent): parent is RootContainer {
  return !("kind" in parent);
}
