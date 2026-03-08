export interface EventEntry {
  id: number;
  message: string;
}

let nextEventId = 1;

export function createEventEntries(messages: string[]): EventEntry[] {
  return messages.map((message) => createEventEntry(message));
}

export function appendEventEntries(
  events: EventEntry[],
  message: string,
  limit: number,
): EventEntry[] {
  return [createEventEntry(message), ...events].slice(0, limit);
}

function createEventEntry(message: string): EventEntry {
  const entry = {
    id: nextEventId,
    message,
  };
  nextEventId += 1;
  return entry;
}
