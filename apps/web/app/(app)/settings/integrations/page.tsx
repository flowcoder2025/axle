import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@axle/ui";
import { Button } from "@axle/ui";
import { Badge } from "@axle/ui";
import { GoogleCalendarCard } from "../../../../src/components/settings/google-calendar-card";

export const metadata = {
  title: "연동 설정 | AXLE",
};

const PLACEHOLDER_INTEGRATIONS = [
  {
    id: "resend",
    name: "Resend",
    description: "트랜잭션 이메일 발송을 위한 Resend 연동입니다.",
  },
  {
    id: "solapi",
    name: "Solapi",
    description: "SMS/카카오 알림톡 발송을 위한 Solapi 연동입니다.",
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "텔레그램 봇을 통해 알림을 전송합니다.",
  },
  {
    id: "discord",
    name: "Discord",
    description: "Discord 웹훅을 통해 팀 채널에 알림을 전송합니다.",
  },
] as const;

export default function IntegrationsSettingsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">연동 설정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          외부 서비스와 AXLE을 연결합니다.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Google Calendar — fully interactive */}
        <GoogleCalendarCard />

        {/* Placeholder integrations */}
        {PLACEHOLDER_INTEGRATIONS.map((integration) => (
          <Card key={integration.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{integration.name}</CardTitle>
                <Badge variant="outline">미연결</Badge>
              </div>
              <CardDescription className="text-xs">
                {integration.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="default" size="sm" disabled>
                연결
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
