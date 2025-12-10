import * as React from "react";
import { clsx } from "clsx";
import { AlertTriangle } from "lucide-react";

export const Alert = ({
  className,
  title,
  children
}: React.HTMLAttributes<HTMLDivElement> & { title?: string }) => {
  return (
    <div
      className={clsx(
        "flex w-full items-start gap-3 rounded-lg border border-rose-700/70 bg-rose-950/60 p-4 text-sm text-rose-100",
        className
      )}
    >
      <AlertTriangle className="h-4 w-4 mt-0.5" />
      <div className="space-y-1">
        {title ? <div className="font-semibold">{title}</div> : null}
        <div className="text-rose-100/90">{children}</div>
      </div>
    </div>
  );
};
