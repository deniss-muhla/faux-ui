#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const temporary = mkdtempSync(join(tmpdir(), "faux-ui-grid-package-"));
const packed = join(temporary, "packed");
const fixture = join(temporary, "consumer");
mkdirSync(packed);
mkdirSync(fixture);

const run = (command, args, cwd = root) =>
  execFileSync(command, args, { cwd, encoding: "utf8", stdio: "pipe" });

try {
  run("bun", ["run", "--cwd", "packages/ui", "build"]);
  run("bun", ["run", "--cwd", "packages/grid", "build"]);
  const uiArchiveName = run(
    "npm",
    ["pack", "./packages/ui", "--pack-destination", packed, "--silent"],
  ).trim();
  const gridArchiveName = run(
    "npm",
    ["pack", "./packages/grid", "--pack-destination", packed, "--silent"],
  ).trim();
  const uiArchive = join(packed, uiArchiveName);
  const gridArchive = join(packed, gridArchiveName);

  if (uiArchiveName !== "faux-ui-ui-0.9.1.tgz") {
    throw new Error(`Unexpected UI archive: ${uiArchiveName}`);
  }
  if (gridArchiveName !== "faux-ui-grid-0.1.0.tgz") {
    throw new Error(`Unexpected Grid archive: ${gridArchiveName}`);
  }

  writeFileSync(
    join(fixture, "package.json"),
    JSON.stringify(
      {
        name: "faux-ui-grid-clean-consumer",
        private: true,
        type: "module",
        dependencies: {
          "@faux-ui/grid": `file:${gridArchive}`,
          "@faux-ui/ui": `file:${uiArchive}`,
          react: "19.2.8",
        },
        devDependencies: {
          "@types/react": "19.2.18",
          typescript: "7.0.2",
          vite: "8.2.0",
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(fixture, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2023",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
          jsx: "react-jsx",
          jsxImportSource: "@faux-ui/ui",
          lib: ["ES2023", "DOM", "DOM.Iterable"],
          types: ["react"],
        },
        include: ["*.ts", "*.tsx"],
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(fixture, "app.tsx"),
    `import { Grid, GridItem } from "@faux-ui/grid";
import { Text } from "@faux-ui/ui";
export function App() {
  return <Grid columns={[6, "1fr"]} rows={[1, 2]} gap={{x:1}} border title="Packed grid">
    <GridItem columnSpan={2}><Text>Header</Text></GridItem>
    <Text>Left</Text>
    <Text align={{x:"end"}}>Right</Text>
  </Grid>;
}
`,
  );
  writeFileSync(
    join(fixture, "dom.tsx"),
    `import { render } from "@faux-ui/ui/dom";
import { App } from "./app.js";
export const mount = () => render(<App />, { width: 24, height: 6 });
`,
  );
  writeFileSync(
    join(fixture, "tui.tsx"),
    `import { render } from "@faux-ui/ui/tui";
import { App } from "./app.js";
class Input { isTTY=true; listener=(_:Uint8Array|string)=>{}; setRawMode(_:boolean){} resume(){} pause(){} on(_:"data",listener:(chunk:Uint8Array|string)=>void){this.listener=listener} off(){} }
class Output { isTTY=true; columns=24; rows=6; chunks:string[]=[]; write(chunk:string){this.chunks.push(chunk)} on(){} off(){} }
const input=new Input(); const output=new Output();
const app=render(<App />, {input,output,mouse:false});
if (!output.chunks.join("").includes("Header")) throw new Error("Packed Grid did not render in TUI");
app.unmount();
`,
  );
  writeFileSync(
    join(fixture, "static.tsx"),
    `import { Grid } from "@faux-ui/grid";
import { Text } from "@faux-ui/ui";
import { renderStatic } from "@faux-ui/ui/testing";
const app=renderStatic(<Grid columns={[3,3]} rows={[1]}><Text>A</Text><Text>B</Text></Grid>,{width:6,height:1});
if (app.getText() !== "A  B  ") throw new Error("Packed Grid static scene mismatch: "+JSON.stringify(app.getText()));
app.unmount();
`,
  );
  writeFileSync(
    join(fixture, "index.html"),
    "<!doctype html><div id=\"app\"></div><script type=\"module\" src=\"/dom.tsx\"></script>",
  );

  // npm resolves two local scoped tarballs together; the current Bun canary
  // incorrectly queries the registry for Grid's unpublished UI peer.
  run("npm", ["install", "--ignore-scripts"], fixture);
  run("bunx", ["tsc", "-p", "tsconfig.json"], fixture);
  run(
    "bun",
    [
      "build",
      "dom.tsx",
      "--target",
      "browser",
      "--outdir",
      "bun-dist",
      "--metafile=bun-meta.json",
    ],
    fixture,
  );
  run("bunx", ["vite", "build", "--outDir", "vite-dist"], fixture);
  run("bun", ["tui.tsx"], fixture);
  run("bun", ["static.tsx"], fixture);

  const gridRoot = join(fixture, "node_modules", "@faux-ui", "grid");
  const installedManifest = JSON.parse(
    readFileSync(join(gridRoot, "package.json"), "utf8"),
  );
  if (installedManifest.version !== "0.1.0") {
    throw new Error(`Installed Grid version is ${installedManifest.version}`);
  }
  if (Object.keys(installedManifest.dependencies ?? {}).length !== 0) {
    throw new Error("Grid package must have no direct runtime dependencies.");
  }
  if (installedManifest.peerDependencies?.["@faux-ui/ui"] !== "^0.9.1") {
    throw new Error("Grid package has the wrong @faux-ui/ui peer range.");
  }
  if (JSON.stringify(installedManifest.pi?.skills) !== '["./skills"]') {
    throw new Error("Grid package does not declare its Pi skill directory.");
  }

  const codexManifestPath = join(
    gridRoot,
    ".codex-plugin",
    "plugin.json",
  );
  const claudeManifestPath = join(
    gridRoot,
    ".claude-plugin",
    "plugin.json",
  );
  if (!existsSync(codexManifestPath) || !existsSync(claudeManifestPath)) {
    throw new Error("Packed Grid cross-agent plugin manifests are missing.");
  }
  const codexManifest = JSON.parse(readFileSync(codexManifestPath, "utf8"));
  const claudeManifest = JSON.parse(readFileSync(claudeManifestPath, "utf8"));
  for (const [host, manifest] of [
    ["Codex", codexManifest],
    ["Claude", claudeManifest],
  ]) {
    if (
      manifest.name !== "faux-ui-grid" ||
      manifest.version !== installedManifest.version
    ) {
      throw new Error(`${host} plugin identity/version does not match Grid.`);
    }
  }
  if (codexManifest.skills !== "./skills/") {
    throw new Error("Codex plugin does not reference the canonical skill.");
  }

  const skillPath = join(gridRoot, "skills", "faux-ui-grid", "SKILL.md");
  if (!existsSync(skillPath)) throw new Error("Packed Grid skill is missing.");
  const skill = readFileSync(skillPath, "utf8");
  if (
    !skill.startsWith("---\nname: faux-ui-grid\n") ||
    !skill.includes("description:") ||
    !skill.includes("license: MIT") ||
    !skill.includes("compatibility:") ||
    !skill.includes("@faux-ui/grid")
  ) {
    throw new Error("Packed Grid skill frontmatter is invalid.");
  }

  const sourceRoot = join(gridRoot, "src");
  const sourcePath = join(sourceRoot, "index.tsx");
  if (!existsSync(sourcePath)) {
    throw new Error("Packed Grid reference source is missing.");
  }
  const gridSource = readdirSync(sourceRoot)
    .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
    .map((name) => readFileSync(join(sourceRoot, name), "utf8"))
    .join("\n");
  const distRoot = join(gridRoot, "dist");
  const gridDist = readdirSync(distRoot)
    .filter((name) => name.endsWith(".js"))
    .map((name) => readFileSync(join(distRoot, name), "utf8"))
    .join("\n");
  for (const forbidden of [
    "@faux-ui/ui/internal",
    "packages/ui/src",
    "../ui/src",
  ]) {
    if (gridSource.includes(forbidden) || gridDist.includes(forbidden)) {
      throw new Error(`Grid package leaked internal UI reference: ${forbidden}`);
    }
  }

  const fauxPackages = run(
    "bash",
    [
      "-lc",
      "find node_modules/@faux-ui -mindepth 1 -maxdepth 1 -type d -printf '%f\\n' | sort",
    ],
    fixture,
  ).trim();
  if (fauxPackages !== "grid\nui") {
    throw new Error(`Expected only @faux-ui/grid and @faux-ui/ui, found: ${fauxPackages}`);
  }

  const bunMeta = JSON.parse(
    readFileSync(join(fixture, "bun-meta.json"), "utf8"),
  );
  for (const input of Object.values(bunMeta.inputs ?? {})) {
    for (const imported of input.imports ?? []) {
      if (
        String(imported.path).startsWith("node:") ||
        String(imported.original ?? "").startsWith("node:")
      ) {
        throw new Error(
          `Grid DOM graph leaked Node import: ${imported.original ?? imported.path}`,
        );
      }
    }
  }

  const browserBundles = [
    readFileSync(join(fixture, "bun-dist", "dom.js"), "utf8"),
    ...run(
      "bash",
      ["-lc", "find vite-dist/assets -type f -name '*.js' -print"],
      fixture,
    )
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((path) => readFileSync(join(fixture, path), "utf8")),
  ].join("\n");
  for (const forbidden of [
    "node:process",
    "node:tty",
    "__vite-browser-external",
    "?1049h",
    "ENTER_ALTERNATE_SCREEN",
  ]) {
    if (browserBundles.includes(forbidden)) {
      throw new Error(`Grid browser bundle leaked TUI/Node marker: ${forbidden}`);
    }
  }

  console.log(`Packed Grid consumer passed: ${gridArchiveName}`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
