/* ============================================================
 * FILE   : 13-hrd-karyawan-actions.js
 * BAGIAN : Aksi HRD atas Karyawan
 * ISI    : Tambah karyawan, ubah status, kirim sanksi, ganti password sendiri (karyawan/koordinator), preview email.
 * ============================================================ */

// ==================== AKSI HRD ====================
// Ambil daftar koordinator valid dari USERS (yang punya role 'koor')
function getKoordinatorList() {
  return Object.values(USERS).filter(function(u){
    return u.roles.some(function(r){ return r.role === 'koor'; });
  }).map(function(u){ return u.name; });
}

// Cek apakah email/nama sudah terdaftar sebagai koordinator
function isKoordinator(emailOrName) {
  var s = (emailOrName||'').toLowerCase();
  return Object.entries(USERS).some(function(entry){
    var em = entry[0], u = entry[1];
    var hasKoor = u.roles.some(function(r){ return r.role === 'koor'; });
    return hasKoor && (em === s || u.name.toLowerCase() === s);
  });
}

// Helper: generate email dari nama
function namaToEmail(nama) {
  // Ambil kata pertama, lowercase, hapus karakter non-alfanumerik
  var clean = nama.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // hapus aksen
    .replace(/[^a-z0-9\s]/g,'').trim()
    .split(/\s+/)[0];                                  // hanya kata pertama
  return clean + '@luziegroup.id';
}

// Preview email saat mengetik nama
function previewEmailKaryawan() {
  var nama = (document.getElementById('new-nama')?.value||'').trim();
  var prev = document.getElementById('preview-email-kary');
  var val  = document.getElementById('preview-email-val');
  if (!prev || !val) return;
  if (nama.length < 2) { prev.style.display='none'; return; }
  var email = namaToEmail(nama);
  // Cek duplikat
  var dupKary = DB.employees.some(function(e){ return e.email===email; });
  var dupAkun = !!USERS[email];
  val.textContent = email;
  val.style.color = (dupKary||dupAkun) ? 'var(--red)' : 'var(--green)';
  if (dupKary||dupAkun) {
    val.textContent = email + ' (sudah digunakan — tambahkan nama tengah/belakang)';
  }
  prev.style.display = 'block';
}

function togglePassFieldKary() { togglePassFieldGeneric('new-pass','new-pass-eye'); }
function togglePassFieldGeneric(inputId, iconId) {
  var inp = document.getElementById(inputId);
  var ico = document.getElementById(iconId);
  if (!inp) return;
  inp.type = inp.type==='password' ? 'text' : 'password';
  if (ico) {
    ico.classList.toggle('ti-eye');
    ico.classList.toggle('ti-eye-off');
  }
}

// ==================== GANTI PASSWORD SENDIRI (KARYAWAN/KOORDINATOR) ====================
function gantiPasswordSendiri() {
  var oldPass = (document.getElementById('cp-old')?.value || '').trim();
  var newPass = (document.getElementById('cp-new')?.value || '').trim();
  var confirmPass = (document.getElementById('cp-confirm')?.value || '').trim();
  var errEl = document.getElementById('cp-err');
  var errMsgEl = document.getElementById('cp-err-msg');

  function showErr(msg) {
    errMsgEl.textContent = msg;
    errEl.style.display = 'flex';
  }

  var email = currentUser.email;
  var u = USERS[email];
  if (!u) { showErr('Akun tidak ditemukan'); return; }

  var roleEntry = u.roles.find(function(r){ return r.role === currentUser.role; });
  if (!roleEntry) { showErr('Role akun tidak ditemukan'); return; }

  if (!oldPass) { showErr('Password lama wajib diisi'); return; }
  if (roleEntry.pass !== oldPass) { showErr('Password lama tidak sesuai'); return; }
  if (!newPass || newPass.length < 6) { showErr('Password baru minimal 6 karakter'); return; }
  if (newPass !== confirmPass) { showErr('Konfirmasi password baru tidak cocok'); return; }
  if (newPass === oldPass) { showErr('Password baru tidak boleh sama dengan password lama'); return; }

  errEl.style.display = 'none';

  roleEntry.pass = newPass;
  saveUsers(USERS);

  document.getElementById('cp-old').value = '';
  document.getElementById('cp-new').value = '';
  document.getElementById('cp-confirm').value = '';

  showToast('✅ Password berhasil diperbarui', 'success');
}

