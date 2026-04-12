import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../hooks/useAppTheme";

const PROCESS_STEPS = [
  "İlk olarak kayıt işleminizin tamamlanması için gerekli belgeleri eksiksiz bir şekilde bizzat kendinizin kursumuza teslim etmesi gerekmektedir.",
  "Kayıt için her ayın 10’u son gündür. O günden sonra alınan kayıt bir sonraki ay sınava girecektir.",
  "Kayıt aşamasında ön bilgi olarak sizlere izlemeniz gereken süreç anlatılmaktadır.",
  "Teorik sınava çalışabilmeniz için sizlere SMS olarak bir platform gönderilecektir.",
  "Teorik sınava girebilmeniz için yatırmanız gereken 1.250₺ sınav harcının zamanı geldiğinde ödeme bilgisi sizlere SMS olarak gönderilecektir.",
  "Sınav harcını yatırdıktan sonra sınav tarihiniz belli olduğunda aynı gün size SMS olarak sınav tarihi ve saati, WhatsApp üzerinden ise sınav giriş belgesi gönderilecektir.",
  "Teorik sınav sonucunuz başarılı değil ise tekrar sınav harcı yatırmanız gerekmektedir. Bununla ilgili SMS sizlere gönderilecektir. Harcınızı yatırdıktan sonra sınav tarihiniz belli olacak ve tekrar sizlere bilgilendirmesi yapılacaktır.",
  "Teorik sınav sonucunuz başarılı ise sizlere direksiyon sınavına girebilmeniz için yatırmanız gereken 2.000₺ direksiyon sınav harcının ödeme bilgisi SMS olarak gönderilecektir ve yaklaşık 1 hafta içerisinde direksiyon dersleri ve direksiyon sınavı için bilgilendirilmek üzere kursumuz tarafından aranacaksınız.",
  "Direksiyon sınavına, teorik sınavda başarılı olduktan sonra MEB’in belirlediği tarihte gireceksiniz. Bu süreçte dersleriniz tamamlamış olacağız.",
  "Direksiyon dersleri tamamen sizin müsait olduğunuz günlerde ve uygun olduğunuz ders saatlerimizde yapılmaktadır. Ön bilgi olarak verdiğiniz tarihler dışına çıkmamaya özen göstermekteyiz.",
  "Derslerinizin başlayacağı tarih ve sınav tarihiniz netleştiği zaman sizlere bilgi verilecektir.",
  "Direksiyon dersleri başladıktan sonra aklınıza takılan bir soru olursa lütfen çekinmeden kurs yönetimine bunu dile getirin.",
  "Direksiyon sınavında başarısız olursanız yatırmanız gereken direksiyon sınavı harcı mesajı SMS olarak gelmektedir.",
  "Bir sonraki sınav tarihiniz belirlendiğinde sizlere sınav tarihi SMS olarak gelecektir ve sınavın olacağı hafta 1 kez daha direksiyon dersi alacaksınız. Eğer ücretli ek ders talebiniz olursa kursumuza sınavdan sonraki 5 gün içerisinde haber vermeniz gerekmektedir.",
  "Direksiyon sınavında başarılı olursanız o hafta içerisinde sizlere sertifika mesajı SMS olarak gönderilecektir. Mesaj geldikten sonra 1 adet biometrik fotoğraf ile istediğiniz nüfus müdürlüğünden ehliyet başvurusunda bulunabilirsiniz.",
];

export default function BilgilendirmeScreen() {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.screen, { backgroundColor: colors.cardBg }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.heroCard,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Sürücü kursuna kayıt ve devamındaki süreç
          </Text>
          <Text style={[styles.heroText, { color: colors.mutedText }]}>
            Kayıttan ehliyet başvurusuna kadar süreçle ilgili temel
            bilgilendirme metnini aşağıda görebilirsin.
          </Text>
        </View>

        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          {PROCESS_STEPS.map((item, index) => (
            <View
              key={`${index}-${item.slice(0, 12)}`}
              style={[
                styles.infoRow,
                {
                  borderBottomColor:
                    index === PROCESS_STEPS.length - 1
                      ? "transparent"
                      : colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.stepBadge,
                  {
                    borderColor: colors.text,
                    backgroundColor: colors.accent,
                  },
                ]}
              >
                <Text style={[styles.stepBadgeText, { color: "#ffffff" }]}>
                  {index + 1}
                </Text>
              </View>

              <Text style={[styles.infoRowText, { color: colors.text }]}>
                {item}
              </Text>
            </View>
          ))}
        </View>

        <View
          style={[
            styles.goodLuckCard,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <Ionicons name="ribbon-outline" size={18} color={colors.accent} />
          <Text style={[styles.goodLuckText, { color: colors.text }]}>
            Başarılar dileriz
          </Text>
        </View>
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
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
  },
  heroTitle: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 28,
    marginBottom: 8,
  },
  heroText: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  stepBadge: {
    minWidth: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    marginTop: 2,
    borderWidth: 1,
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  infoRowText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
  },
  goodLuckCard: {
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 8,
    borderWidth: 1,
  },
  goodLuckText: {
    fontSize: 14,
    fontWeight: "800",
  },
});
