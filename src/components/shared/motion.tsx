"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store/app-context";

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item: Variants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } } };

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const { motionEnabled } = useApp();
  if (!motionEnabled) return <div className={className}>{children}</div>;
  return <motion.div variants={container} initial="hidden" animate="show" className={className}>{children}</motion.div>;
}
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const { motionEnabled } = useApp();
  if (!motionEnabled) return <div className={cn("min-w-0", className)}>{children}</div>;
  return <motion.div variants={item} className={cn("min-w-0", className)}>{children}</motion.div>;
}
export function HoverLift({ children, className }: { children: ReactNode; className?: string }) {
  const { motionEnabled } = useApp();
  if (!motionEnabled) return <div className={cn("h-full", className)}>{children}</div>;
  return <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }} className={cn("h-full", className)}>{children}</motion.div>;
}
