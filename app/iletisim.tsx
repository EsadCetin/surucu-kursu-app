import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function Iletisim() {
  const openWebsite = async () => {
    const url = "https://ayassurucukursu.com";

    try {
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Hata", "Web sitesi açılamadı.");
      }
    } catch (error) {
      Alert.alert("Hata", "Web sitesi açılamadı.");
    }
  };

  const callPhone = async () => {
    const url = "tel:05375046984";

    try {
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Hata", "Telefon araması başlatılamadı.");
      }
    } catch (error) {
      Alert.alert("Hata", "Telefon araması başlatılamadı.");
    }
  };
  const openMap = async () => {
    const url = "https://maps.app.goo.gl/cf1G2JGZWjw9zLWeA";

    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Hata", "Konum açılamadı.");
    }
  };
  const openWhatsApp = async () => {
    const whatsappPhone = "905375046984";
    const message = encodeURIComponent(
      "Merhaba, Yeni Ayaş Sürücü Kursu hakkında bilgi almak istiyorum.",
    );
    const url = `https://wa.me/${whatsappPhone}?text=${message}`;

    try {
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Hata", "WhatsApp açılamadı.");
      }
    } catch (error) {
      Alert.alert("Hata", "WhatsApp açılamadı.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Yeni Ayaş Sürücü Kursu</Text>

        <Text style={styles.text}>Telefon: 0537 504 69 84</Text>
        <Text style={styles.text}>Web: ayassurucukursu.com</Text>
        <Text style={styles.text}>
          Adres: Hacıveli Mah. Ankara Cad. No:7/D (Petrol Ofisi Üst Katı)
          Ayaş/Ankara
        </Text>

        <TouchableOpacity style={styles.button} onPress={callPhone}>
          <Text style={styles.buttonText}>Ara</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.buttonSecondary} onPress={openWebsite}>
          <Text style={styles.buttonText}>Web Sitesine Git</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buttonSecondary} onPress={openMap}>
          <Text style={styles.buttonText}>Konumu Aç</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.whatsappButton} onPress={openWhatsApp}>
        <Ionicons name="logo-whatsapp" size={50} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0e0e11",
    padding: 16,
  },
  card: {
    top: 15,
    backgroundColor: "#17171b",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#232329",
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 18,
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
  whatsappButton: {
    position: "absolute",
    bottom: 20,
    right: 50,
    width: "7%",
    alignSelf: "flex-end",
    backgroundColor: "#1f8f55",
    paddingVertical: 14,
    borderRadius: 50,
    alignItems: "center",
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
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
