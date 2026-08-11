import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { splitGraphemes } from "../src/internal/unicode.js";

const fixture = readFileSync(
  resolve(import.meta.dirname, "fixtures/GraphemeBreakTest-17.0.0.txt"),
  "utf8",
);

describe("Unicode 17 grapheme conformance", () => {
  it("passes every official default grapheme boundary case", () => {
    let cases = 0;
    for (const rawLine of fixture.split("\n")) {
      const source = rawLine.split("#", 1)[0]?.trim() ?? "";
      if (source === "") continue;
      const tokens = source.split(/\s+/u);
      let input = "";
      let current = "";
      const expected: string[] = [];
      for (let index = 1; index < tokens.length; index += 2) {
        const code = tokens[index];
        if (code === undefined) continue;
        const marker = tokens[index - 1];
        if (marker === "÷" && current !== "") {
          expected.push(current);
          current = "";
        }
        const character = String.fromCodePoint(Number.parseInt(code, 16));
        input += character;
        current += character;
      }
      if (current !== "") expected.push(current);
      expect(splitGraphemes(input), `case ${cases + 1}: ${source}`).toEqual(
        expected,
      );
      cases += 1;
    }
    expect(cases).toBeGreaterThan(700);
  });
});
