import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";

export type AppTheme = "dark" | "light";

export type AppThemeColors = {
  screenBg: string;
  cardBg: string;
  cardAltBg: string;
  border: string;
  text: string;
  subText: string;
  mutedText: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  accent: string;
  accentContrast: string;
  accentSoft: string;
  overlay: string;
  tabBarBg: string;
  tabBarInactive: string;
};

const THEME_KEY = "app_theme_preference";
const listeners = new Set<(theme: AppTheme) => void>();

let cachedTheme: AppTheme = "dark";
let hasLoadedTheme = false;

const themeColorsMap: Record<AppTheme, AppThemeColors> = {
  dark: {
    screenBg: "#0d0d10",
    cardBg: "#0d0d10",
    cardAltBg: "#1d1d23",
    border: "#2a2a31",
    text: "#ffffff",
    subText: "#d8d8dd",
    mutedText: "#8d8d95",
    inputBg: "#111114",
    inputBorder: "#2a2a31",
    inputText: "#ffffff",
    accent: "#c1121f",
    accentContrast: "#ffffff",
    accentSoft: "rgba(193,18,31,0.12)",
    overlay: "rgba(0,0,0,0.55)",
    tabBarBg: "#1d1d23",
    tabBarInactive: "#6B7280",
  },
  light: {
    screenBg: "#f5f7fb",
    cardBg: "#f5f7fb",
    cardAltBg: "#eef2f7",
    border: "#d8dee8",
    text: "#111827",
    subText: "#374151",
    mutedText: "#6b7280",
    inputBg: "#ffffff",
    inputBorder: "#cfd8e3",
    inputText: "#111827",
    accent: "#c1121f",
    accentContrast: "#ffffff",
    accentSoft: "rgba(193,18,31,0.08)",
    overlay: "rgba(15,23,42,0.32)",
    tabBarBg: "#ffffff",
    tabBarInactive: "#667085",
  },
};

async function loadStoredTheme(): Promise<AppTheme> {
  if (hasLoadedTheme) {
    return cachedTheme;
  }

  try {
    const storedTheme = await AsyncStorage.getItem(THEME_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
      cachedTheme = storedTheme;
    }
  } catch (error) {
    console.log("Tema tercihi okunamadı:", error);
  }

  hasLoadedTheme = true;
  return cachedTheme;
}

async function persistTheme(nextTheme: AppTheme) {
  cachedTheme = nextTheme;
  hasLoadedTheme = true;

  listeners.forEach((listener) => listener(nextTheme));

  try {
    await AsyncStorage.setItem(THEME_KEY, nextTheme);
  } catch (error) {
    console.log("Tema tercihi kaydedilemedi:", error);
  }
}

export function useAppTheme() {
  const [theme, setThemeState] = useState<AppTheme>(cachedTheme);
  const [themeReady, setThemeReady] = useState(hasLoadedTheme);

  useEffect(() => {
    let mounted = true;

    loadStoredTheme().then((storedTheme) => {
      if (!mounted) return;
      setThemeState(storedTheme);
      setThemeReady(true);
    });

    const listener = (nextTheme: AppTheme) => {
      if (!mounted) return;
      setThemeState(nextTheme);
    };

    listeners.add(listener);

    return () => {
      mounted = false;
      listeners.delete(listener);
    };
  }, []);

  const setTheme = useCallback(async (nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    await persistTheme(nextTheme);
  }, []);

  const toggleTheme = useCallback(async () => {
    const nextTheme: AppTheme = theme === "dark" ? "light" : "dark";
    await setTheme(nextTheme);
  }, [setTheme, theme]);

  const colors = useMemo(() => themeColorsMap[theme], [theme]);

  return {
    theme,
    themeReady,
    colors,
    isDarkTheme: theme === "dark",
    isLightTheme: theme === "light",
    setTheme,
    toggleTheme,
  };
}
