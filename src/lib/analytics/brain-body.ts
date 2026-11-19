import type { Workout, WorkoutSample } from "@/types/health";
import { calculateMean, pearson } from "./baseline";

export type BBSignal = "brainFlow" | "entropy" | "hr" | "hrv" | "rr";

export const BB_SIGNALS: { key: BBSignal; label: string; unit: string; simulatedTemple: boolean; decimals: number; colorVar: string }[] = [
  { key: "brainFlow", label: "BrainFlow Index", unit: "index", simulatedTemple: true, decimals: 1, colorVar: "violet" },
  { key: "entropy", label: "Entropy", unit: "a.u.", simulatedTemple: true, decimals: 3, colorVar: "amber" },
  { key: "hr", label: "Heart rate", unit: "bpm", simulatedTemple: true, decimals: 0, colorVar: "cyan" },
  { key: "hrv", label: "HRV", unit: "ms", simulatedTemple: true, decimals: 1, colorVar: "lime" },
  { key: "rr", label: "Respiratory rate", unit: "br/min", simulatedTemple: true, decimals: 1, colorVar: "danger" },
];

const mean = (xs: number[]) => calculateMean(xs) ?? 0;
const col = (s: WorkoutSample[], k: BBSignal) => s.map((x) => (k === "brainFlow" ? x.brainFlow : k === "entropy" ? x.entropy : k === "hr" ? x.hr : k === "hrv" ? x.hrv : x.rr));

export interface WorkoutSummary {
  id: string;
  name: string;
  intensityLabel: Workout["intensityLabel"];
  durationMin: number;
  rpe: number;
  preHr: number;
  avgHr: number;
  peakHr: number;
  hrRecovery1: number;
  hrRecovery5: number;
  hrvPre: number;
  hrvDuringPct: number;
  hrvRecoveryPct: number;
  bfPre: number;
  bfPeakDelta: number;
  bfPeakAt: number;
  bfEndDelta: number;
  bfRecoveryDelta: number;
  entropyPre: number;
  entropyMinDelta: number;
  entropyRecoveryDelta: number;
  corrHrBf: number | null;
  corrHrEntropy: number | null;
}

export function summarizeWorkout(w: Workout): WorkoutSummary {
  const D = w.durationMin;
  const pre = w.samples.filter((s) => s.phase === "before");
  const dur = w.samples.filter((s) => s.phase === "during");
  const rec = w.samples.filter((s) => s.phase === "recovery");
  const at = (t: number) => w.samples.find((s) => s.t === t) ?? w.samples[w.samples.length - 1];
  const preHr = mean(pre.map((s) => s.hr));
  const hrvPre = mean(pre.map((s) => s.hrv));
  const bfPre = mean(pre.map((s) => s.brainFlow));
  const enPre = mean(pre.map((s) => s.entropy));
  const bfs = dur.map((s) => s.brainFlow);
  const peakIdx = bfs.indexOf(Math.max(...bfs));
  const tailDur = dur.slice(-3);
  const tailRec = rec.slice(-3);
  return {
    id: w.id,
    name: w.name,
    intensityLabel: w.intensityLabel,
    durationMin: D,
    rpe: w.rpe,
    preHr,
    avgHr: mean(dur.map((s) => s.hr)),
    peakHr: Math.max(...dur.map((s) => s.hr)),
    hrRecovery1: at(D - 1).hr - at(D + 1).hr,
    hrRecovery5: at(D - 1).hr - at(D + 5).hr,
    hrvPre,
    hrvDuringPct: ((mean(dur.map((s) => s.hrv)) - hrvPre) / hrvPre) * 100,
    hrvRecoveryPct: ((mean(tailRec.map((s) => s.hrv)) - hrvPre) / hrvPre) * 100,
    bfPre,
    bfPeakDelta: Math.max(...bfs) - bfPre,
    bfPeakAt: dur[peakIdx]?.t ?? 0,
    bfEndDelta: mean(tailDur.map((s) => s.brainFlow)) - bfPre,
    bfRecoveryDelta: mean(tailRec.map((s) => s.brainFlow)) - bfPre,
    entropyPre: enPre,
    entropyMinDelta: Math.min(...dur.map((s) => s.entropy)) - enPre,
    entropyRecoveryDelta: mean(tailRec.map((s) => s.entropy)) - enPre,
    corrHrBf: pearson(col(dur, "hr"), col(dur, "brainFlow"))?.r ?? null,
    corrHrEntropy: pearson(col(dur, "hr"), col(dur, "entropy"))?.r ?? null,
  };
}

export interface CrossObservation {
  id: string;
  title: string;
  text: string;
  evidence: { label: string; value: string }[];
}

