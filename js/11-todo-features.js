/* ============================================================
 * FILE   : 11-todo-features.js
 * BAGIAN : Fitur To-Do Harian
 * ISI    : Simpan/tampilkan to-do harian karyawan, penilaian skor to-do, submit to-do, reminder Hubstaff.
 * ============================================================ */

// ==================== TODO ====================
var myTodos = [{task:'',score:null},{task:'',score:null},{task:'',score:null}];

function loadMyTodos() {
  var aKey = attendKey(currentUser.email);
  var saved = DB.todos[aKey];
  if (saved && saved.length) {
    // BUGFIX: copy semua field penting agar koreksi/komentar koordinator ikut terbawa di myTodos
    myTodos = saved.map(function(t) {
      return {
        task:          t.task || '',
        score:         (t.score === undefined ? null : t.score),
        koreksi_skor:  (t.koreksi_skor !== undefined ? t.koreksi_skor : null),
        komentar_koor: t.komentar_koor || '',
        koor_edit_by:  t.koor_edit_by  || '',
        koor_edit_time:t.koor_edit_time|| ''
      };
    });
  } else {
    myTodos = [{task:'',score:null},{task:'',score:null},{task:'',score:null}];
  }
}

function saveMyTodos() {
  var aKey = attendKey(currentUser.email);
  // BUGFIX: baca existing langsung dari DB (bukan snapshot lama) agar koreksi koordinator tidak tertimpa
  var existing = DB.todos[aKey] || [];
  var newTodos = myTodos.map(function(t,i) {
    var prev = existing[i] || {};
    var item = {
      task:         t.task || '',
      score:        (t.score !== null && t.score !== undefined) ? t.score : null,
      koreksi_skor: (prev.koreksi_skor !== null && prev.koreksi_skor !== undefined) ? prev.koreksi_skor : null,
      komentar_koor: prev.komentar_koor || ''
    };
    if (prev.koor_edit_by)   item.koor_edit_by   = prev.koor_edit_by;
    if (prev.koor_edit_time) item.koor_edit_time = prev.koor_edit_time;
    return item;
  });
  DB.todos[aKey] = newTodos;
  // BUGFIX: simpan hanya path todos/aKey ke Firebase (bukan seluruh DB) → cegah race condition
  dbSaveLocal(DB);
  showSaveStatus('todo-save-status', 'saving');
  dbSavePath('todos/' + aKey, cleanForFirebase(newTodos)).then(function(){
    showSaveStatus('todo-save-status', 'saved');
  }).catch(function(){
    showSaveStatus('todo-save-status', 'error');
  });
  if (bc) bc.postMessage({ type:'update', data: DB });
}

