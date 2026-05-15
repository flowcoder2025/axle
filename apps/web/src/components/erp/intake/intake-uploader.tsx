"use client";

/**
 * IntakeUploader — Client component for /erp/intake/new.
 *
 * Lets the user upload a receipt via drag-drop or file picker (with
 * `capture="environment"` so mobile users land directly in the camera).
 *
 * On success: redirects to /erp/intake/[draftId] for review.
 * On failure: surfaces the server-provided error text.
 *
 * Server-side OCR + parse + matchSuggestions are still synchronous in
 * POST /api/erp/intake (Phase 20 MVP), so the spinner copy warns the user
 * about the 10~20s latency.
 */

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@axle/ui";

/** Phase 20 cap; matches the limit enforced in POST /api/erp/intake. */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_PREFIXES = ["image/", "application/pdf"];

function isAllowedFile(file: File): { ok: true } | { ok: false; message: string } {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, message: "파일 크기가 10MB를 초과합니다." };
  }
  const type = file.type || "";
  const allowed = ALLOWED_PREFIXES.some((prefix) => type.startsWith(prefix));
  if (!allowed) {
    return {
      ok: false,
      message: "이미지(JPG/PNG/HEIC) 또는 PDF 파일만 업로드할 수 있습니다.",
    };
  }
  return { ok: true };
}

export function IntakeUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    const check = isAllowedFile(file);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/erp/intake", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { draftId: string };
      router.push(`/erp/intake/${data.draftId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드 실패");
      setUploading(false);
    }
  }

  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      void handleUpload(file);
    }
    // Allow re-selecting the same file after an error.
    e.target.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleUpload(file);
    }
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!uploading) setDragActive(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
  }

  function openPicker() {
    if (!uploading) inputRef.current?.click();
  }

  const dropzoneClass = [
    "rounded-lg border-2 border-dashed p-12 text-center transition-colors",
    uploading
      ? "border-muted bg-muted/30 text-muted-foreground"
      : dragActive
        ? "border-blue-500 bg-blue-50 text-blue-700"
        : "border-muted-foreground/30 hover:border-muted-foreground/60",
  ].join(" ");

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-disabled={uploading}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        className={dropzoneClass}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
            />
            <p className="text-sm font-medium">OCR 처리 중… (10~20초)</p>
            <p className="text-xs text-muted-foreground">
              영수증을 분석하고 있습니다. 페이지를 떠나지 마세요.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              영수증 이미지를 이곳에 끌어놓거나 클릭하여 선택하세요
            </p>
            <p className="text-xs text-muted-foreground">
              JPG / PNG / HEIC / PDF · 최대 10MB
            </p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={onPickFile}
        disabled={uploading}
      />

      <div className="flex items-center gap-2">
        <Button type="button" onClick={openPicker} disabled={uploading}>
          파일 선택
        </Button>
        {uploading && (
          <span className="text-xs text-muted-foreground">업로드 중…</span>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}
    </div>
  );
}
