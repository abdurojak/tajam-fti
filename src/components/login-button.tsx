"use client";
import { signIn, signOut } from "next-auth/react";
import { useState } from "react";
export function LoginButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        className="button primary login-button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await signIn("google", { callbackUrl: "/" });
          } catch {
            setError("Belum dapat membuka login Google. Silakan coba lagi.");
            setBusy(false);
          }
        }}
      >
        {busy ? "Membuka Google…" : "Masuk dengan Google"}
      </button>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
export function LogoutButton() {
  return (
    <button
      className="nav-item"
      onClick={() => void signOut({ callbackUrl: "/login" })}
    >
      Keluar akun
    </button>
  );
}
