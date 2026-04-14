import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui";

type OrgRank = {
  orgId: string;
  orgName: string;
  eventCount: number;
};

type OrgLeaderboardProps = {
  data: OrgRank[];
};

export function OrgLeaderboard({ data }: OrgLeaderboardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">조직별 활동 순위</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium w-8">#</th>
                <th className="pb-2 font-medium">조직</th>
                <th className="pb-2 font-medium text-right">이벤트</th>
              </tr>
            </thead>
            <tbody>
              {data.map((org, i) => (
                <tr key={org.orgId} className="border-b border-border/50 last:border-0">
                  <td className="py-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 font-medium">{org.orgName}</td>
                  <td className="py-2 text-right text-muted-foreground">
                    {org.eventCount.toLocaleString()}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-muted-foreground">
                    데이터가 없습니다
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
