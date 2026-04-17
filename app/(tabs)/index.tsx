import { ScrollView, Text, View, Pressable, ActivityIndicator, Alert, FlatList } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface RecentEvent {
  id: string;
  title: string;
  startDate: string;
  location?: string;
  addedAt?: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Reload recent events every time screen comes into focus
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
      console.error("Image picker error:", error);
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
      console.error("Camera error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
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
  };

  const renderRecentEvent = ({ item }: { item: RecentEvent }) => (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        gap: 6,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>
        {item.title}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name="time-outline" size={14} color={colors.muted} />
        <Text style={{ fontSize: 14, color: colors.muted }}>
          {formatDate(item.startDate)}
        </Text>
      </View>
      {item.location && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="location-outline" size={14} color={colors.muted} />
          <Text style={{ fontSize: 14, color: colors.muted, flex: 1 }}>
            {item.location}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="flex-1 gap-8 p-6">
          {/* Hero Section */}
          <View className="items-center gap-4 mt-6">
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: `${colors.primary}15`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="scan-outline" size={36} color={colors.primary} />
            </View>
            <Text className="text-3xl font-bold text-foreground text-center">
              日程掃描器
            </Text>
            <Text className="text-base text-muted text-center px-4">
              掃描含有日程資訊的圖片，快速添加活動到你的日曆
            </Text>
          </View>

          {/* Action Buttons */}
          <View className="gap-3">
            <Pressable
              onPress={handleTakePhoto}
              disabled={isLoading}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                  borderRadius: 16,
                  paddingVertical: 18,
                  paddingHorizontal: 24,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="camera" size={22} color="white" />
                  <Text style={{ color: "white", fontWeight: "600", fontSize: 17 }}>
                    拍照掃描
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={handlePickImage}
              disabled={isLoading}
              style={({ pressed }) => [
                {
                  borderColor: colors.primary,
                  borderWidth: 2,
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                  borderRadius: 16,
                  paddingVertical: 16,
                  paddingHorizontal: 24,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="image" size={22} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 17 }}>
                    從相簿選擇
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          {/* Tips Section */}
          <View
            style={{
              backgroundColor: `${colors.primary}08`,
              borderRadius: 14,
              padding: 16,
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
              使用小提示
            </Text>
            <View style={{ gap: 6 }}>
              {[
                "確保圖片中的日期和時間清晰可見",
                "支援多種格式：下午3點、3:30 PM、14:00 等",
                "適用於海報、截圖、手寫筆記等",
                "一張圖片可以識別多個活動",
              ].map((tip, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginTop: 2 }} />
                  <Text style={{ fontSize: 13, color: colors.muted, flex: 1, lineHeight: 18 }}>
                    {tip}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Recent Events */}
          {recentEvents.length > 0 && (
            <View className="gap-3">
              <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>
                最近添加
              </Text>
              <FlatList
                data={recentEvents}
                renderItem={renderRecentEvent}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              />
            </View>
          )}

          {/* Empty State */}
          {recentEvents.length === 0 && (
            <View className="flex-1 items-center justify-center gap-3 py-8">
              <Ionicons name="calendar-outline" size={48} color={colors.muted} />
              <Text className="text-base text-muted text-center">
                尚未添加任何活動{"\n"}掃描一張圖片開始使用！
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
