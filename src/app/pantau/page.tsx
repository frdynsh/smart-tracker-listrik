// src/app/pantau/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
} from "recharts";

interface Device {
  id: string;
  nama: string;
  lokasi?: string | null;
  last_seen_at?: string | null;
}

interface Reading {
  id: string;
  device_id: string;
  ts: string;
  v: number;
  i: number;
  p: number;
  e_wh: number;
}

const OFFLINE_THRESHOLD_MS = 120_000;

export default function PantauPage() {
  const supabase = useMemo(() => createClient(), []);

  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("all");
  const [range, setRange] = useState<"today" | "7d">("today");
  const [unit, setUnit] = useState<"rupiah" | "kwh">("rupiah");
  const [showTable, setShowTable] = useState<boolean>(false);

  const [readings, setReadings] = useState<Reading[]>([]);
  const [has30DayData, setHas30DayData] = useState<boolean>(false);
  const [tarif, setTarif] = useState<number>(1444.7);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchPantauData = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tarif_per_kwh")
        .eq("id", user.id)
        .single();
      if (profile?.tarif_per_kwh) {
        setTarif(Number(profile.tarif_per_kwh));
      }
    }

    const { data: devs } = await supabase
      .from("devices")
      .select("id, nama, lokasi, last_seen_at")
      .order("created_at", { ascending: true });
    setDevices((devs as Device[]) || []);

    // Cek ketersediaan data > 21 hari untuk tombol 30 Hari
    const twentyOneDaysAgo = new Date();
    twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21);
    const { count: oldCount } = await supabase
      .from("readings")
      .select("*", { count: "exact", head: true })
      .lt("ts", twentyOneDaysAgo.toISOString());
    setHas30DayData((oldCount || 0) > 0);

    // Hitung awal rentang waktu
    const startTime = new Date();
    if (range === "today") {
      startTime.setHours(0, 0, 0, 0);
    } else {
      startTime.setDate(startTime.getDate() - 7);
      startTime.setHours(0, 0, 0, 0);
    }

    let query = supabase
      .from("readings")
      .select("*")
      .gte("ts", startTime.toISOString())
      .order("ts", { ascending: true })
      .limit(200);

    if (selectedDevice !== "all") {
      query = query.eq("device_id", selectedDevice);
    }

    const { data: reads } = await query;
    setReadings((reads as Reading[]) || []);
    setLoading(false);
  }, [supabase, range, selectedDevice]);

  useEffect(() => {
    fetchPantauData();
    const timer = setInterval(fetchPantauData, 15000);
    return () => clearInterval(timer);
  }, [fetchPantauData]);

  const deviceMap = useMemo(() => {
    const map = new Map<string, Device>();
    devices.forEach((d) => map.set(d.id, d));
    return map;
  }, [devices]);

  const onlineCount = useMemo(() => {
    const now = Date.now();
    return devices.filter(
      (d) =>
        d.last_seen_at &&
        now - new Date(d.last_seen_at).getTime() <= OFFLINE_THRESHOLD_MS,
    ).length;
  }, [devices]);

  // Agregasi data grafik per jam (atau slot waktu)
  const {
    chartData,
    peakPoint,
    totalKwh,
    totalBiaya,
    avgCostPerHour,
    avgKwhPerHour,
    peakHourWindow,
    lastUpdatedText,
  } = useMemo(() => {
    if (readings.length === 0) {
      return {
        chartData: [],
        peakPoint: null,
        totalKwh: 0,
        totalBiaya: 0,
        avgCostPerHour: 0,
        avgKwhPerHour: 0,
        peakHourWindow: "-",
        lastUpdatedText: "Belum ada data",
      };
    }

    // Hitung energi terukur per perangkat dalam rentang terpilih
    const byDevice = new Map<string, Reading[]>();
    readings.forEach((r) => {
      const list = byDevice.get(r.device_id) || [];
      list.push(r);
      byDevice.set(r.device_id, list);
    });

    let sumKwh = 0;
    byDevice.forEach((list) => {
      if (list.length > 0) {
        const deltaWh = Math.max(
          0,
          Number(list[list.length - 1].e_wh) - Number(list[0].e_wh),
        );
        sumKwh += deltaWh / 1000;
      }
    });

    // Kelompokkan pembacaan per slot waktu untuk grafik yang bersih
    const bucketMap = new Map<
      string,
      {
        label: string;
        sortKey: number;
        totalWatt: number;
        count: number;
        hourNum: number;
      }
    >();

    readings.forEach((r) => {
      const dateObj = new Date(r.ts);
      const label =
        range === "today"
          ? `${String(dateObj.getHours()).padStart(2, "0")}.00`
          : dateObj.toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "short",
            });

      const key =
        range === "today"
          ? `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}-${dateObj.getHours()}`
          : `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;

      const existing = bucketMap.get(key);
      if (existing) {
        existing.totalWatt += Number(r.p);
        existing.count += 1;
      } else {
        bucketMap.set(key, {
          label,
          sortKey: dateObj.getTime(),
          totalWatt: Number(r.p),
          count: 1,
          hourNum: dateObj.getHours(),
        });
      }
    });

    const formattedChart = Array.from(bucketMap.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .map((b) => {
        const avgWatt = b.count > 0 ? b.totalWatt / b.count : 0;
        const kwhRate = avgWatt / 1000;
        const rpRate = Math.round(kwhRate * tarif);
        return {
          waktu: b.label,
          nilai: unit === "rupiah" ? rpRate : Number(kwhRate.toFixed(3)),
          rpRate,
          kwhRate: Number(kwhRate.toFixed(3)),
          watt: Math.round(avgWatt),
          hourNum: b.hourNum,
        };
      });

    let maxItem = formattedChart[0] || null;
    formattedChart.forEach((item) => {
      if (maxItem && item.nilai > maxItem.nilai) {
        maxItem = item;
      }
    });

    const costTotal = sumKwh * tarif;
    const activeSlots = Math.max(1, formattedChart.length);
    const avgRp = costTotal / activeSlots;
    const avgKwh = sumKwh / activeSlots;

    const peakWindow = maxItem
      ? `${String(maxItem.hourNum).padStart(2, "0")}.00 – ${String(
          (maxItem.hourNum + 2) % 24,
        ).padStart(2, "0")}.00`
      : "-";

    const latestTs = new Date(
      readings[readings.length - 1].ts,
    ).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return {
      chartData: formattedChart,
      peakPoint: maxItem,
      totalKwh: sumKwh,
      totalBiaya: costTotal,
      avgCostPerHour: avgRp,
      avgKwhPerHour: avgKwh,
      peakHourWindow: peakWindow,
      lastUpdatedText: `${latestTs} WIB`,
    };
  }, [readings, range, tarif, unit]);

  const selectedDeviceObj =
    selectedDevice !== "all" ? deviceMap.get(selectedDevice) : null;

  return (
    <AppShell>
      <div className="flex flex-col w-full gap-6">
        {/* 1. PAGE HEADER AREA */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs uppercase tracking-wider text-on-surface-variant font-bold">
                Pantauan Konsumsi Listrik
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-secondary-container" />
              <span className="text-xs font-semibold text-on-surface-variant">
                Sinkronisasi Realtime
              </span>
            </div>
            <h1 className="font-extrabold text-2xl sm:text-3xl lg:text-[36px] leading-tight text-on-surface tracking-tight">
              Riwayat Pemakaian Listrik
            </h1>
            <p className="text-sm sm:text-base text-on-surface-variant mt-0.5">
              Catatan otomatis dari perangkat yang dipasangi sensor PZEM-004T
            </p>
          </div>

          {/* Active Device Snapshot Pill */}
          <div className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant/70 px-4 py-2.5 rounded-xl shadow-2xs self-start md:self-auto">
            <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary-container shrink-0">
              <span className="material-symbols-outlined text-[22px]">
                nest_multi_room
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-on-surface-variant">
                Status Jaringan Sensor
              </span>
              <span className="text-sm text-on-surface font-semibold flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-primary-container" />
                {onlineCount} dari {devices.length} Colokan Aktif
              </span>
            </div>
          </div>
        </div>

        {/* 2. CONTROL & FILTER TOOLBAR */}
        <div className="w-full bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
          {/* Left: Time Duration Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-on-surface-variant mr-1">
              Rentang:
            </span>
            <button
              type="button"
              onClick={() => setRange("today")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                range === "today"
                  ? "bg-primary-container text-on-primary shadow-2xs"
                  : "bg-surface hover:bg-surface-container text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                today
              </span>
              <span>Hari Ini</span>
            </button>

            <button
              type="button"
              onClick={() => setRange("7d")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                range === "7d"
                  ? "bg-primary-container text-on-primary shadow-2xs"
                  : "bg-surface hover:bg-surface-container text-on-surface"
              }`}
            >
              <span>7 Hari</span>
            </button>

            <button
              type="button"
              disabled={!has30DayData}
              className="px-4 py-2 rounded-lg bg-surface text-on-surface-variant/45 text-sm font-semibold cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
            >
              <span>30 Hari</span>
              {!has30DayData && (
                <span className="text-[11px] bg-surface-container text-on-surface-variant/75 px-2 py-0.5 rounded-full">
                  Data belum cukup
                </span>
              )}
            </button>
          </div>

          {/* Middle: Device Selector Dropdown */}
          <div className="relative flex items-center">
            <span className="material-symbols-outlined text-primary-container text-[20px] absolute left-3.5 pointer-events-none">
              tune
            </span>
            <select
              aria-label="Pilih Perangkat Terpantau"
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="h-11 pl-10 pr-9 rounded-lg bg-surface hover:bg-surface-container border border-outline-variant/60 text-on-surface text-sm font-semibold transition-colors appearance-none cursor-pointer focus:outline-none focus:border-primary"
            >
              <option value="all">
                Semua Perangkat ({devices.length} Alat)
              </option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nama}
                  {d.lokasi ? ` (${d.lokasi})` : ""}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined text-on-surface-variant text-[18px] absolute right-3 pointer-events-none">
              expand_more
            </span>
          </div>

          {/* Right: Metric Unit Toggle & View Mode */}
          <div className="flex flex-wrap items-center gap-3">
            {!showTable && (
              <div className="flex items-center bg-surface p-1 rounded-lg border border-outline-variant/50">
                <button
                  type="button"
                  onClick={() => setUnit("rupiah")}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    unit === "rupiah"
                      ? "bg-primary-container text-on-primary shadow-2xs"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Rupiah (Rp)
                </button>
                <button
                  type="button"
                  onClick={() => setUnit("kwh")}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    unit === "kwh"
                      ? "bg-primary-container text-on-primary shadow-2xs"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  kWh
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowTable((prev) => !prev)}
              className="h-11 px-4 rounded-lg bg-surface hover:bg-surface-container border border-outline-variant/60 text-on-surface text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[19px] text-on-surface-variant">
                {showTable ? "show_chart" : "table_chart"}
              </span>
              <span>
                {showTable ? "Lihat sebagai grafik" : "Lihat sebagai tabel"}
              </span>
            </button>
          </div>
        </div>

        {/* 3. MAIN CHART OR TABLE CONTAINER */}
        {!showTable ? (
          <div className="w-full bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-6 lg:p-7 shadow-2xs flex flex-col gap-6">
            {/* Header of Chart Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-col">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-lg sm:text-[22px] text-on-surface">
                    {unit === "rupiah"
                      ? `Grafik Estimasi Biaya (${
                          range === "today" ? "Hari Ini" : "7 Hari Terakhir"
                        })`
                      : `Grafik Konsumsi Energi (${
                          range === "today" ? "Hari Ini" : "7 Hari Terakhir"
                        })`}
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-semibold">
                    WIB (UTC+7)
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
                  Menampilkan laju pemakaian terukur dari{" "}
                  {selectedDeviceObj
                    ? selectedDeviceObj.nama
                    : `${devices.length} colokan terpantau`}
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface text-on-surface-variant text-xs font-semibold whitespace-nowrap">
                  <span className="material-symbols-outlined text-[16px]">
                    schedule
                  </span>
                  <span>Pembaruan terakhir: {lastUpdatedText}</span>
                </div>
              </div>
            </div>

            {/* Chart Canvas Area */}
            <div className="relative w-full h-80">
              {loading ? (
                <div className="w-full h-full rounded-xl bg-surface-container-low animate-pulse" />
              ) : chartData.length > 0 ? (
                <>
                  {peakPoint && peakPoint.nilai > 0 && (
                    <div className="mb-3 inline-flex items-center gap-2 bg-primary text-on-primary px-3 py-1.5 rounded-lg shadow-xs text-xs font-semibold">
                      <span className="material-symbols-outlined text-[16px] text-secondary-fixed">
                        bolt
                      </span>
                      <span>
                        Puncak:{" "}
                        {unit === "rupiah"
                          ? `Rp ${peakPoint.rpRate.toLocaleString("id-ID")} / jam`
                          : `${peakPoint.kwhRate} kWh / jam`}{" "}
                        ({peakPoint.waktu})
                      </span>
                    </div>
                  )}

                  <ResponsiveContainer width="100%" height="90%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 16, left: -8, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient
                          id="primaryAreaGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#1e40af"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="100%"
                            stopColor="#1e40af"
                            stopOpacity={0.0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="4 4"
                        stroke="#eee7e3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="waktu"
                        tick={{ fontSize: 12, fill: "#757684" }}
                        axisLine={{ stroke: "#c4c5d5" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#757684" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) =>
                          unit === "rupiah" ? `Rp ${val}` : `${val}`
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
                          unit === "rupiah"
                            ? `Rp ${Number(value).toLocaleString("id-ID")} / jam`
                            : `${value} kWh / jam`,
                          unit === "rupiah" ? "Laju Biaya" : "Laju Energi",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="nilai"
                        stroke="#1e40af"
                        fill="url(#primaryAreaGrad)"
                        strokeWidth={3}
                        activeDot={{
                          r: 6,
                          fill: "#1e40af",
                          stroke: "#ffffff",
                          strokeWidth: 2,
                        }}
                      />
                      {peakPoint && (
                        <ReferenceDot
                          x={peakPoint.waktu}
                          y={peakPoint.nilai}
                          r={6}
                          fill="#1e40af"
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div className="w-full h-full rounded-xl bg-surface-container-low border border-outline-variant/50 flex flex-col items-center justify-center text-center p-6">
                  <span className="material-symbols-outlined text-[36px] text-on-surface-variant mb-2">
                    insights
                  </span>
                  <p className="text-base font-bold text-on-surface">
                    Belum ada riwayat pembacaan pada rentang ini
                  </p>
                  <p className="text-xs sm:text-sm text-on-surface-variant mt-1 max-w-md">
                    Data akan muncul otomatis setelah modul ESP32 mengirimkan
                    pembacaan sensor PZEM-004T.
                  </p>
                </div>
              )}
            </div>

            {/* Chart Detailed Legend Bar */}
            <div className="pt-4 border-t border-surface-container flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full bg-primary-container" />
                  <span className="text-sm text-on-surface font-bold">
                    {selectedDeviceObj
                      ? selectedDeviceObj.nama
                      : "Semua Perangkat Terpantau"}
                  </span>
                  <span className="text-xs text-on-surface-variant font-medium">
                    ({readings.length} titik pembacaan)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-on-surface-variant">
                <span className="material-symbols-outlined text-[17px] text-secondary">
                  info
                </span>
                <span className="text-xs font-semibold">
                  Tarif dasar terpakai: Rp{" "}
                  {tarif.toLocaleString("id-ID", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  / kWh
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* MODE TABEL LOG SENSOR PZEM-004T */
          <div className="w-full bg-surface-container-lowest border border-outline-variant/70 rounded-xl shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-outline-variant/50 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-bold text-lg text-on-surface">
                  Log Pembacaan Sensor PZEM-004T
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Menampilkan {readings.length} catatan terbaru berdasarkan
                  filter aktif
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary-fixed text-primary">
                Data Terukur Langsung
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-container-low text-on-surface-variant text-xs font-bold uppercase tracking-wider border-b border-outline-variant/60">
                  <tr>
                    <th className="px-5 py-3.5">Waktu (WIB)</th>
                    <th className="px-5 py-3.5">Perangkat</th>
                    <th className="px-5 py-3.5">Tegangan (V)</th>
                    <th className="px-5 py-3.5">Arus (A)</th>
                    <th className="px-5 py-3.5">Daya Aktif (W)</th>
                    <th className="px-5 py-3.5">Energi Akumulasi (Wh)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {readings.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-10 text-center text-on-surface-variant"
                      >
                        Belum ada data pembacaan sensor pada rentang waktu ini.
                      </td>
                    </tr>
                  ) : (
                    readings
                      .slice()
                      .reverse()
                      .map((r) => {
                        const dev = deviceMap.get(r.device_id);
                        return (
                          <tr
                            key={r.id}
                            className="hover:bg-surface-container-low/60 transition-colors"
                          >
                            <td className="px-5 py-3 whitespace-nowrap text-on-surface">
                              {new Date(r.ts).toLocaleString("id-ID")}
                            </td>
                            <td className="px-5 py-3 font-semibold text-on-surface whitespace-nowrap">
                              {dev?.nama || "Perangkat IoT"}
                            </td>
                            <td className="px-5 py-3 text-on-surface-variant whitespace-nowrap">
                              {Number(r.v).toFixed(1)} V
                            </td>
                            <td className="px-5 py-3 text-on-surface-variant whitespace-nowrap">
                              {Number(r.i).toFixed(2)} A
                            </td>
                            <td className="px-5 py-3 font-bold text-primary-container whitespace-nowrap">
                              {Number(r.p).toFixed(1)} W
                            </td>
                            <td className="px-5 py-3 text-on-surface-variant whitespace-nowrap">
                              {Number(r.e_wh).toFixed(1)} Wh
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. BOTTOM ROW: 4 PLAIN-LANGUAGE STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Stat Card 1: Biaya Periode Terpilih */}
          <div className="bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-5 shadow-2xs flex flex-col justify-between h-full">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-on-surface-variant font-semibold">
                  {range === "today" ? "Biaya Hari Ini" : "Biaya 7 Hari"}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-semibold whitespace-nowrap shrink-0">
                  Estimasi
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-extrabold text-[28px] sm:text-[32px] leading-tight text-on-surface tracking-tight">
                  Rp {Math.round(totalBiaya).toLocaleString("id-ID")}
                </span>
              </div>
            </div>
            <div className="pt-3 border-t border-surface-container mt-4 flex items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">
                schedule
              </span>
              <span className="text-xs font-medium">
                {range === "today"
                  ? "Terhitung sejak 00.00 WIB"
                  : "Akumulasi 7 hari terakhir"}
              </span>
            </div>
          </div>

          {/* Stat Card 2: Listrik Terpakai */}
          <div className="bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-5 shadow-2xs flex flex-col justify-between h-full">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-on-surface-variant font-semibold">
                  Listrik Terpakai
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary font-semibold whitespace-nowrap shrink-0">
                  Terukur
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-extrabold text-[28px] sm:text-[32px] leading-tight text-on-surface tracking-tight">
                  {totalKwh.toFixed(2).replace(".", ",")}
                </span>
                <span className="text-lg text-on-surface-variant font-semibold">
                  kWh
                </span>
              </div>
            </div>
            <div className="pt-3 border-t border-surface-container mt-4 flex items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">
                speed
              </span>
              <span className="text-xs font-medium">
                Total energi terukur pada periode ini
              </span>
            </div>
          </div>

          {/* Stat Card 3: Rata-rata per Jam */}
          <div className="bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-5 shadow-2xs flex flex-col justify-between h-full">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-on-surface-variant font-semibold">
                  Rata-rata per Jam
                </span>
                <span className="w-2 h-2 rounded-full bg-outline-variant shrink-0" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-bold text-[26px] sm:text-[28px] leading-tight text-on-surface tracking-tight">
                  Rp {Math.round(avgCostPerHour).toLocaleString("id-ID")}
                </span>
                <span className="text-sm text-on-surface-variant font-semibold">
                  / jam
                </span>
              </div>
            </div>
            <div className="pt-3 border-t border-surface-container mt-4 flex items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">
                equalizer
              </span>
              <span className="text-xs font-medium">
                ± {avgKwhPerHour.toFixed(2).replace(".", ",")} kWh saat alat
                aktif
              </span>
            </div>
          </div>

          {/* Stat Card 4: Jam Paling Ramai */}
          <div className="bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-5 shadow-2xs flex flex-col justify-between h-full">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-on-surface-variant font-semibold">
                  Jam Paling Ramai
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-semibold whitespace-nowrap shrink-0">
                  Beban Tinggi
                </span>
              </div>
              <div className="mt-1 flex items-baseline">
                <span className="font-bold text-[22px] leading-tight text-on-surface tracking-tight">
                  {peakHourWindow}
                </span>
                {peakHourWindow !== "-" && (
                  <span className="text-xs text-on-surface-variant font-semibold ml-1.5">
                    WIB
                  </span>
                )}
              </div>
            </div>
            <div className="pt-3 border-t border-surface-container mt-4 flex items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px] text-secondary shrink-0">
                mode_heat
              </span>
              <span className="text-xs font-medium truncate">
                {peakPoint
                  ? `Puncak ${peakPoint.watt} W terukur pada periode ini`
                  : "Menunggu data beban aktif"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
