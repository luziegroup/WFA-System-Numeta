/* ============================================================
 * FILE   : 19-export-import-akun.js
 * BAGIAN : Export/Import Akun (CSV)
 * ISI    : Export & import data akun (email, password, role) via CSV.
 * ============================================================ */

// ==================== IMPORT / EXPORT CSV AKUN ====================
function exportAkunCSV() {
  var entries = Object.entries(USERS);
  if (!entries.length) { showToast('Tidak ada akun untuk diexport','warning'); return; }
  var header = 'nama,email,password,role';
  var rows = [];
  entries.forEach(function(entry) {
    var em = entry[0], u = entry[1];
    u.roles.forEach(function(r) {
      rows.push([u.name, em, r.pass, r.role].map(function(v){
        return '"' + String(v||'').replace(/"/g,'""') + '"';
      }).join(','));
    });
  });
  var csv  = '\uFEFF' + [header].concat(rows).join('\r\n');
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = 'akun_wfa_' + new Date().toISOString().slice(0,10) + '.csv';
  a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
  showToast(rows.length + ' baris akun berhasil diexport','success');
}

function exportAkunCSVTemplate() {
  var csv = '\uFEFF' + 'nama,email,password,role\r\nBudi Santoso,,123456,koor\r\nSiti Rahayu,,123456,kary\r\nAdmin Baru,admin2@luziegroup.id,admin999,hrd';
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = 'template_import_akun.csv';
  a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
  showToast('Template CSV akun berhasil diunduh','success');
}

function importAkunCSV(input) {
  var file = input.files[0];
  if (!file) return;

  function setStatus(msg, clr) {
    var el = document.getElementById('import-akun-status');
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
      var iEmail = headers.indexOf('email');
      var iPass  = headers.indexOf('password');
      var iRole  = headers.indexOf('role');

      if (iNama < 0) {
        var delimLabel = delim===';'?'semicolon (;)':delim==='\t'?'tab':'koma (,)';
        var headerFound = headers.join(', ') || '(tidak terbaca)';
        showToast('Header tidak valid — kolom "nama" wajib ada','error');
        setStatus('❌ Header tidak valid. Terdeteksi pemisah: ' + delimLabel + '. Kolom terbaca: ' + headerFound, 'var(--red)');
        input.value = ''; return;
      }

      var modeUpdate = !!(document.getElementById('chk-akun-upsert') && document.getElementById('chk-akun-upsert').checked);
      var validRoles = ['kary','koor','hrd'];
      var colors = ['#0078D4','#0050A0','#D97706','#94A3B8','#DC2626','#0D9E6B','#7C3AED'];
      var added = 0, updated = 0, skipped = 0;
      var usedEmails = {}; // cegah duplikat email auto-generate dalam 1 file

      for (var i = 1; i < lines.length; i++) {
        var cols  = parseCSVLine(lines[i]);
        var nama  = (cols[iNama]  || '').trim();
        var email = (iEmail >= 0 && cols[iEmail]) ? cols[iEmail].trim().toLowerCase() : '';
        var pass  = (iPass  >= 0 && cols[iPass])  ? cols[iPass].trim()  : '123456';
        var role  = (iRole  >= 0 && cols[iRole])  ? cols[iRole].trim().toLowerCase() : 'kary';

        if (!nama) { skipped++; continue; }
        if (!validRoles.includes(role)) role = 'kary';
        if (pass && pass.length < 6) { skipped++; continue; }

        // Auto-generate email dari nama jika kosong
        if (!email) {
          var base = namaToEmail(nama); // contoh: budi@luziegroup.id
          email = base;
          var counter = 1;
          while ((USERS[email] || usedEmails[email]) && !modeUpdate) {
            var atIdx = base.indexOf('@');
            email = base.slice(0, atIdx) + counter + base.slice(atIdx);
            counter++;
          }
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { skipped++; continue; }
        usedEmails[email] = true;

        var existingUser = USERS[email];

        if (existingUser) {
          if (modeUpdate) {
            existingUser.name = nama;
            existingUser.initials = nama.split(' ').map(function(x){return x[0]||'';}).join('').slice(0,2).toUpperCase();
            if (pass) {
              var existingRoleIdx = existingUser.roles.findIndex(function(r){ return r.role === role; });
              if (existingRoleIdx >= 0) {
                existingUser.roles[existingRoleIdx].pass = pass;
              } else {
                existingUser.roles.push({pass: pass, role: role});
              }
            }
            updated++;
          } else {
            skipped++;
          }
          continue;
        }

        var initials = nama.split(' ').map(function(x){return x[0]||'';}).join('').slice(0,2).toUpperCase();
        var newUser = {
          name: nama,
          initials: initials,
          avBg: colors[Object.keys(USERS).length % colors.length],
          avColor: '#fff',
          roles: [{pass: pass, role: role}]
        };
        // Karyawan: wajib lengkapi Divisi & Koordinator saat login pertama
        if (role === 'kary') newUser.setupDone = false;

        USERS[email] = newUser;
        added++;
      }

      saveUsers(USERS);

      var parts = [];
      if (added)   parts.push('✅ ' + added   + ' akun baru ditambahkan');
      if (updated) parts.push('🔄 ' + updated + ' data diperbarui');
      if (skipped) parts.push('⏭ '  + skipped + ' baris dilewati' + (modeUpdate?'':' (duplikat/tidak valid)'));
      var statusMsg = parts.join(' · ') || 'Tidak ada perubahan';
      setStatus(statusMsg, added||updated ? 'var(--green)' : 'var(--amber)');

      if (added || updated) {
        showToast((added?added+' akun ditambahkan':'') + (added&&updated?' · ':'') + (updated?updated+' diperbarui':''), 'success');
      } else {
        showToast('Tidak ada data baru.' + (skipped?' '+skipped+' baris duplikat. Aktifkan "Mode Update" untuk memperbarui.':''), 'warning');
      }

      input.value = '';
      showPage('hrd','akun');

    } catch(err) {
      showToast('Error parsing CSV: ' + err.message, 'error');
      setStatus('❌ Error: ' + err.message, 'var(--red)');
      input.value = '';
    }
  };
  reader.readAsText(file, 'UTF-8');
}

// BUGFIX: Auto-save draft to-do setiap 5 detik (dipercepat dari 20s agar data tidak hilang)
setInterval(function() {
  if (currentRole === 'kary' && currentPageId === 'todo') {
    autoSaveTodoDraft();
  }
}, 5000);

// BUGFIX: Simpan to-do saat user mau menutup tab/browser
window.addEventListener('beforeunload', function() {
  if (currentRole === 'kary' && currentUser) {
    autoSaveTodoDraft();
  }
});

