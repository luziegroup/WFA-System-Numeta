/* ============================================================
 * FILE   : 05-portal-router.js
 * BAGIAN : Portal Builder & Router Halaman
 * ISI    : Definisi menu per role, pembangunan portal/sidebar, navigasi antar halaman (showPage), badge status, grafik tren skor performa (SVG).
 * ============================================================ */

// ==================== PORTAL BUILDER ====================
var MENUS = {
  hrd:[
    {sec:'Menu Utama'},
    {id:'dashboard',  icon:'ti-layout-dashboard', label:'Dashboard'},
    {id:'karyawan',   icon:'ti-users',             label:'Data Karyawan'},
    {id:'rekap',      icon:'ti-chart-bar',          label:'Rekap Absensi'},
    {id:'performa',   icon:'ti-chart-histogram',    label:'Analisis Performa'},
    {id:'laporan',    icon:'ti-file-analytics',     label:'Laporan'},
    {sec:'Manajemen'},
    {id:'akun',       icon:'ti-shield-lock',        label:'Manajemen Akun'},
    {id:'sanksi',     icon:'ti-gavel',              label:'Sanksi & Pelanggaran'},
    {id:'pengaturan', icon:'ti-settings',           label:'Pengaturan Sistem'},
  ],
  koor:[
    {sec:'Menu Utama'},
    {id:'dashboard',icon:'ti-layout-dashboard',label:'Dashboard Tim'},
    {id:'zoom',     icon:'ti-video',            label:'Zoom Pagi'},
    {id:'monitor',  icon:'ti-eye',              label:'Monitor To-Do List'},
    {id:'rekap',    icon:'ti-chart-bar',        label:'Rekap Absensi Tim'},
    {id:'performa', icon:'ti-chart-histogram',  label:'Performa Tim'},
    {sec:'Tindakan'},
    {id:'teguran',  icon:'ti-bell',             label:'Kirim Teguran'},
    {id:'laporan',  icon:'ti-file-analytics',   label:'Laporan Tim'},
    {sec:'Akun'},
    {id:'akunsaya', icon:'ti-user-cog',         label:'Akun Saya'},
  ],
  kary:[
    {sec:'Menu Utama'},
    {id:'beranda',    icon:'ti-home',           label:'Beranda Saya'},
    {id:'absen',      icon:'ti-map-pin',        label:'Absensi + GPS'},
    {id:'todo',       icon:'ti-list-check',     label:'To-Do List'},
    {id:'hubstaff',   icon:'ti-player-play',    label:'Hubstaff'},
    {sec:'Informasi'},
    {id:'notifikasi', icon:'ti-bell',           label:'Notifikasi'},
    {id:'performa',   icon:'ti-chart-histogram',label:'Performa Saya'},
    {id:'riwayat',    icon:'ti-history',        label:'Riwayat Absen'},
    {id:'pelanggaran',icon:'ti-alert-triangle', label:'Pelanggaran Saya'},
    {sec:'Akun'},
    {id:'akunsaya',   icon:'ti-user-cog',       label:'Akun Saya'},
  ]
};

function buildPortal(role, initialPageId) {
  currentRole = role;
  var sidebar = document.getElementById('sidebar');
  var main = document.getElementById('main-content');
  var menus = MENUS[role];

  // Desktop sidebar
  sidebar.innerHTML = menus.map(function(m) {
    if (m.sec) return '<div class="sidebar-section">' + m.sec + '</div>';
    return '<div class="sidebar-item" id="si-' + m.id + '" onclick="showPage(\'' + role + '\',\'' + m.id + '\')"><i class="ti ' + m.icon + '"></i>' + m.label + '</div>';
  }).join('');

  // Build pages
  main.innerHTML = '';
  menus.filter(function(m){ return m.id; }).forEach(function(m) {
    var pg = document.createElement('div');
    pg.className = 'page';
    pg.id = 'pg-' + m.id;
    main.appendChild(pg);
  });

  // Mobile bottom nav — show max 5 items (nav items only, no sections)
  var navItems = menus.filter(function(m){ return m.id; });
  var maxBn = 5;
  var bnItems = navItems.length <= maxBn ? navItems : navItems.slice(0, maxBn);
  var bnHtml = bnItems.map(function(m) {
    return '<button class="bn-item" id="bn-' + m.id + '" onclick="showPage(\'' + role + '\',\'' + m.id + '\')">' +
      '<i class="ti ' + m.icon + '"></i>' +
      '<span>' + m.label.split(' ')[0] + '</span>' +
    '</button>';
  }).join('');
  var bnEl = document.getElementById('bottom-nav-inner');
  if (bnEl) bnEl.innerHTML = bnHtml;

  // Mobile avatar
  var u = currentUser;
  var mobAv = document.getElementById('mob-av');
  if (mobAv && u) {
    mobAv.style.background = u.avBg || 'var(--blue-500)';
    mobAv.style.color = u.avColor || '#fff';
    mobAv.textContent = u.initials || '';
  }

  var menuIds = menus.filter(function(m){ return m.id; }).map(function(m){ return m.id; });
  var firstId = menuIds[0];
  // BUGFIX: kalau dipanggil saat resume sesi (refresh halaman), lanjutkan ke halaman
  // terakhir yang dibuka user, bukan selalu balik ke halaman pertama menu
  var targetId = (initialPageId && menuIds.indexOf(initialPageId) >= 0) ? initialPageId : firstId;
  showPage(role, targetId);

  // Cek notifikasi performa yang belum dibaca → tampilkan modal wajib "OK" (khusus karyawan)
  if (role === 'kary' && typeof cekNotifikasiLoginKaryawan === 'function') {
    setTimeout(cekNotifikasiLoginKaryawan, 300);
  }
}

