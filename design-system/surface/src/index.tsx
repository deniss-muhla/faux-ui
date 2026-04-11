import type { ReactNode } from "react";
import type { TrackShorthand } from "@faux-ui/core";

import {
  mergeFoundationTheme,
  type PartialFoundationTheme,
} from "@faux-ui/foundation";

export type TileTone = "neutral" | "accent" | "selected";

export interface TileProps {
  label?: string;
  title: string;
  description?: string;
  footer?: string;
  variant?: TileTone;
  theme?: PartialFoundationTheme;
  onPress?: () => void;
}

export function Tile(props: TileProps): ReactNode {
  const theme = mergeFoundationTheme(props.theme);
  const rows: TrackShorthand[] = [];

  if (props.label !== undefined) {
    rows.push(1);
  }

  rows.push(1);

  if (props.description !== undefined) {
    rows.push(1);
  }

  if (props.footer !== undefined) {
    rows.push(1);
  }

  const interactive = props.onPress !== undefined;
  const tone = props.variant ?? "neutral";
  const background =
    tone === "accent"
      ? theme.surface.accent
      : tone === "selected"
        ? theme.surface.selection
        : theme.surface.panel;
  const titleColor =
    tone === "accent" ? theme.surface.inverseText : theme.surface.text;
  const eyebrowColor =
    tone === "neutral" ? theme.surface.signal : theme.surface.inverseText;
  const detailColor =
    tone === "accent" ? theme.surface.inverseText : theme.surface.mutedText;
  const footerColor =
    tone === "accent" ? theme.surface.inverseText : theme.surface.signal;
  const interactionProps = interactive
    ? {
        onClick: () => props.onPress?.(),
        onPress: () => props.onPress?.(),
        styleHover: {
          background: theme.surface.focus,
          color: theme.surface.inverseText,
        },
        styleFocus: {
          background: theme.action.focusBackground,
          color: theme.action.focusText,
        },
      }
    : {};

  return (
    <view
      rows={rows}
      focusable={interactive}
      style={{ background, color: titleColor }}
      {...interactionProps}
    >
      {props.label === undefined ? null : (
        <text style={{ color: eyebrowColor }}>{props.label}</text>
      )}
      <text style={{ color: titleColor }}>{props.title}</text>
      {props.description === undefined ? null : (
        <text style={{ color: detailColor }}>{props.description}</text>
      )}
      {props.footer === undefined ? null : (
        <text style={{ color: footerColor }}>{props.footer}</text>
      )}
    </view>
  );
}
