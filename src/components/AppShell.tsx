// src/components/AppShell.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/supabase";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Pantau", href: "/pantau", icon: "monitoring" },
  { label: "Pengingat", href: "/pengingat", icon: "notifications" },
  { label: "Cek", href: "/cek", icon: "bolt" },
  { label: "Bandingkan", href: "/bandingkan", icon: "compare_arrows" },
  { label: "Hemat", href: "/hemat", icon: "savings" },
  { label: "Perangkat", href: "/perangkat", icon: "devices" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userName, setUserName] = useState<string>("Pengguna");
  const [userEmail, setUserEmail] = useState<string>("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email || "");
      const metaName =
        user.user_metadata?.nama ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "Pengguna";
      setUserName(metaName);
    };
    loadUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/masuk");
  };

  const activeNav =
    NAV_ITEMS.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) || NAV_ITEMS[0];

  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen w-full bg-surface text-on-surface flex">
      {/* SIDEBAR DESKTOP (Fixed Left 260px) */}
      <aside className="hidden lg:flex lg:w-[260px] lg:flex-col lg:fixed lg:inset-y-0 bg-surface-container-lowest border-r border-outline-variant/70 z-30">
        {/* Brand Logo */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-outline-variant/50">
          <div className="w-9 h-9 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shadow-2xs shrink-0">
            <span className="material-symbols-outlined text-[20px]">bolt</span>
          </div>
          <div className="min-w-0">
            <span className="font-extrabold text-base text-on-surface tracking-tight block truncate">
              Smart Tracker
            </span>
            <span className="text-[11px] font-medium text-on-surface-variant block">
              Pantau Listrik Perangkat
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3.5 py-5 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                  isActive
                    ? "bg-primary-fixed text-primary font-bold shadow-2xs"
                    : "text-on-surface-variant font-medium hover:bg-surface-container-low hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {item.icon}
                </span>
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Account & Logout */}
        <div className="p-4 border-t border-outline-variant/50">
          <div className="p-3 rounded-xl bg-surface-container-low flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary text-xs font-bold flex items-center justify-center shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-on-surface truncate">
                  {userName}
                </p>
                <p className="text-[11px] text-on-surface-variant truncate">
                  {userEmail}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Keluar Akun"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-error-container hover:text-error transition-colors cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">
                logout
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE DRAWER SIDEBAR */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs lg:hidden flex"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <aside className="w-[260px] h-full bg-surface-container-lowest flex flex-col justify-between p-4 shadow-xl">
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-outline-variant/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary-container text-on-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">
                      bolt
                    </span>
                  </div>
                  <span className="font-extrabold text-sm text-on-surface">
                    Smart Tracker
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    close
                  </span>
                </button>
              </div>

              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm ${
                        isActive
                          ? "bg-primary-fixed text-primary font-bold"
                          : "text-on-surface-variant font-medium hover:bg-surface-container-low"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2.5 px-4 rounded-xl bg-error-container/60 text-error text-sm font-semibold flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">
                logout
              </span>
              <span>Keluar</span>
            </button>
          </aside>
        </div>
      )}

      {/* MAIN CONTENT AREA (Full Width Desktop) */}
      <div className="flex-1 lg:pl-[260px] min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="h-16 sticky top-0 z-20 bg-surface-container-lowest/90 backdrop-blur-md border-b border-outline-variant/60 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka Menu"
              className="lg:hidden w-9 h-9 rounded-xl border border-outline-variant flex items-center justify-center text-on-surface hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-[20px]">
                menu
              </span>
            </button>
            <div className="min-w-0">
              <h1 className="font-bold text-lg sm:text-xl text-on-surface truncate">
                {activeNav.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/pengingat"
              title="Notifikasi Peringatan"
              className="w-9 h-9 rounded-xl border border-outline-variant/80 bg-surface-container-lowest hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">
                notifications
              </span>
            </Link>
            <div className="flex items-center gap-2 pl-2 border-l border-outline-variant/60">
              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary text-xs font-bold flex items-center justify-center">
                {initials}
              </div>
              <span className="hidden md:inline text-sm font-semibold text-on-surface whitespace-nowrap">
                {userName}
              </span>
            </div>
          </div>
        </header>

        {/* Page Body: Full Desktop Width */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
