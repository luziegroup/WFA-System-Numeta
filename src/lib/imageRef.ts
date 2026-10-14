/**
 * Gambar besar (foto bukti to-do, foto meeting) TIDAK lagi disimpan di dalam data utama
 * (entries / zoomMeetings), karena data utama ikut terunduh ke banyak perangkat dan
 * menghabiskan kuota Downloads Firebase. Gambar disimpan di node terpisah dan hanya
 * diunduh saat benar-benar dilihat (get() sekali, lalu di-cache di memori).
 *
 * Di data utama hanya tersimpan REFERENSI berbentuk  "rtdb:<path>"  (path relatif DB_ROOT).
 * Nilai lama yang masih berupa data URL / http tetap bisa ditampilkan seperti biasa.
 */
import { dbRef, get, set, remove } from './firebase';

const PREFIX = 'rtdb:';

export const isImageRef = (v?: string | null): v is string => !!v && v.startsWith(PREFIX);
export const isInlineImage = (v?: string | null): boolean => !!v && v.startsWith('data:');
export const makeImageRef = (path: string) => PREFIX + path;
const pathOf = (ref: string) => ref.slice(PREFIX.length);

/** Karakter yang dilarang di key Firebase diganti. */
export const safeSegment = (s: string) => s.replace(/[.#$\[\]/]/g, '_');

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

/** Ambil isi gambar (data URL) dari sebuah referensi. Referensi non-"rtdb:" dikembalikan apa adanya. */
export function loadImage(src: string): Promise<string> {
  if (!isImageRef(src)) return Promise.resolve(src);
  const hit = cache.get(src);
  if (hit) return Promise.resolve(hit);
  const running = inflight.get(src);
  if (running) return running;
  const p = get(dbRef(pathOf(src)))
    .then((snap) => {
      const val = snap.val();
      if (typeof val !== 'string' || !val) throw new Error('Gambar tidak ditemukan');
      cache.set(src, val);
      return val;
    })
    .finally(() => inflight.delete(src));
  inflight.set(src, p);
  return p;
}

/** Simpan data URL ke node gambar dan kembalikan referensinya. Cache langsung terisi (tampil instan). */
export async function saveImage(path: string, dataUrl: string): Promise<string> {
  const ref = makeImageRef(path);
  cache.set(ref, dataUrl);
  await set(dbRef(path), dataUrl);
  return ref;
}

/** Hapus node gambar (best-effort) bila nilainya sebuah referensi. */
export function deleteImage(src?: string | null) {
  if (!isImageRef(src)) return;
  cache.delete(src);
  remove(dbRef(pathOf(src))).catch(() => undefined);
}

export const forgetImage = (src: string) => cache.delete(src);
