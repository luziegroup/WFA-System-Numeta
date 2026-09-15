/* ============================================================
 * FILE   : 02-scoring-engine.js
 * BAGIAN : Engine Penilaian Performa
 * ISI    : Perhitungan skor absen, skor todo, skor harian, rata-rata bulanan, evaluasi performa otomatis & notifikasi.
 * ============================================================ */

// ==================== ENGINE PENILAIAN PERFORMA ====================
// Komponen 1: Skor Absen (0-100) — gabungan ketepatan absen PAGI & kelengkapan absen SIANG.
// PERUBAHAN: sebelumnya skor Absen hanya dihitung dari ketepatan absen pagi, sehingga karyawan
// yang absen pagi tepat waktu tapi TIDAK absen siang tetap dapat skor Absen 100 (padahal
// harinya "Tidak Lengkap"). Sekarang skor Absen = rata-rata (ketepatan pagi + kelengkapan siang),
// jadi hari yang cuma absen pagi saja otomatis menurunkan skor Absen, bukan cuma skor akhir.
function hitungSkorAbsen(rec) {
  if (!rec || !rec.pagi) return null; // belum absen pagi sama sekali → tidak dinilai

  var skorPagi;
  if (rec.status !== 'terlambat') {
    skorPagi = 100;
  } else {
    // Hitung menit keterlambatan dari batasPagi
    var batas = (DB.settings.batasPagi || '08:30').split(':').map(Number);
    var pagi  = (rec.pagi || '00:00').split(':').map(Number);
    var batasMin = batas[0]*60 + batas[1];
    var pagiMin  = pagi[0]*60  + pagi[1];
    var telat = Math.max(0, pagiMin - batasMin);
    // Penalti: -2 poin per menit terlambat, minimum 30
    skorPagi = Math.max(30, Math.round(100 - (telat * 2)));
  }

  // Absen siang: 100 jika sudah absen siang, 0 jika belum (belum lengkap hari itu)
  var skorSiang = rec.siang ? 100 : 0;

  return Math.round((skorPagi + skorSiang) / 2);
}

// Komponen 2: Skor To-Do (0-100) — rata-rata skor (memakai koreksi koordinator jika ada)
function hitungSkorTodo(aKey) {
  var todos = (DB.todos[aKey] || []).filter(function(t){ return t.task && t.task.trim(); });
  if (!todos.length) return null; // tidak ada to-do → tidak dinilai

  var nilai = todos.map(function(t) {
    var koreksi = (t.koreksi_skor !== null && t.koreksi_skor !== undefined) ? t.koreksi_skor : null;
    return koreksi !== null ? koreksi : t.score;
  }).filter(function(s){ return s !== null && s !== undefined; });

  if (!nilai.length) return null; // belum ada skor terisi
  return Math.round(nilai.reduce(function(a,b){return a+b;},0) / nilai.length);
}

// Hitung & simpan skor harian gabungan (dipanggil setiap ada perubahan absen/todo/komunikasi)
function hitungSkorHarian(email, aKey) {
  var rec = DB.attendance[aKey];
  if (!rec) return;

  var sAbsen = hitungSkorAbsen(rec);
  var sTodo  = hitungSkorTodo(aKey);
  var sKom   = (rec.skorKomunikasi !== null && rec.skorKomunikasi !== undefined) ? rec.skorKomunikasi : null;

  rec.skorAbsen      = sAbsen;
  rec.skorTodo       = sTodo;
  rec.skorKomunikasi = sKom;

  var wA = DB.settings.bobotAbsen      ?? 34;
  var wT = DB.settings.bobotTodo       ?? 33;
  var wK = DB.settings.bobotKomunikasi ?? 33;

  // PERUBAHAN: sebelumnya komponen yang belum terisi (null) DIKECUALIKAN dari perhitungan —
  // bobotnya otomatis dilimpahkan ke komponen lain, sehingga skor akhir bisa tampil tinggi
  // (mis. 100) padahal karyawan baru absen pagi dan BELUM mengisi to-do/dinilai komunikasinya.
  // Sekarang komponen yang belum terisi dihitung sebagai 0 — supaya rata-rata yang ditampilkan
  // benar-benar mencerminkan kelengkapan kinerja hari itu (Absen + To-Do + Komunikasi).
  // Skor akhir hanya dihitung kalau karyawan sudah absen pagi hari itu; kalau belum absen sama
  // sekali, tetap tidak ada skor (null), bukan 0 — supaya hari "tidak WFA" tidak ikut menurunkan
  // rata-rata bulanan.
  if (rec.pagi) {
    var nAbsen = sAbsen !== null ? sAbsen : 0;
    var nTodo  = sTodo  !== null ? sTodo  : 0;
    var nKom   = sKom   !== null ? sKom   : 0;
    rec.skor = Math.round((nAbsen*wA + nTodo*wT + nKom*wK) / (wA+wT+wK));
  } else {
    rec.skor = null;
  }

  // Sinkronkan ke DB.employees.skor (avg bulan ini) untuk tampilan ringkas
  updateAvgSkorBulanan(email);
}

