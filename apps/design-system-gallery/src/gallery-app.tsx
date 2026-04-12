import type { ReactNode } from "react";

import { AppShell, Button, Panel } from "@faux-ui/ui";

const noop = (): void => {};

export function DesignSystemGalleryApp(): ReactNode {
  return (
    <AppShell
      label="ui"
      title="faux-ui gallery"
      description="stable visual regression matrix"
      footer="AppShell, Button, and Panel stay renderer-neutral"
    >
      <view rows={[5, 5, 5]} style={{ background: "bg" }}>
        <view columns={[28, 28, 28]} style={{ background: "bg" }}>
          <Panel
            label="ui"
            title="App shell"
            description="Public authoring primitives stay renderer-neutral."
          />
          <Button
            title="Primary action"
            description="Accent variant and focus states."
            variant="accent"
            onPress={noop}
          />
          <Panel
            label="surface"
            title="Accent tile"
            description="Reusable framed panel language."
            variant="accent"
          />
        </view>

        <view columns={[28, 28, 28]} style={{ background: "bg" }}>
          <Button
            title="Quiet action"
            description="Neutral action for low-emphasis work."
            onPress={noop}
          />
          <Button
            title="Selected action"
            description="Persistent selected state."
            variant="selected"
            onPress={noop}
          />
          <Panel
            label="surface"
            title="Selected tile"
            description="Selection variant stays aligned with core tokens."
            variant="selected"
            onPress={noop}
          />
        </view>

        <view columns={[28, 28, 28]} style={{ background: "bg" }}>
          <Panel
            label="composed"
            title="Foundation plus action"
            description="Components compile down to view and text only."
            footer="No DOM-only layout rules."
          />
          <Button
            title="Disabled action"
            description="Non-focusable but visibly present."
            disabled
          />
          <Panel
            label="tokens"
            title="Shared semantic palette"
            description="The gallery is fixed for stable snapshots."
          />
        </view>
      </view>
    </AppShell>
  );
}
