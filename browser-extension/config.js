/**
 * Ganti dua nilai ini sesuai project Firebase Anda (sama seperti di src/lib/firebase.ts
 * pada aplikasi utama). Setelah diubah, muat ulang ekstensi di chrome://extensions.
 */
const WFA_CONFIG = {
  DATABASE_URL: 'https://wfa-system-numeta-default-rtdb.asia-southeast1.firebasedatabase.app',
  DB_ROOT: 'luzie-react',
  /**
   * Alamat web WFA System. Diisi SEKALI oleh admin/IT di file ini sebelum dibagikan ke
   * karyawan, supaya tiap karyawan yang memuat ekstensi ini TIDAK perlu mengisi apa pun lagi
   * di halaman Opsi — tinggal muat ekstensinya, langsung otomatis tersambung.
   * Kalau nanti pindah hosting, karyawan yang SUDAH terpasang tetap bisa diperbarui manual
   * lewat halaman Opsi (tidak perlu pasang ulang), tapi karyawan yang BELUM pasang akan
   * langsung dapat alamat baru ini kalau filenya diperbarui sebelum dibagikan.
   */
  DEFAULT_APP_ORIGIN: 'https://wfa-numeta.vercel.app',
};

/**
 * Alamat database TERBARU: dibaca dari config.json di alamat web WFA System (sama seperti yang
 * dipakai aplikasi), jadi saat admin pindah project Firebase ekstensi ikut pindah tanpa dipasang
 * ulang. Gagal mengambil -> pakai salinan terakhir yang berhasil -> pakai nilai di atas.
 */
async function wfaGetDb() {
  const fallback = { databaseUrl: WFA_CONFIG.DATABASE_URL, dbRoot: WFA_CONFIG.DB_ROOT };
  try {
    const { appOrigin, remoteDb } = await chrome.storage.local.get(['appOrigin', 'remoteDb']);
    const origin = String(appOrigin || WFA_CONFIG.DEFAULT_APP_ORIGIN || '').trim().replace(/\/+$/, '');
    // Pakai hasil ambil terakhir selama < 5 menit supaya tidak mengambil tiap permintaan
    if (remoteDb && Date.now() - remoteDb.at < 5 * 60 * 1000) return remoteDb.value;
    if (/^https?:\/\//.test(origin)) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch(origin + '/config.json', { cache: 'no-store', signal: ctrl.signal });
        clearTimeout(timer);
        if (res.ok) {
          const j = await res.json();
          const url = String(j?.firebase?.databaseURL || '').replace(/\/+$/, '');
          const root = String(j?.dbRoot || '').replace(/^\/+|\/+$/g, '');
          if (/^https:\/\/.+\.(firebasedatabase\.app|firebaseio\.com)$/i.test(url) && /^[A-Za-z0-9_-]{1,60}$/.test(root)) {
            const value = { databaseUrl: url, dbRoot: root };
            await chrome.storage.local.set({ remoteDb: { value, at: Date.now() } });
            return value;
          }
        }
      } catch (e) {
        // jaringan/CORS gagal — lanjut ke salinan terakhir
      }
    }
    if (remoteDb && remoteDb.value) return remoteDb.value;
  } catch (e) {
    // abaikan
  }
  return fallback;
}
