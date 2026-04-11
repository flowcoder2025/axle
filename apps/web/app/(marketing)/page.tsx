import Link from "next/link";
import { getCurrentUser } from "@axle/auth";
import { redirect } from "next/navigation";
import {
  FileText,
  Award,
  Building2,
  Scale,
  DollarSign,
  Sparkles,
  FolderKanban,
  Users,
  ArrowRight,
} from "lucide-react";

export const metadata = {
  title: "AXLE — 컨설팅 자동화 플랫폼",
  description: "정부 지원사업, 벤처인증, 연구소 인증, 특허, 재무 컨설팅 업무를 자동화합니다.",
};

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="bg-[#0A1628] text-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 md:px-12 lg:px-20 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border-[1.5px] border-[#C9A96E]">
            <span className="text-[#C9A96E] text-sm font-extrabold">A</span>
          </div>
          <span className="text-[#C9A96E] text-sm font-bold tracking-widest">AXLE</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#services" className="text-sm text-gray-400 hover:text-white transition-colors">서비스</a>
          <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">기능</a>
          <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">요금제</a>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:block">
            로그인
          </Link>
          <Link
            href="/signup"
            className="bg-[#C9A96E] text-[#0A1628] px-5 py-2 rounded-md text-sm font-semibold hover:bg-[#B8944F] transition-colors"
          >
            시작하기
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 py-20 md:py-32 max-w-4xl mx-auto">
        <p className="text-[#C9A96E] text-xs font-semibold tracking-[0.2em] uppercase mb-4">
          Consulting Automation Platform
        </p>
        <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-6">
          컨설팅의 모든 과정을<br />자동화합니다
        </h1>
        <p className="text-gray-400 text-base md:text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
          정부 지원사업 · 벤처인증 · 연구소 인증 · 특허 · 재무 컨설팅<br className="hidden md:block" />
          AI 기반 서류 작성부터 프로젝트 관리까지, 하나의 플랫폼에서.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/signup"
            className="bg-[#C9A96E] text-[#0A1628] px-8 py-3 rounded-md text-sm font-semibold hover:bg-[#B8944F] transition-colors"
          >
            무료 체험
          </Link>
          <a
            href="#features"
            className="border border-[#C9A96E] text-[#C9A96E] px-8 py-3 rounded-md text-sm font-semibold hover:bg-[#C9A96E]/10 transition-colors"
          >
            더 알아보기
          </a>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-t border-white/10 py-12 max-w-4xl mx-auto">
        <div className="flex justify-center gap-16 md:gap-24">
          {[
            { value: "500+", label: "고객사" },
            { value: "98%", label: "성공률" },
            { value: "3,200+", label: "프로젝트" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-[#C9A96E] text-2xl md:text-3xl font-bold">{stat.value}</div>
              <div className="text-gray-500 text-xs mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="px-6 py-20 md:py-28 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">전문 컨설팅 영역</h2>
          <p className="text-gray-400 text-sm">6개 핵심 분야를 하나의 플랫폼에서</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: Award, title: "정부 지원사업", desc: "지원사업 탐색부터 신청서 작성까지 자동화" },
            { icon: Building2, title: "벤처인증", desc: "벤처기업 인증 요건 분석 및 서류 자동 생성" },
            { icon: FileText, title: "연구소 인증", desc: "기업부설연구소 인정 절차 자동 관리" },
            { icon: Scale, title: "특허", desc: "특허 출원/등록 프로세스 체계적 관리" },
            { icon: DollarSign, title: "재무 컨설팅", desc: "재무 분석, 사업계획서, 투자유치 지원" },
            { icon: Sparkles, title: "AI 매칭", desc: "고객사에 최적 지원사업 AI 자동 매칭" },
          ].map((service) => (
            <div
              key={service.title}
              className="bg-[#162040] rounded-xl p-6 border border-white/5 hover:border-[#C9A96E]/30 transition-colors"
            >
              <service.icon className="h-8 w-8 text-[#C9A96E] mb-4" />
              <h3 className="text-base font-semibold mb-2">{service.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{service.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-20 md:py-28 bg-[#0D1B2A]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">핵심 기능</h2>
            <p className="text-gray-400 text-sm">업무 효율을 극대화하는 자동화 기능</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: FileText,
                title: "AI 서류 자동 작성",
                desc: "지원사업 신청서, 사업계획서 등 핵심 서류를 AI가 자동 생성합니다. 템플릿 기반으로 빠르고 정확하게.",
              },
              {
                icon: FolderKanban,
                title: "프로젝트 관리",
                desc: "컨설팅 파이프라인을 한눈에. 진행 상황, 마감일, 담당자를 실시간으로 추적합니다.",
              },
              {
                icon: Users,
                title: "고객 포털",
                desc: "고객과 실시간으로 문서를 공유하고, 진행 상황을 투명하게 전달합니다.",
              },
            ].map((feature) => (
              <div key={feature.title} className="text-center">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#C9A96E]/10 mx-auto mb-5">
                  <feature.icon className="h-7 w-7 text-[#C9A96E]" />
                </div>
                <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 md:py-28 text-center max-w-3xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">지금 시작하세요</h2>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
          14일 무료 체험 · 카드 등록 불필요 · 모든 기능 이용 가능
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 bg-[#C9A96E] text-[#0A1628] px-8 py-3 rounded-md text-sm font-semibold hover:bg-[#B8944F] transition-colors"
        >
          무료 체험 시작 <ArrowRight size={16} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-10 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#C9A96E]/50">
              <span className="text-[#C9A96E] text-xs font-extrabold">A</span>
            </div>
            <span className="text-[#C9A96E] text-xs font-bold tracking-widest">AXLE</span>
          </div>
          <div className="flex gap-6 text-xs text-gray-500">
            <a href="#" className="hover:text-gray-300 transition-colors">이용약관</a>
            <a href="#" className="hover:text-gray-300 transition-colors">개인정보처리방침</a>
            <a href="#" className="hover:text-gray-300 transition-colors">문의하기</a>
          </div>
          <p className="text-xs text-gray-600">&copy; 2026 AXLE. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
