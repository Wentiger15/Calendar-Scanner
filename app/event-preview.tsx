import { ScrollView, Text, View, Pressable, ActivityIndicator, Platform, Alert } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import { CalendarAddSheet } from "@/components/calendar-add-sheet";
import { addToNativeCalendar, type CalendarEvent } from "@/lib/calendar-utils";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Convert an image URI to a base64 data URL.
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

/** Status for each event card's "add to calendar" action */
type AddStatus = "idle" | "adding" | "added" | "canceled" | "error";

/**
 * Group events by title for multi-time-slot display.
 */
function groupEventsByTitle(events: CalendarEvent[]): { title: string; events: CalendarEvent[] }[] {
  const groups: Map<string, CalendarEvent[]> = new Map();
  for (const event of events) {
    const key = event.title.trim();
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(event);
  }
  return Array.from(groups.entries()).map(([title, evts]) => ({ title, events: evts }));
}

export default function EventPreviewScreen() {
  const router = useRouter();
  const colors = useColors();
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addStatuses, setAddStatuses] = useState<Map<number, AddStatus>>(new Map());

  // Calendar add sheet state
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetEvents, setSheetEvents] = useState<CalendarEvent[]>([]);
  const [sheetEventIndices, setSheetEventIndices] = useState<number[]>([]);

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
          setError("無法從此圖片中找到活動資訊。請嘗試使用日期和時間更清晰的圖片。");
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

  const handleEditEvent = (event: CalendarEvent) => {
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
    const label = confidence > 0.8 ? "高" : confidence > 0.6 ? "中" : "低";
    return { percent, color, label };
  };

  /** Save event to recent events in AsyncStorage */
  const saveToRecentEvents = async (evt: CalendarEvent) => {
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
   * Initiate adding event(s) to calendar.
   * On Web: opens the CalendarAddSheet to choose Google/Apple Calendar.
   * On Native: directly opens system calendar UI.
   */
  const initiateAddToCalendar = useCallback(async (evts: CalendarEvent[], indices: number[]) => {
    // Mark all as adding
    setAddStatuses((prev) => {
      const next = new Map(prev);
      indices.forEach((i) => next.set(i, "adding"));
      return next;
    });

    if (Platform.OS === "web") {
      // Show the calendar choice sheet
      setSheetEvents(evts);
      setSheetEventIndices(indices);
      setSheetVisible(true);
    } else {
      // Native: add each event using system calendar UI
      try {
        for (let j = 0; j < evts.length; j++) {
          const evt = evts[j];
          const idx = indices[j];
          const saved = await addToNativeCalendar(evt);
          if (saved) {
            await saveToRecentEvents(evt);
            setAddStatuses((prev) => new Map(prev).set(idx, "added"));
          } else {
            setAddStatuses((prev) => new Map(prev).set(idx, "idle"));
          }
        }
      } catch (error) {
        console.error("Calendar error:", error);
        const errorMsg = error instanceof Error ? error.message : "Failed to add event";
        Alert.alert("錯誤", errorMsg);
        setAddStatuses((prev) => {
          const next = new Map(prev);
          indices.forEach((i) => {
            if (next.get(i) !== "added") next.set(i, "error");
          });
          return next;
        });
      }
    }
  }, []);

  /** Called when the CalendarAddSheet reports success */
  const handleSheetSuccess = useCallback(async () => {
    for (const evt of sheetEvents) {
      await saveToRecentEvents(evt);
    }
    setAddStatuses((prev) => {
      const next = new Map(prev);
      sheetEventIndices.forEach((i) => next.set(i, "added"));
      return next;
    });
  }, [sheetEvents, sheetEventIndices]);

  /** Called when the CalendarAddSheet is canceled */
  const handleSheetCancel = useCallback(() => {
    setAddStatuses((prev) => {
      const next = new Map(prev);
      sheetEventIndices.forEach((i) => {
        if (next.get(i) !== "added") next.set(i, "idle");
      });
      return next;
    });
  }, [sheetEventIndices]);

  // Check if all events in a group are added
  const isGroupAllAdded = (startIndex: number, count: number) => {
    for (let i = startIndex; i < startIndex + count; i++) {
      if (addStatuses.get(i) !== "added") return false;
    }
    return true;
  };

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
          <Text className="text-lg font-semibold text-foreground">正在分析圖片...</Text>
          <Text className="text-sm text-muted text-center px-8">
            正在提取活動詳情，包括日期、時間和地點
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
            無法識別活動
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
              <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>重試</Text>
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
              <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 16 }}>返回</Text>
            </Pressable>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  // Group events by title for multi-time-slot display
  const eventGroups = groupEventsByTitle(events);

  /** Render the status/action indicator for a single event slot */
  const renderSlotStatus = (evt: CalendarEvent, eventIdx: number) => {
    const status = addStatuses.get(eventIdx) || "idle";

    if (status === "added") {
      return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={{ color: colors.success, fontSize: 13, fontWeight: "600" }}>已添加</Text>
        </View>
      );
    }
    if (status === "adding") {
      return <ActivityIndicator size="small" color={colors.primary} />;
    }
    if (status === "error") {
      return (
        <Pressable
          onPress={() => initiateAddToCalendar([evt], [eventIdx])}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flexDirection: "row", alignItems: "center", gap: 4 }]}
        >
          <Ionicons name="refresh" size={16} color={colors.error} />
          <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>重試</Text>
        </Pressable>
      );
    }

    // idle - show compact Add button
    return (
      <Pressable
        onPress={() => initiateAddToCalendar([evt], [eventIdx])}
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
        <Text style={{ color: "white", fontSize: 13, fontWeight: "600" }}>添加</Text>
      </Pressable>
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
                {events.length === 1 ? "找到 1 個活動" : `找到 ${events.length} 個活動`}
              </Text>
              <Text className="text-sm text-muted">
                點擊添加活動到你的日曆
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
              const groupIndices = group.events.map((_, i) => groupStartIndex + i);

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
                          {group.events.length} 個時段
                        </Text>
                      </View>
                      {allAdded && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                          <Text style={{ color: colors.success, fontSize: 12, fontWeight: "600" }}>已全部添加</Text>
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
                                至 {formatShortDateTime(evt.endDate)}
                              </Text>
                            </View>
                          )}
                        </View>
                        {renderSlotStatus(evt, eventIdx)}
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
                      <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>編輯</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => initiateAddToCalendar(group.events, groupIndices)}
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
                      }]}
                    >
                      {anyAdding ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : allAdded ? (
                        <>
                          <Ionicons name="checkmark-done" size={16} color={colors.success} />
                          <Text style={{ color: colors.success, fontWeight: "600", fontSize: 14 }}>已全部添加</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="calendar" size={16} color={colors.primary} />
                          <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>全部添加</Text>
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
                        <Text style={{ color: colors.success, fontSize: 12, fontWeight: "600" }}>已添加</Text>
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
                        至 {formatDateTime(evt.endDate)}
                      </Text>
                    </View>
                  )}

                  {evt.location && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="location-outline" size={16} color={colors.primary} />
                      <Text style={{ color: colors.foreground, fontSize: 15, flex: 1 }}>
                        {evt.location}
                      </Text>
                    </View>
                  )}

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
                      編輯
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => initiateAddToCalendar([evt], [eventIdx])}
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
                      },
                    ]}
                  >
                    {status === "adding" ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : status === "added" ? (
                      <>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={{ color: colors.success, fontWeight: "600", fontSize: 15 }}>已添加</Text>
                      </>
                    ) : status === "error" ? (
                      <>
                        <Ionicons name="refresh" size={16} color={colors.error} />
                        <Text style={{ color: colors.error, fontWeight: "600", fontSize: 15 }}>重試</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="calendar" size={16} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 15 }}>
                          加至日曆
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
              掃描其他圖片
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Calendar choice sheet (Web only) */}
      <CalendarAddSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        events={sheetEvents}
        onSuccess={handleSheetSuccess}
        onCancel={handleSheetCancel}
      />
    </ScreenContainer>
  );
}
