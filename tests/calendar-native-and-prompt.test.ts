import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Native calendar integration uses createEventInCalendarAsync", () => {
  const filesToCheck = [
    "app/event-preview.tsx",
    "app/event-success.tsx",
    "app/event-editor.tsx",
  ];

  for (const filePath of filesToCheck) {
    it(`${filePath} should use createEventInCalendarAsync instead of createEventAsync`, () => {
      const content = fs.readFileSync(path.resolve(filePath), "utf-8");
      // Should use the new API
      expect(content).toContain("createEventInCalendarAsync");
      // Should NOT use the old silent API (except in comments)
      const lines = content.split("\n");
      const codeLines = lines.filter(
        (l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")
      );
      const codeContent = codeLines.join("\n");
      // The old createEventAsync should not appear in code (only createEventInCalendarAsync)
      const oldApiMatches = codeContent.match(/Calendar\.createEventAsync\b/g);
      expect(oldApiMatches).toBeNull();
    });
  }

  it("event-preview.tsx should check result.action for saved/done", () => {
    const content = fs.readFileSync("app/event-preview.tsx", "utf-8");
    expect(content).toContain('result.action === "saved"');
    expect(content).toContain('result.action === "done"');
  });

  it("event-success.tsx should check result.action for saved/done", () => {
    const content = fs.readFileSync("app/event-success.tsx", "utf-8");
    expect(content).toContain('result.action === "saved"');
    expect(content).toContain('result.action === "done"');
  });

  it("event-editor.tsx should check result.action for saved/done", () => {
    const content = fs.readFileSync("app/event-editor.tsx", "utf-8");
    expect(content).toContain('result.action !== "saved"');
    expect(content).toContain('result.action !== "done"');
  });
});

describe("AI prompt includes multi-time-slot extraction rules", () => {
  it("server/routers.ts should have MULTI-TIME-SLOT section in prompt", () => {
    const content = fs.readFileSync("server/routers.ts", "utf-8");
    expect(content).toContain("MULTI-TIME-SLOT EVENTS");
    expect(content).toContain("SEPARATE event entry for EACH time slot");
    expect(content).toContain("NEVER combine multiple time slots");
  });

  it("user message should instruct about multi-time-slot extraction", () => {
    const content = fs.readFileSync("server/routers.ts", "utf-8");
    expect(content).toContain("MULTIPLE time slots or sessions on different dates/times");
    expect(content).toContain("SEPARATE entry for EACH time slot");
  });

  it("prompt should include Chinese date/time examples", () => {
    const content = fs.readFileSync("server/routers.ts", "utf-8");
    expect(content).toContain("4月22日下午3:00-4:00");
    expect(content).toContain("4月23日上午10:30-11:30");
  });
});

describe("Web .ics download uses Blob approach (not data URI window.open)", () => {
  it("event-preview.tsx should use Blob for .ics download", () => {
    const content = fs.readFileSync("app/event-preview.tsx", "utf-8");
    expect(content).toContain("new Blob([icsContent]");
    expect(content).toContain("URL.createObjectURL");
  });

  it("event-preview.tsx should show .ics instruction guide modal", () => {
    const content = fs.readFileSync("app/event-preview.tsx", "utf-8");
    expect(content).toContain("showIcsGuide");
    expect(content).toContain(".ics File Downloaded");
    // Should have step-by-step instructions
    expect(content).toContain("加至日曆");
  });

  it("event-success.tsx should show .ics instruction guide modal", () => {
    const content = fs.readFileSync("app/event-success.tsx", "utf-8");
    expect(content).toContain("showIcsGuide");
    expect(content).toContain(".ics File Downloaded");
  });
});

describe("Event preview supports multi-time-slot grouping", () => {
  it("event-preview.tsx should have groupEventsByTitle function", () => {
    const content = fs.readFileSync("app/event-preview.tsx", "utf-8");
    expect(content).toContain("groupEventsByTitle");
  });

  it("event-preview.tsx should render multi-slot UI with per-slot buttons", () => {
    const content = fs.readFileSync("app/event-preview.tsx", "utf-8");
    expect(content).toContain("Time Slots");
    expect(content).toContain("Add All");
    expect(content).toContain("addAllEventsInGroup");
  });

  it("event-preview.tsx should generate multi-event .ics for Add All", () => {
    const content = fs.readFileSync("app/event-preview.tsx", "utf-8");
    expect(content).toContain("generateMultiIcsContent");
  });
});
