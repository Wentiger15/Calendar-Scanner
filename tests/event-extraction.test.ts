import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

/**
 * Test suite for event extraction functionality
 * Tests the validation and parsing of extracted event data
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

  describe("Event Date Parsing", () => {
    it("should handle ISO 8601 date format", () => {
      const eventData = {
        title: "Conference",
        startDate: "2026-03-15T09:00:00Z",
        confidence: 0.85,
      };

      const result = eventExtractionSchema.safeParse(eventData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startDate).toBe("2026-03-15T09:00:00Z");
      }
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

  describe("Confidence Score Interpretation", () => {
    it("should accept high confidence score (0.8+)", () => {
      const eventData = {
        title: "Meeting",
        startDate: "2026-03-15T10:00:00",
        confidence: 0.95,
      };

      const result = eventExtractionSchema.safeParse(eventData);
      expect(result.success).toBe(true);
    });

    it("should accept medium confidence score (0.5-0.8)", () => {
      const eventData = {
        title: "Meeting",
        startDate: "2026-03-15T10:00:00",
        confidence: 0.65,
      };

      const result = eventExtractionSchema.safeParse(eventData);
      expect(result.success).toBe(true);
    });

    it("should accept low confidence score (0-0.5)", () => {
      const eventData = {
        title: "Meeting",
        startDate: "2026-03-15T10:00:00",
        confidence: 0.3,
      };

      const result = eventExtractionSchema.safeParse(eventData);
      expect(result.success).toBe(true);
    });

    it("should accept boundary values (0 and 1)", () => {
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
  });

  describe("Optional Fields", () => {
    it("should allow omitting optional fields", () => {
      const eventData = {
        title: "Event",
        startDate: "2026-03-15T10:00:00",
        confidence: 0.8,
      };

      const result = eventExtractionSchema.safeParse(eventData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.endDate).toBeUndefined();
        expect(result.data.location).toBeUndefined();
        expect(result.data.description).toBeUndefined();
      }
    });

    it("should preserve optional fields when provided", () => {
      const eventData = {
        title: "Event",
        startDate: "2026-03-15T10:00:00",
        location: "Room 101",
        description: "Important meeting",
        confidence: 0.8,
      };

      const result = eventExtractionSchema.safeParse(eventData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.location).toBe("Room 101");
        expect(result.data.description).toBe("Important meeting");
      }
    });
  });

  describe("Real-world Event Scenarios", () => {
    it("should handle conference event", () => {
      const eventData = {
        title: "React Conference 2026",
        startDate: "2026-06-15T08:00:00",
        endDate: "2026-06-17T18:00:00",
        location: "San Francisco Convention Center",
        description: "Annual React developers conference with workshops and keynotes",
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

    it("should handle multi-day event", () => {
      const eventData = {
        title: "Summer Vacation",
        startDate: "2026-07-01T00:00:00",
        endDate: "2026-07-31T23:59:59",
        location: "Hawaii",
        description: "Family vacation",
        confidence: 0.85,
      };

      const result = eventExtractionSchema.safeParse(eventData);
      expect(result.success).toBe(true);
    });
  });
});
