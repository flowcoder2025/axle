"use client";

import { useState, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@axle/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SerializedSchedule } from "@/app/(app)/calendar/page";
import { ScheduleCard } from "./schedule-card";
import { ScheduleDialog } from "./schedule-dialog";
import { ScheduleFilters } from "./schedule-filters";
import { cn } from "@axle/ui";

type ViewMode = "monthly" | "weekly" | "daily";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"] as const;

const TYPE_COLORS: Record<string, string> = {
  DEADLINE: "bg-red-500",
  MEETING: "bg-blue-500",
  REMINDER: "bg-yellow-500",
  PROGRAM_DUE: "bg-purple-500",
};

const TYPE_BG_LIGHT: Record<string, string> = {
  DEADLINE: "bg-red-50 text-red-800 border-red-200",
  MEETING: "bg-blue-50 text-blue-800 border-blue-200",
  REMINDER: "bg-yellow-50 text-yellow-800 border-yellow-200",
  PROGRAM_DUE: "bg-purple-50 text-purple-800 border-purple-200",
};

interface CalendarViewProps {
  schedules: SerializedSchedule[];
  initialYear: number;
  initialMonth: number; // 1-indexed
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatMonthLabel(year: number, month: number) {
  return `${year}년 ${month}월`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  // 0 = Sunday
  return new Date(year, month - 1, 1).getDay();
}

function getWeekDates(baseDate: Date): Date[] {
  const day = baseDate.getDay();
  const sunday = new Date(baseDate);
  sunday.setDate(baseDate.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

function formatTime(isoString: string, isAllDay: boolean) {
  if (isAllDay) return "종일";
  const d = new Date(isoString);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export function CalendarView({ schedules, initialYear, initialMonth }: CalendarViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [view, setView] = useState<ViewMode>("monthly");
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth); // 1-indexed
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDefaultDate, setCreateDefaultDate] = useState<Date | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<SerializedSchedule | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(
    new Set(["DEADLINE", "MEETING", "REMINDER", "PROGRAM_DUE"])
  );

  // For weekly/daily navigation
  const [focusDate, setFocusDate] = useState(() => new Date(year, month - 1, 1));

  const filteredSchedules = useMemo(
    () => schedules.filter((s) => activeTypes.has(s.type)),
    [schedules, activeTypes]
  );

  function navigatePrev() {
    if (view === "monthly") {
      const newDate = new Date(year, month - 2, 1);
      const newYear = newDate.getFullYear();
      const newMonth = newDate.getMonth() + 1;
      setYear(newYear);
      setMonth(newMonth);
      setFocusDate(newDate);
      const params = new URLSearchParams(searchParams.toString());
      params.set("year", String(newYear));
      params.set("month", String(newMonth));
      router.push(`${pathname}?${params.toString()}`);
    } else if (view === "weekly") {
      const d = new Date(focusDate);
      d.setDate(d.getDate() - 7);
      setFocusDate(d);
    } else {
      const d = new Date(focusDate);
      d.setDate(d.getDate() - 1);
      setFocusDate(d);
    }
  }

  function navigateNext() {
    if (view === "monthly") {
      const newDate = new Date(year, month, 1);
      const newYear = newDate.getFullYear();
      const newMonth = newDate.getMonth() + 1;
      setYear(newYear);
      setMonth(newMonth);
      setFocusDate(newDate);
      const params = new URLSearchParams(searchParams.toString());
      params.set("year", String(newYear));
      params.set("month", String(newMonth));
      router.push(`${pathname}?${params.toString()}`);
    } else if (view === "weekly") {
      const d = new Date(focusDate);
      d.setDate(d.getDate() + 7);
      setFocusDate(d);
    } else {
      const d = new Date(focusDate);
      d.setDate(d.getDate() + 1);
      setFocusDate(d);
    }
  }

  function navigateToday() {
    const today = new Date();
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
    setFocusDate(today);
    setSelectedDay(today);
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(today.getFullYear()));
    params.set("month", String(today.getMonth() + 1));
    router.push(`${pathname}?${params.toString()}`);
  }

  function getHeaderLabel() {
    if (view === "monthly") return formatMonthLabel(year, month);
    if (view === "weekly") {
      const weekDates = getWeekDates(focusDate);
      const start = weekDates[0];
      const end = weekDates[6];
      if (start.getMonth() === end.getMonth()) {
        return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 – ${end.getDate()}일`;
      }
      return `${start.getMonth() + 1}월 ${start.getDate()}일 – ${end.getMonth() + 1}월 ${end.getDate()}일`;
    }
    return `${focusDate.getFullYear()}년 ${focusDate.getMonth() + 1}월 ${focusDate.getDate()}일`;
  }

  function getSchedulesForDate(date: Date) {
    return filteredSchedules.filter((s) => isSameDay(new Date(s.startDate), date));
  }

  function handleDayClick(date: Date) {
    setSelectedDay(date);
  }

  function handleCreateOnDay(date: Date) {
    setCreateDefaultDate(date);
    setCreateDialogOpen(true);
  }

  function handleDialogClose() {
    setCreateDialogOpen(false);
    setEditingSchedule(null);
    setCreateDefaultDate(null);
  }

  const today = new Date();

  // ── Monthly Grid ──────────────────────────────────────────────
  function renderMonthlyView() {
    const firstDow = getFirstDayOfWeek(year, month);
    const daysInMonth = getDaysInMonth(year, month);
    const prevMonthDays = getDaysInMonth(year, month - 1 || 12);
    const cells: { date: Date; isCurrentMonth: boolean }[] = [];

    // Prefix: last days of prev month
    for (let i = firstDow - 1; i >= 0; i--) {
      const d = new Date(year, month - 2, prevMonthDays - i);
      cells.push({ date: d, isCurrentMonth: false });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month - 1, d), isCurrentMonth: true });
    }
    // Suffix: first days of next month
    const remaining = 42 - cells.length; // 6 rows × 7
    for (let d = 1; d <= remaining; d++) {
      cells.push({ date: new Date(year, month, d), isCurrentMonth: false });
    }

    const daySchedules = selectedDay ? getSchedulesForDate(selectedDay) : [];

    return (
      <div className="flex gap-4">
        {/* Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-7 border-l border-t">
            {DAY_NAMES.map((name, i) => (
              <div
                key={name}
                className={cn(
                  "border-b border-r py-2 text-center text-xs font-semibold",
                  i === 0 && "text-red-500",
                  i === 6 && "text-blue-500"
                )}
              >
                {name}
              </div>
            ))}
            {cells.map(({ date, isCurrentMonth }, idx) => {
              const daySchedules = getSchedulesForDate(date);
              const isToday = isSameDay(date, today);
              const isSelected = selectedDay ? isSameDay(date, selectedDay) : false;
              const dow = idx % 7;

              return (
                <div
                  key={idx}
                  onClick={() => handleDayClick(date)}
                  className={cn(
                    "min-h-[90px] cursor-pointer border-b border-r p-1 transition-colors",
                    !isCurrentMonth && "bg-muted/30",
                    isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/30"
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                        isToday && "bg-primary text-primary-foreground",
                        !isCurrentMonth && "text-muted-foreground",
                        dow === 0 && isCurrentMonth && !isToday && "text-red-500",
                        dow === 6 && isCurrentMonth && !isToday && "text-blue-500"
                      )}
                    >
                      {date.getDate()}
                    </span>
                    {isCurrentMonth && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateOnDay(date);
                        }}
                        className="hidden rounded px-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground group-hover:block"
                        title="일정 추가"
                      >
                        +
                      </button>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {daySchedules.slice(0, 3).map((s) => (
                      <div
                        key={s.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSchedule(s);
                        }}
                        className={cn(
                          "flex items-center gap-1 truncate rounded px-1 py-0.5 text-xs",
                          TYPE_BG_LIGHT[s.type]
                        )}
                      >
                        <span
                          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TYPE_COLORS[s.type])}
                        />
                        <span className="truncate">{s.title}</span>
                      </div>
                    ))}
                    {daySchedules.length > 3 && (
                      <div className="px-1 text-xs text-muted-foreground">
                        +{daySchedules.length - 3}개
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Side Panel */}
        {selectedDay && (
          <div className="w-72 shrink-0 rounded-lg border bg-background">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold">
                {selectedDay.getMonth() + 1}월 {selectedDay.getDate()}일 일정
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => handleCreateOnDay(selectedDay)}
              >
                + 추가
              </Button>
            </div>
            <div className="max-h-[600px] overflow-y-auto p-3">
              {daySchedules.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  이 날의 일정이 없습니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {daySchedules.map((s) => (
                    <ScheduleCard
                      key={s.id}
                      schedule={s}
                      onClick={() => setEditingSchedule(s)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Weekly View ───────────────────────────────────────────────
  function renderWeeklyView() {
    const weekDates = getWeekDates(focusDate);
    return (
      <div className="overflow-x-auto rounded-lg border">
        <div className="grid min-w-[700px] grid-cols-7">
          {weekDates.map((date, i) => {
            const isToday = isSameDay(date, today);
            const daySchedules = getSchedulesForDate(date);
            return (
              <div key={i} className={cn("border-r last:border-r-0", i === 0 && "rounded-l-lg")}>
                <div
                  className={cn(
                    "border-b px-2 py-2 text-center text-sm font-medium",
                    isToday && "bg-primary/10"
                  )}
                >
                  <div className={cn("text-xs text-muted-foreground", i === 0 && "text-red-500", i === 6 && "text-blue-500")}>
                    {DAY_NAMES[i]}
                  </div>
                  <div
                    className={cn(
                      "mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm",
                      isToday && "bg-primary text-primary-foreground"
                    )}
                  >
                    {date.getDate()}
                  </div>
                </div>
                <div
                  className="min-h-[400px] cursor-pointer p-1 space-y-1"
                  onClick={() => handleCreateOnDay(date)}
                >
                  {daySchedules.map((s) => (
                    <div
                      key={s.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSchedule(s);
                      }}
                      className={cn(
                        "cursor-pointer rounded border px-1.5 py-1 text-xs",
                        TYPE_BG_LIGHT[s.type]
                      )}
                    >
                      <div className="font-medium truncate">{s.title}</div>
                      <div className="text-xs opacity-70">{formatTime(s.startDate, s.isAllDay)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Daily View ────────────────────────────────────────────────
  function renderDailyView() {
    const daySchedules = getSchedulesForDate(focusDate);
    const isToday = isSameDay(focusDate, today);
    return (
      <div className="rounded-lg border">
        <div className={cn("border-b px-4 py-3 flex items-center justify-between", isToday && "bg-primary/5")}>
          <span className="font-semibold text-sm">
            {focusDate.getFullYear()}년 {focusDate.getMonth() + 1}월 {focusDate.getDate()}일 ({DAY_NAMES[focusDate.getDay()]})
          </span>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleCreateOnDay(focusDate)}>
            + 일정 추가
          </Button>
        </div>
        <div className="p-4">
          {daySchedules.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">이 날의 일정이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {daySchedules.map((s) => (
                <ScheduleCard
                  key={s.id}
                  schedule={s}
                  onClick={() => setEditingSchedule(s)}
                  expanded
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* View Toggle */}
        <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-1">
          {(["monthly", "weekly", "daily"] as ViewMode[]).map((v) => (
            <Button
              key={v}
              variant={view === v ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => {
                setView(v);
                if (v !== "monthly") setFocusDate(new Date(year, month - 1, 1));
              }}
            >
              {v === "monthly" ? "월간" : v === "weekly" ? "주간" : "일간"}
            </Button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={navigatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[180px] text-center text-sm font-semibold">
            {getHeaderLabel()}
          </span>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={navigateToday}>
          오늘
        </Button>

        <div className="ml-auto">
          <ScheduleFilters activeTypes={activeTypes} onActiveTypesChange={setActiveTypes} />
        </div>

        <Button
          size="sm"
          className="h-7 px-3 text-xs"
          onClick={() => {
            setCreateDefaultDate(new Date(year, month - 1, 1));
            setCreateDialogOpen(true);
          }}
        >
          + 일정 추가
        </Button>
      </div>

      {/* Calendar Body */}
      {view === "monthly" && renderMonthlyView()}
      {view === "weekly" && renderWeeklyView()}
      {view === "daily" && renderDailyView()}

      {/* Create/Edit Dialog */}
      <ScheduleDialog
        open={createDialogOpen || editingSchedule !== null}
        schedule={editingSchedule}
        defaultDate={createDefaultDate}
        onClose={handleDialogClose}
      />
    </div>
  );
}
