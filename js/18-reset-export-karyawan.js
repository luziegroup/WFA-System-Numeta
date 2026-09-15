/* ============================================================
 * FILE   : 18-reset-export-karyawan.js
 * BAGIAN : Reset Sistem & Export/Import Karyawan
 * ISI    : Reset total sistem ke nol, export/import data karyawan via CSV.
 * ============================================================ */

// ==================== RESET TOTAL SISTEM KE NOL ====================
function resetTotalSistem() {
  var konfirmasi1 = confirm(
    '⚠️ RESET TOTAL SISTEM!\n\n' +
    'Ini akan menghapus PERMANEN:\n' +
    '• Semua data karyawan (' + DB.employees.length + ')\n' +
    '• Semua akun login KECUALI Admin HRD\n' +
    '• Semua riwayat absensi\n' +
    '• Semua sanksi & pelanggaran\n' +
    '• Semua to-do harian\n' +
    '• Semua jadwal Zoom Meeting\n' +
    '• Pengaturan dikembalikan ke default\n\n' +
    'Akun "admin@luziegroup.id" akan tetap ada agar Anda bisa login kembali.\n\n' +
    'Tindakan ini TIDAK DAPAT DIBATALKAN. Lanjutkan?'
  );
  if (!konfirmasi1) return;

  var konfirmasi2 = prompt('Untuk konfirmasi akhir, ketik tepat: RESET TOTAL');
  if (konfirmasi2 !== 'RESET TOTAL') { showToast('Dibatalkan — konfirmasi tidak cocok','warning'); return; }

  // Reset DB
  DB.employees    = [];
  DB.sanctions    = [];
  DB.attendance   = {};
  DB.todos        = {};
  DB.zoomMeetings = [];
  DB.notifikasiPerforma = [];
  DB.settings     = { batasPagi:'08:30', mulaiSiang:'12:00', mulaiKerja:'08:00', selesaiKerja:'17:00', radiusGPS:50, minSkorBonus:75, divisiList: DEFAULT_DIVISI_LIST.slice(), bobotAbsen:34, bobotTodo:33, bobotKomunikasi:33, minSkorRataRata:70, hariEvaluasiCabut:5 };
  // CATATAN: dbSave(DB) di sini SENGAJA menimpa seluruh database — ini memang tombol
  // "reset total ke nol" yang sudah dikonfirmasi 2x oleh HRD, jadi overwrite penuh adalah perilaku yang benar.
  dbSave(DB);

  // Reset USERS — sisakan hanya akun HRD yang sedang login (atau admin default)
  var keepEmail = (currentUser && currentUser.email && USERS[currentUser.email] && USERS[currentUser.email].roles.some(function(r){return r.role==='hrd';}))
    ? currentUser.email
    : 'admin@luziegroup.id';

  var freshUsers = {};
  if (USERS[keepEmail]) {
    freshUsers[keepEmail] = USERS[keepEmail];
  } else {
    freshUsers['admin@luziegroup.id'] = { name:'Admin HRD', initials:'HR', avBg:'#0078D4', avColor:'#fff', roles:[{pass:'admin123', role:'hrd'}] };
  }
  saveUsers(freshUsers);

  showToast('✅ Sistem berhasil di-reset total ke nol. Silakan mulai input data baru.', 'success');
  setTimeout(function(){ showPage('hrd','dashboard'); }, 500);
}


