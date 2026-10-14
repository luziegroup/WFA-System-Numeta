/**
 * Konfigurasi Firebase Realtime Database.
 *
 * Alamat database dibaca dari public/config.json saat aplikasi dibuka (lib/runtimeConfig.ts),
 * jadi pindah project Firebase cukup mengganti file itu — tanpa build ulang.
 *
 * Catatan: apiKey Firebase untuk aplikasi web memang bersifat publik. Keamanan data
 * diatur lewat Realtime Database Rules (lihat database.rules.json), bukan dengan
 * menyembunyikan apiKey.
 */
import { initializeApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  onValue,
  update,
  set,
  get,
  remove,
  serverTimestamp,
  query,
  orderByKey,
  startAt,
  endAt,
  limitToLast,
  type DatabaseReference,
  type Query,
} from 'firebase/database';
import { getRuntimeConfig } from './runtimeConfig';

// Nilai diambil dari config.json (lihat lib/runtimeConfig.ts) — sudah final sebelum modul ini dimuat.
const runtime = getRuntimeConfig();
const firebaseConfig = runtime.firebase;

const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);

/**
 * Semua data aplikasi disimpan di bawah satu "root". Default-nya BEDA dari root
 * aplikasi V2 ("luzie") karena struktur datanya berbeda — supaya tidak saling menimpa
 * kalau keduanya memakai project Firebase yang sama.
 */
export const DB_ROOT = runtime.dbRoot;

export const dbRef = (path: string): DatabaseReference => ref(rtdb, `${DB_ROOT}/${path}`);
export const rootRef = (): DatabaseReference => ref(rtdb, DB_ROOT);

export { onValue, update, set, get, remove, serverTimestamp, ref, query, orderByKey, startAt, endAt, limitToLast };
export type { Query };

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
