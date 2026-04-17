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
 * Format a Date to Google Calendar's required format: YYYYMMDDTHHmmssZ
 */
function toGoogleCalDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Build a Google Calendar "create event" URL.
 * Opens in the browser and lets the user save directly.
 */
export function buildGoogleCalendarUrl(evt: CalendarEvent): string {
  const startDate = new Date(evt.startDate);
  let endDate: Date;
  if (evt.endDate) {
    endDate = new Date(evt.endDate);
  } else {
    endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);
  }

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: evt.title,
    dates: `${toGoogleCalDate(startDate)}/${toGoogleCalDate(endDate)}`,
  });

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
  const startDate = new Date(evt.startDate);
  let endDate: Date;
  if (evt.endDate) {
    endDate = new Date(evt.endDate);
  } else {
    endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);
  }

  const toIcsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escapeIcs = (str: string) => str.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@calendarscanner`;

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

  for (let idx = 0; idx < events.length; idx++) {
    const evt = events[idx];
    const startDate = new Date(evt.startDate);
    let endDate: Date;
    if (evt.endDate) {
      endDate = new Date(evt.endDate);
    } else {
      endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);
    }

    const toIcsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const escapeIcs = (str: string) => str.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}-${idx}@calendarscanner`;

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
