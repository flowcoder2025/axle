"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@axle/ui";
import { getValidTransitions, getStatusLabel } from "@/lib/services/project-state-machine";
import { Loader2 } from "lucide-react";
import type { ProjectStatus } from "@prisma/client";

interface ProjectStatusControlsProps {
  projectId: string;
  currentStatus: ProjectStatus;
}

export function ProjectStatusControls({ projectId, currentStatus }: ProjectStatusControlsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<ProjectStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validTransitions = getValidTransitions(currentStatus);

  if (validTransitions.length === 0) {
    return null;
  }

  async function handleTransition(targetStatus: ProjectStatus) {
    setLoading(targetStatus);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ?? "상태 변경에 실패했습니다."
        );
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "상태 변경에 실패했습니다.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {validTransitions.map((targetStatus) => {
          const isLoading = loading === targetStatus;
          return (
            <Button
              key={targetStatus}
              size="sm"
              variant="outline"
              onClick={() => handleTransition(targetStatus)}
              disabled={loading !== null}
            >
              {isLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {getStatusLabel(targetStatus)}으로 이동
            </Button>
          );
        })}
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
