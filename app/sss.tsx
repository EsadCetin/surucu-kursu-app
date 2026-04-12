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

type FAQItem = {
  question: string;
  answer: string;
  keywords: string[];
};

const faqData: FAQItem[] = [
  {
    question: "Uygulamaya nasıl giriş yaparım?",
    answer:
      "TC kimlik numaranızı girerek öğrenci paneline giriş yapabilirsiniz. Girdiğiniz bilgi sistemde kayıtlıysa süreciniz ekrana gelir.",
    keywords: ["giriş", "tc", "kimlik", "öğrenci paneli", "login"],
  },
  {
    question: "TC kimlik numaramla giriş yapamıyorum, ne yapmalıyım?",
    answer:
      "Önce 11 haneli TC kimlik numaranızı eksiksiz girdiğinizden emin olun. Buna rağmen giriş yapamıyorsanız kurs ile iletişime geçmeniz gerekir.",
    keywords: ["giriş sorunu", "kimlik numarası", "oturum", "hata"],
  },
  {
    question: "Evraklarımın eksik olup olmadığını nereden görebilirim?",
    answer:
      "Panelde başvuru durumunuz ve evrak bilginiz görüntülenir. Evrak eksikse detay kısmında gerekli bilgi yer alır.",
    keywords: ["evrak", "eksik evrak", "başvuru", "belge"],
  },
  {
    question:
      "Eksik evraklarımı tamamladıktan sonra sistem hemen güncellenir mi?",
    answer:
      "Evraklar kurs tarafından işlendiğinde bilgiler güncellenir. İşlem yoğunluğuna göre kısa bir gecikme olabilir. Daha sonra tekrar kontrol edebilirsiniz.",
    keywords: ["evrak güncelleme", "sistem", "güncellenme", "belge"],
  },
  {
    question: "E-sınav harcını yatırmadıysam ne olur?",
    answer:
      "E-sınav harcı yatırılmadıysa sınav süreci ilerlemez. Gerekli ödeme bilgileri kurs tarafından sizinle paylaşılır.",
    keywords: ["e-sınav", "harç", "ödeme", "ücret"],
  },
  {
    question: "E-sınav tarihimi nerede görebilirim?",
    answer:
      "E-sınav tarihiniz açıklandığında panelinizde görüntülenir. Tarih henüz görünmüyorsa planlama süreci devam ediyor olabilir.",
    keywords: ["e-sınav tarihi", "sınav tarihi", "tarih", "panel"],
  },
  {
    question: "E-sınavdan kaldım, ne yapmam gerekiyor?",
    answer:
      "Başarısız olmanız durumunda yeniden sınav süreci başlatılır. Tekrar harç yatırmanız ve yeni sınav tarihini beklemeniz gerekir.",
    keywords: ["e-sınavdan kaldım", "tekrar sınav", "başarısız", "harç"],
  },
  {
    question: "E-sınavı geçince ne olur?",
    answer:
      "E-sınavı başarıyla geçtiğinizde direksiyon aşamasına geçersiniz. Sonraki süreçte direksiyon dersleri ve sınavı için kurs tarafından bilgilendirilirsiniz.",
    keywords: ["e-sınavı geçtim", "direksiyon", "sonraki aşama"],
  },
  {
    question: "Direksiyon sınav tarihim ne zaman belli olur?",
    answer:
      "Direksiyon sınav tarihiniz belli olduğunda SMS ile bilgilendirme yapılır ve tarih panelinizde görüntülenir.",
    keywords: ["direksiyon sınavı", "sınav tarihi", "sms", "tarih"],
  },
  {
    question: "Direksiyon dersleri ne zaman başlar?",
    answer:
      "Direksiyon dersleri için, teorik ve e-sınav aşamaları tamamlandıktan sonra kurs tarafından aranacaksınız. Müsait olduğunuz gün ve saatler öğrenilir ona göre planlama yapılır. Derslere başlandığında gün ve saat bilgisi kurs tarafından 1 gün önce sizinle paylaşılır.",
    keywords: ["direksiyon dersi", "ders", "başlangıç", "planlama"],
  },
  {
    question:
      "Direksiyon derslerimde planlandı, katılmadı vs. yazıyor, anlamları nedir?",
    answer:
      "Direksiyon dersleriniz onaylandıysa kurs tarafından gün ve saat bilgisi verildiği anlamına gelir. Katıldı olarak görünüyorsa o derse katılım sağladınız demektir. Katılmadı yazıyorsa o derse gelmediğiniz anlamına gelir. Planlandı yazan dersler ön bilgi amaçlı yazılmıştır, kesin tarih ve saat bilgisi verilmeden önce değişiklik olabilir.",
    keywords: ["direksiyon dersi", "ders", "başlangıç", "planlama"],
  },
  {
    question: "Direksiyon sınavını geçince süreç tamamlanıyor mu?",
    answer:
      "Evet. Direksiyon sınavından başarılı olduğunuzda eğitim süreciniz tamamlanmış olur. Sonraki aşamada sertifika ve resmi işlemler için yönlendirme yapılır.",
    keywords: ["direksiyon sınavı", "tamamlandı", "başarılı", "sertifika"],
  },
  {
    question: "Sertifikam ne zaman hazırlanır?",
    answer:
      "Sınav süreçleri tamamlandıktan sonra sertifika hazırlık işlemleri başlatılır. Sınavdan sonraki 1 hafta içerisinde kurs tarafından size bilgi verilir.",
    keywords: ["sertifika", "belge", "hazır", "tamamlandı"],
  },
  {
    question: "Uygulamada ödeme yapılıyor mu?",
    answer:
      "Uygulama doğrudan ödeme alma sistemi değildir. Ancak ödeme bilgilerine, borç durumuna veya ilgili yönlendirmelere uygulama içinden ulaşabilirsiniz.",
    keywords: ["ödeme", "borç", "ücret", "harç", "online ödeme"],
  },
  {
    question: "Ödeme yaptım ama sistemde görünmüyor, ne yapmalıyım?",
    answer:
      "Ödeme bilgileri sisteme anlık düşmeyebilir. Güncellemeler kurs tarafından günlük olarak yapılır. Bir gün sonra tekrar kontrol edin. Sorun devam ederse dekont ile kursa ulaşın.",
    keywords: ["ödeme görünmüyor", "dekont", "ödeme sorunu", "sistem"],
  },
  {
    question: "Panelde bilgilerim yanlış görünüyor, ne yapmalıyım?",
    answer:
      "Ad, telefon, evrak veya sınav bilgilerinizde hata varsa kurs ile doğrudan iletişime geçmeniz gerekir. Gerekirse kayıt bilgileri manuel olarak güncellenir.",
    keywords: ["yanlış bilgi", "telefon", "hatalı kayıt", "güncelleme"],
  },
  {
    question: "Telefon numaram değişti, nasıl güncelleyebilirim?",
    answer:
      "Telefon numarası değişiklikleri için kursla iletişime geçmeniz gerekir. Güncel numaranız sisteme işlendiğinde yeni bilgilendirmeler o numaraya gönderilir.",
    keywords: ["telefon", "numara değişikliği", "iletişim", "güncelleme"],
  },
  {
    question: "Sınav günü yanımda neler olmalı?",
    answer:
      "Sınav günü geçerli kimlik belgenizi yanınızda bulundurmalısınız. Kursunuz ek belge veya saat bilgisi verdiyse ona da uymalısınız.",
    keywords: ["sınav günü", "kimlik", "gerekli belge", "evrak"],
  },
  {
    question: "Sınav saatimi kaçırırsam ne olur?",
    answer:
      "Sınav saatinin kaçırılması durumunda ilgili sınava katılım sağlanamaz. Sınava katılmadı olarak görülür ve tekrar harç yatırmanız gerekir. Yeni sınav ve ücret ile ilgili kurs tarafından bilgilendirilirsiniz.",
    keywords: ["sınav saati", "kaçırdım", "geç kaldım", "yeniden planlama"],
  },
];

