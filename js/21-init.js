/* ============================================================
 * FILE   : 21-init.js
 * BAGIAN : Inisialisasi Aplikasi
 * ISI    : Start clock, resume sesi login setelah refresh — dijalankan paling akhir setelah semua fungsi lain ter-load.
 * ============================================================ */

// ==================== INIT ====================
updateClock();
setInterval(updateClock,1000);
trySessionResume(); // BUGFIX: lanjutkan ke halaman terakhir setelah refresh, bukan kembali ke login
