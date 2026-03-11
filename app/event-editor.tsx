import { ScrollView, Text, View, Pressable, TextInput, Alert } from "react-native";
import { useState, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";

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

  const [event, setEvent] = useState<EventData | null>(null);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (eventData) {
      try {
        const parsed = JSON.parse(eventData);
        setEvent(parsed);
        setTitle(parsed.title || "");
        setLocation(parsed.location || "");
        setDescription(parsed.description || "");

        if (parsed.startDate) {
          const startDt = new Date(parsed.startDate);
          setStartDate(startDt.toISOString().split("T")[0]);
          setStartTime(startDt.toTimeString().slice(0, 5));
        }

        if (parsed.endDate) {
          const endDt = new Date(parsed.endDate);
          setEndDate(endDt.toISOString().split("T")[0]);
          setEndTime(endDt.toTimeString().slice(0, 5));
        }
      } catch (error) {
        console.error("Failed to parse event data:", error);
      }
    }
  }, [eventData]);

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert("Validation Error", "Event title is required");
      return;
    }

    if (!startDate) {
      Alert.alert("Validation Error", "Start date is required");
      return;
    }

    const updatedEvent: EventData = {
      title: title.trim(),
      startDate: startDate + (startTime ? `T${startTime}:00` : "T00:00:00"),
      endDate: endDate ? endDate + (endTime ? `T${endTime}:00` : "T23:59:59") : undefined,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
      confidence: event?.confidence || 0.8,
    };

    router.push({
      pathname: "/event-success",
      params: {
        eventData: JSON.stringify(updatedEvent),
      },
    });
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="gap-6 p-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">Edit Event</Text>
            <Text className="text-sm text-muted">Modify the event details as needed</Text>
          </View>

          {/* Form Fields */}
          <View className="gap-6">
            {/* Title */}
            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">Event Title *</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Enter event title"
                placeholderTextColor={colors.muted}
                className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                style={{ color: colors.foreground }}
              />
            </View>

            {/* Start Date */}
            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">Start Date *</Text>
              <TextInput
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                style={{ color: colors.foreground }}
              />
            </View>

            {/* Start Time */}
            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">Start Time</Text>
              <TextInput
                value={startTime}
                onChangeText={setStartTime}
                placeholder="HH:MM"
                placeholderTextColor={colors.muted}
                className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                style={{ color: colors.foreground }}
              />
            </View>

            {/* End Date */}
            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">End Date (Optional)</Text>
              <TextInput
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                style={{ color: colors.foreground }}
              />
            </View>

            {/* End Time */}
            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">End Time (Optional)</Text>
              <TextInput
                value={endTime}
                onChangeText={setEndTime}
                placeholder="HH:MM"
                placeholderTextColor={colors.muted}
                className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                style={{ color: colors.foreground }}
              />
            </View>

            {/* Location */}
            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">Location (Optional)</Text>
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="Enter location"
                placeholderTextColor={colors.muted}
                className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                style={{ color: colors.foreground }}
              />
            </View>

            {/* Description */}
            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">Description (Optional)</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Enter description"
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={4}
                className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                style={{ color: colors.foreground, textAlignVertical: "top" }}
              />
            </View>
          </View>

          {/* Action Buttons */}
          <View className="gap-3 mt-4">
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
              className="rounded-lg py-4 px-6 items-center flex-row justify-center gap-2"
            >
              <Ionicons name="checkmark-circle" size={20} color="white" />
              <Text className="text-white font-semibold text-base">Save & Add to Calendar</Text>
            </Pressable>

            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="rounded-lg py-3 px-6 items-center"
            >
              <Text className="text-muted font-semibold text-base">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
