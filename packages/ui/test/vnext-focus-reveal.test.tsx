import { describe, expect, it, vi } from "vitest";

import { Box, Rows, ScrollView, Text } from "../src/index.js";
import { InteractionController } from "../src/internal/controller.js";
import { computeLayout } from "../src/internal/layout.js";
import {
  createBoxNode,
  createTextNode,
  replaceChildren,
  type BoxNode,
  type SemanticNode,
} from "../src/internal/model.js";
import { SemanticMount } from "../src/internal/mount.js";
import { paintScene, sceneToText } from "../src/internal/scene.js";

const SHORT_VIEWPORT = { width: 8, height: 2 };

function append(parent: BoxNode, ...children: SemanticNode[]): BoxNode {
  replaceChildren(parent, children);
  return parent;
}

/** A vertical scrolling list of focusable rows; node 1 is the viewport. */
function focusableList(
  rowCount: number,
  onScroll?: () => void,
): {
  root: BoxNode;
  rows: number[];
} {
  const rows: number[] = [];
  const children: SemanticNode[] = [];
  for (let index = 0; index < rowCount; index += 1) {
    const id = index + 2;
    rows.push(id);
    children.push(
      append(
        createBoxNode(id, { focusable: true }),
        createTextNode(100 + id, { text: `row${index}` }),
      ),
    );
  }
  const root = append(
    createBoxNode(1, {
      axis: "column",
      tracks: children.map(() => 1),
      scroll: "y",
      ...(onScroll === undefined ? {} : { onScroll }),
    }),
    ...children,
  );
  return { root, rows };
}

/** An outer scrolling list whose first child is a two-row fixed region. */
function outerListWithFixedRegion(
  outerScroll?: () => void,
  regionScroll?: () => void,
): { root: BoxNode; region: BoxNode } {
  const region = append(
    createBoxNode(2, {
      axis: "column",
      scroll: "y",
      ...(regionScroll === undefined ? {} : { onScroll: regionScroll }),
    }),
    createTextNode(102, { text: "sig0\nsig1" }),
  );
  const rows = createTextNode(103, { text: "row1\nrow2\nrow3\nrow4" });
  const root = append(
    createBoxNode(1, {
      axis: "column",
      tracks: [2, 4],
      scroll: "y",
      ...(outerScroll === undefined ? {} : { onScroll: outerScroll }),
    }),
    region,
    rows,
  );
  return { root, region };
}

/** An outer list containing an inner list that has its own overflow. */
function nestedLists(
  outerScroll?: () => void,
  innerScroll?: () => void,
): { root: BoxNode; inner: BoxNode } {
  const inner = append(
    createBoxNode(2, {
      axis: "column",
      scroll: "y",
      ...(innerScroll === undefined ? {} : { onScroll: innerScroll }),
    }),
    createTextNode(102, { text: "i0\ni1\ni2\ni3\ni4\ni5" }),
  );
  const outerRows = createTextNode(103, {
    text: "row1\nrow2\nrow3\nrow4\nrow5",
  });
  const root = append(
    createBoxNode(1, {
      axis: "column",
      tracks: [3, 5],
      scroll: "y",
      ...(outerScroll === undefined ? {} : { onScroll: outerScroll }),
    }),
    inner,
    outerRows,
  );
  return { root, inner };
}

function rowAt(rows: number[], index: number): number {
  const id = rows[index];
  if (id === undefined) throw new Error(`no list row at index ${index}`);
  return id;
}

function createSession(
  root: SemanticNode,
  size = SHORT_VIEWPORT,
): {
  controller: InteractionController;
  sync: () => void;
  paintedRows: () => string[];
} {
  const controller = new InteractionController();
  const sync = (): void => {
    const layout = computeLayout(root, size);
    controller.update(
      root,
      layout,
      paintScene(root, layout, controller.snapshot()),
    );
  };
  const paintedRows = (): string[] =>
    sceneToText(
      paintScene(root, computeLayout(root, size), controller.snapshot()),
    )
      .split("\n")
      .map((line) => line.trim());
  return { controller, sync, paintedRows };
}

