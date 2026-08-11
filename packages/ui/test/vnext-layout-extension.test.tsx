import { describe, expect, it } from "vitest";

import { Box, Text } from "@faux-ui/ui";
import {
  Layout,
  type LayoutEngine,
} from "@faux-ui/ui/layout";
import { renderStatic } from "@faux-ui/ui/testing";

describe("public layout extension", () => {
  it("allocates validated local child frames through the shared scene", () => {
    const engine: LayoutEngine = {
      preferred: () => ({ width: 7, height: 2 }),
      layout: ({ size, children }) => {
        expect(size).toEqual({ width: 7, height: 2 });
        expect(children).toEqual([
          { width: 3, height: 1 },
          { width: 3, height: 1 },
        ]);
        return {
          children: [
            { x: 0, y: 0, width: 3, height: 1 },
            { x: 4, y: 1, width: 3, height: 1 },
          ],
          contentSize: { width: 7, height: 2 },
        };
      },
    };
    const app = renderStatic(
      <Layout layout={engine}>
        <Box><Text>one</Text></Box>
        <Box><Text>two</Text></Box>
      </Layout>,
      { width: 7, height: 2 },
    );

    expect(app.getText()).toBe("one    \n    two");
    app.unmount();
  });

  it("rejects malformed extension geometry", () => {
    const missingFrame: LayoutEngine = {
      preferred: () => ({ width: 1, height: 1 }),
      layout: () => ({ children: [] }),
    };
    expect(() =>
      renderStatic(
        <Layout layout={missingFrame}><Text>x</Text></Layout>,
        { width: 1, height: 1 },
      )
    ).toThrow(/returned 0 frames for 1 children/u);

    const fractionalFrame: LayoutEngine = {
      preferred: () => ({ width: 1, height: 1 }),
      layout: () => ({
        children: [{ x: 0.5, y: 0, width: 1, height: 1 }],
      }),
    };
    expect(() =>
      renderStatic(
        <Layout layout={fractionalFrame}><Text>x</Text></Layout>,
        { width: 1, height: 1 },
      )
    ).toThrow(/layout child 0\.x must be a finite non-negative integer/u);
  });
});
