"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MotionConfig, useReducedMotion } from "framer-motion";
import { format, parseISO } from "date-fns";
import type { DataMode, Dataset, DateFormatPref, DateRangeDays, Settings, SourceId } from "@/types/health";
import type { Experiment, ExperimentStatus } from "@/types/experiment";
import { generateDataset } from "@/lib/data/generator";
import { DEFAULT_SEED } from "@/lib/data/seed";
import { loadRealDataset } from "@/lib/data/real";
import { clearState, defaultExperiments, defaultState, DEFAULT_SETTINGS, loadState, saveState } from "@/lib/data/persistence";
import { displayUnit, formatMetric, toDisplay } from "@/lib/metrics";
import type { MetricKey } from "@/types/health";

interface AppContextValue {
  hydrated: boolean;
  dataset: Dataset;
  seed: number;
  settings: Settings;
  /** Experiments that belong to the dataset currently shown. */
  experiments: Experiment[];
  /** True when the real public dataset is shown instead of the synthetic demo. */
  isReal: boolean;
  /** The day after the newest measurements ("today" for this dataset). */
  today: string;
  setDataMode: (m: DataMode) => void;
  motionEnabled: boolean;
  updateSettings: (patch: Partial<Settings>) => void;
  setDateRange: (d: DateRangeDays) => void;
  setSource: (s: SourceId) => void;
  createExperiment: (e: Omit<Experiment, "id" | "createdAt" | "status" | "startDate" | "pausedOn" | "completedOn" | "adherence" | "isSample"> & { startDate?: string | null }) => Experiment;
  updateExperiment: (id: string, patch: Partial<Experiment>) => void;
  deleteExperiment: (id: string) => void;
  setExperimentStatus: (id: string, status: ExperimentStatus, startDate?: string) => void;
  toggleAdherence: (id: string, date: string) => void;
  resetAll: () => void;
  restoreSampleExperiments: () => void;
  regenerate: (seed: number) => void;
  markNotificationsRead: (ids: string[]) => void;
  fmtDate: (iso: string, pattern?: string) => string;
  fmt: (key: MetricKey, v: number | null | undefined, withUnit?: boolean) => string;
  conv: (key: MetricKey, v: number) => number;
  unitOf: (key: MetricKey) => string;
}

const Ctx = createContext<AppContextValue | null>(null);

