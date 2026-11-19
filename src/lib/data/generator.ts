import { addDays, format, getDay, parseISO } from "date-fns";
import type { DailyRecord, Dataset, MetricValues, Workout, WorkoutKind, WorkoutSample } from "@/types/health";
import { clamp } from "@/lib/utils";
import { createGaussian, DATA_END_DATE, DEFAULT_SEED, DEMO_TODAY, EVENTS, mulberry32, TOTAL_DAYS } from "./seed";

export function dateAtIndex(index: number, endDate = DATA_END_DATE, total = TOTAL_DAYS): string {
  return format(addDays(parseISO(endDate), index - (total - 1)), "yyyy-MM-dd");
}

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/** Deterministic: the same seed always yields exactly the same 90 days. */
export function generateDataset(seed: number = DEFAULT_SEED): Dataset {
  const rng = mulberry32(seed);
  const g = createGaussian(rng);
  const days: DailyRecord[] = [];

  let sleepLatent = 0;
  let walkE = 0;
  let walkCum = 0;
  const forced: Record<number, { min: number; rpe: number }> = {
    [EVENTS.workouts.running]: { min: 36, rpe: 8.5 },
    [EVENTS.workouts.cycling]: { min: 45, rpe: 6 },
    [EVENTS.workouts.walking]: { min: 40, rpe: 3 },
  };

  for (let i = 0; i < TOTAL_DAYS; i++) {
    const date = dateAtIndex(i);
    const dow = getDay(parseISO(date));
    const weekend = dow === 0 || dow === 6;

    const inHighLoad = i >= EVENTS.highLoad.start && i <= EVENTS.highLoad.end;
    const trainDay = [1, 3, 5, 6].includes(dow) || (inHighLoad && dow !== 0 && dow !== 2);

    // Workout of the day
    let workoutMin = 0;
    let rpe = 0;
    const draw1 = g();
    const draw2 = g();
    if (trainDay) {
      workoutMin = Math.round(clamp(40 + draw1 * 7, 25, 70) * (inHighLoad ? 1.15 : 1));
      rpe = clamp(5.3 + draw2 * 0.6 + (inHighLoad ? 2.8 : 0), 3, 9.5);
    }
    if (forced[i]) {
      workoutMin = forced[i].min;
      rpe = forced[i].rpe;
    }

    // Scripted effects
    const drift = i < EVENTS.driftRampStart ? 0 : Math.min(1, (i - EVENTS.driftRampStart + 1) / (EVENTS.driftFull - EVENTS.driftRampStart + 1));
    const blip = EVENTS.travelBlip.includes(i) ? 1 : 0;

    const wi = i - EVENTS.walk.start;
    const inWalk = wi >= 0 && wi < EVENTS.walk.days;
    let walkToday = 0;
    if (inWalk) {
      if (EVENTS.walkAdherence[wi]) {
        walkCum++;
        walkToday = 1;
        walkE = Math.min(1, walkCum / 5);
      } else {
        walkE *= 0.7;
      }
    } else if (wi >= EVENTS.walk.days) {
      walkE *= 0.85;
    }

    const { start: ms, end: me } = EVENTS.mobilityDip;
    const dip = i < ms ? 0 : i <= me ? Math.min(1, (i - ms + 1) / 4) : Math.max(0, 1 - (i - me) / 10);
    const stairDecline = i < EVENTS.stairDeclineStart ? 0 : Math.min(1, (i - EVENTS.stairDeclineStart + 1) / 10);

    sleepLatent = 0.5 * sleepLatent + g() * 0.8;

    // ---------- Apple Watch (simulated) ----------
    const restingHr = 62 + g() * 1.2 + 5.0 * drift + 3.0 * blip - 3.8 * walkE;
    const hrv = 50 + g() * 2.8 - 6.5 * drift - 4 * blip + 6.5 * walkE + 0.8 * sleepLatent;
    const respRate = 14.6 + g() * 0.35 + 0.7 * drift + 0.5 * blip - 0.2 * walkE;
    const sleepDuration = clamp(6.8 + (weekend ? 0.35 : 0) + 0.35 * sleepLatent + g() * 0.3 - 0.45 * drift - 0.9 * blip + 0.75 * walkE, 4.5, 9.5);
    const sleepEfficiency = clamp(90 + g() * 2.0 - 5.5 * drift - 7 * blip + 1.5 * walkE + 0.5 * sleepLatent, 70, 98);
    const sleepConsistency = clamp(78 + g() * 3.5 - 5 * drift - 6 * blip + 8 * walkE, 40, 99);
    const remShare = 0.215 + g() * 0.01;
    const deepShare = 0.155 + g() * 0.01 - 0.01 * drift;
    const sleepGap = rng() < 0.03;

    const steps = Math.max(1500, 8100 + (weekend ? 600 : 0) + g() * 1100 + 1900 * walkToday + (workoutMin > 0 ? 1500 : 0) - 700 * drift - 250 * dip);
    const exerciseMinutes = Math.max(5, 22 + workoutMin * 0.8 + walkToday * 20 + g() * 5);
    const activeEnergy = steps * 0.04 + exerciseMinutes * 4.5 + workoutMin * 3 + 120 + g() * 25;
    const walkingDistance = steps * 0.00071 + g() * 0.1;
    const avgHr = restingHr + 17 + g() * 1.5 + (workoutMin > 0 ? 3 : 0);
    const vo2Max = 44 + i * 0.012 + g() * 0.25 - 0.9 * drift;
    const daylight = Math.max(3, 26 + (weekend ? 8 : 0) + g() * 8 + 33 * walkToday);
    const noise = 66 + g() * 3.5 + (weekend ? -2 : 0);

    const walkingSpeed = 1.28 + g() * 0.022 - 0.09 * dip - 0.02 * drift;
    const stepLength = 68 + g() * 0.8 - 4.2 * dip - 0.5 * drift;
    const walkingAsymmetry = Math.max(0.3, 3.2 + g() * 0.45 + 1.4 * dip);
    const doubleSupport = 27.5 + g() * 0.6 + 1.6 * dip + 0.3 * drift;
    const stairAscent = 0.55 + g() * 0.02 - 0.015 * dip;
    const stairDescent = 0.62 + g() * 0.022 - 0.07 * stairDecline;

    const apple: MetricValues = {
      restingHr: round(restingHr, 1),
      avgHr: round(avgHr, 1),
      hrv: round(hrv, 1),
      respRate: round(respRate, 2),
      steps: Math.round(steps),
      activeEnergy: Math.round(activeEnergy),
      exerciseMinutes: Math.round(exerciseMinutes),
      walkingDistance: round(walkingDistance, 2),
      vo2Max: round(vo2Max, 1),
      daylight: Math.round(daylight),
      noise: round(noise, 1),
      walkingSpeed: round(walkingSpeed, 3),
      stepLength: round(stepLength, 1),
      walkingAsymmetry: round(walkingAsymmetry, 1),
      doubleSupport: round(doubleSupport, 1),
      stairAscent: round(stairAscent, 3),
      stairDescent: round(stairDescent, 3),
    };
    if (!sleepGap) {
      apple.sleepDuration = round(sleepDuration, 2);
      apple.remDuration = round(sleepDuration * remShare, 2);
      apple.deepDuration = round(sleepDuration * deepShare, 2);
      apple.coreDuration = round(sleepDuration * (1 - remShare - deepShare), 2);
      apple.sleepEfficiency = round(sleepEfficiency, 1);
      apple.sleepConsistency = Math.round(sleepConsistency);
      apple.sleepRespRate = round(respRate - 1.3 + g() * 0.2, 2);
    } else {
      g();
    }
    if (workoutMin > 0) {
      apple.workoutDuration = workoutMin;
      apple.workoutIntensity = round(rpe, 1);
      apple.workoutHr = Math.round(112 + rpe * 6.2 + g() * 3);
      apple.hrRecovery = round(29 + g() * 2.2 - 5 * drift - 0.5 * (rpe - 5), 1);
    }

    // ---------- Temple-compatible (simulated) ----------
    const templeGap = rng() < 0.02;
    const temple: MetricValues = {};
    const tBrain = 61 + g() * 2.8 + 3.8 * walkE + 0.9 * sleepLatent - 4.5 * drift;
    const tEntropy = 1.34 + g() * 0.05 + 0.04 * walkE - 0.07 * drift + 0.015 * sleepLatent;
    const tHr = avgHr + g() * 1.2 - 0.5;
    const tHrv = hrv * 0.95 + g() * 1.8;
    const tResp = respRate + 0.15 + g() * 0.25;
    if (!templeGap) {
      temple.brainFlow = round(tBrain, 1);
      temple.entropy = round(tEntropy, 3);
      temple.avgHr = round(tHr, 1);
      temple.hrv = round(tHrv, 1);
      temple.respRate = round(tResp, 2);
    }

    // ---------- Self-reported / manual ----------
    const manual: MetricValues = {
      reactionTime: Math.round(284 + g() * 13 + 14 * drift + 6 * blip - 6 * walkE),
      energy: round(clamp(6.6 + g() * 0.8 - 1.2 * drift + 0.9 * walkE + 0.3 * sleepLatent, 1, 10), 1),
      mentalFatigue: round(clamp(4.0 + g() * 0.8 + 1.4 * drift - 0.7 * walkE, 1, 10), 1),
    };

    days.push({ date, index: i, apple, temple, manual });
  }

  const workouts = buildWorkouts(seed, days);
  return { kind: "demo", seed, startDate: days[0].date, endDate: days[days.length - 1].date, today: DEMO_TODAY, days, workouts };
}

