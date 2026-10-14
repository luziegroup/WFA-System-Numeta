# Panduan Pasang Tangkap Layar → Google Drive

Alur: aplikasi desktop karyawan mengambil layar → mengirim ke **Apps Script** milik akun Google
perusahaan → tersimpan di **Drive** → Firebase hanya menyimpan catatan kecil (ID file + waktu).

## 1. Pasang script di Google Drive perusahaan
1. Buka https://script.google.com dengan akun Google yang Drive-nya dipakai menyimpan gambar → **Proyek baru**.
2. Hapus isi bawaan, tempel isi `apps-script/Code.gs`.
3. Ganti `UPLOAD_KEY`, `VIEW_KEY`, dan `ADMIN_KEY` dengan tiga teks acak panjang yang **berbeda**
   (contoh: 30+ karakter huruf/angka). `ADMIN_KEY` dipakai untuk **menghapus** gambar — pegang sendiri,
   jangan dibagikan ke koordinator.
4. Menu **Layanan (Services) → + → Drive API → Tambahkan**. (Supaya penghapusan otomatis benar-benar permanen
   dan tidak menumpuk di tempat sampah Drive.)
5. Pilih fungsi `setup` → **Jalankan** → setujui izin akses Drive. Ini membuat folder **WFA Screenshots** dan
   jadwal hapus otomatis tiap malam.
6. **Deploy → Deployment baru → jenis: Aplikasi web** → *Jalankan sebagai:* **Saya** → *Yang memiliki akses:*
   **Siapa saja** → Deploy → salin URL berakhiran `/exec`.
   (Wajib "Siapa saja" karena aplikasi tidak memakai login Google. Yang melindungi adalah kunci di langkah 3.)
7. Setiap mengubah kode script, buat **versi deployment baru** agar perubahannya berlaku.

## 2. Isi di aplikasi
Login HRD → **Pengaturan Hubstaff** → bagian *Penyimpanan Google Drive*: tempel URL dan `UPLOAD_KEY` →
**Tes Koneksi** → nyalakan **Tangkap layar** → atur jumlah/interval → **Simpan**.

Bagikan `VIEW_KEY` hanya ke orang yang berhak melihat gambar. Mereka memasukkannya sekali di jendela
*Tangkap Layar* (Monitor Hubstaff → Lihat); kunci ini tersimpan di browser mereka saja, bukan di database.
Saat HRD menekan **Hapus** pada sebuah gambar, aplikasi akan meminta `ADMIN_KEY` sekali dan menyimpannya
di browser HRD tersebut.

## 3. Build ulang aplikasi desktop
Fitur ini butuh kode native baru, jadi installer lama **tidak** bisa mengambil layar:
```bash
npm install
npm run tauri build
```
Bagikan installer baru (perbarui `DESKTOP_DOWNLOAD_URL` di `HubstaffView.tsx`).
- **Windows:** tidak ada izin tambahan.
- **macOS:** karyawan harus mengizinkan *Screen Recording* untuk WFA System di Pengaturan Sistem → Privasi.
- **Linux:** hanya X11 (Wayland biasanya menolak tangkap layar diam-diam).
- Yang diambil hanya **monitor pertama** yang terdeteksi.

## 4. Uji coba sebelum dipakai 40 orang
1. Pakai 2–3 karyawan dulu, pengaturan: 1 tangkapan / 5 menit.
2. Mulai timer → tunggu → cek folder *WFA Screenshots/tanggal* di Drive, dan tombol **Lihat** di Monitor Hubstaff.
3. Pantau baris "Tangkap layar: N terunggah • gagal" di menu Hubstaff karyawan. Banyak "gagal" biasanya karena
   kuota Apps Script (permintaan serentak) atau kunci salah.
4. Baru naikkan ke semua karyawan.

## 5. Catatan penting
- **Kapasitas:** perkiraan per karyawan ada di Pengaturan Hubstaff. Kalikan 40. Contoh default
  (1×/10 menit, kualitas 60, 1280 px): ±290 MB/hari untuk semua karyawan.
- **Kuota Apps Script akun Gmail** lebih kecil daripada Workspace (batas eksekusi harian dan permintaan
  serentak; angka pasti bisa berubah, cek dokumentasi Google "Quotas for Google Services"). Jika sering gagal,
  kurangi jumlah tangkapan atau pindah ke Workspace / penyimpanan lain.
- **Keamanan:** aplikasi belum memakai Firebase Authentication. `UPLOAD_KEY` tersimpan di database
  (siapa pun yang bisa membaca database bisa melihatnya — dampaknya hanya bisa mengunggah gambar sampah);
  `VIEW_KEY` tidak pernah masuk database. Untuk keamanan penuh, langkah berikutnya adalah migrasi login ke
  Firebase Auth.
- **Privasi:** beri tahu karyawan sebelum mengaktifkan, dan tinjau kebutuhan izin/persetujuan sesuai UU PDP.
  Pertimbangkan opsi *Buramkan gambar*.
- Jika HRD memilih **Simpan N hari**, script menghapus permanen folder tanggal yang lebih lama setiap pukul 02.00.

Lihat juga `docs/PANDUAN-PELACAKAN-ALAMAT.md` untuk fitur pelacakan alamat (URL), dan pengaturan
**cakupan per divisi** yang sekarang berlaku untuk aktivitas, tangkap layar, maupun pelacakan alamat.


## 6. Tampilan hasil (mirip Hubstaff)

- Gambar dikelompokkan per blok 10 menit, dengan rata-rata persentase aktivitas blok itu.
- Setiap gambar menampilkan jam:menit:detik dan persentase aktivitas sejak tangkapan sebelumnya
  (aktivitas per gambar baru tercatat mulai pembaruan ini; tangkapan lama tidak punya angka ini).
- Klik gambar untuk memperbesar, lalu gunakan tombol panah, tombol keyboard ←/→, atau Esc.
- Kalau jam laptop karyawan berbeda lebih dari 3 menit dari jam server saat gambar diambil, muncul
  tanda peringatan di lightbox. Ini menandakan jam koleksi mungkin tidak akurat, misalnya laptop
  offline lama atau jamnya sengaja diubah.
- Tombol **Hapus** (hanya untuk HRD) menghapus gambar permanen dari Drive dan catatannya di Firebase.
