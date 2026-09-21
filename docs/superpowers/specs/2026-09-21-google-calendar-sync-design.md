# Desain Sinkronisasi Google Calendar TAJAM FTI

## Tujuan

TAJAM FTI menyinkronkan setiap tanggal acara pada rencana konten ke satu kalender Google bersama milik tim. Pembuatan, perubahan, pembatalan, dan penghapusan rencana harus tercermin pada event yang sama tanpa duplikasi. Data TAJAM tetap tersimpan bila Google Calendar sedang gagal.

## Batas Fitur

- Satu kalender tim bersama ditetapkan melalui `GOOGLE_CALENDAR_ID`.
- Hanya `dateEvent` yang disinkronkan. `dateUpload` tetap tampil pada kalender internal dan ekspor ICS, tetapi tidak membuat event Google.
- Status Draf dan Terbit memiliki event Google Calendar.
- Status Batal serta penghapusan konten menghapus event Google.
- Event dibuat sebagai agenda sepanjang hari.
- Pembuatan lewat formulir maupun impor Excel mengikuti aturan yang sama.
- Sinkronisasi berlangsung satu arah dari TAJAM ke Google Calendar. Perubahan langsung di Google Calendar tidak ditarik kembali ke TAJAM.

## Pendekatan Otorisasi

Integrasi memakai OAuth milik pengguna yang sedang masuk. Provider Google meminta scope identitas yang sudah ada ditambah scope minimum `https://www.googleapis.com/auth/calendar.events`, `access_type=offline`, dan persetujuan yang memastikan refresh token tersedia. Access token, refresh token, dan waktu kedaluwarsa disimpan dalam JWT NextAuth yang dienkripsi oleh `NEXTAUTH_SECRET`; nilai tersebut tidak dimasukkan ke objek sesi browser.

Setiap anggota harus:

1. terdaftar aktif di TAJAM;
2. login ulang dan menyetujui izin Calendar; dan
3. memiliki izin mengubah event pada kalender tim bersama.

Semua panggilan Google dilakukan dari server. Hak TAJAM tetap diperiksa sebelum sinkronisasi, sehingga scope Calendar tidak memperluas cakupan jurusan atau prodi pengguna.

## Model Data

Migrasi PostgreSQL baru membuat tabel `content_calendar_events`:

- `content_id`, primary key dan identitas logis konten tanpa foreign key, agar pekerjaan penghapusan tetap ada setelah konten dihapus;
- `calendar_id`, kalender tujuan saat pemetaan dibuat;
- `google_event_id`, nullable hingga pembuatan berhasil;
- `desired_action`, salah satu `upsert` atau `delete`;
- `sync_status`, salah satu `pending`, `synced`, atau `failed`;
- `last_error`, pesan aman yang tidak mengandung token atau respons mentah;
- `last_synced_at`, nullable;
- `created_at` dan `updated_at`.

Pemetaan menggunakan satu baris per konten. Operasi create/update menggunakan `google_event_id` yang sama. Baris beraksi `delete` bertindak sebagai tombstone sampai Google mengonfirmasi penghapusan, lalu dapat dihapus. Perubahan kalender tujuan tidak memindahkan event lama secara diam-diam; konfigurasi tersebut harus dimigrasikan secara eksplisit.

Mode SQLite lokal tidak menghubungi Google. Kalender internal dan ekspor ICS tetap berfungsi seperti sekarang.

## Bentuk Event

- Ringkasan: ide konten.
- Tanggal mulai: `dateEvent`.
- Tanggal akhir: satu hari setelah `dateEvent`, mengikuti aturan eksklusif event sepanjang hari Google Calendar.
- Deskripsi: prodi, kegiatan, channel, PIC, format, status, catatan, dan penanda bahwa event dikelola TAJAM.
- Extended property privat: ID konten TAJAM untuk membantu pemeriksaan dan pemulihan tanpa menampilkan data tambahan kepada pengguna kalender.

Semua teks dinormalisasi sebelum dikirim. Tautan publikasi hanya dicantumkan bila valid dan tersedia.

## Alur Sinkronisasi

### Buat dan Ubah

Penyimpanan konten dan penandaan status `pending` dilakukan dalam transaksi database yang sama. Setelah commit, server mencoba sinkronisasi menggunakan token pengguna:

- tanpa `google_event_id`, buat event baru dan simpan ID hasilnya;
- dengan `google_event_id`, perbarui event tersebut;
- bila event yang tersimpan sudah hilang dari Google, buat ulang tepat satu event dan ganti ID pemetaan.

