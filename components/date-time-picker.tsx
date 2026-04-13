import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface DateTimePickerFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  mode: "date" | "time";
  required?: boolean;
}

export function DateTimePickerField({
  label,
  value,
  onChange,
  mode,
  required = false,
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
    return formatTime(value);
  };

  const getIcon = (): "calendar-outline" | "time-outline" => {
    return mode === "date" ? "calendar-outline" : "time-outline";
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
    setTempDate(new Date(value.getTime()));
    setShowPicker(true);
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
        {label}
        {required ? " *" : ""}
      </Text>
      <Pressable
        onPress={openPicker}
        style={({ pressed }) => ({
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
        })}
      >
        <Text style={{ color: colors.foreground, fontSize: 16 }}>{getDisplayText()}</Text>
        <Ionicons name={getIcon()} size={20} color={colors.muted} />
      </Pressable>

      {showPicker && (
        <Modal transparent animationType="slide">
          <Pressable
            onPress={handleCancel}
            style={{
              flex: 1,
              justifyContent: "flex-end",
              backgroundColor: "rgba(0,0,0,0.4)",
            }}
          >
            <Pressable
              onPress={() => {}}
              style={{
                backgroundColor: colors.background,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: 40,
              }}
            >
              {/* Toolbar */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 14,
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

              {/* Picker Content */}
              {mode === "date" ? (
                <DatePicker
                  value={tempDate}
                  onChange={(d) => setTempDate(d)}
                  colors={colors}
                />
              ) : (
                <TimePicker
                  value={tempDate}
                  onChange={(d) => setTempDate(d)}
                  colors={colors}
                />
              )}
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

/* ─── Wheel-style Picker Column ─── */

interface WheelPickerProps {
  items: { label: string; value: number }[];
  selectedValue: number;
  onValueChange: (value: number) => void;
  colors: any;
  width?: number;
}

function WheelPicker({ items, selectedValue, onValueChange, colors, width = 80 }: WheelPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const isUserScrolling = useRef(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIndex = items.findIndex((item) => item.value === selectedValue);

  useEffect(() => {
    if (!isUserScrolling.current && scrollRef.current) {
      const offset = selectedIndex * ITEM_HEIGHT;
      scrollRef.current.scrollTo({ y: offset, animated: false });
    }
  }, [selectedIndex]);

  const handleScrollEnd = (offsetY: number) => {
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
    if (items[clampedIndex] && items[clampedIndex].value !== selectedValue) {
      onValueChange(items[clampedIndex].value);
    }
    // Snap to position
    scrollRef.current?.scrollTo({ y: clampedIndex * ITEM_HEIGHT, animated: true });
    isUserScrolling.current = false;
  };

  return (
    <View style={{ width, height: PICKER_HEIGHT, overflow: "hidden" }}>
      {/* Selection highlight */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: ITEM_HEIGHT * 2,
          left: 4,
          right: 4,
          height: ITEM_HEIGHT,
          backgroundColor: `${colors.primary}12`,
          borderRadius: 10,
          zIndex: 1,
        }}
      />
      {/* Top/bottom fade masks */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: ITEM_HEIGHT * 2,
          zIndex: 2,
          opacity: 0.7,
          backgroundColor: colors.background,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: ITEM_HEIGHT * 2,
          zIndex: 2,
          opacity: 0.7,
          backgroundColor: colors.background,
        }}
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{
          paddingVertical: ITEM_HEIGHT * 2,
        }}
        onScrollBeginDrag={() => {
          isUserScrolling.current = true;
        }}
        onMomentumScrollEnd={(e) => {
          handleScrollEnd(e.nativeEvent.contentOffset.y);
        }}
        onScrollEndDrag={(e) => {
          // For cases where momentum doesn't trigger
          if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
          scrollTimeout.current = setTimeout(() => {
            handleScrollEnd(e.nativeEvent.contentOffset.y);
          }, 150);
        }}
      >
        {items.map((item, index) => {
          const isSelected = item.value === selectedValue;
          return (
            <Pressable
              key={`${item.value}-${index}`}
              onPress={() => {
                onValueChange(item.value);
                scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
              }}
              style={{
                height: ITEM_HEIGHT,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: isSelected ? 20 : 16,
                  fontWeight: isSelected ? "600" : "400",
                  color: isSelected ? colors.foreground : colors.muted,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ─── Date Picker ─── */

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  colors: any;
}

function DatePicker({ value, onChange, colors }: DatePickerProps) {
  const currentYear = new Date().getFullYear();

  const years = Array.from({ length: 11 }, (_, i) => {
    const y = currentYear - 2 + i;
    return { label: String(y), value: y };
  });

  const months = Array.from({ length: 12 }, (_, i) => ({
    label: [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ][i],
    value: i,
  }));

  const daysInMonth = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => ({
    label: String(i + 1).padStart(2, "0"),
    value: i + 1,
  }));

  const handleYearChange = (year: number) => {
    const newDate = new Date(value.getTime());
    newDate.setFullYear(year);
    // Clamp day if needed
    const maxDay = new Date(year, newDate.getMonth() + 1, 0).getDate();
    if (newDate.getDate() > maxDay) newDate.setDate(maxDay);
    onChange(newDate);
  };

  const handleMonthChange = (month: number) => {
    const newDate = new Date(value.getTime());
    newDate.setMonth(month);
    const maxDay = new Date(newDate.getFullYear(), month + 1, 0).getDate();
    if (newDate.getDate() > maxDay) newDate.setDate(maxDay);
    onChange(newDate);
  };

  const handleDayChange = (day: number) => {
    const newDate = new Date(value.getTime());
    newDate.setDate(day);
    onChange(newDate);
  };

  return (
    <View style={{ flexDirection: "row", justifyContent: "center", paddingVertical: 8 }}>
      <WheelPicker
        items={years}
        selectedValue={value.getFullYear()}
        onValueChange={handleYearChange}
        colors={colors}
        width={90}
      />
      <WheelPicker
        items={months}
        selectedValue={value.getMonth()}
        onValueChange={handleMonthChange}
        colors={colors}
        width={80}
      />
      <WheelPicker
        items={days}
        selectedValue={value.getDate()}
        onValueChange={handleDayChange}
        colors={colors}
        width={70}
      />
    </View>
  );
}

/* ─── Time Picker ─── */

interface TimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  colors: any;
}

function TimePicker({ value, onChange, colors }: TimePickerProps) {
  const hours = Array.from({ length: 24 }, (_, i) => ({
    label: String(i).padStart(2, "0"),
    value: i,
  }));

  const minutes = Array.from({ length: 60 }, (_, i) => ({
    label: String(i).padStart(2, "0"),
    value: i,
  }));

  const handleHourChange = (hour: number) => {
    const newDate = new Date(value.getTime());
    newDate.setHours(hour);
    onChange(newDate);
  };

  const handleMinuteChange = (minute: number) => {
    const newDate = new Date(value.getTime());
    newDate.setMinutes(minute);
    onChange(newDate);
  };

  return (
    <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: 8 }}>
      <WheelPicker
        items={hours}
        selectedValue={value.getHours()}
        onValueChange={handleHourChange}
        colors={colors}
        width={90}
      />
      <Text style={{ fontSize: 24, fontWeight: "700", color: colors.foreground, marginHorizontal: 4 }}>
        :
      </Text>
      <WheelPicker
        items={minutes}
        selectedValue={value.getMinutes()}
        onValueChange={handleMinuteChange}
        colors={colors}
        width={90}
      />
    </View>
  );
}
