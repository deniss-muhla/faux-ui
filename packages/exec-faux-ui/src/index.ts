#!/usr/bin/env node

import { pathToFileURL } from "node:url";

export function buildExecutionMessage(entry: string, target = "dom"): string {
  return [
    `exec-faux-ui entry: ${entry}`,
    `target: ${target}`,
    "Execution is not implemented yet.",
    "Next: wire format detection, renderer selection, and inspect mode.",
  ].join("\n");
}

export function main(args: string[]): void {
  const entry = args[0] ?? "<entry>";
  const targetFlagIndex = args.indexOf("--target");
  const target =
    targetFlagIndex >= 0 ? (args[targetFlagIndex + 1] ?? "dom") : "dom";

  console.log(buildExecutionMessage(entry, target));
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main(process.argv.slice(2));
}
