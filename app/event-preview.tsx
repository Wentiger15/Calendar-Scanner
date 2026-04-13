import { ScrollView, Text, View, Pressable, ActivityIndicator, FlatList } from "react-native";
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

  const [events, setEvents] = useState<ExtractedEvent[]>([]);
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

      // Call API to extract events
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

  const handleConfirmEvent = (event: ExtractedEvent) => {
    router.push({
      pathname: "/event-success",
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

  const getConfidenceInfo = (confidence: number) => {
    const percent = Math.round(confidence * 100);
    const color = confidence > 0.8 ? colors.success : confidence > 0.6 ? colors.warning : colors.error;
    const label = confidence > 0.8 ? "High" : confidence > 0.6 ? "Medium" : "Low";
    return { percent, color, label };
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
                Tap an event to edit, or confirm to add directly
              </Text>
            </View>
          </View>
        </View>

        {/* Event Cards */}
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, gap: 16, paddingTop: 8 }}>
          {events.map((event, index) => {
            const conf = getConfidenceInfo(event.confidence);
            return (
              <View
                key={`event-${index}`}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
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
                      {event.title}
                    </Text>
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
                  </View>

                  {/* Date & Time */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="time-outline" size={16} color={colors.primary} />
                    <Text style={{ color: colors.foreground, fontSize: 15 }}>
                      {formatDateTime(event.startDate)}
                    </Text>
                  </View>

                  {event.endDate && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="arrow-forward-outline" size={16} color={colors.muted} />
                      <Text style={{ color: colors.muted, fontSize: 14 }}>
                        to {formatDateTime(event.endDate)}
                      </Text>
                    </View>
                  )}

                  {/* Location */}
                  {event.location && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="location-outline" size={16} color={colors.primary} />
                      <Text style={{ color: colors.foreground, fontSize: 15, flex: 1 }}>
                        {event.location}
                      </Text>
                    </View>
                  )}

                  {/* Description */}
                  {event.description && (
                    <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
                      {event.description}
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
                    onPress={() => handleEditEvent(event)}
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
                    onPress={() => handleConfirmEvent(event)}
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
                        opacity: pressed ? 0.7 : 1,
                        backgroundColor: pressed ? `${colors.success}10` : "transparent",
                      },
                    ]}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                    <Text style={{ color: colors.success, fontWeight: "600", fontSize: 15 }}>
                      Confirm
                    </Text>
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
    </ScreenContainer>
  );
}