export default function SSSScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const { colors } = useAppTheme();

  const normalizedSearch = searchText.trim().toLocaleLowerCase("tr-TR");

  const filteredFaqData = useMemo(() => {
    if (!normalizedSearch) {
      return faqData;
    }

    return faqData.filter((item) => {
      const haystack = [item.question, item.answer, ...item.keywords]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(normalizedSearch);
    });
  }, [normalizedSearch]);

  const toggleItem = (index: number) => {
    setOpenIndex((current) => (current === index ? null : index));
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.screenBg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={[styles.iconWrapper, { backgroundColor: colors.accent }]}>
          <Ionicons
            name="help-circle"
            size={35}
            color={colors.accentContrast}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>
            Sıkça Sorulan Sorular
          </Text>

          <Text style={[styles.subtitle, { color: colors.mutedText }]}>
            Aradığınız soruyu yazın, ilgili cevabı hemen bulun
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
          placeholder="Örn: ödeme, evrak, direksiyon, sınav..."
          placeholderTextColor={colors.mutedText}
          style={[styles.searchInput, { color: colors.text }]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />

        {searchText.length > 0 ? (
          <TouchableOpacity
            onPress={() => {
              setSearchText("");
              setOpenIndex(null);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle" size={18} color={colors.mutedText} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.resultInfoRow}>
        <Text style={[styles.resultInfoText, { color: colors.mutedText }]}>
          {filteredFaqData.length} sonuç bulundu
        </Text>
      </View>

      {filteredFaqData.length === 0 ? (
        <View
          style={[
            styles.emptyState,
            {
              backgroundColor: colors.cardBg,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="search-outline" size={24} color={colors.mutedText} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Sonuç bulunamadı
          </Text>
          <Text style={[styles.emptyText, { color: colors.subText }]}>
            Farklı bir kelime deneyin. Örneğin ödeme, evrak, sınav veya
            direksiyon yazabilirsiniz.
          </Text>
        </View>
      ) : (
        filteredFaqData.map((item, index) => {
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
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  content: {
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
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
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
  resultInfoRow: {
    marginBottom: 10,
  },
  resultInfoText: {
    fontSize: 12,
    fontWeight: "600",
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
