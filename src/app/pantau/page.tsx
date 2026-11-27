// src/app/pantau/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/supabase";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
} from "recharts";

interface Device {
  id: string;
  nama: string;
  jenis_beban?: string | null;
  daya_nominal_w?: number | null;
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

interface DeviceSeriesConfig {
  id: string;
  nama: string;
  dayaNominal: number;
  color: string;
  dashed: boolean;
}

const OFFLINE_THRESHOLD_MS = 120_000;
const ITEMS_PER_PAGE = 5;

// Palet warna konsisten dengan Stitch untuk membedakan garis tiap perangkat
const DEVICE_LINE_PALETTE = [
  { color: "#0D9488", dashed: false }, // Teal (Alat 1)
  { color: "#9B4500", dashed: false }, // Warm Amber / Secondary (Alat 2)
  { color: "#757684", dashed: true }, // Warm Slate Dashed (Alat 3)
  { color: "#6366F1", dashed: false }, // Indigo (Alat 4)
  { color: "#005826", dashed: true }, // Deep Forest (Alat 5)
];

export default function PantauPage() {
  const supabase = useMemo(() => createClient(), []);

  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("all");
  const [deviceDropdownOpen, setDeviceDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [range, setRange] = useState<"today" | "7d" | "30d">("today");
  const [unit, setUnit] = useState<"rupiah" | "kwh">("rupiah");
  const [showTable, setShowTable] = useState<boolean>(false);
  const [tablePage, setTablePage] = useState<number>(1);

  const [readings, setReadings] = useState<Reading[]>([]);
  const [has30DayData, setHas30DayData] = useState<boolean>(false);
  const [tarif, setTarif] = useState<number>(1444.7);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDeviceDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDeviceDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Reset halaman tabel ke 1 saat filter rentang atau perangkat berubah
  useEffect(() => {
    setTablePage(1);
  }, [range, selectedDevice]);

  const fetchPantauData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let userDevices: Device[] = [];
    if (user) {
      const [{ data: profile }, { data: devs }] = await Promise.all([
        supabase
          .from("profiles")
          .select("tarif_per_kwh")
          .eq("id", user.id)
          .single(),
        supabase
          .from("devices")
          .select("id, nama, jenis_beban, daya_nominal_w, last_seen_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
      ]);

      if (profile?.tarif_per_kwh) {
        setTarif(Number(profile.tarif_per_kwh));
      }
      userDevices = (devs as Device[]) || [];
    }
    setDevices(userDevices);

    if (userDevices.length === 0) {
      setReadings([]);
      setHas30DayData(false);
      setLoading(false);
      return;
    }

    const devIds = userDevices.map((d) => d.id);

    // Cek ketersediaan data > 21 hari milik perangkat user untuk tombol 30 Hari
    const twentyOneDaysAgo = new Date();
    twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21);
    const { count: oldCount } = await supabase
      .from("readings")
      .select("*", { count: "exact", head: true })
      .in("device_id", devIds)
      .lt("ts", twentyOneDaysAgo.toISOString());
    setHas30DayData((oldCount || 0) > 0);

    // Hitung awal rentang waktu
    const startTime = new Date();
    if (range === "today") {
      startTime.setHours(0, 0, 0, 0);
    } else if (range === "7d") {
      startTime.setDate(startTime.getDate() - 7);
      startTime.setHours(0, 0, 0, 0);
    } else {
      startTime.setDate(startTime.getDate() - 30);
      startTime.setHours(0, 0, 0, 0);
    }

    let query = supabase
      .from("readings")
      .select("*")
      .gte("ts", startTime.toISOString())
      .order("ts", { ascending: true })
      .limit(5000);

    if (selectedDevice !== "all") {
      query = query.eq("device_id", selectedDevice);
    } else {
      query = query.in("device_id", devIds);
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

  // Konfigurasi seri warna per perangkat
  const deviceSeriesList: DeviceSeriesConfig[] = useMemo(() => {
    return devices.map((dev, idx) => {
      const style = DEVICE_LINE_PALETTE[idx % DEVICE_LINE_PALETTE.length];
      return {
        id: dev.id,
        nama: dev.nama,
        dayaNominal: dev.daya_nominal_w || 50,
        color: style.color,
        dashed: style.dashed,
      };
    });
  }, [devices]);

  const activeSeriesList = useMemo(() => {
    if (selectedDevice === "all") return deviceSeriesList;
    return deviceSeriesList.filter((s) => s.id === selectedDevice);
  }, [deviceSeriesList, selectedDevice]);

  const onlineCount = useMemo(() => {
    const now = Date.now();
    return devices.filter(
      (d) =>
        d.last_seen_at &&
        now - new Date(d.last_seen_at).getTime() <= OFFLINE_THRESHOLD_MS,
    ).length;
  }, [devices]);

  // Agregasi data grafik per slot waktu (memisahkan seri tiap perangkat + total akumulasi)
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

    // 1. Hitung energi terukur kumulatif per perangkat dalam rentang terpilih
    const byDevice = new Map<string, Reading[]>();
    readings.forEach((r) => {
      const list = byDevice.get(r.device_id) || [];
      list.push(r);
      byDevice.set(r.device_id, list);
    });

    let sumKwh = 0;
    byDevice.forEach((list) => {
      if (list.length > 1) {
        const deltaWh = Math.max(
          0,
          Number(list[list.length - 1].e_wh) - Number(list[0].e_wh),
        );
        sumKwh += deltaWh / 1000;
      } else if (list.length === 1) {
        sumKwh += Math.max(0, Number(list[0].p) / 1000);
      }
    });

    // 2. Kelompokkan pembacaan per slot waktu & per device_id
    const bucketMap = new Map<
      string,
      {
        label: string;
        sortKey: number;
        hourNum: number;
        perDeviceWatt: Map<string, { sum: number; count: number }>;
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

      let bucket = bucketMap.get(key);
      if (!bucket) {
        bucket = {
          label,
          sortKey: dateObj.getTime(),
          hourNum: dateObj.getHours(),
          perDeviceWatt: new Map(),
        };
        bucketMap.set(key, bucket);
      }

      const devAcc = bucket.perDeviceWatt.get(r.device_id) || {
        sum: 0,
        count: 0,
      };
      devAcc.sum += Number(r.p);
      devAcc.count += 1;
      bucket.perDeviceWatt.set(r.device_id, devAcc);
    });

    // 3. Susun titik data grafik dengan kolom dinamis dev_<deviceId> + total nilai
    const formattedChart = Array.from(bucketMap.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .map((b) => {
        let totalAvgWatt = 0;
        const point: Record<string, string | number> = {
          waktu: b.label,
          hourNum: b.hourNum,
        };

        activeSeriesList.forEach((ser) => {
          const acc = b.perDeviceWatt.get(ser.id);
          const devAvgWatt = acc && acc.count > 0 ? acc.sum / acc.count : 0;
          totalAvgWatt += devAvgWatt;

          const devKwhRate = devAvgWatt / 1000;
          const devRpRate = Math.round(devKwhRate * tarif);
          point[`dev_${ser.id}`] =
            unit === "rupiah" ? devRpRate : Number(devKwhRate.toFixed(3));
        });

        const totalKwhRate = totalAvgWatt / 1000;
        const totalRpRate = Math.round(totalKwhRate * tarif);

        point.nilai =
          unit === "rupiah" ? totalRpRate : Number(totalKwhRate.toFixed(3));
        point.rpRate = totalRpRate;
        point.kwhRate = Number(totalKwhRate.toFixed(3));
        point.watt = Math.round(totalAvgWatt);

        return point;
      });

    let maxItem = formattedChart[0] || null;
    formattedChart.forEach((item) => {
      if (maxItem && Number(item.nilai) > Number(maxItem.nilai)) {
        maxItem = item;
      }
    });

    const costTotal = sumKwh * tarif;
    const activeSlots = Math.max(1, formattedChart.length);
    const avgRp = costTotal / activeSlots;
    const avgKwh = sumKwh / activeSlots;

    const peakHour = maxItem ? Number(maxItem.hourNum) : 0;
    const peakWindow = maxItem
      ? `${String(peakHour).padStart(2, "0")}.00 – ${String(
          (peakHour + 2) % 24,
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
  }, [readings, range, tarif, unit, activeSeriesList]);

  // Pagination untuk tabel log sensor (terbaru di atas)
  const reversedReadings = useMemo(() => {
    return readings.slice().reverse();
  }, [readings]);

  const totalPages = Math.max(
    1,
    Math.ceil(reversedReadings.length / ITEMS_PER_PAGE),
  );
  const safeTablePage = Math.min(tablePage, totalPages);
  const startIdx = (safeTablePage - 1) * ITEMS_PER_PAGE;
  const paginatedReadings = reversedReadings.slice(
    startIdx,
    startIdx + ITEMS_PER_PAGE,
  );

  const selectedDeviceObj =
    selectedDevice !== "all" ? deviceMap.get(selectedDevice) : null;

  const selectedDeviceLabel = selectedDeviceObj
    ? `${selectedDeviceObj.nama}${
        selectedDeviceObj.jenis_beban
          ? ` (${selectedDeviceObj.jenis_beban})`
          : ""
      }`
    : `Semua Perangkat (${devices.length} Alat)`;

  const isMultiAllView =
    selectedDevice === "all" && activeSeriesList.length > 1;

  const rangeSuffixTitle =
    range === "today"
      ? "per Jam (Hari Ini)"
      : range === "7d"
        ? "per Hari (7 Hari Terakhir)"
        : "per Hari (30 Hari Terakhir)";

  return (
    <AppShell>
      <div className="flex flex-col w-full max-w-full overflow-x-hidden gap-4 sm:gap-6">
        {/* 1. PAGE HEADER AREA */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs uppercase tracking-wider text-primary-container font-bold">
                Pantauan Konsumsi Listrik
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container shrink-0" />
              <span className="text-xs text-on-surface-variant font-medium">
                Sinkronisasi Realtime
              </span>
            </div>
            <h1 className="font-extrabold text-2xl sm:text-3xl lg:text-[36px] leading-tight text-on-surface tracking-tight">
              Riwayat Pemakaian Listrik
            </h1>
            <p className="text-sm sm:text-base text-on-surface-variant mt-0.5 leading-relaxed">
              Catatan otomatis dari perangkat yang dipasangi sensor PZEM-004T
            </p>
          </div>

          {/* Active Device Snapshot Pill */}
          <div className="w-full sm:w-auto flex items-center gap-3 bg-surface-container-lowest border border-outline-variant/70 px-3.5 sm:px-4 py-2.5 rounded-xl shadow-2xs self-start md:self-auto shrink-0">
            <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary-container shrink-0">
              <span className="material-symbols-outlined text-[22px]">
                nest_multi_room
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-on-surface-variant">
                Status Jaringan Sensor
              </span>
              <span className="text-sm text-on-surface font-semibold flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-primary-container shrink-0" />
                {onlineCount} dari {devices.length} Colokan Aktif
              </span>
            </div>
          </div>
        </div>

        {/* 2. CONTROL & FILTER TOOLBAR */}
        <div className="w-full bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-3.5 sm:p-4 shadow-2xs flex flex-col lg:flex-row lg:flex-wrap lg:items-center justify-between gap-3 sm:gap-4">
          {/* Left: Time Duration Selector */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-on-surface-variant mr-0.5">
              Rentang:
            </span>
            <button
              type="button"
              onClick={() => setRange("today")}
              className={`min-h-[40px] px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
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
              className={`min-h-[40px] px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
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
              onClick={() => setRange("30d")}
              className={`min-h-[40px] px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                !has30DayData
                  ? "bg-surface text-on-surface-variant/45 cursor-not-allowed"
                  : range === "30d"
                    ? "bg-primary-container text-on-primary shadow-2xs cursor-pointer"
                    : "bg-surface hover:bg-surface-container text-on-surface cursor-pointer"
              }`}
            >
              <span>30 Hari</span>
            </button>
          </div>

          {/* Middle: Responsive Device Selector Dropdown */}
          <div
            ref={dropdownRef}
            className="relative w-full sm:w-auto sm:min-w-[230px] sm:max-w-[300px] min-w-0"
          >
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={deviceDropdownOpen}
              aria-label="Pilih Perangkat Terpantau"
              onClick={() => setDeviceDropdownOpen((prev) => !prev)}
              className="w-full h-11 px-3.5 rounded-lg bg-surface hover:bg-surface-container border border-outline-variant/60 text-on-surface text-xs sm:text-sm font-semibold transition-colors flex items-center justify-between gap-2 cursor-pointer focus:outline-none focus:border-primary"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-primary-container text-[20px] shrink-0">
                  tune
                </span>
                <span className="truncate text-left">
                  {selectedDeviceLabel}
                </span>
              </span>
              <span
                className={`material-symbols-outlined text-on-surface-variant text-[18px] shrink-0 transition-transform duration-200 ${
                  deviceDropdownOpen ? "rotate-180" : ""
                }`}
              >
                expand_more
              </span>
            </button>

            {deviceDropdownOpen && (
              <ul
                role="listbox"
                aria-label="Daftar Perangkat Terpantau"
                className="absolute left-0 right-0 sm:right-auto sm:min-w-full sm:w-max sm:max-w-[340px] mt-1.5 max-h-64 overflow-y-auto rounded-xl bg-surface-container-lowest border border-outline-variant/80 shadow-lg py-1.5 z-30"
              >
                <li role="option" aria-selected={selectedDevice === "all"}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDevice("all");
                      setDeviceDropdownOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 text-left text-xs sm:text-sm flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      selectedDevice === "all"
                        ? "bg-primary-fixed/60 text-primary font-bold"
                        : "text-on-surface hover:bg-surface-container font-medium"
                    }`}
                  >
                    <span className="truncate">
                      Semua Perangkat ({devices.length} Alat)
                    </span>
                    {selectedDevice === "all" && (
                      <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
                        check
                      </span>
                    )}
                  </button>
                </li>

                {devices.map((d, idx) => {
                  const isSelected = selectedDevice === d.id;
                  const serColor =
                    DEVICE_LINE_PALETTE[idx % DEVICE_LINE_PALETTE.length].color;

                  return (
                    <li key={d.id} role="option" aria-selected={isSelected}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDevice(d.id);
                          setDeviceDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2.5 text-left text-xs sm:text-sm flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-primary-fixed/60 text-primary font-bold"
                            : "text-on-surface hover:bg-surface-container font-medium"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: serColor }}
                          />
                          <span className="truncate">
                            {d.nama}
                            {d.jenis_beban ? ` (${d.jenis_beban})` : ""}
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

          {/* Right: Metric Unit Toggle & View Mode */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {!showTable && (
              <div className="flex items-center bg-surface p-1 rounded-lg border border-outline-variant/50 shrink-0">
                <button
                  type="button"
                  onClick={() => setUnit("rupiah")}
                  className={`px-3 sm:px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
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
                  className={`px-3 sm:px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
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
              className="flex-1 sm:flex-initial justify-center h-11 px-4 rounded-lg bg-surface hover:bg-surface-container border border-outline-variant/60 text-on-surface text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[19px] text-on-surface-variant shrink-0">
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
          <div className="w-full bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 sm:p-6 lg:p-7 shadow-2xs flex flex-col gap-5 sm:gap-6 min-w-0">
            {/* Header of Chart Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-base sm:text-lg md:text-[22px] text-on-surface leading-snug">
                    {unit === "rupiah"
                      ? `Grafik Biaya Pemakaian ${rangeSuffixTitle}`
                      : `Grafik Konsumsi Energi ${rangeSuffixTitle}`}
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-semibold shrink-0">
                    WIB (UTC+7)
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
                  {selectedDeviceObj
                    ? `Menampilkan rincian pemakaian terukur dari ${selectedDeviceObj.nama}`
                    : `Menampilkan pemakaian akumulatif beserta rincian tiap garis dari ${devices.length} colokan terpantau`}
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface text-on-surface-variant text-xs font-semibold whitespace-nowrap">
                  <span className="material-symbols-outlined text-[16px] shrink-0">
                    schedule
                  </span>
                  <span>Pembaruan terakhir: {lastUpdatedText}</span>
                </div>
              </div>
            </div>

            {/* Chart Canvas Area (Multi-Device Composed Line & Area Chart) */}
            <div className="relative w-full h-72 sm:h-80 min-w-0">
              {loading ? (
                <div className="w-full h-full rounded-xl bg-surface-container-low animate-pulse" />
              ) : chartData.length > 0 ? (
                <>
                  {peakPoint && Number(peakPoint.nilai) > 0 && (
                    <div className="mb-3 inline-flex items-center gap-2 bg-primary text-on-primary px-3 py-1.5 rounded-lg shadow-xs text-xs font-semibold max-w-full">
                      <span className="material-symbols-outlined text-[16px] text-secondary-fixed shrink-0">
                        bolt
                      </span>
                      <span className="truncate">
                        Puncak:{" "}
                        {unit === "rupiah"
                          ? `Rp ${Number(peakPoint.rpRate).toLocaleString("id-ID")} / jam`
                          : `${peakPoint.kwhRate} kWh / jam`}{" "}
                        ({peakPoint.waktu})
                      </span>
                    </div>
                  )}

                  <ResponsiveContainer width="100%" height="88%">
                    <ComposedChart
                      data={chartData}
                      margin={{ top: 10, right: 12, left: -14, bottom: 4 }}
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
                            stopOpacity={0.18}
                          />
                          <stop
                            offset="60%"
                            stopColor="#1e40af"
                            stopOpacity={0.05}
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
                        tick={{ fontSize: 11, fill: "#757684" }}
                        axisLine={{ stroke: "#c4c5d5" }}
                        tickLine={false}
                        minTickGap={20}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#757684" }}
                        axisLine={false}
                        tickLine={false}
                        width={56}
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
                          boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
                        }}
                        formatter={(value: unknown, name: unknown) => {
                          const formattedVal =
                            unit === "rupiah"
                              ? `Rp ${Number(value).toLocaleString("id-ID")} / jam`
                              : `${value} kWh / jam`;
                          return [formattedVal, String(name)];
                        }}
                      />

                      {/* Garis individual per perangkat saat mode "Semua Perangkat" */}
                      {isMultiAllView &&
                        activeSeriesList.map((ser) => (
                          <Line
                            key={ser.id}
                            type="monotone"
                            dataKey={`dev_${ser.id}`}
                            name={ser.nama}
                            stroke={ser.color}
                            strokeWidth={2.2}
                            strokeDasharray={ser.dashed ? "5 4" : undefined}
                            dot={false}
                            activeDot={{
                              r: 4.5,
                              fill: ser.color,
                              stroke: "#ffffff",
                              strokeWidth: 1.5,
                            }}
                          />
                        ))}

                      {/* Area + Garis Utama Total Akumulasi / Perangkat Terpilih */}
                      <Area
                        type="monotone"
                        dataKey="nilai"
                        name={
                          isMultiAllView
                            ? "Total Akumulasi (Semua Alat)"
                            : selectedDeviceObj?.nama || "Total Pemakaian"
                        }
                        stroke={
                          selectedDeviceObj && activeSeriesList[0]
                            ? activeSeriesList[0].color
                            : "#1e40af"
                        }
                        fill="url(#primaryAreaGrad)"
                        strokeWidth={3.2}
                        activeDot={{
                          r: 6,
                          fill:
                            selectedDeviceObj && activeSeriesList[0]
                              ? activeSeriesList[0].color
                              : "#1e40af",
                          stroke: "#ffffff",
                          strokeWidth: 2,
                        }}
                      />

                      {peakPoint && (
                        <ReferenceDot
                          x={String(peakPoint.waktu)}
                          y={Number(peakPoint.nilai)}
                          r={6}
                          fill={
                            selectedDeviceObj && activeSeriesList[0]
                              ? activeSeriesList[0].color
                              : "#1e40af"
                          }
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div className="w-full h-full rounded-xl bg-surface-container-low border border-outline-variant/50 flex flex-col items-center justify-center text-center p-5 sm:p-6">
                  <span className="material-symbols-outlined text-[36px] text-on-surface-variant mb-2">
                    insights
                  </span>
                  <p className="text-sm sm:text-base font-bold text-on-surface">
                    Belum ada riwayat pembacaan pada rentang ini
                  </p>
                  <p className="text-xs sm:text-sm text-on-surface-variant mt-1 max-w-md leading-relaxed">
                    Data akan muncul otomatis setelah modul ESP32 mengirimkan
                    pembacaan sensor PZEM-004T.
                  </p>
                </div>
              )}
            </div>

            {/* Chart Detailed Legend Bar (Selaras Stitch) */}
            <div className="pt-4 border-t border-surface-container flex flex-wrap items-center justify-between gap-3 sm:gap-4">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 min-w-0">
                {/* Total / Selected Primary Legend */}
                <div className="flex items-center gap-2">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        selectedDeviceObj && activeSeriesList[0]
                          ? activeSeriesList[0].color
                          : "#1e40af",
                    }}
                  />
                  <span className="text-xs sm:text-sm text-on-surface font-bold">
                    {selectedDeviceObj
                      ? selectedDeviceObj.nama
                      : "Total Akumulasi"}
                  </span>
                  <span className="text-xs text-on-surface-variant font-medium">
                    {selectedDeviceObj
                      ? `• ${selectedDeviceObj.daya_nominal_w || 50} Watt`
                      : "(Semua Alat)"}
                  </span>
                </div>

                {/* Daftar Legenda Warna Tiap Perangkat saat mode "Semua Perangkat" */}
                {isMultiAllView && (
                  <>
                    <div className="h-4 w-px bg-outline-variant/50 hidden sm:block" />
                    {activeSeriesList.map((ser) => (
                      <button
                        key={ser.id}
                        type="button"
                        onClick={() => setSelectedDevice(ser.id)}
                        title={`Klik untuk fokus ke ${ser.nama}`}
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
                      >
                        {ser.dashed ? (
                          <span
                            className="w-4 h-0 border-t-2 border-dashed shrink-0"
                            style={{ borderColor: ser.color }}
                          />
                        ) : (
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: ser.color }}
                          />
                        )}
                        <span className="text-xs sm:text-sm text-on-surface font-medium">
                          {ser.nama}
                        </span>
                        <span className="text-xs text-on-surface-variant">
                          - {ser.dayaNominal} Watt
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>

              {/* Quick Explanation Tag */}
              <div className="flex items-center gap-1.5 text-on-surface-variant">
                <span className="material-symbols-outlined text-[17px] text-secondary shrink-0">
                  info
                </span>
                <span className="text-xs font-semibold">
                  Tarif dasar R-1/TR: Rp{" "}
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
          /* MODE TABEL LOG SENSOR PZEM-004T DENGAN PAGINATION */
          <div className="w-full bg-surface-container-lowest border border-outline-variant/70 rounded-xl shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-outline-variant/50 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-bold text-base sm:text-lg text-on-surface">
                  Log Pembacaan Sensor PZEM-004T
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Menampilkan {readings.length} catatan terbaru berdasarkan
                  filter aktif
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary-fixed text-primary shrink-0 whitespace-nowrap">
                Data Terukur Langsung
              </span>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs sm:text-sm text-left">
                <thead className="bg-surface-container-low text-on-surface-variant text-xs font-bold uppercase tracking-wider border-b border-outline-variant/60">
                  <tr>
                    <th className="px-4 sm:px-5 py-3.5 whitespace-nowrap">
                      Waktu (WIB)
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 whitespace-nowrap">
                      Perangkat
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 whitespace-nowrap">
                      Tegangan (V)
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 whitespace-nowrap">
                      Arus (A)
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 whitespace-nowrap">
                      Daya Aktif (W)
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 whitespace-nowrap">
                      Energi Akumulasi (Wh)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {paginatedReadings.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 sm:px-5 py-10 text-center text-on-surface-variant"
                      >
                        Belum ada data pembacaan sensor pada rentang waktu ini.
                      </td>
                    </tr>
                  ) : (
                    paginatedReadings.map((r) => {
                      const dev = deviceMap.get(r.device_id);
                      return (
                        <tr
                          key={r.id}
                          className="hover:bg-surface-container-low/60 transition-colors"
                        >
                          <td className="px-4 sm:px-5 py-3 whitespace-nowrap text-on-surface">
                            {new Date(r.ts).toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 sm:px-5 py-3 font-semibold text-on-surface whitespace-nowrap">
                            {dev?.nama || "Perangkat IoT"}
                          </td>
                          <td className="px-4 sm:px-5 py-3 text-on-surface-variant whitespace-nowrap">
                            {Number(r.v).toFixed(1)} V
                          </td>
                          <td className="px-4 sm:px-5 py-3 text-on-surface-variant whitespace-nowrap">
                            {Number(r.i).toFixed(2)} A
                          </td>
                          <td className="px-4 sm:px-5 py-3 font-bold text-primary-container whitespace-nowrap">
                            {Number(r.p).toFixed(1)} W
                          </td>
                          <td className="px-4 sm:px-5 py-3 text-on-surface-variant whitespace-nowrap">
                            {Number(r.e_wh).toFixed(1)} Wh
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer Controls */}
            {reversedReadings.length > ITEMS_PER_PAGE && (
              <div className="px-4 sm:px-5 py-3.5 bg-surface-container-low/60 border-t border-outline-variant/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-on-surface-variant font-medium">
                  Menampilkan{" "}
                  <strong className="text-on-surface">{startIdx + 1}</strong>–
                  <strong className="text-on-surface">
                    {Math.min(
                      startIdx + ITEMS_PER_PAGE,
                      reversedReadings.length,
                    )}
                  </strong>{" "}
                  dari{" "}
                  <strong className="text-on-surface">
                    {reversedReadings.length}
                  </strong>{" "}
                  catatan
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safeTablePage <= 1}
                    onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/70 text-xs font-semibold text-on-surface hover:bg-surface-container disabled:opacity-45 disabled:cursor-not-allowed inline-flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      chevron_left
                    </span>
                    <span>Sebelumnya</span>
                  </button>

                  <span className="px-2.5 text-xs font-semibold text-on-surface-variant whitespace-nowrap">
                    Halaman {safeTablePage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={safeTablePage >= totalPages}
                    onClick={() =>
                      setTablePage((p) => Math.min(totalPages, p + 1))
                    }
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/70 text-xs font-semibold text-on-surface hover:bg-surface-container disabled:opacity-45 disabled:cursor-not-allowed inline-flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>Berikutnya</span>
                    <span className="material-symbols-outlined text-[16px]">
                      chevron_right
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. BOTTOM ROW: 4 PLAIN-LANGUAGE STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Stat Card 1: Biaya Periode Terpilih */}
          <div className="bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between h-full min-w-0">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-on-surface-variant font-semibold">
                  {range === "today"
                    ? "Biaya Hari Ini"
                    : range === "7d"
                      ? "Biaya 7 Hari"
                      : "Biaya 30 Hari"}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-semibold whitespace-nowrap shrink-0">
                  Estimasi
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-extrabold text-[26px] sm:text-[32px] leading-tight text-on-surface tracking-tight break-words">
                  Rp {Math.round(totalBiaya).toLocaleString("id-ID")}
                </span>
              </div>
            </div>
            <div className="pt-3 border-t border-surface-container mt-4 flex items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px] shrink-0">
                schedule
              </span>
              <span className="text-xs font-medium">
                {range === "today"
                  ? "Terhitung sejak 00.00 WIB"
                  : range === "7d"
                    ? "Akumulasi 7 hari terakhir"
                    : "Akumulasi 30 hari terakhir"}
              </span>
            </div>
          </div>

          {/* Stat Card 2: Listrik Terpakai */}
          <div className="bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between h-full min-w-0">
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
                <span className="font-extrabold text-[26px] sm:text-[32px] leading-tight text-on-surface tracking-tight">
                  {totalKwh.toFixed(2).replace(".", ",")}
                </span>
                <span className="text-base sm:text-lg text-on-surface-variant font-semibold">
                  kWh
                </span>
              </div>
            </div>
            <div className="pt-3 border-t border-surface-container mt-4 flex items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px] shrink-0">
                speed
              </span>
              <span className="text-xs font-medium">
                Total energi terukur pada periode ini
              </span>
            </div>
          </div>

          {/* Stat Card 3: Rata-rata per Jam */}
          <div className="bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between h-full min-w-0">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-on-surface-variant font-semibold">
                  Rata-rata per Jam
                </span>
                <span className="w-2 h-2 rounded-full bg-outline-variant shrink-0" />
              </div>
              <div className="mt-1 flex items-baseline gap-1 flex-wrap">
                <span className="font-bold text-[24px] sm:text-[28px] leading-tight text-on-surface tracking-tight">
                  Rp {Math.round(avgCostPerHour).toLocaleString("id-ID")}
                </span>
                <span className="text-sm text-on-surface-variant font-semibold">
                  / jam
                </span>
              </div>
            </div>
            <div className="pt-3 border-t border-surface-container mt-4 flex items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px] shrink-0">
                equalizer
              </span>
              <span className="text-xs font-medium">
                ± {avgKwhPerHour.toFixed(2).replace(".", ",")} kWh saat alat
                aktif
              </span>
            </div>
          </div>

          {/* Stat Card 4: Jam Paling Ramai */}
          <div className="bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between h-full min-w-0">
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
                <span className="font-bold text-xl sm:text-[22px] leading-tight text-on-surface tracking-tight">
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
