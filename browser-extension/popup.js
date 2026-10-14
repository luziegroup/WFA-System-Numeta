document.getElementById('opts').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

(async () => {
  const { userId, token } = await chrome.storage.local.get(['userId', 'token']);
  const msg = document.getElementById('msg');
  const dot = document.getElementById('dot');
  if (!userId || !token) {
    msg.textContent = 'Belum dipasangkan. Buka Pengaturan untuk memasukkan kode pasang.';
    return;
  }
  try {
    const db = await wfaGetDb();
    const res = await fetch(`${db.databaseUrl}/${db.dbRoot}/trackingStatus/${userId}.json`);
    const data = (await res.json()) || {};
    const on = !!(data.tracking && data.urlTrackingOn);
    dot.classList.toggle('on', on);
    msg.textContent = on
      ? 'Sedang mencatat alamat situs.'
      : data.tracking
      ? 'Timer aktif, tapi pelacakan alamat tidak diaktifkan untuk divisi Anda.'
      : 'Timer Hubstaff sedang tidak berjalan.';
  } catch {
    msg.textContent = 'Tidak bisa menghubungi server.';
  }
})();
