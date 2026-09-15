/* ============================================================
 * FILE   : 17-filter-select-hapus.js
 * BAGIAN : Filter, Seleksi & Hapus Data
 * ISI    : Filter daftar karyawan & akun, pilih semua/sebagian, reset password & hapus karyawan terpilih.
 * ============================================================ */

// ==================== FILTER KARYAWAN ====================
function applyFilter() {
  var q      = (document.getElementById('flt-q')?.value||'').toLowerCase();
  var div    = document.getElementById('flt-div')?.value||'';
  var koor   = document.getElementById('flt-koor')?.value||'';
  var status = document.getElementById('flt-status')?.value||'';
  var rows   = document.querySelectorAll('#emp-tbody tr');
  var visible = 0;
  rows.forEach(function(row) {
    var ok = true;
    if (q      && !row.dataset.search.includes(q))   ok=false;
    if (div    && row.dataset.div    !== div)         ok=false;
    if (koor   && row.dataset.koor   !== koor)        ok=false;
    if (status && row.dataset.status !== status)      ok=false;
    row.style.display = ok ? '' : 'none';
    if (ok) visible++;
  });
  var countEl = document.getElementById('emp-count');
  if (countEl) countEl.textContent = visible;
  var empty = document.getElementById('empty-filter');
  var tbl   = document.getElementById('emp-table');
  if (empty && tbl) { empty.style.display = visible?'none':'block'; tbl.style.display = visible?'':'none'; }
  updateSelCount();
}

function resetFilter() {
  ['flt-q','flt-div','flt-koor','flt-status'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value='';
  });
  applyFilter();
}

// ==================== FILTER MANAJEMEN AKUN ====================
function applyAkunFilter() {
  var q      = (document.getElementById('akf-q')?.value||'').toLowerCase();
  var role   = document.getElementById('akf-role')?.value||'';
  var status = document.getElementById('akf-status')?.value||'';
  var rows   = document.querySelectorAll('#akun-tbody tr');
  var visible = 0;
  rows.forEach(function(row) {
    var ok = true;
    if (q      && !row.dataset.search.includes(q))                          ok=false;
    if (role   && !row.dataset.roles.split(',').includes(role))             ok=false;
    if (status && row.dataset.status !== status)                            ok=false;
    row.style.display = ok ? '' : 'none';
    if (ok) visible++;
  });
  var countEl = document.getElementById('akun-count');
  if (countEl) countEl.textContent = visible;
  var empty = document.getElementById('akun-empty-filter');
  var tbl   = document.getElementById('akun-table');
  if (empty && tbl) { empty.style.display = visible?'none':'block'; tbl.style.display = visible?'':'none'; }
}

function resetAkunFilter() {
  ['akf-q','akf-role','akf-status'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value='';
  });
  applyAkunFilter();
}

// ==================== FILTER ANALISIS PERFORMA (HRD) ====================
// Berbeda dari filter rekap (yang cuma sembunyikan baris tabel dengan CSS), filter performa
// perlu MENGHITUNG ULANG rata-rata & grafik gabungan sesuai karyawan terpilih — jadi di sini
// kontennya benar-benar dibangun ulang lewat buildPerformaHRDContent() dan ditimpakan ke
// container-nya saja (dropdown filter di atasnya tidak ikut ter-reset).
function applyPerformaFilterHRD() {
  var div       = document.getElementById('prf-div')?.value    || '';
  var koor      = document.getElementById('prf-koor')?.value   || '';
  var raw       = document.getElementById('prf-bulan')?.value  || 'range:6';
  var parts     = raw.split(':');
  var bulanSel  = parts[0] === 'month'
    ? { type:'month', bulanKey: parts[1] }
    : { type:'range', numMonths: parseInt(parts[1],10) || 6 };
  var container = document.getElementById('performa-hrd-content');
  if (container) container.innerHTML = buildPerformaHRDContent(div, koor, bulanSel);
}

function resetPerformaFilterHRD() {
  var elDiv = document.getElementById('prf-div');   if (elDiv)  elDiv.value  = '';
  var elKoor= document.getElementById('prf-koor');  if (elKoor) elKoor.value = '';
  var elBln = document.getElementById('prf-bulan'); if (elBln)  elBln.value  = 'range:6';
  applyPerformaFilterHRD();
}

// ==================== FILTER REKAP ABSENSI TIM (Koordinator) ====================
// Versi Koordinator dari fitur Rekap Absensi HRD — kontennya dibangun ulang lewat fungsi
// buildRekapContent() yang SAMA persis dipakai HRD (didefinisikan di 06-page-hrd.js), hanya
// filter koordinatornya dikunci ke currentUser.name supaya koordinator hanya melihat & mengelola
// data anggota timnya sendiri, bukan seluruh karyawan.
function applyRekapFilterKoor() {
  var bulan  = document.getElementById('rkpk-bulan')?.value  || todayKey().slice(0,7);
  var div    = document.getElementById('rkpk-div')?.value    || '';
  var status = document.getElementById('rkpk-status')?.value || '';
  var container = document.getElementById('rekap-koor-content');
  if (container) container.innerHTML = buildRekapContent(bulan, currentUser.name, div, status);
}

