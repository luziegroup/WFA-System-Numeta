/* ============================================================
 * FILE   : 16-manajemen-akun.js
 * BAGIAN : Manajemen Akun
 * ISI    : Tambah akun, ubah email/password, tambah/hapus role pada akun, hapus akun.
 * ============================================================ */

// ==================== MANAJEMEN AKUN ====================
function tambahAkun() {
  var nama  = document.getElementById('au-nama')?.value?.trim();
  var email = document.getElementById('au-email')?.value?.trim().toLowerCase();
  var pass  = document.getElementById('au-pass')?.value?.trim();
  var role  = document.getElementById('au-role')?.value;
  if (!nama)  { showToast('Nama wajib diisi','error'); return; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Email tidak valid','error'); return; }
  if (!pass || pass.length < 6) { showToast('Password minimal 6 karakter','error'); return; }
  if (USERS[email]) { showToast('Email "' + email + '" sudah terdaftar','error'); return; }
  var colors = ['#0078D4','#0050A0','#D97706','#94A3B8','#DC2626','#0D9E6B','#7C3AED'];
  USERS[email] = {
    name: nama,
    initials: nama.split(' ').map(function(x){return x[0]||'';}).join('').slice(0,2).toUpperCase(),
    avBg: colors[Object.keys(USERS).length % colors.length],
    avColor: '#fff',
    roles: [{pass: pass, role: role}]
  };
  saveUsers(USERS);
  showToast('Akun "' + nama + '" berhasil dibuat sebagai ' + {hrd:'HRD',koor:'Koordinator',kary:'Karyawan'}[role], 'success');
  showPage('hrd','akun');
}

function simpanEmail(oldEmail, inputId) {
  var newEmail = (document.getElementById(inputId)?.value||'').trim().toLowerCase();
  if (!newEmail) { showToast('Email tidak boleh kosong','error'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { showToast('Format email tidak valid','error'); return; }
  if (newEmail === oldEmail) { showToast('Email tidak berubah','info'); return; }
  if (USERS[newEmail]) { showToast('Email "' + newEmail + '" sudah dipakai akun lain','error'); return; }

  // Salin data akun ke email baru, hapus yang lama
  USERS[newEmail] = USERS[oldEmail];
  delete USERS[oldEmail];

  // Jika yang diedit adalah akun yang sedang login, update currentUser
  if (currentUser && currentUser.email === oldEmail) {
    currentUser.email = newEmail;
  }

  saveUsers(USERS);
  showToast('Email berhasil diubah menjadi ' + newEmail, 'success');
  showPage('hrd', 'akun');
}

function simpanPass(email, roleIdx, inputId) {
  var newPass = document.getElementById(inputId)?.value?.trim();
  if (!newPass || newPass.length < 6) { showToast('Password minimal 6 karakter','error'); return; }
  if (!USERS[email] || !USERS[email].roles[roleIdx]) return;
  USERS[email].roles[roleIdx].pass = newPass;
  saveUsers(USERS);
  showToast('Password berhasil diperbarui', 'success');
}

function lihatPass(inputId) {
  var el = document.getElementById(inputId);
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
}

function tambahRoleAkun(email) {
  var u = USERS[email];
  if (!u) return;
  var existingRoles = u.roles.map(function(r){ return r.role; });
  var available = ['kary','koor','hrd'].filter(function(r){ return !existingRoles.includes(r); });
  if (!available.length) { showToast('Akun ini sudah memiliki semua role', 'warning'); return; }
  var newRole = available[0];
  var newPass = prompt('Masukkan password untuk role ' + {hrd:'HRD',koor:'Koordinator',kary:'Karyawan'}[newRole] + ':');
  if (!newPass || newPass.length < 6) { showToast('Password minimal 6 karakter — role tidak ditambahkan','error'); return; }
  u.roles.push({pass: newPass, role: newRole});
  saveUsers(USERS);
  showToast('Role ' + {hrd:'HRD',koor:'Koordinator',kary:'Karyawan'}[newRole] + ' ditambahkan', 'success');
  showPage('hrd','akun');
}

function hapusRole(email, roleIdx) {
  var u = USERS[email];
  if (!u || u.roles.length <= 1) { showToast('Akun harus memiliki minimal 1 role','warning'); return; }
  var r = u.roles[roleIdx];
  if (!confirm('Hapus role ' + {hrd:'HRD',koor:'Koordinator',kary:'Karyawan'}[r.role] + ' dari akun ' + u.name + '?')) return;
  u.roles.splice(roleIdx, 1);
  saveUsers(USERS);
  showToast('Role berhasil dihapus','warning');
  showPage('hrd','akun');
}

function hapusAkun(email) {
  if (email === currentUser.email) { showToast('Tidak bisa menghapus akun yang sedang digunakan','error'); return; }
  var u = USERS[email];
  if (!u) return;
  if (!confirm('Hapus akun "' + u.name + '" (' + email + ')?\nAksi ini tidak dapat dibatalkan.')) return;
  delete USERS[email];
  saveUsers(USERS);
  showToast('Akun ' + u.name + ' berhasil dihapus','warning');
  showPage('hrd','akun');
}

