"use client";

import { useEffect, useState } from "react";
import { Download, History } from "lucide-react";
import { Button } from "@axle/ui";

interface VersionEntry {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  version: number;
  createdAt: string;
}

interface DocumentVersionListProps {
  documentId: string;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function DocumentVersionList({ documentId }: DocumentVersionListProps) {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchVersions() {
      try {
        const res = await fetch(`/api/documents/${documentId}/versions`);
        if (!res.ok) throw new Error("버전 정보를 불러올 수 없습니다.");
        const json = await res.json();
        if (!cancelled) {
          setVersions(json.data ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "오류가 발생했습니다."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchVersions();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  async function handleDownload(versionId: string, name: string) {
    setDownloadingId(versionId);
    try {
      const res = await fetch(`/api/documents/${versionId}/download`);
      if (!res.ok) throw new Error("다운로드 실패");
      const json = await res.json();
      const a = document.createElement("a");
      a.href = json.data.url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert("다운로드에 실패했습니다.");
    } finally {
      setDownloadingId(null);
    }
  }

  if (loading) {
    return (
      <div className="px-6 py-3 text-sm text-muted-foreground">
        버전 불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-3 text-sm text-destructive">{error}</div>
    );
  }

  return (
    <div className="px-6 py-3">
      <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <History className="h-3.5 w-3.5" />
        버전 히스토리
      </div>
      {versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">버전 정보가 없습니다.</p>
      ) : (
        <ul className="space-y-1.5">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between rounded-md bg-background px-3 py-2 text-sm border"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground w-6">
                  v{v.version}
                </span>
                <span className="truncate max-w-xs">{v.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(v.createdAt)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0"
                onClick={() => handleDownload(v.id, v.name)}
                disabled={downloadingId === v.id}
                title="이 버전 다운로드"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="sr-only">v{v.version} 다운로드</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
