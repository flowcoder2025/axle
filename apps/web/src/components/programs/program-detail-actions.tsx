"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@axle/ui";
import { Pencil, Trash2 } from "lucide-react";
import { ProgramForm, type ProgramFormData } from "./program-form";

interface ProgramDetailActionsProps {
  programId: string;
  program: ProgramFormData;
}

export function ProgramDetailActions({
  programId,
  program,
}: ProgramDetailActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`"${program.name}" 지원사업을 삭제하시겠습니까?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/programs/${programId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/programs");
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setEditOpen(true)}
      >
        <Pencil className="mr-1.5 h-3.5 w-3.5" />
        편집
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={handleDelete}
        disabled={deleting}
      >
        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
        삭제
      </Button>

      <ProgramForm
        open={editOpen}
        onOpenChange={setEditOpen}
        initialData={program}
        programId={programId}
        mode="edit"
      />
    </div>
  );
}
