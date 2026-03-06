import type { Size, TextLayoutRequest } from "@faux-ui/core";

export interface TuiTextMeasurer {
  measure(request: TextLayoutRequest): Size;
  lines(request: TextLayoutRequest): string[];
}

export function createTuiTextMeasurer(): TuiTextMeasurer {
  return {
    measure(request) {
      const lines = layoutLines(request);
      const width = lines.reduce((max, line) => Math.max(max, line.length), 0);
      return {
        width,
        height: lines.length,
      };
    },
    lines: layoutLines,
  };
}

function layoutLines(request: TextLayoutRequest): string[] {
  const sourceLines = request.text.split("\n");
  if (
    !request.wrap ||
    request.maxWidth === undefined ||
    request.maxWidth <= 0
  ) {
    return sourceLines;
  }

  const wrapped: string[] = [];
  for (const sourceLine of sourceLines) {
    if (sourceLine.length === 0) {
      wrapped.push("");
      continue;
    }

    for (let start = 0; start < sourceLine.length; start += request.maxWidth) {
      wrapped.push(sourceLine.slice(start, start + request.maxWidth));
    }
  }

  return wrapped;
}
