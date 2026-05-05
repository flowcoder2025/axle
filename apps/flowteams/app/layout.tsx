import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FlowTeams — HR / Payroll",
  description:
    "AXLE 메타플랫폼 위에서 동작하는 인사·급여·근태·휴가·노무자문 thin shell. 도메인 로직은 @axle/pbc-hr-payroll에서 위임받습니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
