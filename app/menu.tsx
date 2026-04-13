import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useMemo, useRef } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AppThemeMode, useAppTheme } from "../hooks/useAppTheme";

type MenuItem = {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: "/" | "/duyurular" | "/iletisim" | "/sss" | "/bilgilendirme";
};

const STUDENT_SESSION_TC_KEY = "student_session_tc";
const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_CLOSE_THRESHOLD = Math.min(120, SCREEN_WIDTH * 0.28);

const MENU_ITEMS: MenuItem[] = [
  {
    key: "home",
    title: "Ana Sayfa",
    subtitle: "Öğrenci süreç ekranına dön",
    icon: "home-outline",
    route: "/",
  },
  {
    key: "info",
    title: "Bilgilendirme",
    subtitle: "Kayıt ve devam sürecini görüntüle",
    icon: "document-text-outline",
    route: "/bilgilendirme",
  },
  {
    key: "announcements",
    title: "Duyurular",
    subtitle: "Güncel bilgilendirmeleri aç",
    icon: "megaphone-outline",
    route: "/duyurular",
  },
  {
    key: "contact",
    title: "İletişim",
    subtitle: "Telefon, konum ve WhatsApp bilgileri",
    icon: "call-outline",
    route: "/iletisim",
  },
  {
    key: "faq",
    title: "SSS",
    subtitle: "Sık sorulan sorular ekranını aç",
    icon: "help-circle-outline",
    route: "/sss",
  },
];

const THEME_OPTIONS: Array<{
  key: AppThemeMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: "light", label: "Açık", icon: "sunny-outline" },
  { key: "system", label: "Sistem", icon: "phone-portrait-outline" },
  { key: "dark", label: "Koyu", icon: "moon-outline" },
];

