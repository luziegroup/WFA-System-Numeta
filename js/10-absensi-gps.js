/* ============================================================
 * FILE   : 10-absensi-gps.js
 * BAGIAN : Absensi & GPS
 * ISI    : Inisialisasi GPS, proses absen pagi & siang, modal sukses absen.
 * ============================================================ */

// ==================== GPS ====================
function initGPS() {
  if (!navigator.geolocation) {
    var lbl = document.getElementById('gps-label');
    var dot = document.getElementById('gps-dot');
    if (lbl) lbl.textContent='GPS tidak tersedia di browser ini';
    if (dot) dot.className='gps-dot error';
    return;
  }
  var dot   = document.getElementById('gps-dot');
  var lbl   = document.getElementById('gps-label');
  var coord = document.getElementById('gps-coord');
  var mapDiv= document.getElementById('gps-map');
  if (!dot) return;
  dot.className='gps-dot detecting';
  lbl.textContent='Mendeteksi lokasi GPS...';
  coord.textContent='Meminta izin akses lokasi';
  if (gpsWatchId) navigator.geolocation.clearWatch(gpsWatchId);
  gpsWatchId = navigator.geolocation.watchPosition(
    function(pos) {
      gpsCoords = {lat:pos.coords.latitude, lng:pos.coords.longitude, acc:Math.round(pos.coords.accuracy)};
      dot.className='gps-dot found';
      lbl.textContent='Lokasi terdeteksi';
      coord.textContent=gpsCoords.lat.toFixed(6)+', '+gpsCoords.lng.toFixed(6)+' · Akurasi: ±'+gpsCoords.acc+'m';
      if (mapDiv) {
        mapDiv.innerHTML='<iframe src="https://www.openstreetmap.org/export/embed.html?bbox='+(gpsCoords.lng-.005)+','+(gpsCoords.lat-.005)+','+(gpsCoords.lng+.005)+','+(gpsCoords.lat+.005)+'&layer=mapnik&marker='+gpsCoords.lat+','+gpsCoords.lng+'" style="width:100%;height:100%;border:none"></iframe>';
      }
    },
    function(err) {
      dot.className='gps-dot error';
      var msgs={1:'Izin lokasi ditolak',2:'Lokasi tidak tersedia',3:'Timeout GPS'};
      lbl.textContent=msgs[err.code]||'Error GPS';
      coord.textContent='Pastikan izin lokasi diaktifkan di browser';
    },
    {enableHighAccuracy:true,timeout:15000,maximumAge:0}
  );
}

// ==================== ABSEN KARYAWAN ====================
function karyAbsenPagi() {
  var lok = document.getElementById('k-lokasi');
  if (!lok || !lok.value.trim()) { showToast('Isi lokasi WFA terlebih dahulu','error'); return; }
  var now = new Date();
  var h=now.getHours(), m=now.getMinutes();
  var ts = String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
  var batasParts = DB.settings.batasPagi.split(':');
  var late = h>parseInt(batasParts[0])||(h===parseInt(batasParts[0])&&m>=parseInt(batasParts[1]));
  var aKey = attendKey(currentUser.email);
  DB.attendance[aKey] = DB.attendance[aKey] || {};
  DB.attendance[aKey].pagi   = ts;
  DB.attendance[aKey].lokasi = lok.value.trim();
  DB.attendance[aKey].status = late?'terlambat':'hadir';
  DB.attendance[aKey].gps    = gpsCoords ? (gpsCoords.lat.toFixed(5)+', '+gpsCoords.lng.toFixed(5)) : 'GPS tidak tersedia';
  var empIdx = DB.employees.findIndex(function(e){ return (e.email||'').toLowerCase()===currentUser.email.toLowerCase(); });
  // CATATAN: tidak perlu lagi tulis status/pagi ke DB.employees — dashboard
  // sekarang membaca langsung dari DB.attendance[hari ini], lebih akurat
  hitungSkorHarian(currentUser.email, aKey);

  // BUGFIX: Simpan granular per path agar tidak menimpa absen karyawan lain (race condition)
  dbSaveLocal(DB);
  var p1 = dbSavePath('attendance/' + aKey, cleanForFirebase(DB.attendance[aKey]));
  if (bc) bc.postMessage({ type:'update', data: DB });
  // BUGFIX: kasih tahu karyawan secara jujur kalau absennya GAGAL terkirim ke server.
  // BUGFIX #2: dulu pesan ini menyuruh "muat ulang halaman" untuk coba lagi — padahal
  // reload justru MENGHAPUS data yang belum terkirim. Sekarang sistem mencoba kirim
  // ulang otomatis di latar belakang, jadi user cukup diminta menunggu/tetap online.
  p1.catch(function(){
    showToast('⚠️ Absen pagi tersimpan di perangkat ini, sempat gagal terkirim ke server. Sistem akan mencoba mengirim ulang otomatis — tetap buka halaman ini & pastikan internet menyala, JANGAN muat ulang sebelum status berubah "Tersimpan".', 'error');
  });

  // Tampilkan modal sukses → arahkan ke to-do list
  showAbsenSuksesModal(ts, late, 'pagi');
}

