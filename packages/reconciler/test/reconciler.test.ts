import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";

import {
  createReconciler,
  createStatefulApp,
  TEXT_TYPE,
  VIEW_TYPE,
} from "../src/index.js";

describe("reconciler skeleton", () => {
  it("renders a single text root", () => {
    const reconciler = createReconciler();
    const root = reconciler.createRoot();

    root.render(createElement(TEXT_TYPE, null, "Hello"));

    const mounted = root.getMountedNode();
    expect(mounted?.kind).toBe("text");
    if (mounted?.kind === "text") {
      expect(mounted.spec.text).toBe("Hello");
      expect(mounted.spec.wrap).toBe(false);
    }
  });

  it("updates text content and view props on rerender", () => {
    const reconciler = createReconciler();
    const root = reconciler.createRoot();

    root.render(
      createElement(
        VIEW_TYPE,
        { columns: [3, 3] },
        createElement(TEXT_TYPE, { wrap: false }, "A"),
      ),
    );
    root.render(
      createElement(
        VIEW_TYPE,
        { columns: [4, 2], focusable: true },
        createElement(TEXT_TYPE, { wrap: true }, "AB"),
      ),
    );

    const mounted = root.getMountedNode();
    expect(mounted?.kind).toBe("view");
    if (mounted?.kind === "view") {
      expect(mounted.spec.columns).toEqual([4, 2]);
      expect(mounted.spec.focusable).toBe(true);
      expect(mounted.children[0]?.kind).toBe("text");
      const child = mounted.children[0];
      if (child?.kind === "text") {
        expect(child.spec.text).toBe("AB");
        expect(child.spec.wrap).toBe(true);
      }
    }
  });

  it("supports append, insert, remove, and reorder under a view", () => {
    const reconciler = createReconciler();
    const root = reconciler.createRoot();

    root.render(
      createElement(
        VIEW_TYPE,
        { rows: ["auto", "auto", "auto"] },
        createElement(TEXT_TYPE, { key: "a" }, "A"),
        createElement(TEXT_TYPE, { key: "c" }, "C"),
      ),
    );
    root.render(
      createElement(
        VIEW_TYPE,
        { rows: ["auto", "auto", "auto"] },
        createElement(TEXT_TYPE, { key: "a" }, "A"),
        createElement(TEXT_TYPE, { key: "b" }, "B"),
        createElement(TEXT_TYPE, { key: "c" }, "C"),
      ),
    );
    root.render(
      createElement(
        VIEW_TYPE,
        { rows: ["auto", "auto"] },
        createElement(TEXT_TYPE, { key: "c" }, "C"),
        createElement(TEXT_TYPE, { key: "a" }, "A"),
      ),
    );

    const mounted = root.getMountedNode();
    expect(mounted?.kind).toBe("view");
    if (mounted?.kind === "view") {
      expect(
        mounted.children.map((child) =>
          child.kind === "text" ? child.spec.text : "",
        ),
      ).toEqual(["C", "A"]);
    }
  });

  it("fires the commit callback after updates", () => {
    const onCommit = vi.fn();
    const reconciler = createReconciler();
    const root = reconciler.createRoot({ onCommit });

    root.render(createElement(TEXT_TYPE, null, "A"));
    root.render(createElement(TEXT_TYPE, null, "B"));
    root.unmount();

    expect(onCommit).toHaveBeenCalledTimes(3);
  });

  it("rejects raw text outside a text element", () => {
    const reconciler = createReconciler();
    const root = reconciler.createRoot();

    expect(() => {
      root.render(createElement(VIEW_TYPE, null, "Hello"));
    }).toThrow(/inside <text>/);
  });

  it("maps JSX wrapper props into host bindings", () => {
    const reconciler = createReconciler();
    const root = reconciler.createRoot();

    root.render(
      createElement(
        VIEW_TYPE,
        {
          columns: [4],
          onClick: "open-root",
          onDragStart: "drag-root-start",
          onDrag: "drag-root",
          focusable: true,
        },
        createElement(
          TEXT_TYPE,
          { onPress: "submit-child", onDragEnd: "drag-child-end", wrap: true },
          "AB",
        ),
      ),
    );

    const mounted = root.getMountedNode();
    expect(mounted?.kind).toBe("view");
    if (mounted?.kind === "view") {
      expect(mounted.bindings).toEqual({
        click: "open-root",
        dragStart: "drag-root-start",
        drag: "drag-root",
      });
      expect(mounted.children[0]?.kind).toBe("text");
      const child = mounted.children[0];
      if (child?.kind === "text") {
        expect(child.bindings).toEqual({
          press: "submit-child",
          dragEnd: "drag-child-end",
        });
        expect(child.spec.wrap).toBe(true);
      }
    }
  });

  it("drives reducer state through a stateful app controller", () => {
    const app = createStatefulApp({
      initialState: 1,
      initialViewState: { suffix: "A" },
      reduce(state: number, action: "increment") {
        return action === "increment" ? state + 1 : state;
      },
      render({ state, viewState }) {
        return createElement(
          TEXT_TYPE,
          null,
          `${String(state)}${viewState.suffix}`,
        );
      },
    });

    expect(app.getState()).toBe(1);
    expect(app.getMountedNode()?.kind).toBe("text");

    app.dispatch("increment");

    const mounted = app.getMountedNode();
    expect(app.getState()).toBe(2);
    expect(mounted?.kind).toBe("text");
    if (mounted?.kind === "text") {
      expect(mounted.spec.text).toBe("2A");
    }
  });

  it("updates view state independently of reducer state", () => {
    const app = createStatefulApp({
      initialState: 2,
      initialViewState: { suffix: "A" },
      reduce(state: number) {
        return state;
      },
      render({ state, viewState }) {
        return createElement(
          TEXT_TYPE,
          null,
          `${String(state)}${viewState.suffix}`,
        );
      },
    });

    app.updateViewState((current) => ({
      ...current,
      suffix: "B",
    }));

    const mounted = app.getMountedNode();
    expect(app.getViewState()).toEqual({ suffix: "B" });
    expect(mounted?.kind).toBe("text");
    if (mounted?.kind === "text") {
      expect(mounted.spec.text).toBe("2B");
    }
  });

  it("notifies subscribers after state changes and unmount", () => {
    const listener = vi.fn();
    const app = createStatefulApp({
      initialState: 1,
      initialViewState: { suffix: "A" },
      reduce(state: number, action: "increment") {
        return action === "increment" ? state + 1 : state;
      },
      render({ state, viewState }) {
        return createElement(
          TEXT_TYPE,
          null,
          `${String(state)}${viewState.suffix}`,
        );
      },
    });

    const unsubscribe = app.subscribe(listener);

    app.dispatch("increment");
    app.unmount();
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[0]?.[1]).toEqual({
      state: 2,
      viewState: { suffix: "A" },
    });
    expect(listener.mock.calls[1]?.[0]).toBeNull();
  });
});
