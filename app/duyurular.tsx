import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAppTheme } from "../hooks/useAppTheme";

type AnnouncementItem = {
  title: string;
  text: string;
  category: string;
  priority: "Yüksek" | "Normal";
};

const announcements: AnnouncementItem[] = [
  {
    title: "E-Sınav Bilgilendirmesi",
    text: "E-sınav harcını yatıran öğrencilerin sınav tarihleri açıklandığında ana sayfada görüntülenecektir.",
    category: "Sınav",
    priority: "Yüksek",
  },
  {
    title: "Direksiyon Sınavı",
    text: "Direksiyon sınavına girecek öğrenciler sınav tarihi ve ders saatleri için aranacaktır.",
    category: "Sınav",
    priority: "Yüksek",
  },
  {
    title: "Eksik Evrak Uyarısı",
    text: "Eksik evrağı bulunan öğrenciler başvuru sürecinde gecikme yaşamamak için evraklarını tamamlamalıdır.",
    category: "Evrak",
    priority: "Yüksek",
  },
  {
    title: "Ödeme Hatırlatması",
    text: "Harç ve kurs ödemelerinizi gecikmeden tamamlamanız, sınav planlamasında aksama yaşanmaması açısından önemlidir.",
    category: "Ödeme",
    priority: "Yüksek",
  },
  {
    title: "Direksiyon Ders Planlaması",
    text: "Direksiyon ders programı, belirttiğiniz gün ve saatlere göre kurs tarafından oluşturulmakta ve ders günlerinden 1 gün önce paylaşılmaktadır.",
    category: "Ders",
    priority: "Normal",
  },
  {
    title: "Sınav Günü Hatırlatması",
    text: "E-Sınav günü kimlik belgenizi ve kurs tarafından gönderilen sınav giriş belgesinin yanınızda bulundurulması zorunludur. Belgesiz giriş yapılamaz. Direksiyon sınavı için kimlik belgeniz yeterlidir.",
    category: "Sınav",
    priority: "Yüksek",
  },
  {
    title: "Telefon Numarası Güncelleme",
    text: "Telefon numarası değişen öğrencilerin, SMS bilgilendirmelerini kaçırmamak için kursa bilgi vermesi gerekir.",
    category: "Genel",
    priority: "Yüksek",
  },
  {
    title: "Uygulama Üzerinden Bilgi Takibi",
    text: "Sınav, ders, evrak ve ödeme süreçlerinizi uygulama içinden düzenli takip etmeniz önerilir.",
    category: "Genel",
    priority: "Normal",
  },
];

export default function Duyurular() {
  const { colors } = useAppTheme();
  const [searchText, setSearchText] = useState("");

  const normalizedSearch = searchText.trim().toLocaleLowerCase("tr-TR");

  const filteredAnnouncements = useMemo(() => {
    if (!normalizedSearch) {
      return announcements;
    }

    return announcements.filter((item) => {
      const haystack = [item.title, item.text, item.category, item.priority]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(normalizedSearch);
    });
  }, [normalizedSearch]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.screenBg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={[styles.iconWrapper, { backgroundColor: colors.accent }]}>
          <Ionicons name="megaphone" size={28} color={colors.accentContrast} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Duyurular
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedText }]}>
            Sınav, evrak ve ödeme süreçlerine ait güncel bilgilendirmeler
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.searchWrapper,
          {
            backgroundColor: colors.cardBg,
            borderColor: colors.border,
          },
        ]}
      >
        <Ionicons name="search" size={18} color={colors.mutedText} />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Duyuru ara: sınav, ödeme, evrak..."
          placeholderTextColor={colors.mutedText}
          style={[styles.searchInput, { color: colors.text }]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />

        {searchText.length > 0 ? (
          <TouchableOpacity
            onPress={() => setSearchText("")}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle" size={18} color={colors.mutedText} />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={[styles.resultInfoText, { color: colors.mutedText }]}>
        {filteredAnnouncements.length} duyuru bulundu
      </Text>

      {filteredAnnouncements.length === 0 ? (
        <View
          style={[
            styles.emptyState,
            {
              backgroundColor: colors.cardBg,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons
            name="documents-outline"
            size={24}
            color={colors.mutedText}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Eşleşen duyuru yok
          </Text>
          <Text style={[styles.emptyText, { color: colors.subText }]}>
            Arama kelimesini değiştirip tekrar deneyin.
          </Text>
        </View>
      ) : (
        filteredAnnouncements.map((item, index) => (
          <View
            key={`${item.title}-${index}`}
            style={[
              styles.card,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
          >
            <View style={styles.topRow}>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor:
                      item.priority === "Yüksek"
                        ? colors.accent
                        : colors.screenBg,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    {
                      color:
                        item.priority === "Yüksek"
                          ? colors.accentContrast
                          : colors.text,
                    },
                  ]}
                >
                  {item.priority}
                </Text>
              </View>

              <Text style={[styles.category, { color: colors.mutedText }]}>
                {item.category}
              </Text>
            </View>

            <Text style={[styles.title, { color: colors.text }]}>
              {item.title}
            </Text>

            <Text style={[styles.text, { color: colors.subText }]}>
              {item.text}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    marginTop: 30,
    padding: 16,
    paddingBottom: 28,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  iconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  searchWrapper: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 14,
  },
  resultInfoText: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 10,
  },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 10,
  },
  badge: {
    minWidth: 72,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },

  category: {
    fontSize: 12,
    fontWeight: "600",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
});
