/**
 * Content script WFA System — Pelacak Alamat.
 *
 * Berjalan hanya di alamat aplikasi WFA System yang diisi admin di halaman Opsi ekstensi
 * (bukan di situs lain). Tugasnya cuma dua, dan tidak pernah membaca isi halaman selain itu:
 *
 * 1. Membaca kode pasang dari atribut `data-wfa-pairing` di elemen <html>, yang HANYA diisi
 *    oleh aplikasi WFA System sendiri saat karyawan berhak memakai pelacakan alamat. Kirim ke
 *    background untuk disimpan — ini yang membuat pemasangan otomatis, tanpa salin-tempel.
 * 2. Memberi tahu balik ke halaman (lewat CustomEvent, bukan mengubah apa pun di halaman)
 *    apakah ekstensi ini sudah terhubung, supaya aplikasi bisa menampilkan tanda "Terhubung".
 */
(() => {
  const root = document.documentElement;

  function reportStatus(status) {
    root.setAttribute('data-wfa-extension', status.paired ? (status.tracking && status.urlTrackingOn ? 'tracking' : 'connected') : 'disconnected');
    window.dispatchEvent(new CustomEvent('wfa-extension-status', { detail: status }));
  }

  function syncPairingFromPage() {
    const code = root.getAttribute('data-wfa-pairing');
    if (code) {
      chrome.runtime.sendMessage({ type: 'wfa-pairing-detected', code }, (res) => {
        if (chrome.runtime.lastError) return; // service worker belum siap; alarm berikutnya akan mencoba lagi
        if (res) reportStatus(res);
      });
    } else {
      chrome.runtime.sendMessage({ type: 'wfa-status-query' }, (res) => {
        if (chrome.runtime.lastError) return;
        if (res) reportStatus(res);
      });
    }
  }

  syncPairingFromPage();
  // Aplikasi WFA System adalah SPA — atribut bisa muncul/berubah setelah script ini jalan
  // pertama kali (login, pindah menu, nyalakan timer). Amati perubahannya.
  const observer = new MutationObserver(syncPairingFromPage);
  observer.observe(root, { attributes: true, attributeFilter: ['data-wfa-pairing'] });

  // Cek ulang tiap 20 detik supaya tanda "Terhubung"/"Tracking" di halaman tetap akurat
  // walau atributnya sendiri tidak berubah (misalnya timer baru mulai berjalan).
  setInterval(syncPairingFromPage, 20000);
})();
