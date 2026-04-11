import { describe, expect, it } from "vitest";
import { isValidElement } from "react";

import { Action } from "../src/index.js";

describe("action", () => {
  it("creates an interactive action when a handler is provided", () => {
    const node = Action({
      title: "Launch",
      description: "Stable action primitive",
      onPress: () => {},
    });

    expect(isValidElement(node)).toBe(true);
    expect(node?.props.focusable).toBe(true);
    expect(typeof node?.props.onPress).toBe("function");
  });

  it("drops focusability when disabled", () => {
    const node = Action({
      title: "Disabled",
      description: "Not interactive",
      disabled: true,
      onPress: () => {},
    });

    expect(node?.props.focusable).toBe(false);
    expect(node?.props.onPress).toBeUndefined();
  });
});
