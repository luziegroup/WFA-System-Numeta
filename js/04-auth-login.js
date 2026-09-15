/* ============================================================
 * FILE   : 04-auth-login.js
 * BAGIAN : Login & Setup Profil
 * ISI    : Alur login 3 langkah (role -> nama -> password), setup profil mandiri karyawan baru, logout, resume sesi.
 * ============================================================ */

// ==================== LOGIN ====================
var loginSelectedRole  = null;  // 'hrd' | 'koor' | 'kary'
var loginSelectedEmail = null;  // email akun yang dipilih
var loginNamaListCache = [];    // cache daftar akun untuk filter pencarian nama

var ROLE_LABEL = { hrd:'HRD', koor:'Koordinator', kary:'Karyawan' };
var ROLE_ICON  = { hrd:'ti-building-bank', koor:'ti-user-star', kary:'ti-user' };
var ROLE_COLOR = { hrd:'#0050A0', koor:'#0D9E6B', kary:'#D97706' };
// DIVISI_LIST diambil dari DB.settings.divisiList (dapat dikelola HRD di Pengaturan Sistem)
function getDivisiList() {
  if (DB.settings && Array.isArray(DB.settings.divisiList) && DB.settings.divisiList.length) {
    return DB.settings.divisiList;
  }
  return DEFAULT_DIVISI_LIST;
}

function loginPilihRole(role, el) {
  loginSelectedRole  = role;
  loginSelectedEmail = null;

  // Tandai role card
  document.querySelectorAll('.role-card').forEach(function(c){ c.classList.remove('sel'); });
  if (el) el.classList.add('sel');

  // Kumpulkan akun yg punya role ini
  var list = Object.entries(USERS).filter(function(entry) {
    return entry[1].roles && entry[1].roles.some(function(r){ return r.role === role; });
  });

  loginNamaListCache = list; // simpan untuk filter pencarian

  var listEl = document.getElementById('login-nama-list');
  var errEl  = document.getElementById('l-err-nama');
  var searchEl = document.getElementById('login-nama-search');
  var searchErrEl = document.getElementById('l-err-search');
  if (searchEl) searchEl.value = '';
  if (searchErrEl) searchErrEl.style.display = 'none';

  if (!list.length) {
    listEl.innerHTML = '';
    errEl.style.display = 'flex';
    if (searchEl) searchEl.style.display = 'none';
  } else {
    errEl.style.display = 'none';
    if (searchEl) searchEl.style.display = 'block';
    renderLoginNamaList(list);
  }

  // Animasi: step1 → step2
  document.getElementById('login-step-1').style.display = 'none';
  document.getElementById('login-step-2').style.display = 'block';
  document.getElementById('login-step-3').style.display = 'none';
}

