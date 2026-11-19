import type { Dataset, MetricKey, SourceId } from "@/types/health";
import { METRICS } from "@/lib/metrics";
import { getSeries, isMetricAvailable } from "@/lib/data/selectors";
import { calculateBaseline, calculateMean } from "@/lib/analytics/baseline";

/**
 * Plain-language layer for "Simple view".
 * Every measurement gets an everyday name, a one-line "what is it", a one-line
 * "why it matters" and a gentle, non-medical tip. No statistics vocabulary.
 */

export type BodyArea = "heart" | "sleep" | "activity" | "walking" | "breathing" | "surroundings" | "mind" | "brainbody";

export const AREAS: { id: BodyArea; label: string; blurb: string; color: "cyan" | "violet" | "lime" | "amber" }[] = [
  { id: "heart", label: "Heart", blurb: "How hard your heart is working and how well it recovers.", color: "cyan" },
  { id: "sleep", label: "Sleep", blurb: "How long and how well you sleep.", color: "violet" },
  { id: "activity", label: "Activity", blurb: "How much you move each day.", color: "lime" },
  { id: "walking", label: "Walking", blurb: "How steady and easy your walking is.", color: "cyan" },
  { id: "breathing", label: "Breathing", blurb: "How fast you breathe when resting and sleeping.", color: "amber" },
  { id: "surroundings", label: "Surroundings", blurb: "Daylight and noise around you.", color: "amber" },
  { id: "mind", label: "How you feel", blurb: "Your own daily check-ins.", color: "lime" },
  { id: "brainbody", label: "Brain-Body (demo)", blurb: "Simulated experimental signals. Not a medical or brain measurement.", color: "violet" },
];

export interface PlainInfo { name: string; area: BodyArea; what: string; why: string; tip: string }

