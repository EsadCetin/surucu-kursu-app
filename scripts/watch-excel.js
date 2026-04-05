const chokidar = require("chokidar");
const { exec } = require("child_process");
const path = require("path");

const excelFile = path.join(__dirname, "../excel/ogrenciler.xlsx");

console.log("Excel takip ediliyor:", excelFile);

let timeout = null;

chokidar.watch(excelFile, { ignoreInitial: true }).on("change", () => {
  clearTimeout(timeout);

  timeout = setTimeout(() => {
    console.log("Excel değişti, JSON güncelleniyor...");

    exec("npm run excel-to-json", (error, stdout, stderr) => {
      if (error) {
        console.error("Hata:", error.message);
        return;
      }

      if (stderr) {
        console.error(stderr);
      }

      console.log(stdout);
    });
  }, 800);
});
