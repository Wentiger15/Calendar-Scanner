import { Platform, Alert, Linking } from "react-native";
import * as Calendar from "expo-calendar";

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
 * Generate .ics content for Apple Calendar / webcal approach.
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
 * Open Apple Calendar via data URI on web.
 * Creates a Blob URL and opens it, which triggers iOS to show the calendar add dialog.
 */
export function openAppleCalendarWeb(evt: CalendarEvent): void {
  const icsContent = generateIcsContent(evt);
  // Use data URI approach - iOS Safari will recognize text/calendar and open Calendar app
  const dataUri = "data:text/calendar;charset=utf-8," + encodeURIComponent(icsContent);
  window.open(dataUri, "_self");
}

/**
 * Open Apple Calendar for multiple events via data URI on web.
 */
export function openAppleCalendarWebMulti(events: CalendarEvent[]): void {
  const icsContent = generateMultiIcsContent(events);
  const dataUri = "data:text/calendar;charset=utf-8," + encodeURIComponent(icsContent);
  window.open(dataUri, "_self");
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
