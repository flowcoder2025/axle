export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left: Navy branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary text-primary-foreground flex-col justify-between p-10">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-accent">
              <span className="text-accent text-lg font-extrabold">A</span>
            </div>
            <span className="text-accent text-lg font-bold tracking-widest">AXLE</span>
          </div>
          <h2 className="text-2xl font-bold leading-tight mb-3">
            컨설팅의 모든 과정을<br />자동화합니다
          </h2>
          <p className="text-sm text-primary-foreground/60 leading-relaxed">
            정부 지원사업 · 벤처인증 · 연구소 인증<br />
            특허 · 재무 컨설팅
          </p>
        </div>
        <div className="bg-[hsl(220,60%,16%)] rounded-xl p-5">
          <p className="text-sm text-primary-foreground/70 italic leading-relaxed">
            &ldquo;AXLE 도입 후 서류 작성 시간이 70% 줄었습니다. 프로젝트 관리도 한눈에 됩니다.&rdquo;
          </p>
          <p className="text-accent text-sm mt-3 font-medium">— 김대표, A컨설팅</p>
        </div>
      </div>

      {/* Right: Form area */}
      <div className="flex-1 flex items-center justify-center bg-background p-6 lg:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
