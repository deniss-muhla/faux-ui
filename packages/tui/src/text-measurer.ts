import type { Size } from "@faux-ui/core";

export interface TuiTextMeasurer {
  measure(text: string): Size;
  lines(text: string): string[];
}

export function createTuiTextMeasurer(): TuiTextMeasurer {
  return {
    measure(text) {
      const lines = layoutLines(text);
      const width = lines.reduce((max, line) => Math.max(max, line.length), 0);
      return {
        width,
        height: lines.length,
      };
    },
    lines: layoutLines,
  };
}

function layoutLines(text: string): string[] {
  return text.split("\n");
}
