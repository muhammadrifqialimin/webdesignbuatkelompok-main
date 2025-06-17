const sqlite3 = require("sqlite3").verbose();

// Mengambil username dan password dari argumen command line
const newUsername = process.argv[2];
const newPassword = process.argv[3];

// Cek apakah username dan password diberikan
if (!newUsername || !newPassword) {
  console.error("❌ Gagal! Harap sediakan username dan password.");
  console.log("   Contoh: node add_admin.js nama_admin password_baru");
  process.exit(1); // Keluar dari skrip dengan status error
}

// Hubungkan ke database
const db = new sqlite3.Database("./db.sqlite", (err) => {
  if (err) {
    return console.error("Error connecting to database:", err.message);
  }
  console.log("✅ Connected to the database.");
});

// Perintah SQL untuk menambahkan admin
const sql = `INSERT INTO admins (username, password) VALUES (?, ?)`;

db.run(sql, [newUsername, newPassword], function (err) {
  if (err) {
    // Cek jika error karena username sudah ada (UNIQUE constraint)
    if (err.message.includes("UNIQUE constraint failed")) {
      return console.error(`❌ Gagal! Username '${newUsername}' sudah ada.`);
    }
    return console.error("Error inserting admin:", err.message);
  }
  // `this.lastID` akan berisi ID dari admin yang baru ditambahkan
  console.log(
    `👍 Admin baru '${newUsername}' berhasil ditambahkan dengan ID: ${this.lastID}`
  );
});

// Tutup koneksi database
db.close((err) => {
  if (err) {
    return console.error("Error closing the database:", err.message);
  }
  console.log("✅ Database connection closed.");
});
