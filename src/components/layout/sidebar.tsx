"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronsLeft, ChevronsRight, Database, FlaskConical, Settings, User, X, Radar } from "lucide-react";
import { navFor } from "./nav";
import { useApp } from "@/lib/store/app-context";
import { cn } from "@/lib/utils";

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { settings } = useApp();
  return (
    <nav aria-label="Primary" className="flex flex-col gap-0.5">
      {navFor(settings.viewMode).map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={cn("group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors", active ? "text-fg" : "text-muted hover:text-fg")}
          >
            {active ? <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl border border-border bg-surface-2" transition={{ type: "spring", stiffness: 500, damping: 40 }} /> : null}
            {active ? <span className="absolute -left-3 top-2 bottom-2 w-0.5 rounded-full bg-lime" /> : null}
            <Icon className={cn("relative z-10 h-4 w-4 shrink-0", active && "text-lime")} />
            {!collapsed ? <span className="relative z-10 truncate">{item.label}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link href="/overview" className="flex h-14 items-center gap-2.5 px-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-lime to-cyan text-[rgb(9_11_16)] shadow-[0_6px_18px_-6px_rgb(var(--lime)/0.7)]"><Radar className="h-4 w-4" strokeWidth={2.4} /></span>
      {!collapsed ? <span className="text-[15px] font-semibold tracking-tight">Vitalscope</span> : null}
    </Link>
  );
}

function Bottom({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { settings, isReal, dataset } = useApp();
  const pathname = usePathname();
  const settingsActive = pathname.startsWith("/settings");
  return (
    <div className="mt-auto space-y-1 border-t border-border pt-3">
      {isReal ? (
        <Link href="/data-sources#real" onClick={onNavigate} className={cn("mb-2 flex items-center gap-2 rounded-xl border border-cyan/25 bg-cyan/5 px-2.5 py-2 hover:bg-cyan/10", collapsed && "justify-center px-0")} title="Real data from a public research dataset">
          <Database className="h-3.5 w-3.5 shrink-0 text-cyan" />
          {!collapsed ? <div className="leading-tight"><p className="text-[11px] font-semibold text-cyan">Real data</p><p className="text-[10px] text-muted">{dataset.provenance?.dataset} · {dataset.provenance?.device}</p></div> : null}
        </Link>
      ) : (
        <div className={cn("mb-2 flex items-center gap-2 rounded-xl border border-lime/25 bg-lime/5 px-2.5 py-2", collapsed && "justify-center px-0")} title="Demo mode: all data is simulated">
          <FlaskConical className="h-3.5 w-3.5 shrink-0 text-lime" />
          {!collapsed ? <div className="leading-tight"><p className="text-[11px] font-semibold text-lime">Demo Mode</p><p className="text-[10px] text-muted">{settings.viewMode === "simple" ? "Simple view · simulated data" : "Simulated measurements"}</p></div> : null}
        </div>
      )}
      <Link href="/settings" onClick={onNavigate} aria-current={settingsActive ? "page" : undefined} className={cn("flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors hover:text-fg", settingsActive ? "bg-surface-2 text-fg" : "text-muted")} title={collapsed ? "Settings" : undefined}>
        <Settings className="h-4 w-4 shrink-0" />{!collapsed ? "Settings" : null}
      </Link>
      <Link href="/settings#profile" onClick={onNavigate} className="flex h-10 items-center gap-2.5 rounded-md px-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg" title={collapsed ? settings.profileName : undefined}>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet/20 text-[10px] font-semibold text-violet">{settings.profileName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase() || <User className="h-3 w-3" />}</span>
        {!collapsed ? <span className="truncate text-fg">{settings.profileName}</span> : null}
      </Link>
    </div>
  );
}

export function DesktopSidebar() {
  const { settings, updateSettings } = useApp();
  const collapsed = settings.sidebarCollapsed;
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 232 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border/60 bg-surface/40 px-3 pb-3 backdrop-blur-xl lg:flex"
    >
      <Brand collapsed={collapsed} />
      <div className="mt-2"><NavList collapsed={collapsed} /></div>
      <Bottom collapsed={collapsed} />
      <button
        onClick={() => updateSettings({ sidebarCollapsed: !collapsed })}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-[18px] z-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-muted hover:text-fg"
      >
        {collapsed ? <ChevronsRight className="h-3 w-3" /> : <ChevronsLeft className="h-3 w-3" />}
      </button>
    </motion.aside>
  );
}

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog" aria-label="Navigation"
            className="absolute inset-y-0 left-0 flex w-[260px] flex-col border-r border-border bg-surface px-3 pb-3"
            initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between"><Brand collapsed={false} />
              <button onClick={onClose} aria-label="Close navigation" className="rounded-md p-1.5 text-muted hover:text-fg"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-2"><NavList collapsed={false} onNavigate={onClose} /></div>
            <Bottom collapsed={false} onNavigate={onClose} />
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
