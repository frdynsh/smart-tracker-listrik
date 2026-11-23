"use client";

import { useState } from "react";
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
  MoreHorizontal,
  X,
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
  const [moreOpen, setMoreOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/masuk");
  };

  // 4 menu utama di bar bawah mobile + 3 menu lainnya di drawer
  const mobileMainItems = [navItems[0], navItems[1], navItems[5], navItems[2]]; // Dashboard, Pantau, Pengingat, Cek
  const mobileMoreItems = [navItems[3], navItems[4], navItems[6]]; // Bandingkan, Hemat, Perangkat

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col md:flex-row antialiased tabular-nums">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-surface-container border-r border-outline-variant p-4 justify-between">
        <div>
          <div className="flex items-center gap-2.5 font-bold text-primary text-lg px-3 py-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div className="flex flex-col">
              <span className="leading-tight text-on-surface">
                Smart Tracker
              </span>
              <span className="text-[11px] font-semibold text-primary">
                Listrik Rumah Tangga
              </span>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[15px] font-medium transition-colors ${
                    active
                      ? "bg-primary text-on-primary font-semibold"
                      : "text-on-surface hover:bg-surface-container-low"
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t border-outline-variant">
          <p className="px-3 text-xs text-on-surface-variant leading-relaxed">
            1 alat PZEM-004T = 1 perangkat terpantau
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-semibold text-error hover:bg-error-container/60 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5 shrink-0" /> Keluar
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:pl-64 p-4 md:p-8 pb-24 md:pb-8 max-w-6xl w-full mx-auto">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface-container-lowest border-t border-outline-variant flex justify-around py-2 z-40">
        {mobileMainItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              className={`flex flex-col items-center text-[11px] px-2 py-0.5 transition-colors ${
                active ? "text-primary font-bold" : "text-on-surface-variant"
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              {item.label}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreOpen(!moreOpen)}
          className={`flex flex-col items-center text-[11px] px-2 py-0.5 ${
            mobileMoreItems.some((m) => m.href === pathname)
              ? "text-primary font-bold"
              : "text-on-surface-variant"
          }`}
        >
          <MoreHorizontal className="w-5 h-5 mb-0.5" />
          Lainnya
        </button>
      </nav>

      {/* Mobile Drawer untuk Menu Lainnya & Keluar */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/30 flex items-end">
          <div className="w-full bg-surface-container-lowest rounded-t-2xl p-4 border-t border-outline-variant space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
              <span className="text-sm font-bold text-on-surface">
                Menu Lainnya
              </span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="p-1 text-on-surface-variant"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {mobileMoreItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-3 p-3 rounded-xl text-[15px] font-medium ${
                    active
                      ? "bg-primary text-on-primary font-semibold"
                      : "text-on-surface hover:bg-surface-container-low"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-[15px] font-semibold text-error hover:bg-error-container/60"
            >
              <LogOut className="w-5 h-5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
