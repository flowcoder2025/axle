"use client";

import { useState } from "react";
import { Button } from "@axle/ui";
import { Plus } from "lucide-react";
import { ProgramForm } from "./program-form";

export function ProgramCreateButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        지원사업 추가
      </Button>
      <ProgramForm open={open} onOpenChange={setOpen} mode="create" />
    </>
  );
}
