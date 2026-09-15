/* ============================================================
 * FILE   : 06-page-hrd.js
 * BAGIAN : Halaman HRD
 * ISI    : Seluruh tampilan & logika dashboard HRD: rekap karyawan, arsip absensi, dsb.
 * ============================================================ */

// Bangun konten halaman "Analisis Performa" (ringkasan + grafik bulanan + papan skor) sesuai
// filter yang aktif. Dipisah dari buildHRD() supaya bisa dipanggil ULANG oleh applyPerformaFilterHRD()
// tanpa membangun ulang seluruh halaman (dropdown filter tidak ikut ter-reset saat isinya berubah).
// bulanSel = {type:'range', numMonths:N}  -> grafik batang rata-rata per bulan (default lama)
// bulanSel = {type:'month', bulanKey:'YYYY-MM'} -> grafik garis skor PER HARI untuk bulan tsb
function buildPerformaHRDContent(filterDiv, filterKoor, bulanSel) {
  bulanSel = bulanSel || { type:'range', numMonths:6 };
  var threshold = DB.settings.minSkorRataRata ?? 70;

  var filtered = DB.employees.filter(function(e) {
    if (filterDiv  && e.div  !== filterDiv)  return false;
    if (filterKoor && e.koor !== filterKoor) return false;
    return true;
  });

  var avgArr = filtered.filter(function(e){ return e.skor!=null; }).map(function(e){ return e.skor; });
  var avgAll = avgArr.length ? Math.round(avgArr.reduce(function(a,b){return a+b;},0)/avgArr.length) : null;
  var dibawahAmbang = filtered.filter(function(e){ return e.skor!=null && e.skor<threshold; }).length;

  var isHarian = bulanSel.type === 'month';
  var bulanLabel = isHarian ? new Date(bulanSel.bulanKey + '-01').toLocaleDateString('id-ID',{month:'long',year:'numeric'}) : '';
  var chartTitle = isHarian
    ? 'Grafik Skor Harian — ' + bulanLabel
    : 'Grafik Performa Bulanan (' + bulanSel.numMonths + ' Bulan Terakhir)';
  var chartInfo = isHarian
    ? 'Rata-rata skor harian gabungan karyawan sesuai filter, per hari, untuk bulan ' + bulanLabel + '.'
    : 'Rata-rata skor harian gabungan karyawan sesuai filter, per bulan.';
  var chartHtml = filtered.length
    ? (isHarian
        ? buildSkorHarianBulanChart(filtered.map(function(e){ return e.email; }), bulanSel.bulanKey, threshold)
        : buildSkorBulananChart(filtered.map(function(e){ return e.email; }), bulanSel.numMonths, threshold))
    : '<div style="text-align:center;padding:32px;color:var(--gray-400);font-size:13px">Tidak ada karyawan yang cocok dengan filter.</div>';

  return (
    '<div class="metrics">' +
      '<div class="metric-box blue-card"><div class="mb-label">Karyawan Tercakup</div><div class="mb-val">' + filtered.length + '</div></div>' +
      '<div class="metric-box"><div class="mb-label">Rata-rata Skor</div><div class="mb-val" style="color:var(--blue-700)">' + (avgAll!=null ? avgAll : '—') + '</div><div class="mb-sub">Bulan ini</div></div>' +
      '<div class="metric-box"><div class="mb-label">Di Bawah Ambang Batas</div><div class="mb-val" style="color:var(--red)">' + dibawahAmbang + '</div><div class="mb-sub">Ambang: ' + threshold + '</div></div>' +
    '</div>' +

    '<div class="card"><div class="card-head"><i class="ti ti-chart-histogram" style="color:var(--blue-600)"></i><h2>' + chartTitle + '</h2></div>' +
    (filtered.length ? '<div class="info-bar info-blue" style="margin-bottom:12px"><i class="ti ti-info-circle"></i>' + chartInfo + '</div>' : '') +
    chartHtml + '</div>' +

    '<div class="card"><div class="card-head"><i class="ti ti-list-numbers" style="color:var(--amber)"></i><h2>Papan Skor (' + filtered.length + ' Karyawan)</h2></div>' +
    buildPapanSkor(filtered, {showDivKoor:true}) +
    '</div>'
  );
}

