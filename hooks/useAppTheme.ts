import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

export type AppThemeMode = "system" | "light" | "dark";
export type ResolvedAppTheme = "light" | "dark";

type ThemeColors = {
  bg: string;
  screenBg: string;
  cardBg: string;
  cardAltBg: string;
  border: string;
  borderStrong: string;
  text: string;
  subText: string;
  mutedText: string;
  accent: string;
  accentContrast: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  overlay: string;
  tabBarBg: string;
  tabBarInactive: string;
  inputBg: string;
  inputBorder: string;
  shadow: string;
};

type UseAppThemeResult = {
  theme: ResolvedAppTheme;
  resolvedTheme: ResolvedAppTheme;
  themeMode: AppThemeMode;
  isDark: boolean;
  themeReady: boolean;
  colors: ThemeColors;
  setTheme: (nextTheme: AppThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
};

const THEME_KEY = "app_theme_mode_v2";

const lightColors: ThemeColors = {
  bg: "#F3F6FB",
  screenBg: "#F3F6FB",
  cardBg: "#FFFFFF",
  cardAltBg: "#EEF3FB",
  border: "#D5DFEC",
  borderStrong: "#B7C7DD",
  text: "#0F172A",
  subText: "#475569",
  mutedText: "#64748B",
  accent: "#0F6CBD",
  accentContrast: "#FFFFFF",
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
  info: "#2563EB",
  overlay: "rgba(15, 23, 42, 0.10)",
  tabBarBg: "#FFFFFF",
  tabBarInactive: "#64748B",
  inputBg: "#FFFFFF",
  inputBorder: "#C7D3E3",
  shadow: "rgba(15, 23, 42, 0.08)",
};

const darkColors: ThemeColors = {
  bg: "#050816",
  screenBg: "#050816",
  cardBg: "#0B1120",
  cardAltBg: "#131C30",
  border: "#1F2A44",
  borderStrong: "#31405F",
  text: "#F8FAFC",
  subText: "#CBD5E1",
  mutedText: "#94A3B8",
  accent: "#0F6CBD",
  accentContrast: "#FFFFFF",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#60A5FA",
  overlay: "rgba(2, 6, 23, 0.55)",
  tabBarBg: "#0B1120",
  tabBarInactive: "#94A3B8",
  inputBg: "#090D1A",
  inputBorder: "#1F4F88",
  shadow: "rgba(2, 6, 23, 0.45)",
};

async function readStoredThemeMode(): Promise<AppThemeMode> {
  try {
    const stored = await AsyncStorage.getItem(THEME_KEY);

    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch (error) {
    console.log("Tema tercihi okunamadı:", error);
  }

  return "system";
}

async function writeStoredThemeMode(nextTheme: AppThemeMode) {
  try {
    await AsyncStorage.setItem(THEME_KEY, nextTheme);
  } catch (error) {
    console.log("Tema tercihi kaydedilemedi:", error);
  }
}

function resolveTheme(
  themeMode: AppThemeMode,
  systemScheme: ReturnType<typeof useColorScheme>,
): ResolvedAppTheme {
  if (themeMode === "light") return "light";
  if (themeMode === "dark") return "dark";
  return systemScheme === "dark" ? "dark" : "light";
}

export function useAppTheme(): UseAppThemeResult {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<AppThemeMode>("system");
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    readStoredThemeMode().then((storedTheme) => {
      if (!mounted) return;
      setThemeMode(storedTheme);
      setThemeReady(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const resolvedTheme = resolveTheme(themeMode, systemScheme);
  const isDark = resolvedTheme === "dark";

  const colors = useMemo(() => (isDark ? darkColors : lightColors), [isDark]);

  const setTheme = useCallback(async (nextTheme: AppThemeMode) => {
    setThemeMode(nextTheme);
    await writeStoredThemeMode(nextTheme);
  }, []);

  const toggleTheme = useCallback(async () => {
    const nextTheme: AppThemeMode =
      themeMode === "system"
        ? "dark"
        : themeMode === "dark"
          ? "light"
          : "system";

    setThemeMode(nextTheme);
    await writeStoredThemeMode(nextTheme);
  }, [themeMode]);

  return {
    theme: resolvedTheme,
    resolvedTheme,
    themeMode,
    isDark,
    themeReady,
    colors,
    setTheme,
    toggleTheme,
  };
}
