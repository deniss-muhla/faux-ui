#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type ScaffoldTemplate = "jsx" | "json" | "hybrid" | "renderer";
export type PackageManager = "bun" | "npm" | "pnpm";
export type ScaffoldRenderer = "dom" | "tui"; // TODO: Maybe this should be choose multiple renderers and generate multiple entry files? Connect with internal list of built-in renderers?

export interface ScaffoldOptions {
  name: string;
  template: ScaffoldTemplate;
  renderer: ScaffoldRenderer;
  packageManager: PackageManager;
  cwd: string;
}

export interface ScaffoldFile {
  path: string;
  content: string;
}

export interface ScaffoldPlan {
  rootDir: string;
  files: ScaffoldFile[];
}

const DEFAULT_TEMPLATE: ScaffoldTemplate = "jsx";
const DEFAULT_RENDERER: ScaffoldRenderer = "tui";
const DEFAULT_PACKAGE_MANAGER: PackageManager = "bun";
const HELP_FLAGS = new Set(["--help", "-h"]);

export function buildScaffoldMessage(plan: ScaffoldPlan): string {
  return [
    `create-faux-ui scaffold target: ${plan.rootDir}`,
    ...plan.files.map((file) => `- ${file.path}`),
  ].join("\n");
}

export function buildScaffoldPlan(options: ScaffoldOptions): ScaffoldPlan {
  const rootDir = resolve(options.cwd, options.name);
  const files: ScaffoldFile[] = [
    {
      path: ".gitignore",
      content: ["node_modules", "dist", ".DS_Store"].join("\n") + "\n",
    },
    {
      path: "README.md",
      content: buildReadme(options),
    },
    {
      path: "package.json",
      content: `${JSON.stringify(buildPackageJson(options), null, 2)}\n`,
    },
  ];

  if (options.template === "renderer") {
    files.push({
      path: "tsconfig.json",
      content: `${JSON.stringify(buildRendererTsconfig(), null, 2)}\n`,
    });
    files.push(...buildRendererFiles(options.name));
    return { rootDir, files };
  }

  if (options.template !== "json") {
    files.push({
      path: "tsconfig.json",
      content: `${JSON.stringify(buildTsconfig(options.renderer), null, 2)}\n`,
    });
  }

  switch (options.template) {
    case "jsx":
      files.push(...buildJsxFiles(options));
      break;
    case "json":
      files.push({
        path: "src/document.json",
        content: `${JSON.stringify(buildDocumentSpec(options.name), null, 2)}\n`,
      });
      break;
    case "hybrid":
      files.push(...buildJsxFiles(options), {
        path: "src/document.json",
        content: `${JSON.stringify(buildDocumentSpec(options.name), null, 2)}\n`,
      });
      break;
  }

  return { rootDir, files };
}

export function scaffoldProject(options: ScaffoldOptions): ScaffoldPlan {
  const plan = buildScaffoldPlan(options);
  ensureTargetDirectory(plan.rootDir);

  for (const file of plan.files) {
    const destination = join(plan.rootDir, file.path);
    mkdirSync(resolve(destination, ".."), { recursive: true });
    writeFileSync(destination, file.content, "utf8");
  }

  return plan;
}

export function run(args: string[], cwd = process.cwd()): string {
  const parsed = parseScaffoldArgs(args, cwd);
  if (parsed.help) {
    return buildUsage();
  }

  const plan = scaffoldProject(parsed.options);
  return [
    buildScaffoldMessage(plan),
    "",
    `Next steps:`,
    `  cd ${parsed.options.name}`,
    `  ${buildInstallCommand(parsed.options.packageManager)}`,
    `  ${buildStartCommand(parsed.options.template, parsed.options.packageManager)}`,
  ].join("\n");
}

