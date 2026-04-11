import type { ReactNode } from "react";
import type { TrackShorthand } from "@faux-ui/core";

import {
  mergeFoundationTheme,
  type PartialFoundationTheme,
} from "@faux-ui/foundation";

export type ActionTone = "neutral" | "accent";

export interface ActionProps {
  title: string;
  description?: string;
  variant?: ActionTone | "selected";
  disabled?: boolean;
  theme?: PartialFoundationTheme;
  onPress?: () => void;
}

export function Action(props: ActionProps): ReactNode {
  const theme = mergeFoundationTheme(props.theme);
  const rows: TrackShorthand[] = props.description === undefined ? [1] : [1, 1];
  const interactive = props.disabled !== true && props.onPress !== undefined;
  const emphasized = props.variant === "accent" || props.variant === "selected";
  const background = props.disabled
    ? theme.action.disabledBackground
    : emphasized
      ? theme.action.activeBackground
      : theme.action.restBackground;
  const textColor = props.disabled
    ? theme.action.disabledText
    : emphasized
      ? theme.action.activeText
      : theme.action.restText;
  const detailColor = props.disabled
    ? theme.action.disabledText
    : emphasized
      ? theme.surface.inverseText
      : theme.surface.mutedText;
  const interactionProps = interactive
    ? {
        onClick: () => props.onPress?.(),
        onPress: () => props.onPress?.(),
        styleHover: {
          background: theme.action.hoverBackground,
          color: theme.action.hoverText,
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
      style={{ background, color: textColor }}
      {...interactionProps}
    >
      <text style={{ color: textColor }}>{props.title}</text>
      {props.description === undefined ? null : (
        <text style={{ color: detailColor }}>{props.description}</text>
      )}
    </view>
  );
}
