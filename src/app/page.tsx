import Link from "next/link";
import { Zap, BellRing, PiggyBank, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-teal-700 text-xl">
          <Zap className="w-6 h-6 fill-teal-600 text-teal-600" />
          <span>Smart Tracker Listrik</span>
        </div>
        <div className="flex gap-3">
          <Link
            href="/masuk"
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-teal-700"
          >
            Masuk
          </Link>
          <Link
            href="/daftar"
            className="px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            Daftar Gratis
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-6 py-16 flex flex-col items-center text-center">
        <span className="px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-semibold mb-4">
          Monitoring IoT Perangkat Rumah Tangga
        </span>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 max-w-3xl mb-6">
          Ketahui Perangkat Paling Boros Sebelum Tagihan Listrik Membengkak
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mb-8">
          Pantau konsumsi daya perangkat elektronik terpantau secara otomatis,
          dapatkan peringatan dini, dan simulasikan penghematan biaya listrik
          harian Anda.
        </p>
        <div className="flex flex-wrap justify-center gap-4 mb-16">
          <Link
            href="/daftar"
            className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700"
          >
            Mulai Sekarang <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/masuk"
            className="px-6 py-3 bg-white border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-100"
          >
            Sudah Punya Akun
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6 w-full text-left">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg mb-2">1. Pantau Real-Time</h3>
            <p className="text-sm text-slate-600">
              Lihat daya (Watt), pemakaian kWh, dan estimasi biaya perangkat
              terpantau tanpa cek meteran manual.
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center mb-4">
              <BellRing className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg mb-2">2. Ingatkan Otomatis</h3>
            <p className="text-sm text-slate-600">
              Terima notifikasi in-app saat perangkat menyala terlalu lama atau
              estimasi biaya melewati batas.
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center mb-4">
              <PiggyBank className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg mb-2">3. Simulasi Hemat</h3>
            <p className="text-sm text-slate-600">
              Bandingkan pemakaian antar-periode dan pasang target penghematan
              untuk menekan biaya bulanan.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}