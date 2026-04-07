/**
 * scripts/excel-to-json.js
 *
 * Düzeltme:
 * - Direksiyon harcı için önceki mantık herkesi "odenmedi" yapıyordu
 * - Artık ALACAK RAPORU'nda direksiyon harç borcu YOKSA ve öğrenci direksiyon aşamasındaysa
 *   direksiyon_harc = "odendi" yapılır
 * - E-sınav harcı için renk okuma korunur
 * - Saat için xlsx'in görünen "w" değeri kullanılır
 * - Tarihler yıl içermiyorsa 2026'ya çevrilir
 */

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");

const ROOT = path.resolve(__dirname, "..");
const EXCEL_PATH = path.join(ROOT, "excel", "ogrenciler.xlsx");
const OUTPUT_PATH = path.join(ROOT, "docs", "students.json");
const DEFAULT_YEAR = 2026;

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

  const parsedDate = new Date(raw);
  if (!Number.isNaN(parsedDate.getTime())) {
    const y =
      parsedDate.getFullYear() <= 1901
        ? fallbackYear
        : parsedDate.getFullYear();
    return asDateText(parsedDate.getDate(), parsedDate.getMonth() + 1, y);
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

  // KRİTİK DÜZELTME:
  // Direksiyon aşamasındaki öğrenci ALACAK RAPORU'nda direksiyon harç borcu taşımıyorsa
  // harcı ödenmiş kabul et.
  if (
    (student.durum === "direksiyon" ||
      student.direksiyon_tarih ||
      student.direksiyon_saati) &&
    !student.direksiyon_harc_borcu
  ) {
    student.direksiyon_harc = "odendi";
  }

  // Borç varsa kesin ödenmedi olmalı
  if (student.direksiyon_harc_borcu) {
    student.direksiyon_harc = "odenmedi";
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
  const range = XLSX.utils.decode_range(sheet["!ref"]);

  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const addr = XLSX.utils.encode_cell({ r: headerRowNumber - 1, c });
    const cell = sheet[addr];
    const header = normalizeHeader(cell?.w || cell?.v);
    if (header) map.set(header, c);
  }

  return map;
}

function getCellByHeaderExcelJS(row, headerMap, alternatives) {
  for (const alt of alternatives) {
    const col = headerMap.get(normalizeHeader(alt));
    if (col) return row.getCell(col);
  }
  return null;
}

function getCellTextByHeaderExcelJS(row, headerMap, alternatives) {
  const cell = getCellByHeaderExcelJS(row, headerMap, alternatives);
  if (!cell) return "";
  return t(cell.text || cell.value);
}

function getDisplayedTextFromXLSXSheet(
  sheet,
  rowNumber1Based,
  headerMapXLSX,
  alternatives,
) {
  for (const alt of alternatives) {
    const colIndex = headerMapXLSX.get(normalizeHeader(alt));
    if (colIndex !== undefined) {
      const addr = XLSX.utils.encode_cell({
        r: rowNumber1Based - 1,
        c: colIndex,
      });
      const cell = sheet[addr];
      if (!cell) return "";
      return t(cell.w || cell.v);
    }
  }
  return "";
}

function getArgb(cell) {
  if (!cell || !cell.fill) return "";
  const fg = cell.fill.fgColor?.argb || "";
  const bg = cell.fill.bgColor?.argb || "";
  return String(fg || bg || "").toUpperCase();
}

