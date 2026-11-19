"use client";

import { useMemo } from "react";
import { useApp } from "./app-context";
import { buildNotifications, buildTimeline, generateInsights } from "@/lib/analytics/insights";

/** Shared, memoised analysis for the current dataset, data source and experiments. */
export function useAnalysis() {
  const { dataset, settings, experiments } = useApp();
  return useMemo(() => {
    const ctx = { ds: dataset, source: settings.source, experiments, units: settings.units };
    const { insights, drift, trends } = generateInsights(ctx);
    return {
      ctx,
      insights,
      drift,
      trends,
      timeline: buildTimeline(ctx, drift, trends),
      notifications: buildNotifications(ctx, drift, trends),
    };
  }, [dataset, settings.source, settings.units, experiments]);
}
