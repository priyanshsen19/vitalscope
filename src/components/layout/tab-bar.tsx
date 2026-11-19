"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Settings } from "lucide-react";
import { NAV, NAV_SIMPLE, type NavItem } from "./nav";
import { useApp } from "@/lib/store/app-context";
import { cn } from "@/lib/utils";

const SETTINGS: NavItem = { href: "/settings", label: "Settings", icon: Settings, title: "Settings" };

/** Bottom tab bar on phones. */
export function TabBar() {
  const pathname = usePathname();
  const { settings } = useApp();
  const tabs = settings.viewMode === "simple" ? [...NAV_SIMPLE.slice(0, 3), SETTINGS] : NAV.slice(0, 5);
  return (
    <nav aria-label="Primary (mobile)" className="fixed inset-x-3 bottom-3 z-40 rounded-full border border-border/80 bg-surface/85 p-1.5 shadow-2xl shadow-black/40 backdrop-blur-xl lg:hidden">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => {
          const active = pathname.startsWith(t.href);
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined} className={cn("relative flex flex-col items-center gap-0.5 rounded-full py-1.5 text-[10px] font-medium", active ? "text-[rgb(9_11_16)]" : "text-muted")}>
                {active ? <motion.span layoutId="tab-active" className="absolute inset-0 rounded-full bg-lime" transition={{ type: "spring", stiffness: 500, damping: 40 }} /> : null}
                <Icon className="relative z-10 h-[18px] w-[18px]" />
                <span className="relative z-10 truncate leading-none">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
