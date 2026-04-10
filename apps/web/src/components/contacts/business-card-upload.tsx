"use client";

import { useRef, useState } from "react";
import { Button } from "@axle/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BusinessCardData {
  name: string | null;
  position: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  address: string | null;
}

interface BusinessCardUploadProps {
  /** Called when the user clicks "폼에 적용" with the parsed card data */
  onResult: (data: BusinessCardData) => void;
  /** Called when the user dismisses/cancels this component */
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BusinessCardUpload({ onResult, onClose }: BusinessCardUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<BusinessCardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setParsed(null);
    setLoading(true);

    // Show preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/ocr/business-card", {
        method: "POST",
        body: formData,
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          (json as { error?: { message?: string } }).error?.message ??
          "명함 인식에 실패했습니다";
        throw new Error(msg);
      }

      setParsed((json as { data: BusinessCardData }).data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "명함 인식에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }

  function handleFile(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드할 수 있습니다");
      return;
    }
    void upload(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFile(e.target.files?.[0]);
    // Reset so the same file can be re-selected
    e.target.value = "";
  }

  function handleApply() {
    if (parsed) {
      onResult(parsed);
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="명함 이미지 업로드 영역"
        className={[
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer select-none",
          dragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/30 hover:border-primary/50",
        ].join(" ")}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mb-2 h-8 w-8 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <p className="text-sm font-medium">명함 이미지를 드래그하거나 클릭하여 업로드</p>
        <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WEBP 지원</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleInputChange}
          aria-label="명함 이미지 파일 선택"
        />
      </div>

      {/* Preview */}
      {previewUrl && (
        <div className="overflow-hidden rounded-md border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="업로드된 명함 미리보기"
            className="max-h-40 w-full object-contain"
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <p className="text-center text-sm text-muted-foreground">명함을 인식하는 중...</p>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Parsed results */}
      {parsed && !loading && (
        <div className="rounded-md border p-3 text-sm space-y-1">
          <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">
            인식 결과
          </p>
          {([
            ["이름", parsed.name],
            ["직위", parsed.position],
            ["부서", parsed.department],
            ["전화", parsed.phone],
            ["이메일", parsed.email],
            ["회사", parsed.company],
            ["주소", parsed.address],
          ] as [string, string | null][]).map(([label, value]) =>
            value ? (
              <div key={label} className="flex gap-2">
                <span className="w-14 shrink-0 text-muted-foreground">{label}</span>
                <span className="flex-1 break-all">{value}</span>
              </div>
            ) : null,
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {onClose && (
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
        )}
        {parsed && !loading && (
          <Button type="button" size="sm" onClick={handleApply}>
            폼에 적용
          </Button>
        )}
      </div>
    </div>
  );
}
