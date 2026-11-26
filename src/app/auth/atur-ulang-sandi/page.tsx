// src/app/atur-ulang-sandi/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function AturUlangSandiPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setSessionReady(true);
      }
    };
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setSessionReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Kata sandi baru minimal 8 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 2000);
  };

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-surface text-on-surface flex flex-col justify-between selection:bg-primary-fixed selection:text-on-primary-fixed antialiased">
      {/* TOP HEADER */}
      <header className="fixed top-0 inset-x-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-14 sm:h-16 max-w-7xl mx-auto px-3.5 sm:px-6 md:px-8 flex items-center justify-between gap-2">
          <Link
            href="/masuk"
            className="flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface transition-colors py-2 px-2.5 sm:px-3 rounded-lg hover:bg-surface-container-high text-sm font-semibold shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">
              arrow_back
            </span>
            <span className="hidden sm:inline whitespace-nowrap">
              Kembali ke Masuk
            </span>
          </Link>

          <Link href="/" className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-on-primary text-[20px]">
                bolt
              </span>
            </div>
            <span className="font-bold text-base sm:text-lg text-on-surface tracking-tight truncate">
              Smart Tracker Listrik
            </span>
          </Link>

          <div className="w-9 sm:w-36 flex justify-end shrink-0" />
        </div>
      </header>

      {/* MAIN CARD */}
      <main className="w-full pt-16 sm:pt-20 flex-1 flex flex-col items-center justify-center px-3.5 sm:px-6 md:px-8 py-6 sm:py-10 bg-surface">
        <div className="w-full max-w-[440px] bg-surface-container-lowest rounded-2xl p-5 sm:p-8 shadow-sm border border-surface-dim flex flex-col">
          <div className="mb-6 text-center">
            <h1 className="font-bold text-2xl sm:text-[28px] leading-tight sm:leading-[36px] text-on-surface tracking-tight">
              Buat Kata Sandi Baru
            </h1>
            <p className="text-sm sm:text-base text-on-surface-variant mt-1.5">
              Masukkan kata sandi baru untuk mengamankan akun pemantauan Anda.
            </p>
          </div>

          {success ? (
            <div className="p-4 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-start gap-3">
              <span className="material-symbols-outlined text-primary-container text-[22px] shrink-0 mt-0.5">
                check_circle
              </span>
              <div className="text-xs sm:text-sm text-on-surface leading-relaxed">
                <strong>Kata sandi berhasil diperbarui!</strong> Mengalihkan ke
                dashboard...
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleUpdatePassword}
              className="flex flex-col gap-4 sm:gap-5"
              noValidate
            >
              {!sessionReady && (
                <div className="p-3.5 rounded-xl bg-secondary-fixed/50 border border-secondary-container/40 text-xs sm:text-sm text-on-secondary-fixed font-medium">
                  Pastikan Anda membuka halaman ini langsung dari tautan di
                  email pemulihan kata sandi.
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-error-container/60 border border-error/20 flex items-start gap-2.5"
                >
                  <span className="material-symbols-outlined text-error text-[20px] shrink-0 mt-0.5">
                    error
                  </span>
                  <span className="text-xs sm:text-sm text-error font-semibold leading-snug">
                    {error}
                  </span>
                </div>
              )}

              {/* Kata Sandi Baru */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="new-password"
                  className="text-sm font-semibold text-on-surface"
                >
                  Kata Sandi Baru <span className="text-error">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3.5 text-[20px] text-outline pointer-events-none">
                    lock
                  </span>
                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="Minimal 8 karakter"
                    className="w-full h-12 pl-11 pr-12 rounded-xl text-base bg-surface-container-lowest text-on-surface border border-surface-dim focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none placeholder:text-outline"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword ? "Sembunyikan sandi" : "Tampilkan sandi"
                    }
                    className="absolute right-2 text-outline hover:text-on-surface transition-colors w-9 h-9 flex items-center justify-center cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Konfirmasi Kata Sandi */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="confirm-new-password"
                  className="text-sm font-semibold text-on-surface"
                >
                  Ulangi Kata Sandi Baru <span className="text-error">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3.5 text-[20px] text-outline pointer-events-none">
                    lock_check
                  </span>
                  <input
                    id="confirm-new-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="Ketik ulang kata sandi baru"
                    className="w-full h-12 pl-11 pr-4 rounded-xl text-base bg-surface-container-lowest text-on-surface border border-surface-dim focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none placeholder:text-outline"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-primary hover:bg-primary-container text-on-primary font-semibold text-base rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 mt-1 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
              >
                <span>
                  {loading ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
                </span>
                {!loading && (
                  <span className="material-symbols-outlined text-[20px]">
                    check
                  </span>
                )}
              </button>
            </form>
          )}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="w-full bg-surface py-4 sm:py-5 shadow-[0_-1px_8px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 text-center text-xs font-semibold text-on-surface-variant leading-relaxed">
          © 2026 Smart Tracker Listrik IoT. Pemantauan Perangkat Rumah Tangga.
        </div>
      </footer>
    </div>
  );
}
