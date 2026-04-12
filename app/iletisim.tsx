import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAppTheme } from "../hooks/useAppTheme";

const WEBSITE_URL = "https://ayassurucukursu.com";
const PHONE_URL = "tel:05375046984";
const MAP_URL = "https://maps.app.goo.gl/cf1G2JGZWjw9zLWeA";
const WHATSAPP_PHONE = "905375046984";
const WHATSAPP_MESSAGE =
  "Merhaba, Yeni Ayaş Sürücü Kursu hakkında bilgi almak istiyorum.";
const GOOGLE_REVIEW_URL = "https://g.page/r/CX1vdkMuiG-_EAI/review";

export default function Iletisim() {
  const { colors, isDarkTheme } = useAppTheme();

  const openUrl = async (url: string, errorMessage: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Hata", errorMessage);
      }
    } catch {
      Alert.alert("Hata", errorMessage);
    }
  };

  const openWebsite = async () => {
    await openUrl(WEBSITE_URL, "Web sitesi açılamadı.");
  };

  const callPhone = async () => {
    await openUrl(PHONE_URL, "Telefon araması başlatılamadı.");
  };

  const openMap = async () => {
    await openUrl(MAP_URL, "Konum açılamadı.");
  };

  const openWhatsApp = async () => {
    const message = encodeURIComponent(WHATSAPP_MESSAGE);
    const url = `https://wa.me/${WHATSAPP_PHONE}?text=${message}`;
    await openUrl(url, "WhatsApp açılamadı.");
  };

  const openGoogleReview = async () => {
    await openUrl(GOOGLE_REVIEW_URL, "Google yorum sayfası açılamadı.");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.screenBg }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>
            Yeni Ayaş Sürücü Kursu
          </Text>

          <View style={styles.infoBlock}>
            <View style={styles.labelRow}>
              <Ionicons
                name="call-outline"
                size={16}
                color={colors.mutedText}
              />
              <Text style={[styles.label, { color: colors.mutedText }]}>
                Telefon
              </Text>
            </View>
            <Text style={[styles.text, { color: colors.subText }]}>
              0537 504 69 84
            </Text>
          </View>

          <View style={styles.infoBlock}>
            <View style={styles.labelRow}>
              <Ionicons
                name="globe-outline"
                size={16}
                color={colors.mutedText}
              />
              <Text style={[styles.label, { color: colors.mutedText }]}>
                Web
              </Text>
            </View>
            <Text style={[styles.text, { color: colors.subText }]}>
              ayassurucukursu.com
            </Text>
          </View>

          <View style={styles.infoBlock}>
            <View style={styles.labelRow}>
              <Ionicons
                name="location-outline"
                size={16}
                color={colors.mutedText}
              />
              <Text style={[styles.label, { color: colors.mutedText }]}>
                Adres
              </Text>
            </View>
            <Text style={[styles.text, { color: colors.subText }]}>
              Hacıveli Mah. Ankara Cad. No:7/D (Petrol Ofisi Üst Katı)
              Ayaş/Ankara
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.accent }]}
            onPress={callPhone}
          >
            <Text style={[styles.buttonText, { color: colors.accentContrast }]}>
              Ara
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.buttonSecondary,
              {
                backgroundColor: colors.cardAltBg,
                borderColor: colors.border,
              },
            ]}
            onPress={openWebsite}
          >
            <Text style={[styles.buttonText, { color: colors.text }]}>
              Web Sitesine Git
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.buttonSecondary,
              {
                backgroundColor: colors.cardAltBg,
                borderColor: colors.border,
              },
            ]}
            onPress={openMap}
          >
            <Text style={[styles.buttonText, { color: colors.text }]}>
              Konumu Aç
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.reviewCard,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <View style={styles.reviewHeader}>
            <Ionicons name="star" size={18} color="#f4b400" />
            <Text style={[styles.reviewTitle, { color: colors.text }]}>
              Google Değerlendirme
            </Text>
          </View>

          <Text style={[styles.reviewScore, { color: colors.text }]}>
            5.0 (280+ yorum)
          </Text>
          <Text style={[styles.reviewText, { color: colors.subText }]}>
            Memnun kaldıysan bize Google üzerinden yorum bırakabilirsin.
          </Text>

          <TouchableOpacity
            style={[
              styles.reviewButton,
              {
                backgroundColor: isDarkTheme ? "#1f8f55" : "#17a34a",
              },
            ]}
            onPress={openGoogleReview}
          >
            <Text style={[styles.buttonText, { color: "#ffffff" }]}>
              Google'da Yorum Yap
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.whatsappButton}
        onPress={openWhatsApp}
        activeOpacity={0.9}
      >
        <Ionicons name="logo-whatsapp" size={34} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  card: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
  },
  reviewCard: {
    marginTop: 16,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
  },
  infoBlock: {
    marginTop: 10,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  text: {
    fontSize: 15,
    marginBottom: 4,
    lineHeight: 22,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  reviewScore: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  reviewText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  whatsappButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 72,
    height: 72,
    backgroundColor: "#1f8f55",
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },
  button: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonSecondary: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  reviewButton: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
