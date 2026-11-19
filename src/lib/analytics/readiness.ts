import type { Dataset, SourceId } from "@/types/health";
import { getSeries } from "@/lib/data/selectors";
import { calculateBaseline, calculateZScore, meanOver } from "./baseline";
import { clamp } from "@/lib/utils";

export interface RingScore {
  key: "recovery" | "sleep" | "move";
  label: string;
  color: "cyan" | "violet" | "lime";
  /** 0..1 fill of the ring */
  progress: number;
  value: string;
  target: string;
  detail: string;
  available: boolean;
}

export interface Readiness {
  score: number | null;
  label: string;
  message: string;
  rings: RingScore[];
  components: { label: string; z: number | null }[];
}

const STEP_GOAL = 10000;
const SLEEP_GOAL = 8;

/**
 * Daily readiness: a transparent 0–100 index from how the last 3 days of recovery
 * and sleep signals compare with the personal baseline (first 30 days).
 * 75 = typical for you; each favourable standard deviation adds 12 points.
 */
export function calculateReadiness(ds: Dataset, source: SourceId): Readiness {
  const last = ds.days.length - 1;
  const z = (key: Parameters<typeof getSeries>[1], invert = false) => {
    const s = getSeries(ds, key, source);
    if (!s) return null;
    const b = calculateBaseline(s, 0, 29);
    const m = meanOver(s, last - 2, last).mean;
    const v = calculateZScore(m, b?.mean, b?.sd);
    return v === null ? null : invert ? -v : v;
  };
  const zHrv = z("hrv");
  const zRhr = z("restingHr", true);
  const zEff = z("sleepEfficiency");
  const zDur = z("sleepDuration");
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const recZ = avg([zHrv, zRhr]);
  const sleepZ = avg([zEff, zDur]);
  const recScore = recZ === null ? null : clamp(75 + 12 * recZ, 0, 100);
  const sleepScore = sleepZ === null ? null : clamp(75 + 12 * sleepZ, 0, 100);
  const parts = [recScore, sleepScore].filter((x): x is number => x !== null);
  const score = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;

  const steps = getSeries(ds, "steps", source)?.[last]?.value ?? null;
  const sleepH = getSeries(ds, "sleepDuration", source)?.[last]?.value ?? null;

  const label = score === null ? "Not enough data" : score >= 80 ? "Primed" : score >= 65 ? "Steady" : score >= 50 ? "Take it a little easier" : "Prioritise recovery";
  const message = score === null
    ? "Recovery and sleep signals are not available from this data source."
    : score >= 80 ? "Your heart and sleep look better than usual. A good day for something more active."
      : score >= 65 ? "Your heart and sleep look about normal for you. Carry on as planned and keep your sleep routine."
        : score >= 50 ? "A few readings are a bit lower than usual. A moderate day may suit you."
          : "Your heart and sleep readings have been off from your usual for a few days. An easier day and an early night may help.";

  return {
    score,
    label,
    message,
    components: [
      { label: "HRV", z: zHrv },
      { label: "Resting HR", z: zRhr },
      { label: "Sleep efficiency", z: zEff },
      { label: "Sleep duration", z: zDur },
    ],
    rings: [
      {
        key: "recovery", label: "Recovery", color: "cyan", available: recScore !== null,
        progress: (recScore ?? 0) / 100, value: recScore === null ? "—" : `${Math.round(recScore)}`, target: "/100",
        detail: "HRV and resting heart rate over the last 3 days compared with your first 30 days.",
      },
      {
        key: "sleep", label: "Sleep", color: "violet", available: sleepH !== null,
        progress: sleepH === null ? 0 : Math.min(1, sleepH / SLEEP_GOAL), value: sleepH === null ? "—" : `${Math.floor(sleepH)}h ${String(Math.round((sleepH % 1) * 60)).padStart(2, "0")}m`, target: `of ${SLEEP_GOAL}h`,
        detail: `Last night’s sleep against an ${SLEEP_GOAL}-hour goal.`,
      },
      {
        key: "move", label: "Move", color: "lime", available: steps !== null,
        progress: steps === null ? 0 : Math.min(1, steps / STEP_GOAL), value: steps === null ? "—" : steps.toLocaleString("en-US"), target: `of ${(STEP_GOAL / 1000).toFixed(0)}k steps`,
        detail: `Yesterday’s steps against a ${STEP_GOAL.toLocaleString("en-US")}-step goal.`,
      },
    ],
  };
}
