import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../hooks/useAppTheme";

const announcements = [
  {
    title: "E-Sınav Bilgilendirmesi",
    text: "E-sınav harcını yatıran öğrencilerin sınav tarihleri açıklandığında ana sayfada görüntülenecektir.",
  },
  {
    title: "Direksiyon Sınavı",
    text: "Direksiyon sınavına girecek öğrenciler sınav tarihi ve ders saatleri için aranacaktır.",
  },
  {
    title: "Eksik Evrak Uyarısı",
    text: "Eksik evrakı bulunan öğrenciler başvuru sürecinde gecikme yaşamamak için evraklarını tamamlamalıdır.",
  },
];

export default function Duyurular() {
  const { colors } = useAppTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.screenBg }]}
      contentContainerStyle={styles.content}
    >
      {announcements.map((item, index) => (
        <View
          key={`${item.title}-${index}`}
          style={[
            styles.card,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>
            {item.title}
          </Text>
          <Text style={[styles.text, { color: colors.subText }]}>
            {item.text}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    marginTop: 36,
    padding: 16,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
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
