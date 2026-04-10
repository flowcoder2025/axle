"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";

/**
 * Portal Upload Page — allows clients to upload documents via portal token.
 * Reuses the existing upload token endpoint from WI-054.
 */
export default function PortalUploadPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<{ name: string; ok: boolean; message: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    setUploading(true);
    setResults([]);

    const uploadResults: { name: string; ok: boolean; message: string }[] = [];

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("token", token);

        const res = await fetch(`/api/upload/${token}`, {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          uploadResults.push({ name: file.name, ok: true, message: "업로드 완료" });
        } else {
          const json = await res.json() as { error?: { message?: string } };
          uploadResults.push({
            name: file.name,
            ok: false,
            message: json.error?.message ?? "업로드 실패",
          });
        }
      } catch {
        uploadResults.push({ name: file.name, ok: false, message: "네트워크 오류" });
      }
    }

    setResults(uploadResults);
    setFiles([]);
    setUploading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <a href={`/portal/${token}`} className="text-sm text-primary hover:underline">
          ← 포털 홈
        </a>
        <h1 className="text-2xl font-bold mt-2">서류 업로드</h1>
        <p className="text-muted-foreground text-sm mt-1">
          필요한 서류 파일을 선택하거나 드래그하여 업로드해 주세요.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
        >
          <p className="text-4xl mb-2">📁</p>
          <p className="font-medium">파일을 드래그하거나 클릭하여 선택</p>
          <p className="text-sm text-muted-foreground mt-1">PDF, 이미지, 문서 파일 지원</p>
          <input
            type="file"
            multiple
            onChange={handleFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="파일 선택"
          />
          <label className="mt-4 inline-block cursor-pointer rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent transition-colors">
            파일 선택
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <ul className="space-y-2">
            {files.map((file, i) => (
              <li key={i} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="ml-2 text-muted-foreground hover:text-destructive shrink-0"
                  aria-label={`${file.name} 제거`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="submit"
          disabled={files.length === 0 || uploading}
          className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? "업로드 중..." : `${files.length}개 파일 업로드`}
        </button>
      </form>

      {/* Upload results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-medium text-sm">업로드 결과</h2>
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                r.ok ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
              }`}
            >
              <span>{r.ok ? "✅" : "❌"}</span>
              <span className="font-medium">{r.name}</span>
              <span className="text-xs ml-auto">{r.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
