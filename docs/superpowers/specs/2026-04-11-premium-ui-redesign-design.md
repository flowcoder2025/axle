# AXLE Premium UI Redesign — Design Spec

## Overview

AXLE 컨설팅 자동화 플랫폼의 전체 UI를 Premium Corporate 디자인으로 교체한다.
기존 API 연결, 데이터 페칭, 비즈니스 로직은 그대로 유지하고 **시각적 레이어만 교체**한다.

## Design Decisions

| 항목 | 결정 |
|------|------|
| 무드 | Premium Corporate — 다크 네이비 + 골드, 고급 컨설팅펌 느낌 |
| 컬러 | Navy #0A1628 · Dark Blue #162040 · Gold #C9A96E · Cool White #F8FAFC |
| 폰트 | Inter (Latin) + Pretendard (Korean) |
| Border Radius | 8px (기본) · 12px (카드) · 6px (버튼/인풋) |
| Shadow | Minimal — border 위주, 그림자 최소 |

## Color System

### Core Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--navy` | `#0A1628` | Primary background, sidebar, buttons |
| `--navy-light` | `#162040` | Secondary dark background, card dark |
| `--gold` | `#C9A96E` | Primary accent, CTA, active states, branding |
| `--cool-white` | `#F8FAFC` | Content area background |
| `--white` | `#FFFFFF` | Card background, input background |
| `--cool-gray` | `#6B7280` | Muted text, icons |
| `--muted` | `#94A3B8` | Secondary text, descriptions |
| `--border` | `#E5E7EB` | Light mode borders |
| `--border-dark` | `rgba(201, 169, 110, 0.15)` | Dark mode borders (gold tint) |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--success` | `#22C55E` | 완료, 성공 상태 |
| `--info` | `#3B82F6` | 검토중, 정보 |
| `--warning` | `#F59E0B` | 경고, 주의 |
| `--destructive` | `#EF4444` | 긴급, 삭제, 에러 |

### Status Badges

| 상태 | Background | Text Color |
|------|-----------|------------|
| 진행중 | `rgba(201, 169, 110, 0.15)` | `#C9A96E` |
| 완료 | `rgba(34, 197, 94, 0.1)` | `#22C55E` |
| 검토중 | `rgba(59, 130, 246, 0.1)` | `#3B82F6` |
| 긴급 | `rgba(239, 68, 68, 0.1)` | `#EF4444` |

## Page Designs

### 1. Landing Page (Public)

**Layout**: Full-screen dark navy background, scrolling sections.

**Sections (순서)**:
1. **Hero** — Navy 풀스크린. 상단 GNB(로고 + 서비스/고객사례/요금제 + CTA). 중앙 메인 카피 + 서브카피 + 2 CTA 버튼(무료체험 + 데모보기). 하단 실적 바(고객사 500+ / 성공률 98% / 프로젝트 3,200+).
2. **서비스 영역** — 6개 컨설팅 분야 카드 (정부지원사업, 벤처인증, 연구소인증, 특허, 재무컨설팅, AI매칭)
3. **핵심 기능** — AI 서류 자동 작성, 프로젝트 관리, 고객 포털 (아이콘 + 제목 + 설명)
4. **사회적 증거** — 고객사 로고 배너 + 고객 후기 카드
5. **요금제** — 플랜 비교 테이블 (Free / Pro / Enterprise)
6. **최종 CTA** — 전환 유도 섹션, 무료 체험 버튼
7. **Footer** — 서비스 링크, 약관, 개인정보, 연락처

**GNB**: 로고(좌) + 메뉴(중) + CTA 버튼(우). 스크롤 시 배경 blur.
**CTA Primary**: Gold 배경 + Navy 텍스트.
**CTA Secondary**: Gold border + Gold 텍스트 (outline).

### 2. Login Page

**Layout**: 스플릿 — 좌측 50% Navy + 우측 50% Cool White.

