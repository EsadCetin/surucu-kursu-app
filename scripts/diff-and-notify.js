const {
  STUDENTS_PATH,
  STATE_PATH,
  readJson,
  writeJson,
  readPreviousStudentsFromGit,
  normalizeValue,
  normalizeDebt,
  buildStage,
  getStateRecord,
  updateStudentBaseline,
  sendNotificationToStudent,
} = require("./push-shared");

function buildStudentMap(students) {
  return new Map((students || []).map((student) => [student.tc, student]));
}

function valueChanged(oldValue, newValue) {
  return normalizeValue(oldValue) !== normalizeValue(newValue);
}

function debtChanged(oldValue, newValue) {
  return normalizeDebt(oldValue) !== normalizeDebt(newValue);
}

async function maybeSend(condition, student, payload) {
  if (!condition) return;
  await sendNotificationToStudent(student, payload);
}

async function main() {
  const students = readJson(STUDENTS_PATH, []);
  const previousStudents = readPreviousStudentsFromGit();
  const state = readJson(STATE_PATH, {});

  if (!Array.isArray(previousStudents)) {
    for (const student of students) {
      const stateRecord = getStateRecord(state, student.tc);
      updateStudentBaseline(stateRecord, student);
    }

    writeJson(STATE_PATH, state);
    console.log("Önceki students.json bulunamadı. İlk kurulum için baseline yazıldı, bildirim gönderilmedi.");
    return;
  }

  const previousMap = buildStudentMap(previousStudents);

  for (const student of students) {
    const previous = previousMap.get(student.tc);
    const stateRecord = getStateRecord(state, student.tc);

    if (!previous) {
      updateStudentBaseline(stateRecord, student);
      continue;
    }

    await maybeSend(
      !normalizeValue(previous.esinav_tarih) && !!normalizeValue(student.esinav_tarih),
      student,
      {
        title: "E-sınav tarihiniz açıklandı",
        body: student.esinav_tarih
          ? `${student.esinav_tarih}${student.esinav_saati ? ` ${student.esinav_saati}` : ""}`
          : "Detay için uygulamayı açın.",
        data: { route: "/" },
      },
    );

    await maybeSend(
      !normalizeValue(previous.direksiyon_tarih) && !!normalizeValue(student.direksiyon_tarih),
      student,
      {
        title: "Direksiyon sınav tarihiniz açıklandı",
        body: student.direksiyon_tarih
          ? `${student.direksiyon_tarih}${student.direksiyon_saati ? ` ${student.direksiyon_saati}` : ""}`
          : "Detay için uygulamayı açın.",
        data: { route: "/" },
      },
    );

    await maybeSend(
      debtChanged(previous.esinav_harc_borcu || previous.esinav_harc_borc, student.esinav_harc_borcu || student.esinav_harc_borc) &&
        !!normalizeDebt(student.esinav_harc_borcu || student.esinav_harc_borc),
      student,
      {
        title: "E-sınav ödeme bilginiz eklendi",
        body: `Borç: ${normalizeDebt(student.esinav_harc_borcu || student.esinav_harc_borc)}`,
        data: { route: "/" },
      },
    );

    await maybeSend(
      debtChanged(previous.direksiyon_harc_borcu || previous.direksiyon_harc_borc, student.direksiyon_harc_borcu || student.direksiyon_harc_borc) &&
        !!normalizeDebt(student.direksiyon_harc_borcu || student.direksiyon_harc_borc),
      student,
      {
        title: "Direksiyon ödeme bilginiz eklendi",
        body: `Borç: ${normalizeDebt(student.direksiyon_harc_borcu || student.direksiyon_harc_borc)}`,
        data: { route: "/" },
      },
    );

    await maybeSend(
      debtChanged(previous.taksit_borcu, student.taksit_borcu) && !!normalizeDebt(student.taksit_borcu),
      student,
      {
        title: "Yeni taksit bilginiz eklendi",
        body: `Borç: ${normalizeDebt(student.taksit_borcu)}`,
        data: { route: "/" },
      },
    );

    await maybeSend(
      !normalizeValue(previous.esinav_borc_son_odeme) && !!normalizeValue(student.esinav_borc_son_odeme),
      student,
      {
        title: "E-sınav son ödeme tarihi eklendi",
        body: `Son ödeme tarihi: ${student.esinav_borc_son_odeme}`,
        data: { route: "/" },
      },
    );

    await maybeSend(
      !normalizeValue(previous.direksiyon_borc_son_odeme) && !!normalizeValue(student.direksiyon_borc_son_odeme),
      student,
      {
        title: "Direksiyon son ödeme tarihi eklendi",
        body: `Son ödeme tarihi: ${student.direksiyon_borc_son_odeme}`,
        data: { route: "/" },
      },
    );

    await maybeSend(
      !normalizeValue(previous.taksit_son_odeme) && !!normalizeValue(student.taksit_son_odeme),
      student,
      {
        title: "Taksit son ödeme tarihi eklendi",
        body: `Son ödeme tarihi: ${student.taksit_son_odeme}`,
        data: { route: "/" },
      },
    );

    await maybeSend(
      buildStage(previous) !== buildStage(student),
      student,
      {
        title: "Süreç aşamanız güncellendi",
        body: `Yeni aşama: ${buildStage(student)}`,
        data: { route: "/" },
      },
    );

    await maybeSend(
      valueChanged(previous.evrak_durumu, student.evrak_durumu),
      student,
      {
        title:
          student.evrak_durumu === "eksik"
            ? "Evraklarınızda eksik var"
            : "Evrak durumunuz güncellendi",
        body:
          student.evrak_durumu === "eksik"
            ? normalizeValue(student.eksik_evraklar) || "Detay için uygulamayı açın."
            : "Evrak durumunuz tamamlandı.",
        data: { route: "/" },
      },
    );

    updateStudentBaseline(stateRecord, student);
  }

  writeJson(STATE_PATH, state);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