// Render daftar nama (dipakai oleh loginPilihRole & filterLoginNamaList)
function renderLoginNamaList(list) {
  var role = loginSelectedRole;
  var listEl = document.getElementById('login-nama-list');
  listEl.innerHTML = list.map(function(entry) {
    var email = entry[0];
    var u     = entry[1];
    var initials = u.initials || (u.name||'?').split(' ').map(function(x){return x[0]||'';}).join('').slice(0,2).toUpperCase();
    var bg = u.avBg || ROLE_COLOR[role];
    return '<button onclick="loginPilihNama(\'' + email.replace(/'/g,"\\'") + '\')" ' +
      'style="display:flex;align-items:center;gap:12px;padding:11px 14px;border:1.5px solid var(--gray-200);border-radius:var(--radius);background:#fff;cursor:pointer;text-align:left;transition:all .15s;font-family:var(--font)" ' +
      'onmouseenter="this.style.borderColor=\'var(--blue-400)\';this.style.background=\'var(--blue-50)\'" ' +
      'onmouseleave="this.style.borderColor=\'var(--gray-200)\';this.style.background=\'#fff\'">' +
      '<div style="width:36px;height:36px;border-radius:50%;background:' + bg + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0">' + initials + '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:14px;font-weight:600;color:var(--gray-800);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (u.name||email) + '</div>' +
        '<div style="font-size:11px;color:var(--gray-400);margin-top:1px">' + ROLE_LABEL[role] + '</div>' +
      '</div>' +
      '<i class="ti ti-chevron-right" style="font-size:16px;color:var(--gray-300);flex-shrink:0"></i>' +
    '</button>';
  }).join('');
}

// Filter daftar nama berdasarkan input pencarian (cocok di awal kata mana pun dalam nama)
function filterLoginNamaList() {
  var q = (document.getElementById('login-nama-search')?.value || '').trim().toLowerCase();
  var searchErrEl = document.getElementById('l-err-search');
  var listEl = document.getElementById('login-nama-list');

  if (!q) {
    renderLoginNamaList(loginNamaListCache);
    if (searchErrEl) searchErrEl.style.display = 'none';
    return;
  }

  var filtered = loginNamaListCache.filter(function(entry) {
    var u = entry[1];
    var email = entry[0];
    var nama = (u.name || email || '').toLowerCase();
    // Cocok jika ada kata dalam nama yang DIMULAI dengan huruf yang diketik
    return nama.split(/\s+/).some(function(word){ return word.indexOf(q) === 0; })
      || nama.indexOf(q) === 0
      || email.toLowerCase().indexOf(q) === 0;
  });

  if (!filtered.length) {
    listEl.innerHTML = '';
    if (searchErrEl) searchErrEl.style.display = 'flex';
  } else {
    if (searchErrEl) searchErrEl.style.display = 'none';
    renderLoginNamaList(filtered);
  }
}

function loginPilihNama(email) {
  loginSelectedEmail = email;
  var u    = USERS[email];
  var role = loginSelectedRole;
  if (!u) return;

  var initials = u.initials || (u.name||'?').split(' ').map(function(x){return x[0]||'';}).join('').slice(0,2).toUpperCase();
  var bg = u.avBg || ROLE_COLOR[role];

  // Isi profil card di step 3
  document.getElementById('login-selected-user').innerHTML =
    '<div style="width:42px;height:42px;border-radius:50%;background:' + bg + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0">' + initials + '</div>' +
    '<div>' +
      '<div style="font-size:15px;font-weight:700;color:var(--gray-800)">' + (u.name||email) + '</div>' +
      '<div style="display:flex;align-items:center;gap:5px;margin-top:2px">' +
        '<i class="ti ' + ROLE_ICON[role] + '" style="font-size:12px;color:' + ROLE_COLOR[role] + '"></i>' +
        '<span style="font-size:12px;color:var(--gray-500)">' + ROLE_LABEL[role] + '</span>' +
      '</div>' +
    '</div>';

  document.getElementById('l-pass').value = '';
  document.getElementById('l-err').style.display = 'none';

  // Animasi: step2 → step3
  document.getElementById('login-step-1').style.display = 'none';
  document.getElementById('login-step-2').style.display = 'none';
  document.getElementById('login-step-3').style.display = 'block';
  setTimeout(function(){ document.getElementById('l-pass').focus(); }, 50);
}

function loginBackToRole() {
  loginSelectedRole  = null;
  loginSelectedEmail = null;
  document.getElementById('login-step-1').style.display = 'block';
  document.getElementById('login-step-2').style.display = 'none';
  document.getElementById('login-step-3').style.display = 'none';
  document.querySelectorAll('.role-card').forEach(function(c){ c.classList.remove('sel'); });
}

function loginBackToNama() {
  loginSelectedEmail = null;
  document.getElementById('login-step-1').style.display = 'none';
  document.getElementById('login-step-2').style.display = 'block';
  document.getElementById('login-step-3').style.display = 'none';
  document.getElementById('l-err').style.display = 'none';
}

function togglePassVis() {
  var inp = document.getElementById('l-pass');
  var ico = document.getElementById('pass-eye');
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    if (ico) { ico.classList.remove('ti-eye'); ico.classList.add('ti-eye-off'); }
  } else {
    inp.type = 'password';
    if (ico) { ico.classList.remove('ti-eye-off'); ico.classList.add('ti-eye'); }
  }
}

// fillLogin dipanggil dari role-card lama — sekarang delegate ke loginPilihRole
function fillLogin(role, el) { loginPilihRole(role, el); }

function doLogin() {
  var email = (loginSelectedEmail || '').toLowerCase().trim();
  var pass  = document.getElementById('l-pass').value;
  var role  = loginSelectedRole;
  var errEl = document.getElementById('l-err');

  if (!email || !role) { return; }
  var u = USERS[email];
  if (!u) { errEl.style.display = 'flex'; return; }

  // Cari role yg cocok dengan password
  var matched = null;
  for (var i = 0; i < u.roles.length; i++) {
    if (u.roles[i].role === role && u.roles[i].pass === pass) { matched = u.roles[i]; break; }
  }
  if (!matched) { errEl.style.display = 'flex'; return; }

  errEl.style.display = 'none';

  // ---- Cek apakah profil karyawan belum lengkap (setup mandiri) ----
  if (matched.role === 'kary' && u.setupDone === false) {
    currentUser = { email:email, name:u.name, initials:u.initials, avBg:u.avBg, avColor:u.avColor, role:matched.role, _setupPass:pass };
    document.getElementById('login-page').style.display = 'none';
    showSetupProfile();
    return;
  }

  currentUser = { email:email, name:u.name, initials:u.initials, avBg:u.avBg, avColor:u.avColor, role:matched.role };
  document.getElementById('login-page').style.display = 'none';
  var ap = document.getElementById('app-page');
  ap.style.display = 'flex';
  ap.style.flexDirection = 'column';
  var av = document.getElementById('top-av');
  av.textContent = u.initials;
  av.style.background = u.avBg;
  av.style.color = u.avColor;
  document.getElementById('top-uname').textContent = u.name;
  document.getElementById('top-urole').textContent = ROLE_LABEL[matched.role];
  buildPortal(matched.role);
}

