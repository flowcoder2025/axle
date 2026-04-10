# Agent Instructions

AXLE — Turborepo monorepo (Next.js 16 + Prisma 7 + Supabase)

## 빌드 & 검증 명령

### Lint
```bash
npx turbo lint
```

### Build
```bash
npx turbo build
```

### Test
```bash
npx turbo test
```

### Type Check
```bash
npx turbo typecheck
```

## 의존성 설치
```bash
npm install
```

## 개별 패키지 실행
```bash
# 특정 패키지만 빌드/테스트
npx turbo build --filter=@axle/db
npx turbo test --filter=@axle/auth
npx turbo lint --filter=web
```

## 인프라 환경
- **DB**: Supabase PostgreSQL (Seoul, ap-northeast-2) — pgbouncer transaction mode
- **Storage**: Supabase Storage (같은 프로젝트)
- **Cache**: Upstash Redis (REST API)
- **Queue**: Upstash QStash (Job Chaining)
- **Auth**: Google OAuth (GCP 프로젝트)
- **AI**: Anthropic + OpenAI + Google Gemini
- **Email**: Resend (from: flow-coder.com)
- **SMS**: Solapi
- **공공데이터**: 국세청 사업자등록 상태조회 (data.go.kr)
- **DART**: 상장사 재무 데이터 (opendart.fss.or.kr)
- **Telegram**: Bot API
- **Discord**: Webhook
- **환경변수**: `.env.local` (28개 변수 설정 완료)

## 아키텍처 계약
- API 표준: `.flowset/contracts/api-standard.md`
- 데이터 흐름: `.flowset/contracts/data-flow.md`
- 모든 API는 api-standard.md 형식 준수 필수
- 데이터 접근은 data-flow.md의 SSOT 엔드포인트 사용 필수

## 와이어프레임
- 미생성 (PRD wireframe_confirmed: false)
- UI 구현 시 PRD L4 태스크의 수용 기준 참조

## 프로젝트 구조
```
axle/
├── turbo.json
├── package.json              # Workspace root
├── packages/
│   ├── db/                   # Prisma 7 + pgvector
│   ├── auth/                 # Auth.js v5 Split Config + ReBAC
│   └── ui/                   # shadcn/ui 공유 컴포넌트
├── apps/
│   └── web/                  # Next.js 16 → Vercel
├── docs/
│   ├── plans/                # Phase별 구현 계획서
│   └── specs/                # 설계 문서
└── .flowset/                 # FlowSet 설정
```
