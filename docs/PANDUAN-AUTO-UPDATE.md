# Panduan Auto-Update Aplikasi Desktop

Setelah dipasang sekali, aplikasi WFA System karyawan akan **otomatis cek, unduh, dan pasang**
versi baru setiap kali dibuka — tanpa Anda perlu kirim ulang installer ke 40 orang setiap ada
perbaikan kecil.

## Cara kerja singkat
1. Tiap aplikasi dibuka, ia mengecek file kecil `latest.json` di web Anda (yang sudah online di
   Vercel).
2. Kalau versi di situ lebih baru dari yang terpasang, aplikasi mengunduh & memasangnya sendiri
   di latar belakang.
3. Setelah terpasang, aplikasi minta izin mulai ulang otomatis (5 detik), lalu versi baru
   langsung dipakai.
4. Semua file update ditandatangani dengan kunci rahasia, supaya tidak bisa dipalsukan orang
   lain — hanya file yang Anda buat sendiri yang akan diterima aplikasi.

## 1. Buat kunci penandatanganan (SEKALI SAJA, selamanya)
Kunci ini membuktikan bahwa update benar-benar dari Anda, bukan dari orang lain. **Simpan
baik-baik** — kalau hilang, Anda harus mengganti kunci baru dan karyawan yang sudah terpasang
tidak akan bisa menerima update dari kunci baru itu (harus pasang ulang manual sekali lagi).

```bash
npx tauri signer generate -w ./wfa-signing-key.key
```

Anda akan diminta membuat **kata sandi** untuk kunci ini — catat baik-baik, jangan sampai lupa.

Perintah ini menghasilkan:
- File `wfa-signing-key.key` (kunci PRIVAT/rahasia) — **JANGAN pernah dibagikan, JANGAN
  dimasukkan ke zip yang dikirim ke siapa pun, JANGAN diunggah ke internet**. Simpan di
  komputer Anda saja, idealnya juga di-backup ke tempat aman (USB terpisah, password manager).
- Teks **kunci publik** yang ditampilkan di terminal (dimulai dengan huruf/angka acak panjang)
  — ini boleh dibagikan, dan WAJIB ditempel ke `src-tauri/tauri.conf.json`:

```json
"plugins": {
  "updater": {
    "pubkey": "TEMPEL_KUNCI_PUBLIK_DI_SINI"
  }
}
```

## 2. Build dengan kunci itu
Setiap kali build untuk dirilis (bukan sekadar coba-coba), isi dulu dua variabel ini di
terminal (PowerShell) sebelum `npm run tauri build`:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content .\wfa-signing-key.key -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "kata-sandi-yang-tadi-dibuat"
npm run tauri build
```

(Command Prompt biasa: `set TAURI_SIGNING_PRIVATE_KEY=...` — tapi PowerShell di atas lebih aman
karena tidak menyimpan isi kunci di riwayat perintah sepanjang baris.)

## 3. Siapkan paket update & deploy
Setelah `npm run tauri build` selesai (tandanya ada baris "Finished 2 updater signatures at:"
di akhir log), jalankan:

```bash
npm run release:update -- "Catatan singkat perubahan di versi ini"
```

Skrip ini otomatis menyalin file hasil build ke `public/updates/` dan membuat `latest.json`.
Lalu deploy seperti biasa:

```bash
npm run build
vercel --prod
```

Selesai. Karyawan yang sudah pasang aplikasi akan menerima update ini otomatis saat berikutnya
membuka aplikasi.

## 4. Untuk update BERIKUTNYA (rutin)
Tiap kali ada perubahan baru yang mau dirilis:
1. Naikkan nomor versi di `src-tauri/tauri.conf.json` (field `"version"`), misalnya dari
   `1.0.0` jadi `1.0.1`. **Wajib dinaikkan**, atau aplikasi karyawan tidak akan menganggapnya
   sebagai versi baru.
2. Ulangi langkah 2 dan 3 di atas (build dengan kunci yang SAMA, lalu `release:update`, lalu
   deploy).

## Hal penting yang perlu diketahui
- **Auto-update baru berlaku MULAI rilis ini.** Karyawan yang instalasinya dari sebelum fitur
  ini ada (termasuk yang sudah Anda bagikan sebelumnya) **harus install manual SEKALI LAGI**
  untuk mendapat versi yang sudah punya kemampuan auto-update. Setelah itu, update-update
  berikutnya baru otomatis.
- Fitur ini **hanya berjalan di aplikasi desktop**, tidak berpengaruh ke versi web.
- Kalau `latest.json` belum ada di server (belum pernah menjalankan langkah 1-3), aplikasi
  tetap jalan normal seperti biasa — hanya saja tidak ada pembaruan otomatis, tanpa error yang
  mengganggu karyawan.
- Pastikan `wfa-signing-key.key` ikut di-backup di tempat Anda menyimpan dokumen penting
  perusahaan — tanpa file ini, Anda tidak bisa merilis update tervalidasi lagi di masa depan.
