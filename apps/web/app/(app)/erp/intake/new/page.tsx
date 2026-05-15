/**
 * /erp/intake/new — Upload a new receipt (Server shell + Client uploader).
 *
 * Server side only enforces the `erp:write` scope and renders the wrapper.
 * All file handling, drag-drop, and OCR-in-progress UX live in
 * {@link IntakeUploader}.
 */

import Link from "next/link";
import { requireErpScope } from "@/lib/erp/auth";
import { IntakeUploader } from "@/src/components/erp/intake/intake-uploader";

export const metadata = {
  title: "새 영수증 업로드 | AXLE",
};

export default async function ErpIntakeNewPage() {
  await requireErpScope("erp:write");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">새 영수증 업로드</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          이미지(JPG/PNG/HEIC) 또는 PDF를 업로드하면 OCR로 자동 분석합니다.
          분석에는 10~20초가 걸릴 수 있습니다.
        </p>
      </div>

      <IntakeUploader />

      <div className="text-sm">
        <Link href="/erp/intake" className="text-muted-foreground hover:underline">
          ← 영수증 목록으로
        </Link>
      </div>
    </div>
  );
}
