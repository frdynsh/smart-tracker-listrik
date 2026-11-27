// src/app/dashboard/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/supabase";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface Device {
  id: string;
  user_id: string;
  nama: string;
  lokasi?: string | null;
  device_code?: string | null;
  last_seen_at?: string | null;
}

interface Reading {
  id: string;
  device_id: string;
  ts: string;
  p: number;
  e_wh: number;
  v?: number;
  i?: number;
}

const OFFLINE_THRESHOLD_MS = 120_000; // > 2 menit tanpa data = Offline

function getDeviceIcon(nama: string): string {
  const lower = nama.toLowerCase();
  if (lower.includes("kipas") || lower.includes("fan")) return "mode_fan";
  if (lower.includes("lampu") || lower.includes("lamp")) return "lightbulb";
  if (
    lower.includes("teko") ||
    lower.includes("kettle") ||
    lower.includes("kopi")
  )
    return "coffee_maker";
  if (lower.includes("tv") || lower.includes("monitor")) return "tv";
  if (
    lower.includes("laptop") ||
    lower.includes("komputer") ||
    lower.includes("pc")
  )
    return "computer";
  return "electrical_services";
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);

  const [devices, setDevices] = useState<Device[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [tarif, setTarif] = useState<number>(1444.7);
  const [ambangBiaya, setAmbangBiaya] = useState<number>(50000);
  const [chartUnit, setChartUnit] = useState<"rupiah" | "kwh">("rupiah");
  const [loading, setLoading] = useState<boolean>(true);

  // State Slide-Over Drawer Troubleshooting Alat Offline
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [selectedOfflineDevice, setSelectedOfflineDevice] =
    useState<Device | null>(null);
  const [retrying, setRetrying] = useState<boolean>(false);
  const [retryFeedback, setRetryFeedback] = useState<
    "idle" | "success" | "still_offline"
  >("idle");

  const fetchDashboardData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [{ data: profile }, { data: rule }, { data: devs }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("tarif_per_kwh")
          .eq("id", user.id)
          .single(),
        supabase
          .from("user_thresholds")
          .select("ambang")
          .eq("user_id", user.id)
          .eq("tipe", "estimasi_biaya")
          .single(),
        supabase
          .from("devices")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
      ]);

    const userDevices = (devs as Device[]) || [];
    if (profile?.tarif_per_kwh) setTarif(Number(profile.tarif_per_kwh));
    if (rule?.ambang) setAmbangBiaya(Number(rule.ambang));
    setDevices(userDevices);

    if (userDevices.length === 0) {
      setReadings([]);
      setLoading(false);
      return;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: reads } = await supabase
      .from("readings")
      .select("*")
      .in(
        "device_id",
        userDevices.map((d) => d.id),
      )
      .gte("ts", todayStart.toISOString())
      .order("ts", { ascending: true })
      .limit(5000);

    setReadings((reads as Reading[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchDashboardData();
    const timer = setInterval(fetchDashboardData, 15000);
    return () => clearInterval(timer);
  }, [fetchDashboardData]);

  // Evaluasi status setiap perangkat
  const now = Date.now();
  const deviceStats = useMemo(() => {
    return devices.map((dev) => {
      const devReads = readings.filter((r) => r.device_id === dev.id);
      const latest =
        devReads.length > 0 ? devReads[devReads.length - 1] : undefined;

      const isOffline =
        !dev.last_seen_at ||
        now - new Date(dev.last_seen_at).getTime() > OFFLINE_THRESHOLD_MS;

      const currentWatt = !isOffline && latest ? Number(latest.p) : 0;
      const deltaWh =
        devReads.length > 0
          ? Math.max(0, Number(latest!.e_wh) - Number(devReads[0].e_wh))
          : 0;
      const kwhToday = deltaWh / 1000;
      const costPerHour = (currentWatt / 1000) * tarif;

      const lastSeenFormatted = dev.last_seen_at
        ? new Date(dev.last_seen_at).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Belum pernah terhubung";

      return {
        ...dev,
        isOffline,
        currentWatt,
        kwhToday,
        costPerHour,
        lastSeenFormatted,
        hasReadings: devReads.length > 0,
      };
    });
  }, [devices, readings, now, tarif]);

  const offlineDevices = deviceStats.filter((d) => d.isOffline);
  const onlineDevices = deviceStats.filter((d) => !d.isOffline);

  const currentPowerTotal = onlineDevices.reduce(
    (sum, d) => sum + d.currentWatt,
    0,
  );
  const totalKwhToday = deviceStats.reduce((sum, d) => sum + d.kwhToday, 0);
  const biayaHariIni = totalKwhToday * tarif;
  const estimasiBiayaBulan = biayaHariIni * 30;

  const isOverBudget = estimasiBiayaBulan > ambangBiaya;
  const selisihBatas = Math.abs(estimasiBiayaBulan - ambangBiaya);

  // Target kuota kWh bulanan diturunkan dari ambangBiaya / tarif
  const batasKwhBulan = tarif > 0 ? ambangBiaya / tarif : 34.6;
  const proyeksiKwhBulan = totalKwhToday * 30;
  const kuotaPersenRaw =
    batasKwhBulan > 0 ? (proyeksiKwhBulan / batasKwhBulan) * 100 : 0;
  const kuotaPersen = Math.min(100, Math.round(kuotaPersenRaw));
  const sisaKwh = Math.max(0, batasKwhBulan - proyeksiKwhBulan);

  // Perangkat dengan konsumsi hari ini tertinggi (untuk analisis & tips hemat)
  const topConsumer = useMemo(() => {
    if (deviceStats.length === 0) return null;
    return [...deviceStats].sort((a, b) => b.kwhToday - a.kwhToday)[0];
  }, [deviceStats]);

  // Data Grafik Pemakaian Hari Ini (Rupiah vs kWh)
  const chartData = useMemo(() => {
    return readings.slice(-24).map((r) => {
      const watt = Number(r.p);
      const kwhPerHour = watt / 1000;
      const rupiahPerHour = Math.round(kwhPerHour * tarif);
      return {
        waktu: new Date(r.ts).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        nilai:
          chartUnit === "rupiah"
            ? rupiahPerHour
            : Number(kwhPerHour.toFixed(3)),
        watt,
      };
    });
  }, [readings, tarif, chartUnit]);

  const openTroubleshootDrawer = (dev?: Device) => {
    const target = dev || offlineDevices[0] || null;
    setSelectedOfflineDevice(target);
    setRetryFeedback("idle");
    setDrawerOpen(true);
  };

  const handleRetryConnection = async () => {
    setRetrying(true);
    setRetryFeedback("idle");
    await fetchDashboardData();

    const targetId = selectedOfflineDevice?.id;
    if (!targetId) {
      setRetrying(false);
      return;
    }

    const { data: freshDev } = await supabase
      .from("devices")
      .select("last_seen_at")
      .eq("id", targetId)
      .single();

    setRetrying(false);
    const stillOff =
      !freshDev?.last_seen_at ||
      Date.now() - new Date(freshDev.last_seen_at).getTime() >
        OFFLINE_THRESHOLD_MS;

    setRetryFeedback(stillOff ? "still_offline" : "success");
  };

  const activeOfflineTarget = selectedOfflineDevice
    ? deviceStats.find((d) => d.id === selectedOfflineDevice.id) ||
      offlineDevices[0]
    : offlineDevices[0];

  return (
    <AppShell>
      <div className="w-full max-w-full overflow-x-hidden">
        {/* 1. TOP STATUS BANNER (4 Kondisi: Kosong, Offline, Peringatan Biaya, Normal) */}
        {loading ? (
          <div className="bg-surface-container-lowest border border-outline-variant/60 p-4 sm:p-5 rounded-2xl mb-4 sm:mb-6 flex items-center gap-3 animate-pulse">
            <div className="w-10 h-10 rounded-xl bg-surface-container shrink-0" />
            <div className="space-y-2 flex-1 min-w-0">
              <div className="h-4 w-44 sm:w-56 max-w-full bg-surface-container rounded" />
              <div className="h-3 w-64 sm:w-80 max-w-full bg-surface-container rounded" />
            </div>
          </div>
        ) : devices.length === 0 ? (
          <section className="bg-surface-container-lowest border border-outline-variant p-4 sm:p-5 rounded-2xl mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary-fixed text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">
                  devices
                </span>
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-base sm:text-lg text-on-surface leading-snug">
                  Belum ada alat IoT yang terhubung
                </h2>
                <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 leading-relaxed">
                  Daftarkan modul ESP32 + PZEM-004T pertama Anda untuk mulai
                  memantau pemakaian listrik perangkat.
                </p>
              </div>
            </div>
            <Link
              href="/perangkat"
              className="w-full sm:w-auto min-h-[44px] bg-primary-container hover:bg-primary text-on-primary text-sm font-semibold px-5 py-2.5 rounded-xl transition flex items-center justify-center gap-2 shrink-0 whitespace-nowrap"
            >
              <span>Tambah Perangkat</span>
              <span className="material-symbols-outlined text-[18px]">
                arrow_forward
              </span>
            </Link>
          </section>
        ) : offlineDevices.length > 0 ? (
          /* BANNER KONDISI ALAT OFFLINE */
          <section className="w-full bg-error-container text-on-error-container rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4 sm:mb-6 shadow-xs border border-error/20">
            <div className="flex items-start md:items-center gap-3 sm:gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-full bg-error/15 text-error flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">
                  warning
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm sm:text-base font-bold text-error">
                    Alat Terputus Sementara
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-error/20 text-error text-[11px] font-bold uppercase tracking-wider shrink-0">
                    Perhatian
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-on-error-container mt-1 leading-relaxed break-words">
                  <strong>
                    {offlineDevices.map((d) => d.nama).join(", ")}
                  </strong>{" "}
                  tidak terhubung (&gt; 2 menit tanpa data
                  {offlineDevices[0]?.lastSeenFormatted
                    ? `, terakhir ${offlineDevices[0].lastSeenFormatted} WIB`
                    : ""}
                  ). Biaya bisa terlihat lebih rendah dari sebenarnya.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openTroubleshootDrawer(offlineDevices[0])}
              className="w-full md:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-container hover:bg-primary text-on-primary text-sm font-semibold rounded-xl shadow-xs transition-all shrink-0 cursor-pointer whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[18px]">
                build
              </span>
              <span>Cara Mengatasi</span>
            </button>
          </section>
        ) : isOverBudget ? (
          /* BANNER KONDISI PERINGATAN (Soft Amber #FEF3C7) */
          <section className="bg-[#FEF3C7] border border-[#FDE68A] p-4 sm:p-5 rounded-2xl mb-4 sm:mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3 sm:gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#FDE68A]/70 flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[#92400E] text-[24px]">
                  warning
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <h2 className="font-bold text-sm sm:text-base md:text-lg text-[#92400E] leading-snug">
                  Perkiraan biaya alat terpantau bulan ini Rp{" "}
                  {Math.round(estimasiBiayaBulan).toLocaleString("id-ID")} —
                  melewati batas Rp{" "}
                  {Math.round(ambangBiaya).toLocaleString("id-ID")}
                </h2>
                <p className="text-xs sm:text-sm text-[#A16207] mt-1 leading-relaxed">
                  {topConsumer && topConsumer.kwhToday > 0
                    ? `${topConsumer.nama} menjadi penyumbang pemakaian terbesar hari ini.`
                    : "Pola pemakaian hari ini berpotensi melampaui batas target bulanan Anda."}
                </p>
              </div>
            </div>
            <div className="shrink-0 w-full md:w-auto">
              <Link
                href="/cek"
                className="w-full md:w-auto min-h-[44px] bg-primary-container hover:bg-primary text-on-primary text-sm font-semibold px-5 py-2.5 rounded-xl transition flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <span>Lihat Penyebabnya</span>
                <span className="material-symbols-outlined text-[18px]">
                  arrow_forward
                </span>
              </Link>
            </div>
          </section>
        ) : (
          /* BANNER KONDISI NORMAL */
          <section className="bg-[#EFF6FF] border border-[#BFDBFE] p-4 sm:p-5 rounded-2xl mb-4 sm:mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start md:items-center gap-3 sm:gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#DBEAFE] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary-container text-[24px]">
                  verified
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <h2 className="font-bold text-sm sm:text-base md:text-lg text-[#1E3A8A] leading-snug">
                  Pemakaian perangkat terpantau aman
                </h2>
                <p className="text-xs sm:text-sm text-primary-container mt-0.5 leading-relaxed">
                  Perkiraan biaya akhir bulan Rp{" "}
                  {Math.round(estimasiBiayaBulan).toLocaleString("id-ID")} (di
                  bawah batas Rp{" "}
                  {Math.round(ambangBiaya).toLocaleString("id-ID")}) — pola
                  pemakaian normal.
                </p>
              </div>
            </div>
            <div className="shrink-0 w-full md:w-auto flex items-center gap-2">
              <span className="w-full md:w-auto justify-center bg-[#DBEAFE] text-[#1E3A8A] text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="material-symbols-outlined text-[18px]">
                  check_circle
                </span>
                Status Normal
              </span>
            </div>
          </section>
        )}

        {/* 2. ROW 1: THREE BIG SUMMARY CARDS */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
          {/* Card 1: Biaya Hari Ini */}
          <div className="bg-surface-container-lowest border border-outline-variant/80 p-4 sm:p-6 rounded-2xl flex flex-col justify-between shadow-2xs min-w-0">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-on-surface-variant">
                  Biaya Hari Ini
                </span>
                <span className="bg-surface-container text-on-surface-variant text-xs px-2.5 py-0.5 rounded-md font-semibold shrink-0">
                  Estimasi
                </span>
              </div>
              <div className="font-extrabold text-[26px] sm:text-[32px] leading-tight sm:leading-[40px] text-on-surface mt-2 tracking-tight break-words">
                Rp {Math.round(biayaHariIni).toLocaleString("id-ID")}
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs sm:text-sm text-on-surface-variant font-medium">
                  {totalKwhToday.toFixed(2).replace(".", ",")} kWh terukur •
                  Daya aktif {Math.round(currentPowerTotal)} W
                </span>
                <span className="bg-surface-container-high text-on-surface text-xs px-2 py-0.5 rounded font-semibold shrink-0">
                  Terukur
                </span>
              </div>
            </div>

            <div className="mt-4 sm:mt-5 pt-3.5 border-t border-outline-variant/50 flex flex-col gap-1">
              <div className="flex items-start sm:items-center gap-1.5 text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5 sm:mt-0">
                  info
                </span>
                <span className="text-xs leading-snug">
                  Dihitung dari {onlineDevices.length} alat aktif sejak 00:00
                </span>
              </div>
              {offlineDevices.length > 0 && (
                <div className="flex items-start sm:items-center gap-1.5 text-error text-xs font-semibold">
                  <span className="material-symbols-outlined text-[15px] shrink-0 mt-0.5 sm:mt-0">
                    wifi_off
                  </span>
                  <span className="leading-snug">
                    ({offlineDevices.length} alat terputus belum memperbarui
                    data)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Perkiraan Akhir Bulan */}
          <div className="bg-surface-container-lowest border border-outline-variant/80 p-4 sm:p-6 rounded-2xl flex flex-col justify-between shadow-2xs min-w-0">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-on-surface-variant">
                  Perkiraan Akhir Bulan
                </span>
                <span className="bg-surface-container text-on-surface-variant text-xs px-2.5 py-0.5 rounded-md font-semibold shrink-0">
                  Estimasi
                </span>
              </div>
              <div className="font-extrabold text-[26px] sm:text-[32px] leading-tight sm:leading-[40px] text-on-surface mt-2 tracking-tight break-words">
                Rp {Math.round(estimasiBiayaBulan).toLocaleString("id-ID")}
              </div>
              <div className="mt-2.5">
                {isOverBudget ? (
                  <span className="bg-[#FEF3C7] text-[#92400E] text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#FDE68A] inline-flex items-start sm:items-center gap-1.5 leading-snug">
                    <span className="material-symbols-outlined text-[14px] shrink-0 mt-0.5 sm:mt-0">
                      trending_up
                    </span>
                    <span>
                      +Rp {Math.round(selisihBatas).toLocaleString("id-ID")} di
                      atas batas Rp{" "}
                      {Math.round(ambangBiaya).toLocaleString("id-ID")}
                    </span>
                  </span>
                ) : (
                  <span className="bg-[#EFF6FF] text-primary-container text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#BFDBFE] inline-flex items-start sm:items-center gap-1.5 leading-snug">
                    <span className="material-symbols-outlined text-[14px] shrink-0 mt-0.5 sm:mt-0">
                      check
                    </span>
                    <span>
                      Aman • Rp{" "}
                      {Math.round(selisihBatas).toLocaleString("id-ID")} di
                      bawah batas
                    </span>
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 sm:mt-5 pt-3.5 border-t border-outline-variant/50 flex flex-col gap-1">
              {offlineDevices.length > 0 ? (
                <div className="flex items-start sm:items-center gap-1.5 text-secondary text-xs font-semibold">
                  <span className="material-symbols-outlined text-[15px] shrink-0 mt-0.5 sm:mt-0">
                    warning_amber
                  </span>
                  <span className="leading-snug">
                    Estimasi belum termasuk alat terputus
                  </span>
                </div>
              ) : (
                <div className="flex items-start sm:items-center gap-1.5 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5 sm:mt-0">
                    history
                  </span>
                  <span className="text-xs leading-snug">
                    Proyeksi 30 hari berdasarkan pemakaian hari ini
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Sisa Kuota Target Hemat */}
          <div className="bg-surface-container-lowest border border-outline-variant/80 p-4 sm:p-6 rounded-2xl flex flex-col justify-between shadow-2xs min-w-0">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-on-surface-variant">
                  Sisa Kuota Target Hemat
                </span>
                {isOverBudget ? (
                  <span className="bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] text-xs px-2.5 py-0.5 rounded-full font-semibold shrink-0 whitespace-nowrap">
                    Melewati Batas
                  </span>
                ) : kuotaPersen >= 75 ? (
                  <span className="bg-surface-container-high text-on-surface text-xs px-2.5 py-0.5 rounded-full font-semibold shrink-0 whitespace-nowrap">
                    Waspada
                  </span>
                ) : (
                  <span className="bg-[#EFF6FF] text-primary-container text-xs px-2.5 py-0.5 rounded-full font-semibold border border-[#BFDBFE] shrink-0 whitespace-nowrap">
                    Cukup Hemat
                  </span>
                )}
              </div>

              <div className="font-extrabold text-[26px] sm:text-[32px] leading-tight sm:leading-[40px] text-on-surface mt-2 tracking-tight">
                {Math.round(kuotaPersenRaw)}% Terpakai
              </div>

              {/* Progress bar Deep Navy */}
              <div className="w-full bg-surface-container-high h-2.5 rounded-full mt-3.5 mb-2 overflow-hidden">
                <div
                  className="bg-primary-container h-full rounded-full transition-all duration-300"
                  style={{ width: `${kuotaPersen}%` }}
                />
              </div>

              <div className="text-xs sm:text-sm text-on-surface font-medium">
                {proyeksiKwhBulan.toFixed(1).replace(".", ",")} dari batas{" "}
                {batasKwhBulan.toFixed(1).replace(".", ",")} kWh
              </div>
            </div>

            <div className="mt-4 sm:mt-5 pt-3.5 border-t border-outline-variant/50 flex items-center justify-between gap-2 text-on-surface-variant">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="material-symbols-outlined text-[16px] shrink-0">
                  energy_savings_leaf
                </span>
                <span className="text-xs truncate">
                  Tersisa {sisaKwh.toFixed(1).replace(".", ",")} kWh di siklus
                  ini
                </span>
              </div>
              <Link
                href="/pengingat"
                className="text-xs font-semibold text-primary-container hover:underline shrink-0 whitespace-nowrap"
              >
                Atur Batas
              </Link>
            </div>
          </div>
        </section>

        {/* 3. ROW 2: SPLIT 2 COLUMNS (CHART 7 COLS + DEVICES 5 COLS) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 mb-6 items-start">
          {/* Left Column: Grafik Pemakaian Hari Ini */}
          <div className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant/80 p-4 sm:p-6 rounded-2xl flex flex-col justify-between shadow-2xs min-w-0">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-outline-variant/50">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base sm:text-lg text-on-surface">
                      Grafik Pemakaian Hari Ini
                    </h3>
                    <span className="bg-surface-container text-on-surface-variant text-xs px-2 py-0.5 rounded font-semibold shrink-0">
                      {chartUnit === "rupiah"
                        ? "Estimasi Biaya"
                        : "Energi Terukur"}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
                    Pemantauan per pembacaan untuk {devices.length} alat
                    terhubung
                  </p>
                </div>

                {/* Toggle Switcher Rupiah / kWh */}
                <div className="bg-surface-container p-1 rounded-xl flex items-center self-start sm:self-auto border border-outline-variant/60 shrink-0">
                  <button
                    type="button"
                    onClick={() => setChartUnit("rupiah")}
                    className={`text-xs px-3 sm:px-3.5 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                      chartUnit === "rupiah"
                        ? "bg-primary-container text-on-primary font-semibold"
                        : "bg-transparent text-on-surface-variant font-medium hover:text-on-surface"
                    }`}
                  >
                    Rupiah (Aktif)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartUnit("kwh")}
                    className={`text-xs px-3 sm:px-3.5 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                      chartUnit === "kwh"
                        ? "bg-primary-container text-on-primary font-semibold"
                        : "bg-transparent text-on-surface-variant font-medium hover:text-on-surface"
                    }`}
                  >
                    kWh
                  </button>
                </div>
              </div>

              {/* Area Chart */}
              <div className="h-56 sm:h-64 w-full mt-4 sm:mt-5">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="navyArea"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#1E40AF"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="100%"
                            stopColor="#1E40AF"
                            stopOpacity={0.0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e9e1dd"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="waktu"
                        tick={{ fontSize: 11, fill: "#444653" }}
                        axisLine={{ stroke: "#c4c5d5" }}
                        tickLine={false}
                        minTickGap={20}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#444653" }}
                        axisLine={false}
                        tickLine={false}
                        width={52}
                        tickFormatter={(val) =>
                          chartUnit === "rupiah" ? `Rp ${val}` : `${val}`
                        }
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderColor: "#c4c5d5",
                          borderRadius: "12px",
                          fontSize: "12px",
                        }}
                        formatter={(value: unknown) => [
                          chartUnit === "rupiah"
                            ? `Rp ${Number(value).toLocaleString("id-ID")}/jam`
                            : `${value} kWh/jam`,
                          chartUnit === "rupiah" ? "Laju Biaya" : "Laju Energi",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="nilai"
                        stroke="#1E40AF"
                        fill="url(#navyArea)"
                        strokeWidth={2.5}
                        activeDot={{
                          r: 5,
                          fill: "#1E40AF",
                          stroke: "#ffffff",
                          strokeWidth: 2,
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full rounded-xl bg-surface-container-low border border-outline-variant/50 flex flex-col items-center justify-center text-center p-5 sm:p-6">
                    <span className="material-symbols-outlined text-[32px] text-on-surface-variant mb-2">
                      show_chart
                    </span>
                    <p className="text-sm font-semibold text-on-surface">
                      Belum ada data pembacaan hari ini
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1 max-w-sm leading-relaxed">
                      Pastikan modul ESP32 terhubung ke Wi-Fi 2.4 GHz dan
                      perangkat elektronik dinyalakan.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Note banner below chart */}
            <div className="mt-4 bg-surface-container-low border border-outline-variant/60 text-on-surface p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="material-symbols-outlined text-primary-container text-[20px] shrink-0 mt-0.5">
                  analytics
                </span>
                <p className="leading-relaxed">
                  <strong className="font-semibold text-on-surface">
                    Ringkasan Hari Ini:
                  </strong>{" "}
                  {isOverBudget
                    ? "Terlihat peningkatan pemakaian yang berpotensi melampaui target biaya bulanan Anda."
                    : "Pemakaian listrik seluruh perangkat terpantau wajar dan stabil sesuai batas harian."}
                </p>
              </div>
              <Link
                href="/pantau"
                className="text-xs font-bold text-primary-container hover:underline inline-flex items-center gap-1 shrink-0 self-end sm:self-auto whitespace-nowrap"
              >
                <span>Detail Riwayat</span>
                <span className="material-symbols-outlined text-[16px]">
                  arrow_forward
                </span>
              </Link>
            </div>
          </div>

          {/* Right Column: Kondisi Perangkat Terpasang */}
          <div className="lg:col-span-5 bg-surface-container-lowest border border-outline-variant/80 p-4 sm:p-6 rounded-2xl flex flex-col justify-between shadow-2xs min-w-0">
            <div>
              <div className="flex flex-wrap items-center justify-between pb-3.5 border-b border-outline-variant/50 gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-base sm:text-lg text-on-surface">
                    Kondisi {devices.length} Perangkat Terpasang
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Hanya colokan terpantau (Prinsip 1 Alat = 1 Perangkat)
                  </p>
                </div>
                <span className="bg-surface-container-high text-on-surface text-xs font-semibold px-3 py-1 rounded-full shrink-0 whitespace-nowrap">
                  {onlineDevices.length} Aktif
                  {offlineDevices.length > 0
                    ? ` • ${offlineDevices.length} Offline`
                    : ""}
                </span>
              </div>

              {/* Appliance List */}
              <div className="flex flex-col gap-3 sm:gap-3.5 mt-4">
                {deviceStats.length === 0 ? (
                  <div className="p-5 rounded-xl bg-surface-container-low text-center">
                    <p className="text-sm font-semibold text-on-surface">
                      Daftar perangkat masih kosong
                    </p>
                    <Link
                      href="/perangkat"
                      className="inline-flex items-center gap-1 text-xs font-bold text-primary-container hover:underline mt-2"
                    >
                      <span>Daftarkan alat sekarang</span>
                      <span className="material-symbols-outlined text-[15px]">
                        arrow_forward
                      </span>
                    </Link>
                  </div>
                ) : (
                  deviceStats.map((dev) => {
                    const isActiveDraw = !dev.isOffline && dev.currentWatt > 2;

                    if (dev.isOffline) {
                      return (
                        <div
                          key={dev.id}
                          className="p-3.5 sm:p-4 rounded-xl bg-error-container/35 border border-error/25 flex flex-col gap-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-surface-container-lowest text-error flex items-center justify-center shrink-0 shadow-2xs">
                                <span className="material-symbols-outlined text-[22px]">
                                  {getDeviceIcon(dev.nama)}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-on-surface break-words">
                                    {dev.nama}
                                  </span>
                                  {dev.lokasi && (
                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-surface-container-highest text-on-surface-variant">
                                      {dev.lokasi}
                                    </span>
                                  )}
                                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-error-container text-error inline-flex items-center gap-1 shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-error" />
                                    Offline
                                  </span>
                                </div>
                                <p className="text-xs text-error font-semibold mt-1 leading-snug">
                                  0 W • Terakhir kirim data:{" "}
                                  {dev.lastSeenFormatted}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-error/15 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                              <span className="material-symbols-outlined text-[15px] shrink-0">
                                wifi_off
                              </span>
                              <span>Tidak ada respons &gt; 2 menit</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => openTroubleshootDrawer(dev)}
                              className="px-3 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high text-primary-container text-xs font-bold inline-flex items-center gap-1 shadow-2xs transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                            >
                              <span>Cek Koneksi</span>
                              <span className="material-symbols-outlined text-[15px]">
                                arrow_forward
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={dev.id}
                        className="p-3.5 rounded-xl border border-outline-variant/80 bg-surface-container-lowest flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center shrink-0 ${
                              isActiveDraw
                                ? "text-primary-container"
                                : "text-on-surface-variant"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[22px]">
                              {getDeviceIcon(dev.nama)}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              <span className="text-sm font-bold text-on-surface break-words">
                                {dev.nama}
                              </span>
                              {dev.lokasi && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-surface-container-highest text-on-surface">
                                  {dev.lokasi}
                                </span>
                              )}
                              {isActiveDraw ? (
                                <span className="bg-[#EFF6FF] text-primary-container border border-[#BFDBFE] font-semibold px-2 py-0.5 rounded text-xs shrink-0 whitespace-nowrap">
                                  Menyala Normal
                                </span>
                              ) : (
                                <span className="bg-surface-container-high text-on-surface-variant font-medium px-2 py-0.5 rounded text-xs shrink-0 whitespace-nowrap">
                                  Standby
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-on-surface-variant mt-0.5">
                              {Math.round(dev.currentWatt)} W • ± Rp{" "}
                              {Math.round(dev.costPerHour).toLocaleString(
                                "id-ID",
                              )}
                              /jam Terukur
                            </p>
                          </div>
                        </div>

                        <Link
                          href="/hemat"
                          title="Simulasikan Penghematan"
                          className="w-full sm:w-auto text-center shrink-0 border border-outline-variant text-on-surface hover:bg-surface-container px-3 py-2 sm:py-1.5 text-xs rounded-lg font-semibold transition whitespace-nowrap"
                        >
                          Simulasi
                        </Link>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Bottom Info Card: Tips Hemat / Catatan Alat Terputus */}
            {offlineDevices.length > 0 ? (
              <div className="p-3.5 bg-surface-container-low border border-outline-variant/60 rounded-xl mt-4 flex items-start gap-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">
                  lightbulb
                </span>
                <p className="text-xs leading-relaxed">
                  Alat yang terputus tetap mengalirkan listrik fisik kecuali
                  dimatikan manual lewat sakelar dinding.
                </p>
              </div>
            ) : (
              <div className="bg-surface-container-low border border-outline-variant/60 p-3.5 sm:p-4 rounded-xl mt-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-on-primary text-[18px]">
                    lightbulb
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-on-surface">
                    Tips Hemat Perangkat
                  </span>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                    {isOverBudget && topConsumer ? (
                      <>
                        Kurangi durasi menyala{" "}
                        <strong className="text-on-surface">
                          {topConsumer.nama}
                        </strong>{" "}
                        sebanyak 2 jam/hari untuk menekan proyeksi biaya agar
                        kembali di bawah Rp{" "}
                        {Math.round(ambangBiaya).toLocaleString("id-ID")}.
                      </>
                    ) : (
                      <>
                        Pemakaian listrik perangkat terpantau stabil dan
                        terkendali. Anda berada di jalur aman untuk menghemat{" "}
                        <strong className="text-on-surface">
                          Rp {Math.round(selisihBatas).toLocaleString("id-ID")}
                        </strong>{" "}
                        bulan ini.
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 4. SLIDE-OVER SIDE DRAWER: LANGKAH PERBAIKAN ALAT OFFLINE */}
        {drawerOpen && activeOfflineTarget && (
          <div
            className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-xs z-50 transition-opacity duration-300 flex justify-end"
            onClick={(e) => {
              if (e.target === e.currentTarget) setDrawerOpen(false);
            }}
          >
            <div className="w-full max-w-[460px] h-dvh bg-surface-container-lowest shadow-2xl flex flex-col justify-between overflow-y-auto">
              {/* Drawer Header */}
              <div className="p-4 sm:p-6 bg-surface-container-low border-b border-outline-variant/60 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-error-container text-error flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px]">
                        build
                      </span>
                    </div>
                    <h3 className="font-bold text-base sm:text-lg text-on-surface truncate">
                      Langkah Perbaikan Alat
                    </h3>
                  </div>
                  <button
                    type="button"
                    aria-label="Tutup Panduan"
                    onClick={() => setDrawerOpen(false)}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer shrink-0"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      close
                    </span>
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed">
                  <strong>
                    {activeOfflineTarget.nama}
                    {activeOfflineTarget.lokasi
                      ? ` di ${activeOfflineTarget.lokasi}`
                      : ""}
                  </strong>{" "}
                  belum memperbarui data daya sejak{" "}
                  <strong>{activeOfflineTarget.lastSeenFormatted}</strong>.
                </p>
              </div>

              {/* Drawer Content: 3 Langkah Jelas */}
              <div className="p-4 sm:p-6 flex flex-col gap-5 sm:gap-6 flex-1">
                {/* Step 1 */}
                <div className="flex items-start gap-3.5 sm:gap-4">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary-container text-on-primary font-bold text-sm sm:text-base flex items-center justify-center shrink-0 shadow-2xs">
                    1
                  </div>
                  <div className="flex flex-col min-w-0">
                    <h4 className="text-sm sm:text-base font-bold text-on-surface">
                      Pastikan Wi-Fi rumah menyala
                    </h4>
                    <p className="text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed">
                      Periksa router internet rumah. Pastikan jaringan Wi-Fi{" "}
                      <strong>2.4 GHz</strong> aktif dan menjangkau posisi
                      stopkontak alat.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3.5 sm:gap-4">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary-container text-on-primary font-bold text-sm sm:text-base flex items-center justify-center shrink-0 shadow-2xs">
                    2
                  </div>
                  <div className="flex flex-col min-w-0">
                    <h4 className="text-sm sm:text-base font-bold text-on-surface">
                      Cek steker &amp; stopkontak modul
                    </h4>
                    <p className="text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed">
                      Pastikan steker modul ESP32 menancap kencang ke stopkontak
                      dinding dan indikator daya pada modul menyala.
                    </p>
                    <div className="mt-2.5 py-2 px-3 rounded-lg bg-surface-container-low flex items-start sm:items-center gap-2 text-on-surface-variant text-xs font-semibold">
                      <span className="material-symbols-outlined text-[18px] text-primary-container shrink-0 mt-0.5 sm:mt-0">
                        power
                      </span>
                      <span className="leading-snug">
                        Jika perlu, cabut dan tancapkan kembali selama 5 detik.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3.5 sm:gap-4">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary-container text-on-primary font-bold text-sm sm:text-base flex items-center justify-center shrink-0 shadow-2xs">
                    3
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <h4 className="text-sm sm:text-base font-bold text-on-surface">
                      Cocokkan ulang ID &amp; Kunci Alat
                    </h4>
                    <p className="text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed">
                      Periksa konfigurasi kode perangkat di menu Perangkat jika
                      sinyal tidak kembali dalam 2–5 menit.
                    </p>
                    {activeOfflineTarget.device_code && (
                      <div className="mt-2.5 py-2 px-3 rounded-lg bg-surface-container-low flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-on-surface-variant">
                        <span className="break-all">
                          ID Alat:{" "}
                          <strong className="text-on-surface">
                            {activeOfflineTarget.device_code}
                          </strong>
                        </span>
                        <Link
                          href="/perangkat"
                          className="text-primary-container hover:underline shrink-0 whitespace-nowrap"
                        >
                          Buka Perangkat
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {retryFeedback === "still_offline" && (
                  <div className="p-3.5 rounded-xl bg-error-container/50 border border-error/25 text-xs text-error font-semibold flex items-start gap-2">
                    <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
                      report
                    </span>
                    <span className="leading-snug">
                      Alat masih belum mengirimkan pembacaan baru. Periksa daya
                      listrik atau Wi-Fi pada modul.
                    </span>
                  </div>
                )}

                {retryFeedback === "success" && (
                  <div className="p-3.5 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-xs text-primary-container font-semibold flex items-start gap-2">
                    <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
                      check_circle
                    </span>
                    <span className="leading-snug">
                      Alat berhasil terhubung kembali!
                    </span>
                  </div>
                )}
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 sm:p-6 bg-surface-container-low border-t border-outline-variant/60 flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3">
                <button
                  type="button"
                  disabled={retrying}
                  onClick={handleRetryConnection}
                  className="w-full sm:w-auto flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-3 bg-primary-container hover:bg-primary text-on-primary text-sm font-semibold rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap"
                >
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      retrying ? "animate-spin" : ""
                    }`}
                  >
                    sync
                  </span>
                  <span>
                    {retrying ? "Memeriksa Koneksi..." : "Coba Hubungkan Ulang"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="w-full sm:w-auto min-h-[44px] px-5 py-3 bg-surface-container-lowest hover:bg-surface-container text-on-surface border border-outline-variant text-sm font-semibold rounded-xl transition-colors cursor-pointer text-center whitespace-nowrap"
                >
                  Tutup Panduan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
