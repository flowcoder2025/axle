"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
} from "@axle/ui";
import type { SerializedSchedule } from "@/app/(app)/calendar/page";
import { toast } from "@axle/ui";

type ScheduleType = "DEADLINE" | "MEETING" | "REMINDER" | "PROGRAM_DUE";

const TYPE_OPTIONS: { value: ScheduleType; label: string }[] = [
  { value: "DEADLINE", label: "마감" },
  { value: "MEETING", label: "미팅" },
  { value: "REMINDER", label: "리마인더" },
  { value: "PROGRAM_DUE", label: "사업 마감" },
];

interface ScheduleDialogProps {
  open: boolean;
  schedule: SerializedSchedule | null; // null = create mode
  defaultDate?: Date | null;
  onClose: () => void;
}

function toDatetimeLocal(iso: string | null | undefined) {
  if (!iso) return "";
  // datetime-local requires "YYYY-MM-DDTHH:mm"
  return iso.slice(0, 16);
}

function toDateInput(iso: string | null | undefined) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function localDatetimeToISO(local: string) {
  if (!local) return "";
  return new Date(local).toISOString();
}

export function ScheduleDialog({ open, schedule, defaultDate, onClose }: ScheduleDialogProps) {
  const router = useRouter();
  const isEdit = !!schedule;

  const [title, setTitle] = useState("");
  const [type, setType] = useState<ScheduleType>("MEETING");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  // Populate form when schedule or defaultDate changes
  useEffect(() => {
    if (schedule) {
      setTitle(schedule.title);
      setType(schedule.type as ScheduleType);
      setIsAllDay(schedule.isAllDay);
      setDescription(schedule.description ?? "");
      if (schedule.isAllDay) {
        setStartDate(toDateInput(schedule.startDate));
        setEndDate(toDateInput(schedule.endDate));
      } else {
        setStartDate(toDatetimeLocal(schedule.startDate));
        setEndDate(toDatetimeLocal(schedule.endDate));
      }
    } else {
      setTitle("");
      setType("MEETING");
      setDescription("");
      setIsAllDay(false);
      if (defaultDate) {
        const y = defaultDate.getFullYear();
        const m = String(defaultDate.getMonth() + 1).padStart(2, "0");
        const d = String(defaultDate.getDate()).padStart(2, "0");
        setStartDate(`${y}-${m}-${d}T09:00`);
        setEndDate(`${y}-${m}-${d}T10:00`);
      } else {
        setStartDate("");
        setEndDate("");
      }
    }
  }, [schedule, defaultDate, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startDate) return;

    setLoading(true);
    try {
      const startISO = isAllDay
        ? new Date(startDate + "T00:00:00").toISOString()
        : localDatetimeToISO(startDate);
      const endISO = endDate
        ? isAllDay
          ? new Date(endDate + "T23:59:59").toISOString()
          : localDatetimeToISO(endDate)
        : null;

      const body = {
        title: title.trim(),
        type,
        startDate: startISO,
        endDate: endISO,
        isAllDay,
        description: description.trim() || undefined,
      };

      const url = isEdit ? `/api/schedules/${schedule!.id}` : "/api/schedules";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? "저장에 실패했습니다.");
      }

      toast.success(isEdit ? "일정이 수정되었습니다." : "일정이 추가되었습니다.");
      router.refresh();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!schedule) return;
    if (!confirm("이 일정을 삭제하시겠습니까?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/schedules/${schedule.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제에 실패했습니다.");
      toast.success("일정이 삭제되었습니다.");
      router.refresh();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "일정 수정" : "일정 추가"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="sched-title">제목 *</Label>
            <Input
              id="sched-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="일정 제목"
              required
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label htmlFor="sched-type">유형 *</Label>
            <select
              id="sched-type"
              value={type}
              onChange={(e) => setType(e.target.value as ScheduleType)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center gap-2">
            <input
              id="sched-allday"
              type="checkbox"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="sched-allday" className="cursor-pointer font-normal">
              종일 일정
            </Label>
          </div>

          {/* Start Date */}
          <div className="space-y-1.5">
            <Label htmlFor="sched-start">{isAllDay ? "시작일 *" : "시작 일시 *"}</Label>
            <Input
              id="sched-start"
              type={isAllDay ? "date" : "datetime-local"}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          {/* End Date */}
          <div className="space-y-1.5">
            <Label htmlFor="sched-end">{isAllDay ? "종료일" : "종료 일시"}</Label>
            <Input
              id="sched-end"
              type={isAllDay ? "date" : "datetime-local"}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="sched-desc">메모</Label>
            <textarea
              id="sched-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="일정 메모 (선택)"
              className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <DialogFooter className="gap-2">
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={loading}
                onClick={handleDelete}
                className="mr-auto"
              >
                삭제
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
              취소
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "저장 중..." : isEdit ? "수정" : "추가"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
