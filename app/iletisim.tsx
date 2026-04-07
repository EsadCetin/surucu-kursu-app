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

const WEBSITE_URL = "https://ayassurucukursu.com";
const PHONE_URL = "tel:05375046984";
const MAP_URL = "https://maps.app.goo.gl/cf1G2JGZWjw9zLWeA";
const WHATSAPP_PHONE = "905375046984";
const WHATSAPP_MESSAGE =
  "Merhaba, Yeni Ayaş Sürücü Kursu hakkında bilgi almak istiyorum.";

// Geçici yorum linki.
// Elindeki gerçek Google yorum / placeId linkini gönderirsen bunu direkt ona çeviririm.
const GOOGLE_REVIEW_URL = "https://g.page/r/CX1vdkMuiG-_EAI/review";

export default function Iletisim() {
  const openUrl = async (url: string, errorMessage: string) => {
    try {
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Hata", errorMessage);
      }
    } catch (error) {
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
    if (GOOGLE_REVIEW_URL.includes("YOUR_PLACE_ID")) {
      Alert.alert(
        "Google Yorum Linki Eksik",
        "Bu alan hazır. Çalışması için gerçek Google yorum linki veya placeId eklenmeli.",
      );
      return;
    }

    await openUrl(GOOGLE_REVIEW_URL, "Google yorum sayfası açılamadı.");
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Yeni Ayaş Sürücü Kursu</Text>

          <Text style={styles.label}>Telefon</Text>
          <Text style={styles.text}>0537 504 69 84</Text>

          <Text style={styles.label}>Web</Text>
          <Text style={styles.text}>ayassurucukursu.com</Text>

          <Text style={styles.label}>Adres</Text>
          <Text style={styles.text}>
            Hacıveli Mah. Ankara Cad. No:7/D (Petrol Ofisi Üst Katı) Ayaş/Ankara
          </Text>

          <TouchableOpacity style={styles.button} onPress={callPhone}>
            <Text style={styles.buttonText}>Ara</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.buttonSecondary}
            onPress={openWebsite}
          >
            <Text style={styles.buttonText}>Web Sitesine Git</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.buttonSecondary} onPress={openMap}>
            <Text style={styles.buttonText}>Konumu Aç</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <Ionicons name="logo-google" size={22} color="#1f8f55" />
            <Text style={styles.reviewTitle}>Google Değerlendirme</Text>
          </View>

          <Text style={styles.reviewText}>
            Memnun kaldıysan bize Google üzerinden yorum bırakabilirsin.
          </Text>

          <TouchableOpacity
            style={styles.reviewButton}
            onPress={openGoogleReview}
          >
            <Text style={styles.buttonText}>Google'da Yorum Yap</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.whatsappButton} onPress={openWhatsApp}>
        <Ionicons name="logo-whatsapp" size={42} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0e0e11",
  },
  content: {
    marginTop: 50,
    padding: 16,
    paddingBottom: 120,
  },
  card: {
    marginTop: 15,
    backgroundColor: "#17171b",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#232329",
  },
  reviewCard: {
    marginTop: 16,
    backgroundColor: "#17171b",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#232329",
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 18,
  },
  reviewTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  label: {
    color: "#8f9098",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
    marginTop: 6,
    textTransform: "uppercase",
  },
  text: {
    color: "#d7d7dc",
    fontSize: 15,
    marginBottom: 8,
    lineHeight: 22,
  },
  reviewText: {
    color: "#d7d7dc",
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
    backgroundColor: "#c1121f",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonSecondary: {
    marginTop: 12,
    backgroundColor: "#2a2a31",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  reviewButton: {
    marginTop: 4,
    backgroundColor: "#1f8f55",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
