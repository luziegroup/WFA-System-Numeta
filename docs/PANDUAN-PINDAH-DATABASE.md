# Panduan Pindah Project Firebase (tanpa build ulang aplikasi)

Alamat database dibaca dari **`public/config.json`** setiap kali aplikasi (web & desktop) dibuka.
Pindah project cukup: pindahkan data → ganti isi `config.json` → upload. Aplikasi desktop TIDAK perlu dibuild ulang
(syarat: karyawan sudah memakai desktop versi 1.0.2 atau lebih baru, yang membaca config.json).

## A. Siapkan sebelum darurat (lakukan sekarang)
1. Ekspor cadangan: Firebase Console → Realtime Database → Data → titik tiga di root → **Export JSON**. Ulangi tiap minggu.
   Jangan menunggu kuota habis: database yang terkunci bisa gagal diekspor.
2. Pastikan semua karyawan memakai desktop ≥ 1.0.2 dan ekstensi browser ≥ 1.2.0.

## B. Langkah pindah
1. **Project baru**: Firebase Console → Add project → aktifkan **Realtime Database** (region sama: Singapore / asia-southeast1).
2. **Ekspor ulang** data dari project lama (Export JSON) tepat sebelum pindah. Data yang masuk setelah ekspor tidak ikut.
3. **Impor** ke database baru: tab Data → titik tiga di root → **Import JSON**.
4. **Salin Rules**: tab Rules project lama → tempel ke project baru → **Publish** (isinya sama dengan `database.rules.json`).
5. **Ambil konfigurasi web** project baru: Project settings → Your apps → Web app → salin `apiKey`, `authDomain`, `databaseURL`,
   `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
6. **Edit `public/config.json`**: ganti semua nilai di bagian `firebase` (dan `dbRoot` bila berbeda), simpan.
7. **Upload `public/config.json`** ke GitHub (atau deploy). Tunggu Vercel selesai.
8. **Cek**: buka `https://wfa-system-v2-nine.vercel.app/config.json` — harus menampilkan nilai baru.
9. Karyawan cukup **menutup dan membuka lagi** aplikasinya. Login HRD → Pengaturan WFA → kartu **Optimasi Database**
   menampilkan "Database aktif: <projectId> · sumber: config.json". Pastikan projectId-nya yang baru.

## C. Jika ada masalah
- **config.json salah ketik / tidak valid**: ditolak otomatis, aplikasi memakai salinan terakhir yang benar (atau bawaan). Aplikasi tidak mati.
- **Perlu kembali ke project lama**: kembalikan isi config.json lalu upload.
- **Karyawan masih terhubung ke project lama**: mereka belum membuka ulang aplikasi, atau memakai versi lama (< 1.0.2).
- **Ekstensi browser** membaca config.json yang sama (alamat web diambil dari opsinya); tidak perlu dipasang ulang.

## D. Catatan
- Ini hanya cadangan: bila pemakaian tidak turun, project baru pun akan mencapai batas 10 GB/bulan. Alternatif tanpa pindah data: upgrade ke Blaze + budget alert.
- Foto ada di database (node `proofImages`, `zoomPhotos`) dan ikut terbawa saat Export/Import.
- Tangkapan layar ada di Google Drive (Apps Script) dan tidak terpengaruh.
