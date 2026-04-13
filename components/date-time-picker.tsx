import { useState } from "react";
import { View, Text, Pressable, Platform, Modal } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";

interface DateTimePickerFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  mode: "date" | "time" | "datetime";
  required?: boolean;
  placeholder?: string;
}

export function DateTimePickerField({
  label,
  value,
  onChange,
  mode,
  required = false,
  placeholder,
}: DateTimePickerFieldProps) {
  const colors = useColors();
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(value);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatTime = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const getDisplayText = () => {
    if (mode === "date") return formatDate(value);
    if (mode === "time") return formatTime(value);
    return `${formatDate(value)} ${formatTime(value)}`;
  };

  const getIcon = () => {
    if (mode === "date") return "calendar-outline" as const;
    if (mode === "time") return "time-outline" as const;
    return "calendar-outline" as const;
  };

  const handleChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
      if (selectedDate) {
        onChange(selectedDate);
      }
    } else {
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    }
  };

  const handleConfirm = () => {
    onChange(tempDate);
    setShowPicker(false);
  };

  const handleCancel = () => {
    setTempDate(value);
    setShowPicker(false);
  };

  const openPicker = () => {
    setTempDate(value);
    setShowPicker(true);
  };

  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-foreground">
        {label}
        {required && " *"}
      </Text>
      <Pressable
        onPress={openPicker}
        style={({ pressed }) => [
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Text style={{ color: colors.foreground, fontSize: 16 }}>
          {getDisplayText()}
        </Text>
        <Ionicons name={getIcon()} size={20} color={colors.muted} />
      </Pressable>

      {/* iOS: Show picker in a modal */}
      {Platform.OS === "ios" && showPicker && (
        <Modal transparent animationType="slide">
          <View
            style={{
              flex: 1,
              justifyContent: "flex-end",
              backgroundColor: "rgba(0,0,0,0.4)",
            }}
          >
            <View
              style={{
                backgroundColor: colors.background,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: 34,
              }}
            >
              {/* Toolbar */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.border,
                }}
              >
                <Pressable onPress={handleCancel} style={{ padding: 4 }}>
                  <Text style={{ color: colors.muted, fontSize: 16 }}>Cancel</Text>
                </Pressable>
                <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600" }}>
                  {label}
                </Text>
                <Pressable onPress={handleConfirm} style={{ padding: 4 }}>
                  <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "600" }}>
                    Done
                  </Text>
                </Pressable>
              </View>

              <DateTimePicker
                value={tempDate}
                mode={mode === "datetime" ? "date" : mode}
                display="spinner"
                onChange={handleChange}
                textColor={colors.foreground}
                themeVariant="light"
              />
              {mode === "datetime" && (
                <DateTimePicker
                  value={tempDate}
                  mode="time"
                  display="spinner"
                  onChange={handleChange}
                  textColor={colors.foreground}
                  themeVariant="light"
                />
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Android: Show picker directly */}
      {Platform.OS === "android" && showPicker && (
        <DateTimePicker
          value={value}
          mode={mode === "datetime" ? "date" : mode}
          display="default"
          onChange={handleChange}
        />
      )}

      {/* Web: Use native HTML input as fallback */}
      {Platform.OS === "web" && showPicker && (
        <Modal transparent animationType="fade">
          <Pressable
            onPress={handleCancel}
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.4)",
            }}
          >
            <View
              style={{
                backgroundColor: colors.background,
                borderRadius: 16,
                padding: 24,
                width: 320,
                gap: 16,
              }}
            >
              <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "600", textAlign: "center" }}>
                {label}
              </Text>

              <View style={{ alignItems: "center", gap: 12 }}>
                {(mode === "date" || mode === "datetime") && (
                  <input
                    type="date"
                    value={formatDate(tempDate)}
                    onChange={(e) => {
                      const [y, m, d] = e.target.value.split("-").map(Number);
                      const newDate = new Date(tempDate);
                      newDate.setFullYear(y, m - 1, d);
                      setTempDate(newDate);
                    }}
                    style={{
                      fontSize: 18,
                      padding: "10px 16px",
                      borderRadius: 8,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.surface,
                      color: colors.foreground,
                      width: "100%",
                    }}
                  />
                )}
                {(mode === "time" || mode === "datetime") && (
                  <input
                    type="time"
                    value={formatTime(tempDate)}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(":").map(Number);
                      const newDate = new Date(tempDate);
                      newDate.setHours(h, m);
                      setTempDate(newDate);
                    }}
                    style={{
                      fontSize: 18,
                      padding: "10px 16px",
                      borderRadius: 8,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.surface,
                      color: colors.foreground,
                      width: "100%",
                    }}
                  />
                )}
              </View>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <Pressable
                  onPress={handleCancel}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.muted, fontWeight: "600" }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleConfirm}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    alignItems: "center",
                    backgroundColor: colors.primary,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "600" }}>Done</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}
