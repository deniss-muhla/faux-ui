import { render } from "@faux-ui/ui/tui";

import { ExampleApp } from "./example-app.js";

const app = render(<ExampleApp />);

process.once("SIGTERM", () => app.unmount());
process.once("uncaughtException", (error) => {
  app.unmount();
  throw error;
});