function showPage(role, id) {
  currentPageId = id;
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.sidebar-item').forEach(function(s){ s.classList.remove('active'); });
  document.querySelectorAll('.bn-item').forEach(function(b){ b.classList.remove('active'); });
  var pg = document.getElementById('pg-' + id);
  var si = document.getElementById('si-' + id);
  var bn = document.getElementById('bn-' + id);
  if (pg) {
    pg.innerHTML = buildPage(role, id);
    pg.classList.add('active');
    onPageShow(role, id);
    // Scroll to top on mobile page change
    window.scrollTo(0, 0);
  }
  if (si) si.classList.add('active');
  if (bn) bn.classList.add('active');
  saveSession(); // BUGFIX: simpan posisi terakhir, agar refresh halaman tidak kembali ke login
}

// PENJAGA UMUM: jika user sedang fokus mengetik di input/textarea/select MANAPUN
// di halaman yang sedang aktif, tunda refresh (jangan timpa isian yang belum
// disimpan). Refresh yang tertunda otomatis dijalankan begitu user selesai
// mengetik (blur/pindah fokus) — lihat listener 'focusout' di bawah.
// Ini TIDAK mengubah logika halaman todo karyawan yang sudah ada; hanya
// menambah perlindungan yang sama untuk halaman-halaman lain.
var pendingPageRefresh = false;
function isTypingInsidePage(pg) {
  var ae = document.activeElement;
  if (!ae || !pg) return false;
  var tag = ae.tagName;
  if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return false;
  return pg.contains(ae);
}

function refreshCurrentPage() {
  if (currentRole && currentPageId) {
    var pg = document.getElementById('pg-' + currentPageId);
    if (pg && pg.classList.contains('active')) {
      // JANGAN refresh halaman todo karyawan jika sedang diisi
      // (mencegah Firebase listener menghapus input yang belum disimpan)
      if (currentRole === 'kary' && currentPageId === 'todo') {
        // Hanya refresh bagian yang aman (banner status absen), bukan form to-do
        refreshTodoBannerOnly();
        return;
      }
      // Penjagaan umum untuk halaman-halaman lain: kalau user sedang mengetik
      // di form manapun di halaman ini, tunda dulu refresh-nya.
      if (isTypingInsidePage(pg)) {
        pendingPageRefresh = true;
        return;
      }
      pg.innerHTML = buildPage(currentRole, currentPageId);
      onPageShow(currentRole, currentPageId);
    }
  }
}

// Jalankan refresh yang tertunda begitu user selesai mengetik (pindah fokus
// keluar dari input/textarea/select). Dipasang di tahap capture supaya
// tertangkap sebelum elemen terkait mungkin sudah berubah.
document.addEventListener('focusout', function(e) {
  if (!pendingPageRefresh) return;
  var tag = e.target && e.target.tagName;
  if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return;
  pendingPageRefresh = false;
  // Beri jeda singkat agar fokus baru (kalau user pindah ke field lain) sempat
  // ter-set dulu, supaya tidak salah anggap "sudah selesai mengetik".
  setTimeout(function() {
    if (!isTypingInsidePage(document.getElementById('pg-' + currentPageId))) {
      refreshCurrentPage();
    } else {
      // User masih mengetik di field lain pada halaman yang sama → tunda lagi.
      pendingPageRefresh = true;
    }
  }, 150);
}, true);

