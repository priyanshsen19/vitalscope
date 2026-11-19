"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useApp } from "@/lib/store/app-context";

export default function Template({ children }: { children: ReactNode }) {
  const { motionEnabled } = useApp();
  if (!motionEnabled) return <div>{children}</div>;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}
