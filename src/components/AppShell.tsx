"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  LayoutDashboard,
  Activity,
  Bell,
  PieChart,
  ArrowLeftRight,
  PiggyBank,
  Cpu,
  LogOut,
  Zap,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pantau", label: "Pantau", icon: Activity },
  { href: "/cek", label: "Cek", icon: PieChart },
  { href: "/bandingkan", label: "Bandingkan", icon: ArrowLeftRight },
  { href: "/hemat", label: "Hemat", icon: PiggyBank },
  { href: "/pengingat", label: "Pengingat", icon: Bell },
  { href: "/perangkat", label: "Perangkat", icon: Cpu },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/masuk");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-white border-r border-slate-200 p-4 justify-between">
        <div>
          <div className="flex items-center gap-2 font-bold text-teal-700 text-lg px-3 py-2 mb-6">
            <Zap className="w-6 h-6 fill-teal-600 text-teal-600" />
            <span>Smart Tracker</span>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                    active
                      ? "bg-teal-50 text-teal-700 font-semibold"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl"
        >
          <LogOut className="w-5 h-5" /> Keluar
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-6xl w-full mx-auto">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex justify-around py-2 z-50">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center text-[11px] ${active ? "text-teal-700 font-bold" : "text-slate-500"}`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/perangkat"
          className={`flex flex-col items-center text-[11px] ${pathname === "/perangkat" ? "text-teal-700 font-bold" : "text-slate-500"}`}
        >
          <Cpu className="w-5 h-5 mb-0.5" />
          Alat
        </Link>
      </nav>
    </div>
  );
}