Respons mutasi mengembalikan konten beserta ringkasan status sinkronisasi. Kegagalan Calendar tidak membatalkan konten yang sudah tersimpan.

### Batal dan Hapus

Perubahan status menjadi Batal menandai sinkronisasi penghapusan. Penghapusan konten juga mempertahankan pekerjaan penghapusan event sampai Google mengonfirmasi atau menyatakan event sudah tidak ada. Setelah berhasil, pemetaan dapat dihapus. Mengaktifkan kembali konten Batal membuat event baru.

### Impor

Impor tetap bersifat transaksional untuk data TAJAM. Setiap konten baru mendapat pekerjaan `pending`. Setelah impor selesai, browser memanggil endpoint sinkronisasi batch dengan jumlah kecil dan berulang sampai seluruh baris impor diproses. Endpoint bersifat idempoten dan memeriksa kembali akses pengguna pada setiap batch.

### Retry

Pengguna dapat menjalankan ulang item berstatus `failed` atau `pending`. Retry memakai ID event yang sudah ada dan tidak membuat duplikat. Tidak ada scheduler berbayar yang diperlukan pada tahap ini; retry otomatis hanya terjadi sesudah mutasi langsung dan selama alur batch impor.

## Antarmuka

- Setiap baris rencana menampilkan status **Tersinkron**, **Menunggu**, atau **Gagal**.
- Item gagal memiliki tombol **Sinkronkan ulang** bagi Admin dan Editor yang berhak mengubah konten tersebut.
- Pesan setelah menyimpan membedakan “rencana dan kalender berhasil” dari “rencana tersimpan, kalender belum tersinkron”.
- Halaman panduan menjelaskan login ulang, izin kalender, dan kebutuhan hak edit pada kalender tim.
- Bila `GOOGLE_CALENDAR_ID` belum tersedia, aplikasi menampilkan integrasi belum dikonfigurasi dan tidak berpura-pura bahwa event sudah dibuat.

Viewer dapat melihat status tetapi tidak dapat menjalankan retry.

## Penanganan Kesalahan

Kesalahan dipetakan ke pesan aman: izin OAuth kurang, refresh token tidak tersedia, kalender tidak ditemukan, tidak memiliki hak edit, batas Google sementara, atau gangguan jaringan. Detail mentah hanya dicatat pada log server tanpa token. Kesalahan sementara menghasilkan status `pending`; kesalahan konfigurasi atau izin menghasilkan `failed`.

Refresh access token dilakukan di server sebelum panggilan Calendar ketika token kedaluwarsa. Jika refresh ditolak, pengguna diminta keluar dan login kembali. Permintaan Google memakai batas waktu dan tidak diulang tanpa batas.

## Pengujian

- Unit: bentuk event, tanggal akhir eksklusif, deskripsi, status Batal, serta klasifikasi kesalahan.
- OAuth: scope, token server-only, refresh berhasil/gagal, dan sesi lama tanpa refresh token.
- Sinkronisasi: create, update dengan ID sama, pemulihan event 404, delete idempoten, serta retry tanpa duplikasi.
- Database: migrasi, transisi `pending/synced/failed`, dan pekerjaan penghapusan yang bertahan setelah konten dihapus.
- Otorisasi: Viewer ditolak, Editor dibatasi cakupan, dan Admin dapat menyinkronkan semua prodi.
- Impor: batch kecil, kelanjutan setelah kegagalan sebagian, dan tidak ada duplikasi.
- Regresi: tes konten, Excel, PDF, ICS, autentikasi, build, serta integrasi PostgreSQL tetap lulus.

Tes integrasi menggunakan server Google palsu. Verifikasi produksi dilakukan dengan satu event uji pada kalender bersama setelah konfigurasi Google Cloud diperbarui.

## Deployment

1. Aktifkan Google Calendar API pada proyek Google Cloud yang digunakan TAJAM.
2. Tambahkan scope `calendar.events` pada consent screen internal.
3. Buat kalender tim bersama dan berikan izin mengubah event kepada anggota.
4. Tambahkan `GOOGLE_CALENDAR_ID` ke environment Netlify.
5. Jalankan migrasi Neon sebelum deployment kode.
6. Deploy aplikasi, lalu minta anggota keluar dan login kembali untuk persetujuan baru.
7. Buat, ubah, batalkan, dan hapus satu rencana uji; pastikan hanya satu event yang mengikuti seluruh perubahan.

Rollback kode tidak menghapus tabel atau event yang sudah dibuat. Bila integrasi harus dihentikan, kosongkan konfigurasi setelah memastikan pekerjaan pending tidak ada; event lama tetap berada di kalender sampai dihapus secara eksplisit.
