import { ScrollView, StyleSheet, Text, View } from "react-native";

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
    text: "Eksik evrakları bulunan öğrenciler başvuru sürecinde gecikme yaşamamak için evraklarını tamamlamalıdır.",
  },
];

export default function Duyurular() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {announcements.map((item, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.text}>{item.text}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0e0e11",
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: "#17171b",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#232329",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  text: {
    color: "#d7d7dc",
    fontSize: 15,
    lineHeight: 22,
  },
});
