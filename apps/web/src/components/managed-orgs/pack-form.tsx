"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Label } from "@axle/ui";
import { updateManagedOrgPacksAction } from "../../../app/(app)/settings/managed-orgs/actions";

type PackId = "A" | "B" | "D" | "E" | "F" | "G";

export interface ManagedOrgPackFormProps {
  managedOrgId: string;
  initial: string[];
  allPackIds: PackId[];
  disabled?: boolean;
}

export function ManagedOrgPackForm({
  managedOrgId,
  initial,
  allPackIds,
  disabled,
}: ManagedOrgPackFormProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(initial));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      setError(null);
      const result = await updateManagedOrgPacksAction(managedOrgId, {
        installedPacks: Array.from(selected) as PackId[],
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-3" data-testid="pack-form">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {allPackIds.map((p) => (
          <Label
            key={p}
            className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            <Checkbox
              checked={selected.has(p)}
              onCheckedChange={() => toggle(p)}
              disabled={disabled || pending}
              data-testid={`pack-checkbox-${p}`}
            />
            Pack {p}
          </Label>
        ))}
      </div>
      {error && (
        <p
          className="text-sm text-destructive"
          data-testid="pack-form-error"
        >
          {error}
        </p>
      )}
      <Button
        onClick={handleSave}
        disabled={disabled || pending}
        data-testid="save-packs-button"
      >
        {pending ? "저장 중…" : "저장"}
      </Button>
    </div>
  );
}
