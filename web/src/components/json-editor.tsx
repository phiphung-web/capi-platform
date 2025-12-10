import { Textarea } from "./ui/textarea";
import { clsx } from "clsx";

interface JsonEditorProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  error?: string | null;
  placeholder?: string;
  minHeight?: number;
}

export function JsonEditor({
  label,
  value,
  onChange,
  error,
  placeholder,
  minHeight = 160
}: JsonEditorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-200">{label}</label>
        {error ? <span className="text-xs text-rose-400">Invalid JSON</span> : null}
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx("w-full font-mono", error ? "border-rose-500" : "border-slate-700")}
        style={{ minHeight }}
        placeholder={placeholder}
      />
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
    </div>
  );
}
