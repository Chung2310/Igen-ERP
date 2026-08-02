import { motion, HTMLMotionProps } from "motion/react";
import { cn } from "../../lib/utils";

interface LuxuryCardProps extends HTMLMotionProps<"div"> {
  padding?: "none" | "sm" | "md" | "lg";
}

export function LuxuryCard({
  className,
  padding = "md",
  children,
  ...props
}: LuxuryCardProps) {
  const paddings = {
    none: "p-0",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className={cn(
        "bg-white border border-slate-200 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden",
        paddings[padding],
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
