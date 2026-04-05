const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const dataPath = path.join(__dirname, "students.json");

function getStudents() {
  const raw = fs.readFileSync(dataPath, "utf8");
  return JSON.parse(raw);
}

app.get("/", (req, res) => {
  res.send("Yeni Ayaş Sürücü Kursu backend çalışıyor.");
});

app.post("/student-login", (req, res) => {
  try {
    const { tc } = req.body;

    if (!tc) {
      return res.status(400).json({ error: "TC kimlik numarası gerekli." });
    }

    if (!/^\d{11}$/.test(tc)) {
      return res
        .status(400)
        .json({ error: "TC kimlik numarası 11 haneli olmalıdır." });
    }

    const students = getStudents();
    const student = students.find((s) => s.tc === tc);

    if (!student) {
      return res
        .status(404)
        .json({ error: "Bu TC kimlik numarasına ait öğrenci bulunamadı." });
    }

    return res.json(student);
  } catch (error) {
    return res.status(500).json({ error: "Sunucu hatası oluştu." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend çalışıyor: http://0.0.0.0:${PORT}`);
});
