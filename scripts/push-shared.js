const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const STUDENTS_PATH = path.join(process.cwd(), "docs", "students.json");
const STATE_PATH = path.join(process.cwd(), "docs", "notification_state.json");

function readJson(filePath, fallback = {}) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return fallback;
  return JSON.parse(raw);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function readPreviousStudentsFromGit() {
  try {
    const raw = execSync("git show HEAD^:docs/students.json", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseAppDate(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).trim().split(".");
  if (parts.length !== 3) return null;

  const day = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const year = Number(parts[2]);

  const date = new Date(Date.UTC(year, month, day));
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function getTodayUtcDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function getDayDiff(dateStr) {
  const target = parseAppDate(dateStr);
  if (!target) return null;

  const today = getTodayUtcDate();
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function normalizeValue(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeDebt(value) {
  const normalized = normalizeValue(value);
  if (!normalized) return "";
  if (normalized.toLocaleLowerCase("tr-TR") === "yok") return "";
  return normalized;
}

function buildStage(student) {
  if (!student) return "";
  if (student.direksiyon_sonuc === "gecti") return "tamamlandi";
  if (
    student.durum === "direksiyon" ||
    student.esinav_sonuc === "gecti" ||
    student.direksiyon_tarih ||
    student.direksiyon_saati
  ) {
    return "direksiyon";
  }
  if (student.evrak_durumu === "tamam") return "esinav";
  return "basvuru";
}

function createNotificationStateRecord() {
  return {
    hashes: {},
    reminders: {},
  };
}

function getStateRecord(state, tc) {
  if (!state[tc]) {
    state[tc] = createNotificationStateRecord();
  }

  if (!state[tc].hashes) state[tc].hashes = {};
  if (!state[tc].reminders) state[tc].reminders = {};
  return state[tc];
}

function updateStudentBaseline(stateRecord, student) {
  stateRecord.hashes.esinav_tarih = `${normalizeValue(student.esinav_tarih)}|${normalizeValue(student.esinav_saati)}`;
  stateRecord.hashes.direksiyon_tarih = `${normalizeValue(student.direksiyon_tarih)}|${normalizeValue(student.direksiyon_saati)}`;
  stateRecord.hashes.esinav_borc = `${normalizeDebt(student.esinav_harc_borcu || student.esinav_harc_borc)}|${normalizeValue(student.esinav_borc_son_odeme)}`;
  stateRecord.hashes.direksiyon_borc = `${normalizeDebt(student.direksiyon_harc_borcu || student.direksiyon_harc_borc)}|${normalizeValue(student.direksiyon_borc_son_odeme)}`;
  stateRecord.hashes.taksit_borc = `${normalizeDebt(student.taksit_borcu)}|${normalizeValue(student.taksit_son_odeme)}`;
  stateRecord.hashes.esinav_son_odeme = normalizeValue(student.esinav_borc_son_odeme);
  stateRecord.hashes.direksiyon_son_odeme = normalizeValue(student.direksiyon_borc_son_odeme);
  stateRecord.hashes.taksit_son_odeme = normalizeValue(student.taksit_son_odeme);
  stateRecord.hashes.stage = buildStage(student);
  stateRecord.hashes.evrak_durumu = normalizeValue(student.evrak_durumu);
}

async function sendNotificationToStudent(student, payload) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    throw new Error("ONESIGNAL_APP_ID veya ONESIGNAL_REST_API_KEY secret tanımlı değil.");
  }

  if (!student?.tc) {
    console.log("[skip] external_id yok");
    return { skipped: true };
  }

  const response = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      target_channel: "push",
      include_aliases: {
        external_id: [String(student.tc)],
      },
      headings: {
        tr: payload.title,
        en: payload.title,
      },
      contents: {
        tr: payload.body,
        en: payload.body,
      },
      data: payload.data || { route: "/" },
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`OneSignal API hatası: ${response.status} ${JSON.stringify(data)}`);
  }

  console.log(`[onesignal] ${student.tc} -> ${payload.title}`);
  return data;
}

module.exports = {
  STUDENTS_PATH,
  STATE_PATH,
  readJson,
  writeJson,
  readPreviousStudentsFromGit,
  parseAppDate,
  getDayDiff,
  normalizeValue,
  normalizeDebt,
  buildStage,
  getStateRecord,
  updateStudentBaseline,
  sendNotificationToStudent,
};
