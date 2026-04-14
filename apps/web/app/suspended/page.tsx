import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui";

export default function SuspendedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-xl">계정 정지</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground">
          <p>소속 조직의 계정이 일시 정지되었습니다.</p>
          <p className="mt-2">관리자에게 문의해 주세요.</p>
          <a href="/login" className="mt-4 inline-block text-sm text-primary underline">
            다시 로그인
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
