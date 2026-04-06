import * as Linking from "expo-linking";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
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

type BadgeTone = "green" | "red" | "orange" | "blue" | "gray";

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

function normalizeValue(value?: string | null) {
  if (!value) return "Henüz bilgi eklenmemiş";

  const cleaned = String(value).trim();
  return cleaned ? cleaned : "Henüz bilgi eklenmemiş";
}

function formatOutcome(value?: string) {
  if (!value) return "Henüz açıklanmadı";
  if (value === "gecti") return "Geçti";
  if (value === "kaldi") return "Kaldı";
  return value;
}

function formatPayment(value?: string) {
  if (!value) return "Henüz bilgi eklenmemiş";
  if (value === "odendi") return "Ödendi";
  if (value === "odenmedi") return "Ödenmedi";
  return value;
}

function getMissingDocumentsList(value?: string) {
  if (!value || !value.trim()) return [];

  return value
    .split(/[,;\n]+/)
    .map((item) => item.replace(/^[•\-\s]+/, "").trim())
    .filter(Boolean);
}

function getProcessBadge(user: Student): { label: string; tone: BadgeTone } {
  if (user.direksiyon_sonuc === "gecti") {
    return { label: "Tamamlandı", tone: "green" };
  }

  if (user.direksiyon_sonuc === "kaldi" || user.esinav_sonuc === "kaldi") {
    return { label: "İşlem gerekli", tone: "red" };
  }

  if (user.durum === "direksiyon") {
    return { label: "Direksiyon aşaması", tone: "blue" };
  }

  if (user.durum === "esinav") {
    return { label: "E-sınav aşaması", tone: "orange" };
  }

  return { label: "Kayıt süreci", tone: "gray" };
}

function getDocumentBadge(user: Student): { label: string; tone: BadgeTone } {
  if (user.evrak_durumu === "tamam") {
    return { label: "Evrak tam", tone: "green" };
  }

  if (user.evrak_durumu === "eksik") {
    return { label: "Evrak eksik", tone: "orange" };
  }

  return { label: "Evrak kontrolü", tone: "gray" };
}

