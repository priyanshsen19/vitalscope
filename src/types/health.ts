export type SourceId = "apple" | "temple" | "combined";
export type RawSource = "apple" | "temple" | "manual";

export type MetricKey =
  | "restingHr" | "avgHr" | "hrv" | "workoutHr" | "hrRecovery" | "vo2Max"
  | "respRate" | "sleepRespRate"
  | "sleepDuration" | "remDuration" | "deepDuration" | "coreDuration" | "sleepEfficiency" | "sleepConsistency"
  | "steps" | "activeEnergy" | "exerciseMinutes" | "walkingDistance" | "workoutDuration" | "workoutIntensity"
  | "walkingSpeed" | "stepLength" | "walkingAsymmetry" | "doubleSupport" | "stairAscent" | "stairDescent"
  | "daylight" | "noise"
  | "brainFlow" | "entropy"
  | "reactionTime" | "energy" | "mentalFatigue";

export type MetricCategory =
  | "cardio" | "respiratory" | "sleep" | "activity" | "mobility" | "environment" | "temple" | "cognitive";

export interface MetricMeta {
  key: MetricKey;
  label: string;
  short: string;
  unit: string;
  decimals: number;
  category: MetricCategory;
  /** Raw sources that can provide this metric. */
  sources: RawSource[];
  /** Which direction is generally favourable for the individual (neutral = no judgement). */
  better: "higher" | "lower" | "neutral";
  /** Temple-compatible measurement that must carry a "Simulated" label. */
  templeSimulated?: boolean;
  description: string;
}

export type MetricValues = Partial<Record<MetricKey, number>>;

export interface DailyRecord {
  date: string; // yyyy-MM-dd
  index: number; // 0 = oldest day
  apple: MetricValues;
  temple: MetricValues;
  manual: MetricValues;
}

export type WorkoutPhase = "before" | "during" | "recovery";

export interface WorkoutSample {
  t: number; // minutes relative to exercise start (negative = before)
  phase: WorkoutPhase;
  hr: number;
  hrv: number;
  rr: number;
  brainFlow: number;
  entropy: number;
}

export type WorkoutKind = "running" | "cycling" | "walking";

export interface Workout {
  id: string;
  name: string;
  kind: WorkoutKind;
  intensityLabel: "High" | "Moderate" | "Low";
  date: string;
  dayIndex: number;
  rpe: number;
  durationMin: number;
  preMin: number;
  recoveryMin: number;
  sleepQuality: number; // prior-night sleep efficiency %
  samples: WorkoutSample[];
}

export type DataMode = "demo" | "real";

export interface Provenance {
  dataset: string;
  title: string;
  authors: string;
  year: number;
  doi: string;
  url: string;
  licence: string;
  device: string;
  file: string;
  participant: string;
  selection: string;
  completeDays: number;
  mapping: Partial<Record<MetricKey, { column: string; note: string }>>;
  coverage: Partial<Record<MetricKey, number>>;
}

export interface Dataset {
  kind: DataMode;
  seed: number;
  startDate: string;
  endDate: string;
  /** The "today" the app reasons from: the day after the newest measurements. */
  today: string;
  days: DailyRecord[];
  workouts: Workout[];
  /** Real data only: metrics actually present in the file. */
  available?: MetricKey[];
  provenance?: Provenance;
}

export interface SeriesPoint {
  date: string;
  index: number;
  value: number | null;
}

export type DateRangeDays = 7 | 14 | 30 | 90;
export type DateFormatPref = "MMM d" | "d MMM" | "yyyy-MM-dd";
export type ThemePref = "dark" | "light" | "system";
export type MotionPref = "system" | "on" | "off";
export type UnitPref = "metric" | "imperial";

export type ViewMode = "simple" | "detailed";

export interface Settings {
  viewMode: ViewMode;
  dataMode: DataMode;
  profileName: string;
  profileAge: number;
  units: UnitPref;
  dateFormat: DateFormatPref;
  theme: ThemePref;
  reducedMotion: MotionPref;
  source: SourceId;
  dateRange: DateRangeDays;
  sidebarCollapsed: boolean;
  readNotifications: string[];
}