function uid(): string {
  return `exp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => defaultState(), []);
  const [hydrated, setHydrated] = useState(false);
  const [seed, setSeed] = useState<number>(initial.seed);
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [experiments, setExperiments] = useState<Experiment[]>(initial.experiments);

  useEffect(() => {
    const s = loadState();
    setSeed(s.seed);
    setSettings(s.settings);
    setExperiments(s.experiments);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveState({ seed, settings, experiments });
  }, [hydrated, seed, settings, experiments]);

  const isReal = settings.dataMode === "real";
  const dataset = useMemo(() => (isReal ? loadRealDataset() : generateDataset(seed)), [isReal, seed]);
  const today = dataset.today;
  const endDate = dataset.endDate;
  const visibleExperiments = useMemo(() => experiments.filter((e) => (e.dataMode ?? "demo") === settings.dataMode), [experiments, settings.dataMode]);

  // theme + motion attributes
  const systemReduce = useReducedMotion();
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = settings.theme === "dark" || (settings.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("light", !dark);
      root.classList.toggle("dark", dark);
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.theme]);

  const motionEnabled = settings.reducedMotion === "on" ? false : settings.reducedMotion === "off" ? true : !systemReduce;
  useEffect(() => {
    document.documentElement.setAttribute("data-reduce-motion", String(!motionEnabled));
  }, [motionEnabled]);

  const updateSettings = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);
  const setDateRange = useCallback((d: DateRangeDays) => setSettings((s) => ({ ...s, dateRange: d })), []);
  const setSource = useCallback((src: SourceId) => setSettings((s) => ({ ...s, source: src })), []);
  // Real data comes from one wearable, so the device picker is fixed to it.
  const setDataMode = useCallback((m: DataMode) => setSettings((s) => ({ ...s, dataMode: m, source: m === "real" ? "apple" : "combined" })), []);

  const createExperiment: AppContextValue["createExperiment"] = useCallback((e) => {
    const exp: Experiment = {
      ...e,
      id: uid(),
      createdAt: endDate,
      dataMode: settings.dataMode,
      status: "draft",
      startDate: e.startDate ?? null,
      pausedOn: null,
      completedOn: null,
      adherence: {},
    };
    setExperiments((list) => [exp, ...list]);
    return exp;
  }, [endDate, settings.dataMode]);

  const updateExperiment = useCallback((id: string, patch: Partial<Experiment>) => {
    setExperiments((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const deleteExperiment = useCallback((id: string) => setExperiments((list) => list.filter((e) => e.id !== id)), []);

  const setExperimentStatus = useCallback((id: string, status: ExperimentStatus, startDate?: string) => {
    setExperiments((list) =>
      list.map((e) => {
        if (e.id !== id) return e;
        if (status === "active") {
          const begin = e.status === "draft" ? startDate ?? e.startDate ?? today : e.startDate ?? startDate ?? today;
          return { ...e, status, startDate: begin, pausedOn: null, completedOn: null };
        }
        if (status === "paused") return { ...e, status, pausedOn: endDate };
        if (status === "completed") return { ...e, status, completedOn: endDate, pausedOn: null };
        return { ...e, status };
      }),
    );
  }, [today, endDate]);

  const toggleAdherence = useCallback((id: string, date: string) => {
    setExperiments((list) =>
      list.map((e) => {
        if (e.id !== id) return e;
        const cur = e.adherence[date];
        const next = { ...e.adherence };
        // cycle: unlogged -> done -> missed -> unlogged
        if (cur === undefined) next[date] = true;
        else if (cur === true) next[date] = false;
        else delete next[date];
        return { ...e, adherence: next };
      }),
    );
  }, []);

  const resetAll = useCallback(() => {
    clearState();
    const d = defaultState();
    setSeed(d.seed);
    setSettings({ ...DEFAULT_SETTINGS });
    setExperiments(d.experiments);
  }, []);

  const restoreSampleExperiments = useCallback(() => {
    setExperiments((list) => {
      const samples = defaultExperiments();
      const ids = new Set(samples.map((s) => s.id));
      return [...samples, ...list.filter((e) => !ids.has(e.id))];
    });
  }, []);

  const regenerate = useCallback((s: number) => setSeed(Number.isFinite(s) && s > 0 ? Math.floor(s) : DEFAULT_SEED), []);

  const markNotificationsRead = useCallback((ids: string[]) => {
    setSettings((s) => ({ ...s, readNotifications: Array.from(new Set([...s.readNotifications, ...ids])) }));
  }, []);

  const fmtDate = useCallback(
    (iso: string, pattern?: string) => {
      if (!iso) return "—";
      const p: string = pattern ?? (settings.dateFormat as DateFormatPref);
      try {
        return format(parseISO(iso), p);
      } catch {
        return iso;
      }
    },
    [settings.dateFormat],
  );

  const fmt = useCallback((key: MetricKey, v: number | null | undefined, withUnit = true) => formatMetric(key, v, settings.units, withUnit), [settings.units]);
  const conv = useCallback((key: MetricKey, v: number) => toDisplay(key, v, settings.units), [settings.units]);
  const unitOf = useCallback((key: MetricKey) => displayUnit(key, settings.units), [settings.units]);

  const value: AppContextValue = {
    hydrated, dataset, seed, settings, experiments: visibleExperiments, isReal, today, setDataMode, motionEnabled, updateSettings, setDateRange, setSource, createExperiment,
    updateExperiment, deleteExperiment, setExperimentStatus, toggleAdherence, resetAll, restoreSampleExperiments, regenerate,
    markNotificationsRead, fmtDate, fmt, conv, unitOf,
  };

  return (
    <Ctx.Provider value={value}>
      <MotionConfig reducedMotion={settings.reducedMotion === "on" ? "always" : settings.reducedMotion === "off" ? "never" : "user"}>{children}</MotionConfig>
    </Ctx.Provider>
  );
}

export function useApp(): AppContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}
