/**
 * scripts/excel-to-json.js
 *
 * v21
 *
 * Düzeltilenler:
 * 1) Saat düzeltildi
 *    - ExcelJS time-only hücrelerde tarihi 1899'a bağlayıp timezone kaydırabiliyor
 *    - bu yüzden direksiyon_calismasi.xlsx ayrıca SheetJS (xlsx) ile de okunur
 *    - saatler önce SheetJS'nin formatted text (w) değerinden alınır
 *    - örn. Excelde 10:00:00 görünen hücre artık 10:00 olur
 *
 * 2) Direksiyon harç rengi düzeltildi
 * 3) Direksiyon ders durum mantığı düzeltildi
 *    - durum kontrolünde note satırı değil telefon satırı baz alınır
 *    - saatler yeşilse => onaylandı
 *    - isim + plaka + telefon satırı yeşilse => ders yapıldı
 *    - saat yeşil ama isim/plaka/telefon satırı mavi ise => derse katılmadı
 *    - boş/beyaz ise => netleşmedi
 * 4) Direksiyon harç renk algısı güçlendirildi
 *    - rgb/indexed/theme dolgu tipleri daha geniş kontrol edilir
 *    - solid dolgu olup beyaz/boş olmayan hücreler ödenmiş sayılır
 * 5) Direksiyon ders renk algısı düzeltildi
 *    - bazı hücrelerde renk dolgu değil yazı renginde tutuluyor
 *    - artık hem fill hem font color birlikte okunuyor
 *    - böylece katıldı / onaylandı / katılmadı tekrar doğru ayrılır
 *    - HARÇ hücresi dolu renkliyse (özellikle yeşil / sarı) odendi kabul edilir
 *    - beyaz / boş ise odenmedi kabul edilir
 *    - bazı Excel fill varyasyonlarında fgColor yerine bgColor da kontrol edilir
 *
 * Not:
 * - direksiyon_tarih / direksiyon_saati sınav alanı olarak boş bırakılır
 * - ders bilgisi direksiyon_dersleri ve direksiyon_sonraki_ders_* alanlarında tutulur
 */

const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const XLSX = require("xlsx");

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
const WINDOW_PAST_DAYS = 31;
const WINDOW_FUTURE_DAYS = 31;

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

