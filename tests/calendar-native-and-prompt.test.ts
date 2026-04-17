import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Calendar utils module", () => {
  it("lib/calendar-utils.ts should export key functions", () => {
    const content = fs.readFileSync("lib/calendar-utils.ts", "utf-8");
    expect(content).toContain("buildGoogleCalendarUrl");
    expect(content).toContain("generateIcsContent");
    expect(content).toContain("generateMultiIcsContent");
    expect(content).toContain("openGoogleCalendar");
    expect(content).toContain("openAppleCalendarWeb");
    expect(content).toContain("addToNativeCalendar");
  });

  it("calendar-utils.ts should use createEventInCalendarAsync for native", () => {
    const content = fs.readFileSync("lib/calendar-utils.ts", "utf-8");
    expect(content).toContain("createEventInCalendarAsync");
    // Should check result.action
    expect(content).toContain('result.action === "saved"');
  });

  it("Google Calendar URL builder should use correct base URL", () => {
    const content = fs.readFileSync("lib/calendar-utils.ts", "utf-8");
    expect(content).toContain("calendar.google.com/calendar/r/eventedit");
    expect(content).toContain("action: \"TEMPLATE\"");
  });
});

describe("CalendarAddSheet component", () => {
  it("should offer Google Calendar and Apple Calendar options", () => {
    const content = fs.readFileSync("components/calendar-add-sheet.tsx", "utf-8");
    expect(content).toContain("Google Calendar");
    expect(content).toContain("Apple Calendar");
    expect(content).toContain("openGoogleCalendar");
    expect(content).toContain("openAppleCalendarWeb");
  });

  it("should handle multi-event addition with individual Apple Calendar buttons", () => {
    const content = fs.readFileSync("components/calendar-add-sheet.tsx", "utf-8");
    // Multi-event: each event gets its own Apple Calendar button
    expect(content).toContain("handleAppleCalendar");
    expect(content).toContain("時段");
  });
});

describe("Pages use CalendarAddSheet instead of .ics download", () => {
  const pages = [
    "app/event-preview.tsx",
    "app/event-success.tsx",
    "app/event-editor.tsx",
  ];

  for (const filePath of pages) {
    it(`${filePath} should import CalendarAddSheet`, () => {
      const content = fs.readFileSync(path.resolve(filePath), "utf-8");
      expect(content).toContain("CalendarAddSheet");
    });

    it(`${filePath} should NOT contain old .ics download code`, () => {
      const content = fs.readFileSync(path.resolve(filePath), "utf-8");
      // Should not have the old .ics guide modal
      expect(content).not.toContain("showIcsGuide");
      expect(content).not.toContain(".ics File Downloaded");
    });
  }

  it("event-preview.tsx should use addToNativeCalendar from calendar-utils", () => {
    const content = fs.readFileSync("app/event-preview.tsx", "utf-8");
    expect(content).toContain("addToNativeCalendar");
    expect(content).toContain("CalendarAddSheet");
  });

  it("event-editor.tsx should use addToNativeCalendar from calendar-utils", () => {
    const content = fs.readFileSync("app/event-editor.tsx", "utf-8");
    expect(content).toContain("addToNativeCalendar");
    expect(content).toContain("CalendarAddSheet");
  });
});

describe("AI prompt includes multi-time-slot extraction rules", () => {
  it("server/routers.ts should have MULTI-TIME-SLOT section in prompt", () => {
    const content = fs.readFileSync("server/routers.ts", "utf-8");
    expect(content).toContain("MULTI-TIME-SLOT EVENTS");
    expect(content).toContain("SEPARATE event entry for EACH");
    expect(content).toContain("NEVER combine multiple time slots");
  });

  it("prompt should instruct about multi-language support", () => {
    const content = fs.readFileSync("server/routers.ts", "utf-8");
    expect(content).toContain("Chinese (Traditional & Simplified)");
    expect(content).toContain("Ignore any decorative elements");
  });

  it("prompt should include Chinese date/time examples for multi-slot", () => {
    const content = fs.readFileSync("server/routers.ts", "utf-8");
    // The prompt has specific Chinese examples
    expect(content).toContain("講解會");
    expect(content).toContain("2026-04-22T15:00:00");
    expect(content).toContain("2026-04-23T10:30:00");
  });

  it("user message should emphasize multi-time-slot extraction", () => {
    const content = fs.readFileSync("server/routers.ts", "utf-8");
    expect(content).toContain("MOST IMPORTANT");
    expect(content).toContain("SEPARATE entry for EACH time slot");
  });

  it("prompt should instruct to never use Untitled Event", () => {
    const content = fs.readFileSync("server/routers.ts", "utf-8");
    expect(content).toContain("never 'Untitled Event'");
    expect(content).toContain("use the actual name from the image");
  });
});

describe("Event preview supports multi-time-slot grouping", () => {
  it("event-preview.tsx should have groupEventsByTitle function", () => {
    const content = fs.readFileSync("app/event-preview.tsx", "utf-8");
    expect(content).toContain("groupEventsByTitle");
  });

  it("event-preview.tsx should render multi-slot UI with per-slot buttons", () => {
    const content = fs.readFileSync("app/event-preview.tsx", "utf-8");
    expect(content).toContain("時段");
    expect(content).toContain("全部添加");
    expect(content).toContain("isMultiSlot");
  });
});
