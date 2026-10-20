import { describe, expect, it, vi } from "vitest";

import { Button, Rows, ScrollView } from "../src/index.js";
import { InteractionController } from "../src/internal/controller.js";
import { computeLayout } from "../src/internal/layout.js";
import {
  createBoxNode,
  createTextNode,
  replaceChildren,
  updateBoxNode,
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

/** A one-row scrolling list whose last row carries the selection. */
function selectableList(rowCount: number, onScroll?: () => void): {
  root: BoxNode;
  rows: BoxNode[];
} {
  const rows: BoxNode[] = [];
  const children: SemanticNode[] = [];
  for (let index = 0; index < rowCount; index += 1) {
    const row = append(
      createBoxNode(index + 2, { selected: index === rowCount - 1 }),
      createTextNode(100 + index + 2, { text: `row${index}` }),
    );
    rows.push(row);
    children.push(row);
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

/** Moves the selection to one row, as a caller that keeps one choice would. */
function selectOnly(rows: BoxNode[], index: number): void {
  for (const [position, row] of rows.entries()) {
    updateBoxNode(row, { selected: position === index });
  }
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
    const changed = controller.update(
      root,
      layout,
      paintScene(root, layout, controller.snapshot()),
    );
    if (!changed) return;
    const corrected = computeLayout(root, size);
    controller.update(
      root,
      corrected,
      paintScene(root, corrected, controller.snapshot()),
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

describe("selection reveal inside a scrolling viewport", () => {
  it("reveals the selected row when the list first paints", () => {
    const { root } = selectableList(5);
    const { controller, sync, paintedRows } = createSession(root);

    sync();
    expect(controller.snapshot().offsets.get(1)).toEqual({ x: 0, y: 3 });
    expect(paintedRows()).toEqual(["row3", "row4"]);
    expect(controller.snapshot().focusedId).toBeNull();
  });

  it("reveals a selection that moves below the viewport without moving focus", () => {
    const { root, rows } = selectableList(5);
    selectOnly(rows, -1);
    const { controller, sync, paintedRows } = createSession(root);
    sync();
    expect(paintedRows()).toEqual(["row0", "row1"]);

    selectOnly(rows, 3);
    sync();
    expect(controller.snapshot().offsets.get(1)).toEqual({ x: 0, y: 2 });
    expect(paintedRows()).toEqual(["row2", "row3"]);
    expect(controller.snapshot().focusedId).toBeNull();
  });

  it("reveals upward with the smallest offset change that shows the selection", () => {
    const { root, rows } = selectableList(5);
    const { controller, sync, paintedRows } = createSession(root);
    sync();
    expect(paintedRows()).toEqual(["row3", "row4"]);

    selectOnly(rows, 1);
    sync();
    expect(controller.snapshot().offsets.get(1)).toEqual({ x: 0, y: 1 });
    expect(paintedRows()).toEqual(["row1", "row2"]);
  });

  it("leaves the offset and the scroll event alone when the selection is painted", () => {
    const onScroll = vi.fn();
    const { root, rows } = selectableList(5, onScroll);
    const { controller, sync } = createSession(root);
    sync();
    expect(controller.snapshot().offsets.get(1)).toEqual({ x: 0, y: 3 });
    const revealedEvents = onScroll.mock.calls.length;

    selectOnly(rows, 3);
    sync();
    expect(controller.snapshot().offsets.get(1)).toEqual({ x: 0, y: 3 });
    expect(onScroll.mock.calls.length).toBe(revealedEvents);
  });

  it("emits the scroll event a selection reveal causes", () => {
    const onScroll = vi.fn();
    const { root, rows } = selectableList(5, onScroll);
    const { controller, sync } = createSession(root);
    sync();
    const offsetOf = (call: unknown[]): unknown => {
      const event = call[0] as {
        previousOffset: { x: number; y: number };
        offset: { x: number; y: number };
        deltaY: number;
      };
      return [event.previousOffset, event.offset, event.deltaY];
    };
    expect(onScroll.mock.calls.map(offsetOf)).toEqual([
      [
        { x: 0, y: 0 },
        { x: 0, y: 3 },
        3,
      ],
    ]);
    expect(controller.snapshot().offsets.get(1)).toEqual({ x: 0, y: 3 });

    selectOnly(rows, 0);
    sync();
    expect(onScroll.mock.calls.map(offsetOf)).toEqual([
      [
        { x: 0, y: 0 },
        { x: 0, y: 3 },
        3,
      ],
      [
        { x: 0, y: 3 },
        { x: 0, y: 0 },
        -3,
      ],
    ]);
    expect(controller.snapshot().offsets.get(1)).toEqual({ x: 0, y: 0 });
  });

  it("leaves a viewport holding several selected controls where the caller scrolled it", () => {
    const onScroll = vi.fn();
    const { root, rows } = selectableList(5, onScroll);
    for (const row of rows) updateBoxNode(row, { selected: true });
    const { controller, sync, paintedRows } = createSession(root);

    sync();
    expect(controller.snapshot().offsets.get(1)).toBeUndefined();
    expect(paintedRows()).toEqual(["row0", "row1"]);
    expect(onScroll).not.toHaveBeenCalled();
  });

  it("reveals a selection through mounted buttons and repaints it", () => {
    const mount = new SemanticMount({ size: SHORT_VIEWPORT });
    const labels = ["row0", "row1", "row2", "row3", "row4"];
    const list = (selected: number) => (
      <ScrollView axis="y">
        <Rows tracks={labels.map(() => 1)}>
          {labels.map((label, index) => (
            <Button
              key={label}
              label={label}
              selected={index === selected}
              onPress={() => undefined}
            />
          ))}
        </Rows>
      </ScrollView>
    );
    mount.render(list(0));
    expect(sceneToText(mount.frame().scene).split("\n")[0]).toContain("row0");

    mount.rerender(list(4));
    expect([...mount.controller().snapshot().offsets.values()]).toEqual([
      { x: 0, y: 3 },
    ]);
    const lines = sceneToText(mount.frame().scene)
      .split("\n")
      .map((line) => line.trim());
    expect(lines).toEqual(["row3", "row4"]);
    expect(mount.controller().snapshot().focusedId).toBeNull();
    mount.unmount();
  });
});