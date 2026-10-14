import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { HubstaffSettings } from '../types';
import { dbRef, set, serverTimestamp } from './firebase';
import { uploadScreenshot } from './screenshotClient';

interface Args {
  active: boolean;
  settings: HubstaffSettings;
  user: { id: string; name: string };
  date: string;
  notify: (msg: string) => void;
  /** Persentase aktivitas sejak panggilan sebelumnya (null = tidak terukur) */
  getActivity?: () => number | null;
}

interface Pending {
  image: string;
  ts: number;
  date: string;
  attempts: number;
  activityPct: number | null;
}

export interface CaptureStatus {
  uploaded: number;
  failed: number;
  pending: number;
  lastError: string | null;
}

const MAX_QUEUE = 8; // gambar tertunda hanya di memori; lebih dari ini, yang terlama dibuang
const MAX_ATTEMPTS = 5;
const safeKey = (s: string) => s.replace(/[.#$\[\]/]/g, '_');

/**
 * Mengambil tangkap layar secara acak selama `active`: `screenshotCount` kali di setiap
 * rentang `screenshotWindowMinutes` menit. Gambar diunggah ke Drive (Apps Script); Firebase
 * hanya menerima catatan kecil (fileId + waktu).
 */
export function useScreenshotCapture(args: Args): CaptureStatus {
  const argsRef = useRef(args);
  argsRef.current = args;
  const queueRef = useRef<Pending[]>([]);
  const flushingRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<CaptureStatus>({ uploaded: 0, failed: 0, pending: 0, lastError: null });
  const statusRef = useRef(status);
  const update = (patch: Partial<CaptureStatus>) => {
    statusRef.current = { ...statusRef.current, ...patch, pending: queueRef.current.length };
    setStatus(statusRef.current);
  };

  const flush = async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const item = queueRef.current[0];
        const { settings, user } = argsRef.current;
        try {
          const fileId = await uploadScreenshot(settings, {
            userId: user.id,
            userName: user.name,
            date: item.date,
            ts: item.ts,
            image: item.image,
          });
          await set(dbRef(`screenshots/${item.date}/${safeKey(user.id)}/${item.ts}`), {
            ts: item.ts,
            fileId,
            blurred: settings.screenshotBlur,
            serverTs: serverTimestamp(),
            ...(item.activityPct !== null ? { activityPct: item.activityPct } : {}),
          });
          queueRef.current.shift();
          update({ uploaded: statusRef.current.uploaded + 1, lastError: null });
        } catch (e) {
          item.attempts += 1;
          const msg = e instanceof Error ? e.message : String(e);
          if (item.attempts >= MAX_ATTEMPTS) {
            queueRef.current.shift();
            update({ failed: statusRef.current.failed + 1, lastError: msg });
            continue;
          }
          update({ lastError: msg });
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(flush, 30_000 * item.attempts);
          break;
        }
      }
    } finally {
      flushingRef.current = false;
      update({});
    }
  };

  const captureOnce = async () => {
    const { settings, date, notify } = argsRef.current;
    try {
      const image = await invoke<string>('capture_screenshot', {
        maxWidth: settings.screenshotMaxWidth,
        quality: settings.screenshotQuality,
        blur: settings.screenshotBlur,
      });
      queueRef.current.push({ image, ts: Date.now(), date, attempts: 0, activityPct: argsRef.current.getActivity?.() ?? null });
      if (queueRef.current.length > MAX_QUEUE) {
        queueRef.current.shift();
        update({ failed: statusRef.current.failed + 1 });
      }
      update({});
      if (settings.screenshotNotifyEmployee) notify('Tangkap layar diambil.');
      void flush();
    } catch (e) {
      update({ lastError: `Gagal mengambil layar: ${e instanceof Error ? e.message : String(e)}` });
    }
  };

  useEffect(() => {
    if (!args.active) return;
    let planned: number[] = [];
    let windowEnd = 0;
    let busy = false;
    const plan = () => {
      const s = argsRef.current.settings;
      const start = Date.now();
      const len = Math.max(1, s.screenshotWindowMinutes) * 60_000;
      planned = Array.from({ length: Math.max(1, s.screenshotCount) }, () => start + Math.random() * len).sort((a, b) => a - b);
      windowEnd = start + len;
    };
    plan();
    const tick = async () => {
      const now = Date.now();
      if (now >= windowEnd) plan();
      if (busy || planned.length === 0 || planned[0] > now) return;
      planned.shift();
      busy = true;
      try {
        await captureOnce();
      } finally {
        busy = false;
      }
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.active]);

  useEffect(() => () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); }, []);

  return status;
}
