import { useCallback, useRef, useState } from 'react';
import { dbRef, get, query, orderByKey, startAt, endAt, update, cleanForFirebase } from './firebase';
import { diffCollection, } from './useFirebaseCollection';

/**
 * Penyimpanan `entries` (catatan harian) yang diambil SESUAI KEBUTUHAN.
 *
 * Id entry berbentuk  entry-{userId}-{YYYY-MM-DD}, jadi satu rentang tanggal milik satu user
 * bisa diambil dengan query KEY (orderByKey + startAt/endAt) — tanpa index, tanpa mengunduh
 * data user lain. Tiap user punya "rentang yang sudah terambil"; permintaan berikutnya hanya
 * mengambil bagian yang belum ada, kecuali force (tombol Refresh).
 */
type Interval = { from: string; to: string };

export const ALL_FROM = '2000-01-01';
export const ALL_TO = '2099-12-31';

const addDays = (d: string, n: number): string => {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};

export const entryKey = (userId: string, date: string) => `entry-${userId}-${date}`;

interface Options<T> {
  normalize: (raw: any, id: string) => T;
  sort: (a: T, b: T) => number;
  /** Dipanggil saat penulisan ke Firebase GAGAL (mis. ditolak server / koneksi). */
  onWriteError?: (e: unknown) => void;
}

type E = { id: string; userId: string; date: string };

