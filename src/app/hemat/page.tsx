// src/app/hemat/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/supabase";

interface DeviceOption {
  id: string;
  nama: string;
  subLabel: string;
  watt: number;
  icon: string;
}

interface ReadingRow {
  device_id: string;
  ts: string;
  p: number;
  e_wh: number;
}

const DEFAULT_DEVICES: DeviceOption[] = [
  {
    id: "kipas",
    nama: "Kipas Angin",
    subLabel: "Kamar Tidur Utama",
    watt: 48,
    icon: "mode_fan",
  },
  {
    id: "lampu",
    nama: "Lampu Meja",
    subLabel: "Ruang Kerja",
    watt: 60,
    icon: "table_lamp",
  },
  {
    id: "teko",
    nama: "Teko Listrik",
    subLabel: "Area Dapur",
    watt: 500,
    icon: "coffee_maker",
  },
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

function getDefaultWatt(nama: string): number {
  const lower = nama.toLowerCase();
  if (lower.includes("kipas")) return 48;
  if (lower.includes("lampu")) return 60;
  if (lower.includes("teko") || lower.includes("pemanas")) return 500;
  if (lower.includes("dispenser")) return 350;
  if (lower.includes("kulkas")) return 100;
  return 75;
}

export default function HematPage() {
  const supabase = useMemo(() => createClient(), []);

  const [tarif, setTarif] = useState<number>(1444.7);
  const [targetRp, setTargetRp] = useState<number>(48600);
  const [editingTarget, setEditingTarget] = useState<boolean>(false);
  const [targetInput, setTargetInput] = useState<string>("48600");
  const [savingTarget, setSavingTarget] = useState<boolean>(false);

  const [currentKwh, setCurrentKwh] = useState<number>(0);
  const [deviceOptions, setDeviceOptions] =
    useState<DeviceOption[]>(DEFAULT_DEVICES);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("kipas");
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [jamKurang, setJamKurang] = useState<number>(2);
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

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [{ data: profile }, { data: budgetRule }, { data: devsData }] =
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
          .select("id, nama, jenis_beban, lokasi")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
      ]);

    if (profile?.tarif_per_kwh) {
      setTarif(Number(profile.tarif_per_kwh));
    }
    if (budgetRule?.ambang) {
      const val = Number(budgetRule.ambang);
      setTargetRp(val);
      setTargetInput(String(val));
    }

    const devs = devsData || [];

    if (devs.length > 0) {
      const devIds = devs.map((d) => d.id);
      const { data: readsData } = await supabase
        .from("readings")
        .select("device_id, ts, p, e_wh")
        .in("device_id", devIds)
        .gte("ts", startOfMonth.toISOString())
        .order("ts", { ascending: true })
        .limit(5000);

      const reads = (readsData as ReadingRow[]) || [];
      let totalMonthKwh = 0;

      const mappedOptions: DeviceOption[] = devs.map((d) => {
        const dReads = reads.filter((r) => r.device_id === d.id);
        if (dReads.length > 1) {
          totalMonthKwh +=
            Math.max(
              0,
              Number(dReads[dReads.length - 1].e_wh) - Number(dReads[0].e_wh),
            ) / 1000;
        } else if (dReads.length === 1) {
          totalMonthKwh += Math.max(0.001, Number(dReads[0].p) / 1000);
        }

        const activeReads = dReads.filter((r) => Number(r.p) > 2);
        const avgWatt =
          activeReads.length > 0
            ? Math.round(
                activeReads.reduce((acc, r) => acc + Number(r.p), 0) /
                  activeReads.length,
              )
            : getDefaultWatt(d.nama);

        return {
          id: d.id,
          nama: d.nama,
          subLabel: d.lokasi || d.jenis_beban || "Colokan Pintar",
          watt: avgWatt,
          icon: getDeviceIcon(d.nama, d.jenis_beban),
        };
      });

      setCurrentKwh(totalMonthKwh);
      setDeviceOptions(mappedOptions);
      setSelectedDeviceId((prev) =>
        mappedOptions.some((o) => o.id === prev) ? prev : mappedOptions[0].id,
      );
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const newTarget = Math.max(5000, Number(targetInput) || 48600);
    setSavingTarget(true);

    const { data: existing } = await supabase
      .from("user_thresholds")
      .select("id")
      .eq("user_id", user.id)
      .eq("tipe", "estimasi_biaya")
      .single();

    if (existing?.id) {
      await supabase
        .from("user_thresholds")
        .update({ ambang: newTarget })
        .eq("id", existing.id);
    } else {
      await supabase.from("user_thresholds").insert({
        user_id: user.id,
        tipe: "estimasi_biaya",
        ambang: newTarget,
        aktif: true,
      });
    }

    setTargetRp(newTarget);
    setSavingTarget(false);
    setEditingTarget(false);
  };

  // Kalkulasi status kuota & proyeksi bulan ini
  const currentCostRp = Math.round(currentKwh * tarif);
  const targetMaxKwh = tarif > 0 ? targetRp / tarif : 0;
  const quotaPct =
    targetRp > 0
      ? Math.min(100, Math.round((currentCostRp / targetRp) * 100))
      : 0;
  const remainingKwh = Math.max(0, targetMaxKwh - currentKwh);
  const remainingRp = Math.max(0, targetRp - currentCostRp);

  const dayOfMonth = Math.max(1, new Date().getDate());
  const projectedMonthRp = Math.round((currentCostRp / dayOfMonth) * 30);
  const projectedOverRp = projectedMonthRp - targetRp;

  // Kalkulasi simulator kurangi jam nyala
  const selectedDevice = useMemo(() => {
    return (
      deviceOptions.find((d) => d.id === selectedDeviceId) || deviceOptions[0]
    );
  }, [deviceOptions, selectedDeviceId]);

  const trimmedKwhMonth = (selectedDevice.watt * jamKurang * 30) / 1000;
  const lowerKwhRange = trimmedKwhMonth * 0.7;
  const estimatedSavedRp = Math.round(trimmedKwhMonth * tarif);

  return (
    <AppShell>
      <div className="flex flex-col w-full max-w-full overflow-x-hidden gap-6 sm:gap-8">
        {/* 1. PAGE HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-primary-container uppercase tracking-wider">
                Perencanaan &amp; Kontrol
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container shrink-0" />
              <span className="text-xs text-on-surface-variant font-medium">
                Siklus Berjalan
              </span>
            </div>
            <h1 className="font-extrabold text-2xl sm:text-3xl lg:text-[36px] text-on-surface tracking-tight leading-tight">
              Target &amp; Simulasi Penghematan
            </h1>
            <p className="text-sm sm:text-base text-on-surface-variant max-w-3xl leading-relaxed">
              Atur target pengeluaran dan simulasikan cara mudah memangkas
              tagihan listrik rumah Anda tanpa kompromi kenyamanan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/70 shadow-2xs">
              <span className="material-symbols-outlined text-[18px] text-primary-container shrink-0">
                devices
              </span>
              <span className="text-xs sm:text-sm text-on-surface font-semibold whitespace-nowrap">
                {deviceOptions.length} Perangkat Terpasang
              </span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/70 shadow-2xs">
              <span className="material-symbols-outlined text-[18px] text-primary-container shrink-0">
                price_change
              </span>
              <span className="text-xs sm:text-sm text-on-surface font-semibold whitespace-nowrap">
                Tarif: Rp {tarif.toLocaleString("id-ID")} / kWh
              </span>
            </div>
          </div>
        </div>

        {/* 2. TARGET HEMAT BULAN INI (HERO SECTION) */}
        <section className="flex flex-col bg-surface-container-lowest border border-outline-variant/70 rounded-2xl shadow-2xs p-4 sm:p-6 lg:p-8 gap-5 sm:gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary-fixed flex items-center justify-center text-primary shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[24px] sm:text-[26px]">
                  savings
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <h2 className="font-bold text-lg sm:text-xl text-on-surface truncate">
                  Target Hemat Bulan Ini
                </h2>
                <span className="text-xs sm:text-sm text-on-surface-variant">
                  Periode aktif: Siklus tagihan berjalan
                </span>
              </div>
            </div>

            {!editingTarget ? (
              <button
                type="button"
                onClick={() => setEditingTarget(true)}
                className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/80 text-on-surface text-xs sm:text-sm font-semibold shadow-2xs hover:bg-surface-container transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[18px]">
                  tune
                </span>
                <span>Ubah Target</span>
              </button>
            ) : (
              <form
                onSubmit={handleSaveTarget}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto"
              >
                <div className="flex items-center gap-1.5 bg-surface-container border border-outline-variant/80 rounded-xl px-3 py-2">
                  <span className="text-xs font-bold text-on-surface-variant">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="5000"
                    step="500"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    className="w-full sm:w-28 bg-transparent text-sm font-bold text-on-surface focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="submit"
                    disabled={savingTarget}
                    className="flex-1 sm:flex-initial min-h-[40px] px-4 py-2 rounded-xl bg-primary-container text-on-primary text-xs sm:text-sm font-semibold cursor-pointer"
                  >
                    {savingTarget ? "..." : "Simpan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTarget(false)}
                    className="flex-1 sm:flex-initial min-h-[40px] px-3 py-2 rounded-xl bg-surface-container text-on-surface-variant text-xs sm:text-sm font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Info Banner Batas Target */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl bg-surface-container-low">
            <div className="flex flex-wrap items-center gap-2.5 min-w-0">
              <span className="px-2.5 py-1 rounded bg-primary-fixed text-primary text-xs font-bold tracking-wide shrink-0 whitespace-nowrap">
                Target Bulanan
              </span>
              <span className="text-xs sm:text-sm md:text-base text-on-surface font-medium">
                Batas anggaran pengeluaran listrik bulanan (maksimal Rp{" "}
                {targetRp.toLocaleString("id-ID")} /{" "}
                {targetMaxKwh.toFixed(1).replace(".", ",")} kWh)
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-on-surface-variant text-xs font-medium shrink-0">
              <span className="material-symbols-outlined text-[16px] text-primary-container">
                verified
              </span>
              <span>Status Berjalan</span>
            </div>
          </div>

          {/* 3 Metric Cards */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-28 rounded-xl bg-surface-container animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
              <div className="flex flex-col p-4 sm:p-5 rounded-xl bg-surface-container">
                <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold mb-1">
                  Realisasi Saat Ini
                </span>
                <div className="text-2xl sm:text-[28px] lg:text-[32px] font-extrabold text-on-surface tracking-tight">
                  Rp {currentCostRp.toLocaleString("id-ID")}
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs sm:text-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-[16px] text-primary-container shrink-0">
                    bolt
                  </span>
                  <span>
                    {currentKwh.toFixed(2).replace(".", ",")} kWh terukur
                  </span>
                </div>
              </div>

              <div className="flex flex-col p-4 sm:p-5 rounded-xl bg-surface-container">
                <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold mb-1">
                  Batas Target
                </span>
                <div className="text-2xl sm:text-[28px] lg:text-[32px] font-extrabold text-on-surface tracking-tight">
                  Rp {targetRp.toLocaleString("id-ID")}
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs sm:text-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-[16px] text-primary-container shrink-0">
                    flag
                  </span>
                  <span>
                    Maksimal {targetMaxKwh.toFixed(2).replace(".", ",")} kWh
                  </span>
                </div>
              </div>

              <div className="flex flex-col p-4 sm:p-5 rounded-xl bg-surface-container justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                    Persentase Kuota
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary text-xs font-semibold shrink-0">
                    Terpakai
                  </span>
                </div>
                <div className="text-2xl sm:text-[28px] lg:text-[32px] font-extrabold text-primary-container mt-1">
                  {quotaPct}%
                </div>
                <div className="text-xs sm:text-sm text-on-surface-variant mt-2">
                  Sisa {remainingKwh.toFixed(2).replace(".", ",")} kWh / Rp{" "}
                  {remainingRp.toLocaleString("id-ID")}
                </div>
              </div>
            </div>
          )}

          {/* Quota Progress Bar */}
          <div className="flex flex-col gap-2.5 pt-1">
            <div className="relative w-full h-4 sm:h-5 rounded-full bg-surface-container-high overflow-hidden shadow-inner">
              <div
                className="absolute left-0 top-0 bottom-0 bg-primary-container rounded-full transition-all duration-500 ease-out"
                style={{ width: `${quotaPct}%` }}
              />
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 text-on-surface-variant text-xs font-medium">
              <span>0 kWh (Rp 0)</span>
              <span className="px-2.5 py-1 rounded-md bg-primary-fixed text-primary font-bold">
                Posisi Realisasi: {currentKwh.toFixed(2).replace(".", ",")} kWh
                ({quotaPct}%) — Rp {currentCostRp.toLocaleString("id-ID")}
              </span>
              <span>
                Batas Target: {targetMaxKwh.toFixed(1).replace(".", ",")} kWh
                (Rp {targetRp.toLocaleString("id-ID")})
              </span>
            </div>
          </div>

          {/* Projection Alert Callout */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[#fef3c7] border border-[#fde68a] shadow-2xs">
            <span className="material-symbols-outlined text-[22px] text-secondary mt-0.5 shrink-0">
              {projectedOverRp > 0 ? "report_problem" : "check_circle"}
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full min-w-0">
              <p className="text-xs sm:text-sm text-on-secondary-fixed leading-relaxed">
                {projectedOverRp > 0 ? (
                  <>
                    <span className="font-bold">Perlu perhatian:</span>{" "}
                    perkiraan akhir bulan Rp{" "}
                    {projectedMonthRp.toLocaleString("id-ID")} (melebihi target
                    Rp {projectedOverRp.toLocaleString("id-ID")} jika pola
                    pemakaian tidak berubah).
                  </>
                ) : (
                  <>
                    <span className="font-bold">On-track aman:</span> perkiraan
                    akhir bulan Rp {projectedMonthRp.toLocaleString("id-ID")}{" "}
                    masih di bawah target anggaran Rp{" "}
                    {targetRp.toLocaleString("id-ID")}.
                  </>
                )}
              </p>
              <span className="self-start sm:self-center px-2.5 py-1 rounded bg-secondary-fixed text-on-secondary-fixed text-xs font-semibold shrink-0 whitespace-nowrap">
                Estimasi
              </span>
            </div>
          </div>
        </section>

        {/* 3. BOTTOM 2-COLUMN GRID: SIMULATOR (7 COLS) + 3 PRACTICAL TIPS (5 COLS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Simulasi Kurangi Jam Nyala (7 Cols) */}
          <section className="lg:col-span-7 flex flex-col bg-surface-container-lowest border border-outline-variant/70 rounded-2xl shadow-2xs p-4 sm:p-6 lg:p-8 gap-5 sm:gap-6 min-w-0">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-primary-fixed flex items-center justify-center text-primary shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[24px]">
                  schedule
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <h2 className="font-bold text-lg sm:text-xl text-on-surface">
                  Simulasi Kurangi Jam Nyala
                </h2>
                <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                  Hitung potensi penghematan biaya bulanan hanya dengan
                  memajukan jam mati perangkat.
                </p>
              </div>
            </div>

            {/* Responsive Custom Device Dropdown */}
            <div ref={dropdownRef} className="flex flex-col gap-2 relative">
              <label className="text-xs sm:text-sm text-on-surface font-semibold">
                Pilih Perangkat Terhubung
              </label>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={dropdownOpen}
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/80 text-on-surface text-xs sm:text-sm md:text-base flex items-center justify-between gap-3 hover:bg-surface-container-high/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="material-symbols-outlined text-[20px] text-primary-container shrink-0">
                    {selectedDevice.icon}
                  </span>
                  <span className="font-medium truncate">
                    {selectedDevice.nama} ({selectedDevice.watt} W) —{" "}
                    {selectedDevice.subLabel}
                  </span>
                </div>
                <span
                  className={`material-symbols-outlined text-on-surface-variant shrink-0 transition-transform duration-200 ${
                    dropdownOpen ? "rotate-180" : ""
                  }`}
                >
                  expand_more
                </span>
              </button>

              {dropdownOpen && (
                <ul
                  role="listbox"
                  className="absolute left-0 right-0 top-full mt-1.5 max-h-60 overflow-y-auto rounded-xl bg-surface-container-lowest border border-outline-variant/80 shadow-lg py-1.5 z-30"
                >
                  {deviceOptions.map((dev) => {
                    const isSelected = dev.id === selectedDevice.id;
                    return (
                      <li key={dev.id} role="option" aria-selected={isSelected}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDeviceId(dev.id);
                            setDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-2.5 text-left text-xs sm:text-sm flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-primary-fixed/60 text-primary font-bold"
                              : "text-on-surface hover:bg-surface-container font-medium"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="material-symbols-outlined text-[18px] text-primary-container shrink-0">
                              {dev.icon}
                            </span>
                            <span className="truncate">
                              {dev.nama} ({dev.watt} W) — {dev.subLabel}
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

            {/* Interactive Slider Box */}
            <div className="flex flex-col p-4 sm:p-5 rounded-xl bg-surface-container-low gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs sm:text-sm text-on-surface font-semibold">
                  Durasi Pengurangan
                </span>
                <span className="px-3 py-1 rounded-full bg-primary-container text-on-primary text-xs font-semibold shadow-2xs whitespace-nowrap">
                  Kurangi {jamKurang} jam per hari
                </span>
              </div>

              <div className="flex flex-col gap-3 py-1">
                <input
                  type="range"
                  min={0}
                  max={6}
                  step={1}
                  value={jamKurang}
                  onChange={(e) => setJamKurang(Number(e.target.value))}
                  aria-label="Durasi Pengurangan Jam per Hari"
                  className="w-full h-2.5 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="grid grid-cols-7 gap-1 text-center text-on-surface-variant text-[11px] sm:text-xs">
                  {[0, 1, 2, 3, 4, 5, 6].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setJamKurang(val)}
                      className={`py-1 rounded transition-colors cursor-pointer ${
                        jamKurang === val
                          ? "text-primary-container font-bold"
                          : "hover:text-primary-container"
                      }`}
                    >
                      {val} jam
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-start sm:items-center gap-2 p-3 rounded-lg bg-surface-container-lowest text-on-surface-variant text-xs sm:text-sm">
                <span className="material-symbols-outlined text-[18px] text-primary-container shrink-0 mt-0.5 sm:mt-0">
                  functions
                </span>
                <span className="leading-relaxed">
                  {selectedDevice.watt} W × {jamKurang} jam/hari × 30 hari ={" "}
                  <strong className="text-on-surface">
                    {trimmedKwhMonth.toFixed(2).replace(".", ",")} kWh
                  </strong>{" "}
                  terpangkas (Asumsi 30 hari)
                </span>
              </div>
            </div>

            {/* Result Output Box */}
            <div className="flex flex-col p-5 sm:p-6 rounded-2xl bg-primary-fixed shadow-2xs gap-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm text-primary font-semibold tracking-wide">
                  Perkiraan Hasil Hemat:
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-surface-container-lowest text-primary text-xs font-semibold shadow-2xs shrink-0">
                  Estimasi
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <div className="text-2xl sm:text-[32px] font-extrabold text-primary tracking-tight">
                  ± Rp {estimatedSavedRp.toLocaleString("id-ID")} / bulan
                </div>
                <div className="text-xs sm:text-sm md:text-base text-on-surface-variant font-medium">
                  {lowerKwhRange.toFixed(1).replace(".", ",")} kWh s.d.{" "}
                  {trimmedKwhMonth.toFixed(2).replace(".", ",")} kWh per bulan
                  terpangkas
                </div>
              </div>

              <Link
                href="/pengingat"
                className="inline-flex items-center justify-center gap-2 w-full min-h-[48px] px-4 rounded-xl bg-primary-container text-on-primary text-sm sm:text-base font-semibold shadow-2xs hover:opacity-95 transition-opacity"
              >
                <span>Terapkan Jadwal di Pengingat</span>
                <span className="material-symbols-outlined text-[20px] shrink-0">
                  arrow_forward
                </span>
              </Link>
            </div>
          </section>

          {/* RIGHT: 3 Langkah Hemat Praktis (5 Cols) */}
          <section className="lg:col-span-5 flex flex-col bg-surface-container-lowest border border-outline-variant/70 rounded-2xl shadow-2xs p-4 sm:p-6 lg:p-8 gap-5 sm:gap-6 min-w-0">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-primary-fixed flex items-center justify-center text-primary shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[24px]">
                  fact_check
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <h2 className="font-bold text-lg sm:text-xl text-on-surface">
                  3 Langkah Hemat Praktis
                </h2>
                <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                  Langkah sederhana tanpa mengorbankan kenyamanan keluarga
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3.5">
              {/* Step 1 */}
              <div className="flex items-start gap-3.5 sm:gap-4 p-4 rounded-xl bg-surface-container shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-on-primary shrink-0 shadow-2xs">
                  <span className="material-symbols-outlined text-[20px]">
                    power_settings_new
                  </span>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <h3 className="text-sm sm:text-base text-on-surface font-semibold leading-snug">
                    Matikan Teko Listrik / alat pemanas segera setelah selesai
                    dipakai
                  </h3>
                  <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                    Pemanas air terus mengonsumsi daya tinggi (500 W) jika
                    dibiarkan dalam posisi standby.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3.5 sm:gap-4 p-4 rounded-xl bg-surface-container shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-on-primary shrink-0 shadow-2xs">
                  <span className="material-symbols-outlined text-[20px]">
                    mode_fan
                  </span>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <h3 className="text-sm sm:text-base text-on-surface font-semibold leading-snug">
                    Kurangi jam nyala Kipas Angin saat udara kamar sudah sejuk
                  </h3>
                  <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                    Menonaktifkan kipas 1–2 jam menjelang pagi menghemat hingga
                    Rp 2.400 per bulan.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3.5 sm:gap-4 p-4 rounded-xl bg-surface-container shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-on-primary shrink-0 shadow-2xs">
                  <span className="material-symbols-outlined text-[20px]">
                    schedule
                  </span>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <h3 className="text-sm sm:text-base text-on-surface font-semibold leading-snug">
                    Hindari menyalakan alat berdaya besar bersamaan di jam
                    18.00–22.00 WIB
                  </h3>
                  <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                    Jam beban puncak malam hari lebih rentan menyebabkan MCB
                    trip saat perangkat aktif bersamaan.
                  </p>
                </div>
              </div>
            </div>

            {/* Banner Status Daya Rumah */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-primary-container to-primary text-on-primary flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="material-symbols-outlined text-[20px] shrink-0">
                  check_circle
                </span>
                <span className="text-xs sm:text-sm font-semibold truncate">
                  {deviceOptions.length} Perangkat Terpantau Terkendali
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-[11px] font-semibold shrink-0 whitespace-nowrap">
                Aman MCB
              </span>
            </div>

            <div className="flex items-start sm:items-center gap-2 pt-1 text-on-surface-variant text-xs sm:text-sm">
              <span className="material-symbols-outlined text-[18px] text-primary-container shrink-0 mt-0.5 sm:mt-0">
                info
              </span>
              <span>
                Hasil penghematan nyata terlihat setelah data pemakaian hari
                berikutnya masuk.
              </span>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
