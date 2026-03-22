import { describe, expect, it } from "vitest";

import { appendEventEntries, createEventEntries } from "../src/log.js";

describe("example log helpers", () => {
  it("keeps duplicate messages uniquely keyed", () => {
    const events = createEventEntries(["Lane changed to Active."]);
    const next = appendEventEntries(events, "Lane changed to Active.", 10);

    expect(next).toHaveLength(2);
    expect(next[0]?.message).toBe("Lane changed to Active.");
    expect(next[1]?.message).toBe("Lane changed to Active.");
    expect(next[0]?.id).not.toBe(next[1]?.id);
  });
});
