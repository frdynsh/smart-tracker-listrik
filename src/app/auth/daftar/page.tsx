// src/app/daftar/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/supabase";

export default function DaftarPage() {
  const router = useRouter();
  const supabase = createClient();

  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(true);

  const [fieldErrors, setFieldErrors] = useState<{
    nama?: string;
    email?: string;
    password?: string;
    agreed?: string;
  }>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const errors: typeof fieldErrors = {};
    const trimmedNama = nama.trim();
    const trimmedEmail = email.trim();

    if (!trimmedNama) {
      errors.nama = "Nama lengkap wajib diisi.";
    } else if (trimmedNama.length < 2) {
      errors.nama = "Nama lengkap minimal 2 karakter.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail) {
      errors.email = "Alamat email wajib diisi.";
    } else if (!emailRegex.test(trimmedEmail)) {
      errors.email = "Format email tidak valid (contoh: nama@domain.com)";
    }

    if (!password) {
      errors.password = "Kata sandi wajib diisi.";
    } else if (password.length < 8) {
      errors.password = `Kata sandi minimal 8 karakter (terisi ${password.length} karakter)`;
    }

    if (!agreed) {
      errors.agreed =
        "Anda perlu menyetujui syarat & ketentuan untuk mendaftar.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");

    if (!validateForm()) return;

    setLoading(true);
    const trimmedNama = nama.trim();
    const trimmedEmail = email.trim();

    const { error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          nama: trimmedNama,
          full_name: trimmedNama,
          name: trimmedNama,
        },
      },
    });

    if (signUpError) {
      setServerError(signUpError.message);
      setLoading(false);
      return;
    }

    router.refresh();
    router.push("/perangkat");
  };

  const errorCount = Object.keys(fieldErrors).length;

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

      {/* 2. MAIN REGISTRATION CARD */}
      <main className="w-full pt-16 sm:pt-20 flex-1 flex flex-col items-center justify-center px-3.5 sm:px-6 md:px-8 py-6 sm:py-10 bg-surface">
        <section className="w-full max-w-[440px] bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-sm p-5 sm:p-8">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="font-bold text-2xl sm:text-[28px] leading-tight sm:leading-[36px] text-on-surface tracking-tight">
              Buat Akun Baru
            </h1>
            <p className="text-sm sm:text-base text-on-surface-variant mt-1.5">
              Satu akun untuk memantau perangkat listrik IoT di rumah Anda
              secara terukur.
            </p>
          </div>

          {/* Interactive Validation / Server Error Banner */}
          {(serverError || errorCount > 0) && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-[#FEF2F2] border border-error/25 flex items-start gap-2.5 text-error"
            >
              <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">
                error
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-error leading-snug break-words">
                  {serverError
                    ? serverError
                    : "Mohon periksa kembali data yang ditandai merah."}
                </p>
                {!serverError && errorCount > 0 && (
                  <p className="text-xs font-medium text-error/80 mt-0.5">
                    Terdapat {errorCount} kesalahan pengisian formulir.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Main Interactive Form */}
          <form
            onSubmit={handleRegister}
            className="space-y-4 sm:space-y-5"
            noValidate
          >
            {/* Nama Lengkap Field */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <label
                  htmlFor="reg-fullname"
                  className={`block text-sm font-semibold ${
                    fieldErrors.nama ? "text-error" : "text-on-surface"
                  }`}
                >
                  Nama Lengkap <span className="text-error">*</span>
                </label>
                {fieldErrors.nama && (
                  <span className="text-xs font-semibold text-error">
                    Wajib diisi
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <span
                  className={`material-symbols-outlined absolute left-3.5 text-[20px] pointer-events-none ${
                    fieldErrors.nama ? "text-error" : "text-on-surface-variant"
                  }`}
                >
                  person
                </span>
                <input
                  id="reg-fullname"
                  name="fullname"
                  type="text"
                  autoComplete="name"
                  required
                  value={nama}
                  onChange={(e) => {
                    setNama(e.target.value);
                    if (fieldErrors.nama) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        nama: undefined,
                      }));
                    }
                  }}
                  placeholder="Contoh: Budi Santoso"
                  className={`w-full h-12 pl-11 pr-10 rounded-lg text-base placeholder:text-outline outline-none transition-all border ${
                    fieldErrors.nama
                      ? "bg-[#FEF2F2] text-error border-error/50 focus:border-error"
                      : "bg-surface-container-lowest text-on-surface border-outline-variant/80 focus:border-primary focus:bg-surface-container-low"
                  }`}
                />
                {fieldErrors.nama && (
                  <span className="material-symbols-outlined absolute right-3 text-error text-[20px] pointer-events-none">
                    report_problem
                  </span>
                )}
              </div>
              {fieldErrors.nama && (
                <p className="flex items-start gap-1.5 text-xs font-semibold text-error pt-0.5">
                  <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">
                    info
                  </span>
                  <span>{fieldErrors.nama}</span>
                </p>
              )}
            </div>

            {/* Email Field */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <label
                  htmlFor="reg-email"
                  className={`block text-sm font-semibold ${
                    fieldErrors.email ? "text-error" : "text-on-surface"
                  }`}
                >
                  Alamat Email <span className="text-error">*</span>
                </label>
                {fieldErrors.email && (
                  <span className="text-xs font-semibold text-error">
                    Tidak Valid
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <span
                  className={`material-symbols-outlined absolute left-3.5 text-[20px] pointer-events-none ${
                    fieldErrors.email ? "text-error" : "text-on-surface-variant"
                  }`}
                >
                  mail
                </span>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        email: undefined,
                      }));
                    }
                  }}
                  placeholder="nama@email.com"
                  className={`w-full h-12 pl-11 pr-10 rounded-lg text-base placeholder:text-outline outline-none transition-all border ${
                    fieldErrors.email
                      ? "bg-[#FEF2F2] text-error border-error/50 focus:border-error"
                      : "bg-surface-container-lowest text-on-surface border-outline-variant/80 focus:border-primary focus:bg-surface-container-low"
                  }`}
                />
                {fieldErrors.email && (
                  <span className="material-symbols-outlined absolute right-3 text-error text-[20px] pointer-events-none">
                    report_problem
                  </span>
                )}
              </div>
              {fieldErrors.email && (
                <p className="flex items-start gap-1.5 text-xs font-semibold text-error pt-0.5">
                  <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">
                    info
                  </span>
                  <span>{fieldErrors.email}</span>
                </p>
              )}
            </div>

            {/* Kata Sandi Field */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <label
                  htmlFor="reg-password"
                  className={`block text-sm font-semibold ${
                    fieldErrors.password ? "text-error" : "text-on-surface"
                  }`}
                >
                  Kata Sandi <span className="text-error">*</span>
                </label>
                <span
                  className={`text-[11px] sm:text-xs font-semibold ${
                    fieldErrors.password
                      ? "text-error"
                      : "text-on-surface-variant"
                  }`}
                >
                  Minimal 8 karakter
                </span>
              </div>
              <div className="relative flex items-center">
                <span
                  className={`material-symbols-outlined absolute left-3.5 text-[20px] pointer-events-none ${
                    fieldErrors.password
                      ? "text-error"
                      : "text-on-surface-variant"
                  }`}
                >
                  lock
                </span>
                <input
                  id="reg-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        password: undefined,
                      }));
                    }
                  }}
                  placeholder="Minimal 8 karakter"
                  className={`w-full h-12 pl-11 pr-12 rounded-lg text-base placeholder:text-outline outline-none transition-all border ${
                    fieldErrors.password
                      ? "bg-[#FEF2F2] text-error border-error/50 focus:border-error"
                      : "bg-surface-container-lowest text-on-surface border-outline-variant/80 focus:border-primary focus:bg-surface-container-low"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword
                      ? "Sembunyikan kata sandi"
                      : "Tampilkan kata sandi"
                  }
                  className="absolute right-2 text-on-surface-variant hover:text-on-surface w-9 h-9 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              {fieldErrors.password && (
                <p className="flex items-start gap-1.5 text-xs font-semibold text-error pt-0.5">
                  <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">
                    info
                  </span>
                  <span>{fieldErrors.password}</span>
                </p>
              )}
            </div>

            {/* Terms and Conditions Checkbox */}
            <div className="pt-1 space-y-1">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => {
                    setAgreed(e.target.checked);
                    if (fieldErrors.agreed) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        agreed: undefined,
                      }));
                    }
                  }}
                  className="mt-1 w-4 h-4 shrink-0 rounded text-primary-container accent-[#1e40af] bg-surface-container cursor-pointer"
                />
                <span className="text-xs sm:text-sm font-medium text-on-surface-variant leading-relaxed">
                  Saya menyetujui{" "}
                  <span className="text-primary-container font-semibold">
                    Syarat &amp; Ketentuan
                  </span>{" "}
                  serta kebijakan privasi perlindungan data pemakaian perangkat.
                </span>
              </label>
              {fieldErrors.agreed && (
                <p className="flex items-start gap-1.5 text-xs font-semibold text-error pl-7">
                  <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">
                    info
                  </span>
                  <span>{fieldErrors.agreed}</span>
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-lg bg-primary-container text-on-primary font-semibold text-base transition-all active:scale-[0.99] flex items-center justify-center gap-2 shadow-sm hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>{loading ? "Membuat Akun..." : "Buat Akun Baru"}</span>
                {!loading && (
                  <span className="material-symbols-outlined text-[20px]">
                    arrow_forward
                  </span>
                )}
              </button>
            </div>
          </form>

          {/* Footer Link Inside Primary Card */}
          <div className="mt-6 sm:mt-7 text-center">
            <p className="text-sm sm:text-base text-on-surface-variant">
              Sudah punya akun?{" "}
              <Link
                href="/masuk"
                className="font-semibold text-primary-container hover:underline whitespace-nowrap"
              >
                Masuk di sini
              </Link>
            </p>
          </div>
        </section>
      </main>

      {/* 3. FOOTER */}
      <footer className="w-full bg-surface py-4 sm:py-5 shadow-[0_-1px_8px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 text-center text-xs font-semibold text-on-surface-variant leading-relaxed">
          © 2026 Smart Tracker Listrik IoT. Pemantauan Perangkat Rumah Tangga.
        </div>
      </footer>
    </div>
  );
}
