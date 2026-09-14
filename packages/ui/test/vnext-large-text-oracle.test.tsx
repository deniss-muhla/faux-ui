import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { Grid, GridItem } from "@faux-ui/grid";
import {
  Box,
  Columns,
  Rows,
  ScrollView,
  Text,
  type Align,
} from "@faux-ui/ui";
import { Layout, type LayoutEngine } from "@faux-ui/ui/layout";

import type { EventTraceEntry } from "../src/internal/controller.js";
import type {
  LayoutNode,
  LayoutResult,
  PreferredNode,
} from "../src/internal/layout.js";
import { SemanticMount } from "../src/internal/mount.js";
import type { Point, SemanticNode, Size } from "../src/internal/model.js";
import type { CellScene } from "../src/internal/scene.js";
import {
  EagerTextOracleSession,
  renderEagerTextOracle,
} from "./support/eager-text-oracle.js";

interface Fixture {
  readonly name: string;
  readonly node: ReactNode;
  readonly size: Size;
}

const diagonalLayout: LayoutEngine = {
  preferred(children) {
    return {
      width: Math.max(children[0]?.width ?? 0, 3 + (children[1]?.width ?? 0)),
      height: Math.max(children[0]?.height ?? 0, 2 + (children[1]?.height ?? 0)),
    };
  },
  layout() {
    return {
      children: [
        { x: 1, y: 1, width: 7, height: 2 },
        { x: 5, y: 3, width: 11, height: 3 },
      ],
      contentSize: { width: 18, height: 7 },
    };
  },
};

const textCases = [
  ["empty text", ""],
  ["trailing newline", "alpha\n"],
  ["CRLF", "alpha\r\nbeta\r\n"],
  ["many lines", Array.from({ length: 40 }, (_, index) => `line-${index}`).join("\n")],
  ["one long line", "0123456789".repeat(30)],
  ["CJK", "漢字かなカナ"],
  ["combining marks", "e\u0301 n\u0303 a\u0323\u0302"],
  ["emoji ZWJ sequence", "A👩‍💻B👨‍👩‍👧‍👦C"],
  ["regional indicators", "A🇺🇳B🇨🇦C"],
  ["tabs", "a\tb\t古"],
  ["controls", "a\u0001b\u0007c"],
  ["wide graphemes", "古😀界"],
] as const;

const overflowModes = [
  "clip",
  "ellipsis-start",
  "ellipsis-middle",
  "ellipsis-end",
] as const;
const alignments = ["start", "center", "end"] as const satisfies readonly Align[];

const fixtures: Fixture[] = [
  ...textCases.map(([name, text]) => ({
    name,
    node: <Text>{text}</Text>,
    size: { width: 13, height: 5 },
  })),
  ...overflowModes.map((overflow) => ({
    name: `overflow ${overflow}`,
    node: <Text overflow={overflow}>A古BCDEFGHIJ</Text>,
    size: { width: 7, height: 2 },
  })),
  ...alignments.flatMap((x) =>
    alignments.map((y) => ({
      name: `alignment ${x}/${y}`,
      node: <Text align={{ x, y }}>古x\ny</Text>,
      size: { width: 9, height: 5 },
    })),
  ),
  {
    name: "nested fixed auto and fraction tracks",
    node: (
      <Rows tracks={[2, "auto", "1fr"]} gap={1}>
        <Columns tracks={[4, "auto", "1fr"]} gap={1}>
          <Text>fixed</Text>
          <Text>古auto</Text>
          <Text align={{ x: "end" }}>fraction</Text>
        </Columns>
        <Box padding={{ x: 1 }}><Text>middle\nrow</Text></Box>
        <Columns tracks={["1fr", "2fr"]}>
          <Text>A</Text>
          <Text align={{ x: "center", y: "end" }}>B</Text>
        </Columns>
      </Rows>
    ),
    size: { width: 30, height: 10 },
  },
  {
    name: "Grid fixed auto fraction and spans",
    node: (
      <Grid columns={[4, "auto", "1fr"]} rows={[2, "auto", "1fr"]} gap={1}>
        <GridItem row={1} column={1} columnSpan={2}><Text>wide 古</Text></GridItem>
        <GridItem row={1} column={3}><Text align={{ x: "end" }}>right</Text></GridItem>
        <GridItem row={2} column={1} rowSpan={2}><Text>A\nB\nC</Text></GridItem>
        <GridItem row={2} column={2} columnSpan={2}><Text>body 👩‍💻</Text></GridItem>
      </Grid>
    ),
    size: { width: 24, height: 9 },
  },
  {
    name: "custom layout with nonzero child origins and content extent",
    node: (
      <Layout layout={diagonalLayout}>
        <Text>first</Text>
        <Text align={{ x: "end", y: "end" }}>古second</Text>
      </Layout>
    ),
    size: { width: 18, height: 7 },
  },
  {
    name: "horizontal scrolling",
    node: (
      <ScrollView axis="x">
        <Text align={{ x: "center", y: "end" }}>
          0123456789古👩‍💻-long-line
        </Text>
      </ScrollView>
    ),
    size: { width: 8, height: 3 },
  },
  {
    name: "vertical scrolling",
    node: (
      <ScrollView axis="y">
        <Text align={{ x: "end", y: "center" }}>
          {"first\nsecond\nthird\nfourth\nfifth"}
        </Text>
      </ScrollView>
    ),
    size: { width: 8, height: 2 },
  },
  {
    name: "two-axis scrolling",
    node: (
      <ScrollView axis="both">
        <Text>
          {"0123456789古👩‍💻-long-line\nsecond-wide-line\nthird"}
        </Text>
      </ScrollView>
    ),
    size: { width: 8, height: 2 },
  },
];

