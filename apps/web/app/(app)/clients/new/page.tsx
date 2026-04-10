import { ClientForm } from "../../../../src/components/clients/client-form";

export const metadata = {
  title: "고객사 추가 | AXLE",
};

export default function NewClientPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">고객사 추가</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          새로운 고객사를 등록합니다.
        </p>
      </div>

      <ClientForm mode="create" />
    </div>
  );
}