// Refresh hanya status absen di banner todo (tidak menyentuh form/input karyawan)
function refreshTodoBannerOnly() {
  var aKey = attendKey(currentUser.email);
  var rec  = DB.attendance[aKey] || {};
  var sudahSiangBaru = !!rec.siang;
  // Deteksi fase sekarang berdasarkan DOM:
  // fase pagi = ada 'td-list' (form input to-do)
  // fase siang = ada 'skor-list' (form penilaian skor)
  var sedangFaseSiang = !!document.getElementById('skor-list');
  var sedangFasePagi  = !!document.getElementById('td-list');

  if (sudahSiangBaru && !sedangFaseSiang) {
    // Fase baru berubah ke siang → auto-save dulu baru re-render
    autoSaveTodoDraft();
    var pg = document.getElementById('pg-todo');
    if (pg) { pg.innerHTML = buildPage('kary','todo'); onPageShow('kary','todo'); }
  } else if (!sudahSiangBaru && sedangFaseSiang) {
    // Kasus edge: absen siang di-reset (jarang terjadi) → re-render aman
    var pg2 = document.getElementById('pg-todo');
    if (pg2) { pg2.innerHTML = buildPage('kary','todo'); onPageShow('kary','todo'); }
  }
  // Fase tidak berubah → tidak re-render, biarkan user mengetik dengan aman
}

// Auto-save draft tanpa gangguan (silent, tidak ada toast) — dipanggil tiap 5 detik & saat tab ditutup
function autoSaveTodoDraft() {
  var hasTasks = myTodos.some(function(t){ return t.task.trim(); });
  if (hasTasks) saveMyTodos();
}

// BUGFIX: sebelumnya tiap 1 huruf yang diketik langsung kirim ke Firebase (boros kuota,
// dan di koneksi lambat bisa terasa macet/lag saat mengetik). Sekarang tunggu user
// berhenti mengetik 0.8 detik dulu sebelum benar-benar kirim ke server.
var _todoTypingDebounce = null;
function autoSaveTodoDraftDebounced() {
  showSaveStatus('todo-save-status', 'saving');
  if (_todoTypingDebounce) clearTimeout(_todoTypingDebounce);
  _todoTypingDebounce = setTimeout(function(){ autoSaveTodoDraft(); }, 800);
}

function onPageShow(role, id) {
  if (role === 'kary' && id === 'absen') initGPS();
  if (role === 'kary' && id === 'todo') renderTodoFull();
}

// ==================== PAGE BUILDER ====================
function buildPage(role, id) {
  if (role === 'hrd')  return buildHRD(id);
  if (role === 'koor') return buildKOOR(id);
  if (role === 'kary') return buildKARY(id);
  return '';
}

function rtBadge() {
  return '<span class="realtime-badge"><i class="ti ti-circle-filled"></i>Realtime</span>';
}

function statusBadge(s) {
  // hadir/terlambat/belum = status absensi harian (dari DB.attendance)
  // aktif/cabut = status permanen akun karyawan (dari DB.employees)
  var map  = {hadir:'badge-green',terlambat:'badge-amber',belum:'badge-gray',cabut:'badge-red',aktif:'badge-green'};
  var lbl  = {hadir:'Tepat waktu',terlambat:'Terlambat',belum:'Belum absen',cabut:'Hak dicabut',aktif:'Aktif'};
  var ic   = {hadir:'ti-check',terlambat:'ti-clock',belum:'ti-minus',cabut:'ti-ban',aktif:'ti-check'};
  return '<span class="badge ' + (map[s]||'badge-gray') + '"><i class="ti ' + (ic[s]||'ti-minus') + '"></i>' + (lbl[s]||s) + '</span>';
}

// Badge kecil untuk menampilkan satu komponen skor (Absen/To-Do/Komunikasi)
function skorBadgeMini(label, val) {
  var color = val===null||val===undefined ? 'var(--gray-400)' : val>=80 ? 'var(--green)' : val>=60 ? 'var(--amber)' : 'var(--red)';
  var display = (val===null||val===undefined) ? '—' : val;
  return '<div style="text-align:center;min-width:64px">' +
    '<div style="font-size:9px;color:var(--gray-400);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">' + label + '</div>' +
    '<div style="font-size:16px;font-weight:700;color:' + color + '">' + display + '</div>' +
  '</div>';
}

