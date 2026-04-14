"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Users as UsersIcon } from "lucide-react";
import {
  Button,
  Input,
  Checkbox,
  Badge,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  toast,
} from "@axle/ui";
import { UserRowActions } from "./user-row-actions";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  platformRole: "USER" | "PLATFORM_ADMIN";
  isActive: boolean;
  createdAt: string;
  orgs: { id: string; name: string; role: string }[];
};

type UsersTableProps = {
  users: UserRow[];
  currentUserId: string;
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
};

export function UsersTable({ users, currentUserId, pagination }: UsersTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");

  const selectableIds = users.filter((u) => u.id !== currentUserId).map((u) => u.id);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableIds));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateSearchParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== "page") params.delete("page");
    router.push(`?${params.toString()}`);
  };

  const handleBulkAction = (
    action: "changeRole" | "deactivate" | "activate",
    role?: "USER" | "PLATFORM_ADMIN",
  ) => {
    if (selected.size === 0) return;
    startTransition(async () => {
      const res = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          userIds: Array.from(selected),
          ...(role ? { platformRole: role } : {}),
        }),
      });
      if (res.ok) {
        const json = await res.json();
        toast.success(`${json.data.updated}명 업데이트됨`);
        setSelected(new Set());
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({ error: { message: "실패" } }));
        toast.error(err.error?.message ?? "실패");
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="min-w-[200px] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            updateSearchParam("search", searchInput || null);
          }}
        >
          <Input
            placeholder="이름 또는 이메일 검색"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </form>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={searchParams.get("role") ?? ""}
          onChange={(e) => updateSearchParam("role", e.target.value || null)}
        >
          <option value="">모든 역할</option>
          <option value="USER">일반</option>
          <option value="PLATFORM_ADMIN">관리자</option>
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={searchParams.get("status") ?? ""}
          onChange={(e) => updateSearchParam("status", e.target.value || null)}
        >
          <option value="">모든 상태</option>
          <option value="active">활성</option>
          <option value="inactive">비활성</option>
        </select>
        <Button variant="outline" size="sm" asChild>
          <a href="/api/admin/users/export" download>
            <Download className="mr-2 h-4 w-4" />
            CSV 내보내기
          </a>
        </Button>
      </div>

      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-2">
          <span className="text-sm font-medium">{selected.size}명 선택됨</span>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => handleBulkAction("changeRole", "PLATFORM_ADMIN")}
          >
            관리자로
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => handleBulkAction("changeRole", "USER")}
          >
            일반으로
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => handleBulkAction("activate")}
          >
            활성화
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => handleBulkAction("deactivate")}
          >
            비활성화
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead>이름</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead>역할</TableHead>
              <TableHead>소속</TableHead>
              <TableHead>가입일</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  <UsersIcon className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  사용자가 없습니다
                </TableCell>
              </TableRow>
            )}
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(user.id)}
                      onCheckedChange={() => toggleOne(user.id)}
                      disabled={isSelf}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/platform-admin/users/${user.id}`}
                      className="font-medium hover:underline"
                    >
                      {user.name ?? "(이름 없음)"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    {user.platformRole === "PLATFORM_ADMIN" ? (
                      <Badge>관리자</Badge>
                    ) : (
                      <Badge variant="secondary">일반</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.orgs[0]?.name ?? "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                  </TableCell>
                  <TableCell>
                    {user.isActive ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-500/30 text-emerald-600"
                      >
                        활성
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-red-500/30 text-red-600">
                        비활성
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <UserRowActions
                      userId={user.id}
                      currentUserId={currentUserId}
                      platformRole={user.platformRole}
                      isActive={user.isActive}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            총 {pagination.total}명 · {pagination.page} / {pagination.totalPages} 페이지
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