const sign = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}`;

export function compareWorkoutResponses(workouts: Workout[], selectedId: string): { summaries: WorkoutSummary[]; observations: CrossObservation[] } {
  const summaries = workouts.map(summarizeWorkout);
  const sel = summaries.find((s) => s.id === selectedId) ?? summaries[0];
  const obs: CrossObservation[] = [];
  if (!sel) return { summaries, observations: obs };

  const others = summaries.filter((s) => s.id !== sel.id);
  const hrUp = sel.avgHr - sel.preHr;
  const bfDirection = sel.bfEndDelta < 0 ? "below" : "above";

  obs.push({
    id: "selected-trajectories",
    title: `${sel.name}: different trajectories`,
    text: `During the selected session, BrainFlow ${sel.bfPeakDelta >= 1 ? `peaked ${sign(sel.bfPeakDelta)} at minute ${sel.bfPeakAt}` : "changed only slightly"} and finished the exercise ${Math.abs(sel.bfEndDelta).toFixed(1)} points ${bfDirection} its pre-exercise level, while heart rate averaged ${hrUp.toFixed(0)} bpm above its pre-exercise level and peaked at ${sel.peakHr.toFixed(0)} bpm. The signals followed different trajectories across exercise and recovery.`,
    evidence: [
      { label: "BrainFlow (pre → peak → end)", value: `${sel.bfPre.toFixed(1)} → ${sign(sel.bfPeakDelta)} → ${sign(sel.bfEndDelta)}` },
      { label: "Heart rate (pre → avg → peak)", value: `${sel.preHr.toFixed(0)} → ${sel.avgHr.toFixed(0)} → ${sel.peakHr.toFixed(0)} bpm` },
      { label: "HRV during exercise", value: `${sign(sel.hrvDuringPct, 0)}% vs pre-exercise` },
    ],
  });

  obs.push({
    id: "recovery",
    title: "Recovery period",
    text: `One minute after stopping, heart rate had dropped ${sel.hrRecovery1.toFixed(0)} bpm and ${sel.hrRecovery5.toFixed(0)} bpm after five minutes. By the end of the 15-minute recovery window HRV was ${sign(sel.hrvRecoveryPct, 0)}% relative to pre-exercise and BrainFlow was ${sign(sel.bfRecoveryDelta)} points from its starting level.`,
    evidence: [
      { label: "HR drop 1 / 5 min", value: `${sel.hrRecovery1.toFixed(0)} / ${sel.hrRecovery5.toFixed(0)} bpm` },
      { label: "Entropy at end of recovery", value: `${sign(sel.entropyRecoveryDelta, 3)} a.u. vs pre-exercise` },
    ],
  });

  const hi = summaries.find((s) => s.intensityLabel === "High");
  const mid = summaries.find((s) => s.intensityLabel === "Moderate");
  const lo = summaries.find((s) => s.intensityLabel === "Low");
  if (hi && mid) {
    obs.push({
      id: "moderate-vs-high",
      title: "Moderate vs high intensity",
      text: `Your moderate-intensity session showed a different relationship between recorded BrainFlow and Entropy compared with the high-intensity session: Entropy moved ${sign(mid.entropyMinDelta, 2)} (lowest point) and BrainFlow held ${sign(mid.bfEndDelta)} at the end of the cycling session, versus Entropy ${sign(hi.entropyMinDelta, 2)} and BrainFlow ${sign(hi.bfEndDelta)} in the run.`,
      evidence: [
        { label: "Running · HR↔BrainFlow correlation", value: hi.corrHrBf === null ? "—" : `r = ${hi.corrHrBf.toFixed(2)}` },
        { label: "Cycling · HR↔BrainFlow correlation", value: mid.corrHrBf === null ? "—" : `r = ${mid.corrHrBf.toFixed(2)}` },
        { label: "Running · HR↔Entropy correlation", value: hi.corrHrEntropy === null ? "—" : `r = ${hi.corrHrEntropy.toFixed(2)}` },
        { label: "Cycling · HR↔Entropy correlation", value: mid.corrHrEntropy === null ? "—" : `r = ${mid.corrHrEntropy.toFixed(2)}` },
      ],
    });
  }
  if (lo && others.length) {
    obs.push({
      id: "low-intensity",
      title: "Low intensity",
      text: `The low-intensity walk produced the smallest cardiovascular response (average ${lo.avgHr.toFixed(0)} bpm, HRV ${sign(lo.hrvDuringPct, 0)}%), with BrainFlow ${sign(lo.bfPeakDelta)} at its highest and Entropy ${sign(lo.entropyRecoveryDelta, 3)} after recovery.`,
      evidence: [{ label: "Walking · peak HR", value: `${lo.peakHr.toFixed(0)} bpm` }],
    });
  }
  return { summaries, observations: obs };
}

export function windowSamples(w: Workout, win: "full" | "during" | "recovery" | "before-during"): WorkoutSample[] {
  if (win === "full") return w.samples;
  if (win === "during") return w.samples.filter((s) => s.phase === "during");
  if (win === "recovery") return w.samples.filter((s) => s.phase === "recovery");
  return w.samples.filter((s) => s.phase !== "recovery");
}

/** Change from the pre-exercise mean for one signal, aligned to exercise start. */
export function relativeToPre(w: Workout, key: BBSignal, mode: "delta" | "percent"): { t: number; value: number }[] {
  const pre = mean(col(w.samples.filter((s) => s.phase === "before"), key));
  return w.samples.map((s) => {
    const v = col([s], key)[0];
    return { t: s.t, value: mode === "percent" ? ((v - pre) / pre) * 100 : v - pre };
  });
}
