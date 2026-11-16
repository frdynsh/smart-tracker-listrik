// src/app/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
// Aktifkan import ini setelah setup Supabase SSR selesai:
// import { createClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  // PRD 9.1: Pengguna yang sudah login langsung diarahkan ke Dashboard
  /*
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }
  */

  return (
    <div className="min-h-screen flex flex-col bg-surface text-on-surface">
      {/* Header / Navbar */}
      <header className="fixed top-0 w-full z-50 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-20 max-w-7xl mx-auto px-6 lg:px-12 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-space-sm group">
            <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-on-primary-container shadow-sm">
              <span className="material-symbols-outlined text-[24px]">
                bolt
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline-md text-headline-md tracking-tight text-on-surface font-bold leading-none">
                Smart Tracker
              </span>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-semibold">
                Listrik IoT
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-space-xl">
            <a
              href="#fitur"
              className="font-body-md text-body-md text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Fitur
            </a>
            <a
              href="#cara-kerja"
              className="font-body-md text-body-md text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Cara Kerja
            </a>
            <a
              href="#instalasi"
              className="font-body-md text-body-md text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Perangkat Didukung
            </a>
            <a
              href="#mulai"
              className="font-body-md text-body-md text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Mulai Sekarang
            </a>
          </nav>

          <div className="flex items-center gap-space-md">
            <Link
              href="/masuk"
              className="hidden sm:inline-flex items-center justify-center h-11 px-space-lg rounded-xl font-title-sm text-title-sm text-on-surface hover:bg-surface-container-high transition-colors"
            >
              Masuk
            </Link>
            <Link
              href="/daftar"
              className="inline-flex items-center justify-center h-11 px-space-xl rounded-xl bg-primary text-on-primary font-title-sm text-title-sm shadow-sm hover:bg-primary-container transition-colors"
            >
              Daftar
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full pt-20 bg-surface flex-1">
        <div className="flex flex-col w-full">
          {/* 1. Hero Section */}
          <section className="relative w-full max-w-7xl mx-auto px-6 lg:px-12 pt-8 pb-16">
            {/* Ambient Glow */}
            <div className="absolute top-12 left-1/4 w-96 h-96 bg-primary-fixed-dim/20 rounded-full blur-3xl pointer-events-none -z-10" />
            <div className="absolute top-36 right-10 w-80 h-80 bg-secondary-container/20 rounded-full blur-3xl pointer-events-none -z-10" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              {/* Left Column: Copy & Actions */}
              <div className="lg:col-span-6 flex flex-col items-start">
                <div className="inline-flex items-center gap-space-xs px-space-md py-1.5 rounded-full bg-surface-container-high shadow-sm mb-6">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                  </span>
                  <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider font-semibold">
                    Monitoring IoT Perangkat Rumah Tangga
                  </span>
                </div>

                <h1 className="font-headline-lg text-headline-lg lg:text-[44px] lg:leading-[52px] font-bold text-on-surface tracking-tight mb-6">
                  Kenali pemakaian listrik perangkatmu sebelum biaya membengkak
                </h1>

                <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl mb-8">
                  Pantau pemakaian tiap perangkat dengan alat IoT, dapat
                  peringatan dini, lalu hemat tanpa menebak tagihan di akhir
                  bulan.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-md w-full sm:w-auto mb-8">
                  <Link
                    href="/daftar"
                    className="inline-flex items-center justify-center gap-space-xs h-12 px-7 rounded-xl bg-primary text-on-primary font-title-sm text-title-sm shadow-md hover:bg-primary-container transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <span>Daftar Sekarang</span>
                    <span className="material-symbols-outlined text-[20px]">
                      arrow_forward
                    </span>
                  </Link>
                  <Link
                    href="/masuk"
                    className="inline-flex items-center justify-center h-12 px-6 rounded-xl bg-surface-container-lowest text-on-surface font-title-sm text-title-sm shadow-sm hover:bg-surface-container transition-colors"
                  >
                    <span>Masuk ke Akun</span>
                  </Link>
                </div>

                {/* Micro-trust Signals */}
                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-on-surface-variant font-label-md text-label-md">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      verified
                    </span>
                    <span>Tanpa langganan bulanan</span>
                  </div>
                  <span className="text-outline-variant font-bold">•</span>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      speed
                    </span>
                    <span>Update otomatis tiap 30 detik</span>
                  </div>
                  <span className="text-outline-variant font-bold">•</span>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      shield
                    </span>
                    <span>Kapasitas beban hingga 600 W</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Live Dashboard Preview */}
              <div className="lg:col-span-6 w-full">
                <div className="relative bg-surface-container-lowest rounded-2xl p-6 lg:p-7 shadow-xl shadow-on-surface/5 flex flex-col gap-5">
                  {/* Card Header Bar */}
                  <div className="flex items-center justify-between pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-[22px]">
                          developer_board
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-title-sm text-title-sm text-on-surface font-semibold">
                          Pratinjau Dashboard
                        </span>
                        <span className="font-label-md text-label-md text-on-surface-variant">
                          ESP32 Power Monitor • Contoh Data
                        </span>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <span>3 Alat Terhubung</span>
                    </div>
                  </div>

                  {/* Dual Metrics Display Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Daya Aktif (Terukur) */}
                    <div className="bg-surface-container-low rounded-xl p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                          Daya Aktif
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-primary font-label-sm text-label-sm">
                          Terukur
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-metric-display text-[32px] leading-tight font-bold text-on-surface">
                          106
                        </span>
                        <span className="font-title-sm text-title-sm text-on-surface-variant font-semibold">
                          Watt
                        </span>
                      </div>
                      <span className="font-label-sm text-label-sm text-primary mt-1 flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[14px]">
                          bolt
                        </span>
                        Tegangan stabil 224 V
                      </span>
                    </div>

                    {/* Estimasi Biaya Perangkat Terpantau */}
                    <div className="bg-surface-container-low rounded-xl p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                          Estimasi Biaya
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm">
                          Bulan Ini
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="font-metric-display text-[26px] lg:text-[28px] leading-tight font-bold text-on-surface">
                          Rp 27.675
                        </span>
                      </div>
                      <span className="font-label-sm text-label-sm text-on-surface-variant mt-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">
                          query_stats
                        </span>
                        18,45 kWh perangkat terpantau
                      </span>
                    </div>
                  </div>

                  {/* Live Appliance Breakdown */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="font-title-sm text-title-sm text-on-surface font-semibold">
                        Beban Perangkat Aktif
                      </span>
                      <span className="font-label-md text-label-md text-on-surface-variant">
                        Batas Sensor: 600 W
                      </span>
                    </div>

                    {/* Device 1 */}
                    <div className="p-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                          <span className="font-title-sm text-title-sm text-on-surface font-semibold">
                            Kipas Angin
                          </span>
                          <span className="font-label-md text-label-md text-on-surface-variant hidden sm:inline">
                            (Kamar Utama)
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="font-title-sm text-title-sm font-bold text-on-surface">
                            48 W
                          </span>
                          <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                            / 45,3% kontribusi
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-500"
                          style={{ width: "45.3%" }}
                        />
                      </div>
                    </div>

                    {/* Device 2 */}
                    <div className="p-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                          <span className="font-title-sm text-title-sm text-on-surface font-semibold">
                            Lampu Meja
                          </span>
                          <span className="font-label-md text-label-md text-on-surface-variant hidden sm:inline">
                            (Ruang Kerja)
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="font-title-sm text-title-sm font-bold text-on-surface">
                            58 W
                          </span>
                          <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                            / 54,7% kontribusi
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-500"
                          style={{ width: "54.7%" }}
                        />
                      </div>
                    </div>

                    {/* Device 3 */}
                    <div className="p-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-outline-variant" />
                          <span className="font-title-sm text-title-sm text-on-surface font-semibold">
                            Teko Listrik
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm">
                            Standby
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="font-title-sm text-title-sm font-bold text-on-surface-variant">
                            0 W
                          </span>
                          <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                            / 0% kontribusi
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-outline-variant/40 h-2 rounded-full"
                          style={{ width: "1.5%" }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Warning Banner */}
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-tertiary-fixed text-on-tertiary-fixed shadow-sm">
                    <span
                      className="material-symbols-outlined text-tertiary text-[20px] mt-0.5 shrink-0"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      warning
                    </span>
                    <div className="flex flex-col text-on-tertiary-fixed">
                      <span className="font-label-sm text-label-sm font-bold tracking-tight uppercase">
                        Peringatan Dini
                      </span>
                      <p className="font-label-md text-label-md mt-0.5">
                        Kipas Angin menyala mendekati batas 8 jam/hari dan
                        berpotensi melewati target hemat.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Clarification / Scope Note Banner (Batas Klaim PRD) */}
          <section
            id="fitur"
            className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-4"
          >
            <div className="w-full p-4 lg:p-5 rounded-2xl bg-surface-container-low shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                  <span className="material-symbols-outlined text-[20px]">
                    info
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-title-sm text-title-sm font-semibold text-on-surface">
                    Transparansi Pengukuran Perangkat Terpantau
                  </span>
                  <span className="font-body-md text-body-md text-on-surface-variant">
                    Aplikasi hanya mengukur perangkat yang dipasangi modul IoT,
                    bukan total beban seluruh meteran PLN rumah.
                  </span>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container text-on-secondary-container font-label-md text-label-md font-semibold whitespace-nowrap self-start md:self-auto">
                <span className="material-symbols-outlined text-[16px] text-secondary">
                  power
                </span>
                <span>Prinsip 1 Alat = 1 Perangkat IoT</span>
              </div>
            </div>
          </section>

          {/* 3. 3-Step Section: '3 Langkah Menuju Hemat' */}
          <section
            id="cara-kerja"
            className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-16"
          >
            <div className="text-center max-w-2xl mx-auto mb-14">
              <div className="inline-block px-3 py-1 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm font-semibold uppercase tracking-wider mb-3">
                Alur Kerja Sederhana
              </div>
              <h2 className="font-headline-lg text-headline-lg lg:text-[32px] lg:leading-[40px] font-bold text-on-surface mb-3">
                3 Langkah Menuju Hemat
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant">
                Cara cerdas mengontrol beban listrik dari perangkat favorit Anda
                tanpa mengubah rutinitas keluarga.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Card 1: Pantau */}
              <div className="group bg-surface-container-lowest rounded-2xl p-7 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                      <span className="material-symbols-outlined text-[26px]">
                        insights
                      </span>
                    </div>
                    <span className="font-label-sm text-label-sm uppercase font-bold tracking-wider text-outline">
                      Tahap 01
                    </span>
                  </div>
                  <h3 className="font-headline-md text-headline-md text-on-surface font-semibold mb-3">
                    Langkah 1 • Pantau
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Pantau daya watt dan konsumsi kWh tiap perangkat elektronik
                    secara real-time dari modul IoT langsung di layar Anda.
                  </p>
                </div>
                <div className="mt-6 pt-5 flex items-center gap-2 text-primary font-title-sm text-title-sm">
                  <span className="font-label-md text-label-md font-semibold">
                    Sensor Terkalibrasi Otomatis
                  </span>
                  <span className="material-symbols-outlined text-[16px]">
                    check_circle
                  </span>
                </div>
              </div>

              {/* Card 2: Ingatkan */}
              <div className="group bg-surface-container-lowest rounded-2xl p-7 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-tertiary-container/15 text-tertiary flex items-center justify-center group-hover:scale-105 transition-transform">
                      <span
                        className="material-symbols-outlined text-[26px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        notifications_active
                      </span>
                    </div>
                    <span className="font-label-sm text-label-sm uppercase font-bold tracking-wider text-outline">
                      Tahap 02
                    </span>
                  </div>
                  <h3 className="font-headline-md text-headline-md text-on-surface font-semibold mb-3">
                    Langkah 2 • Ingatkan
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Dapatkan notifikasi in-app otomatis saat durasi nyala
                    berlebih atau estimasi biaya mendekati ambang batas yang
                    ditentukan.
                  </p>
                </div>
                <div className="mt-6 pt-5 flex items-center gap-2 text-tertiary font-title-sm text-title-sm">
                  <span className="font-label-md text-label-md font-semibold">
                    Peringatan Durasi & Ambang Biaya
                  </span>
                  <span className="material-symbols-outlined text-[16px]">
                    check_circle
                  </span>
                </div>
              </div>

              {/* Card 3: Hemat */}
              <div className="group bg-surface-container-lowest rounded-2xl p-7 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center group-hover:scale-105 transition-transform">
                      <span
                        className="material-symbols-outlined text-[26px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        electric_bolt
                      </span>
                    </div>
                    <span className="font-label-sm text-label-sm uppercase font-bold tracking-wider text-outline">
                      Tahap 03
                    </span>
                  </div>
                  <h3 className="font-headline-md text-headline-md text-on-surface font-semibold mb-3">
                    Langkah 3 • Hemat
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Bandingkan pemakaian antar-periode, simulasikan pengurangan
                    jam nyala, dan pasang target penghematan bulanan secara
                    terukur.
                  </p>
                </div>
                <div className="mt-6 pt-5 flex items-center gap-2 text-secondary font-title-sm text-title-sm">
                  <span className="font-label-md text-label-md font-semibold">
                    Kalkulator Simulasi Biaya
                  </span>
                  <span className="material-symbols-outlined text-[16px]">
                    check_circle
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Visual Proof Showcase / Appliance Gallery */}
          <section
            id="instalasi"
            className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-10"
          >
            <div className="bg-surface-container-low rounded-3xl p-8 lg:p-12 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 flex flex-col">
                <span className="font-label-sm text-label-sm text-primary uppercase font-bold tracking-wider mb-2">
                  Instalasi Plug-and-Play
                </span>
                <h3 className="font-headline-lg text-headline-lg lg:text-[28px] font-bold text-on-surface mb-4">
                  Cukup tancapkan ke stopkontak rumah Anda
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant mb-6">
                  Tidak perlu membongkar kabel instalasi utama rumah. Cukup
                  hubungkan perangkat elektronik ke stopkontak modul IoT dan
                  sambungkan ke Wi-Fi dalam hitungan menit.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-label-sm">
                      ✓
                    </span>
                    <span className="font-body-md text-body-md text-on-surface">
                      Kotak tertutup berisolasi & pengaman sekering
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-label-sm">
                      ✓
                    </span>
                    <span className="font-body-md text-body-md text-on-surface">
                      Mendukung kapasitas beban perangkat hingga 600 Watt
                    </span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative overflow-hidden rounded-2xl h-56 shadow-sm">
                  <img
                    className="w-full h-full object-cover"
                    alt="Sudut ruang keluarga dengan adaptor smart plug terpasang pada stopkontak dinding"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDeeab0ud75dmzOi32BuF-2hfMn5ffEX1nXmkAxLG9ZtDpzjPtFCuCvXpsh0t00JQ8BUSZmsdVPuC1BwpFN6xos2WDkAc43MCkUKAcj1W6imh85r7_25lzGe8LkovfvIHxvvbmCpafr-yXqq6QPPGnw5KEwlHDLGAJIxQYGXHtlMAWv6a8DSlad7Zg4Cmi-eLky8K6kgMmhVQ9sgZSrkd2OAG726cWKh9JUI35lzsX3"
                  />
                  <div className="absolute bottom-3 left-3 bg-surface-container-lowest/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-on-surface font-label-sm text-label-sm font-semibold shadow-sm">
                    Ruang Keluarga
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl h-56 shadow-sm">
                  <img
                    className="w-full h-full object-cover"
                    alt="Modul pemantau energi IoT terpasang pada meja ruang kerja"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCKrQhZ9Hj8Jwc610EcMMGHGT-bY9lMfgwC6CJrczCaupU8FxH-S0XPzas-50NA5csResk53IxqikLj0K5mPxysmmC8Tz2uY4_jbUZ4dSOEeky6Evcv7GeVbRsaaKTjkRSmn669tzijvBUd2i_khhqfMHNbjmTOe0wky0aShAXEUiHSR219CciRt5TdBzr0g39wu8yEwbyBbsEW-vatyeq_hLsmGJw0vE0_H4Iw04cU"
                  />
                  <div className="absolute bottom-3 left-3 bg-surface-container-lowest/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-on-surface font-label-sm text-label-sm font-semibold shadow-sm">
                    Ruang Kerja &amp; Kamar
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 5. Bottom Conversion CTA Section */}
          <section
            id="mulai"
            className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-14"
          >
            <div className="relative overflow-hidden rounded-3xl bg-primary text-on-primary p-8 lg:p-14 shadow-xl">
              <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-primary-fixed/10 pointer-events-none blur-2xl" />
              <div className="absolute -left-16 -bottom-16 w-80 h-80 rounded-full bg-on-primary/10 pointer-events-none blur-2xl" />

              <div className="relative z-10 flex flex-col items-center text-center max-w-3xl mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-surface-container-lowest/15 backdrop-blur-sm text-on-primary flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-[32px]">
                    power
                  </span>
                </div>

                <h2 className="font-headline-lg text-headline-lg lg:text-[36px] lg:leading-[44px] font-bold text-on-primary tracking-tight mb-4">
                  Mulai Kendalikan Beban Listrik
                </h2>

                <p className="font-body-lg text-body-lg text-on-primary/90 max-w-xl mb-8">
                  Hubungkan perangkat pertamamu ke modul IoT dalam hitungan
                  menit dan pantau estimasi biayanya secara transparan.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                  <Link
                    href="/daftar"
                    className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-surface-container-lowest text-primary font-title-sm text-title-sm font-bold shadow-lg hover:bg-surface-container hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <span>Buat Akun Gratis Sekarang</span>
                    <span className="material-symbols-outlined text-[20px]">
                      arrow_forward
                    </span>
                  </Link>
                </div>

                <p className="font-label-md text-label-md text-on-primary/75 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">
                    wifi
                  </span>
                  <span>
                    Dapat digunakan langsung dengan jaringan Wi-Fi 2.4 GHz rumah
                    Anda.
                  </span>
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-space-xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-space-lg pb-space-lg">
            <div className="flex items-center gap-space-sm">
              <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center text-on-primary-container">
                <span className="material-symbols-outlined text-[18px]">
                  bolt
                </span>
              </div>
              <span className="font-title-sm text-title-sm text-on-surface">
                Smart Tracker Listrik IoT
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-space-lg">
              <a
                href="#fitur"
                className="font-body-md text-body-md text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Fitur
              </a>
              <a
                href="#cara-kerja"
                className="font-body-md text-body-md text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Cara Kerja
              </a>
              <a
                href="#instalasi"
                className="font-body-md text-body-md text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Perangkat
              </a>
              <Link
                href="/masuk"
                className="font-body-md text-body-md text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Masuk Akun
              </Link>
            </div>

            <div className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-surface-container-highest">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-label-sm text-label-sm text-on-surface font-semibold">
                IoT Real-Time Monitoring Aktif
              </span>
            </div>
          </div>

          <div className="pt-space-md flex flex-col sm:flex-row items-center justify-between gap-space-sm text-on-surface-variant">
            <p className="font-label-md text-label-md">
              © 2026 Smart Tracker Listrik IoT. Seluruh hak cipta dilindungi.
            </p>
            <div className="flex items-center gap-space-md">
              <span className="font-label-md text-label-md">Privasi</span>
              <span className="font-label-md text-label-md">
                Syarat &amp; Ketentuan
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
