import { invoke } from '@tauri-apps/api/core';

/** Terdeteksi true kalau halaman ini berjalan di dalam aplikasi desktop (Tauri). */
export const isDesktopApp =
  typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || 'isTauri' in window);

/**
 * Berapa detik sistem operasi tidak menerima input keyboard/mouse sama sekali (di aplikasi
 * MANA PUN, bukan hanya di WFA System). Hanya tersedia di aplikasi desktop; di browser
 * mengembalikan null karena browser tidak boleh melihat aktivitas di luar tabnya.
 */
export async function getSystemIdleSeconds(): Promise<number | null> {
  if (!isDesktopApp) return null;
  try {
    return await invoke<number>('system_idle_seconds');
  } catch {
    return null;
  }
}
