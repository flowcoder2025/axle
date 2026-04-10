import { Badge } from "@axle/ui";
import { RefreshCw } from "lucide-react";

interface ExpiryIndicatorProps {
  expiresAt: string | null | undefined;
  autoRenew?: boolean;
}

function getDaysRemaining(expiresAt: string): number {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const msRemaining = expiry.getTime() - now.getTime();
  return Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
}

export function ExpiryIndicator({ expiresAt, autoRenew }: ExpiryIndicatorProps) {
  if (!expiresAt) return null;

  const days = getDaysRemaining(expiresAt);

  let badge: React.ReactNode;

  if (days < 0) {
    // Expired
    badge = (
      <Badge variant="destructive" className="text-xs">
        만료됨
      </Badge>
    );
  } else if (days <= 7) {
    // Urgent: D-0 ~ D-7
    badge = (
      <Badge
        variant="destructive"
        className="text-xs"
        title={`${days}일 후 만료`}
      >
        D-{days}
      </Badge>
    );
  } else if (days <= 30) {
    // Warning: D-7 ~ D-30
    badge = (
      <Badge
        variant="outline"
        className="border-yellow-400 bg-yellow-50 text-yellow-700 text-xs hover:bg-yellow-50"
        title={`${days}일 후 만료`}
      >
        D-{days}
      </Badge>
    );
  } else {
    // D-30+: gray notice
    badge = (
      <Badge variant="secondary" className="text-xs" title={`${days}일 후 만료`}>
        만료 예정
      </Badge>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      {badge}
      {autoRenew && (
        <RefreshCw
          className="h-3 w-3 text-muted-foreground"
          title="자동 갱신"
          aria-label="자동 갱신"
        />
      )}
    </span>
  );
}
