"use client";

import { useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@axle/ui";
import {
  formatPrice,
  type CatalogPack,
} from "@/src/lib/module-catalog";
import {
  installPackAction,
  uninstallPackAction,
} from "../../../app/(app)/settings/modules/actions";

export interface PackCardProps {
  pack: CatalogPack;
  /** Set of module ids the org has currently installed (across all packs). */
  installedModules: ReadonlySet<string>;
}

function isPackInstalled(
  pack: CatalogPack,
  installed: ReadonlySet<string>,
): boolean {
  return pack.modules.every((m) => installed.has(m.id));
}

export function PackCard({ pack, installedModules }: PackCardProps) {
  const [pending, startTransition] = useTransition();
  const installed = isPackInstalled(pack, installedModules);

  const handleInstall = () => {
    startTransition(async () => {
      await installPackAction(pack.id);
    });
  };

  const handleUninstall = () => {
    if (
      !window.confirm(
        `Pack ${pack.id}를 제거하면 ${pack.modules.length}개 모듈이 비활성화됩니다. 데이터는 30일간 보관됩니다.\n\n계속하시겠습니까?`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      await uninstallPackAction(pack.id);
    });
  };

  return (
    <Card
      data-testid={`pack-card-${pack.id}`}
      className={installed ? "border-2 border-green-500" : undefined}
    >
      <CardHeader>
        <div className="flex items-start gap-3">
          <div
            aria-hidden
            className="grid h-12 w-12 shrink-0 place-items-center rounded-lg text-2xl text-white"
            style={{ backgroundColor: pack.accentColor }}
          >
            {pack.icon}
          </div>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-base">
              {pack.title}
              {installed && (
                <Badge
                  variant="default"
                  data-testid={`pack-status-${pack.id}`}
                >
                  설치
                </Badge>
              )}
              {pack.recommended && !installed && (
                <Badge variant="outline">추천</Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              {pack.audience}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{pack.description}</p>

        <div className="flex flex-wrap gap-1.5">
          {pack.modules.map((mod) => (
            <span
              key={mod.id}
              className={
                mod.multiOrg
                  ? "rounded-md bg-amber-100 px-2 py-0.5 text-xs text-amber-900"
                  : mod.admin
                    ? "rounded-md bg-muted px-2 py-0.5 text-xs italic text-muted-foreground"
                    : "rounded-md bg-muted px-2 py-0.5 text-xs text-foreground"
              }
              data-testid={`module-chip-${mod.id}`}
            >
              {mod.label}
              {mod.multiOrg && " ⊛"}
              {mod.admin && " (admin)"}
            </span>
          ))}
        </div>

        <p className="font-mono text-sm text-muted-foreground">
          {formatPrice(pack.pricing.monthly, pack.pricing.pricingNote)} (
          {pack.modules.length} modules)
        </p>

        <div className="flex gap-2 pt-2">
          {installed ? (
            <>
              <Button variant="outline" size="sm" disabled>
                설정
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleUninstall}
                disabled={pending}
                data-testid={`uninstall-pack-button-${pack.id}`}
              >
                {pending ? "제거 중…" : "제거"}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={handleInstall}
                disabled={pending}
                data-testid={`install-pack-button-${pack.id}`}
              >
                {pending ? "설치 중…" : "설치하기"}
              </Button>
              <Button variant="ghost" size="sm" disabled>
                자세히
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
