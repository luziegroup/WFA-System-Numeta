import { useEffect, useRef } from 'react';
import { isDesktopApp } from './systemIdle';

/**
 * Cek pembaruan otomatis (hanya di aplikasi desktop). Dijalankan sekali tiap aplikasi dibuka:
 * kalau ada versi baru di server, diunduh & dipasang sendiri di latar belakang, lalu aplikasi
 * dimulai ulang otomatis supaya versi barunya langsung dipakai. Karyawan tidak perlu
 * mengunduh installer manual lagi untuk pembaruan kecil (lihat docs/PANDUAN-AUTO-UPDATE.md
 * untuk cara merilis versi baru).
 */
export function useAppUpdater(notify: (msg: string, type?: 'success' | 'warning' | 'info') => void) {
  const ranRef = useRef(false);

  useEffect(() => {
    if (!isDesktopApp || ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();
        if (!update) return; // sudah versi terbaru

        notify(`Pembaruan ${update.version} ditemukan, mengunduh di latar belakang...`, 'info');

        // Progres unduhan tidak ditampilkan tiap potongan (terlalu sering & mengganggu);
        // cukup notifikasi di awal dan di akhir seperti sudah dilakukan di atas/bawah ini.
        await update.downloadAndInstall();

        notify('Pembaruan terpasang. Aplikasi akan dimulai ulang dalam 5 detik...', 'success');
        setTimeout(async () => {
          try {
            const { relaunch } = await import('@tauri-apps/plugin-process');
            await relaunch();
          } catch {
            // gagal restart otomatis -> karyawan tinggal tutup & buka lagi manual
          }
        }, 5000);
      } catch {
        // Gagal cek/unduh pembaruan (mis. tidak ada internet, server update belum ada
        // latest.json) -> aplikasi tetap jalan normal dengan versi yang terpasang sekarang.
      }
    })();
  }, [notify]);
}
