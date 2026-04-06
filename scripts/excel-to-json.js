const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

const excelPath = path.join(__dirname, "../excel/ogrenciler.xlsx");
const localOutputPath = path.join(__dirname, "../data/students.json");
const publicOutputPath = path.join(__dirname, "../docs/students.json");

function cleanValue(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeName(value) {
  return cleanValue(value).replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");
}

function normalizeTc(value) {
  if (value === undefined || value === null || value === "") return "";
  return String(value).replace(/\D/g, "");
}

function normalizePhone(value) {
  if (value === undefined || value === null || value === "") return "";
  return String(value).trim();
}

function getValueByPossibleHeaders(row, headerMap, headerNames) {
  for (const headerName of headerNames) {
    const col = headerMap[headerName.toLocaleUpperCase("tr-TR")];
    if (col) {
      return row.getCell(col).value;
    }
  }
  return "";
}

function normalizeDate(value) {
  if (!value) return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().split("T")[0];
  }

  if (typeof value === "object" && value.result) {
    return normalizeDate(value.result);
  }

  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return cleanValue(value);
}

function getSheetByTrimmedName(workbook, targetName) {
  const normalizedTarget = targetName.trim().toLocaleUpperCase("tr-TR");
  return workbook.worksheets.find(
    (sheet) =>
      sheet.name.trim().toLocaleUpperCase("tr-TR") === normalizedTarget,
  );
}

function buildHeaderMap(worksheet, headerRowNumber) {
  const headerRow = worksheet.getRow(headerRowNumber);
  const headerMap = {};

  headerRow.eachCell((cell, colNumber) => {
    const key = cleanValue(cell.value).toLocaleUpperCase("tr-TR");
    if (key) {
      headerMap[key] = colNumber;
    }
  });

  return headerMap;
}

