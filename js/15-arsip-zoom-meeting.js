/* ============================================================
 * FILE   : 15-arsip-zoom-meeting.js
 * BAGIAN : Arsip Data Lama & Zoom Meeting
 * ISI    : Konfigurasi & proses arsip data lama ke Google Sheets, manajemen jadwal Zoom Meeting.
 * ============================================================ */

// ==================== ARSIP DATA LAMA KE GOOGLE SHEETS ====================
// Tujuan: memindahkan absen & to-do yang sudah lama keluar dari Firebase
// supaya kuota gratis Firebase (Spark) tidak cepat habis. Data lama TIDAK
// hilang — tetap bisa dibuka lewat link Google Sheets, hanya saja sudah
// tidak ikut disinkronkan realtime oleh aplikasi ini lagi.

// Default: arsipkan semua data SEBELUM 2 bulan yang lalu
function defaultCutoffMonth() {
  var d = new Date();
  d.setMonth(d.getMonth() - 2);
  return d.toISOString().slice(0,7); // 'YYYY-MM'
}

function simpanKonfigArsip() {
  var url    = (document.getElementById('cfg-arsipUrl')?.value || '').trim();
  var secret = (document.getElementById('cfg-arsipSecret')?.value || '').trim();
  var link   = (document.getElementById('cfg-arsipSheetLink')?.value || '').trim();

  DB.settings.archiveWebAppUrl = url;
  DB.settings.archiveSecret    = secret;
  DB.settings.archiveSheetUrl  = link;

  dbSaveLocal(DB);
  dbSavePath('settings', cleanForFirebase(DB.settings));
  showToast('Konfigurasi arsip tersimpan', 'success');
  showPage('hrd','pengaturan');
}

function arsipkanDataLama() {
  var url    = DB.settings.archiveWebAppUrl;
  var secret = DB.settings.archiveSecret;
  if (!url || !secret) {
    showToast('Isi & simpan URL Web App + Secret Key dahulu sebelum mengarsipkan', 'error');
    return;
  }

  var cutoffMonth = document.getElementById('arsip-cutoff')?.value || defaultCutoffMonth();
  var cutoffStr = cutoffMonth + '-01'; // arsipkan semua tanggal SEBELUM tanggal 1 bulan ini

  // Kumpulkan baris arsip + daftar key yang akan dihapus dari Firebase
  var attendanceArchive = [];
  var todoArchive = [];
  var attKeysToDelete = {};
  var todoKeysToDelete = {};

  Object.keys(DB.attendance).forEach(function(key) {
    var tgl = key.slice(-10); // format key = encodedEmail_YYYY-MM-DD
    if (tgl >= cutoffStr) return; // masih dalam rentang aktif, jangan diarsipkan
    var email = emailFromAttendKey(key) || '';
    var emp = DB.employees.find(function(e){ return (e.email||'').toLowerCase() === email.toLowerCase(); });
    var rec = DB.attendance[key] || {};

    attendanceArchive.push({
      tanggal: tgl, email: email, nama: emp?emp.name:'', divisi: emp?emp.div:'', koordinator: emp?emp.koor:'',
      jamPagi: rec.pagi||'', jamSiang: rec.siang||'', status: rec.status||'',
      skorAbsen: rec.skorAbsen??'', skorTodo: rec.skorTodo??'', skorKomunikasi: rec.skorKomunikasi??'', skorAkhir: rec.skor??''
    });
    attKeysToDelete[key] = null;

    var todos = (DB.todos[key]||[]).filter(function(t){ return t.task && t.task.trim(); });
    todos.forEach(function(t) {
      todoArchive.push({
        tanggal: tgl, email: email, nama: emp?emp.name:'',
        tugas: t.task||'', skor: t.score??'', koreksiKoor: t.koreksi_skor??'', komentarKoor: t.komentar_koor||''
      });
    });
    if (DB.todos[key] !== undefined) todoKeysToDelete[key] = null;
  });

  if (!attendanceArchive.length) {
    showToast('Tidak ada data sebelum ' + cutoffMonth + ' yang perlu diarsipkan', 'info');
    return;
  }

  if (!confirm('Arsipkan ' + attendanceArchive.length + ' hari absensi (' + todoArchive.length + ' item to-do) sebelum ' + cutoffMonth + '?\n\nData ini akan dipindah ke Google Sheets lalu DIHAPUS dari Firebase untuk menghemat kuota. Lanjutkan?')) return;

  var btn = document.getElementById('btn-arsipkan');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2"></i> Mengarsipkan...'; }

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // hindari CORS preflight ke Apps Script
    body: JSON.stringify({ secret: secret, attendance: attendanceArchive, todos: todoArchive })
  })
  .then(function(res){ return res.json(); })
  .then(function(result) {
    if (!result || !result.ok) throw new Error((result && result.error) || 'Web App menolak permintaan');

    // Baru hapus dari Firebase SETELAH dipastikan tersimpan aman di Google Sheets
    var p1 = Object.keys(attKeysToDelete).length ? dbUpdatePaths('attendance', attKeysToDelete) : Promise.resolve();
    var p2 = Object.keys(todoKeysToDelete).length ? dbUpdatePaths('todos', todoKeysToDelete) : Promise.resolve();
    return Promise.all([p1, p2]);
  })
  .then(function() {
    Object.keys(attKeysToDelete).forEach(function(k){ delete DB.attendance[k]; });
    Object.keys(todoKeysToDelete).forEach(function(k){ delete DB.todos[k]; });
    dbSaveLocal(DB);
    if (bc) bc.postMessage({ type:'update', data: DB });
    showToast('✅ ' + attendanceArchive.length + ' hari absensi & ' + todoArchive.length + ' item to-do berhasil diarsipkan & dibersihkan dari Firebase', 'success');
    showPage('hrd','pengaturan');
  })
  .catch(function(err) {
    console.warn('Arsip gagal:', err);
    showToast('⚠️ Gagal mengarsipkan: ' + err.message + '. Data TIDAK dihapus dari Firebase, aman, coba lagi.', 'error');
  })
  .finally(function() {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-archive"></i>Arsipkan & Bersihkan'; }
  });
}

