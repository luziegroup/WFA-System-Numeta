/* ============================================================
 * FILE   : 12-komentar-komunikasi.js
 * BAGIAN : Komentar & Penilaian Komunikasi
 * ISI    : Komentar/koreksi koordinator atas to-do karyawan, penilaian skor komunikasi.
 * ============================================================ */

// ==================== KOMENTAR & KOREKSI KOORDINATOR ====================
function simpanKomentarKoor(tkKey, idx) {
  var itemId   = tkKey + '_' + idx;
  var komEl    = document.getElementById('kom-' + itemId);
  var korEl    = document.getElementById('kor-' + itemId);
  if (!komEl || !korEl) return;

  var komentar = komEl.value.trim();
  var koreksi  = korEl.value !== '' ? parseInt(korEl.value) : null;

  if (!DB.todos[tkKey]) { showToast('Data to-do tidak ditemukan','error'); return; }
  var todos = DB.todos[tkKey];
  if (!todos[idx]) { showToast('Item tidak ditemukan','error'); return; }

  todos[idx].komentar_koor  = komentar;
  todos[idx].koreksi_skor   = koreksi;
  todos[idx].koor_edit_by   = currentUser.name;
  todos[idx].koor_edit_time = new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});

  // Re-hitung skor harian gabungan untuk karyawan ini
  var ownerEmail = emailFromAttendKey(tkKey);
  if (ownerEmail) hitungSkorHarian(ownerEmail, tkKey);

  // BUGFIX: dulu dbSave(DB) menimpa seluruh database. Sekarang hanya simpan
  // path todos milik karyawan ini + skor harian yang terdampak.
  dbSaveLocal(DB);
  dbSavePath('todos/' + tkKey, cleanForFirebase(todos));
  if (ownerEmail) persistSkorHarian(ownerEmail, tkKey);
  showToast('Komentar & koreksi tersimpan','success');

  // Refresh area tombol simpan → tampil "Tersimpan"
  var area = document.getElementById('koor-area-' + itemId);
  if (area) {
    var statusEl = area.querySelector('.koor-saved-status');
    if (!statusEl) {
      var btnEl = area.querySelector('button');
      if (btnEl) {
        var span = document.createElement('span');
        span.className = 'koor-saved-status';
        span.style.cssText = 'font-size:11px;color:var(--green);display:inline-flex;align-items:center;gap:3px';
        span.innerHTML = '<i class="ti ti-circle-check"></i>Tersimpan';
        btnEl.insertAdjacentElement('afterend', span);
      }
    } else {
      statusEl.innerHTML = '<i class="ti ti-circle-check"></i>Tersimpan ' + todos[idx].koor_edit_time;
    }
  }
}

// ==================== PENILAIAN KOMUNIKASI (KOORDINATOR) ====================
function simpanSkorKomunikasi(email, tkKey) {
  var sel = document.getElementById('kom-skor-' + tkKey);
  if (!sel || sel.value === '') { showToast('Pilih nilai komunikasi terlebih dahulu','error'); return; }

  var skor = parseInt(sel.value);
  DB.attendance[tkKey] = DB.attendance[tkKey] || {};
  DB.attendance[tkKey].skorKomunikasi = skor;
  DB.attendance[tkKey].skorKomunikasi_by = currentUser.name;
  DB.attendance[tkKey].skorKomunikasi_time = new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});

  hitungSkorHarian(email, tkKey);
  persistSkorHarian(email, tkKey); // BUGFIX: jangan dbSave(DB) penuh

  showToast('Nilai komunikasi tersimpan','success');
  showPage('koor','monitor');
}

