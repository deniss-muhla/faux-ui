import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const moduleUrl = (relativePath: string): string =>
  `/@fs/${resolve(import.meta.dirname, relativePath)}`;

type HostParitySupport = typeof import("./support/large-text-host-parity.js");
type CanonicalHostScene =
  import("./support/large-text-host-parity.js").CanonicalHostScene;

test.describe("large text DOM parity", () => {
  test("matches static inspection through identical large input and commands", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/");

    const result = await page.evaluate(
      async ({ domUrl, supportUrl, testingUrl }) => {
        const support = (await import(supportUrl)) as HostParitySupport;
        const testing = await import(testingUrl);
        const dom = await import(domUrl);

        document.body.replaceChildren();
        document.body.setAttribute("style", "color: rgb(1, 2, 3)");
        const expectedBodyStyle = document.body.getAttribute("style");
        let source = support.createLargeTextHostParitySource();
        const staticRecorder = support.createHostParityRecorder();
        const domRecorder = support.createHostParityRecorder();
        const staticApp = testing.renderStatic(
          support.createLargeTextHostParityView(source, staticRecorder),
          support.LARGE_TEXT_HOST_PARITY_SIZE,
        );
        const domApp = dom.render(
          support.createLargeTextHostParityView(source, domRecorder),
          {
            container: document.body,
            width: support.LARGE_TEXT_HOST_PARITY_SIZE.width,
            height: support.LARGE_TEXT_HOST_PARITY_SIZE.height,
            cellSize: { width: 8, height: 16 },
            ariaLabel: "Large text parity",
          },
        );
        const surface = domApp.element;
        // Synthetic pointer events do not own an active browser pointer.
        surface.setPointerCapture = () => {};
        const snapshots: Array<{
          readonly label: string;
          readonly scene: CanonicalHostScene;
          readonly text: string;
          readonly visualText: string;
          readonly scrollOffsets: readonly {
            readonly x: number;
            readonly y: number;
          }[];
          readonly eventCount: number;
          readonly traceCount: number;
        }> = [];
        const sourceLengths = [testing.inspectTextSource(source).text.length];

        const record = (label: string): void => {
          const staticScene = staticApp.getScene();
          const domScene = domApp.getScene();
          const canonicalStatic = support.canonicalHostScene(staticScene);
          const canonicalDom = support.canonicalHostScene(domScene);
          if (
            JSON.stringify(canonicalStatic) !== JSON.stringify(canonicalDom)
          ) {
            throw new Error(`DOM scene differs from static scene at ${label}.`);
          }

          const text = testing.sceneToText(staticScene);
          const visualRows = Array.from(
            surface.querySelectorAll("[data-faux-ui-row]"),
          ) as HTMLElement[];
          const visualText = visualRows
            .map((row) => row.textContent ?? "")
            .join("\n");
          if (visualText !== text) {
            throw new Error(`DOM visible text differs at ${label}.`);
          }
          if (
            JSON.stringify(domRecorder.events) !==
            JSON.stringify(staticRecorder.events)
          ) {
            throw new Error(`DOM event trace differs at ${label}.`);
          }

          const rootId = staticApp.getLayout().root.nodeId;
          const textId = staticApp.getTextIndexes()[0]?.nodeId;
          if (textId === undefined) throw new Error("Expected one text index.");
          const expectedTrace = staticRecorder.events.map((event) => ({
            type: event.type,
            targetId: event.target.kind === "text" ? textId : rootId,
            currentTargetId:
              event.currentTarget.kind === "text" ? textId : rootId,
          }));
          if (
            JSON.stringify(staticApp.getEventTrace()) !==
            JSON.stringify(expectedTrace)
          ) {
            throw new Error(`Static event trace differs at ${label}.`);
          }

          snapshots.push({
            label,
            scene: canonicalStatic,
            text,
            visualText,
            scrollOffsets: staticRecorder.events
              .filter(
                (event) =>
                  event.type === "scroll" && event.offset !== undefined,
              )
              .map((event) => event.offset as { x: number; y: number }),
            eventCount: staticRecorder.events.length,
            traceCount: staticApp.getEventTrace().length,
          });
        };

        const dispatchKey = (key: string): void => {
          const staticResult = staticApp.keyDown({ key });
          const event = new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            key,
          });
          surface.dispatchEvent(event);
          if (staticResult.defaultPrevented !== event.defaultPrevented) {
            throw new Error(`Key handling differs for ${key}.`);
          }
        };

        const clientPoint = (x: number, y: number) => {
          const rect = surface.getBoundingClientRect();
          return {
            clientX: rect.left + (x + 0.5) * 8,
            clientY: rect.top + (y + 0.5) * 16,
          };
        };

        const dispatchPointerMove = (): void => {
          const point = { x: 3, y: 3, button: 0, buttons: 1 };
          const staticResult = staticApp.pointerMove(point);
          const event = new PointerEvent("pointermove", {
            ...clientPoint(point.x, point.y),
            bubbles: true,
            cancelable: true,
            button: point.button,
            buttons: point.buttons,
          });
          surface.dispatchEvent(event);
          if (staticResult.defaultPrevented !== event.defaultPrevented) {
            throw new Error("Pointer-move handling differs.");
          }
        };

        const dispatchPointerDown = (): void => {
          const point = { x: 3, y: 3, button: 0, buttons: 1 };
          const staticResult = staticApp.pointerDown(point);
          const event = new PointerEvent("pointerdown", {
            ...clientPoint(point.x, point.y),
            bubbles: true,
            cancelable: true,
            button: point.button,
            buttons: point.buttons,
          });
          surface.dispatchEvent(event);
          if (staticResult.defaultPrevented !== event.defaultPrevented) {
            throw new Error("Pointer-down handling differs.");
          }
        };

        const dispatchPointerUp = (): void => {
          const point = { x: 3, y: 3, button: 0, buttons: 0 };
          const staticResult = staticApp.pointerUp(point);
          const event = new PointerEvent("pointerup", {
            ...clientPoint(point.x, point.y),
            bubbles: true,
            cancelable: true,
            button: point.button,
            buttons: point.buttons,
          });
          surface.dispatchEvent(event);
          if (staticResult.defaultPrevented !== event.defaultPrevented) {
            throw new Error("Pointer-up handling differs.");
          }
        };

        const dispatchWheel = (deltaY: number): void => {
          const point = { x: 3, y: 3 };
          const staticResult = staticApp.scroll({
            ...point,
            deltaX: 0,
            deltaY: Math.sign(deltaY),
          });
          const event = new WheelEvent("wheel", {
            ...clientPoint(point.x, point.y),
            bubbles: true,
            cancelable: true,
            deltaMode: 0,
            deltaY,
          });
          surface.dispatchEvent(event);
          if (staticResult.defaultPrevented !== event.defaultPrevented) {
            throw new Error("Wheel handling differs.");
          }
        };

        const updateSource = (next: typeof source, label: string): void => {
          source = next;
          staticApp.rerender(
            support.createLargeTextHostParityView(source, staticRecorder),
          );
          domApp.rerender(
            support.createLargeTextHostParityView(source, domRecorder),
          );
          sourceLengths.push(testing.inspectTextSource(source).text.length);
          record(label);
        };

        try {
          record("initial large source");
          domApp.focus();

          dispatchKey("Tab");
          record("focus through Tab");
          dispatchKey("Home");
          record("home offset");
          dispatchKey("ArrowRight");
          record("horizontal key scroll");
          dispatchPointerMove();
          record("pointer move");
          dispatchPointerDown();
          record("pointer down");
          dispatchPointerUp();
          record("pointer up");
          dispatchWheel(100);
          record("wheel scroll");
          dispatchKey("End");
          record("deep two-axis offset");

          updateSource(
            support.appendLargeTextHostParitySegment(source),
            "append source segment",
          );
          updateSource(
            support.extendLargeTextHostParitySegment(source),
            "extend source segment",
          );
          updateSource(
            support.replaceLargeTextHostParitySegment(source),
            "replace source segment",
          );

          staticApp.setSize(support.LARGE_TEXT_HOST_PARITY_RESIZED_SIZE);
          domApp.setSize(support.LARGE_TEXT_HOST_PARITY_RESIZED_SIZE);
          record("resize to 100 by 24");
          staticApp.setSize(support.LARGE_TEXT_HOST_PARITY_SIZE);
          domApp.setSize(support.LARGE_TEXT_HOST_PARITY_SIZE);
          record("resize back to 120 by 30");

          dispatchKey("Home");
          record("return to first offset");
          dispatchKey("ArrowDown");
          record("vertical key scroll");
          dispatchWheel(-100);
          record("reverse wheel scroll");
          dispatchKey("End");
          record("final deep offset");
          dispatchKey("ArrowUp");
          record("final Unicode line");

          const staticBeforeUnmount = staticApp.getWorkCounts();
          staticApp.unmount();
          const staticAfterUnmount = staticApp.getWorkCounts();
          staticApp.unmount();
          const staticAfterSecondUnmount = staticApp.getWorkCounts();
          const domBeforeUnmount = {
            surfaceCount: document.querySelectorAll("[data-faux-ui-surface]")
              .length,
            surfaceConnected: surface.isConnected,
          };
          domApp.unmount();
          const domAfterUnmount = {
            surfaceCount: document.querySelectorAll("[data-faux-ui-surface]")
              .length,
            surfaceConnected: surface.isConnected,
            bodyStyle: document.body.getAttribute("style"),
          };
          domApp.unmount();
          const domAfterSecondUnmount = {
            surfaceCount: document.querySelectorAll("[data-faux-ui-surface]")
              .length,
            surfaceConnected: surface.isConnected,
            bodyStyle: document.body.getAttribute("style"),
          };
          surface.dispatchEvent(
            new KeyboardEvent("keydown", {
              bubbles: true,
              cancelable: true,
              key: "ArrowDown",
            }),
          );

          return {
            sourceLengths,
            snapshots,
            finalEvents: staticRecorder.events,
            finalTrace: staticApp.getEventTrace(),
            staticBeforeUnmount,
            staticAfterUnmount,
            staticAfterSecondUnmount,
            domBeforeUnmount,
            domAfterUnmount,
            domAfterSecondUnmount,
            expectedBodyStyle,
            detachedEventCount: domRecorder.events.length,
          };
        } finally {
          staticApp.unmount();
          domApp.unmount();
        }
      },
      {
        domUrl: moduleUrl("../src/dom.ts"),
        supportUrl: moduleUrl("./support/large-text-host-parity.tsx"),
        testingUrl: moduleUrl("../src/testing.ts"),
      },
    );

    expect(result.sourceLengths[0]).toBe(667_633);
    expect(result.sourceLengths).toHaveLength(4);
    expect(result.snapshots).toHaveLength(19);
    expect(result.snapshots.map((snapshot) => snapshot.scene.width)).toContain(
      100,
    );
    expect(result.snapshots.map((snapshot) => snapshot.scene.height)).toContain(
      24,
    );
    expect(
      result.snapshots.some((snapshot) =>
        snapshot.scene.cells.some(
          (cell) => cell.continuation === true && cell.ownerId !== null,
        ),
      ),
    ).toBe(true);
    expect(
      result.snapshots.some((snapshot) =>
        snapshot.scene.cells.some(
          (cell) =>
            cell.ownerId !== null &&
            cell.style.bold === true &&
            cell.style.underline === true,
        ),
      ),
    ).toBe(true);
    expect(
      result.snapshots.every(
        (snapshot) => snapshot.text === snapshot.visualText,
      ),
    ).toBe(true);
    expect(
      result.snapshots.some((snapshot) =>
        snapshot.scrollOffsets.some((offset) => offset.x > 0 && offset.y > 0),
      ),
    ).toBe(true);
    expect(result.finalEvents.length).toBeGreaterThan(0);
    expect(result.finalTrace.length).toBe(result.finalEvents.length);
    expect(result.staticAfterUnmount.entriesDisposed).toBe(1);
    expect(result.staticAfterSecondUnmount).toEqual(result.staticAfterUnmount);
    expect(result.domBeforeUnmount).toEqual({
      surfaceCount: 1,
      surfaceConnected: true,
    });
    expect(result.domAfterUnmount).toEqual({
      surfaceCount: 0,
      surfaceConnected: false,
      bodyStyle: result.expectedBodyStyle,
    });
    expect(result.domAfterSecondUnmount).toEqual(result.domAfterUnmount);
    expect(result.detachedEventCount).toBe(result.finalEvents.length);
  });
});
