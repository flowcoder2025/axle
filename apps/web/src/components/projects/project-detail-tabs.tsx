"use client";

import { useState } from "react";
import { ProjectOverview } from "./project-overview";
import { ChecklistPanel } from "../checklist/checklist-panel";
import type { ProjectStatus, ProjectType, Priority, FeeType } from "@prisma/client";

interface ChildProject {
  id: string;
  title: string;
  type: ProjectType;
  status: ProjectStatus;
}

interface ProjectSummary {
  id: string;
  title: string;
  type: ProjectType;
  status: ProjectStatus;
  priority: Priority;
  assignedTo: string | null;
  dueDate: string | null;
  memo: string | null;
  feeType: FeeType | null;
  feeAmount: string | null;
  successRate: string | null;
  isPaid: boolean;
  client: { id: string; name: string };
  children: ChildProject[];
}

interface ProjectDetailTabsProps {
  project: ProjectSummary;
}

const TABS = [
  { id: "overview", label: "개요" },
  { id: "checklist", label: "체크리스트" },
  { id: "documents", label: "서류" },
  { id: "meetings", label: "미팅" },
  { id: "ai_jobs", label: "AI 작업" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ProjectDetailTabs({ project }: ProjectDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const tablistId = "project-detail-tablist";

  return (
    <div className="space-y-4">
      {/* Tab nav */}
      <div className="border-b">
        <nav
          className="flex gap-0"
          aria-label="프로젝트 상세 탭"
          role="tablist"
          id={tablistId}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              ].join(" ")}
              aria-selected={activeTab === tab.id}
              aria-controls="project-detail-tabpanel"
              role="tab"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab panels */}
      <div
        id="project-detail-tabpanel"
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === "overview" && (
          <ProjectOverview project={project} />
        )}
        {activeTab === "checklist" && (
          <ChecklistPanel projectId={project.id} clientId={project.client.id} />
        )}
        {activeTab === "documents" && (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            서류 탭은 추후 연동 예정입니다.
          </div>
        )}
        {activeTab === "meetings" && (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            미팅 탭은 추후 연동 예정입니다.
          </div>
        )}
        {activeTab === "ai_jobs" && (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            AI 작업 탭은 추후 연동 예정입니다.
          </div>
        )}
      </div>
    </div>
  );
}
