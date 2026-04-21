import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { Button } from "@axle/ui";
import { ArrowLeft, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { ProgramCategoryBadge } from "../../../../src/components/programs/program-category-badge";
import { ProgramDetailActions } from "../../../../src/components/programs/program-detail-actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const program = await prisma.programInfo.findFirst({
    where: { id: programId },
    select: { name: true },
  });
  return {
    title: program
      ? `${program.name} | AXLE`
      : "지원사업 상세 | AXLE",
  };
}

interface PageProps {
  params: Promise<{ programId: string }>;
}

function formatDate(date: Date | null) {
  if (!date) return "-";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatFunding(value: { toNumber: () => number } | null) {
  if (!value) return "-";
  const num = value.toNumber();
  if (num >= 100_000_000) {
    return `${(num / 100_000_000).toLocaleString("ko-KR")}억원`;
  }
  if (num >= 10_000) {
    return `${(num / 10_000).toLocaleString("ko-KR")}만원`;
  }
  return `${num.toLocaleString("ko-KR")}원`;
}

function isExpired(applicationEnd: Date | null) {
  if (!applicationEnd) return false;
  return applicationEnd < new Date();
}

export default async function ProgramDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  const { programId } = await params;

  if (!user?.orgId) {
    notFound();
  }

  // 조직 프로그램 + crawled 플랫폼 프로그램(orgId=null) 모두 조회 허용
  const program = await prisma.programInfo.findFirst({
    where: {
      id: programId,
      OR: [{ orgId: user.orgId }, { orgId: null }],
    },
    include: {
      schedules: {
        orderBy: { startDate: "asc" },
        select: {
          id: true,
          title: true,
          type: true,
          startDate: true,
        },
      },
      _count: { select: { matchingResults: true } },
    },
  });

  if (!program) {
    notFound();
  }

  const expired = isExpired(program.applicationEnd);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/programs"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          지원사업 목록
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{program.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">
              {program.name}
            </h1>
            <ProgramCategoryBadge category={program.category} />
            {expired && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                마감됨
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {program.agency && <span>기관: {program.agency}</span>}
            {program.region && <span>지역: {program.region}</span>}
            <span>매칭 {program._count.matchingResults}건</span>
          </div>
        </div>

        <ProgramDetailActions
          programId={programId}
          program={{
            name: program.name,
            agency: program.agency ?? "",
            category: program.category,
            applicationStart: program.applicationStart
              ? program.applicationStart.toISOString().split("T")[0]
              : "",
            applicationEnd: program.applicationEnd
              ? program.applicationEnd.toISOString().split("T")[0]
              : "",
            maxFunding: program.maxFunding
              ? program.maxFunding.toNumber().toString()
              : "",
            region: program.region ?? "",
            announcementUrl: program.announcementUrl ?? "",
            memo: program.memo ?? "",
          }}
        />
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-muted-foreground">접수 기간</p>
          <p className="text-sm font-medium">
            {program.applicationStart
              ? formatDate(program.applicationStart)
              : "미정"}
            {" ~ "}
            {program.applicationEnd
              ? formatDate(program.applicationEnd)
              : "미정"}
          </p>
        </div>

        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-muted-foreground">최대 지원금</p>
          <p className="text-sm font-medium">{formatFunding(program.maxFunding)}</p>
        </div>

        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-muted-foreground">공고 URL</p>
          {program.announcementUrl ? (
            <a
              href={program.announcementUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              공고 바로가기
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">-</p>
          )}
        </div>
      </div>

      {/* Memo */}
      {program.memo && (
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-xs text-muted-foreground">메모</p>
          <p className="text-sm whitespace-pre-wrap">{program.memo}</p>
        </div>
      )}

      {/* Matching Results Summary */}
      <div className="rounded-lg border p-4 space-y-2">
        <h2 className="text-base font-semibold">매칭 결과</h2>
        {program._count.matchingResults === 0 ? (
          <p className="text-sm text-muted-foreground">
            아직 매칭된 고객사가 없습니다.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            총 {program._count.matchingResults}개 고객사와 매칭되었습니다.
          </p>
        )}
      </div>

      {/* Linked Schedules */}
      {program.schedules.length > 0 && (
        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="text-base font-semibold">연결된 일정</h2>
          <ul className="space-y-2">
            {program.schedules.map((schedule) => (
              <li
                key={schedule.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-medium">{schedule.title}</span>
                <span className="text-muted-foreground">
                  {formatDate(schedule.startDate)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
