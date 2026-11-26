// src/app/cek/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase";

interface DeviceRow {
  id: string;
  nama: string;
  jenis_beban?: string | null;
  lokasi?: string | null;
  last_seen_at?: string | null;
}

interface ReadingRow {
  id: string;
  device_id: string;
  ts: string;
  p: number;
  e_wh: number;
}

interface DeviceBreakdown {
  id: string;
  nama: string;
  subLabel: string;
  icon: string;
  color: string;
  kwh: number;
  biaya: number;
  persen: number;
  latestWatt: number;
  isOnline: boolean;
}

const SLICE_COLORS = ["#1E40AF", "#475569", "#D97706", "#0D9488", "#6366F1"];
const OFFLINE_THRESHOLD_MS = 120_000;
const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function getDeviceIcon(nama: string, jenis?: string | null): string {
  const text = `${nama} ${jenis || ""}`.toLowerCase();
  if (text.includes("kipas") || text.includes("ac") || text.includes("fan")) {
    return "mode_fan";
  }
  if (text.includes("lampu") || text.includes("lamp")) {
    return "table_lamp";
  }
  if (
    text.includes("teko") ||
    text.includes("kopi") ||
    text.includes("dispenser") ||
    text.includes("magic") ||
    text.includes("rice")
  ) {
    return "coffee_maker";
  }
  if (text.includes("kulkas") || text.includes("fridge")) {
    return "kitchen";
  }
  if (text.includes("tv") || text.includes("komputer") || text.includes("pc")) {
    return "tv";
  }
  return "bolt";
}

