import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import type { DriftStatus } from "@/lib/analytics/drift-detection";
import type { MovementStatus } from "@/lib/analytics/movement";

export function TrendIcon({ dir, className = "h-3.5 w-3.5" }: { dir: "up" | "down" | "flat"; className?: string }) {
  return dir === "up" ? <ArrowUpRight className={className} /> : dir === "down" ? <ArrowDownRight className={className} /> : <ArrowRight className={className} />;
}

const driftMap: Record<DriftStatus, { tone: Tone; label: string }> = {
  drifting: { tone: "amber", label: "Drift detected" },
  building: { tone: "amber", label: "Watching" },
  favourable: { tone: "lime", label: "Favourable shift" },
  stable: { tone: "cyan", label: "Within baseline" },
  unavailable: { tone: "muted", label: "Unavailable" },
};
export function DriftStatusBadge({ status }: { status: DriftStatus }) {
  const m = driftMap[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

const moveMap: Record<MovementStatus, { tone: Tone; label: string }> = {
  improving: { tone: "lime", label: "Improving" },
  stable: { tone: "cyan", label: "Stable" },
  monitor: { tone: "amber", label: "Worth monitoring" },
  unavailable: { tone: "muted", label: "Unavailable" },
};
export function MovementStatusBadge({ status }: { status: MovementStatus }) {
  const m = moveMap[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
