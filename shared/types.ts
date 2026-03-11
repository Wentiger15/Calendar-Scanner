/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

/**
 * Event extraction and calendar types
 */

export interface ExtractedEvent {
  title: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  description?: string;
  confidence: number; // 0-1 confidence score
}

export interface EventPreviewData {
  title: string;
  startDate: string; // ISO string
  endDate?: string; // ISO string
  location?: string;
  description?: string;
  confidence: number;
  rawImageUri?: string; // URI of the scanned image
}

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  notes?: string;
  createdAt: Date;
}
