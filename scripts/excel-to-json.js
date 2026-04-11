/**
 * scripts/excel-to-json.js
 *
 * v10
 *
 * Bu sürümde eklenen:
 * - excel/direksiyon_calismasi.xlsx dosyası da aynı script içinde okunur
 * - ikinci script çalıştırmaya gerek kalmaz
 * - aktif direksiyon öğrencileri "DİREKSİYON LİSTESİ" sayfasından alınır
 * - hoca sayfalarından geçmiş 3 ay + gelecek 3 ay dersleri çekilir
 * - dersler students.json içine direksiyon_dersleri olarak yazılır
 * - uygun öğrencilerde direksiyon_tarih / direksiyon_saati de bir sonraki derse göre doldurulur
 *
 * Net kural:
 * 1) ogrenciler.xlsx
 *    - E-SINAV
 *    - DİREKSİYON
 *    - EKSİK BELGELER
 *    - ALACAK RAPORU
 *
 * 2) direksiyon_calismasi.xlsx
 *    - DİREKSİYON LİSTESİ
 *    - eğitmen sayfaları
 *
 * Direksiyon çalışma mantığı:
 * - "DİREKSİYON LİSTESİ" sayfasında sadece renkli aktif bölüm alınır
 * - turuncu altındaki pasif kısım alınmaz
 * - öğrenci eşleşmesi önce aktif listedeki isim + tc ile kurulur
 * - dersler hoca sayfalarından okunur
 * - renk anlamları:
 *   * plaka + ad + telefon yeşil  => katildi
 *   * plaka + ad + telefon mavi   => katilmadi
 *   * saat/blok yeşil             => teyitli
 *   * diğer durum                 => planlandi
 */

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");

const ROOT = path.resolve(__dirname, "..");
const EXCEL_PATH = path.join(ROOT, "excel", "ogrenciler.xlsx");
const DIREKSIYON_CALISMASI_PATH = path.join(
  ROOT,
  "excel",
  "direksiyon_calismasi.xlsx",
);
const OUTPUT_PATH = path.join(ROOT, "docs", "students.json");

const DEFAULT_YEAR = 2026;
const ESINAV_FIXED_FEE = "1.250₺";
const WINDOW_PAST_DAYS = 92;
const WINDOW_FUTURE_DAYS = 92;

const TEACHER_SHEETS = [
  "ZEYNEP HOCA",
  "LEYLA HOCA",
  "LEYLA BEĞDE",
  "RÜMEYSA",
  "KEMAL HOCA",
  "FATMA AŞÇI",
  "CANAN HOCA",
  "MERVE HOCA",
];