function renderTodoFull() {
  var c = document.getElementById('todo-container');
  if (!c) return;
  loadMyTodos();

  var aKey       = attendKey(currentUser.email);
  var rec        = DB.attendance[aKey] || {};
  var sudahPagi  = !!rec.pagi;
  var sudahSiang = !!rec.siang;

  // ============ FASE PAGI: belum absen siang ============
  if (!sudahSiang) {
    c.innerHTML =
      // Banner fase
      '<div style="display:flex;align-items:center;gap:10px;background:linear-gradient(135deg,#0078D4,#0050A0);color:#fff;border-radius:var(--radius-lg);padding:14px 18px;margin-bottom:16px">' +
        '<i class="ti ti-sun" style="font-size:22px"></i>' +
        '<div><div style="font-weight:700;font-size:14px">Fase Pagi</div>' +
        '<div style="font-size:12px;opacity:.85">Absen pagi + isi to-do list → kirim ke koordinator → nyalakan Hubstaff</div></div>' +
        (sudahPagi ? '<span style="margin-left:auto;background:rgba(255,255,255,0.2);padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600">✓ Absen ' + rec.pagi + '</span>' : '') +
      '</div>' +

      // Warning jika belum absen pagi
      (!sudahPagi ?
        '<div class="info-bar info-amber" style="margin-bottom:14px"><i class="ti ti-alert-circle"></i>' +
        'Belum absen pagi. <button onclick="showPage(\'kary\',\'absen\')" style="background:none;border:none;color:var(--blue-700);font-weight:700;cursor:pointer;padding:0;font-size:13px">Absen dulu →</button></div>'
      : '') +

      // Form to-do
      '<div class="card"><div class="card-head"><i class="ti ti-list-check" style="color:var(--blue-600)"></i><h2>To-Do List Pagi</h2></div>' +
      '<div class="info-bar info-blue" style="margin-bottom:12px"><i class="ti ti-info-circle"></i>Tulis rencana kerja sebelum jam ' + DB.settings.batasPagi + '. Koordinator dapat melihat tugas Anda.</div>' +
      '<div id="td-list"></div>' +
      '<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:6px;justify-content:center" onclick="addTodo()"><i class="ti ti-plus"></i>Tambah Tugas</button>' +
      '<div style="display:flex;align-items:center;justify-content:flex-end;margin-top:12px;gap:8px">' +
        '<span id="todo-save-status" style="font-size:11px;color:var(--gray-400);margin-right:auto;display:flex;align-items:center;gap:4px"></span>' +
        '<button class="btn btn-ghost" onclick="saveTodoDraft()"><i class="ti ti-device-floppy"></i>Simpan Draft</button>' +
        '<button class="btn btn-primary" onclick="submitTodo()"><i class="ti ti-send"></i>Kirim ke Koordinator</button>' +
      '</div></div>' +

      // Penilaian skor — terkunci, hanya preview
      '<div class="card" style="border:1.5px dashed var(--gray-200)">' +
        '<div class="card-head">' +
          '<i class="ti ti-lock" style="color:var(--gray-300)"></i>' +
          '<h2 style="color:var(--gray-400)">Penilaian Skor Siang</h2>' +
          '<span class="badge badge-gray" style="margin-left:auto">Tersedia setelah absen siang</span>' +
        '</div>' +
        '<div style="padding:16px;text-align:center;color:var(--gray-400);font-size:13px">' +
          '<i class="ti ti-moon" style="font-size:28px;display:block;margin-bottom:8px;color:var(--gray-300)"></i>' +
          'Selesaikan pekerjaan hari ini, lalu <strong>absen siang</strong> untuk membuka penilaian skor.' +
        '</div>' +
      '</div>';

    renderTodoList();

  // ============ FASE SIANG: sudah absen siang → hanya penilaian skor ============
  } else {
    var f = myTodos.filter(function(t){ return t.task.trim(); });
    c.innerHTML =
      // Banner fase
      '<div style="display:flex;align-items:center;gap:10px;background:linear-gradient(135deg,#059669,#047857);color:#fff;border-radius:var(--radius-lg);padding:14px 18px;margin-bottom:16px">' +
        '<i class="ti ti-moon" style="font-size:22px"></i>' +
        '<div><div style="font-weight:700;font-size:14px">Fase Siang</div>' +
        '<div style="font-size:12px;opacity:.85">Absen siang sudah tercatat — sekarang beri penilaian skor untuk to-do pagi Anda</div></div>' +
        '<div style="margin-left:auto;text-align:right">' +
          '<div style="background:rgba(255,255,255,0.2);padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;margin-bottom:4px">✓ Pagi: ' + (rec.pagi||'--') + '</div>' +
          '<div style="background:rgba(255,255,255,0.2);padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600">✓ Siang: ' + rec.siang + '</div>' +
        '</div>' +
      '</div>' +

      // Ringkasan to-do pagi — readonly
      '<div class="card"><div class="card-head"><i class="ti ti-list" style="color:var(--blue-600)"></i><h2>To-Do Pagi Anda (Readonly)</h2></div>' +
      (f.length ?
        f.map(function(t, i) {
          var koreksi  = (t.koreksi_skor !== null && t.koreksi_skor !== undefined) ? t.koreksi_skor : null;
          var komentar = t.komentar_koor || '';
          var hasScore = (t.score !== null && t.score !== undefined);
          var skorAkhir = koreksi !== null ? koreksi : (hasScore ? t.score : null);
          var skorWarna = skorAkhir >= 80 ? 'var(--green)' : skorAkhir >= 60 ? 'var(--amber)' : skorAkhir !== null ? 'var(--red)' : 'var(--gray-400)';

          return '<div style="border:1px solid var(--gray-100);border-radius:var(--radius);padding:10px 12px;margin-bottom:8px">' +
            '<div style="display:flex;align-items:center;gap:10px">' +
              '<span style="font-size:12px;color:var(--gray-400);min-width:18px">' + (i+1) + '.</span>' +
              '<span style="flex:1;font-size:13px;color:var(--gray-700)">' + t.task + '</span>' +
              '<div style="display:flex;align-items:center;gap:5px">' +
                (hasScore
                  ? '<span style="font-size:12px;color:var(--gray-400)">Skor saya: ' + t.score + '</span>'
                  : '<span class="badge badge-gray">Belum dinilai</span>'
                ) +
                (koreksi !== null
                  ? '<i class="ti ti-arrow-right" style="font-size:11px;color:var(--gray-300)"></i>' +
                    '<span style="font-size:11px;color:var(--amber)">Koreksi koordinator:</span>' +
                    '<span style="font-weight:700;font-size:14px;color:' + skorWarna + '">' + koreksi + '</span>'
                  : ''
                ) +
              '</div>' +
            '</div>' +
            (komentar
              ? '<div style="margin-top:8px;background:var(--blue-50, #eff6ff);border-left:3px solid var(--blue-400);border-radius:0 6px 6px 0;padding:8px 10px;font-size:12px;color:var(--gray-700)">' +
                  '<span style="font-weight:600;color:var(--blue-600)"><i class="ti ti-message-circle-2" style="margin-right:4px"></i>Komentar Koordinator</span>' +
                  (t.koor_edit_by ? ' <span style="color:var(--gray-400);font-size:11px">· ' + t.koor_edit_by + ' ' + (t.koor_edit_time||'') + '</span>' : '') +
                  '<div style="margin-top:4px">' + komentar + '</div>' +
                '</div>'
              : ''
            ) +
          '</div>';
        }).join('')
        : '<div style="font-size:13px;color:var(--gray-400);padding:8px 0">To-do list pagi kosong</div>'
      ) +
      '</div>' +

      // Form penilaian skor
      '<div class="card"><div class="card-head"><i class="ti ti-star" style="color:var(--amber)"></i><h2>Beri Skor Pencapaian</h2></div>' +
      '<div class="info-bar info-amber" style="margin-bottom:12px"><i class="ti ti-info-circle"></i>Nilai setiap tugas secara jujur. Koordinator akan memverifikasi penilaian Anda.</div>' +
      '<div id="skor-list"></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:16px;padding-top:12px;border-top:1px solid var(--gray-100)">' +
        '<div style="font-size:14px;color:var(--gray-600)">Rata-rata skor: <strong id="avg-skor" style="font-size:20px;color:var(--blue-700)">—</strong></div>' +
        '<button class="btn btn-primary" onclick="submitSkor()"><i class="ti ti-check"></i>Simpan Penilaian</button>' +
      '</div></div>';

    renderSkorList();
  }
}

