"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";

export default function HematPage() {
  const [dayaWatt, setDayaWatt] = useState(500);
  const [jamKurang, setJamKurang] = useState(2);
  const tarif = 1444.7;

  // Rumus simulasi: jam dikurangi * (daya/1000) * 30 hari * tarif
  const estimasiHemat = jamKurang * (dayaWatt / 1000) * 30 * tarif;

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Target & Simulasi Penghematan
      </h1>
      <p className="text-xs text-slate-500 mb-6">
        Hitung potensi penurunan estimasi biaya listrik jika mengurangi durasi
        pemakaian perangkat.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
          <h2 className="font-bold text-slate-800">
            Simulasi Pengurangan Jam Nyala
          </h2>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Pilih Daya Perangkat (Watt)
            </label>
            <select
              value={dayaWatt}
              onChange={(e) => setDayaWatt(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value={30}>Kipas Angin (30 W)</option>
              <option value={60}>Lampu Meja (60 W)</option>
              <option value={500}>Teko Listrik (500 W)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Kurangi Pemakaian: <strong>{jamKurang} jam/hari</strong>
            </label>
            <input
              type="range"
              min="1"
              max="12"
              value={jamKurang}
              onChange={(e) => setJamKurang(Number(e.target.value))}
              className="w-full accent-teal-600"
            />
          </div>
          <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl">
            <span className="text-xs text-teal-800">
              Potensi Penghematan (Estimasi 30 Hari):
            </span>
            <p className="text-2xl font-extrabold text-teal-700 mt-1">
              Biaya turun ± Rp{" "}
              {Math.round(estimasiHemat).toLocaleString("id-ID")}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-3">
          <h2 className="font-bold text-slate-800">
            Saran & Tips Hemat Praktis
          </h2>
          <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-700">
            1. Matikan kipas angin dan lampu meja saat ruangan tidak digunakan
            lebih dari 15 menit.
          </div>
          <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-700">
            2. Gunakan teko listrik sesuai takaran air yang dibutuhkan agar
            waktu pemanasan lebih singkat.
          </div>
          <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-700">
            3. Manfaatkan fitur Pengingat untuk membatasi durasi nyala perangkat
            berdaya tinggi.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
