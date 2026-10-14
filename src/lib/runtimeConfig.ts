/**
 * Konfigurasi database yang bisa diganti TANPA membangun ulang aplikasi.
 *
 * Saat aplikasi dibuka, alamat database dibaca dari `config.json` di hosting (Vercel). Urutan:
 *   1. config.json dari hosting (diambil dengan batas waktu 2,5 detik)
 *   2. salinan config.json terakhir yang pernah berhasil (disimpan di perangkat)
 *   3. nilai bawaan yang tertanam di aplikasi (env VITE_FIREBASE_* atau nilai default di bawah)
 *
 * Config yang tidak valid DITOLAK (tidak pernah dipakai, tidak disimpan), jadi salah ketik di
 * config.json tidak membuat aplikasi mati — aplikasi jatuh ke langkah 2 atau 3.
 */
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface RuntimeConfig {
  firebase: FirebaseWebConfig;
  dbRoot: string;
  source: 'config.json' | 'salinan-terakhir' | 'bawaan';
}

const env = import.meta.env;

const BUILT_IN: Omit<RuntimeConfig, 'source'> = {
  firebase: {
    apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyCp1LgPxQr5FmPW0sLKAs0My2OuT20-GGY',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'wfa-system-numeta.firebaseapp.com',
    databaseURL: env.VITE_FIREBASE_DATABASE_URL || 'https://wfa-system-numeta-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: env.VITE_FIREBASE_PROJECT_ID || 'wfa-system-numeta',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'wfa-system-numeta.firebasestorage.app',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '136549410920',
    appId: env.VITE_FIREBASE_APP_ID || '1:136549410920:web:542e7782cff26bbbcef3dd',
  },
  dbRoot: env.VITE_DB_ROOT || 'luzie-react',
};

/** Alamat config.json untuk aplikasi desktop (di desktop tidak ada "hosting sendiri"). */
const DESKTOP_CONFIG_URL = env.VITE_REMOTE_CONFIG_URL || 'https://wfa-numeta.vercel.app/config.json';

const CACHE_KEY = 'wfa_runtime_config_v1';
const FETCH_TIMEOUT_MS = 2500;

const clean = (s: string) => s.replace(/^\/+|\/+$/g, '');

let current: RuntimeConfig = { ...BUILT_IN, dbRoot: clean(BUILT_IN.dbRoot), source: 'bawaan' };

/** Konfigurasi yang sedang dipakai (sudah final setelah loadRuntimeConfig selesai). */
export const getRuntimeConfig = (): RuntimeConfig => current;

const FIELDS: Array<keyof FirebaseWebConfig> = [
  'apiKey',
  'authDomain',
  'databaseURL',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

/** Kembalikan config yang sudah dibersihkan, atau null bila tidak valid. */
function validate(raw: any): Omit<RuntimeConfig, 'source'> | null {
  try {
    const fb = raw?.firebase;
    if (!fb || typeof fb !== 'object') return null;
    const out = {} as FirebaseWebConfig;
    for (const k of FIELDS) {
      const v = fb[k];
      if (typeof v !== 'string' || !v.trim()) return null;
      out[k] = v.trim();
    }
    if (!/^https:\/\/[a-z0-9-]+(-default-rtdb)?(\.[a-z0-9-]+)*\.(firebasedatabase\.app|firebaseio\.com)\/?$/i.test(out.databaseURL)) return null;
    out.databaseURL = out.databaseURL.replace(/\/+$/, '');
    const root = clean(String(raw.dbRoot ?? BUILT_IN.dbRoot));
    if (!/^[A-Za-z0-9_-]{1,60}$/.test(root)) return null;
    return { firebase: out, dbRoot: root };
  } catch {
    return null;
  }
}

function configUrl(): string {
  const isDesktop = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
  if (isDesktop) return DESKTOP_CONFIG_URL;
  if (env.VITE_REMOTE_CONFIG_URL) return env.VITE_REMOTE_CONFIG_URL;
  return new URL('config.json', document.baseURI).href;
}

async function fetchRemote(): Promise<Omit<RuntimeConfig, 'source'> | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(configUrl(), { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) return null;
    return validate(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function readSaved(): Omit<RuntimeConfig, 'source'> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? validate(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Panggil SEKALI sebelum aplikasi dimuat. Tidak pernah melempar error. */
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  // Saat pengembangan lokal (npm run dev) pakai .env / nilai bawaan, bukan config.json produksi.
  if (env.DEV) return current;

  const remote = await fetchRemote();
  if (remote) {
    current = { ...remote, source: 'config.json' };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ firebase: remote.firebase, dbRoot: remote.dbRoot }));
    } catch {
      /* penyimpanan penuh — tidak fatal */
    }
    return current;
  }
  const saved = readSaved();
  if (saved) {
    current = { ...saved, source: 'salinan-terakhir' };
    return current;
  }
  return current; // bawaan
}
