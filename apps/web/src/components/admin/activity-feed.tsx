import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui";

type ActivityEvent = {
  id: string;
  action: string;
  userId: string | null;
  userName: string | null;
  category: string;
  createdAt: string;
};

type ActivityFeedProps = {
  events: ActivityEvent[];
};

export function ActivityFeed({ events }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">최근 활동</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">액션</th>
                <th className="pb-2 font-medium">사용자</th>
                <th className="pb-2 font-medium">시간</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-2">
                    <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs">
                      {event.action}
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-muted-foreground">
                    {event.userName ?? "익명"}
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {new Date(event.createdAt).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-muted-foreground">
                    최근 활동이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