// ==================== KONTEN REKAP ABSENSI (bisa dibangun ulang oleh applyRekapFilter) ====================
// Dipisah dari buildHRD() supaya filter bulan/koor/div/status bisa mem-build ULANG hanya
// bagian metrik + tabel ini (dropdown filter di atasnya tidak ikut ter-reset).
// Setiap baris karyawan punya panah (chevron) yang saat diklik menampilkan rincian
// absensi HARIAN karyawan tsb untuk bulan yang difilter (lazy-render, sekali per baris).
function buildRekapContent(bulanKey, koorF, divF, statusF) {
  var emps = DB.employees.filter(function(e) {
    if (koorF   && e.koor   !== koorF)   return false;
    if (divF    && e.div    !== divF)    return false;
    if (statusF && e.status !== statusF) return false;
    return true;
  });

  var bulanLabel = new Date(bulanKey + '-01').toLocaleDateString('id-ID',{month:'long',year:'numeric'});

  // Hitung statistik real per karyawan untuk bulan yang dipilih
  var empStats = emps.map(function(emp) {
    var encEm = (emp.email||'').toLowerCase().replace(/[.#$\[\]]/g,'_'); // BUGFIX: lowercase
    var keys  = Object.keys(DB.attendance).filter(function(k){
      return k.startsWith(encEm+'_') && k.indexOf(bulanKey)>=0;
    });
    var hadir=0,terlambat=0,tdk=0,skorArr=[];
    keys.forEach(function(k){
      var r=DB.attendance[k];
      if(r.pagi&&r.siang){ if(r.status==='terlambat')terlambat++; else hadir++; }
      else if(r.pagi||r.siang) tdk++;
      if(r.skor!=null) skorArr.push(Number(r.skor));
    });
    var avgSkor = skorArr.length ? Math.round(skorArr.reduce(function(a,b){return a+b;},0)/skorArr.length) : null;
    var bonusOk = avgSkor!=null && avgSkor>=(DB.settings.minSkorBonus||75) && terlambat===0 && emp.pelanggaran<2;
    return {emp:emp, hadir:hadir, terlambat:terlambat, tdk:tdk, avgSkor:avgSkor, bonusOk:bonusOk, totalKeys:keys.length};
  });

  // Summary total real
  var ttlHadir   = empStats.filter(function(s){return s.hadir+s.terlambat>0;}).length;
  var ttlLambat  = empStats.reduce(function(a,s){return a+s.terlambat;},0);
  var allSkor    = empStats.filter(function(s){return s.avgSkor!=null;}).map(function(s){return s.avgSkor;});
  var avgAll     = allSkor.length ? Math.round(allSkor.reduce(function(a,b){return a+b;},0)/allSkor.length) : 0;
  var ttlBonus   = empStats.filter(function(s){return s.bonusOk;}).length;

  return (
    // Metrik real
    '<div class="metrics">' +
      '<div class="metric-box blue-card"><div class="mb-label">Karyawan Tercakup</div><div class="mb-val">' + emps.length + '</div></div>' +
      '<div class="metric-box"><div class="mb-label">Pernah Hadir</div><div class="mb-val" style="color:var(--green)">' + ttlHadir + '</div><div class="mb-sub">' + bulanLabel + '</div></div>' +
      '<div class="metric-box"><div class="mb-label">Total Keterlambatan</div><div class="mb-val" style="color:var(--amber)">' + ttlLambat + '</div></div>' +
      '<div class="metric-box"><div class="mb-label">Avg Skor Tim</div><div class="mb-val" style="color:var(--blue-600)">' + (avgAll||'—') + '</div></div>' +
      '<div class="metric-box"><div class="mb-label">Dapat Bonus</div><div class="mb-val" style="color:var(--green)">' + ttlBonus + '</div><div class="mb-sub">dari ' + emps.length + '</div></div>' +
    '</div>' +

    // ---- TABEL REKAP ----
    '<div class="card"><div class="card-head"><i class="ti ti-table" style="color:var(--blue-600)"></i>' +
      '<h2>Detail Rekap — ' + bulanLabel + ' (<span id="rkp-count">' + empStats.length + '</span> karyawan)</h2>' +
    '</div>' +
    (!empStats.length
      ? '<div style="text-align:center;padding:24px;color:var(--gray-400);font-size:13px"><i class="ti ti-search" style="font-size:28px;display:block;margin-bottom:8px"></i>Tidak ada karyawan yang cocok dengan filter</div>'
      : '<div style="overflow-x:auto"><table class="data-table" style="min-width:640px" id="rkp-table">' +
        '<thead><tr>' +
          '<th style="width:24px"></th><th>Nama</th><th>Divisi</th><th>Koordinator</th>' +
          '<th style="text-align:center">Hadir</th><th style="text-align:center">Terlambat</th>' +
          '<th style="text-align:center">Tdk Lengkap</th><th style="text-align:center">Avg Skor</th>' +
          '<th style="text-align:center">Status</th><th style="text-align:center">Bonus</th>' +
        '</tr></thead>' +
        '<tbody id="rkp-tbody">' +
        empStats.map(function(s){
          var e=s.emp;
          var safeId = 'rkp-' + (e.email||'').replace(/[^a-zA-Z0-9]/g,'_');
          var skClr=s.avgSkor>=80?'var(--green)':s.avgSkor?'var(--amber)':'var(--gray-400)';
          return '<tr data-koor="'+e.koor+'" data-div="'+e.div+'" data-status="'+e.status+'">' +
            '<td style="text-align:center"><i class="ti ti-chevron-down" id="'+safeId+'-chev" style="cursor:pointer;color:var(--gray-400);font-size:15px" onclick="toggleRekapRow(this,\''+e.email+'\',\''+bulanKey+'\')" title="Lihat rincian harian"></i></td>' +
            '<td><div style="display:flex;align-items:center;gap:7px;cursor:pointer" onclick="toggleRekapRow(document.getElementById(\''+safeId+'-chev\'),\''+e.email+'\',\''+bulanKey+'\')">' +
              '<div class="av" style="background:'+e.bg+';color:#fff;width:26px;height:26px;font-size:10px">'+e.inits+'</div>' +
              '<span style="font-weight:600">'+e.name+'</span></div></td>' +
            '<td style="font-size:12px;color:var(--gray-500)">'+e.div+'</td>' +
            '<td style="font-size:12px;color:var(--gray-500)">'+e.koor+'</td>' +
            '<td style="text-align:center;font-weight:700;color:var(--green)">'+s.hadir+'</td>' +
            '<td style="text-align:center;font-weight:700;color:var(--amber)">'+s.terlambat+'</td>' +
            '<td style="text-align:center;font-weight:700;color:var(--blue-500)">'+s.tdk+'</td>' +
            '<td style="text-align:center;font-weight:700;color:'+skClr+'">'+(s.avgSkor||'—')+'</td>' +
            '<td style="text-align:center">'+statusBadge(e.status)+'</td>' +
            '<td style="text-align:center"><span class="badge '+(s.bonusOk?'badge-green':'badge-red')+'">'+(s.bonusOk?'✓ Ya':'✗ Tidak')+'</span></td>' +
          '</tr>' +
          '<tr id="'+safeId+'-detail" style="display:none"><td colspan="10" class="rkp-detail-cell" data-loaded="0" style="padding:0;background:var(--gray-50)"></td></tr>';
        }).join('') +
        '</tbody>' +
      '</table></div>'
    ) +
    '</div>'
  );
}

// ---- HRD ----
function buildHRD(id) {
  var emps = DB.employees;
  var today = todayKey();

  // BUGFIX: hadir/terlambat/belum harus dibaca dari DB.attendance[hari ini],
  // bukan dari DB.employees.status yang merupakan status permanen dan TIDAK
  // direset tiap hari — itulah kenapa dashboard selalu menampilkan data kemarin.
  var hadir = 0, terlambat = 0, belum = 0, cabut = 0;
  emps.forEach(function(e) {
    if (e.status === 'cabut') { cabut++; return; }
    var rec = DB.attendance[attendKeyFor(e.email, today)] || {};
    if (rec.status === 'hadir')        hadir++;
    else if (rec.status === 'terlambat') terlambat++;
    else                                 belum++;
  });

  if (id === 'dashboard') return (
    '<div class="page-header"><h1>Dashboard HRD ' + rtBadge() + '</h1><p>Ringkasan kondisi WFA hari ini — ' + new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) + '</p></div>' +
    '<div class="metrics">' +
      '<div class="metric-box blue-card"><div class="mb-label">Total Karyawan WFA</div><div class="mb-val">' + emps.length + '</div><div class="mb-sub">Aktif bulan ini</div></div>' +
      '<div class="metric-box"><div class="mb-label">Hadir Tepat Waktu</div><div class="mb-val" style="color:var(--green)">' + hadir + '</div><div class="mb-sub">Hari ini</div></div>' +
      '<div class="metric-box"><div class="mb-label">Terlambat</div><div class="mb-val" style="color:var(--amber)">' + terlambat + '</div><div class="mb-sub">Hari ini</div></div>' +
      '<div class="metric-box"><div class="mb-label">Belum Absen</div><div class="mb-val" style="color:var(--red)">' + belum + '</div><div class="mb-sub">Perlu follow up</div></div>' +
    '</div>' +
    '<div class="card"><div class="card-head"><i class="ti ti-users"></i><h2>Status Absensi Karyawan</h2></div>' +
    emps.map(function(e) {
      // BUGFIX: ambil jam pagi, siang, dan status dari attendance HARI INI
      // bukan dari DB.employees yang menyimpan status permanen & tidak direset harian
      var rec = DB.attendance[attendKeyFor(e.email, today)] || {};
      var absenStatus = e.status === 'cabut' ? 'cabut'
                      : (rec.status || 'belum');
      return '<div class="trow">' +
        '<div class="av" style="background:' + e.bg + ';color:#fff">' + e.inits + '</div>' +
        '<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--gray-800)">' + e.name + '</div>' +
        '<div style="font-size:11px;color:var(--gray-400)">' + e.div + ' · Koor: ' + e.koor + '</div></div>' +
        '<div style="text-align:right;margin-right:12px">' +
          '<div style="font-size:12px;font-weight:600;color:var(--gray-600)">Pagi: ' + (rec.pagi||'--') + ' | Siang: ' + (rec.siang||'--') + '</div>' +
          '<div style="font-size:11px;color:var(--gray-400)">Hubstaff: ' + (e.status==='cabut'?'<span style="color:var(--red)">Non-aktif</span>':'<span style="color:var(--green)">Aktif</span>') + '</div>' +
        '</div>' + statusBadge(absenStatus) + '</div>';
    }).join('') + '</div>' +
    '<div class="card"><div class="card-head"><i class="ti ti-alert-circle" style="color:var(--red)"></i><h2>Pelanggaran Terbaru</h2></div>' +
    DB.sanctions.slice(0,3).map(function(s) {
      var isRed = s.jenis.includes('tertulis') || s.jenis.includes('Pencabutan');
      return '<div class="v-card ' + (isRed?'v-red':'v-amber') + '">' +
        '<div class="v-date">' + s.date + ' · ' + s.from + ' → ' + s.to + '</div>' +
        '<div class="v-text">' + s.alasan + '</div>' +
        '<span class="badge ' + (isRed?'badge-red':'badge-amber') + '" style="margin-top:6px">' + s.jenis + '</span></div>';
    }).join('') + '</div>' +

    /* ---- TREN PERFORMA PERUSAHAAN ---- */
    '<div class="card"><div class="card-head"><i class="ti ti-chart-line" style="color:var(--blue-600)"></i><h2>Tren Skor Performa (30 Hari Terakhir)</h2></div>' +
    '<div class="info-bar info-blue" style="margin-bottom:12px"><i class="ti ti-info-circle"></i>Rata-rata skor harian seluruh karyawan (gabungan Absen, To-Do, Komunikasi). Garis putus-putus menandai ambang batas minimum (' + (DB.settings.minSkorRataRata??70) + ').</div>' +
    buildSkorTrendChart(emps.map(function(e){return e.email;}), 30, DB.settings.minSkorRataRata??70) +
    '</div>' +

    /* ---- NOTIFIKASI PERFORMA TERBARU ---- */
    ((DB.notifikasiPerforma||[]).length ?
      '<div class="card"><div class="card-head"><i class="ti ti-bell-exclamation" style="color:var(--amber)"></i><h2>Notifikasi Performa Terbaru</h2></div>' +
        (DB.notifikasiPerforma||[]).slice(0,5).map(function(n){
          var isCabut = n.jenis==='cabut';
          return '<div class="v-card ' + (isCabut?'v-red':'v-amber') + '">' +
            '<div class="v-date">' + n.tanggal + ' · ' + n.nama + ' (Koor: ' + (n.koor||'-') + ')</div>' +
            '<div class="v-text">' + n.pesan + '</div>' +
            '<span class="badge ' + (isCabut?'badge-red':'badge-amber') + '" style="margin-top:6px">' + (isCabut?'Hak WFA Dicabut':'Peringatan Performa') + '</span></div>';
        }).join('') + '</div>'
    : '')
  );

  if (id === 'karyawan') {
    var pendingAccounts = Object.entries(USERS).filter(function(entry){
      var u = entry[1];
      return u.setupDone === false && u.roles.some(function(r){ return r.role==='kary'; });
    });

    return (
    '<div class="page-header"><h1>Data Karyawan ' + rtBadge() + '</h1><p>Kelola akun dan status WFA seluruh karyawan</p></div>' +

    /* ---- AKUN MENUNGGU SETUP ---- */
    (pendingAccounts.length ?
      '<div class="card" style="border:1px solid #fde68a;background:#fffbeb">' +
        '<div class="card-head"><i class="ti ti-clock-pause" style="color:var(--amber)"></i><h2>Akun Menunggu Setup (' + pendingAccounts.length + ')</h2></div>' +
        '<div class="info-bar info-amber" style="margin-bottom:10px"><i class="ti ti-info-circle"></i>Akun ini sudah bisa <strong>login</strong>, tapi belum muncul di "Daftar Karyawan" karena belum melengkapi <strong>Divisi & Koordinator</strong>. Mereka akan diarahkan otomatis untuk mengisi data saat login pertama.</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
          pendingAccounts.slice(0,30).map(function(entry){
            var em = entry[0], u = entry[1];
            return '<span class="badge" style="background:#fff;border:1px solid #fde68a;color:#92400e"><i class="ti ti-user"></i>' + (u.name||em) + '</span>';
          }).join('') +
          (pendingAccounts.length > 30 ? '<span class="badge" style="background:#fff;border:1px solid #fde68a;color:#92400e">+' + (pendingAccounts.length-30) + ' lainnya</span>' : '') +
        '</div>' +
      '</div>'
    : '') +

    /* ---- TAMBAH KARYAWAN ---- */
    '<div class="card"><div class="card-head"><i class="ti ti-user-plus" style="color:var(--green)"></i><h2>Tambah Karyawan Baru</h2></div>' +
    '<div class="info-bar info-blue" style="margin-bottom:12px"><i class="ti ti-info-circle"></i>Akun login akan dibuat otomatis dari nama karyawan. Email login: <strong>nama.depan@luziegroup.id</strong></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px" class="hrd-form-grid">' +
      '<div class="field" style="margin:0"><label>Nama Lengkap</label><input type="text" id="new-nama" placeholder="Nama karyawan" oninput="previewEmailKaryawan()"/></div>' +
      '<div class="field" style="margin:0"><label>Password Login</label>' +
        '<div style="position:relative">' +
          '<input type="password" id="new-pass" placeholder="Min. 6 karakter" style="padding-right:38px"/>' +
          '<button type="button" onclick="togglePassFieldKary()" tabindex="-1" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--gray-400);cursor:pointer;padding:4px;display:flex;align-items:center"><i class="ti ti-eye" id="new-pass-eye" style="font-size:15px"></i></button>' +
        '</div>' +
      '</div>' +
      '<div class="field" style="margin:0"><label>Divisi</label><select id="new-div">' + getDivisiList().map(function(d){return '<option>'+d+'</option>';}).join('') + '</select></div>' +
      '<div class="field" style="margin:0"><label>Koordinator</label><select id="new-koor">' +
      getKoordinatorList().map(function(n){ return '<option>'+n+'</option>'; }).join('') +
      '</select></div>' +
    '</div>' +
    '<div id="preview-email-kary" style="margin-top:10px;font-size:12px;color:var(--gray-500);display:none">' +
      '<i class="ti ti-at" style="margin-right:4px"></i>Email login: <strong id="preview-email-val"></strong>' +
    '</div>' +
    '<div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn btn-primary" onclick="addKaryawan()"><i class="ti ti-plus"></i>Tambah Karyawan</button></div></div>' +

    /* ---- IMPORT / EXPORT ---- */
    '<div class="card"><div class="card-head"><i class="ti ti-file-spreadsheet" style="color:var(--blue-600)"></i><h2>Import & Export Data</h2></div>' +
    '<div class="info-bar info-blue" style="margin-bottom:14px"><i class="ti ti-info-circle"></i>Format CSV: <strong>nama,email,password,divisi,koordinator,role</strong> (semua kolom selain nama opsional). Email dibuat otomatis dari nama. Jika <strong>Divisi/Koordinator dikosongkan</strong>, akun karyawan dibuat tanpa data lengkap — mereka wajib mengisi Nama, Divisi, Koordinator, dan boleh ganti password <strong>saat login pertama</strong>.</div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px" class="import-btns">' +
      '<label style="display:inline-flex;align-items:center;gap:7px;padding:10px 18px;background:var(--gray-100);border:1px solid var(--gray-200);border-radius:var(--radius);font-size:13px;font-weight:600;color:var(--gray-700);cursor:pointer" onmouseenter="this.style.background=\'var(--gray-200)\'" onmouseleave="this.style.background=\'var(--gray-100)\'">' +
        '<i class="ti ti-upload" style="font-size:15px"></i>Import dari CSV<input type="file" accept=".csv" style="display:none" onchange="importCSV(this)"/></label>' +
      '<button class="btn btn-ghost" onclick="exportCSV()"><i class="ti ti-download"></i>Export ke CSV</button>' +
      '<button class="btn btn-ghost" onclick="exportCSVTemplate()"><i class="ti ti-file-download"></i>Template CSV</button>' +
    '</div>' +
    '<label style="display:flex;align-items:center;gap:7px;font-size:12px;color:var(--gray-600);cursor:pointer;margin-bottom:6px">' +
      '<input type="checkbox" id="chk-upsert"> ' +
      '<span><strong>Mode Update</strong> — jika nama sudah ada, data divisi & koordinatornya akan diperbarui (bukan dilewati)</span>' +
    '</label>' +
    '<div id="import-status" style="font-size:12px;margin-top:4px"></div>' +
    '</div>' +

    /* clear stale status on next tick */
    '<script>setTimeout(function(){var el=document.getElementById("import-status");if(el)el.textContent="";},50);<\/script>' +

    /* ---- FILTER ---- */
    '<div class="card" id="filter-card"><div class="card-head"><i class="ti ti-filter" style="color:var(--blue-600)"></i><h2>Filter & Pencarian</h2></div>' +
    '<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:10px" class="filter-grid">' +
      '<div class="field" style="margin:0"><label>Cari Nama / Email</label><input type="text" id="flt-q" placeholder="Ketik nama atau email..." oninput="applyFilter()"/></div>' +
      '<div class="field" style="margin:0"><label>Divisi</label><select id="flt-div" onchange="applyFilter()"><option value="">Semua Divisi</option>' + getDivisiList().map(function(d){return '<option>'+d+'</option>';}).join('') + '</select></div>' +
      '<div class="field" style="margin:0"><label>Koordinator</label><select id="flt-koor" onchange="applyFilter()"><option value="">Semua</option>' +
      getKoordinatorList().map(function(n){ return '<option>'+n+'</option>'; }).join('') +
      '</select></div>' +
      '<div class="field" style="margin:0"><label>Status</label><select id="flt-status" onchange="applyFilter()"><option value="">Semua Status</option><option value="hadir">Tepat Waktu</option><option value="terlambat">Terlambat</option><option value="belum">Belum Absen</option><option value="cabut">Hak Dicabut</option></select></div>' +
    '</div>' +
    '<div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn btn-ghost btn-sm" onclick="resetFilter()"><i class="ti ti-refresh"></i>Reset Filter</button></div>' +
    '</div>' +

    /* ---- DAFTAR KARYAWAN ---- */
    '<div class="card" id="karyawan-table-card"><div class="card-head" style="justify-content:space-between">' +
      '<div style="display:flex;align-items:center;gap:8px"><i class="ti ti-list"></i><h2>Daftar Karyawan (<span id="emp-count">' + emps.length + '</span>)</h2></div>' +
      '<div style="display:flex;align-items:center;gap:8px">' +
        '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--gray-600);cursor:pointer"><input type="checkbox" id="chk-all" onchange="toggleSelectAll(this)"> Pilih Semua</label>' +
        '<button class="btn btn-danger btn-sm" id="btn-hapus-terpilih" style="display:none" onclick="hapusTerpilih()"><i class="ti ti-trash"></i>Hapus Terpilih (<span id="sel-count">0</span>)</button>' +
        (emps.length ? '<button class="btn btn-danger btn-sm" onclick="hapusSemuaKaryawan()" style="background:#fff;color:var(--red);border:1px solid #fca5a5"><i class="ti ti-trash-x"></i>Hapus Semua (' + emps.length + ')</button>' : '') +
      '</div>' +
    '</div>' +
    '<div id="empty-filter" style="display:none;text-align:center;padding:24px;color:var(--gray-400);font-size:13px"><i class="ti ti-search" style="font-size:28px;display:block;margin-bottom:8px"></i>Tidak ada karyawan yang cocok dengan filter</div>' +
    '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">' +
    '<table class="data-table" id="emp-table" style="min-width:600px"><thead><tr>' +
      '<th style="width:32px"><input type="checkbox" id="chk-head" onchange="toggleSelectAll(this)"/></th>' +
      '<th>Nama</th><th>Divisi</th><th>Koordinator</th><th>Status</th><th>Pelanggaran</th><th>Aksi</th>' +
    '</tr></thead><tbody id="emp-tbody">' +
    emps.map(function(e) {
      return '<tr data-id="' + e.id + '" data-div="' + e.div + '" data-koor="' + e.koor + '" data-status="' + e.status + '" data-search="' + (e.name+' '+(e.div||'')).toLowerCase() + '">' +
        '<td><input type="checkbox" class="row-chk" onchange="updateSelCount()"/></td>' +
        '<td><div style="display:flex;align-items:center;gap:8px"><div class="av" style="background:' + e.bg + ';color:#fff;width:30px;height:30px;font-size:10px">' + e.inits + '</div>' +
        '<div style="font-weight:600">' + e.name + '</div></div></td>' +
        '<td>' + e.div + '</td><td>' + e.koor + '</td><td>' + statusBadge(e.status) + '</td>' +
        '<td style="text-align:center;font-weight:700;color:' + (e.pelanggaran>0?'var(--red)':'var(--green)') + '">' + e.pelanggaran + '</td>' +
        '<td style="display:flex;gap:6px;flex-wrap:wrap">' +
          '<button class="btn btn-ghost btn-sm" onclick="ubahStatusKaryawan(' + e.id + ')"><i class="ti ti-refresh"></i>Ubah Status</button>' +
          '<button class="btn btn-danger btn-sm" onclick="hapusKaryawan(' + e.id + ')"><i class="ti ti-trash"></i>Hapus</button>' +
        '</td></tr>';
    }).join('') +
    '</tbody></table></div></div>'
    );
  }

  if (id === 'rekap') {
    var thisMonth   = todayKey().slice(0,7);
    var bulanOptsRkp= getBulanOptionsList(12);

    // Ambil daftar koordinator unik dari karyawan
    var koorList = [];
    DB.employees.forEach(function(e){ if(e.koor && !koorList.includes(e.koor)) koorList.push(e.koor); });
    var divList  = [];
    DB.employees.forEach(function(e){ if(e.div  && !divList.includes(e.div))   divList.push(e.div); });

    return (
      '<div class="page-header"><h1>Rekap Absensi ' + rtBadge() + '</h1><p>Data kehadiran & kinerja karyawan — klik nama untuk lihat rincian harian, filter per bulan & divisi</p></div>' +

      // ---- FILTER & HAPUS DATA ----
      '<div class="card" id="rekap-filter-card">' +
        '<div class="card-head"><i class="ti ti-filter" style="color:var(--blue-600)"></i><h2>Filter & Kelola Data</h2></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:12px" class="filter-grid">' +
          '<div class="field" style="margin:0"><label>Bulan</label>' +
            '<select id="rkp-bulan" onchange="applyRekapFilter()">' +
              bulanOptsRkp.map(function(b){ return '<option value="'+b.key+'"'+(b.key===thisMonth?' selected':'')+'>'+b.label+'</option>'; }).join('') +
            '</select></div>' +
          '<div class="field" style="margin:0"><label>Koordinator</label>' +
            '<select id="rkp-koor" onchange="applyRekapFilter()">' +
              '<option value="">Semua Koordinator</option>' +
              koorList.map(function(k){return '<option>'+k+'</option>';}).join('') +
            '</select></div>' +
          '<div class="field" style="margin:0"><label>Divisi</label>' +
            '<select id="rkp-div" onchange="applyRekapFilter()">' +
              '<option value="">Semua Divisi</option>' +
              divList.map(function(d){return '<option>'+d+'</option>';}).join('') +
            '</select></div>' +
          '<div class="field" style="margin:0"><label>Status Karyawan</label>' +
            '<select id="rkp-status" onchange="applyRekapFilter()">' +
              '<option value="">Semua Status</option>' +
              '<option value="hadir">Tepat Waktu</option>' +
              '<option value="terlambat">Terlambat</option>' +
              '<option value="belum">Belum Absen</option>' +
              '<option value="cabut">Hak Dicabut</option>' +
            '</select></div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
          '<button class="btn btn-ghost btn-sm" onclick="resetRekapFilter()"><i class="ti ti-refresh"></i>Reset Filter</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="exportRekapCSV()"><i class="ti ti-download"></i>Export CSV</button>' +
          '<div style="flex:1"></div>' +
          '<button class="btn btn-danger btn-sm" onclick="hapusDataAbsensiFilter()"><i class="ti ti-trash"></i>Hapus Data Absensi (Bulan & Filter Aktif)</button>' +
        '</div>' +
      '</div>' +

      '<div id="rekap-content">' + buildRekapContent(thisMonth, '', '', '') + '</div>'
    );
  }

  if (id === 'performa') {
    var koorListPrf = [];
    DB.employees.forEach(function(e){ if (e.koor && !koorListPrf.includes(e.koor)) koorListPrf.push(e.koor); });
    var divListPrf  = [];
    DB.employees.forEach(function(e){ if (e.div  && !divListPrf.includes(e.div))   divListPrf.push(e.div); });
    var bulanOptsPrf = getBulanOptionsList(12);

    return (
      '<div class="page-header"><h1>Analisis Performa ' + rtBadge() + '</h1><p>Grafik & papan skor performa seluruh karyawan — dapat difilter per divisi, koordinator, dan bulan</p></div>' +

      '<div class="card">' +
        '<div class="card-head"><i class="ti ti-filter" style="color:var(--blue-600)"></i><h2>Filter</h2></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px" class="filter-grid">' +
          '<div class="field" style="margin:0"><label>Divisi</label>' +
            '<select id="prf-div" onchange="applyPerformaFilterHRD()">' +
              '<option value="">Semua Divisi</option>' +
              divListPrf.map(function(d){ return '<option>' + d + '</option>'; }).join('') +
            '</select></div>' +
          '<div class="field" style="margin:0"><label>Koordinator</label>' +
            '<select id="prf-koor" onchange="applyPerformaFilterHRD()">' +
              '<option value="">Semua Koordinator</option>' +
              koorListPrf.map(function(k){ return '<option>' + k + '</option>'; }).join('') +
            '</select></div>' +
          '<div class="field" style="margin:0"><label>Grafik</label>' +
            '<select id="prf-bulan" onchange="applyPerformaFilterHRD()">' +
              '<optgroup label="Rata-rata Bulanan">' +
                '<option value="range:3">3 Bulan Terakhir</option>' +
                '<option value="range:6" selected>6 Bulan Terakhir</option>' +
                '<option value="range:12">12 Bulan Terakhir</option>' +
              '</optgroup>' +
              '<optgroup label="Skor Harian per Bulan">' +
                bulanOptsPrf.map(function(b){ return '<option value="month:' + b.key + '">' + b.label + '</option>'; }).join('') +
              '</optgroup>' +
            '</select></div>' +
        '</div>' +
        '<div style="margin-top:10px"><button class="btn btn-ghost btn-sm" onclick="resetPerformaFilterHRD()"><i class="ti ti-refresh"></i>Reset Filter</button></div>' +
      '</div>' +

      '<div id="performa-hrd-content">' + buildPerformaHRDContent('', '', {type:'range', numMonths:6}) + '</div>'
    );
  }

  if (id === 'sanksi') return (
    '<div class="page-header"><h1>Sanksi & Pelanggaran ' + rtBadge() + '</h1><p>Kelola teguran dan sanksi karyawan</p></div>' +
    '<div class="card"><div class="card-head"><i class="ti ti-gavel" style="color:var(--red)"></i><h2>Berikan Sanksi Resmi</h2></div>' +
    '<div class="info-bar info-amber"><i class="ti ti-alert-triangle"></i>Sanksi akan tercatat permanen dalam sistem.</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px" class="sanksi-grid">' +
      '<div class="field" style="margin:0"><label>Pilih Karyawan</label><select id="h-emp">' + emps.map(function(e){ return '<option>' + e.name + '</option>'; }).join('') + '</select></div>' +
      '<div class="field" style="margin:0"><label>Jenis Sanksi</label><select id="h-jenis"><option value="lisan">Teguran Lisan</option><option value="tertulis">Teguran Tertulis</option><option value="cabut">Pencabutan Hak WFA</option></select></div>' +
    '</div>' +
    '<div class="field" style="margin-top:12px"><label>Tanggal</label><input type="date" id="h-tgl" value="' + todayKey() + '"/></div>' +
    '<div class="field"><label>Alasan Pelanggaran</label><textarea id="h-alasan" placeholder="Jelaskan pelanggaran secara detail..."></textarea></div>' +
    '<div style="display:flex;justify-content:flex-end;gap:8px">' +
      '<button class="btn btn-primary" onclick="kirimSanksiHRD()"><i class="ti ti-send"></i>Kirim Sanksi Resmi</button></div></div>' +

    '<div class="card" id="sanksi-filter-card">' +
      '<div class="card-head"><i class="ti ti-filter" style="color:var(--blue-600)"></i><h2>Filter Riwayat</h2></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px" class="filter-grid">' +
        '<div class="field" style="margin:0"><label>Karyawan</label><select id="sk-karyawan" onchange="applySanksiFilter()"><option value="">Semua Karyawan</option>' +
          emps.map(function(e){ return '<option>' + e.name + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="field" style="margin:0"><label>Jenis Sanksi</label><select id="sk-jenis" onchange="applySanksiFilter()"><option value="">Semua Jenis</option><option value="Teguran Lisan">Teguran Lisan</option><option value="Teguran Tertulis">Teguran Tertulis</option><option value="Pencabutan Hak WFA">Pencabutan Hak WFA</option></select></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn btn-ghost btn-sm" onclick="resetSanksiFilter()"><i class="ti ti-refresh"></i>Reset Filter</button></div>' +
    '</div>' +

    '<div class="card" id="sanksi-list-content">' + buildSanksiListContent('', '') + '</div>'
  );

// Konten "Riwayat Sanksi" — dipisah jadi fungsi supaya filter Karyawan/Jenis Sanksi bisa
// membangun ulang daftarnya tanpa reload seluruh halaman.
function buildSanksiListContent(karyawanF, jenisF) {
  var filtered = DB.sanctions.filter(function(s){
    if (karyawanF && s.to !== karyawanF) return false;
    if (jenisF    && s.jenis !== jenisF) return false;
    return true;
  });
  return '<div class="card-head"><i class="ti ti-history"></i><h2>Riwayat Sanksi (' + filtered.length + ')</h2></div>' +
    (filtered.length
      ? filtered.map(function(s) {
          var isRed = s.jenis.includes('tertulis')||s.jenis.includes('Pencabutan');
          return '<div class="v-card ' + (isRed?'v-red':'v-amber') + '">' +
            '<div class="v-date">' + s.date + ' · ' + s.from + ' → ' + s.to + '</div>' +
            '<div class="v-text">' + s.alasan + '</div>' +
            '<span class="badge ' + (isRed?'badge-red':'badge-amber') + '" style="margin-top:6px">' + s.jenis + '</span></div>';
        }).join('')
      : '<div style="text-align:center;padding:24px;color:var(--gray-400);font-size:13px"><i class="ti ti-search" style="font-size:28px;display:block;margin-bottom:8px"></i>Tidak ada sanksi yang cocok dengan filter</div>'
    );
}

  if (id === 'akun') {
    var roleLabel = {hrd:'HRD',koor:'Koordinator',kary:'Karyawan'};
    var roleColor = {hrd:'var(--blue-600)',koor:'var(--amber)',kary:'var(--green)'};
    var userList  = Object.entries(USERS);
    return (
      '<div class="page-header"><h1>Manajemen Akun</h1><p>Kelola password dan hak akses pengguna sistem</p></div>' +

      /* ---- TAMBAH AKUN BARU (HRD/KOOR) ---- */
      '<div class="card"><div class="card-head"><i class="ti ti-user-plus" style="color:var(--green)"></i><h2>Tambah Akun Baru</h2></div>' +
      '<div class="info-bar info-blue" style="margin-bottom:12px"><i class="ti ti-info-circle"></i>Akun koordinator & HRD ditambah di sini. Akun karyawan dibuat otomatis saat tambah karyawan di menu Data Karyawan.</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">' +
        '<div class="field" style="margin:0"><label>Nama Lengkap</label><input type="text" id="au-nama" placeholder="Nama pengguna"/></div>' +
        '<div class="field" style="margin:0"><label>Password</label><input type="password" id="au-pass" placeholder="Min. 6 karakter"/></div>' +
        '<div class="field" style="margin:0"><label>Role / Hak Akses</label>' +
          '<select id="au-role"><option value="koor">Koordinator</option><option value="hrd">HRD</option></select>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:12px">' +
        '<button class="btn btn-primary" onclick="tambahAkun()"><i class="ti ti-plus"></i>Tambah Akun</button>' +
      '</div></div>' +

      /* ---- TAMBAH AKUN KARYAWAN MANDIRI (SETUP SENDIRI) ---- */
      '<div class="card"><div class="card-head"><i class="ti ti-user-cog" style="color:var(--amber)"></i><h2>Tambah Akun Karyawan (Isi Profil Mandiri)</h2></div>' +
      '<div class="info-bar info-amber" style="margin-bottom:12px"><i class="ti ti-alert-triangle"></i>Cukup buat <strong>Email/Username</strong> & <strong>Password awal</strong>. Karyawan akan diminta melengkapi <strong>Nama, Divisi, Koordinator</strong>, dan boleh mengganti password saat pertama kali login. Password awal tetap tersimpan & terlihat oleh HRD sebagai cadangan jika karyawan lupa.</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div class="field" style="margin:0"><label>Email / Username Login</label><input type="text" id="pe-email" placeholder="contoh: budi123@luziegroup.id"/></div>' +
        '<div class="field" style="margin:0"><label>Password Awal</label>' +
          '<div style="position:relative">' +
            '<input type="password" id="pe-pass" placeholder="Min. 6 karakter" style="padding-right:38px"/>' +
            '<button type="button" onclick="togglePassFieldGeneric(\'pe-pass\',\'pe-pass-eye\')" tabindex="-1" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--gray-400);cursor:pointer;padding:4px;display:flex;align-items:center"><i class="ti ti-eye" id="pe-pass-eye" style="font-size:15px"></i></button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:12px">' +
        '<button class="btn btn-primary" onclick="tambahAkunKaryawanMandiri()"><i class="ti ti-plus"></i>Buat Akun</button>' +
      '</div></div>' +

      /* ---- IMPORT / EXPORT AKUN KARYAWAN MANDIRI ---- */
      '<div class="card"><div class="card-head"><i class="ti ti-file-spreadsheet" style="color:var(--blue-600)"></i><h2>Import & Export Akun Karyawan</h2></div>' +
      '<div class="info-bar info-blue" style="margin-bottom:14px"><i class="ti ti-info-circle"></i>Format CSV import: <strong>nama,email,password,role</strong>. Kolom <strong>email</strong> boleh dikosongkan (dibuat otomatis dari nama). Kolom <strong>password</strong> kosong = default "123456". Role: <strong>kary</strong> / <strong>koor</strong> / <strong>hrd</strong>. Karyawan (role=kary) akan diminta melengkapi Divisi, Koordinator, dan boleh ganti password saat login pertama.</div>' +
      '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--gray-600);cursor:pointer;margin-bottom:10px"><input type="checkbox" id="chk-akun-upsert"> <strong>Mode Update</strong> — jika email sudah ada, perbarui nama & password (bukan dilewati)</label>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px" class="import-btns">' +
        '<label style="display:inline-flex;align-items:center;gap:7px;padding:10px 18px;background:var(--gray-100);border:1px solid var(--gray-200);border-radius:var(--radius);font-size:13px;font-weight:600;color:var(--gray-700);cursor:pointer" onmouseenter="this.style.background=\'var(--gray-200)\'" onmouseleave="this.style.background=\'var(--gray-100)\'">' +
          '<i class="ti ti-upload" style="font-size:15px"></i>Import dari CSV<input type="file" accept=".csv" style="display:none" onchange="importAkunCSV(this)"/></label>' +
        '<button class="btn btn-ghost" onclick="exportAkunCSV()"><i class="ti ti-download"></i>Export Daftar Akun</button>' +
        '<button class="btn btn-ghost" onclick="exportAkunCSVTemplate()"><i class="ti ti-file-download"></i>Template CSV</button>' +
      '</div>' +
      '<div id="import-akun-status" style="font-size:12px;margin-top:4px"></div>' +
      '</div>' +

      /* clear stale status on next tick */
      '<script>setTimeout(function(){var el=document.getElementById("import-akun-status");if(el)el.textContent="";},50);<\/script>' +

      /* ---- FILTER ---- */
      '<div class="card" id="akun-filter-card"><div class="card-head"><i class="ti ti-filter" style="color:var(--blue-600)"></i><h2>Filter & Pencarian</h2></div>' +
      '<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px" class="filter-grid">' +
        '<div class="field" style="margin:0"><label>Cari Nama / Email</label><input type="text" id="akf-q" placeholder="Ketik nama atau email..." oninput="applyAkunFilter()"/></div>' +
        '<div class="field" style="margin:0"><label>Role</label><select id="akf-role" onchange="applyAkunFilter()"><option value="">Semua Role</option><option value="hrd">HRD</option><option value="koor">Koordinator</option><option value="kary">Karyawan</option></select></div>' +
        '<div class="field" style="margin:0"><label>Status</label><select id="akf-status" onchange="applyAkunFilter()"><option value="">Semua Status</option><option value="lengkap">Lengkap</option><option value="belum">Belum Lengkap</option></select></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn btn-ghost btn-sm" onclick="resetAkunFilter()"><i class="ti ti-refresh"></i>Reset Filter</button></div>' +
      '</div>' +

      /* ---- DAFTAR AKUN ---- */
      '<div class="card"><div class="card-head"><i class="ti ti-shield-check" style="color:var(--blue-600)"></i><h2>Daftar Akun (<span id="akun-count">' + userList.length + '</span>)</h2></div>' +
      '<div id="akun-empty-filter" style="display:none;text-align:center;padding:24px;color:var(--gray-400);font-size:13px"><i class="ti ti-search" style="font-size:28px;display:block;margin-bottom:8px"></i>Tidak ada akun yang cocok dengan filter</div>' +
      '<table class="data-table" id="akun-table"><thead><tr><th>Pengguna</th><th>Role & Password</th><th>Aksi</th></tr></thead><tbody id="akun-tbody">' +
      userList.map(function(entry) {
        var em = entry[0], u = entry[1];
        var safeId = em.replace(/[@.]/g,'_');
        var belumLengkap = (u.setupDone === false);
        var roleRows = u.roles.map(function(r, ri) {
          return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
            '<span class="badge" style="background:' + (roleColor[r.role]||'var(--gray-300)') + '20;color:' + (roleColor[r.role]||'var(--gray-500)') + ';min-width:80px;justify-content:center">' + (roleLabel[r.role]||r.role) + '</span>' +
            '<input type="password" value="' + r.pass + '" id="pass-' + safeId + '-' + ri + '" style="width:140px;padding:5px 8px;border:1px solid var(--gray-200);border-radius:var(--radius);font-size:12px"/>' +
            '<button onclick="lihatPass(\'pass-' + safeId + '-' + ri + '\')" style="padding:5px 8px;background:var(--gray-100);border:1px solid var(--gray-200);border-radius:var(--radius);cursor:pointer;font-size:11px"><i class="ti ti-eye"></i></button>' +
            '<button onclick="simpanPass(\'' + em + '\',' + ri + ',\'pass-' + safeId + '-' + ri + '\')" style="padding:5px 8px;background:var(--blue-600);color:#fff;border:none;border-radius:var(--radius);cursor:pointer;font-size:11px"><i class="ti ti-device-floppy"></i> Simpan</button>' +
            (u.roles.length > 1 ? '<button onclick="hapusRole(\'' + em + '\',' + ri + ')" style="padding:5px 8px;background:var(--red-light);color:var(--red);border:1px solid #fca5a5;border-radius:var(--radius);cursor:pointer;font-size:11px"><i class="ti ti-x"></i></button>' : '') +
          '</div>';
        }).join('');
        var rolesStr = u.roles.map(function(r){return r.role;}).join(',');
        var searchStr = ((u.name||'') + ' ' + em).toLowerCase();
        return '<tr data-search="' + searchStr.replace(/"/g,'&quot;') + '" data-roles="' + rolesStr + '" data-status="' + (belumLengkap?'belum':'lengkap') + '">' +
          '<td><div style="display:flex;align-items:center;gap:8px">' +
            '<div class="av" style="background:' + u.avBg + ';color:' + u.avColor + ';width:30px;height:30px;font-size:11px">' + u.initials + '</div>' +
            '<div><div style="font-weight:600">' + (u.name || em) + (belumLengkap ? ' <span class="badge badge-amber" style="margin-left:6px"><i class="ti ti-clock-pause"></i>Belum Lengkap</span>' : '') + '</div>' +
            '<div style="font-size:11px;color:var(--gray-400)">' + (u.roles.map(function(r){return roleLabel[r.role]||r.role;}).join(' · ')) + (belumLengkap ? ' · ' + em : '') + '</div>' +
            '</div></div></td>' +
          '<td>' + roleRows +
            '<button onclick="tambahRoleAkun(\'' + em + '\')" style="margin-top:4px;display:inline-flex;align-items:center;gap:5px;padding:5px 10px;background:var(--gray-50);border:1px dashed var(--gray-300);border-radius:var(--radius);font-size:11px;color:var(--gray-500);cursor:pointer"><i class="ti ti-plus"></i>Tambah Role</button>' +
          '</td>' +
          '<td><button class="btn btn-danger btn-sm" onclick="hapusAkun(\'' + em + '\')"><i class="ti ti-trash"></i>Hapus</button></td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>'
    );
  }

  if (id === 'laporan') {
    return '<div id="laporan-hrd-content">' + buildLaporanHRDContent(todayKey().slice(0,7)) + '</div>';
  }

// Konten halaman Laporan (HRD) — dipisah jadi fungsi supaya bisa dibangun ULANG saat filter
// bulan berubah (lihat applyLaporanFilterHRD di 17-filter-select-hapus.js), tanpa reset ke
// halaman awal seperti showPage().
function buildLaporanHRDContent(bulanKey) {
    var isHRD  = true;
    var isKoor = false;
    var targetEmps = DB.employees;

    var thisMonth  = bulanKey;
    var bulanLabel = new Date(bulanKey + '-01').toLocaleDateString('id-ID',{month:'long',year:'numeric'});
    var isBulanIni = (bulanKey === todayKey().slice(0,7));
    var bulanOptsLap = getBulanOptionsList(12);

    // Hitung statistik per karyawan
    var empStats = targetEmps.map(function(emp) {
      var encEm  = emp.email.replace(/[.#$\[\]]/g,'_');
      var keys   = Object.keys(DB.attendance).filter(function(k){ return k.startsWith(encEm+'_') && k.indexOf(thisMonth)>=0; });
      var hadir=0, terlambat=0, tidakLengkap=0, skorArr=[];
      keys.forEach(function(k){
        var r = DB.attendance[k];
        if (r.pagi && r.siang) {
          if (r.status==='terlambat') terlambat++;
          else hadir++;
        } else if (r.pagi || r.siang) {
          tidakLengkap++;
        }
        if (r.skor!=null) skorArr.push(Number(r.skor));
      });
      var avg = skorArr.length ? Math.round(skorArr.reduce(function(a,b){return a+b;},0)/skorArr.length) : null;
      return { emp:emp, hadir:hadir, terlambat:terlambat, tidakLengkap:tidakLengkap, avgSkor:avg, totalAbsen:keys.length };
    });

    // Summary total
    var totalKary   = targetEmps.length;
    // BUGFIX: sama seperti dashboard — baca status absen hari ini dari DB.attendance
    var todayL = todayKey();
    var hadirHariIni = 0, blmAbsen = 0, cabut = 0;
    targetEmps.forEach(function(e) {
      if (e.status === 'cabut') { cabut++; return; }
      var r = DB.attendance[attendKeyFor(e.email, todayL)] || {};
      if (r.status === 'hadir' || r.status === 'terlambat') hadirHariIni++;
      else blmAbsen++;
    });

    // Hitung rekap to-do per karyawan
    var todoStats = targetEmps.map(function(emp) {
      var encEm = emp.email.replace(/[.#$\[\]]/g,'_');
      var keys  = Object.keys(DB.todos).filter(function(k){ return k.startsWith(encEm+'_') && k.indexOf(thisMonth)>=0; });
      var totalTugas=0, sudahSkor=0, avgTodoSkor=null, skorArr=[];
      keys.forEach(function(k){
        var list = (DB.todos[k]||[]).filter(function(t){ return t.task&&t.task.trim(); });
        totalTugas += list.length;
        list.forEach(function(t){
          var s = t.koreksi_skor !== null && t.koreksi_skor !== undefined ? t.koreksi_skor : t.score;
          if (s !== null && s !== undefined){ sudahSkor++; skorArr.push(Number(s)); }
        });
      });
      avgTodoSkor = skorArr.length ? Math.round(skorArr.reduce(function(a,b){return a+b;},0)/skorArr.length) : null;
      return { emp:emp, totalTugas:totalTugas, sudahSkor:sudahSkor, avgTodoSkor:avgTodoSkor, hariIsiTodo:keys.length };
    });

    // Hitung rekap absen hari ini per karyawan (status real-time)
    var statusHariIni = targetEmps.map(function(emp) {
      if (emp.status === 'cabut') return { emp:emp, status:'cabut', pagi:'—', siang:'—' };
      var rec = DB.attendance[attendKeyFor(emp.email, todayL)] || {};
      return { emp:emp, status:rec.status||'belum', pagi:rec.pagi||'—', siang:rec.siang||'—' };
    });

    // Kalkulasi summary
    var allSkorLaporan   = empStats.filter(function(s){return s.avgSkor!=null;}).map(function(s){return s.avgSkor;});
    var avgAllLaporan    = allSkorLaporan.length ? Math.round(allSkorLaporan.reduce(function(a,b){return a+b;},0)/allSkorLaporan.length) : null;
    var totalTerlambatBulan = empStats.reduce(function(a,s){return a+s.terlambat;},0);
    var totalHadirBulan     = empStats.reduce(function(a,s){return a+s.hadir;},0);
    var totalTugas       = todoStats.reduce(function(a,s){return a+s.totalTugas;},0);
    var totalSkorTugas   = todoStats.reduce(function(a,s){return a+s.sudahSkor;},0);

    // Tanggal hari ini untuk header
    var tglHariIni = (function(){
      var d = new Date();
      var hariNama = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][d.getDay()];
      var bulanNama = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][d.getMonth()];
      return hariNama + ', ' + d.getDate() + ' ' + bulanNama + ' ' + d.getFullYear();
    })();

    return (
      /* ===== HEADER ===== */
      '<div class="page-header">' +
        '<h1>Laporan ' + (isKoor?'Tim':'Kehadiran & To-Do') + ' ' + rtBadge() + '</h1>' +
        '<p>' + bulanLabel + (isKoor?' &nbsp;·&nbsp; Tim <strong>'+currentUser.name+'</strong>':'') + ' &nbsp;·&nbsp; <span style="color:var(--blue-600);font-weight:600">' + tglHariIni + '</span></p>' +
      '</div>' +

      /* ===== FILTER BULAN ===== */
      '<div class="card" id="laporan-filter-card">' +
        '<div class="card-head"><i class="ti ti-filter" style="color:var(--blue-600)"></i><h2>Filter Laporan</h2></div>' +
        '<div style="display:grid;grid-template-columns:1fr;max-width:260px;gap:10px">' +
          '<div class="field" style="margin:0"><label>Bulan</label>' +
            '<select id="lap-bulan" onchange="applyLaporanFilterHRD()">' +
              bulanOptsLap.map(function(b){ return '<option value="'+b.key+'"'+(b.key===bulanKey?' selected':'')+'>'+b.label+'</option>'; }).join('') +
            '</select></div>' +
        '</div>' +
        (isBulanIni ? '' : '<div class="info-bar info-amber" style="margin-top:10px"><i class="ti ti-alert-triangle"></i>Anda melihat laporan bulan ' + bulanLabel + '. Panel bertanda "Live/Hari Ini" tetap menampilkan status HARI INI (real-time), terlepas dari bulan yang dipilih di sini.</div>') +
      '</div>' +

      /* ===== SUMMARY CARDS ===== */
      '<div class="metrics" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">' +
        '<div class="metric-box blue-card"><div class="mb-label">' + (isKoor?'Anggota Tim':'Total Karyawan') + '</div><div class="mb-val">' + totalKary + '</div></div>' +
        '<div class="metric-box">' +
          '<div class="mb-label">Hadir Hari Ini</div>' +
          '<div class="mb-val" style="color:var(--green)">' + hadirHariIni + '</div>' +
          '<div class="mb-sub" style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--green);animation:blink 1.5s infinite"></span>Live</div>' +
        '</div>' +
        '<div class="metric-box"><div class="mb-label">Belum Absen</div><div class="mb-val" style="color:var(--amber)">' + blmAbsen + '</div></div>' +
        '<div class="metric-box"><div class="mb-label">Hak Dicabut</div><div class="mb-val" style="color:var(--red)">' + cabut + '</div></div>' +
        '<div class="metric-box"><div class="mb-label">Avg Skor Tim</div><div class="mb-val" style="color:var(--blue-500)">' + (avgAllLaporan||'—') + '</div><div class="mb-sub">bulan ini</div></div>' +
        '<div class="metric-box"><div class="mb-label">Total Hadir Bulan</div><div class="mb-val" style="color:var(--green)">' + totalHadirBulan + '</div><div class="mb-sub">hari·orang</div></div>' +
      '</div>' +

      /* ===== TAB NAVIGATION ===== */
      '<div style="display:flex;gap:4px;margin-bottom:16px;background:var(--gray-100);border-radius:var(--radius-lg);padding:4px;width:fit-content">' +
        '<button id="tab-absen-btn" onclick="laporanSwitchTab(\'absen\')" style="padding:8px 18px;border:none;border-radius:var(--radius);font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font);background:var(--white);color:var(--blue-700);box-shadow:0 1px 4px rgba(0,0,0,.1)"><i class="ti ti-calendar-stats" style="margin-right:5px"></i>Rekap Absen</button>' +
        '<button id="tab-todo-btn" onclick="laporanSwitchTab(\'todo\')" style="padding:8px 18px;border:none;border-radius:var(--radius);font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font);background:transparent;color:var(--gray-500)"><i class="ti ti-checkbox" style="margin-right:5px"></i>Rekap To-Do</button>' +
      '</div>' +

      /* ===== PANEL ABSEN ===== */
      '<div id="panel-absen">' +

        /* Status Hari Ini */
        '<div class="card">' +
          '<div class="card-head">' +
            '<i class="ti ti-clock-check" style="color:var(--blue-600)"></i>' +
            '<h2>Status Absen Hari Ini</h2>' +
            '<span class="realtime-badge" style="margin-left:8px"><i class="ti ti-circle-filled"></i>Live</span>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px">' +
          statusHariIni.map(function(s) {
            var colorMap = {hadir:'var(--green)',terlambat:'var(--amber)',belum:'var(--gray-400)',cabut:'var(--red)'};
            var bgMap    = {hadir:'var(--green-light)',terlambat:'var(--amber-light)',belum:'var(--gray-50)',cabut:'var(--red-light)'};
            var iconMap  = {hadir:'ti-check-circle',terlambat:'ti-clock-x',belum:'ti-clock-pause',cabut:'ti-ban'};
            var c = colorMap[s.status]||'var(--gray-400)';
            var bg = bgMap[s.status]||'var(--gray-50)';
            return '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:var(--radius-lg);background:' + bg + ';border:1px solid ' + c + '30">' +
              '<div class="av" style="background:' + s.emp.bg + ';color:#fff;width:36px;height:36px;font-size:12px;flex-shrink:0">' + s.emp.inits + '</div>' +
              '<div style="flex:1;min-width:0">' +
                '<div style="font-size:13px;font-weight:700;color:var(--gray-800);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + s.emp.name + '</div>' +
                '<div style="font-size:11px;color:var(--gray-500);margin-top:2px">Pagi: <strong>' + s.pagi + '</strong> &nbsp;|&nbsp; Siang: <strong>' + s.siang + '</strong></div>' +
              '</div>' +
              '<div style="text-align:right;flex-shrink:0">' +
                '<i class="ti ' + (iconMap[s.status]||'ti-minus') + '" style="font-size:18px;color:' + c + '"></i>' +
              '</div>' +
            '</div>';
          }).join('') +
          '</div>' +
        '</div>' +

        /* Distribusi Status Visual */
        '<div class="card">' +
          '<div class="card-head"><i class="ti ti-chart-bar" style="color:var(--blue-600)"></i><h2>Distribusi Kehadiran Hari Ini</h2></div>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">' +
          (function(){
            var dist = [
              {label:'Tepat Waktu', count:hadirHariIni, color:'var(--green)', icon:'ti-check'},
              {label:'Terlambat',   count:targetEmps.filter(function(e){ var r=DB.attendance[attendKeyFor(e.email,todayL)]||{}; return r.status==='terlambat'; }).length, color:'var(--amber)', icon:'ti-clock'},
              {label:'Belum Absen', count:blmAbsen,    color:'var(--gray-400)', icon:'ti-clock-pause'},
              {label:'Hak Dicabut', count:cabut,        color:'var(--red)', icon:'ti-ban'},
            ];
            var maxCount = Math.max.apply(null, dist.map(function(d){return d.count;})) || 1;
            return dist.map(function(d){
              var pct = totalKary ? Math.round(d.count/totalKary*100) : 0;
              var barW = Math.round(d.count/maxCount*100);
              return '<div style="flex:1;min-width:120px;padding:14px 16px;border-radius:var(--radius-lg);background:var(--gray-50);border:1px solid var(--gray-200)">' +
                '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">' +
                  '<i class="ti ' + d.icon + '" style="font-size:14px;color:' + d.color + '"></i>' +
                  '<span style="font-size:11px;font-weight:600;color:var(--gray-600);text-transform:uppercase;letter-spacing:.4px">' + d.label + '</span>' +
                '</div>' +
                '<div style="font-size:28px;font-weight:800;color:' + d.color + ';line-height:1">' + d.count + '</div>' +
                '<div style="height:5px;border-radius:99px;background:var(--gray-200);margin-top:10px">' +
                  '<div style="height:100%;width:' + barW + '%;border-radius:99px;background:' + d.color + ';transition:width .6s ease"></div>' +
                '</div>' +
                '<div style="font-size:10px;color:var(--gray-400);margin-top:4px">' + pct + '% dari total</div>' +
              '</div>';
            }).join('');
          })() +
          '</div>' +
        '</div>' +

        /* Rekap Bulanan Tabel */
        '<div class="card">' +
          '<div class="card-head">' +
            '<i class="ti ti-table" style="color:var(--blue-600)"></i>' +
            '<h2>Rekap Kehadiran — ' + bulanLabel + '</h2>' +
            '<button class="btn btn-ghost btn-sm card-action" onclick="exportLaporan()"><i class="ti ti-download"></i>Export CSV</button>' +
          '</div>' +
          '<div style="overflow-x:auto"><table class="data-table" style="min-width:640px"><thead><tr>' +
            '<th>Nama</th><th>' + (isHRD?'Divisi':'Divisi') + '</th><th style="text-align:center">Hadir</th><th style="text-align:center">Terlambat</th><th style="text-align:center">Tdk Lengkap</th><th style="text-align:center">Avg Skor</th><th>Status</th>' +
          '</tr></thead><tbody>' +
          empStats.map(function(s) {
            var e = s.emp;
            var skorColor = s.avgSkor>=80?'var(--green)':s.avgSkor>=60?'var(--amber)':s.avgSkor?'var(--red)':'var(--gray-400)';
            var totalAbsenBulan = s.hadir + s.terlambat + s.tidakLengkap;
            return '<tr>' +
              '<td><div style="display:flex;align-items:center;gap:8px">' +
                '<div class="av" style="background:' + e.bg + ';color:#fff;width:30px;height:30px;font-size:10px">' + e.inits + '</div>' +
                '<div><div style="font-weight:600;font-size:13px">' + e.name + '</div>' +
                '<div style="font-size:10px;color:var(--gray-400)">' + (e.koor||'') + '</div></div>' +
              '</div></td>' +
              '<td style="color:var(--gray-500);font-size:12px">' + (e.div||'—') + '</td>' +
              '<td style="text-align:center">' +
                '<span style="display:inline-flex;align-items:center;gap:3px;font-weight:700;color:var(--green)">' +
                  '<i class="ti ti-check" style="font-size:12px"></i>' + s.hadir +
                '</span></td>' +
              '<td style="text-align:center">' +
                '<span style="display:inline-flex;align-items:center;gap:3px;font-weight:700;color:var(--amber)">' +
                  '<i class="ti ti-clock" style="font-size:12px"></i>' + s.terlambat +
                '</span></td>' +
              '<td style="text-align:center">' +
                '<span style="font-weight:600;color:var(--blue-500)">' + s.tidakLengkap + '</span>' +
              '</td>' +
              '<td style="text-align:center">' +
                (s.avgSkor !== null
                  ? '<div style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;border:2.5px solid ' + skorColor + ';font-weight:700;font-size:13px;color:' + skorColor + '">' + s.avgSkor + '</div>'
                  : '<span style="color:var(--gray-400)">—</span>') +
              '</td>' +
              '<td>' + statusBadge(e.status) + '</td>' +
            '</tr>';
          }).join('') +
          '</tbody></table></div>' +
        '</div>' +

      '</div>' + /* end panel-absen */

      /* ===== PANEL TODO ===== */
      '<div id="panel-todo" style="display:none">' +

        /* Summary To-Do */
        '<div class="metrics" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:16px">' +
          '<div class="metric-box blue-card"><div class="mb-label">Total Tugas Bulan Ini</div><div class="mb-val">' + totalTugas + '</div><div class="mb-sub">seluruh tim</div></div>' +
          '<div class="metric-box"><div class="mb-label">Tugas Sudah Dinilai</div><div class="mb-val" style="color:var(--green)">' + totalSkorTugas + '</div></div>' +
          '<div class="metric-box"><div class="mb-label">Belum Dinilai</div><div class="mb-val" style="color:var(--amber)">' + (totalTugas-totalSkorTugas) + '</div></div>' +
          (function(){
            var allTdSkor = todoStats.filter(function(s){return s.avgTodoSkor!=null;}).map(function(s){return s.avgTodoSkor;});
            var avgTd = allTdSkor.length ? Math.round(allTdSkor.reduce(function(a,b){return a+b;},0)/allTdSkor.length) : null;
            var c = avgTd>=80?'var(--green)':avgTd>=60?'var(--amber)':avgTd?'var(--red)':'var(--gray-400)';
            return '<div class="metric-box"><div class="mb-label">Avg Skor To-Do Tim</div><div class="mb-val" style="color:' + c + '">' + (avgTd||'—') + '</div><div class="mb-sub">bulan ini</div></div>';
          })() +
        '</div>' +

        /* Tabel Rekap To-Do */
        '<div class="card">' +
          '<div class="card-head"><i class="ti ti-list-check" style="color:var(--blue-600)"></i><h2>Rekap To-Do List Per Anggota</h2></div>' +
          '<div style="overflow-x:auto"><table class="data-table" style="min-width:600px"><thead><tr>' +
            '<th>Nama</th><th style="text-align:center">Hari Isi</th><th style="text-align:center">Total Tugas</th><th style="text-align:center">Dinilai</th><th style="text-align:center">Avg Skor</th><th>Progress</th>' +
          '</tr></thead><tbody>' +
          todoStats.map(function(s) {
            var e = s.emp;
            var c = s.avgTodoSkor>=80?'var(--green)':s.avgTodoSkor>=60?'var(--amber)':s.avgTodoSkor?'var(--red)':'var(--gray-400)';
            var pct = s.totalTugas ? Math.round(s.sudahSkor/s.totalTugas*100) : 0;
            var barColor = pct>=80?'var(--green)':pct>=50?'var(--amber)':'var(--red)';
            return '<tr>' +
              '<td><div style="display:flex;align-items:center;gap:8px">' +
                '<div class="av" style="background:' + e.bg + ';color:#fff;width:30px;height:30px;font-size:10px">' + e.inits + '</div>' +
                '<div><div style="font-weight:600;font-size:13px">' + e.name + '</div>' +
                '<div style="font-size:10px;color:var(--gray-400)">' + (e.div||'') + '</div></div>' +
              '</div></td>' +
              '<td style="text-align:center;font-weight:600;color:var(--blue-600)">' + s.hariIsiTodo + '</td>' +
              '<td style="text-align:center;font-weight:700">' + s.totalTugas + '</td>' +
              '<td style="text-align:center">' +
                '<span style="font-weight:600;color:var(--green)">' + s.sudahSkor + '</span>' +
                '<span style="color:var(--gray-300)"> / </span>' +
                '<span style="color:var(--gray-500)">' + s.totalTugas + '</span>' +
              '</td>' +
              '<td style="text-align:center">' +
                (s.avgTodoSkor !== null
                  ? '<div style="display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;border:2.5px solid ' + c + ';font-weight:800;font-size:13px;color:' + c + '">' + s.avgTodoSkor + '</div>'
                  : '<span style="color:var(--gray-400);font-size:12px">Belum ada</span>') +
              '</td>' +
              '<td style="min-width:100px">' +
                '<div style="display:flex;align-items:center;gap:8px">' +
                  '<div style="flex:1;height:8px;border-radius:99px;background:var(--gray-200)">' +
                    '<div style="height:100%;width:' + pct + '%;border-radius:99px;background:' + barColor + ';transition:width .6s ease"></div>' +
                  '</div>' +
                  '<span style="font-size:11px;font-weight:600;color:' + barColor + ';min-width:32px">' + pct + '%</span>' +
                '</div>' +
              '</td>' +
            '</tr>';
          }).join('') +
          '</tbody></table></div>' +
        '</div>' +

        /* Kartu To-Do Hari Ini per anggota */
        '<div class="card"><div class="card-head"><i class="ti ti-calendar-check" style="color:var(--blue-600)"></i><h2>To-Do Hari Ini</h2><span class="realtime-badge" style="margin-left:8px"><i class="ti ti-circle-filled"></i>Live</span></div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">' +
        targetEmps.map(function(emp) {
          var tkKey = attendKeyFor(emp.email, todayL);
          var todos = (DB.todos[tkKey]||[]).filter(function(t){ return t.task&&t.task.trim(); });
          var doneTodos = todos.filter(function(t){ var s=t.koreksi_skor!==null&&t.koreksi_skor!==undefined?t.koreksi_skor:t.score; return s!==null&&s!==undefined; });
          var statusC = todos.length===0?'var(--gray-300)':doneTodos.length===todos.length?'var(--green)':'var(--amber)';
          return '<div style="border:1px solid var(--gray-200);border-radius:var(--radius-lg);padding:14px;background:var(--white)">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
              '<div class="av" style="background:' + emp.bg + ';color:#fff;width:32px;height:32px;font-size:11px;flex-shrink:0">' + emp.inits + '</div>' +
              '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + emp.name + '</div>' +
              '<div style="font-size:10px;color:var(--gray-400)">' + (emp.div||'') + '</div></div>' +
              '<span style="font-size:11px;font-weight:600;color:' + statusC + '">' + doneTodos.length + '/' + todos.length + ' dinilai</span>' +
            '</div>' +
            (todos.length === 0
              ? '<div style="text-align:center;padding:14px 0;color:var(--gray-300);font-size:12px"><i class="ti ti-clipboard-x" style="font-size:20px;display:block;margin-bottom:4px"></i>Belum mengisi to-do</div>'
              : '<div style="display:flex;flex-direction:column;gap:5px">' +
                todos.map(function(t) {
                  var s = t.koreksi_skor!==null&&t.koreksi_skor!==undefined?t.koreksi_skor:t.score;
                  var hasScore = s!==null&&s!==undefined;
                  var sc = hasScore?(s>=80?'var(--green)':s>=60?'var(--amber)':'var(--red)'):'var(--gray-300)';
                  return '<div style="display:flex;align-items:center;gap:7px;padding:6px 8px;background:var(--gray-50);border-radius:7px">' +
                    '<i class="ti ' + (hasScore?'ti-check-circle':'ti-circle') + '" style="font-size:13px;color:' + sc + ';flex-shrink:0"></i>' +
                    '<div style="flex:1;font-size:12px;color:var(--gray-700);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + t.task + '</div>' +
                    (hasScore ? '<span style="font-weight:700;font-size:12px;color:' + sc + ';flex-shrink:0">' + s + '</span>' : '<span style="font-size:10px;color:var(--gray-300);flex-shrink:0">—</span>') +
                  '</div>';
                }).join('') +
              '</div>') +
          '</div>';
        }).join('') +
        '</div></div>' +

      '</div>' + /* end panel-todo */

      (DB.settings.archiveSheetUrl ?
        '<div class="card" style="background:var(--blue-50);border:1px solid var(--blue-200)">' +
          '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
            '<i class="ti ti-archive" style="font-size:20px;color:var(--blue-600)"></i>' +
            '<div style="flex:1;min-width:200px"><div style="font-weight:700;font-size:13px">Arsip Data Lama</div><div style="font-size:12px;color:var(--gray-500)">Riwayat absen & to-do bulan-bulan sebelumnya yang sudah dipindahkan dari Firebase</div></div>' +
            '<a href="' + DB.settings.archiveSheetUrl + '" target="_blank" class="btn btn-ghost btn-sm"><i class="ti ti-external-link"></i>Buka di Google Sheets</a>' +
          '</div></div>'
      : '')
    );
  }

  if (id === 'pengaturan') return (
    '<div class="page-header"><h1>Pengaturan Sistem</h1><p>Konfigurasi aturan WFA perusahaan</p></div>' +
    '<div class="card"><div class="card-head"><i class="ti ti-clock" style="color:var(--blue-600)"></i><h2>Aturan Waktu Absensi</h2></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px" class="pengaturan-grid">' +
      '<div class="field" style="margin:0"><label>Batas jam absen pagi</label><input type="time" id="cfg-batasPagi" value="' + DB.settings.batasPagi + '"/></div>' +
      '<div class="field" style="margin:0"><label>Jam absen siang mulai</label><input type="time" id="cfg-mulaiSiang" value="' + DB.settings.mulaiSiang + '"/></div>' +
    '</div>' +
    '<div class="divider"></div>' +
    '<div class="card-head"><i class="ti ti-star" style="color:var(--amber)"></i><h2>Aturan Skor & Bonus</h2></div>' +
    '<div class="field"><label>Min. skor untuk bonus kinerja</label><input type="number" id="cfg-minSkor" value="' + DB.settings.minSkorBonus + '" min="0" max="100"/></div>' +
    '<div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btn-primary" onclick="simpanPengaturan()"><i class="ti ti-device-floppy"></i>Simpan Pengaturan</button></div></div>' +

    /* ---- BOBOT PENILAIAN PERFORMA ---- */
    '<div class="card"><div class="card-head"><i class="ti ti-chart-pie" style="color:var(--blue-600)"></i><h2>Bobot Penilaian Performa</h2></div>' +
    '<div class="info-bar info-blue" style="margin-bottom:12px"><i class="ti ti-info-circle"></i>Skor harian karyawan = rata-rata berbobot dari 3 komponen: <strong>Ketepatan Absen</strong>, <strong>Hasil To-Do List</strong> (dikonfirmasi koordinator), dan <strong>Komunikasi</strong> (dinilai koordinator setiap WFA). Total bobot tidak harus 100 — sistem otomatis menormalkan berdasarkan komponen yang terisi.</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px" class="pengaturan-grid">' +
      '<div class="field" style="margin:0"><label>Bobot Ketepatan Absen (%)</label><input type="number" id="cfg-bobotAbsen" value="' + (DB.settings.bobotAbsen??34) + '" min="0" max="100"/></div>' +
      '<div class="field" style="margin:0"><label>Bobot Hasil To-Do (%)</label><input type="number" id="cfg-bobotTodo" value="' + (DB.settings.bobotTodo??33) + '" min="0" max="100"/></div>' +
      '<div class="field" style="margin:0"><label>Bobot Komunikasi (%)</label><input type="number" id="cfg-bobotKomunikasi" value="' + (DB.settings.bobotKomunikasi??33) + '" min="0" max="100"/></div>' +
    '</div>' +
    '<div class="divider"></div>' +
    '<div class="card-head" style="padding-top:0"><i class="ti ti-alert-triangle" style="color:var(--amber)"></i><h2>Ambang Batas Evaluasi Otomatis</h2></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px" class="pengaturan-grid">' +
      '<div class="field" style="margin:0"><label>Min. rata-rata skor (peringatan)</label><input type="number" id="cfg-minSkorRataRata" value="' + (DB.settings.minSkorRataRata??70) + '" min="0" max="100"/>' +
        '<div style="font-size:11px;color:var(--gray-400);margin-top:4px">Jika skor harian/rata-rata bulanan di bawah ini, sistem mengirim notifikasi perbaikan.</div></div>' +
      '<div class="field" style="margin:0"><label>Hari berturut-turut sebelum hak WFA dicabut</label><input type="number" id="cfg-hariEvaluasiCabut" value="' + (DB.settings.hariEvaluasiCabut??5) + '" min="1" max="30"/>' +
        '<div style="font-size:11px;color:var(--gray-400);margin-top:4px">Jika skor di bawah ambang selama N hari WFA berturut-turut, hak WFA dicabut otomatis.</div></div>' +
    '</div>' +
    '<div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btn-primary" onclick="simpanBobotPerforma()"><i class="ti ti-device-floppy"></i>Simpan Bobot & Ambang Batas</button></div></div>' +

    /* ---- KELOLA DIVISI ---- */
    '<div class="card"><div class="card-head"><i class="ti ti-sitemap" style="color:var(--blue-600)"></i><h2>Kelola Divisi</h2></div>' +
    '<div class="info-bar info-blue" style="margin-bottom:12px"><i class="ti ti-info-circle"></i>Daftar divisi ini akan muncul di dropdown saat HRD menambah karyawan, saat karyawan melengkapi profil, dan di filter Data Karyawan.</div>' +
    '<div id="divisi-list-wrap" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">' +
      getDivisiList().map(function(d,idx){
        return '<span class="badge" style="background:var(--blue-50);color:var(--blue-700);border:1px solid var(--blue-200);padding:7px 10px;font-size:13px">' +
          d +
          '<button onclick="hapusDivisi(' + idx + ')" title="Hapus divisi" style="margin-left:8px;background:none;border:none;color:var(--red);cursor:pointer;display:inline-flex;align-items:center;padding:0"><i class="ti ti-x" style="font-size:13px"></i></button>' +
        '</span>';
      }).join('') +
    '</div>' +
    '<div style="display:flex;gap:10px">' +
      '<input type="text" id="divisi-baru" placeholder="Nama divisi baru..." style="flex:1" onkeydown="if(event.key===\'Enter\')tambahDivisi()"/>' +
      '<button class="btn btn-primary" onclick="tambahDivisi()"><i class="ti ti-plus"></i>Tambah Divisi</button>' +
    '</div></div>' +

    /* ---- ARSIP DATA LAMA KE GOOGLE SHEETS ---- */
    '<div class="card"><div class="card-head"><i class="ti ti-archive" style="color:var(--blue-600)"></i><h2>Arsip Data Lama ke Google Sheets</h2></div>' +
    '<div class="info-bar info-blue" style="margin-bottom:12px"><i class="ti ti-info-circle"></i>Memindahkan riwayat absen & to-do yang sudah lama keluar dari Firebase membuat kuota gratis Firebase tidak cepat habis. Data yang sudah diarsipkan TIDAK hilang — tetap bisa dibuka kapan saja lewat link Google Sheets di bawah.</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px" class="pengaturan-grid">' +
      '<div class="field" style="margin:0"><label>URL Web App Apps Script</label><input type="text" id="cfg-arsipUrl" placeholder="https://script.google.com/macros/s/.../exec" value="' + (DB.settings.archiveWebAppUrl||'').replace(/"/g,'&quot;') + '"/></div>' +
      '<div class="field" style="margin:0"><label>Secret Key</label><input type="text" id="cfg-arsipSecret" placeholder="samakan dengan SECRET di Apps Script" value="' + (DB.settings.archiveSecret||'').replace(/"/g,'&quot;') + '"/></div>' +
    '</div>' +
    '<div class="field"><label>Link Google Sheets (untuk dibuka & dilihat)</label><input type="text" id="cfg-arsipSheetLink" placeholder="https://docs.google.com/spreadsheets/d/..." value="' + (DB.settings.archiveSheetUrl||'').replace(/"/g,'&quot;') + '"/></div>' +
    '<div style="display:flex;justify-content:flex-end;margin-bottom:14px"><button class="btn btn-ghost" onclick="simpanKonfigArsip()"><i class="ti ti-device-floppy"></i>Simpan Konfigurasi</button></div>' +
    '<div class="divider"></div>' +
    '<div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;align-items:end" class="pengaturan-grid">' +
      '<div class="field" style="margin:0"><label>Arsipkan semua data SEBELUM bulan</label><input type="month" id="arsip-cutoff" value="' + defaultCutoffMonth() + '"/></div>' +
      '<button class="btn btn-primary" id="btn-arsipkan" onclick="arsipkanDataLama()" style="height:42px"><i class="ti ti-archive"></i>Arsipkan & Bersihkan</button>' +
    '</div>' +
    (DB.settings.archiveSheetUrl ? '<div style="margin-top:12px"><a href="' + DB.settings.archiveSheetUrl + '" target="_blank" style="font-size:13px;color:var(--blue-600);display:inline-flex;align-items:center;gap:5px"><i class="ti ti-external-link"></i>Buka Arsip di Google Sheets</a></div>' : '') +
    '</div>' +

    '<div class="card" style="border:1px solid #fca5a5">' +
      '<div class="card-head"><i class="ti ti-alert-octagon" style="color:var(--red)"></i><h2 style="color:var(--red)">Zona Bahaya</h2></div>' +
      '<div class="info-bar" style="background:#fef2f2;color:#991b1b;border:1px solid #fca5a5">' +
        '<i class="ti ti-alert-triangle" style="color:var(--red)"></i>' +
        '<div><strong>Reset Total Sistem</strong> akan menghapus SEMUA data secara permanen: seluruh karyawan, akun login (kecuali Admin HRD), absensi, sanksi, to-do, dan jadwal Zoom. Pengaturan jam kerja akan dikembalikan ke default. Tindakan ini <strong>tidak dapat dibatalkan</strong>.</div>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:8px">' +
        '<button class="btn btn-danger" onclick="resetTotalSistem()"><i class="ti ti-trash-x"></i>Reset Total Sistem ke Nol</button>' +
      '</div>' +
    '</div>'
  );

  return '<div class="page-header"><h1>Halaman tidak ditemukan</h1></div>';
}

// ---- KOORDINATOR ----
// Render satu baris kartu arsip to-do untuk satu tanggal — dipindah ke scope
// global (sebelumnya terkurung di dalam closure buildKOOR) supaya bisa dipanggil
// ulang oleh arsipPilihTgl() saat tombol tanggal diklik. Isi logikanya SAMA PERSIS,
// hanya targetEmps sekarang jadi parameter, bukan diambil dari closure.
function renderArsipTglRow(tgl, targetEmps) {
  var rows = targetEmps.map(function(emp) {
    var encEm = emp.email.replace(/[.#$\[\]]/g,'_');
    var key   = encEm + '_' + tgl;
    var todos = (DB.todos[key]||[]).filter(function(t){ return t.task&&t.task.trim(); });
    var rec   = DB.attendance[key] || {};
    var doneTodos = todos.filter(function(t){ var s=t.koreksi_skor!==null&&t.koreksi_skor!==undefined?t.koreksi_skor:t.score; return s!==null&&s!==undefined; });
    var avgS  = doneTodos.length ? Math.round(doneTodos.reduce(function(a,t){ var s=t.koreksi_skor!==null&&t.koreksi_skor!==undefined?t.koreksi_skor:t.score; return a+(s||0); },0)/doneTodos.length) : null;
    var statusC = todos.length===0?'var(--gray-300)':doneTodos.length===todos.length?'var(--green)':'var(--amber)';
    var avgColor = avgS>=80?'var(--green)':avgS>=60?'var(--amber)':avgS?'var(--red)':'var(--gray-400)';

    return '<div style="border:1px solid var(--gray-200);border-radius:var(--radius-lg);padding:14px;background:var(--white)">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--gray-100)">' +
        '<div class="av" style="background:' + emp.bg + ';color:#fff;width:34px;height:34px;font-size:11px;flex-shrink:0">' + emp.inits + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + emp.name + '</div>' +
          '<div style="font-size:10px;color:var(--gray-400);margin-top:2px">' +
            'Absen: <strong>' + (rec.pagi||'—') + '</strong> → <strong>' + (rec.siang||'—') + '</strong>' +
            (rec.status ? ' &nbsp;·&nbsp; <span style="color:' + (rec.status==='hadir'?'var(--green)':rec.status==='terlambat'?'var(--amber)':'var(--gray-400)') + '">' + (rec.status==='hadir'?'Tepat waktu':rec.status==='terlambat'?'Terlambat':'—') + '</span>' : '') +
          '</div>' +
        '</div>' +
        (avgS !== null
          ? '<div style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;border:2.5px solid ' + avgColor + ';font-weight:800;font-size:13px;color:' + avgColor + ';flex-shrink:0">' + avgS + '</div>'
          : '<div style="width:38px;height:38px;border-radius:50%;border:2px solid var(--gray-200);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--gray-300);flex-shrink:0">—</div>') +
      '</div>' +
      (todos.length === 0
        ? '<div style="text-align:center;padding:12px 0;color:var(--gray-300);font-size:12px"><i class="ti ti-clipboard-x" style="font-size:18px;display:block;margin-bottom:4px"></i>Tidak ada to-do</div>'
        : '<div style="display:flex;flex-direction:column;gap:5px">' +
          todos.map(function(t, ti){
            var s = t.koreksi_skor!==null&&t.koreksi_skor!==undefined?t.koreksi_skor:t.score;
            var hasS = s!==null&&s!==undefined;
            var sc = hasS?(s>=80?'var(--green)':s>=60?'var(--amber)':'var(--red)'):'var(--gray-300)';
            var isKoreksi = t.koreksi_skor!==null&&t.koreksi_skor!==undefined;
            return '<div style="padding:7px 9px;background:var(--gray-50);border-radius:8px;border-left:3px solid ' + (hasS?sc:'var(--gray-200)') + '">' +
              '<div style="display:flex;align-items:center;gap:7px">' +
                '<span style="font-size:10px;font-weight:700;color:var(--gray-400);min-width:16px">' + (ti+1) + '.</span>' +
                '<div style="flex:1;font-size:12px;color:var(--gray-800);font-weight:500">' + t.task + '</div>' +
                (hasS
                  ? '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0">' +
                      (t.score!==null&&t.score!==undefined && isKoreksi
                        ? '<span style="font-size:10px;color:var(--gray-400);text-decoration:line-through">' + t.score + '</span><span style="font-size:10px;color:var(--amber)">→</span>'
                        : '') +
                      '<span style="font-weight:800;font-size:13px;color:' + sc + '">' + s + '</span>' +
                      (isKoreksi ? '<i class="ti ti-pencil" style="font-size:10px;color:var(--amber)" title="Dikoreksi koordinator"></i>' : '') +
                    '</div>'
                  : '<span style="font-size:11px;color:var(--gray-300);flex-shrink:0">Blm dinilai</span>') +
              '</div>' +
              (t.komentar_koor
                ? '<div style="margin-top:5px;padding:5px 8px;background:var(--blue-50);border-radius:5px;font-size:11px;color:var(--blue-800);display:flex;align-items:flex-start;gap:5px">' +
                    '<i class="ti ti-message-circle" style="font-size:12px;flex-shrink:0;margin-top:1px"></i>' +
                    '<span>' + t.komentar_koor + '</span>' +
                  '</div>'
                : '') +
            '</div>';
          }).join('') +
        '</div>') +
      (todos.length > 0
        ? '<div style="margin-top:8px;display:flex;align-items:center;gap:6px;font-size:11px;color:var(--gray-400)">' +
            '<span>' + doneTodos.length + '/' + todos.length + ' tugas dinilai</span>' +
            (doneTodos.length === todos.length
              ? '<span style="color:var(--green);display:flex;align-items:center;gap:2px"><i class="ti ti-circle-check"></i> Lengkap</span>'
              : '<span style="color:var(--amber)">· ' + (todos.length-doneTodos.length) + ' belum</span>') +
          '</div>'
        : '') +
    '</div>';
  }).join('');
  return rows;
}

// BUGFIX: fungsi ini dipanggil oleh tombol tanggal arsip (onclick="arsipPilihTgl(...)")
// tapi SEBELUMNYA TIDAK PERNAH DIDEFINISIKAN — itu sebabnya tombolnya tidak bisa
// diklik sama sekali (klik memicu error "arsipPilihTgl is not defined" yang gagal
// diam-diam, tidak terlihat oleh user). Sekarang didefinisikan di scope global agar
// bisa dipanggil dari onclick di HTML manapun.
function arsipPilihTgl(tgl) {
  var timku = DB.employees.filter(function(e){ return e.koor === currentUser.name; });
  var grid  = document.getElementById('arsip-grid');
  var label = document.getElementById('arsip-tgl-label');
  if (!grid) return; // halaman sudah berpindah sebelum tombol sempat diproses

  grid.innerHTML = renderArsipTglRow(tgl, timku);

  if (label) {
    var d = new Date(tgl);
    var h = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][d.getDay()];
    var b = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][d.getMonth()];
    label.textContent = h + ', ' + d.getDate() + ' ' + b + ' ' + d.getFullYear();
  }

  // Perbarui gaya tombol chip agar yang aktif terlihat biru, sisanya normal —
  // meniru gaya isActive yang sama seperti saat tombol pertama kali dibuat.
  var chipsWrap = document.getElementById('arsip-tgl-chips');
  if (chipsWrap) {
    Array.prototype.forEach.call(chipsWrap.querySelectorAll('button[id^="chip-"]'), function(btn){
      var isActive = btn.id === ('chip-' + tgl);
      btn.style.borderColor = isActive ? 'var(--blue-500)' : 'var(--gray-200)';
      btn.style.background  = isActive ? 'var(--blue-600)' : 'var(--white)';
      btn.style.color       = isActive ? '#fff' : 'var(--gray-600)';
    });
  }
}

