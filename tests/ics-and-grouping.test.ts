import { describe, it, expect } from "vitest";

/**
 * Tests for ICS generation and multi-time-slot event grouping.
 * Mirrors the logic in event-preview.tsx and event-success.tsx.
 */

interface ExtractedEvent {
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  description?: string;
  confidence: number;
}

// ─── ICS generation (mirrors event-preview.tsx) ───

function generateIcsContent(evt: ExtractedEvent): string {
  const startDate = new Date(evt.startDate);
  let endDate: Date;
  if (evt.endDate) {
    endDate = new Date(evt.endDate);
  } else {
    endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);
  }

  const toIcsDate = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escapeIcs = (str: string) =>
    str.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  const uid = `test-uid@calendarscanner`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Calendar Scanner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${toIcsDate(startDate)}`,
    `DTEND:${toIcsDate(endDate)}`,
    `SUMMARY:${escapeIcs(evt.title)}`,
  ];

  if (evt.location) lines.push(`LOCATION:${escapeIcs(evt.location)}`);
  if (evt.description) lines.push(`DESCRIPTION:${escapeIcs(evt.description)}`);

  lines.push("BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", "DESCRIPTION:Reminder", "END:VALARM");
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n");
}

function generateMultiIcsContent(events: ExtractedEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Calendar Scanner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const evt of events) {
    const startDate = new Date(evt.startDate);
    let endDate: Date;
    if (evt.endDate) {
      endDate = new Date(evt.endDate);
    } else {
      endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);
    }

    const toIcsDate = (d: Date) =>
      d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const escapeIcs = (str: string) =>
      str.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
    const uid = `test-uid-${events.indexOf(evt)}@calendarscanner`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTART:${toIcsDate(startDate)}`);
    lines.push(`DTEND:${toIcsDate(endDate)}`);
    lines.push(`SUMMARY:${escapeIcs(evt.title)}`);
    if (evt.location) lines.push(`LOCATION:${escapeIcs(evt.location)}`);
    if (evt.description) lines.push(`DESCRIPTION:${escapeIcs(evt.description)}`);
    lines.push("BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", "DESCRIPTION:Reminder", "END:VALARM");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// ─── Event grouping (mirrors event-preview.tsx) ───

function groupEventsByTitle(events: ExtractedEvent[]): { title: string; events: ExtractedEvent[] }[] {
  const groups: Map<string, ExtractedEvent[]> = new Map();
  for (const event of events) {
    const key = event.title.trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(event);
  }
  return Array.from(groups.entries()).map(([title, evts]) => ({ title, events: evts }));
}

// ─── Tests ───

