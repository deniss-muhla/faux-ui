import {
  Grid,
  GridItem,
  repeat,
  type GridGap,
} from "@faux-ui/grid";
import { Box, ScrollView, Text, type Track } from "@faux-ui/ui";

const columns = [12, ...repeat(2, "1fr")] satisfies Track[];
const gap = { x: 1, y: 0 } satisfies GridGap;

const app = (
  <ScrollView axis="y">
    <Grid
      columns={columns}
      rows={[1, "1fr"]}
      gap={gap}
      border
    >
      <GridItem row={1} column={1} columnSpan={3} padding={{ x: 1 }}>
        <Text align={{ x: "center" }}>Header</Text>
      </GridItem>
      <GridItem row={2} column={1}><Text>Nav</Text></GridItem>
      <GridItem row={2} column={2} columnSpan={2}>
        <Box><Text>Main</Text></Box>
      </GridItem>
    </Grid>
  </ScrollView>
);
void app;

// @ts-expect-error Grid requires explicit columns.
const missingColumns = <Grid />;
// @ts-expect-error CSS strings are not accepted as track definitions.
const cssTrack = <Grid columns={["minmax(10, 1fr)"]}><Text>x</Text></Grid>;
// @ts-expect-error GridItem coordinates are numeric one-based lines.
const namedLine = <GridItem column="main"><Text>x</Text></GridItem>;
// @ts-expect-error Grid children must be semantic elements.
const rawGridText = <Grid columns={[1]}>raw</Grid>;
// @ts-expect-error GridItem is a container; text must use Text.
const rawItemText = <GridItem>raw</GridItem>;
// @ts-expect-error A no-axis GridItem accepts one semantic child.
const multipleItemChildren = <GridItem><Text>a</Text><Text>b</Text></GridItem>;
// @ts-expect-error GridItem is only a placement/container wrapper.
const itemTextAlign = <GridItem align={{ x: "end" }}><Text>x</Text></GridItem>;
// @ts-expect-error Scrolling composes through ScrollView.
const gridScroll = <Grid columns={[1]} scroll="y"><Text>x</Text></Grid>;
// @ts-expect-error Automatic placement has one source-ordered row flow.
const gridFlow = <Grid columns={[1]} flow="column" />;
// @ts-expect-error Grid does not expose CSS item-alignment aliases.
const cssAlignment = <Grid columns={[1]} justifyItems="center" />;
void missingColumns;
void cssTrack;
void namedLine;
void rawGridText;
void rawItemText;
void multipleItemChildren;
void itemTextAlign;
void gridScroll;
void gridFlow;
void cssAlignment;
