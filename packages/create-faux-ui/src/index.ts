#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type ScaffoldTemplate = "jsx" | "json" | "hybrid";
export type PackageManager = "bun" | "npm" | "pnpm";

export interface ScaffoldOptions {
  name: string;
  template: ScaffoldTemplate;
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
      content: `${JSON.stringify(buildTsconfig(), null, 2)}\n`,
    });
  }

  switch (options.template) {
    case "jsx":
      files.push({
        path: "src/app.tsx",
        content: buildJsxApp(options.name),
      });
      break;
    case "json":
      files.push({
        path: "src/document.json",
        content: `${JSON.stringify(buildDocumentSpec(options.name), null, 2)}\n`,
      });
      break;
    case "hybrid":
      files.push(
        {
          path: "src/app.tsx",
          content: buildJsxApp(options.name),
        },
        {
          path: "src/document.json",
          content: `${JSON.stringify(buildDocumentSpec(options.name), null, 2)}\n`,
        },
      );
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
    dependencies["@faux-ui/tui"] = "0.1.0";
    dependencies.react = "^19.2.0";
    devDependencies["@types/react"] = "^19.2.2";
    devDependencies.tsx = "^4.20.6";
    devDependencies.typescript = "^5.9.0";
    scripts.start = "tsx src/app.tsx";
    scripts.typecheck = "tsc --noEmit";
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

function buildTsconfig(): Record<string, unknown> {
  return {
    compilerOptions: {
      target: "ES2023",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      jsx: "react-jsx",
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
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
    `Starter generated by create-faux-ui using the ${templateLabel} template.`,
    "",
    "## Commands",
    "",
    `- Install: ${buildInstallCommand(options.packageManager)}`,
    `- Start: ${buildStartCommand(options.template, options.packageManager)}`,
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
    "",
  ].join("\n");
}

function buildJsxApp(name: string): string {
  return [
    'import { createReconciler, Text, View } from "@faux-ui/reconciler";',
    'import { mountTerminalTuiHost } from "@faux-ui/tui";',
    "",
    `const appName = ${JSON.stringify(name)};`,
    "",
    "const reconciler = createReconciler();",
    "const root = reconciler.createRoot();",
    "",
    "root.render(",
    '  <View rows={[1, 1, 1, 1]} onClick="open-root">',
    "    <Text>{`${appName} starter`}</Text>",
    '    <View focusable onMouseDown="drag-card-down" onDragStart="drag-card-start" onDrag="drag-card" onDragEnd="drag-card-end">',
    "      <Text>Drag tokens are already bound on this card.</Text>",
    "    </View>",
    "    <Text>faux-ui is rendering this layout through the TUI runtime.</Text>",
    "    <Text>Press Ctrl+C to exit.</Text>",
    "  </View>,",
    ");",
    "",
    "const mounted = root.getMountedNode();",
    "if (mounted === null) {",
    '  throw new Error("Expected a single mounted root node.");',
    "}",
    "",
    "mountTerminalTuiHost(mounted).start();",
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
    "Usage: create-faux-ui <name> [--template jsx|json|hybrid] [--pm bun|npm|pnpm]",
    "- jsx creates a TypeScript + JSX TUI starter",
    "- json creates a schema document starter for exec-faux-ui",
    "- hybrid creates both JSX and JSON entrypoints",
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