export function main(args: string[]): number {
  try {
    console.log(run(args));
    return 0;
  } catch (error) {
    console.error(formatScaffoldError(error));
    return 1;
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  process.exitCode = main(process.argv.slice(2));
}

function parseScaffoldArgs(
  args: string[],
  cwd: string,
): { help: true } | { help: false; options: ScaffoldOptions } {
  let name: string | null = null;
  let template = DEFAULT_TEMPLATE;
  let renderer = DEFAULT_RENDERER;
  let packageManager = DEFAULT_PACKAGE_MANAGER;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) {
      continue;
    }

    if (HELP_FLAGS.has(arg)) {
      return { help: true };
    }

    if (arg === "--template") {
      template = parseTemplate(requireOptionValue(args, ++index, arg));
      continue;
    }

    if (arg === "--renderer") {
      renderer = parseRenderer(requireOptionValue(args, ++index, arg));
      continue;
    }

    if (arg === "--pm") {
      packageManager = parsePackageManager(
        requireOptionValue(args, ++index, arg),
      );
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (name !== null) {
      throw new Error(`Unexpected extra argument: ${arg}`);
    }

    name = arg;
  }

  if (name === null) {
    throw new Error("Missing project name. Use --help for usage.");
  }

  return {
    help: false,
    options: {
      name,
      template,
      renderer,
      packageManager,
      cwd,
    },
  };
}

function buildPackageJson(options: ScaffoldOptions): Record<string, unknown> {
  if (options.template === "renderer") {
    return buildRendererPackageJson(options);
  }

  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {};
  const scripts: Record<string, string> = {};

  if (options.template === "jsx" || options.template === "hybrid") {
    dependencies["@faux-ui/app"] = "0.1.0";
    dependencies["@faux-ui/reconciler"] = "0.1.0";
    dependencies.react = "^19.2.0";
    devDependencies["@types/react"] = "^19.2.2";
    devDependencies.typescript = "^5.9.0";
    scripts.typecheck = "tsc --noEmit";

    if (options.renderer === "tui") {
      devDependencies.tsx = "^4.20.6";
      scripts.start = "tsx src/main.tsx";
    } else {
      devDependencies["@types/node"] = "^24.0.0";
      devDependencies.vite = "^6.3.5";
      scripts.start = "vite";
      scripts.build = "vite build";
      scripts.preview = "vite preview";
    }
  }

  if (options.template === "json" || options.template === "hybrid") {
    dependencies["exec-faux-ui"] = "0.1.0";
    scripts["preview:tui"] =
      "exec-faux-ui src/document.json --target tui --static";
    scripts["inspect:bindings"] =
      "exec-faux-ui src/document.json --inspect bindings";
    scripts["inspect:layout"] =
      "exec-faux-ui src/document.json --inspect layout";
    scripts["inspect:render-tree"] =
      "exec-faux-ui src/document.json --inspect render-tree";
  }

  const packageJson: Record<string, unknown> = {
    name: options.name,
    private: true,
    version: "0.1.0",
    type: "module",
    scripts,
    dependencies,
  };

  if (Object.keys(devDependencies).length > 0) {
    packageJson.devDependencies = devDependencies;
  }

  const packageManager = resolvePackageManagerField(options.packageManager);
  if (packageManager !== null) {
    packageJson.packageManager = packageManager;
  }

  return packageJson;
}

function buildRendererPackageJson(
  options: ScaffoldOptions,
): Record<string, unknown> {
  const packageJson: Record<string, unknown> = {
    name: options.name,
    version: "0.1.0",
    type: "module",
    scripts: {
      build: "tsc -p tsconfig.json",
      typecheck: "tsc -p tsconfig.json --pretty false --noEmit",
      test: "vitest run",
    },
    dependencies: {
      "@faux-ui/core": "0.1.0",
      "@faux-ui/renderer": "0.1.0",
      react: "^19.2.0",
    },
    devDependencies: {
      "@types/react": "^19.2.2",
      typescript: "^5.9.0",
      vitest: "^3.0.0",
    },
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        default: "./dist/index.js",
      },
    },
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    files: ["dist"],
  };

  const packageManager = resolvePackageManagerField(options.packageManager);
  if (packageManager !== null) {
    packageJson.packageManager = packageManager;
  }

  return packageJson;
}

function buildTsconfig(renderer: ScaffoldRenderer): Record<string, unknown> {
  const compilerOptions: Record<string, unknown> = {
    target: "ES2023",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    jsx: "react-jsx",
    jsxImportSource: "@faux-ui/reconciler",
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
  };

  if (renderer === "dom") {
    compilerOptions.lib = ["ES2023", "DOM", "DOM.Iterable"];
    compilerOptions.types = ["node"];
  }

  return {
    compilerOptions: {
      ...compilerOptions,
    },
    include: ["src/**/*.ts", "src/**/*.tsx"],
  };
}

