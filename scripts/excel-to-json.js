const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

const excelPath = path.join(__dirname, "../excel/ogrenciler.xlsx");
const localOutputPath = path.join(__dirname, "../data/students.json");
const publicOutputPath = path.join(__dirname, "../docs/students.json");

function cleanValue(value) {
  if (value === undefined || value === null) return "";

  if (typeof value === "object") {
    if (value.text) return String(value.text).trim();
    if (value.result) return String(value.result).trim();
    if (Array.isArray(value.richText)) {
      return value.richText
        .map((x) => x.text || "")
        .join("")
        .trim();
    }
  }

  return String(value).trim();
}

function normalizeName(value) {
  return cleanValue(value).replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");
}

function normalizeTc(value) {
  return cleanValue(value).replace(/\D/g, "");
}

function normalizePhone(value) {
  return cleanValue(value);
}

function normalizeDate(value) {
  if (!value) return "";

  if (value instanceof Date && !isNaN(value.getTime())) {
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const year = String(value.getFullYear());
    return `${day}.${month}.${year}`;
  }

  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const converted = new Date(excelEpoch.getTime() + value * 86400000);

    if (!isNaN(converted.getTime())) {
      const day = String(converted.getUTCDate()).padStart(2, "0");
      const month = String(converted.getUTCMonth() + 1).padStart(2, "0");
      const year = String(converted.getUTCFullYear());
      return `${day}.${month}.${year}`;
    }
  }

  const text = cleanValue(value).replace(/,/g, ".");
  if (!text) return "";

  const parts = text.split(".");
  if (parts.length === 2) {
    return `${parts[0].padStart(2, "0")}.${parts[1].padStart(2, "0")}.${new Date().getFullYear()}`;
  }

  if (parts.length === 3) {
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return `${parts[0].padStart(2, "0")}.${parts[1].padStart(2, "0")}.${year}`;
  }

  return text;
}

function normalizeResult(value) {
  const text = cleanValue(value).toLocaleLowerCase("tr-TR");

  if (!text) return "";

  if (
    text.includes("geçti") ||
    text.includes("gecti") ||
    text.includes("başarılı") ||
    text.includes("basarili") ||
    text === "g"
  ) {
    return "gecti";
  }

  if (
    text.includes("kaldı") ||
    text.includes("kaldi") ||
    text.includes("başarısız") ||
    text.includes("basarisiz") ||
    text === "k"
  ) {
    return "kaldi";
  }

  return "";
}

function getSheetByTrimmedName(workbook, targetName) {
  return workbook.worksheets.find(
    (sheet) =>
      sheet.name.trim().toLocaleUpperCase("tr-TR") ===
      targetName.trim().toLocaleUpperCase("tr-TR"),
  );
}

function getHeaderMap(worksheet, headerRowNumber) {
  const headerRow = worksheet.getRow(headerRowNumber);
  const map = {};

  headerRow.eachCell((cell, colNumber) => {
    const key = cleanValue(cell.value).toLocaleUpperCase("tr-TR");
    if (key) map[key] = colNumber;
  });

  return map;
}

function getValueByHeader(row, headerMap, headerName) {
  const col = headerMap[headerName.toLocaleUpperCase("tr-TR")];
  if (!col) return "";
  return row.getCell(col).value;
}

function getValueByPossibleHeaders(row, headerMap, headerNames) {
  for (const headerName of headerNames) {
    const col = headerMap[headerName.toLocaleUpperCase("tr-TR")];
    if (col) return row.getCell(col).value;
  }
  return "";
}

function getCellColor(cell) {
  const fill = cell.fill;
  if (!fill) return "";
  const fg = fill.fgColor?.argb || "";
  const bg = fill.bgColor?.argb || "";
  return String(fg || bg).toUpperCase();
}

function getHarcStatus(cell) {
  const pattern = String(cell.fill?.pattern || "").toLowerCase();
  const color = getCellColor(cell);

  if (!pattern || pattern === "none") return "odenmedi";

  if (
    color === "FF00B050" ||
    color === "FFFFFF00" ||
    color.includes("00B050") ||
    color.includes("FFFF00") ||
    color.includes("92D050")
  ) {
    return "odendi";
  }

  return "odenmedi";
}

function getEksikBelgeler(row, headerMap) {
  const eksikler = [];

  if (cleanValue(getValueByHeader(row, headerMap, "SÖZL")))
    eksikler.push("Sözleşme");
  if (cleanValue(getValueByHeader(row, headerMap, "İMZA")))
    eksikler.push("İmza");
  if (cleanValue(getValueByHeader(row, headerMap, "RESİM")))
    eksikler.push("Resim");
  if (cleanValue(getValueByHeader(row, headerMap, "SAĞLIK")))
    eksikler.push("Sağlık");
  if (cleanValue(getValueByHeader(row, headerMap, "ÖĞRENİM")))
    eksikler.push("Öğrenim");
  if (cleanValue(getValueByHeader(row, headerMap, "SABIKA")))
    eksikler.push("Sabıka");
  if (cleanValue(getValueByHeader(row, headerMap, "İKAMET")))
    eksikler.push("İkamet");
  if (cleanValue(getValueByHeader(row, headerMap, "WEBCAM")))
    eksikler.push("Webcam");

  return eksikler;
}

