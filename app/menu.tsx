import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAppTheme } from "../hooks/useAppTheme";

type MenuItem = {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: "/" | "/duyurular" | "/iletisim" | "/sss";
};

const STUDENT_SESSION_TC_KEY = "student_session_tc";

const MENU_ITEMS: MenuItem[] = [
  {
    key: "home",
    title: "Ana Sayfa",
    subtitle: "Öğrenci süreç ekranına dön",
    icon: "home-outline",
    route: "/",
  },
  {
    key: "announcements",
    title: "Duyurular",
    subtitle: "Güncel duyuruları görüntüle",
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
    subtitle: "Sıkça sorulan sorular",
    icon: "help-circle-outline",
    route: "/sss",
  },
];

function ThemeToggle({
  selectedTheme,
  onToggle,
  colors,
}: {
  selectedTheme: "dark" | "light";
  onToggle: () => void;
  colors: {
    cardAltBg: string;
    border: string;
    accent: string;
    accentContrast: string;
    mutedText: string;
  };
}) {
  const animatedValue = useRef(
    new Animated.Value(selectedTheme === "light" ? 1 : 0),
  ).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: selectedTheme === "light" ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animatedValue, selectedTheme]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 35],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onToggle}
      style={[
        styles.themeToggle,
        {
          borderColor: colors.border,
          backgroundColor: colors.cardAltBg,
        },
      ]}
    >
      <View style={styles.themeToggleIcons}>
        <Ionicons name="moon" size={15} color={colors.mutedText} />
        <Ionicons name="sunny" size={16} color={colors.mutedText} />
      </View>

      <Animated.View
        style={[
          styles.themeToggleThumb,
          {
            backgroundColor: colors.accent,
            transform: [{ translateX }],
          },
        ]}
      >
        <Ionicons
          name={selectedTheme === "light" ? "sunny" : "moon"}
          size={16}
          color={colors.accentContrast}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function MenuScreen() {
  const router = useRouter();
  const { theme, colors, themeReady, toggleTheme } = useAppTheme();

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
      <ScrollView
        style={[styles.container, { backgroundColor: colors.screenBg }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.heroCard,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View
              style={[styles.heroIconWrap, { backgroundColor: colors.accent }]}
            >
              <Ionicons
                name="menu-outline"
                size={28}
                color={colors.accentContrast}
              />
            </View>

            {themeReady ? (
              <ThemeToggle
                selectedTheme={theme}
                onToggle={toggleTheme}
                colors={colors}
              />
            ) : null}
          </View>

          <Text style={[styles.heroTitle, { color: colors.text }]}>Menü</Text>
          <Text style={[styles.heroText, { color: colors.subText }]}> 
            Buradan uygulamanın diğer ekranlarına geçebilirsin.
          </Text>
        </View>

        <View style={styles.listWrap}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.9}
              onPress={() => router.replace(item.route)}
              style={[
                styles.menuCard,
                { backgroundColor: colors.cardBg, borderColor: colors.border },
              ]}
            >
              <View
                style={[styles.menuIcon, { backgroundColor: colors.cardAltBg }]}
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
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleLogout}
          style={[
            styles.logoutButton,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
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
              Öğrenci oturumunu kapat ve giriş ekranına dön
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.mutedText}
          />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
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
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 22,
  },
  themeToggle: {
    width: 68,
    height: 34,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  themeToggleIcons: {
    width: "100%",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  themeToggleThumb: {
    position: "absolute",
    top: 3,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
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
    marginTop: 6,
  },
  logoutIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
