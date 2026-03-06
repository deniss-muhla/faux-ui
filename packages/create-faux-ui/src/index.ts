#!/usr/bin/env node

import { pathToFileURL } from "node:url";

export function buildScaffoldMessage(name: string): string {
  return [
    `create-faux-ui scaffold target: ${name}`,
    "Scaffolding is not implemented yet.",
    "Next: add templates for jsx, json, and hybrid starters.",
  ].join("\n");
}

export function main(args: string[]): void {
  const name = args[0] ?? "faux-ui-app";
  console.log(buildScaffoldMessage(name));
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main(process.argv.slice(2));
}
