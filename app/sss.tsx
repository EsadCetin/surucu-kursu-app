import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const faqData = [
  {
    question: "Uygulamaya nasıl giriş yaparım?",
    answer:
      "TC kimlik numaranızı girerek öğrenci paneline giriş yapabilirsiniz. Girdiğiniz bilgi sistemde kayıtlıysa süreciniz ekrana gelir.",
  },
  {
    question: "TC kimlik numaramla giriş yapamıyorum, ne yapmalıyım?",
    answer:
      "Önce 11 haneli TC kimlik numaranızı eksiksiz girdiğinizden emin olun. Buna rağmen giriş yapamıyorsanız kurs ile iletişime geçmeniz gerekir.",
  },
  {
    question: "Evraklarımın eksik olup olmadığını nereden görebilirim?",
    answer:
      "Panelde başvuru durumunuz ve evrak bilginiz görüntülenir. Evrak eksikse detay kısmında gerekli bilgi yer alır.",
  },
  {
    question:
      "Eksik evraklarımı tamamladıktan sonra sistem hemen güncellenir mi?",
    answer:
      "Evraklar kurs tarafından işlendiğinde bilgiler güncellenir. Daha sonra tekrar kontrol edebilirsiniz.",
  },
  {
    question: "E-sınav harcını yatırmadıysam ne olur?",
    answer:
      "E-sınav harcı yatırılmadıysa sınav süreci ilerlemez. Gerekli ödeme bilgileri size kurs tarafından bildirilir.",
  },
  {
    question: "E-sınav tarihimi nerede görebilirim?",
    answer: "E-sınav tarihiniz açıklandığında panelinizde görüntülenir.",
  },
  {
    question: "E-sınavdan kaldım, ne yapmam gerekiyor?",
    answer:
      "Başarısız olmanız durumunda yeniden sınav süreci başlatılır. Tekrar harç yatırmanız ve yeni sınav tarihini beklemeniz gerekir.",
  },
  {
    question: "E-sınavı geçince ne olur?",
    answer:
      "E-sınavı başarıyla geçtiğinizde direksiyon aşamasına geçersiniz. Sonraki süreçte direksiyon dersleri ve sınavı için kurs tarafından aranırsınız.",
  },
  {
    question: "Direksiyon sınav tarihim ne zaman belli olur?",
    answer:
      "Direksiyon sınav tarihiniz belli olduğunda sizlere SMS gelir ve tarih panelinizde görüntülenir.",
  },
  {
    question: "Direksiyon sınavını geçince süreç tamamlanıyor mu?",
    answer:
      "Evet. Direksiyon sınavından başarılı olduğunuzda süreciniz tamamlandı olarak görünür.",
  },
  {
    question: "Panelde bilgilerim yanlış görünüyor, ne yapmalıyım?",
    answer:
      "Ad, telefon, evrak veya sınav bilgilerinizde hata varsa kurs ile doğrudan iletişime geçmeniz gerekir.",
  },
  {
    question: "Uygulamada ödeme yapılıyor mu?",
    answer:
      "Uygulama doğrudan ödeme alma sistemi değil, ödeme bilgisine veya ilgili yönlendirmeye ulaşmanız için kullanılır.",
  },
];

export default function SSSScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.iconWrapper}>
          <Ionicons name="help-circle-outline" size={28} color="#17171b" />
        </View>
        <View>
          <Text style={styles.title}>Sıkça Sorulan Sorular</Text>
          <Text style={styles.subtitle}>
            Ehliyet süreciyle ilgili en çok sorulan sorular
          </Text>
        </View>
      </View>

      {faqData.map((item, index) => {
        const isOpen = openIndex === index;

        return (
          <View key={index} style={styles.card}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => toggleItem(index)}
              style={styles.questionRow}
            >
              <Text style={styles.question}>{item.question}</Text>
              <Ionicons
                name={isOpen ? "chevron-up" : "chevron-down"}
                size={20}
                color="#9CA3AF"
              />
            </TouchableOpacity>

            {isOpen && (
              <View style={styles.answerWrapper}>
                <Text style={styles.answer}>{item.answer}</Text>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0e0e11",
    padding: 16,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 12,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#c1121f",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  title: {
    color: "#F9FAFB",
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 4,
  },
  card: {
    backgroundColor: "#17171b",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#232329",
    marginBottom: 12,
    overflow: "hidden",
  },
  questionRow: {
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  question: {
    flex: 1,
    color: "#F3F4F6",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
  },
  answerWrapper: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: "#1F2937",
  },
  answer: {
    color: "#CBD5E1",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
});
