# TAJAM FTI

**Tangkap · Arahkan · Jadwalkan · Aksi · Muat**

Aplikasi perencanaan konten berbasis Next.js, React, dan TypeScript. SQLite untuk penggunaan lokal; PostgreSQL Neon dan login Google untuk tim online di Netlify. Mengikuti 12 kolom template Excel TAJAM FTI. Status **Draf**, **Terbit**, **Batal**; tanpa approval.

Untuk versi online, ikuti **[panduan Netlify + Neon + login Google](docs/deployment.md)**. Kode siap dikonfigurasi; database dan kredensial layanan tidak disertakan.

## Menjalankan lokal

Butuh Node.js 20.9 atau lebih baru (Node LTS disarankan) dan npm.

```powershell
cd D:\Koding\Next\trisakti
npm install
npm run dev
```

Buka **http://127.0.0.1:3000**. Hentikan dengan Ctrl+C di terminal. Untuk build produksi lokal:

```powershell
npm run build
npm start
```

Server default hanya mendengarkan loopback komputer ini. Tidak memerlukan Neon, Netlify, Vercel, atau akun Google. Font tersedia sebagai paket lokal sehingga UI tidak bergantung pada Google Fonts.

## Fitur

- Dashboard: jumlah aktif/draf/terbit, upload bulan ini, komposisi kategori, dan jadwal mendatang.
- Tambah, edit, dan hapus konten; pencarian dan filter prodi, kategori, status, PIC, bulan upload.
- Arsip Batal terpisah. Ubah kembali menjadi Draf untuk melanjutkan konten.
- Kalender acara dan upload, navigasi bulan, serta ekspor ICS sesuai bulan dan jenis jadwal.
- Impor `.xlsx` di browser: pratinjau per baris, validasi, dan deduplikasi persis. File sumber tidak disimpan. Maksimal 5 MB / 5.000 baris. Data valid disimpan secara transaksional; kesalahan satu baris memblokir batch.
- Ekspor `.xlsx` sesuai filter. Template baru memiliki dropdown Draf/Terbit/Batal.
- Laporan dengan grafik kategori/prodi, status, dan seluruh detail. Pilih **Unduh PDF** untuk unduhan langsung, atau **Cetak** untuk dialog cetak browser. PDF menggunakan A4 landscape.
- Layout responsif, panduan penggunaan, dan opsi memuat tiga contoh template secara eksplisit. Data awal kosong.

## Aturan template

Gunakan sheet **Template Import** dan pertahankan header aslinya. Isi semua kolom kecuali link publikasi dan catatan yang opsional. `Draft` dari template lama diterima sebagai alias `Draf`; `Disetujui`/`Ditolak` harus diganti sesuai realisasi konten, tidak otomatis dikonversi menjadi Terbit/Batal. Tanggal acara dan upload yang sama menghasilkan peringatan, bukan penolakan. Format tanggal `YYYY-MM-DD`, `DD/MM/YYYY`, atau sel tanggal Excel. Formula harus ditempel sebagai nilai sebelum impor. File asli yang memakai prefix namespace OOXML didukung tanpa mengubah sumber.

## Penyimpanan dan pencadangan

Database dibuat otomatis di `data/tajam.db`. Data tetap ada setelah server berhenti/restart. Folder `data/` diabaikan Git. Untuk cadangan, hentikan server lalu salin seluruh folder `data/` (termasuk berkas WAL/SHM jika masih ada). Menghapus folder ini akan menghapus data aplikasi.

Untuk pengujian terisolasi, variabel `TAJAM_DB_PATH` dapat menunjuk file lain. Jangan gunakan database uji untuk data kerja. Semua browser yang mengakses server/database sama melihat sumber data yang sama; muat ulang halaman untuk mengambil perubahan dari browser lain.

## Batas versi ini

- **Login Google tersedia untuk mode cloud**, dibatasi `ALLOWED_EMAILS`. Semua anggota memiliki akses penuh ke data tim. Mode lokal tanpa environment cloud tetap tanpa login dan hanya mendengarkan loopback.
- **Google Calendar belum tersinkron otomatis.** Ekspor ICS adalah impor manual. Mengubah data aplikasi tidak otomatis mengubah acara yang sudah diimpor. OAuth, izin kalender, dan reminder Google merupakan tahap integrasi berikutnya.
- Deployment Netlify wajib memakai `DATABASE_URL` PostgreSQL/Neon. Konfigurasi login yang belum lengkap menutup akses; tidak ada fallback SQLite di runtime serverless.

## Pemeriksaan

```powershell
npm test
npm run typecheck
npm run build
npm audit
```

`node scripts/check-api.mjs` menguji endpoint pada server lokal aktif dan membersihkan data yang dibuatnya sendiri. Jalankan pada database uji. `tests/fixtures/template-original.xlsx` adalah salinan read-only template pengguna untuk uji kompatibilitas; file sumber di Downloads tetap utuh.

## Struktur kode

- `src/lib/domain.ts`: model, pilihan dropdown, dan validasi bersama.
- `src/lib/store.ts`: akses SQLite dan impor transaksional.
- `src/lib/postgres-store.ts`: PostgreSQL, transaksi, dan pencegahan duplikat impor bersamaan.
- `src/lib/database.ts`: pemilihan adapter lokal/cloud.
- `src/lib/auth.ts`: login Google, sesi, serta perlindungan API.
- `src/lib/workbook.ts`: pembacaan/ekspor Excel dan normalisasi namespace OOXML.
- `src/lib/download.ts`: unduhan dan ekspor kalender.
- `src/app/api/`: endpoint CRUD/impor dengan pemeriksaan origin dan validasi server.
- `src/components/`: dashboard, formulir, tabel/filter, kalender, impor, laporan, dan panduan.

Override `exceljs → uuid 11.1.1+` mempertahankan API `v4` yang digunakan ExcelJS dan menghindari advisory pada uuid versi lama. Vitest 4.1.11 dengan Vite 6 dipilih agar kompatibel dengan Node 20 yang terpasang.