// ==================== ZOOM MEETING ====================
function zoomMeetCard(m, showActions) {
  var isToday = m.tanggal === todayKey();
  var borderClr = m.penting ? 'var(--red)' : (isToday ? 'var(--blue-300)' : 'var(--gray-200)');
  var bgClr     = m.penting ? 'var(--red-light)' : (isToday ? 'var(--blue-50)' : 'var(--white)');

  // ---- BUKTI FOTO ZOOM (bisa lebih dari satu — untuk sesi Pagi & Siang) ----
  // Kartu ini bisa ditampilkan ke koordinator (showActions=true, boleh upload/hapus) maupun
  // ke karyawan/riwayat (showActions=false, hanya lihat bukti kalau sudah ada).
  // BUGFIX: dulu cuma 1 foto per meeting (m.buktiFoto tunggal) — sekarang array m.buktiFotos
  // supaya bisa upload bukti Zoom Pagi & Zoom Siang (atau lebih) dalam satu kartu meeting yang sama.
  var daftarBukti = m.buktiFotos || (m.buktiFoto ? [{foto:m.buktiFoto, by:m.buktiFotoBy, at:m.buktiFotoAt}] : []);
  var buktiHtml = (function() {
    var galeri = daftarBukti.length ? (
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
        daftarBukti.map(function(b, idx){
          var waktuUpload = b.at ? new Date(b.at).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '';
          return '<div style="position:relative;width:64px">' +
            '<img src="' + b.foto + '" onclick="lihatBuktiZoomFull(' + m.id + ',' + idx + ')" style="width:64px;height:64px;object-fit:cover;border-radius:6px;cursor:pointer;border:1px solid var(--gray-200)" title="Klik untuk lihat ukuran penuh"/>' +
            (showActions ? '<button onclick="hapusBuktiZoom(' + m.id + ',' + idx + ')" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:var(--red);color:#fff;border:2px solid #fff;font-size:11px;line-height:1;cursor:pointer;padding:0" title="Hapus foto ini"><i class="ti ti-x"></i></button>' : '') +
            '<div style="font-size:9px;color:var(--gray-400);text-align:center;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + waktuUpload + '</div>' +
          '</div>';
        }).join('') +
      '</div>'
    ) : '';

    var badge = daftarBukti.length
      ? '<div style="margin-top:4px;font-size:11px;font-weight:700;color:var(--green)"><i class="ti ti-circle-check"></i> ' + daftarBukti.length + ' bukti foto terunggah' + (showActions?' (Pagi/Siang)':'') + '</div>'
      : '';

    if (!showActions) return daftarBukti.length ? (badge + galeri) : '';

    return badge + galeri +
      '<div style="margin-top:8px">' +
        '<label style="display:inline-flex;align-items:center;gap:6px;padding:7px 12px;background:var(--gray-100);border:1px dashed var(--gray-300);border-radius:var(--radius);font-size:11px;font-weight:600;color:var(--gray-600);cursor:pointer">' +
          '<i class="ti ti-camera-plus"></i>' + (daftarBukti.length ? 'Tambah Foto Lagi (Pagi/Siang)' : 'Upload Bukti Foto Zoom') +
          '<input type="file" accept="image/*" capture="environment" style="display:none" onchange="handleZoomBuktiUpload(this,' + m.id + ')"/>' +
        '</label>' +
        (!daftarBukti.length ? '<div style="font-size:10px;color:var(--gray-400);margin-top:4px"><i class="ti ti-clock"></i> Pastikan jam saat meeting berlangsung terlihat jelas di foto (screenshot layar/jam). Bisa upload lebih dari satu — misalnya untuk Zoom Pagi & Zoom Siang.</div>' : '') +
      '</div>';
  })();


  return '<div style="border:1.5px solid ' + borderClr + ';border-radius:var(--radius-lg);padding:14px 16px;margin-bottom:10px;background:' + bgClr + '">' +
    '<div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">' +
      '<div style="flex:1;min-width:200px">' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;flex-wrap:wrap">' +
          '<span class="badge ' + (isToday?'badge-green':'badge-gray') + '">' + (isToday?'Hari Ini · ':'') + m.tanggal + ' · ' + m.jam + '</span>' +
          (m.penting?'<span class="badge badge-red"><i class="ti ti-alert-circle"></i>Penting</span>':'') +
          '<span class="badge badge-blue">' + (m.status||'Aktif') + '</span>' +
        '</div>' +
        '<div style="font-size:14px;font-weight:700;color:var(--gray-800);margin-bottom:4px">' + m.judul + '</div>' +
        (m.catatan?'<div style="font-size:12px;color:var(--gray-500);margin-bottom:8px">' + m.catatan + '</div>':'') +
        '<div style="font-size:12px;color:var(--gray-400);word-break:break-all"><i class="ti ti-link" style="margin-right:4px"></i>' + m.link + '</div>' +
        buktiHtml +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">' +
        '<a href="' + m.link + '" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:var(--blue-600);color:#fff;border-radius:var(--radius);font-size:12px;font-weight:600;text-decoration:none"><i class="ti ti-video"></i>Buka</a>' +
        '<button onclick="navigator.clipboard.writeText(\'' + m.link + '\').then(function(){showToast(\'Link disalin!\',\'success\')})" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:var(--gray-100);border:1px solid var(--gray-200);border-radius:var(--radius);font-size:12px;font-weight:600;cursor:pointer"><i class="ti ti-copy"></i>Salin</button>' +
        (showActions ? '<button onclick="hapusZoomMeeting(' + m.id + ')" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:var(--red-light);color:var(--red);border:1px solid #fca5a5;border-radius:var(--radius);font-size:12px;font-weight:600;cursor:pointer"><i class="ti ti-trash"></i>Hapus</button>' : '') +
      '</div>' +
    '</div>' +
  '</div>';
}

