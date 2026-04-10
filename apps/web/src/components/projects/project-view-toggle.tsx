"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@axle/ui";
import { LayoutList, Columns3 } from "lucide-react";

type ViewMode = "table" | "kanban";

interface ProjectViewToggleProps {
  currentView: ViewMode;
}

export function ProjectViewToggle({ currentView }: ProjectViewToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function switchView(view: ViewMode) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-1">
      <Button
        variant={currentView === "table" ? "default" : "ghost"}
        size="sm"
        className="h-7 gap-1.5 px-2.5 text-xs"
        onClick={() => switchView("table")}
      >
        <LayoutList className="h-3.5 w-3.5" />
        테이블
      </Button>
      <Button
        variant={currentView === "kanban" ? "default" : "ghost"}
        size="sm"
        className="h-7 gap-1.5 px-2.5 text-xs"
        onClick={() => switchView("kanban")}
      >
        <Columns3 className="h-3.5 w-3.5" />
        칸반
      </Button>
    </div>
  );
}