// Buat akun karyawan "kosong" — profil (nama, divisi, koordinator) akan diisi mandiri saat login pertama
function tambahAkunKaryawanMandiri() {
  var email = (document.getElementById('pe-email')?.value || '').trim().toLowerCase();
  var pass  = (document.getElementById('pe-pass')?.value || '').trim();

  if (!email || !email.includes('@')) { showToast('Email/username tidak valid','error'); return; }
  if (!pass || pass.length < 6) { showToast('Password minimal 6 karakter','error'); return; }

  if (USERS[email]) { showToast('Email "' + email + '" sudah terdaftar','error'); return; }
  if (DB.employees.some(function(e){ return e.email===email; })) { showToast('Email "' + email + '" sudah digunakan karyawan lain','error'); return; }

  // Buat akun tanpa nama/divisi — ditandai belum lengkap
  USERS[email] = {
    name: '', initials: '??', avBg: '#94A3B8', avColor: '#fff',
    roles: [{ pass: pass, role: 'kary' }],
    setupDone: false
  };
  saveUsers(USERS);

  showToast('✅ Akun "' + email + '" dibuat. Karyawan akan diminta melengkapi profil saat login pertama.', 'success');
  document.getElementById('pe-email').value = '';
  document.getElementById('pe-pass').value = '';
  showPage('hrd','akun');
}

function addKaryawan() {
  var nama = document.getElementById('new-nama')?.value?.trim();
  var pass = document.getElementById('new-pass')?.value?.trim();
  var div  = document.getElementById('new-div')?.value;
  var koor = document.getElementById('new-koor')?.value;

  if (!nama) { showToast('Nama wajib diisi','error'); return; }
  if (!pass || pass.length < 6) { showToast('Password minimal 6 karakter','error'); return; }

  // Generate email otomatis dari nama — selalu lowercase
  var email = namaToEmail(nama).toLowerCase().trim();

  // Cek duplikat nama di karyawan
  if (DB.employees.find(function(e){ return (e.email||'').toLowerCase()===email; })) {
    showToast('Email "' + email + '" sudah terdaftar — gunakan nama lengkap agar berbeda','error');
    return;
  }
  // Cek duplikat di akun
  if (USERS[email]) {
    showToast('Akun "' + email + '" sudah ada — gunakan nama lengkap agar email berbeda','error');
    return;
  }

  // Validasi koordinator
  var validKoor = getKoordinatorList();
  if (validKoor.length && !validKoor.includes(koor)) {
    showToast('Koordinator tidak valid','error'); return;
  }

  var colors = ['#0078D4','#0050A0','#D97706','#94A3B8','#DC2626','#0D9E6B','#7C3AED','#0891B2'];
  var bg = colors[DB.employees.length % colors.length];

  // 1. Tambah ke daftar karyawan
  DB.employees.push({
    id: Date.now(), name: nama,
    inits: nama.split(' ').map(function(x){ return x[0]||''; }).join('').slice(0,2).toUpperCase(),
    div: div, koor: koor, email: email, bg: bg,
    status:'aktif', pelanggaran:0
  });
  dbSaveLocal(DB);
  dbSavePath('employees', cleanForFirebase(DB.employees)); // BUGFIX: jangan timpa seluruh DB

  // 2. Buat akun login otomatis
  USERS[email] = {
    name: nama,
    initials: nama.split(' ').map(function(x){ return x[0]||''; }).join('').slice(0,2).toUpperCase(),
    avBg: bg, avColor: '#fff',
    roles: [{ pass: pass, role: 'kary' }]
  };
  saveUsers(USERS);

  showToast('✅ ' + nama + ' ditambahkan — login: ' + email + ' / ' + pass, 'success');
  showPage('hrd','karyawan');
}

