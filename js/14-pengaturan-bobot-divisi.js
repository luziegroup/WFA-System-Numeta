/* ============================================================
 * FILE   : 14-pengaturan-bobot-divisi.js
 * BAGIAN : Pengaturan Bobot & Divisi
 * ISI    : Simpan bobot penilaian performa, kelola daftar divisi (tambah/hapus).
 * ============================================================ */

// ==================== BOBOT PENILAIAN PERFORMA ====================
function simpanBobotPerforma() {
  var bA = parseFloat(document.getElementById('cfg-bobotAbsen')?.value);
  var bT = parseFloat(document.getElementById('cfg-bobotTodo')?.value);
  var bK = parseFloat(document.getElementById('cfg-bobotKomunikasi')?.value);
  var minRata = parseInt(document.getElementById('cfg-minSkorRataRata')?.value);
  var hariCabut = parseInt(document.getElementById('cfg-hariEvaluasiCabut')?.value);

  if (isNaN(bA)||isNaN(bT)||isNaN(bK)||bA<0||bT<0||bK<0) { showToast('Bobot harus berupa angka >= 0','error'); return; }
  if (bA+bT+bK <= 0) { showToast('Minimal satu bobot harus lebih dari 0','error'); return; }
  if (isNaN(minRata)||minRata<0||minRata>100) { showToast('Ambang batas skor harus 0-100','error'); return; }
  if (isNaN(hariCabut)||hariCabut<1) { showToast('Hari evaluasi minimal 1','error'); return; }

  DB.settings.bobotAbsen      = bA;
  DB.settings.bobotTodo       = bT;
  DB.settings.bobotKomunikasi = bK;
  DB.settings.minSkorRataRata = minRata;
  DB.settings.hariEvaluasiCabut = hariCabut;

  // Hitung ulang seluruh skor harian bulan ini dengan bobot baru
  recalcSemuaSkor();

  // BUGFIX: scope hanya ke branch yang benar2 disentuh (settings, attendance, employees,
  // notifikasi, sanksi) — bukan dbSave(DB) yang juga ikut menimpa todos/zoomMeetings yang
  // tidak ada hubungannya dengan aksi ini.
  dbSaveLocal(DB);
  dbSavePath('settings', cleanForFirebase(DB.settings));
  dbSavePath('attendance', cleanForFirebase(DB.attendance));
  dbSavePath('employees', cleanForFirebase(DB.employees));
  dbSavePath('notifikasiPerforma', cleanForFirebase(DB.notifikasiPerforma));
  dbSavePath('sanctions', cleanForFirebase(DB.sanctions));
  showToast('✅ Bobot & ambang batas tersimpan. Skor seluruh karyawan dihitung ulang.', 'success');
  showPage('hrd','pengaturan');
}

// Hitung ulang skor harian semua karyawan untuk seluruh tanggal yang ada di attendance
function recalcSemuaSkor() {
  Object.keys(DB.attendance).forEach(function(aKey) {
    var email = emailFromAttendKey(aKey);
    if (email) hitungSkorHarian(email, aKey);
  });
}

// ==================== KELOLA DIVISI ====================
function tambahDivisi() {
  var inp = document.getElementById('divisi-baru');
  var nama = (inp?.value || '').trim();
  if (!nama) { showToast('Nama divisi tidak boleh kosong','error'); return; }

  var list = getDivisiList().slice();
  if (list.some(function(d){ return d.toLowerCase() === nama.toLowerCase(); })) {
    showToast('Divisi "' + nama + '" sudah ada','warning'); return;
  }

  list.push(nama);
  DB.settings.divisiList = list;
  dbSaveLocal(DB);
  dbSavePath('settings', cleanForFirebase(DB.settings)); // BUGFIX: jangan timpa seluruh DB

  showToast('✅ Divisi "' + nama + '" berhasil ditambahkan', 'success');
  showPage('hrd','pengaturan');
}

function hapusDivisi(idx) {
  var list = getDivisiList().slice();
  var nama = list[idx];
  if (nama === undefined) return;

  var dipakai = DB.employees.filter(function(e){ return e.div === nama; }).length;
  var msg = 'Hapus divisi "' + nama + '"?';
  if (dipakai) msg += '\n\n⚠️ ' + dipakai + ' karyawan saat ini menggunakan divisi ini. Data mereka TIDAK akan otomatis berubah, namun divisi ini tidak akan muncul lagi di pilihan baru.';
  if (!confirm(msg)) return;

  list.splice(idx, 1);
  DB.settings.divisiList = list;
  dbSaveLocal(DB);
  dbSavePath('settings', cleanForFirebase(DB.settings)); // BUGFIX: jangan timpa seluruh DB

  showToast('Divisi "' + nama + '" dihapus dari daftar pilihan', 'warning');
  showPage('hrd','pengaturan');
}