export const PLAIN: Partial<Record<MetricKey, PlainInfo>> = {
  restingHr: { name: "Resting heart rate", area: "heart", what: "How many times your heart beats in a minute when you are calm and still.", why: "When it sits higher than usual for several days, your body is often dealing with stress, poor sleep, illness or hard training.", tip: "Rest days, steady sleep and staying hydrated usually help it settle." },
  hrv: { name: "Heart recovery (HRV)", area: "heart", what: "Tiny changes in time between heartbeats. More variation usually means your body is relaxed and recovered.", why: "A drop below your usual level is a common sign you are tired or under strain.", tip: "Easier days, regular bedtimes and less late caffeine or alcohol often help." },
  avgHr: { name: "Average heart rate", area: "heart", what: "Your average heart beats per minute across the whole day.", why: "It shows how busy your heart has been overall, including activity.", tip: "This one naturally goes up on active days. Look at the trend, not single days." },
  hrRecovery: { name: "Heart rate drop after exercise", area: "heart", what: "How quickly your heart slows down in the first minute after a workout.", why: "A faster drop is generally linked with better fitness.", tip: "Regular, gentle cardio tends to improve this over weeks." },
  vo2Max: { name: "Fitness level (VO2 Max)", area: "heart", what: "An estimate of how well your body uses oxygen during exercise.", why: "It is one of the best overall signs of cardio fitness. It changes slowly.", tip: "Brisk walks, runs or rides a few times a week can lift it gradually." },
  sleepDuration: { name: "Time asleep", area: "sleep", what: "How long you actually slept last night.", why: "Most adults feel and recover best with about 7–9 hours.", tip: "Going to bed at a similar time each night makes it easier to get enough." },
  sleepEfficiency: { name: "Sleep quality", area: "sleep", what: "How much of your time in bed you actually spent asleep.", why: "Lower numbers mean more tossing, turning or waking up.", tip: "A dark, cool room and no screens just before bed may help." },
  sleepConsistency: { name: "Sleep routine", area: "sleep", what: "How regular your bedtime and wake-up time are (0–100).", why: "A regular routine helps your body clock and energy levels.", tip: "Try to keep wake-up time steady, even at weekends." },
  deepDuration: { name: "Deep sleep", area: "sleep", what: "Time in the deepest stage of sleep, when the body does most physical repair.", why: "Too little can leave you feeling unrefreshed.", tip: "Exercise earlier in the day and avoiding late heavy meals can help." },
  remDuration: { name: "Dream sleep (REM)", area: "sleep", what: "Time in the sleep stage when most dreaming happens.", why: "It supports mood and memory.", tip: "Enough total sleep usually brings enough REM with it." },
  coreDuration: { name: "Light sleep", area: "sleep", what: "Time in light sleep, which makes up most of the night.", why: "It is normal for this to be the biggest share of your sleep.", tip: "Nothing special needed — it follows your overall sleep." },
  steps: { name: "Steps", area: "activity", what: "How many steps you took in a day.", why: "Moving regularly through the day is good for heart, mood and sleep.", tip: "Short walks after meals are an easy way to add steps." },
  activeEnergy: { name: "Calories burned moving", area: "activity", what: "Energy you used through movement and exercise (not counting resting).", why: "It shows how active your day was.", tip: "Any extra movement counts, not just workouts." },
  exerciseMinutes: { name: "Exercise minutes", area: "activity", what: "Minutes of activity that got you breathing a bit harder.", why: "Common guidance is around 150 minutes a week.", tip: "Splitting it into 20–30 minutes a day works well for most people." },
  walkingDistance: { name: "Distance walked", area: "activity", what: "How far you walked or ran in a day.", why: "Another simple way to see how active you are.", tip: "Take the longer route when you can." },
  walkingSpeed: { name: "Walking speed", area: "walking", what: "How fast you usually walk on flat ground.", why: "Walking speed is a well-known everyday sign of overall health and energy.", tip: "Regular walking and leg-strength exercises help keep it up." },
  stepLength: { name: "Step length", area: "walking", what: "The usual distance between your steps.", why: "Shorter steps than usual can mean tiredness, stiffness or discomfort.", tip: "Stretching and mobility work can help you move more freely." },
  walkingAsymmetry: { name: "Walking balance (left vs right)", area: "walking", what: "How often your left and right steps take different amounts of time.", why: "Higher numbers can mean you are favouring one side.", tip: "If this stays high and something hurts, a physio or doctor can check it." },
  doubleSupport: { name: "Both-feet-down time", area: "walking", what: "How much of each step you spend with both feet on the ground.", why: "More time often means you are walking more carefully.", tip: "Balance exercises can help you feel steadier." },
  stairAscent: { name: "Stair climbing speed", area: "walking", what: "How quickly you go up stairs.", why: "It reflects leg strength and fitness.", tip: "Taking the stairs regularly is good practice." },
  stairDescent: { name: "Stair descending speed", area: "walking", what: "How quickly you go down stairs.", why: "Slowing down can mean stiffness or less confidence on stairs.", tip: "Leg strength and balance work can help." },
  respRate: { name: "Breathing rate", area: "breathing", what: "How many breaths you take per minute when resting.", why: "It is usually very steady. A rise can happen with illness or stress.", tip: "If it stays higher than usual and you feel unwell, check in with a professional." },
  sleepRespRate: { name: "Breathing rate while asleep", area: "breathing", what: "Breaths per minute during sleep.", why: "It is normally very stable night to night.", tip: "Look for longer changes rather than one-off nights." },
  daylight: { name: "Time in daylight", area: "surroundings", what: "Minutes you spent outside in daylight.", why: "Daylight helps set your body clock, which supports sleep and mood.", tip: "A morning walk outside is a simple way to get more." },
  noise: { name: "Noise around you", area: "surroundings", what: "How loud your surroundings were on average.", why: "Long periods of loud noise can be tiring and affect hearing.", tip: "Quieter breaks during the day can help." },
  energy: { name: "Your energy", area: "mind", what: "How energetic you said you felt (1–10).", why: "How you feel matters as much as the numbers.", tip: "Compare it with your sleep — they often move together." },
  mentalFatigue: { name: "Mental tiredness", area: "mind", what: "How mentally tired you said you felt (1–10).", why: "Higher numbers can mean you need more rest or breaks.", tip: "Short breaks away from screens can help." },
  reactionTime: { name: "Reaction speed", area: "mind", what: "How quickly you responded in a short tap test (lower is faster).", why: "Being tired often makes reactions a little slower.", tip: "Good sleep is the biggest help here." },
  brainFlow: { name: "BrainFlow (demo signal)", area: "brainbody", what: "A simulated, experimental index for this demo. It is not a measure of thinking or blood flow.", why: "Shown only to explore how such a signal might move with activity.", tip: "Treat this as exploratory — don’t make decisions from it." },
  entropy: { name: "Entropy (demo signal)", area: "brainbody", what: "A simulated measure of signal complexity for this demo. It is not a medical measurement.", why: "Shown only to explore how such a signal might relate to other measurements.", tip: "Treat this as exploratory — don’t make decisions from it." },
};

