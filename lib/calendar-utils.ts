import { Platform, Linking } from "react-native";
import * as Calendar from "expo-calendar";
import { getApiBaseUrl } from "@/constants/oauth";

export interface CalendarEvent {
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  description?: string;
  confidence: number;
}

/**
 * Format a date string (YYYY-MM-DDTHH:MM:SS) to Google Calendar format (YYYYMMDDTHHmmss).
 * The AI returns local times without timezone, so we keep them as-is (no Z suffix).
 * Google Calendar will interpret them in the user's timezone when ctz is set.
 */
function toGoogleCalDateLocal(dateStr: string): string {
  // Strip non-numeric except T
  return dateStr.replace(/[-:]/g, "").replace(/\.\d{3}.*$/, "");
}

/**
 * Build a Google Calendar "create event" URL.
 * Uses local time format + ctz parameter so the event appears at the correct local time.
 */
export function buildGoogleCalendarUrl(evt: CalendarEvent): string {
  const startStr = evt.startDate;
  let endStr: string;
  if (evt.endDate) {
    endStr = evt.endDate;
  } else {
    // Default +1 hour
    const d = new Date(startStr);
    d.setHours(d.getHours() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    endStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: evt.title,
    dates: `${toGoogleCalDateLocal(startStr)}/${toGoogleCalDateLocal(endStr)}`,
  });

  // Set user's timezone so Google interprets the local times correctly
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tz) params.set("ctz", tz);

  if (evt.location) params.set("location", evt.location);
  if (evt.description) params.set("details", evt.description);

  return `https://calendar.google.com/calendar/r/eventedit?${params.toString()}`;
}

/**
 * Build a server-hosted .ics URL for Apple Calendar.
 * iOS Safari will recognize Content-Type: text/calendar and open the Calendar app
 * with the "Add to Calendar" dialog — this is the ONLY reliable way on iOS Safari.
 */
export function buildAppleCalendarUrl(evt: CalendarEvent): string {
  const apiBase = getApiBaseUrl();
  const params = new URLSearchParams({
    title: evt.title,
    start: evt.startDate,
  });

  if (evt.endDate) params.set("end", evt.endDate);
  if (evt.location) params.set("location", evt.location);
  if (evt.description) params.set("description", evt.description);

  return `${apiBase}/api/calendar/event.ics?${params.toString()}`;
}

/**
 * Generate .ics content for local use (tests, etc.)
 */
export function generateIcsContent(evt: CalendarEvent): string {
  const toIcsDateLocal = (dateStr: string) => dateStr.replace(/[-:]/g, "").replace(/\.\d{3}.*$/, "");
  const escapeIcs = (str: string) => str.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@calendarscanner`;

  const startIcs = toIcsDateLocal(evt.startDate);
  let endIcs: string;
  if (evt.endDate) {
    endIcs = toIcsDateLocal(evt.endDate);
  } else {
    const d = new Date(evt.startDate);
    d.setHours(d.getHours() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    endIcs = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Calendar Scanner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${startIcs}`,
    `DTEND:${endIcs}`,
    `SUMMARY:${escapeIcs(evt.title)}`,
  ];

  if (evt.location) lines.push(`LOCATION:${escapeIcs(evt.location)}`);
  if (evt.description) lines.push(`DESCRIPTION:${escapeIcs(evt.description)}`);

  lines.push("BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", "DESCRIPTION:Reminder", "END:VALARM");
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n");
}

/**
 * Generate multi-event .ics content.
 */
export function generateMultiIcsContent(events: CalendarEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Calendar Scanner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  const toIcsDateLocal = (dateStr: string) => dateStr.replace(/[-:]/g, "").replace(/\.\d{3}.*$/, "");
  const escapeIcs = (str: string) => str.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  const pad = (n: number) => String(n).padStart(2, "0");

  for (let idx = 0; idx < events.length; idx++) {
    const evt = events[idx];
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}-${idx}@calendarscanner`;
    const startIcs = toIcsDateLocal(evt.startDate);
    let endIcs: string;
    if (evt.endDate) {
      endIcs = toIcsDateLocal(evt.endDate);
    } else {
      const d = new Date(evt.startDate);
      d.setHours(d.getHours() + 1);
      endIcs = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    }

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTART:${startIcs}`);
    lines.push(`DTEND:${endIcs}`);
    lines.push(`SUMMARY:${escapeIcs(evt.title)}`);
    if (evt.location) lines.push(`LOCATION:${escapeIcs(evt.location)}`);
    if (evt.description) lines.push(`DESCRIPTION:${escapeIcs(evt.description)}`);
    lines.push("BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", "DESCRIPTION:Reminder", "END:VALARM");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/**
 * Open Google Calendar in the browser to add the event.
 * Works on both Web and Native.
 */
export async function openGoogleCalendar(evt: CalendarEvent): Promise<void> {
  const url = buildGoogleCalendarUrl(evt);
  if (Platform.OS === "web") {
    window.open(url, "_blank");
  } else {
    await Linking.openURL(url);
  }
}

/**
 * Open Apple Calendar via server-hosted .ics URL on web.
 * iOS Safari will download the .ics file and show the native "Add to Calendar" dialog.
 * 
 * IMPORTANT: We use window.location.href (not window.open) because:
 * - window.open may be blocked by popup blockers
 * - window.location.href triggers a direct navigation that iOS Safari handles natively
 * - iOS Safari recognizes text/calendar Content-Type and opens Calendar app
 */
export function openAppleCalendarWeb(evt: CalendarEvent): void {
  const url = buildAppleCalendarUrl(evt);
  window.location.href = url;
}

/**
 * Open Apple Calendar for multiple events - opens each one sequentially.
 * Since iOS can only handle one .ics at a time, we open the first one.
 * User can add remaining events one by one.
 */
export function openAppleCalendarWebMulti(events: CalendarEvent[]): void {
  if (events.length > 0) {
    openAppleCalendarWeb(events[0]);
  }
}

/**
 * Add event using native iOS/Android calendar API.
 * Opens the system calendar editor UI for user confirmation.
 * Returns true if user saved, false if canceled.
 */
export async function addToNativeCalendar(evt: CalendarEvent): Promise<boolean> {
  const startDate = new Date(evt.startDate);
  let endDate: Date;
  if (evt.endDate) {
    endDate = new Date(evt.endDate);
  } else {
    endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);
  }

  try {
    const result = await Calendar.createEventInCalendarAsync(
      {
        title: evt.title,
        startDate,
        endDate,
        location: evt.location,
        notes: evt.description,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        alarms: [{ relativeOffset: -15 }],
      },
      { startNewActivityTask: true }
    );

    return result.action === "saved" || result.action === "done";
  } catch (error) {
    console.error("Native calendar error:", error);
    throw error;
  }
}
