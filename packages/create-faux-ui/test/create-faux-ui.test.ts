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

    expect(plan.files.map((file) => file.path)).toContain("src/main.tsx");
    expect(plan.files.map((file) => file.path)).toContain("tsconfig.json");

    const packageJson = plan.files.find((file) => file.path === "package.json");
    expect(packageJson?.content).toContain("@faux-ui/reconciler");
    expect(packageJson?.content).toContain("@faux-ui/app");
    expect(packageJson?.content).toContain('"start": "tsx src/main.tsx"');
  });

  it("builds a DOM JSX starter plan with browser entry files", () => {
    const plan = buildScaffoldPlan(
      baseOptions({ template: "jsx", renderer: "dom" }),
    );

    expect(plan.files.map((file) => file.path)).toContain("index.html");
    expect(plan.files.map((file) => file.path)).toContain("src/main.tsx");
    expect(plan.files.map((file) => file.path)).toContain("src/styles.css");
    expect(plan.files.map((file) => file.path)).not.toContain("src/app.tsx");

    const packageJson = plan.files.find((file) => file.path === "package.json");
    expect(packageJson?.content).toContain("@faux-ui/app");
    expect(packageJson?.content).toContain('"start": "vite"');
    expect(packageJson?.content).toContain('"build": "vite build"');
  });

  it("builds a JSON starter plan with exec-faux-ui scripts", () => {
    const plan = buildScaffoldPlan(baseOptions({ template: "json" }));

    expect(plan.files.map((file) => file.path)).toContain("src/document.json");
    expect(plan.files.map((file) => file.path)).not.toContain("tsconfig.json");

    const packageJson = plan.files.find((file) => file.path === "package.json");
    expect(packageJson?.content).toContain("exec-faux-ui");
    expect(packageJson?.content).toContain("preview:tui");
    expect(packageJson?.content).toContain("inspect:bindings");
  });

  it("builds a renderer package starter plan with the shared contract", () => {
    const plan = buildScaffoldPlan(baseOptions({ template: "renderer" }));

    expect(plan.files.map((file) => file.path)).toContain("src/index.ts");
    expect(plan.files.map((file) => file.path)).toContain(
      "test/renderer.test.ts",
    );
    expect(plan.files.map((file) => file.path)).toContain("tsconfig.json");

    const packageJson = plan.files.find((file) => file.path === "package.json");
    const source = plan.files.find((file) => file.path === "src/index.ts");
    const readme = plan.files.find((file) => file.path === "README.md");

    expect(packageJson?.content).toContain("@faux-ui/renderer");
    expect(packageJson?.content).toContain('"test": "vitest run"');
    expect(source?.content).toContain("mountRendererApp");
    expect(source?.content).toContain("RendererDefinition");
    expect(source?.content).toContain("createExampleThemeTarget");
    expect(source?.content).toContain("exampleRendererMetadata");
    expect(readme?.content).toContain("renderer package template");
    expect(readme?.content).toContain("capability and metadata export");
  });

  it("writes the scaffold to disk and prints next steps", () => {
    const cwd = mkdtempSync(join(tmpdir(), "create-faux-ui-"));
    const output = run(
      [
        "demo-hybrid",
        "--template",
        "hybrid",
        "--renderer",
        "dom",
        "--pm",
        "pnpm",
      ],
      cwd,
    );

    expect(output).toContain("Next steps:");
    expect(output).toContain("pnpm install");
    expect(output).toContain("pnpm run start");

    const packageJson = readFileSync(
      join(cwd, "demo-hybrid", "package.json"),
      "utf8",
    );
    const appSource = readFileSync(
      join(cwd, "demo-hybrid", "src", "main.tsx"),
      "utf8",
    );
    const documentSource = readFileSync(
      join(cwd, "demo-hybrid", "src", "document.json"),
      "utf8",
    );
    const indexHtml = readFileSync(
      join(cwd, "demo-hybrid", "index.html"),
      "utf8",
    );

    expect(packageJson).toContain('"packageManager": "pnpm@9"');
    expect(packageJson).toContain('"start": "vite"');
    expect(appSource).toContain("render(");
    expect(appSource).toContain("useState");
    expect(documentSource).toContain("drag-root-start");
    expect(documentSource).toContain("--inspect bindings");
    expect(indexHtml).toContain("<title>");
  });

  it("prints renderer template next steps with tests as the entrypoint", () => {
    const output = run(
      ["demo-renderer", "--template", "renderer", "--pm", "npm"],
      mkdtempSync(join(tmpdir(), "create-faux-ui-renderer-")),
    );

    expect(output).toContain("npm install");
    expect(output).toContain("npm run test");
  });

  it("refuses to scaffold into a non-empty directory", () => {
    const cwd = mkdtempSync(join(tmpdir(), "create-faux-ui-"));
    const projectRoot = join(cwd, "occupied");
    scaffoldProject({ ...baseOptions(), cwd, name: "occupied" });

    expect(() =>
      scaffoldProject({ ...baseOptions(), cwd, name: "occupied" }),
    ).toThrow(`Target directory is not empty: ${projectRoot}`);
  });
});

function baseOptions(
  overrides: Partial<ScaffoldOptions> = {},
): ScaffoldOptions {
  return {
    name: "demo-app",
    template: "jsx",
    renderer: "tui",
    packageManager: "bun",
    cwd: tmpdir(),
    ...overrides,
  };
}
