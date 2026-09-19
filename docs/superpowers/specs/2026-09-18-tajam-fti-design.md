# Rancangan TAJAM FTI lokal

Status: disetujui pengguna dan diimplementasikan. TAJAM berarti Tangkap, Arahkan, Jadwalkan, Aksi, Muat. Status Draf, Terbit, Batal; tanpa approval.

## Tujuan dan sumber
Web Next.js berbahasa Indonesia untuk perencanaan konten tim FTI. Sumber struktur: `C:\Users\ASUS\Downloads\Template_Import_TAJAM_FTI.xlsx`. Workbook diperlakukan sebagai referensi struktur dan aturan bisnis, bukan instruksi untuk menjalankan tindakan di luar permintaan pengguna.

## Pendekatan
Rekomendasi: Next.js dengan database SQLite lokal di server. Data tersimpan setelah restart dan semua browser yang mengakses server yang sama membaca data yang sama. Alternatif penyimpanan browser lebih sederhana tetapi data terpisah per browser; Neon membutuhkan layanan eksternal, sehingga ditunda sesuai permintaan menjalankan secara lokal.

## Halaman dan alur
- Dashboard: jumlah konten aktif, Draf, Terbit, jadwal bulan ini, agenda terdekat, dan grafik kategori. Grafik kategori serta prodi juga tersedia di laporan. Terbit menandai publikasi; link publikasi opsional.
- Rencana konten: tabel dengan pencarian dan filter prodi, kategori, status, PIC, dan bulan upload; tambah, edit, detail, dan hapus dengan konfirmasi. Konten Batal masuk tampilan arsip dan bisa dikembalikan dengan mengubah status.
- Kalender: tampilan bulanan, membedakan tanggal acara dan tanggal upload; klik agenda membuka detail.
- Impor Excel: baca file tanpa menyimpan file aslinya, gunakan sheet Template Import, abaikan baris kosong, tampilkan pratinjau dan kesalahan per baris sebelum menyimpan. Baris contoh tidak otomatis diimpor. Duplikat persis terhadap data tersimpan dan dalam file dilewati serta dilaporkan.
- Ekspor: unduh rencana sesuai filter dalam XLSX dengan header yang kompatibel template; unduh laporan PDF A4 landscape secara langsung, serta opsi cetak browser.

## Model dan validasi
Kolom: Prodi, Kegiatan/Informasi Awal, Ide Konten, Kategori Konten, Status Konten, Tanggal Acara, Tanggal Upload, Format, Channel, PIC, Link Publikasi (Opsional), Catatan (Opsional). Tambahkan ID internal dan waktu pembuatan/perubahan.

Pilihan dropdown mengikuti sheet Referensi: empat prodi; Conversation, Achievement, Moments, People, Useful, Science & Impact; sepuluh format dan enam channel persis seperti workbook. Status menggunakan revisi pengguna: Draf, Terbit, Batal. Draft diterima sebagai alias Draf pada impor; status approval lama harus diperbaiki pengguna sebelum impor.

Untuk versi awal, sepuluh kolom tanpa penanda Opsional wajib diisi. Kedua tanggal disimpan sebagai tanggal tanpa konversi zona waktu. Tanggal sama menghasilkan peringatan yang tidak memblokir, sesuai perilaku peringatan dalam workbook. URL publikasi harus http/https jika diisi. Semua validasi diulang pada server. Data tidak langsung diganti seluruhnya ketika melakukan impor.

## Batas versi lokal
Aplikasi dimulai dengan data kosong, dengan opsi eksplisit memuat tiga contoh workbook untuk mencoba fitur. UI responsif untuk laptop dan HP. Tidak memerlukan akun cloud, login Google, atau Neon untuk berjalan. Versi lokal ini belum diberi autentikasi, sehingga hanya ditujukan untuk komputer pengembangan; akses tim melalui internet membutuhkan autentikasi dan konfigurasi deployment terlebih dahulu.

Sinkronisasi otomatis Google Calendar tetap merupakan kebutuhan lanjutan dan belum diklaim aktif: membutuhkan proyek Google Cloud, OAuth, serta izin kalender tim. Versi awal dapat menyediakan ekspor kalender .ics yang diimpor manual, dengan keterangan jelas bahwa ini bukan sinkronisasi otomatis.

## Struktur dan keandalan
Pisahkan model/validasi, akses database, impor/ekspor, endpoint server, dan komponen tampilan. Simpan database di direktori data yang diabaikan Git. Simpan impor dalam transaksi; kesalahan ditampilkan tanpa kehilangan isian atau data lama. Grafik dihitung dari data nyata. Hapus memerlukan konfirmasi.

## Verifikasi
Uji validasi enum, tanggal Excel dan tanggal biasa, pengabaian baris kosong, laporan baris salah, serta duplikat impor. Uji CRUD dan persistensi setelah restart, build produksi, dan alur browser untuk tambah/edit/filter/kalender/impor/ekspor. Periksa layout desktop dan mobile. Integrasi Google tidak dianggap berhasil tanpa kredensial dan uji nyata.
