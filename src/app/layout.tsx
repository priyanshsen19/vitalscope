import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Vitalscope — Personal Health Intelligence",
  description: "Understand your body beyond the numbers. Demo using simulated wearable measurements.",
};
export const viewport: Viewport = { themeColor: "#090b10" };

const themeScript = `try{var s=JSON.parse(localStorage.getItem('vitalscope:v1')||'{}').settings||{};var t=s.theme||'dark';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('light',!d);r.classList.toggle('dark',d);if(s.reducedMotion==='on')r.setAttribute('data-reduce-motion','true');}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-lime focus:px-3 focus:py-2 focus:text-sm focus:text-black">Skip to content</a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
