import { describe, expect, it } from "vitest";
import { isValidElement } from "react";
import { createViewNode } from "../../core/src/index.js";

import {
  AppShell,
  Button,
  Divider,
  Panel,
  createUiRuntimeBridge,
  defaultUiTheme,
  mergeUiTheme,
} from "../src/index.js";

describe("@faux-ui/ui", () => {
  it("merges nested theme overrides without dropping defaults", () => {
    const theme = mergeUiTheme({
      surface: { panel: "selection" },
    });

    expect(theme.surface.panel).toBe("selection");
    expect(theme.surface.canvas).toBe(defaultUiTheme.surface.canvas);
    expect(theme.action.focusBackground).toBe(
      defaultUiTheme.action.focusBackground,
    );
  });

  it("returns a renderer-neutral app shell element", () => {
    const node = AppShell({
      label: "ui",
      title: "Gallery",
      description: "Stable shell",
      footer: "No DOM-only layout rules.",
      children: null,
    });

    expect(isValidElement(node)).toBe(true);
  });

  it("creates an interactive button when a handler is provided", () => {
    const node = Button({
      label: "action",
      title: "Launch",
      description: "Stable action primitive",
      onPress: () => {},
    });

    expect(isValidElement(node)).toBe(true);
    expect(node?.props.focusable).toBe(true);
    expect(typeof node?.props.onPress).toBe("function");
  });

  it("drops focusability when the button is disabled", () => {
    const node = Button({
      title: "Disabled",
      description: "Not interactive",
      disabled: true,
      onPress: () => {},
    });

    expect(node?.props.focusable).toBe(false);
    expect(node?.props.onPress).toBeUndefined();
  });

  it("creates a panel element with optional slots", () => {
    const node = Panel({
      label: "surface",
      title: "Panel",
      description: "Card-like presentation",
      footer: "Shared surface package",
    });

    expect(isValidElement(node)).toBe(true);
    expect(node?.props.rows).toEqual([1, 1, 1, 1]);
  });

  it("makes a panel focusable when interactive", () => {
    const node = Panel({
      title: "Selectable panel",
      onPress: () => {},
      variant: "selected",
    });

    expect(node?.props.focusable).toBe(true);
    expect(typeof node?.props.onClick).toBe("function");
  });

  it("creates a divider element with the requested chrome variant", () => {
    const node = Divider({
      orientation: "vertical",
      variant: "dotted",
    });

    expect(isValidElement(node)).toBe(true);
    expect(node?.props.rows).toHaveLength(256);
  });

  it("derives mounted view metrics through the runtime bridge", () => {
    const root = createViewNode({
      spec: {
        scroll: "y",
      },
    });
    root.layout.cachedSize = { width: 12, height: 3 };
    root.layout.contentSize = { width: 12, height: 7 };

    const bridge = createUiRuntimeBridge();
    bridge.attach({
      getMountedNode: () => root,
      getScrollOffset: () => ({ x: 0, y: 2 }),
      setScrollOffset: () => {},
    });

    expect(bridge.getViewMetrics(root.id)).toEqual({
      nodeId: root.id,
      scroll: "y",
      viewport: { width: 12, height: 3 },
      content: { width: 12, height: 7 },
      offset: { x: 0, y: 2 },
      maxOffset: { x: 0, y: 4 },
      overflow: { x: false, y: true, any: true },
    });
  });
});
