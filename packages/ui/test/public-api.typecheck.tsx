import * as Ui from "@faux-ui/ui";
import { Box, Button, Columns, Rows, Text, type Track } from "@faux-ui/ui";
import { render as renderDom } from "@faux-ui/ui/dom";
import { renderStatic } from "@faux-ui/ui/testing";
import { render as renderTui } from "@faux-ui/ui/tui";

const tracks = [10, "auto", "2fr"] satisfies Track[];
const app = (
  <Columns tracks={tracks}>
    <Text>typed</Text>
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

renderStatic(app, { width: 40, height: 4 });
renderStatic(rows, { width: 40, height: 1 });
void renderDom;
void renderTui;

// @ts-expect-error Singular directional components were removed before release.
void Ui.Row;
// @ts-expect-error Singular directional components were removed before release.
void Ui.Column;
// @ts-expect-error Box alignment was ineffective and is not public.
const alignedBox = <Box alignX="center" />;
// @ts-expect-error keyHint replaced the misleading display-only hotkey prop.
const oldHint = <Button hotkey="r">Run</Button>;
// @ts-expect-error Modifier-first focusStyle replaced styleFocus.
const oldFocusStyle = <Text styleFocus={{ bold: true }}>old</Text>;
// @ts-expect-error Modifier-first hoverStyle replaced styleHover.
const oldHoverStyle = <Text styleHover={{ bold: true }}>old</Text>;
// @ts-expect-error HTML intrinsics are not part of faux-ui JSX.
const html = <div>not supported</div>;
// @ts-expect-error Semantic elements cannot be nested inside Text.
const nestedText = <Text><Box /></Text>;
// @ts-expect-error Named/general-grid tracks were intentionally removed.
const namedTrack: Track = "sidebar";
void alignedBox;
void oldHint;
void oldFocusStyle;
void oldHoverStyle;
void html;
void nestedText;
void namedTrack;
