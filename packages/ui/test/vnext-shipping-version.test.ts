import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { VERSION } from "@faux-ui/ui";

interface ShippingManifest {
  readonly version?: string;
  readonly peerDependencies?: Record<string, string>;
}

const readManifest = (relativePath: string): ShippingManifest =>
  JSON.parse(
    readFileSync(new URL(relativePath, import.meta.url), "utf8"),
  ) as ShippingManifest;

const uiManifest = readManifest("../package.json");
const codexPlugin = readManifest("../.codex-plugin/plugin.json");
const claudePlugin = readManifest("../.claude-plugin/plugin.json");
const workspaceManifest = readManifest("../../../package.json");
const exampleManifest = readManifest("../../../apps/example/package.json");
const gridManifest = readManifest("../../grid/package.json");

describe("shipping version surfaces", () => {
  it("reports the unreleased candidate through every package path", () => {
    // The unreleased candidate under test. This is the single expected version
    // in the suite; every other surface is compared against the package entry.
    const candidate = "0.10.0";

    expect(VERSION).toBe(candidate);
    expect(uiManifest.version, "@faux-ui/ui manifest").toBe(VERSION);
    expect(workspaceManifest.version, "faux-ui workspace manifest").toBe(
      VERSION,
    );
    expect(exampleManifest.version, "example workspace manifest").toBe(VERSION);
    expect(codexPlugin.version, "Codex plugin manifest").toBe(VERSION);
    expect(claudePlugin.version, "Claude plugin manifest").toBe(VERSION);
    expect(gridManifest.version, "@faux-ui/grid manifest").toBe("0.1.0");
    expect(
      gridManifest.peerDependencies?.["@faux-ui/ui"],
      "@faux-ui/grid UI peer range",
    ).toBe(`^${VERSION}`);
  });
});
