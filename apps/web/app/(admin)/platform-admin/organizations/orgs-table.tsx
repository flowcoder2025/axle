"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2 } from "lucide-react";
import {
  Button,
  Input,
  Badge,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@axle/ui";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isSuspended: boolean;
  memberCount: number;
  createdAt: string;
};

type OrgsTableProps = {
  orgs: OrgRow[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
};

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

export function OrgsTable({ orgs, pagination }: OrgsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");

  const updateSearchParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== "page") params.delete("page");
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <form
        className="max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          updateSearchParam("search", searchInput || null);
        }}
      >
        <Input
          placeholder="조직명 또는 slug 검색"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </form>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>조직명</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>멤버 수</TableHead>
              <TableHead>플랜</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>생성일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orgs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  <Building2 className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  조직이 없습니다
                </TableCell>
              </TableRow>
            )}
            {orgs.map((org) => (
              <TableRow key={org.id}>
                <TableCell>
                  <Link
                    href={`/platform-admin/organizations/${org.id}`}
                    className="font-medium hover:underline"
                  >
                    {org.name}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{org.slug}</TableCell>
                <TableCell>{org.memberCount}</TableCell>
                <TableCell>
                  <Badge variant="outline">{PLAN_LABEL[org.plan] ?? org.plan}</Badge>
                </TableCell>
                <TableCell>
                  {org.isSuspended ? (
                    <Badge variant="outline" className="border-red-500/30 text-red-600">
                      정지
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">
                      정상
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(org.createdAt).toLocaleDateString("ko-KR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            총 {pagination.total}개 · {pagination.page} / {pagination.totalPages} 페이지
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => updateSearchParam("page", String(pagination.page - 1))}
            >
              이전
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => updateSearchParam("page", String(pagination.page + 1))}
            >
              다음
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
