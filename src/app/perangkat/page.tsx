// src/app/perangkat/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase";

interface DeviceRow {
  id: string;
  nama: string;
  jenis_beban?: string | null;
  lokasi?: string | null;
  daya_nominal_w?: number | null;
  last_seen_at?: string | null;
  created_at?: string;
}

interface ReadingRow {
  device_id: string;
  ts: string;
  v?: number | null;
  i?: number | null;
  p: number;
  e_wh: number;
}

const JENIS_OPTIONS = [
  "Kipas Angin",
  "Lampu Meja",
  "Teko Listrik",
  "Lainnya (≤ 600 W)",
];

const OFFLINE_THRESHOLD_MS = 120_000;

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getDeviceIcon(nama: string, jenis?: string | null): string {
  const text = `${nama} ${jenis || ""}`.toLowerCase();
  if (text.includes("kipas") || text.includes("ac") || text.includes("fan")) {
    return "mode_fan";
  }
  if (text.includes("lampu") || text.includes("lamp")) {
    return "desk";
  }
  if (
    text.includes("teko") ||
    text.includes("kopi") ||
    text.includes("dispenser") ||
    text.includes("pemanas")
  ) {
    return "coffee_maker";
  }
  if (text.includes("kulkas") || text.includes("fridge")) {
    return "kitchen";
  }
  if (text.includes("tv") || text.includes("komputer")) {
    return "tv";
  }
  return "power";
}

