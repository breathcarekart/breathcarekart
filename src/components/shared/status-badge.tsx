import { cn } from "@/lib/utils";

const tones = {
  available: "bg-success-soft text-success border-success/20",
  rented: "bg-primary-soft text-primary border-primary/20",
  service: "bg-warning-soft text-warning-foreground border-warning/30",
  damaged: "bg-danger-soft text-danger border-danger/20",
  paid: "bg-success-soft text-success border-success/20",
  pending: "bg-warning-soft text-warning-foreground border-warning/30",
  overdue: "bg-danger-soft text-danger border-danger/20",
  draft: "bg-muted text-muted-foreground border-border",
  active: "bg-success-soft text-success border-success/20",
  "due-soon": "bg-warning-soft text-warning-foreground border-warning/30",
  neutral: "bg-muted text-muted-foreground border-border",
} as const;

export type Tone = keyof typeof tones;

const labels: Record<string, string> = {
  "due-soon": "Due soon",
  service: "In service",
};

export function StatusBadge({
  tone,
  label,
  className,
}: {
  tone: Tone;
  label?: string;
  className?: string;
}) {
  const text = label ?? labels[tone] ?? tone;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        tones[tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {text}
    </span>
  );
}
