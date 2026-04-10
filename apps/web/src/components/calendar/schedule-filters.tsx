"use client";

import { cn } from "@axle/ui";

type ScheduleType = "DEADLINE" | "MEETING" | "REMINDER" | "PROGRAM_DUE";

const TYPE_OPTIONS: { value: ScheduleType; label: string; dotClass: string }[] = [
  { value: "DEADLINE", label: "마감", dotClass: "bg-red-500" },
  { value: "MEETING", label: "미팅", dotClass: "bg-blue-500" },
  { value: "REMINDER", label: "리마인더", dotClass: "bg-yellow-500" },
  { value: "PROGRAM_DUE", label: "사업 마감", dotClass: "bg-purple-500" },
];

interface ScheduleFiltersProps {
  activeTypes: Set<string>;
  onActiveTypesChange: (types: Set<string>) => void;
}

export function ScheduleFilters({ activeTypes, onActiveTypesChange }: ScheduleFiltersProps) {
  function toggle(type: ScheduleType) {
    const next = new Set(activeTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    onActiveTypesChange(next);
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {TYPE_OPTIONS.map((opt) => {
        const active = activeTypes.has(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
              active
                ? "border-transparent bg-foreground/10 text-foreground"
                : "border-border text-muted-foreground opacity-50"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", opt.dotClass)} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