export default function MenuScreen() {
  const router = useRouter();
  const { colors, themeMode, setTheme } = useAppTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const isWeb = Platform.OS === "web";

  const closeMenu = () => {
    Animated.timing(translateX, {
      toValue: SCREEN_WIDTH,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      translateX.setValue(0);

      if (router.canGoBack()) {
        router.back();
        return;
      }

      router.replace("/");
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (isWeb) return false;
          const horizontal =
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
          return horizontal && gestureState.dx > 10;
        },
        onPanResponderMove: (_, gestureState) => {
          if (isWeb) return;
          translateX.setValue(Math.max(0, gestureState.dx));
        },
        onPanResponderRelease: (_, gestureState) => {
          if (isWeb) return;

          if (
            gestureState.dx > SWIPE_CLOSE_THRESHOLD ||
            gestureState.vx > 0.8
          ) {
            closeMenu();
            return;
          }

          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
            speed: 20,
          }).start();
        },
        onPanResponderTerminate: () => {
          if (isWeb) return;
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
            speed: 20,
          }).start();
        },
      }),
    [isWeb, router, translateX],
  );

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem(STUDENT_SESSION_TC_KEY);
      router.replace("/");
    } catch {
      Alert.alert("Hata", "Çıkış yapılırken bir sorun oluştu.");
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.screenBg }]}>
      <Animated.View
        style={[
          styles.animatedWrap,
          {
            transform: [{ translateX }],
          },
        ]}
        {...(!isWeb ? panResponder.panHandlers : {})}
      >
        <ScrollView
          style={[styles.container, { backgroundColor: colors.screenBg }]}
          contentContainerStyle={[styles.content, isWeb && styles.webContent]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.heroCard,
              styles.webCard,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
          >
            <View style={styles.heroTopRow}>
              <View
                style={[
                  styles.heroIconWrap,
                  { backgroundColor: colors.accent },
                ]}
              >
                <Ionicons
                  name="menu-outline"
                  size={28}
                  color={colors.accentContrast}
                />
              </View>

              <Pressable
                onPress={closeMenu}
                style={({ pressed }) => [
                  styles.closeButton,
                  {
                    backgroundColor: colors.cardAltBg,
                    borderColor: colors.border,
                    opacity: pressed ? 0.86 : 1,
                  },
                ]}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <Text style={[styles.heroTitle, { color: colors.text }]}>Menü</Text>
            <Text style={[styles.heroText, { color: colors.subText }]}>
              Tema ayarını burada değiştirebilir, diğer sayfalara geçebilir ve
              oturumunu kapatabilirsin.
            </Text>
          </View>

          <View
            style={[
              styles.themeCard,
              styles.webCard,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
          >
            <View style={styles.themeHeaderRow}>
              <View
                style={[
                  styles.themeIconWrap,
                  { backgroundColor: colors.cardAltBg },
                ]}
              >
                <Ionicons
                  name="color-palette-outline"
                  size={20}
                  color={colors.text}
                />
              </View>

              <View style={styles.themeTextWrap}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Tema
                </Text>
                <Text
                  style={[styles.sectionSubtitle, { color: colors.subText }]}
                >
                  Açık, koyu veya telefonun sistem temasını kullan.
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.themeSegment,
                {
                  backgroundColor: colors.cardAltBg,
                  borderColor: colors.border,
                },
              ]}
            >
              {THEME_OPTIONS.map((option) => {
                const selected = themeMode === option.key;

                return (
                  <Pressable
                    key={option.key}
                    onPress={() => {
                      setTheme(option.key).catch((error) => {
                        console.log("Tema değiştirilemedi:", error);
                      });
                    }}
                    style={({ pressed }) => [
                      styles.themeSegmentButton,
                      {
                        backgroundColor: selected
                          ? colors.accent
                          : "transparent",
                        borderColor: selected ? colors.accent : colors.border,
                        opacity: pressed ? 0.88 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={option.icon}
                      size={16}
                      color={selected ? colors.accentContrast : colors.text}
                    />
                    <Text
                      style={[
                        styles.themeSegmentText,
                        {
                          color: selected ? colors.accentContrast : colors.text,
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.listWrap, styles.webCard]}>
            {MENU_ITEMS.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => router.replace(item.route)}
                style={({ pressed }) => [
                  styles.menuCard,
                  {
                    backgroundColor: colors.cardBg,
                    borderColor: colors.border,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.menuIcon,
                    { backgroundColor: colors.cardAltBg },
                  ]}
                >
                  <Ionicons name={item.icon} size={22} color={colors.text} />
                </View>

                <View style={styles.menuBody}>
                  <Text style={[styles.menuTitle, { color: colors.text }]}>
                    {item.title}
                  </Text>
                  <Text
                    style={[styles.menuSubtitle, { color: colors.subText }]}
                  >
                    {item.subtitle}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.mutedText}
                />
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.logoutButton,
              styles.webCard,
              {
                backgroundColor: colors.cardBg,
                borderColor: colors.border,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View
              style={[styles.logoutIcon, { backgroundColor: colors.cardAltBg }]}
            >
              <Ionicons name="log-out-outline" size={22} color={colors.text} />
            </View>

            <View style={styles.menuBody}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>
                Çıkış Yap
              </Text>
              <Text style={[styles.menuSubtitle, { color: colors.subText }]}>
                Öğrenci oturumunu kapat ve giriş ekranına dön.
              </Text>
            </View>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  animatedWrap: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  webContent: {
    width: "100%",
    maxWidth: 880,
    alignSelf: "center",
    paddingTop: 24,
    paddingBottom: 40,
  },
  webCard: {
    width: "100%",
    alignSelf: "center",
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 22,
  },
  themeCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 14,
  },
  themeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  themeIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  themeTextWrap: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 20,
  },
  themeSegment: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 6,
    flexDirection: "row",
    gap: 6,
  },
  themeSegmentButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
  },
  themeSegmentText: {
    fontSize: 13,
    fontWeight: "800",
  },
  listWrap: {
    gap: 12,
  },
  menuCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  menuBody: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 13,
    lineHeight: 20,
  },
  logoutButton: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoutIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
