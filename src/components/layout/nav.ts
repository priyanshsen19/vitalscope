import { Activity, BookOpenCheck, Brain, Database, FlaskConical, Footprints, HeartPulse, LayoutDashboard, Lightbulb, Sprout, type LucideIcon } from "lucide-react";
import type { ViewMode } from "@/types/health";

export interface NavItem { href: string; label: string; icon: LucideIcon; title: string }

const TODAY: NavItem = { href: "/overview", label: "Today", icon: LayoutDashboard, title: "Today" };
const HOW: NavItem = { href: "/how-it-works", label: "How it works", icon: BookOpenCheck, title: "How Vitalscope works" };
const MY_BODY: NavItem = { href: "/my-body", label: "My Body", icon: HeartPulse, title: "My Body" };

export const NAV: NavItem[] = [
  TODAY,
  MY_BODY,
  { href: "/health-drift", label: "Health Drift", icon: Activity, title: "Health Drift Detection" },
  { href: "/experiments", label: "Experiments", icon: FlaskConical, title: "Personal Health Experiments" },
  { href: "/movement", label: "Movement", icon: Footprints, title: "Movement Intelligence" },
  { href: "/brain-body", label: "Brain-Body", icon: Brain, title: "Brain-Body Intelligence" },
  { href: "/insights", label: "Insights", icon: Lightbulb, title: "Insights" },
  { href: "/data-sources", label: "Data Sources", icon: Database, title: "Data Sources" },
  HOW,
];

/** Simple view: three places, everyday names. */
export const NAV_SIMPLE: NavItem[] = [
  TODAY,
  MY_BODY,
  { href: "/experiments", label: "Habits", icon: Sprout, title: "Habits" },
  HOW,
];

export const navFor = (mode: ViewMode) => (mode === "simple" ? NAV_SIMPLE : NAV);

export function titleFor(pathname: string, mode: ViewMode = "detailed"): string {
  if (pathname.startsWith("/settings")) return "Settings";
  return navFor(mode).find((n) => pathname.startsWith(n.href))?.title ?? NAV.find((n) => pathname.startsWith(n.href))?.title ?? "Vitalscope";
}
