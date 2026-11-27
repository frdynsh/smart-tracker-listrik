// src/app/page.tsx
import Link from "next/link";
import FaqAccordion from "@/components/FaqAccordion";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/supabase";

export default async function LandingPage() {
  // PRD 9.1: Pengguna yang sudah login langsung diarahkan ke Dashboard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface text-on-surface overflow-x-clip antialiased tabular-nums">
      {/* 1. TOP NAVIGATION BAR */}
      <header className="w-full bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 h-16 sm:h-20 flex items-center justify-between gap-3">
          {/* Left: Brand Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 sm:gap-3 shrink-0"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-xs">
              <span className="material-symbols-outlined text-[22px] sm:text-[24px]">
                bolt
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base sm:text-xl tracking-tight text-on-primary-fixed-variant leading-tight">
                Smart Tracker
              </span>
              <span className="text-[10px] sm:text-xs font-bold tracking-wider text-on-surface-variant uppercase">
                Listrik IoT
              </span>
            </div>
          </Link>

          {/* Center Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-on-surface">
            <a
              href="#pratinjau"
              className="hover:text-primary transition-colors"
            >
              Pratinjau
            </a>
            <a
              href="#cara-kerja"
              className="hover:text-primary transition-colors"
            >
              Cara Kerja
            </a>
            <a
              href="#perangkat"
              className="hover:text-primary transition-colors"
            >
              Perangkat IoT
            </a>
            <a href="#faq" className="hover:text-primary transition-colors">
              FAQ
            </a>
          </nav>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/masuk"
              className="px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors"
            >
              Masuk
            </Link>
            <Link
              href="/daftar"
              className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-primary hover:bg-on-primary-fixed-variant text-on-primary font-semibold text-xs sm:text-sm shadow-xs transition-colors"
            >
              Daftar
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-12 py-8 sm:py-10 lg:py-14 flex flex-col gap-12 sm:gap-14 lg:gap-16">
        {/* 2. HERO SECTION (Split 2-Column Layout) */}
        <section
          id="pratinjau"
          className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center"
        >
          {/* Left Column: Copy & CTAs */}
          <div className="lg:col-span-6 flex flex-col items-start gap-5">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-fixed border border-primary-fixed-dim text-primary text-xs font-bold tracking-wide uppercase">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              PEMANTAU LISTRIK PERANGKAT IOT
            </div>

            {/* Headline */}
            <h1 className="font-extrabold text-3xl sm:text-4xl lg:text-[44px] leading-[1.18] tracking-tight text-on-primary-fixed-variant">
              Kenali pemakaian listrik perangkatmu sebelum biaya membengkak
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-on-surface-variant leading-relaxed">
              Pantau pemakaian tiap perangkat dengan alat IoT, dapat peringatan
              dini, lalu hemat tanpa menebak tagihan di akhir bulan.
            </p>

            {/* CTA Buttons Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-1 w-full sm:w-auto">
              <Link
                href="/daftar"
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-primary hover:bg-on-primary-fixed-variant text-on-primary font-bold text-base shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <span>Daftar Sekarang</span>
                <span className="material-symbols-outlined text-[20px]">
                  arrow_forward
                </span>
              </Link>
              <Link
                href="/masuk"
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl border border-outline-variant bg-surface-container-lowest hover:bg-surface-container text-on-surface font-bold text-base transition-colors flex items-center justify-center"
              >
                Masuk ke Akun
              </Link>
            </div>

            {/* Trust Points Row */}
            <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-on-surface-variant">
              <span className="flex items-center gap-1.5 font-semibold text-on-surface">
                <span className="text-primary">✓</span> Tanpa langganan bulanan
              </span>
              <span className="text-outline-variant hidden sm:inline">•</span>
              <span className="flex items-center gap-1.5 font-semibold text-on-surface">
                <span className="text-primary">✓</span> Update otomatis tiap 30
                detik
              </span>
              <span className="text-outline-variant hidden sm:inline">•</span>
              <span className="flex items-center gap-1.5 font-semibold text-on-surface">
                <span className="text-primary">✓</span> Batas beban aman ≤ 600 W
              </span>
            </div>
          </div>

          {/* Right Column: Floating Dashboard Preview Card */}
          <div className="lg:col-span-6 flex justify-center w-full">
            <div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 sm:p-6 shadow-md shadow-stone-900/5 flex flex-col gap-5">
              {/* Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-outline-variant">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary-fixed text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">
                      grid_view
                    </span>
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-on-surface leading-tight">
                      Pratinjau Dashboard
                    </h2>
                    <span className="text-xs text-on-surface-variant">
                      ESP32 + PZEM-004T 10A • Contoh Data
                    </span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-primary text-xs font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />3 Alat
                  Terhubung
                </span>
              </div>

              {/* Top Metric Cards Side-by-Side */}
              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3.5">
                {/* Left Metric: Daya Aktif (Terukur) */}
                <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-on-surface-variant mb-1">
                    <span className="font-medium">Daya Aktif</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-fixed text-primary font-bold">
                      Terukur
                    </span>
                  </div>
                  <div className="my-1">
                    <span className="font-extrabold text-2xl lg:text-[28px] text-on-primary-fixed-variant">
                      106
                    </span>
                    <span className="text-xs font-bold text-on-surface-variant ml-1">
                      Watt
                    </span>
                  </div>
                  <div className="text-[11px] text-on-surface-variant flex items-center gap-1 pt-1.5 border-t border-outline-variant/70">
                    <span className="text-primary font-bold">⚡</span> Tegangan
                    stabil 224 V
                  </div>
                </div>

                {/* Right Metric: Estimasi Biaya */}
                <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-on-surface-variant mb-1">
                    <span className="font-medium">Estimasi Biaya</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container text-on-surface font-bold">
                      Bulan Ini
                    </span>
                  </div>
                  <div className="my-1">
                    <span className="font-extrabold text-2xl lg:text-[26px] text-on-primary-fixed-variant">
                      Rp 27.675
                    </span>
                  </div>
                  <div className="text-[11px] text-on-surface-variant flex items-center gap-1 pt-1.5 border-t border-outline-variant/70">
                    <span className="material-symbols-outlined text-[14px] text-primary">
                      trending_up
                    </span>
                    18,45 kWh terpantau
                  </div>
                </div>
              </div>

              {/* Device Load List */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-on-surface px-0.5">
                  <span>Beban Perangkat Aktif</span>
                  <span className="text-on-surface-variant font-medium text-[11px]">
                    Batas Uji: 600 W
                  </span>
                </div>

                {/* Item 1: Kipas Angin */}
                <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      <span className="font-bold text-on-surface truncate">
                        Kipas Angin
                      </span>
                      <span className="text-on-surface-variant text-[11px] hidden sm:inline">
                        (Alat 1)
                      </span>
                    </div>
                    <div className="font-semibold text-on-surface shrink-0">
                      <span className="font-bold text-on-primary-fixed-variant">
                        48 W
                      </span>
                      <span className="text-on-surface-variant text-[11px] ml-1">
                        / 45,3% daya aktif
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: "45.3%" }}
                    />
                  </div>
                </div>

                {/* Item 2: Lampu Meja */}
                <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      <span className="font-bold text-on-surface truncate">
                        Lampu Meja
                      </span>
                      <span className="text-on-surface-variant text-[11px] hidden sm:inline">
                        (Alat 2)
                      </span>
                    </div>
                    <div className="font-semibold text-on-surface shrink-0">
                      <span className="font-bold text-on-primary-fixed-variant">
                        58 W
                      </span>
                      <span className="text-on-surface-variant text-[11px] ml-1">
                        / 54,7% daya aktif
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: "54.7%" }}
                    />
                  </div>
                </div>

                {/* Item 3: Teko Listrik */}
                <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-outline-variant shrink-0" />
                    <span className="font-bold text-on-surface truncate">
                      Teko Listrik
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-bold shrink-0">
                      Standby
                    </span>
                  </div>
                  <div className="font-semibold text-on-surface-variant shrink-0">
                    <span>0 W</span>
                    <span className="text-[11px] ml-1">/ 0% daya aktif</span>
                  </div>
                </div>
              </div>

              {/* Warning Banner at bottom of card */}
              <div className="p-3 rounded-xl bg-tertiary-fixed border border-tertiary-fixed-dim flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-on-tertiary-fixed-variant shrink-0 mt-0.5">
                  warning
                </span>
                <p className="text-xs text-on-tertiary-fixed-variant leading-snug">
                  <strong className="font-bold tracking-wide uppercase text-[10px] block mb-0.5">
                    PERINGATAN DINI
                  </strong>
                  Kipas Angin menyala mendekati batas 8 jam/hari dan berpotensi
                  melewati ambang biaya.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. INFO / PRINCIPLE BANNER */}
        <section
          id="prinsip"
          className="scroll-mt-24 w-full p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs"
        >
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-fixed text-primary flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
              <span className="material-symbols-outlined text-[20px]">
                info
              </span>
            </div>
            <div>
              <h2 className="font-bold text-sm text-on-surface">
                Transparansi Pengukuran Perangkat Terpantau
              </h2>
              <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
                Aplikasi hanya mengukur perangkat yang dipasangi modul IoT,
                bukan total beban seluruh meteran listrik PLN rumah.
              </p>
            </div>
          </div>
          <div className="px-3.5 py-1.5 rounded-full bg-surface-container border border-outline-variant text-on-primary-fixed-variant text-xs font-bold tracking-wide shrink-0 flex items-center gap-1.5">
            <span>⚡</span> Prinsip 1 Alat = 1 Perangkat IoT
          </div>
        </section>

        {/* 4. "3 LANGKAH MENUJU HEMAT" SECTION */}
        <section
          id="cara-kerja"
          className="scroll-mt-24 flex flex-col items-center text-center pt-2"
        >
          <div className="inline-flex items-center px-3.5 py-1 rounded-full bg-surface-container border border-outline-variant text-on-surface text-xs font-bold tracking-wider uppercase mb-3">
            ALUR KERJA SEDERHANA
          </div>
          <h2 className="font-extrabold text-2xl sm:text-3xl lg:text-4xl text-on-primary-fixed-variant">
            3 Langkah Menuju Hemat
          </h2>
          <p className="text-on-surface-variant text-sm sm:text-base max-w-2xl mt-2 mb-8 sm:mb-10">
            Cara mudah mengontrol beban listrik dari perangkat sehari-hari tanpa
            mengubah rutinitas keluarga.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 w-full text-left">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant hover:border-primary/50 transition-colors flex flex-col justify-between gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-primary-fixed text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[26px]">
                      show_chart
                    </span>
                  </div>
                  <span className="text-[11px] font-bold tracking-widest text-on-surface-variant uppercase">
                    TAHAP 01
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-on-surface mb-2">
                    Langkah 1 • Pantau
                  </h3>
                  <p className="text-on-surface-variant text-xs sm:text-sm leading-relaxed">
                    Pantau daya Watt dan konsumsi kWh tiap perangkat elektronik
                    secara otomatis dari modul ESP32 &amp; PZEM-004T langsung di
                    layar Anda.
                  </p>
                </div>
              </div>
              <div className="pt-4 border-t border-outline-variant flex items-center gap-1.5 text-xs font-semibold text-primary">
                <span>Pembacaan Digital Terukur</span>
                <span>✓</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant hover:border-primary/50 transition-colors flex flex-col justify-between gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-tertiary-fixed text-on-tertiary-fixed-variant flex items-center justify-center">
                    <span className="material-symbols-outlined text-[26px]">
                      notifications_active
                    </span>
                  </div>
                  <span className="text-[11px] font-bold tracking-widest text-on-surface-variant uppercase">
                    TAHAP 02
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-on-surface mb-2">
                    Langkah 2 • Ingatkan
                  </h3>
                  <p className="text-on-surface-variant text-xs sm:text-sm leading-relaxed">
                    Dapatkan notifikasi di dalam aplikasi saat durasi nyala
                    berlebih atau estimasi biaya mendekati ambang batas yang
                    Anda tentukan.
                  </p>
                </div>
              </div>
              <div className="pt-4 border-t border-outline-variant flex items-center gap-1.5 text-xs font-semibold text-on-tertiary-fixed-variant">
                <span>Peringatan Durasi &amp; Batas Biaya</span>
                <span>✓</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant hover:border-primary/50 transition-colors flex flex-col justify-between gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-primary-fixed text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[26px]">
                      bolt
                    </span>
                  </div>
                  <span className="text-[11px] font-bold tracking-widest text-on-surface-variant uppercase">
                    TAHAP 03
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-on-surface mb-2">
                    Langkah 3 • Hemat
                  </h3>
                  <p className="text-on-surface-variant text-xs sm:text-sm leading-relaxed">
                    Bandingkan pemakaian antar-periode, simulasikan pengurangan
                    jam nyala perangkat, dan tetapkan target hemat bulanan.
                  </p>
                </div>
              </div>
              <div className="pt-4 border-t border-outline-variant flex items-center gap-1.5 text-xs font-semibold text-primary">
                <span>Kalkulator Simulasi Biaya</span>
                <span>✓</span>
              </div>
            </div>
          </div>
        </section>

        {/* 5. "CUKUP TANCAPKAN KE STOPKONTAK" SHOWCASE SECTION */}
        <section
          id="perangkat"
          className="scroll-mt-24 p-6 lg:p-10 rounded-3xl bg-surface-container-low border border-outline-variant"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Side */}
            <div className="lg:col-span-5 flex flex-col items-start gap-4">
              <span className="text-xs font-bold tracking-wider text-primary uppercase">
                INSTALASI COLOKAN PERANTARA
              </span>
              <h2 className="font-extrabold text-2xl sm:text-3xl text-on-primary-fixed-variant leading-tight">
                Cukup tancapkan ke stopkontak rumah Anda
              </h2>
              <p className="text-on-surface-variant text-xs sm:text-sm leading-relaxed">
                Tidak perlu membongkar kabel instalasi utama rumah. Cukup
                hubungkan perangkat elektronik (seperti kipas angin, lampu meja,
                atau teko listrik) ke stopkontak kotak modul ESP32 + PZEM-004T
                dan sambungkan ke Wi-Fi.
              </p>
              <div className="pt-2 flex flex-col gap-2.5 text-xs sm:text-sm font-semibold text-on-surface">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary-fixed text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    ✓
                  </span>
                  <span>
                    Kotak tertutup berisolasi dengan pemisahan zona AC &amp; DC
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary-fixed text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    ✓
                  </span>
                  <span>
                    Sensor PZEM-004T 10A dengan batas beban uji aman ≤ 600 W
                  </span>
                </div>
              </div>
            </div>

            {/* Right Side: Photographic domestic cards */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Card 1: Ruang Keluarga */}
              <div className="relative rounded-2xl overflow-hidden border border-outline-variant group bg-surface-container aspect-4/3 sm:aspect-square flex items-end p-4 shadow-xs">
                <img
                  alt="Sudut ruang keluarga dengan stopkontak perangkat rumah tangga"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBd_hB7B7ij_haU6Ewlj8MascVF5HsuHmffMubsaIfdFTdl-WB5Ty6neMi4xN7biQ_q84MLCOZhlEUQvfSfRamMbhu7QDy7EAklRAYrma0rkV-VkR6LpAsNC74xBQJ5K_SBEMQdg9jG_60hwx19I6ya5DSsRpQRwkEqDEt1pfQBmIStajn0Nt_72GuOY3-77exqOK-JDt8G3rmLPFvac4PNyVyte8RpUxqcHCdV3ro_"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <span className="relative z-10 px-3.5 py-1.5 rounded-full bg-surface-container-lowest/95 backdrop-blur-sm text-on-surface font-bold text-xs shadow-xs">
                  Ruang Keluarga
                </span>
              </div>

              {/* Card 2: Ruang Kerja & Kamar */}
              <div className="relative rounded-2xl overflow-hidden border border-outline-variant group bg-surface-container aspect-4/3 sm:aspect-square flex items-end p-4 shadow-xs">
                <img
                  alt="Meja ruang kerja dengan perangkat elektronik terpantau"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAY2mgW0mceVzravjQG4VZro-1fkdOlQ5pzD_w66mOvgRj3xwOjOXh1TpO_xzlTjvq3_Cot-YHZpaxHe7rt0y_INtnfwa2hdiA1RB4xshDPxC3Vncg-zSedkgOE09CkO5ug5ofdal2GMSPWdoeQLowA7eEkJ5l7RsZN7cZYn0UJchFXFGnN99d2WiE00KM4WXTkb-yJbGsC_-8Sp2g8D4qbyyOQEXSg_z34-0QVZcn3"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <span className="relative z-10 px-3.5 py-1.5 rounded-full bg-surface-container-lowest/95 backdrop-blur-sm text-on-surface font-bold text-xs shadow-xs">
                  Ruang Kerja &amp; Kamar
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 6. FAQ SECTION */}
        <section
          id="faq"
          className="scroll-mt-24 flex flex-col items-center pt-2"
        >
          <div className="inline-flex items-center px-3.5 py-1 rounded-full bg-surface-container border border-outline-variant text-on-surface text-xs font-bold tracking-wider uppercase mb-3">
            FAQ &amp; BANTUAN
          </div>
          <h2 className="font-extrabold text-2xl sm:text-3xl lg:text-4xl text-on-primary-fixed-variant text-center leading-tight">
            Pertanyaan yang Sering Diajukan
          </h2>
          <p className="text-on-surface-variant text-sm sm:text-base max-w-2xl text-center mt-2 mb-8 sm:mb-10">
            Hal-hal penting yang perlu Anda ketahui tentang modul Smart Tracker
            IoT dan sistem pemantauan listrik perangkat.
          </p>

          <FaqAccordion />
        </section>

        {/* 7. LARGE BOTTOM CTA CARD */}
        <section
          id="mulai"
          className="scroll-mt-24 rounded-3xl bg-primary text-on-primary p-7 sm:p-12 lg:p-14 flex flex-col items-center text-center shadow-md"
        >
          <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-on-primary mb-5 sm:mb-6">
            <span className="material-symbols-outlined text-[30px]">power</span>
          </div>

          <h2 className="font-extrabold text-2xl sm:text-3xl lg:text-4xl max-w-2xl leading-tight text-on-primary mb-3">
            Mulai Kendalikan Beban Listrik
          </h2>

          <p className="text-primary-fixed text-sm sm:text-base max-w-xl leading-relaxed mb-7 sm:mb-8">
            Hubungkan perangkat pertamamu ke modul ESP32 + PZEM-004T dalam
            hitungan menit dan pantau estimasi biayanya secara transparan.
          </p>

          <Link
            href="/daftar"
            className="px-7 sm:px-8 py-3.5 rounded-full bg-surface-container-lowest text-on-primary-fixed-variant font-bold text-sm sm:text-base hover:bg-surface transition-colors shadow-sm flex items-center gap-2"
          >
            <span>Buat Akun Gratis Sekarang</span>
            <span className="material-symbols-outlined text-[20px]">
              arrow_forward
            </span>
          </Link>

          <div className="mt-6 flex items-center gap-1.5 text-xs text-primary-fixed/90">
            <span className="material-symbols-outlined text-[16px]">wifi</span>
            <span>
              Dapat digunakan langsung dengan jaringan Wi-Fi 2.4 GHz rumah Anda.
            </span>
          </div>
        </section>
      </main>

      {/* 8. FOOTER */}
      <footer className="w-full bg-surface-container-lowest border-t border-outline-variant mt-8 py-8 sm:py-10 text-xs text-on-surface-variant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 flex flex-col gap-6 sm:gap-8">
          {/* Top Row */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-5 pb-6 border-b border-outline-variant">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary">
                <span className="material-symbols-outlined text-[18px]">
                  bolt
                </span>
              </div>
              <span className="font-bold text-base text-on-primary-fixed-variant">
                Smart Tracker Listrik IoT
              </span>
            </div>

            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold text-on-surface">
              <a
                href="#pratinjau"
                className="hover:text-primary transition-colors"
              >
                Pratinjau
              </a>
              <a
                href="#cara-kerja"
                className="hover:text-primary transition-colors"
              >
                Cara Kerja
              </a>
              <a
                href="#perangkat"
                className="hover:text-primary transition-colors"
              >
                Perangkat IoT
              </a>
              <a href="#faq" className="hover:text-primary transition-colors">
                FAQ
              </a>
              <Link
                href="/masuk"
                className="hover:text-primary transition-colors"
              >
                Masuk Akun
              </Link>
            </nav>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-primary text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              IoT Real-Time Monitoring Aktif
            </div>
          </div>

          {/* Bottom Row */}
          <div className="flex flex-col text-center sm:flex-row items-center justify-between gap-3 text-[11px]">
            <span>
              © 2026 Smart Tracker Listrik IoT • Kelompok Hayuu. Seluruh hak
              cipta dilindungi.
            </span>
            <div className="flex items-center gap-4">
              <span>Privasi</span>
              <span>•</span>
              <span>Syarat &amp; Ketentuan</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
