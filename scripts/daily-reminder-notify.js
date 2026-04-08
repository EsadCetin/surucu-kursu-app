const {
  STUDENTS_PATH,
  STATE_PATH,
  readJson,
  writeJson,
  getDayDiff,
  normalizeDebt,
  getStateRecord,
  sendNotificationToStudent,
} = require("./push-shared");

function buildReminderKey(type, date) {
  return `${type}:${date}`;
}

async function sendReminderIfNeeded(
  stateRecord,
  student,
  reminderType,
  targetDate,
  payload,
) {
  if (!targetDate) return;
  if (getDayDiff(targetDate) !== 1) return;

  const key = buildReminderKey(reminderType, targetDate);
  if (stateRecord.reminders[key]) return;

  await sendNotificationToStudent(student, payload);
  stateRecord.reminders[key] = new Date().toISOString();
}

async function main() {
  const students = readJson(STUDENTS_PATH, []);
  const state = readJson(STATE_PATH, {});

  for (const student of students) {
    const stateRecord = getStateRecord(state, student.tc);

    await sendReminderIfNeeded(
      stateRecord,
      student,
      "esinav_1gun",
      student.esinav_tarih,
      {
        title: "Yarın e-sınavınız var",
        body: student.esinav_saati
          ? `Saat: ${student.esinav_saati}`
          : "Saat bilgisi için uygulamayı açın.",
        data: { route: "/" },
      },
    );

    await sendReminderIfNeeded(
      stateRecord,
      student,
      "direksiyon_1gun",
      student.direksiyon_tarih,
      {
        title: "Yarın direksiyon sınavınız var",
        body: student.direksiyon_saati
          ? `Saat: ${student.direksiyon_saati}`
          : "Saat bilgisi için uygulamayı açın.",
        data: { route: "/" },
      },
    );

    if (normalizeDebt(student.esinav_harc_borcu || student.esinav_harc_borc)) {
      await sendReminderIfNeeded(
        stateRecord,
        student,
        "esinav_odeme_1gun",
        student.esinav_borc_son_odeme,
        {
          title: "E-sınav ödeme tarihine 1 gün kaldı",
          body: "Ödemenizi geciktirmeyin.",
          data: { route: "/" },
        },
      );
    }

    if (
      normalizeDebt(
        student.direksiyon_harc_borcu || student.direksiyon_harc_borc,
      )
    ) {
      await sendReminderIfNeeded(
        stateRecord,
        student,
        "direksiyon_odeme_1gun",
        student.direksiyon_borc_son_odeme,
        {
          title: "Direksiyon ödeme tarihine 1 gün kaldı",
          body: "Ödemenizi geciktirmeyin.",
          data: { route: "/" },
        },
      );
    }

    if (normalizeDebt(student.taksit_borcu)) {
      await sendReminderIfNeeded(
        stateRecord,
        student,
        "taksit_odeme_1gun",
        student.taksit_son_odeme,
        {
          title: "Taksit ödeme tarihine 1 gün kaldı",
          body: "Ödemenizi geciktirmeyin.",
          data: { route: "/" },
        },
      );
    }
  }

  writeJson(STATE_PATH, state);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
