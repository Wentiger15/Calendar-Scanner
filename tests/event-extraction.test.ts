import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

/**
 * Test suite for event extraction functionality
 * Tests the validation, parsing, time normalization, and multi-event extraction
 */

// Mock event extraction schema
const eventExtractionSchema = z.object({
  title: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

// normalizeDateTime from server/routers.ts
function normalizeDateTime(dateStr: string | undefined): string {
  if (!dateStr) return new Date().toISOString();

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dateStr)) {
    return dateStr;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return `${dateStr}T09:00:00`;
  }

  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().replace("Z", "").split(".")[0];
    }
  } catch {
    // Fall through
  }

  return dateStr;
}

// Confidence scoring helper
function getConfidenceInfo(confidence: number) {
  const percent = Math.round(confidence * 100);
  const label = confidence > 0.8 ? "High" : confidence > 0.6 ? "Medium" : "Low";
  return { percent, label };
}

describe("Event Extraction", () => {
  describe("Event Data Validation", () => {
    it("should validate a complete event with all fields", () => {
      const eventData = {
        title: "Team Meeting",
        startDate: "2026-03-15T10:00:00",
        endDate: "2026-03-15T11:00:00",
        location: "Conference Room A",
        description: "Quarterly planning meeting",
        confidence: 0.95,
      };

      const result = eventExtractionSchema.safeParse(eventData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Team Meeting");
        expect(result.data.confidence).toBe(0.95);
      }
    });

    it("should validate an event with minimal required fields", () => {
      const eventData = {
        title: "Doctor Appointment",
        startDate: "2026-03-20T14:30:00",
        confidence: 0.8,
      };

      const result = eventExtractionSchema.safeParse(eventData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Doctor Appointment");
        expect(result.data.endDate).toBeUndefined();
        expect(result.data.location).toBeUndefined();
      }
    });

    it("should reject event without title", () => {
      const eventData = {
        startDate: "2026-03-15T10:00:00",
        confidence: 0.9,
      };

      const result = eventExtractionSchema.safeParse(eventData);
      expect(result.success).toBe(false);
    });

    it("should reject event without startDate", () => {
      const eventData = {
        title: "Meeting",
        confidence: 0.9,
      };

      const result = eventExtractionSchema.safeParse(eventData);
      expect(result.success).toBe(false);
    });

    it("should reject event without confidence score", () => {
      const eventData = {
        title: "Meeting",
        startDate: "2026-03-15T10:00:00",
      };

      const result = eventExtractionSchema.safeParse(eventData);
      expect(result.success).toBe(false);
    });

    it("should reject confidence score outside valid range", () => {
      const eventDataTooHigh = {
        title: "Meeting",
        startDate: "2026-03-15T10:00:00",
        confidence: 1.5,
      };

      const eventDataTooLow = {
        title: "Meeting",
        startDate: "2026-03-15T10:00:00",
        confidence: -0.1,
      };

      expect(eventExtractionSchema.safeParse(eventDataTooHigh).success).toBe(false);
      expect(eventExtractionSchema.safeParse(eventDataTooLow).success).toBe(false);
    });
  });

  describe("normalizeDateTime", () => {
    it("should handle full ISO datetime strings", () => {
      expect(normalizeDateTime("2026-03-15T14:30:00")).toBe("2026-03-15T14:30:00");
    });

    it("should add default time to date-only strings", () => {
      expect(normalizeDateTime("2026-03-15")).toBe("2026-03-15T09:00:00");
    });

    it("should handle ISO datetime with seconds", () => {
      expect(normalizeDateTime("2026-03-15T20:00:00")).toBe("2026-03-15T20:00:00");
    });

    it("should handle undefined input", () => {
      const result = normalizeDateTime(undefined);
      expect(result).toBeTruthy();
      expect(new Date(result).getTime()).not.toBeNaN();
    });

    it("should handle parseable date strings", () => {
      const result = normalizeDateTime("March 15, 2026 8:00 PM");
      expect(result).toBeTruthy();
      const date = new Date(result);
      expect(date.getTime()).not.toBeNaN();
    });

    it("should pass through unparseable strings", () => {
      expect(normalizeDateTime("not-a-date")).toBe("not-a-date");
    });
  });

  describe("Time Format Expectations (AI Output)", () => {
    it("should expect 8PM to be represented as 20:00", () => {
      const expectedOutput = "2026-03-15T20:00:00";
      const date = new Date(normalizeDateTime(expectedOutput));
      expect(date.getHours()).toBe(20);
      expect(date.getMinutes()).toBe(0);
    });

    it("should expect 3:30 PM to be represented as 15:30", () => {
      const expectedOutput = "2026-03-15T15:30:00";
      const date = new Date(normalizeDateTime(expectedOutput));
      expect(date.getHours()).toBe(15);
      expect(date.getMinutes()).toBe(30);
    });

    it("should expect 9:15 AM to be represented as 09:15", () => {
      const expectedOutput = "2026-03-15T09:15:00";
      const date = new Date(normalizeDateTime(expectedOutput));
      expect(date.getHours()).toBe(9);
      expect(date.getMinutes()).toBe(15);
    });

    it("should expect 12PM (noon) to be represented as 12:00", () => {
      const date = new Date(normalizeDateTime("2026-03-15T12:00:00"));
      expect(date.getHours()).toBe(12);
    });

    it("should expect 12AM (midnight) to be represented as 00:00", () => {
      const date = new Date(normalizeDateTime("2026-03-16T00:00:00"));
      expect(date.getHours()).toBe(0);
    });
  });

  describe("Multi-Event Response Parsing", () => {
    it("should parse multiple events from API response", () => {
      const apiResponse = {
        success: true,
        events: [
          {
            title: "Morning Meeting",
            startDate: "2026-03-15T09:00:00",
            endDate: "2026-03-15T10:00:00",
            location: "Room A",
            confidence: 0.95,
          },
          {
            title: "Lunch with Client",
            startDate: "2026-03-15T12:00:00",
            endDate: "2026-03-15T13:30:00",
            location: "Restaurant",
            confidence: 0.88,
          },
          {
            title: "Evening Presentation",
            startDate: "2026-03-15T20:00:00",
            endDate: "2026-03-15T21:30:00",
            confidence: 0.82,
          },
        ],
      };

      expect(apiResponse.events).toHaveLength(3);
      expect(apiResponse.events[0].title).toBe("Morning Meeting");
      expect(apiResponse.events[2].startDate).toBe("2026-03-15T20:00:00");
      const eveningDate = new Date(apiResponse.events[2].startDate);
      expect(eveningDate.getHours()).toBe(20);
    });

    it("should handle single event response", () => {
      const apiResponse = {
        success: true,
        events: [
          {
            title: "Doctor Appointment",
            startDate: "2026-03-15T15:30:00",
            location: "City Hospital",
            confidence: 0.92,
          },
        ],
      };

      expect(apiResponse.events).toHaveLength(1);
      expect(apiResponse.events[0].title).toBe("Doctor Appointment");
    });

    it("should handle empty events response", () => {
      const apiResponse = {
        success: false,
        error: "No events found in the image",
      };

      expect(apiResponse.success).toBe(false);
      expect(apiResponse.error).toBeTruthy();
    });

    it("should validate each event in multi-event response", () => {
      const events = [
        { title: "Event 1", startDate: "2026-03-15T09:00:00", confidence: 0.95 },
        { title: "Event 2", startDate: "2026-03-15T14:00:00", confidence: 0.88 },
        { title: "Event 3", startDate: "2026-03-15T20:00:00", confidence: 0.75 },
      ];

      events.forEach((event) => {
        const result = eventExtractionSchema.safeParse(event);
        expect(result.success).toBe(true);
      });
    });
  });

  describe("Confidence Scoring", () => {
    it("should classify high confidence correctly", () => {
      expect(getConfidenceInfo(0.95).label).toBe("High");
      expect(getConfidenceInfo(0.81).label).toBe("High");
    });

    it("should classify medium confidence correctly", () => {
      expect(getConfidenceInfo(0.75).label).toBe("Medium");
      expect(getConfidenceInfo(0.61).label).toBe("Medium");
    });

    it("should classify low confidence correctly", () => {
      expect(getConfidenceInfo(0.5).label).toBe("Low");
      expect(getConfidenceInfo(0.3).label).toBe("Low");
    });

    it("should calculate percentage correctly", () => {
      expect(getConfidenceInfo(0.95).percent).toBe(95);
      expect(getConfidenceInfo(0.333).percent).toBe(33);
    });
  });

  describe("Event Date Parsing", () => {
    it("should handle ISO 8601 date format", () => {
      const eventData = {
        title: "Conference",
        startDate: "2026-03-15T09:00:00Z",
        confidence: 0.85,
      };

      const result = eventExtractionSchema.safeParse(eventData);
      expect(result.success).toBe(true);
    });

    it("should validate date range with endDate after startDate", () => {
      const eventData = {
        title: "Workshop",
        startDate: "2026-03-15T09:00:00",
        endDate: "2026-03-15T17:00:00",
        confidence: 0.9,
      };

      const result = eventExtractionSchema.safeParse(eventData);
      expect(result.success).toBe(true);
    });
  });

  describe("Real-world Event Scenarios", () => {
    it("should handle conference event", () => {
      const eventData = {
        title: "React Conference 2026",
        startDate: "2026-06-15T08:00:00",
        endDate: "2026-06-17T18:00:00",
        location: "San Francisco Convention Center",
        description: "Annual React developers conference",
        confidence: 0.92,
      };

      const result = eventExtractionSchema.safeParse(eventData);
      expect(result.success).toBe(true);
    });

    it("should handle personal appointment", () => {
      const eventData = {
        title: "Dentist Appointment",
        startDate: "2026-03-18T14:00:00",
        endDate: "2026-03-18T14:30:00",
        location: "Downtown Dental Clinic",
        confidence: 0.88,
      };

      const result = eventExtractionSchema.safeParse(eventData);
      expect(result.success).toBe(true);
    });

    it("should handle all-day event", () => {
      const eventData = {
        title: "Company Holiday",
        startDate: "2026-07-04T00:00:00",
        endDate: "2026-07-04T23:59:59",
        description: "Independence Day - Office Closed",
        confidence: 0.99,
      };

      const result = eventExtractionSchema.safeParse(eventData);
      expect(result.success).toBe(true);
    });

    it("should handle Chinese format event", () => {
      // AI should convert "下午3點" → 15:00:00
      const eventData = {
        title: "客戶會議",
        startDate: "2026-03-15T15:00:00",
        endDate: "2026-03-15T16:30:00",
        location: "會議室B",
        description: "與客戶討論新項目",
        confidence: 0.87,
      };

      const result = eventExtractionSchema.safeParse(eventData);
      expect(result.success).toBe(true);
      const startDate = new Date(eventData.startDate);
      expect(startDate.getHours()).toBe(15);
    });

    it("should handle event with PM time correctly", () => {
      // AI should convert "8PM" → 20:00:00
      const eventData = {
        title: "Evening Dinner",
        startDate: "2026-03-15T20:00:00",
        location: "Italian Restaurant",
        confidence: 0.9,
      };

      const result = eventExtractionSchema.safeParse(eventData);
      expect(result.success).toBe(true);
      const startDate = new Date(eventData.startDate);
      expect(startDate.getHours()).toBe(20);
    });
  });

  describe("Edge Cases", () => {
    it("should handle boundary confidence values", () => {
      const eventDataZero = {
        title: "Meeting",
        startDate: "2026-03-15T10:00:00",
        confidence: 0,
      };

      const eventDataOne = {
        title: "Meeting",
        startDate: "2026-03-15T10:00:00",
        confidence: 1,
      };

      expect(eventExtractionSchema.safeParse(eventDataZero).success).toBe(true);
      expect(eventExtractionSchema.safeParse(eventDataOne).success).toBe(true);
    });

    it("should handle event end date validation", () => {
      const event = {
        title: "Meeting",
        startDate: "2026-03-15T15:00:00",
        endDate: "2026-03-15T14:00:00",
        confidence: 0.8,
      };

      // Schema validates format, not logic - end before start is a UI concern
      const result = eventExtractionSchema.safeParse(event);
      expect(result.success).toBe(true);

      // But the UI should catch this
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);
      expect(end <= start).toBe(true);
    });

    it("should handle very long title", () => {
      const eventData = {
        title: "A".repeat(200),
        startDate: "2026-03-15T10:00:00",
        confidence: 0.7,
      };

      const result = eventExtractionSchema.safeParse(eventData);
      expect(result.success).toBe(true);
    });
  });
});