/* ----------------------------- Workout sessions ----------------------------- */

interface WorkoutSpec {
  id: string;
  name: string;
  kind: WorkoutKind;
  label: "High" | "Moderate" | "Low";
  day: number;
  dur: number;
  rpe: number;
  hrPeak: number;
  hrTau: number;
  hrRecTau: number;
  hrvMin: number;
  hrvRecoverTo: number;
  rrPeak: number;
}

const SPECS: WorkoutSpec[] = [
  { id: "w-run", name: "High-intensity running", kind: "running", label: "High", day: EVENTS.workouts.running, dur: 36, rpe: 8.5, hrPeak: 171, hrTau: 4, hrRecTau: 7, hrvMin: 14, hrvRecoverTo: 0.72, rrPeak: 36 },
  { id: "w-cycle", name: "Moderate-intensity cycling", kind: "cycling", label: "Moderate", day: EVENTS.workouts.cycling, dur: 45, rpe: 6, hrPeak: 141, hrTau: 6, hrRecTau: 6, hrvMin: 26, hrvRecoverTo: 0.9, rrPeak: 26 },
  { id: "w-walk", name: "Low-intensity walking", kind: "walking", label: "Low", day: EVENTS.workouts.walking, dur: 40, rpe: 3, hrPeak: 104, hrTau: 5, hrRecTau: 4, hrvMin: 40, hrvRecoverTo: 1.0, rrPeak: 19 },
];

