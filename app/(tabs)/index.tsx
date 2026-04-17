import { Text, View, Pressable, ActivityIndicator, Alert, FlatList, StyleSheet } from "react-native";
import { useState, useCallback, useRef } from "react";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

interface RecentEvent {
  id: string;
  title: string;
  startDate: string;
  location?: string;
  addedAt?: string;
}

/** Swipeable history row with delete action */
function SwipeableHistoryItem({
  item,
  colors,
  onDelete,
}: {
  item: RecentEvent;
  colors: ReturnType<typeof useColors>;
  onDelete: (id: string) => void;
}) {
  const translateX = useSharedValue(0);
  const DELETE_THRESHOLD = -80;

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .onUpdate((e) => {
      // Only allow left swipe
      translateX.value = Math.min(0, Math.max(-120, e.translationX));
    })
    .onEnd(() => {
      if (translateX.value < DELETE_THRESHOLD) {
        translateX.value = withTiming(-120);
      } else {
        translateX.value = withTiming(0);
      }
    })
    .runOnJS(true);

  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      if (translateX.value < -10) {
        translateX.value = withTiming(0);
      }
    })
    .runOnJS(true);

  const composed = Gesture.Simultaneous(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleDelete = useCallback(() => {
    translateX.value = withTiming(-400, { duration: 200 }, () => {
      runOnJS(onDelete)(item.id);
    });
  }, [item.id, onDelete]);

  return (
    <View style={styles.swipeContainer}>
      {/* Delete button behind */}
      <Pressable
        onPress={handleDelete}
        style={({ pressed }) => [
          styles.deleteButton,
          { backgroundColor: colors.error, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Ionicons name="trash-outline" size={20} color="white" />
        <Text style={styles.deleteText}>刪除</Text>
      </Pressable>

      {/* Swipeable foreground */}
      <GestureDetector gesture={composed}>
        <Animated.View style={[animatedStyle]}>
          <View
            style={[
              styles.historyCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.historyTitle, { color: colors.foreground }]}>
              {item.title}
            </Text>
            <View style={styles.historyRow}>
              <Ionicons name="time-outline" size={14} color={colors.muted} />
              <Text style={[styles.historyMeta, { color: colors.muted }]}>
                {formatDate(item.startDate)}
              </Text>
            </View>
            {item.location ? (
              <View style={styles.historyRow}>
                <Ionicons name="location-outline" size={14} color={colors.muted} />
                <Text style={[styles.historyMeta, { color: colors.muted, flex: 1 }]}>
                  {item.location}
                </Text>
              </View>
            ) : null}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("zh-TW", {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadRecentEvents();
    }, [])
  );

  const loadRecentEvents = async () => {
    try {
      const stored = await AsyncStorage.getItem("recentEvents");
      if (stored) {
        setRecentEvents(JSON.parse(stored).slice(0, 10));
      }
    } catch (error) {
      console.error("Failed to load recent events:", error);
    }
  };

  const deleteEvent = useCallback(async (id: string) => {
    try {
      const stored = await AsyncStorage.getItem("recentEvents");
      if (stored) {
        const all: RecentEvent[] = JSON.parse(stored);
        const filtered = all.filter((e) => e.id !== id);
        await AsyncStorage.setItem("recentEvents", JSON.stringify(filtered));
        setRecentEvents(filtered.slice(0, 10));
      }
    } catch (error) {
      console.error("Failed to delete event:", error);
    }
  }, []);

  const handlePickImage = async () => {
    try {
      setIsLoading(true);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("需要權限", "我們需要存取你的相簿來選擇圖片。");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        router.push({
          pathname: "/event-preview",
          params: { imageUri: result.assets[0].uri },
        });
      }
    } catch (error) {
      Alert.alert("錯誤", "選擇圖片失敗，請重試。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      setIsLoading(true);
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("需要權限", "我們需要存取你的相機來拍照。");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        router.push({
          pathname: "/event-preview",
          params: { imageUri: result.assets[0].uri },
        });
      }
    } catch (error) {
      Alert.alert("錯誤", "拍照失敗，請重試。");
    } finally {
      setIsLoading(false);
    }
  };

  const renderHistoryItem = useCallback(
    ({ item }: { item: RecentEvent }) => (
      <SwipeableHistoryItem item={item} colors={colors} onDelete={deleteEvent} />
    ),
    [colors, deleteEvent]
  );

  const keyExtractor = useCallback((item: RecentEvent) => item.id, []);

  const ListHeader = useCallback(
    () => (
      <View style={styles.headerContainer}>
        {/* Hero */}
        <View style={styles.heroSection}>
          <View
            style={[styles.heroIcon, { backgroundColor: `${colors.primary}15` }]}
          >
            <Ionicons name="scan-outline" size={36} color={colors.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            日程掃描器
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.muted }]}>
            掃描含有日程資訊的圖片，快速添加活動到你的日曆
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonGroup}>
          <Pressable
            onPress={handleTakePhoto}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="camera" size={22} color="white" />
                <Text style={styles.primaryButtonText}>拍照掃描</Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={handlePickImage}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: colors.primary,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons name="image" size={22} color={colors.primary} />
                <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                  從相簿選擇
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Tips */}
        <View style={[styles.tipsCard, { backgroundColor: `${colors.primary}08` }]}>
          <Text style={[styles.tipsTitle, { color: colors.foreground }]}>
            使用小提示
          </Text>
          <TipRow icon="checkmark-circle" color={colors.success} text="確保圖片中的日期和時間清晰可見" mutedColor={colors.muted} />
          <TipRow icon="checkmark-circle" color={colors.success} text="支援多種格式：下午3點、3:30 PM、14:00 等" mutedColor={colors.muted} />
          <TipRow icon="checkmark-circle" color={colors.success} text="適用於海報、截圖、手寫筆記等" mutedColor={colors.muted} />
          <TipRow icon="checkmark-circle" color={colors.success} text="一張圖片可以識別多個活動" mutedColor={colors.muted} />
        </View>

        {/* Section header for recent events */}
        {recentEvents.length > 0 ? (
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              最近添加
            </Text>
            <Text style={[styles.sectionHint, { color: colors.muted }]}>
              左滑可刪除
            </Text>
          </View>
        ) : null}
      </View>
    ),
    [colors, isLoading, recentEvents.length]
  );

  const ListEmpty = useCallback(
    () => (
      <View style={styles.emptyState}>
        <Ionicons name="calendar-outline" size={48} color={colors.muted} />
        <Text style={[styles.emptyText, { color: colors.muted }]}>
          {"尚未添加任何活動\n掃描一張圖片開始使用！"}
        </Text>
      </View>
    ),
    [colors.muted]
  );

  return (
    <ScreenContainer className="bg-background">
      <FlatList
        data={recentEvents}
        renderItem={renderHistoryItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="always"
      />
    </ScreenContainer>
  );
}

/** Small tip row component */
function TipRow({
  icon,
  color,
  text,
  mutedColor,
}: {
  icon: string;
  color: string;
  text: string;
  mutedColor: string;
}) {
  return (
    <View style={styles.tipRow}>
      <Ionicons name={icon as any} size={16} color={color} style={styles.tipIcon} />
      <Text style={[styles.tipText, { color: mutedColor }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  headerContainer: {
    gap: 24,
    paddingTop: 24,
  },
  heroSection: {
    alignItems: "center",
    gap: 8,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 16,
    lineHeight: 22,
  },
  buttonGroup: {
    gap: 12,
  },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 17,
  },
  secondaryButton: {
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  secondaryButtonText: {
    fontWeight: "600",
    fontSize: 17,
  },
  tipsCard: {
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  tipIcon: {
    marginTop: 2,
  },
  tipText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  sectionHint: {
    fontSize: 12,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  separator: {
    height: 10,
  },
  // Swipeable item styles
  swipeContainer: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 14,
  },
  deleteButton: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 120,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    gap: 4,
  },
  deleteText: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
  },
  historyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  historyMeta: {
    fontSize: 14,
  },
});
