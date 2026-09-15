# WFA System V2 — Struktur Terpecah (untuk memudahkan debugging)

File asli (`index.html`, 5.774 baris) sudah dipecah menjadi beberapa file
terpisah **tanpa mengubah satu baris kode pun** — hanya dipindahkan ke file
lain. Sudah diverifikasi dengan `diff`: isi kode 100% identik dengan file asli.

## Kenapa dipecah?

Sebelumnya semua CSS + semua JavaScript (± 5.300 baris) ada di dalam SATU
tag `<script>` di `index.html`. Kalau ada error, browser cuma bilang
"index.html line 3421" — susah tahu itu bagian fitur apa.

Sekarang, kalau ada error di konsol browser, akan muncul nama file spesifik,
misalnya:
```
Uncaught TypeError ... at buildKARY (08-page-kary.js:120)
```
Langsung tahu error ada di halaman Karyawan, tidak perlu scroll 5000 baris.

## Struktur folder

```
output/
├── index.html                  <- kerangka HTML (login page, app shell)
├── css/
│   └── style.css                <- semua styling
└── js/
    ├── 00-firebase-config.js        Kredensial & init Firebase
    ├── 01-data-store.js             Simpan/baca data (localStorage + Firebase realtime)
    ├── 02-scoring-engine.js         Rumus perhitungan skor performa
    ├── 03-ui-common.js              Jam, toast notifikasi, tab laporan
    ├── 04-auth-login.js             Login, setup profil, logout
    ├── 05-portal-router.js          Menu sidebar & navigasi antar halaman
    ├── 06-page-hrd.js               Halaman dashboard HRD
    ├── 07-page-koor.js              Halaman dashboard Koordinator
    ├── 08-page-kary.js              Halaman dashboard Karyawan
    ├── 09-rekap-laporan.js          Filter rekap & export laporan
    ├── 10-absensi-gps.js            GPS & proses absen pagi/siang
    ├── 11-todo-features.js          Fitur to-do harian karyawan
    ├── 12-komentar-komunikasi.js    Komentar koordinator & skor komunikasi
    ├── 13-hrd-karyawan-actions.js   Tambah karyawan, sanksi, ganti password
    ├── 14-pengaturan-bobot-divisi.js Pengaturan bobot skor & divisi
    ├── 15-arsip-zoom-meeting.js     Arsip data lama & jadwal Zoom
    ├── 16-manajemen-akun.js         Kelola akun (email/password/role)
    ├── 17-filter-select-hapus.js    Filter & hapus data terpilih
    ├── 18-reset-export-karyawan.js  Reset sistem & CSV karyawan
    ├── 19-export-import-akun.js     CSV akun
    ├── 20-edit-kehadiran.js         Modal edit/perbaiki data absen (admin), antisipasi gagal absen
    └── 21-init.js                   Baris terakhir yang dijalankan saat load
```

## PENTING: urutan file tidak boleh diubah

Ini bukan aplikasi modern dengan `import`/`export` module. Semua fungsi &
variabel bersifat **global** (sama seperti kode aslinya), jadi:

- `js/06-page-hrd.js` memanggil fungsi `showToast()` yang didefinisikan di
  `js/03-ui-common.js` — kalau urutan `<script src="...">` di `index.html`
  dibalik, akan muncul error `showToast is not defined`.
- Urutan `<script src>` di `index.html` sudah disusun **sama persis** dengan
  urutan eksekusi kode asli. Jangan diubah urutannya, dan jangan hapus salah
  satu tag `<script src>`-nya.

## Cara pakai / deploy

Upload seluruh isi folder `output/` (index.html + folder css + folder js)
ke hosting kamu (GitHub Pages, Netlify, cPanel, dll) dengan **struktur folder
yang sama persis**. Tidak perlu build tool apa pun — tinggal buka
`index.html` di browser seperti biasa.

## Cara memperbaiki error ke depannya

1. Buka DevTools browser (F12) → tab **Console**.
2. Lihat nama file & nomor baris di pesan error, contoh:
   `Uncaught ReferenceError: DB is not defined at 13-hrd-karyawan-actions.js:45`
3. Buka file tersebut di folder `js/`, lompat ke baris yang disebutkan.
4. Karena tiap file cuma berisi satu topik fitur (lihat tabel di atas),
   kamu langsung tahu konteks bug-nya tanpa harus baca ribuan baris kode
   fitur lain.

## Catatan tambahan (bukan bug, tapi perlu diketahui)

`js/00-firebase-config.js` berisi `apiKey` Firebase dalam bentuk teks
terbuka. Ini **normal** untuk aplikasi web client-side berbasis Firebase
(kunci ini memang didesain untuk terlihat publik), tapi keamanan data
sebenarnya harus diatur lewat **Firebase Realtime Database Rules** di
Firebase Console, bukan lewat menyembunyikan apiKey ini. Kalau belum pernah
mengatur Rules, ada baiknya dicek supaya data absensi tidak bisa diakses
sembarang orang dari internet.
