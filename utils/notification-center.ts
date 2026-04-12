import AsyncStorage from "@react-native-async-storage/async-storage";

export type LessonItem = {
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

export type Student = {
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

export type AppNotificationType =
  | "missing-documents"
  | "payment-due"
  | "payment-overdue"
  | "lesson-tomorrow"
  | "exam-today"
  | "new-lessons"
  | "lesson-plan-changed";

export type AppNotificationItem = {
  id: string;
  studentTc: string;
  type: AppNotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  sourceKey: string;
};

type StudentNotificationSnapshot = {
  missingDocumentsKey: string;
  paymentKey: string;
  overduePaymentKey: string;
  tomorrowLessonKey: string;
  todayExamKey: string;
  lessonPlanKey: string;
  plannedLessonScheduleKey: string;
  lessonCount: number;
};

export type NotificationSummary = {
  unreadCount: number;
  totalCount: number;
  items: AppNotificationItem[];
};

const STORAGE_KEY = "app_notification_center_v1";
const SNAPSHOT_STORAGE_KEY = "app_notification_snapshot_v1";
const MAX_NOTIFICATIONS = 60;

function normalizeValue(value?: string | null) {
  if (!value) return "";
  return String(value).trim();
}

function normalizeLower(value?: string | null) {
  return normalizeValue(value).toLocaleLowerCase("tr-TR");
}

function formatDebt(value?: string) {
  const normalized = normalizeValue(value);
  return normalized || "Yok";
}

function hasDebtValue(value?: string) {
  return formatDebt(value).toLocaleLowerCase("tr-TR") !== "yok";
}

function getEsinavDebt(user: Student) {
  return user.esinav_harc_borcu || user.esinav_harc_borc || "";
}

function getDireksiyonDebt(user: Student) {
  return user.direksiyon_harc_borcu || user.direksiyon_harc_borc || "";
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

function parseAppDate(dateStr?: string) {
  if (!dateStr) return null;

  const normalized = dateStr.trim();
  const parts = normalized.split(".");
  if (parts.length !== 3) return null;

  const day = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const year = Number(parts[2]);

  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return null;

  date.setHours(0, 0, 0, 0);
  return date;
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

function isTodayDate(dateStr?: string) {
  return getDaysDiffFromToday(dateStr) === 0;
}

function isTomorrowDate(dateStr?: string) {
  return getDaysDiffFromToday(dateStr) === 1;
}

function isUpcomingPaymentDate(dateStr?: string, maxDays = 3) {
  const diff = getDaysDiffFromToday(dateStr);
  return diff !== null ? diff >= 0 && diff <= maxDays : false;
}

function isOverduePaymentDate(dateStr?: string) {
  const diff = getDaysDiffFromToday(dateStr);
  return diff !== null ? diff < 0 : false;
}

function isLessonConfirmed(lesson?: LessonItem) {
  if (!lesson) return false;

  const durum = normalizeLower(lesson.durum);
  const katilim = normalizeLower(lesson.katilim);

  if (katilim === "katildi" || katilim === "katilmadi") {
    return false;
  }

  return Boolean(lesson.teyitli_mi) || durum === "teyitli";
}

function isLessonAttended(lesson?: LessonItem) {
  if (!lesson) return false;

  const durum = normalizeLower(lesson.durum);
  const katilim = normalizeLower(lesson.katilim);

  return katilim === "katildi" || durum === "katildi";
}

function isLessonMissed(lesson?: LessonItem) {
  if (!lesson) return false;

  const durum = normalizeLower(lesson.durum);
  const katilim = normalizeLower(lesson.katilim);

  return katilim === "katilmadi" || durum === "katilmadi";
}

function getNearestTomorrowConfirmedLesson(user: Student) {
  return getLessons(user)
    .filter(
      (lesson) => isTomorrowDate(lesson.tarih) && isLessonConfirmed(lesson),
    )
    .sort((a, b) => {
      const first = `${a.tarih || ""} ${a.saat || ""}`;
      const second = `${b.tarih || ""} ${b.saat || ""}`;
      return first.localeCompare(second, "tr");
    })[0];
}

function buildLessonPlanKey(user: Student) {
  return getLessons(user)
    .map((lesson, index) => {
      return [
        index,
        normalizeValue(lesson.tarih),
        normalizeValue(lesson.saat),
        normalizeLower(lesson.durum),
        normalizeLower(lesson.katilim),
        lesson.teyitli_mi ? "1" : "0",
        normalizeValue(lesson.not),
        normalizeValue(lesson.egitmen),
        normalizeValue(lesson.arac_plaka),
      ].join(":");
    })
    .join("|");
}

function isPendingPlannedLesson(lesson?: LessonItem) {
  if (!lesson) return false;
  if (
    isLessonAttended(lesson) ||
    isLessonMissed(lesson) ||
    isLessonConfirmed(lesson)
  ) {
    return false;
  }

  return normalizeLower(lesson.durum) === "planlandi";
}

function buildPendingPlannedLessonScheduleKey(user: Student) {
  return getLessons(user)
    .map((lesson, index) => ({ lesson, index }))
    .filter(({ lesson }) => isPendingPlannedLesson(lesson))
    .map(({ lesson, index }) => {
      return [
        index,
        normalizeValue(lesson.tarih),
        normalizeValue(lesson.saat),
      ].join(":");
    })
    .join("|");
}

function buildUpcomingPaymentEntries(user: Student) {
  const entries: Array<{
    key: string;
    label: string;
    date?: string;
    debt?: string;
  }> = [];

  if (
    hasDebtValue(getEsinavDebt(user)) &&
    isUpcomingPaymentDate(user.esinav_borc_son_odeme || user.esinav_son_odeme)
  ) {
    entries.push({
      key: `esinav:${user.esinav_borc_son_odeme || user.esinav_son_odeme}:${formatDebt(getEsinavDebt(user))}`,
      label: "E-sınav harcı",
      date: user.esinav_borc_son_odeme || user.esinav_son_odeme,
      debt: formatDebt(getEsinavDebt(user)),
    });
  }

  if (
    hasDebtValue(getDireksiyonDebt(user)) &&
    isUpcomingPaymentDate(
      user.direksiyon_borc_son_odeme || user.direksiyon_son_odeme,
    )
  ) {
    entries.push({
      key: `direksiyon:${user.direksiyon_borc_son_odeme || user.direksiyon_son_odeme}:${formatDebt(getDireksiyonDebt(user))}`,
      label: "Direksiyon harcı",
      date: user.direksiyon_borc_son_odeme || user.direksiyon_son_odeme,
      debt: formatDebt(getDireksiyonDebt(user)),
    });
  }

  if (
    hasDebtValue(user.taksit_borcu) &&
    isUpcomingPaymentDate(user.taksit_son_odeme)
  ) {
    entries.push({
      key: `taksit:${user.taksit_son_odeme}:${formatDebt(user.taksit_borcu)}`,
      label: "Taksit ödemesi",
      date: user.taksit_son_odeme,
      debt: formatDebt(user.taksit_borcu),
    });
  }

  return entries;
}

function buildOverduePaymentEntries(user: Student) {
  const entries: Array<{
    key: string;
    label: string;
    date?: string;
    debt?: string;
  }> = [];

  if (
    hasDebtValue(getEsinavDebt(user)) &&
    isOverduePaymentDate(user.esinav_borc_son_odeme || user.esinav_son_odeme)
  ) {
    entries.push({
      key: `esinav:${user.esinav_borc_son_odeme || user.esinav_son_odeme}:${formatDebt(getEsinavDebt(user))}`,
      label: "E-sınav harcı",
      date: user.esinav_borc_son_odeme || user.esinav_son_odeme,
      debt: formatDebt(getEsinavDebt(user)),
    });
  }

  if (
    hasDebtValue(getDireksiyonDebt(user)) &&
    isOverduePaymentDate(
      user.direksiyon_borc_son_odeme || user.direksiyon_son_odeme,
    )
  ) {
    entries.push({
      key: `direksiyon:${user.direksiyon_borc_son_odeme || user.direksiyon_son_odeme}:${formatDebt(getDireksiyonDebt(user))}`,
      label: "Direksiyon harcı",
      date: user.direksiyon_borc_son_odeme || user.direksiyon_son_odeme,
      debt: formatDebt(getDireksiyonDebt(user)),
    });
  }

  if (
    hasDebtValue(user.taksit_borcu) &&
    isOverduePaymentDate(user.taksit_son_odeme)
  ) {
    entries.push({
      key: `taksit:${user.taksit_son_odeme}:${formatDebt(user.taksit_borcu)}`,
      label: "Taksit ödemesi",
      date: user.taksit_son_odeme,
      debt: formatDebt(user.taksit_borcu),
    });
  }

  return entries;
}

async function readNotifications() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [] as AppNotificationItem[];

  try {
    const parsed = JSON.parse(raw) as AppNotificationItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.id === "string");
  } catch {
    return [];
  }
}

async function writeNotifications(items: AppNotificationItem[]) {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(items.slice(0, MAX_NOTIFICATIONS)),
  );
}

async function readSnapshots() {
  const raw = await AsyncStorage.getItem(SNAPSHOT_STORAGE_KEY);
  if (!raw) return {} as Record<string, StudentNotificationSnapshot>;

  try {
    const parsed = JSON.parse(raw) as Record<
      string,
      StudentNotificationSnapshot
    >;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {} as Record<string, StudentNotificationSnapshot>;
  }
}

async function writeSnapshots(
  data: Record<string, StudentNotificationSnapshot>,
) {
  await AsyncStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(data));
}

