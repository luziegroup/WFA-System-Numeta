/* ============================================================
 * FILE   : 01-data-store.js
 * BAGIAN : Data Store & Sinkronisasi Realtime
 * ISI    : Fungsi baca/tulis localStorage, sinkronisasi Firebase, antrian pending write, struktur data utama DB & USERS, helper key tanggal/absen.
 * ============================================================ */

// ==================== REALTIME DATA STORE ====================
// Data tersimpan di localStorage — persisten antar sesi & tab
// BroadcastChannel memungkinkan update realtime antar tab/window

// ==================== FIREBASE REALTIME DATA STORE ====================
// Firebase Realtime Database sebagai backend utama
// localStorage sebagai cache & fallback offline

const DB_KEY    = 'wfa_data_v3_luzie';
const USERS_KEY = 'wfa_users_v2_luzie';
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('wfa_realtime') : null;
var DEFAULT_DIVISI_LIST = ['MJO','Keuangan','IT & Data','Marketplace','CRM','Kreatif','Operasional H2','Numeta'];

// ---- Cache lokal ----
function dbLoadLocal() {
  try { const r = localStorage.getItem(DB_KEY); if (r) return JSON.parse(r); } catch(e) {}
  return null;
}
function dbSaveLocal(data) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(data)); } catch(e) {}
}

// ---- Sesi login (BUGFIX: agar refresh halaman TIDAK kembali ke layar login, ----
// ---- tapi lanjut tepat di halaman/posisi terakhir yang dibuka user) ----
const SESSION_KEY = 'wfa_session_v1_luzie';
function saveSession() {
  if (!currentUser) return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      email: currentUser.email,
      role: currentUser.role,
      pageId: currentPageId
    }));
  } catch(e) {}
}
function loadSession() {
  try { var r = localStorage.getItem(SESSION_KEY); if (r) return JSON.parse(r); } catch(e) {}
  return null;
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch(e) {}
}

// ==================== ANTRIAN TULIS YANG BELUM TERKONFIRMASI ====================
// MASALAH YANG DIPERBAIKI: sebelumnya, kalau dbSavePath() gagal terkirim ke server
// (mis. koneksi putus saat karyawan absen), datanya HANYA ada di layar & localStorage.
// Begitu listener Firebase di bawah menerima data terbaru dari server (yang tidak
// punya perubahan tadi), baris "DB = val" menimpa total DB lokal — perubahan yang
// belum terkirim itu HILANG, padahal user sudah diberi tahu "muat ulang untuk coba
// lagi" — reload justru membuang datanya, bukan mengirim ulang.
//
// Sekarang setiap dbSavePath() dicatat ke antrian ini (disimpan juga ke localStorage
// agar selamat walau tab ditutup/refresh sebelum sempat terkirim). Antrian ini
// dicoba dikirim ulang otomatis saat: (1) koneksi Firebase kembali online, dan
// (2) setiap kali snapshot baru diterima dari server. Item baru dibuang dari
// antrian hanya setelah benar-benar berhasil tersimpan di server.
var PENDING_WRITES_KEY = 'wfa_pending_writes_v1';
function loadPendingWrites() {
  try { return JSON.parse(localStorage.getItem(PENDING_WRITES_KEY) || '{}'); } catch(e) { return {}; }
}
function savePendingWritesToLocal() {
  try { localStorage.setItem(PENDING_WRITES_KEY, JSON.stringify(pendingWrites)); } catch(e) {}
}
var pendingWrites = loadPendingWrites();

// Timpakan path yang masih tertunda ke atas object DB (dot-path sederhana, mis. "attendance/abc_2026-07-02")
function applyPendingWritesTo(dbObj) {
  Object.keys(pendingWrites).forEach(function(path) {
    var parts = path.split('/');
    var cur = dbObj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = pendingWrites[path];
  });
}

// Coba kirim ulang satu path yang masih tertunda
function retryPendingWrite(path) {
  if (!(path in pendingWrites)) return;
  fbRef('db/' + path).set(pendingWrites[path]).then(function() {
    delete pendingWrites[path];
    savePendingWritesToLocal();
  }).catch(function(e) {
    console.warn('Retry pending write gagal untuk path', path, e);
  });
}

function flushPendingWrites() {
  Object.keys(pendingWrites).forEach(retryPendingWrite);
}

