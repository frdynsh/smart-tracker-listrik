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
      }
    );

    if (signInError || !data.user) {
      setError(
        "Email atau kata sandi salah. Silakan periksa kembali dan coba lagi."
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

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col justify-between selection:bg-primary-fixed selection:text-on-primary-fixed antialiased">
      {/* 1. FIXED TOP HEADER */}
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-16 max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface transition-colors py-2 px-3 rounded-lg hover:bg-surface-container-high text-sm font-semibold"
          >
            <span className="material-symbols-outlined text-[20px]">
              arrow_back
            </span>
            <span className="hidden sm:inline">Kembali ke Beranda</span>
          </Link>

          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-[20px]">
                bolt
              </span>
            </div>
            <span className="font-bold text-lg text-on-surface tracking-tight">
              Smart Tracker Listrik
            </span>
          </Link>

          {/* Penyeimbang posisi tengah logo */}
          <div className="w-10 sm:w-36 flex justify-end" />
        </div>
      </header>

      {/* 2. MAIN CONTENT */}
      <main className="w-full pt-16 flex-1 flex flex-col items-center justify-center px-4 md:px-8 py-10 bg-surface">
        <div className="w-full max-w-[440px] bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-surface-dim flex flex-col">
          {/* Header & Branding Context */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-sm shrink-0">
              <span className="material-symbols-outlined text-on-primary text-[26px]">
                bolt
              </span>
            </div>
            <div>
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block">
                Pemantauan Listrik IoT
              </span>
              <h1 className="font-semibold text-[22px] leading-[28px] text-on-surface">
                Masuk ke Akun
              </h1>
            </div>
          </div>

          <p className="text-base text-on-surface-variant mb-7">
            Lihat kondisi dan perkiraan biaya perangkat listrik Anda
          </p>

          {/* Interactive Error Banner (Muncul saat login gagal) */}
          {error && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-error-container/60 border border-error/20 flex items-start gap-3 mb-5"
            >
              <span
                className="material-symbols-outlined text-error text-[22px] shrink-0 mt-0.5"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                error
              </span>
              <span className="text-sm text-error font-semibold leading-snug">
                {error}
              </span>
            </div>
          )}

          {/* Interactive Login Form */}
          <form onSubmit={handleLogin} className="flex flex-col gap-5" noValidate>
            {/* Email Field */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-email"
                className="text-sm font-semibold text-on-surface flex items-center justify-between"
              >
                <span>
                  Alamat Email <span className="text-error">*</span>
                </span>
                <span className="text-xs text-on-surface-variant font-normal">
                  Format: nama@domain.com
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

            {/* Password Field */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className="text-sm font-semibold text-on-surface"
                >
                  Kata Sandi <span className="text-error">*</span>
                </label>
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
                  className="absolute right-3.5 text-outline hover:text-on-surface transition-colors p-1 flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
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
              className="w-full h-12 bg-primary hover:bg-primary-container text-on-primary font-semibold text-base rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 mt-2 group active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
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
                Belum punya akun?
                <Link
                  href="/daftar"
                  className="text-sm text-primary font-semibold hover:underline ml-1"
                >
                  Daftar sekarang
                </Link>
              </p>
            </div>
          </form>
        </div>
      </main>

      {/* 3. FOOTER */}
      <footer className="w-full bg-surface py-5 shadow-[0_-1px_8px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 text-center text-xs font-semibold text-on-surface-variant">
          © 2026 Smart Tracker Listrik IoT. Pemantauan Perangkat Rumah Tangga.
        </div>
      </footer>
    </div>
  );
}