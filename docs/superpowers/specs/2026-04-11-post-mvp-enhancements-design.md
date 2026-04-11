# AXLE Post-MVP Enhancements Design

Date: 2026-04-11

## Overview

Phase 0~16 MVP 완료 후 8개 후속 작업을 3단계로 실행한다.

## Execution Order

```
Phase A: Schema changes (#7, #8) → DB push (#3)
Phase B: Code changes (#4, #5, #6, #1)
Phase C: Vercel deploy (#2)
```

## Phase A: Schema Changes + DB Push

### #8 assignedTo → User Foreign Key

**현재**: `Client.assignedTo String?`, `Project.assignedTo String?` (자유 텍스트)
**변경**: `assignedToId String?` + `@relation` to User

- Client 모델: `assignedTo String?` → `assignedToId String? @relation(fields: [assignedToId], references: [id])`
- Project 모델: 동일 패턴
- 기존 자유텍스트 → userId 매칭 마이그레이션 스크립트 제공
- ProjectMember LEAD 동기화: assignedTo 설정 시 해당 유저를 ProjectMember LEAD로도 등록

**영향 범위**:
- Prisma schema (Client, Project 모델)
- API routes: clients CRUD, projects CRUD
- Components: client-form, project-form (텍스트 input → 유저 선택 드롭다운)
- 분석 쿼리: groupBy assignedTo → groupBy assignedToId + include user

### #7 OAuth Token Server-Side Storage

**현재**: `localStorage["google_calendar_tokens"]`에 평문 저장
**변경**: DB 암호화 저장 + API route

**OAuthToken 모델**:
```prisma
model OAuthToken {
  id           String   @id @default(cuid())
  userId       String
  provider     String   // GOOGLE, etc.
  accessToken  String   // AES-256-GCM encrypted
  refreshToken String?  // AES-256-GCM encrypted
  expiresAt    DateTime?
  scope        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, provider])
}
```

**암호화**: AES-256-GCM, 키는 `OAUTH_ENCRYPTION_KEY` 환경변수
**API**: `/api/oauth/tokens` (GET/POST/DELETE)
**마이그레이션**: 클라이언트 localStorage → 서버로 일회성 전송 후 삭제

### #3 DB Push

스키마 변경 완료 후 사용자가 `npx prisma db push` 실행 (Supabase Seoul).

## Phase B: Code Changes

### #4 Mobile Sidebar

**현재**: `w-64` 고정 사이드바, 모바일에서 콘텐츠 영역 부족
**변경**: `md:` 이상 데스크톱 사이드바, 모바일에서 Sheet 기반 hamburger

- `@axle/ui` Sheet 컴포넌트 활용
- SidebarProvider에 `isMobile` 상태 + `toggleMobile()` 추가
- Header에 hamburger 아이콘 (`md:hidden`)
- 기존 사이드바는 `hidden md:flex`

### #5 ReBAC Enhancement

**현재**: orgId 필터 + Organization role (OWNER/ADMIN/MEMBER)
**변경**: 프로젝트 레벨 권한 추가

- `packages/auth`에 `checkProjectAccess(userId, projectId, requiredRole)` 추가
- ProjectMember.role: LEAD / MEMBER / VIEWER
- LEAD: 프로젝트 수정/삭제/멤버 관리
- MEMBER: 조회 + 하위 리소스(회의록, 문서 등) CRUD
- VIEWER: 조회만
- 적용 대상: project detail/edit/delete API, meeting/document/action-item API

### #6 SSE Real-time Notifications

**현재**: `setInterval(fetchNotifications, 30_000)` 폴링
**변경**: Server-Sent Events

- **서버**: `app/api/notifications/stream/route.ts` — ReadableStream + SSE format
- **전파**: 인메모리 EventEmitter (단일 인스턴스 배포 기준, 스케일 시 Redis pub/sub)
- **클라이언트**: `useNotificationStream()` hook — EventSource 사용
- **fallback**: SSE 연결 실패 시 30초 폴링으로 자동 전환
- notification-bell.tsx의 setInterval 제거 → useNotificationStream() 사용

### #1 AI Integration Enhancement

**현재**: 규칙기반 평가 + OpenAI 임베딩 (RAG)
**변경**: Claude API 심층 분석 추가

- `evaluation/engine.ts`: 규칙기반 점수 산출 후 Claude API로 개선 제안 생성
- `diagnosis/gap-analyzer.ts`: RAG 검색 결과를 Claude에 전달하여 심층 갭 분석
- `resolveAiTier()` 라우팅 유지 — API_HAIKU 티어에서 Anthropic SDK 직접 호출
- 새 유틸: `packages/ai/src/claude.ts` — Anthropic SDK 래퍼 (스트리밍, 에러 핸들링)
- 환경변수 `ANTHROPIC_API_KEY`는 이미 .env.example에 존재

## Phase C: Vercel Deploy

- 환경변수 17개 Vercel 대시보드에 등록 (사용자)
- `vercel deploy --preview` → 확인 → `vercel --prod`
- Cron jobs (vercel.json에 9개 정의됨) 동작 확인

## Non-Goals

- 터치 스와이프 사이드바 (YAGNI)
- WebSocket (SSE로 충분, 양방향 불필요)
- 멀티 프로바이더 OAuth 확장 (현재 Google만)
- AI 모델 파인튜닝 (API 호출로 충분)
