const el = (id) => document.getElementById(id);

function parsePairingCode(raw) {
  const s = raw.trim();
  const dot = s.indexOf('.');
  if (dot > 0) return { userId: s.slice(0, dot), token: s.slice(dot + 1) };
  return null;
}

async function refreshBadge() {
  const { userId } = await chrome.storage.local.get(['userId']);
  const badge = el('badge');
  const badgeText = el('badgeText');
  const who = el('who');
  if (!userId) {
    badge.className = 'badge';
    badgeText.textContent = 'Belum tersambung ke akun mana pun';
    who.textContent = '';
    return;
  }
  who.textContent = '';
  try {
    const db = await wfaGetDb();
    const res = await fetch(`${db.databaseUrl}/${db.dbRoot}/trackingStatus/${userId}.json`);
    const data = (await res.json()) || {};
    const on = !!(data.tracking && data.urlTrackingOn);
    badge.className = 'badge' + (on ? ' on' : '');
    badgeText.textContent = on
      ? 'Tersambung — sedang mencatat alamat situs'
      : data.tracking
      ? 'Tersambung — timer aktif, tapi divisi ini belum diizinkan HRD'
      : 'Tersambung — menunggu timer Hubstaff dinyalakan';
  } catch {
    badge.className = 'badge';
    badgeText.textContent = 'Tersambung, tapi tidak bisa menghubungi server sekarang';
  }
}

async function loadOrigin() {
  const { appOrigin } = await chrome.storage.local.get(['appOrigin']);
  // Kalau belum pernah diisi manual, tampilkan nilai bawaan dari config.js (yang otomatis
  // sudah tersimpan sejak ekstensi dimuat) supaya kolomnya tidak pernah tampak kosong.
  el('origin').value = appOrigin || WFA_CONFIG.DEFAULT_APP_ORIGIN || '';
}

el('saveOrigin').addEventListener('click', async () => {
  const raw = el('origin').value.trim().replace(/\/+$/, '');
  const status = el('originStatus');
  if (!/^https?:\/\/[^/]+$/.test(raw)) {
    status.textContent = 'Format alamat tidak valid. Contoh yang benar: https://wfa-numeta.vercel.app (tanpa garis miring di akhir).';
    status.className = 'status err';
    return;
  }
  await chrome.storage.local.set({ appOrigin: raw });
  status.textContent = 'Tersimpan. Buka WFA System di tab ini/tab baru untuk mengetesnya.';
  status.className = 'status ok';
});

el('save').addEventListener('click', async () => {
  const parsed = parsePairingCode(el('token').value);
  const status = el('status');
  if (!parsed) {
    status.textContent = 'Kode pasang tidak dikenali. Salin ulang dari menu Hubstaff, jangan diedit.';
    status.className = 'status err';
    return;
  }
  await chrome.storage.local.set({ userId: parsed.userId, token: parsed.token });
  status.textContent = 'Tersambung secara manual.';
  status.className = 'status ok';
  refreshBadge();
});

loadOrigin();
refreshBadge();
setInterval(refreshBadge, 10000);
