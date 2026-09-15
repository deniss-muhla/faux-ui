# Faux UI live Linux event monitor

This Linux-only manual TUI exercises the large-text path in `@faux-ui/ui`. It appends each event as one immutable `TextSource` segment and renders the complete retained log in a two-axis `ScrollView` with `followEnd="y"`.

The default run combines:

- `/proc/stat` CPU samples every 20 ms;
- new journal entries from `journalctl -f`;
- kernel and udev USB events from `udevadm monitor`.

The application keeps the growing log in process memory. It does not write event text to disk.

## Run it

Install the workspace from the Faux UI repository root:

```bash
bun install --frozen-lockfile
```

Start the monitor:

```bash
bun run example:system-events
```

Run only USB events:

```bash
bun run example:system-events -- --sources udev
```

Run CPU sampling at 100 updates per second without journal or USB events:

```bash
bun run example:system-events -- --sources cpu --sample-ms 10
```

Show all options:

```bash
bun run example:system-events -- --help
```

The app can also be started directly with `bun run --cwd apps/system-event-monitor dev:tui`.

## Requirements

- Linux;
- `journalctl` for journal events;
- `udevadm` for USB events;
- a terminal that can run the Faux UI TUI host.

Missing event commands report a safe state line and do not stop the other selected sources.

## Controls

The event viewport receives focus on mount.

- Arrow keys scroll by one row or column.
- Page Up and Page Down move by one viewport.
- Home moves to the top-left corner.
- End moves to the bottom-right corner.
- Tab restores focus if you moved it.
- `q` or Ctrl+C quits and stops every child process.

Vertical follow-end stops when you scroll upward. Return to the bottom with Page Down or End, then move horizontally to any column. New events continue following vertically without changing that horizontal offset.

## What to watch

Leave the default run open for several minutes. The retained UTF-16 count should keep growing while scrolling and key input remain responsive.

The header reports:

- retained event and UTF-16 counts;
- the current event rate;
- the largest observed `/proc/stat` timer delay;
- elapsed time and the latest event source.

A large timer-delay jump means the JavaScript event loop stalled. Generate a journal event with another terminal if needed:

```bash
logger "faux-ui manual event $(date --iso-8601=ns)"
```

Check these cases:

1. Stay at the bottom and move horizontally. Incoming events should not reset the horizontal position.
2. Scroll upward. Incoming events should not pull the viewport back to the bottom.
3. Return to the bottom. Vertical following should resume.
4. Resize the terminal repeatedly while the log grows.
5. Quit with `q` or Ctrl+C. The terminal and monitored child processes should stop cleanly.

This is an opt-in manual diagnostic. It is not part of the browser, packed-consumer, or automated TUI release gates because it depends on Linux services and devices.