function detectEsinavHarcStatus(cell) {
  if (!cell) return "odenmedi";

  const argb = getArgb(cell).replace(/^FF/, "");
  const rawText = t(cell.text || cell.value).toLocaleLowerCase("tr-TR");

  const greenHints = new Set([
    "00B050",
    "70AD47",
    "92D050",
    "A9D18E",
    "C6E0B4",
    "E2F0D9",
  ]);
  const yellowHints = new Set([
    "FFFF00",
    "FFD966",
    "FFE699",
    "FFF2CC",
    "FFC000",
    "FFE599",
  ]);
  const whiteHints = new Set([
    "FFFFFF",
    "F2F2F2",
    "F7F7F7",
    "EDEDED",
    "FFFFFE",
  ]);

  if (greenHints.has(argb) || yellowHints.has(argb)) return "odendi";
  if (whiteHints.has(argb)) return "odenmedi";

  if (
    ["yeşil", "yesil", "sarı", "sari", "odendi", "ödendi"].includes(rawText)
  ) {
    return "odendi";
  }

  return "odenmedi";
}

async function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel dosyası bulunamadı: ${EXCEL_PATH}`);
  }

  const workbookJs = new ExcelJS.Workbook();
  await workbookJs.xlsx.readFile(EXCEL_PATH);

  const workbookXlsx = XLSX.readFile(EXCEL_PATH, {
    cellDates: false,
    raw: false,
  });

  const store = buildStore();

  const eSinavSheetJs = getWorksheetByName(workbookJs, "E-SINAV");
  const direksiyonSheetJs = getWorksheetByName(workbookJs, "DİREKSİYON");
  const eksikSheetJs = getWorksheetByName(workbookJs, "EKSİK BELGELER");
  const alacakSheetJs = getWorksheetByName(workbookJs, "ALACAK RAPORU");

  const eSinavSheetX =
    workbookXlsx.Sheets["E-SINAV"] || workbookXlsx.Sheets["E-SINAV "];
  const direksiyonSheetX =
    workbookXlsx.Sheets["DİREKSİYON"] || workbookXlsx.Sheets["DİREKSİYON "];
  const alacakSheetX = workbookXlsx.Sheets["ALACAK RAPORU"];

  if (!eSinavSheetJs || !direksiyonSheetJs || !eksikSheetJs || !alacakSheetJs) {
    throw new Error("ExcelJS tarafında gerekli sayfalardan biri eksik.");
  }
  if (!eSinavSheetX || !direksiyonSheetX || !alacakSheetX) {
    throw new Error("xlsx tarafında gerekli sayfalardan biri eksik.");
  }

  const eHeaderRowNo = 2;
  const eHeaderMapJs = buildHeaderMapExcelJS(eSinavSheetJs, eHeaderRowNo);
  const eHeaderMapX = buildHeaderMapXLSX(eSinavSheetX, eHeaderRowNo);
  let eCount = 0;

  for (let r = eHeaderRowNo + 1; r <= eSinavSheetJs.rowCount; r += 1) {
    const row = eSinavSheetJs.getRow(r);
    const tcValue = tc(getCellTextByHeaderExcelJS(row, eHeaderMapJs, ["TC"]));
    const nameValue = t(
      getCellTextByHeaderExcelJS(row, eHeaderMapJs, ["ADI SOYADI"]),
    );
    if (!tcValue && !nameValue) continue;
    eCount += 1;

    const student = getOrCreate(store, tcValue, nameValue);
    setIfEmpty(student, "tc", tcValue);
    setIfEmpty(student, "ad_soyad", nameValue);
    setIfEmpty(
      student,
      "sinif",
      getCellTextByHeaderExcelJS(row, eHeaderMapJs, ["SINIF"]),
    );
    setIfEmpty(
      student,
      "telefonlar",
      getCellTextByHeaderExcelJS(row, eHeaderMapJs, ["TELEFONLAR"]),
    );
    if (!student.durum) student.durum = "esinav";

    const examDateDisplay = getDisplayedTextFromXLSXSheet(
      eSinavSheetX,
      r,
      eHeaderMapX,
      ["SINAV TARİHİ"],
    );
    const examTimeDisplay = getDisplayedTextFromXLSXSheet(
      eSinavSheetX,
      r,
      eHeaderMapX,
      ["SINAV SAATİ"],
    );
    const harcCell = getCellByHeaderExcelJS(row, eHeaderMapJs, [
      "HARÇ",
      "HARC",
    ]);

    const examDate = formatDate(
      examDateDisplay ||
        getCellByHeaderExcelJS(row, eHeaderMapJs, ["SINAV TARİHİ"])?.value,
    );
    const examTime = normalizeTimeText(examTimeDisplay);
    const harcStatus = detectEsinavHarcStatus(harcCell);

    if (examDate) student.esinav_tarih = examDate;
    if (examTime) student.esinav_saati = examTime;
    student.esinav_harc = harcStatus;

    if (!student.evrak_durumu) student.evrak_durumu = "tamam";
  }

  const dHeaderRowNo = 2;
  const dHeaderMapJs = buildHeaderMapExcelJS(direksiyonSheetJs, dHeaderRowNo);
  const dHeaderMapX = buildHeaderMapXLSX(direksiyonSheetX, dHeaderRowNo);
  let dCount = 0;

  for (let r = dHeaderRowNo + 1; r <= direksiyonSheetJs.rowCount; r += 1) {
    const row = direksiyonSheetJs.getRow(r);
    const tcValue = tc(getCellTextByHeaderExcelJS(row, dHeaderMapJs, ["TC"]));
    const nameValue = t(
      getCellTextByHeaderExcelJS(row, dHeaderMapJs, ["ADI SOYADI"]),
    );
    if (!tcValue && !nameValue) continue;
    dCount += 1;

    const student = getOrCreate(store, tcValue, nameValue);
    setIfEmpty(student, "tc", tcValue);
    setIfEmpty(student, "ad_soyad", nameValue);
    setIfEmpty(
      student,
      "sinif",
      getCellTextByHeaderExcelJS(row, dHeaderMapJs, ["SINIF"]),
    );
    setIfEmpty(
      student,
      "telefonlar",
      getCellTextByHeaderExcelJS(row, dHeaderMapJs, [
        "TELEFONLAR",
        "TELEFON",
        "__EMPTY_7",
      ]),
    );
    student.durum = "direksiyon";

    const examDateDisplay = getDisplayedTextFromXLSXSheet(
      direksiyonSheetX,
      r,
      dHeaderMapX,
      ["SINAV TARİHİ", "__EMPTY_8"],
    );
    const examTimeDisplay = getDisplayedTextFromXLSXSheet(
      direksiyonSheetX,
      r,
      dHeaderMapX,
      ["SINAV SAATİ", "__EMPTY_9"],
    );

    const examDate = formatDate(
      examDateDisplay ||
        getCellByHeaderExcelJS(row, dHeaderMapJs, ["SINAV TARİHİ", "__EMPTY_8"])
          ?.value,
    );
    const examTime = normalizeTimeText(examTimeDisplay);

    if (examDate) student.direksiyon_tarih = examDate;
    if (examTime) student.direksiyon_saati = examTime;

    if (!student.evrak_durumu) student.evrak_durumu = "tamam";
  }

  const xHeaderRowNo = 1;
  const xHeaderMapJs = buildHeaderMapExcelJS(eksikSheetJs, xHeaderRowNo);
  let xCount = 0;

  for (let r = xHeaderRowNo + 1; r <= eksikSheetJs.rowCount; r += 1) {
    const row = eksikSheetJs.getRow(r);
    const tcValue = tc(getCellTextByHeaderExcelJS(row, xHeaderMapJs, ["TC"]));
    const nameValue = t(
      getCellTextByHeaderExcelJS(row, xHeaderMapJs, ["ADI SOYADI"]),
    );
    if (!tcValue && !nameValue) continue;
    xCount += 1;

    const student = getOrCreate(store, tcValue, nameValue);
    setIfEmpty(student, "tc", tcValue);
    setIfEmpty(student, "ad_soyad", nameValue);

    const missingList = [
      xMissing(
        getCellTextByHeaderExcelJS(row, xHeaderMapJs, ["SÖZL", "SOZL"]),
        "Sözleşme",
      ),
      xMissing(
        getCellTextByHeaderExcelJS(row, xHeaderMapJs, ["İMZA", "IMZA"]),
        "İmza",
      ),
      xMissing(
        getCellTextByHeaderExcelJS(row, xHeaderMapJs, ["RESİM", "RESIM"]),
        "Resim",
      ),
      xMissing(
        getCellTextByHeaderExcelJS(row, xHeaderMapJs, ["SAĞLIK", "SAGLIK"]),
        "Sağlık Raporu",
      ),
      xMissing(
        getCellTextByHeaderExcelJS(row, xHeaderMapJs, ["ÖĞRENİM", "OGRENIM"]),
        "Öğrenim Belgesi",
      ),
      xMissing(
        getCellTextByHeaderExcelJS(row, xHeaderMapJs, ["SABIKA"]),
        "Sabıka",
      ),
      xMissing(
        getCellTextByHeaderExcelJS(row, xHeaderMapJs, ["İKAMET", "IKAMET"]),
        "İkamet",
      ),
      xMissing(
        getCellTextByHeaderExcelJS(row, xHeaderMapJs, ["WEBCAM"]),
        "Webcam",
      ),
      xMissing(
        getCellTextByHeaderExcelJS(row, xHeaderMapJs, ["KİMLİK", "KIMLIK"]),
        "Kimlik",
      ),
      xMissing(
        getCellTextByHeaderExcelJS(row, xHeaderMapJs, ["EHLİYET", "EHLIYET"]),
        "Ehliyet",
      ),
      xMissing(
        getCellTextByHeaderExcelJS(row, xHeaderMapJs, ["MESAJ"]),
        "Mesaj",
      ),
      xMissing(
        getCellTextByHeaderExcelJS(row, xHeaderMapJs, ["REFERANS"]),
        "Referans",
      ),
    ].filter(Boolean);

    if (missingList.length) {
      student.evrak_durumu = "eksik";
      student.eksik_evraklar = missingList.join(", ");
    } else if (!student.evrak_durumu) {
      student.evrak_durumu = "tamam";
    }
  }

  const aHeaderRowNo = 3;
  const aHeaderMapJs = buildHeaderMapExcelJS(alacakSheetJs, aHeaderRowNo);
  let aCount = 0;

  for (let r = aHeaderRowNo + 1; r <= alacakSheetJs.rowCount; r += 1) {
    const row = alacakSheetJs.getRow(r);
    const nameValue = t(
      getCellTextByHeaderExcelJS(row, aHeaderMapJs, ["ADI SOYADI"]),
    );
    if (!nameValue) continue;
    aCount += 1;

    const student = getOrCreate(store, "", nameValue);
    setIfEmpty(student, "ad_soyad", nameValue);

    const eDebt = money(
      getCellTextByHeaderExcelJS(row, aHeaderMapJs, ["E SINAV HARCI"]),
    );
    const dDebt = money(
      getCellTextByHeaderExcelJS(row, aHeaderMapJs, [
        "DİREKSİYON SINAV HARCI",
        "DIREKSIYON SINAV HARCI",
      ]),
    );
    const installment = money(
      getCellTextByHeaderExcelJS(row, aHeaderMapJs, ["TAKSİT", "TAKSIT"]),
    );
    const dueDate = formatDate(
      getCellTextByHeaderExcelJS(row, aHeaderMapJs, ["TARİH", "TARIH"]) ||
        getCellByHeaderExcelJS(row, aHeaderMapJs, ["TARİH", "TARIH"])?.value,
    );

    if (eDebt) {
      student.esinav_harc_borcu = eDebt;
      student.esinav_borc_son_odeme = dueDate;
      if (!student.esinav_son_odeme) student.esinav_son_odeme = dueDate;
      if (!student.esinav_harc) student.esinav_harc = "odenmedi";
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
