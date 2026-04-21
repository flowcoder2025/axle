"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  toast,
  cn,
} from "@axle/ui";
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Pencil,
  Loader2,
} from "lucide-react";
import type { ChecklistItemType, ProjectType } from "@prisma/client";

type TemplateItem = {
  id: string;
  name: string;
  description: string | null;
  isRequired: boolean;
  sortOrder: number;
  itemType: ChecklistItemType;
  certificateType: string | null;
};

type Template = {
  id: string;
  orgId: string | null;
  projectType: ProjectType;
  name: string;
  description: string | null;
  isRequired: boolean;
  sortOrder: number;
  items: TemplateItem[];
};

type Group = {
  projectType: ProjectType;
  label: string;
  templates: Template[];
};

type Props = {
  groups: Group[];
  currentScope: "org" | "platform";
};

const PROJECT_TYPE_ORDER: ProjectType[] = [
  "BUSINESS_PLAN",
  "VENTURE_CERT",
  "SOBOOJANG_CERT",
  "RESEARCH_INSTITUTE",
  "PATENT",
  "FINANCIAL_ANALYSIS",
  "RESEARCH_TASK",
  "BUNDLE",
];

async function apiFetch<T>(
  url: string,
  init: RequestInit = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (res.status === 204) return { ok: true, data: null as T };
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error:
          (body as { error?: { message?: string } })?.error?.message ??
          `HTTP ${res.status}`,
      };
    }
    return { ok: true, data: (body as { data: T }).data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export function ChecklistTemplateAdmin({ groups, currentScope }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createDialog, setCreateDialog] = useState<null | {
    projectType: ProjectType;
  }>(null);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [addItemDialog, setAddItemDialog] = useState<null | {
    templateId: string;
  }>(null);
  const [editItem, setEditItem] = useState<null | {
    templateId: string;
    item: TemplateItem;
  }>(null);

  const refresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const switchScope = (scope: "org" | "platform") => {
    const params = new URLSearchParams();
    params.set("scope", scope);
    router.push(`?${params.toString()}`);
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("이 템플릿을 삭제하시겠습니까?")) return;
    const res = await apiFetch(`/api/checklist-templates/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("삭제 실패", { description: res.error });
      return;
    }
    toast.success("삭제 완료");
    refresh();
  };

  const deleteItem = async (templateId: string, itemId: string) => {
    if (!confirm("항목을 삭제하시겠습니까?")) return;
    const res = await apiFetch(
      `/api/checklist-templates/${templateId}/items/${itemId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      toast.error("삭제 실패", { description: res.error });
      return;
    }
    refresh();
  };

  const moveItem = async (
    templateId: string,
    items: TemplateItem[],
    index: number,
    direction: "up" | "down",
  ) => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return;

    const reordered = items.slice();
    [reordered[index], reordered[target]] = [
      reordered[target]!,
      reordered[index]!,
    ];
    const payload = reordered.map((item, idx) => ({
      id: item.id,
      sortOrder: idx + 1,
    }));

    const res = await apiFetch(
      `/api/checklist-templates/${templateId}/items`,
      {
        method: "PATCH",
        body: JSON.stringify({ items: payload }),
      },
    );
    if (!res.ok) {
      toast.error("순서 변경 실패", { description: res.error });
      return;
    }
    refresh();
  };

  const orderedGroups = [...groups].sort(
    (a, b) =>
      PROJECT_TYPE_ORDER.indexOf(a.projectType) -
      PROJECT_TYPE_ORDER.indexOf(b.projectType),
  );

  return (
    <div className="space-y-6">
      {/* Scope toggle */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={currentScope === "platform" ? "default" : "outline"}
          onClick={() => switchScope("platform")}
          disabled={pending}
        >
          플랫폼 공용
        </Button>
        <Button
          size="sm"
          variant={currentScope === "org" ? "default" : "outline"}
          onClick={() => switchScope("org")}
          disabled={pending}
        >
          조직 전용
        </Button>
        {pending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
      </div>

      {orderedGroups.map((group) => (
        <section
          key={group.projectType}
          className="rounded-lg border border-border bg-card"
        >
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-base font-semibold">{group.label}</h2>
              <p className="text-xs text-muted-foreground">
                {group.templates.length}개 템플릿
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setCreateDialog({ projectType: group.projectType })
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              템플릿 추가
            </Button>
          </header>

          <div className="divide-y divide-border">
            {group.templates.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                등록된 템플릿이 없습니다.
              </div>
            )}
            {group.templates.map((tmpl) => (
              <article key={tmpl.id} className="px-4 py-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{tmpl.name}</h3>
                      {tmpl.orgId === null ? (
                        <Badge variant="secondary">플랫폼</Badge>
                      ) : (
                        <Badge variant="outline">조직</Badge>
                      )}
                      {tmpl.isRequired && (
                        <Badge variant="default">필수</Badge>
                      )}
                    </div>
                    {tmpl.description && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {tmpl.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditTemplate(tmpl)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteTemplate(tmpl.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <ul className="space-y-1.5">
                  {tmpl.items.map((item, idx) => (
                    <li
                      key={item.id}
                      className={cn(
                        "flex items-center gap-2 rounded-md border border-border/50 bg-background px-3 py-2 text-xs",
                      )}
                    >
                      <span className="font-mono text-muted-foreground">
                        {idx + 1}.
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{item.name}</span>
                          <Badge
                            variant={
                              item.itemType === "CERTIFICATE"
                                ? "secondary"
                                : "outline"
                            }
                            className="px-1.5 py-0 text-[10px]"
                          >
                            {item.itemType}
                          </Badge>
                          {item.isRequired && (
                            <Badge
                              variant="default"
                              className="px-1.5 py-0 text-[10px]"
                            >
                              필수
                            </Badge>
                          )}
                          {item.certificateType && (
                            <span className="text-[10px] text-muted-foreground">
                              [{item.certificateType}]
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            moveItem(tmpl.id, tmpl.items, idx, "up")
                          }
                          disabled={idx === 0}
                          aria-label="위로"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            moveItem(tmpl.id, tmpl.items, idx, "down")
                          }
                          disabled={idx === tmpl.items.length - 1}
                          aria-label="아래로"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setEditItem({ templateId: tmpl.id, item })
                          }
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteItem(tmpl.id, item.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>

                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => setAddItemDialog({ templateId: tmpl.id })}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  항목 추가
                </Button>
              </article>
            ))}
          </div>
        </section>
      ))}

      {createDialog && (
        <TemplateDialog
          mode="create"
          scope={currentScope}
          projectType={createDialog.projectType}
          onClose={() => setCreateDialog(null)}
          onSaved={() => {
            setCreateDialog(null);
            refresh();
          }}
        />
      )}

      {editTemplate && (
        <TemplateDialog
          mode="edit"
          scope={currentScope}
          template={editTemplate}
          onClose={() => setEditTemplate(null)}
          onSaved={() => {
            setEditTemplate(null);
            refresh();
          }}
        />
      )}

      {addItemDialog && (
        <ItemDialog
          mode="create"
          templateId={addItemDialog.templateId}
          onClose={() => setAddItemDialog(null)}
          onSaved={() => {
            setAddItemDialog(null);
            refresh();
          }}
        />
      )}

      {editItem && (
        <ItemDialog
          mode="edit"
          templateId={editItem.templateId}
          item={editItem.item}
          onClose={() => setEditItem(null)}
          onSaved={() => {
            setEditItem(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

type TemplateDialogProps =
  | {
      mode: "create";
      scope: "org" | "platform";
      projectType: ProjectType;
      onClose: () => void;
      onSaved: () => void;
    }
  | {
      mode: "edit";
      scope: "org" | "platform";
      template: Template;
      onClose: () => void;
      onSaved: () => void;
    };

function TemplateDialog(props: TemplateDialogProps) {
  const initial =
    props.mode === "edit"
      ? {
          name: props.template.name,
          description: props.template.description ?? "",
          isRequired: props.template.isRequired,
          sortOrder: props.template.sortOrder,
        }
      : {
          name: "",
          description: "",
          isRequired: true,
          sortOrder: 0,
        };

  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      name: form.name,
      description: form.description || undefined,
      isRequired: form.isRequired,
      sortOrder: form.sortOrder,
    };

    let res;
    if (props.mode === "create") {
      payload.projectType = props.projectType;
      payload.scope = props.scope;
      res = await apiFetch(`/api/checklist-templates`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } else {
      res = await apiFetch(`/api/checklist-templates/${props.template.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    }

    setSubmitting(false);
    if (!res.ok) {
      toast.error("저장 실패", { description: res.error });
      return;
    }
    toast.success("저장 완료");
    props.onSaved();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? "템플릿 추가" : "템플릿 수정"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium">이름</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">설명</label>
            <textarea
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isRequired}
                onChange={(e) =>
                  setForm({ ...form, isRequired: e.target.checked })
                }
              />
              필수
            </label>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium">정렬 순서</label>
              <Input
                type="number"
                className="w-20"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm({ ...form, sortOrder: Number(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={props.onClose}
              disabled={submitting}
            >
              취소
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type ItemDialogProps =
  | {
      mode: "create";
      templateId: string;
      onClose: () => void;
      onSaved: () => void;
    }
  | {
      mode: "edit";
      templateId: string;
      item: TemplateItem;
      onClose: () => void;
      onSaved: () => void;
    };

function ItemDialog(props: ItemDialogProps) {
  const initial =
    props.mode === "edit"
      ? {
          name: props.item.name,
          description: props.item.description ?? "",
          isRequired: props.item.isRequired,
          itemType: props.item.itemType,
          certificateType: props.item.certificateType ?? "",
          sortOrder: props.item.sortOrder,
        }
      : {
          name: "",
          description: "",
          isRequired: true,
          itemType: "DOCUMENT" as ChecklistItemType,
          certificateType: "",
          sortOrder: 0,
        };

  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      name: form.name,
      description: form.description || undefined,
      isRequired: form.isRequired,
      itemType: form.itemType,
      certificateType: form.certificateType || undefined,
      sortOrder: form.sortOrder,
    };

    const res =
      props.mode === "create"
        ? await apiFetch(
            `/api/checklist-templates/${props.templateId}/items`,
            {
              method: "POST",
              body: JSON.stringify(payload),
            },
          )
        : await apiFetch(
            `/api/checklist-templates/${props.templateId}/items/${props.item.id}`,
            {
              method: "PATCH",
              body: JSON.stringify(payload),
            },
          );

    setSubmitting(false);
    if (!res.ok) {
      toast.error("저장 실패", { description: res.error });
      return;
    }
    toast.success("저장 완료");
    props.onSaved();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? "항목 추가" : "항목 수정"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium">이름</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">설명</label>
            <textarea
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              rows={2}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div className="flex items-center gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium">타입</label>
              <select
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                value={form.itemType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    itemType: e.target.value as ChecklistItemType,
                  })
                }
              >
                <option value="DOCUMENT">문서 (DOCUMENT)</option>
                <option value="CERTIFICATE">증명서 (CERTIFICATE)</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isRequired}
                onChange={(e) =>
                  setForm({ ...form, isRequired: e.target.checked })
                }
              />
              필수
            </label>
          </div>
          {form.itemType === "CERTIFICATE" && (
            <div>
              <label className="mb-1 block text-xs font-medium">
                증명서 유형 (예: 벤처기업확인서)
              </label>
              <Input
                value={form.certificateType}
                onChange={(e) =>
                  setForm({ ...form, certificateType: e.target.value })
                }
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium">정렬 순서</label>
            <Input
              type="number"
              className="w-24"
              value={form.sortOrder}
              onChange={(e) =>
                setForm({ ...form, sortOrder: Number(e.target.value) || 0 })
              }
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={props.onClose}
              disabled={submitting}
            >
              취소
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
