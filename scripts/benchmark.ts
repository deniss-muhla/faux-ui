import { createElement } from "react";

import { ExampleApp } from "../apps/example/src/example-app.js";
import { renderStatic } from "../packages/ui/src/testing.js";

const runs = 100;
const started = performance.now();
for (let index = 0; index < runs; index += 1) {
  const app = renderStatic(createElement(ExampleApp), {
    width: 100,
    height: 30,
  });
  app.unmount();
}
const duration = performance.now() - started;
console.log(
  `${runs} serious-fixture mounts: ${duration.toFixed(1)}ms (${(
    duration / runs
  ).toFixed(2)}ms/mount)`,
);
