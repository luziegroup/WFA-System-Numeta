import { useCallback, useEffect, useRef, useState } from 'react';
import { dbRef, onValue, update, set, cleanForFirebase } from './firebase';

/**
 * Sinkronisasi koleksi (kumpulan item ber-`id`) dengan Firebase Realtime Database.
 *
 * - Data disimpan sebagai MAP {id: item} (bukan array), jadi dua orang yang menulis item
 *   berbeda pada saat bersamaan TIDAK saling menimpa.
 * - setItems() memakai API yang sama dengan useState (nilai langsung / fungsi updater),
 *   lalu hanya mengirim FIELD yang benar-benar berubah (bukan seluruh item).
 * - localStorage dipakai sebagai cache agar aplikasi langsung tampil saat dibuka ulang.
 */
type Updater<T> = T[] | ((prev: T[]) => T[]);

interface Options<T> {
  /** Path relatif terhadap DB_ROOT, mis. 'entries' */
  path: string;
  /** Rapikan item mentah dari Firebase (Firebase membuang array kosong & null) */
  normalize: (raw: any, id: string) => T;
  /** Urutan tampil */
  sort?: (a: T, b: T) => number;
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(cleanForFirebase(a)) === JSON.stringify(cleanForFirebase(b));

function readCache<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    /* abaikan cache rusak */
  }
  return [];
}

export function useFirebaseCollection<T extends { id: string }>({ path, normalize, sort }: Options<T>) {
  const cacheKey = `wfa_cache_${path}`;
  const [items, setItemsState] = useState<T[]>(() => readCache<T>(cacheKey));
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef<T[]>(items);
  const normalizeRef = useRef(normalize);
  const sortRef = useRef(sort);
  normalizeRef.current = normalize;
  sortRef.current = sort;

  useEffect(() => {
    const unsub = onValue(
      dbRef(path),
      (snap) => {
        const val = snap.val() as Record<string, unknown> | null;
        let list: T[] = val
          ? Object.entries(val).map(([id, raw]) => normalizeRef.current({ ...(raw as object), id }, id))
          : [];
        if (sortRef.current) list = list.sort(sortRef.current);
        itemsRef.current = list;
        setItemsState(list);
        setLoaded(true);
        setError(null);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(list));
        } catch {
          /* kuota penuh — cache saja, tidak fatal */
        }
      },
      (err) => {
        console.error(`[Firebase] gagal membaca "${path}":`, err);
        setError(err.message);
        setLoaded(true); // tetap lanjut dengan cache lokal
      }
    );
    return unsub;
  }, [path, cacheKey]);

  const setItems = useCallback(
    (updater: Updater<T>) => {
      const prev = itemsRef.current;
      let next = typeof updater === 'function' ? (updater as (p: T[]) => T[])(prev) : updater;
      if (sortRef.current) next = [...next].sort(sortRef.current);

      const prevMap = new Map<string, T>(prev.map((i) => [i.id, i] as [string, T]));
      const nextMap = new Map<string, T>(next.map((i) => [i.id, i] as [string, T]));
      const changes: Record<string, unknown> = {};

      // Item baru / berubah → tulis hanya field yang berubah
      nextMap.forEach((item, id) => {
        const old = prevMap.get(id);
        if (!old) {
          changes[id] = cleanForFirebase(item);
          return;
        }
        if (same(old, item)) return;
        const keys = new Set<string>([...Object.keys(old), ...Object.keys(item)]);
        keys.forEach((k) => {
          if (k === 'id') return;
          const a = (old as any)[k];
          const b = (item as any)[k];
          if (!same(a, b)) changes[`${id}/${k}`] = b === undefined ? null : cleanForFirebase(b);
        });
      });
      // Item dihapus
      prevMap.forEach((_, id) => {
        if (!nextMap.has(id)) changes[id] = null;
      });

      itemsRef.current = next;
      setItemsState(next);

      if (Object.keys(changes).length === 0) return;
      update(dbRef(path), changes).catch((e) => {
        console.error(`[Firebase] gagal menyimpan "${path}":`, e);
        setError(e?.message || 'Gagal menyimpan');
      });
    },
    [path]
  );

  return { items, setItems, loaded, error };
}

/** Sinkronisasi satu nilai/objek tunggal (mis. pengaturan sistem). */
export function useFirebaseValue<T extends object>(path: string, defaults: T) {
  const cacheKey = `wfa_cache_${path}`;
  const [value, setValueState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) return { ...defaults, ...JSON.parse(raw) };
    } catch {
      /* abaikan */
    }
    return defaults;
  });
  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState<boolean | null>(null);
  const valueRef = useRef<T>(value);
  const defaultsRef = useRef(defaults);

  useEffect(() => {
    const unsub = onValue(
      dbRef(path),
      (snap) => {
        const raw = snap.val();
        const merged = { ...defaultsRef.current, ...(raw || {}) } as T;
        valueRef.current = merged;
        setValueState(merged);
        setExists(raw !== null);
        setLoaded(true);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(merged));
        } catch {
          /* abaikan */
        }
      },
      (err) => {
        console.error(`[Firebase] gagal membaca "${path}":`, err);
        setLoaded(true);
      }
    );
    return unsub;
  }, [path, cacheKey]);

  const setValue = useCallback(
    (patch: Partial<T>) => {
      const next = { ...valueRef.current, ...patch };
      valueRef.current = next;
      setValueState(next);
      set(dbRef(path), cleanForFirebase(next)).catch((e) =>
        console.error(`[Firebase] gagal menyimpan "${path}":`, e)
      );
    },
    [path]
  );

  return { value, setValue, loaded, exists };
}
