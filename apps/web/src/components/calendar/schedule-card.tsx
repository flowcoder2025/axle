import { Badge, Card, CardContent, cn } from "@axle/ui";
import type { SerializedSchedule } from "@/app/(app)/calendar/page";

const TYPE_LABELS: Record<string, string> = {
  DEADLINE: "마감",
  MEETING: "미팅",
  REMINDER: "리마인더",
  PROGRAM_DUE: "사업 마감",
};

const TYPE_BADGE_CLASS: Record<string, string> = {
  DEADLINE: "border-red-200 bg-red-50 text-red-700",
  MEETING: "border-blue-200 bg-blue-50 text-blue-700",
  REMINDER: "border-yellow-200 bg-yellow-50 text-yellow-700",
  PROGRAM_DUE: "border-purple-200 bg-purple-50 text-purple-700",
};

interface ScheduleCardProps {
  schedule: SerializedSchedule;
  onClick?: () => void;
  expanded?: boolean;
}

function formatTime(isoString: string, isAllDay: boolean) {
  if (isAllDay) return "종일";
  const d = new Date(isoString);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export function ScheduleCard({ schedule, onClick, expanded = false }: ScheduleCardProps) {
  const startTime = formatTime(schedule.startDate, schedule.isAllDay);
  const endTime = schedule.endDate ? formatTime(schedule.endDate, schedule.isAllDay) : null;
  const timeLabel =
    schedule.isAllDay ? "종일" : endTime ? `${startTime} – ${endTime}` : startTime;

  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer transition-shadow hover:shadow-sm",
        !expanded && "border-0 shadow-none hover:shadow-none hover:bg-accent/50"
      )}
    >
      <CardContent className={cn("p-3", !expanded && "p-2")}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge
                variant="outline"
                className={cn("text-xs h-5 px-1.5", TYPE_BADGE_CLASS[schedule.type])}
              >
                {TYPE_LABELS[schedule.type] ?? schedule.type}
              </Badge>
              {schedule.client && (
                <span className="text-xs text-muted-foreground truncate">
                  {schedule.client.name}
                </span>
              )}
            </div>
            <p className={cn("font-medium truncate", expanded ? "mt-1 text-sm" : "mt-0.5 text-xs")}>
              {schedule.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{timeLabel}</p>
            {expanded && schedule.description && (
              <p className="mt-1.5 text-sm text-muted-foreground whitespace-pre-line">
                {schedule.description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
