import { z } from "zod";
import type { Experiment } from "@/types/experiment";
import type { Settings } from "@/types/health";
import { buildSampleExperiments, DEFAULT_SEED, SAMPLE_PROFILE } from "./seed";
import { dateAtIndex } from "./generator";

const STORAGE_KEY = "vitalscope:v1";

const metricKey = z.string();
const experimentSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["Sleep", "Exercise", "Nutrition", "Recovery", "Lifestyle", "Environment"]),
  hypothesis: z.string(),
  behaviour: z.string(),
  durationDays: z.union([z.literal(7), z.literal(14), z.literal(21), z.literal(30)]),
  primaryMetric: metricKey,
  secondaryMetrics: z.array(metricKey),
  status: z.enum(["draft", "active", "paused", "completed"]),
  createdAt: z.string(),
  startDate: z.string().nullable(),
  pausedOn: z.string().nullable(),
  completedOn: z.string().nullable(),
  adherence: z.record(z.boolean()),
  isSample: z.boolean().optional(),
  dataMode: z.enum(["demo", "real"]).optional(),
});

const settingsSchema = z.object({
  viewMode: z.enum(["simple", "detailed"]).default("simple"),
  dataMode: z.enum(["demo", "real"]).default("demo"),
  profileName: z.string(),
  profileAge: z.number(),
  units: z.enum(["metric", "imperial"]),
  dateFormat: z.enum(["MMM d", "d MMM", "yyyy-MM-dd"]),
  theme: z.enum(["dark", "light", "system"]),
  reducedMotion: z.enum(["system", "on", "off"]),
  source: z.enum(["apple", "temple", "combined"]),
  dateRange: z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(90)]),
  sidebarCollapsed: z.boolean(),
  readNotifications: z.array(z.string()),
});

const persistedSchema = z.object({
  version: z.literal(1),
  seed: z.number(),
  settings: settingsSchema,
  experiments: z.array(experimentSchema),
});

export interface PersistedState {
  seed: number;
  settings: Settings;
  experiments: Experiment[];
}

export const DEFAULT_SETTINGS: Settings = {
  viewMode: "simple",
  dataMode: "demo",
  profileName: SAMPLE_PROFILE.name,
  profileAge: SAMPLE_PROFILE.age,
  units: "metric",
  dateFormat: "MMM d",
  theme: "dark",
  reducedMotion: "system",
  source: "combined",
  dateRange: 30,
  sidebarCollapsed: false,
  readNotifications: [],
};

export function defaultExperiments(): Experiment[] {
  return buildSampleExperiments((i) => dateAtIndex(i));
}

export function defaultState(): PersistedState {
  return { seed: DEFAULT_SEED, settings: { ...DEFAULT_SETTINGS }, experiments: defaultExperiments() };
}

export function loadState(): PersistedState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = persistedSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return defaultState();
    return {
      seed: parsed.data.seed,
      settings: parsed.data.settings,
      experiments: parsed.data.experiments as Experiment[],
    };
  } catch {
    return defaultState();
  }
}

export function saveState(state: PersistedState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...state }));
  } catch {
    /* storage unavailable (private mode / quota) – app continues in memory */
  }
}

export function clearState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export const STORAGE_KEY_NAME = STORAGE_KEY;
