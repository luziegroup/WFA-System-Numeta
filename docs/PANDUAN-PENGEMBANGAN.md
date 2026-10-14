# Panduan Pengembangan (supaya hemat kuota tetap terjaga)

Sejak versi hemat-kuota, aplikasi TIDAK lagi mengunduh seluruh database. Ikuti aturan ini saat menambah fitur.

## 1. Membaca `entries` (absen, to-do, nilai, Hubstaff)
`entries` dari `useApp()` hanya berisi data yang SUDAH dimuat (default: milik sendiri 31 hari terakhir).
Halaman yang menampilkan data pada rentang tanggal tertentu WAJIB memuatnya:

```tsx
import { useApp, useEntriesRange } from '../context/AppContext';
import { RefreshBar } from './RefreshBar';

const { entries } = useApp();
const { refresh, loading, updatedAt } = useEntriesRange(from, to);           // sesuai peran: karyawan=sendiri, leader=tim, HRD=semua
// useEntriesRange(from, to, { self: true })                                 // khusus entry milik sendiri
// ...
<RefreshBar onRefresh={refresh} loading={loading} updatedAt={updatedAt} />
```
- Jangan memakai rentang "semua riwayat" kecuali pengguna memilihnya (ALL_FROM/ALL_TO di `utils/dateRange.ts`).
- Lupa memanggil `useEntriesRange` = halaman terlihat "kosong" untuk tanggal lama. Itu bukan bug data.

## 2. Menulis data
- Gunakan fungsi di AppContext (`setEntries(prev => ...)`) — hanya FIELD yang berubah yang dikirim.
- Menulis ke entry yang belum termuat aman (ditulis per-field, tidak menimpa yang ada di server).
- Data yang bisa ditulis bersamaan oleh banyak orang (peserta meeting, foto meeting) ditulis PER-ITEM
  (`set(ref('zoomMeetings/{id}/attendees/{uid}'))`), jangan menulis ulang seluruh daftar.

## 3. Gambar
- JANGAN simpan data URL/base64 di `entries`, `zoomMeetings`, `users`, atau `warnings`.
- Simpan lewat `saveImage(path, dataUrl)` (lib/imageRef.ts) → dapat referensi `rtdb:...`; simpan referensi di data utama.
- Tampilkan dengan `<RemoteImage src={...} />` atau `openImageModal(ref)`. Avatar maksimal 160px (`compressImage(file, 160, 0.75)`).

## 4. Listener realtime (`onValue`)
- Hanya untuk data KECIL yang benar-benar harus live (`users`, `settings`, status `trackingStatus/{uid}`, sinyal `signals/*`).
- Pasang di dalam efek dan lepas saat komponen ditutup. Jangan membuat listener pada `entries`, `warnings`, `zoomMeetings`.
- Data baru yang harus sampai cepat tanpa Refresh: tulis cap waktu ke `signals/...` (lihat `sendSignal`), penerima mengambil ulang daftar.

## 5. Rilis aplikasi desktop
1. Naikkan `"version"` di `src-tauri/tauri.conf.json`.
2. `$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content .\wfa-signing-key.key -Raw` dan `..._PASSWORD`, lalu `npm run tauri build`.
3. `npm run release:update -- "catatan rilis"` (memilih installer sesuai versi, jadi sisa installer lama tidak mengganggu).
4. Upload `public/updates/*` dan `src-tauri/tauri.conf.json` ke GitHub.
- JANGAN upload `*.key` (sudah ada di `.gitignore`). Jangan commit `src-tauri/target`, `node_modules`, `dist`.

## 6. Sebelum merge
`npx tsc --noEmit` dan `npm run build` harus lolos. Pantau Firebase → Realtime Database → Usage (target < ~0,3 GB/hari).