function buildRendererTsconfig(): Record<string, unknown> {
  return {
    compilerOptions: {
      target: "ES2023",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      declaration: true,
      outDir: "dist",
      rootDir: ".",
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ["src/**/*.ts", "test/**/*.ts"],
  };
}

function buildReadme(options: ScaffoldOptions): string {
  if (options.template === "renderer") {
    return buildRendererReadme(options);
  }

  const templateLabel =
    options.template === "jsx"
      ? "JSX"
      : options.template === "json"
        ? "JSON"
        : "hybrid";

  return [
    `# ${options.name}`,
    "",
    `Starter generated by create-faux-ui using the ${templateLabel} template${options.template === "json" ? "." : ` with the ${options.renderer.toUpperCase()} renderer.`}`,
    "",
    "## Commands",
    "",
    `- Install: ${buildInstallCommand(options.packageManager)}`,
    `- Start: ${buildStartCommand(options.template, options.packageManager)}`,
    ...(options.renderer === "dom" && options.template !== "json"
      ? [
          "- Build: npm-style `run build` uses Vite to bundle the browser app.",
          "- Preview: npm-style `run preview` serves the production build locally.",
        ]
      : []),
    ...(options.template === "hybrid" || options.template === "json"
      ? [
          "- Inspect bindings: exec-faux-ui src/document.json --inspect bindings",
          "- Inspect layout: exec-faux-ui src/document.json --inspect layout",
        ]
      : []),
    "",
    "## Notes",
    "",
    "- The generated dependencies assume published faux-ui packages.",
    "- When working from a monorepo clone, replace them with local workspace or file references.",
    ...(options.template !== "json"
      ? [`- Renderer target: ${options.renderer.toUpperCase()}`]
      : []),
    "",
  ].join("\n");
}

function buildRendererReadme(options: ScaffoldOptions): string {
  const runner = resolvePackageManagerBinary(options.packageManager);

  return [
    `# ${options.name}`,
    "",
    "Starter generated by create-faux-ui using the renderer package template.",
    "",
    "## Commands",
    "",
    `- Install: ${buildInstallCommand(options.packageManager)}`,
    `- Typecheck: ${runner} run typecheck`,
    `- Test: ${runner} run test`,
    `- Build: ${runner} run build`,
    "",
    "## What This Template Gives You",
    "",
    "- a typed RendererDefinition export",
    "- a render() wrapper built on mountRendererApp()",
    "- a fake-host test you can replace with your real platform runtime",
    "- a small applyTheme() hook plus an optional theme-target helper",
    "- a capability and metadata export you can keep near the renderer package",
    "",
    "## Replace First",
    "",
    "- rename exampleRenderer and the package name to your renderer's real identity",
    "- replace detectExampleEnvironment() with your actual environment probe",
    "- replace ExampleRendererHost with your platform mount/update/unmount bridge",
    "- expand the options and mounted handle types to match your renderer runtime",
    "",
  ].join("\n");
}

function buildJsxFiles(options: ScaffoldOptions): ScaffoldFile[] {
  if (options.renderer === "dom") {
    return [
      {
        path: "index.html",
        content: buildDomIndexHtml(options.name),
      },
      {
        path: "src/main.tsx",
        content: buildDomApp(options.name),
      },
      {
        path: "src/styles.css",
        content: buildDomStyles(),
      },
    ];
  }

  return [
    {
      path: "src/main.tsx",
      content: buildTuiApp(options.name),
    },
  ];
}

function buildRendererFiles(name: string): ScaffoldFile[] {
  return [
    {
      path: "src/index.ts",
      content: buildRendererTemplateSource(name),
    },
    {
      path: "test/renderer.test.ts",
      content: buildRendererTemplateTest(),
    },
  ];
}

function buildRendererTemplateSource(name: string): string {
  return [
    'import type { ReactNode } from "react";',
    'import type { SemanticColor, UINode } from "@faux-ui/core";',
    "import {",
    "  mountRendererApp,",
    "  type MountedRendererApp,",
    "  type RendererDefinition,",
    "  type RendererThemeValues,",
    '} from "@faux-ui/renderer";',
    "",
    `const rendererName = ${JSON.stringify(name)};`,
    "",
    "export interface ExampleRendererHost {",
    "  mount(root: UINode): void;",
    "  update(root: UINode): void;",
    "  unmount(): void;",
    "}",
    "",
    "export interface ExampleThemeTarget {",
    "  variables: Partial<Record<SemanticColor, string>>;",
    "  setThemeVariable(name: string, value: string): void;",
    "}",
    "",
    "export interface ExampleRendererCapabilities {",
    '  output: "replace-me";',
    "  supportsFocus: boolean;",
    "  supportsHover: boolean;",
    "  supportsThemeTarget: boolean;",
    "}",
    "",
    "export interface ExampleRendererMetadata {",
    "  capabilities: ExampleRendererCapabilities;",
    "  themeTargetExample: string;",
    "  notes: string[];",
    "}",
    "",
    "export const exampleRendererCapabilities: ExampleRendererCapabilities = {",
    '  output: "replace-me",',
    "  supportsFocus: true,",
    "  supportsHover: false,",
    "  supportsThemeTarget: true,",
    "};",
    "",
    "export const exampleRendererMetadata: ExampleRendererMetadata = {",
    "  capabilities: exampleRendererCapabilities,",
    '  themeTargetExample: "createExampleThemeTarget()",',
    "  notes: [",
    '    "Replace the capability flags with your renderer\'s real surface.",',
    '    "If your renderer cannot apply theme tokens directly, drop the theme target helper.",',
    "  ],",
    "};",
    "",
    "export interface ExampleRendererOptions {",
    "  host: ExampleRendererHost;",
    "  themeTarget?: ExampleThemeTarget;",
    "}",
    "",
    "interface ExampleRendererHandle {",
    "  host: ExampleRendererHost;",
    "  lastRoot: UINode;",
    "  themeTarget: ExampleThemeTarget;",
    "}",
    "",
    "export interface MountedExampleRendererApp",
    "  extends MountedRendererApp<void, ExampleRendererHandle, void> {",
    "  getHost(): ExampleRendererHost;",
    "  getThemeTarget(): ExampleThemeTarget;",
    "  getCapabilities(): ExampleRendererCapabilities;",
    "}",
    "",
    "export function createExampleThemeTarget(",
    "  initial: RendererThemeValues = {},",
    "): ExampleThemeTarget {",
    "  const variables: Partial<Record<SemanticColor, string>> = {};",
    "",
    "  for (const [token, value] of Object.entries(initial)) {",
    "    if (value === undefined) {",
    "      continue;",
    "    }",
    "",
    "    variables[token as SemanticColor] = value;",
    "  }",
    "",
    "  return {",
    "    variables,",
    "    setThemeVariable(name, value) {",
    '      const prefix = "--faux-ui-color-";',
    "      if (!name.startsWith(prefix)) {",
    "        return;",
    "      }",
    "",
    "      variables[name.slice(prefix.length) as SemanticColor] = value;",
    "    },",
    "  };",
    "}",
    "",
    "export const exampleRenderer: RendererDefinition<",
    "  ExampleRendererOptions,",
    "  MountedExampleRendererApp,",
    "  ExampleThemeTarget",
    "> = {",
    "  name: rendererName,",
    "  detect: detectExampleEnvironment,",
    "  render(node, options) {",
    "    return render(node, options);",
    "  },",
    "  applyTheme(target, theme) {",
    "    applyExampleTheme(target, theme);",
    "  },",
    "};",
    "",
    "export function render(",
    "  node: ReactNode,",
    "  options: ExampleRendererOptions,",
    "): MountedExampleRendererApp {",
    "  const mounted = mountRendererApp<",
    "    ExampleRendererOptions,",
    "    void,",
    "    ExampleRendererHandle,",
    "    void",
    "  >(node, options, {",
    "    targetName: rendererName,",
    "    mount(root, initialOptions) {",
    "      initialOptions.host.mount(root);",
    "      return {",
    "        host: initialOptions.host,",
    "        lastRoot: root,",
    "        themeTarget: initialOptions.themeTarget ?? createExampleThemeTarget(),",
    "      };",
    "    },",
    "    update(handle, root) {",
    "      handle.lastRoot = root;",
    "      handle.host.update(root);",
    "    },",
    "    rerender(handle) {",
    "      handle.host.update(handle.lastRoot);",
    "    },",
    "    unmount(handle) {",
    "      handle.host.unmount();",
    "    },",
    "  });",
    "",
    "  return {",
    "    ...mounted,",
    "    getHost() {",
    "      return mounted.getImplementationHandle().host;",
    "    },",
    "    getThemeTarget() {",
    "      return mounted.getImplementationHandle().themeTarget;",
    "    },",
    "    getCapabilities() {",
    "      return exampleRendererCapabilities;",
    "    },",
    "  };",
    "}",
    "",
    "function detectExampleEnvironment(): boolean {",
    "  return false;",
    "}",
    "",
    "function applyExampleTheme(",
    "  target: ExampleThemeTarget,",
    "  theme: RendererThemeValues,",
    "): void {",
    "  for (const [token, value] of Object.entries(theme)) {",
    "    if (value === undefined) {",
    "      continue;",
    "    }",
    "",
    "    target.setThemeVariable(`--faux-ui-color-${token}`, value);",
    "  }",
    "}",
    "",
  ].join("\n");
}

function buildRendererTemplateTest(): string {
  return [
    'import { createElement } from "react";',
    'import { describe, expect, it } from "vitest";',
    "",
    'import { exampleRenderer, render } from "../src/index.js";',
    "",
    'describe("example renderer template", () => {',
    '  it("mounts and updates through the host bridge", () => {',
    "    const events: string[] = [];",
    '    const mounted = render(createElement("view" as never), {',
    "      host: {",
    "        mount(root) {",
    "          events.push(`mount:${root.kind}`);",
    "        },",
    "        update(root) {",
    "          events.push(`update:${root.kind}`);",
    "        },",
    "        unmount() {",
    '          events.push("unmount");',
    "        },",
    "      },",
    "    });",
    "",
    "    expect(exampleRenderer.name).toBeTruthy();",
    "    expect(mounted.getCapabilities().supportsThemeTarget).toBe(true);",
    "    expect(mounted.getThemeTarget().variables).toEqual({});",
    '    mounted.update(createElement("text" as never, undefined, "next"));',
    "    mounted.rerender();",
    "    mounted.unmount();",
    "",
    "    expect(events).toEqual([",
    '      "mount:view",',
    '      "update:text",',
    '      "update:text",',
    '      "unmount",',
    "    ]);",
    "  });",
    "});",
    "",
  ].join("\n");
}

function buildTuiApp(name: string): string {
  return [
    'import { render } from "@faux-ui/app";',
    "",
    `const appName = ${JSON.stringify(name)};`,
    "",
    "render(",
    "  <view rows={[1, 1, 1, 1]}>",
    "    <text>{`${appName} starter`}</text>",
    "    <view focusable>",
    "      <text>This card is focusable.</text>",
    "    </view>",
    "    <text>faux-ui is rendering this layout through the TUI runtime.</text>",
    "    <text>Press Ctrl+C to exit.</text>",
    "  </view>,",
    ");",
  ].join("\n");
}

function buildDomIndexHtml(name: string): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="UTF-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `    <title>${name}</title>`,
    '    <link rel="stylesheet" href="/src/styles.css" />',
    "  </head>",
    "  <body>",
    '    <script type="module" src="/src/main.tsx"></script>',
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}

