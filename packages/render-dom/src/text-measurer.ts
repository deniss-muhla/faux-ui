import type { Size } from "@faux-ui/core";

export interface DomTextMeasureRequest {
  text: string;
  maxWidth?: number;
}

export interface DomMeasurementAdapter {
  measureText(request: DomTextMeasureRequest): Size;
}

export interface DomCanvasTextMetricsLike {
  width: number;
}

export interface DomCanvasContextLike {
  font: string;
  measureText(text: string): DomCanvasTextMetricsLike;
}

export interface DomCanvasLike {
  getContext(type: "2d"): DomCanvasContextLike | null;
}

export interface DomCanvasDocumentLike {
  createElement(tag: "canvas"): DomCanvasLike;
}

export interface BrowserDomTextMeasurerOptions {
  context?: DomCanvasContextLike;
  document?: DomCanvasDocumentLike;
  font?: string;
  lineHeight?: number;
  minimumWidth?: number;
}

export interface DomTextMeasurer {
  measure(request: DomTextMeasureRequest): Size;
}

export function createDomTextMeasurer(
  adapter: DomMeasurementAdapter,
): DomTextMeasurer {
  return {
    measure(request) {
      return adapter.measureText(request);
    },
  };
}

export function createBrowserDomTextMeasurer(
  options: BrowserDomTextMeasurerOptions = {},
): DomTextMeasurer {
  const context =
    options.context ??
    createCanvasContext(
      options.document ?? readGlobalDocument(),
      options.font ?? '16px "Segoe UI", sans-serif',
    );
  const lineHeight = Math.max(1, options.lineHeight ?? 20);
  const minimumWidth = Math.max(0, options.minimumWidth ?? 1);

  return createDomTextMeasurer({
    measureText({ text }) {
      return {
        width: Math.max(
          minimumWidth,
          Math.ceil(context.measureText(text).width),
        ),
        height: lineHeight,
      };
    },
  });
}

function readGlobalDocument(): DomCanvasDocumentLike {
  const documentLike = (globalThis as { document?: DomCanvasDocumentLike })
    .document;
  if (documentLike === undefined) {
    throw new Error(
      "Expected a DOM-like document or explicit canvas context for text measurement.",
    );
  }

  return documentLike;
}

function createCanvasContext(
  document: DomCanvasDocumentLike,
  font: string,
): DomCanvasContextLike {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Expected a 2D canvas context for DOM text measurement.");
  }

  context.font = font;
  return context;
}
