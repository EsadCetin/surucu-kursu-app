/**
 * excel-to-json.js
 *
 * Bu sürüm:
 * - E-SINAV, DİREKSİYON, EKSİK BELGELER, ALACAK RAPORU sayfalarını okur
 * - Aynı öğrenciyi TC ile, TC yoksa ad soyad ile birleştirir
 * - Borç son ödeme tarihlerini ana son ödeme alanlarına da yansıtır
 * - E-SINAV sayfasındaki harç hücresinin rengine göre ödeme durumunu çıkarır:
 *   - yeşil / sarı  => odendi
 *   - beyaz / boş   => odenmedi
 *
 * Kullanım:
 *   node scripts/excel-to-json.js
 */

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

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

function formatDate(v, fallbackYear = 2026) {
  if (v == null || v === "") return "";

  if (v instanceof Date && !isNaN(v.getTime())) {
    const d = String(v.getDate()).padStart(2, "0");
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const y = v.getFullYear();
    return `${d}.${m}.${y}`;
  }

  if (typeof v === "number" && !Number.isNaN(v)) {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return `${String(parsed.d).padStart(2, "0")}.${String(parsed.m).padStart(2, "0")}.${parsed.y}`;
    }
  }

  const raw = t(v);

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

function formatTime(v) {
  if (v == null || v === "") return "";

  if (typeof v === "number" && !Number.isNaN(v)) {
    const totalMinutes = Math.round(v * 24 * 60);
    const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  const raw = t(v);
  if (!raw) return "";
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;

  const match = raw.match(/(\d{1,2})[:.](\d{2})/);
  if (match) {
    return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
  }

  return raw;
}

function money(v) {
  return t(v);
}

function parseSheet(ws, headerRowIndex) {
  return XLSX.utils.sheet_to_json(ws, {
    defval: "",
    raw: true,
    range: headerRowIndex - 1,
  });
}

function decodeSheetRange(ws) {
  if (!ws || !ws["!ref"]) return null;
  return XLSX.utils.decode_range(ws["!ref"]);
}

function findColumnLetterByHeader(ws, headerRowIndex, headerMatchers) {
  const range = decodeSheetRange(ws);
  if (!range) return "";

  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const address = XLSX.utils.encode_cell({ r: headerRowIndex - 1, c });
    const value = t(ws[address]?.v);
    if (!value) continue;

    const norm = value.toLocaleLowerCase("tr-TR");
    if (headerMatchers.some((m) => norm.includes(m))) {
      return XLSX.utils.encode_col(c);
    }
  }

  return "";
}

function getArgbFromCellStyle(cell) {
  if (!cell || !cell.s) return "";
  const fill = cell.s.fill || {};
  const fg = fill.fgColor || {};
  const bg = fill.bgColor || {};
  return String(fg.rgb || bg.rgb || "").toUpperCase();
}

function mapFillColorToPaymentStatus(argb) {
  const rgb = String(argb || "")
    .replace(/^FF/, "")
    .toUpperCase();

  if (!rgb) return "";

  const whiteSet = new Set(["FFFFFF", "FFFFFE", "F2F2F2", "F7F7F7", "EDEDED"]);
  if (whiteSet.has(rgb)) return "odenmedi";

  const greenHints = ["00B050", "70AD47", "92D050", "A9D18E", "C6E0B4"];
  if (greenHints.includes(rgb)) return "odendi";

  const yellowHints = ["FFFF00", "FFD966", "FFE699", "FFF2CC", "FFC000"];
  if (yellowHints.includes(rgb)) return "odendi";

  return "";
}