// ==================== GRAFIK TREN SKOR PERFORMA (SVG) ====================
// Bangun grafik garis untuk rata-rata skor harian dari sekumpulan email karyawan, N hari terakhir
function buildSkorTrendChart(emails, numDays, threshold) {
  numDays = numDays || 30;

  // Generate daftar tanggal N hari terakhir (urut lama -> baru)
  var dates = [];
  for (var i = numDays-1; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate()-i);
    dates.push(d.toISOString().split('T')[0]);
  }

  return buildSkorHarianChartFromDates(dates, emails, threshold);
}

// Sama seperti buildSkorTrendChart, tapi untuk SATU BULAN TERTENTU (bukan N hari terakhir dari
// hari ini) — dipakai fitur filter bulan pada grafik "Analisis Performa" supaya HRD/Koordinator
// bisa melihat skor perhari khusus bulan yang dipilih (bukan cuma rata-rata bulanan).
function buildSkorHarianBulanChart(emails, bulanKey, threshold) {
  var dates = daftarTanggalBulan(bulanKey);
  if (!dates.length) {
    return '<div style="text-align:center;padding:32px;color:var(--gray-400);font-size:13px">' +
      '<i class="ti ti-calendar-off" style="font-size:32px;display:block;margin-bottom:8px"></i>' +
      'Belum ada tanggal yang bisa ditampilkan untuk bulan ini.' +
    '</div>';
  }
  return buildSkorHarianChartFromDates(dates, emails, threshold);
}

// Sama seperti buildSkorHarianBulanChart, tapi untuk RENTANG N BULAN TERAKHIR sekaligus (garis
// harian yang menyambung lintas bulan) — dipakai grafik "3 Bulan Terakhir" milik karyawan.
function buildSkorHarianRentangChart(emails, numMonths, threshold) {
  var dates = daftarTanggalRentangBulan(numMonths);
  if (!dates.length) {
    return '<div style="text-align:center;padding:32px;color:var(--gray-400);font-size:13px">' +
      '<i class="ti ti-calendar-off" style="font-size:32px;display:block;margin-bottom:8px"></i>' +
      'Belum ada tanggal yang bisa ditampilkan.' +
    '</div>';
  }
  return buildSkorHarianChartFromDates(dates, emails, threshold);
}

// Penghitung ID unik untuk elemen <defs> SVG (gradient/filter), supaya kalau beberapa grafik
// tampil sekaligus di halaman yang sama, id-nya tidak bentrok satu sama lain.
var __chartUidSeq = 0;
function nextChartUid(prefix) { return prefix + '_' + (++__chartUidSeq); }

// Bungkus konten SVG grafik dengan kartu bergaya "dashboard gelap" (gradasi navy-ungu + glow
// halus), dipakai bersama oleh grafik garis & grafik batang supaya temanya seragam.
function bungkusKartuGrafikGelap(svgInner, W, H, minWidth, legendLabel) {
  var legend = legendLabel ? (
    '<div style="display:flex;align-items:center;gap:7px;padding:0 6px 12px;font-size:11.5px;color:rgba(255,255,255,0.75)">' +
      '<span style="width:10px;height:10px;border-radius:50%;background:linear-gradient(90deg,var(--blue-300),var(--blue-500));display:inline-block;flex-shrink:0"></span>' +
      legendLabel +
    '</div>'
  ) : '';
  return '<div style="overflow-x:auto;border-radius:18px;padding:18px 8px 10px;' +
      'background:linear-gradient(135deg,var(--blue-900) 0%,var(--blue-800) 55%,var(--blue-700) 100%);' +
      'box-shadow:0 0 0 1px rgba(255,255,255,0.08),0 12px 28px rgba(0,50,120,0.35)">' +
    legend +
    '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;min-width:' + minWidth + 'px;height:auto;font-family:var(--font)">' +
      svgInner +
    '</svg>' +
  '</div>';
}

// Tampilan "belum ada data" versi kartu gelap, dipakai bersama oleh kedua jenis grafik
function kartuGrafikKosong(icon, pesan) {
  return '<div style="text-align:center;padding:40px 20px;border-radius:18px;' +
    'background:linear-gradient(135deg,var(--blue-900) 0%,var(--blue-800) 55%,var(--blue-700) 100%);color:rgba(255,255,255,0.6);font-size:13px">' +
    '<i class="ti ' + icon + '" style="font-size:32px;display:block;margin-bottom:8px;opacity:.7"></i>' +
    pesan +
  '</div>';
}

