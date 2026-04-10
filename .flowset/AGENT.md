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
<!-- /wi:env에서 자동 채워짐. 비어있으면 DB 미설정 상태 — mock 허용 -->

## 아키텍처 계약
<!-- /wi:start Phase 4.6에서 자동 채워짐. 비어있으면 계약 미생성 -->

## 와이어프레임
<!-- /wi:start Phase 4에서 자동 채워짐. 비어있으면 와이어프레임 미생성 -->

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
