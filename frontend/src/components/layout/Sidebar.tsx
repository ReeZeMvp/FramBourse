"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  DollarSign,
  Upload,
  Settings,
  BarChart2,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/performance", label: "Performance", icon: TrendingUp },
  { href: "/dividends", label: "Dividendes", icon: DollarSign },
  { href: "/geography", label: "Géographie", icon: Globe },
  { href: "/analysis", label: "Analyse", icon: BarChart2 },
  { href: "/import", label: "Importer", icon: Upload },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

export function Sidebar() {
  const path = usePathname();

  return (
    <aside className="w-16 lg:w-56 h-full bg-bg-card border-r border-zinc-800 flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center justify-center lg:justify-start px-4 border-b border-zinc-800">
        <span className="text-2xl">🍓</span>
        <span className="hidden lg:block ml-2 font-bold text-zinc-100 tracking-tight">
          Fram<span className="text-violet-400">Bourse</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 flex flex-col gap-1 px-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== "/" && path.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-violet-950 text-violet-300 shadow-glow"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              )}
            >
              <Icon size={18} className={active ? "text-violet-400" : ""} />
              <span className="hidden lg:block">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-zinc-800 hidden lg:block">
        <p className="text-xs text-zinc-600 text-center">FramBourse v1.0</p>
      </div>
    </aside>
  );
}
