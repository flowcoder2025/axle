"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  cn,
} from "@axle/ui";
import { Plus, Trash2 } from "lucide-react";

interface ClientOption {
  id: string;
  name: string;
}

interface ProjectOption {
  id: string;
  title: string;
  clientId: string;
}

interface AttendeeInput {
  name: string;
  role: string;
}

interface MeetingFormProps {
  clients: ClientOption[];
  projects: ProjectOption[];
  mode?: "create" | "edit";
  meetingId?: string;
  initialData?: {
    title?: string;
    clientId?: string;
    projectId?: string;
    date?: string;
    time?: string;
    location?: string;
  };
}

const selectCn = cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
  "transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

export function MeetingForm({ clients, projects, mode = "create", meetingId, initialData }: MeetingFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [clientId, setClientId] = useState(initialData?.clientId ?? "");
  const [projectId, setProjectId] = useState(initialData?.projectId ?? "");
  const [date, setDate] = useState(initialData?.date ?? "");
  const [time, setTime] = useState(initialData?.time ?? "");
  const [location, setLocation] = useState(initialData?.location ?? "");
  const [attendees, setAttendees] = useState<AttendeeInput[]>([{ name: "", role: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Filter projects by selected client
  const filteredProjects = clientId
    ? projects.filter((p) => p.clientId === clientId)
    : projects;

  function addAttendee() {
    setAttendees((prev) => [...prev, { name: "", role: "" }]);
  }

  function removeAttendee(idx: number) {
    setAttendees((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateAttendee(
    idx: number,
    field: keyof AttendeeInput,
    value: string
  ) {
    setAttendees((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a))
    );
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "제목은 필수입니다.";
    if (!clientId) newErrors.clientId = "고객사를 선택해주세요.";
    if (!date) newErrors.date = "날짜를 입력해주세요.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setServerError(null);

    const datetime = time ? `${date}T${time}:00` : `${date}T00:00:00`;
    const validAttendees = attendees.filter((a) => a.name.trim());

    try {
      const url = mode === "create" ? "/api/meetings" : `/api/meetings/${meetingId}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const payload: Record<string, unknown> = {
        title: title.trim(),
        clientId,
        projectId: projectId || undefined,
        date: new Date(datetime).toISOString(),
        location: location.trim() || undefined,
      };
      if (mode === "create" && validAttendees.length > 0) {
        payload.attendees = validAttendees.map((a) => ({
          name: a.name.trim(),
          role: a.role.trim() || undefined,
        }));
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        setServerError(json?.error?.message ?? "저장 중 오류가 발생했습니다.");
        return;
      }

      const savedId: string = json.data?.id ?? meetingId;
      router.push(`/meetings/${savedId}`);
      router.refresh();
    } catch {
      setServerError("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                제목 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setErrors((p) => ({ ...p, title: "" }));
                }}
                placeholder="예: 1분기 사업계획 검토 미팅"
                disabled={submitting}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clientId">
                  고객사 <span className="text-destructive">*</span>
                </Label>
                <select
                  id="clientId"
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setProjectId("");
                    setErrors((p) => ({ ...p, clientId: "" }));
                  }}
                  disabled={submitting}
                  className={selectCn}
                >
                  <option value="">고객사 선택</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.clientId && (
                  <p className="text-xs text-destructive">{errors.clientId}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="projectId">프로젝트 (선택)</Label>
                <select
                  id="projectId"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={submitting || filteredProjects.length === 0}
                  className={selectCn}
                >
                  <option value="">프로젝트 선택 (선택사항)</option>
                  {filteredProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">
                  날짜 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setErrors((p) => ({ ...p, date: "" }));
                  }}
                  disabled={submitting}
                />
                {errors.date && (
                  <p className="text-xs text-destructive">{errors.date}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">시간</Label>
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">장소</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="예: 본사 회의실 A"
                disabled={submitting}
              />
            </div>
          </CardContent>
        </Card>

        {/* Attendees */}
        <Card>
          <CardHeader>
            <CardTitle>초기 참석자</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {attendees.map((attendee, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor={`attendee-name-${idx}`}>이름</Label>
                  <Input
                    id={`attendee-name-${idx}`}
                    value={attendee.name}
                    onChange={(e) => updateAttendee(idx, "name", e.target.value)}
                    placeholder="홍길동"
                    disabled={submitting}
                  />
                </div>
                <div className="w-40 space-y-1.5">
                  <Label htmlFor={`attendee-role-${idx}`}>역할</Label>
                  <Input
                    id={`attendee-role-${idx}`}
                    value={attendee.role}
                    onChange={(e) => updateAttendee(idx, "role", e.target.value)}
                    placeholder="대표이사"
                    disabled={submitting}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAttendee(idx)}
                  disabled={submitting || attendees.length <= 1}
                  aria-label="참석자 제거"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addAttendee}
              disabled={submitting}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              참석자 추가
            </Button>
          </CardContent>

          <CardFooter className="flex items-center gap-3">
            {serverError && (
              <p className="flex-1 text-sm text-destructive">{serverError}</p>
            )}
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={submitting}
              >
                취소
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "저장 중..." : mode === "create" ? "미팅 생성" : "변경 저장"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </form>
  );
}
