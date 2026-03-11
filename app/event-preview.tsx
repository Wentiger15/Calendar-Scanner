import { ScrollView, Text, View, Pressable, ActivityIndicator, Alert } from "react-native";
import { useState, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import * as FileSystem from "expo-file-system";

interface ExtractedEvent {
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  description?: string;
  confidence: number;
}

export default function EventPreviewScreen() {
  const router = useRouter();
  const colors = useColors();
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>();

  const [event, setEvent] = useState<ExtractedEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      // Read image as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      } as any);

      // Determine MIME type
      const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
      const mimeType = ext === "png" ? "image/png" : "image/jpeg";

      // Create data URL
      const dataUrl = `data:${mimeType};base64,${base64}`;

      // Call API to extract event
      const result = await extractEventMutation.mutateAsync({
        imageUrl: dataUrl,
      });

      if (result.success && result.event) {
        setEvent(result.event);
      } else {
        setError(result.error || "Failed to extract event information");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to process image";
      setError(errorMsg);
      console.error("Extraction error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    if (event) {
      router.push({
        pathname: "/event-editor",
        params: {
          eventData: JSON.stringify(event),
        },
      });
    }
  };

  const handleConfirm = () => {
    if (event) {
      router.push({
        pathname: "/event-success",
        params: {
          eventData: JSON.stringify(event),
        },
      });
    }
  };

  const handleRetry = () => {
    if (imageUri) {
      extractEventFromImage(imageUri);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-base text-muted mt-4">Extracting event information...</Text>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center gap-6">
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text className="text-lg font-semibold text-foreground text-center">
            Extraction Failed
          </Text>
          <Text className="text-base text-muted text-center">{error}</Text>
          <View className="gap-3 w-full">
            <Pressable
              onPress={handleRetry}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
              className="rounded-lg py-3 px-6 items-center"
            >
              <Text className="text-white font-semibold">Try Again</Text>
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                {
                  borderColor: colors.primary,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
              className="rounded-lg py-3 px-6 items-center border-2"
            >
              <Text style={{ color: colors.primary }} className="font-semibold">
                Go Back
              </Text>
            </Pressable>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (!event) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-base text-muted">No event data available</Text>
      </ScreenContainer>
    );
  }

  const confidencePercent = Math.round(event.confidence * 100);
  const confidenceColor =
    event.confidence > 0.8 ? colors.success : event.confidence > 0.6 ? colors.warning : colors.error;

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="gap-6 p-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">Event Details</Text>
            <Text className="text-sm text-muted">Review and confirm the extracted information</Text>
          </View>

          {/* Event Card */}
          <View className="bg-surface rounded-2xl p-6 gap-4 border border-border">
            {/* Title */}
            <View className="gap-2">
              <Text className="text-xs font-semibold text-muted uppercase">Event Title</Text>
              <Text className="text-xl font-bold text-foreground">{event.title}</Text>
            </View>

            {/* Date and Time */}
            <View className="gap-2">
              <Text className="text-xs font-semibold text-muted uppercase">Start Date & Time</Text>
              <Text className="text-base text-foreground">
                {new Date(event.startDate).toLocaleString()}
              </Text>
            </View>

            {/* End Date (if available) */}
            {event.endDate && (
              <View className="gap-2">
                <Text className="text-xs font-semibold text-muted uppercase">End Date & Time</Text>
                <Text className="text-base text-foreground">
                  {new Date(event.endDate).toLocaleString()}
                </Text>
              </View>
            )}

            {/* Location (if available) */}
            {event.location && (
              <View className="gap-2">
                <Text className="text-xs font-semibold text-muted uppercase">Location</Text>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="location" size={16} color={colors.muted} />
                  <Text className="text-base text-foreground flex-1">{event.location}</Text>
                </View>
              </View>
            )}

            {/* Description (if available) */}
            {event.description && (
              <View className="gap-2">
                <Text className="text-xs font-semibold text-muted uppercase">Description</Text>
                <Text className="text-base text-foreground">{event.description}</Text>
              </View>
            )}

            {/* Confidence Score */}
            <View className="gap-2 pt-4 border-t border-border">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-muted uppercase">Confidence</Text>
                <Text style={{ color: confidenceColor }} className="text-sm font-semibold">
                  {confidencePercent}%
                </Text>
              </View>
              <View className="h-2 bg-border rounded-full overflow-hidden">
                <View
                  style={{
                    backgroundColor: confidenceColor,
                    width: `${confidencePercent}%`,
                  }}
                  className="h-full"
                />
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="gap-3">
            <Pressable
              onPress={handleConfirm}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.success,
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
              className="rounded-lg py-4 px-6 items-center flex-row justify-center gap-2"
            >
              <Ionicons name="checkmark-circle" size={20} color="white" />
              <Text className="text-white font-semibold text-base">Confirm & Add</Text>
            </Pressable>

            <Pressable
              onPress={handleEdit}
              style={({ pressed }) => [
                {
                  borderColor: colors.primary,
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
              className="rounded-lg py-4 px-6 items-center flex-row justify-center gap-2 border-2"
            >
              <Ionicons name="pencil" size={20} color={colors.primary} />
              <Text style={{ color: colors.primary }} className="font-semibold text-base">
                Edit Details
              </Text>
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
