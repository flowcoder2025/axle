"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Label,
} from "@axle/ui";
import { Upload, Plus, X } from "lucide-react";

interface ClientOption {
  id: string;
  name: string;
}

interface DocumentUploadProps {
  clients: ClientOption[];
}

type DocCategory = "INPUT" | "OUTPUT" | "TEMPLATE" | "ISSUED";

const CATEGORY_LABELS: Record<DocCategory, string> = {
  INPUT: "입력",
  OUTPUT: "출력",
  TEMPLATE: "템플릿",
  ISSUED: "발급",
};

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export function DocumentUpload({ clients }: DocumentUploadProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [clientId, setClientId] = useState("");
  const [category, setCategory] = useState<DocCategory>("INPUT");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setFile(null);
    setClientId("");
    setCategory("INPUT");
    setUploading(false);
    setProgress(0);
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      resetForm();
    }
    setOpen(next);
  }

  function validateFile(f: File): string | null {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      return `지원하지 않는 파일 형식입니다. (PDF, JPG, PNG, WEBP, DOC, DOCX)`;
    }
    if (f.size > MAX_FILE_SIZE_BYTES) {
      return `파일 크기가 ${MAX_FILE_SIZE_MB}MB를 초과합니다.`;
    }
    return null;
  }

  function handleFileSelect(f: File) {
    const validationError = validateFile(f);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setFile(f);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFileSelect(f);
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelect(f);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("파일을 선택해주세요.");
      return;
    }
    if (!clientId) {
      setError("고객사를 선택해주세요.");
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(10);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("clientId", clientId);
    formData.append("category", category);

    try {
      // Simulate progress during upload
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 80));
      }, 200);

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          json?.error?.message ?? `업로드 실패 (${res.status})`
        );
      }

      setOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "업로드에 실패했습니다.";
      setError(message);
      setProgress(0);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        서류 업로드
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>서류 업로드</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Drag-and-drop zone */}
            <div
              className={[
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50",
              ].join(" ")}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                accept={ACCEPTED_TYPES.join(",")}
                onChange={handleInputChange}
              />
              {file ? (
                <div className="flex items-center gap-2 text-sm">
                  <Upload className="h-4 w-4 text-primary" />
                  <span className="font-medium">{file.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium">
                      파일을 여기에 드래그하거나 클릭하여 선택하세요
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, JPG, PNG, WEBP, DOC, DOCX (최대 {MAX_FILE_SIZE_MB}MB)
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Client select */}
            <div className="space-y-1.5">
              <Label htmlFor="upload-client">고객사</Label>
              <select
                id="upload-client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">고객사 선택</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category select */}
            <div className="space-y-1.5">
              <Label htmlFor="upload-category">카테고리</Label>
              <select
                id="upload-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as DocCategory)}
                required
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {(Object.keys(CATEGORY_LABELS) as DocCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            {/* Upload progress */}
            {uploading && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>업로드 중...</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={uploading}
              >
                취소
              </Button>
              <Button type="submit" disabled={uploading || !file}>
                {uploading ? "업로드 중..." : "업로드"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
