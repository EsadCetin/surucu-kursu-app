import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAppTheme } from "../hooks/useAppTheme";

type LessonItem = {
  tarih?: string;
  saat?: string;
  not?: string;
  durum?: "planlandi" | "teyitli" | "katildi" | "katilmadi";
  teyitli_mi?: boolean;
  katilim?: "katildi" | "katilmadi" | "";
  arac_plaka?: string;
  telefon?: string;
  egitmen?: string;
};

type Student = {
  tc: string;
  ad_soyad: string;
  sinif: string;
  telefonlar: string;
  durum: string;
  evrak_durumu: string;
  eksik_evraklar?: string;

  esinav_harc: string;
  esinav_son_odeme?: string;
  esinav_tarih?: string;
  esinav_saati?: string;
  esinav_sonuc: string;

  direksiyon_harc: string;
  direksiyon_son_odeme?: string;
  direksiyon_tarih?: string;
  direksiyon_saati?: string;
  direksiyon_sonuc: string;

  direksiyon_dersleri?: LessonItem[] | string;

  esinav_harc_borcu?: string;
  esinav_harc_borc?: string;
  esinav_borc_son_odeme?: string;

  direksiyon_harc_borcu?: string;
  direksiyon_harc_borc?: string;
  direksiyon_borc_son_odeme?: string;

  taksit_borcu?: string;
  taksit_son_odeme?: string;
};

type CachedStudentsPayload = {
  students: Student[];
  lastSuccessfulSyncAt?: string;
  sourceModifiedAt?: string;
};

type StatusType = "success" | "error" | "warning" | "info" | "normal";
type BadgeTone = "green" | "red" | "orange" | "blue" | "gray";

type LoginFeedback = {
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
};

