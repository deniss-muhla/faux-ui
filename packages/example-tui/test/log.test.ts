import { describe, expect, it } from "vitest";

import { appendEventEntries, createEventEntries } from "../src/log.js";

describe("example-tui log helpers", () => {
  it("keeps duplicate messages uniquely keyed", () => {
    const events = createEventEntries(["Lane set to build."]);
    const next = appendEventEntries(events, "Lane set to build.", 8);

    expect(next).toHaveLength(2);
    expect(next[0]?.message).toBe("Lane set to build.");
    expect(next[1]?.message).toBe("Lane set to build.");
    expect(next[0]?.id).not.toBe(next[1]?.id);
  });
});