// Bantu bikin path kurva halus (Catmull-Rom -> Bezier) dari daftar titik [x,y], supaya garis
// grafik tidak kaku/patah-patah. Butuh minimal 2 titik.
function haluskanPath(pts) {
  var d = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
  for (var i = 0; i < pts.length - 1; i++) {
    var p0 = pts[i === 0 ? 0 : i - 1];
    var p1 = pts[i];
    var p2 = pts[i + 1];
    var p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
    var c1x = p1[0] + (p2[0] - p0[0]) / 6;
    var c1y = p1[1] + (p2[1] - p0[1]) / 6;
    var c2x = p2[0] - (p3[0] - p1[0]) / 6;
    var c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ' C' + c1x.toFixed(1) + ',' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ',' + c2y.toFixed(1) + ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
  }
  return d;
}

// Warna titik/status berdasarkan skor — pakai token warna yang SAMA dengan status badge di
// seluruh aplikasi (hijau/amber/merah), bukan warna baru, supaya konsisten secara visual.
function warnaStatusSkor(p, threshold) {
  return p>=80 ? '#0D9E6B' : p>=threshold ? '#D97706' : '#DC2626';
}

// Inti pembangun grafik garis skor harian (SVG) dari daftar tanggal apa pun yang diberikan.
// Dipisah dari buildSkorTrendChart supaya bisa dipakai ulang oleh buildSkorHarianBulanChart.
// PERUBAHAN: hari tanpa skor (belum WFA) dihilangkan dari sumbu-X sepenuhnya — sebelumnya
// hari kosong itu memutus garis jadi beberapa segmen terpisah (termasuk bikin blok area
// mengambang yang aneh). Sekarang grafik hanya memuat tanggal yang BENAR-BENAR punya skor,
// jadi garis selalu tersambung utuh dari titik pertama sampai titik terakhir.
function buildSkorHarianChartFromDates(dates, emails, threshold) {
  threshold = (threshold===undefined||threshold===null) ? 70 : threshold;

  // Hitung rata-rata skor harian gabungan dari semua email, lalu buang tanggal yang kosong
  var dataPoin = [];
  dates.forEach(function(dateKey) {
    var vals = [];
    emails.forEach(function(email) {
      var aKey = attendKeyFor(email, dateKey);
      var rec = DB.attendance[aKey];
      if (rec && rec.skor !== null && rec.skor !== undefined) vals.push(rec.skor);
    });
    if (vals.length) {
      dataPoin.push({ tgl: dateKey, skor: Math.round(vals.reduce(function(a,b){return a+b;},0)/vals.length) });
    }
  });

  if (!dataPoin.length) {
    return kartuGrafikKosong('ti-chart-line', 'Belum ada data skor performa. Grafik akan muncul setelah karyawan absen &amp; dinilai.');
  }

  // Dimensi SVG — sedikit lebih tinggi & lega supaya label & titik tidak sesak
  var W = 900, H = 260, padL = 40, padR = 18, padT = 26, padB = 34;
  var plotW = W - padL - padR, plotH = H - padT - padB;
  var n = dataPoin.length;

  var uidLine = nextChartUid('lineGrad');
  var uidArea = nextChartUid('areaGrad');
  var uidGlow = nextChartUid('glow');

  function xPos(i) { return padL + (n<=1 ? plotW/2 : (i/(n-1)) * plotW); }
  function yPos(v) { return padT + plotH - (v/100)*plotH; }

  var pts = dataPoin.map(function(d,i){ return [xPos(i), yPos(d.skor)]; });

  // Glow: garis tebal buram di belakang supaya garis utama tampak menyala lembut
  var glowPaths = n >= 2 ? '<path d="' + haluskanPath(pts) + '" fill="none" stroke="url(#' + uidLine + ')" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity="0.35" filter="url(#' + uidGlow + ')"/>' : '';

  // Garis utama kurva halus — selalu satu garis utuh (tidak ada lagi yang putus-putus)
  var linePaths = n >= 2 ? '<path d="' + haluskanPath(pts) + '" fill="none" stroke="url(#' + uidLine + ')" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' : '';

  // Area gradient lembut di bawah garis, memudar ke transparan
  var areaFills = '';
  if (n >= 2) {
    var dPath = haluskanPath(pts);
    var lastX = pts[pts.length-1][0], firstX = pts[0][0];
    areaFills = '<path d="' + dPath + ' L' + lastX.toFixed(1) + ',' + (padT+plotH) + ' L' + firstX.toFixed(1) + ',' + (padT+plotH) + ' Z" fill="url(#' + uidArea + ')"/>';
  }

  var threshY = yPos(threshold);

  // Grid horizontal (0,25,50,75,100) — garis putih transparan tipis khas dashboard gelap
  var gridLinesH = [0,25,50,75,100].map(function(v) {
    var y = yPos(v);
    return '<line x1="' + padL + '" y1="' + y + '" x2="' + (W-padR) + '" y2="' + y + '" stroke="rgba(255,255,255,0.08)" stroke-width="1" stroke-dasharray="' + (v===0?'0':'3,4') + '"/>' +
           '<text x="' + (padL-10) + '" y="' + (y+3) + '" font-size="10.5" fill="rgba(255,255,255,0.55)" text-anchor="end">' + v + '</text>';
  }).join('');

  // Label tanggal — tampilkan setiap ~5-6 titik supaya tidak berdempetan
  var step = Math.max(1, Math.round(n/6));

  var gridLinesV = dataPoin.map(function(d,i) {
    if (i % step !== 0 && i !== n-1) return '';
    return '<line x1="' + xPos(i).toFixed(1) + '" y1="' + padT + '" x2="' + xPos(i).toFixed(1) + '" y2="' + (padT+plotH) + '" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>';
  }).join('');
  var gridLines = gridLinesH + gridLinesV;

  var dateLabels = dataPoin.map(function(d,i) {
    if (i % step !== 0 && i !== n-1) return '';
    var dt = new Date(d.tgl);
    var lbl = dt.getDate() + '/' + (dt.getMonth()+1);
    return '<text x="' + xPos(i).toFixed(1) + '" y="' + (H-10) + '" font-size="10.5" fill="rgba(255,255,255,0.55)" text-anchor="middle">' + lbl + '</text>';
  }).join('');

  // Titik data — warna sesuai status (hijau/amber/merah, konsisten dgn badge status aplikasi),
  // titik terakhir (skor terbaru) dibesarkan + diberi label angka
  var dots = dataPoin.map(function(d,i) {
    var p = d.skor;
    var color = warnaStatusSkor(p, threshold);
    var isLast = (i === n-1);
    var r = isLast ? 6 : 3.5;
    var cx = xPos(i).toFixed(1), cy = yPos(p).toFixed(1);
    var dt = new Date(d.tgl);
    var tanggalLabel = dt.getDate() + '/' + (dt.getMonth()+1);
    var dot = '<circle cx="' + cx + '" cy="' + cy + '" r="' + (isLast?11:6.5) + '" fill="' + color + '" opacity="' + (isLast?0.28:0.18) + '"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + color + '" stroke="#003366" stroke-width="' + (isLast?2:1.5) + '"><title>' + tanggalLabel + ': ' + p + '</title></circle>';
    if (isLast) {
      var labelY = (p >= 88) ? (parseFloat(cy) + 18) : (parseFloat(cy) - 13);
      dot += '<text x="' + cx + '" y="' + labelY.toFixed(1) + '" font-size="11.5" font-weight="700" fill="#ffffff" text-anchor="middle">' + p + '</text>';
    }
    return dot;
  }).join('');

  var svgInner =
    '<defs>' +
      '<linearGradient id="' + uidLine + '" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0%" stop-color="var(--blue-300)"/>' +
        '<stop offset="100%" stop-color="var(--blue-500)"/>' +
      '</linearGradient>' +
      '<linearGradient id="' + uidArea + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="var(--blue-400)" stop-opacity="0.35"/>' +
        '<stop offset="100%" stop-color="var(--blue-400)" stop-opacity="0"/>' +
      '</linearGradient>' +
      '<filter id="' + uidGlow + '" x="-50%" y="-50%" width="200%" height="200%">' +
        '<feGaussianBlur stdDeviation="4" result="blur"/>' +
      '</filter>' +
    '</defs>' +
    gridLines +
    areaFills +
    '<line x1="' + padL + '" y1="' + threshY.toFixed(1) + '" x2="' + (W-padR) + '" y2="' + threshY.toFixed(1) + '" stroke="#EF4444" stroke-width="1.5" stroke-dasharray="5,4" opacity="0.7"/>' +
    '<text x="' + (W-padR) + '" y="' + (threshY-6).toFixed(1) + '" font-size="9.5" fill="#EF4444" opacity="0.95" text-anchor="end">Min ' + threshold + '</text>' +
    glowPaths +
    linePaths +
    dots +
    dateLabels;

  return bungkusKartuGrafikGelap(svgInner, W, H, 500, 'Skor rata-rata harian');
}

