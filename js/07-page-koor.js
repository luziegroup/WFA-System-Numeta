/* ============================================================
 * FILE   : 07-page-koor.js
 * BAGIAN : Halaman Koordinator
 * ISI    : Seluruh tampilan & logika dashboard Koordinator (supervisor).
 * ============================================================ */

function buildKOOR(id) {
  var timku = DB.employees.filter(function(e){ return e.koor===currentUser.name; });
  var today = todayKey();

  // BUGFIX: sama seperti HRD dashboard — status hadir/terlambat/belum harus dibaca
  // dari DB.attendance[hari ini], bukan DB.employees.status yang tidak direset harian
  var hadir = 0, terlambat = 0, belum = 0;
  timku.forEach(function(e) {
    if (e.status === 'cabut') { belum++; return; }
    var rec = DB.attendance[attendKeyFor(e.email, today)] || {};
    if (rec.status === 'hadir')          hadir++;
    else if (rec.status === 'terlambat') terlambat++;
    else                                 belum++;
});

  if (id === 'dashboard') {
    if (!timku.length) {
      var emptyDateLabel = (function(){
        var d = new Date();
        var hariNama = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][d.getDay()];
        var bulanNama = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][d.getMonth()];
        return hariNama + ', ' + d.getDate() + ' ' + bulanNama + ' ' + d.getFullYear();
      })();
      return (
        '<div class="page-header"><h1>Dashboard Tim ' + rtBadge() + '</h1><p>Status tim WFA Anda hari ini &nbsp;·&nbsp; <span style="color:var(--blue-600);font-weight:600">' + emptyDateLabel + '</span></p></div>' +
        '<div class="card"><div style="text-align:center;padding:40px 16px;color:var(--gray-400)">' +
          '<i class="ti ti-users-group" style="font-size:40px;display:block;margin-bottom:12px"></i>' +
          '<div style="font-size:14px;font-weight:600;color:var(--gray-600);margin-bottom:6px">Belum ada anggota tim</div>' +
          '<div style="font-size:13px;max-width:420px;margin:0 auto">Anggota tim akan muncul di sini setelah karyawan login pertama kali dan memilih <strong>' + currentUser.name + '</strong> sebagai koordinator mereka saat melengkapi profil.</div>' +
        '</div></div>'
      );
    }
    var todayDateLabel = (function(){
      var d = new Date();
      var hariNama = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][d.getDay()];
      var bulanNama = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][d.getMonth()];
      return hariNama + ', ' + d.getDate() + ' ' + bulanNama + ' ' + d.getFullYear();
    })();
    return (
    '<div class="page-header"><h1>Dashboard Tim ' + rtBadge() + '</h1><p>Status tim WFA Anda hari ini &nbsp;·&nbsp; <span style="color:var(--blue-600);font-weight:600">' + todayDateLabel + '</span></p></div>' +
    '<div class="metrics">' +
      '<div class="metric-box blue-card"><div class="mb-label">Anggota Tim</div><div class="mb-val">' + timku.length + '</div></div>' +
      '<div class="metric-box"><div class="mb-label">Hadir Tepat Waktu</div><div class="mb-val" style="color:var(--green)">' + hadir + '</div></div>' +
      '<div class="metric-box"><div class="mb-label">Terlambat</div><div class="mb-val" style="color:var(--amber)">' + terlambat + '</div></div>' +
      '<div class="metric-box"><div class="mb-label">Belum/Cabut</div><div class="mb-val" style="color:var(--red)">' + belum + '</div></div>' +
    '</div>' +
    '<div class="card"><div class="card-head"><i class="ti ti-clipboard-check"></i><h2>Status Tim Hari Ini</h2></div>' +
    timku.map(function(e) {
      // BUGFIX: baca jam pagi/siang/status dari attendance hari ini, bukan dari employees
      var rec = DB.attendance[attendKeyFor(e.email, today)] || {};
      var absenStatus = e.status === 'cabut' ? 'cabut' : (rec.status || 'belum');
      var todaySkor = rec.skor;
      var ring = todaySkor != null ? '<div class="score-ring ' + (todaySkor>=80?'good':'warn') + '" style="margin-right:10px">' + todaySkor + '</div>' : '<div class="score-ring" style="margin-right:10px;border-color:var(--gray-200);color:var(--gray-400)">—</div>';
      return '<div class="trow">' +
        '<div class="av" style="background:' + e.bg + ';color:#fff">' + e.inits + '</div>' +
        '<div style="flex:1"><div style="font-size:13px;font-weight:600">' + e.name + '</div>' +
        '<div style="font-size:11px;color:var(--gray-400)">' + e.div + ' · Pagi: ' + (rec.pagi||'--') + ' | Siang: ' + (rec.siang||'--') + '</div></div>' +
        ring + statusBadge(absenStatus) + '</div>';
    }).join('') + '</div>' +
    '<div class="card"><div class="card-head"><i class="ti ti-device-laptop" style="color:var(--green)"></i><h2>Status Hubstaff Tim</h2></div>' +
    timku.map(function(e) {
      var on = e.status !== 'cabut'; // Hubstaff aktif = akun tidak dicabut (status permanen)
      return '<div class="hubs-bar">' +
        '<div class="hubs-dot ' + (on?'hubs-active':'hubs-off') + '"></div>' +
        '<div style="flex:1;font-size:13px;font-weight:500">' + e.name + '</div>' +
        '<span style="font-size:12px;color:' + (on?'var(--green)':'var(--red)') + '">' + (on?'Aktif':'Tidak Aktif') + '</span></div>';
    }).join('') + '</div>' +

    /* ---- ZOOM TODAY WIDGET ---- */
    (function(){
      var todayMeet = (DB.zoomMeetings||[]).filter(function(m){ return m.koor===currentUser.name && m.tanggal===todayKey(); });
      if (!todayMeet.length) return (
        '<div class="card"><div class="card-head"><i class="ti ti-video" style="color:var(--blue-500)"></i><h2>Zoom Meeting Hari Ini</h2>' +
        '<button class="btn btn-primary btn-sm card-action" onclick="showPage(\'koor\',\'zoom\')"><i class="ti ti-plus"></i>Buat Meeting</button></div>' +
        '<div style="text-align:center;padding:16px;color:var(--gray-400);font-size:13px"><i class="ti ti-calendar-off" style="font-size:24px;display:block;margin-bottom:6px"></i>Belum ada meeting hari ini. Buat jadwal untuk tim Anda.</div></div>'
      );
      return '<div class="card"><div class="card-head"><i class="ti ti-video" style="color:var(--blue-500)"></i><h2>Zoom Meeting Hari Ini (' + todayMeet.length + ')</h2>' +
        '<button class="btn btn-ghost btn-sm card-action" onclick="showPage(\'koor\',\'zoom\')"><i class="ti ti-list"></i>Kelola</button></div>' +
        todayMeet.map(function(m){ return zoomMeetCard(m, true); }).join('') + '</div>';
    })()
    );
  }

  if (id === 'zoom') {
    var meetings = (DB.zoomMeetings||[]).filter(function(m){ return m.koor===currentUser.name; });
    var todayMeet = meetings.filter(function(m){ return m.tanggal===todayKey(); });
    var upcoming  = meetings.filter(function(m){ return m.tanggal>todayKey(); }).slice(0,5);
    var past      = meetings.filter(function(m){ return m.tanggal<todayKey(); }).slice(0,5);

    return (
      '<div class="page-header"><h1>Zoom Meeting Tim</h1><p>Buat & bagikan link Zoom ke seluruh anggota tim Anda</p></div>' +

      /* ---- BUAT MEETING ---- */
      '<div class="card"><div class="card-head"><i class="ti ti-video-plus" style="color:var(--blue-600)"></i><h2>Buat Jadwal Meeting Baru</h2></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px" class="zoom-form-grid">' +
        '<div class="field" style="margin:0"><label>Judul Meeting</label><input type="text" id="zm-judul" placeholder="Contoh: Koordinasi Pagi Harian"/></div>' +
        '<div class="field" style="margin:0"><label>Link Zoom / Google Meet</label><input type="text" id="zm-link" placeholder="https://zoom.us/j/..."/></div>' +
        '<div class="field" style="margin:0"><label>Tanggal</label><input type="date" id="zm-tgl" value="' + todayKey() + '"/></div>' +
        '<div class="field" style="margin:0"><label>Jam Mulai</label><input type="time" id="zm-jam" value="08:00"/></div>' +
      '</div>' +
      '<div class="field" style="margin-top:12px"><label>Agenda / Catatan (opsional)</label><textarea id="zm-catatan" placeholder="Tulis agenda meeting atau hal-hal yang akan dibahas..." style="min-height:70px"></textarea></div>' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">' +
        '<label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--gray-700);cursor:pointer"><input type="checkbox" id="zm-penting"> Tandai sebagai <strong>Meeting Penting</strong> (muncul di dashboard karyawan)</label>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px">' +
        '<button class="btn btn-ghost" onclick="simpanDraftZoom()"><i class="ti ti-device-floppy"></i>Simpan Draft</button>' +
        '<button class="btn btn-primary" onclick="buatZoomMeeting()"><i class="ti ti-send"></i>Buat & Sebarkan ke Tim</button>' +
      '</div></div>' +

      /* ---- MEETING HARI INI ---- */
      '<div class="card"><div class="card-head"><i class="ti ti-calendar-event" style="color:var(--green)"></i><h2>Meeting Hari Ini (' + todayMeet.length + ')</h2></div>' +
      (todayMeet.length ? todayMeet.map(function(m){ return zoomMeetCard(m, true); }).join('') :
        '<div style="text-align:center;padding:20px;color:var(--gray-400);font-size:13px"><i class="ti ti-calendar-off" style="font-size:28px;display:block;margin-bottom:8px"></i>Belum ada meeting hari ini</div>') +
      '</div>' +

      /* ---- UPCOMING ---- */
      (upcoming.length ? '<div class="card"><div class="card-head"><i class="ti ti-calendar-time" style="color:var(--amber)"></i><h2>Akan Datang (' + upcoming.length + ')</h2></div>' +
        upcoming.map(function(m){ return zoomMeetCard(m, true); }).join('') + '</div>' : '') +

      /* ---- RIWAYAT ---- */
      (past.length ? '<div class="card"><div class="card-head"><i class="ti ti-history" style="color:var(--gray-400)"></i><h2>Riwayat Meeting</h2>' +
        '<span style="margin-left:auto;font-size:12px;color:var(--gray-400)">5 terakhir</span></div>' +
        past.map(function(m){ return zoomMeetCard(m, false); }).join('') + '</div>' : '')
    );
  }

  if (id === 'monitor') {
    // Pastikan skor harian terbaru sebelum ditampilkan (auto-sync jika ada data to-do/absen yang belum dihitung)
    var changedEmails = [];
    timku.forEach(function(e){
      var aKey = attendKey(e.email);
      var before = JSON.stringify((DB.attendance[aKey]||{}).skor);
      hitungSkorHarian(e.email, aKey);
      var after = JSON.stringify((DB.attendance[aKey]||{}).skor);
      if (before !== after) changedEmails.push(e.email);
    });
    // BUGFIX: dulu dbSave(DB) menimpa SELURUH database hanya karena koordinator membuka halaman ini.
    // Sekarang hanya simpan karyawan yang skornya benar-benar berubah.
    changedEmails.forEach(function(email){ persistSkorHarian(email, attendKey(email)); });

    return (
    '<div class="page-header"><h1>Monitor To-Do List ' + rtBadge() + '</h1><p>Pantau & verifikasi tugas anggota tim Anda</p></div>' +
    '<div class="info-bar info-blue"><i class="ti ti-info-circle"></i>Anda dapat memberi komentar dan mengoreksi skor setiap item to-do, serta menilai komunikasi anggota tim hari ini.</div>' +
    timku.map(function(e) {
      var tkKey = attendKey(e.email);
      var rec   = DB.attendance[tkKey] || {};
      var todos = (DB.todos[tkKey] || []).filter(function(t){ return t.task && t.task.trim(); });
      var sudahIsi = todos.length > 0;
      var adaSkor  = todos.some(function(t){ return t.score !== null && t.score !== undefined; });
      var avgSkor  = adaSkor ? Math.round(todos.filter(function(t){ return t.score!=null; }).reduce(function(a,t){ return a+t.score; },0) / todos.filter(function(t){ return t.score!=null; }).length) : null;
      var skorKom  = (rec.skorKomunikasi !== null && rec.skorKomunikasi !== undefined) ? rec.skorKomunikasi : null;
      var sudahWFA = !!rec.pagi; // sudah absen pagi = melaksanakan WFA hari ini

      return '<div class="card" id="monitor-card-' + tkKey + '">' +
        '<div class="card-head">' +
          '<div class="av" style="background:' + e.bg + ';color:#fff;width:30px;height:30px;font-size:11px">' + e.inits + '</div>' +
          '<h2>' + e.name + ' <span style="font-weight:400;color:var(--gray-400)">· ' + e.div + '</span></h2>' +
          (avgSkor !== null
            ? '<span class="badge badge-blue" style="margin-left:auto">Avg skor: ' + avgSkor + '</span>'
            : sudahIsi
              ? '<span class="badge badge-amber" style="margin-left:auto">Belum diberi skor</span>'
              : '<span class="badge badge-gray" style="margin-left:auto">Belum mengisi</span>'
          ) +
        '</div>' +

        /* ---- RINGKASAN SKOR HARIAN GABUNGAN ---- */
        (sudahWFA ?
          '<div style="display:flex;gap:10px;flex-wrap:wrap;padding:10px 12px;background:var(--gray-50);border-radius:var(--radius);margin-bottom:12px">' +
            skorBadgeMini('Absen', rec.skorAbsen) +
            skorBadgeMini('To-Do', rec.skorTodo) +
            skorBadgeMini('Komunikasi', rec.skorKomunikasi) +
            '<div style="flex:1"></div>' +
            '<div style="text-align:right">' +
              '<div style="font-size:10px;color:var(--gray-400);text-transform:uppercase;letter-spacing:.5px">Skor Hari Ini</div>' +
              '<div style="font-size:22px;font-weight:800;color:' + (rec.skor>=80?'var(--green)':rec.skor>=60?'var(--amber)':rec.skor!=null?'var(--red)':'var(--gray-400)') + '">' + (rec.skor!=null?rec.skor:'—') + '</div>' +
            '</div>' +
          '</div>'
        : '') +

        (!sudahIsi
          ? '<div style="font-size:13px;color:var(--gray-400);padding:10px 0">Belum mengisi to-do list hari ini</div>'
          : '<div>' +
              todos.map(function(t, i) {
                var itemId   = tkKey + '_' + i;
                var koreksi  = (t.koreksi_skor !== null && t.koreksi_skor !== undefined) ? t.koreksi_skor : null;
                var komentar = t.komentar_koor || '';
                var hasScore = (t.score !== null && t.score !== undefined);
                var skorTampil = koreksi !== null ? koreksi : (hasScore ? t.score : null);
                var skorWarna  = skorTampil >= 80 ? 'var(--green)' : skorTampil >= 60 ? 'var(--amber)' : skorTampil !== null ? 'var(--red)' : 'var(--gray-400)';

                return '<div style="border:1px solid var(--gray-100);border-radius:var(--radius);padding:12px;margin-bottom:8px">' +

                  // Baris utama: tugas + skor
                  '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
                    '<i class="ti ' + (hasScore?'ti-check-circle':'ti-circle') + '" style="font-size:16px;color:' + (hasScore?'var(--green)':'var(--gray-300)') + ';flex-shrink:0"></i>' +
                    '<div style="flex:1;font-size:13px;color:var(--gray-800)">' + t.task + '</div>' +
                    '<div style="display:flex;align-items:center;gap:6px">' +
                      (hasScore
                        ? '<span style="font-size:11px;color:var(--gray-400)">Staff:</span><span style="font-weight:600;font-size:13px;color:var(--gray-600)">' + t.score + '</span>'
                        : '<span style="font-size:12px;color:var(--gray-400)">—</span>'
                      ) +
                      (koreksi !== null
                        ? '<i class="ti ti-arrow-right" style="font-size:11px;color:var(--gray-300)"></i><span style="font-size:11px;color:var(--amber)">Koreksi:</span><span style="font-weight:700;font-size:14px;color:' + skorWarna + '">' + koreksi + '</span>'
                        : ''
                      ) +
                    '</div>' +
                  '</div>' +

                  // Area komentar + koreksi skor koordinator
                  '<div style="background:var(--gray-50);border-radius:var(--radius);padding:10px;display:flex;flex-direction:column;gap:8px" id="koor-area-' + itemId + '">' +
                    '<div style="display:flex;gap:8px;align-items:flex-start">' +
                      '<i class="ti ti-message-circle-2" style="font-size:14px;color:var(--blue-400);margin-top:3px;flex-shrink:0"></i>' +
                      '<textarea id="kom-' + itemId + '" placeholder="Tulis komentar / catatan untuk item ini..." ' +
                        'style="flex:1;resize:vertical;min-height:52px;border:1px solid var(--gray-200);border-radius:6px;padding:7px 10px;font-size:12px;font-family:var(--font);color:var(--gray-700);background:#fff" ' +
                        'oninput="this.style.height=\'auto\';this.style.height=this.scrollHeight+\'px\'">' + komentar + '</textarea>' +
                    '</div>' +
                    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
                      '<span style="font-size:12px;color:var(--gray-500);flex-shrink:0">' + (hasScore ? 'Koreksi skor:' : 'Beri skor (karyawan belum menilai):') + '</span>' +
                      '<select id="kor-' + itemId + '" style="padding:6px 10px;border:1.5px solid var(--gray-200);border-radius:6px;font-size:12px;background:#fff;color:var(--gray-700)">' +
                        '<option value="">' + (hasScore ? 'Tidak dikoreksi' : 'Pilih skor') + '</option>' +
                        [100,90,80,70,60,50,40,30,20,10,0].map(function(s){
                          return '<option value="' + s + '" ' + (koreksi===s?'selected':'') + '>' + s + '</option>';
                        }).join('') +
                      '</select>' +
                      '<button onclick="simpanKomentarKoor(\'' + tkKey + '\',' + i + ')" ' +
                        'style="padding:7px 14px;background:var(--blue-600);color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px">' +
                        '<i class="ti ti-device-floppy" style="font-size:12px"></i>Simpan</button>' +
                      (komentar || koreksi !== null
                        ? '<span style="font-size:11px;color:var(--green);display:flex;align-items:center;gap:3px"><i class="ti ti-circle-check"></i>Tersimpan</span>'
                        : ''
                      ) +
                    '</div>' +
                  '</div>' +

                '</div>';
              }).join('') +
            '</div>'
        ) +

        /* ---- PENILAIAN KOMUNIKASI ---- */
        (sudahWFA ?
          '<div style="border-top:1px solid var(--gray-100);margin-top:12px;padding-top:12px">' +
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
              '<i class="ti ti-message-2" style="font-size:15px;color:var(--blue-500)"></i>' +
              '<span style="font-size:13px;font-weight:600;color:var(--gray-700)">Nilai Komunikasi Hari Ini:</span>' +
              '<select id="kom-skor-' + tkKey + '" style="padding:6px 10px;border:1.5px solid var(--gray-200);border-radius:6px;font-size:12px;background:#fff;color:var(--gray-700)">' +
                '<option value="">Pilih nilai</option>' +
                [100,90,80,70,60,50,40,30,20,10,0].map(function(s){
                  return '<option value="' + s + '" ' + (skorKom===s?'selected':'') + '>' + s + '</option>';
                }).join('') +
              '</select>' +
              '<button onclick="simpanSkorKomunikasi(\'' + e.email + '\',\'' + tkKey + '\')" ' +
                'style="padding:7px 14px;background:var(--blue-600);color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px">' +
                '<i class="ti ti-device-floppy" style="font-size:12px"></i>Simpan</button>' +
              (skorKom !== null
                ? '<span style="font-size:11px;color:var(--green);display:flex;align-items:center;gap:3px"><i class="ti ti-circle-check"></i>Tersimpan</span>'
                : '<span style="font-size:11px;color:var(--gray-400)">Belum dinilai</span>'
              ) +
            '</div>' +
          '</div>'
        : '<div style="font-size:12px;color:var(--gray-400);padding-top:10px;border-top:1px solid var(--gray-100);margin-top:12px"><i class="ti ti-info-circle"></i> Penilaian komunikasi tersedia setelah karyawan absen pagi (melaksanakan WFA hari ini).</div>') +

      '</div>';
    }).join('')
    );
  }

  if (id === 'rekap') {
    var thisMonth    = todayKey().slice(0,7);
    var bulanOptsKoor= getBulanOptionsList(12);
    var divListKoor  = [];
    timku.forEach(function(e){ if (e.div && !divListKoor.includes(e.div)) divListKoor.push(e.div); });

    return (
      '<div class="page-header"><h1>Rekap Absensi Tim ' + rtBadge() + '</h1><p>Data kehadiran & kinerja anggota tim Anda — klik nama untuk lihat rincian harian, filter per bulan & divisi</p></div>' +

      '<div class="card" id="rekap-koor-filter-card">' +
        '<div class="card-head"><i class="ti ti-filter" style="color:var(--blue-600)"></i><h2>Filter</h2></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px" class="filter-grid">' +
          '<div class="field" style="margin:0"><label>Bulan</label>' +
            '<select id="rkpk-bulan" onchange="applyRekapFilterKoor()">' +
              bulanOptsKoor.map(function(b){ return '<option value="'+b.key+'"'+(b.key===thisMonth?' selected':'')+'>'+b.label+'</option>'; }).join('') +
            '</select></div>' +
          '<div class="field" style="margin:0"><label>Divisi</label>' +
            '<select id="rkpk-div" onchange="applyRekapFilterKoor()">' +
              '<option value="">Semua Divisi</option>' +
              divListKoor.map(function(d){return '<option>'+d+'</option>';}).join('') +
            '</select></div>' +
          '<div class="field" style="margin:0"><label>Status Karyawan</label>' +
            '<select id="rkpk-status" onchange="applyRekapFilterKoor()">' +
              '<option value="">Semua Status</option>' +
              '<option value="hadir">Tepat Waktu</option>' +
              '<option value="terlambat">Terlambat</option>' +
              '<option value="belum">Belum Absen</option>' +
              '<option value="cabut">Hak Dicabut</option>' +
            '</select></div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
          '<button class="btn btn-ghost btn-sm" onclick="resetRekapFilterKoor()"><i class="ti ti-refresh"></i>Reset Filter</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="exportRekapCSVKoor()"><i class="ti ti-download"></i>Export CSV</button>' +
        '</div>' +
      '</div>' +

      '<div id="rekap-koor-content">' + buildRekapContent(thisMonth, currentUser.name, '', '') + '</div>'
    );
  }

  if (id === 'performa') {
    var threshold = DB.settings.minSkorRataRata ?? 70;
    var avgSkorArr = timku.filter(function(e){ return e.skor!=null; }).map(function(e){ return e.skor; });
    var avgTim = avgSkorArr.length ? Math.round(avgSkorArr.reduce(function(a,b){return a+b;},0)/avgSkorArr.length) : null;

    return (
      '<div class="page-header"><h1>Performa Tim ' + rtBadge() + '</h1><p>Rata-rata skor, tren bulanan, dan papan skor anggota tim Anda</p></div>' +

      '<div class="metrics">' +
        '<div class="metric-box blue-card"><div class="mb-label">Anggota Tim</div><div class="mb-val">' + timku.length + '</div></div>' +
        '<div class="metric-box"><div class="mb-label">Rata-rata Skor Tim</div><div class="mb-val" style="color:var(--blue-700)">' + (avgTim!=null ? avgTim : '—') + '</div><div class="mb-sub">Bulan ini</div></div>' +
        '<div class="metric-box"><div class="mb-label">Ambang Batas Minimum</div><div class="mb-val" style="color:var(--red)">' + threshold + '</div></div>' +
      '</div>' +

      '<div class="card"><div class="card-head"><i class="ti ti-chart-histogram" style="color:var(--blue-600)"></i><h2>Grafik Performa Tim Bulanan (6 Bulan Terakhir)</h2></div>' +
      (timku.length ?
        '<div class="info-bar info-blue" style="margin-bottom:12px"><i class="ti ti-info-circle"></i>Rata-rata skor harian gabungan seluruh anggota tim, per bulan.</div>' +
        buildSkorBulananChart(timku.map(function(e){ return e.email; }), 6, threshold)
      :
        '<div style="text-align:center;padding:32px;color:var(--gray-400);font-size:13px">Belum ada anggota tim untuk ditampilkan.</div>'
      ) + '</div>' +

      '<div class="card"><div class="card-head"><i class="ti ti-list-numbers" style="color:var(--amber)"></i><h2>Papan Skor Tim</h2></div>' +
      buildPapanSkor(timku, {showDivKoor:true}) +
      '</div>'
    );
  }

  if (id === 'laporan') {
    var isKoor = true;
    var targetEmps = timku;
    var now2       = new Date();
    var thisMonth2 = now2.toISOString().slice(0,7);
    var bulanLabel2= now2.toLocaleDateString('id-ID',{month:'long',year:'numeric'});
    var todayL2    = today;

    var empStats2 = targetEmps.map(function(emp) {
      var encEm = emp.email.replace(/[.#$\[\]]/g,'_');
      var keys  = Object.keys(DB.attendance).filter(function(k){ return k.startsWith(encEm+'_') && k.indexOf(thisMonth2)>=0; });
      var hadir2=0, terlambat2=0, tidakLengkap2=0, skorArr2=[];
      keys.forEach(function(k){
        var r = DB.attendance[k];
        if (r.pagi && r.siang) { if (r.status==='terlambat') terlambat2++; else hadir2++; }
        else if (r.pagi || r.siang) { tidakLengkap2++; }
        if (r.skor!=null) skorArr2.push(Number(r.skor));
      });
      var avg2 = skorArr2.length ? Math.round(skorArr2.reduce(function(a,b){return a+b;},0)/skorArr2.length) : null;
      return { emp:emp, hadir:hadir2, terlambat:terlambat2, tidakLengkap:tidakLengkap2, avgSkor:avg2, totalAbsen:keys.length };
    });

    var todoStats2 = targetEmps.map(function(emp) {
      var encEm = emp.email.replace(/[.#$\[\]]/g,'_');
      var keys  = Object.keys(DB.todos).filter(function(k){ return k.startsWith(encEm+'_') && k.indexOf(thisMonth2)>=0; });
      var totalTugas2=0, sudahSkor2=0, skorArr2=[];
      keys.forEach(function(k){
        var list = (DB.todos[k]||[]).filter(function(t){ return t.task&&t.task.trim(); });
        totalTugas2 += list.length;
        list.forEach(function(t){
          var s = t.koreksi_skor!==null&&t.koreksi_skor!==undefined?t.koreksi_skor:t.score;
          if (s!==null&&s!==undefined){ sudahSkor2++; skorArr2.push(Number(s)); }
        });
      });
      var avgTd = skorArr2.length ? Math.round(skorArr2.reduce(function(a,b){return a+b;},0)/skorArr2.length) : null;
      return { emp:emp, totalTugas:totalTugas2, sudahSkor:sudahSkor2, avgTodoSkor:avgTd, hariIsiTodo:keys.length };
    });

    var totalKary2    = targetEmps.length;
    var hadirHariIni2 = 0, blmAbsen2 = 0, cabut2 = 0;
    targetEmps.forEach(function(e) {
      if (e.status === 'cabut') { cabut2++; return; }
      var r = DB.attendance[attendKeyFor(e.email, todayL2)] || {};
      if (r.status === 'hadir' || r.status === 'terlambat') hadirHariIni2++;
      else blmAbsen2++;
    });

    var allSkor2 = empStats2.filter(function(s){return s.avgSkor!=null;}).map(function(s){return s.avgSkor;});
    var avgAll2  = allSkor2.length ? Math.round(allSkor2.reduce(function(a,b){return a+b;},0)/allSkor2.length) : null;
    var totalTugas2  = todoStats2.reduce(function(a,s){return a+s.totalTugas;},0);
    var totalSkor2   = todoStats2.reduce(function(a,s){return a+s.sudahSkor;},0);
    var totalHadir2  = empStats2.reduce(function(a,s){return a+s.hadir;},0);

    var tglHariIni2 = (function(){
      var d = new Date();
      var hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][d.getDay()];
      var bln  = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][d.getMonth()];
      return hari + ', ' + d.getDate() + ' ' + bln + ' ' + d.getFullYear();
    })();

    var statusHariIni2 = targetEmps.map(function(emp) {
      if (emp.status === 'cabut') return { emp:emp, status:'cabut', pagi:'—', siang:'—' };
      var rec = DB.attendance[attendKeyFor(emp.email, todayL2)] || {};
      return { emp:emp, status:rec.status||'belum', pagi:rec.pagi||'—', siang:rec.siang||'—' };
    });

    return (
      '<div class="page-header">' +
        '<h1>Laporan Tim ' + rtBadge() + '</h1>' +
        '<p>' + bulanLabel2 + ' &nbsp;·&nbsp; Tim <strong>' + currentUser.name + '</strong> &nbsp;·&nbsp; <span style="color:var(--blue-600);font-weight:600">' + tglHariIni2 + '</span></p>' +
      '</div>' +

      '<div class="metrics" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">' +
        '<div class="metric-box blue-card"><div class="mb-label">Anggota Tim</div><div class="mb-val">' + totalKary2 + '</div></div>' +
        '<div class="metric-box"><div class="mb-label">Hadir Hari Ini</div><div class="mb-val" style="color:var(--green)">' + hadirHariIni2 + '</div><div class="mb-sub" style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--green);animation:blink 1.5s infinite"></span>Live</div></div>' +
        '<div class="metric-box"><div class="mb-label">Belum Absen</div><div class="mb-val" style="color:var(--amber)">' + blmAbsen2 + '</div></div>' +
        '<div class="metric-box"><div class="mb-label">Hak Dicabut</div><div class="mb-val" style="color:var(--red)">' + cabut2 + '</div></div>' +
        '<div class="metric-box"><div class="mb-label">Avg Skor Tim</div><div class="mb-val" style="color:var(--blue-500)">' + (avgAll2||'—') + '</div><div class="mb-sub">bulan ini</div></div>' +
        '<div class="metric-box"><div class="mb-label">Total Hadir Bulan</div><div class="mb-val" style="color:var(--green)">' + totalHadir2 + '</div><div class="mb-sub">hari·orang</div></div>' +
      '</div>' +

      '<div style="display:flex;gap:4px;margin-bottom:16px;background:var(--gray-100);border-radius:var(--radius-lg);padding:4px;width:fit-content">' +
        '<button id="tab-absen-btn" onclick="laporanSwitchTab(\'absen\')" style="padding:8px 18px;border:none;border-radius:var(--radius);font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font);background:var(--white);color:var(--blue-700);box-shadow:0 1px 4px rgba(0,0,0,.1)"><i class="ti ti-calendar-stats" style="margin-right:5px"></i>Rekap Absen</button>' +
        '<button id="tab-todo-btn" onclick="laporanSwitchTab(\'todo\')" style="padding:8px 18px;border:none;border-radius:var(--radius);font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font);background:transparent;color:var(--gray-500)"><i class="ti ti-checkbox" style="margin-right:5px"></i>Rekap To-Do</button>' +
      '</div>' +

      '<div id="panel-absen">' +
        '<div class="card">' +
          '<div class="card-head"><i class="ti ti-clock-check" style="color:var(--blue-600)"></i><h2>Status Absen Hari Ini</h2><span class="realtime-badge" style="margin-left:8px"><i class="ti ti-circle-filled"></i>Live</span></div>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px">' +
          statusHariIni2.map(function(s) {
            var colorMap = {hadir:'var(--green)',terlambat:'var(--amber)',belum:'var(--gray-400)',cabut:'var(--red)'};
            var bgMap    = {hadir:'var(--green-light)',terlambat:'var(--amber-light)',belum:'var(--gray-50)',cabut:'var(--red-light)'};
            var iconMap  = {hadir:'ti-check-circle',terlambat:'ti-clock-x',belum:'ti-clock-pause',cabut:'ti-ban'};
            var c = colorMap[s.status]||'var(--gray-400)';
            var bg = bgMap[s.status]||'var(--gray-50)';
            return '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:var(--radius-lg);background:' + bg + ';border:1px solid ' + c + '30">' +
              '<div class="av" style="background:' + s.emp.bg + ';color:#fff;width:36px;height:36px;font-size:12px;flex-shrink:0">' + s.emp.inits + '</div>' +
              '<div style="flex:1;min-width:0">' +
                '<div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + s.emp.name + '</div>' +
                '<div style="font-size:11px;color:var(--gray-500);margin-top:2px">Pagi: <strong>' + s.pagi + '</strong> &nbsp;|&nbsp; Siang: <strong>' + s.siang + '</strong></div>' +
              '</div>' +
              '<i class="ti ' + (iconMap[s.status]||'ti-minus') + '" style="font-size:20px;color:' + c + ';flex-shrink:0"></i>' +
            '</div>';
          }).join('') +
          '</div>' +
        '</div>' +

        '<div class="card">' +
          '<div class="card-head"><i class="ti ti-chart-bar" style="color:var(--blue-600)"></i><h2>Distribusi Status Hari Ini</h2></div>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          (function(){
            var terlambatHariIni = targetEmps.filter(function(e){ var r=DB.attendance[attendKeyFor(e.email,todayL2)]||{}; return r.status==='terlambat'; }).length;
            var dist = [
              {label:'Tepat Waktu',count:hadirHariIni2-terlambatHariIni,color:'var(--green)',icon:'ti-check'},
              {label:'Terlambat',  count:terlambatHariIni,               color:'var(--amber)',icon:'ti-clock'},
              {label:'Belum Absen',count:blmAbsen2,                      color:'var(--gray-400)',icon:'ti-clock-pause'},
              {label:'Hak Dicabut',count:cabut2,                         color:'var(--red)',icon:'ti-ban'},
            ];
            return dist.map(function(d){
              var pct = totalKary2 ? Math.round(d.count/totalKary2*100) : 0;
              return '<div style="flex:1;min-width:100px;padding:14px 16px;border-radius:var(--radius-lg);background:var(--gray-50);border:1px solid var(--gray-200)">' +
                '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">' +
                  '<i class="ti ' + d.icon + '" style="font-size:14px;color:' + d.color + '"></i>' +
                  '<span style="font-size:11px;font-weight:600;color:var(--gray-600);text-transform:uppercase;letter-spacing:.4px">' + d.label + '</span>' +
                '</div>' +
                '<div style="font-size:28px;font-weight:800;color:' + d.color + ';line-height:1">' + d.count + '</div>' +
                '<div style="height:5px;border-radius:99px;background:var(--gray-200);margin-top:10px">' +
                  '<div style="height:100%;width:' + pct + '%;border-radius:99px;background:' + d.color + '"></div>' +
                '</div>' +
                '<div style="font-size:10px;color:var(--gray-400);margin-top:4px">' + pct + '% dari tim</div>' +
              '</div>';
            }).join('');
          })() +
          '</div>' +
        '</div>' +

        '<div class="card">' +
          '<div class="card-head"><i class="ti ti-table" style="color:var(--blue-600)"></i><h2>Rekap Kehadiran Bulan Ini</h2>' +
            '<button class="btn btn-ghost btn-sm card-action" onclick="exportLaporan()"><i class="ti ti-download"></i>Export CSV</button>' +
          '</div>' +
          '<div style="overflow-x:auto"><table class="data-table" style="min-width:500px"><thead><tr>' +
            '<th>Nama</th><th>Divisi</th><th style="text-align:center">Hadir</th><th style="text-align:center">Terlambat</th><th style="text-align:center">Tdk Lengkap</th><th style="text-align:center">Avg Skor</th><th>Status</th>' +
          '</tr></thead><tbody>' +
          empStats2.map(function(s) {
            var e = s.emp;
            var sc = s.avgSkor>=80?'var(--green)':s.avgSkor>=60?'var(--amber)':s.avgSkor?'var(--red)':'var(--gray-400)';
            return '<tr>' +
              '<td><div style="display:flex;align-items:center;gap:8px">' +
                '<div class="av" style="background:' + e.bg + ';color:#fff;width:30px;height:30px;font-size:10px">' + e.inits + '</div>' +
                '<div style="font-weight:600;font-size:13px">' + e.name + '</div>' +
              '</div></td>' +
              '<td style="color:var(--gray-500);font-size:12px">' + (e.div||'—') + '</td>' +
              '<td style="text-align:center;font-weight:700;color:var(--green)">' + s.hadir + '</td>' +
              '<td style="text-align:center;font-weight:700;color:var(--amber)">' + s.terlambat + '</td>' +
              '<td style="text-align:center;font-weight:600;color:var(--blue-500)">' + s.tidakLengkap + '</td>' +
              '<td style="text-align:center">' +
                (s.avgSkor !== null
                  ? '<div style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;border:2.5px solid ' + sc + ';font-weight:700;font-size:12px;color:' + sc + '">' + s.avgSkor + '</div>'
                  : '<span style="color:var(--gray-400)">—</span>') +
              '</td>' +
              '<td>' + statusBadge(e.status) + '</td>' +
            '</tr>';
          }).join('') +
          '</tbody></table></div>' +
        '</div>' +
      '</div>' +

      '<div id="panel-todo" style="display:none">' +
        '<div class="metrics" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:16px">' +
          '<div class="metric-box blue-card"><div class="mb-label">Total Tugas Bulan Ini</div><div class="mb-val">' + totalTugas2 + '</div><div class="mb-sub">seluruh tim</div></div>' +
          '<div class="metric-box"><div class="mb-label">Sudah Dinilai</div><div class="mb-val" style="color:var(--green)">' + totalSkor2 + '</div></div>' +
          '<div class="metric-box"><div class="mb-label">Belum Dinilai</div><div class="mb-val" style="color:var(--amber)">' + (totalTugas2-totalSkor2) + '</div></div>' +
          (function(){
            var allTd2 = todoStats2.filter(function(s){return s.avgTodoSkor!=null;}).map(function(s){return s.avgTodoSkor;});
            var avgTd2 = allTd2.length ? Math.round(allTd2.reduce(function(a,b){return a+b;},0)/allTd2.length) : null;
            var c2 = avgTd2>=80?'var(--green)':avgTd2>=60?'var(--amber)':avgTd2?'var(--red)':'var(--gray-400)';
            return '<div class="metric-box"><div class="mb-label">Avg Skor To-Do</div><div class="mb-val" style="color:' + c2 + '">' + (avgTd2||'—') + '</div><div class="mb-sub">bulan ini</div></div>';
          })() +
        '</div>' +

        /* ---- REKAP PER ANGGOTA BULAN INI ---- */
        '<div class="card">' +
          '<div class="card-head"><i class="ti ti-list-check" style="color:var(--blue-600)"></i><h2>Rekap To-Do Per Anggota — Bulan Ini</h2></div>' +
          '<div style="overflow-x:auto"><table class="data-table" style="min-width:500px"><thead><tr>' +
            '<th>Nama</th><th style="text-align:center">Hari Isi</th><th style="text-align:center">Total Tugas</th><th style="text-align:center">Dinilai</th><th style="text-align:center">Avg Skor</th><th>Progress Penilaian</th>' +
          '</tr></thead><tbody>' +
          todoStats2.map(function(s) {
            var e = s.emp;
            var c = s.avgTodoSkor>=80?'var(--green)':s.avgTodoSkor>=60?'var(--amber)':s.avgTodoSkor?'var(--red)':'var(--gray-400)';
            var pct = s.totalTugas ? Math.round(s.sudahSkor/s.totalTugas*100) : 0;
            var barC = pct>=80?'var(--green)':pct>=50?'var(--amber)':'var(--red)';
            return '<tr>' +
              '<td><div style="display:flex;align-items:center;gap:8px">' +
                '<div class="av" style="background:' + e.bg + ';color:#fff;width:30px;height:30px;font-size:10px">' + e.inits + '</div>' +
                '<div><div style="font-weight:600;font-size:13px">' + e.name + '</div><div style="font-size:10px;color:var(--gray-400)">' + (e.div||'') + '</div></div>' +
              '</div></td>' +
              '<td style="text-align:center;font-weight:600;color:var(--blue-600)">' + s.hariIsiTodo + '</td>' +
              '<td style="text-align:center;font-weight:700">' + s.totalTugas + '</td>' +
              '<td style="text-align:center"><span style="font-weight:600;color:var(--green)">' + s.sudahSkor + '</span><span style="color:var(--gray-300)"> / </span><span style="color:var(--gray-500)">' + s.totalTugas + '</span></td>' +
              '<td style="text-align:center">' +
                (s.avgTodoSkor !== null
                  ? '<div style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;border:2.5px solid ' + c + ';font-weight:800;font-size:12px;color:' + c + '">' + s.avgTodoSkor + '</div>'
                  : '<span style="color:var(--gray-400);font-size:12px">—</span>') +
              '</td>' +
              '<td style="min-width:120px"><div style="display:flex;align-items:center;gap:8px">' +
                '<div style="flex:1;height:8px;border-radius:99px;background:var(--gray-200)"><div style="height:100%;width:' + pct + '%;border-radius:99px;background:' + barC + '"></div></div>' +
                '<span style="font-size:11px;font-weight:600;color:' + barC + ';min-width:32px">' + pct + '%</span>' +
              '</div></td>' +
            '</tr>';
          }).join('') +
          '</tbody></table></div>' +
        '</div>' +

        /* ---- ARSIP TO-DO HARIAN ---- */
        (function(){
          // Kumpulkan semua tanggal unik yang ada to-do dari anggota tim ini
          var encEmails = targetEmps.map(function(emp){ return emp.email.replace(/[.#$\[\]]/g,'_'); });
          var allDates = {};
          Object.keys(DB.todos).forEach(function(k){
            encEmails.forEach(function(enc){
              if (k.startsWith(enc + '_')) {
                var tgl = k.slice(enc.length + 1); // YYYY-MM-DD
                if (/^\d{4}-\d{2}-\d{2}$/.test(tgl)) allDates[tgl] = true;
              }
            });
          });
          // Urutkan dari terbaru, ambil 30 hari terakhir (selain hari ini)
          var sortedDates = Object.keys(allDates).filter(function(d){ return d !== todayL2; }).sort().reverse().slice(0,30);

          if (!sortedDates.length) {
            return '<div class="card"><div class="card-head"><i class="ti ti-archive" style="color:var(--blue-600)"></i><h2>Arsip To-Do Harian</h2></div>' +
              '<div style="text-align:center;padding:32px;color:var(--gray-400);font-size:13px"><i class="ti ti-calendar-off" style="font-size:32px;display:block;margin-bottom:8px"></i>Belum ada data to-do dari hari sebelumnya</div></div>';
          }

          // Bangun opsi tanggal
          var tglOptions = sortedDates.map(function(d){
            var dd = new Date(d);
            var hariNm = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'][dd.getDay()];
            var blnNm  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'][dd.getMonth()];
            return '<option value="' + d + '">' + hariNm + ', ' + dd.getDate() + ' ' + blnNm + ' ' + dd.getFullYear() + '</option>';
          }).join('');

          // Render to-do untuk tanggal yang dipilih (default: tanggal paling baru)
          function renderArsipTgl(tgl) { return renderArsipTglRow(tgl, targetEmps); }

          var defaultTgl = sortedDates[0];
          var defaultContent = renderArsipTgl(defaultTgl);

          return '<div class="card">' +
            '<div class="card-head">' +
              '<i class="ti ti-archive" style="color:var(--blue-600)"></i>' +
              '<h2>Arsip To-Do Harian</h2>' +
              '<span style="font-size:11px;color:var(--gray-400);margin-left:4px">· ' + sortedDates.length + ' hari tersimpan</span>' +
            '</div>' +
            '<div class="info-bar info-blue" style="margin-bottom:14px"><i class="ti ti-info-circle"></i>Pilih tanggal untuk melihat rekap to-do seluruh anggota tim. Tampilan lengkap beserta skor dan komentar koordinator.</div>' +

            /* Selector tanggal sebagai chip/tab horizontal scroll */
            '<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:10px;margin-bottom:14px;-webkit-overflow-scrolling:touch" id="arsip-tgl-chips">' +
            sortedDates.map(function(d, idx){
              var dd = new Date(d);
              var hariNm = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'][dd.getDay()];
              var blnNm  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'][dd.getMonth()];
              var isActive = (idx === 0);
              return '<button id="chip-' + d + '" onclick="arsipPilihTgl(\'' + d + '\')" ' +
                'style="flex-shrink:0;padding:6px 12px;border-radius:99px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font);border:1.5px solid ' + (isActive?'var(--blue-500)':'var(--gray-200)') + ';background:' + (isActive?'var(--blue-600)':'var(--white)') + ';color:' + (isActive?'#fff':'var(--gray-600)') + ';transition:all .15s">' +
                hariNm + ' ' + dd.getDate() + '/' + (dd.getMonth()+1) +
              '</button>';
            }).join('') +
            '</div>' +

            /* Konten arsip */
            '<div id="arsip-todo-content">' +
              '<div style="font-size:12px;font-weight:600;color:var(--gray-500);margin-bottom:10px;display:flex;align-items:center;gap:6px">' +
                '<i class="ti ti-calendar" style="color:var(--blue-500)"></i>' +
                '<span id="arsip-tgl-label">' + (function(){ var d=new Date(defaultTgl); var h=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][d.getDay()]; var b=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][d.getMonth()]; return h+', '+d.getDate()+' '+b+' '+d.getFullYear(); })() + '</span>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:12px" id="arsip-grid">' +
                defaultContent +
              '</div>' +
            '</div>' +
          '</div>';
        })() +

        /* To-Do Hari Ini */
        '<div class="card"><div class="card-head"><i class="ti ti-calendar-check" style="color:var(--blue-600)"></i><h2>To-Do Hari Ini</h2><span class="realtime-badge" style="margin-left:8px"><i class="ti ti-circle-filled"></i>Live</span></div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:12px">' +
        targetEmps.map(function(emp) {
          var tkKey = attendKeyFor(emp.email, todayL2);
          var todos = (DB.todos[tkKey]||[]).filter(function(t){ return t.task&&t.task.trim(); });
          var doneTodos = todos.filter(function(t){ var s=t.koreksi_skor!==null&&t.koreksi_skor!==undefined?t.koreksi_skor:t.score; return s!==null&&s!==undefined; });
          var rec = DB.attendance[tkKey] || {};
          var avgS = doneTodos.length ? Math.round(doneTodos.reduce(function(a,t){ var s=t.koreksi_skor!==null&&t.koreksi_skor!==undefined?t.koreksi_skor:t.score; return a+(s||0); },0)/doneTodos.length) : null;
          var avgColor = avgS>=80?'var(--green)':avgS>=60?'var(--amber)':avgS?'var(--red)':'var(--gray-400)';
          return '<div style="border:1px solid var(--gray-200);border-radius:var(--radius-lg);padding:14px;background:var(--white)">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--gray-100)">' +
              '<div class="av" style="background:' + emp.bg + ';color:#fff;width:34px;height:34px;font-size:11px;flex-shrink:0">' + emp.inits + '</div>' +
              '<div style="flex:1;min-width:0">' +
                '<div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + emp.name + '</div>' +
                '<div style="font-size:10px;color:var(--gray-400);margin-top:2px">' + (emp.div||'') + ' · ' + doneTodos.length + '/' + todos.length + ' dinilai</div>' +
              '</div>' +
              (avgS !== null
                ? '<div style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;border:2.5px solid ' + avgColor + ';font-weight:800;font-size:13px;color:' + avgColor + ';flex-shrink:0">' + avgS + '</div>'
                : '<div style="width:38px;height:38px;border-radius:50%;border:2px solid var(--gray-200);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--gray-300);flex-shrink:0">—</div>') +
            '</div>' +
            (todos.length === 0
              ? '<div style="text-align:center;padding:14px 0;color:var(--gray-300);font-size:12px"><i class="ti ti-clipboard-x" style="font-size:20px;display:block;margin-bottom:4px"></i>Belum mengisi</div>'
              : '<div style="display:flex;flex-direction:column;gap:5px">' +
                todos.map(function(t, ti){
                  var s = t.koreksi_skor!==null&&t.koreksi_skor!==undefined?t.koreksi_skor:t.score;
                  var hasS = s!==null&&s!==undefined;
                  var sc = hasS?(s>=80?'var(--green)':s>=60?'var(--amber)':'var(--red)'):'var(--gray-300)';
                  return '<div style="padding:7px 9px;background:var(--gray-50);border-radius:8px;border-left:3px solid ' + (hasS?sc:'var(--gray-200)') + '">' +
                    '<div style="display:flex;align-items:center;gap:7px">' +
                      '<span style="font-size:10px;font-weight:700;color:var(--gray-400);min-width:16px">' + (ti+1) + '.</span>' +
                      '<div style="flex:1;font-size:12px;color:var(--gray-800);font-weight:500">' + t.task + '</div>' +
                      (hasS ? '<span style="font-weight:800;font-size:13px;color:' + sc + ';flex-shrink:0">' + s + '</span>' : '<span style="font-size:11px;color:var(--gray-300)">—</span>') +
                    '</div>' +
                    (t.komentar_koor ? '<div style="margin-top:5px;padding:4px 7px;background:var(--blue-50);border-radius:5px;font-size:11px;color:var(--blue-800);display:flex;gap:4px"><i class="ti ti-message-circle" style="font-size:11px;flex-shrink:0;margin-top:1px"></i>' + t.komentar_koor + '</div>' : '') +
                  '</div>';
                }).join('') +
              '</div>') +
          '</div>';
        }).join('') +
        '</div></div>' +
      '</div>'
    );
  }

  if (id === 'teguran') return (
    '<div class="page-header"><h1>Kirim Teguran</h1><p>Berikan teguran kepada anggota tim</p></div>' +
    '<div class="card"><div class="card-head"><i class="ti ti-bell" style="color:var(--amber)"></i><h2>Formulir Teguran</h2></div>' +
    '<div class="info-bar info-amber"><i class="ti ti-alert-triangle"></i>Teguran akan otomatis diteruskan ke HRD dan dicatat dalam sistem.</div>' +
    '<div class="field"><label>Pilih Anggota Tim</label><select id="k-emp">' + timku.map(function(e){ return '<option>' + e.name + '</option>'; }).join('') + '</select></div>' +
    '<div class="field"><label>Jenis Pelanggaran</label><select id="k-pelang"><option>Terlambat absen pagi</option><option>Tidak menyalakan Hubstaff</option><option>Tidak mengisi to-do list</option><option>Tidak hadir zoom pagi</option><option>Lainnya</option></select></div>' +
    '<div class="field"><label>Keterangan Detail</label><textarea id="k-alasan" placeholder="Jelaskan kronologi pelanggaran..."></textarea></div>' +
    '<div style="display:flex;justify-content:flex-end"><button class="btn btn-primary" onclick="kirimSanksiKoor()"><i class="ti ti-send"></i>Kirim Teguran</button></div></div>'
  );
  if (id === 'akunsaya') {
    return (
      '<div class="page-header"><h1>Akun Saya</h1><p>Kelola informasi akun dan password login Anda</p></div>' +
      '<div class="card"><div class="card-head"><i class="ti ti-id-badge" style="color:var(--blue-600)"></i><h2>Informasi Akun</h2></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px" class="pengaturan-grid">' +
        '<div class="field" style="margin:0"><label>Nama</label><input type="text" value="' + (currentUser.name||'') + '" disabled/></div>' +
        '<div class="field" style="margin:0"><label>Email / Username</label><input type="text" value="' + currentUser.email + '" disabled/></div>' +
      '</div></div>' +
      '<div class="card"><div class="card-head"><i class="ti ti-lock" style="color:var(--amber)"></i><h2>Ganti Password</h2></div>' +
      '<div class="info-bar info-blue"><i class="ti ti-info-circle"></i>Masukkan password lama Anda untuk verifikasi, lalu isi password baru minimal 6 karakter.</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px" class="pengaturan-grid">' +
        '<div class="field" style="margin:0"><label>Password Lama</label>' +
          '<div style="position:relative"><input type="password" id="cp-old" placeholder="Password saat ini" style="padding-right:38px"/>' +
          '<button type="button" onclick="togglePassFieldGeneric(\'cp-old\',\'cp-old-eye\')" tabindex="-1" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--gray-400);cursor:pointer;padding:4px;display:flex;align-items:center"><i class="ti ti-eye" id="cp-old-eye" style="font-size:15px"></i></button></div>' +
        '</div>' +
        '<div class="field" style="margin:0"><label>Password Baru</label>' +
          '<div style="position:relative"><input type="password" id="cp-new" placeholder="Min. 6 karakter" style="padding-right:38px"/>' +
          '<button type="button" onclick="togglePassFieldGeneric(\'cp-new\',\'cp-new-eye\')" tabindex="-1" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--gray-400);cursor:pointer;padding:4px;display:flex;align-items:center"><i class="ti ti-eye" id="cp-new-eye" style="font-size:15px"></i></button></div>' +
        '</div>' +
        '<div class="field" style="margin:0"><label>Konfirmasi Password Baru</label>' +
          '<div style="position:relative"><input type="password" id="cp-confirm" placeholder="Ulangi password baru" style="padding-right:38px"/>' +
          '<button type="button" onclick="togglePassFieldGeneric(\'cp-confirm\',\'cp-confirm-eye\')" tabindex="-1" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--gray-400);cursor:pointer;padding:4px;display:flex;align-items:center"><i class="ti ti-eye" id="cp-confirm-eye" style="font-size:15px"></i></button></div>' +
        '</div>' +
      '</div>' +
      '<div class="err-msg" id="cp-err"><i class="ti ti-alert-circle"></i> <span id="cp-err-msg">Periksa kembali isian Anda</span></div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:12px">' +
        '<button class="btn btn-primary" onclick="gantiPasswordSendiri()"><i class="ti ti-device-floppy"></i>Simpan Password Baru</button>' +
      '</div></div>'
    );
  }
  return '';
}

// ---- KARYAWAN ----