describe("ICS Generation", () => {
  it("should produce valid VCALENDAR wrapper", () => {
    const ics = generateIcsContent({
      title: "Test Event",
      startDate: "2026-06-01T10:00:00Z",
      confidence: 0.9,
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//Calendar Scanner//EN");
  });

  it("should include VEVENT block with correct SUMMARY", () => {
    const ics = generateIcsContent({
      title: "Team Standup",
      startDate: "2026-06-01T09:00:00Z",
      confidence: 0.85,
    });
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("SUMMARY:Team Standup");
  });

  it("should default endDate to +1 hour when not provided", () => {
    const ics = generateIcsContent({
      title: "Quick Chat",
      startDate: "2026-06-01T14:00:00Z",
      confidence: 0.8,
    });
    // DTSTART should be 14:00, DTEND should be 15:00
    expect(ics).toContain("DTSTART:20260601T140000Z");
    expect(ics).toContain("DTEND:20260601T150000Z");
  });

  it("should use provided endDate", () => {
    const ics = generateIcsContent({
      title: "Workshop",
      startDate: "2026-06-01T09:00:00Z",
      endDate: "2026-06-01T17:00:00Z",
      confidence: 0.9,
    });
    expect(ics).toContain("DTSTART:20260601T090000Z");
    expect(ics).toContain("DTEND:20260601T170000Z");
  });

  it("should include LOCATION when provided", () => {
    const ics = generateIcsContent({
      title: "Meeting",
      startDate: "2026-06-01T10:00:00Z",
      location: "Room 42",
      confidence: 0.9,
    });
    expect(ics).toContain("LOCATION:Room 42");
  });

  it("should include DESCRIPTION when provided", () => {
    const ics = generateIcsContent({
      title: "Meeting",
      startDate: "2026-06-01T10:00:00Z",
      description: "Discuss Q3 goals",
      confidence: 0.9,
    });
    expect(ics).toContain("DESCRIPTION:Discuss Q3 goals");
  });

  it("should include a 15-minute VALARM", () => {
    const ics = generateIcsContent({
      title: "Reminder Test",
      startDate: "2026-06-01T10:00:00Z",
      confidence: 0.9,
    });
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("TRIGGER:-PT15M");
    expect(ics).toContain("END:VALARM");
  });

  it("should escape special characters in SUMMARY", () => {
    const ics = generateIcsContent({
      title: "Team; Meeting, with\\backslash",
      startDate: "2026-06-01T10:00:00Z",
      confidence: 0.9,
    });
    expect(ics).toContain("SUMMARY:Team\\; Meeting\\, with\\\\backslash");
  });

  it("should escape newlines in DESCRIPTION", () => {
    const ics = generateIcsContent({
      title: "Event",
      startDate: "2026-06-01T10:00:00Z",
      description: "Line one\nLine two",
      confidence: 0.9,
    });
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two");
  });
});

describe("Multi-Event ICS Generation", () => {
  it("should produce a single VCALENDAR with multiple VEVENTs", () => {
    const events: ExtractedEvent[] = [
      { title: "Slot A", startDate: "2026-06-01T09:00:00Z", confidence: 0.9 },
      { title: "Slot B", startDate: "2026-06-02T09:00:00Z", confidence: 0.9 },
      { title: "Slot C", startDate: "2026-06-03T09:00:00Z", confidence: 0.9 },
    ];
    const ics = generateMultiIcsContent(events);

    // Exactly one VCALENDAR
    const calStarts = (ics.match(/BEGIN:VCALENDAR/g) || []).length;
    const calEnds = (ics.match(/END:VCALENDAR/g) || []).length;
    expect(calStarts).toBe(1);
    expect(calEnds).toBe(1);

    // Three VEVENTs
    const evtStarts = (ics.match(/BEGIN:VEVENT/g) || []).length;
    expect(evtStarts).toBe(3);

    expect(ics).toContain("SUMMARY:Slot A");
    expect(ics).toContain("SUMMARY:Slot B");
    expect(ics).toContain("SUMMARY:Slot C");
  });

  it("should handle a single event in multi-ICS", () => {
    const events: ExtractedEvent[] = [
      { title: "Only One", startDate: "2026-06-01T10:00:00Z", confidence: 0.9 },
    ];
    const ics = generateMultiIcsContent(events);
    const evtStarts = (ics.match(/BEGIN:VEVENT/g) || []).length;
    expect(evtStarts).toBe(1);
  });
});

describe("Event Grouping by Title", () => {
  it("should group events with the same title", () => {
    const events: ExtractedEvent[] = [
      { title: "Yoga Class", startDate: "2026-06-01T08:00:00Z", confidence: 0.9 },
      { title: "Yoga Class", startDate: "2026-06-03T08:00:00Z", confidence: 0.9 },
      { title: "Yoga Class", startDate: "2026-06-05T08:00:00Z", confidence: 0.9 },
    ];
    const groups = groupEventsByTitle(events);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe("Yoga Class");
    expect(groups[0].events).toHaveLength(3);
  });

  it("should keep different titles as separate groups", () => {
    const events: ExtractedEvent[] = [
      { title: "Meeting A", startDate: "2026-06-01T09:00:00Z", confidence: 0.9 },
      { title: "Meeting B", startDate: "2026-06-01T14:00:00Z", confidence: 0.85 },
    ];
    const groups = groupEventsByTitle(events);
    expect(groups).toHaveLength(2);
    expect(groups[0].title).toBe("Meeting A");
    expect(groups[1].title).toBe("Meeting B");
  });

  it("should handle a mix of single and multi-slot events", () => {
    const events: ExtractedEvent[] = [
      { title: "Workshop", startDate: "2026-06-01T09:00:00Z", confidence: 0.9 },
      { title: "Workshop", startDate: "2026-06-02T09:00:00Z", confidence: 0.9 },
      { title: "Keynote", startDate: "2026-06-01T18:00:00Z", confidence: 0.95 },
    ];
    const groups = groupEventsByTitle(events);
    expect(groups).toHaveLength(2);

    const workshopGroup = groups.find((g) => g.title === "Workshop");
    expect(workshopGroup?.events).toHaveLength(2);

    const keynoteGroup = groups.find((g) => g.title === "Keynote");
    expect(keynoteGroup?.events).toHaveLength(1);
  });

  it("should trim whitespace when grouping", () => {
    const events: ExtractedEvent[] = [
      { title: "  Yoga Class  ", startDate: "2026-06-01T08:00:00Z", confidence: 0.9 },
      { title: "Yoga Class", startDate: "2026-06-03T08:00:00Z", confidence: 0.9 },
    ];
    const groups = groupEventsByTitle(events);
    // Both should be grouped together after trimming
    expect(groups).toHaveLength(1);
    expect(groups[0].events).toHaveLength(2);
  });

  it("should preserve event order within groups", () => {
    const events: ExtractedEvent[] = [
      { title: "Session", startDate: "2026-06-01T09:00:00Z", confidence: 0.9 },
      { title: "Session", startDate: "2026-06-01T14:00:00Z", confidence: 0.85 },
      { title: "Session", startDate: "2026-06-01T18:00:00Z", confidence: 0.8 },
    ];
    const groups = groupEventsByTitle(events);
    expect(groups[0].events[0].startDate).toBe("2026-06-01T09:00:00Z");
    expect(groups[0].events[1].startDate).toBe("2026-06-01T14:00:00Z");
    expect(groups[0].events[2].startDate).toBe("2026-06-01T18:00:00Z");
  });

  it("should handle empty events array", () => {
    const groups = groupEventsByTitle([]);
    expect(groups).toHaveLength(0);
  });
});
