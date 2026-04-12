import { createElement } from "react";

import { defaultSemanticColors } from "@faux-ui/core";

import { CanvasExampleApp } from "./canvas-example-app.js";
import {
  canvasExampleRenderer,
  createCanvasThemeTarget,
  render,
} from "./canvas-renderer.js";
import "./styles.css";

const canvas = document.querySelector("#canvas-renderer");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Expected #canvas-renderer to be an HTMLCanvasElement.");
}

const themeTarget = createCanvasThemeTarget(defaultSemanticColors);
canvasExampleRenderer.applyTheme?.(themeTarget, defaultSemanticColors);

render(createElement(CanvasExampleApp), {
  canvas,
  themeTarget,
});
