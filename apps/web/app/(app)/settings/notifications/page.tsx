import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@axle/ui";
import { Button } from "@axle/ui";

export const metadata = {
  title: "알림 설정 | AXLE",
};

const NOTIFICATION_CHANNELS = [
  {
    id: "email",
    label: "이메일",
    description: "작업 완료, 멘션 등 주요 이벤트를 이메일로 받습니다.",
  },
  {
    id: "push",
    label: "푸시 알림",
    description: "브라우저 푸시 알림을 통해 실시간 알림을 받습니다.",
  },
  {
    id: "telegram",
    label: "텔레그램",
    description: "텔레그램 봇을 통해 알림을 받습니다.",
  },
] as const;

export default function NotificationsSettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">알림 설정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          알림 채널과 수신 조건을 설정합니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>알림 채널</CardTitle>
          <CardDescription>알림을 받을 채널을 선택합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {NOTIFICATION_CHANNELS.map((channel) => (
            <div
              key={channel.id}
              className="flex items-start gap-3 rounded-lg border p-4"
            >
              <input
                type="checkbox"
                id={channel.id}
                className="mt-0.5 h-4 w-4 cursor-not-allowed rounded border-input"
                disabled
              />
              <div className="space-y-1">
                <label
                  htmlFor={channel.id}
                  className="block text-sm font-medium"
                >
                  {channel.label}
                </label>
                <p className="text-xs text-muted-foreground">
                  {channel.description}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
        <CardFooter>
          <Button disabled>저장</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