// ---- Kompres gambar di sisi browser (canvas) sebelum disimpan ke Firebase ----
// Tujuan: foto bukti zoom seringkali berukuran beberapa MB (screenshot HP/laptop) — kalau
// disimpan mentah ke Realtime Database, ukuran data membengkak & memberatkan aplikasi/kuota.
// Di sini foto di-resize (maks ~900px sisi terpanjang) lalu dikompres JPEG bertahap sampai
// ukurannya kecil (target ±180KB). Juga ditambahkan stempel WAKTU UPLOAD di pojok foto —
// sebagai jejak tambahan kapan bukti ini diunggah (di luar jam yang terlihat di foto aslinya).
function compressZoomBukti(file, callback) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var maxDim = 900;
      var scale  = Math.min(1, maxDim / Math.max(img.width, img.height));
      var w = Math.max(1, Math.round(img.width  * scale));
      var h = Math.max(1, Math.round(img.height * scale));

      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      // Stempel waktu upload di pojok kanan bawah
      var stamp = 'Diupload: ' + new Date().toLocaleString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
      var fontSize = Math.max(11, Math.round(w/45));
      ctx.font = 'bold ' + fontSize + 'px sans-serif';
      var textW = ctx.measureText(stamp).width;
      var padX = 8, boxH = fontSize + 12;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(w - textW - padX*2 - 6, h - boxH - 6, textW + padX*2, boxH);
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.fillText(stamp, w - textW - padX - 6, h - 6 - boxH/2);

      // Kompres bertahap sampai cukup kecil (target ±180KB, minimum kualitas 0.35)
      var quality = 0.7;
      var dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length > 240000 && quality > 0.35) {
        quality -= 0.1;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      callback(dataUrl);
    };
    img.onerror = function(){ showToast('Gagal membaca gambar — coba file lain','error'); };
    img.src = e.target.result;
  };
  reader.onerror = function(){ showToast('Gagal membaca file','error'); };
  reader.readAsDataURL(file);
}