function ubahStatusKaryawan(id) {
  var idx = DB.employees.findIndex(function(e){ return e.id===id; });
  if (idx<0) return;
  // BUGFIX: status di DB.employees adalah status PERMANEN akun (aktif/cabut).
  // Status hadir/terlambat/belum hanya boleh datang dari absensi nyata di DB.attendance,
  // bukan diubah manual dari sini — jadi siklus hanya antara 'aktif' dan 'cabut'.
  // (Sebelumnya siklus mencakup 'hadir','terlambat','belum','cabut' yang menyebabkan
  // dashboard menampilkan status palsu dari DB.employees, bukan dari attendance hari ini.)
  var cur = DB.employees[idx].status;
  DB.employees[idx].status = (cur === 'cabut') ? 'aktif' : 'cabut';
  dbSaveLocal(DB);
  dbSavePath('employees/' + idx, cleanForFirebase(DB.employees[idx]));
  showToast('Status ' + DB.employees[idx].name + ' diubah ke: ' + DB.employees[idx].status, 'info');
  showPage('hrd','karyawan');
}

function kirimSanksiHRD() {
  var alasan = document.getElementById('h-alasan')?.value?.trim();
  if (!alasan) { showToast('Isi alasan pelanggaran','error'); return; }
  var jenis  = document.getElementById('h-jenis')?.value;
  var empNama= document.getElementById('h-emp')?.value;
  var jenisLabel = {lisan:'Teguran Lisan',tertulis:'Teguran Tertulis',cabut:'Pencabutan Hak WFA'}[jenis]||jenis;
  var tgl = new Date().toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
  DB.sanctions.unshift({id:Date.now(), date:tgl, from:'HRD', to:empNama, jenis:jenisLabel, alasan:alasan});
  var empIdx = DB.employees.findIndex(function(e){ return e.name===empNama; });
  if (empIdx>=0) {
    DB.employees[empIdx].pelanggaran = (DB.employees[empIdx].pelanggaran||0)+1;
    if (jenis==='cabut') DB.employees[empIdx].status='cabut';
  }
  dbSaveLocal(DB);
  dbSavePath('sanctions', cleanForFirebase(DB.sanctions)); // BUGFIX: jangan timpa seluruh DB
  if (empIdx>=0) dbSavePath('employees/' + empIdx, cleanForFirebase(DB.employees[empIdx]));
  showToast('Sanksi "'+jenisLabel+'" dikirim ke '+empNama, jenis==='cabut'?'error':'warning');
  document.getElementById('h-alasan').value='';
  showPage('hrd','sanksi');
}

function kirimSanksiKoor() {
  var alasan = document.getElementById('k-alasan')?.value?.trim();
  if (!alasan) { showToast('Isi keterangan pelanggaran','error'); return; }
  var emp    = document.getElementById('k-emp')?.value;
  var pelang = document.getElementById('k-pelang')?.value;
  var tgl    = new Date().toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
  DB.sanctions.unshift({id:Date.now(), date:tgl, from:'Koordinator', to:emp, jenis:'Teguran Lisan', alasan:'['+pelang+'] '+alasan});
  var empIdx = DB.employees.findIndex(function(e){ return e.name===emp; });
  if (empIdx>=0) DB.employees[empIdx].pelanggaran=(DB.employees[empIdx].pelanggaran||0)+1;
  dbSaveLocal(DB);
  dbSavePath('sanctions', cleanForFirebase(DB.sanctions)); // BUGFIX: jangan timpa seluruh DB
  if (empIdx>=0) dbSavePath('employees/' + empIdx, cleanForFirebase(DB.employees[empIdx]));
  showToast('Teguran dikirim ke '+emp+' dan diteruskan ke HRD','warning');
  document.getElementById('k-alasan').value='';
  showPage('koor','teguran');
}

function simpanPengaturan() {
  DB.settings.batasPagi  = document.getElementById('cfg-batasPagi')?.value || DB.settings.batasPagi;
  DB.settings.mulaiSiang = document.getElementById('cfg-mulaiSiang')?.value || DB.settings.mulaiSiang;
  DB.settings.minSkorBonus= parseInt(document.getElementById('cfg-minSkor')?.value)||DB.settings.minSkorBonus;
  dbSaveLocal(DB);
  dbSavePath('settings', cleanForFirebase(DB.settings)); // BUGFIX: jangan timpa seluruh DB
  showToast('Pengaturan berhasil disimpan dan berlaku realtime','success');
}

