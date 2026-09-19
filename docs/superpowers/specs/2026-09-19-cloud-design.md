# TAJAM FTI: Netlify, Neon, dan GitHub publik

Pengguna menyetujui penyesuaian Netlify + Neon dan publikasi kode di GitHub publik. UI, format Excel, status, dan data lokal dipertahankan.

## Penyimpanan

`DATABASE_URL` memilih PostgreSQL Neon melalui node-postgres. Tanpa URL, mode komputer lokal tetap SQLite. Runtime Netlify wajib menggunakan database eksternal dan tidak boleh diam-diam menggunakan file sementara. API menjadi asinkron. Skema SQL disiapkan dengan perintah migrasi eksplisit, bukan saat build. Kredensial hanya di environment server.

CRUD dan impor mempertahankan validasi yang sama. Impor PostgreSQL adalah satu transaksi: satu data invalid membatalkan seluruh batch, duplikat persis dilewati termasuk pada impor serentak. Migrasi tidak menghapus data. Ekspor/impor Excel bisa digunakan memindahkan isi lokal ke cloud.

## Akses

Website tim memerlukan login Google (dipilih pengguna) dan pemeriksaan sesi pada setiap API. Email Google harus terverifikasi dan tercantum pada allowlist server. Konfigurasi cloud yang belum lengkap harus menolak akses, bukan membuka data. Mode lokal tetap dapat digunakan tanpa akun.

## Publikasi

Repositori publik berisi kode, template kosong untuk pengujian, panduan, SQL, serta contoh environment tanpa nilai rahasia. Folder database, file environment, log, hasil pengujian browser, dan dependency tidak dipublikasikan. Nama yang diusulkan `tajam-fti`. GitHub terhubung melalui connector; autentikasi CLI belum tersedia saat pemeriksaan awal.

Deployment live memerlukan database Neon dan konfigurasi akses milik pengguna. Permintaan saat ini mencakup penyesuaian dan push kode; tidak mengasumsikan kredensial sudah tersedia.

## Verifikasi

Uji PostgreSQL nyata pada cluster lokal sementara, termasuk CRUD, rollback, persistensi, dan impor serentak. Uji akses anonim dan sesi, origin HTTPS di belakang proxy, SQLite regresi, typecheck, dan build. Tinjau daftar file sebelum push. Catat terpisah pemeriksaan lokal dan layanan cloud yang belum dapat diuji.
