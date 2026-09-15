/* ============================================================
 * FILE   : 20-edit-kehadiran.js
 * BAGIAN : Edit Kehadiran Manual (Admin/HRD)
 * ISI    : Modal untuk memperbaiki data absen karyawan secara manual — dipakai HRD untuk
 *          mengantisipasi kasus gagal absen (error GPS/jaringan) lewat menu Rekap Absensi
 *          (klik tombol "Edit" pada rincian harian karyawan).
 * ============================================================ */

// Buka modal edit kehadiran untuk satu karyawan pada satu tanggal tertentu.
// Hanya HRD (admin) yang boleh mengedit data kehadiran — koordinator hanya bisa melihat
// (lihat renderRekapDetailBulan di 09-rekap-laporan.js: tombol Edit disembunyikan untuk koor).
function openEditAbsenModal(email, tgl) {
  if (currentRole !== 'hrd') { showToast('Hanya HRD/Admin yang bisa mengedit data kehadiran','error'); return; }
  var emp = DB.employees.find(function(e){ return e.email === email; });
  if (!emp) { showToast('Karyawan tidak ditemukan','error'); return; }

  var aKey = attendKeyFor(email, tgl);
  var rec  = DB.attendance[aKey] || {};

  var old = document.getElementById('edit-absen-modal');
  if (old) old.remove();

  var d = new Date(tgl);
  var hariNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  var bulanNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  var tglLabel = hariNames[d.getDay()] + ', ' + d.getDate() + ' ' + bulanNames[d.getMonth()] + ' ' + d.getFullYear();

  var modalHTML =
    '<div id="edit-absen-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px">' +
      '<div style="background:#fff;border-radius:16px;padding:24px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3)">' +

        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">' +
          '<div class="av" style="background:' + emp.bg + ';color:#fff;width:36px;height:36px;font-size:12px;flex-shrink:0">' + emp.inits + '</div>' +
          '<div style="min-width:0">' +
            '<div style="font-weight:700;font-size:14px;color:var(--gray-800);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + emp.name + '</div>' +
            '<div style="font-size:11px;color:var(--gray-400)">' + tglLabel + '</div>' +
          '</div>' +
        '</div>' +

        '<div class="info-bar info-amber" style="margin:12px 0"><i class="ti ti-alert-triangle"></i>Gunakan untuk memperbaiki data akibat gagal absen (error GPS/jaringan). Status & skor performa dihitung ulang otomatis mengikuti perubahan jam absen di bawah ini.</div>' +

        '<div class="field" style="margin-bottom:10px"><label>Jam Absen Pagi</label><input type="time" id="edt-pagi" value="' + (rec.pagi||'') + '"/></div>' +
        '<div class="field" style="margin-bottom:10px"><label>Jam Absen Siang</label><input type="time" id="edt-siang" value="' + (rec.siang||'') + '"/></div>' +
        '<div class="field" style="margin-bottom:4px"><label>Lokasi WFA (opsional)</label><input type="text" id="edt-lokasi" value="' + (rec.lokasi||'').replace(/"/g,'&quot;') + '" placeholder="Contoh: Rumah, Cafe XYZ"/></div>' +
        '<div style="font-size:11px;color:var(--gray-400);margin:2px 0 16px">Kosongkan jam pagi/siang jika ingin menandai karyawan belum/tidak absen pada sesi tersebut.</div>' +

        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn btn-danger btn-sm" onclick="hapusAbsenTanggal(\'' + email + '\',\'' + tgl + '\')" style="background:#fff;color:var(--red);border:1px solid #fca5a5"><i class="ti ti-trash"></i>Hapus Data</button>' +
          '<div style="flex:1"></div>' +
          '<button class="btn btn-ghost btn-sm" onclick="tutupModalEditAbsen()">Batal</button>' +
          '<button class="btn btn-primary btn-sm" onclick="simpanEditAbsen(\'' + email + '\',\'' + tgl + '\')"><i class="ti ti-device-floppy"></i>Simpan</button>' +
        '</div>' +

      '</div>' +
    '</div>';

  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function tutupModalEditAbsen() {
  var m = document.getElementById('edit-absen-modal');
  if (m) m.remove();
}

// Simpan perubahan jam absen — status (hadir/terlambat) dihitung ulang persis seperti alur
// absen normal karyawan (bandingkan jam pagi dengan DB.settings.batasPagi), lalu skor harian
// & rata-rata bulanan dihitung ulang lewat hitungSkorHarian() supaya konsisten dengan data lain.
function simpanEditAbsen(email, tgl) {
  if (currentRole !== 'hrd') { showToast('Hanya HRD/Admin yang bisa mengedit data kehadiran','error'); return; }
  var emp = DB.employees.find(function(e){ return e.email === email; });
  if (!emp) { showToast('Karyawan tidak ditemukan','error'); return; }

  var pagi   = (document.getElementById('edt-pagi')?.value   || '').trim();
  var siang  = (document.getElementById('edt-siang')?.value  || '').trim();
  var lokasi = (document.getElementById('edt-lokasi')?.value || '').trim();

  var aKey = attendKeyFor(email, tgl);
  DB.attendance[aKey] = DB.attendance[aKey] || {};
  var rec = DB.attendance[aKey];

  if (pagi) {
    rec.pagi = pagi;
    var batasParts = (DB.settings.batasPagi || '08:30').split(':').map(Number);
    var pagiParts  = pagi.split(':').map(Number);
    var late = (pagiParts[0] > batasParts[0]) || (pagiParts[0] === batasParts[0] && pagiParts[1] >= batasParts[1]);
    rec.status = late ? 'terlambat' : 'hadir';
  } else {
    delete rec.pagi;
    delete rec.status;
  }

  if (siang) rec.siang = siang; else delete rec.siang;
  if (lokasi) rec.lokasi = lokasi;

  // Jejak audit sederhana — supaya jelas data ini pernah dikoreksi manual oleh admin
  rec.editedByAdmin = true;
  rec.editedAt = new Date().toISOString();
  rec.editedBy = (currentUser && currentUser.name) || 'HRD';

  hitungSkorHarian(email, aKey);
  persistSkorHarian(email, aKey);

  tutupModalEditAbsen();
  showToast('✅ Kehadiran ' + emp.name + ' tanggal ' + tgl + ' berhasil diperbarui', 'success');
  applyRekapFilter(); // refresh tabel & metrik sesuai filter yang sedang aktif
}

// ==================== LIHAT TO-DO LIST (Admin/HRD) ====================
// Modal read-only untuk HRD melihat isi to-do list & skor (termasuk koreksi & komentar
// koordinator) milik satu karyawan pada satu tanggal — dipanggil dari tombol "To-Do" di
// rincian harian menu Rekap Absensi.
function openLihatTodoModal(email, tgl) {
  var emp = DB.employees.find(function(e){ return e.email === email; });
  if (!emp) { showToast('Karyawan tidak ditemukan','error'); return; }

  var aKey = attendKeyFor(email, tgl);
  var todos = (DB.todos[aKey] || []).filter(function(t){ return t.task && t.task.trim(); });

  var old = document.getElementById('lihat-todo-modal');
  if (old) old.remove();

  var d = new Date(tgl);
  var hariNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  var bulanNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  var tglLabel = hariNames[d.getDay()] + ', ' + d.getDate() + ' ' + bulanNames[d.getMonth()] + ' ' + d.getFullYear();

  var itemsHtml = !todos.length
    ? '<div style="text-align:center;padding:20px;color:var(--gray-400);font-size:13px"><i class="ti ti-clipboard-x" style="font-size:26px;display:block;margin-bottom:6px"></i>Tidak ada to-do list pada tanggal ini.</div>'
    : todos.map(function(t, i){
        var koreksi   = (t.koreksi_skor !== null && t.koreksi_skor !== undefined) ? t.koreksi_skor : null;
        var hasScore  = (t.score !== null && t.score !== undefined);
        var skorAkhir = koreksi !== null ? koreksi : (hasScore ? t.score : null);
        var skorWarna = skorAkhir>=80?'var(--green)':skorAkhir>=60?'var(--amber)':skorAkhir!=null?'var(--red)':'var(--gray-400)';
        return '<div style="border:1px solid var(--gray-100);border-radius:var(--radius);padding:10px 12px;margin-bottom:8px;text-align:left">' +
          '<div style="display:flex;align-items:center;gap:10px">' +
            '<span style="font-size:12px;color:var(--gray-400);min-width:18px">' + (i+1) + '.</span>' +
            '<span style="flex:1;font-size:13px;color:var(--gray-700)">' + t.task + '</span>' +
            (hasScore ? '<span style="font-size:12px;color:var(--gray-400)">Skor: ' + t.score + '</span>' : '<span class="badge badge-gray">Belum dinilai</span>') +
            (koreksi !== null
              ? '<i class="ti ti-arrow-right" style="font-size:11px;color:var(--gray-300)"></i><span style="font-weight:700;font-size:14px;color:' + skorWarna + '">' + koreksi + '</span>'
              : '') +
          '</div>' +
          (t.komentar_koor
            ? '<div style="margin-top:8px;background:#eff6ff;border-left:3px solid var(--blue-400);border-radius:0 6px 6px 0;padding:8px 10px;font-size:12px;color:var(--gray-700)">' +
                '<span style="font-weight:600;color:var(--blue-600)"><i class="ti ti-message-circle-2" style="margin-right:4px"></i>Komentar Koordinator</span>' +
                (t.koor_edit_by ? ' <span style="color:var(--gray-400);font-size:11px">· ' + t.koor_edit_by + ' ' + (t.koor_edit_time||'') + '</span>' : '') +
                '<div style="margin-top:4px">' + t.komentar_koor + '</div>' +
              '</div>'
            : '') +
        '</div>';
      }).join('');

  var modalHTML =
    '<div id="lihat-todo-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px">' +
      '<div style="background:#fff;border-radius:16px;padding:24px;max-width:460px;width:100%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">' +
          '<div class="av" style="background:' + emp.bg + ';color:#fff;width:36px;height:36px;font-size:12px;flex-shrink:0">' + emp.inits + '</div>' +
          '<div style="min-width:0;flex:1">' +
            '<div style="font-weight:700;font-size:14px;color:var(--gray-800);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + emp.name + '</div>' +
            '<div style="font-size:11px;color:var(--gray-400)">' + tglLabel + '</div>' +
          '</div>' +
          '<button onclick="tutupModalLihatTodo()" style="background:none;border:none;color:var(--gray-400);cursor:pointer;padding:4px"><i class="ti ti-x" style="font-size:18px"></i></button>' +
        '</div>' +
        itemsHtml +
        '<div style="display:flex;justify-content:flex-end;margin-top:8px">' +
          '<button class="btn btn-ghost btn-sm" onclick="tutupModalLihatTodo()">Tutup</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function tutupModalLihatTodo() {
  var m = document.getElementById('lihat-todo-modal');
  if (m) m.remove();
}

// Hapus data absensi satu tanggal — dipakai kalau data yang masuk memang salah total (mis.
// tercatat dua kali, atau bukan hari kerja karyawan tsb) dan sebaiknya dianggap tidak ada.
function hapusAbsenTanggal(email, tgl) {
  if (currentRole !== 'hrd') { showToast('Hanya HRD/Admin yang bisa menghapus data kehadiran','error'); return; }
  var emp = DB.employees.find(function(e){ return e.email === email; });
  if (!emp) { showToast('Karyawan tidak ditemukan','error'); return; }

  var aKey = attendKeyFor(email, tgl);
  if (!DB.attendance[aKey]) { showToast('Tidak ada data absensi pada tanggal ini','warning'); return; }

  if (!confirm('Hapus seluruh data absensi ' + emp.name + ' tanggal ' + tgl + '?\nAksi ini tidak dapat dibatalkan.')) return;

  delete DB.attendance[aKey];
  dbSaveLocal(DB);
  dbSavePath('attendance/' + aKey, null);

  // Rata-rata skor bulanan karyawan perlu dihitung ulang karena satu titik data hilang
  updateAvgSkorBulanan(email);
  var idx = DB.employees.findIndex(function(e){ return e.email === email; });
  if (idx >= 0) dbSavePath('employees/' + idx, cleanForFirebase(DB.employees[idx]));
  dbSavePath('notifikasiPerforma', cleanForFirebase(DB.notifikasiPerforma));
  dbSavePath('sanctions', cleanForFirebase(DB.sanctions));

  tutupModalEditAbsen();
  showToast('Data absensi tanggal ' + tgl + ' berhasil dihapus', 'warning');
  applyRekapFilter();
}
