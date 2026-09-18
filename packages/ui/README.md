# @faux-ui/ui

Deterministic terminal-first React UI with a browser mirror. Version 0.10.0 is a pre-1.0 evidence candidate.

```bash
bun add @faux-ui/ui react
```

Configure TypeScript:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@faux-ui/ui"
  }
}
```

Author one shared application:

```tsx
import { Button, Rows, Text } from "@faux-ui/ui";

export function App() {
  return (
    <Rows tracks={[1, 1]}>
      <Text>Hello from cells</Text>
      <Button label="Run" onPress={() => console.log("run")} />
    </Rows>
  );
}
```

Mount it in a browser without app CSS:

```tsx
import { render } from "@faux-ui/ui/dom";
import { App } from "./App.js";

render(<App />, { ariaLabel: "Example" });
```

Or mount it in a terminal:

```tsx
import { render } from "@faux-ui/ui/tui";
import { App } from "./App.js";

render(<App />);
```

`Rows` gives each child a row track (height); `Columns` gives each child a column track (width). Both accept fixed-cell, `auto`, and fraction tracks. `Text` uses one optional axis object, such as `align={{ x: "end", y: "center" }}`.

Large or streaming values should use an immutable `TextSource`, passed as `<Text source={...} />`. `createTextSource` establishes or resets the value, `appendTextSourceSegment` adds one segment in order, `extendTextSourceSegment` adds a delta to a named segment's end, and `replaceTextSourceSegment` swaps a named segment in place. String children remain supported. `TextSource` lets Faux UI index the complete value once and then prepare only the visible window plus bounded overscan. Creation and replacement re-index the affected content; append and extension stay bounded by the changed delta and its unfinished Unicode boundary. Several source updates may reach one React commit; Faux UI compares persistent source identities, preserves proven ranges, and rebuilds only the suffix after the earliest unproven change. Ordinary terminal updates then write only changed rows instead of clearing the screen. `ScrollView.followEnd` accepts `boolean | "x" | "y" | "both"` and follows each selected enabled axis independently. `Home` and `End` scroll the vertical axis when it can scroll and return the horizontal offset to 0; a viewport without vertical overflow keeps horizontal `Home` and `End`.

Optional `@faux-ui/grid` adds shared two-axis tracks, numeric placement, and spans. Third-party layout component authors can use the advanced pure-cell contract at `@faux-ui/ui/layout`; ordinary applications should prefer the foundation components.

## Agent Skill

The tarball includes one standards-compatible `faux-ui` skill plus thin discovery metadata for multiple hosts:

- Pi: `package.json#pi.skills`;
- Codex/ChatGPT: `.codex-plugin/plugin.json`;
- Claude Code: `.claude-plugin/plugin.json`.

Installing the npm dependency does not automatically enable it in Codex or Claude. Enable the corresponding plugin, or link `skills/faux-ui` into `.agents/skills/faux-ui` or `.claude/skills/faux-ui`. See the [cross-agent packaging reference](https://github.com/deniss-muhla/faux-ui/blob/main/docs/agent-skill-packaging.md) for details and official references.

Static tests use `@faux-ui/ui/testing`. Production applications that pre-wrap text can import `splitGraphemes` and `lineCellWidth` from `@faux-ui/ui`; these helpers use the same grapheme and terminal-cell rules as rendering.

See the [repository README](https://github.com/deniss-muhla/faux-ui#readme) for layout, interaction, Unicode, theming, and host options.

MIT licensed. Generated Unicode tables are distributed under the included Unicode License v3 notice.
