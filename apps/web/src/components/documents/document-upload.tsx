"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from "@axle/ui";
import { Loader2, Upload, UploadCloud } from "lucide-react";

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

export function DocumentUpload({ clients }: DocumentUploadProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [category, setCategory] = useState<DocCategory>("INPUT");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setFile(null);
      setError(null);
      setSubmitting(false);
      setClientId(clients[0]?.id ?? "");
      setCategory("INPUT");
    }
    setOpen(next);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("파일을 선택해 주세요.");
      return;
    }
    if (!clientId) {
      setError("고객사를 선택해 주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("clientId", clientId);
      formData.append("category", category);

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ??
            "업로드에 실패했습니다.",
        );
      }

      handleOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        disabled={clients.length === 0}
      >
        <Upload className="mr-1.5 h-4 w-4" />
        서류 업로드
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>서류 업로드</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Client selector */}
            <div className="space-y-1.5">
              <Label htmlFor="upload-client">고객사 *</Label>
              <select
                id="upload-client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={submitting}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category selector */}
            <div className="space-y-1.5">
              <Label htmlFor="upload-category">분류 *</Label>
              <select
                id="upload-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as DocCategory)}
                disabled={submitting}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {(Object.keys(CATEGORY_LABELS) as DocCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            {/* Drag-and-drop zone */}
            <div className="space-y-1.5">
              <Label>파일 *</Label>
              <div
                role="button"
                tabIndex={0}
                aria-label="파일 선택 영역 — 파일을 끌어다 놓거나 클릭하여 선택"
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={[
                  "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
                  dragging
                    ? "border-primary bg-primary/5"
                    : "border-input hover:border-primary/50 hover:bg-muted/30",
                  submitting ? "pointer-events-none opacity-50" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <UploadCloud className="mb-2 h-8 w-8 text-muted-foreground" />
                {file ? (
                  <p className="text-sm font-medium">{file.name}</p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      파일을 끌어다 놓거나{" "}
                      <span className="font-medium text-primary underline underline-offset-2">
                        클릭하여 선택
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      PDF, 이미지, Word 등 모든 파일 형식 지원
                    </p>
                  </>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={submitting}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
              >
                취소
              </Button>
              <Button type="submit" disabled={submitting || !file}>
                {submitting ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 h-4 w-4" />
                )}
                업로드
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
