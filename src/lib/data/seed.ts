import type { Experiment } from "@/types/experiment";

export const DEFAULT_SEED = 20240917;
/** The newest day that has measurements. */
export const DATA_END_DATE = "2026-11-18";
/** The demo "today" (day after the last measurements). */
export const DEMO_TODAY = "2026-11-19";
export const TOTAL_DAYS = 90;

/** Index positions (0 = oldest day) of the scripted events in the synthetic history. */
export const EVENTS = {
  walk: { start: 34, days: 14 },
  walkAdherence: [true, true, true, true, false, true, true, true, true, true, false, true, true, true] as boolean[],
  highLoad: { start: 72, end: 86 },
  driftRampStart: 74,
  driftFull: 79,
  travelBlip: [55, 56],
  mobilityDip: { start: 50, end: 64 },
  stairDeclineStart: 60,
  workouts: { running: 85, cycling: 80, walking: 88 },
};

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createGaussian(rng: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    const mag = Math.sqrt(-2 * Math.log(u));
    spare = mag * Math.sin(2 * Math.PI * v);
    return mag * Math.cos(2 * Math.PI * v);
  };
}

export const SAMPLE_PROFILE = { name: "Alex Rivera", age: 34 };

/** Builds the initial experiments shipped with the demo (dates derived from the dataset start). */
export function buildSampleExperiments(dateAt: (index: number) => string): Experiment[] {
  const walkStart = dateAt(EVENTS.walk.start);
  const walkEnd = dateAt(EVENTS.walk.start + EVENTS.walk.days - 1);
  const walkAdherence: Record<string, boolean> = {};
  EVENTS.walkAdherence.forEach((ok, i) => {
    walkAdherence[dateAt(EVENTS.walk.start + i)] = ok;
  });

  const bedStartIdx = 80;
  const bedAdh: Record<string, boolean> = {};
  const bedPattern = [true, true, false, true, true, true, false, true, true, true];
  bedPattern.forEach((ok, i) => {
    bedAdh[dateAt(bedStartIdx + i)] = ok;
  });

  return [
    {
      id: "exp-morning-walk",
      name: "Morning Walk Experiment",
      category: "Lifestyle",
      hypothesis: "A 20-minute morning outdoor walk may improve sleep consistency and recovery indicators.",
      behaviour: "Walk outdoors for 20 minutes within one hour of waking.",
      durationDays: 14,
      primaryMetric: "sleepDuration",
      secondaryMetrics: ["hrv", "restingHr", "daylight"],
      status: "completed",
      createdAt: dateAt(EVENTS.walk.start - 3),
      startDate: walkStart,
      pausedOn: null,
      completedOn: walkEnd,
      adherence: walkAdherence,
      isSample: true,
    },
    {
      id: "exp-consistent-bedtime",
      name: "Consistent Bedtime",
      category: "Sleep",
      hypothesis: "Going to bed within a 30-minute window each night may raise sleep efficiency and HRV.",
      behaviour: "Be in bed by 22:45 (±15 min) every night, including weekends.",
      durationDays: 14,
      primaryMetric: "sleepEfficiency",
      secondaryMetrics: ["sleepConsistency", "hrv", "restingHr"],
      status: "active",
      createdAt: dateAt(bedStartIdx - 1),
      startDate: dateAt(bedStartIdx),
      pausedOn: null,
      completedOn: null,
      adherence: bedAdh,
      isSample: true,
    },
    {
      id: "exp-caffeine-cutoff",
      name: "Afternoon Caffeine Cut-off",
      category: "Nutrition",
      hypothesis: "Stopping caffeine after 13:00 may shorten time to fall asleep and improve deep sleep.",
      behaviour: "No coffee, tea or energy drinks after 13:00.",
      durationDays: 21,
      primaryMetric: "deepDuration",
      secondaryMetrics: ["sleepEfficiency", "restingHr"],
      status: "draft",
      createdAt: dateAt(88),
      startDate: null,
      pausedOn: null,
      completedOn: null,
      adherence: {},
      isSample: true,
    },
  ];
}
