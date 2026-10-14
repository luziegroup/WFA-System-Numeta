import React, { useState, useEffect } from 'react';
import { RefreshBar } from './RefreshBar';
import { useApp } from '../context/AppContext';
import {
  FileText,
  Laptop,
  Smartphone,
  ExternalLink,
  HelpCircle,
  CheckCircle2,
  Lock,
  Unlock,
  Play,
  Pause,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Check,
  RefreshCw,
  Download
} from 'lucide-react';
import { SidebarMenuId } from './Sidebar';
import { isDesktopApp, getSystemIdleSeconds } from '../lib/systemIdle';
import { isScreenshotConfigured, isFeatureEnabledForDivision, formatClock } from '../utils/hubstaffUtils';
import { dbRef, set as fbSet } from '../lib/firebase';
import { UrlTrackingPairingCard } from './UrlTrackingPairingCard';
import { useActivityDetail } from '../lib/useActivityDetail';
import { useScreenshotCapture } from '../lib/useScreenshotCapture';

/** Link download installer aplikasi desktop WFA System (mis. link Google Drive).
 *  Tempel link di antara tanda kutip. Selama masih kosong, tidak ada yang berubah di tampilan. */
const DESKTOP_DOWNLOAD_URL = 'https://drive.google.com/file/d/1uGV-XjIDR9HOcfodk--q5M2Bocj-6H4X/view?usp=sharing';

/** false = tracking tetap bisa dimulai dari browser seperti biasa (hanya muncul anjuran
 *  install aplikasi desktop). Ubah jadi true kalau installer sudah dibagikan ke karyawan
 *  dan tracking ingin diwajibkan lewat aplikasi desktop. */
const REQUIRE_DESKTOP_FOR_TRACKING = false;

/* ------------------------------------------------------------------------------------------
 * Penghitung waktu tracking.
 * Waktu dihitung dari SELISIH JAM DINDING (Date.now), bukan dengan menambah 1 tiap detik,
 * karena browser/aplikasi desktop memperlambat timer saat window di-minimize atau tertutup
 * aplikasi lain (menambah 1 per detik akan membuat jam kerja tercatat kurang).
 * Status "sedang berjalan" juga disimpan di penyimpanan lokal supaya refresh / buka-tutup
 * aplikasi yang singkat tidak menghentikan timer.
 * ------------------------------------------------------------------------------------------ */
const TIMER_STORAGE_PREFIX = 'wfa_hubstaff_timer_';

/** Kalau halaman dimuat ulang dalam rentang ini sejak terakhir aktif, timer dianggap masih
 *  berjalan dan dilanjutkan. Lebih lama dari ini (mis. laptop mati), waktu hanya dihitung
 *  sampai terakhir aktif dan timer berhenti. */
const RESUME_WINDOW_MS = 120_000;

interface StoredTimer {
  base: number;
  runStart: number | null;
  lastSeen: number;
}

interface RestoredTimer {
  base: number;
  runStart: number | null;
  resumed: boolean;
  expired: boolean;
}

const readStoredTimer = (entryId: string): StoredTimer | null => {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_PREFIX + entryId);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.base !== 'number' || typeof v?.lastSeen !== 'number') return null;
    return { base: v.base, runStart: typeof v.runStart === 'number' ? v.runStart : null, lastSeen: v.lastSeen };
  } catch {
    return null;
  }
};

const writeStoredTimer = (entryId: string, value: StoredTimer) => {
  try {
    localStorage.setItem(TIMER_STORAGE_PREFIX + entryId, JSON.stringify(value));
  } catch {
    // penyimpanan lokal tidak tersedia — timer tetap jalan, hanya tidak bisa dilanjutkan setelah refresh
  }
};

const totalSecondsOf = (base: number, runStart: number | null): number =>
  base + (runStart === null ? 0 : Math.max(0, Math.floor((Date.now() - runStart) / 1000)));

const restoreTimer = (entryId: string, savedSeconds: number, now: number = Date.now()): RestoredTimer => {
  const stored = readStoredTimer(entryId);
  if (!stored) return { base: savedSeconds, runStart: null, resumed: false, expired: false };
  if (stored.runStart === null) {
    return { base: Math.max(stored.base, savedSeconds), runStart: null, resumed: false, expired: false };
  }
  // Timer masih berstatus "berjalan" saat halaman ditutup / dimuat ulang.
  if (now - stored.lastSeen <= RESUME_WINDOW_MS) {
    const total = Math.max(stored.base + Math.max(0, Math.floor((now - stored.runStart) / 1000)), savedSeconds);
    return { base: total, runStart: now, resumed: true, expired: false };
  }
  const total = Math.max(stored.base + Math.max(0, Math.floor((stored.lastSeen - stored.runStart) / 1000)), savedSeconds);
  return { base: total, runStart: null, resumed: false, expired: true };
};