function buildWorkouts(seed: number, days: DailyRecord[]): Workout[] {
  return SPECS.map((spec, k) => {
    const rng = mulberry32(seed + 1000 + k * 17);
    const g = createGaussian(rng);
    const pre = 10;
    const rec = 15;
    const rest = { hr: 70, hrv: 48, rr: 14.8, bf: 62, en: 1.34 };
    const D = spec.dur;
    const samples: WorkoutSample[] = [];
    let nHr = 0, nHrv = 0, nRr = 0, nBf = 0, nEn = 0;
    const ar = (prev: number, s: number) => 0.6 * prev + g() * s;

    // Smooth value at end of exercise for recovery continuity
    const during = (t: number) => {
      const u = t / D;
      const hr = rest.hr + (spec.hrPeak - rest.hr) * (1 - Math.exp(-(t + 1) / spec.hrTau)) + 6 * u;
      const hrv = spec.hrvMin + (rest.hrv - spec.hrvMin) * Math.exp(-(t + 1) / 3.5);
      const rr = rest.rr + (spec.rrPeak - rest.rr) * (1 - Math.exp(-(t + 1) / (spec.hrTau + 1)));
      let bf: number;
      let en: number;
      if (spec.kind === "running") {
        bf = rest.bf + 10 * Math.sin(Math.PI * u * 0.9) - 7 * u * u;
        en = rest.en - 0.38 * (1 - Math.exp(-t / 6)) - 0.1 * u;
      } else if (spec.kind === "cycling") {
        bf = rest.bf + 10 * (1 - Math.exp(-t / 6)) - 1.5 * u;
        en = rest.en - 0.14 * (1 - Math.exp(-t / 8));
      } else {
        bf = rest.bf + 4 * (1 - Math.exp(-t / 8));
        en = rest.en + 0.03 * (1 - Math.exp(-t / 10));
      }
      return { hr, hrv, rr, bf, en };
    };
    const end = during(D);

    for (let t = -pre; t <= D + rec; t++) {
      let hr: number, hrv: number, rr: number, bf: number, en: number;
      let phase: WorkoutSample["phase"];
      if (t < 0) {
        phase = "before";
        hr = rest.hr + (t + pre) * 0.15 * 0; hrv = rest.hrv; rr = rest.rr; bf = rest.bf; en = rest.en;
      } else if (t < D) {
        phase = "during";
        ({ hr, hrv, rr, bf, en } = during(t));
      } else {
        phase = "recovery";
        const r = t - D;
        hr = rest.hr + 4 + (end.hr - rest.hr - 4) * Math.exp(-r / spec.hrRecTau);
        const hrvTarget = rest.hrv * spec.hrvRecoverTo;
        hrv = hrvTarget + (end.hrv - hrvTarget) * Math.exp(-r / 9) + (rest.hrv - hrvTarget) * 0.35 * (1 - Math.exp(-r / 20));
        rr = rest.rr + 1 + (end.rr - rest.rr - 1) * Math.exp(-r / (spec.hrRecTau + 2));
        if (spec.kind === "running") {
          bf = rest.bf + (end.bf - rest.bf) * Math.exp(-r / 7) + 5 * (1 - Math.exp(-r / 5)) * Math.exp(-r / 12) - 3 * (1 - Math.exp(-r / 4)) * Math.exp(-r / 20);
          en = end.en + (rest.en - 0.04 - end.en) * (1 - Math.exp(-r / 14));
        } else if (spec.kind === "cycling") {
          bf = rest.bf + (end.bf - rest.bf) * Math.exp(-r / 10);
          en = end.en + (rest.en - end.en) * (1 - Math.exp(-r / 6));
        } else {
          bf = rest.bf + (end.bf - rest.bf) * Math.exp(-r / 6);
          en = end.en + (rest.en - end.en) * (1 - Math.exp(-r / 5));
        }
      }
      nHr = ar(nHr, 1.4); nHrv = ar(nHrv, 1.1); nRr = ar(nRr, 0.4); nBf = ar(nBf, 0.5); nEn = ar(nEn, 0.008);
      samples.push({
        t,
        phase,
        hr: round(hr + nHr, 1),
        hrv: round(Math.max(5, hrv + nHrv), 1),
        rr: round(rr + nRr, 1),
        brainFlow: round(bf + nBf, 1),
        entropy: round(en + nEn, 3),
      });
    }

    const day = days[spec.day];
    return {
      id: spec.id,
      name: spec.name,
      kind: spec.kind,
      intensityLabel: spec.label,
      date: day.date,
      dayIndex: spec.day,
      rpe: spec.rpe,
      durationMin: D,
      preMin: pre,
      recoveryMin: rec,
      sleepQuality: day.apple.sleepEfficiency ?? 89,
      samples,
    };
  });
}