/** Thresholds in units of your typical day-to-day spread. Kept generous so only clear changes are flagged. */
export const NORMAL = 1.5;
const MUCH = 2.5;

export type PlainTone = "good" | "watch" | "neutral";

export interface PlainStatus {
  word: string;      // "Normal for you", "A bit lower than usual"
  tone: PlainTone;
  sentence: string;  // full plain sentence
}

/** Turn "how far from usual" into everyday words. z is (recent − usual) / typical day-to-day spread. */
export function plainStatus(key: MetricKey, z: number | null): PlainStatus {
  const info = PLAIN[key];
  const name = (info?.name ?? METRICS[key].label).toLowerCase();
  if (z === null) return { word: "Not enough data", tone: "neutral", sentence: `We don’t have enough recent readings for ${name} yet.` };
  const a = Math.abs(z);
  if (a < NORMAL) return { word: "Normal for you", tone: "good", sentence: `Your ${name} is right in your usual range.` };
  const dir = z > 0 ? "higher" : "lower";
  const amount = a < MUCH ? "a bit" : "quite a bit";
  const better = METRICS[key].better;
  const tone: PlainTone = better === "neutral" ? "neutral" : (better === "higher") === z > 0 ? "good" : "watch";
  const word = `${a < MUCH ? "A bit" : "Much"} ${dir} than usual`;
  const end = tone === "good" ? " That’s a good sign." : tone === "watch" ? " Worth keeping an eye on." : "";
  return { word, tone, sentence: `Your ${name} has been ${amount} ${dir} than usual this week.${end}` };
}

export interface PlainReading {
  key: MetricKey;
  info: PlainInfo;
  recent: number | null;   // last 7 days average
  usual: number | null;    // first 30 days average
  usualLow: number | null;
  usualHigh: number | null;
  z: number | null;
  status: PlainStatus;
}

const SIMPLE_KEYS = Object.keys(PLAIN) as MetricKey[];

/** Every measurement available in this source, compared with the person's usual range. */
export function plainReadings(ds: Dataset, source: SourceId): PlainReading[] {
  return SIMPLE_KEYS.filter((k) => isMetricAvailable(k, source, ds)).map((key) => {
    const s = getSeries(ds, key, source)!;
    const b = calculateBaseline(s, 0, 29);
    const recent = calculateMean(s.slice(-7).map((p) => p.value));
    const z = recent !== null && b && b.sd > 0 ? (recent - b.mean) / b.sd : null;
    return {
      key, info: PLAIN[key]!, recent, usual: b?.mean ?? null,
      usualLow: b ? b.mean - b.sd : null, usualHigh: b ? b.mean + b.sd : null,
      z, status: plainStatus(key, z),
    };
  }).filter((r) => r.recent !== null);
}
