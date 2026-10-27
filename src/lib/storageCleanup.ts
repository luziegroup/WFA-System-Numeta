/**
 * Menjaga penyimpanan lokal browser (localStorage, batas sekitar 5 MB per alamat situs) tetap lega.
 *
 * Latar belakang: Firebase sendiri menulis beberapa penanda kecil ke localStorage saat membuka koneksi
 * (mis. "firebase:previous_websocket_failure"). Kalau localStorage PENUH, penulisan itu melempar
 * QuotaExceededError di dalam kode Firebase dan koneksi gagal terbentuk -> login macet di
 * "Menghubungkan ke server...". Cache lama yang menumpuk (format versi lama, atau milik project Firebase
 * yang sudah ditinggalkan) adalah penyebab utamanya.
 *
 * Fungsi ini dipanggil SEBELUM aplikasi/Firebase dimuat. Cache hanya mempercepat tampilan awal dan selalu
 * bisa dibuat ulang dari server, jadi aman dibuang. Sesi login, timer yang sedang berjalan, dan pengaturan
 * kecil dipertahankan.
 */
const CACHE_PREFIX = 'wfa_cache_';
/** Sisa ruang yang dijaga (dalam jumlah karakter; localStorage menghitung ~2 byte per karakter). */
const SOFT_LIMIT_CHARS = 1_500_000;

const PROTECTED = [
  'wfa_session_v2',
  'wfa_impersonator_v1',
  'wfa_runtime_config_v1',
  'wfa_sidebar_collapsed_v1',
  'wfa_screenshot_view_key',
  'wfa_screenshot_admin_key',
];
const PROTECTED_PREFIXES = ['wfa_hubstaff_timer_', 'wfa_hubstaff_activity_'];

const isProtected = (k: string) => PROTECTED.includes(k) || PROTECTED_PREFIXES.some((p) => k.startsWith(p));

type Store = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>;

function listKeys(s: Store): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k !== null) out.push(k);
  }
  return out;
}

const sizeOf = (s: Store, k: string) => k.length + (s.getItem(k)?.length ?? 0);

function canWrite(s: Store): boolean {
  const k = 'wfa_probe_tulis';
  try {
    s.setItem(k, 'x'.repeat(4096));
    s.removeItem(k);
    return true;
  } catch {
    try {
      s.removeItem(k);
    } catch {
      /* abaikan */
    }
    return false;
  }
}

/**
 * @param projectId project Firebase yang aktif; cache milik project lain / format lama dibuang.
 *                  Kosongkan untuk pembersihan awal sebelum konfigurasi diketahui.
 * @param store     hanya untuk pengujian
 * @returns jumlah item yang dibuang
 */
export function cleanupStorage(projectId?: string, store?: Store): number {
  let removed = 0;
  let s: Store;
  try {
    s = store ?? window.localStorage;
  } catch {
    return 0; // penyimpanan tidak tersedia (mode privat ketat)
  }
  const drop = (k: string) => {
    try {
      s.removeItem(k);
      removed++;
    } catch {
      /* abaikan */
    }
  };

  try {
    // 1) Penanda kegagalan websocket Firebase yang usang
    listKeys(s)
      .filter((k) => k.startsWith('firebase:previous_websocket_failure'))
      .forEach(drop);

    // 2) Cache milik project lain atau berformat lama (tanpa id project)
    if (projectId) {
      const mine = `${CACHE_PREFIX}${projectId}_`;
      listKeys(s)
        .filter((k) => k.startsWith(CACHE_PREFIX) && !k.startsWith(mine))
        .forEach(drop);
    }

    // 3) Total terlalu besar -> buang SEMUA cache (dibuat ulang otomatis dari server)
    const total = () => listKeys(s).reduce((t, k) => t + sizeOf(s, k), 0);
    if (total() > SOFT_LIMIT_CHARS) {
      listKeys(s).filter((k) => k.startsWith(CACHE_PREFIX)).forEach(drop);
    }

    // 4) Uji tulis. Kalau masih penuh, buang item terbesar yang bukan sesi/timer sampai bisa menulis.
    if (!canWrite(s)) {
      const rest = listKeys(s)
        .filter((k) => !isProtected(k))
        .sort((a, b) => sizeOf(s, b) - sizeOf(s, a));
      for (const k of rest) {
        drop(k);
        if (canWrite(s)) break;
      }
    }
  } catch {
    /* pembersihan tidak boleh pernah menghentikan aplikasi */
  }
  return removed;
}
