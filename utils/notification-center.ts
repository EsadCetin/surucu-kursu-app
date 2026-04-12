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
  | "lesson-tomorrow"
  | "exam-today"
  | "new-lessons";

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
  tomorrowLessonKey: string;
  todayExamKey: string;
  lessonCount: number;
};

const STORAGE_KEY = "app_notification_center_v1";
const SNAPSHOT_STORAGE_KEY = "app_notification_snapshot_v1";
const MAX_NOTIFICATIONS = 60;

function normalizeValue(value?: string | null) {
  if (!value) return "";
  return String(value).trim();
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

function getNearestTomorrowLesson(user: Student) {
  return getLessons(user)
    .filter((lesson) => isTomorrowDate(lesson.tarih))
    .sort((a, b) => {
      const first = `${a.tarih || ""} ${a.saat || ""}`;
      const second = `${b.tarih || ""} ${b.saat || ""}`;
      return first.localeCompare(second, "tr");
    })[0];
}

function buildPaymentEntries(user: Student) {
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
    return {};
  }
}

async function writeSnapshots(
  value: Record<string, StudentNotificationSnapshot>,
) {
  await AsyncStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(value));
}

async function addNotification(
  item: Omit<AppNotificationItem, "id" | "createdAt" | "read">,
) {
  const existing = await readNotifications();
  const duplicate = existing.find(
    (entry) =>
      entry.studentTc === item.studentTc && entry.sourceKey === item.sourceKey,
  );

  if (duplicate) {
    return existing;
  }

  const created: AppNotificationItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    read: false,
  };

  const nextItems = [created, ...existing].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  await writeNotifications(nextItems);
  return nextItems;
}

function buildSnapshot(user: Student): StudentNotificationSnapshot {
  const missingDocuments = getMissingDocumentsList(user.eksik_evraklar).join(
    "|",
  );
  const paymentKey = buildPaymentEntries(user)
    .map((entry) => entry.key)
    .join("||");
  const tomorrowLesson = getNearestTomorrowLesson(user);
  const examKeys = [
    isTodayDate(user.esinav_tarih)
      ? `esinav:${user.esinav_tarih}:${normalizeValue(user.esinav_saati)}`
      : "",
    isTodayDate(user.direksiyon_tarih)
      ? `direksiyon:${user.direksiyon_tarih}:${normalizeValue(user.direksiyon_saati)}`
      : "",
  ]
    .filter(Boolean)
    .join("||");

  return {
    missingDocumentsKey:
      user.evrak_durumu === "eksik" ? `eksik:${missingDocuments}` : "",
    paymentKey,
    tomorrowLessonKey: tomorrowLesson
      ? `${tomorrowLesson.tarih || ""}:${normalizeValue(tomorrowLesson.saat)}:${normalizeValue(tomorrowLesson.not)}`
      : "",
    todayExamKey: examKeys,
    lessonCount: getLessons(user).length,
  };
}

export async function syncStudentNotificationState(user: Student) {
  const snapshots = await readSnapshots();
  const previous = snapshots[user.tc];
  const nextSnapshot = buildSnapshot(user);

  if (
    nextSnapshot.missingDocumentsKey &&
    previous?.missingDocumentsKey !== nextSnapshot.missingDocumentsKey
  ) {
    const missingDocs = getMissingDocumentsList(user.eksik_evraklar);
    await addNotification({
      studentTc: user.tc,
      type: "missing-documents",
      title: "Eksik evrak uyarısı",
      message: missingDocs.length
        ? `Eksik evrakların: ${missingDocs.join(", ")}`
        : "Eksik evrakların bulunuyor. Kursla iletişime geçmen gerekiyor.",
      sourceKey: `missing:${nextSnapshot.missingDocumentsKey}`,
    });
  }

  const paymentEntries = buildPaymentEntries(user);
  for (const entry of paymentEntries) {
    const sourceKey = `payment:${entry.key}`;
    await addNotification({
      studentTc: user.tc,
      type: "payment-due",
      title: "Yaklaşan ödeme var",
      message: `${entry.label} için son ödeme tarihi ${entry.date}. Borç: ${entry.debt}.`,
      sourceKey,
    });
  }

  const tomorrowLesson = getNearestTomorrowLesson(user);
  if (
    tomorrowLesson &&
    previous?.tomorrowLessonKey !== nextSnapshot.tomorrowLessonKey
  ) {
    await addNotification({
      studentTc: user.tc,
      type: "lesson-tomorrow",
      title: "Yarın direksiyon dersin var",
      message: `${tomorrowLesson.tarih} tarihinde${tomorrowLesson.saat ? ` ${tomorrowLesson.saat}` : ""} için direksiyon dersi planlandı.`,
      sourceKey: `lesson-tomorrow:${nextSnapshot.tomorrowLessonKey}`,
    });
  }

  if (
    nextSnapshot.todayExamKey &&
    previous?.todayExamKey !== nextSnapshot.todayExamKey
  ) {
    const todayExamMessages: string[] = [];

    if (isTodayDate(user.esinav_tarih)) {
      todayExamMessages.push(
        `Bugün e-sınavın var${user.esinav_saati ? ` (${user.esinav_saati})` : ""}.`,
      );
    }

    if (isTodayDate(user.direksiyon_tarih)) {
      todayExamMessages.push(
        `Bugün direksiyon sınavın var${user.direksiyon_saati ? ` (${user.direksiyon_saati})` : ""}.`,
      );
    }

    await addNotification({
      studentTc: user.tc,
      type: "exam-today",
      title: "Bugünkü sınav bilgilendirmesi",
      message: todayExamMessages.join(" "),
      sourceKey: `exam-today:${nextSnapshot.todayExamKey}`,
    });
  }

  if (
    typeof previous?.lessonCount === "number" &&
    nextSnapshot.lessonCount > previous.lessonCount
  ) {
    const newCount = nextSnapshot.lessonCount - previous.lessonCount;
    await addNotification({
      studentTc: user.tc,
      type: "new-lessons",
      title: "Yeni direksiyon dersi planlandı",
      message:
        newCount === 1
          ? "Takvimine 1 yeni direksiyon dersi eklendi."
          : `Takvimine ${newCount} yeni direksiyon dersi eklendi.`,
      sourceKey: `new-lessons:${user.tc}:${nextSnapshot.lessonCount}`,
    });
  }

  snapshots[user.tc] = nextSnapshot;
  await writeSnapshots(snapshots);
  return getNotificationSummary(user.tc);
}

export async function getNotificationSummary(studentTc?: string) {
  const items = await readNotifications();
  const filtered = studentTc
    ? items.filter((item) => item.studentTc === studentTc)
    : items;

  return {
    items: filtered,
    unreadCount: filtered.filter((item) => !item.read).length,
  };
}

export async function markNotificationAsRead(id: string) {
  const items = await readNotifications();
  const nextItems = items.map((item) =>
    item.id === id ? { ...item, read: true } : item,
  );
  await writeNotifications(nextItems);
  return nextItems;
}

export async function markAllNotificationsAsRead(studentTc?: string) {
  const items = await readNotifications();
  const nextItems = items.map((item) =>
    !studentTc || item.studentTc === studentTc ? { ...item, read: true } : item,
  );
  await writeNotifications(nextItems);
  return nextItems;
}

export async function clearNotificationCenter(studentTc?: string) {
  if (!studentTc) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }

  const items = await readNotifications();
  await writeNotifications(
    items.filter((item) => item.studentTc !== studentTc),
  );
}
