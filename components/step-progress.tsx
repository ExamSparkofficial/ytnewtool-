import { cn } from "@/lib/utils";

interface StepProgressProps {
  currentStep: number;
  steps: string[];
}

export function StepProgress({ currentStep, steps }: StepProgressProps) {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const isActive = currentStep === stepNumber;
        const isComplete = currentStep > stepNumber;

        return (
          <div
            key={label}
            className={cn(
              "rounded-3xl border px-4 py-4 transition-all",
              isActive && "border-sky-300/60 bg-sky-400/10 shadow-glow",
              isComplete && "border-emerald-300/50 bg-emerald-400/10",
              !isActive && !isComplete && "border-white/10 bg-white/5"
            )}
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Step {stepNumber}</p>
            <p className="mt-2 font-medium text-white">{label}</p>
          </div>
        );
      })}
    </div>
  );
}
