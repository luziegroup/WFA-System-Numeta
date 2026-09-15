/* ============================================================
 * FILE   : 09-rekap-laporan.js
 * BAGIAN : Rekap & Laporan
 * ISI    : Filter rekap absensi, hapus data absensi terfilter, export laporan.
 * ============================================================ */

// ==================== REKAP FILTER & HAPUS ====================
// BUGFIX: rekap sekarang punya filter BULAN (bukan cuma "bulan ini" yang di-hardcode), jadi
// filter tidak bisa lagi sekadar sembunyikan baris tabel dengan CSS — statistik per karyawan
// (hadir/terlambat/avg skor) berbeda-beda tergantung bulan yang dipilih. Karena itu setiap
// filter berubah, konten tabel dibangun ULANG lewat buildRekapContent() dan ditimpakan ke
// container-nya saja (dropdown filter di atasnya tidak ikut ter-reset).
function applyRekapFilter() {
  var bulan  = document.getElementById('rkp-bulan')?.value  || todayKey().slice(0,7);
  var koor   = document.getElementById('rkp-koor')?.value   || '';
  var div    = document.getElementById('rkp-div')?.value    || '';
  var status = document.getElementById('rkp-status')?.value || '';
  var container = document.getElementById('rekap-content');
  if (container) container.innerHTML = buildRekapContent(bulan, koor, div, status);
}

function resetRekapFilter() {
  var elBln = document.getElementById('rkp-bulan'); if (elBln) elBln.value = todayKey().slice(0,7);
  ['rkp-koor','rkp-div','rkp-status'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.value='';
  });
  applyRekapFilter();
}

// ==================== EXPAND / RINCIAN HARIAN PER KARYAWAN ====================
// Dipanggil saat panah (chevron) atau nama karyawan di tabel rekap diklik. Baris rincian
// di-render sekali (lazy) lalu di-cache di DOM (data-loaded="1") supaya klik berikutnya
// tinggal show/hide tanpa membangun ulang tabel harian.
function toggleRekapRow(chevEl, email, bulanKey) {
  var safeId = 'rkp-' + (email||'').replace(/[^a-zA-Z0-9]/g,'_');
  var row = document.getElementById(safeId + '-detail');
  if (!row) return;
  var isOpen = row.style.display !== 'none';
  if (isOpen) {
    row.style.display = 'none';
    if (chevEl) { chevEl.classList.remove('ti-chevron-up'); chevEl.classList.add('ti-chevron-down'); }
    return;
  }
  var cell = row.querySelector('.rkp-detail-cell');
  if (cell && cell.dataset.loaded !== '1') {
    cell.innerHTML = renderRekapDetailBulan(email, bulanKey);
    cell.dataset.loaded = '1';
  }
  row.style.display = '';
  if (chevEl) { chevEl.classList.remove('ti-chevron-down'); chevEl.classList.add('ti-chevron-up'); }
}