function buildDomApp(name: string): string {
  return [
    'import { useState } from "react";',
    'import { render } from "@faux-ui/app";',
    'import "./styles.css";',
    "",
    `const appName = ${JSON.stringify(name)};`,
    "",
    "function App() {",
    "  const [count, setCount] = useState(0);",
    "",
    "  return (",
    '    <view rows={[56, 96, 44]} style={{ background: "bg" }}>',
    '      <view rows={[28, 28]} style={{ background: "accent" }}>',
    '        <text style={{ color: "inverse" }}>{`${appName} starter`}</text>',
    '        <text style={{ color: "inverse" }}>DOM runtime with React state</text>',
    "      </view>",
    '      <view rows={[30, 54]} focusable onClick={() => setCount((c) => c + 1)} onPress={() => setCount((c) => c + 1)} style={{ background: "selection" }} styleHover={{ background: "focus" }} styleFocus={{ background: "focus" }}>',
    '        <text style={{ color: "accent" }}>Interaction card</text>',
    '        <text style={{ color: "fg" }}>{`Count: ${count}`}</text>',
    "      </view>",
    '      <text style={{ color: "muted" }}>Click the card or use Tab plus Enter to update state.</text>',
    "    </view>",
    "  );",
    "}",
    "",
    "render(<App />);",
    "",
  ].join("\n");
}

