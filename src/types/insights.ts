export type InsightCategory = "drift" | "experiment" | "movement" | "brain-body" | "pattern";
export type InsightSeverity = "positive" | "info" | "attention" | "notable";

export interface InsightEvidence {
  label: string;
  value: string;
  detail?: string;
}

export interface Insight {
  id: string;
  category: InsightCategory;
  title: string;
  description: string;
  severity: InsightSeverity;
  /** 0..1 relevance used for ordering */
  relevance: number;
  confidence: { score: number; level: "Low" | "Moderate" | "High" };
  dateRange: { start: string; end: string };
  evidence: InsightEvidence[];
  explanation: string;
  href: string;
  simulatedTemple?: boolean;
}

export interface TimelineEvent {
  id: string;
  date: string;
  type: "drift" | "experiment" | "workout" | "movement" | "pattern";
  title: string;
  detail: string;
  tone: "lime" | "cyan" | "violet" | "amber" | "muted";
  href: string;
}
