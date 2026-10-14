import { useEffect, useRef, useState } from 'react';
import { getActiveWindowInfo } from './activeWindow';
import { takeInputCounts } from './inputCounts';
import { getSystemIdleSeconds, isDesktopApp } from './systemIdle';
import { dbRef, set as fbSet, get as fbGet } from './firebase';
const DEFAULT_IDLE_THRESHOLD_SECONDS = 60;

interface Args {
  active: boolean; // isTracking && featureActivity diizinkan untuk divisi ini
  userId: string;
  date: string;
  idleThresholdSeconds?: number;
}

const BLOCK_MS = 10 * 60_000; // rincian per 10 menit, sama seperti pengelompokan tangkap layar
const POLL_MS = 5000;
const safeKey = (s: string) => s.replace(/[.#$[\]/]/g, '_').slice(0, 80);

/**
 * Mencatat rincian aktivitas untuk ditampilkan HRD/koordinator:
 * 1. Timeline per blok 10 menit (aktif/idle) -> activityTimeline/{date}/{userId}/{blockStart}
 * 2. Total waktu per aplikasi yang dipakai -> appActivity/{date}/{userId}/{appKey}
 * Keduanya hanya jalan di aplikasi desktop (butuh akses sistem), dan hanya saat parameter
 * `active` true (timer berjalan & fitur aktivitas diizinkan untuk divisi karyawan ini).
 */
export function useActivityDetail({ active, userId, date, idleThresholdSeconds = DEFAULT_IDLE_THRESHOLD_SECONDS }: Args) {
  const blockRef = useRef({ start: 0, activeSeconds: 0, idleSeconds: 0, apps: new Map<string, number>(), keyboardEvents: 0, mouseEvents: 0, keyboardSeconds: 0, mouseSeconds: 0 });
  const appTotalsRef = useRef(new Map<string, { seconds: number; lastTitle: string }>());
  const lastPollRef = useRef(Date.now());
  const [, force] = useState(0);

  const newBlock = (start: number) => {
    blockRef.current = { start, activeSeconds: 0, idleSeconds: 0, apps: new Map(), keyboardEvents: 0, mouseEvents: 0, keyboardSeconds: 0, mouseSeconds: 0 };
  };

  const flushBlock = async () => {
    const b = blockRef.current;
    if (b.activeSeconds + b.idleSeconds <= 0) return;
    let topApp: string | undefined;
    let topSeconds = 0;
    b.apps.forEach((secs, app) => {
      if (secs > topSeconds) {
        topSeconds = secs;
        topApp = app;
      }
    });
    try {
      await fbSet(dbRef(`activityTimeline/${date}/${safeKey(userId)}/${b.start}`), {
        blockStart: b.start,
        activeSeconds: Math.round(b.activeSeconds),
        idleSeconds: Math.round(b.idleSeconds),
        ...(topApp ? { topApp } : {}),
        ...(b.keyboardEvents + b.mouseEvents > 0
          ? {
              keyboardEvents: Math.round(b.keyboardEvents),
              mouseEvents: Math.round(b.mouseEvents),
              keyboardSeconds: Math.round(b.keyboardSeconds),
              mouseSeconds: Math.round(b.mouseSeconds),
            }
          : {}),
      });
    } catch {
      // koneksi putus sesaat: blok ini dilewati, blok berikutnya tetap jalan
    }
  };

  const flushAppTotals = async () => {
    const entries = Array.from(appTotalsRef.current.entries());
    if (entries.length === 0) return;
    await Promise.all(
      entries.map(([app, v]) =>
        fbSet(dbRef(`appActivity/${date}/${safeKey(userId)}/${safeKey(app)}`), {
          appName: app,
          seconds: Math.round(v.seconds),
          lastTitle: v.lastTitle.slice(0, 150),
          lastSeen: Date.now(),
        }).catch(() => undefined)
      )
    );
  };

  useEffect(() => {
    if (!active || !isDesktopApp) return;
    let cancelled = false;
    const curBlockStart = Math.floor(Date.now() / BLOCK_MS) * BLOCK_MS;
    newBlock(curBlockStart);
    appTotalsRef.current = new Map();
    lastPollRef.current = Date.now();

    // Timer bisa dijeda & dilanjutkan berkali-kali dalam satu hari. Baca dulu total yang
    // sudah tersimpan (dari sesi sebelumnya) supaya flush berikutnya MENAMBAH, bukan menimpa
    // jadi lebih kecil. Ini sekali saja saat mulai, bukan tiap flush (hemat pembacaan).
    (async () => {
      try {
        const [totalsSnap, blockSnap] = await Promise.all([
          fbGet(dbRef(`appActivity/${date}/${safeKey(userId)}`)),
          fbGet(dbRef(`activityTimeline/${date}/${safeKey(userId)}/${curBlockStart}`)),
        ]);
        if (cancelled) return;
        const totalsVal = (totalsSnap.val() || {}) as Record<string, { appName: string; seconds: number; lastTitle?: string }>;
        Object.values(totalsVal).forEach((v) => {
          appTotalsRef.current.set(v.appName, { seconds: v.seconds || 0, lastTitle: v.lastTitle || '' });
        });
        const blockVal = blockSnap.val() as
          | { activeSeconds?: number; idleSeconds?: number; keyboardEvents?: number; mouseEvents?: number; keyboardSeconds?: number; mouseSeconds?: number }
          | null;
        if (blockVal && blockRef.current.start === curBlockStart) {
          blockRef.current.activeSeconds = blockVal.activeSeconds || 0;
          blockRef.current.idleSeconds = blockVal.idleSeconds || 0;
          blockRef.current.keyboardEvents = blockVal.keyboardEvents || 0;
          blockRef.current.mouseEvents = blockVal.mouseEvents || 0;
          blockRef.current.keyboardSeconds = blockVal.keyboardSeconds || 0;
          blockRef.current.mouseSeconds = blockVal.mouseSeconds || 0;
        }
      } catch {
        // gagal baca -> lanjut dari 0 untuk sesi ini; lebih baik sedikit kurang akurat
        // daripada macet menunggu jaringan
      }
    })();

    const poll = async () => {
      if (cancelled) return;
      const now = Date.now();
      const dt = Math.max(0, Math.min((now - lastPollRef.current) / 1000, 60));
      lastPollRef.current = now;

      const blockStart = Math.floor(now / BLOCK_MS) * BLOCK_MS;
      if (blockStart !== blockRef.current.start) {
        await flushBlock();
        newBlock(blockStart);
      }

      const idleSecs = await getSystemIdleSeconds();
      if (idleSecs === null) return;
      const b = blockRef.current;
      if (idleSecs >= idleThresholdSeconds) {
        b.idleSeconds += dt;
        return; // idle: tidak perlu cek aplikasi aktif
      }
      b.activeSeconds += dt;

      const counts = await takeInputCounts();
      if (counts) {
        b.keyboardEvents += counts.keyboard;
        b.mouseEvents += counts.mouse;
        // Hubstaff: % Keyboard / % Mouse = porsi WAKTU yang ada input jenis itu (bukan jumlah ketukan)
        if (counts.keyboard > 0) b.keyboardSeconds += dt;
        if (counts.mouse > 0) b.mouseSeconds += dt;
      }

      const win = await getActiveWindowInfo();
      if (win && win.appName) {
        b.apps.set(win.appName, (b.apps.get(win.appName) || 0) + dt);
        const totals = appTotalsRef.current;
        const cur = totals.get(win.appName) || { seconds: 0, lastTitle: '' };
        cur.seconds += dt;
        cur.lastTitle = win.title || cur.lastTitle;
        totals.set(win.appName, cur);
      }
      force((x) => x + 1);
    };

    const id = setInterval(poll, POLL_MS);
    const flushId = setInterval(flushAppTotals, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearInterval(flushId);
      flushBlock();
      flushAppTotals();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, userId, date, idleThresholdSeconds]);
}