// ==================== GRAFIK PERFORMA BULANAN (SVG line chart) ====================
// Bangun grafik rata-rata skor PER BULAN untuk sekumpulan email, N bulan terakhir.
// Dipakai di halaman "Performa" Karyawan (1 email), Koordinator (email tim), dan HRD (email hasil filter).
// GAYA: kurva mulus + titik di tiap data (pola sama seperti grafik skor harian).
function buildSkorBulananChart(emails, numMonths, threshold) {
  numMonths = numMonths || 6;
  threshold = (threshold===undefined||threshold===null) ? 70 : threshold;

  var dataMentah = hitungRataSkorBulanan(emails, numMonths);
  var data = dataMentah.filter(function(d){ return d.avg !== null; }); // buang bulan tanpa data — biar garis tidak putus
  if (!data.length) {
    return kartuGrafikKosong('ti-chart-histogram', 'Belum ada data skor performa bulanan. Grafik akan muncul setelah karyawan absen &amp; dinilai.');
  }

  var W = 700, H = 260, padL = 40, padR = 18, padT = 26, padB = 34;
  var plotW = W - padL - padR, plotH = H - padT - padB;
  var n = data.length;

  var uidLine = nextChartUid('lineGradM');
  var uidArea = nextChartUid('areaGradM');
  var uidGlow = nextChartUid('glowM');

  function xPos(i) { return padL + (n<=1 ? plotW/2 : (i/(n-1)) * plotW); }
  function yPos(v) { return padT + plotH - (v/100)*plotH; }

  var pts = data.map(function(d,i){ return [xPos(i), yPos(d.avg)]; });

  var glowPaths = n >= 2 ? '<path d="' + haluskanPath(pts) + '" fill="none" stroke="url(#' + uidLine + ')" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity="0.35" filter="url(#' + uidGlow + ')"/>' : '';
  var linePaths = n >= 2 ? '<path d="' + haluskanPath(pts) + '" fill="none" stroke="url(#' + uidLine + ')" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' : '';

  var areaFills = '';
  if (n >= 2) {
    var dPath = haluskanPath(pts);
    var lastX = pts[pts.length-1][0], firstX = pts[0][0];
    areaFills = '<path d="' + dPath + ' L' + lastX.toFixed(1) + ',' + (padT+plotH) + ' L' + firstX.toFixed(1) + ',' + (padT+plotH) + ' Z" fill="url(#' + uidArea + ')"/>';
  }

  var threshY = yPos(threshold);

  var gridLinesH = [0,25,50,75,100].map(function(v) {
    var y = yPos(v);
    return '<line x1="' + padL + '" y1="' + y + '" x2="' + (W-padR) + '" y2="' + y + '" stroke="rgba(255,255,255,0.08)" stroke-width="1" stroke-dasharray="' + (v===0?'0':'3,4') + '"/>' +
           '<text x="' + (padL-10) + '" y="' + (y+3) + '" font-size="10.5" fill="rgba(255,255,255,0.55)" text-anchor="end">' + v + '</text>';
  }).join('');

  var gridLinesV = data.map(function(d, i) {
    return '<line x1="' + xPos(i).toFixed(1) + '" y1="' + padT + '" x2="' + xPos(i).toFixed(1) + '" y2="' + (padT+plotH) + '" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>';
  }).join('');
  var gridLines = gridLinesH + gridLinesV;

  var labels = data.map(function(d, i) {
    return '<text x="' + xPos(i).toFixed(1) + '" y="' + (H-10) + '" font-size="10.5" fill="rgba(255,255,255,0.55)" text-anchor="middle">' + d.label + '</text>';
  }).join('');

  var dots = data.map(function(d,i) {
    var p = d.avg;
    var color = warnaStatusSkor(p, threshold);
    var isLast = (i === n-1);
    var r = isLast ? 6 : 3.5;
    var cx = xPos(i).toFixed(1), cy = yPos(p).toFixed(1);
    var dot = '<circle cx="' + cx + '" cy="' + cy + '" r="' + (isLast?11:6.5) + '" fill="' + color + '" opacity="' + (isLast?0.28:0.18) + '"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + color + '" stroke="#003366" stroke-width="' + (isLast?2:1.5) + '"><title>' + d.label + ': ' + p + '</title></circle>';
    var labelY = (p >= 88) ? (parseFloat(cy) + 18) : (parseFloat(cy) - 13);
    dot += '<text x="' + cx + '" y="' + labelY.toFixed(1) + '" font-size="' + (isLast?'11.5':'10.5') + '" font-weight="700" fill="' + (isLast?'#ffffff':'rgba(255,255,255,0.85)') + '" text-anchor="middle">' + p + '</text>';
    return dot;
  }).join('');

  var svgInner =
    '<defs>' +
      '<linearGradient id="' + uidLine + '" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0%" stop-color="var(--blue-300)"/>' +
        '<stop offset="100%" stop-color="var(--blue-500)"/>' +
      '</linearGradient>' +
      '<linearGradient id="' + uidArea + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="var(--blue-400)" stop-opacity="0.35"/>' +
        '<stop offset="100%" stop-color="var(--blue-400)" stop-opacity="0"/>' +
      '</linearGradient>' +
      '<filter id="' + uidGlow + '" x="-50%" y="-50%" width="200%" height="200%">' +
        '<feGaussianBlur stdDeviation="4" result="blur"/>' +
      '</filter>' +
    '</defs>' +
    gridLines +
    areaFills +
    '<line x1="' + padL + '" y1="' + threshY.toFixed(1) + '" x2="' + (W-padR) + '" y2="' + threshY.toFixed(1) + '" stroke="#EF4444" stroke-width="1.5" stroke-dasharray="5,4" opacity="0.7"/>' +
    '<text x="' + (W-padR) + '" y="' + (threshY-6).toFixed(1) + '" font-size="9.5" fill="#EF4444" opacity="0.95" text-anchor="end">Min ' + threshold + '</text>' +
    glowPaths +
    linePaths +
    dots +
    labels;

  return bungkusKartuGrafikGelap(svgInner, W, H, 500, 'Skor rata-rata bulanan');
}

