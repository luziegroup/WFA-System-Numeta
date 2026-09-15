/* ============================================================
 * FILE   : 03-ui-common.js
 * BAGIAN : Utilitas UI Umum
 * ISI    : Jam realtime (clock), notifikasi toast, switch tab laporan.
 * ============================================================ */

// ==================== LAPORAN TAB SWITCH ====================
function laporanSwitchTab(tab) {
  var panelA = document.getElementById('panel-absen');
  var panelT = document.getElementById('panel-todo');
  var btnA   = document.getElementById('tab-absen-btn');
  var btnT   = document.getElementById('tab-todo-btn');
  if (!panelA || !panelT) return;
  panelA.style.display = tab === 'absen' ? 'block' : 'none';
  panelT.style.display = tab === 'todo'  ? 'block' : 'none';
  if (btnA && btnT) {
    if (tab === 'absen') {
      btnA.style.background = 'var(--white)'; btnA.style.color = 'var(--blue-700)'; btnA.style.boxShadow = '0 1px 4px rgba(0,0,0,.1)';
      btnT.style.background = 'transparent';  btnT.style.color = 'var(--gray-500)';  btnT.style.boxShadow = 'none';
    } else {
      btnT.style.background = 'var(--white)'; btnT.style.color = 'var(--blue-700)'; btnT.style.boxShadow = '0 1px 4px rgba(0,0,0,.1)';
      btnA.style.background = 'transparent';  btnA.style.color = 'var(--gray-500)';  btnA.style.boxShadow = 'none';
    }
  }
}

// ==================== CLOCK ====================
function updateClock() {
  const n = new Date();
  const t = [n.getHours(),n.getMinutes(),n.getSeconds()].map(v=>String(v).padStart(2,'0')).join(':');
  const tShort = [n.getHours(),n.getMinutes()].map(v=>String(v).padStart(2,'0')).join(':');
  const el = document.getElementById('topnav-clock');
  const mobEl = document.getElementById('mob-clock');
  if (el) el.textContent = t;
  if (mobEl) mobEl.textContent = tShort;
}
setInterval(updateClock, 1000);

// ==================== TOAST ====================
function showToast(msg, type) {
  type = type || 'success';
  const t = document.getElementById('toast');
  const icons = {success:'ti-check',warning:'ti-alert-triangle',error:'ti-alert-circle',info:'ti-info-circle'};
  const colors = {success:'#0D9E6B',warning:'#D97706',error:'#DC2626',info:'#0078D4'};
  t.innerHTML = '<i class="ti ' + icons[type] + '" style="font-size:16px;color:' + colors[type] + '"></i> ' + msg;
  t.style.display = 'flex';
  t.style.borderLeft = '4px solid ' + colors[type];
  clearTimeout(t._timer);
  t._timer = setTimeout(function(){ t.style.display='none'; }, 3500);
}

// BUGFIX: indikator status simpan yang jujur ke karyawan (jangan biarkan mereka mengira
// data sudah tersimpan padahal koneksi gagal/putus — ini akar masalah "data hilang")
function showSaveStatus(targetId, status) {
  var el = document.getElementById(targetId);
  if (!el) return;
  if (status === 'saving') {
    el.innerHTML = '<i class="ti ti-loader-2" style="font-size:12px"></i> Menyimpan...';
    el.style.color = 'var(--gray-400)';
  } else if (status === 'saved') {
    el.innerHTML = '<i class="ti ti-circle-check" style="font-size:12px"></i> Tersimpan';
    el.style.color = 'var(--green)';
  } else if (status === 'error') {
    el.innerHTML = '<i class="ti ti-alert-triangle" style="font-size:12px"></i> Gagal tersimpan — periksa koneksi internet';
    el.style.color = 'var(--red)';
  }
}

