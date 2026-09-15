/* ============================================================
 * FILE   : 08-page-kary.js
 * BAGIAN : Halaman Karyawan
 * ISI    : Seluruh tampilan & logika dashboard Karyawan (staff).
 * ============================================================ */

// Konten grafik "Performa Saya" — dipisah jadi fungsi supaya filter tampilan (bulan tertentu /
// 3 bulan terakhir / rata-rata bulanan) bisa membangun ulang HANYA bagian grafik ini lewat
// applyGrafikSaya() di 17-filter-select-hapus.js, tanpa reload seluruh halaman.
function buildGrafikSayaContent(mode, threshold) {
  threshold = threshold ?? (DB.settings.minSkorRataRata ?? 70);
  var chartTitle, chartInfo, chartHtml;

  if (mode.type === 'month') {
    var bulanLabel = new Date(mode.bulanKey + '-01').toLocaleDateString('id-ID',{month:'long',year:'numeric'});
    chartTitle = 'Skor Harian — ' + bulanLabel;
    chartInfo  = 'Skor harian Anda untuk bulan ' + bulanLabel + '. Garis putus-putus menandai ambang batas minimum (' + threshold + ').';
    chartHtml  = buildSkorHarianBulanChart([currentUser.email], mode.bulanKey, threshold);
  } else if (mode.type === 'range') {
    chartTitle = 'Skor Harian — ' + mode.numMonths + ' Bulan Terakhir';
    chartInfo  = 'Skor harian Anda selama ' + mode.numMonths + ' bulan terakhir. Garis putus-putus menandai ambang batas minimum (' + threshold + ').';
    chartHtml  = buildSkorHarianRentangChart([currentUser.email], mode.numMonths, threshold);
  } else {
    chartTitle = 'Rata-rata Bulanan — ' + mode.numMonths + ' Bulan Terakhir';
    chartInfo  = 'Rata-rata skor harian Anda per bulan.';
    chartHtml  = buildSkorBulananChart([currentUser.email], mode.numMonths, threshold);
  }

  return '<div class="card-head" style="margin-bottom:10px"><h3 style="font-size:13px;font-weight:700;color:var(--gray-600);margin:0">' + chartTitle + '</h3></div>' +
    '<div class="info-bar info-blue" style="margin-bottom:12px"><i class="ti ti-info-circle"></i>' + chartInfo + '</div>' +
    chartHtml;
}

