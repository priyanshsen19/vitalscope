"use client";

import type { ReactNode } from "react";
import { useApp } from "@/lib/store/app-context";
import { PageSkeleton } from "./states";

/** Renders children only once persisted state has been read from localStorage. */
export function Hydrated({ children }: { children: ReactNode }) {
  const { hydrated } = useApp();
  if (!hydrated) return <PageSkeleton />;
  return <>{children}</>;
}