function resetRekapFilterKoor() {
  var elBln = document.getElementById('rkpk-bulan'); if (elBln) elBln.value = todayKey().slice(0,7);
  ['rkpk-div','rkpk-status'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.value='';
  });
  applyRekapFilterKoor();
}

function exportRekapCSVKoor() {
  var bulan  = document.getElementById('rkpk-bulan')?.value  || todayKey().slice(0,7);
  var div    = document.getElementById('rkpk-div')?.value    || '';
  var status = document.getElementById('rkpk-status')?.value || '';

  var filtered = DB.employees.filter(function(e){
    if (e.koor !== currentUser.name) return false;
    if (div    && e.div    !== div)     return false;
    if (status && e.status !== status)  return false;
    return true;
  });

  if (!filtered.length) { showToast('Tidak ada anggota tim yang cocok dengan filter','warning'); return; }

  var header = 'nama,divisi,koordinator,hadir,terlambat,tidak_lengkap,avg_skor,status,bonus';
  var rows = filtered.map(function(emp){
    var encEm = emp.email.replace(/[.#$\[\]]/g,'_');
    var keys  = Object.keys(DB.attendance).filter(function(k){ return k.startsWith(encEm+'_') && k.indexOf(bulan)>=0; });
    var hadir=0,terlambat=0,tdk=0,skorArr=[];
    keys.forEach(function(k){
      var r=DB.attendance[k];
      if(r.pagi&&r.siang){if(r.status==='terlambat')terlambat++;else hadir++;}
      else if(r.pagi||r.siang)tdk++;
      if(r.skor!=null)skorArr.push(Number(r.skor));
    });
    var avg=skorArr.length?Math.round(skorArr.reduce(function(a,b){return a+b;},0)/skorArr.length):null;
    var bonus=(avg!=null&&avg>=(DB.settings.minSkorBonus||75)&&terlambat===0&&emp.pelanggaran<2)?'Ya':'Tidak';
    return [emp.name,emp.div,emp.koor,hadir,terlambat,tdk,avg||'',emp.status,bonus]
      .map(function(v){return '"'+String(v||'').replace(/"/g,'""')+'"';}).join(',');
  });

  var csv  = '\uFEFF' + [header].concat(rows).join('\r\n');
  var blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href=url; a.download='rekap_tim_'+currentUser.name.replace(/\s/g,'_')+'_'+bulan+'.csv';
  a.style.display='none'; document.body.appendChild(a); a.click();
  setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); },2000);
  showToast(filtered.length + ' data berhasil diexport','success');
}

// ==================== FILTER SANKSI & PELANGGARAN (HRD) ====================
function applySanksiFilter() {
  var karyawan  = document.getElementById('sk-karyawan')?.value || '';
  var jenis     = document.getElementById('sk-jenis')?.value    || '';
  var container = document.getElementById('sanksi-list-content');
  if (container) container.innerHTML = buildSanksiListContent(karyawan, jenis);
}

function resetSanksiFilter() {
  ['sk-karyawan','sk-jenis'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.value = '';
  });
  applySanksiFilter();
}

// ==================== GRAFIK PERFORMA SAYA (Karyawan) ====================
function applyGrafikSaya() {
  var raw = document.getElementById('mygraf-pilih')?.value || 'month:' + todayKey().slice(0,7);
  var parts = raw.split(':');
  var mode;
  if (parts[0] === 'month')      mode = { type:'month', bulanKey: parts[1] };
  else if (parts[0] === 'range') mode = { type:'range',  numMonths: parseInt(parts[1],10) || 3 };
  else                            mode = { type:'avg',    numMonths: parseInt(parts[1],10) || 6 };
  var container = document.getElementById('mygraf-content');
  if (container) container.innerHTML = buildGrafikSayaContent(mode);
}

// ==================== SELECT & HAPUS ====================
function updateSelCount() {
  var checked = document.querySelectorAll('#emp-tbody tr:not([style*="none"]) .row-chk:checked');
  var btn = document.getElementById('btn-hapus-terpilih');
  var cntEl = document.getElementById('sel-count');
  if (btn) btn.style.display = checked.length ? 'inline-flex' : 'none';
  if (cntEl) cntEl.textContent = checked.length;
}

function toggleSelectAll(src) {
  var val = src.checked;
  document.querySelectorAll('#emp-tbody tr:not([style*="none"]) .row-chk').forEach(function(c){ c.checked=val; });
  ['chk-all','chk-head'].forEach(function(id){ var el=document.getElementById(id); if(el) el.checked=val; });
  updateSelCount();
}

function resetPassKaryawan(email, nama) {
  if (!email) { showToast('Karyawan ini belum punya akun login','warning'); return; }
  var newPass = prompt('Reset password untuk ' + nama + '\nMasukkan password baru (min. 6 karakter):');
  if (newPass === null) return; // batal
  if (!newPass || newPass.length < 6) { showToast('Password minimal 6 karakter','error'); return; }
  if (!USERS[email]) {
    // Buatkan akun baru jika belum ada
    var emp = DB.employees.find(function(e){ return e.email===email; });
    USERS[email] = {
      name: nama,
      initials: nama.split(' ').map(function(x){return x[0]||'';}).join('').slice(0,2).toUpperCase(),
      avBg: emp ? emp.bg : '#0078D4', avColor:'#fff',
      roles:[{pass:newPass, role:'kary'}]
    };
  } else {
    var idx = USERS[email].roles.findIndex(function(r){ return r.role==='kary'; });
    if (idx>=0) USERS[email].roles[idx].pass = newPass;
    else USERS[email].roles.push({pass:newPass, role:'kary'});
  }
  saveUsers(USERS);
  showToast('Password ' + nama + ' berhasil direset: ' + newPass, 'success');
}

function hapusKaryawan(id) {
  var emp = DB.employees.find(function(e){ return e.id===id; });
  if (!emp) return;
  if (!confirm('Hapus karyawan "' + emp.name + '"?\nAkun login juga akan dihapus. Aksi ini tidak dapat dibatalkan.')) return;
  // Hapus dari daftar karyawan
  DB.employees = DB.employees.filter(function(e){ return e.id!==id; });
  dbSaveLocal(DB);
  dbSavePath('employees', cleanForFirebase(DB.employees)); // BUGFIX: jangan timpa seluruh DB
  // Hapus akun login jika ada
  if (emp.email && USERS[emp.email]) {
    delete USERS[emp.email];
    saveUsers(USERS);
  }
  showToast(emp.name + ' beserta akun loginnya berhasil dihapus','warning');
  showPage('hrd','karyawan');
}

function hapusTerpilih() {
  var checked = document.querySelectorAll('#emp-tbody tr:not([style*="none"]) .row-chk:checked');
  if (!checked.length) return;
  var ids = Array.from(checked).map(function(c){ return parseInt(c.closest('tr').dataset.id); });
  var names = ids.map(function(id){ var e=DB.employees.find(function(x){return x.id===id;}); return e?e.name:''; }).filter(Boolean);
  if (!confirm('Hapus ' + ids.length + ' karyawan:\n' + names.join(', ') + '\n\nAkun login mereka juga akan dihapus. Aksi ini tidak dapat dibatalkan.')) return;
  var emailsToDelete = ids.map(function(id){ var e=DB.employees.find(function(x){return x.id===id;}); return e?e.email:''; }).filter(Boolean);
  DB.employees = DB.employees.filter(function(e){ return !ids.includes(e.id); });
  dbSaveLocal(DB);
  dbSavePath('employees', cleanForFirebase(DB.employees)); // BUGFIX: jangan timpa seluruh DB
  emailsToDelete.forEach(function(em){ if(em&&USERS[em]) delete USERS[em]; });
  if(emailsToDelete.length) saveUsers(USERS);
  showToast(ids.length + ' karyawan beserta akun loginnya berhasil dihapus','warning');
  showPage('hrd','karyawan');
}

// Hapus SELURUH data karyawan + akun login mereka (reset total)
function hapusSemuaKaryawan() {
  var total = DB.employees.length;
  if (!total) { showToast('Tidak ada data karyawan untuk dihapus','warning'); return; }

  var konfirmasi1 = confirm('⚠️ PERINGATAN!\n\nIni akan menghapus SEMUA ' + total + ' data karyawan beserta akun login mereka secara permanen.\n\nAkun yang baru dibuat via "Tambah Akun Karyawan (Isi Profil Mandiri)" namun belum mengisi profil TIDAK akan terhapus.\n\nLanjutkan?');
  if (!konfirmasi1) return;

  var konfirmasi2 = prompt('Ketik "HAPUS SEMUA" (tanpa tanda kutip) untuk konfirmasi:');
  if (konfirmasi2 !== 'HAPUS SEMUA') { showToast('Dibatalkan — konfirmasi tidak cocok','warning'); return; }

  var emailsToDelete = DB.employees.map(function(e){ return e.email; }).filter(Boolean);
  DB.employees = [];
  dbSaveLocal(DB);
  dbSavePath('employees', cleanForFirebase(DB.employees)); // BUGFIX: jangan timpa seluruh DB
  emailsToDelete.forEach(function(em){ if(em && USERS[em]) delete USERS[em]; });
  if (emailsToDelete.length) saveUsers(USERS);

  showToast('✅ ' + total + ' data karyawan & akun login berhasil dihapus. Sistem siap diisi ulang.', 'success');
  showPage('hrd','karyawan');
}

