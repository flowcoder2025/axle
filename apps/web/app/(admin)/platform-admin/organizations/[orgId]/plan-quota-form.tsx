"use client";

import { useState, useTransition } from "react";
import { Button, Input, Label, toast } from "@axle/ui";
import { updatePlanQuota } from "../actions";

type PlanQuotaFormProps = {
  orgId: string;
  plan: string;
  quotaAiJobs: number;
  quotaMembers: number;
};

export function PlanQuotaForm({
  orgId,
  plan,
  quotaAiJobs,
  quotaMembers,
}: PlanQuotaFormProps) {
  const [isPending, startTransition] = useTransition();
  const [formPlan, setFormPlan] = useState(plan);
  const [formAiJobs, setFormAiJobs] = useState(String(quotaAiJobs));
  const [formMembers, setFormMembers] = useState(String(quotaMembers));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const aiJobs = parseInt(formAiJobs, 10);
      const members = parseInt(formMembers, 10);
      if (Number.isNaN(aiJobs) || Number.isNaN(members)) {
        toast.error("숫자를 올바르게 입력해 주세요");
        return;
      }
      const result = await updatePlanQuota(orgId, {
        plan: formPlan as "free" | "pro" | "enterprise",
        quotaAiJobs: aiJobs,
        quotaMembers: members,
      });
      if (result.ok) toast.success("저장되었습니다");
      else toast.error(result.error);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="plan">플랜</Label>
        <select
          id="plan"
          value={formPlan}
          onChange={(e) => setFormPlan(e.target.value)}
          className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>
      <div>
        <Label htmlFor="quotaAiJobs">AI 작업 쿼터 (월간)</Label>
        <Input
          id="quotaAiJobs"
          type="number"
          min={0}
          value={formAiJobs}
          onChange={(e) => setFormAiJobs(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="quotaMembers">멤버 쿼터</Label>
        <Input
          id="quotaMembers"
          type="number"
          min={1}
          value={formMembers}
          onChange={(e) => setFormMembers(e.target.value)}
          className="mt-1"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "저장 중..." : "저장"}
      </Button>
    </form>
  );
}
