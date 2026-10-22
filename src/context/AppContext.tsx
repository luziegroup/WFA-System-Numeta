import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { User, DailyWfaEntry, TodoItem, AbsenRecord, WarningItem, ZoomMeetingInfo, ZoomMeetingPhoto, WfaSettings, HubstaffSettings, HubstaffStatsPatch } from '../types';
import { INITIAL_SETTINGS, INITIAL_HUBSTAFF_SETTINGS, getTodayDateString } from '../data/initialData';
import { useFirebaseCollection, useFirebaseValue } from '../lib/useFirebaseCollection';
import { useEntriesStore, ALL_FROM, ALL_TO } from '../lib/useEntriesStore';
import { watchConnection, dbRef, get, set as fbSet, remove as fbRemove, onValue, query, orderByKey, limitToLast, cleanForFirebase } from '../lib/firebase';
import { isInlineImage, makeImageRef, saveImage, deleteImage, safeSegment } from '../lib/imageRef';
import { hashPassword, verifyPassword, isHashed, DEFAULT_PASSWORD } from '../lib/password';
import { lateWarningDraft, todoReminderDraft, performanceWarningDraft, AUTO_SENDER_ID, AUTO_SENDER_NAME, type AutoWarnDraft } from '../utils/autoWarnings';

interface ToastInfo {
  id: string;
  message: string;
  type: 'success' | 'warning' | 'info';
}

interface LoginResult {
  ok: boolean;
  error?: string;
}

interface AppContextType {
  currentUser: User;
  allUsers: User[];
  isAuthenticated: boolean;
  /** false selama data awal dari server belum termuat */
  isReady: boolean;
  isOnline: boolean;
  login: (username: string, password: string) => LoginResult;
  logout: () => void;
  /** HRD masuk sebagai akun karyawan/koordinator tertentu tanpa perlu tahu passwordnya */
  loginAsUser: (userId: string) => void;
  /** Kembali ke akun HRD setelah selesai "login sebagai" */
  returnToAdmin: () => void;
  isImpersonating: boolean;
  impersonatorUser?: User;
  /** Cek password akun yang sedang login (untuk form ganti password) */
  verifyCurrentPassword: (plain: string) => boolean;
  /** true kalau akun yang sedang login MASIH memakai password bawaan (akun baru / hasil reset HRD) —
   *  dipakai untuk menampilkan peringatan wajib ganti password di seluruh aplikasi. */
  mustChangePassword: boolean;
  /** Cek apakah sebuah calon password baru sama dengan password bawaan yang TIDAK boleh dipakai
   *  ulang oleh akun yang sedang login (dipakai validasi form Ganti Password). */
  isDefaultPasswordValue: (plain: string) => boolean;
  entries: DailyWfaEntry[];
  /**
   * Pastikan entries tanggal [from, to] sudah termuat (sesuai peran: karyawan = miliknya, leader = timnya,
   * HRD = semua). Data TIDAK diunduh otomatis di luar ini. force = ambil ulang dari server.
   */
  ensureEntries: (from: string, to: string, opts?: { force?: boolean; self?: boolean }) => Promise<void>;
  /** Daftarkan rentang yang sedang ditampilkan suatu halaman (dipakai refresh otomatis saat tab kembali aktif lama). */
  registerEntriesRange: (id: string, range: { from: string; to: string; self?: boolean; onSynced?: () => void } | null) => void;
  entriesLoading: boolean;
  entriesUpdatedAt: number | null;
  /** Kapan data utama (entry sendiri, teguran, meeting) terakhir disinkronkan penuh */
  lastSyncAt: number | null;
  /** Berubah saat anggota lingkup data berubah (mis. ada karyawan baru) -> halaman memuat ulang rentangnya. */
  entriesScopeKey: string;
  refreshAll: () => Promise<void>;
  refreshWarnings: () => Promise<void>;
  warningsLoading: boolean;
  warningsUpdatedAt: number | null;
  refreshZoomMeetings: () => Promise<void>;
  zoomLoading: boolean;
  zoomUpdatedAt: number | null;
  selectedDate: string;
  activeImageModal: { url: string; title?: string } | null;
  toasts: ToastInfo[];
  warnings: WarningItem[];
  zoomMeeting: ZoomMeetingInfo;
  zoomMeetings: ZoomMeetingInfo[];
  wfaSettings: WfaSettings;
  updateWfaSettings: (settings: Partial<WfaSettings>) => void;
  hubstaffSettings: HubstaffSettings;
  updateHubstaffSettings: (settings: Partial<HubstaffSettings>) => void;
  /** true = akun yang sedang login boleh membuka Monitor Hubstaff (HRD selalu; koordinator sesuai pengaturan) */
  canMonitorHubstaff: boolean;
  addUser: (userData: Omit<User, 'id'>) => void;
  updateUser: (userId: string, data: Partial<User>) => void;
  /** Reset password akun ke password default (dipakai HRD kalau ada yang lupa password) */
  resetUserPassword: (userId: string) => void;
  deleteUser: (userId: string) => void;
  createZoomMeeting: (data: {
    title: string;
    date: string;
    time: string;
    duration: number;
    agenda?: string;
    isUrgent: boolean;
    link: string;
    session: 'pagi' | 'siang';
  }) => ZoomMeetingInfo | null;
  deleteZoomMeeting: (meetingId: string) => void;
  addZoomPhoto: (meetingId: string, photoUrl: string, caption?: string) => void;
  deleteZoomPhoto: (meetingId: string, photoId: string) => void;
  setSelectedDate: (date: string) => void;
  openImageModal: (url: string, title?: string) => void;
  closeImageModal: () => void;
  showToast: (message: string, type?: 'success' | 'warning' | 'info') => void;

  // Aksi Karyawan
  getCurrentEntry: () => DailyWfaEntry;
  doAbsenPagi: (location: string, notes: string) => void;
  addTodo: (task: string, target?: string) => void;
  deleteTodo: (todoId: string) => void;
  toggleTodoCentang: (todoId: string) => void; // FITUR UTAMA: Ubah penilaian menjadi CENTANG
  updateTodoProof: (todoId: string, proofLink?: string, proofImage?: string, proofFileName?: string) => void;
  doAbsenSiang: (location: string, notes: string) => void;
  updateHubstaffStats: (patch: HubstaffStatsPatch) => void;