function renderTodoList() {
  var c=document.getElementById('td-list');
  if (!c) return;
  c.innerHTML = myTodos.map(function(t,i) {
    return '<div class="todo-item">' +
      '<span style="font-size:12px;color:var(--gray-400);min-width:18px">' + (i+1) + '.</span>' +
      '<input type="text" value="' + t.task.replace(/"/g,'&quot;') + '" placeholder="Tulis tugas yang akan dikerjakan..." oninput="myTodos[' + i + '].task=this.value;autoSaveTodoDraftDebounced()"/>' +
      '<button class="del" onclick="delTodo(' + i + ')"><i class="ti ti-trash" style="font-size:14px"></i></button>' +
      '</div>';
  }).join('');
}

function addTodo(){ myTodos.push({task:'',score:null}); renderTodoList(); }
function delTodo(i){ myTodos.splice(i,1); renderTodoList(); }

function saveTodoDraft() { saveMyTodos(); showToast('Draft tersimpan','info'); }

function submitTodo() {
  var f = myTodos.filter(function(t){ return t.task.trim(); });
  if (!f.length) { showToast('Tambahkan minimal satu tugas','error'); return; }
  saveMyTodos();
  showToast(f.length+' tugas berhasil dikirim ke koordinator','success');
  renderSkorList();

  // Tampilkan reminder Hubstaff setelah submit to-do
  showHubstaffReminder();
}

function showHubstaffReminder() {
  var old = document.getElementById('hubstaff-modal');
  if (old) old.remove();

  var html =
    '<div id="hubstaff-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px">' +
      '<div style="background:#fff;border-radius:16px;padding:32px;max-width:400px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3)">' +
        '<div style="width:64px;height:64px;background:#dbeafe;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">' +
          '<i class="ti ti-device-laptop" style="font-size:32px;color:#0078D4"></i>' +
        '</div>' +
        '<h2 style="margin:0 0 8px;font-size:20px;color:#1e293b">To-Do List Terkirim! ✅</h2>' +
        '<p style="margin:0 0 20px;color:#64748b;font-size:14px">Langkah terakhir — pastikan <strong>Hubstaff</strong> sudah aktif sebelum mulai bekerja.</p>' +

        '<div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:16px;margin-bottom:20px;text-align:left">' +
          '<div style="font-size:13px;font-weight:700;color:#1e40af;margin-bottom:10px"><i class="ti ti-info-circle" style="margin-right:6px"></i>Cara menyalakan Hubstaff:</div>' +
          '<div style="font-size:12px;color:#334155;line-height:1.8">' +
            '1. Buka aplikasi <strong>Hubstaff</strong> di laptop/HP<br>' +
            '2. Pilih proyek yang sesuai<br>' +
            '3. Klik tombol <strong>▶ Start</strong> untuk mulai tracking<br>' +
            '4. Pastikan timer berjalan sebelum mulai kerja' +
          '</div>' +
        '</div>' +

        '<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;margin-bottom:20px;font-size:12px;color:#92400e;text-align:left">' +
          '<i class="ti ti-alert-triangle" style="margin-right:6px"></i>' +
          'Hubstaff yang tidak aktif akan tercatat sebagai pelanggaran dan dipantau koordinator.' +
        '</div>' +

        '<button onclick="document.getElementById(\'hubstaff-modal\').remove();showPage(\'kary\',\'hubstaff\')" style="width:100%;padding:13px;background:#0078D4;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">' +
          '<i class="ti ti-player-play" style="margin-right:6px"></i>Aktifkan Hubstaff Sekarang!' +
        '</button>' +
        '<button onclick="document.getElementById(\'hubstaff-modal\').remove()" style="width:100%;margin-top:8px;padding:10px;background:transparent;border:none;font-size:12px;color:#94a3b8;cursor:pointer">Lewati</button>' +
      '</div>' +
    '</div>';

  document.body.insertAdjacentHTML('beforeend', html);
}

function renderSkorList() {
  var c = document.getElementById('skor-list');
  if (!c) return;
  var f = myTodos.filter(function(t){ return t.task.trim(); });
  if (!f.length) { c.innerHTML='<div style="font-size:13px;color:var(--gray-400)">Isi dan kirim to-do list pagi terlebih dahulu</div>'; return; }
  c.innerHTML = f.map(function(t,i) {
    var hasScore = (t.score !== null && t.score !== undefined);
    return '<div class="todo-item">' +
      '<i class="ti ' + (hasScore?'ti-check-circle':'ti-circle') + '" style="font-size:16px;color:' + (hasScore?'var(--green)':'var(--gray-300)') + '"></i>' +
      '<div style="flex:1;font-size:13px">' + t.task + '</div>' +
      '<select style="width:80px;padding:7px 6px;border:1.5px solid var(--gray-200);border-radius:var(--radius);font-size:13px;font-family:var(--font)" onchange="setSkor(' + i + ',this.value)">' +
        '<option value="">Skor</option>' +
        [100,90,80,70,60,50,0].map(function(s){ return '<option value="'+s+'" '+(hasScore && t.score===s?'selected':'')+'>'+s+'</option>'; }).join('') +
      '</select></div>';
  }).join('');
  updateAvgSkor();
}

function setSkor(i, v) {
  var f = myTodos.filter(function(t){ return t.task.trim(); });
  f[i].score = v ? parseInt(v) : null;
  updateAvgSkor();
}

function updateAvgSkor() {
  var scores = myTodos.filter(function(t){ return t.score !== null && t.score !== undefined; }).map(function(t){ return t.score; });
  var avg = document.getElementById('avg-skor');
  if (avg) avg.textContent = scores.length ? Math.round(scores.reduce(function(a,b){return a+b;},0)/scores.length) : '—';
}

function submitSkor() {
  var f = myTodos.filter(function(t){ return t.task.trim() && t.score !== null && t.score !== undefined; });
  if (!f.length) { showToast('Isi skor minimal satu tugas','error'); return; }
  saveMyTodos();
  hitungSkorHarian(currentUser.email, attendKey(currentUser.email));
  persistSkorHarian(currentUser.email, attendKey(currentUser.email)); // BUGFIX: jangan dbSave(DB) penuh
  showToast('Penilaian skor berhasil disimpan & dikirim ke koordinator','success');
}

// ==================== RIWAYAT TO-DO (karyawan) ====================
// Dipakai di halaman "Riwayat Absensi": klik panah pada satu tanggal untuk melihat isi to-do
// list & skornya (termasuk koreksi & komentar koordinator jika ada) pada tanggal tersebut.
function toggleTodoRiwayatKary(chevEl, aKey) {
  var safeId = 'my-td-' + aKey.replace(/[^a-zA-Z0-9]/g,'_');
  var row = document.getElementById(safeId + '-detail');
  if (!row) return;
  var isOpen = row.style.display !== 'none';
  if (isOpen) {
    row.style.display = 'none';
    if (chevEl) { chevEl.classList.remove('ti-chevron-up'); chevEl.classList.add('ti-chevron-down'); }
    return;
  }
  var cell = row.querySelector('.mytd-detail-cell');
  if (cell && cell.dataset.loaded !== '1') {
    cell.innerHTML = renderTodoRiwayatDetailKary(aKey);
    cell.dataset.loaded = '1';
  }
  row.style.display = '';
  if (chevEl) { chevEl.classList.remove('ti-chevron-down'); chevEl.classList.add('ti-chevron-up'); }
}

function renderTodoRiwayatDetailKary(aKey) {
  var todos = (DB.todos[aKey] || []).filter(function(t){ return t.task && t.task.trim(); });
  if (!todos.length) return '<div style="padding:14px;color:var(--gray-400);font-size:12px;text-align:center">Tidak ada to-do list pada tanggal ini.</div>';

  var rows = todos.map(function(t, i){
    var koreksi  = (t.koreksi_skor !== null && t.koreksi_skor !== undefined) ? t.koreksi_skor : null;
    var hasScore = (t.score !== null && t.score !== undefined);
    var skorAkhir = koreksi !== null ? koreksi : (hasScore ? t.score : null);
    var skorWarna = skorAkhir>=80?'var(--green)':skorAkhir>=60?'var(--amber)':skorAkhir!=null?'var(--red)':'var(--gray-400)';
    return '<div style="border:1px solid var(--gray-100);border-radius:var(--radius);padding:10px 12px;margin-bottom:8px;background:var(--white)">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<span style="font-size:12px;color:var(--gray-400);min-width:18px">' + (i+1) + '.</span>' +
        '<span style="flex:1;font-size:13px;color:var(--gray-700)">' + t.task + '</span>' +
        (hasScore ? '<span style="font-size:12px;color:var(--gray-400)">Skor saya: ' + t.score + '</span>' : '<span class="badge badge-gray">Belum dinilai</span>') +
        (koreksi !== null
          ? '<i class="ti ti-arrow-right" style="font-size:11px;color:var(--gray-300)"></i><span style="font-weight:700;font-size:14px;color:' + skorWarna + '">' + koreksi + '</span>'
          : '') +
      '</div>' +
      (t.komentar_koor
        ? '<div style="margin-top:8px;background:var(--blue-50, #eff6ff);border-left:3px solid var(--blue-400);border-radius:0 6px 6px 0;padding:8px 10px;font-size:12px;color:var(--gray-700)">' +
            '<span style="font-weight:600;color:var(--blue-600)"><i class="ti ti-message-circle-2" style="margin-right:4px"></i>Komentar Koordinator</span>' +
            (t.koor_edit_by ? ' <span style="color:var(--gray-400);font-size:11px">· ' + t.koor_edit_by + ' ' + (t.koor_edit_time||'') + '</span>' : '') +
            '<div style="margin-top:4px">' + t.komentar_koor + '</div>' +
          '</div>'
        : '') +
    '</div>';
  }).join('');

  return '<div style="padding:12px 14px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--gray-500);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px"><i class="ti ti-list-check"></i> To-Do List Tanggal Ini</div>' +
    rows +
  '</div>';
}

