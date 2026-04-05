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
    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Hata", "Web sitesi açılamadı.");
    }
  };

  const callPhone = async () => {
    const url = "tel:05305402914";
    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Hata", "Telefon araması başlatılamadı.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Yeni Ayaş Sürücü Kursu</Text>
        <Text style={styles.text}>Telefon: 0530 540 29 14</Text>
        <Text style={styles.text}>Web: ayassurucukursu.com</Text>
        <Text style={styles.text}>Adres: Hacıveli Mah. Ankara Cad.</Text>

        <TouchableOpacity style={styles.button} onPress={callPhone}>
          <Text style={styles.buttonText}>Ara</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.buttonSecondary} onPress={openWebsite}>
          <Text style={styles.buttonText}>Web Sitesine Git</Text>
        </TouchableOpacity>
      </View>
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
    marginBottom: 14,
  },
  text: {
    color: "#d7d7dc",
    fontSize: 15,
    marginBottom: 8,
  },
  button: {
    marginTop: 16,
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
