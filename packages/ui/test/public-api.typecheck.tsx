import * as Ui from "@faux-ui/ui";
import {
  appendTextSourceSegment,
  Box,
  Button,
  Columns,
  createTextSource,
  extendTextSourceSegment,
  lineCellWidth,
  replaceTextSourceSegment,
  Rows,
  ScrollView,
  splitGraphemes,
  Text,
  type TextSource,
  type TextSourceSegment,
  type Track,
} from "@faux-ui/ui";
import { render as renderDom } from "@faux-ui/ui/dom";
import { Layout, type LayoutEngine } from "@faux-ui/ui/layout";
import {
  inspectTextSource,
  renderStatic,
  type TextSourceInspection,
} from "@faux-ui/ui/testing";
import { render as renderTui } from "@faux-ui/ui/tui";

const tracks = [10, "auto", "2fr"] satisfies Track[];
const initialSegment: TextSourceSegment = { id: "initial", text: "typed" };
const initialSource: TextSource = createTextSource([initialSegment]);
const appendedSource = appendTextSourceSegment(initialSource, {
  id: "appended",
  text: " source",
});
const extendedSource = extendTextSourceSegment(
  appendedSource,
  "appended",
  " extension",
);
const replacedSource = replaceTextSourceSegment(
  extendedSource,
  "initial",
  "replacement",
);
const sourceInspection: TextSourceInspection =
  inspectTextSource(replacedSource);
void sourceInspection.text;
void sourceInspection.segments[0]?.identity;
void sourceInspection.segments[0]?.chunks[0]?.identity;

const app = (
  <Columns tracks={tracks}>
    <Text align={{ x: "center", y: "end" }}>typed</Text>
    <Box />
    <Button
      label="Run"
      onPress={(event) => {
        void event.target.kind;
        // @ts-expect-error Internal semantic IDs are not public event fields.
        void event.targetId;
      }}
    />
  </Columns>
);

const engine: LayoutEngine = {
  preferred: () => ({ width: 1, height: 1 }),
  layout: () => ({
    children: [{ x: 0, y: 0, width: 1, height: 1 }],
  }),
};
const extension = (
  <Layout layout={engine}>
    <Text>e</Text>
  </Layout>
);

const rows = (
  <Rows tracks={[1]}>
    <Button
      keyHint="r"
      focusStyle={{ background: "focus" }}
      hoverStyle={{ background: "selection" }}
    >
      Run
    </Button>
  </Rows>
);

const followEndValues = (
  <Rows>
    <ScrollView axis="both" followEnd={false}>
      <Text>none</Text>
    </ScrollView>
    <ScrollView axis="both" followEnd>
      <Text>all</Text>
    </ScrollView>
    <ScrollView axis="both" followEnd="x">
      <Text>horizontal</Text>
    </ScrollView>
    <ScrollView axis="both" followEnd="y">
      <Text>vertical</Text>
    </ScrollView>
    <ScrollView axis="both" followEnd="both">
      <Text>both</Text>
    </ScrollView>
  </Rows>
);
const invalidFollowEnd = (
  <ScrollView
    axis="both"
    // @ts-expect-error ScrollView followEnd accepts only booleans and scroll axes.
    followEnd="diagonal"
  >
    <Text>invalid</Text>
  </ScrollView>
);

renderStatic(app, { width: 40, height: 4 });
renderStatic(rows, { width: 40, height: 1 });
renderStatic(extension, { width: 1, height: 1 });
renderStatic(<Text source={replacedSource} />, { width: 40, height: 1 });
void renderDom;
void renderTui;
void lineCellWidth("A古é👩‍💻");
void splitGraphemes("A古é👩‍💻");

// @ts-expect-error TextSource is opaque and cannot be fabricated by callers.
const fabricatedSource: TextSource = {};
// @ts-expect-error TextSource exposes no segment representation.
void initialSource.segments;
// @ts-expect-error TextSourceSegment fields are readonly.
initialSegment.text = "mutated";
// @ts-expect-error Text accepts either string children or source, never both.
const mixedTextInput = <Text source={initialSource}>mixed</Text>;
// @ts-expect-error Text source must be a TextSource.
const invalidTextSource = <Text source="plain string" />;
// @ts-expect-error Advanced Layout is isolated to @faux-ui/ui/layout.
void Ui.Layout;
// @ts-expect-error Singular directional components were removed before release.
void Ui.Row;
// @ts-expect-error Singular directional components were removed before release.
void Ui.Column;
// @ts-expect-error Box alignment was ineffective and is not public.
const alignedBox = <Box alignX="center" />;
// @ts-expect-error Text axis pairs use align={{ x, y }}.
const oldTextAlign = <Text alignX="center">old</Text>;
// @ts-expect-error keyHint replaced the misleading display-only hotkey prop.
const oldHint = <Button hotkey="r">Run</Button>;
// @ts-expect-error Modifier-first focusStyle replaced styleFocus.
const oldFocusStyle = <Text styleFocus={{ bold: true }}>old</Text>;
// @ts-expect-error Modifier-first hoverStyle replaced styleHover.
const oldHoverStyle = <Text styleHover={{ bold: true }}>old</Text>;
// @ts-expect-error HTML intrinsics are not part of faux-ui JSX.
const html = <div>not supported</div>;
// @ts-expect-error Semantic elements cannot be nested inside Text.
const nestedText = Text({ children: <Box /> });
// @ts-expect-error Named/general-grid tracks were intentionally removed.
const namedTrack: Track = "sidebar";
void fabricatedSource;
void mixedTextInput;
void invalidTextSource;
void alignedBox;
void oldTextAlign;
void oldHint;
void oldFocusStyle;
void oldHoverStyle;
void html;
void nestedText;
void namedTrack;
void followEndValues;
void invalidFollowEnd;
