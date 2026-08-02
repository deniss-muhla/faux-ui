import { describe, expect, it, vi } from "vitest";

import { ScrollView, Text } from "@faux-ui/ui";
import { renderStatic } from "@faux-ui/ui/testing";
import {
  Grid,
  GridItem,
  VERSION,
  repeat,
} from "@faux-ui/grid";

describe("@faux-ui/grid", () => {
  it("auto-places ordinary semantic children across shared tracks", () => {
    const app = renderStatic(
      <Grid columns={[4, "1fr", 3]} gap={{ x: 1 }}>
        <Text>A</Text>
        <Text>B</Text>
        <Text>C</Text>
        <Text>D</Text>
        <Text>E</Text>
        <Text>F</Text>
      </Grid>,
      { width: 15, height: 2 },
    );

    expect(app.getText()).toBe("A    B      C  \nD    E      F  ");
    expect(app.getLayout().root.children.map((child) => child.frame)).toEqual([
      { x: 0, y: 0, width: 4, height: 1 },
      { x: 5, y: 0, width: 6, height: 1 },
      { x: 12, y: 0, width: 3, height: 1 },
      { x: 0, y: 1, width: 4, height: 1 },
      { x: 5, y: 1, width: 6, height: 1 },
      { x: 12, y: 1, width: 3, height: 1 },
    ]);
    app.unmount();
  });

  it("flattens keyed fragments", () => {
    const app = renderStatic(
      <Grid columns={[2, 2]} rows={[1]}>
        <>
          <GridItem key="a"><Text>A</Text></GridItem>
          <GridItem key="b"><Text>B</Text></GridItem>
        </>
      </Grid>,
      { width: 4, height: 1 },
    );

    expect(app.getText()).toBe("A B ");
    app.unmount();
  });

  it("resolves auto tracks from Unicode-aware preferred content", () => {
    const app = renderStatic(
      <Grid columns={["auto", "1fr"]} rows={["auto"]}>
        <Text>古a</Text>
        <Text>rest</Text>
      </Grid>,
      { width: 10, height: 1 },
    );

    expect(app.getLayout().root.children.map((child) => child.frame)).toEqual([
      { x: 0, y: 0, width: 3, height: 1 },
      { x: 3, y: 0, width: 7, height: 1 },
    ]);
    app.unmount();
  });

  it("supports explicit placement and spans on both axes", () => {
    const app = renderStatic(
      <Grid columns={[3, 3, 3]} rows={[1, 2, 1]} gap={1}>
        <GridItem row={1} column={1} columnSpan={2}><Text>wide</Text></GridItem>
        <GridItem row={1} column={3}><Text>top</Text></GridItem>
        <GridItem row={2} column={1} rowSpan={2}><Text>tall</Text></GridItem>
        <GridItem row={2} column={2} columnSpan={2}><Text>body</Text></GridItem>
      </Grid>,
      { width: 11, height: 6 },
    );

    expect(app.getLayout().root.children.map((child) => child.frame)).toEqual([
      { x: 0, y: 0, width: 7, height: 1 },
      { x: 8, y: 0, width: 3, height: 1 },
      { x: 0, y: 2, width: 3, height: 4 },
      { x: 4, y: 2, width: 7, height: 2 },
    ]);
    app.unmount();
  });

  it("creates implicit auto columns for explicit placement", () => {
    const app = renderStatic(
      <Grid columns={[2]} rows={[1]}>
        <Text>A</Text>
        <GridItem row={1} column={2}><Text>CC</Text></GridItem>
      </Grid>,
      { width: 4, height: 1 },
    );

    expect(app.getLayout().root.children.map((child) => child.frame)).toEqual([
      { x: 0, y: 0, width: 2, height: 1 },
      { x: 2, y: 0, width: 2, height: 1 },
    ]);
    app.unmount();
  });

  it("allows deliberate overlap with later source items painting later", () => {
    const app = renderStatic(
      <Grid columns={[4]} rows={[1]}>
        <GridItem row={1} column={1}><Text>first</Text></GridItem>
        <GridItem row={1} column={1}><Text>last</Text></GridItem>
      </Grid>,
      { width: 4, height: 1 },
    );

    expect(app.getText()).toBe("last");
    app.unmount();
  });

  it("lets Text own alignment inside a stretched GridItem", () => {
    const app = renderStatic(
      <Grid columns={[5]} rows={[2]}>
        <GridItem><Text align={{ x: "end", y: "end" }}>x</Text></GridItem>
      </Grid>,
      { width: 5, height: 2 },
    );

    expect(app.getText()).toBe("     \n    x");
    app.unmount();
  });

  it("preserves ordinary Box handlers on GridItem", () => {
    const focus = vi.fn();
    const press = vi.fn();
    const app = renderStatic(
      <Grid columns={["1fr"]} rows={[1]}>
        <GridItem
          focusable
          onFocus={focus}
          onPress={press}
          accessibleLabel="Open row"
        >
          <Text>Open</Text>
        </GridItem>
      </Grid>,
      { width: 8, height: 1 },
    );

    app.keyDown({ key: "Tab" });
    app.keyDown({ key: "Enter" });
    expect(focus).toHaveBeenCalledTimes(1);
    expect(press).toHaveBeenCalledTimes(1);
    app.unmount();
  });

  it("composes with ScrollView instead of owning scrolling", () => {
    const app = renderStatic(
      <ScrollView axis="y">
        <Grid columns={["1fr"]} rows={[1, 1, 1]}>
          <Text>one</Text>
          <Text>two</Text>
          <Text>three</Text>
        </Grid>
      </ScrollView>,
      { width: 5, height: 2 },
    );

    expect(app.getText()).toBe("one  \ntwo  ");
    app.scroll({ x: 0, y: 0, deltaX: 0, deltaY: 1 });
    expect(app.getText()).toBe("two  \nthree");
    app.unmount();
  });

  it("fails early for malformed input and misuse", () => {
    expect(() =>
      renderStatic(<Grid columns={[]} />, { width: 1, height: 1 })
    ).toThrow(/non-empty track array/u);

    expect(() =>
      renderStatic(
        <Grid columns={[1]}><GridItem row={0}><Text>x</Text></GridItem></Grid>,
        { width: 1, height: 1 },
      )
    ).toThrow(/GridItem row must be a finite positive integer/u);

    expect(() =>
      renderStatic(<GridItem><Text>x</Text></GridItem>, { width: 1, height: 1 })
    ).toThrow(/direct child of Grid/u);

    expect(() =>
      renderStatic(
        <Grid columns={["0fr"] as never}><Text>x</Text></Grid>,
        { width: 1, height: 1 },
      )
    ).toThrow(/positive fraction/u);

    expect(() =>
      renderStatic(
        <Grid columns={[1]} children={"raw text" as never} />,
        { width: 1, height: 1 },
      )
    ).toThrow(/wrap text in <Text>/u);
  });

  it("repeats CSS-like track patterns", () => {
    expect(repeat(3, "1fr")).toEqual(["1fr", "1fr", "1fr"]);
    expect(repeat(2, [4, "1fr"])).toEqual([4, "1fr", 4, "1fr"]);
  });

  it("reports its independent package version", () => {
    expect(VERSION).toBe("0.1.0");
  });
});
