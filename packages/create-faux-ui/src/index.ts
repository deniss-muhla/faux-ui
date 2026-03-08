#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type ScaffoldTemplate = "jsx" | "json" | "hybrid";
export type PackageManager = "bun" | "npm" | "pnpm";
export type ScaffoldRenderer = "dom" | "tui";

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
  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {};
  const scripts: Record<string, string> = {};

  if (options.template === "jsx" || options.template === "hybrid") {
    dependencies["@faux-ui/reconciler"] = "0.1.0";
    dependencies.react = "^19.2.0";
    devDependencies["@types/react"] = "^19.2.2";
    devDependencies.typescript = "^5.9.0";
    scripts.typecheck = "tsc --noEmit";

    if (options.renderer === "tui") {
      dependencies["@faux-ui/tui"] = "0.1.0";
      devDependencies.tsx = "^4.20.6";
      scripts.start = "tsx src/app.tsx";
    } else {
      dependencies["@faux-ui/dom"] = "0.1.0";
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

function buildTsconfig(renderer: ScaffoldRenderer): Record<string, unknown> {
  const compilerOptions: Record<string, unknown> = {
    target: "ES2023",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    jsx: "react-jsx",
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

function buildReadme(options: ScaffoldOptions): string {
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
      path: "src/app.tsx",
      content: buildTuiApp(options.name),
    },
  ];
}

function buildTuiApp(name: string): string {
  return [
    'import { Text, View } from "@faux-ui/reconciler";',
    'import { renderTui } from "@faux-ui/tui";',
    "",
    `const appName = ${JSON.stringify(name)};`,
    "",
    "renderTui(",
    '  <View rows={[1, 1, 1, 1]} onClick="open-root">',
    "    <Text>{`${appName} starter`}</Text>",
    '    <View focusable onMouseDown="drag-card-down" onDragStart="drag-card-start" onDrag="drag-card" onDragEnd="drag-card-end">',
    "      <Text>Drag tokens are already bound on this card.</Text>",
    "    </View>",
    "    <Text>faux-ui is rendering this layout through the TUI runtime.</Text>",
    "    <Text>Press Ctrl+C to exit.</Text>",
    "  </View>,",
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
    '    <script type="module" src="/src/main.tsx"></script>',
    "  </head>",
    "  <body>",
    '    <div class="page">',
    '      <div class="page-copy">',
    `        <p class="eyebrow">${name}</p>`,
    "        <h1>faux-ui DOM starter</h1>",
    "        <p>Application-owned handlers resolve faux-ui action tokens and rerender the tree.</p>",
    "      </div>",
    '      <div id="app"></div>',
    "    </div>",
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}

function buildDomApp(name: string): string {
  return [
    'import { createDomTextMeasurer, renderDom, type DomElementLike, type MountedRenderedDomApp } from "@faux-ui/dom";',
    'import { Text, View } from "@faux-ui/reconciler";',
    'import "./styles.css";',
    "",
    `const appName = ${JSON.stringify(name)};`,
    'const host = document.querySelector<HTMLDivElement>("#app");',
    "if (host === null) {",
    '  throw new Error("Expected #app to exist.");',
    "}",
    "",
    'host.style.setProperty("--faux-ui-color-fg", "#1f2937");',
    'host.style.setProperty("--faux-ui-color-muted", "#4b5563");',
    'host.style.setProperty("--faux-ui-color-accent", "#0f766e");',
    'host.style.setProperty("--faux-ui-color-success", "#166534");',
    'host.style.setProperty("--faux-ui-color-warning", "#b45309");',
    'host.style.setProperty("--faux-ui-color-danger", "#b91c1c");',
    'host.style.setProperty("--faux-ui-color-bg", "#fffdf7");',
    'host.style.setProperty("--faux-ui-color-bgAlt", "#f3efe1");',
    'host.style.setProperty("--faux-ui-color-border", "#d6cfc3");',
    'host.style.setProperty("--faux-ui-color-focus", "#d7f4f0");',
    'host.style.setProperty("--faux-ui-color-selection", "#e7f5ef");',
    'host.style.setProperty("--faux-ui-color-inverse", "#fffaf2");',
    "",
    'const canvas = document.createElement("canvas");',
    'const context = canvas.getContext("2d");',
    "if (context === null) {",
    '  throw new Error("Expected a 2D canvas context.");',
    "}",
    "context.font = '16px \"Segoe UI\", sans-serif';",
    "",
    "const measureText = createDomTextMeasurer({",
    "  measureText({ text }) {",
    "    return {",
    "      width: Math.max(1, Math.ceil(context.measureText(text).width)),",
    "      height: 20,",
    "    };",
    "  },",
    "});",
    "",
    "let count = 0;",
    "let mounted: MountedRenderedDomApp<() => void> | null = null;",
    "",
    "renderApp();",
    'window.addEventListener("resize", () => {',
    "  mounted?.update(undefined, { constraints: readConstraints() });",
    "});",
    "",
    "function renderApp() {",
    "  const tree = ",
    '    <View rows={[56, 96, 44]} style={{ background: "bg" }}>',
    '      <View rows={[28, 28]} style={{ background: "accent" }}>',
    '        <Text style={{ color: "inverse" }}>{`${appName} starter`}</Text>',
    '        <Text style={{ color: "inverse" }}>DOM runtime with app-owned action handlers</Text>',
    "      </View>",
    '      <View rows={[30, 54]} focusable onClick="increment-count" onPress="increment-count" style={{ background: "selection" }} styleHover={{ background: "focus" }} styleFocus={{ background: "focus" }}>',
    '        <Text style={{ color: "accent" }}>Interaction card</Text>',
    '        <Text style={{ color: "fg" }}>{`Count: ${count}`}</Text>',
    "      </View>",
    '      <Text style={{ color: "muted" }}>Click the card or use Tab plus Enter to update state.</Text>',
    "    </View>;",
    "",
    "  if (mounted === null) {",
    "    mounted = renderDom<() => void>(tree, {",
    "      container: host as unknown as DomElementLike,",
    "      constraints: readConstraints(),",
    "      measureText: measureText.measure,",
    "      resolveAction(token) {",
    '        if (token !== "increment-count") {',
    "          return undefined;",
    "        }",
    "",
    "        return () => {",
    "          count += 1;",
    "          renderApp();",
    "        };",
    "      },",
    "    });",
    "    return;",
    "  }",
    "",
    "  mounted.update(tree, { constraints: readConstraints() });",
    "}",
    "",
    "function readConstraints() {",
    "  return {",
    "    maxWidth: Math.max(420, host.clientWidth - 32),",
    "    maxHeight: Math.max(220, host.clientHeight - 32),",
    "  };",
    "}",
    "",
  ].join("\n");
}

function buildDomStyles(): string {
  return [
    ":root {",
    '  font-family: "Segoe UI", sans-serif;',
    "  color: #1f2937;",
    "  background: linear-gradient(180deg, #f8f3e7 0%, #f2ecdf 100%);",
    "}",
    "",
    "* {",
    "  box-sizing: border-box;",
    "}",
    "",
    "body {",
    "  margin: 0;",
    "  min-height: 100vh;",
    "}",
    "",
    ".page {",
    "  min-height: 100vh;",
    "  padding: 32px 20px 40px;",
    "  display: grid;",
    "  gap: 18px;",
    "}",
    "",
    ".page-copy {",
    "  max-width: 720px;",
    "}",
    "",
    ".page-copy h1 {",
    "  margin: 0;",
    "  font-size: clamp(2.2rem, 5vw, 4rem);",
    "  line-height: 0.96;",
    "}",
    "",
    ".page-copy p {",
    "  margin: 8px 0 0;",
    "  color: #4b5563;",
    "}",
    "",
    ".eyebrow {",
    "  margin: 0 0 8px;",
    "  text-transform: uppercase;",
    "  letter-spacing: 0.16em;",
    "  font-size: 11px;",
    "  color: #8a5b2b;",
    "}",
    "",
    "#app {",
    "  position: relative;",
    "  width: min(100%, 640px);",
    "  height: 260px;",
    "  overflow: hidden;",
    "  border-radius: 24px;",
    "  border: 1px solid rgba(64, 52, 38, 0.12);",
    "  padding: 16px;",
    "  background: rgba(255, 255, 255, 0.9);",
    "  box-shadow: 0 20px 60px rgba(65, 52, 36, 0.16);",
    "}",
    "",
    "@media (max-width: 640px) {",
    "  #app {",
    "    height: 320px;",
    "  }",
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
    "Usage: create-faux-ui <name> [--template jsx|json|hybrid] [--renderer dom|tui] [--pm bun|npm|pnpm]",
    "- jsx creates a TypeScript + JSX starter, defaulting to the TUI renderer",
    "- json creates a schema document starter for exec-faux-ui",
    "- hybrid creates both JSX and JSON entrypoints",
    "- renderer applies to JSX and hybrid starters",
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
  if (value === "jsx" || value === "json" || value === "hybrid") {
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
