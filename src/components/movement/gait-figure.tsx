"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store/app-context";

interface Props { speed: number; stepLength: number; asymmetry: number }

const HIP = { x: 100, y: 84 };
const THIGH = 34;
const SHIN = 34;
const rad = (d: number) => (d * Math.PI) / 180;

function leg(phi: number) {
  const thigh = 28 * Math.sin(phi);
  const bend = 38 * Math.max(0, Math.sin(phi + Math.PI / 2.2));
  const shin = thigh - bend;
  const knee = { x: HIP.x + THIGH * Math.sin(rad(thigh)), y: HIP.y + THIGH * Math.cos(rad(thigh)) };
  const foot = { x: knee.x + SHIN * Math.sin(rad(shin)), y: knee.y + SHIN * Math.cos(rad(shin)) };
  return { knee, foot };
}

/** Schematic gait cycle whose cadence follows measured walking speed ÷ step length. */
export function GaitFigure({ speed, stepLength, asymmetry }: Props) {
  const { motionEnabled } = useApp();
  const [phase, setPhase] = useState(0.6);
  const raf = useRef<number | null>(null);
  const stepsPerSec = speed / (stepLength / 100);
  const strideHz = stepsPerSec / 2;

  useEffect(() => {
    if (!motionEnabled) return;
    let last = performance.now();
    let p = phase;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      p += dt * strideHz * 0.7 * Math.PI * 2; // 0.7× for a calmer, legible animation
      setPhase(p);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionEnabled, strideHz]);

  const skew = (asymmetry / 100) * 1.2; // right-leg timing offset
  const L = leg(phase);
  const R = leg(phase + Math.PI + skew * Math.sin(phase));
  const bob = Math.abs(Math.sin(phase)) * 2.5;
  const shoulder = { x: HIP.x + 2, y: HIP.y - 46 + bob };
  const arm = (ph: number) => {
    const a = -22 * Math.sin(ph);
    const elbow = { x: shoulder.x + 24 * Math.sin(rad(a)), y: shoulder.y + 24 * Math.cos(rad(a)) };
    const hand = { x: elbow.x + 20 * Math.sin(rad(a + 18)), y: elbow.y + 20 * Math.cos(rad(a + 18)) };
    return `M${shoulder.x},${shoulder.y} L${elbow.x},${elbow.y} L${hand.x},${hand.y}`;
  };
  const stroke = { strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

  return (
    <svg viewBox="0 0 200 170" className="h-auto w-full max-w-[260px]" role="img" aria-label={`Schematic gait animation at ${stepsPerSec.toFixed(1)} steps per second`}>
      <line x1="10" y1="158" x2="190" y2="158" stroke="rgb(var(--border))" strokeWidth="1.5" strokeDasharray="3 5" />
      <path d={`M${HIP.x},${HIP.y} L${R.knee.x},${R.knee.y} L${R.foot.x},${R.foot.y}`} stroke="rgb(var(--cyan))" strokeOpacity="0.45" strokeWidth="5" {...stroke} />
      <path d={arm(phase + Math.PI)} stroke="rgb(var(--cyan))" strokeOpacity="0.45" strokeWidth="4" {...stroke} />
      <line x1={HIP.x} y1={HIP.y + bob * 0} x2={shoulder.x} y2={shoulder.y} stroke="rgb(var(--fg))" strokeWidth="6" {...stroke} />
      <circle cx={shoulder.x + 2} cy={shoulder.y - 13} r="9" fill="rgb(var(--fg))" />
      <path d={`M${HIP.x},${HIP.y} L${L.knee.x},${L.knee.y} L${L.foot.x},${L.foot.y}`} stroke="rgb(var(--cyan))" strokeWidth="5" {...stroke} />
      <path d={arm(phase)} stroke="rgb(var(--cyan))" strokeWidth="4" {...stroke} />
    </svg>
  );
}