function excelSerialToDate(serial) {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const jsDate = new Date(excelEpoch.getTime() + serial * 86400000);
  return new Date(
    jsDate.getUTCFullYear(),
    jsDate.getUTCMonth(),
    jsDate.getUTCDate(),
  );
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

  if (typeof value === "number" && !Number.isNaN(value) && value > 1000) {
    return excelSerialToDate(value);
  }

  const raw = t(value);
  if (!raw) return null;

  let m = raw.match(/^(\d{1,2})[.,/](\d{1,2})[.,/](\d{4})$/);
  if (m) {
    return new Date(
      normalizeYear(m[3], fallbackYear),
      Number(m[2]) - 1,
      Number(m[1]),
    );
  }

  m = raw.match(/^(\d{1,2})[.,/](\d{1,2})$/);
  if (m) {
    return new Date(fallbackYear, Number(m[2]) - 1, Number(m[1]));
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

function formatDate(v, fallbackYear = DEFAULT_YEAR) {
  const d = parseExcelDate(v, fallbackYear);
  if (!d) {
    const raw = t(v);
    return raw || "";
  }

  return asDateText(
    d.getDate(),
    d.getMonth() + 1,
    normalizeYear(d.getFullYear(), fallbackYear),
  );
}

function normalizeTimeText(rawValue) {
  const raw = t(rawValue);
  if (raw) {
    // 10:00, 10:00:00, 2026-04-11 10:00:00 gibi formatları yakala
    const strict = raw.match(/\b(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\b/);
    if (strict) {
      const hh = String(Number(strict[1])).padStart(2, "0");
      const mm = strict[2];
      return `${hh}:${mm}`;
    }
  }

  if (rawValue instanceof Date && !isNaN(rawValue.getTime())) {
    return `${String(rawValue.getUTCHours()).padStart(2, "0")}:${String(
      rawValue.getUTCMinutes(),
    ).padStart(2, "0")}`;
  }

  if (typeof rawValue === "object" && rawValue?.result instanceof Date) {
    return `${String(rawValue.result.getUTCHours()).padStart(2, "0")}:${String(
      rawValue.result.getUTCMinutes(),
    ).padStart(2, "0")}`;
  }

  return "";
}

function parseTimeFromNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "";

  if (value >= 0 && value < 1) {
    const totalMinutes = Math.round(value * 24 * 60);
    const hh = Math.floor(totalMinutes / 60) % 24;
    const mm = totalMinutes % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  if (value >= 1 && value < 60000) {
    const fraction = value - Math.floor(value);
    if (fraction >= 0 && fraction < 1) {
      const totalMinutes = Math.round(fraction * 24 * 60);
      const hh = Math.floor(totalMinutes / 60) % 24;
      const mm = totalMinutes % 60;
      return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }
  }

  return "";
}

function parseTimeCell(cell) {
  if (!cell) return "";

  // Önce ekranda görünen metin
  const fromText = normalizeTimeText(cell.text);
  if (fromText) return fromText;

  // En ham internal numeric/model değer
  const internalRaw =
    cell?._value?.model?.value ??
    cell?._value?.model?.result ??
    cell?.model?.value ??
    (cell?.model && typeof cell.model === "object"
      ? cell.model.result
      : undefined);

  const fromInternalNumber = parseTimeFromNumber(internalRaw);
  if (fromInternalNumber) return fromInternalNumber;

  // Direct numeric
  const fromValueNumber = parseTimeFromNumber(cell.value);
  if (fromValueNumber) return fromValueNumber;

  if (cell.value && typeof cell.value === "object" && "result" in cell.value) {
    const fromResultNumber = parseTimeFromNumber(cell.value.result);
    if (fromResultNumber) return fromResultNumber;
  }

  // Son çare text/date çözümü
  const fromDirect = normalizeTimeText(cell.value);
  if (fromDirect) return fromDirect;

  if (cell.value && typeof cell.value === "object" && "result" in cell.value) {
    const fromResultText = normalizeTimeText(cell.value.result);
    if (fromResultText) return fromResultText;
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
    direksiyon_sonraki_ders_tarih: "",
    direksiyon_sonraki_ders_saati: "",
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

function getWorksheetByName(workbook, wantedName) {
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

function getSheetCellFormattedText(sheet, rowNumber, colNumber) {
  if (!sheet) return "";
  const addr = XLSX.utils.encode_cell({ r: rowNumber - 1, c: colNumber - 1 });
  const cell = sheet[addr];
  if (!cell) return "";
  return t(cell.w ?? cell.v ?? "");
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

function getColorCodes(color) {
  if (!color) return [];
  return [
    t(color?.argb || "").toUpperCase(),
    t(color?.rgb || "").toUpperCase(),
    t(color?.indexed || "").toUpperCase(),
    t(color?.theme || "").toUpperCase(),
  ].filter(Boolean);
}

function getCellFillColorObjects(cell) {
  return [cell?.fill?.fgColor || null, cell?.fill?.bgColor || null].filter(
    Boolean,
  );
}

function getCellFontColorObjects(cell) {
  return [cell?.font?.color || null].filter(Boolean);
}

function getCellFillCodes(cell) {
  return getCellFillColorObjects(cell).flatMap(getColorCodes);
}

function getCellFontCodes(cell) {
  return getCellFontColorObjects(cell).flatMap(getColorCodes);
}

function getAllCellColorCodes(cell) {
  return [...getCellFillCodes(cell), ...getCellFontCodes(cell)];
}

function isSolid(cell) {
  return t(cell?.fill?.patternType).toLowerCase() === "solid";
}

function isWhiteLikeCode(code) {
  return (
    !code ||
    code === "0" ||
    code === "64" ||
    code.includes("FFFFFF") ||
    code.includes("FFFFFE") ||
    code.includes("F2F2F2") ||
    code.includes("00000000")
  );
}

function hasMeaningfulFill(cell) {
  if (!isSolid(cell)) return false;

  const colorObjects = getCellFillColorObjects(cell);
  if (!colorObjects.length) return false;

  return colorObjects.some((color) => {
    const type = t(color?.type).toLowerCase();
    const codes = getColorCodes(color);
    if (!codes.length) return false;

    if (type === "rgb") {
      return codes.some((code) => !isWhiteLikeCode(code));
    }

    if (type === "indexed") {
      return codes.some((code) => code && code !== "64" && code !== "0");
    }

    if (type === "theme") {
      return true;
    }

    return codes.some((code) => code && !isWhiteLikeCode(code));
  });
}

function hasMeaningfulFontColor(cell) {
  const codes = getCellFontCodes(cell);
  if (!codes.length) return false;
  return codes.some((code) => !isWhiteLikeCode(code));
}

function isPaidByFill(cell) {
  return hasMeaningfulFill(cell);
}

function getExcelCellArgb(cell) {
  return getAllCellColorCodes(cell).join("|");
}

function cellHasColor(cell, variants) {
  const codes = getAllCellColorCodes(cell);
  return variants.some((variant) =>
    codes.some((code) => code.includes(variant)),
  );
}

function isGreen(cell) {
  const greenVariants = ["00B050", "92D050", "70AD47", "00AF50", "008000"];
  return cellHasColor(cell, greenVariants);
}

function isBlue(cell) {
  const blueVariants = ["0070C0", "5B9BD5", "4F81BD", "0000FF"];
  return cellHasColor(cell, blueVariants);
}

function setIfEmpty(obj, key, value) {
  const val = t(value);
  if (val && !obj[key]) obj[key] = val;
}

function getCellText(cell) {
  if (!cell) return "";
  if (typeof cell.text === "string" && cell.text.trim()) return t(cell.text);
  if (cell.value && typeof cell.value === "object" && "result" in cell.value) {
    return t(cell.value.result);
  }
  return t(cell.value);
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
  secondNameCell,
) {
  const timeGreen = isGreen(timeStartCell) || isGreen(timeEndCell);

  const nameGreen = isGreen(nameCell) || isGreen(secondNameCell);
  const nameBlue = isBlue(nameCell) || isBlue(secondNameCell);

  const plateGreen = isGreen(plateCell);
  const plateBlue = isBlue(plateCell);

  const phoneGreen = isGreen(phoneCell);
  const phoneBlue = isBlue(phoneCell);

  if (nameGreen && plateGreen && phoneGreen) {
    return "katildi";
  }

  if (timeGreen && (nameBlue || plateBlue || phoneBlue)) {
    return "katilmadi";
  }

  if (timeGreen) {
    return "teyitli";
  }

  return "planlandi";
}

function pickTeacherSheets(workbook) {
  const picked = [];
  const usedNames = new Set();

  for (const wanted of TEACHER_SHEETS) {
    const ws = findWorksheetByNames(workbook, wanted);
    if (ws && !usedNames.has(ws.name)) {
      usedNames.add(ws.name);
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

  for (let r = 3; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);

    const tcValue = tc(getCellText(row.getCell(2)));
    const nameValue = getCellText(row.getCell(3));
    const classValue = getCellText(row.getCell(8));

    if (!tcValue || tcValue.length !== 11) continue;
    if (!nameValue) continue;

    const vehicleValue = getCellText(row.getCell(4));
    const phoneValue = getCellText(row.getCell(5));
    const hasRealStudentSignal = !!(classValue || phoneValue || vehicleValue);

    if (!hasRealStudentSignal) continue;

    const activeStudent = {
      tc: tcValue,
      ad_soyad: nameValue,
      name_key: normalizePersonName(nameValue),
      arac_kodu: vehicleValue,
      telefon: phoneValue,
      kalan_ders: getCellText(row.getCell(6)),
      toplam_ders: getCellText(row.getCell(7)),
      sinif: classValue,
      d_bitis: getCellText(row.getCell(9)),
    };

    byTc.set(activeStudent.tc, activeStudent);
    byName.set(activeStudent.name_key, activeStudent);
  }

  return { byTc, byName };
}

function isWeekHeaderRow(row) {
  const first = normalizeHeader(getCellText(row.getCell(1)));
  return first === "gunler" || first === "günler";
}

function findDateRow(ws, weekHeaderRowNumber) {
  for (
    let r = weekHeaderRowNumber + 1;
    r <= Math.min(ws.rowCount, weekHeaderRowNumber + 3);
    r += 1
  ) {
    let hitCount = 0;

    for (
      let detailCol = 2;
      detailCol <= Math.min(ws.columnCount, 16);
      detailCol += 2
    ) {
      const d = parseExcelDate(
        ws.getRow(r).getCell(detailCol).value,
        DEFAULT_YEAR,
      );
      if (d) hitCount += 1;
    }

    if (hitCount >= 2) return r;
  }

  return 0;
}

function collectWeekSections(ws) {
  const sections = [];

  for (let r = 1; r <= ws.rowCount; r += 1) {
    if (!isWeekHeaderRow(ws.getRow(r))) continue;

    const dateRow = findDateRow(ws, r);
    if (!dateRow) continue;

    sections.push({
      headerRow: r,
      dateRow,
    });
  }

  for (let i = 0; i < sections.length; i += 1) {
    const current = sections[i];
    const next = sections[i + 1];
    current.endRow = next ? next.headerRow - 1 : ws.rowCount;
  }

  return sections;
}

function parseLessons(exceljsWorkbook, xlsxWorkbook, activeLookup) {
  const today = new Date();

  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() - WINDOW_PAST_DAYS);
  minDate.setHours(0, 0, 0, 0);

  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + WINDOW_FUTURE_DAYS);
  maxDate.setHours(23, 59, 59, 999);

  const lessonsByTc = new Map();
  const teacherSheets = pickTeacherSheets(exceljsWorkbook);

  for (const ws of teacherSheets) {
    const teacherName = getCellText(ws.getCell("A1")) || ws.name;
    const xSheet = getSheetByNameXLSX(xlsxWorkbook, ws.name);
    const weekSections = collectWeekSections(ws);

    for (const section of weekSections) {
      for (
        let detailCol = 2;
        detailCol <= Math.min(ws.columnCount, 16);
        detailCol += 2
      ) {
        const timeCol = detailCol - 1;
        const lessonDate = parseExcelDate(
          ws.getRow(section.dateRow).getCell(detailCol).value,
          today.getFullYear(),
        );

        if (!lessonDate) continue;
        if (
          !sameOrAfter(lessonDate, minDate) ||
          !sameOrBefore(lessonDate, maxDate)
        )
          continue;

        for (let r = section.dateRow + 2; r <= section.endRow - 2; r += 1) {
          const startTime =
            normalizeTimeText(getSheetCellFormattedText(xSheet, r, timeCol)) ||
            parseTimeCell(ws.getRow(r).getCell(timeCol));
          const endTime =
            normalizeTimeText(
              getSheetCellFormattedText(xSheet, r + 1, timeCol),
            ) || parseTimeCell(ws.getRow(r + 1).getCell(timeCol));

          if (!startTime || !endTime) continue;

          const plateCell = ws.getRow(r - 1).getCell(detailCol);
          const nameCell1 = ws.getRow(r).getCell(detailCol);
          const phoneCell = ws.getRow(r + 1).getCell(detailCol);
          const noteCell = ws.getRow(r + 2).getCell(detailCol);

          const nameCell2 = undefined;

          const name1 = getCellText(nameCell1);

          const studentName = name1 || "";

          if (!studentName) continue;

          const activeStudent = activeLookup.byName.get(
            normalizePersonName(studentName),
          );
          if (!activeStudent) continue;

          const status = lessonStatusFromCells(
            ws.getRow(r).getCell(timeCol),
            ws.getRow(r + 1).getCell(timeCol),
            plateCell,
            nameCell1,
            phoneCell,
            nameCell2,
          );

          const phoneText = getCellText(phoneCell);
          const noteText = getCellText(noteCell);
          const plateText = getCellText(plateCell);

          const lesson = {
            tarih: asDateText(
              lessonDate.getDate(),
              lessonDate.getMonth() + 1,
              lessonDate.getFullYear(),
            ),
            tarih_iso: dateToIso(lessonDate),
            saat: `${startTime}-${endTime}`,
            baslangic_saati: startTime,
            bitis_saati: endTime,
            egitmen: teacherName,
            ogrenci: activeStudent.ad_soyad,
            tc: activeStudent.tc,
            telefon: /^\d|^0/.test(phoneText.replace(/\s+/g, ""))
              ? phoneText
              : activeStudent.telefon,
            arac_plaka: plateText || activeStudent.arac_kodu,
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

async function applyDireksiyonCalismasi(store) {
  if (!fs.existsSync(DIREKSIYON_CALISMASI_PATH)) {
    console.log(
      "ℹ️ direksiyon_calismasi.xlsx bulunamadı, direksiyon dersleri atlandı.",
    );
    return {
      updatedStudentCount: 0,
      orphanActiveStudentCount: 0,
      totalLessonCount: 0,
      activeStudentCount: 0,
    };
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(DIREKSIYON_CALISMASI_PATH);
  const xlsxBook = XLSX.readFile(DIREKSIYON_CALISMASI_PATH, {
    cellDates: false,
    cellNF: true,
    cellText: true,
  });

  const activeLookup = buildActiveStudentLookup(workbook);
  const lessonsByTc = parseLessons(workbook, xlsxBook, activeLookup);

  let updatedStudentCount = 0;
  let orphanActiveStudentCount = 0;
  let totalLessonCount = 0;

  for (const [activeTc, activeStudent] of activeLookup.byTc.entries()) {
    const student =
      (activeTc ? store.byTc.get(activeTc) : null) ||
      store.byName.get(activeStudent.name_key);

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

    const nextLesson = pickNextLesson(lessons);
    if (nextLesson) {
      student.direksiyon_sonraki_ders_tarih = nextLesson.tarih || "";
      student.direksiyon_sonraki_ders_saati = nextLesson.saat || "";
      student.direksiyon_son_egitmen = nextLesson.egitmen || "";
    } else if (!lessons.length) {
      student.direksiyon_sonraki_ders_tarih = "";
      student.direksiyon_sonraki_ders_saati = "";
      student.direksiyon_son_egitmen = "";
    }

    student.direksiyon_tarih = "";
    student.direksiyon_saati = "";

    updatedStudentCount += 1;
  }

  return {
    updatedStudentCount,
    orphanActiveStudentCount,
    totalLessonCount,
    activeStudentCount: activeLookup.byTc.size,
  };
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

  student.direksiyon_tarih = "";
  student.direksiyon_saati = "";

  if (!student.direksiyon_kalan_ders) student.direksiyon_kalan_ders = "";
  if (!student.direksiyon_toplam_ders) student.direksiyon_toplam_ders = "";
  if (!student.direksiyon_aktif_arac) student.direksiyon_aktif_arac = "";
  if (!student.direksiyon_son_egitmen) student.direksiyon_son_egitmen = "";
  if (!student.direksiyon_sonraki_ders_tarih)
    student.direksiyon_sonraki_ders_tarih = "";
  if (!student.direksiyon_sonraki_ders_saati)
    student.direksiyon_sonraki_ders_saati = "";
}

async function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel dosyası bulunamadı: ${EXCEL_PATH}`);
  }

  const excelBook = new ExcelJS.Workbook();
  await excelBook.xlsx.readFile(EXCEL_PATH);

  const esinavSheetJs = getWorksheetByName(excelBook, "E-SINAV");
  const direksiyonSheetJs = getWorksheetByName(excelBook, "DİREKSİYON");
  const eksikSheetJs = getWorksheetByName(excelBook, "EKSİK BELGELER");
  const alacakSheetJs = getWorksheetByName(excelBook, "ALACAK RAPORU");

  if (!esinavSheetJs || !direksiyonSheetJs || !eksikSheetJs || !alacakSheetJs) {
    throw new Error("Gerekli sayfalardan biri bulunamadı.");
  }

  const store = buildStore();
  const alacakLookup = buildAlacakLookup(alacakSheetJs);

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
    const examTime = normalizeTimeText(
      row.getCell(10).text || row.getCell(10).value,
    );
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

    student.direksiyon_tarih = "";
    student.direksiyon_saati = "";
  }

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
    `📋 Aktif direksiyon listesi öğrenci sayısı: ${direksiyonCalismasiStats.activeStudentCount}`,
  );
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
