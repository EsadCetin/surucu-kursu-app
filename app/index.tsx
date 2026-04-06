import * as Linking from "expo-linking";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Student = {
  tc: string;
  ad_soyad: string;
  sinif: string;
  telefonlar: string;
  durum: string;
  evrak_durumu: string;
  eksik_evraklar?: string;
  esinav_harc: string;
  esinav_tarih?: string;
  esinav_saati?: string;
  esinav_sonuc: string;
  direksiyon_harc: string;
  direksiyon_tarih?: string;
  direksiyon_sonuc: string;
};

type StatusType = "success" | "error" | "warning" | "info" | "normal";

type StatusResult = {
  text: string;
  type: StatusType;
};

type StepItemProps = {
  title: string;
  checked: boolean;
  active?: boolean;
  onPress: () => void;
};

const DATA_URL =
  "https://raw.githubusercontent.com/EsadCetin/surucu-kursu-app/main/data/students.json";

function parseAppDate(dateStr?: string) {
  if (!dateStr) return null;

  const normalized = dateStr.trim();
  const parts = normalized.split(".");

  if (parts.length !== 3) return null;

  const day = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const year = Number(parts[2]);

  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return null;

  date.setHours(0, 0, 0, 0);
  return date;
}

function isPastDate(dateStr?: string) {
  const examDate = parseAppDate(dateStr);
  if (!examDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return examDate < today;
}

function formatPhone(phone: string) {
  if (!phone) return "-";

  const digits = phone.replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("0")) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
  }

  if (digits.length === 10 && digits.startsWith("5")) {
    return `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
  }

  return phone;
}

function StepItem({ title, checked, active = false, onPress }: StepItemProps) {
  return (
    <TouchableOpacity
      style={styles.stepRow}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View
        style={[
          styles.stepCircle,
          checked && styles.stepCircleChecked,
          active && !checked && styles.stepCircleActive,
        ]}
      >
        <Text style={styles.stepCircleText}>
          {checked ? "✓" : active ? "•" : ""}
        </Text>
      </View>

      <View style={styles.stepContent}>
        <Text
          style={[
            styles.stepTitle,
            checked && styles.stepTitleChecked,
            active && !checked && styles.stepTitleActive,
          ]}
        >
          {title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoChip}>
      <Text style={styles.infoChipLabel}>{label}</Text>
      <Text style={styles.infoChipValue}>{value || "-"}</Text>
    </View>
  );
}

export default function Index() {
  const [tc, setTc] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState<Student | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [selectedDetail, setSelectedDetail] = useState("");

  useEffect(() => {
    const loadStudents = async () => {
      try {
        setLoadingStudents(true);

        const response = await fetch(DATA_URL, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Öğrenci verisi alınamadı.");
        }

        const data: Student[] = await response.json();
        setStudents(data);
      } catch (error) {
        Alert.alert("Hata", "Veriler yüklenemedi.");
      } finally {
        setLoadingStudents(false);
      }
    };

    loadStudents();
  }, []);

  const reloadStudents = async () => {
    try {
      setLoadingStudents(true);

      const response = await fetch(DATA_URL, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Veri alınamadı.");
      }

      const data: Student[] = await response.json();
      setStudents(data);

      if (user) {
        const updatedUser = data.find((s) => s.tc === user.tc);
        if (updatedUser) {
          setUser(updatedUser);
        }
      }
    } catch (error) {
      Alert.alert("Hata", "Veriler yenilenemedi.");
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleLogin = () => {
    const cleanedTc = tc.trim();

    if (!cleanedTc) {
      Alert.alert("Hata", "TC kimlik numarası giriniz.");
      return;
    }

    if (!/^\d+$/.test(cleanedTc)) {
      Alert.alert("Hata", "TC kimlik numarası sadece rakamlardan oluşmalıdır.");
      return;
    }

    if (cleanedTc.length !== 11) {
      Alert.alert("Hata", "TC kimlik numarası 11 haneli olmalıdır.");
      return;
    }

    const foundUser = students.find((s) => s.tc === cleanedTc);

    if (foundUser) {
      setUser(foundUser);
      setLoggedIn(true);
      setSelectedDetail("");
    } else {
      Alert.alert("Hata", "Bu TC kimlik numarasına ait öğrenci bulunamadı.");
    }
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setUser(null);
    setTc("");
    setSelectedDetail("");
  };

  const initials = useMemo(() => {
    if (!user?.ad_soyad) return "";
    return user.ad_soyad
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [user]);

  const highlightedExamInfo = useMemo(() => {
    if (!user) return "";

    if (user.direksiyon_sonuc === "gecti") {
      return "Direksiyon sınavını başarıyla geçtiniz.";
    }

    if (user.direksiyon_tarih && user.direksiyon_sonuc !== "gecti") {
      return `Direksiyon sınav tarihi: ${user.direksiyon_tarih}`;
    }

    if (
      user.durum === "esinav" &&
      user.esinav_tarih &&
      user.esinav_sonuc !== "gecti" &&
      isPastDate(user.esinav_tarih)
    ) {
      return "E-sınavdan başarısız oldunuz. Tekrar harç yatırarak sınava girebilirsiniz.";
    }

    if (user.esinav_tarih && user.esinav_sonuc !== "gecti") {
      return user.esinav_saati
        ? `E-sınav: ${user.esinav_tarih} / ${user.esinav_saati}`
        : `E-sınav tarihi: ${user.esinav_tarih}`;
    }

    return "";
  }, [user]);

  const mainStatus: StatusResult = useMemo(() => {
    if (!user) return { text: "", type: "normal" };

    if (user.direksiyon_sonuc === "gecti") {
      return {
        text: "Tebrikler, direksiyon sınavından başarılı oldunuz.",
        type: "success",
      };
    }

    if (user.esinav_sonuc === "kaldi") {
      return {
        text: "E-sınav başarısız.",
        type: "error",
      };
    }

    if (
      user.durum === "esinav" &&
      user.esinav_tarih &&
      user.esinav_sonuc !== "gecti" &&
      isPastDate(user.esinav_tarih)
    ) {
      return {
        text:
          user.esinav_harc === "odendi"
            ? "E-sınavdan başarısız oldunuz. Yeni sınav tarihiniz açıklandığında size bilgi verilecektir."
            : "E-sınavdan başarısız oldunuz. Tekrar harç yatırarak sınava girebilirsiniz.",
        type: "error",
      };
    }

    if (user.direksiyon_tarih && user.direksiyon_sonuc !== "gecti") {
      return {
        text: "Direksiyon sınav tarihiniz açıklandı.",
        type: "info",
      };
    }

    if (user.evrak_durumu === "eksik") {
      return {
        text: "Kurs başvurunuz alındı. Evraklarınız eksik.",
        type: "warning",
      };
    }

    if (user.durum === "esinav" && user.esinav_harc === "odenmedi") {
      return {
        text: "E-sınav harcınızı yatırmadınız. Aşağıdaki bağlantıdan ödeme yapabilirsiniz.",
        type: "warning",
      };
    }

    if (
      user.durum === "esinav" &&
      user.esinav_harc === "odendi" &&
      !user.esinav_tarih
    ) {
      return {
        text: "E-sınav harcını yatırdınız. Sınav tarihinin açıklanmasını bekleyin.",
        type: "info",
      };
    }

    if (user.esinav_tarih && user.esinav_sonuc !== "gecti") {
      return {
        text: "E-sınav tarihiniz açıklandı.",
        type: "info",
      };
    }

    if (user.evrak_durumu === "tamam" && user.esinav_sonuc !== "gecti") {
      return {
        text: "Başvurunuz tamamlandı. E-sınav süreciniz devam ediyor.",
        type: "normal",
      };
    }

    if (user.esinav_sonuc === "gecti" && user.direksiyon_sonuc !== "gecti") {
      return {
        text: "E-sınavı başarıyla geçtiniz. Direksiyon aşamasına geçildi.",
        type: "normal",
      };
    }

    return {
      text: "Süreç devam ediyor.",
      type: "normal",
    };
  }, [user]);

  const stepStates = useMemo(() => {
    if (!user) {
      return {
        basvuruYapildi: false,
        basvuruTamamlandi: false,
        esinavAsamasi: false,
        direksiyonAsamasi: false,
        tamamlandi: false,
      };
    }

    return {
      basvuruYapildi: true,
      basvuruTamamlandi: user.evrak_durumu === "tamam",
      esinavAsamasi:
        user.evrak_durumu === "tamam" ||
        !!user.esinav_tarih ||
        user.esinav_sonuc === "gecti" ||
        user.esinav_sonuc === "kaldi",
      direksiyonAsamasi:
        user.esinav_sonuc === "gecti" ||
        !!user.direksiyon_tarih ||
        user.direksiyon_sonuc === "gecti" ||
        user.direksiyon_sonuc === "kaldi",
      tamamlandi: user.direksiyon_sonuc === "gecti",
    };
  }, [user]);

  const activeStep = useMemo(() => {
    if (!user) return "";

    if (user.direksiyon_sonuc === "gecti") return "tamamlandi";
    if (user.esinav_sonuc === "gecti") return "direksiyon";
    if (user.evrak_durumu === "tamam") return "esinav";
    return "basvuru";
  }, [user]);

  const showBasvuruDetay = () => {
    if (!user) return;

    if (user.evrak_durumu === "eksik") {
      setSelectedDetail(
        `Eksik evraklar:\n${user.eksik_evraklar || "- Evrak bilgisi bulunamadı"}`,
      );
      return;
    }

    setSelectedDetail("Kurs başvurunuz alınmıştır.");
  };

  const showBasvuruTamamDetay = () => {
    if (!user) return;

    if (user.evrak_durumu === "tamam") {
      setSelectedDetail("Kurs başvurunuz tamamlandı. Evraklarınız tam.");
    } else {
      setSelectedDetail(
        "Evraklarınız tamamlandığında bu aşama onaylanacaktır.",
      );
    }
  };

  const showEsinavDetay = () => {
    if (!user) return;

    if (
      user.durum === "esinav" &&
      user.esinav_tarih &&
      user.esinav_sonuc !== "gecti" &&
      isPastDate(user.esinav_tarih)
    ) {
      if (user.esinav_harc === "odendi") {
        setSelectedDetail(
          "Sınav harcınızı yatırdınız. Yeni sınav tarihiniz açıklandığında size bilgi verilecektir.",
        );
      } else {
        setSelectedDetail(
          "E-sınavdan başarısız oldunuz. Tekrar harç yatırarak sınava girebilirsiniz.",
        );
      }
      return;
    }

    if (user.evrak_durumu !== "tamam") {
      setSelectedDetail("Önce evraklarınızın tamamlanması gerekiyor.");
      return;
    }

    if (user.esinav_sonuc === "kaldi") {
      setSelectedDetail("E-sınav başarısız.");
      return;
    }

    if (user.esinav_harc === "odenmedi") {
      setSelectedDetail(
        "Sınav harcınızı yatırmamışsınız. Aşağıdaki butonla ödeme sayfasına gidebilirsiniz.",
      );
      return;
    }

    if (user.esinav_harc === "odendi" && !user.esinav_tarih) {
      setSelectedDetail("Sınav harcınız yatırılmış. Sınav tarihi bekleniyor.");
      return;
    }

    if (user.esinav_tarih && user.esinav_sonuc !== "gecti") {
      setSelectedDetail(
        user.esinav_saati
          ? `E-sınav tarihiniz ${user.esinav_tarih} / ${user.esinav_saati}`
          : `E-sınav tarihiniz ${user.esinav_tarih}`,
      );
      return;
    }

    if (user.esinav_sonuc === "gecti") {
      setSelectedDetail("E-sınavı başarıyla geçtiniz.");
      return;
    }

    setSelectedDetail("E-sınav süreciniz devam ediyor.");
  };

  const showDireksiyonDetay = () => {
    if (!user) return;

    if (user.esinav_sonuc !== "gecti") {
      setSelectedDetail(
        "Direksiyon aşamasına geçmek için önce e-sınavı geçmelisiniz.",
      );
      return;
    }

    if (user.direksiyon_sonuc === "gecti") {
      setSelectedDetail("Direksiyon sınavını başarıyla geçtiniz.");
      return;
    }

    if (user.direksiyon_sonuc === "kaldi") {
      setSelectedDetail("Direksiyon sınavında başarısız oldunuz.");
      return;
    }

    if (user.direksiyon_harc === "odenmedi") {
      setSelectedDetail("Direksiyon harcı henüz yatırılmamış görünüyor.");
      return;
    }

    if (user.direksiyon_tarih) {
      setSelectedDetail(`Direksiyon sınav tarihiniz ${user.direksiyon_tarih}`);
      return;
    }

    setSelectedDetail("Direksiyon süreciniz devam ediyor.");
  };

  const openHarcLink = () => {
    Linking.openURL("https://odeme.meb.gov.tr");
  };

  if (loadingStudents) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#c1121f" />
        <Text style={styles.loadingText}>Veriler yükleniyor...</Text>
      </View>
    );
  }

  if (!loggedIn || !user) {
    return (
      <View style={styles.container}>
        <View style={styles.loginBox}>
          <Text style={styles.brand}>Yeni Ayaş Sürücü Kursu</Text>
          <Text style={styles.loginTitle}>Öğrenci Girişi</Text>
          <Text style={styles.loginSub}>
            TC kimlik numaranızı girerek sürecinizi görüntüleyin.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="TC Kimlik Numarası"
            placeholderTextColor="#8f8f97"
            keyboardType="numeric"
            maxLength={11}
            value={tc}
            onChangeText={setTc}
          />

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Giriş Yap</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.refreshButton} onPress={reloadStudents}>
        <Text style={styles.refreshButtonText}>Verileri Yenile</Text>
      </TouchableOpacity>

      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <View style={styles.profileTextArea}>
            <Text style={styles.name}>{user.ad_soyad}</Text>
            <Text style={styles.subName}>TC: {user.tc}</Text>
          </View>
        </View>

        <View style={styles.chipsRow}>
          <InfoChip label="Sınıf" value={user.sinif || "-"} />
          <InfoChip label="Telefon" value={formatPhone(user.telefonlar)} />
        </View>
      </View>

      {!!highlightedExamInfo && (
        <View style={styles.heroCard}>
          <Text style={styles.heroCardLabel}>Bilgilendirme</Text>
          <Text style={styles.heroCardText}>{highlightedExamInfo}</Text>
        </View>
      )}

      <View
        style={[
          styles.statusCard,
          mainStatus.type === "success" && styles.statusSuccess,
          mainStatus.type === "error" && styles.statusError,
          mainStatus.type === "warning" && styles.statusWarning,
          mainStatus.type === "info" && styles.statusInfo,
        ]}
      >
        <Text style={styles.statusTitle}>Genel Durum</Text>
        <Text style={styles.statusText}>{mainStatus.text}</Text>

        {user.durum === "esinav" && user.esinav_harc === "odenmedi" ? (
          <TouchableOpacity style={styles.paymentButton} onPress={openHarcLink}>
            <Text style={styles.paymentButtonText}>Harç Ödeme Sayfası</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.stepsCard}>
        <Text style={styles.sectionTitle}>Süreç Adımları</Text>

        <StepItem
          title="Başvuru yapıldı"
          checked={stepStates.basvuruYapildi}
          active={activeStep === "basvuru"}
          onPress={showBasvuruDetay}
        />

        <StepItem
          title="Başvuru tamamlandı"
          checked={stepStates.basvuruTamamlandi}
          active={activeStep === "basvuru" && user.evrak_durumu === "tamam"}
          onPress={showBasvuruTamamDetay}
        />

        <StepItem
          title="E-sınav aşaması"
          checked={stepStates.esinavAsamasi}
          active={activeStep === "esinav"}
          onPress={showEsinavDetay}
        />

        <StepItem
          title="Direksiyon aşaması"
          checked={stepStates.direksiyonAsamasi}
          active={activeStep === "direksiyon"}
          onPress={showDireksiyonDetay}
        />

        <StepItem
          title="Süreç tamamlandı"
          checked={stepStates.tamamlandi}
          active={activeStep === "tamamlandi"}
          onPress={() =>
            setSelectedDetail(
              user.direksiyon_sonuc === "gecti"
                ? "Tüm süreç başarıyla tamamlandı."
                : "Süreç henüz tamamlanmadı.",
            )
          }
        />
      </View>

      {!!selectedDetail && (
        <View style={styles.detailCard}>
          <Text style={styles.sectionTitle}>Detay</Text>
          <Text style={styles.detailText}>{selectedDetail}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d10",
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0d0d10",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    color: "#ffffff",
    marginTop: 12,
    fontSize: 15,
    fontWeight: "600",
  },
  loginBox: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  brand: {
    color: "#c1121f",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  loginTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  loginSub: {
    color: "#a0a0a8",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  input: {
    backgroundColor: "#1f1f25",
    color: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    fontSize: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#2c2c34",
  },
  loginButton: {
    backgroundColor: "#c1121f",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  loginButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  refreshButton: {
    backgroundColor: "#1f1f25",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 14,
  },
  refreshButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  profileCard: {
    backgroundColor: "#151519",
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#232329",
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  profileTextArea: {
    flex: 1,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#c1121f",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800",
  },
  name: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  subName: {
    color: "#8f8f97",
    fontSize: 14,
    marginTop: 4,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  infoChip: {
    flex: 1,
    backgroundColor: "#1d1d23",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#2a2a31",
  },
  infoChipLabel: {
    color: "#8d8d95",
    fontSize: 12,
    marginBottom: 6,
    fontWeight: "600",
  },
  infoChipValue: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  heroCard: {
    backgroundColor: "#c1121f",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  heroCardLabel: {
    color: "#ffd9dd",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  heroCardText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 26,
  },
  statusCard: {
    backgroundColor: "#151519",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#232329",
  },
  statusSuccess: {
    borderColor: "#1f8f55",
  },
  statusError: {
    borderColor: "#a62d2d",
  },
  statusWarning: {
    borderColor: "#a67c1a",
  },
  statusInfo: {
    borderColor: "#2c6ca6",
  },
  statusTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  statusText: {
    color: "#d8d8dd",
    fontSize: 15,
    lineHeight: 23,
  },
  paymentButton: {
    backgroundColor: "#c1121f",
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  paymentButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  stepsCard: {
    backgroundColor: "#151519",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#232329",
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 14,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#232329",
    borderWidth: 1,
    borderColor: "#3a3a42",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  stepCircleChecked: {
    backgroundColor: "#c1121f",
    borderColor: "#c1121f",
  },
  stepCircleActive: {
    borderColor: "#c1121f",
  },
  stepCircleText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: "#d0d0d6",
    fontSize: 15,
    fontWeight: "600",
  },
  stepTitleChecked: {
    color: "#ffffff",
  },
  stepTitleActive: {
    color: "#ffffff",
  },
  detailCard: {
    backgroundColor: "#151519",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#232329",
  },
  detailText: {
    color: "#d8d8dd",
    fontSize: 15,
    lineHeight: 23,
  },
  logoutButton: {
    backgroundColor: "#26262d",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  logoutButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