function t(v) {
  return String(v ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tc(v) {
  return t(v).replace(/\D/g, "");
}

function normalizeHeader(v) {
  return t(v)
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[()]/g, " ")
    .replace(/[\/\\_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePersonName(v) {
  return t(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[‐‑‒–—―\-_/\\.'`’]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asDateText(day, month, year = DEFAULT_YEAR) {
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

function normalizeYear(yearValue, fallbackYear = DEFAULT_YEAR) {
  const y = Number(yearValue);
  if (!y || Number.isNaN(y)) return fallbackYear;
  if (y < 100) return 2000 + y;
  if (y <= 1901) return fallbackYear;
  return y;
}

function formatSlashDateAsMonthDayYear(raw, fallbackYear = DEFAULT_YEAR) {
  const match = t(raw).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return "";

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = normalizeYear(match[3], fallbackYear);

  if (!month || !day || month > 12 || day > 31) return "";
  return asDateText(day, month, year);
}

function formatDate(v, fallbackYear = DEFAULT_YEAR) {
  if (v == null || v === "") return "";

  if (v instanceof Date && !isNaN(v.getTime())) {
    return asDateText(
      v.getDate(),
      v.getMonth() + 1,
      normalizeYear(v.getFullYear(), fallbackYear),
    );
  }

  if (typeof v === "object" && v && typeof v.text === "string") {
    return formatDate(v.text, fallbackYear);
  }

  if (typeof v === "number" && !Number.isNaN(v)) {
    if (v > 1000) {
      const parsed = XLSX.SSF.parse_date_code(v);
      if (parsed && parsed.d && parsed.m) {
        return asDateText(
          parsed.d,
          parsed.m,
          normalizeYear(parsed.y, fallbackYear),
        );
      }
    }

    const raw = String(v);
    if (/^\d{1,2}\.\d{1,2}$/.test(raw)) {
      const [d, m] = raw.split(".");
      return asDateText(Number(d), Number(m), fallbackYear);
    }

    const fixed = v.toFixed(2);
    if (/^\d{1,2}\.\d{2}$/.test(fixed)) {
      const [d, m] = fixed.split(".");
      return asDateText(Number(d), Number(m), fallbackYear);
    }
  }

  const raw = t(v);
  if (!raw) return "";

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) return raw;

  if (/^\d{1,2}[.,]\d{1,2}$/.test(raw)) {
    const [d, m] = raw.replace(",", ".").split(".");
    return asDateText(Number(d), Number(m), fallbackYear);
  }

  if (/^\d{1,2}[.,]\d{1,2}[.,]\d{2}$/.test(raw)) {
    const [d, m, y2] = raw.replace(/,/g, ".").split(".");
    return asDateText(Number(d), Number(m), 2000 + Number(y2));
  }

  if (/^\d{1,2}[.,]\d{1,2}[.,]\d{4}$/.test(raw)) {
    const [d, m, y] = raw.replace(/,/g, ".").split(".");
    return asDateText(Number(d), Number(m), normalizeYear(y, fallbackYear));
  }

  if (/^\d{1,2}\/\d{1,2}\/(\d{2}|\d{4})$/.test(raw)) {
    return formatSlashDateAsMonthDayYear(raw, fallbackYear);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-");
    return asDateText(Number(d), Number(m), normalizeYear(y, fallbackYear));
  }

  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(raw)) {
    const [y, m, d] = raw.split("/");
    return asDateText(Number(d), Number(m), normalizeYear(y, fallbackYear));
  }

  return raw;
}

function normalizeTimeText(rawValue) {
  if (rawValue instanceof Date && !isNaN(rawValue.getTime())) {
    return `${String(rawValue.getHours()).padStart(2, "0")}:${String(
      rawValue.getMinutes(),
    ).padStart(2, "0")}`;
  }

  const raw = t(rawValue);
  if (!raw) return "";

  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(":");
    return `${String(Number(h)).padStart(2, "0")}:${m}`;
  }

  const match = raw.match(/(\d{1,2})[:.](\d{2})/);
  if (match) {
    return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
  }

  return "";
}

function money(v) {
  return t(v);
}

function createStudent(tcValue = "", nameValue = "") {
  return {
    tc: tcValue,
    ad_soyad: nameValue,
    sinif: "",
    telefonlar: "",
    durum: "",
    evrak_durumu: "",
    eksik_evraklar: "",
    esinav_harc: "",
    esinav_son_odeme: "",
    esinav_tarih: "",
    esinav_saati: "",
    esinav_sonuc: "",
    direksiyon_harc: "",
    direksiyon_son_odeme: "",
    direksiyon_tarih: "",
    direksiyon_saati: "",
    direksiyon_sonuc: "",
    direksiyon_dersleri: [],
    direksiyon_kalan_ders: "",
    direksiyon_toplam_ders: "",
    direksiyon_aktif_arac: "",
    direksiyon_son_egitmen: "",
    esinav_harc_borcu: "",
    esinav_borc_son_odeme: "",
    direksiyon_harc_borcu: "",
    direksiyon_borc_son_odeme: "",
    taksit_borcu: "",
    taksit_son_odeme: "",
  };
}

function buildStore() {
  return { byTc: new Map(), byName: new Map() };
}

function getOrCreate(store, tcValue, nameValue) {
  const cleanTc = tc(tcValue);
  const cleanName = t(nameValue);
  const normName = normalizePersonName(cleanName);

  if (cleanTc && store.byTc.has(cleanTc)) {
    const existing = store.byTc.get(cleanTc);
    if (normName) store.byName.set(normName, existing);
    return existing;
  }

  if (normName && store.byName.has(normName)) {
    const existing = store.byName.get(normName);
    if (cleanTc && !existing.tc) {
      existing.tc = cleanTc;
      store.byTc.set(cleanTc, existing);
    } else if (cleanTc) {
      store.byTc.set(cleanTc, existing);
    }
    return existing;
  }

  const student = createStudent(cleanTc, cleanName);
  if (cleanTc) store.byTc.set(cleanTc, student);
  if (normName) store.byName.set(normName, student);
  return student;
}

function allStudents(store) {
  const unique = new Set();
  const arr = [];

  for (const student of store.byTc.values()) {
    if (!unique.has(student)) {
      unique.add(student);
      arr.push(student);
    }
  }

  for (const student of store.byName.values()) {
    if (!unique.has(student)) {
      unique.add(student);
      arr.push(student);
    }
  }

  return arr;
}

function getWorksheetByNameExcelJS(workbook, wantedName) {
  const wanted = normalizeHeader(wantedName);
  return workbook.worksheets.find((ws) => normalizeHeader(ws.name) === wanted);
}

function getSheetByNameXLSX(workbook, wantedName) {
  const wanted = normalizeHeader(wantedName);
  const realName = workbook.SheetNames.find(
    (name) => normalizeHeader(name) === wanted,
  );
  return realName ? workbook.Sheets[realName] : null;
}

function getExcelCellArgb(cell) {
  const fg = cell?.fill?.fgColor;
  if (!fg) return "";
  return t(fg.argb || fg.rgb || "").toUpperCase();
}

function isPaidByFill(cell) {
  const pattern = t(cell?.fill?.patternType).toLowerCase();
  const argb = getExcelCellArgb(cell);

  if (pattern !== "solid") return false;

  return (
    argb.includes("FF00B050") ||
    argb.includes("00B050") ||
    argb.includes("FFFFFF00") ||
    argb.includes("FFFF00") ||
    argb.includes("FFD966") ||
    argb.includes("FFE699")
  );
}

function isSolid(cell) {
  return t(cell?.fill?.patternType).toLowerCase() === "solid";
}

function isGreen(cell) {
  const color = getExcelCellArgb(cell);
  return isSolid(cell) && color.includes("00B050");
}

function isBlue(cell) {
  const color = getExcelCellArgb(cell);
  return isSolid(cell) && color.includes("0070C0");
}

function setIfEmpty(obj, key, value) {
  const val = t(value);
  if (val && !obj[key]) obj[key] = val;
}

function buildAlacakLookup(alacakSheetJs) {
  const map = new Map();

  for (let r = 4; r <= alacakSheetJs.rowCount; r += 1) {
    const row = alacakSheetJs.getRow(r);
    const name = t(row.getCell(2).text || row.getCell(2).value);
    if (!name) continue;

    const key = normalizePersonName(name);
    map.set(key, {
      name,
      esinav_harc_borcu: money(row.getCell(3).text || row.getCell(3).value),
      direksiyon_harc_borcu: money(row.getCell(4).text || row.getCell(4).value),
      taksit_borcu: money(row.getCell(5).text || row.getCell(5).value),
      tarih: formatDate(row.getCell(6).value),
    });
  }

  return map;
}

function buildEksikBelgeler(student, row) {
  const labels = [
    { col: 5, label: "Sözleşme" },
    { col: 6, label: "İmza" },
    { col: 7, label: "Fotoğraf" },
    { col: 8, label: "Sağlık raporu" },
    { col: 9, label: "Öğrenim belgesi" },
    { col: 10, label: "Sabıka kaydı" },
    { col: 11, label: "İkametgah" },
    { col: 12, label: "Webcam" },
  ];

  const missing = labels
    .filter(
      ({ col }) =>
        t(row.getCell(col).text || row.getCell(col).value).toLocaleUpperCase(
          "tr-TR",
        ) === "X",
    )
    .map(({ label }) => label);

  if (missing.length) {
    student.evrak_durumu = "eksik";
    student.eksik_evraklar = missing.join(", ");
  } else if (!student.evrak_durumu) {
    student.evrak_durumu = "tamam";
  }
}

/* -----------------------------
 * DİREKSİYON ÇALIŞMASI YARDIMCILARI
 * ----------------------------- */

function getCellText(cell) {
  if (!cell) return "";
  if (typeof cell.text === "string" && cell.text.trim()) return t(cell.text);
  if (cell.value && typeof cell.value === "object" && "result" in cell.value) {
    return t(cell.value.result);
  }
  return t(cell.value);
}

function rowHasAnyFill(row, startCol, endCol) {
  for (let c = startCol; c <= endCol; c += 1) {
    if (isSolid(row.getCell(c))) return true;
  }
  return false;
}

function parseExcelDate(value, fallbackYear = DEFAULT_YEAR) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === "object" && value.result instanceof Date) {
    return new Date(
      value.result.getFullYear(),
      value.result.getMonth(),
      value.result.getDate(),
    );
  }

  if (typeof value === "number" && !Number.isNaN(value)) {
    if (value > 1000) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed && parsed.d && parsed.m) {
        return new Date(
          normalizeYear(parsed.y, fallbackYear),
          parsed.m - 1,
          parsed.d,
        );
      }
    }
  }

  const raw = t(value);
  if (!raw) return null;

  let m = raw.match(/^(\d{1,2})[.,/](\d{1,2})[.,/](\d{4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = normalizeYear(m[3], fallbackYear);
    return new Date(year, month - 1, day);
  }

  m = raw.match(/^(\d{1,2})[.,/](\d{1,2})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    return new Date(fallbackYear, month - 1, day);
  }

  m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  m = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  return null;
}

function parseTimeValue(value) {
  if (!value) return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(
      value.getMinutes(),
    ).padStart(2, "0")}`;
  }

  if (typeof value === "object" && value.result instanceof Date) {
    return `${String(value.result.getHours()).padStart(2, "0")}:${String(
      value.result.getMinutes(),
    ).padStart(2, "0")}`;
  }

  return normalizeTimeText(value);
}

function dateToIso(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function sameOrAfter(a, b) {
  return a.getTime() >= b.getTime();
}

function sameOrBefore(a, b) {
  return a.getTime() <= b.getTime();
}

function lessonStatusFromCells(
  timeStartCell,
  timeEndCell,
  plateCell,
  nameCell,
  phoneCell,
) {
  const mainGreen = [plateCell, nameCell, phoneCell].every((cell) =>
    isGreen(cell),
  );
  const mainBlue = [plateCell, nameCell, phoneCell].every((cell) =>
    isBlue(cell),
  );

  if (mainGreen) return "katildi";
  if (mainBlue) return "katilmadi";

  if (
    isGreen(timeStartCell) ||
    isGreen(timeEndCell) ||
    isGreen(plateCell) ||
    isGreen(nameCell) ||
    isGreen(phoneCell)
  ) {
    return "teyitli";
  }

  return "planlandi";
}

function findWorksheetByNames(workbook, wantedNames) {
  const candidates = Array.isArray(wantedNames) ? wantedNames : [wantedNames];
  const wantedSet = new Set(
    candidates.map((name) => normalizePersonName(name)),
  );

  return workbook.worksheets.find((ws) =>
    wantedSet.has(normalizePersonName(ws.name)),
  );
}

function pickTeacherSheets(workbook) {
  const picked = [];
  const used = new Set();

  for (const wanted of TEACHER_SHEETS) {
    const ws = findWorksheetByNames(workbook, wanted);
    if (ws && !used.has(ws.id)) {
      used.add(ws.id);
      picked.push(ws);
    }
  }

  if (picked.length) return picked;

  return workbook.worksheets.filter((ws) => {
    const name = normalizePersonName(ws.name);

    if (!name) return false;
    if (name.includes("direksiyon listesi")) return false;
    if (name.includes("hak yanma")) return false;
    if (name.includes("girmiyen")) return false;
    if (name.includes("programi")) return false;
    if (name === "1 gun ders") return false;
    if (name === "2 gun ders") return false;
    if (name === "4 gun ders") return false;
    if (name.includes("yemek")) return false;

    return true;
  });
}

function buildActiveStudentLookup(workbook) {
  const ws = findWorksheetByNames(workbook, [
    "DİREKSİYON LİSTESİ",
    "DIREKSIYON LISTESI",
  ]);
  if (!ws) {
    throw new Error(
      'direksiyon_calismasi.xlsx içinde "DİREKSİYON LİSTESİ" sayfası bulunamadı.',
    );
  }

  const byTc = new Map();
  const byName = new Map();

  for (let r = 1; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);

    const tcValue = tc(getCellText(row.getCell(2)));
    const nameValue = getCellText(row.getCell(3));

    if (!tcValue || tcValue.length !== 11 || !nameValue) continue;

    // Aktif bölüm: satırda renk var.
    // Turuncu altı / pasif bölüm: genelde renksiz.
    if (!rowHasAnyFill(row, 2, 10)) continue;

    const activeStudent = {
      tc: tcValue,
      ad_soyad: nameValue,
      name_key: normalizePersonName(nameValue),
      arac_kodu: getCellText(row.getCell(4)),
      telefon: getCellText(row.getCell(5)),
      kalan_ders: getCellText(row.getCell(6)),
      toplam_ders: getCellText(row.getCell(7)),
      sinif: getCellText(row.getCell(8)),
      d_bitis: getCellText(row.getCell(9)),
    };

    byTc.set(activeStudent.tc, activeStudent);
    byName.set(activeStudent.name_key, activeStudent);
  }

  return { byTc, byName };
}

function parseLessons(workbook, activeLookup) {
  const today = new Date();

  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() - WINDOW_PAST_DAYS);
  minDate.setHours(0, 0, 0, 0);

  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + WINDOW_FUTURE_DAYS);
  maxDate.setHours(23, 59, 59, 999);

  const lessonsByTc = new Map();
  const teacherSheets = pickTeacherSheets(workbook);

  for (const ws of teacherSheets) {
    const teacherName = getCellText(ws.getCell("A1")) || ws.name;

    for (let r = 1; r <= ws.rowCount; r += 1) {
      const dateColumns = [];

      for (
        let baseCol = 1;
        baseCol <= Math.min(ws.columnCount, 20);
        baseCol += 2
      ) {
        const rawDate = ws.getRow(r).getCell(baseCol).value;
        const lessonDate = parseExcelDate(rawDate, today.getFullYear());

        if (!lessonDate) continue;
        if (
          !sameOrAfter(lessonDate, minDate) ||
          !sameOrBefore(lessonDate, maxDate)
        )
          continue;

        dateColumns.push({ baseCol, detailCol: baseCol + 1, lessonDate });
      }

      if (!dateColumns.length) continue;

      for (const dateColumn of dateColumns) {
        const { baseCol, detailCol, lessonDate } = dateColumn;

        for (
          let plateRow = r + 2;
          plateRow <= Math.min(ws.rowCount, r + 25);
          plateRow += 4
        ) {
          if (plateRow + 3 > ws.rowCount) continue;

          const plateCell = ws.getRow(plateRow).getCell(detailCol);
          const nameCell = ws.getRow(plateRow + 1).getCell(detailCol);
          const phoneCell = ws.getRow(plateRow + 2).getCell(detailCol);
          const noteCell = ws.getRow(plateRow + 3).getCell(detailCol);

          const startTimeCell = ws.getRow(plateRow + 1).getCell(baseCol);
          const endTimeCell = ws.getRow(plateRow + 2).getCell(baseCol);

          const studentName = getCellText(nameCell);
          if (!studentName) continue;

          const activeStudent = activeLookup.byName.get(
            normalizePersonName(studentName),
          );
          if (!activeStudent) continue;

          const startTime = parseTimeValue(startTimeCell.value);
          const endTime = parseTimeValue(endTimeCell.value);
          const noteText = getCellText(noteCell);
          const status = lessonStatusFromCells(
            startTimeCell,
            endTimeCell,
            plateCell,
            nameCell,
            phoneCell,
          );

          const lesson = {
            tarih: asDateText(
              lessonDate.getDate(),
              lessonDate.getMonth() + 1,
              lessonDate.getFullYear(),
            ),
            tarih_iso: dateToIso(lessonDate),
            saat:
              startTime && endTime
                ? `${startTime}-${endTime}`
                : startTime || endTime || "",
            baslangic_saati: startTime,
            bitis_saati: endTime,
            egitmen: teacherName,
            ogrenci: activeStudent.ad_soyad,
            tc: activeStudent.tc,
            telefon: getCellText(phoneCell) || activeStudent.telefon,
            arac_plaka: getCellText(plateCell) || activeStudent.arac_kodu,
            kalan_ders: activeStudent.kalan_ders,
            toplam_ders: activeStudent.toplam_ders,
            sinif: activeStudent.sinif,
            not: noteText,
            durum: status,
            teyitli_mi: status === "teyitli" || status === "katildi",
            katilim:
              status === "katildi"
                ? "katildi"
                : status === "katilmadi"
                  ? "katilmadi"
                  : "",
          };

          if (!lessonsByTc.has(activeStudent.tc)) {
            lessonsByTc.set(activeStudent.tc, []);
          }

          lessonsByTc.get(activeStudent.tc).push(lesson);
        }
      }
    }
  }

  for (const [studentTc, lessons] of lessonsByTc.entries()) {
    const unique = new Map();

    for (const lesson of lessons) {
      const key = [
        lesson.tarih_iso,
        lesson.baslangic_saati,
        lesson.bitis_saati,
        lesson.egitmen,
        normalizePersonName(lesson.ogrenci),
      ].join("|");

      if (!unique.has(key)) {
        unique.set(key, lesson);
      }
    }

    const sorted = Array.from(unique.values()).sort((a, b) => {
      const aKey = `${a.tarih_iso} ${a.baslangic_saati || "99:99"}`;
      const bKey = `${b.tarih_iso} ${b.baslangic_saati || "99:99"}`;
      return aKey.localeCompare(bKey, "tr");
    });

    lessonsByTc.set(studentTc, sorted);
  }

  return lessonsByTc;
}

function applyDireksiyonCalismasi(store) {
  if (!fs.existsSync(DIREKSIYON_CALISMASI_PATH)) {
    console.log(
      "ℹ️ direksiyon_calismasi.xlsx bulunamadı, direksiyon dersleri atlandı.",
    );
    return {
      updatedStudentCount: 0,
      orphanActiveStudentCount: 0,
      totalLessonCount: 0,
    };
  }

  const workbook = new ExcelJS.Workbook();

  return workbook.xlsx.readFile(DIREKSIYON_CALISMASI_PATH).then(() => {
    const activeLookup = buildActiveStudentLookup(workbook);
    const lessonsByTc = parseLessons(workbook, activeLookup);

    let updatedStudentCount = 0;
    let orphanActiveStudentCount = 0;
    let totalLessonCount = 0;

    for (const [activeTc, activeStudent] of activeLookup.byTc.entries()) {
      const student =
        (activeTc ? store.byTc.get(activeTc) : null) ||
        store.byName.get(activeStudent.name_key) ||
        getOrCreate(store, activeStudent.tc, activeStudent.ad_soyad);

      if (!student) {
        orphanActiveStudentCount += 1;
        continue;
      }

      setIfEmpty(student, "tc", activeStudent.tc);
      setIfEmpty(student, "ad_soyad", activeStudent.ad_soyad);
      setIfEmpty(student, "sinif", activeStudent.sinif);
      setIfEmpty(student, "telefonlar", activeStudent.telefon);

      student.durum = "direksiyon";
      student.direksiyon_kalan_ders = activeStudent.kalan_ders || "";
      student.direksiyon_toplam_ders = activeStudent.toplam_ders || "";
      student.direksiyon_aktif_arac = activeStudent.arac_kodu || "";

      const lessons = lessonsByTc.get(activeTc) || [];
      student.direksiyon_dersleri = lessons;
      totalLessonCount += lessons.length;

      if (lessons.length) {
        const nextLesson = pickNextLesson(lessons);
        if (nextLesson) {
          student.direksiyon_tarih = nextLesson.tarih || "";
          student.direksiyon_saati = nextLesson.saat || "";
          student.direksiyon_son_egitmen = nextLesson.egitmen || "";
        } else {
          student.direksiyon_son_egitmen =
            lessons[lessons.length - 1]?.egitmen ||
            student.direksiyon_son_egitmen ||
            "";
        }
      }

      updatedStudentCount += 1;
    }

    return {
      updatedStudentCount,
      orphanActiveStudentCount,
      totalLessonCount,
    };
  });
}

function pickNextLesson(lessons) {
  const now = new Date();

  for (const lesson of lessons) {
    const d = parseExcelDate(lesson.tarih, DEFAULT_YEAR);
    if (!d) continue;

    const [hh, mm] = String(lesson.baslangic_saati || "23:59").split(":");
    d.setHours(Number(hh || 23), Number(mm || 59), 0, 0);

    if (d.getTime() >= now.getTime()) {
      return lesson;
    }
  }

  return lessons[lessons.length - 1] || null;
}

function syncDerivedFields(student) {
  if (!student.evrak_durumu) {
    student.evrak_durumu = student.eksik_evraklar ? "eksik" : "tamam";
  }

  if (!student.esinav_harc && student.esinav_harc_borcu) {
    student.esinav_harc = "odenmedi";
  }

  if (!student.direksiyon_harc) {
    if (
      student.direksiyon_harc_borcu ||
      student.direksiyon_borc_son_odeme ||
      student.direksiyon_son_odeme
    ) {
      student.direksiyon_harc = "odenmedi";
    }
  }

  if (!student.esinav_son_odeme && student.esinav_borc_son_odeme) {
    student.esinav_son_odeme = student.esinav_borc_son_odeme;
  }

  if (!student.direksiyon_son_odeme && student.direksiyon_borc_son_odeme) {
    student.direksiyon_son_odeme = student.direksiyon_borc_son_odeme;
  }

  if (!student.durum) {
    if (
      (Array.isArray(student.direksiyon_dersleri) &&
        student.direksiyon_dersleri.length) ||
      student.direksiyon_harc ||
      student.direksiyon_harc_borcu
    ) {
      student.durum = "direksiyon";
    } else if (
      student.esinav_tarih ||
      student.esinav_saati ||
      student.esinav_harc ||
      student.esinav_harc_borcu
    ) {
      student.durum = "esinav";
    }
  }

  if (!Array.isArray(student.direksiyon_dersleri)) {
    student.direksiyon_dersleri = [];
  }

  if (!student.direksiyon_tarih && student.direksiyon_dersleri.length) {
    const nextLesson = pickNextLesson(student.direksiyon_dersleri);
    if (nextLesson) {
      student.direksiyon_tarih = nextLesson.tarih || "";
      student.direksiyon_saati = nextLesson.saat || "";
      student.direksiyon_son_egitmen =
        nextLesson.egitmen || student.direksiyon_son_egitmen || "";
    }
  }

  if (!student.direksiyon_tarih) student.direksiyon_tarih = "";
  if (!student.direksiyon_saati) student.direksiyon_saati = "";
  if (!student.direksiyon_kalan_ders) student.direksiyon_kalan_ders = "";
  if (!student.direksiyon_toplam_ders) student.direksiyon_toplam_ders = "";
  if (!student.direksiyon_aktif_arac) student.direksiyon_aktif_arac = "";
  if (!student.direksiyon_son_egitmen) student.direksiyon_son_egitmen = "";
}

async function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel dosyası bulunamadı: ${EXCEL_PATH}`);
  }

  const xlsxBook = XLSX.readFile(EXCEL_PATH, { cellStyles: true });
  const exceljsBook = new ExcelJS.Workbook();
  await exceljsBook.xlsx.readFile(EXCEL_PATH);

  const esinavSheetJs = getWorksheetByNameExcelJS(exceljsBook, "E-SINAV");
  const direksiyonSheetJs = getWorksheetByNameExcelJS(
    exceljsBook,
    "DİREKSİYON",
  );
  const eksikSheetJs = getWorksheetByNameExcelJS(exceljsBook, "EKSİK BELGELER");
  const alacakSheetJs = getWorksheetByNameExcelJS(exceljsBook, "ALACAK RAPORU");

  const esinavSheetX = getSheetByNameXLSX(xlsxBook, "E-SINAV");
  const direksiyonSheetX = getSheetByNameXLSX(xlsxBook, "DİREKSİYON");
  const alacakSheetX = getSheetByNameXLSX(xlsxBook, "ALACAK RAPORU");

  if (!esinavSheetJs || !direksiyonSheetJs || !eksikSheetJs || !alacakSheetJs) {
    throw new Error("Gerekli sayfalardan biri bulunamadı.");
  }

  if (!esinavSheetX || !direksiyonSheetX || !alacakSheetX) {
    throw new Error("xlsx tarafında gerekli sayfalardan biri bulunamadı.");
  }

  const store = buildStore();
  const alacakLookup = buildAlacakLookup(alacakSheetJs);

  // E-SINAV
  for (let r = 3; r <= esinavSheetJs.rowCount; r += 1) {
    const row = esinavSheetJs.getRow(r);

    const tcValue = row.getCell(2).value;
    const nameValue = t(row.getCell(3).text || row.getCell(3).value);
    if (!nameValue) continue;

    const student = getOrCreate(store, tcValue, nameValue);

    setIfEmpty(student, "ad_soyad", nameValue);
    setIfEmpty(student, "tc", tcValue);
    setIfEmpty(student, "sinif", row.getCell(5).text || row.getCell(5).value);
    setIfEmpty(
      student,
      "telefonlar",
      row.getCell(8).text || row.getCell(8).value,
    );

    student.durum = "esinav";

    const dueDate = formatDate(row.getCell(4).value);
    const examDate = formatDate(row.getCell(9).value);
    const examTime = normalizeTimeText(row.getCell(10).value);
    const paid = isPaidByFill(row.getCell(6));

    if (dueDate) {
      student.esinav_son_odeme = dueDate;
      student.esinav_borc_son_odeme = dueDate;
    }
    if (examDate) student.esinav_tarih = examDate;
    if (examTime) student.esinav_saati = examTime;

    if (paid) {
      student.esinav_harc = "odendi";
      student.esinav_harc_borcu = "";
      student.esinav_borc_son_odeme = "";
    } else {
      student.esinav_harc = "odenmedi";
      student.esinav_harc_borcu = ESINAV_FIXED_FEE;
    }
  }

  // DİREKSİYON
  for (let r = 3; r <= direksiyonSheetJs.rowCount; r += 1) {
    const row = direksiyonSheetJs.getRow(r);

    const tcValue = row.getCell(2).value;
    const nameValue = t(row.getCell(3).text || row.getCell(3).value);
    if (!nameValue) continue;

    const student = getOrCreate(store, tcValue, nameValue);

    setIfEmpty(student, "ad_soyad", nameValue);
    setIfEmpty(student, "tc", tcValue);
    setIfEmpty(student, "sinif", row.getCell(5).text || row.getCell(5).value);
    setIfEmpty(
      student,
      "telefonlar",
      row.getCell(8).text || row.getCell(8).value,
    );

    student.durum = "direksiyon";

    const paid = isPaidByFill(row.getCell(6));

    if (paid) {
      student.direksiyon_harc = "odendi";
      student.direksiyon_harc_borcu = "";
      student.direksiyon_borc_son_odeme = "";
      student.direksiyon_son_odeme = "";
    } else {
      student.direksiyon_harc = "odenmedi";

      const alacak = alacakLookup.get(normalizePersonName(nameValue));
      if (alacak) {
        if (alacak.direksiyon_harc_borcu) {
          student.direksiyon_harc_borcu = alacak.direksiyon_harc_borcu;
        }
        if (alacak.tarih) {
          student.direksiyon_borc_son_odeme = alacak.tarih;
          student.direksiyon_son_odeme = alacak.tarih;
        }
      }
    }
  }

  // EKSİK BELGELER
  for (let r = 2; r <= eksikSheetJs.rowCount; r += 1) {
    const row = eksikSheetJs.getRow(r);

    const tcValue = row.getCell(2).value;
    const nameValue = t(row.getCell(3).text || row.getCell(3).value);
    if (!nameValue) continue;

    const student = getOrCreate(store, tcValue, nameValue);
    setIfEmpty(student, "ad_soyad", nameValue);
    setIfEmpty(student, "tc", tcValue);

    buildEksikBelgeler(student, row);
  }

  // ALACAK RAPORU
  for (let r = 4; r <= alacakSheetJs.rowCount; r += 1) {
    const row = alacakSheetJs.getRow(r);

    const nameValue = t(row.getCell(2).text || row.getCell(2).value);
    if (!nameValue) continue;

    const student = getOrCreate(store, "", nameValue);

    const esinavDebt = money(row.getCell(3).text || row.getCell(3).value);
    const direksiyonDebt = money(row.getCell(4).text || row.getCell(4).value);
    const taksitDebt = money(row.getCell(5).text || row.getCell(5).value);
    const dueDate = formatDate(row.getCell(6).value);

    if (esinavDebt && !student.esinav_harc_borcu) {
      student.esinav_harc = "odenmedi";
      student.esinav_harc_borcu = esinavDebt;
      if (dueDate && !student.esinav_borc_son_odeme) {
        student.esinav_borc_son_odeme = dueDate;
      }
      if (dueDate && !student.esinav_son_odeme) {
        student.esinav_son_odeme = dueDate;
      }
    }

    if (student.direksiyon_harc === "odenmedi") {
      if (direksiyonDebt && !student.direksiyon_harc_borcu) {
        student.direksiyon_harc_borcu = direksiyonDebt;
      }
      if (dueDate && !student.direksiyon_borc_son_odeme) {
        student.direksiyon_borc_son_odeme = dueDate;
      }
      if (dueDate && !student.direksiyon_son_odeme) {
        student.direksiyon_son_odeme = dueDate;
      }
    }

    if (taksitDebt) {
      student.taksit_borcu = taksitDebt;
      if (dueDate) student.taksit_son_odeme = dueDate;
    }
  }

  const direksiyonCalismasiStats = await applyDireksiyonCalismasi(store);

  const result = allStudents(store)
    .filter((student) => student.tc || student.ad_soyad)
    .map((student) => {
      syncDerivedFields(student);
      return student;
    })
    .sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, "tr"));

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), "utf-8");

  console.log("✅ students.json oluşturuldu");
  console.log(`👤 Toplam benzersiz öğrenci: ${result.length}`);
  console.log(
    `🚗 Direksiyon çalışma dosyasından güncellenen öğrenci: ${direksiyonCalismasiStats.updatedStudentCount}`,
  );
  console.log(
    `🗓️ Toplam direksiyon dersi yazılan kayıt: ${direksiyonCalismasiStats.totalLessonCount}`,
  );
  console.log(
    `⚠️ Aktif listede olup ana öğrenci verisiyle eşleşmeyen öğrenci: ${direksiyonCalismasiStats.orphanActiveStudentCount}`,
  );
}

main().catch((err) => {
  console.error("❌ excel-to-json hatası:", err);
  process.exit(1);
});
