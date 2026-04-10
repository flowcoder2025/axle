import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@axle/ui";
import { Button } from "@axle/ui";
import { Badge } from "@axle/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@axle/ui";

export const metadata = {
  title: "팀 관리 | AXLE",
};

const PLACEHOLDER_MEMBERS = [
  { name: "홍길동", email: "gildong@example.com", role: "관리자" },
  { name: "김철수", email: "cheolsu@example.com", role: "멤버" },
  { name: "이영희", email: "younghee@example.com", role: "멤버" },
] as const;

export default function TeamSettingsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">팀 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            팀 멤버를 초대하고 역할을 관리합니다.
          </p>
        </div>
        <Button disabled>멤버 초대</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>멤버 목록</CardTitle>
          <CardDescription>현재 조직의 모든 멤버입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>역할</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PLACEHOLDER_MEMBERS.map((member) => (
                <TableRow key={member.email}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell className="text-muted-foreground">{member.email}</TableCell>
                  <TableCell>
                    <Badge variant={member.role === "관리자" ? "default" : "secondary"}>
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" disabled>
                      편집
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
