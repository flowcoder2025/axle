"use client";

import { useState } from "react";
import { Button } from "@axle/ui";
import { ProjectOverview } from "./project-overview";
import type {
  RollupAggregate,
  RollupChildResult,
} from "../../../lib/services/bundle-rollup";
import { ChecklistPanel } from "../checklist/checklist-panel";
import { ActivityFeed } from "../collaboration/activity-feed";
import { MemberList } from "./member-list";
import { AddMemberDialog } from "./add-member-dialog";
import { HandoffForm } from "./handoff-form";
import { HandoffSummary } from "./handoff-summary";
import { ProjectDocumentList } from "./project-document-list";
import { BundlePropagateButton } from "./bundle-propagate-button";
import { ProjectMeetingList } from "./project-meeting-list";
import { ProjectAiJobList } from "./project-ai-job-list";
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
  assignedToId: string | null;
  assignedToUser?: { id: string; name: string | null; email: string } | null;
  dueDate: string | null;
  memo: string | null;
  feeType: FeeType | null;
  feeAmount: string | null;
  successRate: string | null;
  isPaid: boolean;
  client: { id: string; name: string };
  children: ChildProject[];
}

interface BundleRollup {
  children: RollupChildResult[];
  aggregate: RollupAggregate;
}

interface ProjectDetailTabsProps {
  project: ProjectSummary;
  rollup?: BundleRollup | null;
}

const TABS = [
  { id: "overview", label: "개요" },
  { id: "checklist", label: "체크리스트" },
  { id: "documents", label: "서류" },
  { id: "meetings", label: "미팅" },
  { id: "members", label: "팀원" },
  { id: "activity", label: "활동" },
  { id: "handoff", label: "인수인계" },
  { id: "ai_jobs", label: "AI 작업" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ProjectDetailTabs({ project, rollup }: ProjectDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
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
          <ProjectOverview project={project} rollup={rollup ?? null} />
        )}
        {activeTab === "checklist" && (
          <ChecklistPanel projectId={project.id} clientId={project.client.id} />
        )}
        {activeTab === "documents" && (
          <div className="space-y-4">
            {project.type === "BUNDLE" && (
              <BundlePropagateButton projectId={project.id} />
            )}
            <ProjectDocumentList projectId={project.id} />
          </div>
        )}
        {activeTab === "meetings" && (
          <ProjectMeetingList projectId={project.id} />
        )}
        {activeTab === "members" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">프로젝트 멤버</h3>
              <Button
                type="button"
                size="sm"
                onClick={() => setMemberDialogOpen(true)}
              >
                팀원 추가
              </Button>
            </div>
            <MemberList projectId={project.id} canManage />
            <AddMemberDialog
              projectId={project.id}
              open={memberDialogOpen}
              onClose={() => setMemberDialogOpen(false)}
            />
          </div>
        )}
        {activeTab === "activity" && (
          <ActivityFeed projectId={project.id} />
        )}
        {activeTab === "handoff" && (
          <div className="space-y-6">
            <HandoffForm projectId={project.id} />
            <HandoffSummary projectId={project.id} />
          </div>
        )}
        {activeTab === "ai_jobs" && (
          <ProjectAiJobList projectId={project.id} />
        )}
      </div>
    </div>
  );
}
