"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase";
import {
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Copy,
  KeyRound,
} from "lucide-react";

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function PerangkatPage() {
  const router = useRouter();
  const supabase = createClient();
  const [devices, setDevices] = useState<any[]>([]);
  const [nama, setNama] = useState("");
  const [jenisBeban, setJenisBeban] = useState("Kipas Angin");
  const [dayaNominal, setDayaNominal] = useState("30");
  const [generatedCreds, setGeneratedCreds] = useState<{
    id: string;
    key: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadDevices = async () => {
    const { data } = await supabase
      .from("devices")
      .select("*")
      .order("created_at", { ascending: true });
    setDevices(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
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

    // Pastikan profil user tersedia di tabel profiles
    await supabase
      .from("profiles")
      .upsert(
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

    const { data, error } = await supabase
      .from("devices")
      .insert({
        user_id: user.id,
        nama,
        jenis_beban: jenisBeban,
        daya_nominal_w: Number(dayaNominal),
        ingest_key_hash: keyHash,
      })
      .select()
      .single();

    setSubmitting(false);

    if (error) {
      setErrorMsg("Gagal menyimpan perangkat: " + error.message);
      return;
    }

    if (data) {
      setGeneratedCreds({ id: data.id, key: rawApiKey });
      setNama("");
      loadDevices();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus perangkat ini beserta seluruh riwayat bacaannya?"))
      return;
    await supabase.from("devices").delete().eq("id", id);
    loadDevices();
  };

  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    return Date.now() - new Date(lastSeen).getTime() <= 2 * 60 * 1000;
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Manajemen Perangkat & Alat IoT
      </h1>
      <p className="text-sm text-slate-600 mb-6">
        1 alat PZEM-004T memantau 1 perangkat elektronik (maksimal beban 600 W).
      </p>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl">
          {errorMsg}
        </div>
      )}

      {generatedCreds && (
        <div className="mb-6 p-5 bg-amber-50 border border-amber-300 rounded-2xl">
          <div className="flex items-center gap-2 font-bold text-amber-900 mb-2">
            <KeyRound className="w-5 h-5" />
            <span>
              Simpan Kredensial Alat Sekarang (Hanya Ditampilkan Sekali!)
            </span>
          </div>
          <p className="text-xs text-amber-800 mb-3">
            Salin kedua nilai ini ke dalam variabel <code>deviceId</code> dan{" "}
            <code>apiKey</code> pada kode ESP32 Anda:
          </p>
          <div className="space-y-2 text-xs font-mono bg-white p-3 rounded-xl border border-amber-200">
            <div className="flex justify-between items-center">
              <span>
                <strong>device_id:</strong> {generatedCreds.id}
              </span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(generatedCreds.id)}
                className="text-teal-700 flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" /> Salin
              </button>
            </div>
            <div className="flex justify-between items-center">
              <span>
                <strong>api_key:</strong> {generatedCreds.key}
              </span>
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard.writeText(generatedCreds.key)
                }
                className="text-teal-700 flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" /> Salin
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setGeneratedCreds(null)}
            className="mt-3 px-4 py-1.5 bg-amber-800 text-white text-xs font-semibold rounded-lg"
          >
            Saya Sudah Menyalinnya
          </button>
        </div>
      )}

      <form
        onSubmit={handleAddDevice}
        className="bg-white p-5 rounded-2xl border border-slate-200 mb-8 grid md:grid-cols-4 gap-4 items-end"
      >
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Nama Perangkat
          </label>
          <input
            type="text"
            required
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Misal: Kipas Kamar"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Jenis Beban
          </label>
          <select
            value={jenisBeban}
            onChange={(e) => setJenisBeban(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option>Kipas Angin</option>
            <option>Lampu Meja</option>
            <option>Teko Listrik</option>
            <option>Lainnya (&le; 600W)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Daya Nominal (Watt)
          </label>
          <input
            type="number"
            required
            min="1"
            max="600"
            value={dayaNominal}
            onChange={(e) => setDayaNominal(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center justify-center gap-2 py-2 px-4 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />{" "}
          {submitting ? "Menyimpan..." : "Tambah Perangkat"}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">Memuat perangkat...</p>
      ) : devices.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
          <p className="font-semibold text-slate-700">
            Tambah perangkat pertama Anda
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Gunakan formulir di atas untuk mendapatkan ID dan Kunci Alat ESP32.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {devices.map((dev) => {
            const online = isOnline(dev.last_seen_at);
            return (
              <div
                key={dev.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 flex justify-between items-start"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-slate-900">{dev.nama}</h3>
                    {online ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" /> Online
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <XCircle className="w-3 h-3" /> Offline
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {dev.jenis_beban} • Nominal {dev.daya_nominal_w} W
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    Terakhir terhubung:{" "}
                    {dev.last_seen_at
                      ? new Date(dev.last_seen_at).toLocaleTimeString("id-ID")
                      : "Menunggu data pertama..."}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(dev.id)}
                  className="p-2 text-slate-400 hover:text-red-600 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
