import * as Linking from "expo-linking";
import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
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
const API_URL = "http://192.168.1.100";
// BURAYA KENDİ GITHUB RAW STUDENTS.JSON LINKİNİ YAZ
const DATA_URL =
  "https://raw.githubusercontent.com/EsadCetin/surucu-kursu-app/0ddb3b1d4fe78c4721ade46643409cd8c92d0b8c/data/students.json";

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

  const [selectedDetail, setSelectedDetail] = useState("");
  const [loginError, setLoginError] = useState("");

  const handleLogin = async () => {
    const cleanedTc = tc.trim();
    setLoginError("");

    if (!cleanedTc) {
      setLoginError("TC kimlik numarası giriniz.");
      return;
    }

    if (!/^\d+$/.test(cleanedTc)) {
      setLoginError("TC kimlik numarası sadece rakamlardan oluşmalıdır.");
      return;
    }

    if (cleanedTc.length !== 11) {
      setLoginError("TC kimlik numarası 11 haneli olmalıdır.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/student-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tc: cleanedTc }),
      });

      const data = await response.json();

      if (!response.ok) {
        setLoginError(data.error || "Giriş başarısız.");
        return;
      }

      setUser(data);
      setLoggedIn(true);
      setSelectedDetail("");
      setLoginError("");
    } catch (error) {
      setLoginError("Sunucuya bağlanılamadı.");
    }
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

    if (user.esinav_tarih) {
      setSelectedDetail(
        user.esinav_saati
          ? `E-sınav tarihiniz: ${user.esinav_tarih}\nSınav saatiniz: ${user.esinav_saati}`
          : `E-sınav tarihiniz: ${user.esinav_tarih}`,
      );
      return;
    }

    setSelectedDetail("E-sınav aşamasındasınız.");
  };

  const showDireksiyonDetay = () => {
    if (!user) return;

    if (user.esinav_sonuc !== "gecti") {
      setSelectedDetail(
        "Direksiyon aşamasına geçmek için önce e-sınavı geçmeniz gerekiyor.",
      );
      return;
    }

    if (user.direksiyon_sonuc === "gecti") {
      setSelectedDetail("Direksiyon sınavından başarılı oldunuz.");
      return;
    }

    if (user.direksiyon_harc === "odenmedi") {
      setSelectedDetail(
        "Sınav harcınızı yatırmadıysanız aşağıdaki hesaba ödeme yapmanız gerekiyor:\n\nTR 0800 0100 0003 5126 9999 5001\nRAVZA GÜL İLERİSOY\n2000₺ SINAV HARCI YATIRMANIZ GEREKİYOR",
      );
      return;
    }

    if (user.direksiyon_harc === "odendi" && user.direksiyon_tarih) {
      setSelectedDetail(
        `Direksiyon sınav tarihiniz: ${user.direksiyon_tarih}\nDersler için aranacaksınız.`,
      );
      return;
    }

    if (user.direksiyon_harc === "odendi" && !user.direksiyon_tarih) {
      setSelectedDetail("Sınav tarihiniz ve dersler için aranacaksınız.");
      return;
    }

    setSelectedDetail("Direksiyon sınav aşamasındasınız.");
  };

  const showFinalDetay = () => {
    if (!user) return;

    if (user.direksiyon_sonuc === "gecti") {
      setSelectedDetail("Direksiyon sınavından başarılı oldunuz.");
    } else {
      setSelectedDetail("Bu aşama henüz tamamlanmadı.");
    }
  };

  const openEsinavPayment = async () => {
    const url = "https://odeme.meb.gov.tr/";
    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    } else {
      setSelectedDetail("Ödeme sayfası açılamadı.");
    }
  };

  if (!loggedIn || !user) {
    return (
      <View style={styles.loginContainer}>
        <View style={styles.loginTopBadge}>
          <Text style={styles.loginTopBadgeText}>Yeni Ayaş Sürücü Kursu</Text>
        </View>

        <Text style={styles.appTitle}>Öğrenci Giriş</Text>
        <Text style={styles.appSubtitle}>
          TC kimlik numaranızı girerek sürecinizi görüntüleyin
        </Text>

        <View style={styles.loginCard}>
          <Text style={styles.inputLabel}>TC Kimlik Numaranız</Text>
          <TextInput
            style={styles.input}
            placeholder="11 haneli TC kimlik numarası"
            placeholderTextColor="#8f8f95"
            keyboardType="numeric"
            maxLength={11}
            value={tc}
            onChangeText={(text) => {
              setTc(text.replace(/[^0-9]/g, ""));
              if (loginError) setLoginError("");
            }}
          />

          {!!loginError && <Text style={styles.errorText}>{loginError}</Text>}

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Giriş Yap</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
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
            <Text style={styles.subName}>Öğrenci Paneli</Text>
          </View>
        </View>

        <View style={styles.chipsRow}>
          <InfoChip label="TC" value={user.tc} />
          <InfoChip label="Sınıf" value={user.sinif || "-"} />
        </View>

        <View style={styles.chipsRow}>
          <InfoChip label="Telefon" value={formatPhone(user.telefonlar)} />
        </View>
      </View>

      {!!highlightedExamInfo && (
        <View style={styles.heroCard}>
          <Text style={styles.heroCardLabel}>Öne Çıkan Bilgi</Text>
          <Text style={styles.heroCardText}>{highlightedExamInfo}</Text>
        </View>
      )}

      <View style={styles.statusCard}>
        <Text style={styles.sectionTitle}>Genel Durum</Text>
        <Text
          style={[
            styles.statusText,
            mainStatus.type === "success" && styles.statusSuccess,
            mainStatus.type === "error" && styles.statusError,
            mainStatus.type === "warning" && styles.statusWarning,
            mainStatus.type === "info" && styles.statusInfo,
          ]}
        >
          {mainStatus.text}
        </Text>

        {user.durum === "esinav" && user.esinav_harc === "odenmedi" && (
          <TouchableOpacity
            style={styles.paymentButton}
            onPress={openEsinavPayment}
          >
            <Text style={styles.paymentButtonText}>E-Sınav Harcını Öde</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.timelineCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Kurs Aşamaları</Text>
          <Text style={styles.sectionSubText}>Detay için dokun</Text>
        </View>

        <StepItem
          title="Kurs Başvurusu"
          checked={stepStates.basvuruYapildi}
          active={activeStep === "basvuru"}
          onPress={showBasvuruDetay}
        />

        <StepItem
          title="Kurs Başvurusu Tamamlandı"
          checked={stepStates.basvuruTamamlandi}
          active={activeStep === "basvuru" && user.evrak_durumu !== "tamam"}
          onPress={showBasvuruTamamDetay}
        />

        <StepItem
          title="E-Sınav Aşaması"
          checked={stepStates.esinavAsamasi}
          active={activeStep === "esinav"}
          onPress={showEsinavDetay}
        />

        <StepItem
          title="Direksiyon Sınav Aşaması"
          checked={stepStates.direksiyonAsamasi}
          active={activeStep === "direksiyon"}
          onPress={showDireksiyonDetay}
        />

        <StepItem
          title="Başarılı"
          checked={stepStates.tamamlandi}
          active={activeStep === "tamamlandi"}
          onPress={showFinalDetay}
        />
      </View>

      {!!selectedDetail && (
        <View style={styles.detailCard}>
          <Text style={styles.sectionTitle}>Detay</Text>
          <Text style={styles.detailText}>{selectedDetail}</Text>

          {selectedDetail.includes("ödeme sayfasına gidebilirsiniz") && (
            <TouchableOpacity
              style={styles.paymentButton}
              onPress={openEsinavPayment}
            >
              <Text style={styles.paymentButtonText}>E-Sınav Harcını Öde</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => {
          setLoggedIn(false);
          setUser(null);
          setTc("");
          setSelectedDetail("");
          setLoginError("");
        }}
      >
        <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0b0b0d",
  },
  content: {
    padding: 18,
    paddingTop: 52,
    paddingBottom: 36,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0b0b0d",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#ffffff",
    marginTop: 12,
    fontSize: 16,
    fontWeight: "600",
  },
  loginContainer: {
    flex: 1,
    backgroundColor: "#0b0b0d",
    justifyContent: "center",
    padding: 22,
  },
  loginTopBadge: {
    alignSelf: "center",
    backgroundColor: "#17171b",
    borderWidth: 1,
    borderColor: "#232329",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 18,
  },
  loginTopBadgeText: {
    color: "#d8d8dd",
    fontSize: 13,
    fontWeight: "600",
  },
  appTitle: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
  },
  appSubtitle: {
    color: "#9a9aa2",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 20,
  },
  loginCard: {
    backgroundColor: "#151519",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#232329",
  },
  inputLabel: {
    color: "#d0d0d6",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#1f1f25",
    color: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    fontSize: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#2c2c34",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 12,
    marginTop: 2,
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
  timelineCard: {
    backgroundColor: "#151519",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#232329",
  },
  detailCard: {
    backgroundColor: "#151519",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#232329",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },
  sectionSubText: {
    color: "#8f8f97",
    fontSize: 12,
    fontWeight: "600",
  },
  statusText: {
    color: "#d7d7dc",
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "600",
  },
  statusSuccess: {
    color: "#22c55e",
  },
  statusError: {
    color: "#ef4444",
  },
  statusWarning: {
    color: "#f59e0b",
  },
  statusInfo: {
    color: "#60a5fa",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#4c4c57",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    backgroundColor: "transparent",
  },
  stepCircleChecked: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a",
  },
  stepCircleActive: {
    backgroundColor: "#c1121f",
    borderColor: "#c1121f",
  },
  stepCircleText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  stepContent: {
    flex: 1,
    backgroundColor: "#1b1b21",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#26262d",
  },
  stepTitle: {
    color: "#b9b9c0",
    fontSize: 15,
    fontWeight: "700",
  },
  stepTitleChecked: {
    color: "#ffffff",
  },
  stepTitleActive: {
    color: "#ffffff",
  },
  detailText: {
    color: "#d7d7dc",
    fontSize: 15,
    lineHeight: 24,
  },
  paymentButton: {
    marginTop: 16,
    backgroundColor: "#c1121f",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  paymentButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  logoutButton: {
    backgroundColor: "#202028",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  logoutButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
});