// Bangun tabel rincian absensi HARIAN satu karyawan untuk satu bulan (dipakai oleh baris
// expand rekap). Setiap baris tanggal punya tombol Edit — antisipasi karyawan gagal absen
// (error GPS/jaringan) supaya HRD tetap bisa memperbaiki datanya secara manual.
// Skor ditampilkan per-komponen (Absen/To-Do/Komunikasi) plus skor akhir gabungan, supaya
// terlihat jelas komponen mana yang belum terisi — komponen yang kosong dihitung sebagai 0
// pada skor akhir (lihat hitungSkorHarian), jadi ikut menurunkan rata-rata yang ditampilkan.
function renderRekapDetailBulan(email, bulanKey) {
  var emp = DB.employees.find(function(e){ return e.email === email; });
  if (!emp) return '<div style="padding:14px;color:var(--gray-400);font-size:12px">Karyawan tidak ditemukan.</div>';

  var dates = daftarTanggalBulan(bulanKey);
  if (!dates.length) return '<div style="padding:14px;color:var(--gray-400);font-size:12px;text-align:center">Belum ada tanggal untuk bulan ini.</div>';

  function komponenCell(val) {
    if (val === null || val === undefined) return '<span style="color:var(--gray-300)">—</span>';
    var c = val>=80?'var(--green)':val>=60?'var(--amber)':'var(--red)';
    return '<span style="font-weight:600;color:'+c+'">'+val+'</span>';
  }

  var hariNames = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  var rows = dates.slice().reverse().map(function(tgl){
    var aKey = attendKeyFor(email, tgl);
    var rec  = DB.attendance[aKey] || {};
    var d    = new Date(tgl);
    var tdk  = !!(rec.pagi && !rec.siang);
    var statusKey = rec.pagi ? (rec.status || 'hadir') : 'belum';
    var skorColor = rec.skor>=80?'var(--green)':rec.skor>=60?'var(--amber)':(rec.skor!=null?'var(--red)':'var(--gray-300)');
    return '<tr>' +
      '<td style="font-size:12px;white-space:nowrap">' + hariNames[d.getDay()] + ', ' + d.getDate() + '/' + (d.getMonth()+1) + '</td>' +
      '<td style="text-align:center;font-size:12px">' + (rec.pagi||'—') + '</td>' +
      '<td style="text-align:center;font-size:12px">' + (rec.siang||'—') + '</td>' +
      '<td style="text-align:center">' + (tdk ? '<span class="badge badge-amber">Tdk Lengkap</span>' : statusBadge(statusKey)) + '</td>' +
      '<td style="text-align:center;font-size:12px">' + komponenCell(rec.skorAbsen) + '</td>' +
      '<td style="text-align:center;font-size:12px">' + komponenCell(rec.skorTodo) + '</td>' +
      '<td style="text-align:center;font-size:12px">' + komponenCell(rec.skorKomunikasi) + '</td>' +
      '<td style="text-align:center;font-weight:700;font-size:12px;color:' + skorColor + '">' + (rec.skor!=null?rec.skor:'—') + '</td>' +
      '<td style="text-align:center;white-space:nowrap">' +
        '<button class="btn btn-ghost btn-sm" onclick="openLihatTodoModal(\'' + email + '\',\'' + tgl + '\')" title="Lihat to-do list & skor tanggal ini"><i class="ti ti-list-check"></i>To-Do</button>' +
        (currentRole === 'hrd'
          ? ' <button class="btn btn-ghost btn-sm" onclick="openEditAbsenModal(\'' + email + '\',\'' + tgl + '\')" title="Edit / perbaiki data absen tanggal ini"><i class="ti ti-pencil"></i>Edit</button>'
          : '') +
      '</td>' +
    '</tr>';
  }).join('');

  return (
    '<div style="padding:12px 14px">' +
      '<div style="font-size:11px;font-weight:700;color:var(--gray-500);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px"><i class="ti ti-calendar-event"></i> Rincian Absen Harian — ' + emp.name + '</div>' +
      '<div class="info-bar info-blue" style="margin-bottom:10px;font-size:11px"><i class="ti ti-info-circle"></i>Skor Akhir = gabungan Absen + To-Do + Komunikasi sesuai bobot pengaturan. Komponen yang belum terisi (—) dihitung 0, sehingga ikut menurunkan Skor Akhir.</div>' +
      '<div style="overflow-x:auto"><table class="data-table" style="min-width:680px;background:var(--white)"><thead><tr>' +
        '<th>Tanggal</th><th style="text-align:center">Pagi</th><th style="text-align:center">Siang</th>' +
        '<th style="text-align:center">Status</th>' +
        '<th style="text-align:center">Skor Absen</th><th style="text-align:center">Skor To-Do</th><th style="text-align:center">Skor Komunikasi</th>' +
        '<th style="text-align:center">Skor Akhir</th><th style="text-align:center">Aksi</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '</div>'
  );
}

function exportRekapCSV() {
  var bulan  = document.getElementById('rkp-bulan')?.value  || todayKey().slice(0,7);
  var koor   = document.getElementById('rkp-koor')?.value   || '';
  var div    = document.getElementById('rkp-div')?.value    || '';
  var status = document.getElementById('rkp-status')?.value || '';

  var filtered = DB.employees.filter(function(e){
    if (koor   && e.koor   !== koor)   return false;
    if (div    && e.div    !== div)     return false;
    if (status && e.status !== status)  return false;
    return true;
  });

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
  a.href=url; a.download='rekap_'+(koor?koor.replace(/\s/g,'_')+'_':'')+(div?div+'_':'')+bulan+'.csv';
  a.style.display='none'; document.body.appendChild(a); a.click();
  setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); },2000);
  showToast(filtered.length + ' data berhasil diexport','success');
}

