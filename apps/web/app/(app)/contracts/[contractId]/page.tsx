import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@axle/ui";
import { ContractActions } from "../../../../src/components/contracts/contract-actions";
import { SignaturePadWrapper } from "../../../../src/components/contracts/signature-pad-wrapper";
import type { ContractStatus } from "@prisma/client";
import type { ContractParty, ContractTerm } from "@axle/docgen";

export const metadata = {
  title: "계약서 상세 | AXLE",
};

const STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: "초안",
  SENT: "발송",
  SIGNED: "서명완료",
  EXPIRED: "만료",
};

interface PageProps {
  params: Promise<{ contractId: string }>;
}

function formatKRW(amount: number): string {
  return amount.toLocaleString("ko-KR") + "원";
}

export default async function ContractDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user?.orgId) notFound();

  const { contractId } = await params;
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, client: { orgId: user.orgId } },
    include: { client: { select: { id: true, name: true, email: true } } },
  });
  if (!contract) notFound();

  const partyA = contract.partyA as unknown as ContractParty;
  const partyB = contract.partyB as unknown as ContractParty;
  const terms = (contract.terms as unknown as ContractTerm[]) ?? [];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {contract.contractNumber}
            </h1>
            <Badge>{STATUS_LABELS[contract.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{contract.title}</p>
        </div>
        <ContractActions
          contractId={contractId}
          status={contract.status}
          contractNumber={contract.contractNumber}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">계약번호</dt>
              <dd className="font-mono mt-0.5">{contract.contractNumber}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">고객사</dt>
              <dd className="mt-0.5">
                <Link
                  href={`/clients/${contract.client.id}`}
                  className="text-primary hover:underline"
                >
                  {contract.client.name}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">상태</dt>
              <dd className="mt-0.5">
                <Badge>{STATUS_LABELS[contract.status]}</Badge>
              </dd>
            </div>
            {contract.totalAmount && (
              <div>
                <dt className="text-muted-foreground">계약금액</dt>
                <dd className="mt-0.5 font-medium">
                  {formatKRW(Number(contract.totalAmount))}
                </dd>
              </div>
            )}
            {contract.startDate && (
              <div>
                <dt className="text-muted-foreground">시작일</dt>
                <dd className="mt-0.5">
                  {new Date(contract.startDate).toLocaleDateString("ko-KR")}
                </dd>
              </div>
            )}
            {contract.endDate && (
              <div>
                <dt className="text-muted-foreground">종료일</dt>
                <dd className="mt-0.5">
                  {new Date(contract.endDate).toLocaleDateString("ko-KR")}
                </dd>
              </div>
            )}
            {contract.signedAt && (
              <div>
                <dt className="text-muted-foreground">서명일</dt>
                <dd className="mt-0.5">
                  {new Date(contract.signedAt).toLocaleDateString("ko-KR")}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">생성일</dt>
              <dd className="mt-0.5">
                {new Date(contract.createdAt).toLocaleDateString("ko-KR")}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">갑 (발주자)</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">업체명</dt>
                <dd className="mt-0.5 font-medium">{partyA.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">대표자</dt>
                <dd className="mt-0.5">{partyA.representative}</dd>
              </div>
              {partyA.businessNumber && (
                <div>
                  <dt className="text-muted-foreground">사업자번호</dt>
                  <dd className="mt-0.5">{partyA.businessNumber}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">을 (수주자)</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">업체명</dt>
                <dd className="mt-0.5 font-medium">{partyB.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">대표자</dt>
                <dd className="mt-0.5">{partyB.representative}</dd>
              </div>
              {partyB.businessNumber && (
                <div>
                  <dt className="text-muted-foreground">사업자번호</dt>
                  <dd className="mt-0.5">{partyB.businessNumber}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      {terms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>계약 조항</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {terms
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((term) => (
                  <li key={term.order} className="text-sm">
                    <h3 className="font-semibold">
                      제{term.order}조 ({term.title})
                    </h3>
                    <p className="mt-1 text-muted-foreground whitespace-pre-wrap">
                      {term.content}
                    </p>
                  </li>
                ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Signature pad shown only for SENT contracts */}
      {contract.status === "SENT" && (
        <Card>
          <CardHeader>
            <CardTitle>전자 서명</CardTitle>
          </CardHeader>
          <CardContent>
            <SignaturePadWrapper contractId={contractId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
