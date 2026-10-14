# WFA System — Ekstensi Pelacak Alamat (Chrome & Edge)

Ekstensi ini mencatat alamat situs (Google, YouTube, dan lainnya) yang dibuka karyawan **hanya
selama timer Hubstaff mereka aktif**, dan hanya untuk divisi yang diizinkan HRD. Bekerja di
Chrome dan Edge (satu paket yang sama untuk berdua).

**Karyawan tidak perlu melakukan apa pun selain memasang ekstensi.** Setelah admin mengisi
alamat aplikasi sekali di pengaturan ekstensi, ekstensi otomatis menyambungkan diri ke akun
setiap karyawan saat mereka membuka WFA System — tidak ada kode yang perlu disalin-tempel.

## Yang dicatat, dan yang TIDAK
- **Dicatat:** alamat (URL), judul tab, dan lama waktu tab itu aktif/fokus.
- **Tidak pernah dicatat:** isi halaman, isi ketikan, kata sandi, cookie, riwayat di luar jam
  timer aktif, atau tab yang tidak sedang fokus.
- Beri tahu karyawan sebelum memasang, dan pastikan sesuai kebijakan privasi perusahaan (UU PDP).

## 1. Isi konfigurasi (sekali, oleh admin/IT, SEBELUM dibagikan ke karyawan)
Buka `config.js`, isi tiga nilai ini:
- `DATABASE_URL` dan `DB_ROOT` — sama persis dengan `src/lib/firebase.ts` di aplikasi utama.
- `DEFAULT_APP_ORIGIN` — alamat web WFA System (contoh: `https://wfa.luziegroup.com`). **Ini
  yang membuat karyawan tidak perlu mengisi apa pun** di halaman Opsi ekstensi — begitu
  ekstensi dimuat di komputer mereka, alamat ini otomatis terisi dan langsung mulai mencari
  sambungan ke WFA System.

Simpan file ini, baru bagikan folder `browser-extension` ke komputer karyawan (langkah 2).

## 2. Pasang ke komputer karyawan
**Mode developer (untuk mulai / uji coba):**
1. Buka `chrome://extensions` (Chrome) atau `edge://extensions` (Edge).
2. Nyalakan **Mode Pengembang / Developer mode**.
3. **Load unpacked / Muat yang belum dikemas** → pilih folder `browser-extension`.

**Pemasangan masal untuk 40 komputer (disarankan):** pakai kebijakan *force-install* Google
Workspace atau Microsoft Intune dengan ID ekstensi dari listing privat/internal di Chrome Web
Store Developer Dashboard. Ini memasang otomatis ke semua komputer terkelola tanpa karyawan
melakukan apa pun.

## 3. Alamat Aplikasi — otomatis terisi, tidak perlu diapa-apakan lagi
Karena sudah diisi di `config.js` pada langkah 1, kolom **Alamat Aplikasi** di halaman Opsi
ekstensi setiap karyawan akan **otomatis terisi sendiri** begitu ekstensi dimuat — tidak perlu
diketik ulang di tiap komputer. Karyawan (atau IT yang memasangkan) tidak perlu membuka halaman
Opsi sama sekali kalau hanya untuk ini.

**Kalau nanti pindah hosting** (misalnya dari Vercel ke Netlify, atau ke domain sendiri), ada dua
cara:
- **Untuk komputer yang BELUM dipasangi ekstensi:** cukup ubah `DEFAULT_APP_ORIGIN` di
  `config.js`, lalu bagikan foldernya seperti biasa — otomatis dapat alamat baru.
- **Untuk komputer yang SUDAH terpasang:** buka halaman Opsi ekstensi di komputer itu, ganti
  kolom Alamat Aplikasi secara manual, klik Simpan Alamat. Tidak perlu memasang ulang.

## 4. Yang dialami karyawan
Tidak ada langkah tambahan. Mereka membuka WFA System seperti biasa untuk absen dan menyalakan
timer Hubstaff. Kalau divisinya diizinkan HRD untuk pelacakan alamat, kartu **Pelacakan Alamat
(URL)** di menu Hubstaff akan menampilkan status:
- **Ekstensi Belum Terdeteksi** — ekstensi belum terpasang di browser ini, atau alamat aplikasi
  di pengaturan ekstensi belum diisi admin.
- **Ekstensi Terhubung** — ekstensi terpasang dan tersambung, menunggu timer dinyalakan.
- **Ekstensi Mencatat** — sedang aktif mencatat alamat situs.

Kalau karyawan memakai browser yang berbeda dari biasanya (atau komputer yang ekstensinya belum
terpasang), akan tampil "Ekstensi Belum Terdeteksi" — ini normal, bukan berarti ada yang salah,
cukup pasang ekstensi di komputer itu juga.

## 5. Kalau auto-connect tidak berhasil
- Buka bagian **"Sambungkan manual"** di halaman Opsi ekstensi, tempel Kode Pasang dari menu
  Hubstaff karyawan seperti versi sebelumnya. Ini jalur cadangan, tetap tersedia.
- Penyebab umum auto-connect gagal: alamat di pengaturan ekstensi tidak sama persis dengan
  alamat yang dibuka karyawan (misalnya beda `www.` atau beda domain custom vs domain bawaan
  hosting), atau karyawan hanya memakai aplikasi desktop dan belum pernah membuka WFA System
  lewat Chrome/Edge biasa (ekstensi browser tidak bisa melihat ke dalam aplikasi desktop yang
  terpisah).

## 6. Uji coba sebelum dipakai semua
1. Pasang di 2–3 komputer dulu, isi Alamat Aplikasi.
2. Karyawan buka WFA System di Chrome/Edge, nyalakan timer Hubstaff.
3. Cek kartu Pelacakan Alamat menampilkan "Ekstensi Mencatat".
4. Buka beberapa situs (termasuk google.com dan youtube.com), tunggu 1 menit.
5. Cek di aplikasi: Monitor Hubstaff → karyawan tsb → tombol **Lihat** di kolom Alamat Situs.
6. Baru naikkan ke semua karyawan.

## 7. Keamanan & keterbatasan yang perlu diketahui
- Ekstensi minta izin luas ("baca dan ubah data di semua situs") supaya bisa mendeteksi alamat
  aplikasi WFA System **apa pun domainnya**, dan supaya bisa berpindah domain kapan saja tanpa
  memasang ulang. Izin ini hanya dipakai content script untuk membaca satu atribut kecil di
  halaman WFA System sendiri — tidak membaca atau mengubah apa pun di situs lain. Untuk
  pemasangan lewat kebijakan IT (force-install), karyawan tidak melihat dialog izin ini sama
  sekali.
- Sama seperti tangkap layar, aplikasi ini tidak memakai Firebase Authentication, jadi kode
  pasang adalah pengaman lewat kerahasiaan, bukan pengaman penuh di sisi server.
- Ekstensi hanya melihat tab yang **sedang aktif dan berfokus**.
- Alamat di tab **incognito/penyamaran tidak tercatat**, kecuali diizinkan manual per karyawan.
- Kalau karyawan mengganti/menghapus ekstensi, tidak ada yang tercatat — bukan pengaman
  anti-curang yang tidak bisa dilewati.
