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

interface ClientOption {
  id: string;
  name: string;
}

interface ResearcherOption {
  id: string;
  name: string;
  position: string | null;
  clientId: string;
}

interface JournalFormProps {
  clients: ClientOption[];
  researchers: ResearcherOption[];
  defaultClientId?: string;
}

export interface JournalFormData {
  id?: string;
  clientId?: string;
  researcherContactId?: string;
  date?: string;
  title?: string;
  content?: string;
  objectives?: string;
  results?: string;
  nextSteps?: string;
  hours?: number | null;
  status?: "DRAFT" | "SUBMITTED" | "APPROVED";
}

interface JournalEditFormProps extends JournalFormProps {
  initialData?: JournalFormData;
  mode?: "create" | "edit";
}

const selectCn = cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
  "transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

const textareaCn = cn(
  "flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
  "transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-muted-foreground resize-vertical"
);

export function JournalForm({
  clients,
  researchers,
  defaultClientId = "",
  initialData,
  mode = "create",
}: JournalEditFormProps) {
  const router = useRouter();

  const [clientId, setClientId] = useState(initialData?.clientId ?? defaultClientId);
  const [researcherContactId, setResearcherContactId] = useState(
    initialData?.researcherContactId ?? ""
  );
  const [date, setDate] = useState(
    initialData?.date ? initialData.date.split("T")[0] : ""
  );
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [content, setContent] = useState(initialData?.content ?? "");
  const [objectives, setObjectives] = useState(initialData?.objectives ?? "");
  const [results, setResults] = useState(initialData?.results ?? "");
  const [nextSteps, setNextSteps] = useState(initialData?.nextSteps ?? "");
  const [hours, setHours] = useState(
    initialData?.hours != null ? String(initialData.hours) : ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Filter researchers by selected client
  const filteredResearchers = clientId
    ? researchers.filter((r) => r.clientId === clientId)
    : researchers;

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!clientId) newErrors.clientId = "고객사를 선택해주세요.";
    if (!researcherContactId) newErrors.researcherContactId = "연구자를 선택해주세요.";
    if (!date) newErrors.date = "날짜를 입력해주세요.";
    if (!title.trim()) newErrors.title = "제목은 필수입니다.";
    if (!content.trim()) newErrors.content = "내용은 필수입니다.";
    if (hours && isNaN(Number(hours))) newErrors.hours = "시간은 숫자여야 합니다.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setServerError(null);

    const payload = {
      clientId,
      researcherContactId,
      date: new Date(`${date}T00:00:00`).toISOString(),
      title: title.trim(),
      content: content.trim(),
      objectives: objectives.trim() || undefined,
      results: results.trim() || undefined,
      nextSteps: nextSteps.trim() || undefined,
      hours: hours ? Number(hours) : undefined,
    };

    try {
      let res: Response;
      if (mode === "edit" && initialData?.id) {
        res = await fetch(`/api/journals/${initialData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/journals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();

      if (!res.ok) {
        setServerError(json?.error?.message ?? "저장 중 오류가 발생했습니다.");
        return;
      }

      const savedId: string = json.data?.id ?? initialData?.id;
      router.push(`/journals/${savedId}`);
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
            {mode === "create" && (
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
                      setResearcherContactId("");
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
                  <Label htmlFor="researcherContactId">
                    연구자 <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="researcherContactId"
                    value={researcherContactId}
                    onChange={(e) => {
                      setResearcherContactId(e.target.value);
                      setErrors((p) => ({ ...p, researcherContactId: "" }));
                    }}
                    disabled={submitting || filteredResearchers.length === 0}
                    className={selectCn}
                  >
                    <option value="">연구자 선택</option>
                    {filteredResearchers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                        {r.position ? ` (${r.position})` : ""}
                      </option>
                    ))}
                  </select>
                  {errors.researcherContactId && (
                    <p className="text-xs text-destructive">
                      {errors.researcherContactId}
                    </p>
                  )}
                </div>
              </div>
            )}

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
                <Label htmlFor="hours">연구 시간 (h)</Label>
                <Input
                  id="hours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={hours}
                  onChange={(e) => {
                    setHours(e.target.value);
                    setErrors((p) => ({ ...p, hours: "" }));
                  }}
                  placeholder="예: 6"
                  disabled={submitting}
                />
                {errors.hours && (
                  <p className="text-xs text-destructive">{errors.hours}</p>
                )}
              </div>
            </div>

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
                placeholder="예: ResNet 기반 분류 모델 설계 연구"
                disabled={submitting}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Research Content */}
        <Card>
          <CardHeader>
            <CardTitle>연구 내용</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="content">
                내용 <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setErrors((p) => ({ ...p, content: "" }));
                }}
                placeholder="연구 내용을 입력하세요..."
                disabled={submitting}
                className={textareaCn}
                rows={6}
              />
              {errors.content && (
                <p className="text-xs text-destructive">{errors.content}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="objectives">연구 목표</Label>
              <textarea
                id="objectives"
                value={objectives}
                onChange={(e) => setObjectives(e.target.value)}
                placeholder="이번 연구의 목표를 입력하세요..."
                disabled={submitting}
                className={textareaCn}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="results">연구 결과</Label>
              <textarea
                id="results"
                value={results}
                onChange={(e) => setResults(e.target.value)}
                placeholder="연구 결과를 입력하세요..."
                disabled={submitting}
                className={textareaCn}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nextSteps">차기 계획</Label>
              <textarea
                id="nextSteps"
                value={nextSteps}
                onChange={(e) => setNextSteps(e.target.value)}
                placeholder="다음 단계 계획을 입력하세요..."
                disabled={submitting}
                className={textareaCn}
                rows={3}
              />
            </div>
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
                {submitting
                  ? "저장 중..."
                  : mode === "edit"
                  ? "수정 저장"
                  : "연구일지 생성"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </form>
  );
}
