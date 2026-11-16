"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase";
import { AlertTriangle, WifiOff, CheckCircle, ArrowRight } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function DashboardPage() {
  const supabase = createClient();
  const [devices, setDevices] = useState<any[]>([]);
  const [readings, setReadings] = useState<any[]>([]);
  const [tarif, setTarif] = useState(1444.7);
  const [ambangBiaya, setAmbangBiaya] = useState(50000);

  const fetchDashboardData = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("tarif_per_kwh")
      .eq("id", user.id)
      .single();
    if (profile) setTarif(Number(profile.tarif_per_kwh));

    const { data: rule } = await supabase
      .from("alert_rules")
      .select("ambang")
      .eq("user_id", user.id)
      .eq("tipe", "estimasi_biaya")
      .single();
    if (rule) setAmbangBiaya(Number(rule.ambang));

    const { data: devs } = await supabase.from("devices").select("*");
    setDevices(devs || []);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: reads } = await supabase
      .from("readings")
      .select("*")
      .gte("ts", todayStart.toISOString())
      .order("ts", { ascending: true });
    setReadings(reads || []);
  };

  useEffect(() => {
    fetchDashboardData();
    const timer = setInterval(fetchDashboardData, 15000); // Polling 15 detik
    return () => clearInterval(timer);
  }, []);

  // Hitung metrik ringkasan
  const offlineDevices = devices.filter(
    (d) =>
      !d.last_seen_at ||
      Date.now() - new Date(d.last_seen_at).getTime() > 120000,
  );

  let currentPowerTotal = 0;
  let totalKwhToday = 0;

  devices.forEach((dev) => {
    const devReads = readings.filter((r) => r.device_id === dev.id);
    if (devReads.length > 0) {
      const latest = devReads[devReads.length - 1];
      if (
        dev.last_seen_at &&
        Date.now() - new Date(dev.last_seen_at).getTime() <= 120000
      ) {
        currentPowerTotal += Number(latest.p);
      }
      const deltaWh = Math.max(
        0,
        Number(latest.e_wh) - Number(devReads[0].e_wh),
      );
      totalKwhToday += deltaWh / 1000;
    }
  });

  const estimasiBiayaBulan = totalKwhToday * 30 * tarif;
  const isOverBudget = estimasiBiayaBulan > ambangBiaya;

  const chartData = readings.slice(-20).map((r) => ({
    waktu: new Date(r.ts).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    watt: Number(r.p),
  }));

  return (
    <AppShell>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Dashboard Pemantauan
          </h1>
          <p className="text-xs text-slate-500">
            Hanya menampilkan perangkat terpantau • Diperbarui otomatis tiap 15
            detik
          </p>
        </div>
      </div>

      {/* Kondisi Banner Status */}
      {devices.length === 0 ? (
        <div className="p-5 mb-6 bg-slate-100 border border-slate-300 rounded-2xl flex justify-between items-center">
          <span className="text-sm font-medium">Belum ada alat terpasang.</span>
          <Link
            href="/perangkat"
            className="px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-lg"
          >
            Tambah Perangkat
          </Link>
        </div>
      ) : offlineDevices.length > 0 ? (
        <div className="p-4 mb-6 bg-red-50 border border-red-200 text-red-800 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-red-600 shrink-0" />
            <div className="text-sm">
              <strong>Alat Offline:</strong>{" "}
              {offlineDevices.map((d) => d.nama).join(", ")} tidak mengirim data
              &gt; 2 menit. Periksa WiFi atau sumber daya alat.
            </div>
          </div>
          <Link
            href="/perangkat"
            className="text-xs font-bold underline shrink-0 ml-4"
          >
            Cek Alat
          </Link>
        </div>
      ) : isOverBudget ? (
        <div className="p-4 mb-6 bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-sm">
              <strong>Peringatan Biaya:</strong> Proyeksi estimasi biaya
              perangkat terpantau mencapai{" "}
              <strong>
                Rp {Math.round(estimasiBiayaBulan).toLocaleString("id-ID")}
              </strong>{" "}
              (melebihi ambang).
            </div>
          </div>
          <Link
            href="/cek"
            className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg shrink-0 ml-4"
          >
            Lihat penyebabnya
          </Link>
        </div>
      ) : (
        <div className="p-4 mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-medium">
            Pemakaian normal. Seluruh perangkat terpantau berada dalam batas
            wajar.
          </span>
        </div>
      )}

      {/* Kartu Ringkasan */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <span className="text-xs font-medium text-slate-500">
            Daya Aktif Saat Ini (Terukur)
          </span>
          <p className="text-3xl font-extrabold text-slate-900 mt-1">
            {currentPowerTotal.toFixed(1)}{" "}
            <span className="text-base font-normal text-slate-500">W</span>
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <span className="text-xs font-medium text-slate-500">
            Pemakaian Hari Ini (Terukur)
          </span>
          <p className="text-3xl font-extrabold text-teal-700 mt-1">
            {totalKwhToday.toFixed(3)}{" "}
            <span className="text-base font-normal text-slate-500">kWh</span>
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <span className="text-xs font-medium text-slate-500">
            Estimasi Biaya 30 Hari (Perangkat Terpantau)
          </span>
          <p className="text-3xl font-extrabold text-slate-900 mt-1">
            Rp {Math.round(estimasiBiayaBulan).toLocaleString("id-ID")}
          </p>
        </div>
      </div>

      {/* Grafik Real-Time */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-slate-800">
            Grafik Daya Terukur Terbaru (Watt)
          </h2>
          <Link
            href="/pantau"
            className="text-xs text-teal-700 font-semibold flex items-center gap-1 hover:underline"
          >
            Detail Riwayat <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="waktu" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="watt"
                stroke="#0d9488"
                fill="#ccfbf1"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AppShell>
  );
}
