"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";
import { useApp } from "@/lib/store/app-context";

export function AnimatedNumber({ value, decimals = 0, format }: { value: number | null; decimals?: number; format?: (v: number) => string }) {
  const { motionEnabled } = useApp();
  const [display, setDisplay] = useState<number | null>(motionEnabled ? 0 : value);
  const prev = useRef<number>(0);

  useEffect(() => {
    if (value === null) { setDisplay(null); return; }
    if (!motionEnabled) { setDisplay(value); prev.current = value; return; }
    const controls = animate(prev.current, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
      onComplete: () => { prev.current = value; },
    });
    return () => { prev.current = value; controls.stop(); };
  }, [value, motionEnabled]);

  if (display === null) return <>—</>;
  return <>{format ? format(display) : display.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}