function buildDomStyles(): string {
  return [
    ":root {",
    "  font-family: monospace;",
    "  --faux-ui-font-family: monospace;",
    "  --faux-ui-cell-width: 1ch;",
    "  --faux-ui-cell-height: 1em;",
    "}",
    "",
    "* {",
    "  box-sizing: border-box;",
    "}",
    "",
    "html,",
    "body {",
    "  margin: 0;",
    "  width: 100%;",
    "  min-height: 100%;",
    "}",
    "",
    "body {",
    "  position: relative;",
    "  min-height: 100vh;",
    "  overflow: hidden;",
    "  background: #fffdf7;",
    "}",
    "",
  ].join("\n");
}

function buildDocumentSpec(name: string): Record<string, unknown> {
  return {
    version: 1,
    root: {
      kind: "view",
      rows: ["auto", "auto", "auto"],
      bind: {
        click: "open-root",
        dragStart: "drag-root-start",
        drag: "drag-root",
        dragEnd: "drag-root-end",
      },
      children: [
        { kind: "text", text: `${name} starter` },
        {
          kind: "text",
          text: "Use exec-faux-ui to inspect or render this document.",
        },
        {
          kind: "text",
          text: "Run exec-faux-ui src/document.json --inspect bindings to see the drag tokens.",
        },
      ],
    },
  };
}

