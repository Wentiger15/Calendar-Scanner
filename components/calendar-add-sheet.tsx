import { Text, View, Pressable, Modal, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import {
  CalendarEvent,
  openGoogleCalendar,
  openAppleCalendarWeb,
  openAppleCalendarWebMulti,
  addToNativeCalendar,
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
 * On Native: Directly opens the system calendar UI (no sheet needed).
 */
export function CalendarAddSheet({ visible, onClose, events, onSuccess, onCancel }: CalendarAddSheetProps) {
  const colors = useColors();
  const isSingle = events.length === 1;
  const firstEvent = events[0];

  const handleGoogleCalendar = async () => {
    try {
      // For multiple events, open Google Calendar for each one
      for (const evt of events) {
        await openGoogleCalendar(evt);
        // Small delay between opens to avoid popup blocking
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

  const handleAppleCalendar = () => {
    try {
      if (isSingle) {
        openAppleCalendarWeb(firstEvent);
      } else {
        openAppleCalendarWebMulti(events);
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Apple Calendar error:", error);
    }
  };

  if (Platform.OS !== "web") {
    // On native, we don't show this sheet - use addToNativeCalendar directly
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
            Add to Calendar
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
              ? "Choose your calendar app"
              : `Add ${events.length} events to your calendar`}
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
                Opens in browser, sign in to save
              </Text>
            </View>
            <Ionicons name="open-outline" size={20} color={colors.muted} />
          </Pressable>

          {/* Apple Calendar Button */}
          <Pressable
            onPress={handleAppleCalendar}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                gap: 16,
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 18,
                marginBottom: 20,
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
                backgroundColor: "#FF375F20",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 24 }}>🍎</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "600", color: colors.foreground }}>
                Apple Calendar
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
                Opens iOS Calendar app directly
              </Text>
            </View>
            <Ionicons name="open-outline" size={20} color={colors.muted} />
          </Pressable>

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
            <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 16 }}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
