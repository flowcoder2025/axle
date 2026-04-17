"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@axle/ui";

const VALID_TABS = ["overview", "members", "plan", "manage"] as const;
type TabValue = (typeof VALID_TABS)[number];

type Props = {
  memberCount: number;
  overview: React.ReactNode;
  members: React.ReactNode;
  plan: React.ReactNode;
  manage: React.ReactNode;
};

export function OrgDetailTabs({ memberCount, overview, members, plan, manage }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const raw = searchParams.get("tab");
  const current: TabValue =
    raw && (VALID_TABS as readonly string[]).includes(raw) ? (raw as TabValue) : "overview";

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <Tabs value={current} onValueChange={handleChange}>
      <TabsList>
        <TabsTrigger value="overview">개요</TabsTrigger>
        <TabsTrigger value="members">멤버 ({memberCount})</TabsTrigger>
        <TabsTrigger value="plan">플랜/쿼터</TabsTrigger>
        <TabsTrigger value="manage">관리</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        {overview}
      </TabsContent>
      <TabsContent value="members">{members}</TabsContent>
      <TabsContent value="plan">{plan}</TabsContent>
      <TabsContent value="manage">{manage}</TabsContent>
    </Tabs>
  );
}