function getPaymentBadge(value?: string): { label: string; tone: BadgeTone } {
  if (value === "odendi") {
    return { label: "Ödendi", tone: "green" };
  }

  if (value === "odenmedi") {
    return { label: "Ödeme bekleniyor", tone: "red" };
  }

  return { label: "Bilgi bekleniyor", tone: "gray" };
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

        {showBottomLine ? (
          <View
            style={[
              styles.stepLine,
              styles.stepLineBottom,
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
      <Text style={styles.infoChipValue}>{normalizeValue(value)}</Text>
    </View>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  return (
    <View
      style={[
        styles.badge,
        tone === "green" && styles.badgeGreen,
        tone === "red" && styles.badgeRed,
        tone === "orange" && styles.badgeOrange,
        tone === "blue" && styles.badgeBlue,
        tone === "gray" && styles.badgeGray,
      ]}
    >
      <Text style={styles.badgeText}>{label}</Text>
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
        ? `Eksik evraklarınızı tamamlamanız gerekiyor.`
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
  const [detailVisible, setDetailVisible] = useState(false);
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

  const openDetailModal = (text: string) => {
    setSelectedDetail(text);
    setDetailVisible(true);
  };

  const closeDetailModal = () => {
    setDetailVisible(false);
    setSelectedDetail("");
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
    setDetailVisible(false);
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setUser(null);
    setTc("");
    setSelectedDetail("");
    setDetailVisible(false);
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

  const processBadge = useMemo(() => {
    if (!user) return { label: "", tone: "gray" as BadgeTone };
    return getProcessBadge(user);
  }, [user]);

  const documentBadge = useMemo(() => {
    if (!user) return { label: "", tone: "gray" as BadgeTone };
    return getDocumentBadge(user);
  }, [user]);

  const esinavPaymentBadge = useMemo(() => {
    if (!user) return { label: "", tone: "gray" as BadgeTone };
    return getPaymentBadge(user.esinav_harc);
  }, [user]);

  const direksiyonPaymentBadge = useMemo(() => {
    if (!user) return { label: "", tone: "gray" as BadgeTone };
    return getPaymentBadge(user.direksiyon_harc);
  }, [user]);

  const missingDocuments = useMemo(() => {
    if (!user) return [];
    return getMissingDocumentsList(user.eksik_evraklar);
  }, [user]);

  const isEsinavStage = useMemo(() => {
    if (!user) return false;
    return user.durum === "esinav" && user.esinav_sonuc !== "gecti";
  }, [user]);

  const isDireksiyonStage = useMemo(() => {
    if (!user) return false;
    return user.durum === "direksiyon" || user.esinav_sonuc === "gecti";
  }, [user]);

  const isMissingDocumentStage = useMemo(() => {
    if (!user) return false;
    return user.evrak_durumu === "eksik";
  }, [user]);

  const showDocumentCard = useMemo(() => {
    if (!user) return false;
    return !isEsinavStage && !isDireksiyonStage;
  }, [user, isEsinavStage, isDireksiyonStage]);

  const showDocumentBadge = useMemo(() => {
    if (!user) return false;
    return !isEsinavStage && !isDireksiyonStage;
  }, [user, isEsinavStage, isDireksiyonStage]);

  const showEsinavInfoCard = useMemo(() => {
    if (!user) return false;
    return !isDireksiyonStage && !isMissingDocumentStage;
  }, [user, isDireksiyonStage, isMissingDocumentStage]);

  const showDireksiyonInfoCard = useMemo(() => {
    if (!user) return false;
    return !isEsinavStage && !isMissingDocumentStage;
  }, [user, isEsinavStage, isMissingDocumentStage]);

  const showOnlinePaymentButton = useMemo(() => {
    if (!user) return false;
    return (
      isEsinavStage &&
      user.esinav_harc === "odenmedi" &&
      !isMissingDocumentStage
    );
  }, [user, isEsinavStage, isMissingDocumentStage]);

  const showPaymentSection = useMemo(() => {
    return showEsinavInfoCard || showDireksiyonInfoCard;
  }, [showEsinavInfoCard, showDireksiyonInfoCard]);

  const showBasvuruDetay = () => {
    if (!user) return;

    if (user.evrak_durumu === "eksik") {
      const items = getMissingDocumentsList(user.eksik_evraklar);
      if (items.length) {
        openDetailModal(
          `Eksik evraklar:\n${items.map((item) => `• ${item}`).join("\n")}`,
        );
      } else {
        openDetailModal(
          "Eksik evrak bilginiz henüz detaylı olarak eklenmemiş.",
        );
      }
      return;
    }

    openDetailModal("Kurs başvurunuz alınmıştır.");
  };

  const showBasvuruTamamDetay = () => {
    if (!user) return;

    if (user.evrak_durumu === "tamam") {
      openDetailModal("Kurs başvurunuz tamamlandı. Evraklarınız tam.");
    } else {
      openDetailModal("Evraklarınız tamamlandığında bu aşama onaylanacaktır.");
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
        openDetailModal(
          "Sınav harcınızı yatırdınız. Yeni sınav tarihiniz açıklandığında size bilgi verilecektir.",
        );
      } else {
        openDetailModal(
          "E-sınavdan başarısız oldunuz. Tekrar harç yatırarak sınava girebilirsiniz.",
        );
      }
      return;
    }

    if (user.evrak_durumu !== "tamam") {
      openDetailModal(
        `Önce evraklarınızın tamamlanması gerekiyor: ${user.eksik_evraklar}`,
      );
      return;
    }

    if (user.esinav_sonuc === "kaldi") {
      openDetailModal("E-sınav başarısız.");
      return;
    }

    if (user.esinav_harc === "odenmedi" && user.durum !== "direksiyon") {
      openDetailModal(
        "Sınav harcınızı yatırmamışsınız. Ödeme yaptıktan sonra süreç devam edecektir.",
      );
      return;
    }

    if (user.esinav_harc === "odendi" && !user.esinav_tarih) {
      openDetailModal("Sınav harcınız yatırılmış. Sınav tarihi bekleniyor.");
      return;
    }

    if (user.esinav_tarih && user.esinav_sonuc !== "gecti") {
      openDetailModal(
        user.esinav_saati
          ? `E-sınav tarihiniz ${user.esinav_tarih} / ${user.esinav_saati}`
          : `E-sınav tarihiniz ${user.esinav_tarih}`,
      );
      return;
    }

    if (user.esinav_sonuc === "gecti") {
      openDetailModal("E-sınavı başarıyla geçtiniz.");
      return;
    }

    openDetailModal("E-sınav süreciniz devam ediyor.");
  };

  const showDireksiyonDetay = () => {
    if (!user) return;

    if (user.esinav_sonuc !== "gecti") {
      openDetailModal(
        "Direksiyon aşamasına geçmek için önce e-sınavı geçmelisiniz.",
      );
      return;
    }

    if (user.direksiyon_sonuc === "gecti") {
      openDetailModal("Direksiyon sınavını başarıyla geçtiniz.");
      return;
    }

    if (user.direksiyon_sonuc === "kaldi") {
      openDetailModal("Direksiyon sınavında başarısız oldunuz.");
      return;
    }

    if (user.direksiyon_harc === "odenmedi") {
      openDetailModal(
        "Direksiyon harcı henüz yatırılmamış görünüyor. Ödeme için kurs ile iletişime geçebilirsiniz.",
      );
      return;
    }

    if (user.direksiyon_tarih) {
      openDetailModal(`Direksiyon sınav tarihiniz ${user.direksiyon_tarih}`);
      return;
    }

    openDetailModal("Direksiyon süreciniz devam ediyor.");
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
          openDetailModal(
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
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>

            <View style={styles.profileTextArea}>
              <Text style={styles.name}>{normalizeValue(user.ad_soyad)}</Text>
              <Text style={styles.subName}>TC: {normalizeValue(user.tc)}</Text>
            </View>
          </View>

          <View style={styles.chipsRow}>
            <InfoChip label="Sınıf" value={user.sinif || ""} />
            <InfoChip label="Telefon" value={formatPhone(user.telefonlar)} />
          </View>

          <View style={styles.badgesRow}>
            <StatusBadge label={processBadge.label} tone={processBadge.tone} />
            {showDocumentBadge ? (
              <StatusBadge
                label={documentBadge.label}
                tone={documentBadge.tone}
              />
            ) : null}
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
          <Text style={styles.statusDescription}>
            {smartStatus.description}
          </Text>

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

        {showDocumentCard ? (
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Evrak Durumu</Text>

            <View style={styles.infoColumnBlock}>
              <Text style={styles.infoLabel}>Genel Durum</Text>
              <Text style={styles.infoValueBlock}>
                {user.evrak_durumu === "tamam"
                  ? "Tamamlandı"
                  : user.evrak_durumu === "eksik"
                    ? "Eksik"
                    : normalizeValue(user.evrak_durumu)}
              </Text>
            </View>

            <View style={styles.infoColumnBlockNoBorder}>
              <Text style={styles.infoLabel}>Eksik Evraklar</Text>

              {user.evrak_durumu === "eksik" ? (
                missingDocuments.length ? (
                  <View style={styles.missingDocsList}>
                    {missingDocuments.map((item, index) => (
                      <View
                        key={`${item}-${index}`}
                        style={styles.missingDocItem}
                      >
                        <Text style={styles.missingDocBullet}>•</Text>
                        <Text style={styles.missingDocText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.infoValueBlock}>
                    Henüz bilgi eklenmemiş
                  </Text>
                )
              ) : (
                <Text style={styles.infoValueBlock}>
                  Eksik evrak görünmüyor
                </Text>
              )}
            </View>
          </View>
        ) : null}

        {showPaymentSection ? (
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Sınav ve Ödeme Bilgileri</Text>

            {showEsinavInfoCard ? (
              <View style={styles.miniCard}>
                <View style={styles.miniCardHeader}>
                  <Text style={styles.miniCardTitle}>E-sınav</Text>
                  <StatusBadge
                    label={esinavPaymentBadge.label}
                    tone={esinavPaymentBadge.tone}
                  />
                </View>
                <Text style={styles.miniCardText}>
                  Tarih:{" "}
                  {normalizeValue(
                    formatExamText(user.esinav_tarih, user.esinav_saati),
                  )}
                </Text>
                <Text style={styles.miniCardText}>
                  Sonuç: {formatOutcome(user.esinav_sonuc)}
                </Text>
                <Text style={styles.miniCardText}>
                  Harç: {formatPayment(user.esinav_harc)}
                </Text>
              </View>
            ) : null}

            {showDireksiyonInfoCard ? (
              <View style={styles.miniCard}>
                <View style={styles.miniCardHeader}>
                  <Text style={styles.miniCardTitle}>Direksiyon</Text>
                  <StatusBadge
                    label={direksiyonPaymentBadge.label}
                    tone={direksiyonPaymentBadge.tone}
                  />
                </View>
                <Text style={styles.miniCardText}>
                  Tarih: {normalizeValue(user.direksiyon_tarih)}
                </Text>
                <Text style={styles.miniCardText}>
                  Sonuç: {formatOutcome(user.direksiyon_sonuc)}
                </Text>
                <Text style={styles.miniCardText}>
                  Harç: {formatPayment(user.direksiyon_harc)}
                </Text>
              </View>
            ) : null}

            {showOnlinePaymentButton ? (
              <TouchableOpacity
                style={styles.paymentWideButton}
                onPress={openHarcLink}
              >
                <Text style={styles.paymentWideButtonText}>
                  Online Ödeme Yap
                </Text>
                <Text style={styles.paymentWideButtonSubText}>
                  İşlem güvenli şekilde tarayıcıda açılır.
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

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

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={detailVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDetailModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeDetailModal}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Detay</Text>
            <Text style={styles.modalText}>{selectedDetail}</Text>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={closeDetailModal}
            >
              <Text style={styles.modalCloseButtonText}>Kapat</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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
  loginButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
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
    marginBottom: 12,
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
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  badgeGreen: {
    backgroundColor: "#11301f",
    borderColor: "#1f8f55",
  },
  badgeRed: {
    backgroundColor: "#301515",
    borderColor: "#a62d2d",
  },
  badgeOrange: {
    backgroundColor: "#33250f",
    borderColor: "#a67c1a",
  },
  badgeBlue: {
    backgroundColor: "#112536",
    borderColor: "#2c6ca6",
  },
  badgeGray: {
    backgroundColor: "#1d1d23",
    borderColor: "#34343b",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
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
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  statusDescription: {
    color: "#d8d8dd",
    fontSize: 15,
    lineHeight: 23,
  },
  paymentButton: {
    marginTop: 14,
    backgroundColor: "#c1121f",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  paymentButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  infoCard: {
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
  infoColumnBlock: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#232329",
  },
  infoColumnBlockNoBorder: {
    paddingTop: 12,
  },
  infoLabel: {
    color: "#8f8f97",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  infoValueBlock: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
  },
  missingDocsList: {
    gap: 8,
  },
  missingDocItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  missingDocBullet: {
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 22,
    marginRight: 8,
  },
  missingDocText: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
  },
  miniCard: {
    backgroundColor: "#1c1c22",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2a2a31",
    marginBottom: 12,
  },
  miniCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 8,
  },
  miniCardTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  miniCardText: {
    color: "#d8d8dd",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 4,
  },
  paymentWideButton: {
    backgroundColor: "#1f1f25",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#2c2c34",
    marginTop: 2,
  },
  paymentWideButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  paymentWideButtonSubText: {
    color: "#9c9ca6",
    fontSize: 13,
    lineHeight: 18,
  },
  stepsCard: {
    backgroundColor: "#151519",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#232329",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 58,
  },
  stepIndicatorColumn: {
    width: 26,
    alignItems: "center",
    position: "relative",
  },
  stepLine: {
    position: "absolute",
    width: 2,
    left: 11,
    zIndex: 0,
  },
  stepLineTop: {
    top: 0,
    height: 29,
  },
  stepLineBottom: {
    top: 29,
    bottom: 0,
  },
  stepLineActive: {
    backgroundColor: "#22c55e",
  },
  stepLinePassive: {
    backgroundColor: "#34343b",
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#34343b",
    backgroundColor: "#151519",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 17,
    zIndex: 2,
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
    justifyContent: "center",
    paddingLeft: 12,
    paddingVertical: 10,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    backgroundColor: "#151519",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#2a2a31",
  },
  modalTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },
  modalText: {
    color: "#d8d8dd",
    fontSize: 15,
    lineHeight: 24,
  },
  modalCloseButton: {
    marginTop: 18,
    backgroundColor: "#c1121f",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalCloseButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
});
