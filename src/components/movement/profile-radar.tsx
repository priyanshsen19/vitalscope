"use client";

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { useApp } from "@/lib/store/app-context";
import type { MovementProfileScores } from "@/lib/analytics/movement";

const AXES: { key: keyof MovementProfileScores; label: string }[] = [
  { key: "consistency", label: "Walking consistency" },
  { key: "regularity", label: "Step regularity" },
  { key: "symmetry", label: "Symmetry" },
  { key: "stairs", label: "Stair movement" },
  { key: "stability", label: "Stability" },
];

export function ProfileRadar({ current, baseline, label }: { current: MovementProfileScores; baseline: MovementProfileScores; label: string }) {
  const { motionEnabled } = useApp();
  const data = AXES.map((a) => ({ axis: a.label, baseline: baseline[a.key], current: current[a.key] }));
  return (
    <div className="h-[280px]" role="img" aria-label="Mobility profile radar chart comparing the selected period with your baseline">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="rgb(var(--border))" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: "rgb(var(--muted))", fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar name="Baseline (first 30 days)" dataKey="baseline" stroke="rgb(var(--muted))" fill="rgb(var(--muted))" fillOpacity={0.12} strokeDasharray="4 3" isAnimationActive={motionEnabled} />
          <Radar name={label} dataKey="current" stroke="rgb(var(--cyan))" fill="rgb(var(--cyan))" fillOpacity={0.25} strokeWidth={2} isAnimationActive={motionEnabled} animationDuration={900} />
          <Tooltip contentStyle={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 8, fontSize: 12 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
