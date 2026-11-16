"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase";
import { Bell } from "lucide-react";

export default function PengingatPage() {
  const supabase = createClient();
  const [notifs, setNotifs] = useState<any[]>([]);
  const [durasiJam, setDurasiJam] = useState("8");
  const [batasRp, setBatasRp] = useState("50000");
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: n } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });
      setNotifs(n || []);

      const { data: rules } = await supabase.from("alert_rules").select("*");
      rules?.forEach((r) => {
        if (r.tipe === "durasi_lama") setDurasiJam(String(r.ambang));
        if (r.tipe === "estimasi_biaya") setBatasRp(String(r.ambang));
      });
    };
    load();
  }, []);

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("alert_rules")
      .update({ ambang: Number(durasiJam) })
      .eq("user_id", user.id)
      .eq("tipe", "durasi_lama");
    await supabase
      .from("alert_rules")
      .update({ ambang: Number(batasRp) })
      .eq("user_id", user.id)
      .eq("tipe", "estimasi_biaya");
    setSavedMsg("Pengaturan ambang peringatan berhasil disimpan.");
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        Pengingat & Ambang Peringatan
      </h1>

      <form
        onSubmit={handleSaveRules}
        className="bg-white p-5 rounded-2xl border border-slate-200 mb-8 grid md:grid-cols-3 gap-4 items-end"
      >
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Batas Durasi Menyala (Jam)
          </label>
          <input
            type="number"
            step="0.1"
            value={durasiJam}
            onChange={(e) => setDurasiJam(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Batas Estimasi Biaya (Rp)
          </label>
          <input
            type="number"
            value={batasRp}
            onChange={(e) => setBatasRp(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>
        <button
          type="submit"
          className="py-2 px-4 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700"
        >
          Simpan Ambang
        </button>
        {savedMsg && (
          <p className="text-xs text-emerald-700 md:col-span-3">{savedMsg}</p>
        )}
      </form>

      <h2 className="font-bold text-slate-800 mb-3">
        Riwayat Notifikasi In-App
      </h2>
      {notifs.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white p-6 rounded-2xl border border-slate-200">
          Belum ada notifikasi peringatan.
        </p>
      ) : (
        <div className="space-y-3">
          {notifs.map((n) => (
            <div
              key={n.id}
              className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center"
            >
              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-bold text-sm text-slate-900">{n.judul}</p>
                  <p className="text-xs text-slate-600">{n.isi}</p>
                </div>
              </div>
              <Link
                href={n.link || "/cek"}
                className="text-xs font-semibold text-teal-700 hover:underline"
              >
                Cek sekarang
              </Link>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
