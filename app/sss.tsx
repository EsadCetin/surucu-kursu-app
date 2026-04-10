import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAppTheme } from "../hooks/useAppTheme";

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
  const { colors } = useAppTheme();

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.screenBg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={[styles.iconWrapper, { backgroundColor: colors.accent }]}>
          <Ionicons
            name="help-circle"
            size={22}
            color={colors.accentContrast}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>
            Sıkça Sorulan Sorular
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedText }]}>
            Ehliyet süreciyle ilgili en çok sorulan sorular
          </Text>
        </View>
      </View>

      {faqData.map((item, index) => {
        const isOpen = openIndex === index;

        return (
          <View
            key={`${item.question}-${index}`}
            style={[
              styles.card,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
          >
            <TouchableOpacity
              onPress={() => toggleItem(index)}
              style={styles.questionRow}
              activeOpacity={0.85}
            >
              <Text style={[styles.question, { color: colors.text }]}>
                {item.question}
              </Text>
              <Ionicons
                name={isOpen ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.mutedText}
              />
            </TouchableOpacity>

            {isOpen ? (
              <View
                style={[
                  styles.answerWrapper,
                  { borderTopColor: colors.border },
                ]}
              >
                <Text style={[styles.answer, { color: colors.subText }]}>
                  {item.answer}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  content: { marginTop: 30, paddingBottom: 28 },
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
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 4 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
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
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
  },
  answerWrapper: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
  },
  answer: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
});
