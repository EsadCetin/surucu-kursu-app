import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
    Alert,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useAppTheme } from "../hooks/useAppTheme";
import {
    AppNotificationItem,
    getNotificationSummary,
    markAllNotificationsAsRead,
    markNotificationAsRead,
} from "../utils/notification-center";

const STUDENT_SESSION_TC_KEY = "student_session_tc";

function formatDateTime(value?: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTypeLabel(type: AppNotificationItem["type"]) {
  switch (type) {
    case "missing-documents":
      return "Evrak";
    case "payment-due":
      return "Ödeme";
    case "lesson-tomorrow":
      return "Ders";
    case "exam-today":
      return "Sınav";
    case "new-lessons":
      return "Takvim";
    default:
      return "Bildirim";
  }
}

export default function BildirimlerScreen() {
  const { theme, colors } = useAppTheme();
  const [items, setItems] = useState<AppNotificationItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [studentTc, setStudentTc] = useState("");

  const loadData = useCallback(async () => {
    const sessionTc =
      (await AsyncStorage.getItem(STUDENT_SESSION_TC_KEY)) || "";
    setStudentTc(sessionTc);

    if (!sessionTc) {
      setItems([]);
      return;
    }

    const summary = await getNotificationSummary(sessionTc);
    setItems(summary.items);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData().catch((error) => {
        console.log("Bildirim merkezi yüklenemedi:", error);
      });
    }, [loadData]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleRead = async (item: AppNotificationItem) => {
    if (item.read) return;
    await markNotificationAsRead(item.id);
    await loadData();
  };

  const handleMarkAllRead = async () => {
    if (!studentTc || !items.length) return;

    await markAllNotificationsAsRead(studentTc);
    await loadData();
  };

  const unreadCount = items.filter((item) => !item.read).length;

  return (
    <>
      <StatusBar
        translucent={false}
        backgroundColor={colors.screenBg}
        barStyle={theme === "dark" ? "light-content" : "dark-content"}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.screenBg }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View
          style={[
            styles.heroCard,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Bildirim Merkezi
          </Text>
          <Text style={[styles.heroText, { color: colors.subText }]}>
            Uygulama açıldığında üretilen evrak, ödeme, ders ve sınav uyarıları
            burada tutulur.
          </Text>

          {studentTc ? (
            <View style={styles.heroMetaRow}>
              <View
                style={[
                  styles.countBadge,
                  {
                    backgroundColor: colors.cardAltBg,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.countBadgeText, { color: colors.text }]}>
                  {unreadCount} okunmamış
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.markAllButton,
                  {
                    backgroundColor: colors.cardAltBg,
                    borderColor: colors.border,
                  },
                ]}
                onPress={handleMarkAllRead}
              >
                <Text
                  style={[styles.markAllButtonText, { color: colors.text }]}
                >
                  Tümünü okundu yap
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {!studentTc ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Önce giriş yapman gerekiyor
            </Text>
            <Text style={[styles.emptyText, { color: colors.subText }]}>
              Bildirim merkezi, giriş yapan öğrencinin cihazındaki kayıtları
              gösterir.
            </Text>
          </View>
        ) : !items.length ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Henüz bildirim yok
            </Text>
            <Text style={[styles.emptyText, { color: colors.subText }]}>
              Yeni uyarılar oluştuğunda burada görünecek.
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.92}
              onPress={() => {
                handleRead(item).catch(() => {
                  Alert.alert("Hata", "Bildirim güncellenemedi.");
                });
              }}
              style={[
                styles.notificationCard,
                {
                  backgroundColor: colors.cardBg,
                  borderColor: item.read ? colors.border : colors.accent,
                },
              ]}
            >
              <View style={styles.notificationHeader}>
                <View
                  style={[
                    styles.typeBadge,
                    {
                      backgroundColor: colors.cardAltBg,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.typeBadgeText, { color: colors.text }]}>
                    {getTypeLabel(item.type)}
                  </Text>
                </View>

                {!item.read ? <View style={styles.unreadDot} /> : null}
              </View>

              <Text style={[styles.notificationTitle, { color: colors.text }]}>
                {item.title}
              </Text>
              <Text
                style={[styles.notificationText, { color: colors.subText }]}
              >
                {item.message}
              </Text>
              <Text
                style={[styles.notificationDate, { color: colors.mutedText }]}
              >
                {formatDateTime(item.createdAt)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },
  heroTitle: { fontSize: 22, fontWeight: "800", marginBottom: 8 },
  heroText: { fontSize: 14, lineHeight: 22 },
  heroMetaRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
  },
  countBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  countBadgeText: { fontSize: 13, fontWeight: "800" },
  markAllButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  markAllButtonText: { fontSize: 13, fontWeight: "800" },
  emptyCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 17, fontWeight: "800", marginBottom: 8 },
  emptyText: { fontSize: 14, lineHeight: 22 },
  notificationCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  typeBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  typeBadgeText: { fontSize: 12, fontWeight: "800" },
  unreadDot: {
    width: 11,
    height: 11,
    borderRadius: 999,
    backgroundColor: "#c1121f",
  },
  notificationTitle: { fontSize: 17, fontWeight: "800", marginBottom: 8 },
  notificationText: { fontSize: 14, lineHeight: 22, marginBottom: 10 },
  notificationDate: { fontSize: 12, fontWeight: "700" },
});