// ---- Firebase helpers ----
function fbRef(path) { return rtdb.ref('luzie/' + path); }
function emailToKey(email) { return (email||'').replace(/\./g,'_').replace(/#/g,'_').replace(/\$/g,'_').replace(/\[/g,'_').replace(/\]/g,'_'); }

// Status koneksi Firebase
var fbOnline = false;
rtdb.ref('.info/connected').on('value', function(snap) {
  fbOnline = !!snap.val();
  var dot = document.getElementById('fb-dot');
  var lbl = document.getElementById('fb-lbl');
  if (dot) dot.style.background = fbOnline ? 'var(--green)' : 'var(--amber)';
  if (lbl) lbl.textContent = fbOnline ? 'Online' : 'Offline';
  // Begitu koneksi kembali online, coba kirim ulang semua tulisan yang tertunda.
  if (fbOnline) flushPendingWrites();
});

// Bersihkan object dari nilai undefined sebelum kirim ke Firebase
// (Firebase menolak undefined — hanya terima null, string, number, boolean, array, object)
function cleanForFirebase(obj) {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(cleanForFirebase);
  if (typeof obj === 'object') {
    var out = {};
    Object.keys(obj).forEach(function(k) {
      var v = obj[k];
      if (v !== undefined) out[k] = cleanForFirebase(v);
    });
    return out;
  }
  return obj;
}

// Simpan ke Firebase + localStorage
function dbSave(data) {
  dbSaveLocal(data);
  if (bc) bc.postMessage({ type:'update', data });
  fbRef('db').set(cleanForFirebase(data)).catch(function(e){ console.warn('Firebase save error:', e); });
}

// Simpan hanya satu sub-path ke Firebase (lebih efisien)
// BUGFIX: sekarang mengembalikan Promise, agar pemanggil bisa kasih feedback jujur ke user
// (sebelumnya gagal kirim hanya tercatat di console, user tidak pernah tahu datanya belum tersimpan)
// BUGFIX #2: sekarang juga dicatat ke antrian pendingWrites, agar kalau gagal
// terkirim (atau tab keburu ditutup/refresh), datanya TIDAK hilang dan akan
// otomatis dicoba kirim ulang — bukan sekadar tercatat di console lalu lenyap.
function dbSavePath(path, value) {
  try {
    var cleaned = cleanForFirebase(value);
    pendingWrites[path] = cleaned;
    savePendingWritesToLocal();
    var p = fbRef('db/' + path).set(cleaned);
    p.then(function() {
      delete pendingWrites[path];
      savePendingWritesToLocal();
    });
    p.catch(function(e){ console.warn('Firebase path save error:', e); });
    return p;
  } catch(e) {
    console.warn('Firebase path save error:', e);
    return Promise.reject(e);
  }
}

// Multi-path update relatif terhadap satu basePath — dipakai fitur arsip untuk
// menghapus banyak key sekaligus (key:null) dalam SATU panggilan jaringan,
// bukan timpa seluruh DB.
function dbUpdatePaths(basePath, updatesObj) {
  try {
    var p = fbRef('db/' + basePath).update(updatesObj);
    p.catch(function(e){ console.warn('Firebase update error:', e); });
    return p;
  } catch(e) {
    console.warn('Firebase update error:', e);
    return Promise.reject(e);
  }
}

// Inisialisasi DB — coba ambil dari Firebase, fallback ke localStorage
var DB = dbLoadLocal() || {
  employees:    [],
  sanctions:    [],
  attendance:   {},
  todos:        {},
  zoomMeetings: [],
  notifikasiPerforma: [],
  settings: { batasPagi:'08:30', mulaiSiang:'12:00', mulaiKerja:'08:00', selesaiKerja:'17:00', radiusGPS:50, minSkorBonus:75, divisiList: DEFAULT_DIVISI_LIST.slice(), bobotAbsen:34, bobotTodo:33, bobotKomunikasi:33, minSkorRataRata:70, hariEvaluasiCabut:5 }
};

// Realtime listener Firebase → update DB dan refresh halaman
fbRef('db').on('value', function(snap) {
  var val = snap.val();
  if (val) {
    // Merge: Firebase adalah sumber kebenaran
    DB = val;
    // Pastikan field wajib ada
    DB.employees    = DB.employees    || [];
    DB.sanctions    = DB.sanctions    || [];
    DB.attendance   = DB.attendance   || {};
    DB.todos        = DB.todos        || {};
    DB.zoomMeetings = DB.zoomMeetings || [];
    DB.notifikasiPerforma = DB.notifikasiPerforma || [];
    DB.settings     = DB.settings     || { batasPagi:'08:30', mulaiSiang:'12:00', mulaiKerja:'08:00', selesaiKerja:'17:00', radiusGPS:50, minSkorBonus:75, divisiList: DEFAULT_DIVISI_LIST.slice(), bobotAbsen:34, bobotTodo:33, bobotKomunikasi:33, minSkorRataRata:70, hariEvaluasiCabut:5 };
    if (DB.settings.bobotAbsen      === undefined) DB.settings.bobotAbsen      = 34;
    if (DB.settings.bobotTodo       === undefined) DB.settings.bobotTodo       = 33;
    if (DB.settings.bobotKomunikasi === undefined) DB.settings.bobotKomunikasi = 33;
    if (DB.settings.minSkorRataRata === undefined) DB.settings.minSkorRataRata = 70;
    if (DB.settings.hariEvaluasiCabut === undefined) DB.settings.hariEvaluasiCabut = 5;
    if (!Array.isArray(DB.settings.divisiList) || !DB.settings.divisiList.length) DB.settings.divisiList = DEFAULT_DIVISI_LIST.slice();
    // BUGFIX: sebelum data dari server ini dianggap final, timpakan dulu tulisan
    // yang masih tertunda (belum terkonfirmasi sukses) di atasnya — supaya absen/
    // to-do yang belum sempat terkirim tidak hilang hanya karena snapshot baru
    // datang atau halaman di-refresh, lalu coba kirim ulang.
    applyPendingWritesTo(DB);
    dbSaveLocal(DB);
    if (currentUser) refreshCurrentPage();
    flushPendingWrites();
  } else {
    // Belum ada data di Firebase → push data lokal
    fbRef('db').set(cleanForFirebase(DB)).catch(function(){});
  }
}, function(err) {
  console.warn('Firebase listener error (mode offline):', err);
});

// Realtime sync antar tab browser (BroadcastChannel)
if (bc) {
  bc.onmessage = function(e) {
    if (e.data && e.data.type === 'update') {
      DB = e.data.data;
      if (currentUser) refreshCurrentPage();
    }
  };
}

// ---- USERS (akun login) ----
// Firebase tidak boleh pakai karakter . @ # $ [ ] sebagai key
// → encode email ke Firebase-safe key saat simpan, decode saat baca

function encodeEmailKey(email) {
  // @ → |at|   . → |dot|
  return (email || '').replace(/@/g, '|at|').replace(/\./g, '|dot|');
}
function decodeEmailKey(key) {
  return (key || '').replace(/\|at\|/g, '@').replace(/\|dot\|/g, '.');
}

// Konversi object USERS {email: data} → Firebase-safe {encodedKey: data}
function usersToFirebase(usersObj) {
  var out = {};
  Object.keys(usersObj).forEach(function(email) {
    out[encodeEmailKey(email)] = cleanForFirebase(usersObj[email]);
  });
  return out;
}
// Konversi balik Firebase {encodedKey: data} → {email: data}
function usersFromFirebase(fbObj) {
  var out = {};
  Object.keys(fbObj).forEach(function(key) {
    out[decodeEmailKey(key)] = fbObj[key];
  });
  return out;
}

function usersLoadLocal() {
  try { var r = localStorage.getItem(USERS_KEY); if (r) return JSON.parse(r); } catch(e) {}
  return null;
}
function usersSaveLocal(data) {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(data)); } catch(e) {}
}

