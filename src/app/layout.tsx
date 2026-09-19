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
      <body>{children}</body>
    </html>
  );
}
