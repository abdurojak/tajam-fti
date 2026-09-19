# Deploy TAJAM FTI ke Netlify + Neon

Kode publik tidak berarti data aplikasi publik. Database, daftar anggota, dan kredensial tetap berada di environment server. Admin dapat melihat seluruh FTI; Editor dan Viewer hanya dapat mengakses prodi yang berada dalam cakupannya.

## 1. Siapkan Neon

Buat proyek/database Neon khusus TAJAM. Salin connection string **pooled** dari panel Connect. Gunakan TLS seperti yang diberikan Neon (`sslmode=require` atau mode verifikasi yang disarankan Neon); jangan menonaktifkan pemeriksaan sertifikat. Gunakan branch/database terpisah untuk pengujian.

Di komputer, salin `.env.example` menjadi `.env.local`, lalu isi `DATABASE_URL` dengan connection string. Jangan kirim nilainya ke chat atau commit ke Git.

```sh
npm install
npm run db:migrate
```

Migrasi membuat tabel dan indeks jika belum ada, mempertahankan data lama, serta mengisi struktur organisasi dan sembilan akun awal. Seed tidak menimpa nama, status, role, atau cakupan yang kelak diubah Admin. Build tidak menghubungi database dan tidak menjalankan migrasi. Database harus siap sebelum aplikasi digunakan.

## 2. Siapkan login Google

Di Google Cloud Console, buat OAuth client bertipe **Web application** dan atur consent screen. Bila aplikasi masih berstatus Testing, tambahkan anggota tim sebagai test users. Untuk organisasi Google Workspace, gunakan pengaturan audience yang sesuai akun organisasi.

Authorized redirect URI untuk produksi:

```text
https://nama-situs.netlify.app/api/auth/callback/google
```

Untuk pengujian lokal gunakan URI terpisah, misalnya `http://localhost:3000/api/auth/callback/google`, dan gunakan host yang sama pada `NEXTAUTH_URL` serta browser. Jika domain berubah, perbarui kedua konfigurasi.

Aplikasi hanya meminta identitas, email, dan profil (`openid email profile`). Izin Gmail/Calendar belum diminta. Email harus terverifikasi Google dan tercatat sebagai anggota aktif di database; tidak ada pendaftaran bebas. Role dan cakupan diperiksa lagi pada setiap permintaan sehingga perubahan Admin berlaku langsung tanpa deployment. Sesi berlaku delapan jam.

Role yang tersedia:

- **Admin** melihat dan mengubah seluruh data, serta mengelola anggota, jurusan, dan prodi.
- **Editor** melihat serta mengubah konten pada jurusan atau prodi yang ditetapkan.
- **Viewer** hanya melihat konten pada jurusan atau prodi yang ditetapkan.

Admin dapat menonaktifkan akun tanpa menghapus riwayat. Setiap perubahan anggota dan struktur organisasi dicatat dalam audit log. Sistem selalu mempertahankan sedikitnya satu Admin aktif.

## 3. Hubungkan Netlify dengan GitHub

Import repositori GitHub pada dashboard Netlify. `netlify.toml` telah menetapkan build `npm run build`, publish `.next`, Node 22. Netlify mendeteksi Next.js dan memasang adapter OpenNext otomatis. Jangan mengubahnya menjadi static export atau menambahkan redirect SPA.

Tambahkan environment berikut di dashboard Netlify. Terapkan untuk **Builds dan Functions** pada production; jangan hanya menaruhnya pada `netlify.toml`.

| Nama | Nilai |
|---|---|
| `DATABASE_URL` | Connection string pooled Neon |
| `NEXTAUTH_URL` | Origin produksi, misalnya `https://nama-situs.netlify.app` |
| `NEXTAUTH_SECRET` | Nilai acak rahasia, minimal 32 karakter |
| `GOOGLE_CLIENT_ID` | Client ID OAuth Google |
| `GOOGLE_CLIENT_SECRET` | Client secret OAuth Google |

Buat secret lokal dengan `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`, lalu simpan hanya di environment. Jangan menggunakan nilai contoh sebagai secret asli. Jangan memberi awalan `NEXT_PUBLIC_` pada nilai di atas.

Setelah mengubah environment, lakukan redeploy. Deploy preview sebaiknya memakai database dan OAuth client terpisah; jangan memberi production secrets pada PR dari kontributor yang tidak dipercaya. Tanpa konfigurasi lengkap, halaman login menampilkan pesan persiapan dan API menolak akses.

## 4. Pindahkan data lokal bila diperlukan

Mode lokal tanpa environment cloud tetap memakai `data/tajam.db`. Database ini tidak diunggah ke GitHub atau Netlify. Ekspor Excel dari aplikasi lokal dengan seluruh filter direset; sertakan status Batal melalui menu Laporan jika diperlukan. Login ke aplikasi online, lalu impor file tersebut. Impor mempertahankan isi 12 kolom, tetapi membuat ID/waktu pencatatan baru.

## 5. Periksa sesudah deployment

- Pengunjung anonim diarahkan ke login; `/api/content` menolak akses tanpa sesi.
- Akun di luar daftar anggota aktif tidak bisa masuk; akun anggota dapat masuk dan keluar.
- Admin melihat menu **Kelola anggota** dan **Kelola organisasi**; Editor/Viewer tidak melihat menu tersebut.
- Editor hanya dapat membuat atau mengubah konten pada cakupannya; Viewer tidak melihat tombol perubahan.
- Tambah/edit konten dan muat ulang untuk memastikan data tetap tersimpan.
- Coba impor Excel, unduh Excel/PDF, dan ekspor kalender.
- Masuk dari perangkat kedua dan muat ulang untuk melihat data tim yang sama.

Sinkronisasi langsung antar-tab belum tersedia; muat ulang untuk mengambil perubahan anggota lain. Jika dua anggota mengedit baris sama, penyimpanan terakhir menjadi hasil akhir. Gmail reminder dan Google Calendar otomatis masih memerlukan integrasi terpisah. Batas penggunaan/biaya mengikuti paket akun Netlify dan Neon; kode ini tidak menjamin hosting gratis selamanya.

## Pengujian terisolasi

`TEST_DATABASE_URL` hanya boleh menunjuk database tes kosong/sekali pakai: suite PostgreSQL membersihkan tabel `content`. Nilai ini tidak otomatis mengambil `DATABASE_URL` aplikasi.

```sh
npm test
npm run build
npm run typecheck
npm run test:cloud
```

`test:cloud` membutuhkan `TEST_DATABASE_URL` dan build produksi; menjalankan server tes port 3307 dengan identitas OAuth dummy dan cookie sesi tes, memeriksa penjagaan akses, CRUD, dan impor paralel, lalu menghentikan server. Ini tidak menggantikan pengujian login Google nyata setelah kredensial produksi tersedia. GitHub Actions menjalankan rangkaian tersebut dengan PostgreSQL 17 sementara tanpa rahasia produksi.

Referensi: [Next.js di Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/), [environment Netlify](https://docs.netlify.com/build/environment-variables/overview/), [Neon untuk Node.js](https://neon.com/docs/guides/node), [Google provider NextAuth](https://next-auth.js.org/providers/google).