var USERS = usersLoadLocal() || {};

// Inisialisasi akun default jika belum ada
fbRef('users').once('value').then(function(snap) {
  var val = snap.val();
  if (val) {
    USERS = usersFromFirebase(val);
    usersSaveLocal(USERS);
  } else {
    // Pertama kali — buat akun admin default
    var defaults = {
      'admin@luziegroup.id': { name:'Admin HRD', initials:'HR', avBg:'#0078D4', avColor:'#fff', roles:[{pass:'admin123', role:'hrd'}] }
    };
    USERS = defaults;
    usersSaveLocal(USERS);
    fbRef('users').set(usersToFirebase(USERS)).catch(function(){});
  }
}).catch(function() {
  // Offline — gunakan cache lokal atau default
  if (!USERS || !Object.keys(USERS).length) {
    USERS = { 'admin@luziegroup.id': { name:'Admin HRD', initials:'HR', avBg:'#0078D4', avColor:'#fff', roles:[{pass:'admin123', role:'hrd'}] } };
  }
});

// Listener realtime untuk USERS (sinkron perubahan akun antar device)
fbRef('users').on('value', function(snap) {
  var val = snap.val();
  if (val) { USERS = usersFromFirebase(val); usersSaveLocal(USERS); sanitizeDB(); }
});

function saveUsers(data) {
  USERS = data;
  usersSaveLocal(data);
  fbRef('users').set(usersToFirebase(data)).catch(function(e){ console.warn('Firebase users save error:', e); });
}

function todayKey() { return new Date().toISOString().split('T')[0]; }
// BUGFIX: email selalu dilowercase sebelum encode agar key konsisten antar semua operasi
function attendKey(email) { return (email||'').toLowerCase().replace(/[.#$\[\]]/g,'_') + '_' + todayKey(); }
function attendKeyFor(email, dateKey) { return (email||'').toLowerCase().replace(/[.#$\[\]]/g,'_') + '_' + dateKey; }

// Cari email karyawan dari attendance key (key = sanitizedEmail_YYYY-MM-DD)
function emailFromAttendKey(aKey) {
  // BUGFIX: bandingkan dengan lowercase email agar konsisten dengan attendKey()
  var match = DB.employees.find(function(e) {
    var prefix = (e.email||'').toLowerCase().replace(/[.#$\[\]]/g,'_') + '_';
    return aKey.startsWith(prefix);
  });
  return match ? match.email : null;
}

