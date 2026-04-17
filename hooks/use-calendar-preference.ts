import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type CalendarType = "google" | "apple" | null;

const STORAGE_KEY = "calendar_preference";

/**
 * Hook to manage calendar preference (Google or Apple).
 * Persists the user's choice in AsyncStorage so they don't have to pick every time.
 */
export function useCalendarPreference() {
  const [preference, setPreference] = useState<CalendarType>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value === "google" || value === "apple") {
          setPreference(value);
        }
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, []);

  const savePreference = useCallback(async (type: CalendarType) => {
    setPreference(type);
    if (type) {
      await AsyncStorage.setItem(STORAGE_KEY, type);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const clearPreference = useCallback(async () => {
    setPreference(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return { preference, loaded, savePreference, clearPreference };
}
