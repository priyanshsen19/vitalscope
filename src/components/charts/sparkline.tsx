"use client";

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { useApp } from "@/lib/store/app-context";
import { cssColor } from "./time-series-chart";

export function Sparkline({ values, color = "cyan", height = 36 }: { values: (number | null)[]; color?: string; height?: number }) {
  const { motionEnabled } = useApp();
  const data = values.map((v, i) => ({ i, v }));
  const nums = values.filter((v): v is number => v !== null);
  const lo = Math.min(...nums), hi = Math.max(...nums);
  const pad = (hi - lo || 1) * 0.15;
  return (
    <div style={{ height }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={[lo - pad, hi + pad]} />
          <Line type="monotone" dataKey="v" stroke={cssColor(color)} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={motionEnabled} animationDuration={900} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