describe("pre-windowing eager text oracle", () => {
  it.each(fixtures)("matches preferred, layout, cells, and ownership for $name", ({ node, size }) => {
    const production = new SemanticMount({ size });
    production.render(node);
    const actual = production.frame();
    const expected = renderEagerTextOracle(actual.root, size);

    expect(observeFrame(actual.layout, actual.scene, new Map(), [])).toEqual(
      observeFrame(expected.layout, expected.scene, new Map(), []),
    );
    production.unmount();
  });

  it("matches nonzero horizontal and vertical offsets plus controller traces", () => {
    const handler = (): void => {};
    const size = { width: 8, height: 3 };
    const production = new SemanticMount({ size });
    production.render(
      <ScrollView
        axis="both"
        focusable
        accessibleLabel="viewport"
        onFocus={handler}
        onKeyDown={handler}
        onPointerEnter={handler}
        onPointerMove={handler}
        onPointerDown={handler}
        onPointerUp={handler}
        onScroll={handler}
      >
        <Text
          accessibleLabel="content"
          onPointerEnter={handler}
          onPointerMove={handler}
          onPointerDown={handler}
          onPointerUp={handler}
        >
          0123456789abcdefghij{"\n"}
          line-1-古-👩‍💻-tail{"\n"}
          line-2-🇺🇳-é-tail{"\n"}
          line-3-with-tab-\t-tail{"\n"}
          line-4-control-\u0001-tail{"\n"}
          line-5-final-tail
        </Text>
      </ScrollView>,
    );

    const root = production.frame().root;
    const content = child(root);
    const oracle = new EagerTextOracleSession(root, size);

    expect(production.setScrollOffset(root.id, { x: 3, y: 2 })).toBe(true);
    expect(oracle.setScrollOffset(root.id, { x: 3, y: 2 })).toBe(true);
    expect(production.focusNext()).toBe(true);
    expect(oracle.focusNext()).toBe(true);
    production.keyDown({ key: "ArrowRight" });
    oracle.keyDown("ArrowRight");
    production.pointerMove({ x: 1, y: 1 });
    oracle.pointerMove({ x: 1, y: 1 });
    production.pointerDown({ x: 1, y: 1, button: 0 });
    oracle.pointerDown({ x: 1, y: 1 });
    production.pointerUp({ x: 1, y: 1, button: 0 });
    oracle.pointerUp({ x: 1, y: 1 });
    production.scroll({ x: 1, y: 1, deltaX: 2, deltaY: 1 });
    oracle.scroll({ x: 1, y: 1 }, { x: 2, y: 1 });

    const actualSnapshot = production.controller().snapshot();
    const actualTrace = production.controller().eventTrace();
    expect(observeFrame(
      production.frame().layout,
      production.frame().scene,
      actualSnapshot.offsets,
      actualTrace,
    )).toEqual(observeFrame(
      oracle.layout,
      oracle.scene,
      oracle.controller.snapshot().offsets,
      oracle.controller.eventTrace(),
    ));
    expect([...actualSnapshot.offsets]).toEqual([[root.id, { x: 6, y: 3 }]]);
    expect(actualTrace).toEqual([
      { type: "focus", targetId: root.id, currentTargetId: root.id },
      { type: "keyDown", targetId: root.id, currentTargetId: root.id },
      { type: "pointerEnter", targetId: root.id, currentTargetId: root.id },
      { type: "pointerEnter", targetId: content.id, currentTargetId: content.id },
      { type: "pointerMove", targetId: content.id, currentTargetId: content.id },
      { type: "pointerMove", targetId: content.id, currentTargetId: root.id },
      { type: "pointerDown", targetId: content.id, currentTargetId: content.id },
      { type: "pointerDown", targetId: content.id, currentTargetId: root.id },
      { type: "pointerUp", targetId: content.id, currentTargetId: content.id },
      { type: "pointerUp", targetId: content.id, currentTargetId: root.id },
      { type: "scroll", targetId: root.id, currentTargetId: root.id },
    ]);
    production.unmount();
  });
});

function observeFrame(
  layout: LayoutResult,
  scene: CellScene,
  offsets: ReadonlyMap<number, Point>,
  eventTrace: readonly EventTraceEntry[],
) {
  return {
    preferred: observePreferred(layout.preferred),
    allocatedFrames: flattenLayout(layout.root).map(({ nodeId, kind, frame, clip }) => ({
      nodeId,
      kind,
      frame,
      clip,
    })),
    contentExtents: flattenLayout(layout.root).map(({ nodeId, contentFrame, contentSize }) => ({
      nodeId,
      contentFrame,
      contentSize,
    })),
    canonicalCells: scene.cells.map(({ glyph, continuation, style }) => ({
      glyph,
      continuation,
      style,
    })),
    ownership: scene.cells.map((cell) => cell.ownerId),
    offsets: [...offsets].toSorted(([left], [right]) => left - right),
    eventTrace: [...eventTrace],
  };
}

function observePreferred(node: PreferredNode): unknown {
  return {
    nodeId: node.nodeId,
    kind: node.kind,
    size: node.size,
    children: node.children.map(observePreferred),
  };
}

function flattenLayout(root: LayoutNode): LayoutNode[] {
  return [root, ...root.children.flatMap(flattenLayout)];
}

function child(root: SemanticNode): SemanticNode {
  if (root.kind !== "box" || root.children[0] === undefined) {
    throw new Error("Expected the scroll fixture to have one child.");
  }
  return root.children[0];
}
