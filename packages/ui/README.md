# @faux-ui/ui

Deterministic terminal-first React UI with a browser mirror. Version 0.9.1 is a pre-1.0 evidence candidate.

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

`Rows` gives each child a row track (height); `Columns` gives each child a column track (width). Both accept fixed-cell, `auto`, and fraction tracks.

Static tests use `@faux-ui/ui/testing`.

See the [repository README](https://github.com/deniss-muhla/faux-ui#readme) for layout, interaction, Unicode, theming, and host options.

MIT licensed. Generated Unicode tables are distributed under the included Unicode License v3 notice.
