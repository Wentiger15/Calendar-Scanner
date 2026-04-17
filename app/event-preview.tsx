import { ScrollView, Text, View, Pressable, ActivityIndicator, Platform, Alert, Modal } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import * as Calendar from "expo-calendar";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Convert an image URI to a base64 data URL.
 * Works on both Web (fetch + blob + FileReader) and native.
 */
async function uriToBase64DataUrl(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert image to base64"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(blob);
  });
}

interface ExtractedEvent {
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  description?: string;
  confidence: number;
}

/** Status for each event card's "add to calendar" action */
type AddStatus = "idle" | "adding" | "added" | "canceled" | "error";

/**
 * Group events by title for multi-time-slot display.
 * Events with the same title are grouped together.
 */
function groupEventsByTitle(events: ExtractedEvent[]): { title: string; events: ExtractedEvent[] }[] {
  const groups: Map<string, ExtractedEvent[]> = new Map();
  for (const event of events) {
    const key = event.title.trim();
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(event);
  }
  return Array.from(groups.entries()).map(([title, evts]) => ({ title, events: evts }));
}

/**
 * Generate an .ics file content string for the given event.
 */
function generateIcsContent(evt: ExtractedEvent): string {
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
 * Generate a multi-event .ics file for adding all events at once.
 */
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

    const toIcsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const escapeIcs = (str: string) => str.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}-${events.indexOf(evt)}@calendarscanner`;

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
 * Download .ics content on Web platform.
 * Uses Blob + link approach for best compatibility.
 */
function downloadIcsWeb(icsContent: string, filename?: string) {
  const fname = filename || "event.ics";
  try {
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fname;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // Fallback: data URI
    const dataUri = "data:text/calendar;charset=utf-8," + encodeURIComponent(icsContent);
    window.location.href = dataUri;
  }
}

export default function EventPreviewScreen() {
  const router = useRouter();
  const colors = useColors();
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>();

  const [events, setEvents] = useState<ExtractedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track add-to-calendar status per event index
  const [addStatuses, setAddStatuses] = useState<Map<number, AddStatus>>(new Map());
  // Web: show instruction modal after .ics download
  const [showIcsGuide, setShowIcsGuide] = useState(false);

  const extractEventMutation = trpc.events.extractFromImage.useMutation();

  useEffect(() => {
    if (imageUri) {
      extractEventFromImage(imageUri);
    }
  }, [imageUri]);

  const extractEventFromImage = async (uri: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const dataUrl = await uriToBase64DataUrl(uri);

      const result = await extractEventMutation.mutateAsync({
        imageUrl: dataUrl,
      });

      if (result.success) {
        const extractedEvents = (result as any).events || (result.event ? [result.event] : []);
        if (extractedEvents.length > 0) {
          setEvents(extractedEvents);
        } else {
          setError("No events could be found in this image. Try a clearer image with visible dates and times.");
        }
      } else {
        setError((result as any).error || "Failed to extract event information");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to process image";
      setError(errorMsg);
      console.error("Extraction error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditEvent = (event: ExtractedEvent) => {
    router.push({
      pathname: "/event-editor",
      params: {
        eventData: JSON.stringify(event),
      },
    });
  };

  const handleRetry = () => {
    if (imageUri) {
      extractEventFromImage(imageUri);
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const dateFormatted = date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        weekday: "short",
      });
      const timeFormatted = date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return `${dateFormatted}  ${timeFormatted}`;
    } catch {
      return dateStr;
    }
  };

  /** Short format for multi-slot display: just date + time */
  const formatShortDateTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const getConfidenceInfo = (confidence: number) => {
    const percent = Math.round(confidence * 100);
    const color = confidence > 0.8 ? colors.success : confidence > 0.6 ? colors.warning : colors.error;
    const label = confidence > 0.8 ? "High" : confidence > 0.6 ? "Medium" : "Low";
    return { percent, color, label };
  };

  /** Save event to recent events in AsyncStorage */
  const saveToRecentEvents = async (evt: ExtractedEvent) => {
    try {
      const recentEvents = JSON.parse(
        (await AsyncStorage.getItem("recentEvents")) || "[]"
      );
      recentEvents.unshift({
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        title: evt.title,
        startDate: evt.startDate,
        location: evt.location,
        addedAt: new Date().toISOString(),
      });
      await AsyncStorage.setItem("recentEvents", JSON.stringify(recentEvents.slice(0, 20)));
    } catch {
      // Non-critical
    }
  };

  /**
   * Add a single event to calendar.
   * 
   * Native (iOS/Android): Uses createEventInCalendarAsync to open the system calendar UI.
   * This ensures the user sees the native calendar editor and can confirm the addition.
   * No silent failures - the user must explicitly tap "Add" in the system UI.
   * 
   * Web: Downloads .ics file and shows instruction guide.
   */
  const addSingleEventToCalendar = useCallback(async (evt: ExtractedEvent, eventIndex: number) => {
    setAddStatuses((prev) => new Map(prev).set(eventIndex, "adding"));

    try {
      if (Platform.OS === "web") {
        // Web: download .ics file
        const icsContent = generateIcsContent(evt);
        const safeName = evt.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "_").slice(0, 50);
        downloadIcsWeb(icsContent, `${safeName}.ics`);
        await saveToRecentEvents(evt);
        // Show instruction guide for iOS Safari users
        setShowIcsGuide(true);
        setAddStatuses((prev) => new Map(prev).set(eventIndex, "added"));
      } else {
        // Native: use createEventInCalendarAsync to open system calendar UI
        const startDate = new Date(evt.startDate);
        let endDate: Date;
        if (evt.endDate) {
          endDate = new Date(evt.endDate);
        } else {
          endDate = new Date(startDate);
          endDate.setHours(endDate.getHours() + 1);
        }

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

        // Check if user actually saved the event
        if (result.action === "saved" || result.action === "done") {
          await saveToRecentEvents(evt);
          setAddStatuses((prev) => new Map(prev).set(eventIndex, "added"));
        } else {
          // User canceled
          setAddStatuses((prev) => new Map(prev).set(eventIndex, "canceled"));
          // Reset to idle after a moment so they can try again
          setTimeout(() => {
            setAddStatuses((prev) => {
              const next = new Map(prev);
              if (next.get(eventIndex) === "canceled") {
                next.set(eventIndex, "idle");
              }
              return next;
            });
          }, 2000);
        }
      }
    } catch (error) {
      console.error("Calendar error:", error);
      if (Platform.OS !== "web") {
        const errorMsg = error instanceof Error ? error.message : "Failed to add event";
        Alert.alert("Error", errorMsg);
      }
      setAddStatuses((prev) => new Map(prev).set(eventIndex, "error"));
    }
  }, []);

  /**
   * Add all events in a group to calendar at once.
   * On Web: generates a single multi-event .ics file.
   * On Native: opens system calendar UI for each event sequentially.
   */
  const addAllEventsInGroup = useCallback(async (groupEvents: ExtractedEvent[], startIndex: number) => {
    // Mark all as adding
    setAddStatuses((prev) => {
      const next = new Map(prev);
      groupEvents.forEach((_, i) => next.set(startIndex + i, "adding"));
      return next;
    });

    try {
      if (Platform.OS === "web") {
        const icsContent = generateMultiIcsContent(groupEvents);
        const safeName = groupEvents[0].title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "_").slice(0, 50);
        downloadIcsWeb(icsContent, `${safeName}_all.ics`);
        setShowIcsGuide(true);

        for (const evt of groupEvents) {
          await saveToRecentEvents(evt);
        }
        setAddStatuses((prev) => {
          const next = new Map(prev);
          groupEvents.forEach((_, i) => next.set(startIndex + i, "added"));
          return next;
        });
      } else {
        // Native: add each event using system calendar UI
        let allSaved = true;
        for (let i = 0; i < groupEvents.length; i++) {
          const evt = groupEvents[i];
          const startDate = new Date(evt.startDate);
          let endDate: Date;
          if (evt.endDate) {
            endDate = new Date(evt.endDate);
          } else {
            endDate = new Date(startDate);
            endDate.setHours(endDate.getHours() + 1);
          }

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

          if (result.action === "saved" || result.action === "done") {
            await saveToRecentEvents(evt);
            setAddStatuses((prev) => new Map(prev).set(startIndex + i, "added"));
          } else {
            allSaved = false;
            setAddStatuses((prev) => new Map(prev).set(startIndex + i, "idle"));
          }
        }

        if (!allSaved) {
          Alert.alert(
            "Partial Addition",
            "Some events were not added. You can add the remaining ones individually."
          );
        }
      }
    } catch (error) {
      console.error("Calendar error:", error);
      setAddStatuses((prev) => {
        const next = new Map(prev);
        groupEvents.forEach((_, i) => {
          if (next.get(startIndex + i) !== "added") {
            next.set(startIndex + i, "error");
          }
        });
        return next;
      });
    }
  }, []);

  // Check if all events in a group are added
  const isGroupAllAdded = (startIndex: number, count: number) => {
    for (let i = startIndex; i < startIndex + count; i++) {
      if (addStatuses.get(i) !== "added") return false;
    }
    return true;
  };

  // Check if any event in a group is being added
  const isGroupAdding = (startIndex: number, count: number) => {
    for (let i = startIndex; i < startIndex + count; i++) {
      if (addStatuses.get(i) === "adding") return true;
    }
    return false;
  };

  // Loading state
  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <View className="items-center gap-4">
          <View
            style={{ backgroundColor: `${colors.primary}15`, borderRadius: 40, padding: 20 }}
          >
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
          <Text className="text-lg font-semibold text-foreground">Analyzing Image...</Text>
          <Text className="text-sm text-muted text-center px-8">
            Extracting event details including dates, times, and locations
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  // Error state
  if (error) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center gap-6">
          <View
            style={{ backgroundColor: `${colors.error}15`, borderRadius: 40, padding: 20 }}
          >
            <Ionicons name="alert-circle" size={48} color={colors.error} />
          </View>
          <Text className="text-lg font-semibold text-foreground text-center">
            Could Not Extract Events
          </Text>
          <Text className="text-base text-muted text-center px-4">{error}</Text>
          <View className="gap-3 w-full mt-4">
            <Pressable
              onPress={handleRetry}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                  borderRadius: 14,
                  paddingVertical: 16,
                  alignItems: "center",
                },
              ]}
            >
              <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>Try Again</Text>
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                },
              ]}
            >
              <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 16 }}>Go Back</Text>
            </Pressable>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  // Group events by title for multi-time-slot display
  const eventGroups = groupEventsByTitle(events);

  /** Render the add button for a single event slot */
  const renderAddButton = (evt: ExtractedEvent, eventIdx: number, compact?: boolean) => {
    const status = addStatuses.get(eventIdx) || "idle";
    const fontSize = compact ? 13 : 15;
    const iconSize = compact ? 16 : 16;

    if (status === "added") {
      return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="checkmark-circle" size={iconSize} color={colors.success} />
          <Text style={{ color: colors.success, fontSize, fontWeight: "600" }}>Added</Text>
        </View>
      );
    }
    if (status === "adding") {
      return <ActivityIndicator size="small" color={colors.primary} />;
    }
    if (status === "canceled") {
      return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="close-circle-outline" size={iconSize} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize, fontWeight: "600" }}>Canceled</Text>
        </View>
      );
    }
    if (status === "error") {
      return (
        <Pressable
          onPress={() => addSingleEventToCalendar(evt, eventIdx)}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flexDirection: "row", alignItems: "center", gap: 4 }]}
        >
          <Ionicons name="refresh" size={iconSize} color={colors.error} />
          <Text style={{ color: colors.error, fontSize, fontWeight: "600" }}>Retry</Text>
        </Pressable>
      );
    }

    // idle
    if (compact) {
      return (
        <Pressable
          onPress={() => addSingleEventToCalendar(evt, eventIdx)}
          style={({ pressed }) => [{
            opacity: pressed ? 0.7 : 1,
            backgroundColor: colors.primary,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }]}
        >
          <Ionicons name="calendar-outline" size={14} color="white" />
          <Text style={{ color: "white", fontSize: 13, fontWeight: "600" }}>Add</Text>
        </Pressable>
      );
    }

    return (
      <>
        <Ionicons name="calendar" size={iconSize} color="white" />
        <Text style={{ color: "white", fontWeight: "600", fontSize }}>
          Add to Calendar
        </Text>
      </>
    );
  };

  // Results
  return (
    <ScreenContainer className="bg-background">
      <View className="flex-1">
        {/* Header */}
        <View className="px-6 pt-4 pb-2">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, padding: 4 }]}
            >
              <Ionicons name="chevron-back" size={24} color={colors.foreground} />
            </Pressable>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">
                {events.length === 1 ? "Event Found" : `${events.length} Events Found`}
              </Text>
              <Text className="text-sm text-muted">
                {Platform.OS === "web"
                  ? "Download .ics file to add to your calendar"
                  : "Tap to open calendar and add events"}
              </Text>
            </View>
          </View>
        </View>

        {/* Event Cards */}
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, gap: 16, paddingTop: 8 }}>
          {eventGroups.map((group, groupIndex) => {
            const groupStartIndex = events.indexOf(group.events[0]);
            const isMultiSlot = group.events.length > 1;
            const allAdded = isGroupAllAdded(groupStartIndex, group.events.length);
            const anyAdding = isGroupAdding(groupStartIndex, group.events.length);

            if (isMultiSlot) {
              // Multi-time-slot event group
              return (
                <View
                  key={`group-${groupIndex}`}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: allAdded ? colors.success : colors.border,
                    overflow: "hidden",
                  }}
                >
                  {/* Group Header */}
                  <View style={{ padding: 20, paddingBottom: 12, gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View
                        style={{
                          backgroundColor: `${colors.primary}20`,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                        }}
                      >
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>
                          {group.events.length} Time Slots
                        </Text>
                      </View>
                      {allAdded && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                          <Text style={{ color: colors.success, fontSize: 12, fontWeight: "600" }}>All Added</Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "700",
                        color: colors.foreground,
                      }}
                    >
                      {group.title}
                    </Text>
                    {group.events[0].location && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons name="location-outline" size={14} color={colors.primary} />
                        <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }}>
                          {group.events[0].location}
                        </Text>
                      </View>
                    )}
                    {group.events[0].description && (
                      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
                        {group.events[0].description}
                      </Text>
                    )}
                  </View>

                  {/* Individual Time Slots */}
                  {group.events.map((evt, slotIndex) => {
                    const eventIdx = groupStartIndex + slotIndex;
                    return (
                      <View
                        key={`slot-${eventIdx}`}
                        style={{
                          borderTopWidth: 1,
                          borderTopColor: colors.border,
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 20,
                          paddingVertical: 12,
                          gap: 12,
                        }}
                      >
                        {/* Time info */}
                        <View style={{ flex: 1, gap: 2 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Ionicons name="time-outline" size={14} color={colors.primary} />
                            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>
                              {formatShortDateTime(evt.startDate)}
                            </Text>
                          </View>
                          {evt.endDate && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 20 }}>
                              <Text style={{ color: colors.muted, fontSize: 13 }}>
                                to {formatShortDateTime(evt.endDate)}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Per-slot action button */}
                        {renderAddButton(evt, eventIdx, true)}
                      </View>
                    );
                  })}

                  {/* Group action bar */}
                  <View
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      flexDirection: "row",
                    }}
                  >
                    <Pressable
                      onPress={() => handleEditEvent(group.events[0])}
                      style={({ pressed }) => [{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        paddingVertical: 14,
                        borderRightWidth: 0.5,
                        borderRightColor: colors.border,
                        opacity: pressed ? 0.7 : 1,
                      }]}
                    >
                      <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => addAllEventsInGroup(group.events, groupStartIndex)}
                      disabled={allAdded || anyAdding}
                      style={({ pressed }) => [{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        paddingVertical: 14,
                        borderLeftWidth: 0.5,
                        borderLeftColor: colors.border,
                        opacity: (pressed || allAdded || anyAdding) ? 0.5 : 1,
                        backgroundColor: (allAdded || anyAdding) ? "transparent" : (pressed ? `${colors.primary}10` : "transparent"),
                      }]}
                    >
                      {anyAdding ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : allAdded ? (
                        <>
                          <Ionicons name="checkmark-done" size={16} color={colors.success} />
                          <Text style={{ color: colors.success, fontWeight: "600", fontSize: 14 }}>All Added</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="calendar" size={16} color={colors.primary} />
                          <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>Add All</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            }

            // Single event card
            const evt = group.events[0];
            const eventIdx = groupStartIndex;
            const status = addStatuses.get(eventIdx) || "idle";
            const conf = getConfidenceInfo(evt.confidence);

            return (
              <View
                key={`event-${eventIdx}`}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: status === "added" ? colors.success : colors.border,
                  overflow: "hidden",
                }}
              >
                {/* Event Header */}
                <View style={{ padding: 20, gap: 12 }}>
                  {/* Title Row */}
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "700",
                        color: colors.foreground,
                        flex: 1,
                        marginRight: 8,
                      }}
                    >
                      {evt.title}
                    </Text>
                    {status === "added" ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: `${colors.success}20`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                        <Text style={{ color: colors.success, fontSize: 12, fontWeight: "600" }}>Added</Text>
                      </View>
                    ) : (
                      <View
                        style={{
                          backgroundColor: `${conf.color}20`,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                        }}
                      >
                        <Text style={{ color: conf.color, fontSize: 12, fontWeight: "600" }}>
                          {conf.label} {conf.percent}%
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Date & Time */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="time-outline" size={16} color={colors.primary} />
                    <Text style={{ color: colors.foreground, fontSize: 15 }}>
                      {formatDateTime(evt.startDate)}
                    </Text>
                  </View>

                  {evt.endDate && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="arrow-forward-outline" size={16} color={colors.muted} />
                      <Text style={{ color: colors.muted, fontSize: 14 }}>
                        to {formatDateTime(evt.endDate)}
                      </Text>
                    </View>
                  )}

                  {/* Location */}
                  {evt.location && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="location-outline" size={16} color={colors.primary} />
                      <Text style={{ color: colors.foreground, fontSize: 15, flex: 1 }}>
                        {evt.location}
                      </Text>
                    </View>
                  )}

                  {/* Description */}
                  {evt.description && (
                    <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }} numberOfLines={3}>
                      {evt.description}
                    </Text>
                  )}
                </View>

                {/* Action Buttons */}
                <View
                  style={{
                    flexDirection: "row",
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <Pressable
                    onPress={() => handleEditEvent(evt)}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        paddingVertical: 14,
                        borderRightWidth: 0.5,
                        borderRightColor: colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 15 }}>
                      Edit
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => addSingleEventToCalendar(evt, eventIdx)}
                    disabled={status === "added" || status === "adding"}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        paddingVertical: 14,
                        borderLeftWidth: 0.5,
                        borderLeftColor: colors.border,
                        opacity: (pressed || status === "added" || status === "adding") ? 0.7 : 1,
                        backgroundColor: (status === "added" || status === "adding") ? "transparent" : (pressed ? `${colors.primary}10` : "transparent"),
                      },
                    ]}
                  >
                    {status === "adding" ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : status === "added" ? (
                      <>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={{ color: colors.success, fontWeight: "600", fontSize: 15 }}>Added</Text>
                      </>
                    ) : status === "error" ? (
                      <>
                        <Ionicons name="refresh" size={16} color={colors.error} />
                        <Text style={{ color: colors.error, fontWeight: "600", fontSize: 15 }}>Retry</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="calendar" size={16} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 15 }}>
                          Add to Calendar
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })}

          {/* Scan another button */}
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              {
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
                opacity: pressed ? 0.7 : 1,
                marginTop: 4,
              },
            ]}
          >
            <Ionicons name="camera-outline" size={18} color={colors.muted} />
            <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 15 }}>
              Scan Different Image
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* iOS .ics instruction guide modal (Web only) */}
      {Platform.OS === "web" && (
        <Modal
          visible={showIcsGuide}
          transparent
          animationType="fade"
          onRequestClose={() => setShowIcsGuide(false)}
        >
          <Pressable
            onPress={() => setShowIcsGuide(false)}
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "center",
              alignItems: "center",
              padding: 24,
            }}
          >
            <Pressable
              onPress={() => {}}
              style={{
                backgroundColor: colors.background,
                borderRadius: 20,
                padding: 24,
                width: "100%",
                maxWidth: 360,
                gap: 16,
              }}
            >
              <View style={{ alignItems: "center", gap: 8 }}>
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: `${colors.primary}15`,
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Ionicons name="download-outline" size={28} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, textAlign: "center" }}>
                  .ics File Downloaded
                </Text>
              </View>

              <Text style={{ fontSize: 15, color: colors.foreground, lineHeight: 22, textAlign: "center" }}>
                A calendar file has been downloaded to your device. To complete adding the event:
              </Text>

              {/* Step 1 */}
              <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                <View style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: colors.primary,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>1</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
                    Open the downloaded .ics file
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}>
                    Tap the file in your Downloads or the notification
                  </Text>
                </View>
              </View>

              {/* Step 2 */}
              <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                <View style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: colors.primary,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>2</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
                    Tap "Add to Calendar" at the bottom
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}>
                    On iPhone, tap the "加至日曆" button at the bottom of the preview (not the checkmark at the top)
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => setShowIcsGuide(false)}
                style={({ pressed }) => [{
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: pressed ? 0.9 : 1,
                  marginTop: 4,
                }]}
              >
                <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>Got it</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </ScreenContainer>
  );
}
