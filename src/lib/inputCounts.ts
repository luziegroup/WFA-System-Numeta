import { invoke } from '@tauri-apps/api/core';
import { isDesktopApp } from './systemIdle';

export interface InputCounts {
  keyboard: number;
  mouse: number;
}

/** Ambil & nolkan hitungan kejadian keyboard/mouse sejak terakhir dipanggil. Hanya berupa
 *  ANGKA HITUNGAN kejadian — tidak pernah berisi tombol yang ditekan atau isi ketikan.
 *  null kalau bukan aplikasi desktop, atau gagal membaca (fitur lain tetap jalan normal). */
export async function takeInputCounts(): Promise<InputCounts | null> {
  if (!isDesktopApp) return null;
  try {
    return await invoke<InputCounts>('take_input_counts');
  } catch {
    return null;
  }
}
