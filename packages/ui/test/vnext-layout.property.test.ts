import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { computeLayout, type LayoutNode } from "../src/internal/layout.js";
import {
  createBoxNode,
  createTextNode,
  replaceChildren,
} from "../src/internal/model.js";

describe("vNext layout properties", () => {
  it("allocates all-fraction rows exactly with deterministic integer frames", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 300 }),
        fc.integer({ min: 0, max: 5 }),
        fc.array(fc.integer({ min: 1, max: 20 }), {
          minLength: 1,
          maxLength: 12,
        }),
        (width, gap, weights) => {
          const root = createBoxNode(1, {
            axis: "row",
            tracks: weights.map((weight) => `${weight}fr` as const),
            gap,
          });
          replaceChildren(
            root,
            weights.map((_, index) =>
              createTextNode(index + 2, { text: `item-${index}` }),
            ),
          );
          const layout = computeLayout(root, { width, height: 7 });
          const gapCost = gap * Math.max(0, weights.length - 1);
          const allocated = layout.root.children.reduce(
            (total, child) => total + child.frame.width,
            0,
          );
          expect(allocated).toBe(Math.max(0, width - gapCost));
          assertIntegerGeometry(layout.root);
          expect(computeLayout(root, { width, height: 7 })).toEqual(layout);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("never creates negative or fractional nested geometry", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 120 }),
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 0, max: 8 }),
        fc.integer({ min: 0, max: 4 }),
        (width, height, padding, gap) => {
          const inner = createBoxNode(2, {
            axis: "column",
            tracks: ["auto", "1fr", 3],
            gap,
            padding,
            border: true,
          });
          replaceChildren(inner, [
            createTextNode(3, { text: "古" }),
            createTextNode(4, { text: "long text" }),
            createTextNode(5, { text: "👩‍💻" }),
          ]);
          const root = createBoxNode(1, { scroll: "both", padding, border: true });
          replaceChildren(root, [inner]);
          assertIntegerGeometry(computeLayout(root, { width, height }).root);
        },
      ),
      { numRuns: 500 },
    );
  });
});

function assertIntegerGeometry(node: LayoutNode): void {
  for (const rect of [node.frame, node.clip, node.contentFrame]) {
    for (const value of [rect.x, rect.y, rect.width, rect.height]) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  }
  expect(Number.isInteger(node.contentSize.width)).toBe(true);
  expect(Number.isInteger(node.contentSize.height)).toBe(true);
  expect(node.contentSize.width).toBeGreaterThanOrEqual(0);
  expect(node.contentSize.height).toBeGreaterThanOrEqual(0);
  node.children.forEach(assertIntegerGeometry);
}