async function pushNotification(item: AppNotificationItem) {
  const items = await readNotifications();
  const exists = items.some((entry) => entry.id === item.id);

  if (exists) return;
  await writeNotifications([item, ...items]);
}

function buildNotificationId(
  studentTc: string,
  type: AppNotificationType,
  sourceKey: string,
) {
  return `${studentTc}:${type}:${sourceKey}`;
}

export async function syncStudentNotifications(
  user: Student,
): Promise<NotificationSummary> {
  const snapshots = await readSnapshots();

  const prev = snapshots[user.tc] || {
    missingDocumentsKey: "",
    paymentKey: "",
    overduePaymentKey: "",
    tomorrowLessonKey: "",
    todayExamKey: "",
    lessonPlanKey: "",
    plannedLessonScheduleKey: "",
    lessonCount: 0,
  };

  const now = new Date().toISOString();

  const missingDocs = getMissingDocumentsList(user.eksik_evraklar);
  const currentMissingDocumentsKey = `${user.evrak_durumu}:${missingDocs.join("|")}`;

  if (user.evrak_durumu === "eksik" && missingDocs.length > 0) {
    if (prev.missingDocumentsKey !== currentMissingDocumentsKey) {
      await pushNotification({
        id: buildNotificationId(
          user.tc,
          "missing-documents",
          currentMissingDocumentsKey,
        ),
        studentTc: user.tc,
        type: "missing-documents",
        title: "Eksik evrakın var",
        message: `Eksik evraklar: ${missingDocs.join(", ")}`,
        createdAt: now,
        read: false,
        sourceKey: currentMissingDocumentsKey,
      });
    }
  }

  const upcomingPaymentEntries = buildUpcomingPaymentEntries(user);
  const currentPaymentKey = upcomingPaymentEntries
    .map((entry) => entry.key)
    .join("|");

  if (
    upcomingPaymentEntries.length > 0 &&
    prev.paymentKey !== currentPaymentKey
  ) {
    const firstEntry = upcomingPaymentEntries[0];

    await pushNotification({
      id: buildNotificationId(user.tc, "payment-due", currentPaymentKey),
      studentTc: user.tc,
      type: "payment-due",
      title: "Yaklaşan ödeme var",
      message: `${firstEntry.label} için son ödeme tarihi ${firstEntry.date}. Borç: ${firstEntry.debt}`,
      createdAt: now,
      read: false,
      sourceKey: currentPaymentKey,
    });
  }

  const overduePaymentEntries = buildOverduePaymentEntries(user);
  const currentOverduePaymentKey = overduePaymentEntries
    .map((entry) => entry.key)
    .join("|");

  if (
    overduePaymentEntries.length > 0 &&
    prev.overduePaymentKey !== currentOverduePaymentKey
  ) {
    const firstEntry = overduePaymentEntries[0];

    await pushNotification({
      id: buildNotificationId(
        user.tc,
        "payment-overdue",
        currentOverduePaymentKey,
      ),
      studentTc: user.tc,
      type: "payment-overdue",
      title: "Gecikmiş ödemeniz bulunmaktadır",
      message: `${firstEntry.label} için son ödeme tarihi geçti: ${firstEntry.date}. Borç: ${firstEntry.debt}`,
      createdAt: now,
      read: false,
      sourceKey: currentOverduePaymentKey,
    });
  }

  const tomorrowLesson = getNearestTomorrowConfirmedLesson(user);
  const currentTomorrowLessonKey = tomorrowLesson
    ? `${tomorrowLesson.tarih || ""}:${tomorrowLesson.saat || ""}`
    : "";

  if (tomorrowLesson && prev.tomorrowLessonKey !== currentTomorrowLessonKey) {
    await pushNotification({
      id: buildNotificationId(
        user.tc,
        "lesson-tomorrow",
        currentTomorrowLessonKey,
      ),
      studentTc: user.tc,
      type: "lesson-tomorrow",
      title: "Yarın direksiyon dersin var",
      message: `${tomorrowLesson.tarih || "Tarih bekleniyor"}${tomorrowLesson.saat ? ` / ${tomorrowLesson.saat}` : ""}`,
      createdAt: now,
      read: false,
      sourceKey: currentTomorrowLessonKey,
    });
  }

  const currentTodayExamKey = isTodayDate(user.esinav_tarih)
    ? `${user.esinav_tarih}:${user.esinav_saati || ""}`
    : "";

  if (currentTodayExamKey && prev.todayExamKey !== currentTodayExamKey) {
    await pushNotification({
      id: buildNotificationId(user.tc, "exam-today", currentTodayExamKey),
      studentTc: user.tc,
      type: "exam-today",
      title: "Bugün sınavın var",
      message: `E-sınav bilgisi: ${user.esinav_tarih}${user.esinav_saati ? ` / ${user.esinav_saati}` : ""}`,
      createdAt: now,
      read: false,
      sourceKey: currentTodayExamKey,
    });
  }

  const lessons = getLessons(user);
  const currentLessonPlanKey = buildLessonPlanKey(user);
  const currentPlannedLessonScheduleKey =
    buildPendingPlannedLessonScheduleKey(user);

  if (lessons.length > prev.lessonCount && prev.lessonCount > 0) {
    const sourceKey = `${prev.lessonCount}->${lessons.length}:${currentLessonPlanKey}`;

    await pushNotification({
      id: buildNotificationId(user.tc, "new-lessons", sourceKey),
      studentTc: user.tc,
      type: "new-lessons",
      title: "Yeni ders planı yapıldı",
      message: `Direksiyon dersi sayın ${prev.lessonCount} iken ${lessons.length} oldu.`,
      createdAt: now,
      read: false,
      sourceKey,
    });
  } else if (
    prev.lessonCount > 0 &&
    lessons.length === prev.lessonCount &&
    prev.plannedLessonScheduleKey &&
    prev.plannedLessonScheduleKey !== currentPlannedLessonScheduleKey
  ) {
    await pushNotification({
      id: buildNotificationId(
        user.tc,
        "lesson-plan-changed",
        `planned:${currentPlannedLessonScheduleKey}`,
      ),
      studentTc: user.tc,
      type: "lesson-plan-changed",
      title: "Ders planın güncellendi",
      message:
        "Planlanan direksiyon dersinin gün veya saat bilgisi güncellendi.",
      createdAt: now,
      read: false,
      sourceKey: `planned:${currentPlannedLessonScheduleKey}`,
    });
  } else if (
    prev.lessonCount > 0 &&
    lessons.length === prev.lessonCount &&
    prev.lessonPlanKey &&
    prev.lessonPlanKey !== currentLessonPlanKey
  ) {
    await pushNotification({
      id: buildNotificationId(
        user.tc,
        "lesson-plan-changed",
        currentLessonPlanKey,
      ),
      studentTc: user.tc,
      type: "lesson-plan-changed",
      title: "Ders planın güncellendi",
      message: "Direksiyon ders planındaki bilgiler güncellendi.",
      createdAt: now,
      read: false,
      sourceKey: currentLessonPlanKey,
    });
  }

  snapshots[user.tc] = {
    missingDocumentsKey: currentMissingDocumentsKey,
    paymentKey: currentPaymentKey,
    overduePaymentKey: currentOverduePaymentKey,
    tomorrowLessonKey: currentTomorrowLessonKey,
    todayExamKey: currentTodayExamKey,
    lessonPlanKey: currentLessonPlanKey,
    plannedLessonScheduleKey: currentPlannedLessonScheduleKey,
    lessonCount: lessons.length,
  };

  await writeSnapshots(snapshots);

  return getNotificationSummary(user.tc);
}

export const syncStudentNotificationState = syncStudentNotifications;

export async function getNotificationSummary(
  studentTc?: string,
): Promise<NotificationSummary> {
  const items = await readNotifications();
  const filtered = studentTc
    ? items.filter((item) => item.studentTc === studentTc)
    : items;

  return {
    unreadCount: filtered.filter((item) => !item.read).length,
    totalCount: filtered.length,
    items: filtered,
  };
}

export async function markNotificationAsRead(id: string) {
  const items = await readNotifications();
  const nextItems = items.map((item) =>
    item.id === id ? { ...item, read: true } : item,
  );
  await writeNotifications(nextItems);
}

export async function markAllNotificationsAsRead(studentTc?: string) {
  const items = await readNotifications();
  const nextItems = items.map((item) =>
    !studentTc || item.studentTc === studentTc ? { ...item, read: true } : item,
  );
  await writeNotifications(nextItems);
}

export async function clearNotificationCenter(studentTc?: string) {
  const items = await readNotifications();
  const nextItems = studentTc
    ? items.filter((item) => item.studentTc !== studentTc)
    : [];
  await writeNotifications(nextItems);
}
