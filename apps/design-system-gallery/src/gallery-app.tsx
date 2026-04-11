import type { ReactNode } from "react";

import { Action } from "@faux-ui/action";
import { Scaffold } from "@faux-ui/foundation";
import { Tile } from "@faux-ui/surface";

const noop = (): void => {};

export function DesignSystemGalleryApp(): ReactNode {
  return (
    <Scaffold
      label="design-system"
      title="faux-ui gallery"
      description="stable visual regression matrix"
      footer="foundation, action, and surface stay renderer-neutral"
    >
      <view rows={[5, 5, 5]} style={{ background: "bg" }}>
        <view columns={[28, 28, 28]} style={{ background: "bg" }}>
          <Tile
            label="foundation"
            title="Scaffold shell"
            description="Theme and layout primitives stay renderer-neutral."
          />
          <Action
            title="Primary action"
            description="Accent variant and focus states."
            variant="accent"
            onPress={noop}
          />
          <Tile
            label="surface"
            title="Accent tile"
            description="Reusable framed panel language."
            variant="accent"
          />
        </view>

        <view columns={[28, 28, 28]} style={{ background: "bg" }}>
          <Action
            title="Quiet action"
            description="Neutral action for low-emphasis work."
            onPress={noop}
          />
          <Action
            title="Selected action"
            description="Persistent selected state."
            variant="selected"
            onPress={noop}
          />
          <Tile
            label="surface"
            title="Selected tile"
            description="Selection variant stays aligned with core tokens."
            variant="selected"
            onPress={noop}
          />
        </view>

        <view columns={[28, 28, 28]} style={{ background: "bg" }}>
          <Tile
            label="composed"
            title="Foundation plus action"
            description="Components compile down to view and text only."
            footer="No DOM-only layout rules."
          />
          <Action
            title="Disabled action"
            description="Non-focusable but visibly present."
            disabled
          />
          <Tile
            label="tokens"
            title="Shared semantic palette"
            description="The gallery is fixed for stable snapshots."
          />
        </view>
      </view>
    </Scaffold>
  );
}
