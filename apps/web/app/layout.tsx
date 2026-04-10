import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AXLE",
  description: "Consulting automation platform",
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
