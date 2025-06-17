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

// SETUP DATABASE TUNGGAL: db.sqlite
const db = new sqlite3.Database("./db.sqlite", (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
    return;
  }
  console.log("✅ Connected to the single SQLite database: db.sqlite");
});

// Menggunakan .serialize() untuk memastikan perintah dijalankan secara berurutan
db.serialize(() => {
  // 1. Buat tabel 'members'
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
        console.error("Error creating 'members' table:", err.message);
      } else {
        console.log("Table 'members' is ready.");
      }
    }
  );

  // 2. Buat tabel 'admins'
  db.run(
    `
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )
  `,
    (err) => {
      if (err) {
        return console.error("Error creating 'admins' table:", err.message);
      }
      console.log("Table 'admins' is ready.");

      // Cek dan masukkan user admin default jika belum ada
      const checkSql = `SELECT * FROM admins WHERE username = ?`;
      db.get(checkSql, ["admin"], (err, row) => {
        if (err) {
          return console.error("Error checking for admin user:", err.message);
        }
        if (!row) {
          const insertSql = `INSERT INTO admins (username, password) VALUES (?, ?)`;
          db.run(insertSql, ["admin", "password123"], (err) => {
            if (err) {
              return console.error(
                "Error inserting default admin:",
                err.message
              );
            }
            console.log("Default admin user ('admin') created in db.sqlite.");
          });
        }
      });
    }
  );

  // 3. Buat tabel 'contacts' untuk menyimpan pesan
  db.run(
    `
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) {
        return console.error("Error creating 'contacts' table:", err.message);
      }
      console.log("Table 'contacts' is ready.");
    }
  );
});

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
app.use(express.static(__dirname));
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

// ROUTE LOGIN
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username dan password harus diisi." });
  }

  const sql = "SELECT * FROM admins WHERE username = ? AND password = ?";
  db.get(sql, [username, password], (err, row) => {
    if (err) {
      console.error("Login error:", err.message);
      return res
        .status(500)
        .json({ message: "Terjadi kesalahan pada server." });
    }
    if (row) {
      res.json({ success: true, message: "Login berhasil!" });
    } else {
      res
        .status(401)
        .json({ success: false, message: "Username atau password salah." });
    }
  });
});

// API Route untuk menerima data dari form kontak
app.post("/api/contact", (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res
      .status(400)
      .json({ success: false, message: "Semua field harus diisi." });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Format email yang Anda masukkan tidak valid.",
    });
  }

  const sql = `INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)`;
  db.run(sql, [name, email, message], function (err) {
    if (err) {
      console.error("Error inserting contact message:", err.message);
      return res.status(500).json({
        success: false,
        message: "Gagal menyimpan pesan ke database.",
      });
    }
    res
      .status(201)
      .json({ success: true, message: "Pesan Anda berhasil dikirim!" });
  });
});

// --- PEMBARUAN: API Routes untuk Manajemen Pesan (Contacts) di Dashboard ---
// GET semua pesan kontak, diurutkan dari yang terbaru
app.get("/api/contacts", async (req, res) => {
  try {
    const rows = await dbAll("SELECT * FROM contacts ORDER BY timestamp DESC");
    res.json(rows);
  } catch (err) {
    console.error("GET /api/contacts Error:", err.message);
    res.status(500).json({ message: "Gagal mengambil data pesan." });
  }
});

// DELETE sebuah pesan kontak berdasarkan ID
app.delete("/api/contacts/:id", async (req, res) => {
  try {
    const result = await dbRun("DELETE FROM contacts WHERE id = ?", [
      req.params.id,
    ]);

    if (result.changes === 0) {
      return res.status(404).json({ message: "Pesan tidak ditemukan." });
    }
    res.json({ message: "Pesan berhasil dihapus!" });
  } catch (err) {
    console.error(`DELETE /api/contacts/${req.params.id} Error:`, err.message);
    res.status(500).json({ message: "Gagal menghapus pesan." });
  }
});
// --- Akhir Pembaruan ---

// API untuk 'members'
app.get("/api/members", async (req, res) => {
  try {
    const rows = await dbAll("SELECT * FROM members ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    console.error("GET /api/members Error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

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
  // PERBAIKAN: Mengarahkan ke index.html di root, bukan di /public
  console.log(
    "   Buka http://localhost:3000/public/index.html di browser Anda."
  );
});
