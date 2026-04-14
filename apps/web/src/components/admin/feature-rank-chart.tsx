"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui";

type ActionData = {
  action: string;
  count: number;
};

type FeatureRankChartProps = {
  data: ActionData[];
  title?: string;
};

const ACTION_LABELS: Record<string, string> = {
  "project.create": "프로젝트 생성",
  "doc.upload": "서류 업로드",
  "doc.request": "서류 요청",
  "ai.job.complete": "AI 작업",
  "matching.run": "매칭 실행",
  "meeting.create": "미팅 생성",
  "estimate.create": "견적 생성",
  "contract.create": "계약 생성",
  "client.create": "고객 등록",
  "project.assign": "프로젝트 배정",
};

function formatAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function FeatureRankChart({ data, title = "기능 사용 랭킹" }: FeatureRankChartProps) {
  const formatted = data.map((d) => ({ ...d, label: formatAction(d.action) }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formatted} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" className="text-xs" />
              <YAxis dataKey="label" type="category" className="text-xs" width={75} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="count" name="사용 횟수" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