type SmartStatus = {
  title: string;
  description: string;
  type: StatusType;
  actionLabel?: string;
  actionType?: "harc" | "detail" | "none";
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

type CalendarEventType =
  | "payment-esinav"
  | "payment-direksiyon"
  | "payment-taksit"
  | "exam-esinav"
  | "exam-direksiyon"
  | "lesson";

type CalendarEvent = {
  key: string;
  date: string;
  time?: string;
  title: string;
  description?: string;
  type: CalendarEventType;
  isPast: boolean;
  isToday: boolean;
  isUpcoming: boolean;
};

type CalendarCell = {
  key: string;
  fullDate: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
};

const DATA_URL =
  "https://raw.githubusercontent.com/EsadCetin/surucu-kursu-app/main/docs/students.json";
const DATA_LAST_COMMIT_URL =
  "https://api.github.com/repos/EsadCetin/surucu-kursu-app/commits?path=docs/students.json&sha=main&per_page=1";

const STUDENT_SESSION_TC_KEY = "student_session_tc";

const STUDENTS_CACHE_KEY = "students_cache_v4";

const LOGIN_LOGO = require("../assets/images/logo.png");

async function saveStudentSessionTc(tc: string) {
  await AsyncStorage.setItem(STUDENT_SESSION_TC_KEY, tc.trim());
}

async function getStudentSessionTc() {
  const storedTc = await AsyncStorage.getItem(STUDENT_SESSION_TC_KEY);
  return storedTc?.trim() || "";
}

async function clearStudentSessionTc() {
  await AsyncStorage.removeItem(STUDENT_SESSION_TC_KEY);
}

async function saveStudentsCache(payload: CachedStudentsPayload) {
  await AsyncStorage.setItem(STUDENTS_CACHE_KEY, JSON.stringify(payload));
}

async function getStudentsCache(): Promise<CachedStudentsPayload | null> {
  const raw = await AsyncStorage.getItem(STUDENTS_CACHE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CachedStudentsPayload;

    if (!parsed || !Array.isArray(parsed.students)) {
      return null;
    }

    return {
      students: parsed.students.filter(
        (item) => item && typeof item.tc === "string",
      ),
      lastSuccessfulSyncAt: parsed.lastSuccessfulSyncAt,
      sourceModifiedAt: parsed.sourceModifiedAt,
    };
  } catch (error) {
    console.log("Öğrenci cache verisi okunamadı:", error);
    return null;
  }
}

function formatDateTime(value?: string) {
  if (!value) return "Henüz bilinmiyor";

  const date = new Date(value);
  if (isNaN(date.getTime())) return "Henüz bilinmiyor";

  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getLastUpdateText(payload?: {
  sourceModifiedAt?: string;
  lastSuccessfulSyncAt?: string;
}) {
  if (payload?.sourceModifiedAt) {
    return formatDateTime(payload.sourceModifiedAt);
  }

  if (payload?.lastSuccessfulSyncAt) {
    return formatDateTime(payload.lastSuccessfulSyncAt);
  }

  return "Henüz bilinmiyor";
}

async function getStudentsLastCommitDate() {
  try {
    const response = await fetch(DATA_LAST_COMMIT_URL, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });

    if (!response.ok) {
      return "";
    }

    const commits = await response.json();

    if (!Array.isArray(commits) || !commits.length) {
      return "";
    }

    const latestCommit = commits[0];
    return (
      latestCommit?.commit?.committer?.date ||
      latestCommit?.commit?.author?.date ||
      ""
    );
  } catch (error) {
    console.log("students.json son commit tarihi alınamadı:", error);
    return "";
  }
}

const MONTH_NAMES = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

const DAY_NAMES = ["Pa", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

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

function formatDateFromParts(day: number, month: number, year: number) {
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return `${dd}.${mm}.${year}`;
}

function getTodayDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getDaysDiffFromToday(dateStr?: string) {
  const target = parseAppDate(dateStr);
  if (!target) return null;
  const diff = target.getTime() - getTodayDate().getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function isPastDate(dateStr?: string) {
  const diff = getDaysDiffFromToday(dateStr);
  return diff !== null ? diff < 0 : false;
}

function isTodayDate(dateStr?: string) {
  const diff = getDaysDiffFromToday(dateStr);
  return diff !== null ? diff === 0 : false;
}

function isUpcomingDate(dateStr?: string, limit = 3) {
  const diff = getDaysDiffFromToday(dateStr);
  return diff !== null ? diff >= 0 && diff <= limit : false;
}

function normalizeValue(value?: string | null) {
  if (!value) return "Henüz bilgi eklenmemiş";
  const cleaned = String(value).trim();
  return cleaned ? cleaned : "Henüz bilgi eklenmemiş";
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

function formatExamText(date?: string, time?: string) {
  if (!date) return "Henüz bilgi eklenmemiş";
  return time ? `${date} / ${time}` : date;
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

function formatDebt(value?: string) {
  if (!value || !value.trim()) return "Yok";
  return value.trim();
}

function hasDebtValue(value?: string) {
  return formatDebt(value).toLocaleLowerCase("tr-TR") !== "yok";
}

function getMissingDocumentsList(value?: string) {
  if (!value || !value.trim()) return [];
  return value
    .split(/[,;\n]+/)
    .map((item) => item.replace(/^[•\-\s]+/, "").trim())
    .filter(Boolean);
}

function parseLessonText(value?: string): LessonItem[] {
  if (!value || !value.trim()) return [];
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const clean = line.replace(/^[•\-\s]+/, "").trim();
      const dateMatch = clean.match(/\b\d{2}\.\d{2}\.\d{4}\b/);
      const timeMatch = clean.match(/\b\d{2}:\d{2}\b/);

      return {
        tarih: dateMatch?.[0],
        saat: timeMatch?.[0],
        not: clean || `${index + 1}. Direksiyon dersi`,
      };
    });
}

function getLessonStatusText(lesson?: LessonItem) {
  if (!lesson) return "Netleşmedi";

  if (lesson.katilim === "katildi" || lesson.durum === "katildi") {
    return "Derse katıldı";
  }

  if (lesson.katilim === "katilmadi" || lesson.durum === "katilmadi") {
    return "Derse katılmadı";
  }

  if (lesson.teyitli_mi || lesson.durum === "teyitli") {
    return "Onaylandı";
  }

  if (lesson.durum === "planlandi") {
    return "Planlandı";
  }

  return "Netleşmedi";
}

function getLessonStatusSuffix(lesson?: LessonItem) {
  return ` / ${getLessonStatusText(lesson)}`;
}

function getLessonDisplayTitle(lesson: LessonItem, index: number) {
  return `${index + 1}. dersi`;
}

function getLessonStartOnly(lesson?: LessonItem) {
  if (!lesson?.saat) return "";
  return lesson.saat.split("-")[0]?.trim() || lesson.saat.trim();
}

function getLessons(user: Student) {
  if (Array.isArray(user.direksiyon_dersleri)) {
    return user.direksiyon_dersleri.filter(
      (item) => item && (item.tarih || item.saat || item.not),
    );
  }

  if (typeof user.direksiyon_dersleri === "string") {
    return parseLessonText(user.direksiyon_dersleri);
  }

  return [];
}

function getEsinavDebt(user: Student) {
  return user.esinav_harc_borcu || user.esinav_harc_borc || "";
}

function getDireksiyonDebt(user: Student) {
  return user.direksiyon_harc_borcu || user.direksiyon_harc_borc || "";
}

function getPaymentBadge(value?: string): { label: string; tone: BadgeTone } {
  if (value === "odendi") return { label: "Ödendi", tone: "green" };
  if (value === "odenmedi") return { label: "Ödeme bekleniyor", tone: "red" };
  return { label: "Bilgi bekleniyor", tone: "gray" };
}

function getProcessBadge(user: Student): { label: string; tone: BadgeTone } {
  if (user.direksiyon_sonuc === "gecti")
    return { label: "Tamamlandı", tone: "green" };
  if (user.direksiyon_sonuc === "kaldi" || user.esinav_sonuc === "kaldi") {
    return { label: "İşlem gerekli", tone: "red" };
  }
  if (user.durum === "direksiyon")
    return { label: "Direksiyon aşaması", tone: "blue" };
  if (user.durum === "esinav")
    return { label: "E-sınav aşaması", tone: "orange" };
  return { label: "Kayıt süreci", tone: "gray" };
}

function getDocumentBadge(user: Student): { label: string; tone: BadgeTone } {
  if (user.evrak_durumu === "tamam")
    return { label: "Evrak tam", tone: "green" };
  if (user.evrak_durumu === "eksik")
    return { label: "Evrak eksik", tone: "orange" };
  return { label: "Evrak kontrolü", tone: "gray" };
}

function getCalendarBadgeTone(type: CalendarEventType): BadgeTone {
  if (
    type === "payment-esinav" ||
    type === "payment-direksiyon" ||
    type === "payment-taksit"
  ) {
    return "red";
  }
  if (type === "exam-esinav") return "blue";
  if (type === "exam-direksiyon") return "orange";
  return "green";
}

function buildCalendarEvents(user: Student): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  if (user.evrak_durumu === "eksik") return events;

  if (user.durum === "esinav") {
    if (user.esinav_borc_son_odeme && hasDebtValue(getEsinavDebt(user))) {
      events.push({
        key: `esinav-odeme-${user.esinav_borc_son_odeme}`,
        date: user.esinav_borc_son_odeme,
        title: "E-sınav harcı son ödeme günü",
        description: `Borç: ${formatDebt(getEsinavDebt(user))}`,
        type: "payment-esinav",
        isPast: isPastDate(user.esinav_borc_son_odeme),
        isToday: isTodayDate(user.esinav_borc_son_odeme),
        isUpcoming: isUpcomingDate(user.esinav_borc_son_odeme),
      });
    }

    if (user.esinav_tarih && !isPastDate(user.esinav_tarih)) {
      events.push({
        key: `esinav-${user.esinav_tarih}-${user.esinav_saati || ""}`,
        date: user.esinav_tarih,
        time: user.esinav_saati,
        title: "E-sınav",
        description: user.esinav_saati
          ? `Sınav saati: ${user.esinav_saati}`
          : "Sınav saati henüz eklenmemiş.",
        type: "exam-esinav",
        isPast: false,
        isToday: isTodayDate(user.esinav_tarih),
        isUpcoming: isUpcomingDate(user.esinav_tarih),
      });
    }
  }

  if (user.durum === "direksiyon" || user.esinav_sonuc === "gecti") {
    if (
      user.direksiyon_borc_son_odeme &&
      hasDebtValue(getDireksiyonDebt(user))
    ) {
      events.push({
        key: `direksiyon-odeme-${user.direksiyon_borc_son_odeme}`,
        date: user.direksiyon_borc_son_odeme,
        title: "Direksiyon harcı son ödeme günü",
        description: `Borç: ${formatDebt(getDireksiyonDebt(user))}`,
        type: "payment-direksiyon",
        isPast: isPastDate(user.direksiyon_borc_son_odeme),
        isToday: isTodayDate(user.direksiyon_borc_son_odeme),
        isUpcoming: isUpcomingDate(user.direksiyon_borc_son_odeme),
      });
    }

    if (user.taksit_son_odeme && hasDebtValue(user.taksit_borcu)) {
      events.push({
        key: `taksit-odeme-${user.taksit_son_odeme}`,
        date: user.taksit_son_odeme,
        title: "Taksit son ödeme günü",
        description: `Borç: ${formatDebt(user.taksit_borcu)}`,
        type: "payment-taksit",
        isPast: isPastDate(user.taksit_son_odeme),
        isToday: isTodayDate(user.taksit_son_odeme),
        isUpcoming: isUpcomingDate(user.taksit_son_odeme),
      });
    }

    getLessons(user).forEach((lesson, index) => {
      if (!lesson.tarih && !lesson.saat && !lesson.not) return;

      const statusText = getLessonStatusText(lesson);
      const startTime = getLessonStartOnly(lesson);

      events.push({
        key: `lesson-${index}-${lesson.tarih || ""}-${lesson.saat || ""}`,
        date: lesson.tarih || "",
        time: startTime || undefined,
        title: "Direksiyon dersi",
        description: startTime
          ? `Ders saati: ${startTime} / ${statusText}`
          : `Durum: ${statusText}`,
        type: "lesson",
        isPast: isPastDate(lesson.tarih),
        isToday: isTodayDate(lesson.tarih),
        isUpcoming: isUpcomingDate(lesson.tarih),
      });
    });

    if (user.direksiyon_tarih) {
      events.push({
        key: `direksiyon-sinav-${user.direksiyon_tarih}-${user.direksiyon_saati || ""}`,
        date: user.direksiyon_tarih,
        time: user.direksiyon_saati,
        title: "Direksiyon sınavı",
        description: user.direksiyon_saati
          ? `Sınav saati ${user.direksiyon_saati}`
          : "Sınav saati henüz eklenmemiş.",
        type: "exam-direksiyon",
        isPast: isPastDate(user.direksiyon_tarih),
        isToday: isTodayDate(user.direksiyon_tarih),
        isUpcoming: isUpcomingDate(user.direksiyon_tarih),
      });
    }
  }

  return events
    .filter((event) => !!event.date)
    .sort((a, b) => {
      const first = parseAppDate(a.date)?.getTime() || 0;
      const second = parseAppDate(b.date)?.getTime() || 0;
      return first - second;
    });
}

function addMonthsSafe(base: Date, amount: number) {
  return new Date(base.getFullYear(), base.getMonth() + amount, 1);
}

function buildMonthCells(
  monthDate: Date,
  events: CalendarEvent[],
): CalendarCell[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  const cells: CalendarCell[] = [];

  for (let i = 0; i < 42; i += 1) {
    const current = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + i,
    );
    const fullDate = formatDateFromParts(
      current.getDate(),
      current.getMonth() + 1,
      current.getFullYear(),
    );

    cells.push({
      key: `${fullDate}-${i}`,
      fullDate,
      dayNumber: current.getDate(),
      isCurrentMonth: current.getMonth() === month,
      isToday: isTodayDate(fullDate),
      events: events.filter((event) => event.date === fullDate),
    });
  }

  return cells;
}

function hasFutureExamDate(user: Student) {
  return !!user.esinav_tarih && !isPastDate(user.esinav_tarih);
}

function getSmartStatus(user: Student): SmartStatus {
  if (user.direksiyon_sonuc === "gecti") {
    return {
      title: "Tebrikler, süreciniz tamamlandı",
      description:
        "Direksiyon sınavını başarıyla geçtiniz. Kurs süreciniz tamamlandı.",
      type: "success",
      actionLabel: "Detayı Gör",
      actionType: "detail",
    };
  }

  if (user.direksiyon_sonuc === "kaldi") {
    return {
      title: "Direksiyon sınavında başarısız oldunuz",
      description:
        "Yeni sınav süreci için kurs tarafından yapılacak bilgilendirmeyi bekleyin.",
      type: "error",
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

  if (
    user.durum === "esinav" &&
    user.esinav_harc === "odendi" &&
    !hasFutureExamDate(user)
  ) {
    return {
      title: "Yeni sınav tarihi bekleniyor",
      description:
        "Yeni harç ödemeniz alındı. Yeni e-sınav tarihi açıklandığında burada gösterilecek.",
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
    hasFutureExamDate(user) &&
    user.esinav_sonuc !== "gecti"
  ) {
    return {
      title: "E-sınav tarihiniz belli oldu",
      description: "Detayı görüntüleyerek sınav tarihini görebilirsiniz.",
      type: "info",
      actionLabel: "Detayı Gör",
      actionType: "detail",
    };
  }

  if (user.esinav_sonuc === "gecti" && user.direksiyon_harc === "odenmedi") {
    return {
      title: "Direksiyon aşamasına geçtiniz",
      description:
        "Direksiyon ödeme bilgisi için kurs tarafından gönderilen SMS'i kontrol edin.",
      type: "warning",
      actionLabel: "Ödeme Bilgisi",
      actionType: "harc",
    };
  }

  if (
    user.durum === "direksiyon" ||
    user.esinav_sonuc === "gecti" ||
    !!user.direksiyon_tarih ||
    !!user.direksiyon_saati
  ) {
    return {
      title: "Direksiyon aşamasındasınız",
      description: user.direksiyon_tarih
        ? `Direksiyon sınav tarihiniz: ${formatExamText(user.direksiyon_tarih, user.direksiyon_saati)}`
        : "Direksiyon dersleri ve sınav ile ilgili kurs tarafından bilgilendirileceksiniz.",
      type: "info",
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

function StepItem({
  title,
  checked,
  active = false,
  onPress,
  showTopLine = false,
  showBottomLine = false,
  lineActive = false,
  colors,
}: StepItemProps & {
  colors: {
    text: string;
    subText: string;
    border: string;
    cardBg: string;
  };
}) {
  return (
    <TouchableOpacity
      style={styles.stepRow}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={styles.stepIndicatorColumn}>
        {showTopLine ? (
          <View
            style={[
              styles.stepLine,
              styles.stepLineTop,
              lineActive ? styles.stepLineActive : styles.stepLinePassive,
              !lineActive ? { backgroundColor: colors.border } : null,
            ]}
          />
        ) : null}

        <View
          style={[
            styles.stepCircle,
            { borderColor: colors.border, backgroundColor: colors.cardBg },
            checked ? styles.stepCircleChecked : null,
            !checked && active ? styles.stepCircleActive : null,
          ]}
        >
          <Text style={styles.stepCircleText}>
            {checked || active ? "✓" : ""}
          </Text>
        </View>

        {showBottomLine ? (
          <View
            style={[
              styles.stepLine,
              styles.stepLineBottom,
              lineActive ? styles.stepLineActive : styles.stepLinePassive,
              !lineActive ? { backgroundColor: colors.border } : null,
            ]}
          />
        ) : null}
      </View>

      <View style={styles.stepContent}>
        <Text
          style={[
            styles.stepTitle,
            checked ? styles.stepTitleChecked : null,
            !checked && active ? styles.stepTitleActive : null,
            {
              color: checked
                ? colors.text
                : active
                  ? colors.text
                  : colors.subText,
            },
          ]}
        >
          {title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  return (
    <View
      style={[
        styles.badge,
        tone === "green"
          ? styles.badgeGreen
          : tone === "red"
            ? styles.badgeRed
            : tone === "orange"
              ? styles.badgeOrange
              : tone === "blue"
                ? styles.badgeBlue
                : styles.badgeGray,
      ]}
    >
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function InfoChip({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: {
    cardAltBg: string;
    border: string;
    mutedText: string;
    text: string;
  };
}) {
  return (
    <View
      style={[
        styles.infoChip,
        { backgroundColor: colors.cardAltBg, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.infoChipLabel, { color: colors.mutedText }]}>
        {label}
      </Text>
      <Text style={[styles.infoChipValue, { color: colors.text }]}>
        {normalizeValue(value)}
      </Text>
    </View>
  );
}

function ThemeToggle({
  selectedTheme,
  onToggle,
  colors,
}: {
  selectedTheme: "dark" | "light";
  onToggle: () => void;
  colors: {
    cardAltBg: string;
    border: string;
    accent: string;
    accentContrast: string;
    mutedText: string;
  };
}) {
  const animatedValue = useRef(
    new Animated.Value(selectedTheme === "light" ? 1 : 0),
  ).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: selectedTheme === "light" ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animatedValue, selectedTheme]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 35],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onToggle}
      style={[
        styles.themeToggle,
        {
          borderColor: colors.border,
          backgroundColor: colors.cardAltBg,
        },
      ]}
    >
      <View pointerEvents="none" style={styles.themeToggleIcons}>
        <Ionicons name="moon" size={15} color={colors.mutedText} />
        <Ionicons name="sunny" size={16} color={colors.mutedText} />
      </View>

      <Animated.View
        style={[
          styles.themeToggleThumb,
          {
            backgroundColor: colors.accent,
            transform: [{ translateX }],
          },
        ]}
      >
        <Ionicons
          name={selectedTheme === "light" ? "sunny" : "moon"}
          size={16}
          color={colors.accentContrast}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function Index() {
  const [tc, setTc] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState<Student | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [lastDataUpdateText, setLastDataUpdateText] =
    useState("Henüz bilinmiyor");
  const [showOfflineDataNotice, setShowOfflineDataNotice] = useState(false);
  const [loginFeedback, setLoginFeedback] = useState<LoginFeedback | null>(
    null,
  );
  const [selectedDetail, setSelectedDetail] = useState("");
  const [detailVisible, setDetailVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarDetailVisible, setCalendarDetailVisible] = useState(false);
  const [calendarSelectedDetail, setCalendarSelectedDetail] = useState("");
  const [sessionTc, setSessionTc] = useState("");
  const [restoringSession, setRestoringSession] = useState(true);
  const { theme, colors, themeReady, toggleTheme } = useAppTheme();
  const calendarScrollRef = useRef<ScrollView | null>(null);
  const loginScrollRef = useRef<ScrollView | null>(null);
  const scrollStartYRef = useRef(0);

  const baseMonth = useMemo(() => new Date(2026, 3, 1), []);
  const [monthOffset, setMonthOffset] = useState(0);

  const visibleMonth = useMemo(
    () => addMonthsSafe(baseMonth, monthOffset),
    [baseMonth, monthOffset],
  );

  const canGoPrev = monthOffset > -3;
  const canGoNext = monthOffset < 2;

  const goToPrevMonth = () => {
    setMonthOffset((prev) => Math.max(prev - 1, -3));
  };

  const goToNextMonth = () => {
    setMonthOffset((prev) => Math.min(prev + 1, 2));
  };

  const handleCalendarMonthChangeGesture = (deltaY: number) => {
    if (Math.abs(deltaY) < 40) return;

    if (deltaY > 0 && canGoNext) {
      goToNextMonth();
      return;
    }

    if (deltaY < 0 && canGoPrev) {
      goToPrevMonth();
    }
  };

  const calendarPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 12 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderRelease: (_, gestureState) => {
          handleCalendarMonthChangeGesture(gestureState.dy);
        },
        onPanResponderTerminate: (_, gestureState) => {
          handleCalendarMonthChangeGesture(gestureState.dy);
        },
      }),
    [canGoPrev, canGoNext],
  );

  const loadStudents = async () => {
    try {
      setLoadingStudents(true);
      setFetchError("");
      setLoginFeedback(null);

      const response = await fetch(`${DATA_URL}?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Öğrenci verisi alınamadı.");
      }

      const data: Student[] = await response.json();
      const githubLastCommitAt = await getStudentsLastCommitDate();
      const rawLastModified =
        response.headers.get("last-modified") ||
        response.headers.get("Last-Modified") ||
        "";
      const sourceModifiedAt = githubLastCommitAt || rawLastModified || "";
      const cachePayload: CachedStudentsPayload = {
        students: data,
        lastSuccessfulSyncAt: new Date().toISOString(),
        sourceModifiedAt: sourceModifiedAt || undefined,
      };

      setStudents(data);
      setLastDataUpdateText(getLastUpdateText(cachePayload));
      setShowOfflineDataNotice(false);

      try {
        await saveStudentsCache(cachePayload);
      } catch (error) {
        console.log("Öğrenci verisi cache'e kaydedilemedi:", error);
      }
    } catch {
      try {
        const cachedPayload = await getStudentsCache();

        if (cachedPayload?.students?.length) {
          setStudents(cachedPayload.students);
          setLastDataUpdateText(getLastUpdateText(cachedPayload));
          setShowOfflineDataNotice(true);
          setFetchError("");
          return;
        }
      } catch (cacheError) {
        console.log("Öğrenci cache verisi yüklenemedi:", cacheError);
      }

      setStudents([]);
      setLastDataUpdateText("Henüz bilinmiyor");
      setShowOfflineDataNotice(false);
      setFetchError(
        "Veriler sunucudan alınamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.",
      );
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    let active = true;

    const restoreStoredSession = async () => {
      try {
        const storedTc = await getStudentSessionTc();
        if (!active) return;
        setSessionTc(storedTc);
        if (storedTc) {
          setTc(storedTc);
        }
      } catch (error) {
        console.log("Kayıtlı oturum okunamadı:", error);
      } finally {
        if (active) {
          setRestoringSession(false);
        }
      }
    };

    restoreStoredSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (restoringSession) return;
    if (loadingStudents) return;
    if (loggedIn) return;
    if (!sessionTc) return;

    const foundUser = students.find((student) => student.tc === sessionTc);

    if (!foundUser) {
      clearStudentSessionTc().catch((error) => {
        console.log("Geçersiz kayıtlı oturum temizlenemedi:", error);
      });
      setSessionTc("");
      setTc("");
      return;
    }

    setTc(foundUser.tc);
    setUser(foundUser);
    setLoggedIn(true);
    setLoginFeedback(null);
    setSelectedDetail("");
    setDetailVisible(false);
    setCalendarVisible(false);
    setCalendarDetailVisible(false);
  }, [restoringSession, loadingStudents, loggedIn, sessionTc, students]);

  useEffect(() => {
    if (calendarVisible && calendarScrollRef.current) {
      calendarScrollRef.current.scrollTo({ y: 0, animated: false });
    }
  }, [monthOffset, calendarVisible]);

  const openDetailModal = (text: string) => {
    setSelectedDetail(text);
    setDetailVisible(true);
  };

  const closeDetailModal = () => {
    setDetailVisible(false);
    setSelectedDetail("");
  };

  const openCalendarModal = () => {
    setCalendarVisible(true);
    setMonthOffset(0);
    setCalendarDetailVisible(false);
    setCalendarSelectedDetail("");
  };

  const closeCalendarModal = () => {
    setCalendarVisible(false);
    setCalendarDetailVisible(false);
    setCalendarSelectedDetail("");
  };

  const openCalendarDetailModal = (text: string) => {
    setCalendarSelectedDetail(text);
    setCalendarDetailVisible(true);
  };

  const closeCalendarDetailModal = () => {
    setCalendarDetailVisible(false);
    setCalendarSelectedDetail("");
  };

  const handleTcChange = (value: string) => {
    setTc(value);
    if (loginFeedback) setLoginFeedback(null);
  };

  const handleLogin = async () => {
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

    try {
      await saveStudentSessionTc(cleanedTc);
      setSessionTc(cleanedTc);
    } catch (error) {
      console.log("Oturum kaydedilemedi:", error);
      setLoginFeedback({
        type: "error",
        title: "Oturum kaydedilemedi",
        message: "Uygulama oturumu cihazda saklanamadı. Lütfen tekrar deneyin.",
      });
      return;
    }

    setUser(foundUser);
    setLoggedIn(true);
    setLoginFeedback(null);
    setSelectedDetail("");
    setDetailVisible(false);
    setCalendarVisible(false);
    setCalendarDetailVisible(false);
  };

  const handleLogout = async () => {
    try {
      await clearStudentSessionTc();
    } catch (error) {
      console.log("Kayıtlı oturum temizlenemedi:", error);
    }

    setSessionTc("");

    setLoggedIn(false);
    setUser(null);
    setTc("");
    setSelectedDetail("");
    setDetailVisible(false);
    setCalendarVisible(false);
    setCalendarDetailVisible(false);
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

  const processBadge = useMemo(
    () =>
      user ? getProcessBadge(user) : { label: "-", tone: "gray" as BadgeTone },
    [user],
  );

  const documentBadge = useMemo(
    () =>
      user ? getDocumentBadge(user) : { label: "-", tone: "gray" as BadgeTone },
    [user],
  );

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
    if (loginFeedback) return loginFeedback;

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

  const isLoginDisabled =
    restoringSession || loadingStudents || !!fetchError || !students.length;

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
        getLessons(user).length > 0 ||
        user.direksiyon_sonuc === "gecti" ||
        user.direksiyon_sonuc === "kaldi",
      tamamlandi: user.direksiyon_sonuc === "gecti",
    };
  }, [user]);

  const activeStep = useMemo(() => {
    if (!user) return "";
    if (user.direksiyon_sonuc === "gecti") return "tamamlandi";
    if (
      user.durum === "direksiyon" ||
      user.esinav_sonuc === "gecti" ||
      !!user.direksiyon_tarih ||
      !!user.direksiyon_saati
    ) {
      return "direksiyon";
    }
    if (user.evrak_durumu === "tamam") return "esinav";
    return "basvuru";
  }, [user]);

  const calendarEvents = useMemo(() => {
    if (!user) return [];
    return buildCalendarEvents(user);
  }, [user]);

  const visibleMonthCells = useMemo(
    () => buildMonthCells(visibleMonth, calendarEvents),
    [visibleMonth, calendarEvents],
  );

  const missingDocs = useMemo(
    () => getMissingDocumentsList(user?.eksik_evraklar),
    [user],
  );

  const showEsinavPaymentCard = useMemo(() => {
    if (!user) return false;
    if (user.evrak_durumu === "eksik") return false;
    return user.durum === "esinav";
  }, [user]);

  const hasEsinavDebt = useMemo(
    () => (user ? hasDebtValue(getEsinavDebt(user)) : false),
    [user],
  );

  const hasDireksiyonDebt = useMemo(
    () => (user ? hasDebtValue(getDireksiyonDebt(user)) : false),
    [user],
  );

  const hasTaksitDebt = useMemo(
    () => (user ? hasDebtValue(user.taksit_borcu) : false),
    [user],
  );

  const showDireksiyonPaymentCard = useMemo(() => {
    if (!user) return false;
    if (user.evrak_durumu === "eksik") return false;
    return user.durum === "direksiyon" || user.esinav_sonuc === "gecti";
  }, [user]);

  const canOpenCalendar = useMemo(() => {
    if (!user) return false;
    if (user.evrak_durumu === "eksik") return false;
    return true;
  }, [user]);

  const openHarcLink = async () => {
    const isEsinavPhase = user?.durum === "esinav";
    const isDireksiyonPhase =
      !!user && (user.durum === "direksiyon" || user.esinav_sonuc === "gecti");

    if (!user || user.evrak_durumu === "eksik") {
      Alert.alert(
        "Bilgi",
        "Eksik evrak bulunan öğrenciler için ödeme ekranı gösterilmez.",
      );
      return;
    }

    if (isDireksiyonPhase) {
      openDetailModal(
        "Ödeme için kurs tarafından gönderilen SMS'i kontrol edin.",
      );
      return;
    }

    if (!isEsinavPhase) {
      Alert.alert("Bilgi", "Şu an için gösterilecek uygun ödeme bulunmuyor.");
      return;
    }

    try {
      await Linking.openURL("https://odeme.meb.gov.tr");
    } catch {
      Alert.alert("Hata", "Ödeme sayfası açılamadı.");
    }
  };

  const showBasvuruDetay = () => {
    if (!user) return;
    if (user.evrak_durumu === "eksik") {
      openDetailModal(
        missingDocs.length
          ? `Eksik evraklar:\n• ${missingDocs.join("\n• ")}`
          : "Eksik evrak bilgisi henüz eklenmemiş.",
      );
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

    if (user.evrak_durumu !== "tamam") {
      openDetailModal("Önce evraklarınızın tamamlanması gerekiyor.");
      return;
    }

    if (
      user.durum === "direksiyon" ||
      user.esinav_sonuc === "gecti" ||
      !!user.direksiyon_tarih ||
      !!user.direksiyon_saati
    ) {
      openDetailModal("E-sınav aşamasını tamamladınız.");
      return;
    }

    if (user.esinav_harc === "odenmedi") {
      openDetailModal("E-sınav harcınız henüz ödenmemiş görünüyor.");
      return;
    }

    if (user.esinav_harc === "odendi" && !hasFutureExamDate(user)) {
      openDetailModal("Yeni sınav tarihi bekleniyor.");
      return;
    }

    if (hasFutureExamDate(user)) {
      openDetailModal(
        `E-sınav tarihiniz:\n${formatExamText(user.esinav_tarih, user.esinav_saati)}`,
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
    const lessons = getLessons(user);

    if (user.esinav_sonuc !== "gecti" && user.durum !== "direksiyon") {
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
      openDetailModal(
        "Direksiyon sınavında başarılı olamadınız. Yeni sınav süreci için kursun bilgilendirmesini bekleyin.",
      );
      return;
    }

    if (lessons.length) {
      const text = lessons
        .map((lesson, index) => {
          const title = getLessonDisplayTitle(lesson, index);
          const dateText = lesson.tarih || "Tarih bekleniyor";
          const startTime = getLessonStartOnly(lesson);
          const timeText = startTime ? ` / ${startTime}` : "";
          const statusText = getLessonStatusSuffix(lesson);

          return `• ${title}: ${dateText}${timeText}${statusText}`;
        })
        .join("\n");

      openDetailModal(`Direksiyon ders planınız:
${text}`);
      return;
    }

    if (user.direksiyon_tarih) {
      openDetailModal(
        `Direksiyon sınav bilginiz:\n${formatExamText(user.direksiyon_tarih, user.direksiyon_saati)}`,
      );
      return;
    }

    if (user.direksiyon_harc === "odenmedi") {
      openDetailModal(
        "Ödeme için kurs tarafından gönderilen SMS'i kontrol edin.",
      );
      return;
    }

    openDetailModal(
      "Direksiyon dersleri ve sınav tarihi belli olduğunda tarafınıza bilgilendirme yapılacaktır.",
    );
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
    [activeStep, stepStates, user, missingDocs],
  );

  const handleSmartAction = () => {
    if (!user) return;

    if (smartStatus.actionType === "harc") {
      openHarcLink();
      return;
    }

    if (smartStatus.actionType === "detail") {
      if (user.evrak_durumu === "eksik") {
        showBasvuruDetay();
        return;
      }

      if (
        user.durum === "direksiyon" ||
        user.esinav_sonuc === "gecti" ||
        !!user.direksiyon_tarih ||
        !!user.direksiyon_saati
      ) {
        showDireksiyonDetay();
        return;
      }

      if (user.durum === "esinav") {
        showEsinavDetay();
        return;
      }

      showBasvuruDetay();
    }
  };

  const handleCalendarCellPress = (cell: CalendarCell) => {
    if (!cell.events.length) return;
    const detail = cell.events
      .map((event) => {
        const datetime = event.time
          ? `Ders tarihi: ${event.date} `
          : event.date;
        return `• ${event.title}\n${datetime}${event.description ? `\n${event.description}` : ""}`;
      })
      .join("\n\n");

    openCalendarDetailModal(detail);
  };

  const handleCalendarScrollBeginDrag = (event: any) => {
    scrollStartYRef.current = event.nativeEvent.contentOffset.y;
  };

  const handleCalendarScrollEndDrag = (event: any) => {
    const endY = event.nativeEvent.contentOffset.y;
    const diff = endY - scrollStartYRef.current;

    handleCalendarMonthChangeGesture(diff);
  };

  const handleTcInputFocus = () => {
    setTimeout(() => {
      loginScrollRef.current?.scrollTo({ y: 160, animated: true });
    }, 180);
  };

  const resetLoginScroll = () => {
    loginScrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const visibleMonthLabel = `${MONTH_NAMES[visibleMonth.getMonth()]} ${visibleMonth.getFullYear()}`;

  if (!loggedIn || !user) {
    return (
      <>
        <StatusBar
          translucent={false}
          backgroundColor={colors.screenBg}
          barStyle={theme === "dark" ? "light-content" : "dark-content"}
        />
        <KeyboardAvoidingView
          style={[styles.container, { backgroundColor: colors.screenBg }]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            ref={loginScrollRef}
            style={[styles.container, { backgroundColor: colors.screenBg }]}
            contentContainerStyle={styles.loginContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            onContentSizeChange={() => {
              if (!tc) {
                resetLoginScroll();
              }
            }}
          >
            <View style={styles.loginThemeToggleWrap}>
              {themeReady ? (
                <ThemeToggle
                  selectedTheme={theme}
                  onToggle={toggleTheme}
                  colors={colors}
                />
              ) : null}
            </View>

            <View style={styles.loginHero}>
              <Image
                source={LOGIN_LOGO}
                style={styles.loginLogo}
                resizeMode="contain"
              />

              {loadingStudents ? (
                <View style={{ marginTop: 10, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text
                    style={{
                      marginTop: 8,
                      color: colors.mutedText,
                      fontSize: 13,
                      fontWeight: "600",
                    }}
                  >
                    Öğrenci bilgileri yükleniyor...
                  </Text>
                </View>
              ) : null}
            </View>
            <View
              style={[
                styles.loginBox,
                {
                  backgroundColor: colors.cardBg,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.loginTitle, { color: colors.text }]}>
                Öğrenci Girişi
              </Text>
              <Text style={[styles.loginSub, { color: colors.subText }]}>
                TC kimlik numaranız ile giriş yaparak süreç bilgilerinizi
                görüntüleyebilirsiniz.
              </Text>

              {visibleLoginFeedback ? (
                <View
                  style={[
                    styles.loginStatusCard,
                    visibleLoginFeedback.type === "success"
                      ? styles.loginStatusSuccess
                      : visibleLoginFeedback.type === "error"
                        ? styles.loginStatusError
                        : visibleLoginFeedback.type === "warning"
                          ? styles.loginStatusWarning
                          : styles.loginStatusInfo,
                  ]}
                >
                  <Text style={styles.loginStatusTitle}>
                    {visibleLoginFeedback.title}
                  </Text>
                  <Text style={styles.loginStatusText}>
                    {visibleLoginFeedback.message}
                  </Text>
                </View>
              ) : null}

              <TextInput
                placeholder="TC kimlik numaranız"
                placeholderTextColor={colors.mutedText}
                inputMode="numeric"
                keyboardType="numeric"
                showSoftInputOnFocus={true}
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
                maxLength={11}
                value={tc}
                onChangeText={handleTcChange}
                onFocus={handleTcInputFocus}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.inputText,
                  },
                ]}
              />

              <TouchableOpacity
                style={[
                  styles.loginButton,
                  isLoginDisabled ? styles.loginButtonDisabled : null,
                ]}
                onPress={handleLogin}
                disabled={isLoginDisabled}
              >
                <Text style={styles.loginButtonText}>Giriş Yap</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </>
    );
  }

  return (
    <>
      <StatusBar
        translucent={false}
        backgroundColor={colors.screenBg}
        barStyle={theme === "dark" ? "light-content" : "dark-content"}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.screenBg }]}
        contentContainerStyle={styles.content}
      >
        <View
          style={[
            styles.profileCard,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <View style={styles.profileHeader}>
            <View style={styles.profileHeaderLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials || "Ö"}</Text>
              </View>

              <View style={styles.profileTextArea}>
                <Text style={[styles.name, { color: colors.text }]}>
                  {normalizeValue(user.ad_soyad)}
                </Text>
                <Text style={[styles.subName, { color: colors.mutedText }]}>
                  Öğrenci Paneli
                </Text>
              </View>
            </View>

            {themeReady ? (
              <View style={styles.profileThemeToggleWrap}>
                <ThemeToggle
                  selectedTheme={theme}
                  onToggle={toggleTheme}
                  colors={colors}
                />
              </View>
            ) : null}
          </View>
          <View style={styles.chipsRow}>
            <InfoChip label="TC" value={user.tc} colors={colors} />
            <InfoChip label="Sınıf" value={user.sinif || "-"} colors={colors} />
          </View>

          <View style={styles.chipsRow}>
            <InfoChip
              label="Telefon"
              value={formatPhone(user.telefonlar)}
              colors={colors}
            />
            {canOpenCalendar ? (
              <TouchableOpacity
                style={[
                  styles.topCalendarButton,
                  {
                    backgroundColor: colors.cardAltBg,
                    borderColor: colors.border,
                  },
                ]}
                onPress={openCalendarModal}
              >
                <Text style={[styles.topCalendarIcon, { color: colors.text }]}>
                  🗓️
                </Text>
              </TouchableOpacity>
            ) : (
              <View
                style={[
                  styles.topCalendarButtonDisabled,
                  {
                    backgroundColor: colors.cardAltBg,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.topCalendarIconDisabled,
                    { color: colors.mutedText },
                  ]}
                >
                  🗓️
                </Text>
              </View>
            )}
          </View>

          <View style={styles.badgesRow}>
            <StatusBadge label={processBadge.label} tone={processBadge.tone} />
            <StatusBadge
              label={documentBadge.label}
              tone={documentBadge.tone}
            />
          </View>
        </View>
        <View
          style={[
            styles.statusCard,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
            smartStatus.type === "success"
              ? styles.statusSuccess
              : smartStatus.type === "error"
                ? styles.statusError
                : smartStatus.type === "warning"
                  ? styles.statusWarning
                  : smartStatus.type === "info"
                    ? styles.statusInfo
                    : null,
          ]}
        >
          <Text style={[styles.statusTitle, { color: colors.text }]}>
            {smartStatus.title}
          </Text>
          <Text style={[styles.statusDescription, { color: colors.subText }]}>
            {smartStatus.description}
          </Text>

          {smartStatus.actionType && smartStatus.actionType !== "none" ? (
            <TouchableOpacity
              style={styles.mainActionButton}
              onPress={handleSmartAction}
            >
              <Text style={styles.mainActionButtonText}>
                {smartStatus.actionLabel || "Detayı Gör"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Evrak Durumu
          </Text>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.mutedText }]}>
              Durum
            </Text>
            <Text
              style={[
                styles.infoValue,
                styles.infoValueRight,
                { color: colors.text },
              ]}
            >
              {user.evrak_durumu === "tamam"
                ? "Tamamlandı"
                : user.evrak_durumu === "eksik"
                  ? "Eksik"
                  : normalizeValue(user.evrak_durumu)}
            </Text>
          </View>

          <View style={styles.infoRowNoBorder}>
            <Text style={[styles.infoLabel, { color: colors.mutedText }]}>
              Eksik Evraklar
            </Text>

            {user.evrak_durumu === "eksik" && missingDocs.length ? (
              <View style={styles.missingDocsList}>
                {missingDocs.map((item, index) => (
                  <Text
                    key={`${item}-${index}`}
                    style={[styles.missingDocItem, { color: colors.text }]}
                  >
                    • {item}
                  </Text>
                ))}
              </View>
            ) : (
              <Text
                style={[
                  styles.infoValue,
                  styles.infoValueRight,
                  { color: colors.text },
                ]}
              >
                Eksik evrak görünmüyor
              </Text>
            )}
          </View>
        </View>
        {showEsinavPaymentCard || showDireksiyonPaymentCard ? (
          <View
            style={[
              styles.infoCard,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Sınav ve Ödeme Bilgileri
            </Text>

            {showEsinavPaymentCard ? (
              <View
                style={[
                  styles.miniCard,
                  {
                    backgroundColor: colors.cardAltBg,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.miniCardHeader}>
                  <Text style={[styles.miniCardTitle, { color: colors.text }]}>
                    E-sınav
                  </Text>
                  <StatusBadge
                    label={getPaymentBadge(user.esinav_harc).label}
                    tone={getPaymentBadge(user.esinav_harc).tone}
                  />
                </View>

                <Text style={[styles.miniCardText, { color: colors.subText }]}>
                  Tarih:{" "}
                  {hasFutureExamDate(user)
                    ? formatExamText(user.esinav_tarih, user.esinav_saati)
                    : "Yeni sınav tarihi bekleniyor"}
                </Text>
                {user.esinav_tarih ? (
                  <Text
                    style={[styles.miniCardText, { color: colors.subText }]}
                  >
                    Sonuç: {formatOutcome(user.esinav_sonuc)}
                  </Text>
                ) : null}
                <Text style={[styles.miniCardText, { color: colors.subText }]}>
                  Harç durumu: {formatPayment(user.esinav_harc)}
                </Text>
                {hasEsinavDebt ? (
                  <Text
                    style={[styles.miniCardText, { color: colors.subText }]}
                  >
                    Harç borcu: {formatDebt(getEsinavDebt(user))}
                  </Text>
                ) : null}
                {hasEsinavDebt ? (
                  <Text
                    style={[styles.miniCardText, { color: colors.subText }]}
                  >
                    Son ödeme:{" "}
                    {normalizeValue(
                      user.esinav_borc_son_odeme || user.esinav_son_odeme,
                    )}
                  </Text>
                ) : null}

                {user.esinav_harc === "odenmedi" ? (
                  <TouchableOpacity
                    style={styles.inlinePayButton}
                    onPress={openHarcLink}
                  >
                    <Text style={styles.inlinePayButtonText}>
                      E-sınav Harcını Öde
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {showDireksiyonPaymentCard ? (
              <View
                style={[
                  styles.miniCard,
                  {
                    backgroundColor: colors.cardAltBg,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.miniCardHeader}>
                  <Text style={[styles.miniCardTitle, { color: colors.text }]}>
                    Direksiyon
                  </Text>
                  <StatusBadge
                    label={getPaymentBadge(user.direksiyon_harc).label}
                    tone={getPaymentBadge(user.direksiyon_harc).tone}
                  />
                </View>

                <Text style={[styles.miniCardText, { color: colors.subText }]}>
                  Sınav tarihi:{" "}
                  {formatExamText(user.direksiyon_tarih, user.direksiyon_saati)}
                </Text>
                {user.direksiyon_tarih ? (
                  <Text
                    style={[styles.miniCardText, { color: colors.subText }]}
                  >
                    Sonuç: {formatOutcome(user.direksiyon_sonuc)}
                  </Text>
                ) : null}
                <Text style={[styles.miniCardText, { color: colors.subText }]}>
                  Harç durumu: {formatPayment(user.direksiyon_harc)}
                </Text>
                {hasDireksiyonDebt ? (
                  <Text
                    style={[styles.miniCardText, { color: colors.subText }]}
                  >
                    Direksiyon harç borcu: {formatDebt(getDireksiyonDebt(user))}
                  </Text>
                ) : null}
                {hasDireksiyonDebt ? (
                  <Text
                    style={[styles.miniCardText, { color: colors.subText }]}
                  >
                    Direksiyon son ödeme:{" "}
                    {normalizeValue(
                      user.direksiyon_borc_son_odeme ||
                        user.direksiyon_son_odeme,
                    )}
                  </Text>
                ) : null}
                <Text style={[styles.miniCardText, { color: colors.subText }]}>
                  Taksit borcu: {formatDebt(user.taksit_borcu)}
                </Text>
                {hasTaksitDebt ? (
                  <Text
                    style={[styles.miniCardText, { color: colors.subText }]}
                  >
                    Taksit son ödeme: {normalizeValue(user.taksit_son_odeme)}
                  </Text>
                ) : null}

                {user.direksiyon_harc === "odenmedi" ? (
                  <TouchableOpacity
                    style={styles.inlinePayButton}
                    onPress={openHarcLink}
                  >
                    <Text style={styles.inlinePayButtonText}>
                      Ödeme Bilgisi
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
        <View
          style={[
            styles.stepsCard,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Süreç Adımları
          </Text>

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
                colors={colors}
              />
            );
          })}
        </View>
        <TouchableOpacity
          style={[
            styles.logoutButton,
            { backgroundColor: colors.cardAltBg, borderColor: colors.border },
          ]}
          onPress={handleLogout}
        >
          <Text style={[styles.logoutButtonText, { color: colors.text }]}>
            Çıkış Yap
          </Text>
        </TouchableOpacity>
        <View
          style={[
            styles.dataSyncCard,
            {
              backgroundColor: colors.cardBg,
              borderColor: showOfflineDataNotice
                ? colors.accent
                : colors.border,
            },
          ]}
        >
          <View style={styles.dataSyncHeader}>
            <Ionicons
              name={
                showOfflineDataNotice ? "cloud-offline-outline" : "time-outline"
              }
              size={18}
              color={showOfflineDataNotice ? colors.accent : colors.text}
            />
            <Text style={[styles.dataSyncTitle, { color: colors.text }]}>
              Verilerin son güncelleme zamanı
            </Text>
          </View>

          <Text style={[styles.dataSyncValue, { color: colors.text }]}>
            {lastDataUpdateText}
          </Text>

          {showOfflineDataNotice ? (
            <Text style={[styles.dataSyncNote, { color: colors.mutedText }]}>
              İnternet yok veya bağlantı zayıf. Kayıtlı son veriler
              gösteriliyor.
            </Text>
          ) : (
            <Text style={[styles.dataSyncNote, { color: colors.mutedText }]}>
              Veriler kurs tarafından günlük olarak güncellenir.
            </Text>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={detailVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDetailModal}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          onPress={closeDetailModal}
        >
          <Pressable
            style={[
              styles.modalCard,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
            onPress={() => {}}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Detay
            </Text>
            <Text style={[styles.modalText, { color: colors.subText }]}>
              {selectedDetail}
            </Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={closeDetailModal}
            >
              <Text style={styles.modalCloseButtonText}>Kapat</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={calendarVisible}
        transparent
        animationType="slide"
        onRequestClose={closeCalendarModal}
      >
        <View
          style={[
            styles.fullScreenCalendar,
            { backgroundColor: colors.screenBg },
          ]}
        >
          <View
            style={[
              styles.calendarHeader,
              { borderBottomColor: colors.border, borderBottomWidth: 1 },
            ]}
          >
            <Text style={[styles.calendarHeaderTitle, { color: colors.text }]}>
              Takvim
            </Text>
            <TouchableOpacity
              style={[
                styles.calendarHeaderClose,
                {
                  backgroundColor: colors.cardAltBg,
                  borderColor: colors.border,
                },
              ]}
              onPress={closeCalendarModal}
            >
              <Text
                style={[styles.calendarHeaderCloseText, { color: colors.text }]}
              >
                Kapat
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.monthNavigator}>
            <Text style={[styles.monthNavigatorTitle, { color: colors.text }]}>
              {visibleMonthLabel}
            </Text>

            <View style={styles.monthNavButtons}>
              <TouchableOpacity
                style={[
                  styles.monthNavButton,
                  {
                    backgroundColor: colors.cardAltBg,
                    borderColor: colors.border,
                  },
                  !canGoPrev ? styles.monthNavButtonDisabled : null,
                ]}
                onPress={() =>
                  canGoPrev && setMonthOffset((prev) => Math.max(prev - 1, -3))
                }
                disabled={!canGoPrev}
              >
                <Text
                  style={[styles.monthNavButtonText, { color: colors.text }]}
                >
                  ▲
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.monthNavButton,
                  {
                    backgroundColor: colors.cardAltBg,
                    borderColor: colors.border,
                  },
                  !canGoNext ? styles.monthNavButtonDisabled : null,
                ]}
                onPress={() =>
                  canGoNext && setMonthOffset((prev) => Math.min(prev + 1, 2))
                }
                disabled={!canGoNext}
              >
                <Text
                  style={[styles.monthNavButtonText, { color: colors.text }]}
                >
                  ▼
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.calendarLegendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.eventDotRed]} />
              <Text style={[styles.legendText, { color: colors.subText }]}>
                Ödeme
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.eventDotBlue]} />
              <Text style={[styles.legendText, { color: colors.subText }]}>
                E-sınav
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.eventDotOrange]} />
              <Text style={[styles.legendText, { color: colors.subText }]}>
                Direksiyon sınavı
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.eventDotGreen]} />
              <Text style={[styles.legendText, { color: colors.subText }]}>
                Ders
              </Text>
            </View>
          </View>
          <View style={styles.dayNamesRow}>
            {DAY_NAMES.map((dayName) => (
              <Text
                key={dayName}
                style={[styles.dayNameText, { color: colors.text }]}
              >
                {dayName}
              </Text>
            ))}
          </View>

          <ScrollView
            ref={calendarScrollRef}
            style={styles.calendarPageScroll}
            contentContainerStyle={styles.calendarPageContent}
            onScrollBeginDrag={handleCalendarScrollBeginDrag}
            onScrollEndDrag={handleCalendarScrollEndDrag}
            scrollEventThrottle={16}
            {...calendarPanResponder.panHandlers}
          >
            <View style={styles.monthGrid}>
              {visibleMonthCells.map((cell) => {
                const hasEvents = cell.events.length > 0;
                const eventTones = Array.from(
                  new Set(
                    cell.events.map((event) =>
                      getCalendarBadgeTone(event.type),
                    ),
                  ),
                );
                const previewText = hasEvents
                  ? cell.events
                      .slice(0, 2)
                      .map((event) =>
                        event.type === "lesson"
                          ? event.time || ""
                          : event.time
                            ? `${event.title} ${event.time}`
                            : event.title,
                      )
                      .filter(Boolean)
                      .join("\n")
                  : "";

                return (
                  <TouchableOpacity
                    key={cell.key}
                    style={[
                      styles.calendarCell,
                      !cell.isCurrentMonth ? styles.calendarCellMuted : null,
                      cell.isToday ? styles.calendarCellToday : null,
                    ]}
                    activeOpacity={hasEvents ? 0.85 : 1}
                    onPress={() => handleCalendarCellPress(cell)}
                    disabled={!hasEvents}
                  >
                    <View
                      style={[
                        styles.calendarCellDayBadge,
                        cell.isToday
                          ? [
                              styles.calendarCellDayBadgeToday,
                              {
                                backgroundColor:
                                  theme === "light"
                                    ? colors.accentSoft
                                    : "#686868",
                              },
                            ]
                          : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.calendarCellDayText,
                          { color: colors.text },
                          !cell.isCurrentMonth
                            ? [
                                styles.calendarCellDayTextMuted,
                                { color: colors.mutedText },
                              ]
                            : null,
                          cell.isToday ? styles.calendarCellDayTextToday : null,
                        ]}
                      >
                        {cell.dayNumber}
                      </Text>
                    </View>

                    <View style={styles.cellDotsRow}>
                      {eventTones.slice(0, 3).map((tone, idx) => (
                        <View
                          key={`${cell.key}-${tone}-${idx}`}
                          style={[
                            styles.cellDot,
                            tone === "red"
                              ? styles.eventDotRed
                              : tone === "blue"
                                ? styles.eventDotBlue
                                : tone === "orange"
                                  ? styles.eventDotOrange
                                  : styles.eventDotGreen,
                          ]}
                        />
                      ))}
                    </View>

                    <Text
                      style={[
                        styles.calendarCellPreview,
                        { color: colors.subText },
                        !cell.isCurrentMonth
                          ? [
                              styles.calendarCellPreviewMuted,
                              { color: colors.mutedText },
                            ]
                          : null,
                      ]}
                      numberOfLines={2}
                    >
                      {previewText}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <Modal
            visible={calendarDetailVisible}
            transparent
            animationType="fade"
            onRequestClose={closeCalendarDetailModal}
          >
            <Pressable
              style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
              onPress={closeCalendarDetailModal}
            >
              <Pressable
                style={[
                  styles.modalCard,
                  {
                    backgroundColor: colors.cardBg,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => {}}
              >
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Takvim Detayı
                </Text>
                <Text style={[styles.modalText, { color: colors.subText }]}>
                  {calendarSelectedDetail}
                </Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={closeCalendarDetailModal}
                >
                  <Text style={styles.modalCloseButtonText}>Kapat</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d10" },
  content: { padding: 16, paddingBottom: 28 },
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
  loginBox: { top: 10, flex: 1, paddingHorizontal: 18 },
  brand: {
    color: "#c1121f",
    fontSize: 46,
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
  loginButtonDisabled: { opacity: 0.55 },
  loginButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  loginStatusCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    backgroundColor: "#151519",
    borderColor: "#232329",
  },
  loginStatusTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },
  loginContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  loginThemeToggleWrap: {
    marginTop: 22,
    paddingHorizontal: 18,
  },
  loginHero: {
    alignItems: "center",
    marginTop: 12,
  },
  loginLogo: {
    width: 270,
    height: 270,
  },
  loginStatusText: { color: "#d8d8dd", fontSize: 14, lineHeight: 22 },
  loginStatusSuccess: { borderColor: "#1f8f55" },
  loginStatusError: { borderColor: "#a62d2d" },
  loginStatusWarning: { borderColor: "#a67c1a" },
  loginStatusInfo: { borderColor: "#2c6ca6" },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  topBarTitle: { color: "#ffffff", fontSize: 24, fontWeight: "800" },
  topCalendarButton: {
    width: 65,
    height: 65,
    borderRadius: 14,
    backgroundColor: "#151519",
    borderWidth: 1,
    borderColor: "#2a2a31",
    alignItems: "center",
    justifyContent: "center",
  },
  topCalendarButtonDisabled: {
    width: 65,
    height: 65,
    borderRadius: 14,
    backgroundColor: "#151519",
    borderWidth: 1,
    borderColor: "#2a2a31",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.4,
  },
  topCalendarIcon: { fontSize: 40 },
  topCalendarIconDisabled: { fontSize: 40 },
  themeToggle: {
    width: 78,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 3,
    overflow: "hidden",
  },
  themeToggleIcons: {
    position: "absolute",
    left: 2,
    right: 2,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  themeToggleThumb: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  dataSyncCard: {
    marginTop: 14,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
  },
  dataSyncHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  dataSyncTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  dataSyncValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  dataSyncNote: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
  },
  profileCard: {
    marginTop: 20,
    backgroundColor: "#151519",
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#232329",
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  profileHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
  },
  profileThemeToggleWrap: {
    alignSelf: "flex-start",
  },
  profileTextArea: { flex: 1 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#c1121f",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarText: { color: "#ffffff", fontSize: 24, fontWeight: "800" },
  name: { color: "#ffffff", fontSize: 22, fontWeight: "800" },
  subName: { color: "#8f8f97", fontSize: 14, marginTop: 4 },
  chipsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
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
  infoChipValue: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  badgeGreen: { backgroundColor: "#11301f", borderColor: "#1f8f55" },
  badgeRed: { backgroundColor: "#301515", borderColor: "#a62d2d" },
  badgeOrange: { backgroundColor: "#33250f", borderColor: "#a67c1a" },
  badgeBlue: { backgroundColor: "#112536", borderColor: "#2c6ca6" },
  badgeGray: { backgroundColor: "#1d1d23", borderColor: "#34343b" },
  badgeText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  statusCard: {
    backgroundColor: "#151519",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#232329",
  },
  statusSuccess: { borderColor: "#1f8f55" },
  statusError: { borderColor: "#a62d2d" },
  statusWarning: { borderColor: "#a67c1a" },
  statusInfo: { borderColor: "#2c6ca6" },
  statusTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  statusDescription: { color: "#d8d8dd", fontSize: 15, lineHeight: 23 },
  mainActionButton: {
    marginTop: 14,
    backgroundColor: "#c1121f",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  mainActionButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
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
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#26262d",
    paddingBottom: 12,
    marginBottom: 12,
  },
  infoRowNoBorder: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  infoLabel: { color: "#a6a6af", fontSize: 14, fontWeight: "600", flex: 1 },
  infoValue: { color: "#ffffff", fontSize: 14, fontWeight: "700", flex: 1 },
  infoValueRight: { textAlign: "right", lineHeight: 22 },
  missingDocsList: { flex: 1, alignItems: "flex-end", gap: 4 },
  missingDocItem: {
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
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
    gap: 8,
    marginBottom: 10,
  },
  miniCardTitle: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  miniCardText: {
    color: "#d8d8dd",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 4,
  },
  inlinePayButton: {
    marginTop: 10,
    backgroundColor: "#c1121f",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  inlinePayButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  stepsCard: {
    backgroundColor: "#151519",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#232329",
  },
  stepRow: { flexDirection: "row", alignItems: "stretch", minHeight: 58 },
  stepIndicatorColumn: {
    width: 26,
    alignItems: "center",
    position: "relative",
  },
  stepLine: { position: "absolute", width: 2, left: 11, zIndex: 0 },
  stepLineTop: { top: 0, height: 29 },
  stepLineBottom: { top: 29, bottom: 0 },
  stepLineActive: { backgroundColor: "#22c55e" },
  stepLinePassive: { backgroundColor: "#34343b" },
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
  stepCircleChecked: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
  stepCircleActive: {
    backgroundColor: "#22c55e",
    borderColor: "#22c55e",
  },
  stepCircleText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  stepContent: {
    flex: 1,
    justifyContent: "center",
    paddingLeft: 12,
    paddingVertical: 10,
  },
  stepTitle: { color: "#d0d0d6", fontSize: 15, fontWeight: "600" },
  stepTitleChecked: { color: "#ffffff" },
  stepTitleActive: { color: "#ffffff" },
  logoutButton: {
    backgroundColor: "#26262d",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  logoutButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
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
  modalText: { color: "#d8d8dd", fontSize: 15, lineHeight: 24 },
  modalCloseButton: {
    marginTop: 16,
    backgroundColor: "#c1121f",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalCloseButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  fullScreenCalendar: { flex: 1, backgroundColor: "#0d0d10", paddingTop: 56 },
  calendarHeader: {
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  calendarHeaderTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 10,
  },
  calendarHeaderClose: {
    marginBottom: 10,
    backgroundColor: "#1d1d23",
    borderWidth: 1,
    borderColor: "#2a2a31",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  calendarHeaderCloseText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  monthNavigator: {
    paddingHorizontal: 16,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  monthNavigatorTitle: { color: "#ffffff", fontSize: 24, fontWeight: "800" },
  monthNavButtons: { flexDirection: "row", gap: 10 },
  monthNavButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#1d1d23",
    borderWidth: 1,
    borderColor: "#2a2a31",
    alignItems: "center",
    justifyContent: "center",
  },
  monthNavButtonDisabled: { opacity: 0.35 },
  monthNavButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  calendarRangeText: {
    color: "#a0a0a8",
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  dayNamesRow: { flexDirection: "row", paddingHorizontal: 8, marginBottom: 10 },
  dayNameText: {
    top: 5,
    flex: 1,
    textAlign: "center",
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "500",
  },
  calendarLegendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 14,
    marginTop: 5,
    paddingHorizontal: 16,
  },
  legendItem: { top: 5, flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 7 },
  legendText: { color: "#cfd0d6", fontSize: 12, fontWeight: "600" },
  calendarPageScroll: { flex: 1 },
  calendarPageContent: { paddingHorizontal: 8, paddingBottom: 32 },
  monthGrid: { flexDirection: "row", flexWrap: "wrap" },
  calendarCell: { width: "14.2857%", aspectRatio: 0.82, padding: 4 },
  calendarCellMuted: { opacity: 0.38 },
  calendarCellToday: { opacity: 1 },
  calendarCellDayBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  calendarCellDayBadgeToday: { backgroundColor: "#686868" },
  calendarCellDayText: { color: "#ffffff", fontSize: 22, fontWeight: "500" },
  calendarCellDayTextMuted: { color: "#8a8a90" },
  calendarCellDayTextToday: { color: "#ffffff", fontWeight: "800" },
  cellDotsRow: {
    minHeight: 18,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    marginBottom: 5,
  },
  cellDot: { width: 9, height: 9, borderRadius: 5 },
  eventDotRed: { backgroundColor: "#c1121f" },
  eventDotBlue: { backgroundColor: "#2c6ca6" },
  eventDotOrange: { backgroundColor: "#c98819" },
  eventDotGreen: { backgroundColor: "#1f8f55" },
  calendarCellPreview: {
    color: "#f2f2f5",
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
    paddingHorizontal: 1,
    fontWeight: "800",
  },
  calendarCellPreviewMuted: { color: "#707078" },
});
