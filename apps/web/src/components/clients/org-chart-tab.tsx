"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input, Label, toast } from "@axle/ui";
import { Download, Plus, Save, Trash2, UserPlus } from "lucide-react";

// ---------------------------------------------------------------------------
// Types (mirrors OrgChartStructure in packages/docgen/src/generators/org-chart.ts)
// ---------------------------------------------------------------------------
interface OrgChartMember {
  name: string;
  position?: string;
}

interface OrgChartDepartment {
  name: string;
  members: OrgChartMember[];
}

interface OrgChartStructure {
  companyName: string;
  ceo: OrgChartMember;
  departments: OrgChartDepartment[];
}

interface OrgChartResponse {
  data: OrgChartStructure | null;
  mermaid: string | null;
}

interface OrgChartTabProps {
  clientId: string;
  fallbackCompanyName?: string;
  fallbackCeoName?: string | null;
}

function emptyChart(company: string, ceoName: string): OrgChartStructure {
  return {
    companyName: company,
    ceo: { name: ceoName, position: "대표이사" },
    departments: [{ name: "경영지원팀", members: [{ name: "", position: "" }] }],
  };
}

export function OrgChartTab({
  clientId,
  fallbackCompanyName,
  fallbackCeoName,
}: OrgChartTabProps) {
  const [chart, setChart] = useState<OrgChartStructure>(() =>
    emptyChart(fallbackCompanyName ?? "", fallbackCeoName ?? ""),
  );
  const [mermaid, setMermaid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // ── Load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/org-chart`);
        if (!res.ok) throw new Error(`GET failed: ${res.status}`);
        const body = (await res.json()) as OrgChartResponse;
        if (cancelled) return;
        if (body.data) {
          setChart(body.data);
          setMermaid(body.mermaid);
        }
      } catch (err) {
        if (!cancelled) toast.error("조직도를 불러오지 못했습니다");
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // ── Render Mermaid preview ──────────────────────────────────────────────
  useEffect(() => {
    if (!mermaid || !previewRef.current) return;
    const container = previewRef.current;
    let cancelled = false;

    (async () => {
      try {
        const mod = await import("mermaid");
        const mermaidLib = mod.default;
        mermaidLib.initialize({ startOnLoad: false, securityLevel: "loose" });
        const id = `org-chart-${Date.now()}`;
        const { svg } = await mermaidLib.render(id, mermaid);
        if (cancelled) return;
        container.innerHTML = svg;
      } catch (err) {
        console.error("Mermaid render error", err);
        if (!cancelled) container.innerHTML = "<p>미리보기 렌더링 실패</p>";
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mermaid]);

  // ── Edit helpers ────────────────────────────────────────────────────────
  const setCompanyName = (name: string) =>
    setChart((c) => ({ ...c, companyName: name }));
  const setCeo = (patch: Partial<OrgChartMember>) =>
    setChart((c) => ({ ...c, ceo: { ...c.ceo, ...patch } }));

  const addDepartment = () =>
    setChart((c) => ({
      ...c,
      departments: [...c.departments, { name: "", members: [] }],
    }));

  const removeDepartment = (deptIdx: number) =>
    setChart((c) => ({
      ...c,
      departments: c.departments.filter((_, i) => i !== deptIdx),
    }));

  const updateDepartment = (deptIdx: number, patch: Partial<OrgChartDepartment>) =>
    setChart((c) => ({
      ...c,
      departments: c.departments.map((d, i) =>
        i === deptIdx ? { ...d, ...patch } : d,
      ),
    }));

  const addMember = (deptIdx: number) =>
    setChart((c) => ({
      ...c,
      departments: c.departments.map((d, i) =>
        i === deptIdx
          ? { ...d, members: [...d.members, { name: "", position: "" }] }
          : d,
      ),
    }));

  const removeMember = (deptIdx: number, memberIdx: number) =>
    setChart((c) => ({
      ...c,
      departments: c.departments.map((d, i) =>
        i === deptIdx
          ? { ...d, members: d.members.filter((_, j) => j !== memberIdx) }
          : d,
      ),
    }));

  const updateMember = (
    deptIdx: number,
    memberIdx: number,
    patch: Partial<OrgChartMember>,
  ) =>
    setChart((c) => ({
      ...c,
      departments: c.departments.map((d, i) =>
        i === deptIdx
          ? {
              ...d,
              members: d.members.map((m, j) =>
                j === memberIdx ? { ...m, ...patch } : m,
              ),
            }
          : d,
      ),
    }));

  // ── Save ────────────────────────────────────────────────────────────────
  const sanitized = useCallback((): OrgChartStructure => {
    return {
      companyName: chart.companyName.trim(),
      ceo: {
        name: chart.ceo.name.trim(),
        position: chart.ceo.position?.trim() || undefined,
      },
      departments: chart.departments
        .map((d) => ({
          name: d.name.trim(),
          members: d.members
            .map((m) => ({
              name: m.name.trim(),
              position: m.position?.trim() || undefined,
            }))
            .filter((m) => m.name.length > 0),
        }))
        .filter((d) => d.name.length > 0),
    };
  }, [chart]);

  const handleSave = async () => {
    const payload = sanitized();
    if (!payload.companyName || !payload.ceo.name) {
      toast.error("회사명과 대표자 이름은 필수입니다");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/org-chart`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `PUT failed: ${res.status}`);
      }
      const body = (await res.json()) as OrgChartResponse;
      setMermaid(body.mermaid);
      toast.success("조직도가 저장되었습니다");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // ── Export PNG ──────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!previewRef.current || !mermaid) {
      toast.error("먼저 조직도를 저장해주세요");
      return;
    }
    setDownloading(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(previewRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `${sanitized().companyName || "org-chart"}-조직도.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PNG 다운로드 실패");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">조직도를 불러오는 중…</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ───────────── Editor ───────────── */}
      <div className="space-y-6">
        <section className="space-y-3 rounded-md border p-4">
          <h3 className="text-sm font-semibold">회사 & 대표</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="company-name">회사명</Label>
              <Input
                id="company-name"
                value={chart.companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="예: 주식회사 제이이티"
              />
            </div>
            <div>
              <Label htmlFor="ceo-position">대표 직함</Label>
              <Input
                id="ceo-position"
                value={chart.ceo.position ?? ""}
                onChange={(e) => setCeo({ position: e.target.value })}
                placeholder="대표이사"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ceo-name">대표자 이름</Label>
              <Input
                id="ceo-name"
                value={chart.ceo.name}
                onChange={(e) => setCeo({ name: e.target.value })}
                placeholder="예: 김희수"
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">부서</h3>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addDepartment}
            >
              <Plus className="mr-1 size-4" /> 부서 추가
            </Button>
          </div>

          {chart.departments.length === 0 && (
            <p className="text-sm text-muted-foreground">
              부서를 추가해 조직도를 구성하세요.
            </p>
          )}

          {chart.departments.map((dept, deptIdx) => (
            <div
              key={deptIdx}
              className="space-y-3 rounded-md border p-4"
            >
              <div className="flex items-center gap-2">
                <Input
                  value={dept.name}
                  onChange={(e) =>
                    updateDepartment(deptIdx, { name: e.target.value })
                  }
                  placeholder="부서명 (예: 연구개발전담부서)"
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeDepartment(deptIdx)}
                  aria-label="부서 삭제"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="space-y-2 pl-4">
                {dept.members.map((member, memberIdx) => (
                  <div key={memberIdx} className="flex items-center gap-2">
                    <Input
                      value={member.name}
                      onChange={(e) =>
                        updateMember(deptIdx, memberIdx, {
                          name: e.target.value,
                        })
                      }
                      placeholder="이름"
                      className="flex-1"
                    />
                    <Input
                      value={member.position ?? ""}
                      onChange={(e) =>
                        updateMember(deptIdx, memberIdx, {
                          position: e.target.value,
                        })
                      }
                      placeholder="직책 (팀장, 사원)"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeMember(deptIdx, memberIdx)}
                      aria-label="구성원 삭제"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => addMember(deptIdx)}
                >
                  <UserPlus className="mr-1 size-4" /> 구성원 추가
                </Button>
              </div>
            </div>
          ))}
        </section>

        <div className="flex gap-2">
          <Button type="button" onClick={handleSave} disabled={saving}>
            <Save className="mr-1 size-4" />
            {saving ? "저장 중…" : "저장 & 미리보기"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleDownload}
            disabled={downloading || !mermaid}
          >
            <Download className="mr-1 size-4" />
            {downloading ? "생성 중…" : "PNG 다운로드"}
          </Button>
        </div>
      </div>

      {/* ───────────── Preview ───────────── */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">미리보기</h3>
        <div
          ref={previewRef}
          className="min-h-[400px] overflow-auto rounded-md border bg-white p-4"
        >
          {!mermaid && (
            <p className="text-sm text-muted-foreground">
              저장을 누르면 조직도가 여기 표시됩니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
