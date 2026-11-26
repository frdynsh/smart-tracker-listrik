// src/app/perangkat/page.tsx
"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase";

interface DeviceRow {
  id: string;
  user_id?: string | null;
  claim_code?: string | null;
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
  "Dispenser Air",
  "Komputer / PC",
  "TV / Hiburan",
  "Lainnya (≤ 600 W)",
];

const LOKASI_OPTIONS = [
  "Kamar Tidur Utama",
  "Ruang Tamu",
  "Ruang Kerja",
  "Dapur",
  "Kamar Anak",
  "Lainnya",
];

const OFFLINE_THRESHOLD_MS = 120_000;

function extractClaimCode(rawText: string): string {
  const trimmed = rawText.trim();
  try {
    const url = new URL(trimmed);
    const param = url.searchParams.get("claim");
    if (param) return param.trim().toUpperCase();
  } catch {
    // Bukan URL penuh, lanjut ekstrak pola kode stiker atau teks langsung
  }
  const match = trimmed.match(/STL-[A-Z0-9]+/i);
  if (match) return match[0].toUpperCase();
  return trimmed.toUpperCase();
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
  if (text.includes("tv") || text.includes("komputer") || text.includes("pc")) {
    return "tv";
  }
  return "power";
}

function PerangkatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  // Mode layar: "list" (Daftar Perangkat) atau "wizard" (Pindai QR & Klaim Perangkat)
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

  // State Wizard Step 1: QR Scanner & Verifikasi Kode Stiker
  const [claimCodeInput, setClaimCodeInput] = useState<string>("");
  const [verifyingCode, setVerifyingCode] = useState<boolean>(false);
  const [verifiedDevice, setVerifiedDevice] = useState<DeviceRow | null>(null);
  const [claimStatusMsg, setClaimStatusMsg] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // State Kamera QR Live
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  // State Wizard Step 2: Lengkapi Identitas Perangkat
  const [nama, setNama] = useState<string>("");
  const [jenisBeban, setJenisBeban] = useState<string>("Kipas Angin");
  const [jenisDropdownOpen, setJenisDropdownOpen] = useState<boolean>(false);
  const jenisDropdownRef = useRef<HTMLDivElement | null>(null);
  const [lokasi, setLokasi] = useState<string>("Kamar Tidur Utama");
  const [lokasiDropdownOpen, setLokasiDropdownOpen] = useState<boolean>(false);
  const lokasiDropdownRef = useRef<HTMLDivElement | null>(null);
  const [dayaNominal, setDayaNominal] = useState<string>("50");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // State Wizard Step 3: Uji Koneksi Real-Time
  const [claimedDeviceInfo, setClaimedDeviceInfo] = useState<{
    id: string;
    nama: string;
    claimCode: string;
  } | null>(null);
  const [testState, setTestState] = useState<
    "idle" | "waiting" | "success" | "timeout"
  >("idle");
  const [firstPacket, setFirstPacket] = useState<{
    v: number;
    i: number;
    p: number;
  } | null>(null);
  const testStartRef = useRef<number | null>(null);
  const autoClaimHandledRef = useRef<boolean>(false);

  const stopCamera = useCallback(() => {
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        jenisDropdownRef.current &&
        !jenisDropdownRef.current.contains(event.target as Node)
      ) {
        setJenisDropdownOpen(false);
      }
      if (
        lokasiDropdownRef.current &&
        !lokasiDropdownRef.current.contains(event.target as Node)
      ) {
        setLokasiDropdownOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setJenisDropdownOpen(false);
        setLokasiDropdownOpen(false);
      }
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
            "id, user_id, claim_code, nama, jenis_beban, lokasi, daya_nominal_w, last_seen_at, created_at",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("readings")
          .select("device_id, ts, v, i, p, e_wh")
          .gte("ts", startOfToday.toISOString())
          .order("ts", { ascending: true })
          .limit(3000),
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

  // Verifikasi Kode Stiker QR terhadap inventaris tabel devices di Supabase
  const verifyClaimCode = useCallback(
    async (rawInput: string) => {
      const normalized = extractClaimCode(rawInput);
      setClaimCodeInput(normalized);
      setErrorMsg("");
      setVerifiedDevice(null);

      if (!normalized) {
        setClaimStatusMsg({
          type: "error",
          text: "Masukkan atau pindai kode unik pada stiker perangkat terlebih dahulu.",
        });
        return;
      }

      setVerifyingCode(true);
      setClaimStatusMsg(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setVerifyingCode(false);
        setClaimStatusMsg({
          type: "error",
          text: "Sesi login berakhir. Silakan masuk kembali.",
        });
        return;
      }

      const { data: foundDev, error } = await supabase
        .from("devices")
        .select(
          "id, user_id, claim_code, nama, jenis_beban, lokasi, daya_nominal_w, last_seen_at",
        )
        .eq("claim_code", normalized)
        .maybeSingle();

      setVerifyingCode(false);

      if (error) {
        setClaimStatusMsg({
          type: "error",
          text: "Gagal memeriksa kode stiker: " + error.message,
        });
        return;
      }

      // Jika RLS menyembunyikan baris karena user_id milik akun lain, atau kode tidak ditemukan
      if (!foundDev) {
        setClaimStatusMsg({
          type: "error",
          text: `Kode "${normalized}" tidak tersedia atau sedang terhubung ke akun lain. Pastikan kode benar atau lepaskan dari akun sebelumnya.`,
        });
        return;
      }

      if (foundDev.user_id === user.id) {
        setClaimStatusMsg({
          type: "info",
          text: `Perangkat "${foundDev.nama}" (${normalized}) sudah terpasang di akun Anda.`,
        });
        return;
      }

      if (foundDev.user_id && foundDev.user_id !== user.id) {
        setClaimStatusMsg({
          type: "error",
          text: `Perangkat dengan kode "${normalized}" sedang terhubung ke akun lain. Lepaskan perangkat dari akun sebelumnya terlebih dahulu.`,
        });
        return;
      }

      // Unit valid dan belum diklaim (user_id === null)
      setVerifiedDevice(foundDev as DeviceRow);
      setNama(
        foundDev.nama && !foundDev.nama.startsWith("Colokan Pintar")
          ? foundDev.nama
          : "",
      );
      if (foundDev.jenis_beban) setJenisBeban(foundDev.jenis_beban);
      if (foundDev.daya_nominal_w)
        setDayaNominal(String(foundDev.daya_nominal_w));
      setClaimStatusMsg({
        type: "success",
        text: `Kode ${normalized} terverifikasi! Unit siap diklaim. silahkan lengkapi identitas perangkat pada Langkah 2.`,
      });
    },
    [supabase],
  );

  // Tangkap parameter ?claim=STL-1001 dari hasil scan kamera bawaan HP
  useEffect(() => {
    const claimParam = searchParams.get("claim");
    if (claimParam && !autoClaimHandledRef.current) {
      autoClaimHandledRef.current = true;
      setViewMode("wizard");
      verifyClaimCode(claimParam);
    }
  }, [searchParams, verifyClaimCode]);

  // Buka kamera HP/Laptop untuk memindai QR Code langsung di browser
  const handleStartCamera = async () => {
    setCameraError("");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        "Browser tidak mendukung akses kamera langsung. Silakan masukkan kode pada stiker secara manual di bawah.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);

      // Tunggu elemen <video> terpasang lalu mulai pemindaian frame
      window.setTimeout(async () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const BarcodeDetectorClass = (
          window as unknown as {
            BarcodeDetector?: new (opts: { formats: string[] }) => {
              detect: (
                source: HTMLVideoElement,
              ) => Promise<Array<{ rawValue?: string }>>;
            };
          }
        ).BarcodeDetector;

        if (!BarcodeDetectorClass) {
          setCameraError(
            "Kamera aktif, tetapi deteksi QR otomatis belum didukung di browser ini. Anda bisa memindai QR memakai kamera bawaan HP atau mengetik kode stiker di bawah.",
          );
          return;
        }

        const detector = new BarcodeDetectorClass({ formats: ["qr_code"] });
        scanTimerRef.current = window.setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              const scannedValue = barcodes[0].rawValue;
              stopCamera();
              verifyClaimCode(scannedValue);
            }
          } catch {
            // Abaikan error frame tunggal saat fokus kamera menyesuaikan
          }
        }, 500);
      }, 150);
    } catch {
      setCameraError(
        "Izin kamera ditolak atau kamera tidak ditemukan. Silakan masukkan kode unik perangkat secara manual di bawah.",
      );
      stopCamera();
    }
  };

  // Polling Uji Koneksi Step 3 ketika status "waiting"
  useEffect(() => {
    if (testState !== "waiting" || !claimedDeviceInfo?.id) return;

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
        .eq("device_id", claimedDeviceInfo.id)
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
  }, [testState, claimedDeviceInfo, supabase, loadDevices]);

  const handleOpenWizard = () => {
    stopCamera();
    setErrorMsg("");
    setCameraError("");
    setClaimCodeInput("");
    setVerifiedDevice(null);
    setClaimStatusMsg(null);
    setNama("");
    setJenisBeban("Kipas Angin");
    setLokasi("Kamar Tidur Utama");
    setDayaNominal("50");
    setClaimedDeviceInfo(null);
    setTestState("idle");
    setFirstPacket(null);
    testStartRef.current = null;
    setViewMode("wizard");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackToList = () => {
    stopCamera();
    setViewMode("list");
    setErrorMsg("");
    loadDevices();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Langkah 2: Ikat kepemilikan unit QR ke akun user & simpan identitas perangkat
  const handleClaimAndSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!verifiedDevice) {
      setErrorMsg(
        "Verifikasi kode stiker / QR Code perangkat pada Langkah 1 terlebih dahulu.",
      );
      return;
    }

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

    const { data: updatedDev, error: claimErr } = await supabase
      .from("devices")
      .update({
        user_id: user.id,
        nama: nama.trim(),
        jenis_beban: jenisBeban,
        lokasi: lokasi.trim() || null,
        daya_nominal_w: nominalNum,
      })
      .eq("id", verifiedDevice.id)
      .is("user_id", null)
      .select()
      .maybeSingle();

    setSubmitting(false);

    if (claimErr || !updatedDev) {
      setErrorMsg(
        claimErr
          ? "Gagal menghubungkan perangkat: " + claimErr.message
          : "Perangkat baru saja diklaim oleh akun lain. Silakan periksa kembali kode perangkat.",
      );
      return;
    }

    setClaimedDeviceInfo({
      id: updatedDev.id,
      nama: updatedDev.nama,
      claimCode: updatedDev.claim_code || claimCodeInput,
    });
    testStartRef.current = Date.now();
    setTestState("waiting");
    loadDevices();
  };

  const handleRetryTest = () => {
    if (!claimedDeviceInfo) return;
    setFirstPacket(null);
    testStartRef.current = Date.now();
    setTestState("waiting");
  };

  // Lepas klaim perangkat (Unbind -> user_id = NULL) agar QR Code bisa dipakai ulang akun lain
  const handleUnbindDevice = async (dev: DeviceRow) => {
    const codeLabel = dev.claim_code ? ` (${dev.claim_code})` : "";
    if (
      !confirm(
        `Lepaskan perangkat "${dev.nama}"${codeLabel} dari akun Anda? Stiker QR Code pada alat ini akan kembali tersedia untuk dipindai ulang.`,
      )
    ) {
      return;
    }

    if (dev.claim_code) {
      await supabase
        .from("devices")
        .update({
          user_id: null,
          nama: `Colokan Pintar (${dev.claim_code})`,
          lokasi: null,
        })
        .eq("id", dev.id);
    } else {
      await supabase.from("devices").delete().eq("id", dev.id);
    }

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
    await supabase
      .from("devices")
      .update({
        nama: editNama.trim(),
        lokasi: editLokasi.trim() || null,
        daya_nominal_w: nominal,
      })
      .eq("id", editingDevice.id);

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
    testState === "success" || testState === "timeout" || claimedDeviceInfo
      ? 3
      : verifiedDevice
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
                    qr_code_2
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
                  qr_code_scanner
                </span>
                <span>Tambah Perangkat (QR)</span>
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
                  Kredensial perangkat tertanam aman di dalam ESP32. Cukup
                  pindai stiker QR Code pada bodi colokan pintar untuk mulai
                  memantau tegangan (V), arus (A), daya (W), dan energi (kWh).
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
                  Aktivasi
                </span>
                <span className="text-xs text-on-surface font-semibold whitespace-nowrap">
                  QR Code Stiker
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
                    qr_code_scanner
                  </span>
                </div>
                <h3 className="font-bold text-lg sm:text-xl text-on-surface tracking-tight mb-2">
                  Belum ada perangkat terpasang
                </h3>
                <p className="text-xs sm:text-sm md:text-base text-on-surface-variant max-w-lg mb-6 leading-relaxed">
                  Pindai kode QR pada stiker colokan pintar Anda untuk
                  menghubungkan modul IoT dan mulai memantau daya listrik.
                </p>
                <button
                  type="button"
                  onClick={handleOpenWizard}
                  className="min-h-[48px] px-6 rounded-xl bg-primary-container text-on-primary text-sm font-semibold flex items-center justify-center gap-2 shadow-2xs hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    qr_code_scanner
                  </span>
                  <span>Pindai QR Perangkat Pertama</span>
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
                    {/* Left: Icon + Title + Status + QR Badge */}
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
                          {dev.claim_code && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-fixed text-primary font-mono text-xs font-bold whitespace-nowrap shrink-0">
                              <span className="material-symbols-outlined text-[13px]">
                                qr_code_2
                              </span>
                              {dev.claim_code}
                            </span>
                          )}
                        </div>
                        <span className="text-xs sm:text-sm text-on-surface-variant">
                          Alat {index + 1} ({dev.jenis_beban || "Beban Terukur"}{" "}
                          - Nominal {dev.daya_nominal_w || 50} W)
                          {dev.lokasi ? ` Lokasi: ${dev.lokasi}` : ""}
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
                        onClick={() => handleUnbindDevice(dev)}
                        title="Lepaskan Perangkat (QR Code dapat diklaim ulang)"
                        className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/50 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          link_off
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
           VIEW 2: WIZARD PINDAI QR & KLAIM PERANGKAT (3 LANGKAH)
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

          {/* Stepper Tracker (Selaras dengan Stitch) */}
          <div className="w-full bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 sm:p-5 shadow-2xs">
            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-0">
              <div className="hidden md:block absolute left-12 right-12 top-1/2 -translate-y-1/2 h-1 bg-surface-container-high z-0">
                <div
                  className="h-full bg-primary-container transition-all duration-500"
                  style={{
                    width:
                      currentStep === 1
                        ? "25%"
                        : currentStep === 2
                          ? "65%"
                          : "100%",
                  }}
                />
              </div>

              {/* Step 1 Indicator */}
              <div className="relative z-10 flex items-center gap-3 bg-surface-container-lowest md:pr-4">
                <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-base shadow-2xs shrink-0">
                  {verifiedDevice ? (
                    <span className="material-symbols-outlined text-[20px]">
                      check
                    </span>
                  ) : (
                    "1"
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs sm:text-sm text-on-surface font-bold">
                    Pindai QR / Kode Alat
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    Kamera &amp; kode stiker
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
                  {claimedDeviceInfo ? (
                    <span className="material-symbols-outlined text-[20px]">
                      check
                    </span>
                  ) : (
                    "2"
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs sm:text-sm text-on-surface font-bold">
                    Identitas Perangkat
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    Nama, tipe &amp; lokasi
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
              {/* STEP 1 CARD: QR SCANNER & MANUAL CODE */}
              <section className="bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 sm:p-6 lg:p-7 shadow-2xs flex flex-col gap-4 sm:gap-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary-container text-xs font-bold shrink-0 whitespace-nowrap">
                      Langkah 1
                    </span>
                    <h2 className="font-bold text-base sm:text-lg text-on-surface truncate">
                      Pindai QR Code Perangkat
                    </h2>
                  </div>
                  <span className="material-symbols-outlined text-primary-container text-[22px] shrink-0">
                    qr_code_scanner
                  </span>
                </div>

                <p className="text-xs sm:text-sm md:text-base text-on-surface-variant leading-relaxed">
                  Arahkan kamera ke kode QR pada stiker colokan pintar atau
                  ketik kode manual.
                </p>

                {/* Camera Viewfinder Box */}
                <div className="relative w-full rounded-xl bg-surface-container-low border border-outline-variant/60 p-5 sm:p-6 flex flex-col items-center justify-center text-center overflow-hidden min-h-[220px]">
                  {/* Corner Guide Ticks */}
                  <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-primary-container rounded-tl z-10 pointer-events-none" />
                  <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-primary-container rounded-tr z-10 pointer-events-none" />
                  <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-primary-container rounded-bl z-10 pointer-events-none" />
                  <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-primary-container rounded-br z-10 pointer-events-none" />

                  {cameraActive ? (
                    <div className="w-full flex flex-col items-center gap-3">
                      <div className="relative w-full max-w-sm aspect-video rounded-xl overflow-hidden bg-black shadow-sm">
                        <video
                          ref={videoRef}
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-x-6 top-1/2 h-0.5 bg-primary-container/80 animate-pulse" />
                      </div>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-error-container text-error text-xs sm:text-sm font-semibold cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          videocam_off
                        </span>
                        <span>Tutup Kamera</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-primary-container/10 text-primary-container flex items-center justify-center mb-3">
                        <span className="material-symbols-outlined text-[32px]">
                          qr_code_2
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-on-surface mb-1">
                        Pindai Kamera Langsung
                      </span>
                      <p className="text-xs sm:text-sm text-on-surface-variant max-w-xs mb-4 leading-relaxed">
                        Posisikan kode QR di dalam bingkai jendela pemindai
                        untuk deteksi instan.
                      </p>
                      <button
                        type="button"
                        onClick={handleStartCamera}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-container text-on-primary text-xs sm:text-sm font-semibold shadow-2xs hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          photo_camera
                        </span>
                        <span>Buka Kamera QR</span>
                      </button>
                    </>
                  )}
                </div>

                {cameraError && (
                  <p className="text-xs text-secondary font-medium bg-secondary-fixed/40 px-3.5 py-2.5 rounded-lg">
                    {cameraError}
                  </p>
                )}

                {/* Divider with text */}
                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-outline-variant/50" />
                  <span className="flex-shrink mx-3 text-[11px] sm:text-xs text-on-surface-variant uppercase tracking-wider font-semibold text-center">
                    atau masukkan kode pada stiker alat
                  </span>
                  <div className="flex-grow border-t border-outline-variant/50" />
                </div>

                {/* Manual Code Entry Input */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="manual_device_code"
                    className="text-xs sm:text-sm text-on-surface font-semibold"
                  >
                    Kode Unik Perangkat (Stiker)
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative flex-1">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                        sell
                      </span>
                      <input
                        id="manual_device_code"
                        type="text"
                        value={claimCodeInput}
                        onChange={(e) =>
                          setClaimCodeInput(e.target.value.toUpperCase())
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            verifyClaimCode(claimCodeInput);
                          }
                        }}
                        placeholder="STL-1001"
                        className="w-full h-12 pl-10 pr-3.5 rounded-xl bg-surface-container-low border border-outline-variant/80 text-on-surface font-mono font-bold text-base sm:text-lg uppercase placeholder:font-sans placeholder:font-normal placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={verifyingCode || !claimCodeInput.trim()}
                      onClick={() => verifyClaimCode(claimCodeInput)}
                      className="inline-flex items-center justify-center gap-1.5 px-5 h-12 rounded-xl bg-primary-container text-on-primary text-xs sm:text-sm font-semibold shadow-2xs hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-45 shrink-0 whitespace-nowrap"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        verified
                      </span>
                      <span>
                        {verifyingCode ? "Memeriksa..." : "Verifikasi Kode"}
                      </span>
                    </button>
                  </div>

                  {claimStatusMsg && (
                    <div
                      className={`mt-1.5 p-3.5 rounded-xl text-xs sm:text-sm font-medium flex items-start gap-2.5 ${
                        claimStatusMsg.type === "success"
                          ? "bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E40AF]"
                          : claimStatusMsg.type === "info"
                            ? "bg-surface-container text-on-surface"
                            : "bg-error-container border border-error/30 text-error"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[19px] shrink-0 mt-0.5">
                        {claimStatusMsg.type === "success"
                          ? "check_circle"
                          : claimStatusMsg.type === "info"
                            ? "info"
                            : "error"}
                      </span>
                      <span>{claimStatusMsg.text}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 mt-0.5 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px] text-primary-container shrink-0">
                      info
                    </span>
                    <p className="text-xs sm:text-sm">
                      Kode unik tertera di bagian belakang stiker modul
                      SmartListrik.
                    </p>
                  </div>
                </div>
              </section>

              {/* STEP 2 CARD: IDENTITAS PERANGKAT */}
              <section
                className={`bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 sm:p-6 lg:p-7 shadow-2xs flex flex-col gap-4 sm:gap-5 transition-opacity ${
                  verifiedDevice ? "opacity-100" : "opacity-70"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary-container text-xs font-bold shrink-0 whitespace-nowrap">
                      Langkah 2
                    </span>
                    <h2 className="font-bold text-base sm:text-lg text-on-surface truncate">
                      Lengkapi Identitas Perangkat
                    </h2>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant text-[22px] shrink-0">
                    edit_note
                  </span>
                </div>

                <p className="text-xs sm:text-sm md:text-base text-on-surface-variant leading-relaxed">
                  Beri nama dan tentukan lokasi colokan agar mudah dipantau di
                  dashboard.
                </p>

                <form
                  onSubmit={handleClaimAndSaveDevice}
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
                      disabled={!verifiedDevice}
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      placeholder="Contoh: Kipas Angin Kamar"
                      className="w-full h-12 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/80 text-on-surface text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-primary-container transition-all disabled:opacity-50"
                    />
                  </div>

                  {/* Jenis Perangkat */}
                  <div
                    ref={jenisDropdownRef}
                    className="flex flex-col gap-1.5 relative"
                  >
                    <label className="text-xs sm:text-sm text-on-surface font-semibold">
                      Jenis Perangkat
                    </label>
                    <button
                      type="button"
                      disabled={!verifiedDevice}
                      aria-haspopup="listbox"
                      aria-expanded={jenisDropdownOpen}
                      onClick={() => setJenisDropdownOpen((prev) => !prev)}
                      className="w-full h-12 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/80 text-on-surface text-sm sm:text-base flex items-center justify-between gap-2 hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50"
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
                        className="absolute left-0 right-0 top-full mt-1.5 max-h-56 overflow-y-auto rounded-xl bg-surface-container-lowest border border-outline-variant/80 shadow-lg py-1.5 z-30"
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
                  <div
                    ref={lokasiDropdownRef}
                    className="flex flex-col gap-1.5 relative"
                  >
                    <label className="text-xs sm:text-sm text-on-surface font-semibold">
                      Lokasi Ruangan
                    </label>
                    <button
                      type="button"
                      disabled={!verifiedDevice}
                      aria-haspopup="listbox"
                      aria-expanded={lokasiDropdownOpen}
                      onClick={() => setLokasiDropdownOpen((prev) => !prev)}
                      className="w-full h-12 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/80 text-on-surface text-sm sm:text-base flex items-center justify-between gap-2 hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <span className="truncate">{lokasi}</span>
                      <span
                        className={`material-symbols-outlined text-on-surface-variant text-[20px] shrink-0 transition-transform duration-200 ${
                          lokasiDropdownOpen ? "rotate-180" : ""
                        }`}
                      >
                        expand_more
                      </span>
                    </button>

                    {lokasiDropdownOpen && (
                      <ul
                        role="listbox"
                        className="absolute left-0 right-0 top-full mt-1.5 max-h-56 overflow-y-auto rounded-xl bg-surface-container-lowest border border-outline-variant/80 shadow-lg py-1.5 z-30"
                      >
                        {LOKASI_OPTIONS.map((opt) => {
                          const isSelected = opt === lokasi;
                          return (
                            <li
                              key={opt}
                              role="option"
                              aria-selected={isSelected}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setLokasi(opt);
                                  setLokasiDropdownOpen(false);
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

                  {/* Daya Nominal (Watt) */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <label
                        htmlFor="device_wattage"
                        className="text-xs sm:text-sm text-on-surface font-semibold"
                      >
                        Daya Nominal (Watt)
                      </label>
                      <span className="text-xs text-on-surface-variant">
                        Beban Uji Operasional
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        id="device_wattage"
                        type="number"
                        required
                        min={1}
                        max={600}
                        disabled={!verifiedDevice}
                        value={dayaNominal}
                        onChange={(e) => setDayaNominal(e.target.value)}
                        className="w-full h-12 px-3.5 pr-16 rounded-xl bg-surface-container-low border border-outline-variant/80 text-on-surface text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-primary-container transition-all disabled:opacity-50"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-on-surface-variant font-bold">
                        Watt
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5 mt-1 text-on-surface-variant">
                      <span className="material-symbols-outlined text-[18px] text-primary-container shrink-0 mt-0.5">
                        shield
                      </span>
                      <p className="text-xs sm:text-sm leading-relaxed">
                        Beban Maks. 600 W untuk pengujian aman stopkontak rumah
                        tangga.
                      </p>
                    </div>
                  </div>

                  {/* Primary CTA Step 2 */}
                  <div className="md:col-span-2 pt-1">
                    <button
                      type="submit"
                      disabled={!verifiedDevice || submitting}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 h-12 rounded-xl bg-primary-container text-on-primary text-sm font-semibold shadow-2xs hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-45"
                    >
                      <span>
                        {submitting
                          ? "Menghubungkan Perangkat..."
                          : "Simpan & Hubungkan Perangkat"}
                      </span>
                      <span className="material-symbols-outlined text-[20px]">
                        wifi
                      </span>
                    </button>
                  </div>
                </form>
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
                        Menunggu Langkah 1 &amp; 2
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed pt-1">
                      Pindai QR Code pada <strong>Langkah 1</strong> dan simpan
                      identitas perangkat di <strong>Langkah 2</strong> untuk
                      memulai validasi sinyal sensor secara otomatis.
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
                          untuk{" "}
                          <strong>
                            {claimedDeviceInfo?.nama} (
                            {claimedDeviceInfo?.claimCode})
                          </strong>{" "}
                          (biasanya 5–15 detik setelah colokan terhubung ke
                          Wi-Fi)...
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
                          Cek koneksi Wi-Fi 2.4 GHz pada portal Wi-Fi colokan
                          pintar
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded bg-surface-container flex items-center justify-center text-xs font-bold shrink-0 text-on-surface-variant">
                          2
                        </span>
                        <span className="text-xs sm:text-sm text-on-surface">
                          Pastikan colokan pintar sudah mendapat daya listrik
                          PLN
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
                        onClick={handleRetryTest}
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

export default function PerangkatPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="h-64 rounded-xl bg-surface-container-lowest border border-outline-variant/60 animate-pulse" />
        </AppShell>
      }
    >
      <PerangkatContent />
    </Suspense>
  );
}
