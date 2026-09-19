# Verifikasi TAJAM FTI lokal

18 September 2026.

- 19 pengujian otomatis: validasi status/tanggal/URL, tanggal sama sebagai peringatan, normalisasi serial Excel, baca template asli ber-namespace OOXML, round-trip XLSX, formula ditolak, baris kosong, header rusak, CRUD SQLite, persistensi koneksi, deduplikasi/transaksi impor, filter ekspor ICS, origin lokal, dan konten PDF.
- TypeScript: tidak ada error.
- Build produksi Next.js: berhasil.
- npm audit: 0 vulnerabilities.
- Pengujian API pada database terpisah: create/update/list/delete, status invalid, origin berbeda, ID tidak ditemukan, batch invalid, impor duplikat. Data pengujian API dibersihkan oleh skripnya sendiri.
- Browser desktop: tambah konten, edit Draf ke Terbit lalu Batal, arsip, pencarian tanpa hasil/reset, unduh Excel, impor satu baris XLSX, dan membaca template asli kosong tanpa mengimpor sheet contoh.
- Browser responsif 390 × 844: dashboard, navigasi, dan laporan ditinjau secara visual; viewport dikembalikan setelah uji.
- PDF hasil unduhan browser benar-benar ada, terbaca oleh pypdf dan dirender dengan Poppler; ringkasan, grafik, tabel dua baris, dan footer diperiksa. Header nomor tabel diperpendek menjadi # untuk menghindari pembungkusan.
- Review independen menemukan ekspor ICS yang belum mengikuti jenis jadwal/bulan dan reload setelah mutasi yang dapat melaporkan kegagalan palsu. Kedua temuan diperbaiki.

Data browser uji berada di `test-results/browser-test.db`, terpisah dari `data/tajam.db` yang digunakan aplikasi kerja.

Batas pada versi lokal awal: belum ada login; ekspor ICS bersifat manual. Dukungan cloud ditambahkan pada pemeriksaan berikut.

Final handoff (2026-09-19): production server running at http://127.0.0.1:3000; page HTTP 200, API returns an empty array using default data/tajam.db. QA data remains isolated in test-results/browser-test.db.

## Penyesuaian cloud — 19 September 2026

- 30 tes lulus, termasuk 5 tes integrasi pada PostgreSQL 17 nyata yang berjalan di cluster sementara terpisah: CRUD, persistensi koneksi, impor paralel tanpa duplikat, batch invalid, pembaruan fingerprint, dan teks mirip SQL.
- Pemeriksaan akses: database cloud tidak fallback ke SQLite; email cocok persis; provider Google dan email terverifikasi wajib; konfigurasi tidak lengkap gagal tertutup; origin HTTPS dikonfigurasi eksplisit.
- `npm run test:cloud` lulus pada build produksi: halaman dan semua endpoint terlindungi; sesi anggota diterima, sesi di luar daftar/tidak terverifikasi/kedaluwarsa/rusak ditolak; respons data no-store; origin asing ditolak; CRUD/impor menggunakan PostgreSQL nyata.
- Migrasi SQL dijalankan dua kali dan berhasil tanpa menghapus data.
- TypeScript dan build produksi berhasil. npm audit production: 0 vulnerabilities.
- Review independen tidak menemukan bug penting pada cakupan autentikasi, adapter database, dan pengecualian publikasi.
- Belum diuji: callback OAuth Google nyata, koneksi Neon milik pengguna, deployment Netlify live. Tes sesi memakai token terenkripsi lokal dan kredensial OAuth dummy khusus proses pengujian; tidak ada jalur bypass autentikasi pada aplikasi.

Repositori publik terverifikasi: https://github.com/abdurojak/tajam-fti (branch main). File environment rahasia, data SQLite, hasil tes, log, dan node_modules tidak dilacak Git.
