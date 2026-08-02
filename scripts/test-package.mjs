#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const temporary = mkdtempSync(join(tmpdir(), "faux-ui-package-"));
const packed = join(temporary, "packed");
const fixture = join(temporary, "consumer");
mkdirSync(packed);
mkdirSync(fixture);

const run = (command, args, cwd = root) =>
  execFileSync(command, args, { cwd, encoding: "utf8", stdio: "pipe" });

try {
  run("bun", ["run", "--cwd", "packages/ui", "build"]);
  const archiveName = run(
    "npm",
    ["pack", "./packages/ui", "--pack-destination", packed, "--silent"],
  ).trim();
  const archive = join(packed, archiveName);

  writeFileSync(
    join(fixture, "package.json"),
    JSON.stringify(
      {
        name: "faux-ui-clean-consumer",
        private: true,
        type: "module",
        dependencies: {
          "@faux-ui/ui": `file:${archive}`,
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
    join(fixture, "tsconfig.dom.json"),
    JSON.stringify(
      {
        extends: "./tsconfig.json",
        compilerOptions: { lib: ["ES2023", "DOM", "DOM.Iterable"] },
        include: ["app.tsx", "dom.tsx"],
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(fixture, "tsconfig.tui.json"),
    JSON.stringify(
      {
        extends: "./tsconfig.json",
        compilerOptions: { lib: ["ES2023"] },
        include: ["app.tsx", "tui.tsx"],
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(fixture, "app.tsx"),
    `import { Button, Columns, Rows, Text, useInput } from "@faux-ui/ui";
export function App() {
  useInput(() => false);
  return <Rows tracks={[1, "1fr"]}><Text>packed</Text><Columns tracks={["1fr", "auto"]}><Text>consumer</Text><Button label="Run" keyHint="r" focusStyle={{background:"focus"}} hoverStyle={{background:"selection"}} onPress={() => {}} /></Columns></Rows>;
}
`,
  );
  writeFileSync(
    join(fixture, "dom.tsx"),
    `import { render } from "@faux-ui/ui/dom";
import { App } from "./app.js";
export const mount = () => render(<App />, { width: 20, height: 4 });
`,
  );
  writeFileSync(
    join(fixture, "tui.tsx"),
    `import { render } from "@faux-ui/ui/tui";
import { App } from "./app.js";
class Input { isTTY=true; listener=(_: Uint8Array|string)=>{}; setRawMode(_:boolean){} resume(){} pause(){} on(_:"data", listener:(chunk:Uint8Array|string)=>void){this.listener=listener} off(){} }
class Output { isTTY=true; columns=20; rows=4; chunks:string[]=[]; write(chunk:string){this.chunks.push(chunk)} on(){} off(){} }
const input=new Input(); const output=new Output();
const app=render(<App />, { input, output, mouse:false });
input.listener("\\t\\r");
if (!output.chunks.join("").includes("packed")) throw new Error("TUI fixture did not render");
app.unmount();
`,
  );
  writeFileSync(
    join(fixture, "tui-node.mjs"),
    `import { createElement } from "react";
import { Text } from "@faux-ui/ui";
import { render } from "@faux-ui/ui/tui";
class Input { constructor(){this.isTTY=true;this.listener=()=>{}} setRawMode(){} resume(){} pause(){} on(_,listener){this.listener=listener} off(){} }
class Output { constructor(){this.isTTY=true;this.columns=20;this.rows=2;this.chunks=[]} write(chunk){this.chunks.push(chunk)} on(){} off(){} }
const input=new Input(); const output=new Output();
const app=render(createElement(Text,null,"node-host"), { input, output, mouse:false });
if (!output.chunks.join("").includes("node-host")) throw new Error("Node TUI fixture did not render");
app.unmount();
`,
  );
  writeFileSync(
    join(fixture, "index.html"),
    `<!doctype html><div id="app"></div><script type="module" src="/dom.tsx"></script>`,
  );

  run("bun", ["install"], fixture);
  run("bunx", ["tsc", "-p", "tsconfig.json"], fixture);
  run("bunx", ["tsc", "-p", "tsconfig.dom.json"], fixture);
  run("bunx", ["tsc", "-p", "tsconfig.tui.json"], fixture);
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
  run("node", ["tui-node.mjs"], fixture);

  const fauxPackages = run(
    "bash",
    ["-lc", "find node_modules/@faux-ui -mindepth 1 -maxdepth 1 -type d -printf '%f\\n' | sort"],
    fixture,
  ).trim();
  if (fauxPackages !== "ui") {
    throw new Error(`Expected only @faux-ui/ui, found: ${fauxPackages}`);
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
        throw new Error(`DOM module graph leaked Node import: ${imported.original ?? imported.path}`);
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
      throw new Error(`DOM bundle leaked TUI/Node marker: ${forbidden}`);
    }
  }

  console.log(`Packed consumer passed: ${archiveName}`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
