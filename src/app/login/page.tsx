import { redirect } from "next/navigation";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { accessMode, authConfigurationReady } from "@/lib/access";
import { currentMember } from "@/lib/auth";
import { LoginButton, LogoutButton } from "@/components/login-button";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (accessMode() === "local") redirect("/");
  const ready = authConfigurationReady();
  if (ready && (await currentMember())) redirect("/");
  const { error } = await searchParams;
  return (
    <main className="login-shell">
      <section className="login-card">
        <span className="brand-mark">
          <ArrowUpRight size={30} />
        </span>
        <p className="eyebrow">TAJAM FTI · RUANG KERJA TIM</p>
        <h1>
          Ide bersama.
          <br />
          Cerita yang terencana.
        </h1>
        <p>
          Masuk untuk mengatur rencana konten, kalender, dan laporan bersama tim
          kreatif FTI.
        </p>
        {ready ? (
          <>
            {error && (
              <div className="notice error" role="alert">
                {error === "AccessDenied"
                  ? "Akun ini belum terdaftar sebagai anggota tim. Gunakan email yang diizinkan atau hubungi pengelola."
                  : "Login belum berhasil. Silakan coba lagi atau hubungi pengelola."}
              </div>
            )}
            <LoginButton />
            <div className="login-note">
              <ShieldCheck size={18} />
              <span>
                Hanya akun Google anggota tim yang terdaftar dapat masuk.
              </span>
            </div>
            <LogoutButton />
          </>
        ) : (
          <div className="notice" role="status">
            Ruang kerja sedang disiapkan. Pengelola perlu melengkapi konfigurasi
            login Google sebelum tim dapat masuk.
          </div>
        )}
      </section>
      <p className="login-footer">
        Tangkap · Arahkan · Jadwalkan · Aksi · Muat
      </p>
    </main>
  );
}
