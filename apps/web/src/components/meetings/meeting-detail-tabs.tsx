"use client";

import { useState } from "react";
import { AttendeeList, type Attendee } from "./attendee-list";
import { TranscriptPanel } from "./transcript-panel";
import { ActionItemList, type ActionItem } from "./action-item-list";
import { RecordingUpload } from "./recording-upload";
import { SendSummaryButton } from "./send-summary-button";

interface TranscriptData {
  id: string;
  rawTranscript: string;
  summary: string | null;
  keyDecisions: unknown;
  aiJobId: string | null;
}

interface MeetingInfo {
  id: string;
  title: string;
  date: string;
  location: string | null;
  clientId: string;
  client: { id: string; name: string };
  project: { id: string; title: string } | null;
  attendees: Attendee[];
  transcript: TranscriptData | null;
  actionItems: ActionItem[];
  recordingUrl: string | null;
}

interface MeetingDetailTabsProps {
  meeting: MeetingInfo;
}

const TABS = [
  { id: "info", label: "정보" },
  { id: "transcript", label: "전사/요약" },
  { id: "actions", label: "액션 아이템" },
  { id: "recording", label: "녹음" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function MeetingDetailTabs({ meeting }: MeetingDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [recordingUrl, setRecordingUrl] = useState(meeting.recordingUrl);
  const [hasSummary, setHasSummary] = useState(!!meeting.transcript?.summary);

  return (
    <div className="space-y-4">
      {/* Tab nav */}
      <div className="border-b">
        <nav className="flex gap-0" aria-label="미팅 상세 탭">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              ].join(" ")}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab panels */}
      <div role="tabpanel" className="min-h-[300px]">
        {activeTab === "info" && (
          <div className="space-y-6">
            {/* Meeting details */}
            <dl className="max-w-2xl divide-y rounded-lg border">
              <div className="grid grid-cols-3 gap-4 px-4 py-3">
                <dt className="text-sm font-medium text-muted-foreground">일시</dt>
                <dd className="col-span-2 text-sm">{formatDate(meeting.date)}</dd>
              </div>
              <div className="grid grid-cols-3 gap-4 px-4 py-3">
                <dt className="text-sm font-medium text-muted-foreground">고객사</dt>
                <dd className="col-span-2 text-sm">{meeting.client.name}</dd>
              </div>
              {meeting.project && (
                <div className="grid grid-cols-3 gap-4 px-4 py-3">
                  <dt className="text-sm font-medium text-muted-foreground">프로젝트</dt>
                  <dd className="col-span-2 text-sm">{meeting.project.title}</dd>
                </div>
              )}
              {meeting.location && (
                <div className="grid grid-cols-3 gap-4 px-4 py-3">
                  <dt className="text-sm font-medium text-muted-foreground">장소</dt>
                  <dd className="col-span-2 text-sm">{meeting.location}</dd>
                </div>
              )}
            </dl>

            {/* Attendees */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">참석자</h3>
              <AttendeeList
                meetingId={meeting.id}
                attendees={meeting.attendees}
              />
            </div>
          </div>
        )}

        {activeTab === "transcript" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">전사 및 요약</h3>
              <SendSummaryButton
                meetingId={meeting.id}
                hasSummary={hasSummary}
              />
            </div>
            <TranscriptPanel
              meetingId={meeting.id}
              transcript={meeting.transcript}
              onChanged={() => {
                // Re-check summary state after transcript changes
                setHasSummary(false);
              }}
            />
          </div>
        )}

        {activeTab === "actions" && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">액션 아이템</h3>
            <ActionItemList
              meetingId={meeting.id}
              actionItems={meeting.actionItems}
              clientId={meeting.clientId}
            />
          </div>
        )}

        {activeTab === "recording" && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">녹음 파일</h3>
            <RecordingUpload
              meetingId={meeting.id}
              recordingUrl={recordingUrl}
              onChanged={(url) => setRecordingUrl(url)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
