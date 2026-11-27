// src/app/bandingkan/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/supabase";

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

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const FULL_DAY_NAMES = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

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

function getMondayStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function BandingkanPage() {
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState<"weekly" | "devices">("weekly");
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [readings, setReadings] = useState<ReadingRow[]>([]);
  const [tarif, setTarif] = useState<number>(1444.7);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const thisMonday = getMondayStart(new Date());
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);

    const [{ data: profile }, { data: devsData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("tarif_per_kwh")
        .eq("id", user.id)
        .single(),
      supabase
        .from("devices")
        .select("id, nama, jenis_beban, lokasi, last_seen_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
    ]);

    if (profile?.tarif_per_kwh) {
      setTarif(Number(profile.tarif_per_kwh));
    }

    const devList = (devsData as DeviceRow[]) || [];
    setDevices(devList);
    if (devList.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devList[0].id);
    }

    if (devList.length > 0) {
      const { data: readsData } = await supabase
        .from("readings")
        .select("id, device_id, ts, p, e_wh")
        .in(
          "device_id",
          devList.map((d) => d.id),
        )
        .gte("ts", lastMonday.toISOString())
        .order("ts", { ascending: true })
        .limit(4000);

      setReadings((readsData as ReadingRow[]) || []);
    } else {
      setReadings([]);
    }

    setLoading(false);
  }, [supabase, selectedDeviceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeDevice = useMemo(() => {
    if (devices.length === 0) return null;
    return devices.find((d) => d.id === selectedDeviceId) || devices[0];
  }, [devices, selectedDeviceId]);

  // Kalkulasi perbandingan Minggu Ini vs Minggu Lalu untuk perangkat aktif + ringkasan semua alat
  const {
    dailyBars,
    maxBarRp,
    peakDayInfo,
    thisWeekStats,
    lastWeekStats,
    diffStats,
    allDevicesComparison,
  } = useMemo(() => {
    const thisMonday = getMondayStart(new Date());
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);

    const computePeriodMetrics = (devId: string, start: Date, end: Date) => {
      const list = readings.filter((r) => {
        if (r.device_id !== devId) return false;
        const t = new Date(r.ts).getTime();
        return t >= start.getTime() && t < end.getTime();
      });

      if (list.length === 0) {
        return {
          kwh: 0,
          costRp: 0,
          totalHours: 0,
          avgHoursPerDay: 0,
          mostFrequentHour: "-",
        };
      }

      const deltaWh =
        list.length > 1
          ? Math.max(
              0,
              Number(list[list.length - 1].e_wh) - Number(list[0].e_wh),
            )
          : Number(list[0].p) * 0.25;
      const kwh = deltaWh / 1000;
      const costRp = Math.round(kwh * tarif);

      const activeReadings = list.filter((r) => Number(r.p) > 2);
      const avgWatt =
        activeReadings.length > 0
          ? activeReadings.reduce((acc, r) => acc + Number(r.p), 0) /
            activeReadings.length
          : 50;
      const totalHours =
        avgWatt > 0 ? Math.min(168, Math.round(deltaWh / avgWatt)) : 0;

      // Cari jam yang paling sering muncul saat alat menyala
      const hourFreq = new Map<number, number>();
      activeReadings.forEach((r) => {
        const h = new Date(r.ts).getHours();
        hourFreq.set(h, (hourFreq.get(h) || 0) + 1);
      });
      let topHour = -1;
      let topCount = 0;
      hourFreq.forEach((cnt, hr) => {
        if (cnt > topCount) {
          topCount = cnt;
          topHour = hr;
        }
      });

      return {
        kwh,
        costRp,
        totalHours,
        avgHoursPerDay: Number((totalHours / 7).toFixed(1)),
        mostFrequentHour:
          topHour >= 0 ? `${String(topHour).padStart(2, "0")}.00 WIB` : "-",
      };
    };

    const devId = activeDevice?.id || "";
    const nextMonday = new Date(thisMonday);
    nextMonday.setDate(thisMonday.getDate() + 7);

    // 7 hari (Senin - Minggu)
    const bars = Array.from({ length: 7 }, (_, i) => {
      const thisDayStart = new Date(thisMonday);
      thisDayStart.setDate(thisMonday.getDate() + i);
      const thisDayEnd = new Date(thisDayStart);
      thisDayEnd.setDate(thisDayStart.getDate() + 1);

      const lastDayStart = new Date(lastMonday);
      lastDayStart.setDate(lastMonday.getDate() + i);
      const lastDayEnd = new Date(lastDayStart);
      lastDayEnd.setDate(lastDayStart.getDate() + 1);

      const dayIdx = thisDayStart.getDay();
      const thisDay = devId
        ? computePeriodMetrics(devId, thisDayStart, thisDayEnd)
        : {
            kwh: 0,
            costRp: 0,
            totalHours: 0,
            avgHoursPerDay: 0,
            mostFrequentHour: "-",
          };
      const lastDay = devId
        ? computePeriodMetrics(devId, lastDayStart, lastDayEnd)
        : {
            kwh: 0,
            costRp: 0,
            totalHours: 0,
            avgHoursPerDay: 0,
            mostFrequentHour: "-",
          };

      return {
        dayShort: DAY_NAMES[dayIdx],
        dayFull: FULL_DAY_NAMES[dayIdx],
        lastCostRp: lastDay.costRp,
        thisCostRp: thisDay.costRp,
        thisHours: thisDay.totalHours,
        lastPct: 0,
        thisPct: 0,
        isPeak: false,
      };
    });

    const maxVal = Math.max(
      ...bars.flatMap((b) => [b.lastCostRp, b.thisCostRp]),
      100,
    );
    let peak = bars[0];
    bars.forEach((b) => {
      b.lastPct =
        b.lastCostRp > 0
          ? Math.max(10, Math.round((b.lastCostRp / maxVal) * 100))
          : 4;
      b.thisPct =
        b.thisCostRp > 0
          ? Math.max(10, Math.round((b.thisCostRp / maxVal) * 100))
          : 4;
      if (b.thisCostRp > peak.thisCostRp) {
        peak = b;
      }
    });
    if (peak.thisCostRp > 0) {
      peak.isPeak = true;
    }

    const thisW = devId
      ? computePeriodMetrics(devId, thisMonday, nextMonday)
      : {
          kwh: 0,
          costRp: 0,
          totalHours: 0,
          avgHoursPerDay: 0,
          mostFrequentHour: "-",
        };
    const lastW = devId
      ? computePeriodMetrics(devId, lastMonday, thisMonday)
      : {
          kwh: 0,
          costRp: 0,
          totalHours: 0,
          avgHoursPerDay: 0,
          mostFrequentHour: "-",
        };

    const costDiff = thisW.costRp - lastW.costRp;
    const costPct =
      lastW.costRp > 0
        ? Math.round((costDiff / lastW.costRp) * 100)
        : thisW.costRp > 0
          ? 100
          : 0;
    const kwhDiff = Number((thisW.kwh - lastW.kwh).toFixed(2));
    const hoursDiff = thisW.totalHours - lastW.totalHours;
    const avgDailyDiff = Number(
      (thisW.avgHoursPerDay - lastW.avgHoursPerDay).toFixed(1),
    );
    const monthlySaveEstimate = Math.max(0, Math.round(Math.abs(costDiff) * 4));

    // Perbandingan semua perangkat untuk Tab 2 & Kartu Bawah
    const devComparisons = devices.map((d) => {
      const mThis = computePeriodMetrics(d.id, thisMonday, nextMonday);
      const mLast = computePeriodMetrics(d.id, lastMonday, thisMonday);
      const pct =
        mLast.costRp > 0
          ? Math.round(((mThis.costRp - mLast.costRp) / mLast.costRp) * 100)
          : 0;
      return {
        id: d.id,
        nama: d.nama,
        subLabel: d.lokasi || d.jenis_beban || "Terpasang",
        icon: getDeviceIcon(d.nama, d.jenis_beban),
        thisCostRp: mThis.costRp,
        lastCostRp: mLast.costRp,
        thisKwh: mThis.kwh,
        avgHours: mThis.avgHoursPerDay,
        pctChange: pct,
      };
    });

    return {
      dailyBars: bars,
      maxBarRp: maxVal,
      peakDayInfo: peak.thisCostRp > 0 ? peak : null,
      thisWeekStats: thisW,
      lastWeekStats: lastW,
      diffStats: {
        costDiff,
        costPct,
        kwhDiff,
        hoursDiff,
        avgDailyDiff,
        monthlySaveEstimate,
      },
      allDevicesComparison: devComparisons,
    };
  }, [activeDevice, devices, readings, tarif]);

  const maxDeviceCost = Math.max(
    ...allDevicesComparison.flatMap((d) => [d.thisCostRp, d.lastCostRp]),
    100,
  );

  const otherDevices = allDevicesComparison.filter(
    (d) => d.id !== activeDevice?.id,
  );

  return (
    <AppShell>
      <div className="flex flex-col w-full max-w-full overflow-x-hidden gap-5 sm:gap-6">
        {/* 1. PAGE TITLE & BIG TABS */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 sm:pb-6 border-b border-outline-variant/80">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <span className="text-xs font-bold text-primary-container tracking-wide uppercase">
                Analisis &amp; Komparasi
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container shrink-0" />
              <span className="text-xs text-on-surface-variant font-medium">
                {devices.length} Perangkat Terpasang
              </span>
            </div>
            <h1 className="font-extrabold text-2xl sm:text-3xl lg:text-[36px] text-on-surface tracking-tight">
              Bandingkan Pemakaian
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              Analisis perubahan pola konsumsi dan perbandingan biaya listrik
              perangkat rumah tangga.
            </p>
          </div>

          {/* Two Large Tabs */}
          <div className="w-full sm:w-auto inline-flex p-1 rounded-xl bg-surface-container-high border border-outline-variant/80 gap-1 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab("weekly")}
              className={`flex-1 sm:flex-initial min-h-[42px] flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "weekly"
                  ? "bg-primary-container text-on-primary shadow-2xs"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest/60"
              }`}
            >
              <span className="material-symbols-outlined text-[18px] shrink-0">
                calendar_view_week
              </span>
              <span>Minggu Ini vs Lalu</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("devices")}
              className={`flex-1 sm:flex-initial min-h-[42px] flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "devices"
                  ? "bg-primary-container text-on-primary shadow-2xs"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest/60"
              }`}
            >
              <span className="material-symbols-outlined text-[18px] shrink-0">
                devices_other
              </span>
              <span>Bandingkan Antar-Alat</span>
            </button>
          </div>
        </div>

        {/* 2. FILTER BAR */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 min-w-0">
            {/* Responsive Device Selector Dropdown (tampil saat mode Minggu Ini vs Lalu) */}
            {activeTab === "weekly" && (
              <div
                ref={dropdownRef}
                className="relative w-full sm:w-auto sm:min-w-[260px] min-w-0"
              >
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={dropdownOpen}
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-2 bg-surface-container-lowest border border-outline-variant/80 rounded-xl shadow-2xs text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary-container shrink-0">
                      <span className="material-symbols-outlined text-[18px]">
                        {activeDevice
                          ? getDeviceIcon(
                              activeDevice.nama,
                              activeDevice.jenis_beban,
                            )
                          : "power"}
                      </span>
                    </div>
                    <div className="flex flex-col text-left min-w-0">
                      <span className="text-[11px] text-on-surface-variant leading-none">
                        Pilihan Colokan
                      </span>
                      <span className="text-xs sm:text-sm text-on-surface mt-0.5 leading-tight font-semibold truncate">
                        {activeDevice
                          ? `${activeDevice.nama}${
                              activeDevice.lokasi || activeDevice.jenis_beban
                                ? ` (${activeDevice.lokasi || activeDevice.jenis_beban})`
                                : ""
                            }`
                          : "Belum ada perangkat"}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`material-symbols-outlined text-on-surface-variant text-[18px] shrink-0 transition-transform duration-200 ${
                      dropdownOpen ? "rotate-180" : ""
                    }`}
                  >
                    expand_more
                  </span>
                </button>

                {dropdownOpen && devices.length > 0 && (
                  <ul
                    role="listbox"
                    className="absolute left-0 right-0 sm:right-auto sm:min-w-full sm:w-max sm:max-w-[340px] mt-1.5 max-h-64 overflow-y-auto rounded-xl bg-surface-container-lowest border border-outline-variant/80 shadow-lg py-1.5 z-30"
                  >
                    {devices.map((dev) => {
                      const isSelected = dev.id === activeDevice?.id;
                      return (
                        <li
                          key={dev.id}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDeviceId(dev.id);
                              setDropdownOpen(false);
                            }}
                            className={`w-full px-3.5 py-2.5 text-left text-xs sm:text-sm flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-primary-fixed/60 text-primary font-bold"
                                : "text-on-surface hover:bg-surface-container font-medium"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="material-symbols-outlined text-[18px] text-primary-container shrink-0">
                                {getDeviceIcon(dev.nama, dev.jenis_beban)}
                              </span>
                              <span className="truncate">
                                {dev.nama}
                                {dev.lokasi || dev.jenis_beban
                                  ? ` (${dev.lokasi || dev.jenis_beban})`
                                  : ""}
                              </span>
                            </div>
                            {isSelected && (
                              <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
                                check
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {/* Period Selector Badge */}
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-surface-container-lowest border border-outline-variant/80 rounded-xl shadow-2xs text-on-surface text-xs sm:text-sm font-medium">
              <span className="material-symbols-outlined text-primary-container text-[18px] shrink-0">
                calendar_today
              </span>
              <span className="whitespace-nowrap">
                Minggu Ini vs Minggu Lalu
              </span>
            </div>
          </div>

          {/* Right Badge Context Info */}
          <div className="flex items-center gap-2 text-on-surface-variant text-xs sm:text-sm bg-surface-container-lowest border border-outline-variant/80 px-3.5 sm:px-4 py-2.5 rounded-xl shadow-2xs self-start lg:self-auto">
            <span className="material-symbols-outlined text-[18px] text-primary-container shrink-0">
              bolt
            </span>
            <span>
              Tarif Listrik:{" "}
              <strong className="text-on-surface font-semibold">
                Rp {tarif.toLocaleString("id-ID")} / kWh
              </strong>{" "}
              • {devices.length} Colokan Terhubung
            </span>
          </div>
        </div>

        {/* 3. SOFT AMBER CALLOUT CARD */}
        <div className="rounded-2xl p-4 sm:p-5 bg-[#fef3c7] border border-[#fde68a] shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 sm:gap-4 min-w-0">
            <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[22px]">
                lightbulb
              </span>
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <h2 className="text-sm sm:text-base md:text-lg text-stone-900 font-bold tracking-tight leading-snug">
                {activeDevice ? (
                  diffStats.costDiff > 0 ? (
                    <>
                      Biaya {activeDevice.nama} naik{" "}
                      {Math.abs(diffStats.costPct)}% minggu ini karena menyala
                      rata-rata {thisWeekStats.avgHoursPerDay} jam/hari{" "}
                      <span className="font-normal text-stone-700">
                        (minggu lalu {lastWeekStats.avgHoursPerDay} jam/hari).
                      </span>
                    </>
                  ) : diffStats.costDiff < 0 ? (
                    <>
                      Biaya {activeDevice.nama} turun{" "}
                      {Math.abs(diffStats.costPct)}% minggu ini dibanding pekan
                      lalu{" "}
                      <span className="font-normal text-stone-700">
                        ({thisWeekStats.avgHoursPerDay} jam/hari vs{" "}
                        {lastWeekStats.avgHoursPerDay} jam/hari).
                      </span>
                    </>
                  ) : (
                    <>
                      Pola pemakaian {activeDevice.nama} relatif stabil
                      dibanding minggu lalu{" "}
                      <span className="font-normal text-stone-700">
                        (rata-rata {thisWeekStats.avgHoursPerDay} jam/hari).
                      </span>
                    </>
                  )
                ) : (
                  "Tambahkan perangkat colokan pintar untuk mulai membandingkan pemakaian antar-minggu."
                )}
              </h2>
              <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                {peakDayInfo
                  ? `Pemakaian harian tertinggi minggu ini terjadi pada hari ${peakDayInfo.dayFull} sebesar Rp ${peakDayInfo.thisCostRp.toLocaleString("id-ID")}.`
                  : "Grafik perbandingan harian akan terisi otomatis seiring masuknya pembacaan sensor PZEM-004T."}
              </p>
            </div>
          </div>

          <div className="shrink-0 pl-13 md:pl-0">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-amber-300 text-stone-900 text-xs sm:text-sm font-bold shadow-2xs whitespace-nowrap">
              <span className="material-symbols-outlined text-amber-700 text-[18px] shrink-0">
                {diffStats.costDiff >= 0 ? "trending_up" : "trending_down"}
              </span>
              <span>
                {diffStats.costDiff >= 0 ? "+" : "-"}Rp{" "}
                {Math.abs(diffStats.costDiff).toLocaleString("id-ID")} Selisih
              </span>
            </span>
          </div>
        </div>

        {/* 4. MAIN CHART CARD */}
        {activeTab === "weekly" ? (
          <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-6 lg:p-7 border border-outline-variant/80 shadow-2xs flex flex-col gap-5 sm:gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-lg sm:text-xl text-on-surface">
                  Grafik Perbandingan Biaya Harian (Senin – Minggu)
                </h2>
                <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
                  Menampilkan perbandingan biaya operasional{" "}
                  {activeDevice?.nama || "perangkat"} per hari (dalam Rupiah)
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 sm:gap-5 px-3 py-2 bg-surface-container border border-outline-variant/80 rounded-xl self-start sm:self-auto shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-primary-container shadow-2xs" />
                  <span className="text-xs text-on-surface font-semibold whitespace-nowrap">
                    Minggu Ini
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-outline shadow-2xs" />
                  <span className="text-xs text-on-surface-variant font-medium whitespace-nowrap">
                    Minggu Lalu
                  </span>
                </div>
              </div>
            </div>

            {/* Chart Canvas Container */}
            {loading ? (
              <div className="h-64 rounded-xl bg-surface-container-low animate-pulse" />
            ) : (
              <div className="relative w-full pt-8 pb-3">
                {/* Background Grid Lines & Y-Axis Labels */}
                <div className="relative h-64 w-full flex flex-col justify-between pointer-events-none text-outline text-[11px] sm:text-xs">
                  {[1, 0.66, 0.33, 0].map((ratio, idx) => (
                    <div
                      key={idx}
                      className={`w-full flex items-center justify-between pb-1 ${
                        idx < 3
                          ? "border-b border-dashed border-outline-variant/60"
                          : ""
                      }`}
                    >
                      <span className="w-14 sm:w-16 truncate">
                        Rp{" "}
                        {Math.round(maxBarRp * ratio).toLocaleString("id-ID")}
                      </span>
                      <div
                        className={`w-[calc(100%-3.75rem)] sm:w-[calc(100%-4.25rem)] border-t ${
                          idx < 3
                            ? "border-dashed border-outline-variant/60"
                            : "border-outline-variant"
                        }`}
                      />
                    </div>
                  ))}
                </div>

                {/* Grouped Bars Overlay */}
                <div className="absolute inset-0 top-8 left-15 sm:left-17 right-2 sm:right-4 flex justify-between items-end pb-7 gap-1.5 sm:gap-5">
                  {dailyBars.map((bar) => (
                    <div
                      key={bar.dayShort}
                      className="flex-1 flex flex-col items-center h-full justify-end group min-w-0"
                    >
                      <div className="w-full flex items-end justify-center gap-1 sm:gap-2.5 h-full">
                        {/* Minggu Lalu */}
                        <div className="relative flex flex-col items-center h-full justify-end w-3 sm:w-7 md:w-8">
                          <div
                            className="w-full bg-outline rounded-t-md transition-all group-hover:opacity-85"
                            style={{ height: `${bar.lastPct}%` }}
                          >
                            <span className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-[11px] py-0.5 px-1.5 rounded transition-opacity pointer-events-none whitespace-nowrap shadow-sm z-20">
                              Rp {bar.lastCostRp.toLocaleString("id-ID")}
                            </span>
                          </div>
                        </div>

                        {/* Minggu Ini */}
                        <div className="relative flex flex-col items-center h-full justify-end w-3 sm:w-7 md:w-8">
                          <div
                            className="w-full bg-primary-container rounded-t-md transition-all group-hover:opacity-95"
                            style={{ height: `${bar.thisPct}%` }}
                          >
                            {bar.isPeak ? (
                              <span className="hidden sm:inline-block absolute -top-8 left-1/2 -translate-x-1/2 bg-primary-container text-on-primary text-[11px] py-0.5 px-2 rounded-md shadow-sm whitespace-nowrap font-bold z-10">
                                Rp {bar.thisCostRp.toLocaleString("id-ID")}{" "}
                                (Puncak)
                              </span>
                            ) : (
                              <span className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-[11px] py-0.5 px-1.5 rounded transition-opacity pointer-events-none whitespace-nowrap shadow-sm z-20">
                                Rp {bar.thisCostRp.toLocaleString("id-ID")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-xs sm:text-sm mt-3 ${
                          bar.isPeak
                            ? "text-on-surface font-bold"
                            : "text-on-surface-variant font-medium"
                        }`}
                      >
                        {bar.dayShort}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Annotation Note */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-on-surface-variant text-xs sm:text-sm pt-3 border-t border-outline-variant/80">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary-container shrink-0" />
                <span>
                  {peakDayInfo
                    ? `Hari ${peakDayInfo.dayFull} mencatatkan pemakaian tertinggi (${peakDayInfo.thisHours} jam menyala).`
                    : "Belum ada catatan puncak harian pada minggu ini."}
                </span>
              </div>
              <span className="text-xs text-outline shrink-0">
                Satuan: Rupiah (Rp)
              </span>
            </div>
          </div>
        ) : (
          /* TAB 2: BANDINGKAN ANTAR-ALAT */
          <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-6 lg:p-7 border border-outline-variant/80 shadow-2xs flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-lg sm:text-xl text-on-surface">
                  Perbandingan Biaya Antar-Perangkat (Minggu Ini vs Lalu)
                </h2>
                <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
                  Membandingkan beban biaya mingguan seluruh colokan pintar
                  secara berdampingan
                </p>
              </div>
              <div className="flex items-center gap-4 px-3 py-2 bg-surface-container border border-outline-variant/80 rounded-xl self-start sm:self-auto shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-primary-container" />
                  <span className="text-xs text-on-surface font-semibold">
                    Minggu Ini
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-outline" />
                  <span className="text-xs text-on-surface-variant font-medium">
                    Minggu Lalu
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {allDevicesComparison.map((dev) => {
                const thisWidth = Math.max(
                  6,
                  Math.round((dev.thisCostRp / maxDeviceCost) * 100),
                );
                const lastWidth = Math.max(
                  6,
                  Math.round((dev.lastCostRp / maxDeviceCost) * 100),
                );

                return (
                  <div
                    key={dev.id}
                    className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/60 flex flex-col gap-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-surface-container-lowest border border-outline-variant/70 flex items-center justify-center text-primary-container shrink-0">
                          <span className="material-symbols-outlined text-[20px]">
                            {dev.icon}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-on-surface truncate">
                            {dev.nama}
                          </p>
                          <p className="text-xs text-on-surface-variant truncate">
                            {dev.subLabel} • Rata-rata {dev.avgHours} jam/hari
                          </p>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                          dev.pctChange > 0
                            ? "bg-error-container text-on-error-container"
                            : "bg-surface-container-high text-on-surface"
                        }`}
                      >
                        {dev.pctChange > 0
                          ? `+${dev.pctChange}%`
                          : `${dev.pctChange}%`}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <span className="w-20 text-xs text-on-surface-variant shrink-0">
                          Minggu Ini
                        </span>
                        <div className="flex-1 bg-surface-variant h-3 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-container rounded-full transition-all duration-500"
                            style={{ width: `${thisWidth}%` }}
                          />
                        </div>
                        <span className="w-24 text-right text-xs font-bold text-on-surface shrink-0">
                          Rp {dev.thisCostRp.toLocaleString("id-ID")}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="w-20 text-xs text-on-surface-variant shrink-0">
                          Minggu Lalu
                        </span>
                        <div className="flex-1 bg-surface-variant h-3 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-outline rounded-full transition-all duration-500"
                            style={{ width: `${lastWidth}%` }}
                          />
                        </div>
                        <span className="w-24 text-right text-xs font-medium text-on-surface-variant shrink-0">
                          Rp {dev.lastCostRp.toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. DETAILED PARAMETER COMPARISON TABLE CARD */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/80 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-6 lg:p-7 border-b border-outline-variant/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-lg sm:text-xl text-on-surface">
                Rincian Perbandingan Parameter
              </h2>
              <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
                Analisis kuantitatif pemakaian daya{" "}
                {activeDevice?.nama || "perangkat"} 7 hari terakhir vs pekan
                sebelumnya
              </p>
            </div>
            <div className="flex items-center gap-2 text-on-surface-variant text-xs shrink-0">
              <span className="material-symbols-outlined text-[16px]">
                sync_alt
              </span>
              <span>Update otomatis tiap pukul 00.00</span>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[620px] text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant text-xs border-b border-outline-variant/80">
                  <th className="py-3.5 px-4 sm:px-6 font-semibold">
                    Parameter Pemakaian
                  </th>
                  <th className="py-3.5 px-4 sm:px-6 font-semibold whitespace-nowrap">
                    Minggu Lalu
                  </th>
                  <th className="py-3.5 px-4 sm:px-6 font-semibold whitespace-nowrap">
                    Minggu Ini
                  </th>
                  <th className="py-3.5 px-4 sm:px-6 font-semibold text-right whitespace-nowrap">
                    Perubahan / Selisih
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/80 text-xs sm:text-sm">
                {/* Row 1: Perkiraan Biaya */}
                <tr className="hover:bg-surface-container-low/60 transition-colors">
                  <td className="py-4 px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary-container shrink-0">
                        <span className="material-symbols-outlined text-[18px]">
                          payments
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-on-surface font-semibold">
                          Perkiraan Biaya
                        </span>
                        <span className="text-xs text-on-surface-variant">
                          Total tagihan listrik colokan
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-on-surface-variant font-medium whitespace-nowrap">
                    Rp {lastWeekStats.costRp.toLocaleString("id-ID")}
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-on-surface font-bold whitespace-nowrap">
                    Rp {thisWeekStats.costRp.toLocaleString("id-ID")}
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                        diffStats.costDiff > 0
                          ? "bg-error-container text-error border-red-200"
                          : "bg-surface-container-high text-on-surface border-outline-variant"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        {diffStats.costDiff > 0 ? "arrow_upward" : "remove"}
                      </span>
                      <span>
                        {diffStats.costDiff > 0
                          ? `+${diffStats.costPct}% (+Rp ${diffStats.costDiff.toLocaleString("id-ID")})`
                          : `Rp ${diffStats.costDiff.toLocaleString("id-ID")}`}
                      </span>
                    </span>
                  </td>
                </tr>

                {/* Row 2: Listrik Terpakai */}
                <tr className="hover:bg-surface-container-low/60 transition-colors">
                  <td className="py-4 px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary-container shrink-0">
                        <span className="material-symbols-outlined text-[18px]">
                          bolt
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-on-surface font-semibold">
                          Listrik Terpakai
                        </span>
                        <span className="text-xs text-on-surface-variant">
                          Akumulasi kilowatt-hour
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-on-surface-variant font-medium whitespace-nowrap">
                    {lastWeekStats.kwh.toFixed(2).replace(".", ",")} kWh
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-on-surface font-bold whitespace-nowrap">
                    {thisWeekStats.kwh.toFixed(2).replace(".", ",")} kWh
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                        diffStats.kwhDiff > 0
                          ? "bg-error-container text-error border-red-200"
                          : "bg-surface-container-high text-on-surface border-outline-variant"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        {diffStats.kwhDiff > 0 ? "arrow_upward" : "remove"}
                      </span>
                      <span>
                        {diffStats.kwhDiff > 0 ? "+" : ""}
                        {diffStats.kwhDiff.toFixed(2).replace(".", ",")} kWh
                      </span>
                    </span>
                  </td>
                </tr>

                {/* Row 3: Total Lama Menyala */}
                <tr className="hover:bg-surface-container-low/60 transition-colors">
                  <td className="py-4 px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary-container shrink-0">
                        <span className="material-symbols-outlined text-[18px]">
                          schedule
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-on-surface font-semibold">
                          Total Lama Menyala
                        </span>
                        <span className="text-xs text-on-surface-variant">
                          Durasi aktif selama 7 hari
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-on-surface-variant font-medium whitespace-nowrap">
                    {lastWeekStats.totalHours} jam
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-on-surface font-bold whitespace-nowrap">
                    {thisWeekStats.totalHours} jam
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-surface-container-high text-on-surface text-xs font-bold border border-outline-variant">
                      <span className="material-symbols-outlined text-[15px]">
                        add
                      </span>
                      <span>
                        {diffStats.hoursDiff >= 0 ? "+" : ""}
                        {diffStats.hoursDiff} jam
                      </span>
                    </span>
                  </td>
                </tr>

                {/* Row 4: Rata-rata per Hari */}
                <tr className="hover:bg-surface-container-low/60 transition-colors">
                  <td className="py-4 px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary-container shrink-0">
                        <span className="material-symbols-outlined text-[18px]">
                          hourglass_top
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-on-surface font-semibold">
                          Rata-rata per Hari
                        </span>
                        <span className="text-xs text-on-surface-variant">
                          Waktu hidup rata-rata harian
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-on-surface-variant font-medium whitespace-nowrap">
                    {lastWeekStats.avgHoursPerDay} jam/hari
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-on-surface font-bold whitespace-nowrap">
                    {thisWeekStats.avgHoursPerDay} jam/hari
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#fef3c7] text-amber-900 text-xs font-bold border border-amber-200">
                      <span className="material-symbols-outlined text-[15px]">
                        more_time
                      </span>
                      <span>
                        {diffStats.avgDailyDiff >= 0 ? "+" : ""}
                        {diffStats.avgDailyDiff} jam/hari
                      </span>
                    </span>
                  </td>
                </tr>

                {/* Row 5: Jam Paling Sering Menyala */}
                <tr className="hover:bg-surface-container-low/60 transition-colors">
                  <td className="py-4 px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary-container shrink-0">
                        <span className="material-symbols-outlined text-[18px]">
                          bedtime
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-on-surface font-semibold">
                          Jam Paling Sering Menyala
                        </span>
                        <span className="text-xs text-on-surface-variant">
                          Waktu mulai aktif rutin
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-on-surface-variant font-medium whitespace-nowrap">
                    {lastWeekStats.mostFrequentHour}
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-on-surface font-bold whitespace-nowrap">
                    {thisWeekStats.mostFrequentHour}
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-surface-container-low text-on-surface-variant text-xs font-medium border border-outline-variant">
                      <span className="material-symbols-outlined text-[15px]">
                        check
                      </span>
                      <span>
                        {thisWeekStats.mostFrequentHour ===
                        lastWeekStats.mostFrequentHour
                          ? "Sama (Pola rutin)"
                          : "Bergeser jam aktif"}
                      </span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Helper Suggestion Card at Bottom */}
          <div className="p-4 sm:p-6 bg-surface-container-low/70 border-t border-outline-variant/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-surface-container-lowest border border-outline-variant flex items-center justify-center text-primary-container shrink-0 mt-0.5 shadow-2xs">
                <span className="material-symbols-outlined text-[18px]">
                  tips_and_updates
                </span>
              </div>
              <p className="text-xs sm:text-sm text-on-surface leading-relaxed">
                Jika durasi pemakaian{" "}
                <strong className="font-semibold">
                  {activeDevice?.nama || "perangkat ini"}
                </strong>{" "}
                dikendalikan sesuai batas aman harian, Anda berpotensi berhemat
                hingga{" "}
                <strong className="font-semibold">
                  Rp {diffStats.monthlySaveEstimate.toLocaleString("id-ID")} per
                  bulan
                </strong>{" "}
                untuk colokan ini saja.
              </p>
            </div>

            <Link
              href="/pengingat"
              className="w-full md:w-auto justify-center inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-container text-on-primary text-xs sm:text-sm font-semibold hover:bg-blue-800 transition-colors whitespace-nowrap shadow-2xs shrink-0"
            >
              <span>Atur Batas Durasi di Pengingat</span>
              <span className="material-symbols-outlined text-[18px] shrink-0">
                arrow_forward
              </span>
            </Link>
          </div>
        </div>

        {/* 6. QUICK LINKS TO OTHER DEVICES */}
        {otherDevices.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <h3 className="font-bold text-base text-on-surface">
                Alat Lain Terpasang
              </h3>
              <span className="text-xs text-on-surface-variant">
                Klik alat untuk membuka detail perbandingan
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {otherDevices.map((dev) => (
                <button
                  key={dev.id}
                  type="button"
                  onClick={() => {
                    setSelectedDeviceId(dev.id);
                    setActiveTab("weekly");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="w-full text-left bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-outline-variant/80 shadow-2xs flex items-center justify-between gap-3 hover:bg-surface-container-low transition-colors cursor-pointer group min-w-0"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-surface-container-low border border-outline-variant/80 flex items-center justify-center text-primary-container shrink-0">
                      <span className="material-symbols-outlined text-[24px]">
                        {dev.icon}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm text-on-surface font-semibold group-hover:text-primary-container transition-colors truncate">
                        {dev.nama}
                      </span>
                      <span className="text-xs text-on-surface-variant truncate">
                        Pemakaian {dev.avgHours} jam/hari • {dev.subLabel}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 text-right shrink-0">
                    <div className="flex flex-col">
                      <span className="text-sm sm:text-base text-on-surface font-bold whitespace-nowrap">
                        Rp {dev.thisCostRp.toLocaleString("id-ID")}
                      </span>
                      <span className="text-xs text-on-surface-variant whitespace-nowrap">
                        Minggu ini (
                        {dev.pctChange > 0
                          ? `+${dev.pctChange}%`
                          : `${dev.pctChange}%`}
                        )
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-outline group-hover:text-primary-container transition-colors shrink-0">
                      chevron_right
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
