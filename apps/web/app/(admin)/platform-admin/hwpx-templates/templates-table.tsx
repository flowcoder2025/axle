"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
} from "@axle/ui";
import { HwpxTemplateDialog } from "@/src/components/admin/hwpx-template-dialog";
import { toast } from "@axle/ui";

export type HwpxTemplateRow = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  version: number;
  orgName: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  fieldMap: Record<string, unknown>;
};

export function HwpxTemplatesTable({
  templates,
}: {
  templates: HwpxTemplateRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<HwpxTemplateRow | null>(null);
  const [creating, setCreating] = useState(false);

  function handleDelete(id: string, name: string) {
    if (!confirm(`정말로 "${name}" 템플릿을 삭제하시겠습니까?`)) return;

    startTransition(async () => {
      const res = await fetch(`/api/hwpx/templates/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("템플릿이 삭제되었습니다");
        router.refresh();
      } else {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        toast.error("삭제 실패", {
          description: data.error?.message ?? "알 수 없는 오류",
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>템플릿 업로드</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>카테고리</TableHead>
              <TableHead>조직</TableHead>
              <TableHead>버전</TableHead>
              <TableHead>생성자</TableHead>
              <TableHead>수정일</TableHead>
              <TableHead className="w-32 text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  등록된 템플릿이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium">{t.name}</div>
                    {t.description ? (
                      <div className="text-xs text-muted-foreground">
                        {t.description}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{t.category}</Badge>
                  </TableCell>
                  <TableCell>
                    {t.orgName ?? (
                      <span className="text-muted-foreground">플랫폼 공통</span>
                    )}
                  </TableCell>
                  <TableCell>v{t.version}</TableCell>
                  <TableCell>{t.createdByName ?? "-"}</TableCell>
                  <TableCell>
                    {new Date(t.updatedAt).toLocaleDateString("ko-KR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(t)}
                      >
                        편집
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleDelete(t.id, t.name)}
                      >
                        삭제
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {creating ? (
        <HwpxTemplateDialog
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      ) : null}

      {editing ? (
        <HwpxTemplateDialog
          mode="edit"
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
