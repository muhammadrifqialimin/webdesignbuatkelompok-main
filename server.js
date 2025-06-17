const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

const app = express();
const port = 3000;

// --- SETUP ---

// Pastikan folder uploads ada
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
  console.log(`Created directory: ${uploadsDir}`);
}

// Setup database
const db = new sqlite3.Database("./db.sqlite", (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
    return;
  }
  console.log("Connected to the SQLite database.");
});

db.run(
  `
  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    name TEXT,
    quote TEXT,
    image TEXT,
    details TEXT
  )
`,
  (err) => {
    if (err) {
      console.error("Error creating table:", err.message);
    } else {
      console.log("Table 'members' is ready.");
    }
  }
);

// Setup multer untuk upload gambar
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  },
});
const upload = multer({ storage });

// --- MIDDLEWARE ---

app.use(cors());
app.use(express.json());

// Menyajikan file statis (HTML, CSS, JS client-side, gambar, dll)
// Semua file di root folder akan bisa diakses
app.use(express.static(__dirname));
// Folder 'uploads' juga disajikan secara publik
app.use("/uploads", express.static(uploadsDir));

// Helper untuk menjalankan query dengan async/await
const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      err ? reject(err) : resolve(this);
    });
  });
const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      err ? reject(err) : resolve(rows);
    });
  });
const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      err ? reject(err) : resolve(row);
    });
  });

// --- API ROUTES ---

// GET semua member
app.get("/api/members", async (req, res) => {
  try {
    const rows = await dbAll("SELECT * FROM members ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    console.error("GET /api/members Error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST tambah member
app.post("/api/members", upload.single("memberImage"), async (req, res) => {
  try {
    const id = Date.now().toString();
    const { memberName, memberQuote, memberDetails } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;

    if (!memberName || !memberQuote || !memberDetails || !image) {
      return res
        .status(400)
        .json({ message: "Semua field termasuk gambar harus diisi!" });
    }

    await dbRun(
      "INSERT INTO members (id, name, quote, image, details) VALUES (?, ?, ?, ?, ?)",
      [id, memberName, memberQuote, image, memberDetails]
    );
    res.status(201).json({ message: "Member berhasil ditambahkan!", id });
  } catch (err) {
    console.error("POST /api/members Error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// PUT update member
app.put("/api/members/:id", upload.single("memberImage"), async (req, res) => {
  const { id } = req.params;
  const { memberName, memberQuote, memberDetails } = req.body;

  if (!memberName || !memberQuote || !memberDetails) {
    return res.status(400).json({ message: "Data tidak lengkap" });
  }

  try {
    const member = await dbGet("SELECT image FROM members WHERE id = ?", [id]);
    if (!member) {
      return res.status(404).json({ message: "Member tidak ditemukan." });
    }

    const finalImage = req.file
      ? `/uploads/${req.file.filename}`
      : member.image;

    await dbRun(
      "UPDATE members SET name = ?, quote = ?, image = ?, details = ? WHERE id = ?",
      [memberName, memberQuote, finalImage, memberDetails, id]
    );
    res.json({ message: "Member berhasil diperbarui!" });
  } catch (err) {
    console.error(`PUT /api/members/${id} Error:`, err.message);
    res.status(500).json({ message: err.message });
  }
});

// DELETE member
app.delete("/api/members/:id", async (req, res) => {
  try {
    const result = await dbRun("DELETE FROM members WHERE id = ?", [
      req.params.id,
    ]);

    if (result.changes === 0) {
      return res
        .status(404)
        .json({ message: "Member tidak ditemukan untuk dihapus." });
    }

    res.json({ message: "Member berhasil dihapus!" });
  } catch (err) {
    console.error(`DELETE /api/members/${req.params.id} Error:`, err.message);
    res.status(500).json({ message: err.message });
  }
});

// --- START SERVER ---
app.listen(port, () => {
  console.log(`✅ Server ready at http://localhost:${port}`);
  console.log("   Buka http://localhost:3000/public/index.html di browser Anda.");
});