function detectEsinavHarcStatusFromColor(
  ws,
  rowNumber1Based,
  harcColumnLetter,
) {
  if (!harcColumnLetter) return "";
  const address = `${harcColumnLetter}${rowNumber1Based}`;
  const cell = ws[address];
  const argb = getArgbFromCellStyle(cell);
  const byColor = mapFillColorToPaymentStatus(argb);
  if (byColor) return byColor;

  const rawText = t(cell?.v).toLocaleLowerCase("tr-TR");
  if (["yeşil", "yesil", "sarı", "sari"].includes(rawText)) return "odendi";
  if (rawText === "beyaz") return "odenmedi";

  return "";
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

function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel dosyası bulunamadı: ${EXCEL_PATH}`);
  }

  const wb = XLSX.readFile(EXCEL_PATH, { cellDates: true, cellStyles: true });
  const store = buildStore();

  const eSinavSheet = wb.Sheets["E-SINAV "] || wb.Sheets["E-SINAV"];
  const direksiyonSheet = wb.Sheets["DİREKSİYON "] || wb.Sheets["DİREKSİYON"];
  const eksikSheet =
    wb.Sheets["EKSİK BELGELER "] || wb.Sheets["EKSİK BELGELER"];
  const alacakSheet = wb.Sheets["ALACAK RAPORU"];

  if (!eSinavSheet || !direksiyonSheet || !eksikSheet || !alacakSheet) {
    throw new Error("Gerekli sayfalardan biri eksik.");
  }

  const eHeaderRow = 2;
  const eRows = parseSheet(eSinavSheet, eHeaderRow);
  const eSinavHarcColumn = findColumnLetterByHeader(eSinavSheet, eHeaderRow, [
    "harç",
    "harc",
  ]);

  for (let i = 0; i < eRows.length; i += 1) {
    const row = eRows[i];
    const tcValue = tc(row["TC"]);
    const nameValue = t(row["ADI SOYADI"]);
    if (!tcValue && !nameValue) continue;

    const student = getOrCreate(store, tcValue, nameValue);
    setIfEmpty(student, "tc", tcValue);
    setIfEmpty(student, "ad_soyad", nameValue);
    setIfEmpty(student, "sinif", row["SINIF"]);
    setIfEmpty(student, "telefonlar", row["TELEFONLAR"]);
    if (!student.durum) student.durum = "esinav";

    const examDate = formatDate(row["SINAV TARİHİ"]);
    const examTime = formatTime(row["SINAV SAATİ"]);
    const colorBasedHarc = detectEsinavHarcStatusFromColor(
      eSinavSheet,
      eHeaderRow + 1 + i,
      eSinavHarcColumn,
    );

    if (examDate) student.esinav_tarih = examDate;
    if (examTime) student.esinav_saati = examTime;

    if (colorBasedHarc) {
      student.esinav_harc = colorBasedHarc;
    } else if (!student.esinav_harc) {
      student.esinav_harc = "odenmedi";
    }

    if (!student.evrak_durumu) student.evrak_durumu = "tamam";
  }

  const dRows = parseSheet(direksiyonSheet, 2);
  for (const row of dRows) {
    const tcValue = tc(row["TC"]);
    const nameValue = t(row["ADI SOYADI"]);
    if (!tcValue && !nameValue) continue;

    const student = getOrCreate(store, tcValue, nameValue);
    setIfEmpty(student, "tc", tcValue);
    setIfEmpty(student, "ad_soyad", nameValue);
    setIfEmpty(student, "sinif", row["SINIF"]);
    setIfEmpty(
      student,
      "telefonlar",
      row["__EMPTY_7"] || row["TELEFON"] || row["TELEFONLAR"],
    );
    student.durum = "direksiyon";

    const examDate = formatDate(row["__EMPTY_8"] || row["SINAV TARİHİ"]);
    const examTime = formatTime(row["__EMPTY_9"] || row["SINAV SAATİ"]);
    if (examDate) student.direksiyon_tarih = examDate;
    if (examTime) student.direksiyon_saati = examTime;

    if (!student.direksiyon_harc) student.direksiyon_harc = "odenmedi";
    if (!student.evrak_durumu) student.evrak_durumu = "tamam";
  }

  const xRows = parseSheet(eksikSheet, 1);
  for (const row of xRows) {
    const tcValue = tc(row["TC"]);
    const nameValue = t(row["ADI SOYADI"]);
    if (!tcValue && !nameValue) continue;

    const student = getOrCreate(store, tcValue, nameValue);
    setIfEmpty(student, "tc", tcValue);
    setIfEmpty(student, "ad_soyad", nameValue);

    const missingList = [
      xMissing(row["SÖZL"], "Sözleşme"),
      xMissing(row["İMZA"], "İmza"),
      xMissing(row["RESİM"], "Resim"),
      xMissing(row["SAĞLIK"], "Sağlık Raporu"),
      xMissing(row["ÖĞRENİM"], "Öğrenim Belgesi"),
      xMissing(row["SABIKA"], "Sabıka"),
      xMissing(row["İKAMET"], "İkamet"),
      xMissing(row["WEBCAM"], "Webcam"),
      xMissing(row["KİMLİK"], "Kimlik"),
      xMissing(row["EHLİYET"], "Ehliyet"),
      xMissing(row["MESAJ"], "Mesaj"),
      xMissing(row["REFERANS"], "Referans"),
    ].filter(Boolean);

    if (missingList.length) {
      student.evrak_durumu = "eksik";
      student.eksik_evraklar = missingList.join(", ");
    } else if (!student.evrak_durumu) {
      student.evrak_durumu = "tamam";
    }
  }

  const aRows = parseSheet(alacakSheet, 3);
  for (const row of aRows) {
    const nameValue = t(row["ADI SOYADI"]);
    if (!nameValue) continue;

    const student = getOrCreate(store, "", nameValue);
    setIfEmpty(student, "ad_soyad", nameValue);

    const eDebt = money(row["E SINAV HARCI"]);
    const dDebt = money(row["DİREKSİYON SINAV HARCI"]);
    const installment = money(row["TAKSİT"]);
    const dueDate = formatDate(row["TARİH"]);

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
  console.log(
    `📄 E-SINAV öğrenci: ${eRows.filter((r) => tc(r["TC"]) || t(r["ADI SOYADI"])).length}`,
  );
  console.log(
    `📄 DİREKSİYON öğrenci: ${dRows.filter((r) => tc(r["TC"]) || t(r["ADI SOYADI"])).length}`,
  );
  console.log(
    `📄 EKSİK BELGELER öğrenci: ${xRows.filter((r) => tc(r["TC"]) || t(r["ADI SOYADI"])).length}`,
  );
  console.log(
    `📄 ALACAK RAPORU öğrenci: ${aRows.filter((r) => t(r["ADI SOYADI"])).length}`,
  );
  console.log(`👤 Toplam benzersiz öğrenci: ${result.length}`);
}

main();
