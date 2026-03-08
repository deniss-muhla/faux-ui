import { describe, expect, it } from "vitest";

import {
  type DocumentSpec,
  decodeCompactDocument,
  encodeCompactDocument,
  validateDocumentSpec,
} from "../src/index.js";

describe("schema validation", () => {
  it("validates a readable document spec", () => {
    const result = validateDocumentSpec({
      version: 1,
      root: {
        kind: "view",
        rows: ["auto", "1fr"],
        columns: [12, "2fr"],
        scroll: "y",
        children: [
          { kind: "text", text: "Title" },
          { kind: "view", focusable: true },
        ],
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.root.kind).toBe("view");
    }
  });

  it("rejects unknown fields in readable documents", () => {
    const result = validateDocumentSpec({
      version: 1,
      root: {
        kind: "text",
        text: "hello",
        unexpected: true,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain("Unknown field");
    }
  });

  it("decodes compact documents into readable specs", () => {
    const result = decodeCompactDocument([
      "FUI",
      1,
      [
        "V",
        { r: ["auto", "1fr"], c: [10, "1fr"], x: "y" },
        [
          ["T", "Header"],
          ["V", { f: true }],
        ],
      ],
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.root.kind).toBe("view");
      if (result.value.root.kind === "view") {
        expect(result.value.root.scroll).toBe("y");
        expect(result.value.root.children).toHaveLength(2);
      }
    }
  });

  it("round-trips readable documents through the compact codec", () => {
    const document: DocumentSpec = {
      version: 1,
      root: {
        kind: "view",
        columns: [8, "1fr"],
        bind: {
          click: "open-menu",
          dragStart: "start-menu-drag",
          drag: "drag-menu",
          dragEnd: "end-menu-drag",
        },
        children: [
          { kind: "text", text: "Menu", style: { color: "accent" } },
          { kind: "view", scroll: "y" },
        ],
      },
    };

    const compact = encodeCompactDocument(document);
    const decoded = decodeCompactDocument(compact);

    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value).toEqual(document);
    }
  });

  it("rejects invalid compact tags", () => {
    const result = decodeCompactDocument(["FUI", 1, ["X"]]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain("Compact node tag");
    }
  });

  it("accepts additive drag bindings in readable documents", () => {
    const result = validateDocumentSpec({
      version: 1,
      root: {
        kind: "view",
        bind: {
          mouseDown: "start-press",
          dragStart: "drag-start",
          drag: "dragging",
          dragEnd: "drag-end",
        },
      },
    });

    expect(result.ok).toBe(true);
  });
});