function handleZoomBuktiUpload(inputEl, meetingId) {
  var file = inputEl.files && inputEl.files[0];
  if (!file) return;
  if (!file.type || !file.type.startsWith('image/')) { showToast('File harus berupa gambar (JPG/PNG)','error'); inputEl.value=''; return; }
  if (file.size > 15*1024*1024) { showToast('Ukuran file terlalu besar (maks 15MB sebelum dikompres)','error'); inputEl.value=''; return; }

  showToast('Mengompres & mengunggah foto...','info');
  compressZoomBukti(file, function(dataUrl){
    var m = (DB.zoomMeetings||[]).find(function(x){ return x.id===meetingId; });
    if (!m) { showToast('Meeting tidak ditemukan','error'); return; }
    // BUGFIX: dulu hanya 1 foto per meeting (menimpa foto sebelumnya) — sekarang ditambahkan
    // ke daftar (array) supaya bisa upload lebih dari sekali, mis. untuk Zoom Pagi & Zoom Siang.
    if (!m.buktiFotos) m.buktiFotos = m.buktiFoto ? [{foto:m.buktiFoto, by:m.buktiFotoBy, at:m.buktiFotoAt}] : [];
    delete m.buktiFoto; delete m.buktiFotoBy; delete m.buktiFotoAt; // bersihkan field lama (sudah dipindah ke array)
    m.buktiFotos.push({
      foto: dataUrl,
      by:   (currentUser && currentUser.name) || '',
      at:   new Date().toISOString()
    });
    dbSaveLocal(DB);
    dbSavePath('zoomMeetings', cleanForFirebase(DB.zoomMeetings)); // BUGFIX: jangan timpa seluruh DB
    showToast('✅ Bukti foto ke-' + m.buktiFotos.length + ' berhasil diunggah (±' + Math.round(dataUrl.length/1024) + ' KB)','success');
    if (currentRole && currentPageId) showPage(currentRole, currentPageId);
  });
  inputEl.value = '';
}

