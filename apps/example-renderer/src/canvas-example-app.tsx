import type { ReactNode } from "react";

export function CanvasExampleApp(): ReactNode {
  return (
    <view rows={[1, 1, 2, 2, 1]} style={{ background: "bg" }}>
      <text style={{ color: "accent" }}>canvas renderer example</text>
      <text style={{ color: "muted" }}>
        This renderer is owned by the app, not by faux-ui core packages.
      </text>
      <view
        focusable
        style={{ background: "selection" }}
        styleHover={{ background: "focus" }}
        styleFocus={{ background: "accent", color: "inverse" }}
      >
        <text style={{ color: "fg" }}>Contributor-shaped renderer</text>
        <text style={{ color: "muted" }}>
          HTML canvas paints a deterministic outline of the faux-ui tree.
        </text>
      </view>
      <view style={{ background: "bgAlt" }}>
        <text style={{ color: "warning" }}>Capabilities</text>
        <text style={{ color: "fg" }}>
          Theme target, metadata, and renderer-owned drawing loop.
        </text>
      </view>
      <text style={{ color: "muted" }}>
        Use this app as a starting point for a contributor-managed renderer.
      </text>
    </view>
  );
}
