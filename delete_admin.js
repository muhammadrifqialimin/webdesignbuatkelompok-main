// hard_delete_admin.js
const sqlite3 = require("sqlite3").verbose();

// Mengambil username dari argumen command line
const usernameToDelete = process.argv[2];

// Cek apakah username diberikan
if (!usernameToDelete) {
  console.error(
    "❌ Gagal! Harap sediakan username yang akan dihapus permanen."
  );
  console.log("   Contoh: node hard_delete_admin.js nama_admin");
  process.exit(1);
}

// Hubungkan ke database
const db = new sqlite3.Database("./db.sqlite", (err) => {
  if (err) {
    return console.error("Error connecting to database:", err.message);
  }
  console.log("✅ Connected to the database.");
});

// =================================================================
// PERBEDAAN UTAMA: Perintah SQL untuk menghapus baris secara permanen
const sql = `DELETE FROM admins WHERE username = ?`;
// =================================================================

// Jalankan perintah DELETE
db.run(sql, [usernameToDelete], function (err) {
  if (err) {
    return console.error("Error deleting admin:", err.message);
  }

  // `this.changes` akan memberitahu kita jika ada baris yang benar-benar dihapus.
  if (this.changes > 0) {
    console.log(
      `🗑️ Admin '${usernameToDelete}' berhasil DIHAPUS PERMANEN dari database.`
    );
  } else {
    console.log(`🤔 Admin '${usernameToDelete}' tidak ditemukan di database.`);
  }
});

// Tutup koneksi database
db.close((err) => {
  if (err) {
    return console.error("Error closing the database:", err.message);
  }
  console.log("✅ Database connection closed.");
});
