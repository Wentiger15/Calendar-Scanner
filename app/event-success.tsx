import { ScrollView, Text, View, Pressable, Alert, ActivityIndicator } from "react-native";
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

  const addEventToCalendar = async () => {
    if (!event) return;

    try {
      setIsAdding(true);

      // Request calendar permissions
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== Calendar.PermissionStatus.GRANTED) {
        Alert.alert(
          "Permission Required",
          "Calendar permission is required to add events. Please enable it in settings."
        );
        return;
      }

      // Get default calendar
      let calendarId: string | null = null;

      if (Calendar.getDefaultCalendarAsync) {
        const defaultCalendar = await Calendar.getDefaultCalendarAsync();
        if (defaultCalendar?.id) {
          calendarId = defaultCalendar.id;
        }
      }

      // Fallback: get first writable calendar
      if (!calendarId) {
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const writableCalendars = calendars.filter((cal) => cal.allowsModifications);
        if (writableCalendars.length === 0) {
          Alert.alert("Error", "No writable calendars found on this device.");
          return;
        }
        calendarId = writableCalendars[0].id;
      }

      // Create event
      const eventDetails: any = {
        title: event.title,
        startDate: new Date(event.startDate),
        endDate: event.endDate ? new Date(event.endDate) : undefined,
        location: event.location,
        notes: event.description,
        timeZone: "UTC",
        alarms: [{ relativeOffset: -15 }], // 15 minutes before
      };

      const eventId = await Calendar.createEventAsync(calendarId, eventDetails);

      // Save to recent events
      const recentEvents = JSON.parse(
        (await AsyncStorage.getItem("recentEvents")) || "[]"
      );
      const newEvent = {
        id: eventId,
        title: event.title,
        startDate: event.startDate,
        location: event.location,
      };
      recentEvents.unshift(newEvent);
      await AsyncStorage.setItem("recentEvents", JSON.stringify(recentEvents.slice(0, 10)));

      setIsAdded(true);
      Alert.alert("Success", `Event "${event.title}" has been added to your calendar!`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to add event";
      Alert.alert("Error", errorMsg);
      console.error("Calendar error:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleScanAnother = () => {
    router.push("/");
  };

  if (!event) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-base text-muted">No event data available</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="gap-6 p-6 flex-1">
          {isAdded ? (
            <>
              {/* Success State */}
              <View className="flex-1 items-center justify-center gap-6">
                <View
                  className="w-20 h-20 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.success }}
                >
                  <Ionicons name="checkmark" size={40} color="white" />
                </View>

                <View className="gap-2 items-center">
                  <Text className="text-2xl font-bold text-foreground text-center">
                    Event Added!
                  </Text>
                  <Text className="text-base text-muted text-center">
                    Your event has been successfully added to Apple Calendar
                  </Text>
                </View>

                {/* Event Summary */}
                <View className="bg-surface rounded-2xl p-6 w-full gap-4 border border-border">
                  <View className="gap-2">
                    <Text className="text-xs font-semibold text-muted uppercase">Event Title</Text>
                    <Text className="text-lg font-bold text-foreground">{event.title}</Text>
                  </View>

                  <View className="gap-2">
                    <Text className="text-xs font-semibold text-muted uppercase">Date & Time</Text>
                    <Text className="text-base text-foreground">
                      {new Date(event.startDate).toLocaleString()}
                    </Text>
                  </View>

                  {event.location && (
                    <View className="gap-2">
                      <Text className="text-xs font-semibold text-muted uppercase">Location</Text>
                      <View className="flex-row items-center gap-2">
                        <Ionicons name="location" size={16} color={colors.muted} />
                        <Text className="text-base text-foreground flex-1">{event.location}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* Action Buttons */}
              <View className="gap-3">
                <Pressable
                  onPress={handleScanAnother}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.9 : 1,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    },
                  ]}
                  className="rounded-lg py-4 px-6 items-center flex-row justify-center gap-2"
                >
                  <Ionicons name="camera" size={20} color="white" />
                  <Text className="text-white font-semibold text-base">Scan Another</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push("/")}
                  style={({ pressed }) => [
                    {
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  className="rounded-lg py-3 px-6 items-center"
                >
                  <Text className="text-muted font-semibold text-base">Back to Home</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              {/* Confirmation State */}
              <View className="gap-2">
                <Text className="text-2xl font-bold text-foreground">Ready to Add?</Text>
                <Text className="text-sm text-muted">
                  This event will be added to your Apple Calendar
                </Text>
              </View>

              {/* Event Preview */}
              <View className="bg-surface rounded-2xl p-6 gap-4 border border-border">
                <View className="gap-2">
                  <Text className="text-xs font-semibold text-muted uppercase">Event Title</Text>
                  <Text className="text-lg font-bold text-foreground">{event.title}</Text>
                </View>

                <View className="gap-2">
                  <Text className="text-xs font-semibold text-muted uppercase">Date & Time</Text>
                  <Text className="text-base text-foreground">
                    {new Date(event.startDate).toLocaleString()}
                  </Text>
                </View>

                {event.endDate && (
                  <View className="gap-2">
                    <Text className="text-xs font-semibold text-muted uppercase">End Time</Text>
                    <Text className="text-base text-foreground">
                      {new Date(event.endDate).toLocaleString()}
                    </Text>
                  </View>
                )}

                {event.location && (
                  <View className="gap-2">
                    <Text className="text-xs font-semibold text-muted uppercase">Location</Text>
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="location" size={16} color={colors.muted} />
                      <Text className="text-base text-foreground flex-1">{event.location}</Text>
                    </View>
                  </View>
                )}

                {event.description && (
                  <View className="gap-2">
                    <Text className="text-xs font-semibold text-muted uppercase">Description</Text>
                    <Text className="text-base text-foreground">{event.description}</Text>
                  </View>
                )}
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
                    },
                  ]}
                  className="rounded-lg py-4 px-6 items-center flex-row justify-center gap-2"
                >
                  {isAdding ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Ionicons name="calendar" size={20} color="white" />
                      <Text className="text-white font-semibold text-base">Add to Calendar</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => router.back()}
                  disabled={isAdding}
                  style={({ pressed }) => [
                    {
                      opacity: pressed || isAdding ? 0.7 : 1,
                    },
                  ]}
                  className="rounded-lg py-3 px-6 items-center"
                >
                  <Text className="text-muted font-semibold text-base">Edit Again</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
