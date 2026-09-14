import { useState } from "react";
import { describe, expect, it } from "vitest";

import {
  appendTextSourceSegment,
  Button,
  createTextSource,
  extendTextSourceSegment,
  replaceTextSourceSegment,
  Rows,
  Text,
  type TextSourceSegment,
} from "@faux-ui/ui";
import {
  inspectTextSource,
  renderStatic,
  type TextSourceInspection,
} from "@faux-ui/ui/testing";

function inspect(
  source: Parameters<typeof inspectTextSource>[0],
): TextSourceInspection {
  return inspectTextSource(source);
}

describe("TextSource public contract", () => {
  it("snapshots creation and append inputs without inserting separators", () => {
    const first = { id: "first", text: "alpha" };
    const second = { id: "second", text: "" };
    const input = [first, second];
    const source = createTextSource(input);
    const appendedInput = { id: "third", text: "omega" };
    const appended = appendTextSourceSegment(source, appendedInput);

    first.id = "changed-id";
    first.text = "changed-text";
    second.text = "changed-empty";
    input.reverse();
    input.push({ id: "later", text: "mutation" });
    appendedInput.id = "changed-third";
    appendedInput.text = "changed-omega";

    const sourceInspection = inspect(source);
    const appendedInspection = inspect(appended);
    expect(sourceInspection).toMatchObject({
      text: "alpha",
      segments: [
        { id: "first", text: "alpha" },
        { id: "second", text: "" },
      ],
    });
    expect(appendedInspection).toMatchObject({
      text: "alphaomega",
      segments: [
        { id: "first", text: "alpha" },
        { id: "second", text: "" },
        { id: "third", text: "omega" },
      ],
    });
    expect(appended).not.toBe(source);
    expect(appendedInspection.segments[0]?.identity).toBe(
      sourceInspection.segments[0]?.identity,
    );
    expect(appendedInspection.segments[1]?.identity).toBe(
      sourceInspection.segments[1]?.identity,
    );
  });

  it("shares unchanged segments and an extended segment's prefix chunks", () => {
    const source = createTextSource([
      { id: "first", text: "A" },
      { id: "middle", text: "B" },
      { id: "last", text: "C" },
    ]);
    const extended = extendTextSourceSegment(source, "middle", "!");
    const before = inspect(source);
    const after = inspect(extended);

    expect(extended).not.toBe(source);
    expect(before.text).toBe("ABC");
    expect(after.text).toBe("AB!C");
    expect(after.segments.map(({ id }) => id)).toEqual([
      "first",
      "middle",
      "last",
    ]);
    expect(after.segments[0]?.identity).toBe(before.segments[0]?.identity);
    expect(after.segments[2]?.identity).toBe(before.segments[2]?.identity);
    expect(after.segments[1]?.identity).not.toBe(before.segments[1]?.identity);
    expect(after.segments[1]?.chunks.map(({ text }) => text)).toEqual([
      "B",
      "!",
    ]);
    expect(after.segments[1]?.chunks[0]?.identity).toBe(
      before.segments[1]?.chunks[0]?.identity,
    );
    expect(inspect(source)).toEqual(before);
  });

  it("replaces in place and creates an empty source as a reset", () => {
    const source = createTextSource([
      { id: "first", text: "A" },
      { id: "middle", text: "B" },
      { id: "last", text: "C" },
    ]);
    const replaced = replaceTextSourceSegment(source, "middle", "replacement");
    const before = inspect(source);
    const after = inspect(replaced);

    expect(replaced).not.toBe(source);
    expect(after.text).toBe("AreplacementC");
    expect(after.segments.map(({ id }) => id)).toEqual([
      "first",
      "middle",
      "last",
    ]);
    expect(after.segments[0]?.identity).toBe(before.segments[0]?.identity);
    expect(after.segments[2]?.identity).toBe(before.segments[2]?.identity);
    expect(after.segments[1]?.identity).not.toBe(before.segments[1]?.identity);
    expect(after.segments[1]?.chunks.map(({ text }) => text)).toEqual([
      "replacement",
    ]);

    const reset = createTextSource();
    expect(inspect(reset)).toEqual({ text: "", segments: [] });
    const emptyArrayReset = createTextSource([]);
    expect(inspect(emptyArrayReset)).toEqual({ text: "", segments: [] });
    expect(inspect(source)).toEqual(before);
  });

  it("rejects invalid IDs and leaves the prior source unchanged", () => {
    expect(() => createTextSource([{ id: "", text: "bad" }])).toThrow(
      TypeError,
    );
    expect(() =>
      createTextSource([
        { id: "same", text: "first" },
        { id: "same", text: "second" },
      ]),
    ).toThrow(RangeError);

    const source = createTextSource([{ id: "valid", text: "value" }]);
    const before = inspect(source);
    const failures: ReadonlyArray<readonly [() => unknown, ErrorConstructor]> =
      [
        [
          () => appendTextSourceSegment(source, { id: "", text: "bad" }),
          TypeError,
        ],
        [
          () => appendTextSourceSegment(source, { id: "valid", text: "bad" }),
          RangeError,
        ],
        [() => extendTextSourceSegment(source, "", "bad"), TypeError],
        [() => extendTextSourceSegment(source, "missing", "bad"), RangeError],
        [() => replaceTextSourceSegment(source, "", "bad"), TypeError],
        [() => replaceTextSourceSegment(source, "missing", "bad"), RangeError],
      ];

    for (const [operation, error] of failures) {
      expect(operation).toThrow(error);
      expect(inspect(source)).toEqual(before);
    }
  });

  it("renders sources through inspection and rejects mixed text inputs", () => {
    const source = createTextSource([
      { id: "left", text: "left" },
      { id: "right", text: "right" },
    ]);
    const app = renderStatic(<Text source={source} />, {
      width: 9,
      height: 1,
    });

    try {
      expect(app.getText()).toBe("leftright");
      expect(inspect(source).text).toBe("leftright");
    } finally {
      app.unmount();
    }

    const beforeFailure = inspect(source);
    expect(() =>
      renderStatic(<Text {...({ source } as object)}>mixed</Text>, {
        width: 5,
        height: 1,
      }),
    ).toThrow(TypeError);
    expect(inspect(source)).toEqual(beforeFailure);
  });

  it("keeps ordinary string children compatible", () => {
    const app = renderStatic(
      <Text>{["ordinary", " ", 7, ["!", null, false]]}</Text>,
      { width: 12, height: 1 },
    );

    try {
      expect(app.getText()).toBe("ordinary 7! ");
    } finally {
      app.unmount();
    }
  });

  it("updates a source through ordinary React state", async () => {
    const initial = createTextSource([{ id: "log", text: "A" }]);

    function SourceState() {
      const [source, setSource] = useState(initial);
      return (
        <Rows tracks={[1, 1]}>
          <Text source={source} />
          <Button
            label="extend"
            padding={0}
            onPress={() =>
              setSource((current) =>
                extendTextSourceSegment(current, "log", "B"),
              )
            }
          />
        </Rows>
      );
    }

    const app = renderStatic(<SourceState />, { width: 6, height: 2 });
    try {
      expect(app.getText()).toBe("A     \nextend");
      app.pointerDown({ x: 1, y: 1, button: 0 });
      app.pointerUp({ x: 1, y: 1, button: 0 });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(app.getText()).toBe("AB    \nextend");
    } finally {
      app.unmount();
    }
  });

  it("exposes no mutable source representation or runtime bridge", () => {
    const source = createTextSource([{ id: "typed", text: "value" }]);

    expect(Object.isFrozen(source)).toBe(true);
    expect(Reflect.ownKeys(source)).toEqual([]);
    expect(() => Object.assign(source, { segments: [] })).toThrow(TypeError);
    expect(inspect(source).text).toBe("value");
  });

  it("accepts the documented readonly segment type", () => {
    const segment: TextSourceSegment = { id: "typed", text: "value" };
    const source = createTextSource([segment]);
    expect(inspect(source).text).toBe("value");
  });
});
