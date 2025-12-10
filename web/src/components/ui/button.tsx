import * as React from "react";
import { clsx } from "clsx";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", disabled, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed";
    const variants: Record<string, string> = {
      primary: "bg-blue-600 text-white hover:bg-blue-500",
      secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700",
      ghost: "bg-transparent text-slate-200 hover:bg-slate-800/60"
    };
    return (
      <button
        ref={ref}
        className={clsx(base, variants[variant], "px-4 py-2", className)}
        disabled={disabled}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
