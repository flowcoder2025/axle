"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Building2 } from "lucide-react";
import { setActiveTenantAction } from "../../app/(app)/settings/managed-orgs/actions";

export interface OrgSwitcherTenant {
  id: string;
  name: string;
  isManaged: boolean;
}

export interface OrgSwitcherProps {
  /** Current active tenant id (owner orgId when self, ManagedOrg.id otherwise). */
  activeId: string;
  /**
   * Available tenants ordered with self at index 0. Empty/single-element
   * arrays cause the switcher to render nothing — we only need the picker
   * for multi-org-enabled orgs with at least one managed org accessible.
   */
  tenants: OrgSwitcherTenant[];
}

export function OrgSwitcher({ activeId, tenants }: OrgSwitcherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (tenants.length < 2) return null;

  const active = tenants.find((t) => t.id === activeId) ?? tenants[0];

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    if (next === activeId) return;
    startTransition(async () => {
      const result = await setActiveTenantAction(next);
      if (result.ok) {
        router.refresh();
      }
    });
  };

  return (
    <div
      className="relative flex items-center gap-2"
      data-testid="org-switcher"
    >
      <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
      <label className="sr-only" htmlFor="org-switcher-select">
        활성 조직 전환
      </label>
      <select
        id="org-switcher-select"
        data-testid="org-switcher-select"
        className="appearance-none rounded-md border border-input bg-background py-1 pl-2 pr-7 text-sm font-medium hover:bg-accent disabled:opacity-50"
        value={active.id}
        disabled={pending}
        onChange={handleChange}
      >
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.isManaged ? `${t.name} ⊛` : `${t.name} (본인)`}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-1.5 h-4 w-4 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}
