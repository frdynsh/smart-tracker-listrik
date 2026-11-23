// src/app/masuk/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function MasukPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // State Modal Lupa Kata Sandi
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Mohon isi alamat email dan kata sandi Anda.");
      return;
    }

    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      {
        email: trimmedEmail,
        password,
      },
    );

    if (signInError || !data.user) {
      setError(
        "Email atau kata sandi salah. Silakan periksa kembali dan coba lagi.",
      );
      setLoading(false);
      return;
    }

    const { count } = await supabase
      .from("devices")
      .select("*", { count: "exact", head: true })
      .eq("user_id", data.user.id);

    router.refresh();

    if ((count || 0) === 0) {
      router.push("/perangkat");
    } else {
      router.push("/dashboard");
    }
  };

  const openForgotModal = () => {
    setResetEmail(email.trim());
    setResetError("");
    setResetSent(false);
    setForgotModalOpen(true);
  };

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");

    const trimmed = resetEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmed || !emailRegex.test(trimmed)) {
      setResetError("Masukkan alamat email terdaftar yang valid.");
      return;
    }

    setResetLoading(true);
    const redirectUrl = `${window.location.origin}/atur-ulang-sandi`;

    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
      trimmed,
      {
        redirectTo: redirectUrl,
      },
    );

    setResetLoading(false);

    if (resetErr) {
      setResetError(resetErr.message);
      return;
    }

    setResetSent(true);
  };

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-surface text-on-surface flex flex-col justify-between selection:bg-primary-fixed selection:text-on-primary-fixed antialiased">
      {/* 1. FIXED TOP HEADER */}
      <header className="fixed top-0 inset-x-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-14 sm:h-16 max-w-7xl mx-auto px-3.5 sm:px-6 md:px-8 flex items-center justify-between gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface transition-colors py-2 px-2.5 sm:px-3 rounded-lg hover:bg-surface-container-high text-sm font-semibold shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">
              arrow_back
            </span>
            <span className="hidden sm:inline whitespace-nowrap">
              Kembali ke Beranda
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

          {/* Penyeimbang posisi tengah logo */}
          <div className="w-9 sm:w-36 flex justify-end shrink-0" />
        </div>
      </header>

      {/* 2. MAIN CONTENT */}
      <main className="w-full pt-16 sm:pt-20 flex-1 flex flex-col items-center justify-center px-3.5 sm:px-6 md:px-8 py-6 sm:py-10 bg-surface">
        <div className="w-full max-w-[440px] bg-surface-container-lowest rounded-2xl p-5 sm:p-8 shadow-sm border border-surface-dim flex flex-col">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="font-bold text-2xl sm:text-[28px] leading-tight sm:leading-[36px] text-on-surface tracking-tight">
              Masuk ke Akun Anda
            </h1>
            <p className="text-sm sm:text-base text-on-surface-variant mt-1.5">
              Lihat kondisi dan perkiraan biaya perangkat listrik Anda.
            </p>
          </div>

          {/* Interactive Error Banner */}
          {error && (
            <div
              role="alert"
              className="p-3.5 sm:p-4 rounded-xl bg-error-container/60 border border-error/20 flex items-start gap-2.5 sm:gap-3 mb-5"
            >
              <span
                className="material-symbols-outlined text-error text-[20px] sm:text-[22px] shrink-0 mt-0.5"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                error
              </span>
              <span className="text-xs sm:text-sm text-error font-semibold leading-snug">
                {error}
              </span>
            </div>
          )}

          {/* Interactive Login Form */}
          <form
            onSubmit={handleLogin}
            className="flex flex-col gap-4 sm:gap-5"
            noValidate
          >
            {/* Email Field */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-email"
                className="text-sm font-semibold text-on-surface flex flex-wrap items-center justify-between gap-1"
              >
                <span>
                  Alamat Email <span className="text-error">*</span>
                </span>
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-[20px] text-outline pointer-events-none">
                  mail
                </span>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="nama@email.com"
                  className={`w-full h-12 pl-11 pr-4 rounded-xl text-base transition-all placeholder:text-outline focus:outline-none ${
                    error
                      ? "bg-error-container/20 text-error border border-error/50 focus:border-error focus:ring-2 focus:ring-error/20"
                      : "bg-surface-container-lowest text-on-surface border border-surface-dim focus:border-primary focus:ring-2 focus:ring-primary/20"
                  }`}
                />
              </div>
            </div>

            {/* Password Field + Lupa Kata Sandi */}
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="login-password"
                  className="text-sm font-semibold text-on-surface"
                >
                  Kata Sandi <span className="text-error">*</span>
                </label>
                <button
                  type="button"
                  onClick={openForgotModal}
                  className="text-xs sm:text-sm font-semibold text-primary hover:underline cursor-pointer whitespace-nowrap"
                >
                  Lupa kata sandi?
                </button>
              </div>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-[20px] text-outline pointer-events-none">
                  lock
                </span>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="Minimal 8 karakter"
                  className={`w-full h-12 pl-11 pr-12 rounded-xl text-base transition-all placeholder:text-outline focus:outline-none ${
                    error
                      ? "bg-error-container/20 text-error border border-error/50 focus:border-error focus:ring-2 focus:ring-error/20"
                      : "bg-surface-container-lowest text-on-surface border border-surface-dim focus:border-primary focus:ring-2 focus:ring-primary/20"
                  }`}
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

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none min-h-[36px]">
                <input
                  type="checkbox"
                  name="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary border-surface-dim accent-primary cursor-pointer"
                />
                <span className="text-sm font-semibold text-on-surface">
                  Ingat saya di perangkat ini
                </span>
              </label>
            </div>

            {/* Primary Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary hover:bg-primary-container text-on-primary font-semibold text-base rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 mt-1 sm:mt-2 group active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>{loading ? "Memeriksa..." : "Masuk"}</span>
              {!loading && (
                <span className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-1">
                  arrow_forward
                </span>
              )}
            </button>

            {/* Registration Routing Link */}
            <div className="text-center pt-2">
              <p className="text-sm text-on-surface-variant">
                Belum punya akun?{" "}
                <Link
                  href="/daftar"
                  className="text-sm text-primary font-semibold hover:underline whitespace-nowrap"
                >
                  Daftar sekarang
                </Link>
              </p>
            </div>
          </form>
        </div>
      </main>

      {/* 3. FOOTER */}
      <footer className="w-full bg-surface py-4 sm:py-5 shadow-[0_-1px_8px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 text-center text-xs font-semibold text-on-surface-variant leading-relaxed">
          © 2026 Smart Tracker Listrik IoT. Pemantauan Perangkat Rumah Tangga.
        </div>
      </footer>

      {/* 4. MODAL LUPA KATA SANDI */}
      {forgotModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-modal-title"
          className="fixed inset-0 z-50 bg-inverse-surface/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setForgotModalOpen(false);
          }}
        >
          <div className="w-full max-w-[420px] bg-surface-container-lowest rounded-2xl p-5 sm:p-7 shadow-xl border border-outline-variant/60 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-fixed text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">
                    lock_reset
                  </span>
                </div>
                <div>
                  <h2
                    id="forgot-modal-title"
                    className="font-bold text-lg text-on-surface"
                  >
                    Atur Ulang Kata Sandi
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    Tautan pemulihan akan dikirim ke email Anda
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setForgotModalOpen(false)}
                aria-label="Tutup modal"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">
                  close
                </span>
              </button>
            </div>

            {resetSent ? (
              <div className="flex flex-col gap-4 pt-1">
                <div className="p-4 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary-container text-[22px] shrink-0 mt-0.5">
                    mark_email_read
                  </span>
                  <div className="text-xs sm:text-sm text-on-surface leading-relaxed">
                    Tautan atur ulang kata sandi telah dikirim ke{" "}
                    <strong className="break-all">{resetEmail}</strong>. Silakan
                    periksa kotak masuk atau folder spam email Anda.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setForgotModalOpen(false)}
                  className="w-full h-11 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:bg-primary-container transition-colors cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSendResetLink}
                className="flex flex-col gap-4"
                noValidate
              >
                {resetError && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-error-container/60 border border-error/20 flex items-start gap-2 text-xs text-error font-semibold"
                  >
                    <span className="material-symbols-outlined text-[18px] shrink-0">
                      error
                    </span>
                    <span>{resetError}</span>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="reset-email-input"
                    className="text-sm font-semibold text-on-surface"
                  >
                    Alamat Email Terdaftar <span className="text-error">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3.5 text-[20px] text-outline pointer-events-none">
                      mail
                    </span>
                    <input
                      id="reset-email-input"
                      type="email"
                      inputMode="email"
                      required
                      value={resetEmail}
                      onChange={(e) => {
                        setResetEmail(e.target.value);
                        if (resetError) setResetError("");
                      }}
                      placeholder="nama@email.com"
                      className="w-full h-12 pl-11 pr-4 rounded-xl text-base bg-surface-container-lowest text-on-surface border border-surface-dim focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none placeholder:text-outline"
                    />
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setForgotModalOpen(false)}
                    className="w-full sm:w-auto sm:flex-1 h-11 rounded-xl border border-outline-variant text-on-surface font-semibold text-sm hover:bg-surface-container transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full sm:w-auto sm:flex-1 h-11 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-semibold text-sm transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {resetLoading ? "Mengirim..." : "Kirim Tautan"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
