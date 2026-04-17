import { useState } from "react";
import { Text, View, Pressable, Modal, Platform, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import {
  CalendarEvent,
  openGoogleCalendar,
  openAppleCalendarWeb,
} from "@/lib/calendar-utils";

interface CalendarAddSheetProps {
  visible: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  onSuccess: () => void;
  onCancel?: () => void;
}

/**
 * A bottom-sheet-style modal that lets the user choose which calendar to add the event to.
 * 
 * On Web: Shows "Google Calendar" and "Apple Calendar" options.
 * - Google Calendar: opens browser tab with pre-filled event
 * - Apple Calendar: navigates to server .ics URL, iOS Safari opens Calendar app
 * On Native: Directly opens the system calendar UI (no sheet needed).
 */
export function CalendarAddSheet({ visible, onClose, events, onSuccess, onCancel }: CalendarAddSheetProps) {
  const colors = useColors();
  const [addingApple, setAddingApple] = useState<number | null>(null);
  const isSingle = events.length === 1;

  const handleGoogleCalendar = async () => {
    try {
      for (const evt of events) {
        await openGoogleCalendar(evt);
        if (events.length > 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Google Calendar error:", error);
    }
  };

  const handleAppleCalendar = (index: number = 0) => {
    try {
      setAddingApple(index);
      // Navigate to the server .ics URL
      // iOS Safari will recognize text/calendar and open Calendar app
      openAppleCalendarWeb(events[index]);
      // We call onSuccess after a short delay since we can't detect if user actually added it
      setTimeout(() => {
        setAddingApple(null);
        onSuccess();
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Apple Calendar error:", error);
      setAddingApple(null);
    }
  };

  if (Platform.OS !== "web") {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        onCancel?.();
        onClose();
      }}
    >
      <Pressable
        onPress={() => {
          onCancel?.();
          onClose();
        }}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 12,
            paddingBottom: 40,
            paddingHorizontal: 24,
          }}
        >
          {/* Handle bar */}
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
              }}
            />
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: colors.foreground,
              textAlign: "center",
              marginBottom: 4,
            }}
          >
            加至日曆
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.muted,
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            {isSingle
              ? "選擇你的日曆應用"
              : `添加 ${events.length} 個事件到日曆`}
          </Text>

          {/* Google Calendar Button */}
          <Pressable
            onPress={handleGoogleCalendar}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                gap: 16,
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 18,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: "#4285F420",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 24 }}>📅</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "600", color: colors.foreground }}>
                Google Calendar
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
                在瀏覽器中打開，登入後保存
              </Text>
            </View>
            <Ionicons name="open-outline" size={20} color={colors.muted} />
          </Pressable>

          {/* Apple Calendar Button(s) */}
          {isSingle ? (
            <Pressable
              onPress={() => handleAppleCalendar(0)}
              disabled={addingApple !== null}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 16,
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  padding: 18,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: pressed || addingApple !== null ? 0.8 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: "#FF375F20",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {addingApple === 0 ? (
                  <ActivityIndicator size="small" color="#FF375F" />
                ) : (
                  <Text style={{ fontSize: 24 }}>🍎</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: "600", color: colors.foreground }}>
                  Apple 日曆
                </Text>
                <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
                  打開 iOS 日曆 App 添加
                </Text>
              </View>
              <Ionicons name="open-outline" size={20} color={colors.muted} />
            </Pressable>
          ) : (
            // Multiple events: show individual Apple Calendar buttons
            events.map((evt, idx) => (
              <Pressable
                key={idx}
                onPress={() => handleAppleCalendar(idx)}
                disabled={addingApple !== null}
                style={({ pressed }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 16,
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                    padding: 18,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: pressed || addingApple !== null ? 0.8 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: "#FF375F20",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {addingApple === idx ? (
                    <ActivityIndicator size="small" color="#FF375F" />
                  ) : (
                    <Text style={{ fontSize: 24 }}>🍎</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}
                    numberOfLines={1}
                  >
                    Apple 日曆 - 時段 {idx + 1}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }} numberOfLines={1}>
                    {new Date(evt.startDate).toLocaleDateString("zh-TW", {
                      month: "numeric",
                      day: "numeric",
                      weekday: "short",
                    })}{" "}
                    {new Date(evt.startDate).toLocaleTimeString("zh-TW", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                    {evt.endDate &&
                      ` - ${new Date(evt.endDate).toLocaleTimeString("zh-TW", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}`}
                  </Text>
                </View>
                <Ionicons name="open-outline" size={20} color={colors.muted} />
              </Pressable>
            ))
          )}

          {/* Important tip for Apple Calendar */}
          <View
            style={{
              backgroundColor: "#FFF3CD",
              borderRadius: 12,
              padding: 14,
              marginBottom: 20,
              flexDirection: "row",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            <Text style={{ fontSize: 16, marginTop: 1 }}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#856404", lineHeight: 18 }}>
                Apple 日曆提示
              </Text>
              <Text style={{ fontSize: 12, color: "#856404", marginTop: 4, lineHeight: 17 }}>
                點擊後會打開日曆預覽，請點擊底部的「加至日曆」按鈕完成添加。右上角的打勾是關閉預覽，不是確認添加。
              </Text>
            </View>
          </View>

          {/* Cancel */}
          <Pressable
            onPress={() => {
              onCancel?.();
              onClose();
            }}
            style={({ pressed }) => [
              {
                backgroundColor: colors.surface,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: "center",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 16 }}>取消</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
