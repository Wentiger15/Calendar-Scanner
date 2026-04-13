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
        Alert.alert("Permission Required", "We need permission to access your photo library.");
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
      Alert.alert("Error", "Failed to pick image. Please try again.");
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
        Alert.alert("Permission Required", "We need permission to access your camera.");
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
      Alert.alert("Error", "Failed to take photo. Please try again.");
      console.error("Camera error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString(undefined, {
        month: "short",
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
              Calendar Scanner
            </Text>
            <Text className="text-base text-muted text-center px-4">
              Scan any image with schedule info to quickly add events to your calendar
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
                    Take Photo
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
                    Choose from Library
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
              Tips for best results
            </Text>
            <View style={{ gap: 6 }}>
              {[
                "Make sure dates and times are clearly visible",
                "Supports formats like 8PM, 3:30 PM, 14:00, etc.",
                "Works with posters, screenshots, and handwritten notes",
                "Multiple events can be extracted from one image",
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
                Recently Added
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
                No events added yet.{"\n"}Scan an image to get started!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
