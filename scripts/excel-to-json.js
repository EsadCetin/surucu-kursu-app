/**
 * scripts/excel-to-json.js
 *
 * ExcelJS tabanlı sürüm.
 *
 * Düzeltme:
 * - Saatler artık Date objesinden üretilmiyor
 * - Hücrede ekranda ne görünüyorsa önce onu okuyor
 * - Böylece SINAV SAATİ sütununda ne yazıyorsa o saat alınır
 *
 * Kullanım:
 *   node scripts/excel-to-json.js
 */

const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const ROOT = path.resolve(__dirname, "..");
const EXCEL_PATH = path.join(ROOT, "excel", "ogrenciler.xlsx");
const OUTPUT_PATH = path.join(ROOT, "docs", "students.json");

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

function excelDateToText(dateObj) {
  const d = String(dateObj.getDate()).padStart(2, "0");
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const y = dateObj.getFullYear();
  return `${d}.${m}.${y}`;
}

function formatDate(v, fallbackYear = 2026) {
  if (v == null || v === "") return "";

  if (v instanceof Date && !isNaN(v.getTime())) {
    return excelDateToText(v);
  }

  if (typeof v === "object" && v && v.text) {
    return formatDate(v.text, fallbackYear);
  }

  const raw = t(v);
  if (!raw) return "";

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) return raw;

  if (/^\d{1,2}[,.]\d{1,2}$/.test(raw)) {
    const [d, m] = raw.replace(",", ".").split(".");
    return `${String(Number(d)).padStart(2, "0")}.${String(Number(m)).padStart(2, "0")}.${fallbackYear}`;
  }

  if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split(/[/-]/);
    return `${d}.${m}.${y}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-");
    return `${d}.${m}.${y}`;
  }

  return raw;
}

function formatTimeFromRaw(rawValue) {
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

  return raw;
}

function formatTimeFromCell(cell) {
  if (!cell) return "";

  // 1) Excel'de ekranda görünen metin neyse önce onu kullan
  const displayText = t(cell.text);
  const parsedDisplay = formatTimeFromRaw(displayText);
  if (parsedDisplay && /^\d{2}:\d{2}$/.test(parsedDisplay)) {
    return parsedDisplay;
  }

  // 2) Hücre değeri string ise onu kullan
  if (typeof cell.value === "string") {
    const parsed = formatTimeFromRaw(cell.value);
    if (parsed) return parsed;
  }

  // 3) Zorunlu fallback: sayı ise Excel time fraction olabilir
  if (typeof cell.value === "number" && !Number.isNaN(cell.value)) {
    const totalMinutes = Math.round(cell.value * 24 * 60);
    const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    return `${hh}:${mm}`;
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

  if (!student.direksiyon_harc && student.direksiyon_harc_borcu) {
    student.direksiyon_harc = "odenmedi";
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

  if (!Array.isArray(student.direksiyon_dersleri)) {
    student.direksiyon_dersleri = [];
  }
}

function getWorksheetByName(workbook, wantedName) {
  const wanted = normalizeHeader(wantedName);
  return workbook.worksheets.find((ws) => normalizeHeader(ws.name) === wanted);
}

function buildHeaderMap(ws, headerRowNumber) {
  const headerRow = ws.getRow(headerRowNumber);
  const map = new Map();

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = normalizeHeader(cell.text || cell.value);
    if (header) map.set(header, colNumber);
  });

  return map;
}

function getCellByHeader(row, headerMap, alternatives) {
  for (const alt of alternatives) {
    const col = headerMap.get(normalizeHeader(alt));
    if (col) return row.getCell(col);
  }
  return null;
}

function getCellTextByHeader(row, headerMap, alternatives) {
  const cell = getCellByHeader(row, headerMap, alternatives);
  if (!cell) return "";
  return t(cell.text || cell.value);
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

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);

  const store = buildStore();

  const eSinavSheet = getWorksheetByName(workbook, "E-SINAV");
  const direksiyonSheet = getWorksheetByName(workbook, "DİREKSİYON");
  const eksikSheet = getWorksheetByName(workbook, "EKSİK BELGELER");
  const alacakSheet = getWorksheetByName(workbook, "ALACAK RAPORU");

  if (!eSinavSheet || !direksiyonSheet || !eksikSheet || !alacakSheet) {
    throw new Error("Gerekli sayfalardan biri eksik.");
  }

  const eHeaderRowNo = 2;
  const eHeaderMap = buildHeaderMap(eSinavSheet, eHeaderRowNo);
  let eCount = 0;

  for (let r = eHeaderRowNo + 1; r <= eSinavSheet.rowCount; r += 1) {
    const row = eSinavSheet.getRow(r);
    const tcValue = tc(getCellTextByHeader(row, eHeaderMap, ["TC"]));
    const nameValue = t(getCellTextByHeader(row, eHeaderMap, ["ADI SOYADI"]));
    if (!tcValue && !nameValue) continue;
    eCount += 1;

    const student = getOrCreate(store, tcValue, nameValue);
    setIfEmpty(student, "tc", tcValue);
    setIfEmpty(student, "ad_soyad", nameValue);
    setIfEmpty(
      student,
      "sinif",
      getCellTextByHeader(row, eHeaderMap, ["SINIF"]),
    );
    setIfEmpty(
      student,
      "telefonlar",
      getCellTextByHeader(row, eHeaderMap, ["TELEFONLAR"]),
    );
    if (!student.durum) student.durum = "esinav";

    const examDateCell = getCellByHeader(row, eHeaderMap, ["SINAV TARİHİ"]);
    const examTimeCell = getCellByHeader(row, eHeaderMap, ["SINAV SAATİ"]);
    const harcCell = getCellByHeader(row, eHeaderMap, ["HARÇ", "HARC"]);

    const examDate = formatDate(examDateCell?.value);
    const examTime = formatTimeFromCell(examTimeCell);
    const harcStatus = detectEsinavHarcStatus(harcCell);

    if (examDate) student.esinav_tarih = examDate;
    if (examTime) student.esinav_saati = examTime;
    student.esinav_harc = harcStatus;

    if (!student.evrak_durumu) student.evrak_durumu = "tamam";
  }

  const dHeaderRowNo = 2;
  const dHeaderMap = buildHeaderMap(direksiyonSheet, dHeaderRowNo);
  let dCount = 0;

  for (let r = dHeaderRowNo + 1; r <= direksiyonSheet.rowCount; r += 1) {
    const row = direksiyonSheet.getRow(r);
    const tcValue = tc(getCellTextByHeader(row, dHeaderMap, ["TC"]));
    const nameValue = t(getCellTextByHeader(row, dHeaderMap, ["ADI SOYADI"]));
    if (!tcValue && !nameValue) continue;
    dCount += 1;

    const student = getOrCreate(store, tcValue, nameValue);
    setIfEmpty(student, "tc", tcValue);
    setIfEmpty(student, "ad_soyad", nameValue);
    setIfEmpty(
      student,
      "sinif",
      getCellTextByHeader(row, dHeaderMap, ["SINIF"]),
    );
    setIfEmpty(
      student,
      "telefonlar",
      getCellTextByHeader(row, dHeaderMap, [
        "TELEFONLAR",
        "TELEFON",
        "__EMPTY_7",
      ]),
    );
    student.durum = "direksiyon";

    const examDate = formatDate(
      getCellByHeader(row, dHeaderMap, ["SINAV TARİHİ", "__EMPTY_8"])?.value,
    );
    const examTime = formatTimeFromCell(
      getCellByHeader(row, dHeaderMap, ["SINAV SAATİ", "__EMPTY_9"]),
    );

    if (examDate) student.direksiyon_tarih = examDate;
    if (examTime) student.direksiyon_saati = examTime;

    if (!student.direksiyon_harc) student.direksiyon_harc = "odenmedi";
    if (!student.evrak_durumu) student.evrak_durumu = "tamam";
  }

  const xHeaderRowNo = 1;
  const xHeaderMap = buildHeaderMap(eksikSheet, xHeaderRowNo);
  let xCount = 0;

  for (let r = xHeaderRowNo + 1; r <= eksikSheet.rowCount; r += 1) {
    const row = eksikSheet.getRow(r);
    const tcValue = tc(getCellTextByHeader(row, xHeaderMap, ["TC"]));
    const nameValue = t(getCellTextByHeader(row, xHeaderMap, ["ADI SOYADI"]));
    if (!tcValue && !nameValue) continue;
    xCount += 1;

    const student = getOrCreate(store, tcValue, nameValue);
    setIfEmpty(student, "tc", tcValue);
    setIfEmpty(student, "ad_soyad", nameValue);

    const missingList = [
      xMissing(
        getCellTextByHeader(row, xHeaderMap, ["SÖZL", "SOZL"]),
        "Sözleşme",
      ),
      xMissing(getCellTextByHeader(row, xHeaderMap, ["İMZA", "IMZA"]), "İmza"),
      xMissing(
        getCellTextByHeader(row, xHeaderMap, ["RESİM", "RESIM"]),
        "Resim",
      ),
      xMissing(
        getCellTextByHeader(row, xHeaderMap, ["SAĞLIK", "SAGLIK"]),
        "Sağlık Raporu",
      ),
      xMissing(
        getCellTextByHeader(row, xHeaderMap, ["ÖĞRENİM", "OGRENIM"]),
        "Öğrenim Belgesi",
      ),
      xMissing(getCellTextByHeader(row, xHeaderMap, ["SABIKA"]), "Sabıka"),
      xMissing(
        getCellTextByHeader(row, xHeaderMap, ["İKAMET", "IKAMET"]),
        "İkamet",
      ),
      xMissing(getCellTextByHeader(row, xHeaderMap, ["WEBCAM"]), "Webcam"),
      xMissing(
        getCellTextByHeader(row, xHeaderMap, ["KİMLİK", "KIMLIK"]),
        "Kimlik",
      ),
      xMissing(
        getCellTextByHeader(row, xHeaderMap, ["EHLİYET", "EHLIYET"]),
        "Ehliyet",
      ),
      xMissing(getCellTextByHeader(row, xHeaderMap, ["MESAJ"]), "Mesaj"),
      xMissing(getCellTextByHeader(row, xHeaderMap, ["REFERANS"]), "Referans"),
    ].filter(Boolean);

    if (missingList.length) {
      student.evrak_durumu = "eksik";
      student.eksik_evraklar = missingList.join(", ");
    } else if (!student.evrak_durumu) {
      student.evrak_durumu = "tamam";
    }
  }

  const aHeaderRowNo = 3;
  const aHeaderMap = buildHeaderMap(alacakSheet, aHeaderRowNo);
  let aCount = 0;

  for (let r = aHeaderRowNo + 1; r <= alacakSheet.rowCount; r += 1) {
    const row = alacakSheet.getRow(r);
    const nameValue = t(getCellTextByHeader(row, aHeaderMap, ["ADI SOYADI"]));
    if (!nameValue) continue;
    aCount += 1;

    const student = getOrCreate(store, "", nameValue);
    setIfEmpty(student, "ad_soyad", nameValue);

    const eDebt = money(
      getCellTextByHeader(row, aHeaderMap, ["E SINAV HARCI"]),
    );
    const dDebt = money(
      getCellTextByHeader(row, aHeaderMap, [
        "DİREKSİYON SINAV HARCI",
        "DIREKSIYON SINAV HARCI",
      ]),
    );
    const installment = money(
      getCellTextByHeader(row, aHeaderMap, ["TAKSİT", "TAKSIT"]),
    );
    const dueDate = formatDate(
      getCellByHeader(row, aHeaderMap, ["TARİH", "TARIH"])?.value,
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
