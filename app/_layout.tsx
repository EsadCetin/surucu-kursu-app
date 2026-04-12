import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Tabs, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../hooks/useAppTheme";
import { getNotificationSummary } from "../utils/notification-center";

const STUDENT_SESSION_TC_KEY = "student_session_tc";

type HeaderButtonProps = {
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  showBadge?: boolean;
  badgeCount?: number;
  colors: {
    text: string;
    cardAltBg: string;
    border: string;
    accent: string;
    accentContrast?: string;
  };
};

function HeaderIconButton({
  onPress,
  icon,
  showBadge = false,
  badgeCount = 0,
  colors,
}: HeaderButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={[
        styles.iconButton,
        {
          backgroundColor: colors.cardAltBg,
          borderColor: colors.border,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
      {showBadge ? (
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Text style={styles.badgeText}>
            {badgeCount > 9 ? "9+" : badgeCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function HeaderTitle({ title }: { title: string }) {
  const { colors } = useAppTheme();

  return (
    <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
  );
}

function MenuButton() {
  const router = useRouter();
  const { colors } = useAppTheme();

  return (
    <HeaderIconButton
      onPress={() => router.push("/menu")}
      icon="menu"
      colors={colors}
    />
  );
}

function MenuCloseButton() {
  const router = useRouter();
  const { colors } = useAppTheme();

  return (
    <HeaderIconButton
      onPress={() => router.back()}
      icon="close"
      colors={colors}
    />
  );
}

function NotificationButton() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    const studentTc =
      (await AsyncStorage.getItem(STUDENT_SESSION_TC_KEY)) || "";

    if (!studentTc) {
      setUnreadCount(0);
      return;
    }

    const summary = await getNotificationSummary(studentTc);
    setUnreadCount(summary.unreadCount);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUnreadCount().catch((error) => {
        console.log("Header bildirim özeti yüklenemedi:", error);
      });
    }, [loadUnreadCount]),
  );

  return (
    <HeaderIconButton
      onPress={() => router.push("/bildirimler")}
      icon="notifications-outline"
      colors={colors}
      showBadge={unreadCount > 0}
      badgeCount={unreadCount}
    />
  );
}

export default function Layout() {
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarStyle: { display: "none" },
        headerStyle: {
          backgroundColor: colors.cardBg,
        },
        headerShadowVisible: false,
        headerTitleAlign: "center",
        headerLeft: () => <MenuButton />,
        headerRight: () => <NotificationButton />,
        headerLeftContainerStyle: styles.headerLeftInset,
        headerRightContainerStyle: styles.headerRightInset,
        sceneStyle: {
          backgroundColor: colors.screenBg,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Ana Sayfa",
          headerTitle: () => <HeaderTitle title="Ana Sayfa" />,
        }}
      />
      <Tabs.Screen
        name="bildirimler"
        options={{
          title: "Bildirimler",
          headerTitle: () => <HeaderTitle title="Bildirimler" />,
        }}
      />
      <Tabs.Screen
        name="duyurular"
        options={{
          title: "Duyurular",
          headerTitle: () => <HeaderTitle title="Duyurular" />,
        }}
      />
      <Tabs.Screen
        name="iletisim"
        options={{
          title: "İletişim",
          headerTitle: () => <HeaderTitle title="İletişim" />,
        }}
      />
      <Tabs.Screen
        name="sss"
        options={{
          title: "SSS",
          headerTitle: () => <HeaderTitle title="Sıkça Sorulan Sorular" />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: "Menü",
          href: null,
          headerLeft: () => <MenuCloseButton />,
          headerRight: () => null,
          headerTitle: () => <HeaderTitle title="Menü" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  headerLeftInset: {
    paddingLeft: 20,
  },
  headerRightInset: {
    paddingRight: 20,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    top: -4,
    right: -4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
});