// ==================== PAPAN SKOR (LEADERBOARD) ====================
// Render daftar peringkat skor performa TERAKHIR untuk sekumpulan karyawan (empList = array
// item dari DB.employees). Diurutkan dari skor terakhir tertinggi ke terendah; yang belum
// pernah punya skor ditempatkan paling bawah. Dipakai di halaman Performa Koordinator & HRD.
function buildPapanSkor(empList, opts) {
  opts = opts || {};
  var showDivKoor = opts.showDivKoor !== false;

  if (!empList || !empList.length) {
    return '<div style="text-align:center;padding:32px;color:var(--gray-400);font-size:13px">' +
      '<i class="ti ti-list-numbers" style="font-size:32px;display:block;margin-bottom:8px"></i>' +
      'Belum ada karyawan untuk ditampilkan.' +
    '</div>';
  }

  var rows = empList.map(function(e) {
    var terakhir = getSkorTerakhir(e.email);
    return { emp: e, terakhir: terakhir, skorUrut: terakhir ? terakhir.skor : -1 };
  });
  rows.sort(function(a,b){ return b.skorUrut - a.skorUrut; });

  return '<div style="display:flex;flex-direction:column">' +
    rows.map(function(row, idx) {
      var e = row.emp, t = row.terakhir;
      var rankColor = idx===0 ? 'var(--amber)' : idx===1 ? 'var(--gray-400)' : idx===2 ? '#b45309' : 'var(--gray-300)';
      var skorColor = t ? (t.skor>=80?'var(--green)':t.skor>=60?'var(--amber)':'var(--red)') : 'var(--gray-300)';
      return '<div class="trow">' +
        '<div style="width:22px;text-align:center;font-weight:800;font-size:12px;color:' + rankColor + ';flex-shrink:0">#' + (idx+1) + '</div>' +
        '<div class="av" style="background:' + e.bg + ';color:#fff">' + e.inits + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:13px;font-weight:600;color:var(--gray-800);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + e.name + '</div>' +
          (showDivKoor ? '<div style="font-size:11px;color:var(--gray-400)">' + (e.div||'-') + ' · Koor: ' + (e.koor||'-') + '</div>' : '') +
        '</div>' +
        '<div style="text-align:center;min-width:64px">' +
          '<div style="font-size:9px;color:var(--gray-400);text-transform:uppercase;letter-spacing:.5px">Terakhir</div>' +
          '<div style="font-size:15px;font-weight:700;color:' + skorColor + '">' + (t ? t.skor : '—') + '</div>' +
        '</div>' +
        '<div style="text-align:center;min-width:80px">' +
          '<div style="font-size:9px;color:var(--gray-400);text-transform:uppercase;letter-spacing:.5px">Avg Bulan Ini</div>' +
          '<div style="font-size:15px;font-weight:700;color:var(--gray-600)">' + (e.skor!=null ? e.skor : '—') + '</div>' +
        '</div>' +
        statusBadge(e.status==='cabut' ? 'cabut' : 'aktif') +
      '</div>';
    }).join('') +
  '</div>';
}

