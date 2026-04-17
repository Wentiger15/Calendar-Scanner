import { ScrollView, Text, View, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";
import { DateTimePickerField } from "@/components/date-time-picker";
import { CalendarAddSheet } from "@/components/calendar-add-sheet";
import { addToNativeCalendar, type CalendarEvent } from "@/lib/calendar-utils";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface EventData {
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  description?: string;
  confidence: number;
}

export default function EventEditorScreen() {
  const router = useRouter();
  const colors = useColors();
  const { eventData } = useLocalSearchParams<{ eventData: string }>();

  const [title, setTitle] = useState("");
  const [startDateTime, setStartDateTime] = useState(new Date());
  const [endDateTime, setEndDateTime] = useState(new Date());
  const [hasEndDate, setHasEndDate] = useState(false);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [confidence, setConfidence] = useState(0.8);
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);

  useEffect(() => {
    if (eventData) {
      try {
        const parsed: EventData = JSON.parse(eventData);
        setTitle(parsed.title || "");
        setLocation(parsed.location || "");
        setDescription(parsed.description || "");
        setConfidence(parsed.confidence || 0.8);

        if (parsed.startDate) {
          const startDt = new Date(parsed.startDate);
          if (!isNaN(startDt.getTime())) {
            setStartDateTime(startDt);
          }
        }

        if (parsed.endDate) {
          const endDt = new Date(parsed.endDate);
          if (!isNaN(endDt.getTime())) {
            setEndDateTime(endDt);
            setHasEndDate(true);
          }
        }
      } catch (error) {
        console.error("Failed to parse event data:", error);
      }
    }
  }, [eventData]);

  const buildCurrentEvent = (): CalendarEvent => ({
    title: title.trim(),
    startDate: startDateTime.toISOString(),
    endDate: hasEndDate ? endDateTime.toISOString() : undefined,
    location: location.trim() || undefined,
    description: description.trim() || undefined,
    confidence,
  });

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Missing Title", "Please enter an event title.");
      return;
    }

    if (hasEndDate && endDateTime <= startDateTime) {
      Alert.alert("Invalid Time", "End time must be after start time.");
      return;
    }

    const updatedEvent = buildCurrentEvent();

    setIsAdding(true);
    try {
      if (Platform.OS === "web") {
        // Web: show calendar choice sheet
        setSheetVisible(true);
        setIsAdding(false);
        return;
      } else {
        // Native: open system calendar UI
        const saved = await addToNativeCalendar(updatedEvent);
        if (!saved) {
          setIsAdding(false);
          return;
        }
      }

      // Save to recent events
      await saveToRecent(updatedEvent);
      setIsAdded(true);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to add event";
      Alert.alert("Error", errorMsg);
    } finally {
      setIsAdding(false);
    }
  };

  const saveToRecent = async (evt: CalendarEvent) => {
    try {
      const recent = JSON.parse((await AsyncStorage.getItem("recentEvents")) || "[]");
      recent.unshift({
        id: Date.now().toString(),
        title: evt.title,
        startDate: evt.startDate,
        location: evt.location,
        addedAt: new Date().toISOString(),
      });
      await AsyncStorage.setItem("recentEvents", JSON.stringify(recent.slice(0, 20)));
    } catch {}
  };

  const handleSheetSuccess = async () => {
    const evt = buildCurrentEvent();
    await saveToRecent(evt);
    setIsAdded(true);
  };

  const toggleEndDate = () => {
    if (!hasEndDate) {
      // Default end time: 1 hour after start
      const defaultEnd = new Date(startDateTime);
      defaultEnd.setHours(defaultEnd.getHours() + 1);
      setEndDateTime(defaultEnd);
    }
    setHasEndDate(!hasEndDate);
  };

  return (
    <ScreenContainer className="bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
          <View className="gap-5 p-6">
            {/* Header with back button */}
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.7 : 1,
                    padding: 4,
                  },
                ]}
              >
                <Ionicons name="chevron-back" size={24} color={colors.foreground} />
              </Pressable>
              <View className="flex-1">
                <Text className="text-2xl font-bold text-foreground">Edit Event</Text>
                <Text className="text-sm text-muted">Modify the event details before adding</Text>
              </View>
            </View>

            {/* Form */}
            <View className="gap-5">
              {/* Title */}
              <View className="gap-2">
                <Text className="text-sm font-semibold text-foreground">Event Title *</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Team Meeting, Doctor Appointment"
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    color: colors.foreground,
                    fontSize: 16,
                  }}
                />
              </View>

              {/* Start Date */}
              <DateTimePickerField
                label="Start Date"
                value={startDateTime}
                onChange={(date) => {
                  setStartDateTime(date);
                  // Auto-adjust end date if needed
                  if (hasEndDate && date >= endDateTime) {
                    const newEnd = new Date(date);
                    newEnd.setHours(newEnd.getHours() + 1);
                    setEndDateTime(newEnd);
                  }
                }}
                mode="date"
                required
              />

              {/* Start Time */}
              <DateTimePickerField
                label="Start Time"
                value={startDateTime}
                onChange={(date) => {
                  const newStart = new Date(startDateTime);
                  newStart.setHours(date.getHours(), date.getMinutes());
                  setStartDateTime(newStart);
                  if (hasEndDate && newStart >= endDateTime) {
                    const newEnd = new Date(newStart);
                    newEnd.setHours(newEnd.getHours() + 1);
                    setEndDateTime(newEnd);
                  }
                }}
                mode="time"
                required
              />

              {/* End Date Toggle */}
              <Pressable
                onPress={toggleEndDate}
                style={({ pressed }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingVertical: 8,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons
                  name={hasEndDate ? "checkbox" : "square-outline"}
                  size={22}
                  color={hasEndDate ? colors.primary : colors.muted}
                />
                <Text style={{ color: colors.foreground, fontSize: 15 }}>Set end date & time</Text>
              </Pressable>

              {/* End Date & Time (conditional) */}
              {hasEndDate && (
                <>
                  <DateTimePickerField
                    label="End Date"
                    value={endDateTime}
                    onChange={(date) => {
                      const newEnd = new Date(endDateTime);
                      newEnd.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                      setEndDateTime(newEnd);
                    }}
                    mode="date"
                  />
                  <DateTimePickerField
                    label="End Time"
                    value={endDateTime}
                    onChange={(date) => {
                      const newEnd = new Date(endDateTime);
                      newEnd.setHours(date.getHours(), date.getMinutes());
                      setEndDateTime(newEnd);
                    }}
                    mode="time"
                  />
                </>
              )}

              {/* Location */}
              <View className="gap-2">
                <Text className="text-sm font-semibold text-foreground">Location</Text>
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                  }}
                >
                  <Ionicons name="location-outline" size={18} color={colors.muted} />
                  <TextInput
                    value={location}
                    onChangeText={setLocation}
                    placeholder="Add a location"
                    placeholderTextColor={colors.muted}
                    returnKeyType="done"
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      paddingLeft: 10,
                      color: colors.foreground,
                      fontSize: 16,
                    }}
                  />
                </View>
              </View>

              {/* Description */}
              <View className="gap-2">
                <Text className="text-sm font-semibold text-foreground">Notes</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Add any notes or details"
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={4}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    color: colors.foreground,
                    fontSize: 16,
                    textAlignVertical: "top",
                    minHeight: 100,
                  }}
                />
              </View>
            </View>

            {/* Action Buttons */}
            <View className="gap-3 mt-2">
              {isAdded ? (
                <>
                  <View
                    style={{
                      backgroundColor: colors.success,
                      borderRadius: 14,
                      paddingVertical: 16,
                      paddingHorizontal: 24,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="white" />
                    <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>
                      Added to Calendar
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => router.push("/")}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.primary,
                        opacity: pressed ? 0.9 : 1,
                        borderRadius: 14,
                        paddingVertical: 14,
                        paddingHorizontal: 24,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      },
                    ]}
                  >
                    <Ionicons name="camera-outline" size={18} color="white" />
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
                        paddingVertical: 12,
                        alignItems: "center",
                      },
                    ]}
                  >
                    <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 16 }}>Back to Home</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={handleSave}
                    disabled={isAdding}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.success,
                        opacity: (pressed || isAdding) ? 0.9 : 1,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                        borderRadius: 14,
                        paddingVertical: 16,
                        paddingHorizontal: 24,
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
                    onPress={() => router.back()}
                    disabled={isAdding}
                    style={({ pressed }) => [
                      {
                        opacity: (pressed || isAdding) ? 0.5 : 1,
                        borderRadius: 14,
                        paddingVertical: 14,
                        paddingHorizontal: 24,
                        alignItems: "center",
                      },
                    ]}
                  >
                    <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 16 }}>
                      Cancel
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {/* Calendar choice sheet (Web only) */}
      <CalendarAddSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        events={[buildCurrentEvent()]}
        onSuccess={handleSheetSuccess}
      />
    </ScreenContainer>
  );
}