function buildUsage(): string {
  return [
    "Usage: create-faux-ui <name> [--template jsx|json|hybrid|renderer] [--renderer dom|tui] [--pm bun|npm|pnpm]",
    "- jsx creates a TypeScript + JSX starter, defaulting to the TUI renderer",
    "- json creates a schema document starter for exec-faux-ui",
    "- hybrid creates both JSX and JSON entrypoints",
    "- renderer creates a third-party renderer package starter built on @faux-ui/renderer",
    "- --renderer applies only to JSX and hybrid starters",
  ].join("\n");
}

function ensureTargetDirectory(rootDir: string): void {
  if (!existsSync(rootDir)) {
    mkdirSync(rootDir, { recursive: true });
    return;
  }

  if (readdirSync(rootDir).length > 0) {
    throw new Error(`Target directory is not empty: ${rootDir}`);
  }
}

function parseTemplate(value: string): ScaffoldTemplate {
  if (
    value === "jsx" ||
    value === "json" ||
    value === "hybrid" ||
    value === "renderer"
  ) {
    return value;
  }

  throw new Error(`Unsupported template: ${value}`);
}

function parseRenderer(value: string): ScaffoldRenderer {
  if (value === "dom" || value === "tui") {
    return value;
  }

  throw new Error(`Unsupported renderer: ${value}`);
}

function parsePackageManager(value: string): PackageManager {
  if (value === "bun" || value === "npm" || value === "pnpm") {
    return value;
  }

  throw new Error(`Unsupported package manager: ${value}`);
}

function requireOptionValue(
  args: string[],
  index: number,
  flag: string,
): string {
  const value = args[index];
  if (value === undefined) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function buildInstallCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case "bun":
      return "bun install";
    case "npm":
      return "npm install";
    case "pnpm":
      return "pnpm install";
  }
}

function buildStartCommand(
  template: ScaffoldTemplate,
  packageManager: PackageManager,
): string {
  const runner = resolvePackageManagerBinary(packageManager);

  if (template === "renderer") {
    return `${runner} run test`;
  }

  if (template === "json") {
    return `${runner} run preview:tui`;
  }

  return `${runner} run start`;
}

function resolvePackageManagerBinary(packageManager: PackageManager): string {
  switch (packageManager) {
    case "bun":
      return "bun";
    case "npm":
      return "npm";
    case "pnpm":
      return "pnpm";
  }
}

function resolvePackageManagerField(
  packageManager: PackageManager,
): string | null {
  switch (packageManager) {
    case "bun":
      return "bun@1.3.10";
    case "pnpm":
      return "pnpm@9";
    case "npm":
      return null;
  }
}

function formatScaffoldError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
