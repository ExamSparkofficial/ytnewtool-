import type { GeneratedScript } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ScriptCardProps {
  script: GeneratedScript;
  selected: boolean;
  onSelect: () => void;
}

export function ScriptCard({ script, selected, onSelect }: ScriptCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-[28px] border p-5 text-left transition-all",
        selected
          ? "border-sky-300/60 bg-sky-400/10 shadow-glow"
          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Concept</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{script.title}</h3>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            selected ? "bg-sky-300 text-slate-950" : "bg-white/10 text-slate-200"
          )}
        >
          {selected ? "Selected" : "Select"}
        </span>
      </div>

      <div className="mt-5 space-y-4 text-sm text-slate-200">
        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.2em] text-slate-400">Hook</p>
          <p>{script.hook}</p>
        </div>
        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.2em] text-slate-400">Body</p>
          <p>{script.body}</p>
        </div>
        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.2em] text-slate-400">CTA</p>
          <p>{script.cta}</p>
        </div>
      </div>
    </button>
  );
}