interface HubstaffViewProps {
  onNavigate?: (menu: SidebarMenuId) => void;
}

export const HubstaffView: React.FC<HubstaffViewProps> = ({ onNavigate }) => {
  const { currentUser, getCurrentEntry, doAbsenPagi, updateHubstaffStats, showToast, hubstaffSettings, refreshAll, entriesLoading, lastSyncAt } = useApp();
  const entry = getCurrentEntry();

  // Komponen ini kini tetap terpasang sepanjang sesi kerja (lihat App.tsx), jadi efek/interval
  // di bawah harus selalu memanggil versi TERBARU fungsi penyimpan, bukan salinan usang.
  const updateStatsRef = React.useRef(updateHubstaffStats);
  updateStatsRef.current = updateHubstaffStats;
  // Pengaturan dari HRD dibaca lewat ref supaya perubahan berlaku tanpa memulai ulang timer.
  const hsRef = React.useRef(hubstaffSettings);
  hsRef.current = hubstaffSettings;
  const activityOn = isDesktopApp && isFeatureEnabledForDivision(hubstaffSettings, 'activity', currentUser.division);
  const targetSeconds = hubstaffSettings.targetHoursPerDay * 3600;

  // Status kelengkapan persiapan kerja
  const isAbsenPagiDone = !!entry.absenPagi;
  const isAbsenSiangDone = !!entry.absenSiang;
  const isTodoListDone = entry.todos.length > 0;
  const isReadyForHubstaff = isAbsenPagiDone && isTodoListDone;
  const showInstallBanner = !isDesktopApp && (REQUIRE_DESKTOP_FOR_TRACKING || !!DESKTOP_DOWNLOAD_URL);

  // Sumber kebenaran total waktu tracking adalah entry.hubstaffSeconds di Firebase (per akun,
  // per TANGGAL — jadi otomatis "reset" tiap hari karena entry-nya sendiri per-tanggal, dan
  // otomatis TERSINKRON ke semua perangkat sehingga bisa dilihat lagi lewat Riwayat Absen).
  const initRef = React.useRef<RestoredTimer | null>(null);
  if (initRef.current === null) {
    initRef.current = restoreTimer(entry.id, entry.hubstaffSeconds || 0);
  }
  const init = initRef.current;

  // baseRef = total detik sampai awal sesi jalan saat ini; runStartRef = jam dinding saat sesi
  // jalan dimulai (null kalau sedang jeda). Total saat ini = base + selisih jam dinding.
  const baseRef = React.useRef(init.base);
  const runStartRef = React.useRef<number | null>(init.runStart);
  const [isTracking, setIsTracking] = useState(init.runStart !== null);
  const [trackedSeconds, setTrackedSeconds] = useState(init.base);
  const [showLaunchModal, setShowLaunchModal] = useState<string | null>(null);

  // Tangkap layar acak selama timer berjalan (hanya aplikasi desktop + sudah dikonfigurasi HRD).
  const screenshotOn = isScreenshotConfigured(hubstaffSettings) && isFeatureEnabledForDivision(hubstaffSettings, 'screenshot', currentUser.division);
  const urlTrackingOn = isFeatureEnabledForDivision(hubstaffSettings, 'urlTracking', currentUser.division);
  // Rincian aktivitas (timeline per blok & aplikasi yang dipakai), ditampilkan ke HRD/koordinator
  // lewat Monitor Hubstaff. Berjalan independen dari tangkap layar.
  useActivityDetail({
    active: isTracking && activityOn,
    userId: currentUser.id,
    date: entry.date,
    idleThresholdSeconds: hubstaffSettings.idleThresholdSeconds,
  });

  const shots = useScreenshotCapture({
    active: isTracking && isDesktopApp && screenshotOn,
    settings: hubstaffSettings,
    user: { id: currentUser.id, name: currentUser.name },
    date: entry.date,
    notify: (m) => showToast(m, 'info'),
    getActivity: () => takeActivitySample(),
  });

  const entryIdRef = React.useRef(entry.id);
  const prevAbsenSiangRef = React.useRef(isAbsenSiangDone);
  const noticeShownRef = React.useRef(false);

  const getTotalNow = () => totalSecondsOf(baseRef.current, runStartRef.current);
  const persistTimer = () =>
    writeStoredTimer(entryIdRef.current, {
      base: baseRef.current,
      runStart: runStartRef.current,
      lastSeen: Date.now(),
    });

  // ---- Tingkat aktivitas (hanya terukur di aplikasi desktop, lewat idle time sistem operasi) ----
  // Disimpan terpisah dari timer supaya logika timer yang sudah ada tidak tersentuh.
  const activityKey = () => `wfa_hubstaff_activity_${entryIdRef.current}`;
  const readActivity = (savedActive: number, savedIdle: number, savedPauses: number) => {
    let a = savedActive, i = savedIdle, p = savedPauses;
    try {
      const v = JSON.parse(localStorage.getItem(activityKey()) || 'null');
      if (v) { a = Math.max(a, v.active || 0); i = Math.max(i, v.idle || 0); p = Math.max(p, v.pauses || 0); }
    } catch { /* abaikan */ }
    return { active: a, idle: i, pauses: p };
  };
  const actRef = React.useRef({ active: 0, idle: 0, pauses: 0 });
  const actInitRef = React.useRef(false);
  if (!actInitRef.current) {
    actInitRef.current = true;
    actRef.current = readActivity(entry.hubstaffActiveSeconds || 0, entry.hubstaffIdleSeconds || 0, entry.hubstaffAutoPauseCount || 0);
  }
  const idleNowRef = React.useRef(false);
  // Persentase aktivitas sejak tangkapan layar sebelumnya (dicatat bersama gambar, seperti Hubstaff).
  const shotSnapRef = React.useRef({ active: actRef.current.active, idle: actRef.current.idle });
  const takeActivitySample = (): number | null => {
    const a = actRef.current;
    const dA = Math.max(0, a.active - shotSnapRef.current.active);
    const dI = Math.max(0, a.idle - shotSnapRef.current.idle);
    shotSnapRef.current = { active: a.active, idle: a.idle };
    if (!isFeatureEnabledForDivision(hsRef.current, 'activity', currentUser.division) || !isDesktopApp || dA + dI <= 0) return null;
    return Math.round((dA / (dA + dI)) * 100);
  };
  const lastPollRef = React.useRef(Date.now());
  const promptShownAtRef = React.useRef<number | null>(null);
  const [activity, setActivity] = useState({ active: actRef.current.active, idle: actRef.current.idle });
  const [idlePrompt, setIdlePrompt] = useState<{ remaining: number } | null>(null);
  // true = timer sedang dijeda OLEH sistem karena idle (bukan dijeda manual) -> boleh lanjut otomatis
  const [autoPaused, setAutoPaused] = useState(false);

  const persistActivity = () => {
    try {
      localStorage.setItem(activityKey(), JSON.stringify(actRef.current));
    } catch { /* abaikan */ }
  };

  /** Kirim status terbaru ke Firebase — juga berfungsi sebagai heartbeat untuk monitoring. */
  // Heartbeat RINGAN ke node `trackingStatus/{uid}` milik sendiri. Isinya sudah LENGKAP (durasi,
  // aktivitas, idle) karena Monitor Hubstaff membaca node ini secara langsung (live) — bukan dari
  // `entries`. Node ini hanya didengarkan oleh halaman Monitor, jadi tidak membebani karyawan lain.
  const trackActivity = () => isDesktopApp && isFeatureEnabledForDivision(hsRef.current, 'activity', currentUser.division);
  const pushHeartbeat = (tracking: boolean, total: number = getTotalNow()) => {
    fbSet(dbRef(`trackingStatus/${currentUser.id}`), {
      tracking,
      lastBeat: Date.now(),
      date: entry.date,
      urlTrackingOn: tracking && urlTrackingOn,
      seconds: total,
      activityTracked: trackActivity(),
      active: trackActivity() ? actRef.current.active : 0,
      idle: trackActivity() ? actRef.current.idle : 0,
      idleNow: trackActivity() && tracking ? idleNowRef.current : false,
      pauses: trackActivity() ? actRef.current.pauses : 0,
    }).catch(() => undefined);
  };

  // `entries` tetap diperbarui (untuk riwayat & performa), tapi TIDAK lagi dibroadcast ke semua
  // perangkat karena entries diambil sesuai kebutuhan, bukan listener terbuka.
  const pushStats = (tracking: boolean, total: number = getTotalNow()) => {
    pushHeartbeat(tracking, total);
    updateStatsRef.current({
      hubstaffSeconds: total,
      hubstaffTracking: tracking,
      hubstaffLastBeat: Date.now(),
      ...(trackActivity()
        ? {
            hubstaffActivityTracked: true,
            hubstaffActiveSeconds: actRef.current.active,
            hubstaffIdleSeconds: actRef.current.idle,
            hubstaffIdleNow: tracking ? idleNowRef.current : false,
            hubstaffAutoPauseCount: actRef.current.pauses,
          }
        : {}),
    });
  };

  const startRunning = () => {
    setAutoPaused(false);
    baseRef.current = getTotalNow();
    runStartRef.current = Date.now();
    persistTimer();
    setTrackedSeconds(baseRef.current);
    lastPollRef.current = Date.now();
    idleNowRef.current = false;
    setIsTracking(true);
  };

  const stopRunning = (): number => {
    setAutoPaused(false);
    const total = getTotalNow();
    baseRef.current = total;
    runStartRef.current = null;
    persistTimer();
    setTrackedSeconds(total);
    setIsTracking(false);
    return total;
  };

  // Kalau entry berganti (hari baru / user lain), muat ulang total tersimpan & hentikan timer.
  useEffect(() => {
    if (entryIdRef.current !== entry.id) {
      entryIdRef.current = entry.id;
      baseRef.current = entry.hubstaffSeconds || 0;
      runStartRef.current = null;
      setTrackedSeconds(entry.hubstaffSeconds || 0);
      setIsTracking(false);
      actRef.current = readActivity(entry.hubstaffActiveSeconds || 0, entry.hubstaffIdleSeconds || 0, entry.hubstaffAutoPauseCount || 0);
      setActivity({ active: actRef.current.active, idle: actRef.current.idle });
      setIdlePrompt(null);
      setAutoPaused(false);
      promptShownAtRef.current = null;
    } else if (runStartRef.current === null && (entry.hubstaffSeconds || 0) > baseRef.current) {
      // Data di Firebase lebih besar (mis. dari perangkat lain / baru selesai dimuat) — ikuti.
      baseRef.current = entry.hubstaffSeconds || 0;
      setTrackedSeconds(baseRef.current);
    }
  }, [entry.id, entry.hubstaffSeconds]);

  // Pemberitahuan sekali saat halaman dimuat: timer dilanjutkan / dihentikan otomatis.
  useEffect(() => {
    if (noticeShownRef.current) return;
    noticeShownRef.current = true;
    if (init.expired) {
      persistTimer();
      pushStats(false, baseRef.current);
      showToast('Timer dihentikan otomatis karena aplikasi tidak aktif lebih dari 2 menit. Waktu dihitung sampai terakhir aktif.', 'info');
    } else if (init.resumed) {
      persistTimer();
      pushStats(true);
      showToast('Timer dilanjutkan otomatis setelah halaman dimuat ulang.', 'info');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Perbarui tampilan tiap detik saat tracking aktif. Nilainya dihitung dari jam dinding, jadi
  // tetap benar walau detak timer diperlambat; dihitung ulang juga saat window kembali terlihat.
  useEffect(() => {
    if (!isTracking) return;
    const tick = () => {
      setTrackedSeconds(getTotalNow());
      persistTimer();
    };
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    const interval = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);
    window.addEventListener('pagehide', persistTimer);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
      window.removeEventListener('pagehide', persistTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTracking]);

  // Sinkron berkala ke Firebase selagi tracking aktif, supaya progress tidak hilang kalau tab
  // tertutup mendadak. Tulisan ke `entries` tidak lagi dikirim ke perangkat lain (tidak ada
  // listener entries), jadi interval ini aman. Status LIVE untuk Monitor lewat heartbeat di bawah.
  useEffect(() => {
    if (!isTracking) return;
    const syncInterval = setInterval(() => {
      pushStats(true);
    }, 60000);
    // Heartbeat ringan terpisah, boleh lebih sering (tidak menambah beban siaran ke semua
    // client) — menjaga status "Terakhir Terlihat" & "Tidak Terpantau" di Monitor Hubstaff
    // tetap akurat meski update `entries` yang berat di atas sudah diperlambat jadi 60 detik.
    const heartbeatInterval = setInterval(() => {
      pushHeartbeat(true);
    }, 20000);
    return () => {
      clearInterval(syncInterval);
      clearInterval(heartbeatInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTracking]);

  // OTOMATIS BERHENTI begitu Absen Siang baru saja tercatat (karyawan dianggap selesai
  // sesi kerja WFA hari itu) — sekaligus simpan total akhirnya ke Firebase.
  useEffect(() => {
    if (!prevAbsenSiangRef.current && isAbsenSiangDone && isTracking) {
      pushStats(false, stopRunning());
      showToast('Absen siang tercatat — timer Hubstaff otomatis dihentikan.', 'info');
    }
    prevAbsenSiangRef.current = isAbsenSiangDone;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAbsenSiangDone]);

  // Simpan progress terakhir saat halaman ditinggalkan (best-effort). Meninggalkan halaman
  // Hubstaff = timer jeda (perilaku yang sudah ada); penanda "berhenti" ditulis supaya tidak
  // terbaca sebagai timer yang masih berjalan saat halaman dibuka lagi.
  useEffect(() => {
    return () => {
      const total = getTotalNow();
      writeStoredTimer(entryIdRef.current, { base: total, runStart: null, lastSeen: Date.now() });
      persistActivity();
      pushStats(false, total);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Jeda otomatis karena idle: buang waktu menganggur (sepanjang `gap` detik) dari total. */
  const autoPauseForIdle = (gap: number) => {
    // Mode "hitung sebagai idle" (bawaan): menit idle tetap ada di total & tercatat sebagai idle.
    // Mode lama: menit idle dibuang dari total, idle & aktif disesuaikan.
    const keepIdle = hsRef.current.keepIdleOnAutoPause !== false;
    const total = keepIdle ? getTotalNow() : Math.max(0, getTotalNow() - gap);
    baseRef.current = total;
    runStartRef.current = null;
    persistTimer();
    setTrackedSeconds(total);
    setIsTracking(false);
    setAutoPaused(true);
    const a = actRef.current;
    const threshold = hsRef.current.idleThresholdSeconds;
    if (!keepIdle) {
      a.idle = Math.max(0, a.idle - Math.max(0, gap - threshold));
      a.active = Math.max(0, a.active - Math.min(gap, threshold));
    }
    a.pauses += 1;
    setActivity({ active: a.active, idle: a.idle });
    persistActivity();
    promptShownAtRef.current = null;
    setIdlePrompt(null);
    pushStats(false, total);
    const resumeNote = hsRef.current.autoResumeOnActivity !== false ? ' Timer lanjut sendiri saat Anda bergerak lagi.' : ' Tekan Mulai untuk melanjutkan.';
    showToast(
      keepIdle
        ? `Timer dijeda otomatis: tidak ada aktivitas. ${Math.round(gap / 60)} menit tercatat sebagai idle.${resumeNote}`
        : `Timer dijeda otomatis: tidak ada aktivitas. ${Math.round(gap / 60)} menit idle tidak dihitung.${resumeNote}`,
      'warning'
    );
  };

  // Setelah dijeda otomatis: pantau input; begitu ada gerakan keyboard/mouse, timer lanjut sendiri.
  useEffect(() => {
    if (!autoPaused || isTracking || !activityOn || hsRef.current.autoResumeOnActivity === false) return;
    let cancelled = false;
    const id = setInterval(async () => {
      const idleSecs = await getSystemIdleSeconds();
      if (cancelled || idleSecs === null || idleSecs >= 3) return; // belum ada gerakan baru
      if (isAbsenSiangDone || !isReadyForHubstaff) {
        setAutoPaused(false);
        return;
      }
      startRunning(); // juga membersihkan penanda autoPaused
      pushStats(true);
      showToast('Aktivitas terdeteksi lagi — timer dilanjutkan otomatis.', 'success');
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPaused, isTracking, activityOn, isAbsenSiangDone]);

  // Hitung aktif vs idle dari input sistem operasi (aplikasi mana pun), tiap detik saat tracking.
  useEffect(() => {
    if (!isTracking || !activityOn) return;
    lastPollRef.current = Date.now();
    let cancelled = false;
    const poll = async () => {
      const now = Date.now();
      const dt = Math.max(0, Math.min(Math.round((now - lastPollRef.current) / 1000), 600));
      lastPollRef.current = now;
      const idleSecs = await getSystemIdleSeconds();
      if (cancelled || idleSecs === null) return;
      const a = actRef.current;
      const cfg = hsRef.current;
      const isIdle = idleSecs >= cfg.idleThresholdSeconds;
      idleNowRef.current = isIdle;
      if (isIdle) a.idle += dt; else a.active += dt;
      setActivity({ active: a.active, idle: a.idle });
      persistActivity();

      if (cfg.autoPauseOnIdle && idleSecs >= cfg.idlePromptMinutes * 60) {
        if (promptShownAtRef.current === null) promptShownAtRef.current = now;
        const remaining = cfg.idleGraceSeconds - Math.floor((now - promptShownAtRef.current) / 1000);
        if (remaining <= 0) autoPauseForIdle(idleSecs);
        else setIdlePrompt({ remaining });
      } else if (promptShownAtRef.current !== null) {
        promptShownAtRef.current = null;
        setIdlePrompt(null);
      }
    };
    const id = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTracking, activityOn]);

  const formatTrackingTime = formatClock;
  const activityTotal = activity.active + activity.idle;
  const activityPercent = activityTotal > 0 ? Math.round((activity.active / activityTotal) * 100) : null;

  const handleToggleTimer = () => {
    if (!isReadyForHubstaff) {
      showToast('Selesaikan absen pagi dan to-do list terlebih dahulu!', 'warning');
      return;
    }
    if (!isTracking && REQUIRE_DESKTOP_FOR_TRACKING && !isDesktopApp) {
      showToast('Install aplikasi desktop WFA System untuk memulai tracking.', 'warning');
      return;
    }
    if (!isTracking) {
      startRunning();
      pushStats(true);
      showToast('Timer Hubstaff dimulai! Time tracking aktif.', 'success');
    } else {
      pushStats(false, stopRunning());
      showToast('Timer Hubstaff dijeda sementara.', 'info');
    }
  };

  const handleOpenDesktop = () => {
    if (!isReadyForHubstaff) {
      showToast('Hubstaff terkunci. Silakan penuhi status persiapan kerja.', 'warning');
      return;
    }
    if (isDesktopApp) {
      showToast('Anda sudah memakai aplikasi desktop WFA System.', 'info');
      return;
    }
    // Coba buka protokol hubstaff URI scheme jika terinstall di desktop
    window.location.href = 'hubstaff://';
    setShowLaunchModal('desktop');
  };

  const handleOpenMobile = () => {
    if (!isReadyForHubstaff) {
      showToast('Hubstaff terkunci. Silakan penuhi status persiapan kerja.', 'warning');
      return;
    }
    setShowLaunchModal('mobile');
  };

  const handleQuickAbsenPagi = () => {
    if (entry.absenPagi) {
      showToast(`Anda sudah absen pagi pukul ${entry.absenPagi.time}. Mengalihkan ke To-Do List...`, 'info');
      setTimeout(() => onNavigate?.('todo-saya'), 800);
      return;
    }
    doAbsenPagi('Rumah (WFA)', 'Absen cepat via halaman persiapan Hubstaff');
    showToast('Absen pagi berhasil dicatat! Mengalihkan ke To-Do List...', 'success');
    setTimeout(() => {
      onNavigate?.('todo-saya');
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <RefreshBar onRefresh={refreshAll} loading={entriesLoading} updatedAt={lastSyncAt} />
      {/* Title & Subtitle Persis Screenshot */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Hubstaff</h1>
        <p className="text-xs text-slate-500 mt-1">Aktifkan time tracking sebelum mulai bekerja</p>
      </div>

      {/* Transparansi: apa saja yang dipantau (sesuai Pengaturan Hubstaff dari HRD) */}
      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 text-xs text-slate-600 space-y-1.5">
        <div className="font-bold text-slate-800 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>Yang dipantau saat timer berjalan</span>
        </div>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Durasi time tracking harian.</li>
          {hubstaffSettings.featureActivity && (
            <li>
              Ada atau tidaknya aktivitas keyboard/mouse (lama waktu aktif dan idle saja &mdash; isi ketikan dan
              posisi kursor tidak direkam).
            </li>
          )}
          {screenshotOn && (
            <li>
              Tangkap layar {hubstaffSettings.screenshotCount}x setiap {hubstaffSettings.screenshotWindowMinutes} menit
              pada waktu acak{hubstaffSettings.screenshotBlur ? ' (diburamkan)' : ''}
              {isDesktopApp ? '.' : ' (hanya lewat aplikasi desktop).'}
            </li>
          )}
          {urlTrackingOn && (
            <li>Alamat situs yang dibuka di browser (Chrome/Edge), lewat ekstensi yang Anda pasang sendiri.</li>
          )}
        </ul>
      </div>

      {urlTrackingOn && <UrlTrackingPairingCard />}

      {/* CARD 1: STATUS PERSIAPAN KERJA */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <FileText className="w-4 h-4 text-blue-600" />
          <span>Status Persiapan Kerja</span>
        </div>

        <div className="space-y-3">
          {/* Item 1: Status Absen Pagi */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white hover:border-slate-200 transition-all">
            <div className="flex items-center gap-3.5">
              {isAbsenPagiDone ? (
                <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-500 flex items-center justify-center text-emerald-600 shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-slate-300 shrink-0" />
              )}
              <div>
                <div className="text-xs font-bold text-slate-900">
                  {isAbsenPagiDone ? 'Sudah Absen Pagi' : 'Belum Absen Pagi'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {isAbsenPagiDone
                    ? `Tercatat pukul ${entry.absenPagi?.time} • ${entry.absenPagi?.location}`
                    : 'Absen dulu sebelum mulai'}
                </div>
              </div>
            </div>

            {isAbsenPagiDone ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Sudah Absen</span>
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleQuickAbsenPagi}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors"
                >
                  Absen Sekarang
                </button>
              </div>
            )}
          </div>

          {/* Item 2: Status To-Do List */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white hover:border-slate-200 transition-all">
            <div className="flex items-center gap-3.5">
              {isTodoListDone ? (
                <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-500 flex items-center justify-center text-emerald-600 shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-slate-300 shrink-0" />
              )}
              <div>
                <div className="text-xs font-bold text-slate-900">
                  {isTodoListDone ? 'Sudah Isi To-Do List' : 'Belum Isi To-Do List'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {isTodoListDone
                    ? `${entry.todos.length} tugas hari ini telah dibuat dan siap dikerjakan`
                    : 'Isi to-do list terlebih dahulu'}
                </div>
              </div>
            </div>

            {isTodoListDone ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Sudah Diisi ({entry.todos.length})</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate?.('todo-saya')}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors"
              >
                Isi To-Do
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CARD 2: BUKA HUBSTAFF */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Laptop className="w-4 h-4 text-blue-600" />
            <span>Buka Hubstaff</span>
          </div>

          {isReadyForHubstaff && (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-700">Hubstaff Siap Digunakan</span>
            </div>
          )}
        </div>

        {/* Banner Status Persyaratan */}
        {!isReadyForHubstaff ? (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Selesaikan absen pagi dan to-do list terlebih dahulu untuk mengaktifkan Hubstaff.</span>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Status Persiapan Lengkap! Absen pagi dan to-do list telah siap. Anda dapat meluncurkan time tracking Hubstaff sekarang.
              </span>
            </div>
            <button
              onClick={handleToggleTimer}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                isTracking
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
              }`}
            >
              {isTracking ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isTracking ? 'Jeda Timer' : 'Mulai Timer'}</span>
            </button>
          </div>
        )}

        {/* Anjuran / kewajiban install aplikasi desktop (hanya tampil saat dibuka lewat browser) */}
        {showInstallBanner && (
          <div className="p-5 rounded-xl border border-blue-200 bg-blue-50/60 space-y-3">
            <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
              <Laptop className="w-4 h-4" />
              <span>
                {REQUIRE_DESKTOP_FOR_TRACKING
                  ? 'Install aplikasi desktop untuk memulai tracking'
                  : 'Disarankan memakai aplikasi desktop WFA System'}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Anda sedang membuka WFA System lewat browser. Aplikasi desktop membuat time tracking
              lebih stabil selama Anda bekerja.
            </p>
            <ol className="text-xs text-slate-700 space-y-1 list-decimal list-inside">
              <li>Download dan install aplikasi WFA System</li>
              <li>Buka aplikasinya, login dengan akun yang sama</li>
              <li>Buka menu Hubstaff, lalu tekan Mulai</li>
            </ol>
            {DESKTOP_DOWNLOAD_URL ? (
              <a
                href={DESKTOP_DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download Aplikasi WFA System</span>
              </a>
            ) : (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 font-semibold text-xs">
                <Download className="w-3.5 h-3.5" />
                <span>Link download belum diatur. Hubungi HRD/IT.</span>
              </span>
            )}
          </div>
        )}

        {/* Interactive Hubstaff Live Tracking Panel (Ketika aktif) */}
        {isReadyForHubstaff && (
          <div className="p-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/70 to-sky-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-mono font-bold text-white shadow-sm ${
                isTracking ? 'bg-blue-600' : 'bg-slate-400'
              }`}>
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">Numeta &bull; {currentUser.division}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    isTracking ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {isTracking ? '● Tracking Aktif' : 'Dijeda'}
                  </span>
                </div>
                <div className="text-xl font-black font-mono text-slate-900 mt-0.5">
                  {formatTrackingTime(trackedSeconds)}
                </div>
                <p className="text-[11px] text-slate-500">
                  Target harian: 08:00:00 jam &bull; Aktivitas otomatis tercatat untuk rekap WFA
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleTimer}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
                  isTracking
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isTracking ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isTracking ? 'Stop / Istirahat' : 'Mulai Tracking Hubstaff'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tingkat aktivitas & progres target harian */}
        {isReadyForHubstaff && (
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1.5">
                <span>Progres target harian</span>
                <span>
                  {formatClock(trackedSeconds)} / {formatClock(targetSeconds)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (trackedSeconds / targetSeconds) * 100)}%` }}
                />
              </div>
            </div>
            {activityOn ? (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                  <div className="text-[10px] font-bold uppercase text-emerald-700">Aktivitas</div>
                  <div className="text-lg font-black text-emerald-800">
                    {activityPercent === null ? '—' : `${activityPercent}%`}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Waktu Aktif</div>
                  <div className="text-sm font-mono font-bold text-slate-800 mt-1">{formatClock(activity.active)}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                  <div className="text-[10px] font-bold uppercase text-amber-700">Waktu Idle</div>
                  <div className="text-sm font-mono font-bold text-amber-800 mt-1">{formatClock(activity.idle)}</div>
                </div>
              </div>
            ) : hubstaffSettings.featureActivity ? (
              <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  Tingkat aktivitas (aktif/idle) hanya terukur lewat aplikasi desktop WFA System. Tracking dari
                  browser hanya mencatat durasi.
                </span>
              </p>
            ) : null}
          </div>
        )}

        {isDesktopApp && screenshotOn && (
          <p className="text-[11px] text-slate-500">
            Tangkap layar: {shots.uploaded} terunggah
            {shots.pending > 0 ? ` • ${shots.pending} menunggu` : ''}
            {shots.failed > 0 ? ` • ${shots.failed} gagal` : ''}
            {shots.lastError ? ` — ${shots.lastError}` : ''}
          </p>
        )}

        {/* 2 Kotak Aplikasi Desktop & Mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Kotak Aplikasi Desktop */}
          <div className="border border-slate-200/80 rounded-2xl p-6 text-center space-y-4 bg-slate-50/40 hover:bg-slate-50/70 transition-colors">
            <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
              <Laptop className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Aplikasi Desktop</h3>
              <p className="text-xs text-slate-400 mt-0.5">Windows / Mac / Linux</p>
            </div>

            {!isReadyForHubstaff ? (
              <button
                type="button"
                disabled
                className="w-full max-w-xs mx-auto py-2.5 px-4 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Terkunci</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenDesktop}
                className="w-full max-w-xs mx-auto py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Buka di Desktop</span>
              </button>
            )}
          </div>

          {/* Kotak Aplikasi Mobile */}
          <div className="border border-slate-200/80 rounded-2xl p-6 text-center space-y-4 bg-slate-50/40 hover:bg-slate-50/70 transition-colors">
            <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Aplikasi Mobile</h3>
              <p className="text-xs text-slate-400 mt-0.5">Android / iOS</p>
            </div>

            {!isReadyForHubstaff ? (
              <button
                type="button"
                disabled
                className="w-full max-w-xs mx-auto py-2.5 px-4 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Terkunci</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenMobile}
                className="w-full max-w-xs mx-auto py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Buka di Mobile</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer Card 2: Buka Hubstaff di Browser */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="text-slate-400">ⓘ</span>
            <span>Jika aplikasi tidak terbuka otomatis, gunakan Hubstaff web:</span>
          </p>
          <a
            href="https://app.hubstaff.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all shadow-2xs"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            <span>Buka Hubstaff di Browser</span>
          </a>
        </div>
      </div>

      {/* CARD 3: CARA MENGGUNAKAN HUBSTAFF */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <HelpCircle className="w-4 h-4 text-blue-600" />
          <span>Cara Menggunakan Hubstaff</span>
        </div>

        <ol className="space-y-3.5 text-xs text-slate-700">
          <li className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
              1
            </span>
            <span className="leading-relaxed">Buka aplikasi Hubstaff di laptop atau HP Anda</span>
          </li>

          <li className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
              2
            </span>
            <span className="leading-relaxed">Pilih project / organisasi Numeta</span>
          </li>

          <li className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
              3
            </span>
            <span className="leading-relaxed">Mulai timer (tracking) sebelum mengerjakan to-do list</span>
          </li>

          <li className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
              4
            </span>
            <span className="leading-relaxed">Pastikan timer tetap berjalan selama jam kerja WFA berlangsung</span>
          </li>

          <li className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
              5
            </span>
            <span className="leading-relaxed">
              Hentikan timer saat istirahat siang (12:00 WIB) dan saat selesai kerja (17:00 WIB)
            </span>
          </li>
        </ol>
      </div>

      {/* Pertanyaan idle: masih bekerja? */}
      {idlePrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Masih bekerja?</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Tidak ada aktivitas keyboard/mouse selama beberapa menit. Timer akan dijeda otomatis dalam{' '}
                <span className="font-bold">{idlePrompt.remaining} detik</span>
                {hubstaffSettings.autoResumeOnActivity !== false ? ' dan lanjut sendiri saat Anda bergerak lagi.' : '.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                promptShownAtRef.current = null;
                setIdlePrompt(null);
              }}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
            >
              Ya, saya masih bekerja
            </button>
          </div>
        </div>
      )}

      {/* Modal Dialog Peluncuran Hubstaff Desktop/Mobile */}
      {showLaunchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {showLaunchModal === 'desktop' ? (
                  <Laptop className="w-5 h-5 text-blue-600" />
                ) : (
                  <Smartphone className="w-5 h-5 text-blue-600" />
                )}
                <span>
                  {showLaunchModal === 'desktop' ? 'Membuka Hubstaff Desktop' : 'Hubstaff Mobile'}
                </span>
              </h3>
              <button
                onClick={() => setShowLaunchModal(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p>
                Permintaan peluncuran aplikasi Hubstaff telah dikirim ke sistem operasi Anda.
              </p>
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-blue-900">
                <div className="font-bold">Organisasi Terhubung:</div>
                <div>Numeta &bull; Divisi {currentUser.division}</div>
                <div className="mt-1 text-[11px] text-blue-700">Akun: {currentUser.email}</div>
              </div>
              <p className="text-[11px] text-slate-500">
                Jika aplikasi belum terinstall, Anda dapat mengunduhnya langsung dari situs resmi Hubstaff atau mengakses via web browser.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <a
                href="https://app.hubstaff.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka Hubstaff Web</span>
              </a>
              <button
                onClick={() => setShowLaunchModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
