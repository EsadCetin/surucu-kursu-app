/**
 * scripts/excel-to-json.js
 *
 * v8
 *
 * Bu sürüm kullanıcı isteğine göre net kuralla yazıldı:
 *
 * DİREKSİYON sheet:
 * - HARÇ hücresi yeşil veya sarı ise -> direksiyon_harc = "odendi"
 * - HARÇ hücresi beyaz / boş ise -> direksiyon_harc = "odenmedi"
 *   ve ALACAK RAPORU sheet'ine gidilir:
 *   - aynı isim bulunur
 *   - DİREKSİYON SINAV HARCI sütunundaki tutar -> direksiyon_harc_borcu
 *   - TARİH sütunundaki değer -> direksiyon_borc_son_odeme ve direksiyon_son_odeme
 *
 * Ek olarak:
 * - Slash tarihleri TR formatına çevrilir
 * - İsim eşleştirme güçlendirildi
 * - CUMA ÇELİK gibi örnekler için ALACAK RAPORU doğrudan isimden eşleştirilir
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
    // Excel serial date ise önce onu dene
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

    // 28.01 / 5.02 gibi sayı şeklinde tutulmuş gün-ay formatı
    const raw = String(v);
    if (/^\d{1,2}\.\d{1,2}$/.test(raw)) {
      const [d, m] = raw.split(".");
      return asDateText(Number(d), Number(m), fallbackYear);
    }

    // 5.2 gibi gelirse de destekle
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
    return `${String(rawValue.getHours()).padStart(2, "0")}:${String(rawValue.getMinutes()).padStart(2, "0")}`;
  }

  if (
    rawValue &&
    typeof rawValue === "object" &&
    rawValue.constructor &&
    rawValue.constructor.name === "Time"
  ) {
    const hour = rawValue.hours || 0;
    const minute = rawValue.minutes || 0;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
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

function setIfEmpty(obj, key, value) {
  const val = t(value);
  if (val && !obj[key]) obj[key] = val;
}

function buildAlacakLookup(alacakSheetJs) {
  const map = new Map();

  // Yapı bu dosyada sabit:
  // A: NO
  // B: ADI SOYADI
  // C: E SINAV HARCI
  // D: DİREKSİYON SINAV HARCI
  // E: TAKSİT
  // F: TARİH
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
      student.direksiyon_tarih ||
      student.direksiyon_saati ||
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
  // Satırlar 3'ten başlıyor
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
  // Satırlar 3'ten başlıyor
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

    const examDate = formatDate(row.getCell(9).value);
    const examTime = normalizeTimeText(row.getCell(10).value);
    const paid = isPaidByFill(row.getCell(6));

    if (examDate) student.direksiyon_tarih = examDate;
    if (examTime) student.direksiyon_saati = examTime;

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
  // Satırlar 2'den başlıyor
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
  // Direksiyon tarafında ödemeyenlerin verisi zaten buradan çekildi.
  // Burada ayrıca e-sınav ve taksit borçlarını da işleyelim.
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
      if (dueDate && !student.esinav_borc_son_odeme)
        student.esinav_borc_son_odeme = dueDate;
      if (dueDate && !student.esinav_son_odeme)
        student.esinav_son_odeme = dueDate;
    }

    // DİREKSİYON mantığı kullanıcı isteğine göre asıl DİREKSİYON sheet'te belirlendi.
    // Burada sadece boş kalmışsa tamamlayalım.
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

  const cuma = result.find(
    (item) =>
      normalizePersonName(item.ad_soyad) === normalizePersonName("CUMA ÇELİK"),
  );
  if (cuma) {
    console.log("🧪 CUMA ÇELİK kontrol:", {
      ad_soyad: cuma.ad_soyad,
      direksiyon_harc: cuma.direksiyon_harc,
      direksiyon_harc_borcu: cuma.direksiyon_harc_borcu,
      direksiyon_borc_son_odeme: cuma.direksiyon_borc_son_odeme,
    });
  }
}

main().catch((err) => {
  console.error("❌ excel-to-json hatası:", err);
  process.exit(1);
});
