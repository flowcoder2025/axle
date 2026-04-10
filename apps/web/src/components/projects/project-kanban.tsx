"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Card } from "@axle/ui";
import { ProjectTypeBadge } from "./project-type-badge";
import { canTransition } from "@/lib/services/project-state-machine";
import type { ProjectType, ProjectStatus } from "@prisma/client";

export interface KanbanProject {
  id: string;
  title: string;
  type: ProjectType;
  status: ProjectStatus;
  assignedTo: string | null;
  client: { name: string };
}

interface Column {
  status: ProjectStatus;
  label: string;
  headerClass: string;
  countClass: string;
}

const COLUMNS: Column[] = [
  { status: "INTAKE",         label: "접수",        headerClass: "bg-gray-50 border-gray-200 text-gray-700",     countClass: "bg-gray-100 text-gray-600" },
  { status: "DOC_COLLECTING", label: "서류 수집 중", headerClass: "bg-orange-50 border-orange-200 text-orange-700", countClass: "bg-orange-100 text-orange-600" },
  { status: "IN_PROGRESS",    label: "진행 중",      headerClass: "bg-blue-50 border-blue-200 text-blue-700",     countClass: "bg-blue-100 text-blue-600" },
  { status: "REVIEW",         label: "검토 중",      headerClass: "bg-yellow-50 border-yellow-200 text-yellow-700", countClass: "bg-yellow-100 text-yellow-600" },
  { status: "SUBMITTED",      label: "제출 완료",    headerClass: "bg-purple-50 border-purple-200 text-purple-700", countClass: "bg-purple-100 text-purple-600" },
  { status: "APPROVED",       label: "승인",         headerClass: "bg-green-50 border-green-200 text-green-700",  countClass: "bg-green-100 text-green-600" },
  { status: "REJECTED",       label: "반려",         headerClass: "bg-red-50 border-red-200 text-red-700",        countClass: "bg-red-100 text-red-600" },
  { status: "COMPLETED",      label: "완료",         headerClass: "bg-slate-100 border-slate-300 text-slate-700", countClass: "bg-slate-200 text-slate-600" },
];

interface ProjectKanbanProps {
  projects: KanbanProject[];
}

export function ProjectKanban({ projects: initialProjects }: ProjectKanbanProps) {
  const [projects, setProjects] = useState<KanbanProject[]>(initialProjects);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ProjectStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dragProjectRef = useRef<KanbanProject | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function getColumnProjects(status: ProjectStatus) {
    return projects.filter((p) => p.status === status);
  }

  function isValidDropTarget(targetStatus: ProjectStatus) {
    const project = dragProjectRef.current;
    if (!project) return false;
    if (project.status === targetStatus) return false;
    return canTransition(project.status, targetStatus);
  }

  function handleDragStart(project: KanbanProject) {
    setDraggingId(project.id);
    dragProjectRef.current = project;
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverColumn(null);
    dragProjectRef.current = null;
  }

  function handleDragOver(e: React.DragEvent, status: ProjectStatus) {
    if (isValidDropTarget(status)) {
      e.preventDefault();
      setDragOverColumn(status);
    }
  }

  function handleDragLeave() {
    setDragOverColumn(null);
  }

  async function handleDrop(e: React.DragEvent, targetStatus: ProjectStatus) {
    e.preventDefault();
    setDragOverColumn(null);

    const project = dragProjectRef.current;
    if (!project || !canTransition(project.status, targetStatus)) {
      setDraggingId(null);
      dragProjectRef.current = null;
      return;
    }

    // Optimistic update
    setProjects((prev) =>
      prev.map((p) => (p.id === project.id ? { ...p, status: targetStatus } : p))
    );
    setDraggingId(null);
    dragProjectRef.current = null;

    function showError(message: string) {
      setError(message);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(null), 3000);
    }

    try {
      const res = await fetch(`/api/projects/${project.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });

      if (!res.ok) {
        // Rollback on failure
        setProjects((prev) =>
          prev.map((p) => (p.id === project.id ? { ...p, status: project.status } : p))
        );
        showError("상태 변경에 실패했습니다");
      }
    } catch {
      // Rollback on network error
      setProjects((prev) =>
        prev.map((p) => (p.id === project.id ? { ...p, status: project.status } : p))
      );
      showError("상태 변경에 실패했습니다");
    }
  }

  return (
    <div className="overflow-x-auto pb-4">
      {error && (
        <div className="mb-3 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="flex gap-3 min-w-max">
        {COLUMNS.map((col) => {
          const colProjects = getColumnProjects(col.status);
          const isOver = dragOverColumn === col.status;
          const isValidTarget = isValidDropTarget(col.status);

          return (
            <div
              key={col.status}
              className={[
                "flex flex-col rounded-lg border w-60 transition-colors",
                isOver && isValidTarget
                  ? "border-2 border-dashed border-primary/50 bg-primary/5"
                  : draggingId && !isValidTarget && col.status !== projects.find(p => p.id === draggingId)?.status
                  ? "opacity-50 border-border bg-muted/10"
                  : "border-border bg-muted/20",
              ].join(" ")}
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.status)}
            >
              {/* Column header */}
              <div className={`flex items-center justify-between rounded-t-lg border-b px-3 py-2.5 ${col.headerClass}`}>
                <span className="font-semibold text-xs">{col.label}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${col.countClass}`}>
                  {colProjects.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 p-2 min-h-[160px]">
                {colProjects.length === 0 && (
                  <div className="flex flex-1 items-center justify-center py-6 text-xs text-muted-foreground">
                    {isOver ? "여기에 놓기" : "없음"}
                  </div>
                )}
                {colProjects.map((project) => {
                  const isDragging = draggingId === project.id;
                  return (
                    <div
                      key={project.id}
                      draggable
                      onDragStart={() => handleDragStart(project)}
                      onDragEnd={handleDragEnd}
                      className={`transition-opacity ${isDragging ? "opacity-40" : "opacity-100"}`}
                    >
                      <Card className="cursor-grab p-2.5 shadow-sm hover:shadow-md active:cursor-grabbing">
                        <Link
                          href={`/projects/${project.id}`}
                          className="block font-medium text-sm hover:underline leading-snug"
                          onClick={(e) => {
                            if (draggingId) e.preventDefault();
                          }}
                        >
                          {project.title}
                        </Link>
                        <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                          <p>{project.client.name}</p>
                          <ProjectTypeBadge type={project.type} />
                          {project.assignedTo && <p>담당: {project.assignedTo}</p>}
                        </div>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
