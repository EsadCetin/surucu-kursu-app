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

type SmartStatus = {
  title: string;
  description: string;
  type: StatusType;
  actionLabel?: string;
  actionType?: "harc" | "detail" | "none";
};

type StatusType = "success" | "error" | "warning" | "info" | "normal";

type LoginFeedback = {
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
};

type StepItemProps = {
  title: string;
  checked: boolean;
  active?: boolean;
  onPress: () => void;
  showTopLine?: boolean;
  showBottomLine?: boolean;
  lineActive?: boolean;
};

const DATA_URL =
  "https://raw.githubusercontent.com/EsadCetin/surucu-kursu-app/main/docs/students.json";

function formatExamText(date?: string, time?: string) {
  if (!date) return "";
  return time ? `${date} / ${time}` : date;
}

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

function StepItem({
  title,
  checked,
  active = false,
  onPress,
  showTopLine = false,
  showBottomLine = false,
  lineActive = false,
}: StepItemProps) {
  return (
    <TouchableOpacity
      style={styles.stepRow}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.stepIndicatorColumn}>
        {showTopLine ? (
          <View
            style={[
              styles.stepLine,
              styles.stepLineTop,
              lineActive ? styles.stepLineActive : styles.stepLinePassive,
            ]}
          />
        ) : null}

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

        {showBottomLine ? (
          <View
            style={[
              styles.stepLine,
              styles.stepLineBottom,
              lineActive ? styles.stepLineActive : styles.stepLinePassive,
            ]}
          />
        ) : null}
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
function getSmartStatus(user: Student): SmartStatus {
  if (user.direksiyon_sonuc === "gecti") {
    return {
      title: "Tebrikler, süreciniz tamamlandı",
      description:
        "Direksiyon sınavını başarıyla geçtiniz. Kurs süreciniz tamamlanmış görünüyor.",
      type: "success",
      actionLabel: "Detayı Gör",
      actionType: "detail",
    };
  }

  if (user.direksiyon_sonuc === "kaldi") {
    return {
      title: "Direksiyon sınavında başarısız oldunuz",
      description:
        "Yeni direksiyon süreci için kurs tarafından yapılacak bilgilendirmeyi bekleyin.",
      type: "error",
      actionLabel: "Detayı Gör",
      actionType: "detail",
    };
  }

  if (user.esinav_sonuc === "gecti" && user.direksiyon_tarih) {
    return {
      title: "Direksiyon sınav tarihiniz belli oldu",
      description: `Direksiyon sınav tarihiniz: ${user.direksiyon_tarih}`,
      type: "info",
      actionLabel: "Detayı Gör",
      actionType: "detail",
    };
  }

  if (user.esinav_sonuc === "gecti" && user.direksiyon_harc === "odenmedi") {
    return {
      title: "Direksiyon aşamasına geçtiniz",
      description:
        "Direksiyon süreciniz başladı ancak harç durumu kontrol edilmelidir.",
      type: "warning",
      actionLabel: "Detayı Gör",
      actionType: "detail",
    };
  }
  if (user.durum === "direksiyon") {
    return {
      title: "Direksiyon aşamasındasınız",
      description: user.direksiyon_tarih
        ? `Direksiyon sınav tarihiniz: ${user.direksiyon_tarih}`
        : "Direksiyon dersleri ve sınav süreciniz devam ediyor.",
      type: "info",
      actionLabel: "Detayı Gör",
      actionType: "detail",
    };
  }
  if (user.esinav_sonuc === "gecti") {
    return {
      title: "E-sınav aşamasını tamamladınız",
      description:
        "Direksiyon süreciniz başlamıştır. Ders ve sınav bilgileri panelde görüntülenecektir.",
      type: "success",
      actionLabel: "Detayı Gör",
      actionType: "detail",
    };
  }

  if (
    user.durum === "esinav" &&
    user.esinav_tarih &&
    user.esinav_sonuc !== "gecti" &&
    isPastDate(user.esinav_tarih)
  ) {
    if (user.esinav_harc === "odendi") {
      return {
        title: "E-sınav sonrası yeni tarih bekleniyor",
        description:
          "Sınav süreciniz devam ediyor. Yeni sınav tarihi açıklandığında panelde görünecektir.",
        type: "info",
        actionLabel: "Detayı Gör",
        actionType: "detail",
      };
    }

    return {
      title: "E-sınav harcı yeniden yatırılmalı",
      description:
        "Sınavda başarısız oldunuz, tekrar harç ödemeniz gerekiyor. Harç ödemesi yaparak süreci devam ettirebilirsiniz.",
      type: "warning",
      actionLabel: "Harç Öde",
      actionType: "harc",
    };
  }

  if (user.esinav_sonuc === "kaldi") {
    return {
      title: "E-sınavda başarısız oldunuz",
      description:
        "Tekrar sınava girmek için harç ve yeni tarih sürecini takip etmeniz gerekir.",
      type: "error",
      actionLabel: "Detayı Gör",
      actionType: "detail",
    };
  }

  if (user.esinav_tarih && user.esinav_sonuc !== "gecti") {
    return {
      title: "E-sınav tarihiniz belli oldu",
      description: `E-sınav bilginiz: ${formatExamText(
        user.esinav_tarih,
        user.esinav_saati,
      )}`,
      type: "info",
      actionLabel: "Detayı Gör",
      actionType: "detail",
    };
  }

  if (user.durum === "esinav" && user.esinav_harc === "odenmedi") {
    return {
      title: "E-sınav harcı bekleniyor",
      description:
        "Sınav sürecinizin ilerlemesi için e-sınav harcını ödemeniz gerekiyor.",
      type: "warning",
      actionLabel: "Harç Öde",
      actionType: "harc",
    };
  }

  if (
    user.durum === "esinav" &&
    user.esinav_harc === "odendi" &&
    !user.esinav_tarih
  ) {
    return {
      title: "E-sınav tarihi bekleniyor",
      description:
        "Harç ödemeniz alınmış görünüyor. Sınav tarihi açıklandığında burada görüntülenecek.",
      type: "info",
      actionLabel: "Detayı Gör",
      actionType: "detail",
    };
  }

  if (user.evrak_durumu === "eksik") {
    return {
      title: "Evraklarınız eksik",
      description: user.eksik_evraklar?.trim()
        ? `Eksik evraklarınızı tamamlamanız gerekiyor: ${user.eksik_evraklar}`
        : "Başvurunuz alınmış ancak eksik evraklarınız bulunuyor.",
      type: "warning",
      actionLabel: "Detayı Gör",
      actionType: "detail",
    };
  }

  if (user.evrak_durumu === "tamam") {
    return {
      title: "Başvurunuz tamamlandı",
      description:
        "Evraklarınız onaylanmış görünüyor. Sınav süreciniz sıradaki aşamaya göre devam edecektir.",
      type: "normal",
      actionLabel: "Detayı Gör",
      actionType: "detail",
    };
  }

  return {
    title: "Süreç devam ediyor",
    description: "Bilgileriniz güncellendikçe bu ekranda gösterilecektir.",
    type: "normal",
    actionLabel: "Detayı Gör",
    actionType: "detail",
  };
}

export default function Index() {
  const [tc, setTc] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState<Student | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [selectedDetail, setSelectedDetail] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [loginFeedback, setLoginFeedback] = useState<LoginFeedback | null>(
    null,
  );

  const loadStudents = async (preserveUser = false) => {
    try {
      setLoadingStudents(true);
      setFetchError("");
      setLoginFeedback(null);

      const response = await fetch(DATA_URL, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Öğrenci verisi alınamadı.");
      }

      const data: Student[] = await response.json();
      setStudents(data);

      if (preserveUser && user) {
        const updatedUser = data.find((s) => s.tc === user.tc);
        if (updatedUser) {
          setUser(updatedUser);
        }
      }
    } catch (error) {
      setStudents([]);
      setFetchError(
        "Veriler sunucudan alınamadı. Lütfen daha sonra tekrar deneyin.",
      );
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const reloadStudents = async () => {
    await loadStudents(true);
  };

  const handleTcChange = (value: string) => {
    setTc(value);

    if (loginFeedback) {
      setLoginFeedback(null);
    }
  };

  const handleLogin = () => {
    const cleanedTc = tc.trim();

    if (loadingStudents) {
      setLoginFeedback({
        type: "info",
        title: "Veriler yükleniyor",
        message: "Lütfen veri yükleme tamamlandıktan sonra tekrar deneyin.",
      });
      return;
    }

    if (fetchError) {
      setLoginFeedback({
        type: "error",
        title: "Veri yüklenemedi",
        message: fetchError,
      });
      return;
    }

    if (!students.length) {
      setLoginFeedback({
        type: "warning",
        title: "Öğrenci verisi bulunmuyor",
        message: "Sistemde henüz görüntülenebilir öğrenci verisi bulunmuyor.",
      });
      return;
    }

    if (!cleanedTc) {
      setLoginFeedback({
        type: "error",
        title: "TC gerekli",
        message: "TC kimlik numarası giriniz.",
      });
      return;
    }

    if (!/^\d+$/.test(cleanedTc)) {
      setLoginFeedback({
        type: "error",
        title: "Geçersiz giriş",
        message: "TC kimlik numarası sadece rakamlardan oluşmalıdır.",
      });
      return;
    }

    if (cleanedTc.length !== 11) {
      setLoginFeedback({
        type: "error",
        title: "Eksik veya hatalı uzunluk",
        message: "TC kimlik numarası 11 haneli olmalıdır.",
      });
      return;
    }

    const foundUser = students.find((s) => s.tc === cleanedTc);

    if (!foundUser) {
      setLoginFeedback({
        type: "warning",
        title: "Kayıt bulunamadı",
        message: "Bu TC kimlik numarasına ait öğrenci bulunamadı.",
      });
      return;
    }

    setLoginFeedback(null);
    setUser(foundUser);
    setLoggedIn(true);
    setSelectedDetail("");
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setUser(null);
    setTc("");
    setSelectedDetail("");
    setLoginFeedback(null);
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

  const smartStatus = useMemo(() => {
    if (!user) {
      return {
        title: "",
        description: "",
        type: "normal" as StatusType,
        actionType: "none" as const,
      };
    }

    return getSmartStatus(user);
  }, [user]);

  const visibleLoginFeedback = useMemo<LoginFeedback | null>(() => {
    if (loginFeedback) {
      return loginFeedback;
    }

    if (fetchError) {
      return {
        type: "error",
        title: "Veri yüklenemedi",
        message: fetchError,
      };
    }

    if (!loadingStudents && !students.length) {
      return {
        type: "warning",
        title: "Veri henüz hazır değil",
        message: "Sistemde henüz görüntülenebilir öğrenci verisi bulunmuyor.",
      };
    }

    return null;
  }, [loginFeedback, fetchError, loadingStudents, students.length]);

  const isLoginDisabled = loadingStudents || !!fetchError || !students.length;

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

    if (user.esinav_harc === "odenmedi" && user.durum !== "direksiyon") {
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

  const stepItems = useMemo(
    () => [
      {
        key: "basvuru",
        title: "Başvuru yapıldı",
        checked: stepStates.basvuruYapildi,
        active: activeStep === "basvuru",
        onPress: showBasvuruDetay,
      },
      {
        key: "basvuruTamam",
        title: "Başvuru tamamlandı",
        checked: stepStates.basvuruTamamlandi,
        active: activeStep === "basvuru" && user?.evrak_durumu === "tamam",
        onPress: showBasvuruTamamDetay,
      },
      {
        key: "esinav",
        title: "E-sınav aşaması",
        checked: stepStates.esinavAsamasi,
        active: activeStep === "esinav",
        onPress: showEsinavDetay,
      },
      {
        key: "direksiyon",
        title: "Direksiyon aşaması",
        checked: stepStates.direksiyonAsamasi,
        active: activeStep === "direksiyon",
        onPress: showDireksiyonDetay,
      },
      {
        key: "tamamlandi",
        title: "Süreç tamamlandı",
        checked: stepStates.tamamlandi,
        active: activeStep === "tamamlandi",
        onPress: () =>
          setSelectedDetail(
            user?.direksiyon_sonuc === "gecti"
              ? "Tüm süreç başarıyla tamamlandı."
              : "Süreç henüz tamamlanmadı.",
          ),
      },
    ],
    [activeStep, stepStates, user],
  );

  const handleSmartAction = () => {
    if (!user) return;

    if (smartStatus.actionType === "harc") {
      openHarcLink();
      return;
    }

    if (smartStatus.actionType === "detail") {
      if (user.direksiyon_sonuc === "gecti" || user.esinav_sonuc === "gecti") {
        showDireksiyonDetay();
        return;
      }

      if (user.durum === "esinav" || user.esinav_tarih || user.esinav_harc) {
        showEsinavDetay();
        return;
      }

      showBasvuruDetay();
    }
  };

  const openHarcLink = async () => {
    try {
      await Linking.openURL("https://odeme.meb.gov.tr");
    } catch (error) {
      Alert.alert("Hata", "Ödeme sayfası açılamadı.");
    }
  };

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
            onChangeText={handleTcChange}
          />

          {visibleLoginFeedback ? (
            <View
              style={[
                styles.loginStatusCard,
                visibleLoginFeedback.type === "success" &&
                  styles.loginStatusSuccess,
                visibleLoginFeedback.type === "error" &&
                  styles.loginStatusError,
                visibleLoginFeedback.type === "warning" &&
                  styles.loginStatusWarning,
                visibleLoginFeedback.type === "info" && styles.loginStatusInfo,
              ]}
            >
              <View style={styles.loginStatusHeader}>
                {visibleLoginFeedback.type === "info" && loadingStudents ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : null}
                <Text style={styles.loginStatusTitle}>
                  {visibleLoginFeedback.title}
                </Text>
              </View>
              <Text style={styles.loginStatusText}>
                {visibleLoginFeedback.message}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.loginButton,
              isLoginDisabled && styles.loginButtonDisabled,
            ]}
            onPress={handleLogin}
            activeOpacity={isLoginDisabled ? 1 : 0.85}
            disabled={isLoginDisabled}
          >
            <Text style={styles.loginButtonText}>
              {loadingStudents ? "Kontrol ediliyor..." : "Giriş Yap"}
            </Text>
          </TouchableOpacity>

          {(fetchError || !students.length) && !loadingStudents ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={reloadStudents}
            >
              <Text style={styles.secondaryButtonText}>Verileri Yenile</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

      <View
        style={[
          styles.statusCard,
          smartStatus.type === "success" && styles.statusSuccess,
          smartStatus.type === "error" && styles.statusError,
          smartStatus.type === "warning" && styles.statusWarning,
          smartStatus.type === "info" && styles.statusInfo,
        ]}
      >
        <Text style={styles.statusTitle}>{smartStatus.title}</Text>
        <Text style={styles.statusDescription}>{smartStatus.description}</Text>

        {smartStatus.actionLabel ? (
          <TouchableOpacity
            style={styles.paymentButton}
            onPress={handleSmartAction}
          >
            <Text style={styles.paymentButtonText}>
              {smartStatus.actionLabel}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.stepsCard}>
        <Text style={styles.sectionTitle}>Süreç Adımları</Text>

        {stepItems.map((item, index) => {
          const showTopLine = index !== 0;
          const showBottomLine = index !== stepItems.length - 1;
          const lineActive = item.checked || item.active;

          return (
            <StepItem
              key={item.key}
              title={item.title}
              checked={item.checked}
              active={item.active}
              onPress={item.onPress}
              showTopLine={showTopLine}
              showBottomLine={showBottomLine}
              lineActive={lineActive}
            />
          );
        })}
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
  loginButtonDisabled: {
    opacity: 0.55,
  },
  secondaryButton: {
    backgroundColor: "#1f1f25",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#2c2c34",
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  loginStatusCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    backgroundColor: "#151519",
    borderColor: "#232329",
  },
  loginStatusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  loginStatusTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  loginStatusText: {
    color: "#d8d8dd",
    fontSize: 14,
    lineHeight: 22,
  },
  loginStatusSuccess: {
    borderColor: "#1f8f55",
  },
  loginStatusError: {
    borderColor: "#a62d2d",
  },
  loginStatusWarning: {
    borderColor: "#a67c1a",
  },
  loginStatusInfo: {
    borderColor: "#2c6ca6",
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
  statusDescription: {
    color: "#d8d8dd",
    fontSize: 15,
    lineHeight: 23,
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
  stepIndicatorColumn: {
    width: 28,
    alignItems: "center",
    marginRight: 12,
    alignSelf: "stretch",
  },
  stepLine: {
    width: 2,
    flex: 1,
    borderRadius: 999,
  },
  stepLineTop: {
    marginBottom: 6,
  },
  stepLineBottom: {
    marginTop: 6,
  },
  stepLineActive: {
    backgroundColor: "#22c55e",
  },
  stepLinePassive: {
    backgroundColor: "#3a3a42",
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
    backgroundColor: "#22c55e",
    borderColor: "#22c55e",
  },
  stepCircleActive: {
    borderColor: "#22c55e",
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
  timelineContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 20,
  },
  stepContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  circle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    zIndex: 2,
  },
  circleActive: {
    backgroundColor: "#22C55E",
  },
  circlePassive: {
    backgroundColor: "#374151",
  },
  line: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  lineActive: {
    backgroundColor: "#22C55E",
  },
  linePassive: {
    backgroundColor: "#374151",
  },
});
