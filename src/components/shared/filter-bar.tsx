import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Toolbar row for list screens: wraps search and filters responsively. */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-end gap-2 p-4", className)}>{children}</div>;
}

export function SearchFilter({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative min-w-56 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 rounded-xl pl-9"
      />
    </div>
  );
}

export type FilterOption = { value: string; label: string };

/** A select with an "All …" option whose value is "all". */
export function SelectFilter({
  value,
  onChange,
  allLabel,
  options,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: FilterOption[];
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={cn("h-10 w-full rounded-xl sm:w-44", className)}
        aria-label={allLabel}
      >
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** From / to date inputs (YYYY-MM-DD strings, empty = open). */
export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <Label className="sr-only" htmlFor="filter-from">
        From date
      </Label>
      <Input
        id="filter-from"
        type="date"
        value={from}
        max={to || undefined}
        onChange={(e) => onFromChange(e.target.value)}
        className="h-10 flex-1 rounded-xl sm:w-36"
      />
      <span className="text-xs text-muted-foreground">to</span>
      <Label className="sr-only" htmlFor="filter-to">
        To date
      </Label>
      <Input
        id="filter-to"
        type="date"
        value={to}
        min={from || undefined}
        onChange={(e) => onToChange(e.target.value)}
        className="h-10 flex-1 rounded-xl sm:w-36"
      />
    </div>
  );
}
