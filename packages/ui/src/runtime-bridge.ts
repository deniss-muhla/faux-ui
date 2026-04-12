import type {
  ScrollOffset,
  ScrollAxis,
  Size,
  UINode,
  ViewNode,
} from "@faux-ui/core";
import type { ReactNode, RefObject } from "react";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
} from "react";
import type { UINodeHandle } from "@faux-ui/reconciler";

export interface UiRuntimeAdapter {
  getMountedNode(): UINode | null;
  getScrollOffset(nodeId: number): ScrollOffset | undefined;
  setScrollOffset(nodeId: number, offset: ScrollOffset): void;
}

export interface UiViewMetrics {
  nodeId: number;
  scroll: ScrollAxis | null;
  viewport: Size;
  content: Size;
  offset: ScrollOffset;
  maxOffset: ScrollOffset;
  overflow: {
    x: boolean;
    y: boolean;
    any: boolean;
  };
}

export interface UiRuntimeBridge {
  attach(adapter: UiRuntimeAdapter | null): void;
  subscribe(listener: () => void): () => void;
  notify(): void;
  getMountedNode(): UINode | null;
  getScrollOffset(nodeId: number): ScrollOffset | undefined;
  setScrollOffset(nodeId: number, offset: ScrollOffset): void;
  getViewMetrics(nodeId: number | null): UiViewMetrics | null;
}

export interface UiRuntimeProviderProps {
  bridge: UiRuntimeBridge;
  children?: ReactNode;
}

const UiRuntimeBridgeContext = createContext<UiRuntimeBridge | null>(null);

export function createUiRuntimeBridge(): UiRuntimeBridge {
  let adapter: UiRuntimeAdapter | null = null;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    attach(nextAdapter) {
      adapter = nextAdapter;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    notify,
    getMountedNode() {
      return adapter?.getMountedNode() ?? null;
    },
    getScrollOffset(nodeId) {
      return adapter?.getScrollOffset(nodeId);
    },
    setScrollOffset(nodeId, offset) {
      adapter?.setScrollOffset(nodeId, offset);
    },
    getViewMetrics(nodeId) {
      if (nodeId === null || adapter === null) {
        return null;
      }

      const node = findViewNodeById(adapter.getMountedNode(), nodeId);
      const viewport = node?.layout.cachedSize;

      if (node === null || viewport === undefined) {
        return null;
      }

      const content = node.layout.contentSize ?? viewport;
      const rawOffset = adapter.getScrollOffset(nodeId) ?? { x: 0, y: 0 };
      const maxOffset = {
        x:
          node.spec.scroll === "x" || node.spec.scroll === "both"
            ? Math.max(0, content.width - viewport.width)
            : 0,
        y:
          node.spec.scroll === "y" || node.spec.scroll === "both"
            ? Math.max(0, content.height - viewport.height)
            : 0,
      };
      const offset = {
        x: clampAxis(rawOffset.x, maxOffset.x),
        y: clampAxis(rawOffset.y, maxOffset.y),
      };

      return {
        nodeId,
        scroll: node.spec.scroll,
        viewport: { width: viewport.width, height: viewport.height },
        content: { width: content.width, height: content.height },
        offset,
        maxOffset,
        overflow: {
          x: maxOffset.x > 0,
          y: maxOffset.y > 0,
          any: maxOffset.x > 0 || maxOffset.y > 0,
        },
      };
    },
  };
}

export function UiRuntimeProvider(props: UiRuntimeProviderProps): ReactNode {
  return createElement(
    UiRuntimeBridgeContext.Provider,
    { value: props.bridge },
    props.children,
  );
}

export function useUiRuntimeBridge(): UiRuntimeBridge | null {
  return useContext(UiRuntimeBridgeContext);
}

export function useUiViewMetrics(
  target: RefObject<UINodeHandle | null>,
): UiViewMetrics | null {
  const bridge = useUiRuntimeBridge();
  const [metrics, setMetrics] = useState<UiViewMetrics | null>(null);
  const updateMetrics = useCallback(() => {
    const nextMetrics = bridge?.getViewMetrics(target.current?.id ?? null) ?? null;
    setMetrics((currentMetrics) =>
      sameViewMetrics(currentMetrics, nextMetrics) ? currentMetrics : nextMetrics,
    );
  }, [bridge, target]);

  useLayoutEffect(() => {
    updateMetrics();
    return bridge?.subscribe(updateMetrics);
  }, [bridge, updateMetrics]);

  return metrics;
}

function findViewNodeById(node: UINode | null, nodeId: number): ViewNode | null {
  if (node === null) {
    return null;
  }

  if (node.id === nodeId) {
    return node.kind === "view" ? node : null;
  }

  for (const child of node.children) {
    const match = findViewNodeById(child, nodeId);
    if (match !== null) {
      return match;
    }
  }

  return null;
}

function sameViewMetrics(
  left: UiViewMetrics | null,
  right: UiViewMetrics | null,
): boolean {
  if (left === right) {
    return true;
  }

  if (left === null || right === null) {
    return false;
  }

  return (
    left.nodeId === right.nodeId &&
    left.scroll === right.scroll &&
    sameSize(left.viewport, right.viewport) &&
    sameSize(left.content, right.content) &&
    sameOffset(left.offset, right.offset) &&
    sameOffset(left.maxOffset, right.maxOffset)
  );
}

function sameSize(left: Size, right: Size): boolean {
  return left.width === right.width && left.height === right.height;
}

function sameOffset(left: ScrollOffset, right: ScrollOffset): boolean {
  return left.x === right.x && left.y === right.y;
}

function clampAxis(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.trunc(value)));
}
