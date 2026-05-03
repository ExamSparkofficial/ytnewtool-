import type { VoiceVariation } from "@/lib/types";
import { formatSeconds, cn } from "@/lib/utils";

interface VoiceCardProps {
  voice: VoiceVariation;
  selected: boolean;
  onSelect: () => void;
}

export function VoiceCard({ voice, selected, onSelect }: VoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-[28px] border p-5 text-left transition-all",
        selected
          ? "border-amber-300/70 bg-amber-300/10 shadow-glow"
          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{voice.label}</h3>
          <p className="mt-2 text-sm text-slate-300">{voice.description}</p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            selected ? "bg-amber-300 text-slate-950" : "bg-white/10 text-slate-200"
          )}
        >
          {formatSeconds(voice.durationSeconds)}
        </span>
      </div>

      <audio className="mt-5 w-full" controls preload="none">
        <source src={voice.previewUrl} type="audio/mpeg" />
      </audio>
    </button>
  );
}
