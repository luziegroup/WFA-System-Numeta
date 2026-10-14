import { invoke } from '@tauri-apps/api/core';
import { isDesktopApp } from './systemIdle';

export interface ActiveWindowInfo {
  appName: string;
  title: string;
}

/** Nama aplikasi & judul jendela yang sedang fokus. null kalau bukan aplikasi desktop, atau
 *  gagal membaca (mis. tidak ada jendela aktif). Tidak pernah membaca isi jendela. */
export async function getActiveWindowInfo(): Promise<ActiveWindowInfo | null> {
  if (!isDesktopApp) return null;
  try {
    const r = await invoke<ActiveWindowInfo>('active_window_info');
    return r && r.appName ? r : null;
  } catch {
    return null;
  }
}
