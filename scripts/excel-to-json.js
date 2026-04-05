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

  // Excel date (gerçek tarih formatı)
  if (value instanceof Date && !isNaN(value.getTime())) {
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const year = String(value.getFullYear());
    return `${day}.${month}.${year}`;
  }

  // "23,03" gibi manuel girilen format
  if (typeof value === "string") {
    const cleaned = value.replace(",", ".").trim();

    // 23.03 şeklinde ise
    const parts = cleaned.split(".");
    if (parts.length === 2) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");

      const year = new Date().getFullYear(); // otomatik yıl
      return `${day}.${month}.${year}`;
    }

    return cleaned;
  }

  return String(value);
}

function getSheetByTrimmedName(workbook, targetName) {
  return workbook.worksheets.find(
    (sheet) =>
      sheet.name.trim().toLocaleUpperCase("tr-TR") ===
      targetName.trim().toLocaleUpperCase("tr-TR"),
  );
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

  // Dolgu yoksa ödenmedi
  if (!pattern || pattern === "none") {
    return "odenmedi";
  }

  // Bu dosyada tespit edilen renkler
  if (
    color === "FF00B050" || // yeşil
    color === "FFFFFF00" || // sarı
    color.includes("00B050") ||
    color.includes("FFFF00") ||
    color.includes("92D050")
  ) {
    return "odendi";
  }

  return "odenmedi";
}

function getHeaderMap(worksheet, headerRowNumber) {
  const headerRow = worksheet.getRow(headerRowNumber);
  const map = {};

  headerRow.eachCell((cell, colNumber) => {
    const key = cleanValue(cell.value).toLocaleUpperCase("tr-TR");
    if (key) {
      map[key] = colNumber;
    }
  });

  return map;
}

function getValueByHeader(row, headerMap, headerName) {
  const col = headerMap[headerName.toLocaleUpperCase("tr-TR")];
  if (!col) return "";
  return row.getCell(col).value;
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

  // EKSİK BELGELER -> başlık 1. satır
  const eksikHeaderMap = getHeaderMap(eksikSheet, 1);

  for (let rowNumber = 2; rowNumber <= eksikSheet.rowCount; rowNumber++) {
    const row = eksikSheet.getRow(rowNumber);
    const adSoyad = cleanValue(
      getValueByHeader(row, eksikHeaderMap, "ADI SOYADI"),
    );
    if (!adSoyad) continue;

    const tcValue = getValueByPossibleHeaders(row, eksikHeaderMap, [
      "TC",
      "T.C.",
      "T.C",
      "TC NO",
    ]);
    const key = normalizeName(adSoyad);
    const eksikListesi = getEksikBelgeler(row, eksikHeaderMap);

    studentsMap.set(key, {
      tc: normalizeTc(tcValue),
      ad_soyad: adSoyad,
      sinif: "",
      telefonlar: "",
      durum: "kayit",
      evrak_durumu: "eksik",
      eksik_evraklar: eksikListesi.join("\n"),
      esinav_harc: "odenmedi",
      esinav_tarih: "",
      esinav_saati: "",
      esinav_sonuc: "",
      direksiyon_harc: "odenmedi",
      direksiyon_tarih: "",
      direksiyon_sonuc: "",
    });
  }

  // E-SINAV -> başlık 2. satır
  const esinavHeaderMap = getHeaderMap(esinavSheet, 2);

  for (let rowNumber = 3; rowNumber <= esinavSheet.rowCount; rowNumber++) {
    const row = esinavSheet.getRow(rowNumber);
    const adSoyad = cleanValue(
      getValueByHeader(row, esinavHeaderMap, "ADI SOYADI"),
    );
    if (!adSoyad) continue;

    const key = normalizeName(adSoyad);
    const existing = studentsMap.get(key) || {
      tc: "",
      ad_soyad: adSoyad,
      sinif: "",
      telefonlar: "",
      durum: "",
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

    const harcCell = row.getCell(6); // F

    studentsMap.set(key, {
      ...existing,
      tc:
        normalizeTc(getValueByHeader(row, esinavHeaderMap, "TC")) ||
        existing.tc,
      ad_soyad: adSoyad,
      sinif:
        cleanValue(getValueByHeader(row, esinavHeaderMap, "SINIF")) ||
        existing.sinif,
      telefonlar:
        normalizePhone(getValueByHeader(row, esinavHeaderMap, "TELEFONLAR")) ||
        existing.telefonlar,
      durum: "esinav",
      evrak_durumu: existing.evrak_durumu === "eksik" ? "eksik" : "tamam",
      esinav_harc: getHarcStatus(harcCell),
      esinav_tarih: normalizeDate(
        getValueByHeader(row, esinavHeaderMap, "SINAV TARİHİ"),
      ),
      esinav_saati: cleanValue(
        getValueByHeader(row, esinavHeaderMap, "SINAV SAATİ"),
      ),
    });
  }

  // DİREKSİYON -> başlık 2. satır
  const direksiyonHeaderMap = getHeaderMap(direksiyonSheet, 2);

  for (let rowNumber = 3; rowNumber <= direksiyonSheet.rowCount; rowNumber++) {
    const row = direksiyonSheet.getRow(rowNumber);
    const adSoyad = cleanValue(
      getValueByHeader(row, direksiyonHeaderMap, "ADI SOYADI"),
    );
    if (!adSoyad) continue;

    const key = normalizeName(adSoyad);
    const existing = studentsMap.get(key) || {
      tc: "",
      ad_soyad: adSoyad,
      sinif: "",
      telefonlar: "",
      durum: "",
      evrak_durumu: "tamam",
      eksik_evraklar: "",
      esinav_harc: "odenmedi",
      esinav_tarih: "",
      esinav_saati: "",
      esinav_sonuc: "gecti",
      direksiyon_harc: "odenmedi",
      direksiyon_tarih: "",
      direksiyon_sonuc: "",
    };

    const harcCell = row.getCell(6); // F

    studentsMap.set(key, {
      ...existing,
      tc:
        normalizeTc(getValueByHeader(row, direksiyonHeaderMap, "TC")) ||
        existing.tc,
      ad_soyad: adSoyad,
      sinif:
        cleanValue(getValueByHeader(row, direksiyonHeaderMap, "SINIF")) ||
        existing.sinif,
      durum: "direksiyon",
      evrak_durumu: existing.evrak_durumu === "eksik" ? "eksik" : "tamam",
      esinav_sonuc: existing.esinav_sonuc || "gecti",
      direksiyon_harc: getHarcStatus(harcCell),
      direksiyon_tarih: normalizeDate(
        getValueByHeader(row, direksiyonHeaderMap, "SINAV TARİHİ"),
      ),
    });
  }

  const students = Array.from(studentsMap.values())
    .filter((student) => student.ad_soyad)
    .sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, "tr"));

  fs.writeFileSync(outputPath, JSON.stringify(students, null, 2), "utf-8");

  console.log("students.json oluşturuldu.");
  console.log(`Toplam öğrenci: ${students.length}`);
}

main().catch((error) => {
  console.error("Hata oluştu:");
  console.error(error.message);
});
const jsonContent = JSON.stringify(students, null, 2);

fs.writeFileSync(localOutputPath, jsonContent, "utf-8");
fs.writeFileSync(publicOutputPath, jsonContent, "utf-8");