// ==================== SETUP PROFIL MANDIRI (KARYAWAN BARU) ====================
function showSetupProfile() {
  var page = document.getElementById('setup-page');
  if (!page) {
    page = document.createElement('div');
    page.id = 'setup-page';
    document.body.appendChild(page);
  }
  page.style.display = 'flex';

  var koorList = getKoordinatorList();
  var u = USERS[currentUser.email] || {};
  var prefillNama = u.name || '';

  page.innerHTML =
    '<div style="display:flex;flex-direction:column;min-height:100vh;background:var(--blue-900)">' +
      '<div class="login-top">' +
        '<div class="login-logo"><i class="ti ti-home-check" style="font-size:20px;color:var(--blue-700)"></i></div>' +
        '<div class="login-brand">WFA System <span>Luzie Group</span></div>' +
      '</div>' +
      '<div class="login-hero">' +
        '<div class="login-box">' +
          '<div class="login-title">Lengkapi Profil Anda</div>' +
          '<div class="login-sub">Selamat datang! Akun Anda belum aktif sepenuhnya.</div>' +
          '<div class="info-bar info-amber" style="margin-bottom:14px"><i class="ti ti-alert-triangle"></i><div><strong>Profil belum lengkap.</strong> Anda wajib mengisi Nama, Divisi, dan Koordinator terlebih dahulu sebelum dapat mengakses sistem.</div></div>' +
          '<div class="field"><label>Nama Lengkap <span style="color:var(--red)">*</span></label><input type="text" id="sp-nama" placeholder="Nama lengkap Anda" value="' + prefillNama.replace(/"/g,'&quot;') + '"/></div>' +
          '<div class="field"><label>Divisi <span style="color:var(--red)">*</span></label><select id="sp-div"><option value="">— Pilih Divisi —</option>' +
            getDivisiList().map(function(d){ return '<option>'+d+'</option>'; }).join('') +
          '</select></div>' +
          (koorList.length ?
            '<div class="field"><label>Koordinator <span style="color:var(--red)">*</span></label><select id="sp-koor"><option value="">— Pilih Koordinator —</option>' +
              koorList.map(function(n){ return '<option>'+n+'</option>'; }).join('') +
            '</select></div>'
          :
            '<div class="field"><label>Koordinator <span style="color:var(--red)">*</span></label><select id="sp-koor" disabled><option value="">Belum ada koordinator terdaftar</option></select>' +
            '<div style="font-size:11px;color:var(--amber);margin-top:4px"><i class="ti ti-alert-triangle"></i> Hubungi HRD untuk menambahkan akun koordinator terlebih dahulu.</div></div>'
          ) +
          '<div class="field"><label>Ganti Password?</label>' +
            '<div style="font-size:12px;color:var(--gray-500);margin-bottom:6px">Ingin mengganti password awal yang diberikan HRD dengan password baru Anda sendiri? Kosongkan jika tidak.</div>' +
            '<div style="position:relative">' +
              '<input type="password" id="sp-pass" placeholder="Kosongkan jika tetap pakai password awal" style="padding-right:38px"/>' +
              '<button type="button" onclick="togglePassFieldGeneric(\'sp-pass\',\'sp-pass-eye\')" tabindex="-1" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--gray-400);cursor:pointer;padding:4px;display:flex;align-items:center"><i class="ti ti-eye" id="sp-pass-eye" style="font-size:15px"></i></button>' +
            '</div>' +
          '</div>' +
          '<div class="err-msg" id="sp-err" style="display:flex"><i class="ti ti-alert-circle"></i> Lengkapi semua field yang wajib diisi</div>' +
          '<button class="btn btn-primary btn-full" onclick="simpanSetupProfile()"><i class="ti ti-check"></i> Simpan & Lanjutkan</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.getElementById('sp-err').style.display = 'none';
}

function simpanSetupProfile() {
  var nama = (document.getElementById('sp-nama')?.value || '').trim();
  var div  = document.getElementById('sp-div')?.value || '';
  var koor = document.getElementById('sp-koor')?.value || '';
  var newPass = (document.getElementById('sp-pass')?.value || '').trim();
  var errEl = document.getElementById('sp-err');

  if (!nama || !div || !koor) { errEl.style.display = 'flex'; return; }
  if (newPass && newPass.length < 6) {
    showToast('Password baru minimal 6 karakter','error'); return;
  }
  errEl.style.display = 'none';

  var email = (currentUser.email || '').toLowerCase().trim();
  var u = USERS[email];

  var initials = nama.split(' ').map(function(x){ return x[0]||''; }).join('').slice(0,2).toUpperCase();
  var colors = ['#0078D4','#0050A0','#D97706','#94A3B8','#DC2626','#0D9E6B','#7C3AED','#0891B2'];
  var bg = u.avBg && u.avBg !== '#94A3B8' ? u.avBg : colors[DB.employees.length % colors.length];

  // Update akun
  u.name = nama;
  u.initials = initials;
  u.avBg = bg;
  u.avColor = '#fff';
  u.setupDone = true;
  if (newPass) {
    var idx = u.roles.findIndex(function(r){ return r.role==='kary'; });
    if (idx>=0) u.roles[idx].pass = newPass;
  }
  saveUsers(USERS);

  // Buat record karyawan jika belum ada
  var existing = DB.employees.find(function(e){ return e.email===email; });
  if (existing) {
    existing.name = nama; existing.inits = initials; existing.div = div; existing.koor = koor; existing.bg = bg;
  } else {
    DB.employees.push({
      id: Date.now(), name: nama, inits: initials,
      div: div, koor: koor, email: email, bg: bg,
      status:'aktif', pelanggaran:0
    });
  }
  dbSaveLocal(DB);
  dbSavePath('employees', cleanForFirebase(DB.employees)); // BUGFIX: jangan timpa seluruh DB, hanya path employees
  currentUser.name = nama; currentUser.initials = initials; currentUser.avBg = bg; currentUser.avColor = '#fff';

  var setupPage = document.getElementById('setup-page');
  if (setupPage) setupPage.style.display = 'none';

  var ap = document.getElementById('app-page');
  ap.style.display = 'flex';
  ap.style.flexDirection = 'column';
  var av = document.getElementById('top-av');
  av.textContent = initials;
  av.style.background = bg;
  av.style.color = '#fff';
  document.getElementById('top-uname').textContent = nama;
  document.getElementById('top-urole').textContent = ROLE_LABEL['kary'];
  buildPortal('kary');

  showToast('✅ Profil berhasil disimpan. Selamat bergabung, ' + nama + '!', 'success');
}


function doLogout() {
  clearSession(); // BUGFIX: hapus sesi tersimpan agar refresh setelah logout tidak login otomatis lagi
  currentUser        = null;
  loginSelectedRole  = null;
  loginSelectedEmail = null;
  if (gpsWatchId) { navigator.geolocation.clearWatch(gpsWatchId); gpsWatchId = null; }
  document.getElementById('app-page').style.display = 'none';
  var sp = document.getElementById('setup-page');
  if (sp) sp.style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
  // Reset ke step 1
  loginBackToRole();
}

// BUGFIX: dipanggil sekali saat halaman pertama kali dimuat/di-refresh.
// Kalau ada sesi tersimpan & masih valid, langsung lanjutkan ke halaman terakhir
// yang dibuka user — TIDAK perlu login ulang dan TIDAK kembali ke halaman awal.
function trySessionResume() {
  var session = loadSession();
  if (!session || !session.email || !session.role) return false;

  var u = USERS[session.email];
  if (!u) return false; // akun sudah tidak ada (mis. dihapus HRD) → tampilkan login seperti biasa

  var hasRole = u.roles && u.roles.some(function(r){ return r.role === session.role; });
  if (!hasRole) return false;

  // Karyawan yang profilnya belum lengkap → arahkan ke layar setup, bukan langsung ke portal
  if (session.role === 'kary' && u.setupDone === false) {
    currentUser = { email:session.email, name:u.name, initials:u.initials, avBg:u.avBg, avColor:u.avColor, role:'kary' };
    document.getElementById('login-page').style.display = 'none';
    showSetupProfile();
    return true;
  }

  currentUser = { email:session.email, name:u.name, initials:u.initials, avBg:u.avBg, avColor:u.avColor, role:session.role };
  document.getElementById('login-page').style.display = 'none';
  var ap = document.getElementById('app-page');
  ap.style.display = 'flex';
  ap.style.flexDirection = 'column';
  var av = document.getElementById('top-av');
  av.textContent = u.initials;
  av.style.background = u.avBg;
  av.style.color = u.avColor;
  document.getElementById('top-uname').textContent = u.name;
  document.getElementById('top-urole').textContent = ROLE_LABEL[session.role];
  buildPortal(session.role, session.pageId);
  return true;
}

