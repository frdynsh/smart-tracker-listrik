"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

const COLORS = ["#0d9488", "#f59e0b", "#3b82f6", "#8b5cf6"];

export default function CekPage() {
  const supabase = createClient();
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [tarif, setTarif] = useState(1444.7);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("tarif_per_kwh")
        .eq("id", user.id)
        .single();
      const currentTarif = prof ? Number(prof.tarif_per_kwh) : 1444.7;
      setTarif(currentTarif);

      const { data: devs } = await supabase.from("devices").select("*");
      const { data: reads } = await supabase
        .from("readings")
        .select("*")
        .order("ts", { ascending: true });

      const items = (devs || []).map((d) => {
        const dReads = (reads || []).filter((r) => r.device_id === d.id);
        const kwh =
          dReads.length > 1
            ? Math.max(
                0,
                Number(dReads[dReads.length - 1].e_wh) - Number(dReads[0].e_wh),
              ) / 1000
            : 0.01;
        return { name: d.nama, kwh, biaya: kwh * currentTarif };
      });

      const totalKwh = items.reduce((acc, cur) => acc + cur.kwh, 0) || 1;
      setBreakdown(
        items.map((it) => ({
          ...it,
          persen: ((it.kwh / totalKwh) * 100).toFixed(1),
        })),
      );
    };
    load();
  }, []);

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">
        Cek Kontribusi Perangkat
      </h1>
      <p className="text-xs text-slate-500 mb-6">
        Estimasi biaya perangkat terpantau (Tarif Rp{" "}
        {tarif.toLocaleString("id-ID")}/kWh • Tidak termasuk biaya beban/PPJ).
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 h-72 flex flex-col items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={breakdown}
                dataKey="kwh"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={4}
              >
                {breakdown.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
          <h2 className="font-bold text-slate-800">
            Rincian Perangkat Terpantau (Total 100%)
          </h2>
          {breakdown.map((item, idx) => (
            <div
              key={item.name}
              className="flex justify-between items-center border-b pb-3 last:border-none"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <div>
                  <p className="font-semibold text-sm text-slate-900">
                    {item.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.kwh.toFixed(3)} kWh • Rp{" "}
                    {Math.round(item.biaya).toLocaleString("id-ID")}
                  </p>
                </div>
              </div>
              <span className="font-bold text-teal-700">{item.persen}%</span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
