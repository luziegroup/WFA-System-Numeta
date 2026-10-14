# Panduan Menjalankan WFA Numeta (project terpisah dari Luzie)

Project ini memakai Firebase sendiri: **wfa-system-numeta**. Alamat web yang diasumsikan: **https://wfa-numeta.vercel.app**
(buat project Vercel dengan nama persis `wfa-numeta`; bila Vercel memberi alamat lain, ganti alamat itu di
`src/lib/runtimeConfig.ts` (DESKTOP_CONFIG_URL), `src-tauri/tauri.conf.json` (endpoints) dan `browser-extension/config.js`).

## A. Firebase (sekali saja)
1. Realtime Database sudah dibuat (Singapore). Tab **Rules** -> tempel isi `database.rules.json` -> **Publish**.
2. Database kosong: saat pertama dibuka aplikasi membuat akun HRD **username `admin`, password `admin123`** dan langsung meminta ganti password.

## B. Web (Vercel)
1. Vercel -> Add New -> Project -> pilih repo `WFA-Numeta` -> nama project `wfa-numeta` -> Deploy.
2. Buka `https://wfa-numeta.vercel.app/config.json` -> harus berisi `wfa-system-numeta`.
3. Login `admin` -> Pengaturan WFA -> kartu Optimasi Database: "Database aktif: wfa-system-numeta - sumber: config.json".

## C. Hapus sisa rilis Luzie (WAJIB)
Di GitHub hapus folder `public/updates` (berisi installer & latest.json milik Luzie). Folder baru dibuat saat rilis Numeta pertama.

## D. Aplikasi desktop (setelah web berjalan)
1. Buat kunci baru (BUKAN kunci Luzie): `npx tauri signer generate -w .\numeta-signing-key.key` (catat kata sandinya; jangan di-upload).
2. Tempel isi `numeta-signing-key.key.pub` ke `"pubkey"` di `src-tauri/tauri.conf.json` (gantikan GANTI_DENGAN_PUBLIC_KEY_NUMETA).
3. Build: set `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, lalu `npm run tauri build`, `npm run release:update -- "Rilis pertama"`.
4. Upload `public/updates` & `src-tauri/tauri.conf.json` ke GitHub. Pasang `WFA Numeta_1.0.0_x64-setup.exe` ke karyawan.
5. Isi `DESKTOP_DOWNLOAD_URL` di `src/components/HubstaffView.tsx` dengan link unduhan Numeta (sudah berisi link Drive Anda).

## E. Yang tidak boleh dicampur dengan Luzie
- Skrip tangkapan layar (Apps Script) & folder Drive: buat deployment sendiri, isi di Pengaturan Hubstaff.
- Ekstensi browser: sudah mengarah ke database & web Numeta; pasang dari folder `browser-extension` project ini.
- Jangan unggah `*.key`.

## F. Keamanan
Rules database masih terbuka (`.read/.write: true`). Benahi (Firebase Authentication + rules per peran) sebelum data karyawan sungguhan dimasukkan.