function createBaseStudent(adSoyad = "") {
  return {
    tc: "",
    ad_soyad: adSoyad,
    sinif: "",
    telefonlar: "",
    durum: "kayit",
    evrak_durumu: "tamam",
    eksik_evraklar: "",
    esinav_harc: "odenmedi",
    esinav_tarih: "",
    esinav_saati: "",
    esinav_sonuc: "",
    direksiyon_harc: "odenmedi",
    direksiyon_tarih: "",
    direksiyon_sonuc: "",
  };
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);

  const eksikSheet = getSheetByTrimmedName(workbook, "EKSİK BELGELER");
  const esinavSheet = getSheetByTrimmedName(workbook, "E-SINAV");
  const direksiyonSheet = getSheetByTrimmedName(workbook, "DİREKSİYON");

  if (!eksikSheet || !esinavSheet || !direksiyonSheet) {
    throw new Error("Gerekli sayfalardan biri bulunamadı.");
  }

  const studentsMap = new Map();

  // 1) EKSİK BELGELER
  const eksikHeaderMap = getHeaderMap(eksikSheet, 1);

  for (let rowNumber = 2; rowNumber <= eksikSheet.rowCount; rowNumber++) {
    const row = eksikSheet.getRow(rowNumber);

    const adSoyad = cleanValue(
      getValueByPossibleHeaders(row, eksikHeaderMap, [
        "ADI SOYADI",
        "ADI SOYADI ",
        "AD SOYAD",
      ]),
    );
    if (!adSoyad) continue;

    const key = normalizeName(adSoyad);
    const existing = studentsMap.get(key) || createBaseStudent(adSoyad);

    const tcValue = getValueByPossibleHeaders(row, eksikHeaderMap, [
      "TC",
      "T.C.",
      "T.C",
      "TC NO",
      "TC KİMLİK NO",
    ]);

    const telefonValue = getValueByPossibleHeaders(row, eksikHeaderMap, [
      "TELEFON",
      "TELEFONLAR",
      "CEP TELEFONU",
      "TEL",
    ]);

    const sinifValue = getValueByPossibleHeaders(row, eksikHeaderMap, [
      "SINIF",
      "SINIFI",
      "EHLİYET SINIFI",
    ]);

    const eksikListesi = getEksikBelgeler(row, eksikHeaderMap);

    studentsMap.set(key, {
      ...existing,
      tc: normalizeTc(tcValue) || existing.tc,
      ad_soyad: adSoyad,
      sinif: cleanValue(sinifValue) || existing.sinif,
      telefonlar: normalizePhone(telefonValue) || existing.telefonlar,
      durum: "kayit",
      evrak_durumu: "eksik",
      eksik_evraklar: eksikListesi.join("\n"),
    });
  }

  // 2) E-SINAV
  const esinavHeaderMap = getHeaderMap(esinavSheet, 2);

  for (let rowNumber = 3; rowNumber <= esinavSheet.rowCount; rowNumber++) {
    const row = esinavSheet.getRow(rowNumber);

    const adSoyad = cleanValue(
      getValueByPossibleHeaders(row, esinavHeaderMap, [
        "ADI SOYADI",
        "AD SOYAD",
      ]),
    );
    if (!adSoyad) continue;

    const key = normalizeName(adSoyad);
    const existing = studentsMap.get(key) || createBaseStudent(adSoyad);

    const tcValue = getValueByPossibleHeaders(row, esinavHeaderMap, [
      "TC",
      "T.C.",
      "T.C",
      "TC NO",
      "TC KİMLİK NO",
    ]);

    const telefonValue = getValueByPossibleHeaders(row, esinavHeaderMap, [
      "TELEFONLAR",
      "TELEFON",
      "CEP TELEFONU",
      "TEL",
    ]);

    const sinifValue = getValueByPossibleHeaders(row, esinavHeaderMap, [
      "SINIF",
      "SINIFI",
      "EHLİYET SINIFI",
    ]);

    const tarihValue = getValueByPossibleHeaders(row, esinavHeaderMap, [
      "SINAV TARİHİ",
      "E-SINAV TARİHİ",
      "TARİH",
    ]);

    const saatValue = getValueByPossibleHeaders(row, esinavHeaderMap, [
      "SINAV SAATİ",
      "SAAT",
    ]);

    const sonucValue = getValueByPossibleHeaders(row, esinavHeaderMap, [
      "SONUÇ",
      "SINAV SONUCU",
      "E-SINAV SONUCU",
    ]);

    const harcCell = row.getCell(
      esinavHeaderMap["HARÇ"] ||
        esinavHeaderMap["HARC"] ||
        esinavHeaderMap["E-SINAV HARCI"] ||
        6,
    );

    const esinavSonuc = normalizeResult(sonucValue);

    studentsMap.set(key, {
      ...existing,
      tc: normalizeTc(tcValue) || existing.tc,
      ad_soyad: adSoyad,
      sinif: cleanValue(sinifValue) || existing.sinif,
      telefonlar: normalizePhone(telefonValue) || existing.telefonlar,
      durum: esinavSonuc === "gecti" ? "direksiyon" : "esinav",
      evrak_durumu: existing.evrak_durumu === "eksik" ? "eksik" : "tamam",
      esinav_harc: getHarcStatus(harcCell),
      esinav_tarih: normalizeDate(tarihValue),
      esinav_saati: cleanValue(saatValue),
      esinav_sonuc: esinavSonuc || existing.esinav_sonuc,
    });
  }

  // 3) DİREKSİYON
  const direksiyonHeaderMap = getHeaderMap(direksiyonSheet, 2);

  for (let rowNumber = 3; rowNumber <= direksiyonSheet.rowCount; rowNumber++) {
    const row = direksiyonSheet.getRow(rowNumber);

    const adSoyad = cleanValue(
      getValueByPossibleHeaders(row, direksiyonHeaderMap, [
        "ADI SOYADI",
        "AD SOYAD",
      ]),
    );
    if (!adSoyad) continue;

    const key = normalizeName(adSoyad);
    const existing = studentsMap.get(key) || createBaseStudent(adSoyad);

    const tcValue = getValueByPossibleHeaders(row, direksiyonHeaderMap, [
      "TC",
      "T.C.",
      "T.C",
      "TC NO",
      "TC KİMLİK NO",
    ]);

    const telefonValue = getValueByPossibleHeaders(row, direksiyonHeaderMap, [
      "TELEFONLAR",
      "TELEFON",
      "CEP TELEFONU",
      "TEL",
    ]);

    const sinifValue = getValueByPossibleHeaders(row, direksiyonHeaderMap, [
      "SINIF",
      "SINIFI",
      "EHLİYET SINIFI",
    ]);

    const tarihValue = getValueByPossibleHeaders(row, direksiyonHeaderMap, [
      "SINAV TARİHİ",
      "DİREKSİYON TARİHİ",
      "TARİH",
    ]);

    const sonucValue = getValueByPossibleHeaders(row, direksiyonHeaderMap, [
      "SONUÇ",
      "SINAV SONUCU",
      "DİREKSİYON SONUCU",
    ]);

    const harcCell = row.getCell(
      direksiyonHeaderMap["HARÇ"] ||
        direksiyonHeaderMap["HARC"] ||
        direksiyonHeaderMap["DİREKSİYON HARCI"] ||
        6,
    );

    const direksiyonSonuc = normalizeResult(sonucValue);

    studentsMap.set(key, {
      ...existing,
      tc: normalizeTc(tcValue) || existing.tc,
      ad_soyad: adSoyad,
      sinif: cleanValue(sinifValue) || existing.sinif,
      telefonlar: normalizePhone(telefonValue) || existing.telefonlar,
      durum: direksiyonSonuc === "gecti" ? "tamam" : "direksiyon",
      evrak_durumu: existing.evrak_durumu === "eksik" ? "eksik" : "tamam",
      esinav_sonuc: existing.esinav_sonuc || "gecti",
      direksiyon_harc: getHarcStatus(harcCell),
      direksiyon_tarih: normalizeDate(tarihValue),
      direksiyon_sonuc: direksiyonSonuc || existing.direksiyon_sonuc,
    });
  }

  const students = Array.from(studentsMap.values())
    .filter((student) => student.ad_soyad)
    .map((student) => ({
      ...student,
      tc: student.tc || "",
      ad_soyad: student.ad_soyad || "",
      sinif: student.sinif || "",
      telefonlar: student.telefonlar || "",
      durum: student.durum || "kayit",
      evrak_durumu: student.evrak_durumu || "tamam",
      eksik_evraklar: student.eksik_evraklar || "",
      esinav_harc: student.esinav_harc || "odenmedi",
      esinav_tarih: student.esinav_tarih || "",
      esinav_saati: student.esinav_saati || "",
      esinav_sonuc: student.esinav_sonuc || "",
      direksiyon_harc: student.direksiyon_harc || "odenmedi",
      direksiyon_tarih: student.direksiyon_tarih || "",
      direksiyon_sonuc: student.direksiyon_sonuc || "",
    }))
    .sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, "tr"));

  const jsonContent = JSON.stringify(students, null, 2);

  fs.writeFileSync(localOutputPath, jsonContent, "utf-8");
  fs.writeFileSync(publicOutputPath, jsonContent, "utf-8");

  console.log("students.json oluşturuldu.");
  console.log(`Toplam öğrenci: ${students.length}`);
}

main().catch((error) => {
  console.error("Hata oluştu:");
  console.error(error.message);
});
