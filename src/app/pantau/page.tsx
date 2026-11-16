"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function PantauPage() {
  const supabase = createClient();
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState("all");
  const [readings, setReadings] = useState<any[]>([]);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: devs } = await supabase.from("devices").select("*");
      setDevices(devs || []);

      let query = supabase
        .from("readings")
        .select("*")
        .order("ts", { ascending: false })
        .limit(50);
      if (selectedDevice !== "all")
        query = query.eq("device_id", selectedDevice);
      const { data: reads } = await query;
      setReadings((reads || []).reverse());
    };
    load();
  }, [selectedDevice]);

  const chartData = readings.map((r) => ({
    waktu: new Date(r.ts).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    daya: Number(r.p),
    tegangan: Number(r.v),
  }));

  return (
    <AppShell>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Pantau Riwayat Pemakaian
          </h1>
          <p className="text-xs text-slate-500">
            Data terukur langsung dari sensor PZEM-004T
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
          >
            <option value="all">Semua Perangkat Terpantau</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nama}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowTable(!showTable)}
            className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-medium hover:bg-slate-100"
          >
            {showTable ? "Lihat Grafik" : "Lihat sebagai tabel"}
          </button>
        </div>
      </div>

      {!showTable ? (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="waktu" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="daya"
                name="Daya (Watt)"
                stroke="#0d9488"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-700 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Tegangan (V)</th>
                <th className="px-4 py-3">Arus (A)</th>
                <th className="px-4 py-3">Daya (W)</th>
                <th className="px-4 py-3">Energi (Wh)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {readings
                .slice()
                .reverse()
                .map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5">
                      {new Date(r.ts).toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-2.5">{r.v} V</td>
                    <td className="px-4 py-2.5">{r.i} A</td>
                    <td className="px-4 py-2.5 font-semibold">{r.p} W</td>
                    <td className="px-4 py-2.5">{r.e_wh} Wh</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