// BUGFIX: simpan HANYA bagian DB yang benar-benar disentuh oleh hitungSkorHarian
// (attendance/employees/notifikasi/sanksi), bukan dbSave(DB) yang menimpa seluruh database
// dan berisiko menghapus absen/to-do karyawan lain yang ditulis di waktu yang berdekatan.
function persistSkorHarian(email, aKey) {
  dbSaveLocal(DB);
  dbSavePath('attendance/' + aKey, cleanForFirebase(DB.attendance[aKey]));
  var idx = DB.employees.findIndex(function(e){ return (e.email||'').toLowerCase() === (email||'').toLowerCase(); });
  if (idx >= 0) dbSavePath('employees/' + idx, cleanForFirebase(DB.employees[idx]));
  dbSavePath('notifikasiPerforma', cleanForFirebase(DB.notifikasiPerforma));
  dbSavePath('sanctions', cleanForFirebase(DB.sanctions));
}

// Hitung rata-rata skor bulan ini untuk seorang karyawan & simpan ke DB.employees
function updateAvgSkorBulanan(email) {
  var emp = DB.employees.find(function(e){ return e.email === email; });
  if (!emp) return;

  var bulanIni = todayKey().slice(0,7); // YYYY-MM
  var encEmail = (email||'').toLowerCase().replace(/[.#$\[\]]/g,'_'); // BUGFIX: lowercase
  var skorArr = [];
  Object.keys(DB.attendance).forEach(function(k) {
    if (!k.startsWith(encEmail + '_')) return;
    var tgl = k.slice((encEmail + '_').length);
    if (!tgl.startsWith(bulanIni)) return;
    var r = DB.attendance[k];
    if (r.skor !== null && r.skor !== undefined) skorArr.push(r.skor);
  });

  emp.skor = skorArr.length ? Math.round(skorArr.reduce(function(a,b){return a+b;},0)/skorArr.length) : null;

  // Cek evaluasi otomatis (peringatan / pencabutan WFA)
  evaluasiPerformaOtomatis(emp, skorArr);
}

// ==================== RIWAYAT SKOR BULANAN (untuk grafik & papan skor performa) ====================
// Cari skor harian TERAKHIR yang sudah tercatat untuk satu email (tanggal terbaru yang punya nilai skor,
// tidak harus hari ini — supaya papan skor tetap menampilkan sesuatu meski karyawan belum absen hari ini)
function getSkorTerakhir(email) {
  var encEmail = (email||'').toLowerCase().replace(/[.#$\[\]]/g,'_');
  var prefix   = encEmail + '_';
  var keys = Object.keys(DB.attendance)
    .filter(function(k){ return k.startsWith(prefix); })
    .sort().reverse(); // format key YYYY-MM-DD di akhir → sort string = sort tanggal, reverse = terbaru dulu

  for (var i = 0; i < keys.length; i++) {
    var r = DB.attendance[keys[i]];
    if (r && r.skor !== null && r.skor !== undefined) {
      return {
        skor: r.skor,
        tanggal: keys[i].slice(prefix.length),
        skorAbsen: r.skorAbsen,
        skorTodo: r.skorTodo,
        skorKomunikasi: r.skorKomunikasi
      };
    }
  }
  return null;
}

// Hitung rata-rata skor HARIAN gabungan dari sekumpulan email, dikelompokkan PER BULAN,
// untuk N bulan terakhir (termasuk bulan berjalan). Dipakai untuk grafik performa bulanan —
// bisa dipanggil dengan 1 email (grafik pribadi karyawan) atau banyak email sekaligus
// (grafik gabungan tim/koordinator atau seluruh perusahaan/HRD).
function hitungRataSkorBulanan(emails, numMonths) {
  numMonths = numMonths || 6;
  var now = new Date();

  // Susun daftar bulan target (lama -> baru), format key "YYYY-MM"
  var months = [];
  for (var i = numMonths - 1; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    months.push({ key: d.getFullYear() + '-' + mm, label: d.toLocaleDateString('id-ID', { month:'short', year:'2-digit' }) });
  }

  // Kumpulkan semua skor attendance milik email-email ini, dikelompokkan per bulan
  var byMonth = {};
  (emails || []).forEach(function(email) {
    var encEmail = (email||'').toLowerCase().replace(/[.#$\[\]]/g,'_');
    var prefix   = encEmail + '_';
    Object.keys(DB.attendance).forEach(function(k) {
      if (!k.startsWith(prefix)) return;
      var tgl      = k.slice(prefix.length); // YYYY-MM-DD
      var bulanKey = tgl.slice(0, 7);         // YYYY-MM
      var r = DB.attendance[k];
      if (!r || r.skor === null || r.skor === undefined) return;
      if (!byMonth[bulanKey]) byMonth[bulanKey] = [];
      byMonth[bulanKey].push(r.skor);
    });
  });

  return months.map(function(m) {
    var vals = byMonth[m.key] || [];
    var avg  = vals.length ? Math.round(vals.reduce(function(a,b){return a+b;},0)/vals.length) : null;
    return { key: m.key, label: m.label, avg: avg, jumlahData: vals.length };
  });
}

// ==================== HELPER FILTER BULAN (dipakai fitur Rekap & Analisis Performa) ====================
// Bangun daftar opsi bulan (terbaru dulu) untuk dropdown filter, format {key:'YYYY-MM', label:'Bulan Tahun'}
function getBulanOptionsList(n) {
  n = n || 12;
  var now = new Date();
  var out = [];
  for (var i = 0; i < n; i++) {
    var d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    out.push({ key: d.getFullYear() + '-' + mm, label: d.toLocaleDateString('id-ID', { month:'long', year:'numeric' }) });
  }
  return out;
}

// Daftar semua tanggal (YYYY-MM-DD) dalam satu bulan tertentu, urut tanggal 1 -> akhir bulan.
// Kalau bulan yang diminta adalah bulan berjalan, tanggal masa depan (belum terjadi) tidak
// disertakan — supaya grafik & rekap harian tidak menampilkan hari yang belum lewat.
function daftarTanggalBulan(bulanKey) {
  var parts = (bulanKey || '').split('-');
  var y = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
  if (!y || !m) return [];
  var lastDay = new Date(y, m, 0).getDate();
  var today   = todayKey();
  var dates   = [];
  for (var day = 1; day <= lastDay; day++) {
    var dk = y + '-' + String(m).padStart(2,'0') + '-' + String(day).padStart(2,'0');
    if (dk > today) break;
    dates.push(dk);
  }
  return dates;
}

// Daftar tanggal untuk N BULAN TERAKHIR (termasuk bulan berjalan), dari tanggal 1 di bulan
// paling awal sampai HARI INI — dipakai grafik skor harian "3 Bulan Terakhir" milik karyawan,
// supaya polanya konsisten dengan daftarTanggalBulan (tidak menampilkan tanggal yang belum lewat).
function daftarTanggalRentangBulan(numMonths) {
  var now   = new Date();
  var start = new Date(now.getFullYear(), now.getMonth() - (numMonths - 1), 1);
  var today = todayKey();
  var dates = [];
  var cur   = new Date(start);
  while (true) {
    var dk = cur.getFullYear() + '-' + String(cur.getMonth()+1).padStart(2,'0') + '-' + String(cur.getDate()).padStart(2,'0');
    if (dk > today) break;
    dates.push(dk);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// Evaluasi otomatis: peringatan jika skor di bawah ambang, cabut WFA jika berturut-turut N hari
function evaluasiPerformaOtomatis(emp, skorArrBulanIni) {
  var minSkor = DB.settings.minSkorRataRata ?? 70;
  var maxHariBuruk = DB.settings.hariEvaluasiCabut ?? 5;

  if (!skorArrBulanIni.length) return;

  // Hitung berapa hari TERAKHIR berturut-turut skor < minSkor
  var email = (emp.email||'').toLowerCase(); // BUGFIX: lowercase
  var encEmailEval = email.replace(/[.#$\[\]]/g,'_');
  var allDates = Object.keys(DB.attendance)
    .filter(function(k){ return k.startsWith(encEmailEval + '_'); })
    .map(function(k){ return { key:k, tgl:k.slice((email.replace(/[.#$\[\]]/g,'_') + '_').length), rec:DB.attendance[k] }; })
    .filter(function(x){ return x.rec.skor !== null && x.rec.skor !== undefined; })
    .sort(function(a,b){ return a.tgl < b.tgl ? 1 : -1; }); // terbaru dulu

  var consecutiveBad = 0;
  for (var i=0; i<allDates.length; i++) {
    if (allDates[i].rec.skor < minSkor) consecutiveBad++;
    else break;
  }

  var avgBulanIni = Math.round(skorArrBulanIni.reduce(function(a,b){return a+b;},0)/skorArrBulanIni.length);

  if (consecutiveBad >= maxHariBuruk) {
    if (emp.status !== 'cabut') {
      emp.status = 'cabut';
      tambahNotifikasiPerforma(emp, 'cabut', avgBulanIni, consecutiveBad);
    }
  } else if (avgBulanIni < minSkor || consecutiveBad > 0) {
    tambahNotifikasiPerforma(emp, 'peringatan', avgBulanIni, consecutiveBad);
  }
}

// Simpan notifikasi performa ke DB (dibaca karyawan & koordinator)
function tambahNotifikasiPerforma(emp, jenis, avgSkor, hariBerturut) {
  DB.notifikasiPerforma = DB.notifikasiPerforma || [];

  // Cegah duplikat notifikasi untuk hari yang sama
  var existingToday = DB.notifikasiPerforma.find(function(n) {
    return n.email === emp.email && n.tanggal === todayKey() && n.jenis === jenis;
  });
  if (existingToday) return;

  var pesan = jenis === 'cabut'
    ? 'Hak WFA dicabut otomatis: skor performa di bawah ' + (DB.settings.minSkorRataRata||70) + ' selama ' + hariBerturut + ' hari berturut-turut (rata-rata: ' + avgSkor + ').'
    : 'Skor performa rata-rata bulan ini (' + avgSkor + ') di bawah target ' + (DB.settings.minSkorRataRata||70) + '. Segera tingkatkan ketepatan absen, kualitas to-do, dan komunikasi.';

  DB.notifikasiPerforma.unshift({
    id: Date.now(),
    email: emp.email || '',
    nama: emp.name || '',
    koor: emp.koor || '',
    jenis: jenis,
    pesan: pesan,
    avgSkor: avgSkor || 0,
    hariBerturut: hariBerturut || 0,
    tanggal: todayKey(),
    dibaca: false
  });

  // Batasi 200 notifikasi terakhir
  if (DB.notifikasiPerforma.length > 200) DB.notifikasiPerforma = DB.notifikasiPerforma.slice(0,200);

  // Jika cabut → catat juga sebagai sanksi otomatis
  if (jenis === 'cabut') {
    DB.sanctions = DB.sanctions || [];
    DB.sanctions.unshift({
      id: Date.now()+1,
      date: new Date().toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}),
      from: 'Sistem (Otomatis)',
      to: emp.name || '',
      jenis: 'Pencabutan Hak WFA',
      alasan: pesan || ''
    });
  }
}

// Sanitasi DB — jalankan setiap kali USERS sudah terbaca dari Firebase
function sanitizeDB() {
  if (!USERS || !Object.keys(USERS).length) return;
  var validKoors = Object.values(USERS).filter(function(u){
    return u.roles && u.roles.some(function(r){ return r.role==='koor'; });
  }).map(function(u){ return u.name; });

  var koorOnlyEmails = Object.keys(USERS).filter(function(k){
    var u = USERS[k];
    if (!u || !u.roles) return false;
    var hasKoor = u.roles.some(function(r){ return r.role==='koor'; });
    var hasKary = u.roles.some(function(r){ return r.role==='kary'; });
    return hasKoor && !hasKary;
  });

  var defaultKoor = validKoors[0] || '';
  var changed = false;

  var before = DB.employees.length;
  DB.employees = DB.employees.filter(function(e){ return !koorOnlyEmails.includes(e.email); });
  if (DB.employees.length !== before) changed = true;

  if (validKoors.length) {
    DB.employees.forEach(function(e) {
      if (!validKoors.includes(e.koor)) { e.koor = defaultKoor; changed = true; }
    });
  }

  if (changed) {
    dbSaveLocal(DB);
    // BUGFIX: sebelumnya dbSave(DB) di sini menimpa SELURUH database memakai salinan
    // lokal client ini. Karena fungsi ini otomatis jalan di SEMUA browser karyawan setiap
    // kali ada perubahan akun, ini sering menghapus absen/to-do yang baru ditulis client lain
    // pada saat yang sama. Sekarang pakai transaction yang hanya menyentuh path 'employees'
    // dan menghitung ulang dari data TERBARU di server, jadi tidak bisa menimpa data lain.
    fbRef('db/employees').transaction(function(serverEmployees) {
      var emps = serverEmployees || [];
      emps = emps.filter(function(e){ return !koorOnlyEmails.includes(e.email); });
      if (validKoors.length) {
        emps.forEach(function(e) {
          if (!validKoors.includes(e.koor)) e.koor = defaultKoor;
        });
      }
      return cleanForFirebase(emps);
    });
  }
}

let currentUser = null;
let gpsCoords = null;
let gpsWatchId = null;
let currentPageId = null;
let currentRole = null;

