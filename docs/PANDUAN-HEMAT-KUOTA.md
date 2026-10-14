# Panduan Hemat Kuota Firebase (Downloads)

## Cara kerja baru
| Data | Cara ambil | Kapan diunduh |
|---|---|---|
| `users`, `settings`, `hubstaffSettings` | Live (kecil) | Saat aplikasi dibuka + saat berubah |
| `entries` (absen, to-do, nilai) | Query key per user + rentang tanggal | Saat halaman dibuka / periode diganti / tombol **Refresh** |
| `warnings` (200 terbaru), `zoomMeetings` (40 terbaru) | `get()` sekali | Saat login / **Refresh** / sinyal ringan |
| Foto bukti & foto meeting | Node terpisah `proofImages`, `zoomPhotos` | Hanya saat fotonya dilihat |
| Status live Monitor Hubstaff | `trackingStatus/{uid}` | Hanya saat Monitor terbuka & saklar **Live** menyala |

Lingkup data per peran: karyawan = entry miliknya, leader = dirinya + timnya (`leaderId`), HRD = semua.
Awal login hanya memuat entry milik sendiri 31 hari terakhir.
Tab yang kembali aktif setelah >10 menit diperbarui sekali; tidak ada polling lain.

Sinyal ringan: `signals/zoom` dan `signals/warn/{uid}` berisi cap waktu (beberapa byte). Penerima hanya
mengambil ulang daftar terkait saat sinyal berubah, jadi teguran/meeting baru tetap sampai tanpa Refresh.

## Langkah deploy (URUTAN PENTING)
1. Deploy aplikasi baru (`npm run deploy`, dan rilis ulang aplikasi desktop bila dipakai).
2. Pastikan semua pengguna memakai versi baru (refresh / update).
3. Login sebagai HRD -> **Pengaturan WFA** -> kartu **Optimasi Database**:
   - **Ukur ukuran database** (lihat bagian terbesar), lalu
   - **Jalankan optimasi** (memindahkan foto lama keluar dari `entries`/`zoomMeetings`, memperkecil avatar).
   Aman dijalankan ulang. Tidak menghapus data.
4. Pantau Firebase Console -> Realtime Database -> Usage selama beberapa hari.

Catatan: versi lama aplikasi tetap membaca seluruh `entries` (dan tidak paham referensi `rtdb:`);
jangan jalankan optimasi sebelum semua perangkat diperbarui.

## Perilaku yang perlu diketahui
- Data bisa tertinggal sampai Refresh; tiap halaman menampilkan "Diperbarui HH:MM:SS".
- Leader menilai: entry terbaru diambil dulu dari server sebelum penilaian disimpan.
- Join meeting dan foto meeting ditulis per-item agar tidak saling menimpa.
- Rules database tidak perlu diubah (query memakai key, tanpa `.indexOn`).
- Keamanan: rules masih `.read/.write: true`. Ini perlu dibenahi terpisah dengan Firebase Authentication.