export function useEntriesStore<T extends E>({ normalize, sort, onWriteError }: Options<T>) {
  const [items, setItemsState] = useState<T[]>([]);
  const itemsRef = useRef<T[]>(items);
  const coverage = useRef(new Map<string, Interval>());
  const inflight = useRef(new Map<string, Promise<T[]>>());
  const [pending, setPending] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const normalizeRef = useRef(normalize);
  const sortRef = useRef(sort);
  const onWriteErrorRef = useRef(onWriteError);
  onWriteErrorRef.current = onWriteError;
  normalizeRef.current = normalize;
  sortRef.current = sort;

  const commit = (next: T[]) => {
    const sorted = [...next].sort(sortRef.current);
    itemsRef.current = sorted;
    setItemsState(sorted);
  };

  /** Ambil satu segmen tanggal milik satu user (query key, hanya data yang diminta). */
  const fetchSegment = (uid: string, a: string, b: string): Promise<T[]> => {
    const k = `${uid}|${a}|${b}`;
    const running = inflight.current.get(k);
    if (running) return running;
    const q = query(dbRef('entries'), orderByKey(), startAt(entryKey(uid, a)), endAt(entryKey(uid, b)));
    const p = get(q)
      .then((snap) => {
        const val = (snap.val() || {}) as Record<string, unknown>;
        return Object.entries(val)
          .map(([id, raw]) => normalizeRef.current({ ...(raw as object), id }, id))
          // pengaman: pastikan benar milik user itu (id user yang berawalan sama)
          .filter((e) => e.userId === uid);
      })
      .finally(() => inflight.current.delete(k));
    inflight.current.set(k, p);
    return p;
  };

  /**
   * Pastikan data `uids` untuk tanggal [from, to] sudah termuat.
   * force = ambil ulang rentang itu dari server (dipakai tombol Refresh).
   */
  const ensure = useCallback(async (uids: string[], from: string, to: string, force = false): Promise<void> => {
    if (!uids.length || from > to) return;
    const jobs: Array<{ uid: string; a: string; b: string }> = [];
    for (const uid of uids) {
      const cov = coverage.current.get(uid);
      if (!cov) {
        jobs.push({ uid, a: from, b: to });
        continue;
      }
      if (force) jobs.push({ uid, a: from, b: to });
      if (from < cov.from) jobs.push({ uid, a: from, b: addDays(cov.from, -1) });
      if (to > cov.to) jobs.push({ uid, a: addDays(cov.to, 1), b: to });
    }
    if (!jobs.length) return;

    setPending((n) => n + 1);
    try {
      const results = await Promise.all(jobs.map((j) => fetchSegment(j.uid, j.a, j.b)));
      // Ganti isi lokal pada tiap segmen yang diambil (supaya data yang dihapus di server ikut hilang)
      let next = itemsRef.current;
      jobs.forEach((j, i) => {
        next = next.filter((e) => !(e.userId === j.uid && e.date >= j.a && e.date <= j.b));
        next = next.concat(results[i]);
        const cov = coverage.current.get(j.uid);
        coverage.current.set(j.uid, cov ? { from: j.a < cov.from ? j.a : cov.from, to: j.b > cov.to ? j.b : cov.to } : { from: j.a, to: j.b });
      });
      commit(next);
      setUpdatedAt(Date.now());
      setError(null);
    } catch (e: any) {
      console.error('[Firebase] gagal membaca "entries":', e);
      setError(e?.message || 'Gagal membaca data');
      throw e;
    } finally {
      setPending((n) => n - 1);
    }
  }, []);

  /** Ambil ulang SATU entry (dipakai sebelum menulis perubahan lintas-orang, mis. penilaian leader). */
  const refreshOne = useCallback(async (id: string): Promise<T | undefined> => {
    const snap = await get(dbRef(`entries/${id}`));
    const raw = snap.val();
    const others = itemsRef.current.filter((e) => e.id !== id);
    if (!raw) {
      commit(others);
      return undefined;
    }
    const fresh = normalizeRef.current({ ...raw, id }, id);
    commit(others.concat(fresh));
    return fresh;
  }, []);

  /**
   * Terapkan perubahan ke state lokal LALU tulis ke Firebase. Mengembalikan Promise yang selesai
   * saat SERVER mengonfirmasi tulisan itu (reject kalau ditolak / gagal) — dipakai untuk
   * memastikan data penting seperti absen benar-benar tersimpan.
   */
  const setItemsAck = useCallback((updater: T[] | ((prev: T[]) => T[])): Promise<void> => {
    const prev = itemsRef.current;
    const next = typeof updater === 'function' ? (updater as (p: T[]) => T[])(prev) : updater;
    const changes = diffCollection(prev, next, { nonDestructiveNew: true });
    commit(next);
    if (Object.keys(changes).length === 0) return Promise.resolve();
    return update(dbRef('entries'), changes).catch((e) => {
      console.error('[Firebase] gagal menyimpan "entries":', e);
      setError(e?.message || 'Gagal menyimpan');
      onWriteErrorRef.current?.(e);
      throw e;
    });
  }, []);

  const setItems = useCallback(
    (updater: T[] | ((prev: T[]) => T[])) => {
      setItemsAck(updater).catch(() => undefined); // kegagalan sudah dilaporkan lewat onWriteError
    },
    [setItemsAck]
  );

  /** Tulis ulang field-field TERISI sebuah entry apa adanya (untuk mencoba lagi setelah gagal). Tidak menghapus apa pun di server. */
  const rewriteEntry = useCallback((id: string): Promise<void> => {
    const item = itemsRef.current.find((e) => e.id === id);
    if (!item) return Promise.reject(new Error('Entry tidak ada di perangkat ini'));
    const body: Record<string, unknown> = {};
    Object.entries(item as Record<string, unknown>).forEach(([k, v]) => {
      if (k === 'id' || v === undefined || v === null) return;
      body[k] = cleanForFirebase(v);
    });
    return update(dbRef(`entries/${id}`), body);
  }, []);

  /** Kosongkan semua (saat ganti akun) supaya data akun sebelumnya tidak tertinggal di memori. */
  const reset = useCallback(() => {
    coverage.current.clear();
    inflight.current.clear();
    itemsRef.current = [];
    setItemsState([]);
    setUpdatedAt(null);
  }, []);

  return { items, setItems, setItemsAck, rewriteEntry, ensure, refreshOne, reset, loading: pending > 0, updatedAt, error };
}
