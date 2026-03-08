import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildScaffoldPlan,
  run,
  scaffoldProject,
  type ScaffoldOptions,
} from "../src/index.js";

describe("create-faux-ui", () => {
  it("builds a JSX starter plan with a runnable app entrypoint", () => {
    const plan = buildScaffoldPlan(baseOptions({ template: "jsx" }));

    expect(plan.files.map((file) => file.path)).toContain("src/app.tsx");
    expect(plan.files.map((file) => file.path)).toContain("tsconfig.json");

    const packageJson = plan.files.find((file) => file.path === "package.json");
    expect(packageJson?.content).toContain("@faux-ui/reconciler");
    expect(packageJson?.content).toContain('"start": "tsx src/app.tsx"');
  });

  it("builds a JSON starter plan with exec-faux-ui scripts", () => {
    const plan = buildScaffoldPlan(baseOptions({ template: "json" }));

    expect(plan.files.map((file) => file.path)).toContain("src/document.json");
    expect(plan.files.map((file) => file.path)).not.toContain("tsconfig.json");

    const packageJson = plan.files.find((file) => file.path === "package.json");
    expect(packageJson?.content).toContain("exec-faux-ui");
    expect(packageJson?.content).toContain("preview:tui");
  });

  it("writes the scaffold to disk and prints next steps", () => {
    const cwd = mkdtempSync(join(tmpdir(), "create-faux-ui-"));
    const output = run(["demo-hybrid", "--template", "hybrid", "--pm", "pnpm"], cwd);

    expect(output).toContain("Next steps:");
    expect(output).toContain("pnpm install");
    expect(output).toContain("pnpm run start");

    const packageJson = readFileSync(
      join(cwd, "demo-hybrid", "package.json"),
      "utf8",
    );
    const appSource = readFileSync(join(cwd, "demo-hybrid", "src", "app.tsx"), "utf8");
    const documentSource = readFileSync(
      join(cwd, "demo-hybrid", "src", "document.json"),
      "utf8",
    );

    expect(packageJson).toContain('"packageManager": "pnpm@9"');
    expect(appSource).toContain("mountTerminalTuiHost");
    expect(documentSource).toContain("demo-hybrid starter");
  });

  it("refuses to scaffold into a non-empty directory", () => {
    const cwd = mkdtempSync(join(tmpdir(), "create-faux-ui-"));
    const projectRoot = join(cwd, "occupied");
    scaffoldProject({ ...baseOptions(), cwd, name: "occupied" });

    expect(() => scaffoldProject({ ...baseOptions(), cwd, name: "occupied" })).toThrow(
      `Target directory is not empty: ${projectRoot}`,
    );
  });
});

function baseOptions(
  overrides: Partial<ScaffoldOptions> = {},
): ScaffoldOptions {
  return {
    name: "demo-app",
    template: "jsx",
    packageManager: "bun",
    cwd: tmpdir(),
    ...overrides,
  };
}