  // Aksi Leader
  leaderReviewEntry: (entryId: string, leaderScore: number, communicationScore: number, generalComment: string, verifiedItemIds: string[]) => void;
  sendWarning: (recipientId: string, type: WarningItem['type'], title: string, message: string) => void;
  deleteWarning: (warningId: string) => void;
  markWarningRead: (warningId: string) => void;
  joinZoomMeeting: (meetingId?: string) => void;
  completeZoomMeeting: (meetingId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const SESSION_KEY = 'wfa_session_v2';
const IMPERSONATOR_KEY = 'wfa_impersonator_v1';

// Data demo dari versi prototipe (localStorage lama) dibersihkan sekali agar tidak tercampur
const LEGACY_KEYS = [
  'luzie_wfa_entries_v4',
  'luzie_wfa_current_user_v4',
  'luzie_wfa_warnings_v3',
  'luzie_wfa_users_v6',
  'luzie_wfa_settings_v5',
  'luzie_wfa_zoom_meetings_v5',
];

// Avatar inisial (SVG data URL) untuk akun bawaan
const initialsAvatar = (name: string) => {
  const initials = name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect width="150" height="150" fill="#004080"/><text x="50%" y="54%" font-family="Arial,sans-serif" font-size="60" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="middle">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

// ---------- Normalisasi data dari Firebase ----------
// Firebase membuang array kosong & nilai null, jadi field-nya perlu dipulihkan.
const toArray = <T,>(x: unknown): T[] =>
  Array.isArray(x) ? (x as T[]) : x && typeof x === 'object' ? (Object.values(x) as T[]) : [];

const tsOfId = (id: string) => parseInt(id.match(/(\d{10,})$/)?.[1] ?? '0', 10);

// Avatar tidak boleh kosong (<img src=""> membuat browser mengunduh ulang halaman)
const normalizeUser = (raw: any): User => ({ ...raw, avatar: raw.avatar || initialsAvatar(raw.name || '?') } as User);

const normalizeEntry = (raw: any): DailyWfaEntry => ({
  ...raw,
  todos: toArray<TodoItem>(raw.todos),
  absenPagi: raw.absenPagi ?? null,
  absenSiang: raw.absenSiang ?? null,
  employeeScorePercent: raw.employeeScorePercent ?? 0,
  totalTodos: raw.totalTodos ?? 0,
  completedTodos: raw.completedTodos ?? 0,
  leaderScore: raw.leaderScore ?? null,
  leaderCommunicationScore: raw.leaderCommunicationScore ?? null,
  leaderGeneralComment: raw.leaderGeneralComment ?? '',
  leaderReviewedAt: raw.leaderReviewedAt ?? null,
  leaderReviewedBy: raw.leaderReviewedBy ?? null,
  status: raw.status ?? 'belum_mulai',
  hubstaffSeconds: raw.hubstaffSeconds ?? 0,
});

const normalizeWarning = (raw: any): WarningItem => raw as WarningItem;

const normalizeZoom = (raw: any): ZoomMeetingInfo => ({
  ...raw,
  photos: toArray<ZoomMeetingPhoto>(raw.photos),
  attendees: toArray<ZoomMeetingInfo['attendees'][number]>(raw.attendees),
  agenda: raw.agenda ?? '',
  passcode: raw.passcode ?? '',
  leaderId: raw.leaderId ?? '',
  // Data lama belum punya field sesi -> tentukan otomatis dari jam mulainya (< 12:00 = pagi)
  session: raw.session ?? (parseInt(String(raw.time || '08').split(':')[0], 10) < 12 ? 'pagi' : 'siang'),
});

const sortEntries = (a: DailyWfaEntry, b: DailyWfaEntry) =>
  b.date.localeCompare(a.date) || a.userName.localeCompare(b.userName);
const sortNewestFirst = <T extends { id: string }>(a: T, b: T) => tsOfId(b.id) - tsOfId(a.id) || b.id.localeCompare(a.id);
const sortUsers = (a: User, b: User) => a.name.localeCompare(b.name);

// Batas jumlah data terbaru yang diambil (bukan seluruh riwayat)
const WARNING_LIMIT = 200;
const ZOOM_LIMIT = 40;
// Hari ke belakang yang selalu dimuat untuk entry milik sendiri (cukup untuk absen/to-do harian)
const BASELINE_DAYS = 31;
// Tab yang kembali aktif setelah selama ini dianggap data sudah basi -> diperbarui otomatis sekali
const STALE_MS = 10 * 60 * 1000;
const OWN_TODAY_STALE_MS = 2 * 60 * 1000;

const shiftDate = (d: string, days: number) => {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

// Username efektif seorang user: pakai field `username` kalau sudah diisi,
// kalau belum (akun lama) otomatis diturunkan dari bagian sebelum "@" di email
// supaya akun lama tetap bisa login tanpa perlu migrasi paksa.
const usernameOf = (u: User) => (u.username?.trim() || u.email.split('@')[0] || '').trim().toLowerCase();

// Placeholder aman saat belum ada yang login / belum ada meeting
const GUEST_USER: User = {
  id: 'guest',
  name: 'Tamu',
  email: '',
  role: 'karyawan',
  division: '-',
  avatar: '',
  isActive: false,
};

const EMPTY_ZOOM: ZoomMeetingInfo = {
  id: 'zoom-none',
  title: 'Belum ada meeting',
  time: '08:00',
  date: getTodayDateString(),
  duration: 60,
  isUrgent: false,
  session: 'pagi',
  hostName: '-',
  leaderId: '',
  meetingId: '-',
  link: '',
  passcode: '',
  agenda: '',
  status: 'selesai',
  photos: [],
  attendees: [],
};

// Akun admin bawaan (sama dengan aplikasi referensi V2). WAJIB diganti passwordnya setelah login pertama.
const DEFAULT_ADMIN_ID = 'usr-hrd-admin';
const DEFAULT_ADMIN_PASSWORD = 'admin123';
const buildDefaultAdmin = (): User => ({
  id: DEFAULT_ADMIN_ID,
  name: 'Admin HRD',
  email: 'admin@numeta.id',
  username: 'admin',
  role: 'hrd',
  division: 'People & Culture (HRD)',
  avatar: initialsAvatar('Admin HRD'),
  joinDate: getTodayDateString(),
  isActive: true,
  password: hashPassword(DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_ID),
});

// Cek apakah password yang TERSIMPAN saat ini untuk akun `u` masih memakai password bawaan
// (baik password default akun baru/hasil reset HRD "123456", maupun password bawaan admin
// pertama "admin123"). Dipakai untuk memicu peringatan wajib ganti password.
const isDefaultPassword = (u: User): boolean => {
  if (!u || u.id === 'guest') return false;
  if (verifyPassword(DEFAULT_PASSWORD, u.password, u.id)) return true;
  if (u.id === DEFAULT_ADMIN_ID && verifyPassword(DEFAULT_ADMIN_PASSWORD, u.password, u.id)) return true;
  return false;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ---------- Data (tersinkron realtime dengan Firebase) ----------
  const users = useFirebaseCollection<User>({ path: 'users', normalize: normalizeUser, sort: sortUsers });
  // `users` & pengaturan kecil -> live. Sisanya diambil SESUAI KEBUTUHAN (lihat lib/useEntriesStore & mode 'once').
  const writeErrorRef = useRef<(e: unknown) => void>(() => undefined);
  const entriesCol = useEntriesStore<DailyWfaEntry>({
    normalize: normalizeEntry,
    sort: sortEntries,
    onWriteError: (e) => writeErrorRef.current(e),
  });
  const [authReady, setAuthReady] = useState(false); // true setelah pengguna terautentikasi (memicu pengambilan pertama)
  const warningsCol = useFirebaseCollection<WarningItem>({
    path: 'warnings',
    normalize: normalizeWarning,
    sort: sortNewestFirst,
    mode: 'once',
    enabled: authReady,
    buildQuery: () => query(dbRef('warnings'), orderByKey(), limitToLast(WARNING_LIMIT)),
  });
  const zoomCol = useFirebaseCollection<ZoomMeetingInfo>({
    path: 'zoomMeetings',
    normalize: normalizeZoom,
    sort: sortNewestFirst,
    mode: 'once',
    enabled: authReady,
    buildQuery: () => query(dbRef('zoomMeetings'), orderByKey(), limitToLast(ZOOM_LIMIT)),
  });
  const settingsVal = useFirebaseValue<WfaSettings>('settings', INITIAL_SETTINGS);
  const hubstaffSettingsVal = useFirebaseValue<HubstaffSettings>('hubstaffSettings', INITIAL_HUBSTAFF_SETTINGS);

  const allUsers = users.items;
  const setAllUsers = users.setItems;
  const entries = entriesCol.items;
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const setEntries = entriesCol.setItems;
  const warnings = warningsCol.items;
  const setWarnings = warningsCol.setItems;
  const zoomMeetings = zoomCol.items;
  const setZoomMeetings = zoomCol.setItems;
  const wfaSettings = settingsVal.value;
  const hubstaffSettings = hubstaffSettingsVal.value;

  // ---------- Status koneksi & kesiapan ----------
  const [isOnline, setIsOnline] = useState<boolean>(false);
  useEffect(() => watchConnection(setIsOnline), []);

  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 6000); // offline / server lambat → lanjut dengan cache
    return () => clearTimeout(t);
  }, []);
  const baseReady = users.loaded && settingsVal.loaded;

  useEffect(() => {
    LEGACY_KEYS.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        /* abaikan */
      }
    });
  }, []);

  // ---------- Toast ----------
  const [toasts, setToasts] = useState<ToastInfo[]>([]);
  const showToast = useCallback((message: string, type: 'success' | 'warning' | 'info' = 'success') => {
    const id = Date.now().toString() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Kegagalan menyimpan ke server TIDAK boleh diam-diam: beri tahu pengguna (maks. 1x per 20 detik).
  const lastWriteErrAt = useRef(0);
  writeErrorRef.current = (e: unknown) => {
    const now = Date.now();
    if (now - lastWriteErrAt.current < 20000) return;
    lastWriteErrAt.current = now;
    const msg = String((e as any)?.message || e || '');
    showToast(
      /permission|denied/i.test(msg)
        ? 'Perubahan DITOLAK server (izin database). Hubungi HRD/IT.'
        : 'Perubahan belum tersimpan ke server (koneksi bermasalah). Jangan tutup aplikasi, coba lagi sebentar.',
      'warning'
    );
  };

  /** Pantau penyimpanan data penting (absen): beri peringatan kalau lambat, coba ulang 1x kalau gagal. */
  const trackSave = (ack: Promise<void>, label: string, entryId: string) => {
    let done = false;
    const slow = setTimeout(() => {
      if (!done) showToast(`${label} belum terkirim ke server (koneksi lambat/terputus). Jangan tutup aplikasi sampai muncul tanda "tersimpan".`, 'warning');
    }, 6000);
    const ok = () => {
      done = true;
      clearTimeout(slow);
      showToast(`${label} tersimpan di server ✓`, 'success');
    };
    ack.then(ok).catch(() => {
      clearTimeout(slow);
      entriesCol
        .rewriteEntry(entryId)
        .then(ok)
        .catch(() => {
          done = true;
          showToast(`${label} GAGAL tersimpan ke server. Muat ulang aplikasi lalu cek Riwayat; jika tidak ada, ulangi absen.`, 'warning');
        });
    });
  };

  /**
   * Kirim teguran OTOMATIS ke akun yang sedang login. Id-nya tetap (lihat utils/autoWarnings.ts) sehingga
   * tidak pernah terkirim ganda walau aplikasi dibuka di beberapa perangkat: dicek dulu di server.
   */
  const autoSentRef = useRef(new Set<string>());
  const sendAutoWarning = async (draft: AutoWarnDraft) => {
    const key = safeSegment(draft.id);
    if (autoSentRef.current.has(key)) return;
    autoSentRef.current.add(key);
    try {
      const snap = await get(dbRef(`warnings/${key}`));
      if (snap.exists()) return; // sudah pernah terkirim (mungkin dari perangkat lain)
      const now = new Date();
      const warn: WarningItem = {
        id: key,
        senderId: AUTO_SENDER_ID,
        senderName: AUTO_SENDER_NAME,
        recipientId: currentUser.id,
        recipientName: currentUser.name,
        type: draft.type,
        title: draft.title,
        message: draft.message,
        date: draft.date,
        createdAt: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`,
        status: 'terkirim',
      };
      warningsCol.patchLocal((prev) => [warn, ...prev.filter((w) => w.id !== key)]);
      await fbSet(dbRef(`warnings/${key}`), cleanForFirebase(warn));
      showToast(`${draft.title}: ${draft.message}`, 'warning');
    } catch (e) {
      console.error('[Firebase] gagal mengirim teguran otomatis:', e);
      autoSentRef.current.delete(key); // boleh dicoba lagi pada pengecekan berikutnya
    }
  };
  const autoWarnRef = useRef(sendAutoWarning);
  autoWarnRef.current = sendAutoWarning;
  const wfaSettingsRef = useRef(wfaSettings);
  wfaSettingsRef.current = wfaSettings;

  // Pesan jelas kalau Firebase menolak akses (biasanya karena Rules)
  const firebaseError = users.error || entriesCol.error || warningsCol.error || zoomCol.error;
  useEffect(() => {
    if (firebaseError) showToast(`Koneksi database bermasalah: ${firebaseError}`, 'warning');
  }, [firebaseError, showToast]);

  // ---------- Akun bawaan pertama kali ----------
  useEffect(() => {
    if (users.loaded && !users.error && users.items.length === 0) {
      setAllUsers([buildDefaultAdmin()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users.loaded, users.error, users.items.length]);

  // ---------- Sesi login (bertahan setelah refresh) ----------
  const [sessionUserId, setSessionUserId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  });
  const persistSession = (id: string | null) => {
    // Ganti/keluar akun: buang data akun sebelumnya dari memori (lingkup data berbeda tiap akun)
    entriesCol.reset();
    setSessionUserId(id);
    try {
      if (id) localStorage.setItem(SESSION_KEY, id);
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      /* abaikan */
    }
  };

  const sessionUser = sessionUserId ? allUsers.find((u) => u.id === sessionUserId) : undefined;
  const isAuthenticated = !!sessionUser && sessionUser.isActive !== false;
  const currentUser: User = isAuthenticated ? sessionUser! : GUEST_USER;

  // ---------- Lingkup & pengambilan data (SESUAI KEBUTUHAN, bukan seluruh database) ----------
  // Karyawan = entry miliknya, Leader = dirinya + timnya, HRD = semua akun.
  const entriesScopeKey = useMemo(() => {
    if (!isAuthenticated) return '';
    const ids = new Set<string>([currentUser.id]);
    if (currentUser.role === 'hrd') allUsers.forEach((u) => ids.add(u.id));
    else if (currentUser.role === 'leader') allUsers.forEach((u) => u.leaderId === currentUser.id && ids.add(u.id));
    return Array.from(ids).sort().join(',');
  }, [isAuthenticated, currentUser.id, currentUser.role, allUsers]);
  const scopeIdsRef = useRef<string[]>([]);
  scopeIdsRef.current = entriesScopeKey ? entriesScopeKey.split(',') : [];
  const meIdRef = useRef(currentUser.id);
  meIdRef.current = currentUser.id;

  const ensureEntries = useCallback(
    (from: string, to: string, opts?: { force?: boolean; self?: boolean }) =>
      entriesCol.ensure(opts?.self ? [meIdRef.current] : scopeIdsRef.current, from, to, !!opts?.force).catch(() => undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entriesCol.ensure]
  );

  const activeRangesRef = useRef(new Map<string, { from: string; to: string; self?: boolean; onSynced?: () => void }>());
  const registerEntriesRange = useCallback((id: string, range: { from: string; to: string; self?: boolean; onSynced?: () => void } | null) => {
    if (range) activeRangesRef.current.set(id, range);
    else activeRangesRef.current.delete(id);
  }, []);

  useEffect(() => {
    setAuthReady(isAuthenticated);
  }, [isAuthenticated]);

  // Pengambilan awal: HANYA entry milik sendiri (31 hari ke belakang) — cukup untuk absen & to-do hari ini.
  const [baselineFor, setBaselineFor] = useState<string | null>(null);
  const lastFullSyncRef = useRef(Date.now());
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
    const ownTodayAtRef = useRef(Date.now());
  useEffect(() => {
    if (!isAuthenticated) {
      setBaselineFor(null);
      return;
    }
    let alive = true;
    const today = getTodayDateString();
    entriesCol
      .ensure([currentUser.id], shiftDate(today, -BASELINE_DAYS), today)
      .catch(() => undefined)
      .finally(() => {
        lastFullSyncRef.current = Date.now();
        ownTodayAtRef.current = Date.now();
        if (alive) {
          setLastSyncAt(Date.now());
          setBaselineFor(currentUser.id);
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, currentUser.id]);

  const isReady = (baseReady && (!isAuthenticated || baselineFor === currentUser.id)) || timedOut;

  // ---------- HRD login sebagai karyawan (impersonation) ----------
  const [impersonatorId, setImpersonatorId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(IMPERSONATOR_KEY);
    } catch {
      return null;
    }
  });
  const persistImpersonator = (id: string | null) => {
    setImpersonatorId(id);
    try {
      if (id) localStorage.setItem(IMPERSONATOR_KEY, id);
      else localStorage.removeItem(IMPERSONATOR_KEY);
    } catch {
      /* abaikan */
    }
  };
  const impersonatorUser = impersonatorId ? allUsers.find((u) => u.id === impersonatorId) : undefined;
  const isImpersonating = !!impersonatorId && !!impersonatorUser;

  const loginAsUser = (userId: string) => {
    if (!sessionUser || sessionUser.role !== 'hrd') {
      showToast('Hanya HRD yang bisa masuk sebagai akun lain', 'warning');
      return;
    }
    if (isImpersonating) {
      showToast('Kembali ke akun Admin dulu sebelum masuk sebagai akun lain', 'warning');
      return;
    }
    if (userId === sessionUser.id) return;
    const target = allUsers.find((u) => u.id === userId);
    if (!target) return;
    if (target.isActive === false) {
      showToast('Akun ini nonaktif, tidak bisa dipakai untuk login', 'warning');
      return;
    }
    persistImpersonator(sessionUser.id);
    persistSession(userId);
    showToast(`Anda login sebagai ${target.name}`, 'info');
  };

  const returnToAdmin = () => {
    if (!impersonatorId) return;
    persistSession(impersonatorId);
    persistImpersonator(null);
    showToast('Kembali ke akun Admin', 'success');
  };

  // Akun dihapus / dinonaktifkan HRD saat sedang login → keluarkan (atau kembali ke Admin kalau sedang impersonate)
  useEffect(() => {
    if (isReady && users.loaded && sessionUserId && !isAuthenticated) {
      if (impersonatorId) {
        persistSession(impersonatorId);
        persistImpersonator(null);
        showToast('Akun yang Anda pakai (login sebagai) sudah dinonaktifkan. Kembali ke akun Admin.', 'warning');
      } else {
        persistSession(null);
        showToast('Sesi berakhir: akun Anda sudah dinonaktifkan atau dihapus.', 'warning');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, users.loaded, sessionUserId, isAuthenticated]);

  const login = (username: string, password: string): LoginResult => {
    const u = username.trim().toLowerCase();
    if (!u || !password) return { ok: false, error: 'Username dan password wajib diisi' };
    if (allUsers.length === 0) {
      return { ok: false, error: 'Data akun belum termuat. Periksa koneksi internet lalu coba lagi.' };
    }
    const user = allUsers.find((usr) => usernameOf(usr) === u);
    if (!user || !verifyPassword(password, user.password, user.id)) {
      return { ok: false, error: 'Username atau password salah' };
    }
    if (user.isActive === false) {
      return { ok: false, error: 'Akun Anda dinonaktifkan. Hubungi HRD.' };
    }
    // Akun lama yang passwordnya masih teks biasa / default → simpan dalam bentuk hash
    if (!isHashed(user.password)) {
      setAllUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, password: hashPassword(password, u.id) } : u)));
    }
    persistSession(user.id);
    return { ok: true };
  };

  const logout = () => {
    if (impersonatorId) {
      persistSession(impersonatorId);
      persistImpersonator(null);
    } else {
      persistSession(null);
    }
  };

  const verifyCurrentPassword = (plain: string) =>
    verifyPassword(plain, sessionUser?.password, sessionUser?.id || '');

  // Wajib ganti password: berlaku untuk akun manapun (karyawan/leader/HRD) selama password yang
  // TERSIMPAN masih persis password bawaan — baik karena akun baru dibuat, HRD menekan tombol
  // Reset, maupun akun admin pertama yang belum pernah diganti. Tidak berlaku saat HRD sedang
  // "login sebagai" (impersonate), karena itu bukan sesi login asli milik pemilik akun.
  const mustChangePassword = isAuthenticated && !isImpersonating && isDefaultPassword(currentUser);

  // Password bawaan yang tidak boleh dipakai lagi oleh akun yang sedang login sebagai password baru
  const isDefaultPasswordValue = (plain: string): boolean => {
    if (plain === DEFAULT_PASSWORD) return true;
    if (currentUser.id === DEFAULT_ADMIN_ID && plain === DEFAULT_ADMIN_PASSWORD) return true;
    return false;
  };

  // ---------- Pengaturan ----------
  const updateWfaSettings = (newSettings: Partial<WfaSettings>) => {
    settingsVal.setValue(newSettings);
    showToast('Pengaturan sistem WFA berhasil disimpan', 'success');
  };

  const updateHubstaffSettings = (patch: Partial<HubstaffSettings>) => {
    hubstaffSettingsVal.setValue(patch);
    showToast('Pengaturan Hubstaff berhasil disimpan', 'success');
  };

  const canMonitorHubstaff = (() => {
    if (currentUser.role === 'hrd') return true;
    if (currentUser.role !== 'leader') return false;
    if (hubstaffSettings.leaderMonitorMode === 'semua') return true;
    if (hubstaffSettings.leaderMonitorMode === 'terpilih') {
      return Object.values(hubstaffSettings.allowedLeaderIds || {}).includes(currentUser.id);
    }
    return false;
  })();

  // ---------- Manajemen akun ----------
  const emailTaken = (email: string, exceptId?: string) =>
    allUsers.some((u) => u.id !== exceptId && u.email.trim().toLowerCase() === email.trim().toLowerCase());

  const usernameTaken = (username: string, exceptId?: string) => {
    const u = username.trim().toLowerCase();
    if (!u) return false;
    return allUsers.some((usr) => usr.id !== exceptId && usernameOf(usr) === u);
  };

  const addUser = (userData: Omit<User, 'id'>) => {
    if (emailTaken(userData.email)) {
      showToast(`Email ${userData.email} sudah terdaftar`, 'warning');
      return;
    }
    const effectiveUsername = (userData.username?.trim() || userData.email.split('@')[0] || '').toLowerCase();
    if (usernameTaken(effectiveUsername)) {
      showToast(
        `Username "${effectiveUsername}" sudah dipakai akun lain. Isi kolom Username dengan nama yang berbeda.`,
        'warning'
      );
      return;
    }
    const id = `usr-${userData.role.slice(0, 4)}-${Date.now()}`;
    const plain = userData.password || DEFAULT_PASSWORD;
    const newUser: User = {
      ...userData,
      username: userData.username?.trim().toLowerCase() || undefined,
      id,
      isActive: true,
      password: hashPassword(plain, id),
    };
    setAllUsers((prev) => [...prev, newUser]);
    showToast(
      `Akun ${newUser.name} (${newUser.role}) berhasil ditambahkan! Password awal: ${userData.password ? '(sesuai input)' : DEFAULT_PASSWORD}`,
      'success'
    );
  };

  const updateUser = (userId: string, data: Partial<User>) => {
    if (data.email && emailTaken(data.email, userId)) {
      showToast(`Email ${data.email} sudah dipakai akun lain`, 'warning');
      return;
    }
    if (data.username !== undefined || data.email !== undefined) {
      const existing = allUsers.find((u) => u.id === userId);
      if (existing) {
        const merged = { ...existing, ...data } as User;
        const newName = usernameOf(merged);
        if (newName !== usernameOf(existing) && usernameTaken(newName, userId)) {
          showToast(`Username "${newName}" sudah dipakai akun lain. Isi kolom Username dengan nama yang berbeda.`, 'warning');
          return;
        }
      }
    }
    const patch: Partial<User> = { ...data };
    if (patch.username) patch.username = patch.username.trim().toLowerCase();
    if (patch.password && !isHashed(patch.password)) patch.password = hashPassword(patch.password, userId);
    setAllUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...patch } : u)));
    showToast('Data akun berhasil diperbarui!', 'success');
  };

  const resetUserPassword = (userId: string) => {
    setAllUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, password: hashPassword(DEFAULT_PASSWORD, userId) } : u))
    );
    showToast(`Password direset ke "${DEFAULT_PASSWORD}". Minta yang bersangkutan menggantinya setelah login.`, 'success');
  };

  const deleteUser = (userId: string) => {
    if (userId === currentUser.id) {
      showToast('Anda tidak bisa menghapus akun yang sedang dipakai', 'warning');
      return;
    }
    setAllUsers((prev) => prev.filter((u) => u.id !== userId));
    showToast('Akun berhasil dihapus dari sistem', 'info');
  };

  // ---------- State UI ----------
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());

  // ---------- Teguran otomatis (dibuat oleh aplikasi karyawan itu sendiri, lihat utils/autoWarnings.ts) ----------
  const baselineForRef = useRef<string | null>(null);
  baselineForRef.current = baselineFor;

  // Pengingat to-do menjelang absen siang: dicek tiap menit selama aplikasi terbuka.
  useEffect(() => {
    if (!isAuthenticated || (currentUser.role !== 'karyawan' && currentUser.role !== 'leader')) return;
    const tick = () => {
      if (baselineForRef.current !== currentUser.id) return; // tunggu data awal termuat
      const today = getTodayDateString();
      const mine = entriesRef.current.find((e) => e.userId === currentUser.id && e.date === today);
      if (!mine) return;
      const draft = todoReminderDraft(currentUser.id, mine, new Date(), wfaSettingsRef.current);
      if (draft) void autoWarnRef.current(draft);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, currentUser.id, currentUser.role]);

  // Teguran performa: dievaluasi tiap data entry diperbarui (login, Refresh, setelah leader menilai).
  useEffect(() => {
    if (!isAuthenticated || currentUser.role !== 'karyawan' || baselineFor !== currentUser.id) return;
    const draft = performanceWarningDraft(currentUser.id, entriesRef.current, getTodayDateString(), wfaSettingsRef.current);
    if (draft) void autoWarnRef.current(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entriesCol.updatedAt, baselineFor, isAuthenticated, currentUser.id, currentUser.role]);

  // Sinkron dua arah web <-> desktop: dengarkan HANYA entry milik sendiri pada tanggal terpilih (beberapa KB).
  // Absen/to-do/penilaian yang terjadi di perangkat lain langsung tampil di sini, dan sebaliknya.
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = `entry-${currentUser.id}-${selectedDate}`;
    return onValue(
      dbRef(`entries/${safeSegment(id)}`),
      (snap) => entriesCol.applyRemote(id, snap.val()),
      (err) => console.error('[Firebase] gagal mendengarkan entry sendiri:', err)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, currentUser.id, selectedDate]);

  // Pindah ke tanggal lain (mis. menengok hari sebelumnya): pastikan entry milik sendiri di tanggal itu termuat
  useEffect(() => {
    if (!isAuthenticated || baselineFor !== currentUser.id) return;
    void entriesCol.ensure([currentUser.id], selectedDate, selectedDate).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, isAuthenticated, baselineFor, currentUser.id]);
  const [activeImageModal, setActiveImageModal] = useState<{ url: string; title?: string } | null>(null);

  // Ganti hari otomatis kalau aplikasi dibiarkan terbuka melewati tengah malam
  useEffect(() => {
    let lastToday = getTodayDateString();
    const timer = setInterval(() => {
      const nowKey = getTodayDateString();
      if (nowKey !== lastToday) {
        setSelectedDate((cur) => (cur === lastToday ? nowKey : cur));
        lastToday = nowKey;
      }
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // ---------- Sinyal ringan: tanda "ada data baru" (beberapa byte), BUKAN datanya ----------
  // Teguran & jadwal meeting perlu sampai ke penerima tanpa menunggu tombol Refresh. Penulis menaruh
  // cap waktu di node kecil; perangkat penerima hanya mendengarkan node itu dan, kalau berubah,
  // mengambil ulang daftar terkait SATU kali.
  const lastSignalSent = useRef<number>(0);
  const sendSignal = useCallback((path: string) => {
    lastSignalSent.current = Date.now();
    fbSet(dbRef(path), lastSignalSent.current).catch(() => undefined);
  }, []);
  const zoomRefreshRef = useRef(zoomCol.refresh);
  zoomRefreshRef.current = zoomCol.refresh;
  const warnRefreshRef = useRef(warningsCol.refresh);
  warnRefreshRef.current = warningsCol.refresh;

  useEffect(() => {
    if (!isAuthenticated) return;
    let first = true;
    return onValue(dbRef('signals/zoom'), (snap) => {
      if (first) {
        first = false;
        return;
      }
      if (snap.val() === lastSignalSent.current) return; // tulisan sendiri
      void zoomRefreshRef.current();
    });
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let first = true;
    return onValue(dbRef(`signals/warn/${currentUser.id}`), (snap) => {
      if (first) {
        first = false;
        return;
      }
      void warnRefreshRef.current();
    });
  }, [isAuthenticated, currentUser.id]);

  // ---------- Tab kembali aktif: perbarui hanya bila data sudah lama / basi ----------
  useEffect(() => {
    if (!isAuthenticated) return;
    const onBack = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      const today = getTodayDateString();
      if (now - lastFullSyncRef.current > STALE_MS) {
        lastFullSyncRef.current = now;
        setLastSyncAt(now);
        ownTodayAtRef.current = now;
        void entriesCol.ensure([meIdRef.current], shiftDate(today, -BASELINE_DAYS), today, true).catch(() => undefined);
        activeRangesRef.current.forEach((r) => void ensureEntries(r.from, r.to, { force: true, self: r.self }).then(() => r.onSynced?.()));
        void warnRefreshRef.current();
        void zoomRefreshRef.current();
      } else if (now - ownTodayAtRef.current > OWN_TODAY_STALE_MS) {
        // Perangkat lain milik akun yang sama mungkin sudah mengubah entry hari ini -> ambil 1 entry saja
        ownTodayAtRef.current = now;
        void entriesCol.refreshOne(`entry-${meIdRef.current}-${today}`).catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    return () => {
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('focus', onBack);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  /** Ambil ulang semuanya yang sedang dipakai: entry milik sendiri, rentang halaman aktif, teguran, meeting. */
  const refreshAll = useCallback(async () => {
    const today = getTodayDateString();
    lastFullSyncRef.current = Date.now();
    ownTodayAtRef.current = Date.now();
    const jobs: Array<Promise<unknown>> = [
      entriesCol.ensure([meIdRef.current], shiftDate(today, -BASELINE_DAYS), today, true).catch(() => undefined),
      warnRefreshRef.current(),
      zoomRefreshRef.current(),
    ];
    activeRangesRef.current.forEach((r) => jobs.push(ensureEntries(r.from, r.to, { force: true, self: r.self }).then(() => r.onSynced?.())));
    await Promise.all(jobs);
    setLastSyncAt(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureEntries]);

  const zoomMeeting = useMemo(() => zoomMeetings[0] || EMPTY_ZOOM, [zoomMeetings]);

  const openImageModal = (url: string, title?: string) => {
    setActiveImageModal({ url, title });
  };

  const closeImageModal = () => {
    setActiveImageModal(null);
  };

  // Helper kalkulasi skor centang: (jumlah centang / total todo) * 100
  const recalculateScore = (todos: TodoItem[]) => {
    const total = todos.length;
    const completed = todos.filter((t) => t.completed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent };
  };

  // Mendapatkan atau menginisialisasi entri untuk currentUser di tanggal terpilih
  const getCurrentEntry = (): DailyWfaEntry => {
    const existing = entries.find(
      (e) => e.userId === currentUser.id && e.date === selectedDate
    );
    if (existing) return existing;

    // Buat entri kosong baru untuk tanggal ini
    const newEntry: DailyWfaEntry = {
      id: `entry-${currentUser.id}-${selectedDate}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      division: currentUser.division,
      date: selectedDate,
      absenPagi: null,
      absenSiang: null,
      todos: [],
      employeeScorePercent: 0,
      totalTodos: 0,
      completedTodos: 0,
      leaderScore: null,
      leaderCommunicationScore: null,
      leaderGeneralComment: '',
      leaderReviewedAt: null,
      leaderReviewedBy: null,
      status: 'belum_mulai',
    };
    return newEntry;
  };

  // 1. Absen Pagi Karyawan
  /**
   * Absen pagi: SEBELUM menulis, cek server — kalau perangkat lain (web/desktop) sudah mencatat absen hari ini,
   * tampilan diperbarui dan absen TIDAK ditimpa.
   */
  const doAbsenPagi = (location: string, notes: string) => {
    void (async () => {
      const id = `entry-${currentUser.id}-${selectedDate}`;
      try {
        const snap = await get(dbRef(`entries/${safeSegment(id)}/absenPagi`));
        const remote = snap.val() as { time?: string } | null;
        if (remote) {
          entriesCol.refreshOne(id).catch(() => undefined);
          showToast(`Anda sudah absen pagi pukul ${remote.time || ''} (tercatat dari perangkat lain). Tampilan diperbarui.`, 'info');
          return;
        }
      } catch {
        /* offline: lanjut dengan data lokal, pengaman lokal tetap berlaku */
      }
      doAbsenPagiNow(location, notes);
    })();
  };

  const doAbsenPagiNow = (location: string, notes: string) => {
    // Pengaman: absen yang sudah tercatat TIDAK boleh ditimpa (jam & status aslinya hilang kalau absen lagi)
    const already = entriesRef.current.find((e) => e.userId === currentUser.id && e.date === selectedDate)?.absenPagi;
    if (already) {
      showToast(`Anda sudah absen pagi pukul ${already.time}. Absen tidak perlu diulang.`, 'info');
      return;
    }
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
    const [limitH, limitM] = (wfaSettings.morningAbsenTime || '08:30').split(':').map(Number);
    const isLate = now.getHours() * 60 + now.getMinutes() > limitH * 60 + limitM;

    const record: AbsenRecord = {
      time: timeStr,
      status: isLate ? 'terlambat' : 'tepat_waktu',
      location: location || 'Rumah (WFA)',
      notes,
      timestamp: Date.now(),
    };

    const ackPagi = entriesCol.setItemsAck((prev) => {
      const idx = prev.findIndex((e) => e.userId === currentUser.id && e.date === selectedDate);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          absenPagi: record,
          status: updated[idx].status === 'belum_mulai' ? 'pagi_selesai' : updated[idx].status,
        };
        return updated;
      } else {
        const newEntry: DailyWfaEntry = {
          id: `entry-${currentUser.id}-${selectedDate}`,
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email,
          division: currentUser.division,
          date: selectedDate,
          absenPagi: record,
          absenSiang: null,
          todos: [],
          employeeScorePercent: 0,
          totalTodos: 0,
          completedTodos: 0,
          leaderScore: null,
          leaderCommunicationScore: null,
          leaderGeneralComment: '',
          leaderReviewedAt: null,
          leaderReviewedBy: null,
          status: 'pagi_selesai',
        };
        return [newEntry, ...prev];
      }
    });

    trackSave(ackPagi, 'Absen pagi', `entry-${currentUser.id}-${selectedDate}`);
    if (currentUser.role !== 'hrd') {
      const lateDraft = lateWarningDraft(currentUser.id, selectedDate, record, wfaSettings);
      if (lateDraft) void sendAutoWarning(lateDraft);
    }
    showToast(`Absen Pagi berhasil (${record.status === 'terlambat' ? 'Terlambat' : 'Tepat Waktu'})`, 'success');
  };

  // 2. Tambah To-Do List di Pagi Hari
  const addTodo = (task: string, target?: string) => {
    if (!task.trim()) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;

    const newTodo: TodoItem = {
      id: 'td-' + Date.now() + Math.random().toString(36).substring(2, 6),
      task: task.trim(),
      target: target?.trim(),
      completed: false,
      createdAt: timeStr,
    };

    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.userId === currentUser.id && e.date === selectedDate);
      if (idx >= 0) {
        const updatedTodos = [...prev[idx].todos, newTodo];
        const { total, completed, percent } = recalculateScore(updatedTodos);
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          todos: updatedTodos,
          totalTodos: total,
          completedTodos: completed,
          employeeScorePercent: percent,
        };
        return updated;
      } else {
        const newEntry: DailyWfaEntry = {
          id: `entry-${currentUser.id}-${selectedDate}`,
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email,
          division: currentUser.division,
          date: selectedDate,
          absenPagi: null,
          absenSiang: null,
          todos: [newTodo],
          employeeScorePercent: 0,
          totalTodos: 1,
          completedTodos: 0,
          leaderScore: null,
          leaderCommunicationScore: null,
          leaderGeneralComment: '',
          leaderReviewedAt: null,
          leaderReviewedBy: null,
          status: 'pagi_selesai',
        };
        return [newEntry, ...prev];
      }
    });

    showToast('Tugas to-do baru berhasil ditambahkan', 'success');
  };

  // 3. Hapus To-Do
  const deleteTodo = (todoId: string) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.userId === currentUser.id && e.date === selectedDate);
      if (idx < 0) return prev;
      const updatedTodos = prev[idx].todos.filter((t) => t.id !== todoId);
      const { total, completed, percent } = recalculateScore(updatedTodos);
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        todos: updatedTodos,
        totalTodos: total,
        completedTodos: completed,
        employeeScorePercent: percent,
      };
      return updated;
    });
    showToast('Tugas to-do dihapus', 'info');
  };

  // 4. PERUBAHAN UTAMA: CENTANG TO-DO LIST (Bukan skor angka manual)
  // Setiap to-do yang dicentang langsung memutakhirkan skor persentase secara realtime
  const toggleTodoCentang = (todoId: string) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.userId === currentUser.id && e.date === selectedDate);
      if (idx < 0) return prev;

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;

      const updatedTodos = prev[idx].todos.map((t) => {
        if (t.id === todoId) {
          const nextVal = !t.completed;
          return {
            ...t,
            completed: nextVal,
            completedAt: nextVal ? timeStr : undefined,
          };
        }
        return t;
      });

      const { total, completed, percent } = recalculateScore(updatedTodos);
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        todos: updatedTodos,
        totalTodos: total,
        completedTodos: completed,
        employeeScorePercent: percent,
      };
      return updated;
    });
  };

  // 5. Update Lampiran Bukti Pekerjaan (Link & Foto)
  const updateTodoProof = (todoId: string, proofLink?: string, proofImage?: string, proofFileName?: string) => {
    // Foto disimpan di node terpisah (proofImages/...), di entry hanya referensinya — supaya
    // data entry yang diunduh banyak orang tetap kecil. Foto baru tampil instan dari cache memori.
    let imageValue = proofImage;
    if (proofImage && isInlineImage(proofImage)) {
      const path = `proofImages/${safeSegment(`entry-${currentUser.id}-${selectedDate}`)}/${safeSegment(todoId)}`;
      imageValue = makeImageRef(path);
      saveImage(path, proofImage).catch(() => showToast('Foto bukti gagal diunggah. Coba lampirkan ulang.', 'warning'));
    }
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.userId === currentUser.id && e.date === selectedDate);
      if (idx < 0) return prev;

      const updatedTodos = prev[idx].todos.map((t) => {
        if (t.id === todoId) {
          return {
            ...t,
            proofLink: proofLink !== undefined ? proofLink : t.proofLink,
            proofImage: imageValue !== undefined ? imageValue : t.proofImage,
            proofFileName: proofFileName !== undefined ? proofFileName : t.proofFileName,
          };
        }
        return t;
      });

      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        todos: updatedTodos,
      };
      return updated;
    });
    showToast('Bukti pekerjaan berhasil disimpan', 'success');
  };

  // 6. Absen Siang Karyawan (dilakukan setelah mencentang to-do)
  const doAbsenSiang = (location: string, notes: string) => {
    void (async () => {
      const id = `entry-${currentUser.id}-${selectedDate}`;
      try {
        const snap = await get(dbRef(`entries/${safeSegment(id)}/absenSiang`));
        const remote = snap.val() as { time?: string } | null;
        if (remote) {
          entriesCol.refreshOne(id).catch(() => undefined);
          showToast(`Anda sudah absen siang pukul ${remote.time || ''} (tercatat dari perangkat lain). Tampilan diperbarui.`, 'info');
          return;
        }
      } catch {
        /* offline: lanjut dengan data lokal */
      }
      doAbsenSiangNow(location, notes);
    })();
  };

  const doAbsenSiangNow = (location: string, notes: string) => {
    const alreadyS = entriesRef.current.find((e) => e.userId === currentUser.id && e.date === selectedDate)?.absenSiang;
    if (alreadyS) {
      showToast(`Anda sudah absen siang pukul ${alreadyS.time}. Absen tidak perlu diulang.`, 'info');
      return;
    }
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
    const isLate = now.getHours() > 13 || (now.getHours() === 13 && now.getMinutes() > 30);

    const record: AbsenRecord = {
      time: timeStr,
      status: isLate ? 'terlambat' : 'tepat_waktu',
      location: location || 'Rumah (WFA)',
      notes,
      timestamp: Date.now(),
    };

    let siangMissing = false;
    const ackSiang = entriesCol.setItemsAck((prev) => {
      const idx = prev.findIndex((e) => e.userId === currentUser.id && e.date === selectedDate);
      if (idx >= 0) {
        const currentTodos = prev[idx].todos;
        const { total, completed, percent } = recalculateScore(currentTodos);
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          absenSiang: record,
          totalTodos: total,
          completedTodos: completed,
          employeeScorePercent: percent,
          status: 'siang_selesai',
        };
        return updated;
      }
      siangMissing = true;
      return prev;
    });

    if (siangMissing) {
      showToast('Data absen pagi hari ini belum termuat di perangkat ini, jadi absen siang TIDAK dicatat. Tekan Refresh lalu ulangi.', 'warning');
      return;
    }
    trackSave(ackSiang, 'Absen siang', `entry-${currentUser.id}-${selectedDate}`);
    showToast('Absen Siang berhasil dicatat! Menunggu verifikasi Leader.', 'success');
  };

  // 6b. Simpan total detik time-tracking Hubstaff hari ini ke entry (tersinkron ke semua perangkat,
  // otomatis "reset" tiap hari karena entry-nya sendiri per-tanggal, bukan field global).
  const updateHubstaffStats = (patch: HubstaffStatsPatch) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.userId === currentUser.id && e.date === selectedDate);
      if (idx < 0) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], ...patch };
      return updated;
    });
  };

  // 7. Aksi Leader: Memberi nilai berdasarkan to-do yang dicentang + nilai komunikasi (wajib) + komen general
  const leaderReviewEntry = (
    entryId: string,
    leaderScore: number,
    communicationScore: number,
    generalComment: string,
    verifiedItemIds: string[]
  ) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;

    const applyReview = () => setEntries((prev) => {
      return prev.map((entry) => {
        if (entry.id === entryId) {
          const updatedTodos = entry.todos.map((todo) => ({
            ...todo,
            verifiedByLeader: verifiedItemIds.includes(todo.id),
          }));

          return {
            ...entry,
            todos: updatedTodos,
            leaderScore: Math.min(100, Math.max(0, leaderScore)),
            leaderCommunicationScore: Math.min(100, Math.max(0, communicationScore)),
            leaderGeneralComment: generalComment.trim(),
            leaderReviewedAt: timeStr,
            leaderReviewedBy: currentUser.name,
            status: 'selesai_direview',
          };
        }
        return entry;
      });
    });

    // Ambil versi TERBARU entry dari server dulu: karyawan mungkin menambah bukti setelah data
    // di layar leader dimuat, dan penilaian menulis ulang daftar to-do.
    entriesCol.refreshOne(entryId).catch(() => undefined).finally(() => applyReview());

    showToast('Evaluasi dan penilaian leader berhasil dikirim!', 'success');
  };

  // 8. Kirim Teguran / Reminder Tim
  const sendWarning = (recipientId: string, type: WarningItem['type'], title: string, message: string) => {
    const targetUser = allUsers.find((u) => u.id === recipientId);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;

    const newWarn: WarningItem = {
      id: 'warn-' + Date.now(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      recipientId,
      recipientName: targetUser?.name || 'Anggota Tim',
      type,
      title: title.trim(),
      message: message.trim(),
      date: selectedDate,
      createdAt: timeStr,
      status: 'terkirim',
    };

    setWarnings((prev) => [newWarn, ...prev]);
    sendSignal(`signals/warn/${recipientId}`);
    showToast(`Teguran berhasil dikirim ke ${targetUser?.name || 'anggota tim'}`, 'warning');
  };

  const deleteWarning = (warningId: string) => {
    setWarnings((prev) => prev.filter((w) => w.id !== warningId));
    showToast('Teguran dihapus dari riwayat', 'info');
  };

  // Tandai teguran sudah dibaca oleh karyawan penerima (dipakai popup notifikasi awal)
  const markWarningRead = (warningId: string) => {
    setWarnings((prev) =>
      prev.map((w) => (w.id === warningId && w.status === 'terkirim' ? { ...w, status: 'dibaca' } : w))
    );
  };

  // 9. Manajemen Google Meet
  // Setiap koordinator punya link Google Meet-nya sendiri (bukan satu link Zoom global),
  // supaya beberapa koordinator bisa meeting BERSAMAAN tanpa bentrok/numpuk di satu link yang sama.
  const createZoomMeeting = (data: {
    title: string;
    date: string;
    time: string;
    duration: number;
    agenda?: string;
    isUrgent: boolean;
    link: string;
    session: 'pagi' | 'siang';
  }): ZoomMeetingInfo | null => {
    const meetLink = (data.link || '').trim();
    if (!meetLink) {
      showToast('Link Google Meet belum diisi. Tempel link Google Meet Anda terlebih dahulu.', 'warning');
      return null;
    }

    // Ambil kode ruangan dari link (meet.google.com/xxx-yyyy-zzz) untuk ditampilkan sebagai "Kode Rapat"
    const meetCode = meetLink.match(/meet\.google\.com\/([a-z0-9-]+)/i)?.[1] || '';

    const newMeeting: ZoomMeetingInfo = {
      id: `zoom-${Date.now()}`,
      title: data.title.trim(),
      date: data.date,
      time: data.time,
      duration: data.duration,
      isUrgent: data.isUrgent,
      session: data.session,
      hostName: currentUser.name,
      leaderId: currentUser.id,
      meetingId: meetCode || '-',
      link: meetLink,
      passcode: wfaSettings.companyZoomPasscode || '',
      agenda: data.agenda?.trim() || '',
      status: 'aktif',
      photos: [],
      attendees: [
        {
          userId: currentUser.id,
          userName: currentUser.name,
          joinedAt: `${data.time} WIB (Host)`,
        },
      ],
    };

    setZoomMeetings((prev) => [newMeeting, ...prev]);
    sendSignal('signals/zoom');

    if (data.isUrgent) {
      showToast(`🚨 Google Meet Urgen "${data.title}" berhasil dibuat & disebarkan ke tim Anda!`, 'warning');
    } else {
      showToast(`⚡ Jadwal Google Meet "${data.title}" dibuat & dibagikan ke tim Anda`, 'success');
    }

    return newMeeting;
  };

  const completeZoomMeeting = (meetingId: string) => {
    setZoomMeetings((prev) =>
      prev.map((m) => (m.id === meetingId ? { ...m, status: 'selesai' } : m))
    );
    sendSignal('signals/zoom');
    showToast('Meeting selesai & link di dashboard karyawan dihapus (diarsipkan sebagai bukti leader)', 'info');
  };

  const deleteZoomMeeting = (meetingId: string) => {
    setZoomMeetings((prev) => prev.filter((m) => m.id !== meetingId));
    fbRemove(dbRef(`zoomPhotos/${safeSegment(meetingId)}`)).catch(() => undefined);
    sendSignal('signals/zoom');
    showToast('Meeting berhasil dihapus dari jadwal', 'info');
  };

  const addZoomPhoto = (meetingId: string, photoUrl: string, caption?: string) => {
    const now = new Date();
    const dateStr = `${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}, ${String(now.getHours()).padStart(2, '0')}.${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
    const photoId = `photo-${Date.now()}`;
    let url = photoUrl;
    if (isInlineImage(photoUrl)) {
      const path = `zoomPhotos/${safeSegment(meetingId)}/${photoId}`;
      url = makeImageRef(path);
      saveImage(path, photoUrl).catch(() => showToast('Foto meeting gagal diunggah. Coba lagi.', 'warning'));
    }
    const newPhoto: ZoomMeetingPhoto = { id: photoId, url, timestamp: dateStr, caption };
    // Tulis HANYA foto ini (bukan seluruh daftar foto) -> tidak menimpa foto lain walau data lokal sudah lama.
    fbSet(dbRef(`zoomMeetings/${safeSegment(meetingId)}/photos/${photoId}`), JSON.parse(JSON.stringify(newPhoto))).catch(() =>
      showToast('Gagal menyimpan foto meeting', 'warning')
    );
    zoomCol.patchLocal((prev) => prev.map((m) => (m.id === meetingId ? { ...m, photos: [...m.photos, newPhoto] } : m)));
    showToast('Bukti foto meeting berhasil ditambahkan', 'success');
  };

  const deleteZoomPhoto = (meetingId: string, photoId: string) => {
    const meeting = zoomMeetings.find((m) => m.id === meetingId);
    const photo = meeting?.photos.find((p) => p.id === photoId);
    deleteImage(photo?.url);
    // photos bisa tersimpan sebagai array (data lama, kunci 0,1,2) atau map -> hapus kunci aslinya
    fbRemove(dbRef(`zoomMeetings/${safeSegment(meetingId)}/photos/${photoId}`)).catch(() => undefined);
    const idx = meeting ? meeting.photos.findIndex((p) => p.id === photoId) : -1;
    if (idx >= 0) {
      // data lama (array): ambil ulang daftar foto dari server agar kunci array tetap konsisten
      get(dbRef(`zoomMeetings/${safeSegment(meetingId)}/photos`))
        .then((snap) => {
          const val = snap.val() as Record<string, ZoomMeetingPhoto> | null;
          const entry = val && Object.entries(val).find(([, v]) => v && v.id === photoId);
          if (entry) return fbRemove(dbRef(`zoomMeetings/${safeSegment(meetingId)}/photos/${entry[0]}`));
        })
        .catch(() => undefined);
    }
    zoomCol.patchLocal((prev) =>
      prev.map((m) => (m.id === meetingId ? { ...m, photos: m.photos.filter((p) => p.id !== photoId) } : m))
    );
    showToast('Bukti foto meeting dihapus', 'info');
  };

  // Presensi gabung Zoom Meeting
  // Ditulis PER-ORANG (zoomMeetings/{id}/attendees/{userId}) supaya dua orang yang bergabung
  // bersamaan tidak saling menimpa — penting karena daftar meeting di perangkat bisa belum
  // diperbarui (tidak lagi live).
  const joinZoomMeeting = (meetingId?: string) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
    const attendee = { userId: currentUser.id, userName: currentUser.name, joinedAt: timeStr };

    const targets = zoomMeetings.filter(
      (m) => (!meetingId || m.id === meetingId) && !m.attendees.some((a) => a.userId === currentUser.id)
    );
    targets.forEach((m) => {
      fbSet(dbRef(`zoomMeetings/${safeSegment(m.id)}/attendees/${safeSegment(currentUser.id)}`), attendee).catch(() =>
        showToast('Presensi meeting gagal tersimpan. Coba lagi.', 'warning')
      );
    });
    zoomCol.patchLocal((prev) =>
      prev.map((m) => (targets.some((t) => t.id === m.id) ? { ...m, attendees: [...m.attendees, attendee] } : m))
    );

    showToast(`Presensi Zoom berhasil: ${currentUser.name} bergabung ke meeting`, 'success');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        allUsers,
        isAuthenticated,
        isReady,
        isOnline,
        login,
        logout,
        loginAsUser,
        returnToAdmin,
        isImpersonating,
        impersonatorUser,
        verifyCurrentPassword,
        mustChangePassword,
        isDefaultPasswordValue,
        entries,
        ensureEntries,
        registerEntriesRange,
        entriesLoading: entriesCol.loading,
        entriesUpdatedAt: entriesCol.updatedAt,
        lastSyncAt,
        entriesScopeKey,
        refreshAll,
        refreshWarnings: warningsCol.refresh,
        warningsLoading: warningsCol.refreshing,
        warningsUpdatedAt: warningsCol.updatedAt,
        refreshZoomMeetings: zoomCol.refresh,
        zoomLoading: zoomCol.refreshing,
        zoomUpdatedAt: zoomCol.updatedAt,
        selectedDate,
        activeImageModal,
        toasts,
        warnings,
        zoomMeeting,
        zoomMeetings,
        wfaSettings,
        updateWfaSettings,
        hubstaffSettings,
        updateHubstaffSettings,
        canMonitorHubstaff,
        addUser,
        updateUser,
        resetUserPassword,
        deleteUser,
        createZoomMeeting,
        deleteZoomMeeting,
        addZoomPhoto,
        deleteZoomPhoto,
        setSelectedDate,
        openImageModal,
        closeImageModal,
        showToast,
        getCurrentEntry,
        doAbsenPagi,
        addTodo,
        deleteTodo,
        toggleTodoCentang,
        updateTodoProof,
        doAbsenSiang,
        updateHubstaffStats,
        leaderReviewEntry,
        sendWarning,
        deleteWarning,
        markWarningRead,
        joinZoomMeeting,
        completeZoomMeeting,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

/**
 * Dipakai halaman yang menampilkan data entries pada rentang tanggal tertentu.
 * - Memuat rentang itu (hanya bagian yang belum ada) saat halaman dibuka / rentang berubah.
 * - refresh() = ambil ulang dari server (tombol Refresh).
 * `enabled=false` menunda pemuatan (mis. mode "hari ini" yang sudah tercakup data awal).
 */
export function useEntriesRange(from: string, to: string, opts: { enabled?: boolean; self?: boolean } = {}) {
  const { enabled = true, self = false } = opts;
  const { ensureEntries, registerEntriesRange, entriesLoading, entriesScopeKey } = useApp();
  const idRef = useRef(`r-${Math.random().toString(36).slice(2)}`);
  // Waktu sinkron khusus rentang halaman ini (bukan waktu pengambilan data lain di aplikasi)
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || !from || !to) return;
    let alive = true;
    registerEntriesRange(idRef.current, { from, to, self, onSynced: () => alive && setSyncedAt(Date.now()) });
    ensureEntries(from, to, { self }).then(() => alive && setSyncedAt(Date.now()));
    return () => {
      alive = false;
      registerEntriesRange(idRef.current, null);
    };
  }, [from, to, enabled, self, entriesScopeKey, ensureEntries, registerEntriesRange]);

  const refresh = useCallback(
    () => ensureEntries(from, to, { force: true, self }).then(() => setSyncedAt(Date.now())),
    [ensureEntries, from, to, self]
  );
  return { refresh, loading: entriesLoading, updatedAt: syncedAt };
}

export { ALL_FROM, ALL_TO };
