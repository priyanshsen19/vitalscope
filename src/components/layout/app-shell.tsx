"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DesktopSidebar, MobileDrawer } from "./sidebar";
import { Topbar } from "./topbar";
import { TabBar } from "./tab-bar";
import { AppProvider } from "@/lib/store/app-context";
import { Hydrated } from "@/components/shared/hydrated";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  useEffect(() => setDrawer(false), [pathname]);
  return (
    <div className="flex min-h-screen">
      <DesktopSidebar />
      <MobileDrawer open={drawer} onClose={() => setDrawer(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setDrawer(true)} />
        <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10 lg:pt-8">
          <Hydrated>{children}</Hydrated>
        </main>
        <TabBar />
      </div>
    </div>
  );
}
