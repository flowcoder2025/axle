import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@axle/ui";
import { Button } from "@axle/ui";
import { Input } from "@axle/ui";
import { Label } from "@axle/ui";

export const metadata = {
  title: "조직 설정 | AXLE",
};

export default function OrganizationSettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">조직 설정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          조직의 기본 정보를 관리합니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
          <CardDescription>조직 이름, 슬러그, 로고를 설정합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">조직 이름</Label>
            <Input
              id="org-name"
              placeholder="예: AXLE Inc."
              defaultValue=""
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-slug">슬러그 (URL)</Label>
            <Input
              id="org-slug"
              placeholder="예: axle-inc"
              defaultValue=""
              disabled
            />
            <p className="text-xs text-muted-foreground">
              axle.app/<span className="font-medium">슬러그</span> 형식으로 사용됩니다.
            </p>
          </div>
          <div className="space-y-2">
            <Label>로고</Label>
            <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 text-xs text-muted-foreground">
              로고 없음
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button disabled>저장</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">위험 영역</CardTitle>
          <CardDescription>조직을 삭제하면 되돌릴 수 없습니다.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="destructive" disabled>
            조직 삭제
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
