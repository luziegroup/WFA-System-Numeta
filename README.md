# WFA System — Luzie Group

Portal **Work From Anywhere**: absensi pagi/siang dengan GPS, to-do list centang + bukti (link/foto), Zoom pagi, rekap & performa, teguran, serta manajemen akun. Tiga peran: **HRD**, **Koordinator (leader)**, dan **Karyawan**.

Data tersimpan di **Firebase Realtime Database** dan tersinkron realtime antar perangkat. Aplikasi ini murni *front-end* (React + Vite) — tidak butuh server sendiri.

---

## 1. Login pertama

Saat database masih kosong, aplikasi otomatis membuat satu akun admin (sama dengan aplikasi referensi V2):

| Username | Password |
|---|---|
| `admin` | `admin123` |

(Login sekarang memakai **Username**, bukan Email. Akun lama yang belum diisi field username otomatis memakai bagian sebelum "@" pada emailnya sebagai username.)

**Langsung ganti password-nya** di menu *Akun Saya*, lalu buat akun Koordinator & Karyawan lewat *Manajemen Akun*.

- Akun baru otomatis berpassword awal `123456` (sarankan pengguna menggantinya).
- Lupa password? HRD menekan tombol **Reset** di *Manajemen Akun* → password kembali ke `123456`.
- HRD juga bisa langsung **Login** sebagai akun karyawan/koordinator lain dari *Manajemen Akun* (tanpa perlu tahu passwordnya) untuk keperluan pengecekan/bantuan. Selama masih dalam mode ini, muncul bar kuning di atas layar dengan tombol **Kembali ke Admin**.

## 2. Menjalankan di komputer

```bash
npm install
npm run dev        # http://localhost:3000
```

Tanpa konfigurasi apa pun aplikasi langsung tersambung ke project Firebase **wfa-system-v3** (sama seperti referensi V2).

## 3. Publish

Build produksi: `npm run build` → hasilnya di folder `dist/` (path relatif, jadi bisa ditaruh di hosting mana pun).

**A. Firebase Hosting** (paling cocok — satu project dengan databasenya)
```bash
npm install -g firebase-tools
firebase login
npm run deploy            # build + deploy hosting
```
Konfigurasi sudah ada di `firebase.json` dan `.firebaserc`. Untuk ikut mengirim aturan database: `firebase deploy --only database` (lihat bagian Keamanan).

**B. Netlify** — hubungkan repo, atau drag & drop folder `dist/`. `netlify.toml` sudah disiapkan.

**C. GitHub Pages** — push ke branch `main`; workflow `.github/workflows/deploy.yml` akan build & deploy. Aktifkan dulu *Settings → Pages → Source: GitHub Actions*.

**D. cPanel / hosting biasa** — upload seluruh isi folder `dist/` ke `public_html`.

> Absensi GPS hanya berjalan di **HTTPS** (atau localhost). Semua opsi di atas otomatis HTTPS.

## 4. Konfigurasi (opsional)

Salin `.env.example` → `.env` **hanya** jika ingin memakai project Firebase lain. Variabel yang tersedia: `VITE_FIREBASE_*` dan `VITE_DB_ROOT`.

Data aplikasi disimpan di folder `luzie-react/` pada Realtime Database — sengaja **berbeda** dari aplikasi V2 (`luzie/`) karena struktur datanya berbeda, supaya keduanya tidak saling menimpa walau memakai project yang sama.

## 5. Keamanan — baca sebelum dipakai luas

- Aplikasi ini memakai login sendiri (bukan Firebase Authentication), sama seperti V2. Akibatnya **Realtime Database Rules harus membuka baca/tulis** untuk folder `luzie-react`; siapa pun yang mengetahui URL database secara teknis bisa membaca datanya.
- Yang sudah dilakukan: password disimpan sebagai **hash** (bukan teks biasa), login dibatasi 5x percobaan, `database.rules.json` menutup semua path selain folder aplikasi & memvalidasi struktur akun, dan header keamanan hosting aktif.
- Yang belum bisa ditutup tanpa migrasi: akses baca data absensi & hash password oleh pihak yang tahu URL database. Untuk keamanan penuh, langkah berikutnya adalah migrasi login ke **Firebase Authentication** dan mengunci Rules dengan `auth != null`.
- `database.rules.json` **menimpa seluruh Rules** project saat di-deploy. Blok `luzie` sengaja dipertahankan supaya aplikasi V2 (bila masih dipakai) tetap jalan — jangan dihapus kalau V2 masih aktif.

## 6. Catatan teknis

- **Foto bukti** dikompres otomatis (maks. 1280px, JPEG) lalu disimpan sebagai teks di database — hemat, tanpa perlu Firebase Storage. Jika jumlah pengguna sudah ratusan, pertimbangkan memindahkannya ke Storage.
- **Zoom**: jadwal meeting memakai *link & passcode Zoom perusahaan* dari menu *Pengaturan WFA* (diisi HRD). Integrasi pembuatan meeting otomatis via Zoom API (Apps Script di V2) belum dibawa ke versi ini.
- **Offline**: perubahan yang dibuat saat koneksi putus dikirim otomatis begitu online lagi selama tab masih terbuka. Indikator Online/Offline ada di header.
- Penyimpanan per-field: dua orang yang mengubah bagian berbeda dari data yang sama (mis. karyawan mencentang to-do sementara koordinator menilai) tidak saling menimpa.

## 7. Struktur proyek

```
src/
  lib/            firebase.ts (config), useFirebaseCollection.ts (sinkronisasi), password.ts, image.ts
  context/        AppContext.tsx  — state, login, semua aksi
  components/     halaman per peran (HRD / Koordinator / Karyawan)
  data/           pengaturan default
firebase.json · .firebaserc · database.rules.json   → Firebase Hosting & Rules
netlify.toml · .github/workflows/deploy.yml         → Netlify / GitHub Pages
```

## 8. Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan (port 3000) |
| `npm run build` | Cek tipe + build produksi ke `dist/` |
| `npm run preview` | Coba hasil build secara lokal |
| `npm run lint` | Cek tipe TypeScript |
| `npm run deploy` | Build + deploy ke Firebase Hosting |
