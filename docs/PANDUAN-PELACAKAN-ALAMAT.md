# Panduan Pelacakan Alamat (URL) — Ekstensi Browser

Fitur ini mencatat alamat situs (termasuk Google dan YouTube) yang dibuka karyawan, **hanya
selama timer Hubstaff mereka aktif**, lewat ekstensi browser Chrome/Edge terpisah. Aplikasi
utama sendiri tidak bisa membaca isi browser tanpa ekstensi ini.

## 1. Nyalakan di Pengaturan Hubstaff
1. Login HRD → **Pengaturan Hubstaff** → kartu **Pelacakan Alamat (URL)**.
2. Nyalakan toggle **Aktifkan pelacakan alamat**.
3. Pilih **Semua Divisi** atau **Divisi Tertentu** → centang divisi yang mau dipantau.
   Divisi yang tidak dicentang tidak akan pernah dicatat, walau karyawannya memasang ekstensi.
4. Atur lama penyimpanan riwayat, dan apakah koordinator boleh ikut melihat.
5. Simpan.

## 2. Pasang ekstensi di komputer karyawan
Ikuti `browser-extension/README.md` untuk instalasi (mode developer untuk mulai, atau
force-install lewat Google Workspace/Intune untuk 40 komputer sekaligus).

## 3. Sambungan otomatis — karyawan tidak perlu apa-apa
Sejak versi ini, karyawan **tidak perlu menyalin kode apa pun**. Begitu ekstensi terpasang dan
admin sudah mengisi Alamat Aplikasi (langkah 2), ekstensi otomatis mendeteksi kode pasang setiap
karyawan langsung dari halaman WFA System yang mereka buka.

Kartu **Pelacakan Alamat (URL)** di menu Hubstaff karyawan menampilkan status sambungan secara
langsung: Ekstensi Belum Terdeteksi / Ekstensi Terhubung / Ekstensi Mencatat. Kalau karyawan
memakai komputer atau browser baru yang belum terpasang ekstensinya, tinggal pasang ekstensi di
situ — tidak ada langkah lain.

Jalur manual (salin-tempel kode) tetap tersedia sebagai cadangan di halaman Opsi ekstensi,
kalau auto-connect tidak berhasil karena sebab tertentu (lihat `browser-extension/README.md`
bagian 5).

## 4. Melihat hasilnya
Monitor Hubstaff → pilih tanggal → kolom **Alamat Situs** → tombol **Lihat**. Tampilannya:
- Daftar situs di kiri, diurutkan dari yang paling lama dibuka.
- Daftar kunjungan di kanan: jam, judul halaman, alamat lengkap, dan lama dibuka. Klik untuk
  membuka alamat itu di tab baru.

## 5. Perkuat keamanan (opsional tapi disarankan)
`database.rules.json` di paket ini sudah menambahkan validasi: tulisan ke `urlActivity` ditolak
kalau tidak membawa kunci yang cocok dengan punya karyawan tersebut. Ini lapisan pengaman
tambahan di luar kerahasiaan kode pasang. Untuk mengaktifkannya:
1. Firebase Console → Realtime Database → **Rules**.
2. Tempel isi `database.rules.json` yang baru → **Publish**.

Tanpa langkah ini, fitur tetap berjalan (karena rules lama sudah `.write: true` untuk semuanya),
hanya saja tanpa lapisan pengaman tambahan tersebut.

## 5.5. Pindah hosting (Vercel → Netlify → domain sendiri)
Alamat aplikasi **tidak ditulis di dalam kode ekstensi**, jadi pindah hosting tidak berdampak
ke ekstensi yang sudah terpasang di komputer karyawan. Yang perlu dilakukan hanya:
1. Buka pengaturan ekstensi (di komputer admin sudah cukup — tidak perlu di semua komputer,
   tapi kalau mau seragam, cukup update di komputer yang jadi acuan pemasangan berikutnya).

   Catatan: karena pengaturan ini tersimpan per-komputer (bukan disinkronkan lewat akun Google),
   kalau sudah terlanjur dipasang di 40 komputer, mengganti alamat berarti mengganti isian ini
   di tiap komputer, atau mendorong ulang lewat kebijakan force-install kalau memakai Google
   Workspace/Intune (nilai defaultnya bisa diatur lewat kebijakan terkelola). Ini tetap jauh
   lebih ringan daripada memasang ulang ekstensi atau meminta karyawan pasang ulang kode.
2. Ganti isian **Alamat Aplikasi** ke alamat baru → **Simpan Alamat**.
3. Selesai — tidak perlu memasang ulang ekstensi, tidak perlu kode pasang baru per karyawan.

## 6. Batasan yang perlu diketahui
- Hanya mencatat tab yang **sedang aktif dan berfokus** di Chrome/Edge. Tab lain yang dibuka di
  belakang tidak dihitung.
- Tidak mencatat di jendela **incognito/penyamaran** kecuali diizinkan manual per karyawan.
- Kalau karyawan menutup/menonaktifkan ekstensi, tidak ada yang tercatat — bukan pengaman
  anti-curang yang tidak bisa dilewati.
- Kalau koneksi internet putus, catatan yang belum terkirim akan hilang (tidak diulang tanpa
  batas), supaya ekstensi tidak menumpuk data lama saat offline lama.
