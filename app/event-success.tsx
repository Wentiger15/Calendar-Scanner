import { ScrollView, Text, View, Pressable, ActivityIndicator, Alert, Platform } from "react-native";
import { useState, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";
import * as Calendar from "expo-calendar";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface EventData {
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  description?: string;
  confidence: number;
}

export default function EventSuccessScreen() {
  const router = useRouter();
  const colors = useColors();
  const { eventData } = useLocalSearchParams<{ eventData: string }>();

  const [event, setEvent] = useState<EventData | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(false);

  useEffect(() => {
    if (eventData) {
      try {
        const parsed = JSON.parse(eventData);
        setEvent(parsed);
      } catch (error) {
        console.error("Failed to parse event data:", error);
      }
    }
  }, [eventData]);

  const formatDateTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleString(undefined, {
        year: "numeric",
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

  /**
   * Generate an .ics file content string for the given event.
   */
  const generateIcsContent = (evt: EventData): string => {
    const startDate = new Date(evt.startDate);
    let endDate: Date;
    if (evt.endDate) {
      endDate = new Date(evt.endDate);
    } else {
      endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);
    }

    // Format date to ICS format: YYYYMMDDTHHMMSSZ
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

    if (evt.location) {
      lines.push(`LOCATION:${escapeIcs(evt.location)}`);
    }
    if (evt.description) {
      lines.push(`DESCRIPTION:${escapeIcs(evt.description)}`);
    }

    // Add alarm (15 min before)
    lines.push("BEGIN:VALARM");
    lines.push("TRIGGER:-PT15M");
    lines.push("ACTION:DISPLAY");
    lines.push("DESCRIPTION:Reminder");
    lines.push("END:VALARM");

    lines.push("END:VEVENT");
    lines.push("END:VCALENDAR");

    return lines.join("\r\n");
  };

  /**
   * Web: download .ics file using data URI + window.open() for iOS Safari compatibility.
   * Falls back to link.click() for desktop browsers, then window.location.href as last resort.
   */
  const addToCalendarWeb = (evt: EventData) => {
    const icsContent = generateIcsContent(evt);
    const dataUri = "data:text/calendar;charset=utf-8," + encodeURIComponent(icsContent);

    // iOS Safari: window.open with data URI works reliably
    const newWindow = window.open(dataUri, "_blank");

    // Fallback: if popup was blocked, try the link approach
    if (!newWindow) {
      try {
        const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${evt.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "_").slice(0, 50)}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch {
        // Last resort: direct navigation
        window.location.href = dataUri;
      }
    }
  };

  /**
   * Native: use expo-calendar to create the event.
   */
  const addToCalendarNative = async (evt: EventData) => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== Calendar.PermissionStatus.GRANTED) {
      Alert.alert(
        "Permission Required",
        "Calendar permission is needed to add events. Please enable it in your device settings."
      );
      return;
    }

    let calendarId: string | null = null;
    try {
      if (Calendar.getDefaultCalendarAsync) {
        const defaultCalendar = await Calendar.getDefaultCalendarAsync();
        if (defaultCalendar?.id) {
          calendarId = defaultCalendar.id;
        }
      }
    } catch {
      // getDefaultCalendarAsync may not be available on all platforms
    }

    if (!calendarId) {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const writableCalendars = calendars.filter((cal) => cal.allowsModifications);
      if (writableCalendars.length === 0) {
        Alert.alert("Error", "No writable calendars found on this device.");
        return;
      }
      calendarId = writableCalendars[0].id;
    }

    const startDate = new Date(evt.startDate);
    let endDate: Date;
    if (evt.endDate) {
      endDate = new Date(evt.endDate);
    } else {
      endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);
    }

    const eventDetails: any = {
      title: evt.title,
      startDate,
      endDate,
      location: evt.location,
      notes: evt.description,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      alarms: [{ relativeOffset: -15 }],
    };

    await Calendar.createEventAsync(calendarId, eventDetails);
  };

  const addEventToCalendar = async () => {
    if (!event) return;

    try {
      setIsAdding(true);

      if (Platform.OS === "web") {
        // Web: download .ics file
        addToCalendarWeb(event);
      } else {
        // Native: use expo-calendar
        await addToCalendarNative(event);
      }

      // Save to recent events
      try {
        const recentEvents = JSON.parse(
          (await AsyncStorage.getItem("recentEvents")) || "[]"
        );
        const newEvent = {
          id: Date.now().toString(),
          title: event.title,
          startDate: event.startDate,
          location: event.location,
          addedAt: new Date().toISOString(),
        };
        recentEvents.unshift(newEvent);
        await AsyncStorage.setItem("recentEvents", JSON.stringify(recentEvents.slice(0, 20)));
      } catch {
        // Non-critical: don't fail if storage fails
      }

      setIsAdded(true);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to add event";
      Alert.alert("Error", errorMsg);
      console.error("Calendar error:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditEvent = () => {
    if (event) {
      router.push({
        pathname: "/event-editor",
        params: { eventData: JSON.stringify(event) },
      });
    }
  };

  if (!event) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-base text-muted">No event data available</Text>
      </ScreenContainer>
    );
  }

  // Success state - event has been added
  if (isAdded) {
    return (
      <ScreenContainer className="bg-background">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
          <View className="flex-1 items-center justify-center gap-6 p-6">
            {/* Success Icon */}
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: colors.success,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="checkmark" size={40} color="white" />
            </View>

            <View className="gap-2 items-center">
              <Text className="text-2xl font-bold text-foreground text-center">
                Added to Calendar!
              </Text>
              <Text className="text-base text-muted text-center px-4">
                {Platform.OS === "web"
                  ? `The .ics file for "${event.title}" has been downloaded. Open it to add to your calendar.`
                  : `"${event.title}" has been added to your calendar with a 15-minute reminder.`}
              </Text>
            </View>

            {/* Event Summary */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.success,
                padding: 16,
                width: "100%",
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>
                {event.title}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="time-outline" size={14} color={colors.primary} />
                <Text style={{ color: colors.muted, fontSize: 14 }}>
                  {formatDateTime(event.startDate)}
                </Text>
              </View>
              {event.location && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="location-outline" size={14} color={colors.primary} />
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{event.location}</Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View className="gap-3 w-full mt-4">
              <Pressable
                onPress={() => router.push("/")}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.9 : 1,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                    borderRadius: 14,
                    paddingVertical: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  },
                ]}
              >
                <Ionicons name="camera-outline" size={20} color="white" />
                <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>
                  Scan Another Image
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.push("/")}
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.7 : 1,
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: "center",
                  },
                ]}
              >
                <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 16 }}>
                  Back to Home
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // Confirmation state - review before adding
  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="gap-6 p-6 flex-1">
          {/* Header */}
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, padding: 4 }]}
            >
              <Ionicons name="chevron-back" size={24} color={colors.foreground} />
            </Pressable>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">Confirm Event</Text>
              <Text className="text-sm text-muted">Review before adding to calendar</Text>
            </View>
          </View>

          {/* Event Details Card */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 20,
              gap: 16,
            }}
          >
            {/* Title */}
            <View className="gap-1">
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Event
              </Text>
              <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground }}>
                {event.title}
              </Text>
            </View>

            {/* Start */}
            <View className="gap-1">
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Start
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="time-outline" size={18} color={colors.primary} />
                <Text style={{ fontSize: 16, color: colors.foreground }}>
                  {formatDateTime(event.startDate)}
                </Text>
              </View>
            </View>

            {/* End */}
            {event.endDate && (
              <View className="gap-1">
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  End
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="time-outline" size={18} color={colors.muted} />
                  <Text style={{ fontSize: 16, color: colors.foreground }}>
                    {formatDateTime(event.endDate)}
                  </Text>
                </View>
              </View>
            )}

            {/* Location */}
            {event.location && (
              <View className="gap-1">
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Location
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="location-outline" size={18} color={colors.primary} />
                  <Text style={{ fontSize: 16, color: colors.foreground, flex: 1 }}>
                    {event.location}
                  </Text>
                </View>
              </View>
            )}

            {/* Notes */}
            {event.description && (
              <View className="gap-1">
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Notes
                </Text>
                <Text style={{ fontSize: 15, color: colors.foreground, lineHeight: 22 }}>
                  {event.description}
                </Text>
              </View>
            )}

            {/* Reminder info */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <Ionicons name="notifications-outline" size={16} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                A reminder will be set 15 minutes before
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="gap-3 flex-1 justify-end">
            <Pressable
              onPress={addEventToCalendar}
              disabled={isAdding}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.success,
                  opacity: pressed || isAdding ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                  borderRadius: 14,
                  paddingVertical: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                },
              ]}
            >
              {isAdding ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="calendar" size={20} color="white" />
                  <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>
                    Add to Calendar
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={handleEditEvent}
              disabled={isAdding}
              style={({ pressed }) => [
                {
                  borderColor: colors.primary,
                  borderWidth: 2,
                  opacity: pressed || isAdding ? 0.7 : 1,
                  borderRadius: 14,
                  paddingVertical: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                },
              ]}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 16 }}>
                Edit Details
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.back()}
              disabled={isAdding}
              style={({ pressed }) => [
                {
                  opacity: pressed || isAdding ? 0.5 : 1,
                  borderRadius: 14,
                  paddingVertical: 12,
                  alignItems: "center",
                },
              ]}
            >
              <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 15 }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