function ensureStudent(studentsMap, tc, adSoyad) {
  const key = tc || adSoyad;
  if (!key) return null;

  if (!studentsMap.has(key)) {
    studentsMap.set(key, {
      tc: tc || "",
      ad_soyad: adSoyad || "",
      sinif: "",
      telefonlar: "",
      durum: "",
      evrak_durumu: "",
      eksik_belgeler: [],
      esinav_tarihi: "",
      esinav_saati: "",
      direksiyon_tarihi: "",
      direksiyon_saati: "",
    });
  }

  const student = studentsMap.get(key);

  if (!student.tc && tc) student.tc = tc;
  if (!student.ad_soyad && adSoyad) student.ad_soyad = adSoyad;

  return student;
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);

  const eksikSheet = getSheetByTrimmedName(workbook, "EKSİK BELGELER");
  const esinavSheet = getSheetByTrimmedName(workbook, "E-SINAV");
  const direksiyonSheet = getSheetByTrimmedName(workbook, "DİREKSİYON");

  console.log(
    "Bulunan sayfalar:",
    workbook.worksheets.map((w) => w.name),
  );

  if (!eksikSheet || !esinavSheet || !direksiyonSheet) {
    throw new Error("Gerekli sayfalardan biri bulunamadı.");
  }

  const studentsMap = new Map();

  // EKSİK BELGELER
  const eksikHeaderMap = buildHeaderMap(eksikSheet, 2);

  for (let rowNumber = 3; rowNumber <= eksikSheet.rowCount; rowNumber++) {
    const row = eksikSheet.getRow(rowNumber);

    const tc = normalizeTc(
      getValueByPossibleHeaders(row, eksikHeaderMap, [
        "TC",
        "T.C.",
        "TCKN",
        "TC KİMLİK NO",
      ]),
    );

    const adSoyad = normalizeName(
      getValueByPossibleHeaders(row, eksikHeaderMap, [
        "ADI SOYADI",
        "AD SOYAD",
        "ADI SOYAD",
      ]),
    );

    const sinif = cleanValue(
      getValueByPossibleHeaders(row, eksikHeaderMap, ["SINIFI", "SINIF"]),
    );

    const telefon = normalizePhone(
      getValueByPossibleHeaders(row, eksikHeaderMap, [
        "TELEFON",
        "TELEFONU",
        "CEP TELEFONU",
      ]),
    );

    const durum = cleanValue(
      getValueByPossibleHeaders(row, eksikHeaderMap, ["DURUMU", "DURUM"]),
    );

    const evrakDurumu = cleanValue(
      getValueByPossibleHeaders(row, eksikHeaderMap, ["EVRAK DURUMU", "EVRAK"]),
    );

    const eksikBelgelerRaw = cleanValue(
      getValueByPossibleHeaders(row, eksikHeaderMap, [
        "EKSİK BELGELER",
        "EKSİK BELGE",
      ]),
    );

    if (!tc && !adSoyad) continue;

    const student = ensureStudent(studentsMap, tc, adSoyad);
    if (!student) continue;

    if (!student.sinif && sinif) student.sinif = sinif;
    if (!student.telefonlar && telefon) student.telefonlar = telefon;
    if (!student.durum && durum) student.durum = durum;
    if (!student.evrak_durumu && evrakDurumu)
      student.evrak_durumu = evrakDurumu;

    if (eksikBelgelerRaw) {
      const belgeler = eksikBelgelerRaw
        .split(/[,\n;/]+/)
        .map((item) => cleanValue(item))
        .filter(Boolean);

      student.eksik_belgeler = [
        ...new Set([...(student.eksik_belgeler || []), ...belgeler]),
      ];
    }
  }

  // E-SINAV
  const esinavHeaderMap = buildHeaderMap(esinavSheet, 2);

  for (let rowNumber = 3; rowNumber <= esinavSheet.rowCount; rowNumber++) {
    const row = esinavSheet.getRow(rowNumber);

    const tc = normalizeTc(
      getValueByPossibleHeaders(row, esinavHeaderMap, [
        "TC",
        "T.C.",
        "TCKN",
        "TC KİMLİK NO",
      ]),
    );

    const adSoyad = normalizeName(
      getValueByPossibleHeaders(row, esinavHeaderMap, [
        "ADI SOYADI",
        "AD SOYAD",
        "ADI SOYAD",
      ]),
    );

    const tarih = normalizeDate(
      getValueByPossibleHeaders(row, esinavHeaderMap, [
        "SINAV TARİHİ",
        "TARİH",
        "E-SINAV TARİHİ",
      ]),
    );

    const saat = cleanValue(
      getValueByPossibleHeaders(row, esinavHeaderMap, [
        "SAAT",
        "SINAV SAATİ",
        "E-SINAV SAATİ",
      ]),
    );

    if (!tc && !adSoyad) continue;

    const student = ensureStudent(studentsMap, tc, adSoyad);
    if (!student) continue;

    if (tarih) student.esinav_tarihi = tarih;
    if (saat) student.esinav_saati = saat;
  }

  // DİREKSİYON
  const direksiyonHeaderMap = buildHeaderMap(direksiyonSheet, 2);

  for (let rowNumber = 3; rowNumber <= direksiyonSheet.rowCount; rowNumber++) {
    const row = direksiyonSheet.getRow(rowNumber);

    const tc = normalizeTc(
      getValueByPossibleHeaders(row, direksiyonHeaderMap, [
        "TC",
        "T.C.",
        "TCKN",
        "TC KİMLİK NO",
      ]),
    );

    const adSoyad = normalizeName(
      getValueByPossibleHeaders(row, direksiyonHeaderMap, [
        "ADI SOYADI",
        "AD SOYAD",
        "ADI SOYAD",
      ]),
    );

    const tarih = normalizeDate(
      getValueByPossibleHeaders(row, direksiyonHeaderMap, [
        "SINAV TARİHİ",
        "TARİH",
        "DİREKSİYON TARİHİ",
      ]),
    );

    const saat = cleanValue(
      getValueByPossibleHeaders(row, direksiyonHeaderMap, [
        "SAAT",
        "SINAV SAATİ",
        "DİREKSİYON SAATİ",
      ]),
    );

    if (!tc && !adSoyad) continue;

    const student = ensureStudent(studentsMap, tc, adSoyad);
    if (!student) continue;

    if (tarih) student.direksiyon_tarihi = tarih;
    if (saat) student.direksiyon_saati = saat;
  }

  const students = Array.from(studentsMap.values())
    .filter((student) => student.ad_soyad)
    .sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, "tr"));

  const jsonContent = JSON.stringify(students, null, 2);

  fs.mkdirSync(path.dirname(localOutputPath), { recursive: true });
  fs.mkdirSync(path.dirname(publicOutputPath), { recursive: true });

  fs.writeFileSync(localOutputPath, jsonContent, "utf-8");
  fs.writeFileSync(publicOutputPath, jsonContent, "utf-8");

  console.log("students.json oluşturuldu.");
  console.log(`Toplam öğrenci: ${students.length}`);
  console.log(`Yerel çıktı: ${localOutputPath}`);
  console.log(`Public çıktı: ${publicOutputPath}`);
}

main().catch((error) => {
  console.error("Hata oluştu:");
  console.error(error);
  process.exit(1);
});
