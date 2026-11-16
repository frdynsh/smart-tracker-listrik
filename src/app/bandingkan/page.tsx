"use client";

import AppShell from "@/components/AppShell";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

const sampleComparison = [
  { nama: "Kipas Angin", periodeLalu: 4.2, periodeIni: 6.3 },
  { nama: "Lampu Meja", periodeLalu: 2.1, periodeIni: 1.9 },
  { nama: "Teko Listrik", periodeLalu: 5.5, periodeIni: 7.8 },
];

export default function BandingkanPage() {
  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Bandingkan Pemakaian
          </h1>
          <p className="text-xs text-slate-500">
            Perbandingan konsumsi energi (kWh) antar-periode
          </p>
        </div>
        <span className="px-2.5 py-1 bg-slate-200 text-slate-700 text-xs font-semibold rounded-md">
          Data simulasi
        </span>
      </div>

      <div className="p-4 mb-6 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
        <strong>Sorotan Otomatis:</strong> Pemakaian{" "}
        <strong>Kipas Angin</strong> naik <strong>50%</strong> dibanding periode
        lalu karena durasi menyala meningkat dari rata-rata 8 jam/hari menjadi
        12 jam/hari.
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sampleComparison}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="nama" />
            <YAxis unit=" kWh" />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="periodeLalu"
              name="Periode Lalu (kWh)"
              fill="#94a3b8"
              radius={[6, 6, 0, 0]}
            />
            <Bar
              dataKey="periodeIni"
              name="Periode Ini (kWh)"
              fill="#0d9488"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </AppShell>
  );
}
