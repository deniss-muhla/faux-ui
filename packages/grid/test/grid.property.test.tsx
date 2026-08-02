import { createElement } from "react";
import fc from "fast-check";
import { describe, it } from "vitest";

import { Text } from "@faux-ui/ui";
import { renderStatic } from "@faux-ui/ui/testing";
import { Grid, GridItem } from "@faux-ui/grid";

describe("Grid placement properties", () => {
  it("auto-places spans deterministically without overlap", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        fc.array(
          fc.record({
            columnSpan: fc.integer({ min: 1, max: 6 }),
            rowSpan: fc.integer({ min: 1, max: 3 }),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        (columnCount, rawItems) => {
          const items = rawItems.map((item) => ({
            columnSpan: Math.min(columnCount, item.columnSpan),
            rowSpan: item.rowSpan,
          }));
          const node = createElement(
            Grid,
            {
              columns: Array.from({ length: columnCount }, () => 2),
            },
            ...items.map((item, index) =>
              createElement(
                GridItem,
                { key: index, ...item },
                createElement(Text, null, String(index % 10)),
              ),
            ),
          );
          const size = {
            width: columnCount * 2,
            height: Math.max(1, items.length * 3),
          };
          const first = renderStatic(node, size);
          const firstFrames = first.getLayout().root.children.map(
            (child) => child.frame,
          );
          first.unmount();
          const second = renderStatic(node, size);
          const secondFrames = second.getLayout().root.children.map(
            (child) => child.frame,
          );
          second.unmount();

          if (JSON.stringify(firstFrames) !== JSON.stringify(secondFrames)) {
            throw new Error("Grid placement was not deterministic.");
          }
          for (const [index, frame] of firstFrames.entries()) {
            if (
              !Number.isInteger(frame.x) ||
              !Number.isInteger(frame.y) ||
              !Number.isInteger(frame.width) ||
              !Number.isInteger(frame.height) ||
              frame.x < 0 ||
              frame.y < 0 ||
              frame.width < 0 ||
              frame.height < 0
            ) {
              throw new Error(`Grid produced invalid frame ${index}.`);
            }
            for (let other = index + 1; other < firstFrames.length; other += 1) {
              const candidate = firstFrames[other];
              if (candidate !== undefined && overlaps(frame, candidate)) {
                throw new Error(`Auto-placed Grid items ${index} and ${other} overlap.`);
              }
            }
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});

function overlaps(
  a: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  b: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}
