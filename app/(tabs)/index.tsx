import { ScrollView, Text, View, Pressable, ActivityIndicator, Alert } from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";

interface RecentEvent {
  id: string;
  title: string;
  startDate: string;
  location?: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const extractEventMutation = trpc.events.extractFromImage.useMutation();

  // Load recent events from AsyncStorage on mount
  useEffect(() => {
    loadRecentEvents();
  }, []);

  const loadRecentEvents = async () => {
    try {
      const AsyncStorage = await import("@react-native-async-storage/async-storage").then(
        (m) => m.default
      );
      const stored = await AsyncStorage.getItem("recentEvents");
      if (stored) {
        setRecentEvents(JSON.parse(stored).slice(0, 5));
      }
    } catch (error) {
      console.error("Failed to load recent events:", error);
    }
  };

  const handlePickImage = async () => {
    try {
      setIsLoading(true);

      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "We need permission to access your photo library.");
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        // Navigate to preview screen with the image
        router.push({
          pathname: "/event-preview",
          params: { imageUri },
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

      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "We need permission to access your camera.");
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        // Navigate to preview screen with the image
        router.push({
          pathname: "/event-preview",
          params: { imageUri },
        });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to take photo. Please try again.");
      console.error("Camera error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="flex-1 gap-8 p-6">
          {/* Hero Section */}
          <View className="items-center gap-3 mt-4">
            <View
              className="w-16 h-16 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.primary }}
            >
              <Ionicons name="camera" size={32} color="white" />
            </View>
            <Text className="text-3xl font-bold text-foreground text-center">
              Calendar Scanner
            </Text>
            <Text className="text-base text-muted text-center">
              Scan images to extract calendar events
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
                },
              ]}
              className="rounded-2xl py-4 px-6 items-center justify-center"
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <View className="flex-row items-center gap-3">
                  <Ionicons name="camera" size={20} color="white" />
                  <Text className="text-white font-semibold text-base">Take Photo</Text>
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={handlePickImage}
              disabled={isLoading}
              style={({ pressed }) => [
                {
                  borderColor: colors.primary,
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
              className="rounded-2xl py-4 px-6 items-center justify-center border-2"
            >
              {isLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <View className="flex-row items-center gap-3">
                  <Ionicons name="image" size={20} color={colors.primary} />
                  <Text style={{ color: colors.primary }} className="font-semibold text-base">
                    Choose from Library
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Recent Events Section */}
          {recentEvents.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">Recent Events</Text>
              <View className="gap-2">
                {recentEvents.map((event) => (
                  <View
                    key={event.id}
                    className="bg-surface rounded-xl p-4 border border-border"
                  >
                    <Text className="text-base font-semibold text-foreground">
                      {event.title}
                    </Text>
                    <Text className="text-sm text-muted mt-1">
                      {new Date(event.startDate).toLocaleDateString()}
                    </Text>
                    {event.location && (
                      <Text className="text-sm text-muted mt-1">📍 {event.location}</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Empty State */}
          {recentEvents.length === 0 && (
            <View className="flex-1 items-center justify-center gap-3">
              <Ionicons name="calendar-outline" size={48} color={colors.muted} />
              <Text className="text-base text-muted text-center">
                No events yet. Start by scanning a schedule!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