function exportCSV() {
  if (!DB.employees || !DB.employees.length) {
    showToast('Tidak ada data karyawan untuk diexport','warning');
    return;
  }
  // Export tanpa kolom email — hanya nama, divisi, koordinator
  var header = 'nama,divisi,koordinator';
  var rows = DB.employees.map(function(e) {
    return [e.name, e.div, e.koor].map(function(v){
      return '"' + String(v||'').replace(/"/g,'""') + '"';
    }).join(',');
  });
  var csv  = '\uFEFF' + [header].concat(rows).join('\r\n');
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = 'karyawan_luziegroup_' + new Date().toISOString().slice(0,10) + '.csv';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
  showToast(DB.employees.length + ' data berhasil diexport','success');
}

function exportCSVTemplate() {
  var koors = getKoordinatorList();
  var koor1 = koors[0] || 'Nama Koordinator';
  // Template: contoh data lengkap & belum lengkap
  var csv = '\uFEFF' +
    'nama,email,password,divisi,koordinator,role\r\n' +
    'Budi Santoso,,pass1234,Marketing,' + koor1 + ',kary\r\n' +
    'Siti Rahayu,,123,,,kary\r\n' +
    'Ahmad Fauzi,,,,,kary';
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url;
  a.download = 'template_import_karyawan.csv';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
  showToast('Template CSV berhasil diunduh','success');
}

function importCSV(input) {
  var file = input.files[0];
  if (!file) return;

  function setStatus(msg, clr) {
    var el = document.getElementById('import-status');
    if (el) { el.textContent = msg; el.style.color = clr || 'var(--gray-500)'; }
  }

  if (!file.name.match(/\.csv$/i)) {
    showToast('File harus berformat .csv','error');
    input.value = ''; return;
  }

  setStatus('⏳ Membaca file...', 'var(--amber)');

  var reader = new FileReader();
  reader.onerror = function() {
    showToast('Gagal membaca file','error');
    setStatus('Gagal membaca file','var(--red)');
    input.value = '';
  };
  reader.onload = function(e) {
    try {
      var raw = e.target.result;
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);

      var lines = raw.split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
      if (!lines.length) { showToast('File kosong','error'); setStatus('❌ File kosong','var(--red)'); input.value=''; return; }

      // Auto-detect delimiter
      var firstLine = lines[0];
      var delim = ',';
      var countSemi  = (firstLine.match(/;/g)||[]).length;
      var countTab   = (firstLine.match(/\t/g)||[]).length;
      var countComma = (firstLine.match(/,/g)||[]).length;
      if (countSemi > countComma && countSemi >= countTab) delim = ';';
      else if (countTab > countComma && countTab > countSemi) delim = '\t';

      function parseCSVLine(line) {
        var cols = [], cur = '', inQ = false;
        for (var k = 0; k < line.length; k++) {
          var ch = line[k];
          if (ch === '"') { inQ = !inQ; }
          else if (ch === delim && !inQ) { cols.push(cur.trim()); cur = ''; }
          else { cur += ch; }
        }
        cols.push(cur.trim());
        return cols.map(function(c){ return c.replace(/^"|"$/g,'').trim(); });
      }

      var headers = parseCSVLine(lines[0].toLowerCase());
      var iNama  = headers.indexOf('nama');
      var iPass  = headers.indexOf('password');
      var iDiv   = headers.indexOf('divisi');
      var iKoor  = headers.indexOf('koordinator');
      var iRole  = headers.indexOf('role');
      // Juga terima kolom 'email' lama (abaikan isinya, generate otomatis)
      var iEmail = headers.indexOf('email');

      if (iNama < 0) {
        var delimLabel = delim===';'?'semicolon (;)':delim==='\t'?'tab':'koma (,)';
        showToast('Header tidak valid — kolom "nama" wajib ada','error');
        setStatus('❌ Header tidak valid. Terdeteksi pemisah: ' + delimLabel + '. Kolom terbaca: ' + (headers.join(', ')||'(tidak terbaca)'), 'var(--red)');
        input.value = ''; return;
      }

      var modeUpdate  = !!(document.getElementById('chk-upsert') && document.getElementById('chk-upsert').checked);
      var validKoors  = getKoordinatorList();
      var validRoles  = ['kary','koor','hrd'];
      var colors      = ['#0078D4','#0050A0','#D97706','#94A3B8','#DC2626','#0D9E6B','#7C3AED','#0891B2'];
      var added = 0, addedAccountsOnly = 0, updated = 0, skipped = 0;

      for (var i = 1; i < lines.length; i++) {
        var cols    = parseCSVLine(lines[i]);
        var nama    = (cols[iNama] || '').trim();
        if (!nama) { skipped++; continue; }

        var passVal = (iPass >= 0 && cols[iPass]) ? cols[iPass].trim() : '';
        var divVal  = (iDiv  >= 0 && cols[iDiv])  ? cols[iDiv].trim()  : '';
        var koorVal = (iKoor >= 0 && cols[iKoor]) ? cols[iKoor].trim() : '';
        var roleVal = (iRole >= 0 && cols[iRole]) ? cols[iRole].trim().toLowerCase() : 'kary';
        if (!validRoles.includes(roleVal)) roleVal = 'kary';

        // Normalisasi koordinator jika diisi tapi tidak valid
        if (koorVal && validKoors.length && !validKoors.includes(koorVal)) koorVal = '';

        // Generate email dari nama (abaikan kolom email lama jika ada)
        var email = namaToEmail(nama);

        // Cari karyawan yang sudah ada berdasarkan nama (case-insensitive) ATAU akun dengan nama sama
        var existingIdx = DB.employees.findIndex(function(x){
          return x.name.toLowerCase() === nama.toLowerCase();
        });
        var existingEmailByName = Object.keys(USERS).find(function(em){
          return (USERS[em].name||'').toLowerCase() === nama.toLowerCase();
        });

        if (existingIdx >= 0 || existingEmailByName) {
          if (modeUpdate) {
            if (existingIdx >= 0) {
              var emp = DB.employees[existingIdx];
              if (divVal)  emp.div  = divVal;
              if (koorVal) emp.koor = koorVal;
            }
            var targetEmail = existingEmailByName || (existingIdx>=0 ? DB.employees[existingIdx].email : null);
            if (passVal && passVal.length >= 6 && targetEmail && USERS[targetEmail]) {
              var ri = USERS[targetEmail].roles.findIndex(function(r){ return r.role===roleVal; });
              if (ri>=0) USERS[targetEmail].roles[ri].pass = passVal;
              else USERS[targetEmail].roles.push({pass:passVal, role:roleVal});
            }
            updated++;
          } else { skipped++; }
          continue;
        }

        // Pastikan email belum dipakai
        if (DB.employees.some(function(x){ return x.email===email; }) || USERS[email]) {
          var suffix = 2;
          var baseEmail = email.replace('@','');
          while (DB.employees.some(function(x){return x.email===baseEmail+suffix+'@luziegroup.id';}) || USERS[baseEmail+suffix+'@luziegroup.id']) suffix++;
          email = baseEmail + suffix + '@luziegroup.id';
        }

        var inits = nama.split(' ').map(function(x){return x[0]||'';}).join('').slice(0,2).toUpperCase();
        var bg = colors[(DB.employees.length + i) % colors.length];
        var finalPass = (passVal && passVal.length >= 6) ? passVal : '123456';

        if (roleVal === 'kary' && (!divVal || !koorVal)) {
          // ---- DATA BELUM LENGKAP (Divisi/Koordinator kosong) ----
          // Buat akun login saja; karyawan melengkapi Nama/Divisi/Koordinator sendiri saat login pertama
          USERS[email] = {
            name: nama, initials: inits, avBg: bg, avColor: '#fff',
            roles: [{ pass: finalPass, role: 'kary' }],
            setupDone: false
          };
          addedAccountsOnly++;
        } else if (roleVal !== 'kary') {
          // ---- KOORDINATOR / HRD: tidak perlu divisi, langsung aktif ----
          USERS[email] = {
            name: nama, initials: inits, avBg: bg, avColor: '#fff',
            roles: [{ pass: finalPass, role: roleVal }]
          };
          added++;
        } else {
          // ---- DATA LENGKAP (Divisi & Koordinator terisi) ----
          DB.employees.push({
            id: Date.now()+i, name:nama, inits:inits,
            div:divVal, koor:koorVal, email:email, bg:bg,
            status:'aktif', pelanggaran:0
          });
          USERS[email] = { name:nama, initials:inits, avBg:bg, avColor:'#fff', roles:[{pass:finalPass, role:'kary'}], setupDone:true };
          added++;
        }
      }

      dbSaveLocal(DB);
      dbSavePath('employees', cleanForFirebase(DB.employees)); // BUGFIX: jangan timpa seluruh DB
      saveUsers(USERS);

      var parts = [];
      if (added)             parts.push('✅ ' + added + ' akun/karyawan ditambahkan');
      if (addedAccountsOnly) parts.push('📝 ' + addedAccountsOnly + ' akun dibuat (menunggu karyawan lengkapi Divisi & Koordinator saat login pertama)');
      if (updated)           parts.push('🔄 ' + updated + ' data diperbarui');
      if (skipped)           parts.push('⏭ '  + skipped + ' baris dilewati');
      setStatus(parts.join(' · ') || 'Tidak ada perubahan', (added||addedAccountsOnly||updated) ? 'var(--green)' : 'var(--amber)');

      if (added || addedAccountsOnly || updated) {
        var msgParts = [];
        if (added) msgParts.push(added+' ditambahkan');
        if (addedAccountsOnly) msgParts.push(addedAccountsOnly+' akun baru (belum lengkap)');
        if (updated) msgParts.push(updated+' diperbarui');
        showToast(msgParts.join(' · '), 'success');
      } else {
        showToast('Tidak ada data baru.' + (skipped?' Aktifkan "Mode Update" untuk memperbarui.':''), 'warning');
      }

      input.value = '';
      showPage('hrd','karyawan');

    } catch(err) {
      showToast('Error parsing CSV: ' + err.message, 'error');
      setStatus('❌ Error: ' + err.message, 'var(--red)');
      input.value = '';
    }
  };
  reader.readAsText(file, 'UTF-8');
}