function hapusDataAbsensiFilter() {
  var bulan  = document.getElementById('rkp-bulan')?.value  || todayKey().slice(0,7);
  var koor   = document.getElementById('rkp-koor')?.value   || '';
  var div    = document.getElementById('rkp-div')?.value    || '';
  var status = document.getElementById('rkp-status')?.value || '';

  if (!koor && !div && !status) {
    showToast('Aktifkan minimal satu filter (Koordinator/Divisi/Status) sebelum menghapus data','warning');
    return;
  }

  var filtered = DB.employees.filter(function(e){
    if (koor   && e.koor   !== koor)   return false;
    if (div    && e.div    !== div)     return false;
    if (status && e.status !== status)  return false;
    return true;
  });

  if (!filtered.length) { showToast('Tidak ada karyawan yang cocok dengan filter','warning'); return; }

  var bulanLabel = new Date(bulan + '-01').toLocaleDateString('id-ID',{month:'long',year:'numeric'});
  var filterDesc = [
    'Bulan: '+bulanLabel,
    koor   ? 'Koordinator: '+koor   : '',
    div    ? 'Divisi: '+div         : '',
    status ? 'Status: '+status      : '',
  ].filter(Boolean).join(', ');

  // Pilih aksi: hapus data absensi atau batal
  var aksi = confirm(
    'Filter aktif: ' + filterDesc + '\n' +
    filtered.length + ' karyawan terseleksi.\n\n' +
    'Pilih aksi:\n' +
    '• OK = Hapus DATA ABSENSI bulan ' + bulanLabel + ' (data karyawan tetap)\n' +
    '• Cancel = Batalkan'
  );
  if (!aksi) return;

  var deleted = 0;
  filtered.forEach(function(emp){
    var encEm = emp.email.replace(/[.#$\[\]]/g,'_');
    Object.keys(DB.attendance).forEach(function(k){
      if (k.startsWith(encEm+'_') && k.indexOf(bulan)>=0) {
        delete DB.attendance[k];
        deleted++;
      }
    });
    // Reset status permanen karyawan ke 'aktif' (bukan 'belum' —
    // status absensi harian sekarang dibaca dari DB.attendance, bukan DB.employees)
    emp.status = 'aktif';
  });

  dbSaveLocal(DB);
  // BUGFIX: hanya simpan path attendance & employees yang benar-benar diubah
  dbSavePath('attendance', cleanForFirebase(DB.attendance));
  dbSavePath('employees', cleanForFirebase(DB.employees));
  showToast(deleted + ' data absensi bulan ' + bulanLabel + ' berhasil dihapus','warning');
  showPage('hrd','rekap');
}

// ==================== LAPORAN EXPORT ====================
// ==================== FILTER LAPORAN (HRD) ====================
function applyLaporanFilterHRD() {
  var bulan = document.getElementById('lap-bulan')?.value || todayKey().slice(0,7);
  var container = document.getElementById('laporan-hrd-content');
  if (container) container.innerHTML = buildLaporanHRDContent(bulan);
}

function exportLaporan() {
  var bulan = document.getElementById('lap-bulan')?.value || todayKey().slice(0,7);
  var targetEmps = currentRole==='koor'
    ? DB.employees.filter(function(e){ return e.koor===currentUser.name; })
    : DB.employees;
  var header = 'nama,divisi,koordinator,hadir,terlambat,tidak_lengkap,avg_skor,status';
  var rows = targetEmps.map(function(emp){
    var encEm=(emp.email||'').toLowerCase().replace(/[.#$\[\]]/g,'_'); // BUGFIX: lowercase
    var keys=Object.keys(DB.attendance).filter(function(k){return k.startsWith(encEm+'_')&&k.indexOf(bulan)>=0;});
    var hadir=0,terlambat=0,tdk=0,skorArr=[];
    keys.forEach(function(k){var r=DB.attendance[k];if(r.pagi&&r.siang){if(r.status==='terlambat')terlambat++;else hadir++;}else if(r.pagi||r.siang)tdk++;if(r.skor!=null)skorArr.push(Number(r.skor));});
    var avg=skorArr.length?Math.round(skorArr.reduce(function(a,b){return a+b;},0)/skorArr.length):'';
    return [emp.name,emp.div,emp.koor,hadir,terlambat,tdk,avg,emp.status].map(function(v){return '"'+String(v||'').replace(/"/g,'""')+'"';}).join(',');
  });
  var csv='\uFEFF'+[header].concat(rows).join('\r\n');
  var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;a.download='laporan_'+bulan+'.csv';a.style.display='none';
  document.body.appendChild(a);a.click();
  setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);},2000);
  showToast('Laporan berhasil diexport','success');
}