export default function PerangkatPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Mode layar: "list" (Daftar Perangkat) atau "wizard" (Tambah Perangkat & Uji Koneksi)
  const [viewMode, setViewMode] = useState<"list" | "wizard">("list");

  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [todayReadings, setTodayReadings] = useState<ReadingRow[]>([]);
  const [tarif, setTarif] = useState<number>(1444.7);
  const [loading, setLoading] = useState<boolean>(true);

  // State Edit Perangkat inline
  const [editingDevice, setEditingDevice] = useState<DeviceRow | null>(null);
  const [editNama, setEditNama] = useState<string>("");
  const [editLokasi, setEditLokasi] = useState<string>("");
  const [editNominal, setEditNominal] = useState<string>("50");
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // State Wizard Step 1
  const [nama, setNama] = useState<string>("");
  const [jenisBeban, setJenisBeban] = useState<string>("Kipas Angin");
  const [jenisDropdownOpen, setJenisDropdownOpen] = useState<boolean>(false);
  const jenisDropdownRef = useRef<HTMLDivElement | null>(null);
  const [lokasi, setLokasi] = useState<string>("");
  const [dayaNominal, setDayaNominal] = useState<string>("50");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // State Wizard Step 2 (Kredensial)
  const [generatedCreds, setGeneratedCreds] = useState<{
    id: string;
    key: string;
    nama: string;
  } | null>(null);
  const [showSecretKey, setShowSecretKey] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<"id" | "key" | null>(null);

  // State Wizard Step 3 (Uji Koneksi Real-Time)
  const [testState, setTestState] = useState<
    "idle" | "waiting" | "success" | "timeout"
  >("idle");
  const [firstPacket, setFirstPacket] = useState<{
    v: number;
    i: number;
    p: number;
  } | null>(null);
  const testStartRef = useRef<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        jenisDropdownRef.current &&
        !jenisDropdownRef.current.contains(event.target as Node)
      ) {
        setJenisDropdownOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setJenisDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const loadDevices = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [{ data: profile }, { data: devsData }, { data: readsData }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("tarif_per_kwh")
          .eq("id", user.id)
          .single(),
        supabase
          .from("devices")
          .select(
            "id, nama, jenis_beban, lokasi, daya_nominal_w, last_seen_at, created_at",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("readings")
          .select("device_id, ts, v, i, p, e_wh")
          .gte("ts", startOfToday.toISOString())
          .order("ts", { ascending: true })
          .limit(1000),
      ]);

    if (profile?.tarif_per_kwh) {
      setTarif(Number(profile.tarif_per_kwh));
    }
    setDevices((devsData as DeviceRow[]) || []);
    setTodayReadings((readsData as ReadingRow[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 10000);
    return () => clearInterval(interval);
  }, [loadDevices]);

  // Polling Uji Koneksi Step 3 ketika status "waiting"
  useEffect(() => {
    if (testState !== "waiting" || !generatedCreds?.id) return;

    if (!testStartRef.current) {
      testStartRef.current = Date.now();
    }

    const checkConnection = async () => {
      const elapsed = Date.now() - (testStartRef.current || Date.now());
      if (elapsed > 120_000) {
        setTestState("timeout");
        return;
      }

      const { data: latestRead } = await supabase
        .from("readings")
        .select("v, i, p, ts")
        .eq("device_id", generatedCreds.id)
        .order("ts", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestRead) {
        setFirstPacket({
          v: Number(latestRead.v ?? 220),
          i: Number(latestRead.i ?? 0),
          p: Number(latestRead.p ?? 0),
        });
        setTestState("success");
        loadDevices();
      }
    };

    checkConnection();
    const poll = setInterval(checkConnection, 3000);
    return () => clearInterval(poll);
  }, [testState, generatedCreds, supabase, loadDevices]);

  const handleOpenWizard = () => {
    setErrorMsg("");
    setNama("");
    setJenisBeban("Kipas Angin");
    setLokasi("");
    setDayaNominal("50");
    setGeneratedCreds(null);
    setShowSecretKey(false);
    setTestState("idle");
    setFirstPacket(null);
    testStartRef.current = null;
    setViewMode("wizard");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackToList = () => {
    setViewMode("list");
    setErrorMsg("");
    loadDevices();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCreateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const nominalNum = Number(dayaNominal);
    if (!nama.trim()) {
      setErrorMsg("Nama perangkat wajib diisi.");
      return;
    }
    if (Number.isNaN(nominalNum) || nominalNum < 1 || nominalNum > 600) {
      setErrorMsg("Daya listrik perangkat harus antara 1 W hingga 600 W.");
      return;
    }

    setSubmitting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErrorMsg("Sesi login tidak ditemukan. Silakan masuk kembali.");
      setSubmitting(false);
      router.push("/masuk");
      return;
    }

    await supabase.from("profiles").upsert(
      {
        id: user.id,
        nama:
          user.user_metadata?.nama ||
          user.user_metadata?.full_name ||
          "Pengguna",
      },
      { onConflict: "id", ignoreDuplicates: true },
    );

    const rawApiKey = "stl_" + crypto.randomUUID().replace(/-/g, "");
    const keyHash = await sha256Hex(rawApiKey);

    const payloadWithLokasi: Record<string, unknown> = {
      user_id: user.id,
      nama: nama.trim(),
      jenis_beban: jenisBeban,
      lokasi: lokasi.trim() || null,
      daya_nominal_w: nominalNum,
      ingest_key_hash: keyHash,
    };

    let insertRes = await supabase
      .from("devices")
      .insert(payloadWithLokasi)
      .select()
      .single();

    // Fallback apabila kolom 'lokasi' belum ada di skema tabel devices
    if (
      insertRes.error &&
      insertRes.error.message.toLowerCase().includes("lokasi")
    ) {
      const { lokasi: _omit, ...fallbackPayload } = payloadWithLokasi;
      insertRes = await supabase
        .from("devices")
        .insert(fallbackPayload)
        .select()
        .single();
    }

    setSubmitting(false);

    if (insertRes.error || !insertRes.data) {
      setErrorMsg(
        "Gagal membuat kode alat: " +
          (insertRes.error?.message || "Terjadi kesalahan"),
      );
      return;
    }

    setGeneratedCreds({
      id: insertRes.data.id,
      key: rawApiKey,
      nama: insertRes.data.nama,
    });
    testStartRef.current = Date.now();
    setTestState("waiting");
    loadDevices();
  };

  const handleCopy = (field: "id" | "key", value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleStartTestNow = () => {
    if (!generatedCreds) return;
    setFirstPacket(null);
    testStartRef.current = Date.now();
    setTestState("waiting");
  };

  const handleDelete = async (dev: DeviceRow) => {
    if (
      !confirm(
        `Hapus perangkat "${dev.nama}" beserta seluruh riwayat bacaan sensornya?`,
      )
    ) {
      return;
    }
    await supabase.from("devices").delete().eq("id", dev.id);
    loadDevices();
  };

  const openEditModal = (dev: DeviceRow) => {
    setEditingDevice(dev);
    setEditNama(dev.nama);
    setEditLokasi(dev.lokasi || "");
    setEditNominal(String(dev.daya_nominal_w || 50));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice || !editNama.trim()) return;
    setSavingEdit(true);

    const nominal = Math.min(600, Math.max(1, Number(editNominal) || 50));
    const updatePayload: Record<string, unknown> = {
      nama: editNama.trim(),
      lokasi: editLokasi.trim() || null,
      daya_nominal_w: nominal,
    };

    const res = await supabase
      .from("devices")
      .update(updatePayload)
      .eq("id", editingDevice.id);

    if (res.error && res.error.message.toLowerCase().includes("lokasi")) {
      await supabase
        .from("devices")
        .update({ nama: editNama.trim(), daya_nominal_w: nominal })
        .eq("id", editingDevice.id);
    }

    setSavingEdit(false);
    setEditingDevice(null);
    loadDevices();
  };

  // Enrich setiap perangkat dengan telemetri terbaru hari ini
  const enrichedDevices = useMemo(() => {
    const now = Date.now();
    return devices.map((dev) => {
      const isOnline =
        !!dev.last_seen_at &&
        now - new Date(dev.last_seen_at).getTime() <= OFFLINE_THRESHOLD_MS;

      const dReads = todayReadings.filter((r) => r.device_id === dev.id);
      const latest = dReads.length > 0 ? dReads[dReads.length - 1] : null;

      const activeWatt = isOnline && latest ? Math.round(Number(latest.p)) : 0;
      const voltage =
        isOnline && latest && latest.v != null
          ? Math.round(Number(latest.v))
          : 220;
      const currentAmp =
        isOnline && latest && latest.i != null
          ? Number(latest.i)
          : activeWatt > 0
            ? Number((activeWatt / voltage).toFixed(2))
            : 0;

      const todayKwh =
        dReads.length > 1
          ? Math.max(
              0,
              Number(dReads[dReads.length - 1].e_wh) - Number(dReads[0].e_wh),
            ) / 1000
          : dReads.length === 1
            ? Math.max(0, Number(dReads[0].p) / 1000)
            : 0;

      const estCostPerHourRp = Math.round((activeWatt / 1000) * tarif);

      return {
        ...dev,
        isOnline,
        activeWatt,
        voltage,
        currentAmp,
        todayKwh,
        estCostPerHourRp,
        icon: getDeviceIcon(dev.nama, dev.jenis_beban),
      };
    });
  }, [devices, todayReadings, tarif]);

  const totalActiveWatt = enrichedDevices.reduce(
    (sum, d) => sum + d.activeWatt,
    0,
  );
  const onlineCount = enrichedDevices.filter((d) => d.isOnline).length;

  // Stepper aktif di mode wizard
  const currentStep =
    testState === "success" || testState === "timeout"
      ? 3
      : generatedCreds
        ? 2
        : 1;

  return (
    <AppShell>
      {viewMode === "list" ? (
        /* =========================================================
           VIEW 1: DAFTAR PERANGKAT & ALAT IoT
        ========================================================= */
        <div className="flex flex-col w-full max-w-full overflow-x-hidden gap-5 sm:gap-7">
          {/* Header Section */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="flex flex-col gap-1.5 max-w-2xl min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary-container text-xs tracking-wider uppercase font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-container shrink-0" />
                  MANAJEMEN ALAT &amp; HARDWARE • {devices.length} Modul
                  Terpasang
                </span>
              </div>
              <h1 className="font-extrabold text-2xl sm:text-3xl lg:text-[34px] text-on-surface tracking-tight leading-tight">
                Perangkat &amp; Alat IoT
              </h1>
              <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed">
                1 modul PZEM-004T (10A) memantau 1 perangkat • Batas aman beban
                uji ≤ 600 W
              </p>

              {/* Supplementary Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-container-low border border-outline-variant/60 text-on-surface text-xs font-medium shadow-2xs">
                  <span className="material-symbols-outlined text-[16px] text-primary-container shrink-0">
                    payments
                  </span>
                  <span>
                    Tarif:{" "}
                    <strong className="text-on-surface">
                      Rp {tarif.toLocaleString("id-ID")} / kWh
                    </strong>
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-container-low border border-outline-variant/60 text-on-surface text-xs font-medium shadow-2xs">
                  <span className="material-symbols-outlined text-[16px] text-primary-container shrink-0">
                    power
                  </span>
                  <span>
                    Kapasitas Terpakai:{" "}
                    <strong className="text-on-surface">
                      {devices.length} Colokan Terdaftar
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Right CTA Button */}
            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={handleOpenWizard}
                className="w-full sm:w-auto min-h-[48px] px-5 rounded-xl bg-primary-container text-on-primary text-sm font-semibold flex items-center justify-center gap-2 shadow-2xs hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[20px]">
                  add
                </span>
                <span>Tambah Perangkat</span>
              </button>
            </div>
          </div>

          {/* Hardware Overview Card */}
          <div className="w-full bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3 max-w-3xl min-w-0">
              <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary-container shrink-0">
                <span className="material-symbols-outlined text-[24px]">
                  memory
                </span>
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <h2 className="font-bold text-base sm:text-lg text-on-surface">
                  Arsitektur Pemantauan Realtime
                </h2>
                <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                  Modul Sensor PZEM-004T terhubung ke Wi-Fi rumah (2.4 GHz).
                  Pembaruan data tegangan (V), arus (A), daya (W), dan energi
                  (kWh) dikirim secara realtime setiap 5 detik.
                </p>
              </div>
            </div>

            {/* Chips / Specifications */}
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex lg:flex-nowrap items-center gap-2 shrink-0">
              <div className="flex flex-col px-3 py-1.5 bg-surface-container-low rounded-lg">
                <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
                  Protokol
                </span>
                <span className="text-xs text-on-surface font-semibold whitespace-nowrap">
                  ESP32 / PZEM-004T
                </span>
              </div>
              <div className="flex flex-col px-3 py-1.5 bg-surface-container-low rounded-lg">
                <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
                  Tegangan Acuan
                </span>
                <span className="text-xs text-on-surface font-semibold whitespace-nowrap">
                  220V AC
                </span>
              </div>
              <div className="flex flex-col px-3 py-1.5 bg-surface-container-low rounded-lg">
                <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
                  Status Jaringan
                </span>
                <span className="text-xs text-primary-container font-semibold flex items-center gap-1 whitespace-nowrap">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      onlineCount > 0
                        ? "bg-primary-container"
                        : "bg-on-surface-variant"
                    }`}
                  />
                  {onlineCount > 0
                    ? `Wi-Fi Terkoneksi (${onlineCount}/${devices.length})`
                    : "Menunggu Sinyal Alat"}
                </span>
              </div>
            </div>
          </div>

          {/* Device Cards Section */}
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                Daftar Perangkat Aktif
              </span>
              <span className="text-xs sm:text-sm text-on-surface-variant">
                Total Beban Kumulatif:{" "}
                <strong className="text-on-surface">{totalActiveWatt} W</strong>
              </span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((n) => (
                  <div
                    key={n}
                    className="h-32 rounded-xl bg-surface-container-lowest border border-outline-variant/60 animate-pulse"
                  />
                ))}
              </div>
            ) : enrichedDevices.length === 0 ? (
              /* Empty State Box */
              <div className="w-full bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-6 sm:p-10 flex flex-col items-center justify-center text-center shadow-2xs">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-surface-container flex items-center justify-center text-primary-container mb-4">
                  <span className="material-symbols-outlined text-[36px] sm:text-[40px]">
                    electrical_services
                  </span>
                </div>
                <h3 className="font-bold text-lg sm:text-xl text-on-surface tracking-tight mb-2">
                  Belum ada perangkat terpasang
                </h3>
                <p className="text-xs sm:text-sm md:text-base text-on-surface-variant max-w-lg mb-6 leading-relaxed">
                  Tambahkan perangkat pertama untuk menghubungkan modul IoT Anda
                  dan mulai memantau daya listrik secara akurat.
                </p>
                <button
                  type="button"
                  onClick={handleOpenWizard}
                  className="min-h-[48px] px-6 rounded-xl bg-primary-container text-on-primary text-sm font-semibold flex items-center justify-center gap-2 shadow-2xs hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    add
                  </span>
                  <span>Tambah Perangkat Pertama</span>
                </button>
                <div className="flex items-center gap-1.5 mt-5 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[16px] shrink-0">
                    info
                  </span>
                  <span className="text-xs">
                    Mendukung sensor PZEM-004T (10A) dengan koneksi Wi-Fi 2.4
                    GHz.
                  </span>
                </div>
              </div>
            ) : (
              enrichedDevices.map((dev, index) => {
                const isStandby = dev.isOnline && dev.activeWatt === 0;
                return (
                  <div
                    key={dev.id}
                    className="w-full bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-4 transition-all hover:shadow-sm"
                  >
                    {/* Left: Icon + Title + Status */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          dev.isOnline && !isStandby
                            ? "bg-primary-container/10 text-primary-container"
                            : "bg-surface-container-high text-on-surface-variant"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[26px]">
                          {dev.icon}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="font-bold text-lg sm:text-xl text-on-surface tracking-tight truncate">
                            {dev.nama}
                          </h2>
                          {dev.isOnline ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary-container text-xs font-semibold whitespace-nowrap shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary-container" />
                              Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-error-container text-error text-xs font-semibold whitespace-nowrap shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-error" />
                              Offline
                            </span>
                          )}
                        </div>
                        <span className="text-xs sm:text-sm text-on-surface-variant">
                          Alat {index + 1} ({dev.jenis_beban || "Beban Terukur"}{" "}
                          • Nominal {dev.daya_nominal_w || 50} W)
                          {dev.lokasi ? ` • Lokasi: ${dev.lokasi}` : ""}
                        </span>
                      </div>
                    </div>

                    {/* Center: 4 Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-2.5 px-3.5 bg-surface-container-low rounded-xl xl:max-w-2xl w-full">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs text-on-surface-variant font-medium">
                          Daya Aktif
                        </span>
                        <span className="font-bold text-base sm:text-lg text-on-surface">
                          {dev.activeWatt} W
                        </span>
                        <span className="text-[11px] text-on-surface-variant">
                          {!dev.isOnline
                            ? "Tidak aktif"
                            : isStandby
                              ? "Standby"
                              : "Terukur"}
                        </span>
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="text-xs text-on-surface-variant font-medium">
                          Estimasi Biaya
                        </span>
                        <span className="font-bold text-base sm:text-lg text-on-surface">
                          {dev.estCostPerHourRp > 0
                            ? `± Rp ${dev.estCostPerHourRp.toLocaleString("id-ID")}`
                            : "Rp 0"}
                        </span>
                        <span className="text-[11px] text-on-surface-variant">
                          {dev.estCostPerHourRp > 0
                            ? "per jam operasi"
                            : "Mode Siaga"}
                        </span>
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="text-xs text-on-surface-variant font-medium">
                          Tegangan &amp; Arus
                        </span>
                        <span className="font-bold text-base sm:text-lg text-on-surface">
                          {dev.isOnline ? `${dev.voltage} V` : "-- V"}
                        </span>
                        <span className="text-[11px] text-on-surface-variant">
                          {dev.isOnline
                            ? `${dev.currentAmp.toFixed(2).replace(".", ",")} Ampere`
                            : "Menunggu data"}
                        </span>
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="text-xs text-on-surface-variant font-medium">
                          Konsumsi Hari Ini
                        </span>
                        <span className="font-bold text-base sm:text-lg text-primary-container">
                          {dev.todayKwh.toFixed(2).replace(".", ",")} kWh
                        </span>
                        <span className="text-[11px] text-on-surface-variant truncate">
                          Siklus 24 jam
                        </span>
                      </div>
                    </div>

                    {/* Right: Actions & Status Indicator Switch */}
                    <div className="flex items-center justify-end gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditModal(dev)}
                        title="Ubah Pengaturan Perangkat"
                        className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          tune
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(dev)}
                        title="Hapus Perangkat"
                        className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/50 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          delete_outline
                        </span>
                      </button>

                      {/* Read-only Sensor Active State Indicator */}
                      <div
                        title={
                          dev.isOnline && !isStandby
                            ? "Beban sedang menyala"
                            : "Beban siaga / offline"
                        }
                        className={`w-14 h-8 rounded-full p-1 flex items-center transition-all ${
                          dev.isOnline && !isStandby
                            ? "bg-primary-container justify-end"
                            : "bg-surface-container-high justify-start"
                        }`}
                      >
                        <span className="w-6 h-6 rounded-full bg-surface-container-lowest shadow-2xs" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Modal Edit Perangkat */}
          {editingDevice && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
              <form
                onSubmit={handleSaveEdit}
                className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col gap-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-on-surface">
                    Ubah Pengaturan Perangkat
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingDevice(null)}
                    className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      close
                    </span>
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface">
                    Nama Perangkat
                  </label>
                  <input
                    type="text"
                    required
                    value={editNama}
                    onChange={(e) => setEditNama(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/80 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface">
                    Lokasi Ruangan
                  </label>
                  <input
                    type="text"
                    value={editLokasi}
                    onChange={(e) => setEditLokasi(e.target.value)}
                    placeholder="Misal: Kamar Tidur Utama"
                    className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/80 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface">
                    Daya Nominal (Watt, maks 600 W)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="600"
                    required
                    value={editNominal}
                    onChange={(e) => setEditNominal(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/80 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingDevice(null)}
                    className="min-h-[42px] px-4 rounded-xl bg-surface-container text-on-surface-variant text-xs sm:text-sm font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="min-h-[42px] px-5 rounded-xl bg-primary-container text-on-primary text-xs sm:text-sm font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {savingEdit ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      ) : (
        /* =========================================================
           VIEW 2: WIZARD TAMBAH PERANGKAT & UJI KONEKSI (3 LANGKAH)
        ========================================================= */
        <div className="flex flex-col w-full max-w-[1240px] mx-auto overflow-x-hidden gap-5 sm:gap-7">
          {/* Top Navigation / Breadcrumb */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-on-surface-variant text-xs uppercase tracking-wider font-semibold">
                <span>Manajemen Alat &amp; Hardware</span>
                <span className="text-outline-variant">•</span>
                <span className="text-primary-container font-bold">
                  Wizard Instalasi
                </span>
              </div>
              <h1 className="font-extrabold text-2xl sm:text-3xl lg:text-[34px] text-on-surface tracking-tight leading-tight">
                Tambah Perangkat &amp; Uji Koneksi
              </h1>
              <p className="text-sm sm:text-base text-on-surface-variant max-w-2xl leading-relaxed">
                Panduan 3 langkah mudah menghubungkan modul IoT (ESP32 &amp;
                PZEM-004T) ke sistem pemantauan listrik rumah.
              </p>
            </div>

            <button
              type="button"
              onClick={handleBackToList}
              className="w-full md:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/80 text-on-surface text-xs sm:text-sm font-semibold shadow-2xs hover:bg-surface-container-high transition-colors shrink-0 cursor-pointer whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[20px]">
                arrow_back
              </span>
              <span>Kembali ke Daftar Perangkat</span>
            </button>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-xl bg-error-container border border-error/30 text-error text-xs sm:text-sm font-medium flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[20px] shrink-0">
                error
              </span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Stepper Tracker */}
          <div className="w-full bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 sm:p-5 shadow-2xs">
            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-0">
              {/* Background Connecting Line for Desktop */}
              <div className="hidden md:block absolute left-12 right-12 top-1/2 -translate-y-1/2 h-1 bg-surface-container-high z-0">
                <div
                  className="h-full bg-primary-container transition-all duration-500"
                  style={{
                    width:
                      currentStep === 1
                        ? "15%"
                        : currentStep === 2
                          ? "65%"
                          : "100%",
                  }}
                />
              </div>

              {/* Step 1 Indicator */}
              <div className="relative z-10 flex items-center gap-3 bg-surface-container-lowest md:pr-4">
                <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-base shadow-2xs shrink-0">
                  1
                </div>
                <div className="flex flex-col">
                  <span className="text-xs sm:text-sm text-on-surface font-bold">
                    Isi Data Perangkat
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    Spesifikasi &amp; lokasi
                  </span>
                </div>
              </div>

              {/* Step 2 Indicator */}
              <div className="relative z-10 flex items-center gap-3 bg-surface-container-lowest md:px-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-base shrink-0 ${
                    currentStep >= 2
                      ? "bg-primary-container text-on-primary shadow-2xs"
                      : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  2
                </div>
                <div className="flex flex-col">
                  <span className="text-xs sm:text-sm text-on-surface font-bold">
                    Pasang Kode IoT
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    Kunci &amp; sketch ESP32
                  </span>
                </div>
              </div>

              {/* Step 3 Indicator */}
              <div className="relative z-10 flex items-center gap-3 bg-surface-container-lowest md:pl-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-base shrink-0 ${
                    currentStep >= 3
                      ? "bg-primary-container text-on-primary shadow-2xs"
                      : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  3
                </div>
                <div className="flex flex-col">
                  <span className="text-xs sm:text-sm text-on-surface font-bold">
                    Hasil Uji Koneksi
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    Validasi sinyal &amp; daya
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Wizard Grid Layout (7 Cols Left + 5 Cols Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-7 items-start">
            {/* LEFT COLUMN: Step 1 & Step 2 */}
            <div className="lg:col-span-7 flex flex-col gap-5 sm:gap-7 min-w-0">
              {/* STEP 1 CARD */}
              <section className="bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 sm:p-6 lg:p-7 shadow-2xs flex flex-col gap-4 sm:gap-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary-container text-xs font-bold shrink-0 whitespace-nowrap">
                      Langkah 1
                    </span>
                    <h2 className="font-bold text-base sm:text-lg text-on-surface truncate">
                      Identifikasi Perangkat Baru
                    </h2>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant text-[22px] shrink-0">
                    tune
                  </span>
                </div>

                <form
                  onSubmit={handleCreateCredentials}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5"
                >
                  {/* Nama Perangkat */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label
                      htmlFor="device_name"
                      className="text-xs sm:text-sm text-on-surface font-semibold"
                    >
                      Nama Perangkat
                    </label>
                    <input
                      id="device_name"
                      type="text"
                      required
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      placeholder="Contoh: Kipas Angin Kamar"
                      className="w-full h-12 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/80 text-on-surface text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
                    />
                  </div>

                  {/* Jenis Perangkat (Custom Responsive Dropdown) */}
                  <div
                    ref={jenisDropdownRef}
                    className="flex flex-col gap-1.5 relative"
                  >
                    <label className="text-xs sm:text-sm text-on-surface font-semibold">
                      Jenis Perangkat
                    </label>
                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={jenisDropdownOpen}
                      onClick={() => setJenisDropdownOpen((prev) => !prev)}
                      className="w-full h-12 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/80 text-on-surface text-sm sm:text-base flex items-center justify-between gap-2 hover:bg-surface-container transition-colors cursor-pointer"
                    >
                      <span className="truncate">{jenisBeban}</span>
                      <span
                        className={`material-symbols-outlined text-on-surface-variant text-[20px] shrink-0 transition-transform duration-200 ${
                          jenisDropdownOpen ? "rotate-180" : ""
                        }`}
                      >
                        expand_more
                      </span>
                    </button>

                    {jenisDropdownOpen && (
                      <ul
                        role="listbox"
                        className="absolute left-0 right-0 top-full mt-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/80 shadow-lg py-1.5 z-30"
                      >
                        {JENIS_OPTIONS.map((opt) => {
                          const isSelected = opt === jenisBeban;
                          return (
                            <li
                              key={opt}
                              role="option"
                              aria-selected={isSelected}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setJenisBeban(opt);
                                  setJenisDropdownOpen(false);
                                }}
                                className={`w-full px-3.5 py-2.5 text-left text-xs sm:text-sm flex items-center justify-between gap-2 cursor-pointer ${
                                  isSelected
                                    ? "bg-primary-fixed/60 text-primary font-bold"
                                    : "text-on-surface hover:bg-surface-container font-medium"
                                }`}
                              >
                                <span className="truncate">{opt}</span>
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

                  {/* Lokasi Ruangan */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="device_room"
                      className="text-xs sm:text-sm text-on-surface font-semibold"
                    >
                      Lokasi Ruangan
                    </label>
                    <input
                      id="device_room"
                      type="text"
                      value={lokasi}
                      onChange={(e) => setLokasi(e.target.value)}
                      placeholder="Contoh: Kamar Tidur Utama"
                      className="w-full h-12 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/80 text-on-surface text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
                    />
                  </div>

                  {/* Daya Listrik (Watt) */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <label
                        htmlFor="device_wattage"
                        className="text-xs sm:text-sm text-on-surface font-semibold"
                      >
                        Daya Listrik Perangkat (Watt)
                      </label>
                      <span className="text-xs text-on-surface-variant">
                        Beban Resistif/Induktif
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        id="device_wattage"
                        type="number"
                        required
                        min={1}
                        max={600}
                        value={dayaNominal}
                        onChange={(e) => setDayaNominal(e.target.value)}
                        className="w-full h-12 px-3.5 pr-16 rounded-xl bg-surface-container-low border border-outline-variant/80 text-on-surface text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-on-surface-variant font-bold">
                        Watt
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5 mt-1 text-on-surface-variant">
                      <span className="material-symbols-outlined text-[18px] text-primary-container shrink-0 mt-0.5">
                        info
                      </span>
                      <p className="text-xs sm:text-sm leading-relaxed">
                        Maksimal 600 W untuk pengujian aman beban uji pada
                        stopkontak sensor rumah tangga.
                      </p>
                    </div>
                  </div>

                  {/* Action Button Step 1 */}
                  <div className="md:col-span-2 pt-1">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 h-12 rounded-xl bg-primary-container text-on-primary text-sm font-semibold shadow-2xs hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
                    >
                      <span>
                        {submitting ? "Membuat Kode Alat..." : "Buat Kode Alat"}
                      </span>
                      <span className="material-symbols-outlined text-[20px]">
                        arrow_forward
                      </span>
                    </button>
                  </div>
                </form>
              </section>

              {/* STEP 2 CARD */}
              <section className="bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 sm:p-6 lg:p-7 shadow-2xs flex flex-col gap-4 sm:gap-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary-container text-xs font-bold shrink-0 whitespace-nowrap">
                      Langkah 2
                    </span>
                    <h2 className="font-bold text-base sm:text-lg text-on-surface truncate">
                      Pasang Kredensial ke Program ESP32
                    </h2>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant text-[22px] shrink-0">
                    terminal
                  </span>
                </div>

                <p className="text-xs sm:text-sm md:text-base text-on-surface-variant leading-relaxed">
                  Masukkan pasangan parameter berikut ke berkas kode konfigurasi
                  sketch Arduino/ESP32 Anda:
                </p>

                {/* Credentials Fields */}
                <div className="flex flex-col gap-3.5">
                  {/* Device ID */}
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                      ID Perangkat (device_id)
                    </span>
                    <div className="flex items-center rounded-xl bg-surface-container-low border border-outline-variant/70 p-1.5 gap-2">
                      <input
                        readOnly
                        type="text"
                        value={
                          generatedCreds
                            ? generatedCreds.id
                            : "Isi Langkah 1 untuk menghasilkan ID..."
                        }
                        className="bg-transparent flex-1 min-w-0 px-2.5 text-xs sm:text-sm md:text-base text-on-surface font-mono tracking-wide focus:outline-none select-all"
                      />
                      <button
                        type="button"
                        disabled={!generatedCreds}
                        onClick={() =>
                          generatedCreds && handleCopy("id", generatedCreds.id)
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 h-10 rounded-lg bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-xs sm:text-sm font-semibold hover:bg-surface-container-high shadow-2xs transition-all cursor-pointer disabled:opacity-40 shrink-0 whitespace-nowrap"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {copiedField === "id" ? "check" : "content_copy"}
                        </span>
                        <span>
                          {copiedField === "id" ? "Tersalin" : "Salin"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Secret Key */}
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                      Kunci Alat (Device Secret Key)
                    </span>
                    <div className="flex items-center rounded-xl bg-surface-container-low border border-outline-variant/70 p-1.5 gap-1.5">
                      <input
                        readOnly
                        type={
                          generatedCreds && !showSecretKey ? "password" : "text"
                        }
                        value={
                          generatedCreds
                            ? generatedCreds.key
                            : "Isi Langkah 1 untuk menghasilkan Kunci..."
                        }
                        className="bg-transparent flex-1 min-w-0 px-2.5 text-xs sm:text-sm md:text-base text-on-surface font-mono tracking-wide focus:outline-none select-all"
                      />
                      {generatedCreds && (
                        <button
                          type="button"
                          onClick={() => setShowSecretKey((prev) => !prev)}
                          title="Tampilkan / Sembunyikan Kunci"
                          className="p-2 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer shrink-0"
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            {showSecretKey ? "visibility_off" : "visibility"}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!generatedCreds}
                        onClick={() =>
                          generatedCreds &&
                          handleCopy("key", generatedCreds.key)
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 h-10 rounded-lg bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-xs sm:text-sm font-semibold hover:bg-surface-container-high shadow-2xs transition-all cursor-pointer disabled:opacity-40 shrink-0 whitespace-nowrap"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {copiedField === "key" ? "check" : "content_copy"}
                        </span>
                        <span>
                          {copiedField === "key" ? "Tersalin" : "Salin"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Warning Callout Soft Amber */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E]">
                  <span className="material-symbols-outlined text-[22px] text-[#92400E] shrink-0 mt-0.5">
                    warning
                  </span>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs sm:text-sm font-bold">
                      Peringatan Keamanan Kunci
                    </span>
                    <p className="text-xs sm:text-sm leading-relaxed">
                      Kunci ini hanya ditampilkan satu kali. Salin dan masukkan
                      ke program ESP32 sebelum menutup halaman ini demi
                      melindungi integritas data meter Anda.
                    </p>
                  </div>
                </div>

                {/* Action Button Step 2 */}
                <div className="pt-1">
                  <button
                    type="button"
                    disabled={!generatedCreds}
                    onClick={handleStartTestNow}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 h-12 rounded-xl bg-primary-container text-on-primary text-sm font-semibold shadow-2xs hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-40"
                  >
                    <span>Uji Koneksi Sekarang</span>
                    <span className="material-symbols-outlined text-[20px]">
                      bolt
                    </span>
                  </button>
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN: Step 3 (Real-time Connection Testing) */}
            <div className="lg:col-span-5 flex flex-col gap-5 sm:gap-7 min-w-0">
              {/* STEP 3 CARD */}
              <section className="bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 sm:p-6 lg:p-7 shadow-2xs flex flex-col gap-4 sm:gap-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary-container text-xs font-bold shrink-0 whitespace-nowrap">
                      Langkah 3
                    </span>
                    <h2 className="font-bold text-base sm:text-lg text-on-surface truncate">
                      Hasil Uji Koneksi
                    </h2>
                  </div>
                  <span className="material-symbols-outlined text-primary-container text-[22px] shrink-0">
                    sensors
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                  Status &amp; validasi sinyal data real-time dari modul ESP32
                  &amp; sensor PZEM-004T:
                </p>

                {testState === "idle" && (
                  <div className="flex flex-col gap-2 p-4 sm:p-5 rounded-xl bg-surface-container-low border border-outline-variant/60">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">
                        Siap Menguji
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface text-xs font-semibold">
                        Menunggu Langkah 1
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed pt-1">
                      Lengkapi formulir di <strong>Langkah 1</strong> untuk
                      membuat kode alat, lalu sistem otomatis mendengarkan paket
                      telemetri pertama dari ESP32 Anda.
                    </p>
                  </div>
                )}

                {testState === "waiting" && (
                  /* STATE A: MENUNGGU DATA */
                  <div className="flex flex-col gap-2.5 p-4 sm:p-5 rounded-xl bg-surface-container-low border border-outline-variant/70">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">
                        Sedang Menunggu
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface text-xs font-semibold whitespace-nowrap">
                        <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse" />
                        Proses Uji
                      </span>
                    </div>
                    <div className="flex items-start gap-3 pt-1">
                      <div className="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-2xs text-primary-container">
                        <span className="material-symbols-outlined animate-spin text-[22px]">
                          sync
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        <h3 className="font-bold text-base text-on-surface">
                          Menunggu data pertama dari alat...
                        </h3>
                        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                          Mendengarkan transmisi paket dari modul PZEM-004T
                          untuk <strong>{generatedCreds?.nama}</strong>{" "}
                          (biasanya 5–15 detik setelah ESP32 menyala)...
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {testState === "success" && (
                  /* STATE B: SUCCESS / BERHASIL */
                  <div className="flex flex-col gap-2.5 p-4 sm:p-5 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E40AF]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs uppercase tracking-wider font-bold text-[#1E40AF]">
                        Terkoneksi Sukses
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#DBEAFE] text-xs font-bold text-[#1E40AF] whitespace-nowrap">
                        Normal &amp; Aktif
                      </span>
                    </div>
                    <div className="flex items-start gap-3 pt-1">
                      <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center shrink-0 shadow-2xs">
                        <span className="material-symbols-outlined text-[24px]">
                          check
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        <h3 className="font-bold text-base text-[#1E40AF] leading-snug">
                          Berhasil terhubung! Data pertama diterima (
                          {firstPacket
                            ? `${firstPacket.v.toFixed(1).replace(".", ",")} V • ${Math.round(firstPacket.p)} W`
                            : "220,0 V • Terukur"}
                          )
                        </h3>
                        <p className="text-xs sm:text-sm text-[#1E40AF]/85 leading-relaxed">
                          Arus terukur{" "}
                          {firstPacket
                            ? `${firstPacket.i.toFixed(2).replace(".", ",")} A`
                            : "aktif"}{" "}
                          • Paket telemetri berhasil masuk ke database.
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 pt-1">
                      <Link
                        href="/dashboard"
                        className="w-full inline-flex items-center justify-center gap-2 px-4 h-11 rounded-xl bg-primary-container text-on-primary text-xs sm:text-sm font-semibold shadow-2xs hover:opacity-95 transition-all"
                      >
                        <span>Buka Dashboard</span>
                        <span className="material-symbols-outlined text-[18px]">
                          arrow_forward
                        </span>
                      </Link>
                    </div>
                  </div>
                )}

                {testState === "timeout" && (
                  /* STATE C: FAILED / GAGAL */
                  <div className="flex flex-col gap-2.5 p-4 sm:p-5 rounded-xl bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs uppercase tracking-wider font-bold text-[#991B1B]">
                        Gagal Terhubung
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FECACA] text-xs font-bold text-[#991B1B] whitespace-nowrap">
                        Waktu Habis
                      </span>
                    </div>
                    <div className="flex items-start gap-3 pt-1">
                      <div className="w-10 h-10 rounded-full bg-[#B91C1C] text-on-primary flex items-center justify-center shrink-0 shadow-2xs">
                        <span className="material-symbols-outlined text-[22px]">
                          error_outline
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        <h3 className="font-bold text-base text-[#991B1B]">
                          Belum ada data masuk (&gt; 2 menit)
                        </h3>
                        <p className="text-xs sm:text-sm text-[#991B1B]/85 leading-relaxed">
                          Modul IoT belum berhasil mengirimkan paket telemetri
                          ke server pusat.
                        </p>
                      </div>
                    </div>

                    {/* Troubleshooting Checklist */}
                    <div className="mt-1 flex flex-col gap-2 bg-surface-container-lowest/90 p-3.5 rounded-xl text-on-surface">
                      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                        Langkah Penelusuran Masalah:
                      </span>
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded bg-surface-container flex items-center justify-center text-xs font-bold shrink-0 text-on-surface-variant">
                          1
                        </span>
                        <span className="text-xs sm:text-sm text-on-surface">
                          Cek koneksi Wi-Fi 2.4 GHz di dekat stopkontak
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded bg-surface-container flex items-center justify-center text-xs font-bold shrink-0 text-on-surface-variant">
                          2
                        </span>
                        <span className="text-xs sm:text-sm text-on-surface">
                          Cek Kunci Alat (API Key) dan Device ID di sketch ESP32
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded bg-surface-container flex items-center justify-center text-xs font-bold shrink-0 text-on-surface-variant">
                          3
                        </span>
                        <span className="text-xs sm:text-sm text-on-surface">
                          Cek kabel stopkontak dalam kotak tertutup &amp; steker
                          sensor
                        </span>
                      </div>
                    </div>

                    {/* Retry Button */}
                    <div className="mt-1 pt-1">
                      <button
                        type="button"
                        onClick={handleStartTestNow}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 h-11 rounded-xl bg-surface-container-lowest text-on-surface text-xs sm:text-sm font-semibold hover:bg-surface-container-high shadow-2xs transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          sync
                        </span>
                        <span>Coba Lagi</span>
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Hardware Specs Card Information */}
              <div className="bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 sm:p-5 shadow-2xs flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-surface-container-high text-primary-container flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[26px]">
                    memory
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-on-surface">
                    Standar Modul Resmi
                  </span>
                  <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                    Kompatibel dengan ESP32 NodeMCU V1 dan sensor PZEM-004T v3.0
                    (AC 80-260V 100A).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