function karyAbsenSiang() {
  var now = new Date();
  var mulaiParts = DB.settings.mulaiSiang.split(':');
  if (now.getHours()<parseInt(mulaiParts[0])) { showToast('Absen siang baru tersedia mulai '+DB.settings.mulaiSiang,'error'); return; }
  var ts = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  var aKey = attendKey(currentUser.email);
  DB.attendance[aKey] = DB.attendance[aKey] || {};
  DB.attendance[aKey].siang = ts;
  DB.attendance[aKey].gps_siang = gpsCoords ? (gpsCoords.lat.toFixed(5)+', '+gpsCoords.lng.toFixed(5)) : 'GPS tidak tersedia';
  var empIdx = DB.employees.findIndex(function(e){ return (e.email||'').toLowerCase()===currentUser.email.toLowerCase(); });
  // CATATAN: tidak perlu lagi tulis siang ke DB.employees — dashboard membaca dari DB.attendance

  // BUGFIX: Simpan granular per path agar tidak menimpa absen karyawan lain (race condition)
  dbSaveLocal(DB);
  var p1 = dbSavePath('attendance/' + aKey, cleanForFirebase(DB.attendance[aKey]));
  if (bc) bc.postMessage({ type:'update', data: DB });
  p1.catch(function(){
    showToast('⚠️ Absen siang tersimpan di perangkat ini, sempat gagal terkirim ke server. Sistem akan mencoba mengirim ulang otomatis — tetap buka halaman ini & pastikan internet menyala, JANGAN muat ulang sebelum status berubah "Tersimpan".', 'error');
  });

  showAbsenSuksesModal(ts, false, 'siang');
}

function showAbsenSuksesModal(ts, late, tipe) {
  // Hapus modal lama jika ada
  var old = document.getElementById('absen-modal');
  if (old) old.remove();

  var isPagi = tipe === 'pagi';
  var modalHTML =
    '<div id="absen-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px">' +
      '<div style="background:#fff;border-radius:16px;padding:32px;max-width:420px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3)">' +

        // Icon sukses
        '<div style="width:64px;height:64px;background:' + (late?'#fef3c7':'#d1fae5') + ';border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">' +
          '<i class="ti ' + (late?'ti-clock-exclamation':'ti-circle-check') + '" style="font-size:32px;color:' + (late?'#d97706':'#059669') + '"></i>' +
        '</div>' +

        '<h2 style="margin:0 0 6px;font-size:20px;color:#1e293b">' + (late?'Absen Terlambat':'Absen Berhasil!') + '</h2>' +
        '<p style="margin:0 0 20px;color:#64748b;font-size:14px">' +
          'Absen ' + (isPagi?'pagi':'siang') + ' tercatat pukul <strong>' + ts + '</strong>' +
          (late?' — <span style="color:#d97706">terlambat dari batas ' + DB.settings.batasPagi + '</span>':'') +
        '</p>' +

        (isPagi ?
          // Setelah absen pagi → isi to-do list + nyalakan hubstaff
          '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:20px;text-align:left">' +
            '<div style="font-size:13px;font-weight:700;color:#065f46;margin-bottom:10px"><i class="ti ti-list-check" style="margin-right:6px"></i>Langkah selanjutnya:</div>' +
            '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #d1fae5">' +
              '<div style="width:24px;height:24px;background:#059669;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0"><span style="color:#fff;font-size:11px;font-weight:700">1</span></div>' +
              '<div style="font-size:13px;color:#1e293b"><strong>Isi To-Do List</strong> — tulis rencana kerja hari ini</div>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:10px;padding:8px 0">' +
              '<div style="width:24px;height:24px;background:#0078D4;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0"><span style="color:#fff;font-size:11px;font-weight:700">2</span></div>' +
              '<div style="font-size:13px;color:#1e293b"><strong>Nyalakan Hubstaff</strong> — pastikan tracking aktif</div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:10px">' +
            '<button onclick="tutupModalAbsen()" style="flex:1;padding:12px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;color:#475569">Nanti</button>' +
            '<button onclick="tutupModalAbsen();showPage(\'kary\',\'todo\')" style="flex:2;padding:12px;background:#059669;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer"><i class="ti ti-arrow-right" style="margin-right:6px"></i>Isi To-Do List Sekarang</button>' +
          '</div>'
        :
          // Setelah absen siang → reminder skor to-do
          '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px;margin-bottom:20px;text-align:left;font-size:13px;color:#1e40af">' +
            '<i class="ti ti-star" style="margin-right:6px"></i>Jangan lupa beri <strong>skor to-do list</strong> pagi Anda hari ini.' +
          '</div>' +
          '<button onclick="tutupModalAbsen();showPage(\'kary\',\'todo\')" style="width:100%;padding:12px;background:#0078D4;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer"><i class="ti ti-star" style="margin-right:6px"></i>Beri Skor To-Do Sekarang</button>' +
          '<button onclick="tutupModalAbsen()" style="width:100%;margin-top:8px;padding:10px;background:transparent;border:none;font-size:13px;color:#94a3b8;cursor:pointer">Lewati</button>'
        ) +
      '</div>' +
    '</div>';

  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function tutupModalAbsen() {
  var m = document.getElementById('absen-modal');
  if (m) m.remove();
  showPage('kary','absen');
}

