import { Box, Button, Row, Text, type Track } from "@faux-ui/ui";
import { render as renderDom } from "@faux-ui/ui/dom";
import { renderStatic } from "@faux-ui/ui/testing";
import { render as renderTui } from "@faux-ui/ui/tui";

const tracks = [10, "auto", "2fr"] satisfies Track[];
const app = (
  <Row tracks={tracks}>
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
  </Row>
);

renderStatic(app, { width: 40, height: 4 });
void renderDom;
void renderTui;

// @ts-expect-error HTML intrinsics are not part of faux-ui JSX.
const html = <div>not supported</div>;
// @ts-expect-error Semantic elements cannot be nested inside Text.
const nestedText = <Text><Box /></Text>;
// @ts-expect-error Named/general-grid tracks were intentionally removed.
const namedTrack: Track = "sidebar";
void html;
void nestedText;
void namedTrack;
