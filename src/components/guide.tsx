import {
  ArrowUpRight,
  CalendarDays,
  Database,
  FileSpreadsheet,
  Lightbulb,
} from "lucide-react";
export default function Guide({ cloud = false }: { cloud?: boolean }) {
  return (
    <div className="guide-grid">
      <section className="panel guide-intro">
        <span className="eyebrow">KENALI RUANG KERJAMU</span>
        <h2>
          Lima langkah.
          <br />
          Banyak cerita.
        </h2>
        <p>
          TAJAM membantu tim FTI mengubah informasi menjadi konten yang
          terencana. Tidak ada alur persetujuan; setiap anggota dapat langsung
          mengerjakan rencananya.
        </p>
        <ol className="guide-process">
          {[
            ["Tangkap", "Catat kegiatan, informasi, atau bahan awal."],
            ["Arahkan", "Pilih ide, kategori, format, dan channel publikasi."],
            ["Jadwalkan", "Tentukan tanggal acara, tanggal upload, dan PIC."],
            ["Aksi", "Kerjakan konten. Simpan sebagai Draf selama prosesnya."],
            [
              "Muat",
              "Ubah menjadi Terbit setelah publikasi dan tambahkan link hasilnya.",
            ],
          ].map(([word, detail]) => (
            <li key={word}>
              <b>{word[0]}</b>
              <div>
                <strong>{word}</strong>
                <p>{detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <div className="guide-stack">
        {[
          {
            icon: Lightbulb,
            title: "Tiga status, tanpa approval",
            text: "Draf: direncanakan atau sedang dikerjakan. Terbit: sudah dipublikasikan. Batal: tidak dilanjutkan dan masuk Arsip. Status Batal dapat diubah kembali lewat edit konten.",
          },
          {
            icon: FileSpreadsheet,
            title: "Excel masuk, laporan keluar",
            text: "Unduh template baru agar dropdown status sesuai. Isi sheet Template Import, lalu periksa pratinjau. Baris kosong diabaikan, duplikat persis dilewati. Ekspor Excel mengikuti filter; PDF tersedia di menu Laporan.",
          },
          {
            icon: CalendarDays,
            title: "Satu kalender, dua tanggal",
            text: "Acara ditandai biru, upload ditandai hijau. Ekspor .ics dapat diimpor manual ke Google Calendar. Sinkronisasi otomatis dan reminder Google belum terhubung; membutuhkan konfigurasi OAuth dan izin kalender.",
          },
          {
            icon: Database,
            title: cloud
              ? "Satu data untuk seluruh tim"
              : "Data tersimpan di komputer ini",
            text: cloud
              ? "Rencana tersimpan di database bersama. Masuk menggunakan akun Google yang didaftarkan pengelola. Muat ulang halaman untuk melihat perubahan terbaru dari anggota lain. Gunakan ekspor Excel untuk menyimpan salinan data tim."
              : "Data disimpan di SQLite pada folder data/tajam.db dan tetap ada setelah restart. Cadangkan folder data saat server berhenti. Mode lokal tanpa konfigurasi cloud hanya diakses dari komputer ini.",
          },
        ].map((item) => (
          <section className="panel guide-card" key={item.title}>
            <span className="guide-icon">
              <item.icon size={21} />
            </span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