describe("focus reveal inside a scrolling viewport", () => {
  it("reveals a focused row below a two-row viewport", () => {
    const { root, rows } = focusableList(5);
    const { controller, sync, paintedRows } = createSession(root);
    sync();

    expect(paintedRows()).toEqual(["row0", "row1"]);
    expect(controller.focus(rowAt(rows, 4))).toBe(true);
    expect(controller.snapshot().focusedId).toBe(rowAt(rows, 4));
    expect(controller.snapshot().offsets.get(1)).toEqual({ x: 0, y: 3 });

    sync();
    expect(paintedRows()).toEqual(["row3", "row4"]);
  });

  it("leaves the offset alone when the focused row is already visible", () => {
    const { root, rows } = focusableList(5);
    const { controller, sync } = createSession(root);
    sync();
    controller.focus(rowAt(rows, 4));
    expect(controller.snapshot().offsets.get(1)).toEqual({ x: 0, y: 3 });

    expect(controller.focus(rowAt(rows, 3))).toBe(true);
    expect(controller.snapshot().offsets.get(1)).toEqual({ x: 0, y: 3 });
  });

  it("emits the scroll event a reveal causes", () => {
    const onScroll = vi.fn();
    const { root, rows } = focusableList(5, onScroll);
    const { controller, sync } = createSession(root);
    sync();
    expect(onScroll).not.toHaveBeenCalled();

    expect(controller.focus(rowAt(rows, 4))).toBe(true);
    expect(onScroll).toHaveBeenCalledTimes(1);
    expect(
      onScroll.mock.calls.map((call) => {
        const event = call[0] as {
          previousOffset: { x: number; y: number };
          offset: { x: number; y: number };
          deltaX: number;
          deltaY: number;
        };
        return [event.previousOffset, event.offset, event.deltaX, event.deltaY];
      }),
    ).toEqual([[{ x: 0, y: 0 }, { x: 0, y: 3 }, 0, 3]]);

    // A focus that reveals nothing moves nothing, so it emits nothing.
    expect(controller.focus(rowAt(rows, 3))).toBe(true);
    expect(onScroll).toHaveBeenCalledTimes(1);
  });

  it("reveals each row while focus traversal walks past the viewport", () => {
    const { root, rows } = focusableList(5);
    const { controller, sync, paintedRows } = createSession(root);
    sync();

    for (let step = 0; step < rows.length; step += 1) {
      expect(controller.focusNext()).toBe(true);
      expect(controller.snapshot().focusedId).toBe(rowAt(rows, step));
    }
    expect(controller.snapshot().offsets.get(1)).toEqual({ x: 0, y: 3 });
    expect(paintedRows()).toEqual(["row3", "row4"]);
  });

  it("reveals upward with the smallest offset change that shows the row", () => {
    const { root, rows } = focusableList(5);
    const { controller, sync, paintedRows } = createSession(root);
    sync();
    controller.focus(rowAt(rows, 4));
    sync();

    expect(controller.focus(rowAt(rows, 1))).toBe(true);
    expect(controller.snapshot().offsets.get(1)).toEqual({ x: 0, y: 1 });
    expect(paintedRows()).toEqual(["row1", "row2"]);
  });

  it("keeps a control clipped by a fixed ancestor out of focus order", () => {
    const clipped = append(
      createBoxNode(2, { axis: "column", tracks: [1, 1, 1, 1] }),
      createBoxNode(3, { focusable: true }),
      createBoxNode(4, { focusable: true }),
      createBoxNode(5, { focusable: true }),
      createBoxNode(6, { focusable: true }),
    );
    const root = append(createBoxNode(1, {}), clipped);
    const { controller, sync } = createSession(root);
    sync();

    expect(controller.focus(6)).toBe(false);
    expect(controller.snapshot().focusedId).toBeNull();
    expect(controller.snapshot().offsets.size).toBe(0);
  });

  it("reveals a row through a mounted scroll view and repaints it", () => {
    const mount = new SemanticMount({ size: SHORT_VIEWPORT });
    mount.render(
      <ScrollView axis="y">
        <Rows tracks={[1, 1, 1, 1, 1]}>
          {["row0", "row1", "row2", "row3", "row4"].map((label) => (
            <Box focusable key={label}>
              <Text>{label}</Text>
            </Box>
          ))}
        </Rows>
      </ScrollView>,
    );

    expect(sceneToText(mount.frame().scene).split("\n")[1]).toContain("row1");
    for (let step = 0; step < 5; step += 1) mount.keyDown({ key: "Tab" });

    const offsets = mount.controller().snapshot().offsets;
    expect([...offsets.values()]).toEqual([{ x: 0, y: 3 }]);
    const lines = sceneToText(mount.frame().scene)
      .split("\n")
      .map((line) => line.trim());
    expect(lines).toEqual(["row3", "row4"]);
    mount.unmount();
  });
});

