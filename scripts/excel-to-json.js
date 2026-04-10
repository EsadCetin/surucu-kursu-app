/**
 * scripts/excel-to-json.js
 *
 * Güncel sürüm.
 *
 * Ne değişti:
 * - E-SINAV sayfasındaki yeni "SON ÖDEME / SON ÖDEME TARİHİ" sütunu okunur
 * - E-sınav ücreti sabit 1.250₺ kabul edilir
 * - E-sınav ödemesi yapılmamışsa harç borcu 1.250₺ yazılır
 * - Son ödeme tarihi varsa esinav_son_odeme ve esinav_borc_son_odeme alanlarına yazılır
 * - Son ödeme tarihi yoksa tarih alanı boş bırakılır
 * - Saat için xlsx'in görünen değeri kullanılır
 * - Renk için ExcelJS kullanılır
 * - docs/students.json üretir
 */

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");

const ROOT = path.resolve(__dirname, "..");
const EXCEL_PATH = path.join(ROOT, "excel", "ogrenciler.xlsx");
const OUTPUT_PATH = path.join(ROOT, "docs", "students.json");
const DEFAULT_YEAR = 2026;
const ESINAV_FIXED_FEE = "1.250₺";

function t(v) {
  return String(v ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tc(v) {
  return t(v).replace(/\D/g, "");
}

function nameKey(v) {
  return t(v).toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
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

function asDateText(day, month, year = DEFAULT_YEAR) {
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

function formatDate(v, fallbackYear = DEFAULT_YEAR) {
  if (v == null || v === "") return "";

  if (v instanceof Date && !isNaN(v.getTime())) {
    const d = v.getDate();
    const m = v.getMonth() + 1;
    const y = v.getFullYear();
    return asDateText(d, m, y <= 1901 ? fallbackYear : y);
  }

  if (typeof v === "object" && v && typeof v.text === "string") {
    return formatDate(v.text, fallbackYear);
  }

  if (typeof v === "number" && !Number.isNaN(v)) {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (parsed && parsed.m && parsed.d) {
      const y = !parsed.y || parsed.y <= 1901 ? fallbackYear : parsed.y;
      return asDateText(parsed.d, parsed.m, y);
    }
  }

  const raw = t(v);
  if (!raw) return "";

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) return raw;

  if (/^\d{1,2}[,.]\d{1,2}$/.test(raw)) {
    const [d, m] = raw.replace(",", ".").split(".");
    return asDateText(Number(d), Number(m), fallbackYear);
  }

  if (/^\d{1,2}[.,]\d{1,2}[.,]\d{2}$/.test(raw)) {
    const [d, m, y2] = raw.replace(/,/g, ".").split(".");
    return asDateText(Number(d), Number(m), 2000 + Number(y2));
  }

  if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split(/[/-]/);
    const yy = Number(y) <= 1901 ? fallbackYear : Number(y);
    return asDateText(Number(d), Number(m), yy);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-");
    const yy = Number(y) <= 1901 ? fallbackYear : Number(y);
    return asDateText(Number(d), Number(m), yy);
  }

  return raw;
}

function normalizeTimeText(rawValue) {
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
    esinav_harc_borcu: "",
    esinav_borc_son_odeme: "",
    direksiyon_harc_borcu: "",
    direksiyon_borc_son_odeme: "",
    taksit_borcu: "",
    taksit_son_odeme: "",
  };
}

function setIfEmpty(obj, key, value) {
  if (Array.isArray(value)) {
    if (!obj[key] || !obj[key].length) obj[key] = value;
    return;
  }
  const val = t(value);
  if (val && !obj[key]) obj[key] = val;
}

function buildStore() {
  return { byTc: new Map(), byName: new Map() };
}

function getOrCreate(store, tcValue, nameValue) {
  const cleanTc = tc(tcValue);
  const cleanName = t(nameValue);

  if (cleanTc && store.byTc.has(cleanTc)) return store.byTc.get(cleanTc);

  const normName = nameKey(cleanName);
  if (normName && store.byName.has(normName)) {
    const existing = store.byName.get(normName);
    if (cleanTc && !existing.tc) {
      existing.tc = cleanTc;
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

function xMissing(value, label) {
  return t(value).toLocaleUpperCase("tr-TR") === "X" ? label : "";
}

function hasValue(value) {
  return !!t(value);
}

function isPaidStatus(value) {
  return t(value) === "odendi";
}

function isUnpaidStatus(value) {
  return t(value) === "odenmedi";
}

function syncDerivedFields(student) {
  if (!student.evrak_durumu) {
    student.evrak_durumu = student.eksik_evraklar ? "eksik" : "tamam";
  }

  if (!student.esinav_harc && student.esinav_harc_borcu) {
    student.esinav_harc = "odenmedi";
  }

  if (!student.esinav_son_odeme && student.esinav_borc_son_odeme) {
    student.esinav_son_odeme = student.esinav_borc_son_odeme;
  }

  if (!student.direksiyon_son_odeme && student.direksiyon_borc_son_odeme) {
    student.direksiyon_son_odeme = student.direksiyon_borc_son_odeme;
  }

  if (!student.durum) {
    if (
      student.direksiyon_harc_borcu ||
      student.direksiyon_tarih ||
      student.direksiyon_saati
    ) {
      student.durum = "direksiyon";
    } else if (
      student.esinav_harc_borcu ||
      student.esinav_tarih ||
      student.esinav_saati
    ) {
      student.durum = "esinav";
    }
  }

  if (
    (student.durum === "direksiyon" ||
      student.direksiyon_tarih ||
      student.direksiyon_saati) &&
    !student.direksiyon_harc_borcu
  ) {
    student.direksiyon_harc = "odendi";
  }

  if (!Array.isArray(student.direksiyon_dersleri)) {
    student.direksiyon_dersleri = [];
  }
}

function getWorksheetByName(workbook, wantedName) {
  const wanted = normalizeHeader(wantedName);
  return workbook.worksheets.find((ws) => normalizeHeader(ws.name) === wanted);
}

function buildHeaderMapExcelJS(ws, headerRowNumber) {
  const headerRow = ws.getRow(headerRowNumber);
  const map = new Map();

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = normalizeHeader(cell.text || cell.value);
    if (header) map.set(header, colNumber);
  });

  return map;
}

function buildHeaderMapXLSX(sheet, headerRowNumber) {
  const map = new Map();
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");

  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const address = XLSX.utils.encode_cell({ r: headerRowNumber - 1, c });
    const cell = sheet[address];
    const header = normalizeHeader(cell?.w || cell?.v || "");
    if (header) map.set(header, c + 1);
  }

  return map;
}

function getColumnNumber(headerMap, headerCandidates) {
  for (const header of headerCandidates) {
    const colNo = headerMap.get(normalizeHeader(header));
    if (colNo) return colNo;
  }
  return 0;
}

function getCellByHeaderExcelJS(row, headerMap, headerCandidates) {
  const colNo = getColumnNumber(headerMap, headerCandidates);
  return colNo ? row.getCell(colNo) : null;
}

function getCellTextByHeaderExcelJS(row, headerMap, headerCandidates) {
  const cell = getCellByHeaderExcelJS(row, headerMap, headerCandidates);
  if (!cell) return "";
  return t(cell.text || cell.value);
}

function getDisplayedCellTextXLSX(
  sheet,
  rowNumber,
  headerMap,
  headerCandidates,
) {
  const colNo = getColumnNumber(headerMap, headerCandidates);
  if (!colNo) return "";

  const address = XLSX.utils.encode_cell({ r: rowNumber - 1, c: colNo - 1 });
  const cell = sheet[address];
  if (!cell) return "";

  return t(cell.w || cell.v);
}

function getFormattedDateFromCells(
  displayedText,
  rawValue,
  fallbackYear = DEFAULT_YEAR,
) {
  const fromDisplayed = formatDate(displayedText, fallbackYear);
  if (fromDisplayed) return fromDisplayed;
  return formatDate(rawValue, fallbackYear);
}

function getExcelCellArgb(cell) {
  const argb =
    cell?.fill?.fgColor?.argb || cell?.style?.fill?.fgColor?.argb || "";
  return t(argb).toUpperCase();
}

function getHarcStatusByColor(cell) {
  const argb = getExcelCellArgb(cell);

  if (!argb) return "odenmedi";

  if (
    argb.includes("92D050") ||
    argb.includes("00B050") ||
    argb.includes("FFFF00") ||
    argb.includes("FFD966") ||
    argb.includes("FFE699")
  ) {
    return "odendi";
  }

  return "odenmedi";
}

function uniqStrings(values) {
  return [...new Set(values.map((item) => t(item)).filter(Boolean))];
}

function applyEsinavFixedFee(student, dueDate) {
  student.esinav_harc = "odenmedi";
  student.esinav_harc_borcu = ESINAV_FIXED_FEE;

  if (dueDate) {
    student.esinav_son_odeme = dueDate;
    student.esinav_borc_son_odeme = dueDate;
  }
}

async function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel dosyası bulunamadı: ${EXCEL_PATH}`);
  }

  const xlsxBook = XLSX.readFile(EXCEL_PATH, { cellStyles: true });
  const exceljsBook = new ExcelJS.Workbook();
  await exceljsBook.xlsx.readFile(EXCEL_PATH);

  const esinavSheetJs = getWorksheetByName(exceljsBook, "E-SINAV");
  const direksiyonSheetJs = getWorksheetByName(exceljsBook, "DİREKSİYON");
  const eksikSheetJs = getWorksheetByName(exceljsBook, "EKSİK BELGELER");
  const alacakSheetJs = getWorksheetByName(exceljsBook, "ALACAK RAPORU");

  const esinavSheetX =
    xlsxBook.Sheets[
      xlsxBook.SheetNames.find(
        (name) => normalizeHeader(name) === normalizeHeader("E-SINAV"),
      )
    ];
  const direksiyonSheetX =
    xlsxBook.Sheets[
      xlsxBook.SheetNames.find(
        (name) => normalizeHeader(name) === normalizeHeader("DİREKSİYON"),
      )
    ];
  const alacakSheetX =
    xlsxBook.Sheets[
      xlsxBook.SheetNames.find(
        (name) => normalizeHeader(name) === normalizeHeader("ALACAK RAPORU"),
      )
    ];

  if (!esinavSheetJs || !direksiyonSheetJs || !eksikSheetJs || !alacakSheetJs) {
    throw new Error(
      "Gerekli sayfalardan biri bulunamadı. E-SINAV / DİREKSİYON / EKSİK BELGELER / ALACAK RAPORU kontrol et.",
    );
  }

  if (!esinavSheetX || !direksiyonSheetX || !alacakSheetX) {
    throw new Error(
      "xlsx tarafında gerekli sayfalardan biri bulunamadı. E-SINAV / DİREKSİYON / ALACAK RAPORU kontrol et.",
    );
  }

  const store = buildStore();

  // E-SINAV
  const eHeaderRowNo = 2;
  const eHeaderMapJs = buildHeaderMapExcelJS(esinavSheetJs, eHeaderRowNo);
  const eHeaderMapX = buildHeaderMapXLSX(esinavSheetX, eHeaderRowNo);
  let eCount = 0;

  for (let r = eHeaderRowNo + 1; r <= esinavSheetJs.rowCount; r += 1) {
    const rowJs = esinavSheetJs.getRow(r);
    const nameValue = t(
      getCellTextByHeaderExcelJS(rowJs, eHeaderMapJs, [
        "ADI SOYADI",
        "ADI SOYADI",
      ]),
    );
    if (!nameValue) continue;
    eCount += 1;

    const student = getOrCreate(
      store,
      getCellTextByHeaderExcelJS(rowJs, eHeaderMapJs, ["TC", "T.C.", "T C"]),
      nameValue,
    );

    setIfEmpty(student, "ad_soyad", nameValue);
    setIfEmpty(
      student,
      "tc",
      getCellTextByHeaderExcelJS(rowJs, eHeaderMapJs, ["TC", "T.C.", "T C"]),
    );
    setIfEmpty(
      student,
      "sinif",
      getCellTextByHeaderExcelJS(rowJs, eHeaderMapJs, ["SINIF"]),
    );
    setIfEmpty(
      student,
      "telefonlar",
      getCellTextByHeaderExcelJS(rowJs, eHeaderMapJs, [
        "TELEFONLAR",
        "TELEFON",
      ]),
    );

    student.durum = "esinav";

    const harcCell = getCellByHeaderExcelJS(rowJs, eHeaderMapJs, [
      "E SINAV HARCI",
      "E-SINAV HARCI",
      "HARÇ",
      "HARC",
      "E SINAV UCRETI",
      "E SINAV ÜCRETİ",
    ]);

    const dueDate = getFormattedDateFromCells(
      getDisplayedCellTextXLSX(esinavSheetX, r, eHeaderMapX, [
        "SON ODEME",
        "SON ODEME TARIHI",
        "SON ODEME TARIH",
        "SON ÖDEME",
        "SON ÖDEME TARİHİ",
        "SON ÖDEME TARİH",
        "ODEME SON TARIHI",
        "ÖDEME SON TARİHİ",
      ]),
      getCellByHeaderExcelJS(rowJs, eHeaderMapJs, [
        "SON ODEME",
        "SON ODEME TARIHI",
        "SON ODEME TARIH",
        "SON ÖDEME",
        "SON ÖDEME TARİHİ",
        "SON ÖDEME TARİH",
        "ODEME SON TARIHI",
        "ÖDEME SON TARİHİ",
      ])?.value,
    );

    const examDate = getFormattedDateFromCells(
      getDisplayedCellTextXLSX(esinavSheetX, r, eHeaderMapX, [
        "SINAV TARIHI",
        "SINAV TARİHİ",
      ]),
      getCellByHeaderExcelJS(rowJs, eHeaderMapJs, [
        "SINAV TARIHI",
        "SINAV TARİHİ",
      ])?.value,
    );

    const examTime = normalizeTimeText(
      getDisplayedCellTextXLSX(esinavSheetX, r, eHeaderMapX, ["SINAV SAATI"]),
    );

    const resultText = normalizeHeader(
      getCellTextByHeaderExcelJS(rowJs, eHeaderMapJs, ["SONUC", "SONUÇ"]),
    );

    const harcStatus = getHarcStatusByColor(harcCell);

    if (examDate) student.esinav_tarih = examDate;
    if (examTime) student.esinav_saati = examTime;
    if (dueDate) student.esinav_son_odeme = dueDate;

    if (resultText.includes("gecti") || resultText.includes("gecti")) {
      student.esinav_sonuc = "gecti";
    } else if (resultText.includes("kaldi") || resultText.includes("kaldi")) {
      student.esinav_sonuc = "kaldi";
    }

    if (isPaidStatus(harcStatus)) {
      student.esinav_harc = "odendi";
      student.esinav_harc_borcu = "";
      student.esinav_borc_son_odeme = "";
    } else {
      applyEsinavFixedFee(student, dueDate);
    }
  }

  // DİREKSİYON
  const dHeaderRowNo = 2;
  const dHeaderMapJs = buildHeaderMapExcelJS(direksiyonSheetJs, dHeaderRowNo);
  const dHeaderMapX = buildHeaderMapXLSX(direksiyonSheetX, dHeaderRowNo);
  let dCount = 0;

  for (let r = dHeaderRowNo + 1; r <= direksiyonSheetJs.rowCount; r += 1) {
    const rowJs = direksiyonSheetJs.getRow(r);
    const nameValue = t(
      getCellTextByHeaderExcelJS(rowJs, dHeaderMapJs, [
        "ADI SOYADI",
        "AD SOYAD",
      ]),
    );
    if (!nameValue) continue;
    dCount += 1;

    const student = getOrCreate(
      store,
      getCellTextByHeaderExcelJS(rowJs, dHeaderMapJs, ["TC", "T.C.", "T C"]),
      nameValue,
    );

    setIfEmpty(student, "ad_soyad", nameValue);
    setIfEmpty(
      student,
      "tc",
      getCellTextByHeaderExcelJS(rowJs, dHeaderMapJs, ["TC", "T.C.", "T C"]),
    );
    setIfEmpty(
      student,
      "sinif",
      getCellTextByHeaderExcelJS(rowJs, dHeaderMapJs, ["SINIF"]),
    );
    setIfEmpty(
      student,
      "telefonlar",
      getCellTextByHeaderExcelJS(rowJs, dHeaderMapJs, [
        "TELEFONLAR",
        "TELEFON",
      ]),
    );

    student.durum = "direksiyon";

    const harcCell = getCellByHeaderExcelJS(rowJs, dHeaderMapJs, [
      "DIREKSIYON HARCI",
      "DİREKSİYON HARCI",
      "DIREKSIYON SINAV HARCI",
      "DİREKSİYON SINAV HARCI",
      "HARÇ",
      "HARC",
    ]);

    const examDate = getFormattedDateFromCells(
      getDisplayedCellTextXLSX(direksiyonSheetX, r, dHeaderMapX, [
        "SINAV TARIHI",
        "SINAV TARİHİ",
      ]),
      getCellByHeaderExcelJS(rowJs, dHeaderMapJs, [
        "SINAV TARIHI",
        "SINAV TARİHİ",
      ])?.value,
    );

    const examTime = normalizeTimeText(
      getDisplayedCellTextXLSX(direksiyonSheetX, r, dHeaderMapX, [
        "SINAV SAATI",
      ]),
    );

    const dueDate = getFormattedDateFromCells(
      getDisplayedCellTextXLSX(direksiyonSheetX, r, dHeaderMapX, [
        "SON ODEME",
        "SON ODEME TARIHI",
        "SON ÖDEME",
        "SON ÖDEME TARİHİ",
      ]),
      getCellByHeaderExcelJS(rowJs, dHeaderMapJs, [
        "SON ODEME",
        "SON ODEME TARIHI",
        "SON ÖDEME",
        "SON ÖDEME TARİHİ",
      ])?.value,
    );

    const resultText = normalizeHeader(
      getCellTextByHeaderExcelJS(rowJs, dHeaderMapJs, ["SONUC", "SONUÇ"]),
    );

    student.direksiyon_harc = getHarcStatusByColor(harcCell);
    if (examDate) student.direksiyon_tarih = examDate;
    if (examTime) student.direksiyon_saati = examTime;
    if (dueDate) student.direksiyon_son_odeme = dueDate;

    if (resultText.includes("gecti") || resultText.includes("gecti")) {
      student.direksiyon_sonuc = "gecti";
    } else if (resultText.includes("kaldi")) {
      student.direksiyon_sonuc = "kaldi";
    }

    const lessonDate = getFormattedDateFromCells(
      getDisplayedCellTextXLSX(direksiyonSheetX, r, dHeaderMapX, [
        "DERS TARIHI",
        "DERS TARİHİ",
        "TARIH",
        "TARİH",
      ]),
      getCellByHeaderExcelJS(rowJs, dHeaderMapJs, [
        "DERS TARIHI",
        "DERS TARİHİ",
        "TARIH",
        "TARİH",
      ])?.value,
    );
    const lessonTime = normalizeTimeText(
      getDisplayedCellTextXLSX(direksiyonSheetX, r, dHeaderMapX, [
        "DERS SAATI",
        "SAAT",
      ]),
    );

    if (lessonDate || lessonTime) {
      student.direksiyon_dersleri.push({
        tarih: lessonDate,
        saat: lessonTime,
        not: lessonDate || lessonTime ? "Direksiyon dersi" : "",
      });
    }
  }

  // EKSİK BELGELER
  const xHeaderRowNo = 2;
  const xHeaderMapJs = buildHeaderMapExcelJS(eksikSheetJs, xHeaderRowNo);
  let xCount = 0;

  for (let r = xHeaderRowNo + 1; r <= eksikSheetJs.rowCount; r += 1) {
    const rowJs = eksikSheetJs.getRow(r);
    const nameValue = t(
      getCellTextByHeaderExcelJS(rowJs, xHeaderMapJs, [
        "ADI SOYADI",
        "ADI SOYADI",
      ]),
    );
    if (!nameValue) continue;
    xCount += 1;

    const student = getOrCreate(
      store,
      getCellTextByHeaderExcelJS(rowJs, xHeaderMapJs, ["TC", "T.C.", "T C"]),
      nameValue,
    );

    setIfEmpty(student, "ad_soyad", nameValue);
    setIfEmpty(
      student,
      "tc",
      getCellTextByHeaderExcelJS(rowJs, xHeaderMapJs, ["TC", "T.C.", "T C"]),
    );

    const missingList = uniqStrings([
      xMissing(
        getCellTextByHeaderExcelJS(rowJs, xHeaderMapJs, [
          "OGRENIM BELGESI",
          "ÖĞRENİM BELGESİ",
        ]),
        "Öğrenim belgesi",
      ),
      xMissing(
        getCellTextByHeaderExcelJS(rowJs, xHeaderMapJs, ["SABIKA KAYDI"]),
        "Sabıka kaydı",
      ),
      xMissing(
        getCellTextByHeaderExcelJS(rowJs, xHeaderMapJs, [
          "SAGLIK RAPORU",
          "SAĞLIK RAPORU",
        ]),
        "Sağlık raporu",
      ),
      xMissing(
        getCellTextByHeaderExcelJS(rowJs, xHeaderMapJs, [
          "BIYOMETRIK",
          "BİYOMETRİK",
          "FOTOGRAF",
        ]),
        "Biyometrik fotoğraf",
      ),
      xMissing(
        getCellTextByHeaderExcelJS(rowJs, xHeaderMapJs, [
          "IKAMETGAH",
          "İKAMETGAH",
          "ADRES BELGESI",
          "ADRES BELGESİ",
        ]),
        "İkametgah / adres belgesi",
      ),
      xMissing(
        getCellTextByHeaderExcelJS(rowJs, xHeaderMapJs, ["KAN GRUBU"]),
        "Kan grubu belgesi",
      ),
      xMissing(
        getCellTextByHeaderExcelJS(rowJs, xHeaderMapJs, ["DIPLOMA"]),
        "Diploma",
      ),
      xMissing(
        getCellTextByHeaderExcelJS(rowJs, xHeaderMapJs, [
          "KIMLIK FOTOKOPISI",
          "KİMLİK FOTOKOPİSİ",
        ]),
        "Kimlik fotokopisi",
      ),
    ]);

    if (missingList.length) {
      student.evrak_durumu = "eksik";
      student.eksik_evraklar = missingList.join(", ");
    } else if (!student.evrak_durumu) {
      student.evrak_durumu = "tamam";
    }
  }

  // ALACAK RAPORU
  const aHeaderRowNo = 3;
  const aHeaderMapJs = buildHeaderMapExcelJS(alacakSheetJs, aHeaderRowNo);
  const aHeaderMapX = buildHeaderMapXLSX(alacakSheetX, aHeaderRowNo);
  let aCount = 0;

  for (let r = aHeaderRowNo + 1; r <= alacakSheetJs.rowCount; r += 1) {
    const rowJs = alacakSheetJs.getRow(r);
    const nameValue = t(
      getCellTextByHeaderExcelJS(rowJs, aHeaderMapJs, [
        "ADI SOYADI",
        "AD SOYAD",
      ]),
    );
    if (!nameValue) continue;
    aCount += 1;

    const student = getOrCreate(store, "", nameValue);
    setIfEmpty(student, "ad_soyad", nameValue);

    const eDebt = money(
      getCellTextByHeaderExcelJS(rowJs, aHeaderMapJs, [
        "E SINAV HARCI",
        "E-SINAV HARCI",
        "E SINAV BORCU",
        "E-SINAV BORCU",
      ]),
    );
    const dDebt = money(
      getCellTextByHeaderExcelJS(rowJs, aHeaderMapJs, [
        "DİREKSİYON SINAV HARCI",
        "DIREKSIYON SINAV HARCI",
        "DİREKSİYON HARCI",
        "DIREKSIYON HARCI",
      ]),
    );
    const installment = money(
      getCellTextByHeaderExcelJS(rowJs, aHeaderMapJs, ["TAKSİT", "TAKSIT"]),
    );
    const dueDate = getFormattedDateFromCells(
      getDisplayedCellTextXLSX(alacakSheetX, r, aHeaderMapX, [
        "TARİH",
        "TARIH",
        "SON ODEME",
        "SON ÖDEME",
        "SON ODEME TARIHI",
        "SON ÖDEME TARİHİ",
      ]),
      getCellByHeaderExcelJS(rowJs, aHeaderMapJs, [
        "TARİH",
        "TARIH",
        "SON ODEME",
        "SON ÖDEME",
        "SON ODEME TARIHI",
        "SON ÖDEME TARİHİ",
      ])?.value,
    );

    if (eDebt && !student.esinav_harc_borcu) {
      student.esinav_harc_borcu = eDebt;
      if (!student.esinav_harc) student.esinav_harc = "odenmedi";
      if (dueDate && !student.esinav_borc_son_odeme)
        student.esinav_borc_son_odeme = dueDate;
      if (dueDate && !student.esinav_son_odeme)
        student.esinav_son_odeme = dueDate;
    }

    if (dDebt) {
      student.direksiyon_harc_borcu = dDebt;
      student.direksiyon_borc_son_odeme = dueDate;
      if (!student.direksiyon_son_odeme) student.direksiyon_son_odeme = dueDate;
      student.direksiyon_harc = "odenmedi";
    }

    if (installment) {
      student.taksit_borcu = installment;
      student.taksit_son_odeme = dueDate;
    }
  }

  const result = allStudents(store)
    .filter((student) => student.tc || student.ad_soyad)
    .map((student) => {
      syncDerivedFields(student);
      return student;
    })
    .sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, "tr"));

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), "utf-8");

  console.log("✅ students.json oluşturuldu");
  console.log(`📄 E-SINAV öğrenci: ${eCount}`);
  console.log(`📄 DİREKSİYON öğrenci: ${dCount}`);
  console.log(`📄 EKSİK BELGELER öğrenci: ${xCount}`);
  console.log(`📄 ALACAK RAPORU öğrenci: ${aCount}`);
  console.log(`👤 Toplam benzersiz öğrenci: ${result.length}`);
}

main().catch((err) => {
  console.error("❌ excel-to-json hatası:", err);
  process.exit(1);
});