function buildKARY(id) {
  var aKey   = attendKey(currentUser.email);
  var attend = DB.attendance[aKey] || {};
  var pagiDone  = !!attend.pagi;
  var siangDone = !!attend.siang;
  var pagiTime  = attend.pagi || '--:--';
  var siangTime = attend.siang || '--:--';
  var myEmp  = DB.employees.find(function(e){ return e.email===currentUser.email; }) || {};

  if (id === 'beranda') {
    var jam = new Date().getHours();
    var sapa = jam<12?'pagi':jam<15?'siang':'sore';
    return (
      '<div class="hero-card">' +
        '<div class="hero-name">Selamat ' + sapa + ', ' + currentUser.name.split(' ')[0] + '! 👋</div>' +
        '<div class="hero-role">Karyawan · ' + (myEmp.div||'') + ' · Koordinator: ' + (myEmp.koor||'') + '</div>' +
        '<div class="hero-stats">' +
          '<div class="hero-stat"><div class="hs-val">21</div><div class="hs-lbl">Hari Hadir</div></div>' +
          '<div class="hero-stat"><div class="hs-val">' + (myEmp.pelanggaran||0) + '</div><div class="hs-lbl">Pelanggaran</div></div>' +
          '<div class="hero-stat">' +
            '<div class="hs-val">' + (myEmp.skor!=null ? myEmp.skor : '—') + '</div>' +
            '<div class="hs-lbl">Avg Skor</div>' +
            (function(){
              // Pengingat langsung di sini, dihitung LIVE dari myEmp.skor (data terkini) —
              // bukan dari teks notifikasi lama yang bisa sudah tidak sinkron dengan skor
              // terbaru. Jadi angka yang tampil selalu konsisten dengan yang di atasnya.
              var threshold = DB.settings.minSkorRataRata ?? 70;
              if (myEmp.skor == null || myEmp.skor >= threshold) return '';
              return '<div style="font-size:10.5px;color:#FDBA74;margin-top:5px;line-height:1.4;max-width:180px">' +
                '<i class="ti ti-alert-triangle" style="font-size:11px"></i> Di bawah target ' + threshold + '. Minta koordinator nilai To-Do &amp; Komunikasi Anda.' +
              '</div>';
            })() +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="card"><div class="card-head"><i class="ti ti-timeline"></i><h2>Alur Harian WFA</h2></div>' +
        '<div class="timeline">' +
          '<div class="tl-item"><div class="tl-dot" style="background:var(--green)"></div><div class="tl-time">Sebelum ' + DB.settings.batasPagi + '</div><div class="tl-text">Zoom koordinasi → Absen pagi + GPS → Isi to-do list</div></div>' +
          '<div class="tl-item"><div class="tl-dot" style="background:var(--amber)"></div><div class="tl-time">Lewat batas</div><div class="tl-text">Dihitung terlambat — bonus kehadiran tidak diberikan</div></div>' +
          '<div class="tl-item"><div class="tl-dot" style="background:var(--blue-500)"></div><div class="tl-time">Sepanjang hari</div><div class="tl-text">Hubstaff wajib aktif — dimonitor koordinator</div></div>' +
          '<div class="tl-item"><div class="tl-dot" style="background:var(--gray-300)"></div><div class="tl-time">Mulai ' + DB.settings.mulaiSiang + '</div><div class="tl-text">Absen siang + GPS → Beri skor to-do list pagi</div></div>' +
        '</div></div>' +

      /* ---- ZOOM WIDGET FOR KARYAWAN ---- */
      (function(){
        var myKoor    = myEmp.koor || '';
        var todayMeet = (DB.zoomMeetings||[]).filter(function(m){ return m.koor===myKoor && m.tanggal===todayKey(); });
        var upcoming  = (DB.zoomMeetings||[]).filter(function(m){ return m.koor===myKoor && m.tanggal>todayKey(); }).slice(0,3);
        var allShow   = todayMeet.concat(upcoming);

        // Tidak ada meeting sama sekali
        if (!allShow.length) return (
          '<div class="card"><div class="card-head"><i class="ti ti-video" style="color:var(--blue-500)"></i><h2>Zoom Meeting</h2></div>' +
          '<div style="padding:16px;text-align:center;color:var(--gray-400);font-size:13px"><i class="ti ti-calendar-off" style="font-size:24px;display:block;margin-bottom:6px"></i>Belum ada jadwal zoom dari koordinator Anda</div></div>'
        );

        // Cek syarat: absen pagi + minimal 1 todo terisi
        var aKey       = attendKey(currentUser.email);
        var sudahAbsen = !!(DB.attendance[aKey] && DB.attendance[aKey].pagi);
        var todoHari   = (DB.todos[aKey] || []).filter(function(t){ return t.task && t.task.trim(); });
        var sudahTodo  = todoHari.length > 0;
        var bolehLihat = sudahAbsen && sudahTodo;

        // Cek syarat yang belum terpenuhi untuk pesan spesifik
        var checklist = [
          { done: sudahAbsen, label: 'Absen pagi',    icon: 'ti-sun',       action: 'showPage(\'kary\',\'absen\')',  aksi: 'Absen Sekarang' },
          { done: sudahTodo,  label: 'Isi To-Do List', icon: 'ti-list-check', action: 'showPage(\'kary\',\'todo\')', aksi: 'Isi To-Do' },
        ];
        var semuaDone = checklist.every(function(c){ return c.done; });

        // Header card
        var headerBg    = semuaDone ? '' : 'background:var(--amber-light);border-color:#fde68a;';
        var headerIcon  = semuaDone ? 'color:var(--blue-500)' : 'color:var(--amber)';
        var headerTitle = semuaDone ? 'Zoom Meeting' : 'Zoom Meeting — Selesaikan Dulu';

        var html = '<div class="card" style="' + (semuaDone?'':'border:1.5px solid #fde68a;') + '">' +
          '<div class="card-head"><i class="ti ti-video" style="' + headerIcon + '"></i><h2>' + headerTitle + '</h2></div>';

        // Jika syarat BELUM terpenuhi → tampil notif + checklist
        if (!semuaDone) {
          html += '<div class="info-bar info-amber" style="margin-bottom:14px">' +
            '<i class="ti ti-bell-ringing"></i>' +
            '<div><strong>Ada meeting dari koordinator!</strong><br>Selesaikan tugas berikut untuk membuka undangan zoom:</div>' +
          '</div>';

          // Checklist progress
          html += '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">';
          checklist.forEach(function(c){
            html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--radius);background:' + (c.done?'var(--green-light)':'var(--gray-50)') + ';border:1px solid ' + (c.done?'#6ee7b7':'var(--gray-200)') + '">' +
              '<i class="ti ' + (c.done?'ti-circle-check':'ti-circle') + '" style="font-size:18px;color:' + (c.done?'var(--green)':'var(--gray-300)') + '"></i>' +
              '<div style="flex:1;font-size:13px;font-weight:' + (c.done?'600':'500') + ';color:' + (c.done?'#065f46':'var(--gray-700)') + '">' + c.label + (c.done?' <span style="font-weight:400;color:var(--gray-400)">✓ Selesai</span>':'') + '</div>' +
              (!c.done ? '<button onclick="' + c.action + '" style="padding:7px 12px;background:var(--blue-600);color:#fff;border:none;border-radius:var(--radius);font-size:12px;font-weight:600;cursor:pointer"><i class="ti ti-arrow-right" style="font-size:12px"></i> ' + c.aksi + '</button>' : '') +
            '</div>';
          });
          html += '</div>';

          // Pratinjau judul meeting (tanpa link)
          html += '<div style="opacity:0.55;pointer-events:none;filter:blur(1px)">';
          allShow.forEach(function(m){
            var isToday = m.tanggal===todayKey();
            html += '<div style="border:1.5px solid var(--gray-200);border-radius:var(--radius-lg);padding:14px;margin-bottom:8px;background:var(--gray-50)">' +
              '<span class="badge ' + (isToday?'badge-green':'badge-gray') + '" style="margin-bottom:8px">' + (isToday?'Hari Ini · ':'') + m.tanggal + ' · ' + m.jam + '</span>' +
              (m.penting?'<span class="badge badge-red" style="margin-left:6px">Penting</span>':'') +
              '<div style="font-size:14px;font-weight:700;color:var(--gray-800);margin-bottom:6px">' + m.judul + '</div>' +
              '<div style="display:inline-flex;align-items:center;gap:7px;padding:9px 16px;background:var(--gray-300);color:#fff;border-radius:var(--radius);font-size:13px;font-weight:600">' +
                '<i class="ti ti-lock"></i>Link Terkunci' +
              '</div>' +
            '</div>';
          });
          html += '</div>';

        } else {
          // Syarat TERPENUHI → tampil link lengkap
          html += '<div class="info-bar info-green" style="margin-bottom:14px">' +
            '<i class="ti ti-circle-check"></i>' +
            '<div>Absen & to-do list selesai. Link meeting tersedia di bawah ini.</div>' +
          '</div>';
          allShow.forEach(function(m){
            var isToday = m.tanggal===todayKey();
            html += '<div style="border:1.5px solid ' + (m.penting?'var(--red)':isToday?'var(--blue-300)':'var(--gray-200)') + ';border-radius:var(--radius-lg);padding:14px;margin-bottom:10px;background:' + (m.penting?'var(--red-light)':isToday?'var(--blue-50)':'var(--white)') + '">' +
              '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px">' +
                '<span class="badge ' + (isToday?'badge-green':'badge-gray') + '">' + (isToday?'Hari Ini · ':'') + m.tanggal + ' · ' + m.jam + '</span>' +
                (m.penting?'<span class="badge badge-red"><i class="ti ti-alert-circle"></i>Penting</span>':'') +
              '</div>' +
              '<div style="font-size:15px;font-weight:700;color:var(--gray-800);margin-bottom:4px">' + m.judul + '</div>' +
              (m.catatan?'<div style="font-size:12px;color:var(--gray-500);margin-bottom:10px">' + m.catatan + '</div>':'') +
              (m.buktiFoto || (m.buktiFotos && m.buktiFotos.length)
                ? '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;margin-bottom:6px;font-size:11px;color:var(--green)"><i class="ti ti-circle-check"></i>' + ((m.buktiFotos||[m.buktiFoto]).length) + ' bukti foto meeting sudah diunggah koordinator</div>'
                : '') +
              '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
                '<a href="' + m.link + '" target="_blank" style="display:inline-flex;align-items:center;gap:7px;padding:10px 18px;background:var(--blue-600);color:#fff;border-radius:var(--radius);font-size:13px;font-weight:600;text-decoration:none">' +
                  '<i class="ti ti-video"></i>Buka Link Zoom</a>' +
                '<button onclick="navigator.clipboard.writeText(\'' + m.link.replace(/'/g,"\\'") + '\').then(function(){showToast(\'Link disalin!\',\'success\')})" style="display:inline-flex;align-items:center;gap:6px;padding:10px 14px;background:var(--gray-100);border:1px solid var(--gray-200);border-radius:var(--radius);font-size:13px;font-weight:600;cursor:pointer"><i class="ti ti-copy"></i>Salin Link</button>' +
              '</div>' +
            '</div>';
          });
        }

        html += '</div>';
        return html;
      })() +

      // ---- KARTU KETENTUAN PENILAIAN SKOR ----
      // Selalu tampil di Beranda supaya karyawan paham cara skor dihitung, dan proaktif
      // meminta koordinator menilai To-Do & Komunikasi (bukan cuma menunggu, karena kolom
      // yang belum dinilai dihitung 0 dan ikut menurunkan Skor Akhir).
      '<div class="card" style="border:1.5px solid var(--blue-200);background:var(--blue-50)">' +
        '<div class="card-head"><i class="ti ti-clipboard-text" style="color:var(--blue-600)"></i><h2>Ketentuan Penilaian Skor</h2></div>' +
        '<div style="font-size:13px;color:var(--gray-700);line-height:1.7">' +
          '<p style="margin:0 0 10px">Skor Akhir harian Anda adalah gabungan 3 komponen sesuai bobot yang ditetapkan HRD:</p>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">' +
            '<div style="flex:1;min-width:100px;text-align:center;padding:10px;background:#fff;border-radius:var(--radius);border:1px solid var(--gray-200)"><div style="font-size:11px;color:var(--gray-500)">Absen</div><div style="font-size:18px;font-weight:700;color:var(--blue-600)">' + (DB.settings.bobotAbsen ?? 34) + '%</div></div>' +
            '<div style="flex:1;min-width:100px;text-align:center;padding:10px;background:#fff;border-radius:var(--radius);border:1px solid var(--gray-200)"><div style="font-size:11px;color:var(--gray-500)">To-Do</div><div style="font-size:18px;font-weight:700;color:var(--blue-600)">' + (DB.settings.bobotTodo ?? 33) + '%</div></div>' +
            '<div style="flex:1;min-width:100px;text-align:center;padding:10px;background:#fff;border-radius:var(--radius);border:1px solid var(--gray-200)"><div style="font-size:11px;color:var(--gray-500)">Komunikasi</div><div style="font-size:18px;font-weight:700;color:var(--blue-600)">' + (DB.settings.bobotKomunikasi ?? 33) + '%</div></div>' +
          '</div>' +
          '<div class="info-bar info-amber" style="margin:0"><i class="ti ti-alert-triangle"></i><div><strong>Penting:</strong> Kolom To-Do dan Komunikasi yang <u>belum dinilai koordinator</u> dihitung <strong>0</strong> — walaupun absen Anda sudah lengkap. Jangan hanya menunggu; <strong>segera hubungi koordinator Anda</strong> agar To-Do List &amp; Komunikasi hari ini dinilai, supaya Skor Akhir Anda tetap akurat.</div></div>' +
        '</div>' +
      '</div>'
    );
  }

  if (id === 'absen') {
    var isLate = pagiDone && attend.status==='terlambat';
    return (
      '<div class="page-header"><h1>Absensi + GPS ' + rtBadge() + '</h1><p>Absen pagi & siang dengan verifikasi lokasi</p></div>' +
      '<div class="absen-grid">' +
        '<div class="absen-card ' + (pagiDone?(isLate?'done-amber':'done-green'):'') + '">' +
          '<div class="ac-icon"><i class="ti ti-sun"></i></div>' +
          '<div class="ac-label">Absen Pagi</div>' +
          '<div class="ac-time">' + pagiTime + '</div>' +
          '<div class="ac-note">' + (pagiDone?(isLate?'Terlambat':'Tepat waktu'):'Belum absen') + '</div>' +
        '</div>' +
        '<div class="absen-card ' + (siangDone?'done-green':'') + '" style="' + (pagiDone?'':'opacity:0.5') + '">' +
          '<div class="ac-icon"><i class="ti ti-moon"></i></div>' +
          '<div class="ac-label">Absen Siang</div>' +
          '<div class="ac-time">' + siangTime + '</div>' +
          '<div class="ac-note">' + (siangDone?'Sudah absen':'Tersedia mulai ' + DB.settings.mulaiSiang) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="card"><div class="card-head"><i class="ti ti-map-pin" style="color:var(--blue-600)"></i><h2>Verifikasi Lokasi GPS</h2></div>' +
        '<div class="gps-box"><div class="gps-status">' +
          '<div class="gps-dot detecting" id="gps-dot"></div>' +
          '<div><div class="gps-label" id="gps-label">Mendeteksi lokasi...</div><div class="gps-coord" id="gps-coord">Meminta izin lokasi</div></div>' +
          '<button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="initGPS()"><i class="ti ti-refresh"></i>Refresh</button>' +
        '</div>' +
        '<div class="gps-map-mini" id="gps-map"><div class="map-placeholder"><i class="ti ti-map-2"></i><p>Menunggu GPS...</p></div></div></div>' +
        (!pagiDone ?
          '<div class="info-bar info-amber"><i class="ti ti-alert-triangle"></i>Absen pagi wajib sebelum jam ' + DB.settings.batasPagi + '. Lewat dari itu dihitung terlambat.</div>' +
          '<div class="field"><label>Lokasi WFA hari ini</label><input type="text" id="k-lokasi" placeholder="Contoh: Rumah, Kafe, Co-working Space..."/></div>' +
          '<div style="display:flex;justify-content:flex-end"><button class="btn btn-primary" onclick="karyAbsenPagi()"><i class="ti ti-map-pin"></i>Absen Pagi Sekarang</button></div>'
          : '<div class="info-bar info-green"><i class="ti ti-check"></i>Absen pagi sudah tercatat pukul ' + pagiTime + '. Jangan lupa absen siang mulai ' + DB.settings.mulaiSiang + '.</div>') +
        (pagiDone && !siangDone ?
          '<div class="divider"></div>' +
          '<div class="card-head"><i class="ti ti-moon" style="color:var(--blue-500)"></i><h2>Absen Siang</h2></div>' +
          '<div class="field"><label>Catatan progress siang</label><textarea id="k-siang-cat" placeholder="Apa yang sudah diselesaikan?"></textarea></div>' +
          '<div style="display:flex;justify-content:flex-end"><button class="btn btn-primary" onclick="karyAbsenSiang()"><i class="ti ti-map-pin"></i>Absen Siang + GPS</button></div>'
          : '') +
        (siangDone ? '<div class="info-bar info-green"><i class="ti ti-check-circle"></i>Absen siang sudah tercatat pukul ' + siangTime + '. Jangan lupa isi skor to-do list!</div>' : '') +
      '</div>'
    );
  }

  if (id === 'todo') {
    var aKey      = attendKey(currentUser.email);
    var rec       = DB.attendance[aKey] || {};
    var sudahPagi = !!rec.pagi;
    var sudahSiang= !!rec.siang;
    var fase = sudahSiang ? 'siang' : 'pagi';
    var subtitle = fase==='pagi'
      ? 'Fase Pagi — Tulis rencana kerja dan kirim ke koordinator'
      : 'Fase Siang — Beri penilaian skor untuk to-do list pagi Anda';
    return '<div class="page-header"><h1>To-Do List Harian</h1><p>' + subtitle + '</p></div><div id="todo-container"></div>';
  }

  if (id === 'hubstaff') {
    var aKey      = attendKey(currentUser.email);
    var rec       = DB.attendance[aKey] || {};
    var sudahPagi = !!rec.pagi;
    var sudahTodo = (DB.todos[aKey]||[]).filter(function(t){ return t.task&&t.task.trim(); }).length > 0;
    var siapHubs  = sudahPagi && sudahTodo;

    return (
      '<div class="page-header"><h1>Hubstaff</h1><p>Aktifkan time tracking sebelum mulai bekerja</p></div>' +

      // Status syarat
      '<div class="card">' +
        '<div class="card-head"><i class="ti ti-checklist" style="color:var(--blue-600)"></i><h2>Status Persiapan Kerja</h2></div>' +
        '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">' +
          '<div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:var(--radius);background:' + (sudahPagi?'var(--green-light)':'var(--gray-50)') + ';border:1px solid ' + (sudahPagi?'#6ee7b7':'var(--gray-200)') + '">' +
            '<i class="ti ' + (sudahPagi?'ti-circle-check':'ti-circle') + '" style="font-size:20px;color:' + (sudahPagi?'var(--green)':'var(--gray-300)') + '"></i>' +
            '<div style="flex:1"><div style="font-weight:600;font-size:13px">' + (sudahPagi?'Absen Pagi ✓ — '+rec.pagi:'Belum Absen Pagi') + '</div>' +
            '<div style="font-size:12px;color:var(--gray-500)">' + (sudahPagi?'Kehadiran sudah tercatat':'Absen dulu sebelum mulai') + '</div></div>' +
            (!sudahPagi?'<button onclick="showPage(\'kary\',\'absen\')" class="btn btn-primary btn-sm">Absen Sekarang</button>':'') +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:var(--radius);background:' + (sudahTodo?'var(--green-light)':'var(--gray-50)') + ';border:1px solid ' + (sudahTodo?'#6ee7b7':'var(--gray-200)') + '">' +
            '<i class="ti ' + (sudahTodo?'ti-circle-check':'ti-circle') + '" style="font-size:20px;color:' + (sudahTodo?'var(--green)':'var(--gray-300)') + '"></i>' +
            '<div style="flex:1"><div style="font-weight:600;font-size:13px">' + (sudahTodo?'To-Do List ✓ — ' + (DB.todos[aKey]||[]).filter(function(t){return t.task&&t.task.trim();}).length + ' tugas':'Belum Isi To-Do List') + '</div>' +
            '<div style="font-size:12px;color:var(--gray-500)">' + (sudahTodo?'Rencana kerja sudah dikirim':'Isi to-do list terlebih dahulu') + '</div></div>' +
            (!sudahTodo?'<button onclick="showPage(\'kary\',\'todo\')" class="btn btn-primary btn-sm">Isi To-Do</button>':'') +
          '</div>' +
        '</div>' +
      '</div>' +

      // Tombol launch Hubstaff
      '<div class="card" style="' + (!siapHubs?'opacity:0.7':'') + '">' +
        '<div class="card-head"><i class="ti ti-device-laptop" style="color:' + (siapHubs?'#0078D4':'var(--gray-400)') + '"></i><h2>Buka Hubstaff</h2></div>' +

        (!siapHubs ?
          '<div class="info-bar info-amber" style="margin-bottom:16px"><i class="ti ti-lock"></i>Selesaikan absen pagi dan to-do list terlebih dahulu untuk mengaktifkan Hubstaff.</div>'
        :
          '<div class="info-bar info-green" style="margin-bottom:16px"><i class="ti ti-circle-check"></i>Semua persiapan selesai! Sekarang aktifkan Hubstaff dan mulai bekerja.</div>'
        ) +

        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
          (siapHubs
            ? '<div style="border:1.5px solid var(--blue-300);border-radius:var(--radius-lg);padding:20px;text-align:center"><i class="ti ti-device-laptop" style="font-size:36px;color:#0078D4;margin-bottom:10px;display:block"></i><div style="font-weight:700;font-size:14px;margin-bottom:4px">Aplikasi Desktop</div><div style="font-size:12px;color:var(--gray-500);margin-bottom:14px">Windows / Mac / Linux</div><a href="hubstaff://" style="display:inline-flex;align-items:center;gap:7px;padding:10px 18px;background:#0078D4;color:#fff;border-radius:var(--radius);font-size:13px;font-weight:600;text-decoration:none"><i class="ti ti-player-play"></i>Buka di Desktop</a></div>'
            : '<div style="border:1.5px dashed var(--gray-200);border-radius:var(--radius-lg);padding:20px;text-align:center;opacity:0.5"><i class="ti ti-device-laptop" style="font-size:36px;color:var(--gray-300);margin-bottom:10px;display:block"></i><div style="font-weight:700;font-size:14px;margin-bottom:4px;color:var(--gray-400)">Aplikasi Desktop</div><div style="font-size:12px;color:var(--gray-400);margin-bottom:14px">Windows / Mac / Linux</div><span style="display:inline-flex;align-items:center;gap:7px;padding:10px 18px;background:var(--gray-200);color:var(--gray-400);border-radius:var(--radius);font-size:13px;font-weight:600"><i class="ti ti-lock"></i>Terkunci</span></div>'
          ) +
          (siapHubs
            ? '<div style="border:1.5px solid var(--blue-300);border-radius:var(--radius-lg);padding:20px;text-align:center"><i class="ti ti-device-mobile" style="font-size:36px;color:#0078D4;margin-bottom:10px;display:block"></i><div style="font-weight:700;font-size:14px;margin-bottom:4px">Aplikasi Mobile</div><div style="font-size:12px;color:var(--gray-500);margin-bottom:14px">Android / iOS</div><a href="hubstaff://" style="display:inline-flex;align-items:center;gap:7px;padding:10px 18px;background:#0078D4;color:#fff;border-radius:var(--radius);font-size:13px;font-weight:600;text-decoration:none"><i class="ti ti-player-play"></i>Buka di HP</a></div>'
            : '<div style="border:1.5px dashed var(--gray-200);border-radius:var(--radius-lg);padding:20px;text-align:center;opacity:0.5"><i class="ti ti-device-mobile" style="font-size:36px;color:var(--gray-300);margin-bottom:10px;display:block"></i><div style="font-weight:700;font-size:14px;margin-bottom:4px;color:var(--gray-400)">Aplikasi Mobile</div><div style="font-size:12px;color:var(--gray-400);margin-bottom:14px">Android / iOS</div><span style="display:inline-flex;align-items:center;gap:7px;padding:10px 18px;background:var(--gray-200);color:var(--gray-400);border-radius:var(--radius);font-size:13px;font-weight:600"><i class="ti ti-lock"></i>Terkunci</span></div>'
          ) +
        '</div>' +

        // Fallback web
        '<div style="border-top:1px solid var(--gray-100);padding-top:14px">' +
          '<div style="font-size:12px;color:var(--gray-500);margin-bottom:8px"><i class="ti ti-info-circle" style="margin-right:4px"></i>Jika aplikasi tidak terbuka otomatis, gunakan Hubstaff web:</div>' +
          '<a href="https://app.hubstaff.com" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:var(--gray-100);border:1px solid var(--gray-200);border-radius:var(--radius);font-size:12px;font-weight:600;color:var(--gray-700);text-decoration:none">' +
            '<i class="ti ti-external-link"></i>Buka Hubstaff di Browser</a>' +
        '</div>' +
      '</div>' +

      // Panduan cara pakai
      '<div class="card"><div class="card-head"><i class="ti ti-help-circle" style="color:var(--gray-400)"></i><h2>Cara Menggunakan Hubstaff</h2></div>' +
        '<div style="display:flex;flex-direction:column;gap:10px">' +
          ['Buka aplikasi Hubstaff di laptop atau HP Anda',
           'Login dengan akun yang sudah didaftarkan perusahaan',
           'Pilih proyek yang sesuai dengan pekerjaan hari ini',
           'Klik tombol <strong>▶ Start</strong> untuk mulai tracking waktu',
           'Pastikan timer berjalan — ini akan terlihat oleh koordinator',
           'Klik <strong>■ Stop</strong> saat selesai bekerja atau istirahat panjang'
          ].map(function(step, i) {
            return '<div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--gray-50)">' +
              '<div style="width:24px;height:24px;background:var(--blue-600);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">' +
                '<span style="color:#fff;font-size:11px;font-weight:700">' + (i+1) + '</span>' +
              '</div>' +
              '<div style="font-size:13px;color:var(--gray-700);line-height:1.5">' + step + '</div>' +
            '</div>';
          }).join('') +
        '</div>' +
        '<div class="info-bar info-amber" style="margin-top:14px"><i class="ti ti-alert-triangle"></i>' +
          'Hubstaff yang tidak aktif saat jam kerja akan tercatat sebagai pelanggaran oleh koordinator.' +
        '</div>' +
      '</div>'
    );
  }

  if (id === 'riwayat') {
    // attendKey encode email, jadi kita cari dengan encoded key
    var encEmail = currentUser.email.replace(/[.#$\[\]]/g,'_');
    var allKeys  = Object.keys(DB.attendance).filter(function(k){
      return k.startsWith(encEmail + '_');
    }).sort().reverse();

    // Hitung statistik bulan ini
    var now       = new Date();
    var thisMonth = now.toISOString().slice(0,7); // "2026-06"
    var monthKeys = allKeys.filter(function(k){ return k.indexOf(thisMonth) >= 0; });

    var totalHadir    = 0, totalTerlambat = 0, totalTidakLengkap = 0;
    var skorArr = [];
    monthKeys.forEach(function(k){
      var r = DB.attendance[k];
      if (r.status==='hadir')      totalHadir++;
      if (r.status==='terlambat')  { totalHadir++; totalTerlambat++; }
      if (r.pagi && !r.siang)      totalTidakLengkap++;
      if (r.skor != null)          skorArr.push(Number(r.skor));
    });
    var avgSkor = skorArr.length ? Math.round(skorArr.reduce(function(a,b){return a+b;},0)/skorArr.length) : null;

    function komponenCellKary(val) {
      if (val === null || val === undefined) return '<span style="color:var(--gray-300)">—</span>';
      var c = val>=80?'var(--green)':val>=60?'var(--amber)':'var(--red)';
      return '<span style="font-weight:600;color:'+c+'">'+val+'</span>';
    }

    // Render baris riwayat — tampilkan SEMUA record meski tidak lengkap
    var riwayatRows = allKeys.map(function(k) {
      var rec     = DB.attendance[k];
      var tglStr  = k.replace(encEmail + '_', '');
      var tgl     = new Date(tglStr);
      var tglLabel= isNaN(tgl) ? tglStr : tgl.toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short'});

      // Tentukan status tampilan
      var statusTampil, statusColor;
      if (rec.pagi && rec.siang) {
        statusTampil = rec.status==='terlambat' ? '⚠ Terlambat' : '✓ Lengkap';
        statusColor  = rec.status==='terlambat' ? 'var(--amber)' : 'var(--green)';
      } else if (rec.pagi && !rec.siang) {
        statusTampil = '⚡ Pagi saja';
        statusColor  = 'var(--blue-500)';
      } else if (!rec.pagi && rec.siang) {
        statusTampil = '⚡ Siang saja';
        statusColor  = 'var(--blue-500)';
      } else {
        statusTampil = '— Tidak absen';
        statusColor  = 'var(--gray-400)';
      }

      var pagiCell  = rec.pagi  ? '<span style="font-weight:600;color:var(--green)">' + rec.pagi  + '</span>' : '<span style="color:var(--gray-300)">—</span>';
      var siangCell = rec.siang ? '<span style="font-weight:600;color:var(--blue-500)">' + rec.siang + '</span>' : '<span style="color:var(--gray-300)">—</span>';
      var skorCell  = rec.skor  ? '<span style="font-weight:700;color:' + (rec.skor>=80?'var(--green)':'var(--amber)') + '">' + rec.skor + '</span>' : '<span style="color:var(--gray-300)">—</span>';
      var safeId    = 'my-td-' + k.replace(/[^a-zA-Z0-9]/g,'_');
      var todoCount = ((DB.todos[k]||[]).filter(function(t){ return t.task && t.task.trim(); })).length;

      return '<tr>' +
        '<td style="text-align:center"><i class="ti ti-chevron-down" id="' + safeId + '-chev" style="cursor:' + (todoCount?'pointer':'default') + ';color:' + (todoCount?'var(--gray-400)':'var(--gray-200)') + ';font-size:15px" ' + (todoCount?('onclick="toggleTodoRiwayatKary(this,\''+k+'\')" title="Lihat to-do list tanggal ini"'):'') + '></i></td>' +
        '<td style="font-weight:600;white-space:nowrap">' + tglLabel + '</td>' +
        '<td>' + pagiCell  + '</td>' +
        '<td>' + siangCell + '</td>' +
        '<td style="color:var(--gray-500);font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (rec.lokasi||'—') + '</td>' +
        '<td style="text-align:center">' + komponenCellKary(rec.skorAbsen) + '</td>' +
        '<td style="text-align:center">' + komponenCellKary(rec.skorTodo) + '</td>' +
        '<td style="text-align:center">' + komponenCellKary(rec.skorKomunikasi) + '</td>' +
        '<td>' + skorCell + '</td>' +
        '<td><span style="font-size:11px;font-weight:600;color:' + statusColor + '">' + statusTampil + '</span></td>' +
      '</tr>' +
      '<tr id="' + safeId + '-detail" style="display:none"><td colspan="10" class="mytd-detail-cell" data-loaded="0" style="padding:0;background:var(--gray-50)"></td></tr>';
    });

    return (
      '<div class="page-header"><h1>Riwayat Absensi ' + rtBadge() + '</h1><p>Catatan kehadiran Anda — semua data ditampilkan meski tidak lengkap. Klik panah untuk lihat to-do list tanggal tsb.</p></div>' +

      // Metrik bulan ini
      '<div class="metrics">' +
        '<div class="metric-box"><div class="mb-label">Hadir Bulan Ini</div><div class="mb-val" style="color:var(--green)">' + totalHadir + '</div><div class="mb-sub">' + thisMonth + '</div></div>' +
        '<div class="metric-box"><div class="mb-label">Terlambat</div><div class="mb-val" style="color:var(--amber)">' + totalTerlambat + '</div></div>' +
        '<div class="metric-box"><div class="mb-label">Tidak Lengkap</div><div class="mb-val" style="color:var(--blue-500)">' + totalTidakLengkap + '</div><div class="mb-sub">Pagi/siang saja</div></div>' +
        '<div class="metric-box"><div class="mb-label">Avg Skor</div><div class="mb-val" style="color:var(--blue-700)">' + (avgSkor||'—') + '</div></div>' +
      '</div>' +

      // Keterangan ikon
      '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px;font-size:12px;color:var(--gray-500)">' +
        '<span><span style="color:var(--green);font-weight:700">✓ Lengkap</span> — absen pagi & siang</span>' +
        '<span><span style="color:var(--blue-500);font-weight:700">⚡ Tidak lengkap</span> — hanya salah satu</span>' +
        '<span><span style="color:var(--amber);font-weight:700">⚠ Terlambat</span> — melewati batas</span>' +
      '</div>' +

      '<div class="info-bar info-blue" style="margin-bottom:12px"><i class="ti ti-info-circle"></i>Skor Akhir gabungan dari Absen + To-Do + Komunikasi sesuai bobot yang ditetapkan HRD. Kolom yang belum terisi (—) dihitung 0, jadi ikut menurunkan Skor Akhir — pastikan to-do list & penilaian komunikasi selalu lengkap.</div>' +

      '<div class="card"><div class="card-head"><i class="ti ti-history"></i><h2>Detail Absensi — ' + now.toLocaleDateString('id-ID',{month:'long',year:'numeric'}) + '</h2></div>' +
      (riwayatRows.length ?
        '<div style="overflow-x:auto"><table class="data-table" style="min-width:760px"><thead><tr>' +
        '<th style="width:24px"></th><th>Tanggal</th><th>Pagi</th><th>Siang</th><th>Lokasi</th>' +
        '<th style="text-align:center">Absen</th><th style="text-align:center">To-Do</th><th style="text-align:center">Komunikasi</th>' +
        '<th>Skor Akhir</th><th>Status</th>' +
        '</tr></thead><tbody>' + riwayatRows.join('') + '</tbody></table></div>'
      :
        '<div style="text-align:center;padding:32px;color:var(--gray-400);font-size:13px">' +
        '<i class="ti ti-calendar-off" style="font-size:32px;display:block;margin-bottom:10px"></i>' +
        'Belum ada riwayat absensi bulan ini.</div>'
      ) + '</div>'
    );
  }

  if (id === 'performa') {
    var terakhir  = getSkorTerakhir(currentUser.email);
    var threshold = DB.settings.minSkorRataRata ?? 70;
    var bulanOptsSaya = getBulanOptionsList(12);

    return (
      '<div class="page-header"><h1>Performa Saya ' + rtBadge() + '</h1><p>Skor performa terakhir dan grafik kinerja harian Anda</p></div>' +

      '<div class="metrics">' +
        '<div class="metric-box blue-card"><div class="mb-label">Skor Terakhir</div><div class="mb-val">' + (terakhir ? terakhir.skor : '—') + '</div><div class="mb-sub">' + (terakhir ? terakhir.tanggal : 'Belum ada data') + '</div></div>' +
        '<div class="metric-box"><div class="mb-label">Rata-rata Bulan Ini</div><div class="mb-val" style="color:var(--blue-700)">' + (myEmp.skor!=null ? myEmp.skor : '—') + '</div></div>' +
        '<div class="metric-box"><div class="mb-label">Ambang Batas Minimum</div><div class="mb-val" style="color:var(--red)">' + threshold + '</div></div>' +
      '</div>' +

      (terakhir ?
        '<div class="card"><div class="card-head"><i class="ti ti-list-details" style="color:var(--blue-600)"></i><h2>Rincian Skor Terakhir — ' + terakhir.tanggal + '</h2></div>' +
        '<div style="display:flex;gap:24px;justify-content:center;flex-wrap:wrap;padding:8px 0">' +
          skorBadgeMini('Absen', terakhir.skorAbsen) +
          skorBadgeMini('To-Do', terakhir.skorTodo) +
          skorBadgeMini('Komunikasi', terakhir.skorKomunikasi) +
        '</div></div>'
      :
        '<div class="card" style="text-align:center;padding:24px;color:var(--gray-400);font-size:13px">' +
        '<i class="ti ti-chart-bar-off" style="font-size:28px;display:block;margin-bottom:8px"></i>Belum ada skor tercatat. Skor akan muncul setelah Anda absen & dinilai koordinator.</div>'
      ) +

      '<div class="card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:4px">' +
          '<div class="card-head" style="margin:0"><i class="ti ti-chart-histogram" style="color:var(--blue-600)"></i><h2>Grafik Kinerja Saya</h2></div>' +
          '<div class="field" style="margin:0;min-width:210px"><label>Tampilan Grafik</label>' +
            '<select id="mygraf-pilih" onchange="applyGrafikSaya()">' +
              '<optgroup label="Skor Harian per Bulan">' +
                bulanOptsSaya.map(function(b,idx){ return '<option value="month:'+b.key+'"'+(idx===0?' selected':'')+'>'+b.label+'</option>'; }).join('') +
              '</optgroup>' +
              '<optgroup label="Skor Harian Rentang">' +
                '<option value="range:3">3 Bulan Terakhir</option>' +
              '</optgroup>' +
              '<optgroup label="Rata-rata Bulanan">' +
                '<option value="avg:6">6 Bulan Terakhir</option>' +
                '<option value="avg:12">12 Bulan Terakhir</option>' +
              '</optgroup>' +
            '</select></div>' +
        '</div>' +
        '<div id="mygraf-content">' + buildGrafikSayaContent({type:'month', bulanKey: bulanOptsSaya[0].key}, threshold) + '</div>' +
      '</div>'
    );
  }

  if (id === 'notifikasi') {
    // Kumpulkan notifikasi dari berbagai sumber
    var notifs = [];
    var encEmail = currentUser.email.replace(/[.#$\[\]]/g,'_');
    var today    = todayKey();
    var aKeyToday= attendKey(currentUser.email);
    var recToday = DB.attendance[aKeyToday] || {};
    var todoToday= (DB.todos[aKeyToday] || []).filter(function(t){ return t.task&&t.task.trim(); });

    // --- Notif absen hari ini ---
    if (!recToday.pagi) {
      notifs.push({type:'warning', icon:'ti-clock', title:'Belum Absen Pagi', msg:'Anda belum melakukan absen pagi hari ini. Segera absen sebelum jam ' + DB.settings.batasPagi + '.', aksi:'Absen Sekarang', page:'absen', time:'Hari ini'});
    } else if (recToday.pagi && !recToday.siang) {
      notifs.push({type:'info', icon:'ti-sun', title:'Absen Siang Belum Dilakukan', msg:'Absen pagi sudah tercatat pukul ' + recToday.pagi + '. Jangan lupa absen siang mulai ' + DB.settings.mulaiSiang + '.', aksi:'Absen Siang', page:'absen', time:'Hari ini'});
    }

    // --- Notif to-do ---
    if (recToday.pagi && !todoToday.length) {
      notifs.push({type:'warning', icon:'ti-list-check', title:'To-Do List Belum Diisi', msg:'Anda sudah absen pagi tapi belum mengisi to-do list. Koordinator perlu melihat rencana kerja Anda.', aksi:'Isi To-Do', page:'todo', time:'Hari ini'});
    }
    if (recToday.siang && todoToday.length && todoToday.every(function(t){return t.score==null;})) {
      notifs.push({type:'info', icon:'ti-star', title:'Beri Skor To-Do List', msg:'Anda sudah absen siang. Jangan lupa beri penilaian skor untuk to-do list pagi Anda.', aksi:'Beri Skor', page:'todo', time:'Hari ini'});
    }

    // --- Notif komentar/koreksi koordinator pada to-do hari ini ---
    todoToday.forEach(function(t) {
      var adaKoreksi = (t.koreksi_skor !== null && t.koreksi_skor !== undefined);
      var adaKomentar = !!(t.komentar_koor && t.komentar_koor.trim());
      if (adaKoreksi || adaKomentar) {
        var msgParts = [];
        if (adaKomentar) msgParts.push('"' + t.komentar_koor + '"');
        if (adaKoreksi)  msgParts.push('Skor dikoreksi menjadi ' + t.koreksi_skor + (t.score!=null ? ' (sebelumnya ' + t.score + ')' : ''));
        notifs.push({
          type: adaKoreksi && t.koreksi_skor < (t.score!=null?t.score:100) ? 'warning' : 'blue',
          icon: 'ti-message-circle-2',
          title: 'Catatan Koordinator: ' + t.task,
          msg: msgParts.join(' · ') + (t.koor_edit_by ? ' — oleh ' + t.koor_edit_by : ''),
          aksi: 'Lihat To-Do', page: 'todo',
          time: 'Hari ini' + (t.koor_edit_time ? ' · ' + t.koor_edit_time : '')
        });
      }
    });

    // --- Notif komentar/koreksi koordinator pada to-do kemarin (jika belum sempat dilihat) ---
    var kemarinAKey = encEmail + '_' + (function(){ var d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().split('T')[0]; })();
    var todoKemarin = (DB.todos[kemarinAKey] || []).filter(function(t){ return t.task&&t.task.trim(); });
    todoKemarin.forEach(function(t) {
      var adaKoreksi = (t.koreksi_skor !== null && t.koreksi_skor !== undefined);
      var adaKomentar = !!(t.komentar_koor && t.komentar_koor.trim());
      if (adaKoreksi || adaKomentar) {
        var msgParts = [];
        if (adaKomentar) msgParts.push('"' + t.komentar_koor + '"');
        if (adaKoreksi)  msgParts.push('Skor dikoreksi menjadi ' + t.koreksi_skor + (t.score!=null ? ' (sebelumnya ' + t.score + ')' : ''));
        notifs.push({
          type: 'blue', icon: 'ti-message-circle-2',
          title: 'Catatan Koordinator (Kemarin): ' + t.task,
          msg: msgParts.join(' · ') + (t.koor_edit_by ? ' — oleh ' + t.koor_edit_by : ''),
          aksi: 'Lihat Riwayat', page: 'riwayat',
          time: 'Kemarin'
        });
      }
    });

    // --- Notif zoom meeting ---
    if (myEmp) {
      var zoomHariIni = (DB.zoomMeetings||[]).filter(function(m){ return m.koor===myEmp.koor && m.tanggal===today; });
      zoomHariIni.forEach(function(m){
        notifs.push({type:'blue', icon:'ti-video', title:'Meeting Zoom: ' + m.judul, msg:'Jadwal zoom hari ini pukul ' + m.jam + (m.catatan?' — '+m.catatan:''), aksi:'Lihat Zoom', page:'beranda', time:'Hari ini · ' + m.jam});
      });
    }

    // --- Notif pelanggaran/teguran ---
    var myPel = DB.sanctions.filter(function(s){ return s.to===currentUser.name||(myEmp&&s.to===myEmp.name); });
    myPel.slice(0,3).forEach(function(s){
      notifs.push({type:'danger', icon:'ti-alert-circle', title:'Teguran: ' + s.jenis, msg:s.alasan + ' (dari: ' + s.from + ')', aksi:'Lihat Detail', page:'pelanggaran', time:s.date});
    });

    // --- Notif absen tidak lengkap kemarin ---
    var kemarin = new Date(); kemarin.setDate(kemarin.getDate()-1);
    var kemarinKey = encEmail + '_' + kemarin.toISOString().split('T')[0];
    var recKemarin = DB.attendance[kemarinKey];
    if (recKemarin && recKemarin.pagi && !recKemarin.siang) {
      notifs.push({type:'warning', icon:'ti-calendar-x', title:'Absen Kemarin Tidak Lengkap', msg:'Kemarin Anda hanya absen pagi tanpa absen siang. Harap lengkapi atau hubungi koordinator.', page:'riwayat', time:'Kemarin'});
    }

    // --- Notif performa (peringatan / pencabutan otomatis) ---
    (DB.notifikasiPerforma||[]).filter(function(n){ return n.email===currentUser.email; }).slice(0,5).forEach(function(n) {
      if (n.jenis === 'cabut') {
        notifs.push({type:'danger', icon:'ti-ban', title:'Hak WFA Dicabut Otomatis', msg:n.pesan, page:'beranda', time:n.tanggal});
      } else {
        notifs.push({type:'warning', icon:'ti-trending-down', title:'Peringatan Performa', msg:n.pesan, page:'beranda', time:n.tanggal});
      }
    });

    return (
      '<div class="page-header"><h1>Notifikasi</h1><p>Pengingat dan informasi penting untuk Anda</p></div>' +

      (notifs.length === 0 ?
        '<div class="card" style="text-align:center;padding:40px">' +
        '<i class="ti ti-bell-off" style="font-size:40px;color:var(--gray-300);display:block;margin-bottom:12px"></i>' +
        '<div style="font-weight:600;color:var(--gray-500);margin-bottom:4px">Tidak ada notifikasi</div>' +
        '<div style="font-size:12px;color:var(--gray-400)">Semua tugas harian Anda sudah selesai!</div></div>'
      :
        notifs.map(function(n){
          var bgMap   = {warning:'var(--amber-light)', info:'var(--blue-50)', blue:'var(--blue-50)', danger:'var(--red-light)'};
          var brdMap  = {warning:'#fde68a', info:'var(--blue-200)', blue:'var(--blue-200)', danger:'#fca5a5'};
          var icoMap  = {warning:'var(--amber)', info:'var(--blue-500)', blue:'var(--blue-600)', danger:'var(--red)'};
          return '<div style="background:' + (bgMap[n.type]||'var(--gray-50)') + ';border:1.5px solid ' + (brdMap[n.type]||'var(--gray-200)') + ';border-radius:var(--radius-lg);padding:16px;margin-bottom:10px">' +
            '<div style="display:flex;align-items:flex-start;gap:12px">' +
              '<div style="width:36px;height:36px;border-radius:50%;background:' + (icoMap[n.type]) + '20;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
                '<i class="ti ' + n.icon + '" style="font-size:18px;color:' + icoMap[n.type] + '"></i>' +
              '</div>' +
              '<div style="flex:1">' +
                '<div style="font-weight:700;font-size:13px;color:var(--gray-800);margin-bottom:3px">' + n.title + '</div>' +
                '<div style="font-size:12px;color:var(--gray-600);margin-bottom:8px;line-height:1.5">' + n.msg + '</div>' +
                '<div style="display:flex;align-items:center;gap:10px">' +
                  '<span style="font-size:11px;color:var(--gray-400)">' + n.time + '</span>' +
                  (n.aksi && n.page ? '<button onclick="showPage(\'kary\',\'' + n.page + '\')" style="padding:5px 12px;background:' + icoMap[n.type] + ';color:#fff;border:none;border-radius:var(--radius);font-size:11px;font-weight:600;cursor:pointer">' + n.aksi + '</button>' : '') +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>';
        }).join('')
      )
    );
  }

  if (id === 'pelanggaran') {
    var myPel = DB.sanctions.filter(function(s){ return s.to===currentUser.name||s.to===(myEmp.name||''); });
    return (
      '<div class="page-header"><h1>Pelanggaran Saya</h1><p>Catatan teguran dan pelanggaran atas nama Anda</p></div>' +
      '<div class="info-bar info-' + ((myEmp.pelanggaran||0)>=2?'red':'blue') + '"><i class="ti ti-info-circle"></i>' +
      '3 pelanggaran berturut-turut dapat berakibat pencabutan hak WFA. Saat ini Anda memiliki ' + (myEmp.pelanggaran||0) + ' catatan pelanggaran.</div>' +
      '<div class="card"><div class="card-head"><i class="ti ti-alert-circle" style="color:var(--amber)"></i><h2>Riwayat Pelanggaran</h2></div>' +
      (myPel.length ? myPel.map(function(s) {
        var isRed = s.jenis.includes('tertulis')||s.jenis.includes('Pencabutan');
        return '<div class="v-card ' + (isRed?'v-red':'v-amber') + '">' +
          '<div class="v-date">' + s.date + ' · Dari: ' + s.from + '</div>' +
          '<div class="v-text">' + s.alasan + '</div>' +
          '<span class="badge ' + (isRed?'badge-red':'badge-amber') + '" style="margin-top:6px">' + s.jenis + '</span></div>';
      }).join('') : '<div style="font-size:13px;color:var(--gray-400);padding:8px 0">Tidak ada catatan pelanggaran</div>') +
      '</div>'
    );
  }

  if (id === 'akunsaya') {
    return (
      '<div class="page-header"><h1>Akun Saya</h1><p>Kelola informasi akun dan password login Anda</p></div>' +
      '<div class="card"><div class="card-head"><i class="ti ti-id-badge" style="color:var(--blue-600)"></i><h2>Informasi Akun</h2></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px" class="pengaturan-grid">' +
        '<div class="field" style="margin:0"><label>Nama</label><input type="text" value="' + (currentUser.name||'') + '" disabled/></div>' +
        '<div class="field" style="margin:0"><label>Email / Username</label><input type="text" value="' + currentUser.email + '" disabled/></div>' +
        '<div class="field" style="margin:0"><label>Divisi</label><input type="text" value="' + (myEmp.div||'-') + '" disabled/></div>' +
        '<div class="field" style="margin:0"><label>Koordinator</label><input type="text" value="' + (myEmp.koor||'-') + '" disabled/></div>' +
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

// ==================== MODAL NOTIFIKASI WAJIB DIBACA SAAT BUKA APLIKASI ====================
// Dipanggil sekali oleh buildPortal() setiap kali karyawan login / lanjutkan sesi.
// Kalau ada notifikasi performa yang belum dibaca (dibaca:false) untuk email ini, tampilkan
// modal yang WAJIB di-klik "OK" dulu sebelum bisa lanjut memakai aplikasi.
function cekNotifikasiLoginKaryawan() {
  if (!currentUser || !currentUser.email) return;
  // Hanya notifikasi jenis "cabut" (pencabutan hak WFA) yang dipakai di modal wajib-baca ini.
  // Peringatan "skor di bawah target" TIDAK lagi dipakai di sini — sekarang sudah ditampilkan
  // langsung & live di bawah "Avg Skor" pada Beranda Saya (lihat buildKARY -> id==='beranda'),
  // supaya tidak ada 2 sumber angka yang berpotensi tidak sinkron satu sama lain.
  var belumDibaca = (DB.notifikasiPerforma || []).filter(function(n) {
    return n.email === currentUser.email && !n.dibaca && n.jenis === 'cabut';
  });
  if (!belumDibaca.length) return;
  tampilkanModalNotifikasiLogin(belumDibaca);
}

function tampilkanModalNotifikasiLogin(list) {
  var old = document.getElementById('notif-login-modal');
  if (old) old.remove();

  var itemsHtml = list.map(function(n) {
    var isCabut = n.jenis === 'cabut';
    var icon  = isCabut ? 'ti-ban' : 'ti-alert-triangle';
    var color = isCabut ? 'var(--red)' : 'var(--amber)';
    var bg    = isCabut ? 'var(--red-light)' : 'var(--amber-light)';
    return '<div style="display:flex;gap:10px;padding:12px 14px;border-radius:var(--radius);background:' + bg + ';margin-bottom:8px;text-align:left">' +
      '<i class="ti ' + icon + '" style="font-size:18px;color:' + color + ';flex-shrink:0;margin-top:1px"></i>' +
      '<div style="font-size:13px;color:var(--gray-700);line-height:1.5">' + n.pesan +
        '<div style="font-size:11px;color:var(--gray-400);margin-top:4px">' + n.tanggal + '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  var idList = list.map(function(n){ return n.id; }).join(',');

  var modalHTML =
    '<div id="notif-login-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px">' +
      '<div style="background:#fff;border-radius:var(--radius-xl);max-width:460px;width:100%;max-height:85vh;overflow-y:auto;padding:24px;box-shadow:var(--shadow-md)">' +
        '<div style="text-align:center;margin-bottom:16px">' +
          '<div style="width:52px;height:52px;border-radius:50%;background:var(--amber-light);display:flex;align-items:center;justify-content:center;margin:0 auto 12px">' +
            '<i class="ti ti-bell-ringing" style="font-size:26px;color:var(--amber)"></i>' +
          '</div>' +
          '<div style="font-size:16px;font-weight:700;color:var(--gray-800)">Ada ' + list.length + ' Notifikasi Penting</div>' +
          '<div style="font-size:12.5px;color:var(--gray-500);margin-top:4px">Mohon dibaca dulu sebelum melanjutkan</div>' +
        '</div>' +
        '<div style="margin-bottom:18px">' + itemsHtml + '</div>' +
        '<button onclick="tutupModalNotifikasiLogin([' + idList + '])" style="width:100%;padding:13px;background:var(--blue-600);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">' +
          '<i class="ti ti-check" style="margin-right:6px"></i>OK, Sudah Saya Baca' +
        '</button>' +
      '</div>' +
    '</div>';

  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Tandai notifikasi terkait sebagai sudah dibaca (persisten ke Firebase) & tutup modal
function tutupModalNotifikasiLogin(ids) {
  (DB.notifikasiPerforma || []).forEach(function(n) {
    if (ids.indexOf(n.id) >= 0) n.dibaca = true;
  });
  dbSavePath('notifikasiPerforma', cleanForFirebase(DB.notifikasiPerforma));
  var m = document.getElementById('notif-login-modal');
  if (m) m.remove();
}

