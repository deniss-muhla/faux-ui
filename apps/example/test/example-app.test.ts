import { describe, expect, it } from "vitest";

import { createInitialState, reduceExampleAction } from "../src/example-app.js";

describe("shared example app", () => {
  it("uses the same lane and task transitions regardless of renderer target", () => {
    const initialState = createInitialState();
    const backlogState = reduceExampleAction(initialState, "lane:backlog");
    const focusedTaskState = reduceExampleAction(backlogState, "task:0");
    const rushState = reduceExampleAction(focusedTaskState, "priority:toggle");

    expect(backlogState.selectedLane).toBe("backlog");
    expect(focusedTaskState.selectedTaskIndex).toBe(0);
    expect(rushState.priority).toBe("rush");
    expect(rushState.events[0]?.message).toBe("Priority mode is now rush.");
  });

  it("cycles to the next visible task", () => {
    const initialState = createInitialState();
    const nextState = reduceExampleAction(initialState, "task:advance");

    expect(nextState.selectedTaskIndex).toBe(1);
    expect(nextState.events[0]?.message).toBe("Advanced to TUI runtime.");
  });
});
