import { addDays, format, parseISO } from "date-fns";
import type { Dataset, MetricKey, MetricValues, Provenance } from "@/types/health";
import raw from "@/data/real/lifesnaps.json";

/**
 * Real, public wearable data: one anonymised LifeSnaps participant (Fitbit Sense).
 * Produced by `scripts/import-lifesnaps.mjs` from the published CSV. Values are as recorded,
 * with unit conversions only — gaps stay gaps. Metrics Fitbit does not record are simply absent.
 */
interface RealFile {
  provenance: Provenance;
  startDate: string;
  endDate: string;
  available: MetricKey[];
  days: { date: string; v: MetricValues }[];
}

const file = raw as unknown as RealFile;

let cached: Dataset | null = null;

export function loadRealDataset(): Dataset {
  if (cached) return cached;
  cached = {
    kind: "real",
    seed: 0,
    startDate: file.startDate,
    endDate: file.endDate,
    today: format(addDays(parseISO(file.endDate), 1), "yyyy-MM-dd"),
    days: file.days.map((d, index) => ({ date: d.date, index, apple: d.v, temple: {}, manual: {} })),
    workouts: [],
    available: file.available,
    provenance: file.provenance,
  };
  return cached;
}

export const REAL_PROVENANCE = file.provenance;
