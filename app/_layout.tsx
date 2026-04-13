import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Tabs, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../hooks/useAppTheme";
import {
  getNotificationSummary,
  subscribeNotificationCenterChanges,
} from "../utils/notification-center";

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
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: colors.cardAltBg,
          borderColor: colors.border,
          opacity: pressed ? 0.86 : 1,
        },
      ]}
      hitSlop={8}
    >
      <Ionicons name={icon} size={20} color={colors.text} />

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
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }

        router.replace("/");
      }}
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

  useEffect(() => {
    const unsubscribe = subscribeNotificationCenterChanges(() => {
      loadUnreadCount().catch((error) => {
        console.log("Header bildirim rozeti güncellenemedi:", error);
      });
    });

    loadUnreadCount().catch((error) => {
      console.log("Header bildirim sayısı ilk yüklemede alınamadı:", error);
    });

    return unsubscribe;
  }, [loadUnreadCount]);

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
        tabBarStyle: {
          display: "none",
        },
        headerStyle: {
          backgroundColor: colors.screenBg,
        },
        headerShadowVisible: false,
        headerTintColor: colors.text,
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
        name="menu"
        options={{
          title: "Menü",
          headerTitle: () => <HeaderTitle title="Menü" />,
          headerLeft: () => <MenuCloseButton />,
          headerRight: () => null,
        }}
      />

      <Tabs.Screen
        name="bildirimler"
        options={{
          title: "Bildirimler",
          headerTitle: () => <HeaderTitle title="Bildirimler" />,
          headerLeft: () => <MenuCloseButton />,
          headerRight: () => null,
        }}
      />

      <Tabs.Screen
        name="duyurular"
        options={{
          title: "Duyurular",
          headerTitle: () => <HeaderTitle title="Duyurular" />,
          headerLeft: () => <MenuCloseButton />,
          headerRight: () => null,
        }}
      />

      <Tabs.Screen
        name="iletisim"
        options={{
          title: "İletişim",
          headerTitle: () => <HeaderTitle title="İletişim" />,
          headerLeft: () => <MenuCloseButton />,
          headerRight: () => null,
        }}
      />

      <Tabs.Screen
        name="sss"
        options={{
          title: "Sık Sorulan Sorular",
          headerTitle: () => <HeaderTitle title="SSS" />,
          headerLeft: () => <MenuCloseButton />,
          headerRight: () => null,
        }}
      />

      <Tabs.Screen
        name="bilgilendirme"
        options={{
          title: "Bilgilendirme",
          headerTitle: () => <HeaderTitle title="Bilgilendirme" />,
          headerLeft: () => <MenuCloseButton />,
          headerRight: () => null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  headerLeftInset: {
    paddingLeft: 14,
  },
  headerRightInset: {
    paddingRight: 14,
  },
});
