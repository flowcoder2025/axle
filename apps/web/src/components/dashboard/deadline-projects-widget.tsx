"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@axle/ui";
import { FolderOpen, Clock } from "lucide-react";

interface DeadlineProject {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  daysRemaining: number;
  clientName: string;
}

interface ApiResponse {
  data: DeadlineProject[];
  total: number;
}

function DdayBadge({ days }: { days: number }) {
  if (days <= 3) {
    return (
      <Badge variant="destructive" className="text-xs">
        D-{days}
      </Badge>
    );
  }
  if (days <= 7) {
    return (
      <Badge
        variant="outline"
        className="border-orange-400 bg-orange-50 text-orange-700 text-xs hover:bg-orange-50"
      >
        D-{days}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-yellow-400 bg-yellow-50 text-yellow-700 text-xs hover:bg-yellow-50"
    >
      D-{days}
    </Badge>
  );
}

export function DeadlineProjectsWidget() {
  const [projects, setProjects] = useState<DeadlineProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/deadline-projects");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ??
            "마감 프로젝트를 불러오지 못했습니다"
        );
      }
      const json: ApiResponse = await res.json();
      setProjects(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">마감 임박</h3>
          {!loading && !error && (
            <Badge variant="secondary" className="text-xs">
              {projects.length}
            </Badge>
          )}
        </div>
        <Link
          href="/projects"
          className="text-xs text-primary hover:underline"
        >
          전체 보기
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          불러오는 중...
        </div>
      )}

      {error && (
        <div className="px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-muted-foreground">
            마감 임박 프로젝트가 없습니다
          </p>
        </div>
      )}

      {!loading && !error && projects.length > 0 && (
        <ul className="divide-y">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {project.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {project.clientName}
                    </p>
                  </div>
                </div>
                <div className="ml-2 shrink-0">
                  <DdayBadge days={project.daysRemaining} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
