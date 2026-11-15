"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { Zap } from "lucide-react";

export default function MasukPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      { email, password },
    );

    if (signInError || !data.user) {
      setError("Email atau password tidak sesuai.");
      setLoading(false);
      return;
    }

    const { count } = await supabase
      .from("devices")
      .select("*", { count: "exact", head: true })
      .eq("user_id", data.user.id);

    if ((count || 0) === 0) {
      router.push("/perangkat");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <div className="flex items-center gap-2 font-bold text-teal-700 text-xl mb-6">
          <Zap className="w-6 h-6" />
          <span>Masuk ke Akun</span>
        </div>

        {error && (
          <div className="p-3 mb-4 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? "Memeriksa..." : "Masuk"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Belum punya akun?{" "}
          <Link
            href="/daftar"
            className="text-teal-700 font-semibold hover:underline"
          >
            Daftar sekarang
          </Link>
        </p>
      </div>
    </div>
  );
}
