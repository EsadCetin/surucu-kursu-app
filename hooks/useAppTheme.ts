import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Appearance, Platform, useColorScheme } from "react-native";

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

type ThemeSubscriber = (nextTheme: AppThemeMode) => void;

const themeSubscribers = new Set<ThemeSubscriber>();
let currentThemeMode: AppThemeMode = "system";
let hasHydratedStoredTheme = false;

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

function subscribeThemeChanges(listener: ThemeSubscriber) {
  themeSubscribers.add(listener);

  return () => {
    themeSubscribers.delete(listener);
  };
}

function notifyThemeChange(nextTheme: AppThemeMode) {
  currentThemeMode = nextTheme;
  themeSubscribers.forEach((listener) => listener(nextTheme));
}

function resolveTheme(
  themeMode: AppThemeMode,
  systemScheme: ReturnType<typeof useColorScheme>,
): ResolvedAppTheme {
  if (themeMode === "light") return "light";
  if (themeMode === "dark") return "dark";
  return systemScheme === "dark" ? "dark" : "light";
}

function getThemeColorMetaTag() {
  if (typeof document === "undefined") return null;

  let tag = document.querySelector('meta[name="theme-color"]');

  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", "theme-color");
    document.head.appendChild(tag);
  }

  return tag as HTMLMetaElement;
}

function applyWebThemeDocumentSide(
  theme: ResolvedAppTheme,
  colors: ThemeColors,
) {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const body = document.body;
  const themeColor = colors.screenBg;

  root.style.backgroundColor = colors.screenBg;
  body.style.backgroundColor = colors.screenBg;
  root.style.colorScheme = theme;
  body.style.colorScheme = theme;

  const meta = getThemeColorMetaTag();
  meta?.setAttribute("content", themeColor);
}

export function useAppTheme(): UseAppThemeResult {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<AppThemeMode>(currentThemeMode);
  const [themeReady, setThemeReady] = useState(hasHydratedStoredTheme);

  useEffect(() => {
    const unsubscribe = subscribeThemeChanges((nextTheme) => {
      setThemeMode(nextTheme);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let mounted = true;

    if (hasHydratedStoredTheme) {
      setThemeMode(currentThemeMode);
      setThemeReady(true);
      return () => {
        mounted = false;
      };
    }

    readStoredThemeMode().then((storedTheme) => {
      if (!mounted) return;

      currentThemeMode = storedTheme;
      hasHydratedStoredTheme = true;
      setThemeMode(storedTheme);
      setThemeReady(true);
      notifyThemeChange(storedTheme);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (themeMode !== "system") {
      return;
    }

    const subscription = Appearance.addChangeListener(() => {
      notifyThemeChange(currentThemeMode);
    });

    return () => {
      subscription.remove();
    };
  }, [themeMode]);

  const resolvedTheme = resolveTheme(themeMode, systemScheme);
  const isDark = resolvedTheme === "dark";

  const colors = useMemo(() => (isDark ? darkColors : lightColors), [isDark]);

  useEffect(() => {
    applyWebThemeDocumentSide(resolvedTheme, colors);
  }, [resolvedTheme, colors]);

  const setTheme = useCallback(async (nextTheme: AppThemeMode) => {
    notifyThemeChange(nextTheme);
    await writeStoredThemeMode(nextTheme);
  }, []);

  const toggleTheme = useCallback(async () => {
    const nextTheme: AppThemeMode =
      currentThemeMode === "system"
        ? "dark"
        : currentThemeMode === "dark"
          ? "light"
          : "system";

    notifyThemeChange(nextTheme);
    await writeStoredThemeMode(nextTheme);
  }, []);

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