function hapusBuktiZoom(meetingId, idx) {
  var m = (DB.zoomMeetings||[]).find(function(x){ return x.id===meetingId; });
  var daftar = m ? (m.buktiFotos || (m.buktiFoto ? [{foto:m.buktiFoto, by:m.buktiFotoBy, at:m.buktiFotoAt}] : [])) : [];
  if (!m || !daftar.length || !daftar[idx]) return;
  if (!confirm('Hapus foto bukti ke-' + (idx+1) + ' pada meeting "' + m.judul + '"?')) return;

  daftar.splice(idx, 1);
  m.buktiFotos = daftar;
  delete m.buktiFoto; delete m.buktiFotoBy; delete m.buktiFotoAt; // bersihkan field lama, semua sudah di array

  dbSaveLocal(DB);
  dbSavePath('zoomMeetings', cleanForFirebase(DB.zoomMeetings)); // BUGFIX: jangan timpa seluruh DB
  showToast('Bukti foto dihapus','warning');
  if (currentRole && currentPageId) showPage(currentRole, currentPageId);
}

function lihatBuktiZoomFull(meetingId, idx) {
  var m = (DB.zoomMeetings||[]).find(function(x){ return x.id===meetingId; });
  var daftar = m ? (m.buktiFotos || (m.buktiFoto ? [{foto:m.buktiFoto, by:m.buktiFotoBy, at:m.buktiFotoAt}] : [])) : [];
  var item = daftar[idx || 0];
  if (!item) return;
  var old = document.getElementById('bukti-zoom-modal');
  if (old) old.remove();
  var html = '<div id="bukti-zoom-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="document.getElementById(\'bukti-zoom-modal\').remove()">' +
    '<img src="' + item.foto + '" style="max-width:100%;max-height:90vh;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,.5)"/>' +
  '</div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function buatZoomMeeting() {
  var judul   = document.getElementById('zm-judul')?.value?.trim();
  var link    = document.getElementById('zm-link')?.value?.trim();
  var tgl     = document.getElementById('zm-tgl')?.value;
  var jam     = document.getElementById('zm-jam')?.value;
  var catatan = document.getElementById('zm-catatan')?.value?.trim();
  var penting = document.getElementById('zm-penting')?.checked;
  if (!judul)  { showToast('Judul meeting wajib diisi','error'); return; }
  if (!link)   { showToast('Link Zoom wajib diisi','error'); return; }
  if (!link.startsWith('http')) { showToast('Link harus diawali https://','error'); return; }
  DB.zoomMeetings = DB.zoomMeetings || [];
  DB.zoomMeetings.unshift({ id:Date.now(), koor:currentUser.name, tanggal:tgl, jam:jam, judul:judul, link:link, catatan:catatan, penting:penting, status:'Aktif' });
  dbSaveLocal(DB);
  dbSavePath('zoomMeetings', cleanForFirebase(DB.zoomMeetings)); // BUGFIX: jangan timpa seluruh DB
  showToast('Meeting "' + judul + '" berhasil dibuat & disebarkan ke tim', 'success');
  showPage('koor','zoom');
}

function simpanDraftZoom() {
  var judul = document.getElementById('zm-judul')?.value?.trim();
  if (!judul) { showToast('Isi judul terlebih dahulu','error'); return; }
  showToast('Draft "' + judul + '" tersimpan (belum dikirim)','info');
}

function hapusZoomMeeting(id) {
  var m = (DB.zoomMeetings||[]).find(function(x){ return x.id===id; });
  if (!m) return;
  if (!confirm('Hapus meeting "' + m.judul + '"?')) return;
  DB.zoomMeetings = DB.zoomMeetings.filter(function(x){ return x.id!==id; });
  dbSaveLocal(DB);
  dbSavePath('zoomMeetings', cleanForFirebase(DB.zoomMeetings)); // BUGFIX: jangan timpa seluruh DB
  showToast('Meeting dihapus','warning');
  showPage('koor','zoom');
}

