import {
  appendTextSourceSegment,
  createTextSource,
  Rows,
  ScrollView,
  Text,
  type TextSource,
  useFocusManager,
  useInput,
} from "@faux-ui/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import type { SystemEventRecord, SystemEventStream } from "./system-events.js";

interface EventMonitorAppProps {
  readonly stream: SystemEventStream;
  readonly onQuit: () => void;
}

interface EventViewState {
  readonly source: TextSource;
  readonly eventCount: number;
  readonly codeUnits: number;
  readonly maximumTimerLagMilliseconds: number;
  readonly latestSource: string;
}

export function EventMonitorApp({ stream, onQuit }: EventMonitorAppProps) {
  const [view, setView] = useState<EventViewState>(() => ({
    source: createTextSource(),
    eventCount: 0,
    codeUnits: 0,
    maximumTimerLagMilliseconds: 0,
    latestSource: "waiting",
  }));
  const [rate, setRate] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const eventCount = useRef(0);
  const startedAt = useRef(performance.now());
  const focus = useFocusManager();

  useEffect(() => {
    focus.focusNext();
  }, [focus]);

  useEffect(
    () =>
      stream.subscribe((record) => {
        const row = formatRecord(record);
        eventCount.current += 1;
        setView((current) => ({
          source: appendTextSourceSegment(current.source, {
            id: `event-${record.sequence}`,
            text: row,
          }),
          eventCount: current.eventCount + 1,
          // This is a retained UTF-16 metric, not terminal display width.
          codeUnits: current.codeUnits + row.length,
          maximumTimerLagMilliseconds: Math.max(
            current.maximumTimerLagMilliseconds,
            record.timerLagMilliseconds,
          ),
          latestSource: record.source,
        }));
      }),
    [stream],
  );

  useEffect(() => {
    let previousCount = eventCount.current;
    let previousAt = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const seconds = Math.max((now - previousAt) / 1_000, 0.001);
      const currentCount = eventCount.current;
      setRate((currentCount - previousCount) / seconds);
      setElapsedSeconds(Math.floor((now - startedAt.current) / 1_000));
      previousCount = currentCount;
      previousAt = now;
    }, 1_000);
    return () => clearInterval(timer);
  }, []);

  useInput(
    useCallback(
      (input) => {
        if (input.key === "q" || (input.ctrl && input.key === "c")) {
          onQuit();
          return true;
        }
        return false;
      },
      [onQuit],
    ),
  );

  return (
    <Rows tracks={[3, "1fr", 1]} style={{ background: "bg", foreground: "fg" }}>
      <Rows tracks={[1, 1, 1]}>
        <Text style={{ foreground: "accent", bold: true }}>
          Faux UI live Linux event monitor
        </Text>
        <Text overflow="ellipsis-end">
          {view.eventCount} events · {view.codeUnits} UTF-16 units ·{" "}
          {rate.toFixed(1)}/s · max timer lag{" "}
          {view.maximumTimerLagMilliseconds.toFixed(2)} ms · {elapsedSeconds}s
        </Text>
        <Text style={{ foreground: "muted" }} overflow="ellipsis-end">
          {stream.description} · latest {view.latestSource}
        </Text>
      </Rows>

      <ScrollView
        axis="both"
        followEnd="y"
        border="rounded"
        title=" Live events "
        focusable
        accessibleLabel="Live system event log"
        focusStyle={{ foreground: "accent" }}
      >
        <Text source={view.source} overflow="clip" />
      </ScrollView>

      <Text style={{ foreground: "muted" }} overflow="ellipsis-end">
        Arrows · Page Up/Down · Home/End scroll · Tab focus · q or Ctrl+C quit ·
        event text stays in memory
      </Text>
    </Rows>
  );
}

function formatRecord(record: SystemEventRecord): string {
  const timestamp = new Date(record.occurredAt).toISOString();
  return `${timestamp} [${record.source}] ${record.text}\n`;
}