describe("wheel routing across nested scrolling regions", () => {
  it("hands the delta to the outer list when the inner region cannot move", () => {
    const outerScroll = vi.fn();
    const regionScroll = vi.fn();
    const { root } = outerListWithFixedRegion(outerScroll, regionScroll);
    const { controller, sync } = createSession(root);
    sync();

    expect(controller.scroll({ x: 1, y: 0, deltaX: 0, deltaY: 1 })).toEqual({
      handled: true,
      defaultPrevented: true,
    });
    expect(controller.snapshot().offsets.get(1)).toEqual({ x: 0, y: 1 });
    expect(controller.snapshot().offsets.has(2)).toBe(false);
    expect(outerScroll).toHaveBeenCalledTimes(1);
    expect(regionScroll).not.toHaveBeenCalled();
  });

  it("reports an unhandled wheel when no ancestor can move", () => {
    const { root } = outerListWithFixedRegion();
    const { controller, sync } = createSession(root);
    sync();

    expect(controller.scroll({ x: 1, y: 0, deltaX: 0, deltaY: -1 })).toEqual({
      handled: false,
      defaultPrevented: false,
    });
    expect(controller.snapshot().offsets.get(1)).toBeUndefined();
  });

  it("keeps a scrollable inner list consuming the wheel", () => {
    const { root } = nestedLists();
    const { controller, sync, paintedRows } = createSession(root);
    sync();

    expect(controller.scroll({ x: 1, y: 1, deltaX: 0, deltaY: 2 })).toEqual({
      handled: true,
      defaultPrevented: true,
    });
    expect(controller.snapshot().offsets.get(2)).toEqual({ x: 0, y: 2 });
    expect(controller.snapshot().offsets.has(1)).toBe(false);
    expect(paintedRows()).toEqual(["i2", "i3"]);
  });

  it("passes the remainder outward when the inner list consumes part of the wheel", () => {
    const outerScroll = vi.fn();
    const innerScroll = vi.fn();
    const { root } = nestedLists(outerScroll, innerScroll);
    const { controller, sync } = createSession(root);
    sync();

    controller.scroll({ x: 1, y: 1, deltaX: 0, deltaY: 2 });
    expect(controller.snapshot().offsets.get(2)).toEqual({ x: 0, y: 2 });
    expect(controller.snapshot().offsets.has(1)).toBe(false);

    // The inner list is one cell from its end, so it consumes one cell of the
    // two-cell wheel and the outer list receives the remaining cell.
    expect(controller.scroll({ x: 1, y: 1, deltaX: 0, deltaY: 2 })).toEqual({
      handled: true,
      defaultPrevented: true,
    });
    expect(controller.snapshot().offsets.get(2)).toEqual({ x: 0, y: 3 });
    expect(controller.snapshot().offsets.get(1)).toEqual({ x: 0, y: 1 });

    expect(
      innerScroll.mock.calls.map(
        (call) => (call[0] as { deltaY: number }).deltaY,
      ),
    ).toEqual([2, 1]);
    // Scroll events bubble, so the outer handler also sees the inner region's
    // dispatch. Its last call is the outer's own dispatch of the remainder.
    const remainder = outerScroll.mock.calls.at(-1)?.[0] as { deltaY: number };
    expect(remainder.deltaY).toBe(1);
  });

  it("reports an unhandled wheel once every ancestor is at its end", () => {
    const { root } = nestedLists();
    const { controller, sync } = createSession(root);
    sync();
    controller.scroll({ x: 1, y: 1, deltaX: 0, deltaY: 2 });
    controller.scroll({ x: 1, y: 1, deltaX: 0, deltaY: 9 });
    expect(controller.snapshot().offsets.get(2)).toEqual({ x: 0, y: 3 });
    expect(controller.snapshot().offsets.get(1)).toEqual({ x: 0, y: 6 });

    expect(controller.scroll({ x: 1, y: 1, deltaX: 0, deltaY: 1 })).toEqual({
      handled: false,
      defaultPrevented: false,
    });
  });
});