**좌측 (Navy)**:
- 로고 (A 아이콘 + AXLE 텍스트)
- 메인 카피: "컨설팅의 모든 과정을 자동화합니다"
- 서브 카피: 서비스 영역 나열
- 하단: 고객 후기 카드 (배경 #162040)

**우측 (Cool White)**:
- 제목: "로그인"
- 설명: "계정에 로그인하세요"
- Google OAuth 버튼
- 구분선 ("또는")
- 이메일 인풋
- 비밀번호 인풋 + 비밀번호 찾기 링크
- 로그인 버튼 (Navy 배경 + Gold 텍스트)
- 회원가입 링크

### 3. Signup Page

**Layout**: 스플릿 — 로그인과 동일 구조.

**좌측 (Navy)**:
- 로고
- 메인 카피: "지금 시작하세요"
- 서브 카피: "무료 체험 · 카드 불필요 · 14일 전체 기능"
- 혜택 체크리스트 (✓ AI 서류 자동 작성, ✓ 프로젝트 관리 무제한, ✓ 고객 포털 제공)

**우측 (Cool White)**:
- 제목: "회원가입"
- Google OAuth 버튼
- 구분선
- 이름 + 회사명 (한 줄 2칸)
- 이메일
- 비밀번호
- 가입하기 버튼
- 로그인 링크

### 4. Dashboard (App Home)

**Layout**: 다크 사이드바(좌) + 라이트 콘텐츠(우).

**사이드바 (Navy #0A1628, 고정)**:
- 로고 (A 아이콘 + AXLE)
- 메뉴: 대시보드, 고객관리, 프로젝트, 문서관리, 일정, 재무, 분석, 매칭, 알림, 설정
- Active 상태: Gold 배경 tint + Gold 텍스트
- 하단: 유저 아바타 + 이름

**콘텐츠 (Cool White #F8FAFC)**:
- 헤더: 페이지 제목 + 설명 + 액션 버튼
- 4칸 스탯 카드: 진행중 프로젝트, 등록 고객, 이번달 미팅, 대기 문서
- 최근 프로젝트 테이블

### 5. Inner Pages (공통 패턴)

모든 내부 페이지 (고객관리, 프로젝트, 문서, 일정, 재무 등)는 동일 패턴:

**구조**:
1. **헤더**: 페이지 제목 + 카운트 + 검색바 + 액션 버튼 (+ 추가)
2. **필터 탭**: 전체 / 진행중 / 완료 등 상태 필터. Active=Navy 배경, Inactive=White border
3. **데이터 테이블**: 컬럼 헤더 (gray) + 행 (white 배경, hover 시 #F8FAFC) + 상태 뱃지 + 페이지네이션

**버튼 스타일**:
- Primary: Navy 배경 + Gold 텍스트
- Secondary: White 배경 + Navy 텍스트 + border
- Accent: Gold 배경 + Navy 텍스트 (CTA)
- Ghost: 투명 + Navy 텍스트

**인풋 스타일**:
- White 배경 + #E5E7EB border + 6px radius
- Focus: Gold border
- Placeholder: #9CA3AF

## Implementation Constraints

### API 연결 보존 (Critical)

기존 API 연결과 데이터 페칭 로직을 **절대 변경하지 않는다**:

- Server Components의 Prisma 쿼리 유지
- API Route Handlers 변경 없음
- Auth.js 인증 플로우 유지
- 클라이언트 상태 관리/훅 유지
- form action, server action 유지

**변경 범위**: JSX 구조, Tailwind 클래스, CSS 변수만 변경. import 경로, props 인터페이스, 데이터 페칭은 유지.

### 작업 순서 (권장)

1. **Design tokens** — `packages/ui/src/globals.css` CSS 변수 교체
2. **Base components** — `packages/ui/src/components/` 스타일 업데이트 (button, input, card, badge 등)
3. **Landing page** — `apps/web/app/page.tsx` 새 랜딩 페이지 (현재는 리다이렉트만)
4. **Auth pages** — login, signup 페이지 교체
5. **App layout** — sidebar, header 교체
6. **Dashboard** — 대시보드 스타일 교체
7. **Inner pages** — 고객관리, 프로젝트 등 공통 패턴 일괄 적용

### 폰트 변경

- 현재: Inter (Google Fonts)
- 추가: Pretendard (한글) — CDN 또는 next/font/local

## Non-Goals

- 새 기능 추가 없음
- API/DB 스키마 변경 없음
- 인증 플로우 변경 없음
- 라우팅 구조 변경 없음 (기존 route groups 유지)
- 다크모드 토글 (현 단계에서는 라이트 모드 + 다크 사이드바만)
