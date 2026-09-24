/**
 * Konfigurasi Firebase Realtime Database.
 *
 * CATATAN MIGRASI: nilai default di bawah ini SENGAJA diarahkan ke project
 * Firebase APLIKASI LAMA (WFA-System-Numeta / "wfa-system-numeta"), bukan lagi
 * ke project bawaan aplikasi ini ("wfa-system-v3"). Ini permintaan eksplisit
 * dari pemilik aplikasi supaya aplikasi baru memakai satu-satunya project
 * Firebase yang sama dengan aplikasi lama. Data aplikasi baru tetap terpisah
 * secara aman di dalam root "luzie-react" (lihat DB_ROOT di bawah) — TIDAK
 * bentrok dengan root "luzie" milik aplikasi lama di project yang sama.
 *
 * Untuk memakai project Firebase lain cukup isi variabel VITE_FIREBASE_* di
 * file .env (lihat .env.example) — nilai di .env akan menimpa default ini.
 *
 * Catatan: apiKey Firebase untuk aplikasi web memang bersifat publik. Keamanan data
 * diatur lewat Realtime Database Rules (lihat database.rules.json), bukan dengan
 * menyembunyikan apiKey.
 */
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, update, set, get, type DatabaseReference } from 'firebase/database';

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyCp1LgPxQr5FmPW0sLKAs0My2OuT20-GGY',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'wfa-system-numeta.firebaseapp.com',
  databaseURL:
    env.VITE_FIREBASE_DATABASE_URL ||
    'https://wfa-system-numeta-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'wfa-system-numeta',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'wfa-system-numeta.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '136549410920',
  appId: env.VITE_FIREBASE_APP_ID || '1:136549410920:web:542e7782cff26bbbcef3dd',
};

const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);

/**
 * Semua data aplikasi disimpan di bawah satu "root". Default-nya BEDA dari root
 * aplikasi V2 ("luzie") karena struktur datanya berbeda — supaya tidak saling menimpa
 * kalau keduanya memakai project Firebase yang sama.
 */
export const DB_ROOT = (env.VITE_DB_ROOT || 'luzie-react').replace(/^\/+|\/+$/g, '');

export const dbRef = (path: string): DatabaseReference => ref(rtdb, `${DB_ROOT}/${path}`);
export const rootRef = (): DatabaseReference => ref(rtdb, DB_ROOT);

export { onValue, update, set, get, ref };

/** Firebase menolak `undefined` — buang dari object, ubah jadi null di dalam array. */
export function cleanForFirebase<T>(value: T): T | null {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) {
    return value.map((v) => (v === undefined ? null : cleanForFirebase(v))) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      if (v !== undefined) out[k] = cleanForFirebase(v);
    });
    return out as T;
  }
  return value;
}

/** Pantau status koneksi ke Firebase (untuk badge Online/Offline di header). */
export function watchConnection(cb: (online: boolean) => void): () => void {
  return onValue(ref(rtdb, '.info/connected'), (snap) => cb(!!snap.val()));
}
