import Link from "next/link";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@axle/ui";
import { requireOrgAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { createManagedOrgAction } from "../actions";

export const metadata = {
  title: "관리 조직 추가 | AXLE",
};

async function handleSubmit(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const bizRegNumber = String(formData.get("bizRegNumber") ?? "").trim();
  const result = await createManagedOrgAction({
    name,
    bizRegNumber: bizRegNumber || undefined,
  });
  if (!result.ok) {
    redirect(
      `/settings/managed-orgs/new?error=${encodeURIComponent(result.error)}`,
    );
  }
  redirect(`/settings/managed-orgs/${result.data?.id ?? ""}`);
}

export default async function NewManagedOrgPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  let user;
  try {
    user = await requireOrgAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirect("/settings/organization");
  }

  const subscription = await prisma.orgMultiOrgSubscription.findUnique({
    where: { orgId: user.orgId },
  });
  if (!subscription?.enabled) redirect("/settings/managed-orgs");

  const params = await searchParams;

  return (
    <div className="max-w-2xl space-y-6" data-testid="new-managed-org-page">
      <div>
        <h1 className="text-2xl font-bold">관리 조직 추가</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          위탁 운영할 새 조직을 등록합니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">조직 정보</CardTitle>
          <CardDescription>
            등록 후 [위탁 Pack] 설정에서 Pack을 부여하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            {params.error && (
              <p
                className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
                data-testid="form-error"
              >
                {params.error}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">조직 이름 *</Label>
              <Input
                id="name"
                name="name"
                required
                maxLength={120}
                placeholder="예: ABC Manufacturing"
                data-testid="name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bizRegNumber">사업자등록번호 (선택)</Label>
              <Input
                id="bizRegNumber"
                name="bizRegNumber"
                maxLength={20}
                placeholder="000-00-00000"
                data-testid="biz-reg-input"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Link href="/settings/managed-orgs">
                <Button variant="ghost" type="button">
                  취소
                </Button>
              </Link>
              <Button type="submit" data-testid="submit-button">
                등록
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