export default function CekPage() {
  const supabase = useMemo(() => createClient(), []);

  const [period, setPeriod] = useState<"today" | "7d" | "month">("month");
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [readings, setReadings] = useState<ReadingRow[]>([]);
  const [sevenDayReadings, setSevenDayReadings] = useState<ReadingRow[]>([]);
  const [tarif, setTarif] = useState<number>(1444.7);
  const [golongan, setGolongan] = useState<string>("R-1/TR 900 VA");
  const [batasAmanRp, setBatasAmanRp] = useState<number>(50000);
  // null = default (tampilkan gabungan semua perangkat tanpa ada item "Semua Perangkat" di daftar)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const [editingTarif, setEditingTarif] = useState<boolean>(false);
  const [tarifInput, setTarifInput] = useState<string>("1444.7");
  const [savingTarif, setSavingTarif] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [{ data: profile }, { data: budgetRule }, { data: devsData }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("tarif_per_kwh, golongan_daya")
          .eq("id", user.id)
          .single(),
        supabase
          .from("alert_rules")
          .select("ambang")
          .eq("user_id", user.id)
          .eq("tipe", "estimasi_biaya")
          .single(),
        supabase
          .from("devices")
          .select("id, nama, jenis_beban, lokasi, last_seen_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
      ]);

    if (profile?.tarif_per_kwh) {
      const tVal = Number(profile.tarif_per_kwh);
      setTarif(tVal);
      setTarifInput(String(tVal));
    }
    if (profile?.golongan_daya) {
      setGolongan(profile.golongan_daya);
    }
    if (budgetRule?.ambang) {
      setBatasAmanRp(Number(budgetRule.ambang));
    }

    const devList = (devsData as DeviceRow[]) || [];
    setDevices(devList);

    if (devList.length === 0) {
      setReadings([]);
      setSevenDayReadings([]);
      setLoading(false);
      return;
    }

    const devIds = devList.map((d) => d.id);

    const startPeriod = new Date();
    if (period === "today") {
      startPeriod.setHours(0, 0, 0, 0);
    } else if (period === "7d") {
      startPeriod.setDate(startPeriod.getDate() - 7);
      startPeriod.setHours(0, 0, 0, 0);
    } else {
      startPeriod.setDate(1);
      startPeriod.setHours(0, 0, 0, 0);
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [{ data: periodReads }, { data: weekReads }] = await Promise.all([
      supabase
        .from("readings")
        .select("id, device_id, ts, p, e_wh")
        .in("device_id", devIds)
        .gte("ts", startPeriod.toISOString())
        .order("ts", { ascending: true })
        .limit(10000),
      supabase
        .from("readings")
        .select("id, device_id, ts, p, e_wh")
        .in("device_id", devIds)
        .gte("ts", sevenDaysAgo.toISOString())
        .order("ts", { ascending: true })
        .limit(10000),
    ]);

    setReadings((periodReads as ReadingRow[]) || []);
    setSevenDayReadings((weekReads as ReadingRow[]) || []);
    setLoading(false);
  }, [supabase, period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Hitung rincian kontribusi setiap perangkat (total tepat 100%)
  const { breakdown, totalKwh, totalBiaya, projectedMonthRp } = useMemo(() => {
    if (devices.length === 0) {
      return {
        breakdown: [] as DeviceBreakdown[],
        totalKwh: 0,
        totalBiaya: 0,
        projectedMonthRp: 0,
      };
    }

    const now = Date.now();
    const rawItems = devices.map((dev, idx) => {
      const devReads = readings.filter((r) => r.device_id === dev.id);
      const isOnline =
        !!dev.last_seen_at &&
        now - new Date(dev.last_seen_at).getTime() <= OFFLINE_THRESHOLD_MS;

      let kwh = 0;
      if (devReads.length > 1) {
        const deltaWh = Math.max(
          0,
          Number(devReads[devReads.length - 1].e_wh) - Number(devReads[0].e_wh),
        );
        kwh = deltaWh / 1000;
      } else if (devReads.length === 1) {
        kwh = Math.max(0.001, Number(devReads[0].p) / 1000);
      }

      const latestRead =
        devReads.length > 0 ? devReads[devReads.length - 1] : null;
      const latestWatt =
        isOnline && latestRead ? Math.round(Number(latestRead.p)) : 0;

      return {
        id: dev.id,
        nama: dev.nama,
        subLabel: dev.lokasi || dev.jenis_beban || "Colokan Terpantau",
        icon: getDeviceIcon(dev.nama, dev.jenis_beban),
        color: SLICE_COLORS[idx % SLICE_COLORS.length],
        kwh,
        biaya: kwh * tarif,
        latestWatt,
        isOnline,
      };
    });

    const sumKwh = rawItems.reduce((acc, item) => acc + item.kwh, 0);
    const sumBiaya = sumKwh * tarif;

    let allocatedPct = 0;
    const sorted = [...rawItems].sort((a, b) => b.kwh - a.kwh);
    const enriched: DeviceBreakdown[] = sorted.map((item, idx) => {
      let persen = 0;
      if (sumKwh > 0) {
        if (idx === sorted.length - 1) {
          persen = Math.max(0, Number((100 - allocatedPct).toFixed(1)));
        } else {
          persen = Number(((item.kwh / sumKwh) * 100).toFixed(1));
          allocatedPct += persen;
        }
      } else if (sorted.length > 0) {
        persen = Number((100 / sorted.length).toFixed(1));
      }
      return { ...item, persen };
    });

    const todayDate = new Date().getDate();
    const elapsedDays =
      period === "today" ? 1 : period === "7d" ? 7 : Math.max(1, todayDate);
    const projected = Math.round((sumBiaya / elapsedDays) * 30);

    return {
      breakdown: enriched,
      totalKwh: sumKwh,
      totalBiaya: sumBiaya,
      projectedMonthRp: projected,
    };
  }, [devices, readings, tarif, period]);

  // Perangkat fokus saat user mengklik salah satu alat (null = default gabungan semua)
  const focusedDevice = useMemo(() => {
    if (!selectedDeviceId || breakdown.length === 0) return null;
    return breakdown.find((b) => b.id === selectedDeviceId) || null;
  }, [breakdown, selectedDeviceId]);

  // Data 7 hari terakhir untuk mini bar chart (gabungan semua alat jika null, atau alat terpilih)
  const sevenDayStats = useMemo(() => {
    const days: {
      key: string;
      dayName: string;
      hoursActive: number;
      costRp: number;
      pctHeight: number;
      isPeak: boolean;
    }[] = [];

    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);

    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - offset);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      days.push({
        key,
        dayName: DAY_LABELS[d.getDay()],
        hoursActive: 0,
        costRp: 0,
        pctHeight: 12,
        isPeak: false,
      });
    }

    if (breakdown.length === 0) {
      return { days, avgHours: 0, peakDay: null, savingEstimateRp: 0 };
    }

    const targetReads = focusedDevice
      ? sevenDayReadings.filter((r) => r.device_id === focusedDevice.id)
      : sevenDayReadings;

    const byDay = new Map<string, ReadingRow[]>();
    targetReads.forEach((r) => {
      const dt = new Date(r.ts);
      const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      const list = byDay.get(key) || [];
      list.push(r);
      byDay.set(key, list);
    });

    days.forEach((dayItem) => {
      const list = byDay.get(dayItem.key) || [];
      if (list.length > 0) {
        const perDev = new Map<string, ReadingRow[]>();
        list.forEach((r) => {
          const arr = perDev.get(r.device_id) || [];
          arr.push(r);
          perDev.set(r.device_id, arr);
        });

        let totalDeltaWh = 0;
        let totalHoursDay = 0;

        perDev.forEach((devList) => {
          const deltaWh =
            devList.length > 1
              ? Math.max(
                  0,
                  Number(devList[devList.length - 1].e_wh) -
                    Number(devList[0].e_wh),
                )
              : Number(devList[0].p) * 0.25;
          const avgWatt =
            devList.reduce((sum, item) => sum + Number(item.p), 0) /
            devList.length;
          const estHours =
            avgWatt > 2
              ? Math.min(24, deltaWh / avgWatt)
              : devList.length * 0.25;

          totalDeltaWh += deltaWh;
          totalHoursDay += estHours;
        });

        dayItem.hoursActive = Number(Math.min(24, totalHoursDay).toFixed(1));
        dayItem.costRp = Math.round((totalDeltaWh / 1000) * tarif);
      }
    });

    const maxHours = Math.max(...days.map((d) => d.hoursActive), 0);
    let peakItem = days[0];

    days.forEach((d) => {
      if (maxHours > 0) {
        d.pctHeight = Math.max(
          14,
          Math.round((d.hoursActive / maxHours) * 100),
        );
        if (d.hoursActive === maxHours) {
          d.isPeak = true;
          peakItem = d;
        }
      }
    });

    const totalHours = days.reduce((acc, d) => acc + d.hoursActive, 0);
    const avgHours = Number((totalHours / 7).toFixed(1));
    const targetRef = focusedDevice || breakdown[0];
    const wattRef =
      targetRef && targetRef.latestWatt > 2 ? targetRef.latestWatt : 50;
    const savingEstimateRp = Math.round(((wattRef * 2) / 1000) * tarif * 30);

    return {
      days,
      avgHours,
      peakDay: maxHours > 0 ? peakItem : null,
      savingEstimateRp,
    };
  }, [focusedDevice, breakdown, sevenDayReadings, tarif]);

  const handleToggleDevice = (id: string) => {
    setSelectedDeviceId((prev) => (prev === id ? null : id));
  };

  const handleSaveTarif = async (e: React.FormEvent) => {
    e.preventDefault();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const parsed = Math.max(100, Number(tarifInput) || 1444.7);
    setSavingTarif(true);
    await supabase
      .from("profiles")
      .update({ tarif_per_kwh: parsed })
      .eq("id", user.id);
    setTarif(parsed);
    setSavingTarif(false);
    setEditingTarif(false);
  };

  // Hitung segmen SVG Donut Chart (Radius = 70, Circumference = 439.82)
  const circumference = 2 * Math.PI * 70;
  let cumulativeDash = 0;
  const donutSegments = breakdown.map((item) => {
    const dashLength =
      totalKwh > 0
        ? (item.persen / 100) * circumference
        : breakdown.length > 0
          ? circumference / breakdown.length
          : 0;
    const segment = {
      ...item,
      dashLength,
      dashOffset: -cumulativeDash,
    };
    cumulativeDash += dashLength;
    return segment;
  });

  const overBudgetRp = projectedMonthRp - batasAmanRp;
  const totalActiveWattAll = breakdown.reduce(
    (sum, item) => sum + item.latestWatt,
    0,
  );
  const onlineCountAll = breakdown.filter((item) => item.isOnline).length;

  return (
    <AppShell>
      <div className="flex flex-col w-full max-w-full overflow-x-hidden gap-5 sm:gap-7">
        {/* 1. PAGE HEADER & PERIOD FILTER */}
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <span className="text-xs uppercase tracking-wider text-primary-container font-bold">
                Audit Energi Rumah Tangga
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container shrink-0" />
              <span className="text-xs text-on-surface-variant font-medium">
                {devices.length} Perangkat Terpasang
              </span>
            </div>
            <h1 className="font-extrabold text-2xl sm:text-3xl lg:text-[36px] text-on-surface tracking-tight leading-tight">
              Cek Perangkat Paling Boros
            </h1>
            <p className="text-sm sm:text-base text-on-surface-variant max-w-2xl leading-relaxed">
              Analisis konsumsi dan pembagian biaya dari {devices.length}{" "}
              perangkat colokan pintar yang terpasang di rumah Anda.
            </p>
          </div>

          {/* Filter Controls Toolbar */}
          <div className="w-full lg:w-auto flex flex-wrap flex-col items-center justify-between sm:justify-start gap-2 bg-surface-container-low border border-outline-variant/60 p-1.5 rounded-xl shadow-2xs">
            <div className="inline-flex items-center gap-1 flex-1 sm:flex-initial">
              <button
                type="button"
                onClick={() => setPeriod("today")}
                className={`flex-1 sm:flex-initial min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  period === "today"
                    ? "bg-primary-container text-on-primary shadow-2xs"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setPeriod("7d")}
                className={`flex-1 sm:flex-initial min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  period === "7d"
                    ? "bg-primary-container text-on-primary shadow-2xs"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                7 Hari
              </button>
              <button
                type="button"
                onClick={() => setPeriod("month")}
                className={`flex-1 sm:flex-initial min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  period === "month"
                    ? "bg-primary-container text-on-primary shadow-2xs"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Bulan Ini
              </button>
            </div>
          </div>
        </header>

        {/* 2. ASYMMETRIC 2-COLUMN GRID (7 COLS LEFT + 5 COLS RIGHT) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-7 items-start">
          {/* LEFT COLUMN: Porsi Biaya Perangkat Terpantau (7 Cols) */}
          <section className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 sm:p-6 lg:p-7 shadow-2xs flex flex-col gap-5 sm:gap-6 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <span className="text-xs uppercase tracking-wider text-on-surface-variant font-bold">
                  Ringkasan Proporsi
                </span>
                <h2 className="font-bold text-base sm:text-lg text-on-surface">
                  Porsi Biaya Perangkat Terpantau
                </h2>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface text-xs font-semibold shrink-0 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim" />
                Siklus Aktif
              </span>
            </div>

            {loading ? (
              <div className="h-64 rounded-xl bg-surface-container-low animate-pulse" />
            ) : breakdown.length === 0 ? (
              <div className="p-8 rounded-xl bg-surface-container-low text-center flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant">
                  power_off
                </span>
                <p className="font-bold text-sm sm:text-base text-on-surface">
                  Belum ada perangkat terpantau
                </p>
                <p className="text-xs text-on-surface-variant max-w-sm">
                  Tambahkan colokan pintar terlebih dahulu untuk melihat
                  pembagian konsumsi listrik.
                </p>
              </div>
            ) : (
              <>
                {/* Donut Visualization Showcase */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-7 py-4 sm:py-5 bg-surface-container-low rounded-xl px-4 sm:px-5">
                  <div className="relative w-48 h-48 sm:w-52 sm:h-52 shrink-0 flex items-center justify-center">
                    <svg
                      aria-label="Grafik Donat Pembagian Beban Listrik"
                      className="w-full h-full -rotate-90 transform"
                      viewBox="0 0 180 180"
                    >
                      <circle
                        cx="90"
                        cy="90"
                        fill="transparent"
                        r="70"
                        stroke="#E9E1DD"
                        strokeWidth="20"
                      />
                      {donutSegments.map((seg) => (
                        <circle
                          key={seg.id}
                          className="transition-all duration-700 cursor-pointer"
                          cx="90"
                          cy="90"
                          fill="transparent"
                          r="70"
                          stroke={seg.color}
                          strokeDasharray={`${seg.dashLength} ${circumference}`}
                          strokeDashoffset={seg.dashOffset}
                          strokeWidth={
                            selectedDeviceId === seg.id ? "24" : "20"
                          }
                          onClick={() => handleToggleDevice(seg.id)}
                        />
                      ))}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
                      <span className="text-[10px] sm:text-xs uppercase tracking-wider text-on-surface-variant font-bold">
                        {focusedDevice ? focusedDevice.nama : "Total Biaya"}
                      </span>
                      <span className="text-xl sm:text-2xl text-on-surface font-extrabold tracking-tight leading-tight">
                        Rp{" "}
                        {Math.round(
                          focusedDevice ? focusedDevice.biaya : totalBiaya,
                        ).toLocaleString("id-ID")}
                      </span>
                      <span className="text-xs text-on-surface-variant mt-0.5">
                        {(focusedDevice ? focusedDevice.kwh : totalKwh)
                          .toFixed(2)
                          .replace(".", ",")}{" "}
                        kWh terukur
                      </span>
                    </div>
                  </div>

                  {/* Quick Stat Tiles (Hanya masing-masing perangkat) */}
                  <div className="flex flex-col gap-2.5 w-full sm:max-w-[220px]">
                    {breakdown.map((item) => {
                      const isSelected = selectedDeviceId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleToggleDevice(item.id)}
                          className={`bg-surface-container-lowest p-3 rounded-lg shadow-2xs flex items-center justify-between gap-2 text-left transition-all cursor-pointer border ${
                            isSelected
                              ? "border-primary-container bg-primary-fixed/15"
                              : "border-transparent hover:border-outline-variant/60"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-xs text-on-surface-variant font-semibold truncate">
                              {item.nama}
                            </span>
                          </div>
                          <span className="text-xs sm:text-sm font-bold text-on-surface shrink-0 whitespace-nowrap">
                            {item.persen.toFixed(1).replace(".", ",")}%
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Breakdown Rows (Total 100%) */}
                <div className="flex flex-col gap-3.5 sm:gap-4">
                  {breakdown.map((item, idx) => {
                    const isTop = idx === 0 && totalKwh > 0;
                    const isFocused = selectedDeviceId === item.id;

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleDevice(item.id)}
                        className={`bg-surface-container-low p-4 sm:p-5 rounded-xl hover:bg-surface-container transition-all flex flex-col gap-2.5 cursor-pointer border ${
                          isFocused
                            ? "border-primary-container/60"
                            : "border-transparent"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-10 h-10 rounded-lg text-on-primary flex items-center justify-center shrink-0"
                              style={{ backgroundColor: item.color }}
                            >
                              <span className="material-symbols-outlined text-[20px]">
                                {item.icon}
                              </span>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-base sm:text-lg text-on-surface truncate">
                                  {item.nama}
                                </span>
                                {isTop && (
                                  <span className="px-2 py-0.5 rounded-md bg-secondary-fixed text-on-secondary-fixed text-[11px] font-bold whitespace-nowrap shrink-0">
                                    Paling Boros
                                  </span>
                                )}
                              </div>
                              <span className="text-xs sm:text-sm text-on-surface-variant truncate">
                                {item.subLabel}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end shrink-0">
                            <span
                              className="font-bold text-base sm:text-lg"
                              style={{ color: item.color }}
                            >
                              {item.persen.toFixed(1).replace(".", ",")}%
                            </span>
                            <span className="text-xs font-semibold text-on-surface whitespace-nowrap">
                              Rp{" "}
                              {Math.round(item.biaya).toLocaleString("id-ID")}
                            </span>
                          </div>
                        </div>

                        {/* Visual Progress Bar */}
                        <div className="w-full bg-surface-variant h-2.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, item.persen)}%`,
                              backgroundColor: item.color,
                            }}
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <span className="text-xs sm:text-sm text-on-surface-variant">
                            {item.kwh.toFixed(2).replace(".", ",")} kWh terukur
                            kumulatif
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleDevice(item.id);
                            }}
                            className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-primary-container hover:text-primary transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <span>
                              {isFocused ? "Kembali ke semua" : "Lihat detail"}
                            </span>
                            <span className="material-symbols-outlined text-[16px]">
                              {isFocused ? "close" : "arrow_forward"}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Footer Card Note */}
            <div className="p-3 bg-surface-container-low rounded-lg flex items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px] text-primary-container shrink-0">
                verified
              </span>
              <span className="text-xs font-semibold">
                Total pembagian tepat 100% tanpa pos tersembunyi •{" "}
                {devices.length} Perangkat Aktif
              </span>
            </div>
          </section>

          {/* RIGHT COLUMN: Stacked Contextual & Deep Dive Cards (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5 sm:gap-7 min-w-0">
            {/* Top Card: Cara Hitung Perkiraan Biaya */}
            <section className="bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 sm:p-6 lg:p-7 shadow-2xs flex flex-col gap-4 sm:gap-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs uppercase tracking-wider text-on-surface-variant font-bold">
                    Metodologi &amp; Anggaran
                  </span>
                  <h2 className="font-bold text-base sm:text-lg text-on-surface">
                    Cara Hitung Perkiraan Biaya
                  </h2>
                  <p className="text-xs sm:text-sm text-on-surface-variant">
                    Rumus transparansi konversi energi ke rupiah
                  </p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary-container shrink-0">
                  <span className="material-symbols-outlined text-[20px]">
                    calculate
                  </span>
                </div>
              </div>

              {/* Highlighted Formula Box */}
              <div className="p-4 bg-surface-container-low rounded-xl flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary-container shrink-0">
                    functions
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-primary-container">
                    Rumus Standar Terukur
                  </span>
                </div>
                <div className="font-bold text-base sm:text-lg text-on-surface tracking-tight break-words">
                  {totalKwh.toFixed(2).replace(".", ",")} kWh × Rp{" "}
                  {tarif.toLocaleString("id-ID")} = Rp{" "}
                  {Math.round(totalBiaya).toLocaleString("id-ID")}
                </div>
                <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                  Dihitung dari kumulatif pembacaan sensor energi{" "}
                  {devices.length} colokan pintar pada periode terpilih.
                </p>
              </div>

              {/* Projected Month-End Alert Box */}
              <div className="p-4 bg-surface-container rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-on-surface">
                    Perkiraan Tagihan Akhir Bulan ({devices.length} Alat)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold whitespace-nowrap shrink-0">
                    Estimasi
                  </span>
                </div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl sm:text-[30px] text-on-surface font-extrabold tracking-tight">
                    Rp {projectedMonthRp.toLocaleString("id-ID")}
                  </span>
                  <span className="text-xs sm:text-sm text-on-surface-variant">
                    / 30 hari
                  </span>
                </div>
                {overBudgetRp > 0 ? (
                  <div className="flex items-center gap-1.5 text-secondary text-xs font-bold">
                    <span className="material-symbols-outlined text-[16px] shrink-0">
                      trending_up
                    </span>
                    <span>
                      +Rp {overBudgetRp.toLocaleString("id-ID")} di atas target
                      batas aman Rp {batasAmanRp.toLocaleString("id-ID")}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-primary-container text-xs font-bold">
                    <span className="material-symbols-outlined text-[16px] shrink-0">
                      check_circle
                    </span>
                    <span>
                      Masih aman di bawah target batas Rp{" "}
                      {batasAmanRp.toLocaleString("id-ID")}
                    </span>
                  </div>
                )}
              </div>

              {/* Editable Tariff Selector */}
              {!editingTarif ? (
                <div className="p-3 bg-surface-container-low rounded-lg flex items-center justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs sm:text-sm font-bold text-on-surface truncate">
                      Tarif Listrik: Rp {tarif.toLocaleString("id-ID")} / kWh
                    </span>
                    <span className="text-xs text-on-surface-variant truncate">
                      Golongan {golongan}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingTarif(true)}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-surface-container-lowest text-xs font-bold text-primary-container hover:bg-surface-container-high transition-colors shadow-2xs cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    Ubah
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleSaveTarif}
                  className="p-3 bg-surface-container-low rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                >
                  <div className="flex items-center gap-1.5 flex-1 bg-surface-container-lowest border border-outline-variant/70 rounded-lg px-3 py-1.5">
                    <span className="text-xs font-bold text-on-surface-variant">
                      Rp
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      min="100"
                      value={tarifInput}
                      onChange={(e) => setTarifInput(e.target.value)}
                      className="w-full min-w-0 bg-transparent text-sm font-bold text-on-surface focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="submit"
                      disabled={savingTarif}
                      className="flex-1 sm:flex-initial min-h-[36px] px-3 py-1.5 rounded-lg bg-primary-container text-on-primary text-xs font-bold cursor-pointer"
                    >
                      {savingTarif ? "..." : "Simpan"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingTarif(false)}
                      className="flex-1 sm:flex-initial min-h-[36px] px-2.5 py-1.5 rounded-lg bg-surface-container text-on-surface-variant text-xs font-semibold cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              )}

              <p className="text-xs text-on-surface-variant leading-relaxed">
                Catatan: Hanya menghitung {devices.length} perangkat terpantau;
                belum termasuk biaya beban &amp; pajak penerangan jalan (PPJ)
                PLN rumah secara keseluruhan.
              </p>
            </section>

            {/* Bottom Card: Rincian Gabungan (Default) atau Perangkat Terpilih */}
            {breakdown.length > 0 && (
              <section className="bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 sm:p-6 lg:p-7 shadow-2xs flex flex-col gap-4 sm:gap-5">
                <div className="flex flex-wrap items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-9 h-9 rounded-lg text-on-primary flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: focusedDevice
                          ? focusedDevice.color
                          : "#1E40AF",
                      }}
                    >
                      <span className="material-symbols-outlined text-[19px]">
                        {focusedDevice ? focusedDevice.icon : "devices"}
                      </span>
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-bold text-base sm:text-lg text-on-surface truncate">
                        {focusedDevice
                          ? `Rincian: ${focusedDevice.nama}`
                          : `Rincian: Seluruh Alat (${breakdown.length})`}
                      </h2>
                      <p className="text-xs sm:text-sm text-on-surface-variant truncate">
                        Rata-rata {sevenDayStats.avgHours} jam/hari •{" "}
                        {focusedDevice
                          ? focusedDevice.isOnline
                            ? `Daya saat ini ${focusedDevice.latestWatt} W`
                            : "Sensor Offline"
                          : `${onlineCountAll} aktif (${totalActiveWattAll} W)`}
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-surface-container-high text-on-surface text-xs font-semibold shrink-0 whitespace-nowrap">
                    {focusedDevice ? focusedDevice.subLabel : "Gabungan"}
                  </span>
                </div>

                {/* Peak Callout Info */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-surface-container-low rounded-lg">
                  <span className="text-xs text-on-surface-variant">
                    Histori Pemakaian Harian (7 Hari Terakhir)
                  </span>
                  <span className="text-xs font-bold text-secondary whitespace-nowrap">
                    {sevenDayStats.peakDay
                      ? `Puncak: ${sevenDayStats.peakDay.hoursActive} jam (Rp ${sevenDayStats.peakDay.costRp.toLocaleString("id-ID")})`
                      : "Belum ada puncak harian"}
                  </span>
                </div>

                {/* 7-Day Bar Mini Chart */}
                <div className="pt-4 pb-2 px-2 bg-surface-container-low rounded-xl">
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2 items-end h-32 w-full">
                    {sevenDayStats.days.map((d) => (
                      <div
                        key={d.key}
                        className="flex flex-col items-center gap-1 h-full justify-end group min-w-0"
                      >
                        <span
                          className={`text-[10px] sm:text-xs font-medium truncate ${
                            d.isPeak
                              ? "text-secondary font-bold"
                              : "text-on-surface-variant"
                          }`}
                        >
                          {d.hoursActive > 0 ? `${d.hoursActive}h` : "0h"}
                        </span>
                        <div
                          className={`w-full max-w-[26px] rounded-t transition-all ${
                            d.isPeak
                              ? "bg-secondary-container group-hover:bg-secondary shadow-2xs"
                              : "bg-[#1E40AF]/80 group-hover:bg-[#1E40AF]"
                          }`}
                          style={{ height: `${d.pctHeight}%` }}
                        />
                        <span
                          className={`text-[11px] sm:text-xs mt-1 ${
                            d.isPeak
                              ? "text-secondary font-bold"
                              : "text-on-surface-variant"
                          }`}
                        >
                          {d.dayName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Practical Domestic Tip (Soft Amber Card) */}
                <div className="p-3.5 sm:p-4 bg-secondary-fixed/50 rounded-xl flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">
                      lightbulb
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs sm:text-sm font-bold text-on-secondary-fixed">
                      Saran Penghematan
                    </span>
                    <p className="text-xs sm:text-sm text-on-secondary-fixed-variant leading-relaxed">
                      Kurangi 2 jam pemakaian{" "}
                      {focusedDevice ? focusedDevice.nama : breakdown[0].nama}{" "}
                      setiap hari untuk memangkas ± Rp{" "}
                      {sevenDayStats.savingEstimateRp.toLocaleString("id-ID")}{" "}
                      hingga akhir bulan. Atau simulasikan skenario lainnya di{" "}
                      <Link
                        href="/hemat"
                        className="font-bold underline text-secondary"
                      >
                        Simulasi Hemat
                      </Link>
                      .
                    </p>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
