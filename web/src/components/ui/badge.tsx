import * as React from "react";
import { clsx } from "clsx";

export const Badge = ({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "success" | "warning" | "error" }) => {
  const variants: Record<string, string> = {
    default: "bg-slate-800 text-slate-100 border border-slate-700",
    success: "bg-emerald-900/70 text-emerald-100 border border-emerald-700",
    warning: "bg-amber-900/70 text-amber-100 border border-amber-700",
    error: "bg-rose-900/70 text-rose-100 border border-rose-700"
  };
  return (
    <div
      className={clsx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
};
