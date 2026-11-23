// src/app/pengingat/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase";

interface NotificationItem {
  id: string;
  user_id: string;
  device_id?: string | null;
  tipe?: string;
  judul: string;
  isi: string;
  link?: string | null;
  dibaca: boolean;
  created_at: string;
}

interface AlertRule {
  id?: string;
  user_id: string;
  tipe: "durasi_lama" | "estimasi_biaya";
  ambang: number;
  aktif: boolean;
}

interface DeviceSummary {
  id: string;
  nama: string;
  jenis_beban?: string | null;
  last_seen_at?: string | null;
  latestWatt: number;
  isOnline: boolean;
}

const OFFLINE_THRESHOLD_MS = 120_000;
const ITEMS_PER_PAGE = 5;

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Baru saja";
  if (diffMins < 60) return `${diffMins} menit lalu`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  return new Date(isoDate).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PengingatPage() {
  const supabase = useMemo(() => createClient(), []);

  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // State pengaturan ambang batas
  const [durasiJam, setDurasiJam] = useState<string>("8");
  const [batasRp, setBatasRp] = useState<string>("50000");
  const [durasiAktif, setDurasiAktif] = useState<boolean>(true);
  const [biayaAktif, setBiayaAktif] = useState<boolean>(true);

  const [saving, setSaving] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [{ data: notifData }, { data: rulesData }, { data: devsData }] =
      await Promise.all([
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("alert_rules").select("*").eq("user_id", user.id),
        supabase
          .from("devices")
          .select("id, nama, jenis_beban, last_seen_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
      ]);

    setNotifs((notifData as NotificationItem[]) || []);
    setCurrentPage(1);

    (rulesData as AlertRule[] | null)?.forEach((r) => {
      if (r.tipe === "durasi_lama") {
        setDurasiJam(String(r.ambang));
        setDurasiAktif(r.aktif);
      }
      if (r.tipe === "estimasi_biaya") {
        setBatasRp(String(r.ambang));
        setBiayaAktif(r.aktif);
      }
    });

    const now = Date.now();
    const enrichedDevices: DeviceSummary[] = await Promise.all(
      (devsData || []).map(async (dev) => {
        const { data: latestRead } = await supabase
          .from("readings")
          .select("p")
          .eq("device_id", dev.id)
          .order("ts", { ascending: false })
          .limit(1)
          .single();

        const isOnline =
          !!dev.last_seen_at &&
          now - new Date(dev.last_seen_at).getTime() <= OFFLINE_THRESHOLD_MS;

        return {
          ...dev,
          latestWatt: isOnline && latestRead ? Number(latestRead.p) : 0,
          isOnline,
        };
      }),
    );

    setDevices(enrichedDevices);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const unreadCount = useMemo(
    () => notifs.filter((n) => !n.dibaca).length,
    [notifs],
  );

  const onlineDevicesCount = useMemo(
    () => devices.filter((d) => d.isOnline).length,
    [devices],
  );

  const totalPages = Math.max(1, Math.ceil(notifs.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedNotifs = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return notifs.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [notifs, safeCurrentPage]);

  const handleMarkAllRead = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Optimistic UI update
    setNotifs((prev) => prev.map((item) => ({ ...item, dibaca: true })));

    const { error } = await supabase
      .from("notifications")
      .update({ dibaca: true })
      .eq("user_id", user.id)
      .eq("dibaca", false);

    if (error) {
      console.error("Gagal menandai notifikasi terbaca:", error.message);
      await loadData();
      return;
    }

    showToast("Semua notifikasi telah ditandai terbaca");
  };

  const handleMarkSingleRead = async (notifId: string) => {
    setNotifs((prev) =>
      prev.map((item) =>
        item.id === notifId ? { ...item, dibaca: true } : item,
      ),
    );

    await supabase
      .from("notifications")
      .update({ dibaca: true })
      .eq("id", notifId);
  };

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);
    const parsedDurasi = Math.max(0.05, Number(durasiJam) || 8);
    const parsedBiaya = Math.max(1000, Number(batasRp) || 50000);

    const { data: existingRules } = await supabase
      .from("alert_rules")
      .select("id, tipe")
      .eq("user_id", user.id);

    const hasDurasi = existingRules?.some((r) => r.tipe === "durasi_lama");
    const hasBiaya = existingRules?.some((r) => r.tipe === "estimasi_biaya");

    if (hasDurasi) {
      await supabase
        .from("alert_rules")
        .update({ ambang: parsedDurasi, aktif: durasiAktif })
        .eq("user_id", user.id)
        .eq("tipe", "durasi_lama");
    } else {
      await supabase.from("alert_rules").insert({
        user_id: user.id,
        tipe: "durasi_lama",
        ambang: parsedDurasi,
        aktif: durasiAktif,
      });
    }

    if (hasBiaya) {
      await supabase
        .from("alert_rules")
        .update({ ambang: parsedBiaya, aktif: biayaAktif })
        .eq("user_id", user.id)
        .eq("tipe", "estimasi_biaya");
    } else {
      await supabase.from("alert_rules").insert({
        user_id: user.id,
        tipe: "estimasi_biaya",
        ambang: parsedBiaya,
        aktif: biayaAktif,
      });
    }

    setSaving(false);
    showToast("Ambang batas berhasil diperbarui dan disinkronkan!");
  };

  const handleQuickTest5Minutes = () => {
    setDurasiJam("0.08");
    setDurasiAktif(true);
    showToast("Batas durasi disetel ke 5 menit (0,08 jam) untuk simulasi tes");
  };

  const handleResetDefault = () => {
    setDurasiJam("8");
    setBatasRp("50000");
    setDurasiAktif(true);
    setBiayaAktif(true);
    showToast(
      "Pengaturan dikembalikan ke standar rekomendasi (8 jam & Rp 50.000)",
    );
  };

  return (
    <AppShell>
      <div className="flex flex-col w-full max-w-full overflow-x-hidden gap-4 sm:gap-6">
        {/* 1. HEADER BLOCK */}
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-xs text-secondary uppercase tracking-widest font-bold">
              Pengaturan Ambang Batas
            </span>
            <span className="h-1 w-8 bg-secondary-container rounded-full inline-block shrink-0" />
          </div>
          <h1 className="font-extrabold text-2xl sm:text-3xl text-on-surface tracking-tight mt-1">
            Pengingat &amp; Batas Aman
          </h1>
          <p className="text-sm sm:text-base text-on-surface-variant max-w-2xl mt-1 leading-relaxed">
            Pantau notifikasi peringatan konsumsi listrik dan tentukan ambang
            batas aman untuk perangkat di rumah Anda.
          </p>
        </div>

        {/* 2. MASTER TWO-COLUMN GRID (7 COLS LEFT + 5 COLS RIGHT) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
          {/* LEFT COLUMN: PERINGATAN MASUK (7 COLS) */}
          <section className="lg:col-span-7 flex flex-col gap-3.5 sm:gap-4 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <h2 className="font-bold text-lg sm:text-xl text-on-surface tracking-tight">
                  Peringatan Masuk
                </h2>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-secondary-fixed text-on-secondary-fixed font-bold whitespace-nowrap shrink-0">
                    {unreadCount} Baru
                  </span>
                )}
              </div>

              {notifs.length > 0 && unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs sm:text-sm font-semibold text-primary-container hover:underline transition-all cursor-pointer whitespace-nowrap py-1"
                >
                  Tandai semua terbaca
                </button>
              )}
            </div>

            <p className="text-xs sm:text-sm text-on-surface-variant -mt-2 leading-relaxed">
              Riwayat peringatan otomatis saat pemakaian melebihi batas durasi
              atau target biaya bulanan
            </p>

            {/* Notification Feed List (Max 5 per page) */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-36 rounded-xl bg-surface-container-lowest border border-outline-variant/60 animate-pulse"
                  />
                ))}
              </div>
            ) : notifs.length === 0 ? (
              <div className="bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-6 sm:p-8 text-center flex flex-col items-center gap-2 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-[#EFF6FF] text-primary-container flex items-center justify-center mb-1">
                  <span className="material-symbols-outlined text-[26px]">
                    notifications_paused
                  </span>
                </div>
                <h3 className="font-bold text-base text-on-surface">
                  Belum ada notifikasi peringatan
                </h3>
                <p className="text-xs sm:text-sm text-on-surface-variant max-w-md leading-relaxed">
                  Semua perangkat terpantau berada dalam batas durasi dan target
                  biaya yang Anda tetapkan.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3.5">
                  {paginatedNotifs.map((n) => {
                    const isUnread = !n.dibaca;
                    const isCostAlert =
                      n.tipe === "estimasi_biaya" ||
                      n.judul.toLowerCase().includes("biaya") ||
                      n.isi.toLowerCase().includes("rp");

                    return (
                      <article
                        key={n.id}
                        onClick={() => {
                          if (isUnread) handleMarkSingleRead(n.id);
                        }}
                        className={`bg-surface-container-lowest border rounded-xl p-4 sm:p-5 flex flex-col gap-3 shadow-2xs relative transition-all hover:shadow-sm min-w-0 ${
                          isUnread
                            ? "border-secondary-container/70 cursor-pointer"
                            : "border-outline-variant/70 opacity-90 hover:opacity-100"
                        }`}
                      >
                        {/* Left accent strip for unread items */}
                        {isUnread && (
                          <div className="absolute left-0 top-3.5 bottom-3.5 w-1.5 bg-secondary-container rounded-r-md" />
                        )}

                        <div
                          className={`flex flex-wrap items-center justify-between gap-2 ${
                            isUnread ? "pl-2" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap ${
                                isUnread
                                  ? "bg-secondary-fixed text-on-secondary-fixed"
                                  : "bg-surface-container-high text-on-surface-variant"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[15px] shrink-0">
                                {isCostAlert ? "payments" : "schedule"}
                              </span>
                              <span>
                                {isCostAlert
                                  ? "Peringatan Biaya"
                                  : "Alat Menyala Lama"}
                              </span>
                            </span>
                            <span className="text-xs text-on-surface-variant font-medium">
                              {formatRelativeTime(n.created_at)}
                            </span>
                          </div>

                          {isUnread ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="w-2.5 h-2.5 rounded-full bg-primary-container" />
                              <span className="text-xs text-primary-container font-bold">
                                Baru
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-outline font-semibold shrink-0">
                              Sudah Dibaca
                            </span>
                          )}
                        </div>

                        <div className={isUnread ? "pl-2" : ""}>
                          <h3 className="font-bold text-base sm:text-lg text-on-surface leading-snug break-words">
                            {n.judul}
                          </h3>
                          <p className="text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed break-words">
                            {n.isi}
                          </p>
                        </div>

                        <div
                          className={`pt-2 flex items-center justify-between flex-wrap gap-2 border-t border-surface-container ${
                            isUnread ? "pl-2" : ""
                          }`}
                        >
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-surface-container text-on-surface-variant font-semibold">
                            <span className="material-symbols-outlined text-[15px] shrink-0">
                              sensors
                            </span>
                            <span>Deteksi Otomatis Sensor</span>
                          </span>

                          <Link
                            href={n.link || "/cek"}
                            onClick={() => {
                              if (isUnread) handleMarkSingleRead(n.id);
                            }}
                            className="inline-flex items-center gap-1 text-xs sm:text-sm text-primary-container font-bold hover:underline transition-all whitespace-nowrap py-1"
                          >
                            <span>Cek Penyebab</span>
                            <span className="material-symbols-outlined text-[16px]">
                              arrow_forward
                            </span>
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-lowest border border-outline-variant/70 rounded-xl px-3.5 sm:px-4 py-2.5 shadow-2xs">
                    <span className="text-xs text-on-surface-variant font-medium">
                      Menampilkan{" "}
                      <strong className="text-on-surface">
                        {(safeCurrentPage - 1) * ITEMS_PER_PAGE + 1}–
                        {Math.min(
                          safeCurrentPage * ITEMS_PER_PAGE,
                          notifs.length,
                        )}
                      </strong>{" "}
                      dari{" "}
                      <strong className="text-on-surface">
                        {notifs.length}
                      </strong>{" "}
                      notifikasi
                    </span>

                    <div className="flex items-center gap-1.5 ml-auto">
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={safeCurrentPage === 1}
                        aria-label="Halaman sebelumnya"
                        className="min-h-[36px] px-2.5 sm:px-3 rounded-lg border border-outline-variant/60 bg-surface hover:bg-surface-container text-on-surface text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          chevron_left
                        </span>
                        <span className="hidden sm:inline">Sebelumnya</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from(
                          { length: totalPages },
                          (_, idx) => idx + 1,
                        ).map((page) => (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setCurrentPage(page)}
                            aria-current={
                              safeCurrentPage === page ? "page" : undefined
                            }
                            className={`w-9 h-9 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              safeCurrentPage === page
                                ? "bg-primary-container text-on-primary shadow-2xs"
                                : "bg-surface hover:bg-surface-container text-on-surface-variant"
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(totalPages, prev + 1),
                          )
                        }
                        disabled={safeCurrentPage === totalPages}
                        aria-label="Halaman berikutnya"
                        className="min-h-[36px] px-2.5 sm:px-3 rounded-lg border border-outline-variant/60 bg-surface hover:bg-surface-container text-on-surface text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        <span className="hidden sm:inline">Berikutnya</span>
                        <span className="material-symbols-outlined text-[16px]">
                          chevron_right
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Summary Banner Below Alerts */}
            <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mt-1">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0 text-primary-container">
                  <span className="material-symbols-outlined text-[22px]">
                    insights
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm text-on-surface font-bold">
                    Total Riwayat Notifikasi In-App
                  </span>
                  <span className="text-xs text-on-surface-variant leading-relaxed">
                    Notifikasi tercatat otomatis setiap kali sensor melaporkan
                    kondisi melewati batas.
                  </span>
                </div>
              </div>
              <span className="text-sm sm:text-lg text-primary font-extrabold whitespace-nowrap shrink-0 self-end sm:self-center">
                {notifs.length} Notifikasi
              </span>
            </div>
          </section>

          {/* RIGHT COLUMN: ATUR BATAS PERINGATAN (5 COLS) */}
          <section className="lg:col-span-5 flex flex-col gap-3.5 sm:gap-4 min-w-0">
            <div className="pb-1">
              <h2 className="font-bold text-lg sm:text-xl text-on-surface tracking-tight">
                Atur Batas Peringatan
              </h2>
              <p className="text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed">
                Sesuaikan toleransi durasi alat dan batas biaya bulanan agar
                peringatan tepat sasaran.
              </p>
            </div>

            {/* Main Configuration Form */}
            <form
              onSubmit={handleSaveRules}
              className="bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 sm:p-6 shadow-2xs flex flex-col gap-4 sm:gap-5"
            >
              {/* Setting Box 1: Batas Durasi Alat */}
              <div className="flex flex-col gap-3 bg-surface-container-low border border-outline-variant/50 p-3.5 sm:p-4 rounded-xl">
                <div className="flex items-start justify-between gap-3 sm:gap-4">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary-container text-[20px] shrink-0">
                        timelapse
                      </span>
                      <label
                        htmlFor="durationInput"
                        className="text-sm sm:text-base text-on-surface font-bold"
                      >
                        Batas Durasi Alat Menyala
                      </label>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      Kirim peringatan jika alat aktif terus-menerus tanpa jeda
                    </p>
                  </div>

                  {/* Custom Toggle Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={durasiAktif}
                    onClick={() => setDurasiAktif((prev) => !prev)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                      durasiAktif
                        ? "bg-primary-container"
                        : "bg-surface-variant"
                    }`}
                  >
                    <span className="sr-only">Aktifkan batas durasi</span>
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-surface-container-lowest shadow transition duration-200 ${
                        durasiAktif ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Numeric Input Row */}
                <div className="mt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1 bg-surface-container-lowest border border-outline-variant/70 rounded-lg px-3.5 py-2 flex items-center justify-between min-w-0">
                    <input
                      id="durationInput"
                      type="number"
                      step="0.01"
                      min="0.05"
                      max="48"
                      value={durasiJam}
                      onChange={(e) => setDurasiJam(e.target.value)}
                      className="w-full min-w-0 bg-transparent text-xl sm:text-2xl text-on-surface font-extrabold focus:outline-none tracking-tight"
                    />
                    <span className="text-sm text-on-surface-variant font-bold shrink-0 ml-2">
                      Jam
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleQuickTest5Minutes}
                    title="Ubah cepat ke 5 menit (0,08 jam) untuk uji coba"
                    className="min-h-[44px] px-3.5 py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold transition-colors shrink-0 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-[16px] text-secondary shrink-0">
                      science
                    </span>
                    <span>5 Menit Tes</span>
                  </button>
                </div>

                {/* Helper Note */}
                <div className="flex items-start gap-2 bg-surface-container rounded-lg p-2.5">
                  <span className="material-symbols-outlined text-primary-container text-[17px] shrink-0 mt-0.5">
                    info
                  </span>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Gunakan tombol <strong>5 Menit Tes</strong> (0,08 jam) jika
                    ingin menguji respon notifikasi sensor secara cepat.
                  </p>
                </div>
              </div>

              {/* Setting Box 2: Batas Anggaran Bulanan */}
              <div className="flex flex-col gap-3 bg-surface-container-low border border-outline-variant/50 p-3.5 sm:p-4 rounded-xl">
                <div className="flex items-start justify-between gap-3 sm:gap-4">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary-container text-[20px] shrink-0">
                        account_balance_wallet
                      </span>
                      <label
                        htmlFor="budgetInput"
                        className="text-sm sm:text-base text-on-surface font-bold"
                      >
                        Batas Anggaran Bulanan
                      </label>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      Kirim peringatan jika estimasi biaya akhir bulan melewati
                      angka ini
                    </p>
                  </div>

                  {/* Custom Toggle Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={biayaAktif}
                    onClick={() => setBiayaAktif((prev) => !prev)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                      biayaAktif ? "bg-primary-container" : "bg-surface-variant"
                    }`}
                  >
                    <span className="sr-only">Aktifkan batas anggaran</span>
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-surface-container-lowest shadow transition duration-200 ${
                        biayaAktif ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Currency Input Row */}
                <div className="mt-1">
                  <div className="relative bg-surface-container-lowest border border-outline-variant/70 rounded-lg px-3.5 py-2.5 flex items-center justify-between gap-2 min-w-0">
                    <span className="text-base sm:text-lg font-extrabold text-on-surface-variant shrink-0">
                      Rp
                    </span>
                    <input
                      id="budgetInput"
                      type="number"
                      step="1000"
                      min="1000"
                      value={batasRp}
                      onChange={(e) => setBatasRp(e.target.value)}
                      className="w-full min-w-0 bg-transparent text-xl sm:text-2xl text-on-surface font-extrabold focus:outline-none tracking-tight"
                    />
                    <span className="material-symbols-outlined text-on-surface-variant text-[20px] shrink-0">
                      edit
                    </span>
                  </div>
                </div>

                {/* Recommendation Helper */}
                <div className="flex items-start gap-2 bg-surface-container rounded-lg p-2.5">
                  <span className="material-symbols-outlined text-secondary text-[17px] shrink-0 mt-0.5">
                    recommend
                  </span>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Untuk pemantauan 2–3 perangkat rumah tangga, batas aman yang
                    disarankan adalah{" "}
                    <strong className="text-on-surface">
                      Rp 45.000 – Rp 60.000
                    </strong>{" "}
                    per bulan.
                  </p>
                </div>
              </div>

              {/* Realtime Info Notice Box */}
              <div className="flex items-start gap-3 bg-surface-container-high rounded-xl p-3.5">
                <div className="w-8 h-8 rounded-lg bg-surface-container-lowest flex items-center justify-center shrink-0 text-primary-container">
                  <span className="material-symbols-outlined text-[18px]">
                    notifications_active
                  </span>
                </div>
                <p className="text-xs text-on-surface leading-relaxed">
                  Peringatan muncul otomatis di aplikasi saat alat mengirim
                  pembacaan daya melalui Wi-Fi rumah.
                </p>
              </div>

              {/* Form Submit & Reset Actions */}
              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full min-h-[48px] bg-primary-container hover:bg-primary text-on-primary text-sm sm:text-base py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-60"
                >
                  <span
                    className={`material-symbols-outlined text-[20px] shrink-0 ${
                      saving ? "animate-spin" : ""
                    }`}
                  >
                    {saving ? "sync" : "save"}
                  </span>
                  <span>
                    {saving ? "Menyimpan Pengaturan..." : "Simpan Pengaturan"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleResetDefault}
                  className="min-h-[40px] text-center text-xs sm:text-sm font-semibold text-on-surface-variant hover:text-on-surface hover:underline transition-colors py-1.5 cursor-pointer"
                >
                  Kembalikan ke Rekomendasi Standar
                </button>
              </div>
            </form>

            {/* Sensor Health Card */}
            <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-on-surface font-bold">
                  Sensor Terpasang di Rumah
                </span>
                <span className="text-xs font-semibold text-on-surface-variant whitespace-nowrap shrink-0">
                  {onlineDevicesCount}/{devices.length} Online
                </span>
              </div>

              {devices.length === 0 ? (
                <p className="text-xs text-on-surface-variant">
                  Belum ada perangkat IoT terdaftar.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {devices.slice(0, 3).map((dev) => (
                    <div
                      key={dev.id}
                      className="bg-surface-container-lowest border border-outline-variant/50 p-2.5 rounded-lg flex sm:flex-col items-center sm:items-start justify-between gap-1 min-w-0"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs text-on-surface font-bold truncate">
                          {dev.nama}
                        </span>
                        <span className="text-[11px] text-on-surface-variant truncate">
                          {dev.jenis_beban || "Terpasang"}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-bold sm:mt-1 shrink-0 whitespace-nowrap ${
                          !dev.isOnline
                            ? "text-error"
                            : dev.latestWatt > 2
                              ? "text-primary"
                              : "text-outline"
                        }`}
                      >
                        {!dev.isOnline
                          ? "Offline"
                          : dev.latestWatt > 2
                            ? `${Math.round(dev.latestWatt)} Watt`
                            : `Standby (${Math.round(dev.latestWatt)}W)`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* TOAST NOTIFICATION */}
        {toastMsg && (
          <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-6 sm:right-6 sm:max-w-md bg-surface-container-lowest text-on-surface px-4 sm:px-5 py-3.5 rounded-xl shadow-lg border border-outline-variant/60 flex items-center gap-3 z-50">
            <span className="material-symbols-outlined text-primary-container text-[20px] shrink-0">
              check_circle
            </span>
            <span className="text-xs sm:text-sm font-bold leading-snug">
              {toastMsg}
            </span>
          </div>
        )}
      </div>
    </AppShell>
  );
}
