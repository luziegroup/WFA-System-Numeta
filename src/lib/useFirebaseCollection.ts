import { useCallback, useEffect, useRef, useState } from 'react';
import { dbRef, onValue, update, set, get, cleanForFirebase, type Query } from './firebase';
import { getRuntimeConfig } from './runtimeConfig';

/**
 * Sinkronisasi koleksi (kumpulan item ber-`id`) dengan Firebase Realtime Database.
 *
 * - Data disimpan sebagai MAP {id: item} (bukan array), jadi dua orang yang menulis item
 *   berbeda pada saat bersamaan TIDAK saling menimpa.
 * - setItems() memakai API yang sama dengan useState (nilai langsung / fungsi updater),
 *   lalu hanya mengirim FIELD yang benar-benar berubah (bukan seluruh item).
 * - localStorage dipakai sebagai cache agar aplikasi langsung tampil saat dibuka ulang.
 *
 * Dua mode pengambilan data:
 *  - 'live' (default): listener onValue terus terbuka — setiap perubahan dikirim ke perangkat ini.
 *    Hanya dipakai untuk data kecil yang memang harus selalu mutakhir (mis. daftar akun).
 *  - 'once': data diambil SEKALI dengan get() saat dibuka, lalu hanya diambil lagi ketika
 *    refresh() dipanggil (tombol Refresh / sinyal perubahan). Tidak ada unduhan otomatis di antaranya.
 */
type Updater<T> = T[] | ((prev: T[]) => T[]);

interface Options<T> {
  /** Path relatif terhadap DB_ROOT, mis. 'entries' */
  path: string;
  /** Rapikan item mentah dari Firebase (Firebase membuang array kosong & null) */
  normalize: (raw: any, id: string) => T;
  /** Urutan tampil */
  sort?: (a: T, b: T) => number;
  /** 'live' = onValue terus-menerus, 'once' = get() sekali + refresh() manual */
  mode?: 'live' | 'once';
  /** Khusus mode 'once': batasi data yang diambil (mis. limitToLast). Default: seluruh path. */
  buildQuery?: () => Query;
  /** Khusus mode 'once': false = tunda pengambilan pertama sampai refresh() dipanggil. */
  enabled?: boolean;
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(cleanForFirebase(a)) === JSON.stringify(cleanForFirebase(b));


/**
 * Hitung perubahan (path -> nilai) antara dua daftar item ber-`id`, supaya yang dikirim ke
 * Firebase hanya FIELD yang benar-benar berubah.
 * `nonDestructiveNew`: item yang tidak ada di `prev` ditulis per-field (tanpa field null), sehingga
 * tidak menimpa data yang sudah ada di server tetapi belum sempat termuat di perangkat ini.
 */
export function diffCollection<T extends { id: string }>(
  prev: T[],
  next: T[],
  opts: { nonDestructiveNew?: boolean } = {}
): Record<string, unknown> {
  const prevMap = new Map<string, T>(prev.map((i) => [i.id, i] as [string, T]));
  const nextMap = new Map<string, T>(next.map((i) => [i.id, i] as [string, T]));
  const changes: Record<string, unknown> = {};

  nextMap.forEach((item, id) => {
    const old = prevMap.get(id);
    if (!old) {
      if (opts.nonDestructiveNew) {
        Object.entries(item as Record<string, unknown>).forEach(([k, v]) => {
          if (k === 'id' || v === undefined || v === null) return;
          changes[`${id}/${k}`] = cleanForFirebase(v);
        });
      } else {
        changes[id] = cleanForFirebase(item);
      }
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
  return changes;
}

function readCache<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    /* abaikan cache rusak */
  }
  return [];
}

export function useFirebaseCollection<T extends { id: string }>({
  path,
  normalize,
  sort,
  mode = 'live',
  buildQuery,
  enabled = true,
}: Options<T>) {
  const cacheKey = `wfa_cache_${getRuntimeConfig().firebase.projectId}_${path}`;
  const [items, setItemsState] = useState<T[]>(() => readCache<T>(cacheKey));
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef<T[]>(items);
  const normalizeRef = useRef(normalize);
  const sortRef = useRef(sort);
  const buildQueryRef = useRef(buildQuery);
  normalizeRef.current = normalize;
  sortRef.current = sort;
  buildQueryRef.current = buildQuery;
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const applySnapshot = useCallback(
    (val: Record<string, unknown> | null) => {
      let list: T[] = val
        ? Object.entries(val).map(([id, raw]) => normalizeRef.current({ ...(raw as object), id }, id))
        : [];
      if (sortRef.current) list = list.sort(sortRef.current);
      itemsRef.current = list;
      setItemsState(list);
      setLoaded(true);
      setError(null);
      setUpdatedAt(Date.now());
      try {
        localStorage.setItem(cacheKey, JSON.stringify(list));
      } catch {
        /* kuota penuh — cache saja, tidak fatal */
      }
    },
    [cacheKey]
  );

  // ---- Mode LIVE ----
  useEffect(() => {
    if (mode !== 'live') return;
    const unsub = onValue(
      dbRef(path),
      (snap) => applySnapshot(snap.val() as Record<string, unknown> | null),
      (err) => {
        console.error(`[Firebase] gagal membaca "${path}":`, err);
        setError(err.message);
        setLoaded(true); // tetap lanjut dengan cache lokal
      }
    );
    return unsub;
  }, [path, mode, applySnapshot]);

  // ---- Mode ONCE: ambil sekali, ulangi hanya lewat refresh() ----
  const inflightRef = useRef<Promise<void> | null>(null);
  const refresh = useCallback((): Promise<void> => {
    if (mode !== 'once') return Promise.resolve();
    if (inflightRef.current) return inflightRef.current;
    setRefreshing(true);
    const q = buildQueryRef.current ? buildQueryRef.current() : dbRef(path);
    const p = get(q)
      .then((snap) => applySnapshot(snap.val() as Record<string, unknown> | null))
      .catch((err) => {
        console.error(`[Firebase] gagal membaca "${path}":`, err);
        setError(err?.message || 'Gagal membaca data');
        setLoaded(true);
      })
      .finally(() => {
        inflightRef.current = null;
        setRefreshing(false);
      });
    inflightRef.current = p;
    return p;
  }, [mode, path, applySnapshot]);

  useEffect(() => {
    if (mode === 'once' && enabled) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, enabled, path]);

  const setItems = useCallback(
    (updater: Updater<T>) => {
      const prev = itemsRef.current;
      let next = typeof updater === 'function' ? (updater as (p: T[]) => T[])(prev) : updater;
      if (sortRef.current) next = [...next].sort(sortRef.current);

      const changes = diffCollection(prev, next);

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

  /** Ubah state lokal SAJA (tanpa menulis ke Firebase) — dipakai setelah menulis langsung ke path anak. */
  const patchLocal = useCallback((updater: (prev: T[]) => T[]) => {
    let next = updater(itemsRef.current);
    if (sortRef.current) next = [...next].sort(sortRef.current);
    itemsRef.current = next;
    setItemsState(next);
  }, []);

  return { items, setItems, patchLocal, loaded, error, refresh, refreshing, updatedAt };
}

/** Sinkronisasi satu nilai/objek tunggal (mis. pengaturan sistem). */
export function useFirebaseValue<T extends object>(path: string, defaults: T) {
  const cacheKey = `wfa_cache_${getRuntimeConfig().firebase.projectId}_${path}`;
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
