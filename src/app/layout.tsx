import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "TAJAM FTI — Ruang Perencanaan Konten",
  description:
    "Tangkap, Arahkan, Jadwalkan, Aksi, Muat. Ruang perencanaan konten FTI.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        {process.env.NETLIFY === "true" && (
          <aside className="migration-announcement" aria-label="Pengumuman alamat baru TAJAM">
            <div className="migration-symbol" aria-hidden="true">↗</div>
            <div className="migration-copy">
              <span>TAJAM PINDAH KE SERVER FTI</span>
              <strong>Akses TAJAM melalui alamat baru</strong>
              <p>Gunakan server Lab1 untuk melanjutkan perencanaan konten tim.</p>
            </div>
            <a href="https://lab1.trisakti.ac.id/tajam-fti">Buka TAJAM Baru <span aria-hidden="true">↗</span></a>
          </aside>
        )}
        {children}
      </body>
    </html>
  );
}
