"use client";

import { useState } from "react";
import { Button, Label } from "@axle/ui";
import { FileText, Sparkles } from "lucide-react";

interface TranscriptData {
  id: string;
  rawTranscript: string;
  summary: string | null;
  keyDecisions: unknown;
  aiJobId: string | null;
}

interface TranscriptPanelProps {
  meetingId: string;
  transcript: TranscriptData | null;
  onChanged?: () => void;
}

const textareaCn =
  "flex min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function TranscriptPanel({ meetingId, transcript: initial, onChanged }: TranscriptPanelProps) {
  const [transcript, setTranscript] = useState<TranscriptData | null>(initial);
  const [pasteText, setPasteText] = useState("");
  const [showPasteForm, setShowPasteForm] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handlePaste(e: React.FormEvent) {
    e.preventDefault();
    if (!pasteText.trim()) return;
    setPasting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawTranscript: pasteText.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "전사 저장에 실패했습니다.");
        return;
      }
      setTranscript(json.data);
      setPasteText("");
      setShowPasteForm(false);
      setSuccessMsg("전사가 저장되었습니다. 요약이 생성 중입니다...");
      onChanged?.();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setPasting(false);
    }
  }

  async function handleGenerateSummary() {
    if (!transcript) return;
    setSummarizing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      // Re-POST transcript to trigger summary generation again
      const res = await fetch(`/api/meetings/${meetingId}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawTranscript: transcript.rawTranscript }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "요약 생성 요청에 실패했습니다.");
        return;
      }
      setTranscript(json.data);
      setSuccessMsg("요약 생성 작업이 요청되었습니다.");
      onChanged?.();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSummarizing(false);
    }
  }

  const keyDecisions = transcript?.keyDecisions
    ? (Array.isArray(transcript.keyDecisions)
        ? (transcript.keyDecisions as string[])
        : null)
    : null;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {successMsg && <p className="text-sm text-green-600">{successMsg}</p>}

      {/* Summary section */}
      {transcript?.summary ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">AI 요약</h3>
          </div>
          <div className="rounded-lg bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {transcript.summary}
          </div>
        </div>
      ) : transcript && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-muted-foreground">AI 요약</h3>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateSummary}
              disabled={summarizing}
            >
              {summarizing ? "요약 중..." : "요약 생성"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {transcript.aiJobId
              ? "요약 생성 중입니다. 잠시 후 새로고침 해주세요."
              : "아직 요약이 없습니다. '요약 생성' 버튼을 클릭하세요."}
          </p>
        </div>
      )}

      {/* Key decisions */}
      {keyDecisions && keyDecisions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">주요 결정사항</h3>
          <ul className="space-y-1.5 pl-4">
            {keyDecisions.map((decision, idx) => (
              <li key={idx} className="text-sm text-muted-foreground list-disc">
                {decision}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Raw transcript */}
      {transcript?.rawTranscript && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">원본 전사</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPasteForm(true)}
            >
              수정
            </Button>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border p-4 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {transcript.rawTranscript}
          </div>
        </div>
      )}

      {/* Paste form */}
      {showPasteForm || !transcript ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">
            {transcript ? "전사 수정" : "전사 붙여넣기"}
          </h3>
          <form onSubmit={handlePaste} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="transcript-text">전사 내용</Label>
              <textarea
                id="transcript-text"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="미팅 전사 내용을 붙여넣으세요..."
                disabled={pasting}
                className={textareaCn}
                rows={8}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pasting || !pasteText.trim()}>
                {pasting ? "저장 중..." : "저장"}
              </Button>
              {transcript && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPasteForm(false)}
                  disabled={pasting}
                >
                  취소
                </Button>
              )}
            </div>
          </form>
        </div>
      ) : (
        !transcript && (
          <Button
            variant="outline"
            onClick={() => setShowPasteForm(true)}
          >
            <FileText className="mr-2 h-4 w-4" />
            전사 붙여넣기
          </Button>
        )
      )}
    </div>
  );
}
