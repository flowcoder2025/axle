import { notFound } from "next/navigation";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { JournalForm } from "../../../../src/components/journals/journal-form";

export const metadata = {
  title: "연구일지 추가 | AXLE",
};

interface NewJournalPageProps {
  searchParams: Promise<{ clientId?: string }>;
}

export default async function NewJournalPage({ searchParams }: NewJournalPageProps) {
  const user = await getCurrentUser();
  if (!user?.orgId) notFound();

  const params = await searchParams;

  const [clients, researchers] = await Promise.all([
    prisma.client.findMany({
      where: { orgId: user.orgId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.contact.findMany({
      where: {
        isResearcher: true,
        client: { orgId: user.orgId },
      },
      orderBy: [{ clientId: "asc" }, { name: "asc" }],
      select: { id: true, name: true, position: true, clientId: true },
    }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">연구일지 추가</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          새로운 연구일지를 등록합니다.
        </p>
      </div>

      <JournalForm
        clients={clients}
        researchers={researchers}
        defaultClientId={params.clientId}
      />
    </div>
  );
}
