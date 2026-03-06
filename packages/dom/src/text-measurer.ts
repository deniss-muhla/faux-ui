import type { Size, TextLayoutRequest } from "@faux-ui/core";

export interface DomMeasurementAdapter {
  measureText(request: TextLayoutRequest): Size;
}

export interface DomTextMeasurer {
  measure(request: TextLayoutRequest): Size;
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
