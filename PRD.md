# AXLE PRD — Consulting Automation Platform

## 프로젝트 개요
- **이름**: AXLE (AX + Axle — 모든 것이 돌아가는 축)
- **목표**: 정부 지원사업, 벤처/연구소 인증, 특허, 재무 컨설팅 업무를 하나의 시스템으로 통합
- **대상 사용자**: FlowCoder + 여유솔루션 컨설팅 팀 (2~5명), 고객사 담당자 (서류 업로드, 연구일지 작성)
- **성공 기준**: 사업계획서 작성 시간 50% 단축, 서류 수집 자동화율 80%, 지원사업 매칭 자동 추천

## 기술 스택
- **언어**: TypeScript 5
- **프레임워크**: Next.js 16 (Turborepo monorepo)
- **DB**: Supabase PostgreSQL + pgvector (Prisma 7 Client Engine + Driver Adapter)
- **인증**: Auth.js v5 Split Config + ReBAC
- **캐시**: Upstash Redis + QStash
- **인프라**: Vercel (웹) + Mac Mini (agent-bridge) + OCI VM (크롤러)
- **AI**: Claude API (Opus/Haiku) + MLX Hermes 3 8B (로컬) + OpenAI (embeddings) + Gemini (OCR)
- **테스트**: Vitest + React Testing Library
- **UI**: shadcn/ui + Tailwind CSS 4 + Recharts
- **기타**: Resend (이메일), Solapi (SMS/알림톡), Electron 36+ (데스크톱)

---

## L1: Foundation (기반 인프라) — Phase 0

Turborepo monorepo + DB 스키마 + 인증 + 권한 + UI 기반

### L2: Monorepo 설정

#### L3: Turborepo Scaffold
1. **Turborepo 루트 설정** — turbo.json, root package.json, tsconfig.json 워크스페이스 구성 — 수용 기준: `npx turbo build` 전체 빌드 성공
2. **패키지 초기 구조** — packages/db, packages/auth, packages/ui, packages/storage, apps/web package.json + tsconfig.json — 수용 기준: 워크스페이스 간 import 정상 동작

### L2: 데이터베이스

#### L3: Prisma 설정
3. **Prisma 7 Client Engine + Driver Adapter** — packages/db에 Prisma 설정, client.ts 싱글톤, index.ts exports — 수용 기준: `npx prisma generate` 성공 + @axle/db import 정상

#### L3: Auth/Org 모델
4. **인증/조직 스키마** — Prisma User, Account, Organization, OrgMember, RelationTuple, RelationDefinition (6개 모델) — 수용 기준: `npx prisma db push` 성공

#### L3: CRM 모델
5. **CRM 스키마** — Prisma Client, Contact, ClientFinancial, ClientAchievement, Certificate, ProgramInfo, MatchingResult (7개 모델) — 수용 기준: Client ↔ Contact 등 relation 정상

#### L3: Project/Document 모델
6. **프로젝트/서류 스키마** — Prisma Project, ProjectMember, ChecklistTemplate, ChecklistItem, Document, DocumentEmbedding, ResearchJournal (7개 모델) — 수용 기준: Project ↔ Client, Document ↔ Client relation 정상

#### L3: AI/Communication/기타 모델
7. **AI/알림/일정 스키마** — Prisma Meeting(@relation Client 포함), MeetingAttendee, MeetingTranscript, ActionItem, AiJob, SkillPattern, AutomationLog, Notification, EmailLog, Schedule, FinancialReport, Estimate, Contract (13개 모델) — 수용 기준: Meeting ↔ Client relation 정상, 전체 enum 정의 완료

#### L3: ReBAC 권한
8. **ReBAC check/grant/revoke** — packages/db/src/permissions.ts (Prisma RelationTuple CRUD) — 수용 기준: 유닛 테스트 통과 — check('project', id, 'viewer', 'user', userId) 정상 동작

### L2: 인증

#### L3: Auth.js v5 Split Config
9. **Edge + Node 분리 설정** — packages/auth (auth.config.ts Edge, auth.ts Node + Prisma Adapter, middleware.ts, dal.ts, session-cache.ts) — 수용 기준: 로그인 → 세션 생성 → 미들웨어 보호 라우트 접근 정상

### L2: UI 기반

#### L3: shadcn/ui 패키지
10. **공유 UI 컴포넌트** — packages/ui (button, input, card, dialog, dropdown-menu, label, table, badge, sidebar, toast + globals.css + cn() 유틸) — 수용 기준: apps/web에서 `@axle/ui` import 정상

### L2: 웹앱 스캐폴드

#### L3: Next.js 16 앱 구조
11. **앱 라우터 + 레이아웃** — apps/web (root layout, (auth)/login, (app)/dashboard, (settings) scaffold, api/auth/[...nextauth], middleware.ts, app-sidebar, user-menu) — 수용 기준: 로그인 → 대시보드 리다이렉트 정상, 미인증 시 로그인 페이지 리다이렉트

#### L3: Settings 페이지 스캐폴드
12. **설정 페이지 기본 구조** — (settings) 라우트 그룹 (조직 설정, 팀 관리, 알림 설정, 연동 설정 탭 레이아웃) — 수용 기준: /settings 접근 시 설정 페이지 렌더링

---

## L1: CRM (고객 관리) — Phase 1

고객사/인물 관리, 온보딩, 명함 OCR, 사업자 검증, 인증서, 파이프라인 칸반

### L2: 고객사 관리

#### L3: Client CRUD
1. **Client API** — SSOT: /api/clients, GET+POST+PATCH+DELETE (Prisma Client CRUD, Zod 검증) — 수용 기준: 고객사 생성 시 DB 레코드 생성 + 목록 조회 정상
2. **Client 목록/상세 UI** — 고객사 목록 테이블 + 상세 페이지 (탭: 정보, 인물, 서류, 프로젝트, 재무, 인증서)

#### L3: Contact CRUD
3. **Contact API** — SSOT: /api/clients/[clientId]/contacts, GET+POST+PATCH+DELETE (Prisma Contact CRUD) — 수용 기준: 인물 생성/수정/삭제 정상
4. **Contact UI** — 인물 목록 + 상세 (고객사 탭 내)

#### L3: 명함 OCR
5. **OCR 처리** — packages/ocr (Gemini Vision API로 명함 이미지 → Contact 필드 추출) — 수용 기준: 명함 이미지 업로드 → name, position, phone, email 자동 추출

#### L3: 사업자번호 검증
6. **공공데이터 API 연동** — packages/ocr (사업자번호 → 국세청 사업자등록 상태조회 API, 무료) — 수용 기준: 사업자번호 입력 시 사업자 상태(정상/휴업/폐업) + 기업명 자동 조회

### L2: 고객 온보딩

#### L3: Client Onboarding 워크플로우
7. **AI 마스터 프로필 생성** — Client 생성 시 공공데이터 API + DART 데이터 기반 masterProfile/profileBlocks JSON 자동 생성 (Prisma Client.masterProfile, Client.profileBlocks) — 수용 기준: 고객사 생성 → AI 프로필 자동 생성 + 프로필 뷰 UI 표시
8. **온보딩 체크리스트 발송** — 고객사 생성 완료 시 NDA + 기업정보 양식 등 초기 서류 요청 자동 발송 — 수용 기준: 온보딩 메일 발송 → EmailLog 기록

### L2: 인증서 관리

#### L3: Certificate CRUD
9. **Certificate API** — SSOT: /api/clients/[clientId]/certificates (Prisma Certificate CRUD, 유효기간 추적) — 수용 기준: 인증서 등록/조회/삭제 + 만료일 기반 알림 연동
10. **Certificate UI** — 고객사 상세 인증서 탭 (목록, 유효기간 인디케이터, 등록 폼)

### L2: 파이프라인

#### L3: 칸반 뷰
11. **Client 파이프라인 칸반** — PROSPECT → ACTIVE → INACTIVE 상태별 카드 뷰, 드래그앤드롭 — 수용 기준: 칸반 보드에서 상태 변경 시 DB 반영

---

## L1: Documents (서류 관리) — Phase 2

Storage 패키지, 파일 업로드/다운로드, 토큰 업로드, OCR, 버전 추적, 체크리스트

### L2: Storage 패키지

#### L3: packages/storage Scaffold
1. **Supabase Storage 클라이언트** — packages/storage (싱글톤, 버킷 구성: documents/recordings/exports, 파일 크기/MIME 검증) — 수용 기준: @axle/storage import + upload/download 함수 정상
2. **Upload/Download 유틸** — packages/storage (buffer/stream/formData 업로드, Signed URL 다운로드, Sharp 이미지 처리, PDF 미리보기) — 수용 기준: 파일 업로드 → Signed URL 반환 정상

### L2: 서류 저장소

#### L3: Document CRUD
3. **Document API** — SSOT: /api/documents, GET+POST+DELETE (Prisma Document CRUD + @axle/storage 연동) — 수용 기준: 파일 업로드 → Supabase Storage 저장 + DB 레코드 생성
4. **Document UI** — 서류 목록 (필터: 고객사, 카테고리, 상태) + 미리보기 + 다운로드

#### L3: 토큰 업로드
5. **외부 업로드 링크** — /api/upload/[token] (uploadToken 기반 인증 없는 업로드) — 수용 기준: 토큰 URL로 파일 업로드 → Document 생성 + ChecklistItem 상태 UPLOADED로 변경

#### L3: 서류 OCR
6. **OCR 처리** — packages/ocr (Document 업로드 시 Gemini Vision → ocrResult JSON 저장) — 수용 기준: PDF/이미지 업로드 → OCR 텍스트 추출 + DB 저장

#### L3: 버전 관리
7. **서류 버전 추적** — Document.version + parentDocId 체인 — 수용 기준: 동일 서류 재업로드 시 버전 증가 + 이전 버전 열람 가능

### L2: 체크리스트

#### L3: 체크리스트 템플릿
8. **ChecklistTemplate CRUD** — SSOT: /api/checklist-templates (Prisma ChecklistTemplate CRUD, ProjectType별) — 수용 기준: 템플릿 생성 → 프로젝트 생성 시 자동 적용

#### L3: 체크리스트 관리
9. **ChecklistItem UI** — 프로젝트별 체크리스트 (PENDING → REQUESTED → UPLOADED → VERIFIED 상태 관리) — 수용 기준: 항목 상태 변경 시 DB 반영 + 서류 연결

### L2: 서류 만료

#### L3: 만료 추적
10. **서류 만료 알림** — Document.expiresAt 기반 만료 예정 추적 + autoRenew 플래그 — 수용 기준: 만료 D-30 서류 목록 조회 가능

---

## L1: Projects (업무 프로젝트) — Phase 3

8가지 ProjectType (BUSINESS_PLAN, VENTURE_CERT, SOBOOJANG_CERT, RESEARCH_INSTITUTE, PATENT, FINANCIAL_ANALYSIS, RESEARCH_TASK, BUNDLE), 상태 머신, 팀 배정, 수수료 추적

### L2: 프로젝트 관리

#### L3: Project CRUD
1. **Project API** — SSOT: /api/projects, GET+POST+PATCH+DELETE (Prisma Project CRUD, 8가지 ProjectType 지원) — 수용 기준: 프로젝트 생성 시 ChecklistTemplate 자동 적용

#### L3: 상태 머신
2. **프로젝트 상태 전이** — INTAKE → DOC_COLLECTING → IN_PROGRESS → REVIEW → SUBMITTED → APPROVED/REJECTED → COMPLETED — 수용 기준: 유효하지 않은 상태 전이 시 400 에러

#### L3: BUNDLE 프로젝트
3. **번들 생성** — BUNDLE 타입 생성 시 하위 프로젝트 자동 생성 (VENTURE_CERT + RESEARCH_INSTITUTE + PATENT, SOBOOJANG_CERT 선택 추가) — 수용 기준: 번들 생성 → 하위 프로젝트 자동 생성 + parentId 연결

#### L3: RESEARCH_TASK 워크플로우
4. **리서치 태스크** — RESEARCH_TASK 타입 프로젝트: 조사 항목 정의(metadata) → AiJob(RESEARCH, CLI_CLAUDE) → agent-bridge/deep-research → 보고서 Document(OUTPUT) 생성 — 수용 기준: 리서치 작업 생성 → AI 조사 실행 → 결과 리포트 Document 저장

### L2: 팀 배정

#### L3: ProjectMember 관리
5. **팀원 배정 API** — SSOT: /api/projects/[id]/members (Prisma ProjectMember CRUD, LEAD/MEMBER/VIEWER 역할) — 수용 기준: 팀원 추가 → Notification 발송
6. **수수료 추적** — Project.feeType (FIXED/SUCCESS_RATE/MONTHLY) + feeAmount + isPaid — 수용 기준: 수수료 정보 입력/수정 정상

### L2: 프로젝트 UI

#### L3: 프로젝트 목록/상세
7. **프로젝트 목록 페이지** — 필터 (타입, 상태, 담당자, 고객사) + 정렬 + 칸반/테이블 전환
8. **프로젝트 상세 페이지** — 탭: 개요, 체크리스트, 서류, 미팅, AI 작업, 견적/계약

---

## L1: Communication (이메일/알림) — Phase 4

이메일, SMS/알림톡, 인앱 알림, Web Push, Telegram, Discord, 이벤트 버스

### L2: 이메일

#### L3: Resend 이메일
1. **이메일 발송 서비스** — packages/email (Resend SDK + React Email 템플릿, 9가지 EmailType) — 수용 기준: 서류 요청 이메일 발송 → EmailLog 기록
2. **이메일 템플릿** — DOC_REQUEST, DOC_PUSH, MEETING_SUMMARY, ESTIMATE, CONTRACT, JOURNAL_REMINDER, DEADLINE_ALERT, MATCHING_DIGEST, ONBOARDING

#### L3: SMS/알림톡
3. **Solapi 연동** — packages/email (SMS + KakaoTalk AlimTalk 발송) — 수용 기준: 서류 미제출 리마인더 SMS 발송 성공

#### L3: 이메일 수신거부
4. **Unsubscribe** — packages/email (HMAC 토큰 생성/검증 + /api/email/unsubscribe 엔드포인트) — 수용 기준: 수신거부 링크 클릭 → 이후 해당 수신자에 발송 차단

#### L3: EmailLog 조회
5. **EmailLog API** — SSOT: /api/email-logs, GET (Prisma EmailLog 조회, clientId/projectId/type 필터) — 수용 기준: 고객사/프로젝트별 발송 이력 조회 정상

### L2: 알림

#### L3: 인앱 알림
6. **Notification API** — SSOT: /api/notifications, GET+PATCH (Prisma Notification CRUD, 16가지 NotificationType: DOC_REQUESTED, DOC_UPLOADED, DOC_EXPIRING, DEADLINE, MEETING, JOURNAL_DUE, ACTION_ITEM, ACTION_ITEM_DUE, PROJECT_ASSIGNED, MATCHING_RESULT, AI_JOB_COMPLETE, AI_JOB_FAILED, PORTAL_COMPLETE, HANDOFF, ESTIMATE_SENT, BUNDLE_COMPLETE) — 수용 기준: 알림 목록 조회 + 읽음 처리 정상
7. **알림 UI** — 헤더 벨 아이콘 + 드롭다운 + 읽지 않은 카운트 배지

#### L3: Web Push
8. **Push 알림** — packages/notification (Service Worker + web-push) — 수용 기준: 브라우저 푸시 알림 수신

#### L3: Telegram 알림
9. **Telegram Bot** — packages/notification (Telegram Bot API, 긴급 알림 전용) — 수용 기준: 지원사업 마감 D-1 알림 Telegram 수신

#### L3: Discord 알림
10. **Discord Webhook** — packages/notification (Discord Webhook, 팀 채널 알림) — 수용 기준: AI 작업 완료/실패 시 Discord 메시지 발송

### L2: 이벤트 시스템

#### L3: 트리거 맵 설정
11. **Notification Trigger Map** — packages/notification (14개 비즈니스 이벤트 → 채널 + 수신자 매핑 설정, getTriggerConfig()) — 수용 기준: 이벤트별 채널/수신자 설정 조회 정상

#### L3: 디스패처
12. **Event Dispatcher** — packages/notification (dispatch(event, payload) → triggerMap 조회 → 채널별 발송, 에러 격리) — 수용 기준: 서류 업로드 이벤트 → 인앱+이메일 동시 발송 + 한 채널 실패 시 나머지 정상

#### L3: 이벤트 버스
13. **TypedEventEmitter** — apps/web (비즈니스 이벤트 emit/on/off, 타입 안전) — 수용 기준: eventBus.emit("DOC_UPLOADED", payload) → dispatcher 호출

---

## L1: AI Engine (AI 엔진) — Phase 5

3-Tier AI 라우터, RAG 시스템, Gap 진단, 평가, SkillPattern 학습

### L2: AI 라우터

#### L3: 3-Tier 라우팅
1. **resolveAiTier** — packages/ai (AiJobType → AiTier 자동 결정: LOCAL_MLX / API_HAIKU / API_OPUS / CLI_CLAUDE) — 수용 기준: BUSINESS_PLAN → CLI_CLAUDE, JOURNAL_DRAFT → LOCAL_MLX 라우팅 정상

#### L3: AiJob 관리
2. **AiJob API** — SSOT: /api/ai/jobs, GET+POST (Prisma AiJob CRUD, 10가지 AiJobType) — 수용 기준: 작업 생성 → QUEUED → RUNNING → COMPLETED 상태 전이 + cost/duration 기록

### L2: RAG 시스템

#### L3: 문서 임베딩
3. **DocumentEmbedding 생성** — packages/ai (OpenAI text-embedding-3-small → pgvector 저장, Prisma DocumentEmbedding) — 수용 기준: Document 업로드 → 임베딩 생성 + 코사인 유사도 검색 정상

#### L3: RAG 검색
4. **시맨틱 검색** — packages/ai (질의 → 관련 문서 chunks 검색 → 컨텍스트 조합) — 수용 기준: 검색 쿼리 → 관련도 높은 문서 Top-K 반환

### L2: AI 분석

#### L3: Gap 진단
5. **Gap Diagnosis** — packages/ai (Client 문서 vs ProgramInfo 요건 대조 → 부족 항목 식별) — 수용 기준: 진단 실행 → 부족 서류/항목 목록 + 우선순위 반환

#### L3: 평가 엔진
6. **Evaluation Engine** — packages/ai (사업계획서 자가 평가: 기준별 점수 + 약점 + 개선안) — 수용 기준: 평가 실행 → 항목별 점수 + 개선 제안 반환

### L2: SkillPattern 학습

#### L3: 패턴 수집/승격
7. **SkillPattern 학습 루프** — packages/ai (AiJob 완료 → 패턴 추출 → successCount++ → ≥10회 → 파인튜닝 후보 → LOCAL_MLX 승격) — 수용 기준: 동일 패턴 10회 성공 시 isFineTuned 후보 마킹

#### L3: SkillPattern 모니터링 UI
8. **패턴 대시보드** — (settings)/ai 페이지 (수집된 패턴 목록, successCount, 파인튜닝 후보, tier 승격 이력) — 수용 기준: 패턴 목록 + 통계 표시

---

## L1: DocGen (문서 생성) — Phase 6

사업계획서 이중 엔진, 견적서, 계약서, 연구일지 리포트, 특허

### L2: 사업계획서

#### L3: RAG 초안 생성 (Engine A)
1. **RAG Draft** — packages/docgen (고객사 벡터 + 성공 사례 → 사업계획서 초안 생성, AiJob CLI_CLAUDE) — 수용 기준: 초안 생성 → 마크다운 문서 반환

#### L3: 정밀 편집 (Engine B)
2. **Precision Editor** — packages/docgen (공고문 양식 분석 → 항목별 연구 → 이미지/다이어그램 → DOCX 생성) — 수용 기준: 양식 맞춤 DOCX 파일 생성 + 이미지 포함

#### L3: 검증
3. **Verification** — packages/docgen (서류 완비 + 양식 적합 + 자격 재확인) — 수용 기준: 검증 실행 → 누락 항목 목록 반환

### L2: 기타 문서 생성

#### L3: 견적서 생성
4. **Estimate DOCX** — packages/docgen/estimate (항목 입력 → 견적서 DOCX/PDF 생성) — 수용 기준: 견적서 생성 → Document (OUTPUT) 저장

#### L3: 계약서 생성
5. **Contract DOCX** — packages/docgen/contract (계약 정보 → 계약서 DOCX + 전자서명) — 수용 기준: 계약서 생성 → Document (OUTPUT) 저장

#### L3: HWPX 양식 편집
6. **HWPX Editor** — packages/docgen (한글 양식 템플릿 → 필드 채우기 + 체크박스 토글) — 수용 기준: 벤처 기술성평가서 HWPX 양식 자동 편집

#### L3: 연구일지 월간 리포트
7. **Monthly Report** — packages/docgen (월간 연구일지 목록 → DOCX 리포트 자동 생성) — 수용 기준: 해당 월 전체 일지 → 포맷된 리포트 DOCX

#### L3: 특허 명세서
8. **Patent Draft** — packages/docgen (선행기술 조사 + 명세서 초안, AiJob CLI_CLAUDE) — 수용 기준: 특허 명세서 초안 생성 → 마크다운 + DOCX

### L2: 문서 변환

#### L3: PDF/Markdown/HWPX 변환
9. **PDF → Markdown** — packages/docgen/converters (pdf-parse 기반 구조 추출) — 수용 기준: 표/제목/본문 구조 보존
10. **Markdown → DOCX** — packages/docgen/converters (docx-js 기반 한국어 DOCX 변환) — 수용 기준: 한글 폰트 + 전체 마크다운 문법 지원

---

## L1: Calendar (일정/지원사업) — Phase 7

일정 관리, 지원사업 마감, Google Calendar 양방향 동기화, ProgramInfo 관리

### L2: 일정 관리

#### L3: Schedule CRUD
1. **Schedule API** — SSOT: /api/schedules, GET+POST+PATCH+DELETE (Prisma Schedule CRUD, 4가지 ScheduleType) — 수용 기준: 일정 생성 + reminderDays 설정 정상

#### L3: 캘린더 UI
2. **통합 캘린더 뷰** — 월간/주간/일간 캘린더 (지원사업 마감 + 고객사 일정 + 미팅 + 리마인더 통합) — 수용 기준: 캘린더에 모든 타입 일정 표시

### L2: Google Calendar 연동

#### L3: 양방향 동기화
3. **Google Calendar Sync** — apps/web/lib/google-calendar.ts (OAuth + Calendar API, AXLE → Google + Google → AXLE 양방향) — 수용 기준: AXLE 일정 생성 → Google Calendar 반영 + 역방향

#### L3: OAuth 설정
4. **Google Calendar OAuth** — (settings)/integrations 페이지에서 Google Calendar 연결/해제 — 수용 기준: OAuth 플로우 완료 → 토큰 저장 + 동기화 활성화

### L2: 지원사업 관리

#### L3: ProgramInfo CRUD
5. **ProgramInfo API** — SSOT: /api/programs, GET+POST+PATCH (Prisma ProgramInfo CRUD, 7가지 ProgramCategory) — 수용 기준: 지원사업 등록 + 마감일 Schedule 자동 생성

#### L3: ProgramInfo UI
6. **지원사업 목록/상세** — 목록 (카테고리, 마감일, 지역 필터) + 상세 (요건, 매칭 결과 포함)

---

## L1: Matching (매칭/크롤러) — Phase 8

3단계 AI 매칭, Playwright 크롤러, 지원사업 자동 수집

### L2: 크롤러

#### L3: 지원사업 크롤링
1. **Crawler Engine** — packages/crawler (Playwright → 지원사업 포털 자동 스크래핑 → ProgramInfo 생성) — 수용 기준: 크롤러 실행 → 새 지원사업 ProgramInfo DB 저장

#### L3: 크롤러 셀프 리페어
2. **Selector Self-Repair** — packages/crawler (셀렉터 실패 → 스크린샷 → AI → 새 셀렉터 추출) — 수용 기준: 셀렉터 변경 시 자동 복구 후 재시도

### L2: 매칭

#### L3: 3단계 매칭 알고리즘
3. **Matching Engine** — packages/matching (Stage 1: 실격 필터 → Stage 2: 감점 → Stage 3: AI 점수화, Prisma MatchingResult) — 수용 기준: Client-ProgramInfo 매칭 → 점수 + 추천/실격 사유 반환

#### L3: 매칭 UI
4. **매칭 결과 뷰** — 고객사별 추천 지원사업 목록 + 점수 + 매칭 사유 + 피드백(isRelevant/feedbackNote) — 수용 기준: 고객사 선택 → 추천 지원사업 score 내림차순 + 피드백 제출

---

## L1: Meetings (미팅) — Phase 9

미팅 관리, 녹음/전사, AI 요약, 액션 아이템, 프로젝트 자동 생성, 요약 메일 발송

### L2: 미팅 관리

#### L3: Meeting CRUD
1. **Meeting API** — SSOT: /api/meetings, GET+POST+PATCH+DELETE (Prisma Meeting CRUD + MeetingAttendee, Meeting ↔ Client relation) — 수용 기준: 미팅 생성 + 참석자 추가 정상

#### L3: 녹음/업로드
2. **Recording Upload API** — /api/meetings/[id]/recording (파일 업로드 → @axle/storage) — 수용 기준: mp3/m4a/wav 업로드 → recordingUrl 저장

### L2: 전사/요약

#### L3: 전사 파이프라인
3. **Transcription** — QStash Job Chain (AiJob TRANSCRIBE → MeetingTranscript.rawTranscript) — 수용 기준: 녹음 업로드 → 자동 전사 시작 → rawTranscript 저장

#### L3: AI 요약 + 액션 아이템
4. **Summary + ActionItem 추출** — AiJob SUMMARY (rawTranscript → summary + keyDecisions + ActionItem 자동 생성) — 수용 기준: 전사 완료 → 요약 + 액션 아이템 자동 생성

#### L3: 수동 전사 입력
5. **Manual Transcript** — 클로바노트 등 외부 전사 텍스트 붙여넣기 → 요약 진행 — 수용 기준: 텍스트 붙여넣기 → AI 요약 실행

### L2: 액션 관리

#### L3: ActionItem CRUD
6. **ActionItem API** — SSOT: /api/meetings/[id]/actions (Prisma ActionItem CRUD, OPEN → IN_PROGRESS → DONE) — 수용 기준: 액션 아이템 상태 변경 + ChecklistItem 연결

#### L3: ActionItem → Project 자동 생성
7. **프로젝트 자동 생성 제안** — ActionItem에서 프로젝트 자동 생성 제안 → 승인 시 Project 생성 + ChecklistTemplate 자동 적용 — 수용 기준: 액션 아이템에서 "프로젝트 생성" 클릭 → Project 생성 + 체크리스트 적용

#### L3: 미팅 요약 메일
8. **Post-Meeting Email** — 참석자 전체에 요약 + 액션 아이템 자동 메일 발송 — 수용 기준: 요약 완료 → EmailLog 생성 + 발송 성공

### L2: 미팅 UI

#### L3: 미팅 페이지
9. **미팅 목록/상세/생성** — 목록 (날짜, 고객사, 프로젝트 필터) + 상세 (탭: 전사, 요약, 액션 아이템, 녹음) + 생성 폼

---

## L1: Journal (연구일지) — Phase 10

연구일지 작성/관리, AI 초안, 승인 워크플로우, 월간 리포트

### L2: 연구일지 관리

#### L3: Journal CRUD
1. **ResearchJournal API** — SSOT: /api/journals, GET+POST+PATCH (Prisma ResearchJournal CRUD) — 수용 기준: 일지 생성 + 수정 정상 (Contact.isResearcher 연구원 연결)

#### L3: 승인 워크플로우
2. **Approval Workflow** — /api/journals/[id]/approve (DRAFT → SUBMITTED → APPROVED 상태 전이) — 수용 기준: 제출 → 승인 → 상태 변경 + 알림

#### L3: AI 초안
3. **Journal AI Draft** — AiJob JOURNAL_DRAFT (이전 일지 + 연구 분야 컨텍스트 → 초안 생성, LOCAL_MLX) — 수용 기준: AI 초안 요청 → 연구일지 초안 반환

### L2: 연구원 관리

#### L3: 연구원 목록 + 월간 리포트
4. **Researcher List API** — 고객사별 연구원(Contact.isResearcher=true) 목록 + 월간 일지 현황 — 수용 기준: 연구원 목록 + 작성률 표시
5. **Monthly Report** — 월간 연구일지 → DOCX 리포트 자동 생성 (packages/docgen) — 수용 기준: 해당 월 전체 일지 → DOCX 생성

### L2: 연구일지 UI

#### L3: 일지 페이지
6. **일지 목록/상세/생성** — 목록 (고객사, 연구원, 월, 상태 필터) + 상세/편집 (마크다운 에디터 + 승인 버튼) + 생성

---

## L1: Finance (재무/분석) — Phase 11

ClientFinancial CRUD, DART 연동, AI 재무 분석, 성과 추적, KPI 대시보드

### L2: 재무 데이터

#### L3: ClientFinancial CRUD
1. **ClientFinancial API** — SSOT: /api/clients/[id]/financials, GET+POST+PATCH (Prisma ClientFinancial CRUD, 연도별) — 수용 기준: 재무 데이터 입력 + 연도별 조회 정상

#### L3: DART OpenAPI 연동
2. **DART 재무 데이터 수집** — 상장사: DART OpenAPI 자동 수집, 비상장사: 수동 입력/Desktop 홈택스 스크래핑 (Prisma AutomationLog DART_FETCH) — 수용 기준: 상장사 사업자번호 → DART API → ClientFinancial 자동 저장

#### L3: AI 재무 분석
3. **Financial Analysis** — AiJob FINANCIAL_ANALYSIS (유동비율, 부채비율, ROE 등 지표 분석 + 조정 컨설팅) — 수용 기준: 분석 실행 → 지표 JSON + 조정안 반환

#### L3: 재무 리포트
4. **FinancialReport 생성** — /api/clients/[id]/financial-reports (Prisma FinancialReport + docgen → DOCX) — 수용 기준: 분석 결과 → DOCX 리포트 생성

### L2: 성과 추적

#### L3: ClientAchievement CRUD
5. **Achievement API** — SSOT: /api/clients/[id]/achievements (Prisma ClientAchievement CRUD, 5가지 AchievementType) — 수용 기준: 성과 등록 (특허, 수상, 계약, 투자, 인증) 정상

### L2: 대시보드

#### L3: KPI 대시보드
6. **Analytics Dashboard** — (analytics) 라우트 그룹 (합격률, 매출, 수수료, 프로젝트 타입별 통계, 컨설턴트별 성과, Recharts 차트) — 수용 기준: 대시보드 로드 → 주요 KPI 차트 표시

#### L3: 재무 대시보드
7. **Finance Dashboard** — (finance) 라우트 그룹 (고객사별 재무 현황, 연도별 트렌드, 비교) — 수용 기준: 고객사 선택 → 재무 지표 차트 표시

---

## L1: Collaboration (협업/포털) — Phase 12

팀 협업, 활동 로그, 핸드오프, 고객사 외부 포털

### L2: 팀 협업

#### L3: 활동 타임라인
1. **Activity Timeline** — 프로젝트별 활동 기록 (서류 업로드, 상태 변경, 코멘트, AI 작업 등) — 수용 기준: 프로젝트 상세에서 활동 이력 시간순 표시

#### L3: 핸드오프
2. **Handoff Workflow** — 담당자 변경 → AI 자동 요약 → 인수자에게 핸드오프 메일 — 수용 기준: 담당자 변경 시 요약 메일 발송 + Notification

#### L3: @멘션
3. **Mention System** — 코멘트에서 @팀원 → 해당 팀원 Notification — 수용 기준: @멘션 시 대상 팀원에게 인앱 알림

### L2: 고객사 포털

#### L3: 외부 포털 뷰
4. **Client Portal** — (portal) 라우트 그룹 (토큰 기반 접근, 서류 업로드, 프로젝트 진행 상황 조회) — 수용 기준: 토큰 URL → 인증 없이 서류 업로드 + 진행 상황 확인

#### L3: 연구일지 포털
5. **Journal Portal** — 연구원이 토큰 링크로 직접 연구일지 작성 — 수용 기준: 토큰 URL → 연구일지 작성 폼 접근

---

## L1: Estimates (견적/계약) — Phase 13

견적서/계약서 CRUD, 문서 생성, 이메일 발송, 전자서명

### L2: 견적서

#### L3: Estimate CRUD
1. **Estimate API** — SSOT: /api/estimates, GET+POST+PATCH (Prisma Estimate CRUD, DRAFT → SENT → ACCEPTED/REJECTED) — 수용 기준: 견적서 생성 + 항목 입력 + 상태 변경 정상
2. **견적서 DOCX 생성 + 이메일** — docgen/estimate → DOCX → Resend 이메일 발송 — 수용 기준: 견적서 발송 → EmailLog 기록

### L2: 계약서

#### L3: Contract CRUD
3. **Contract API** — SSOT: /api/contracts, GET+POST+PATCH (Prisma Contract CRUD, DRAFT → SENT → SIGNED → EXPIRED) — 수용 기준: 계약서 생성 + 전자서명 + 상태 변경 정상
4. **계약서 DOCX + 전자서명** — docgen/contract + signature_pad (전자서명 → PDF 삽입) — 수용 기준: 서명 완료 → Document 저장 + 상태 SIGNED

#### L3: 견적 → 계약 전환
5. **Auto-conversion** — 견적 수락 시 계약서 자동 생성 제안 + 프로젝트 자동 생성 옵션 — 수용 기준: 견적 ACCEPTED → 계약서 초안 자동 생성

### L2: 견적/계약 UI

#### L3: 견적/계약 페이지
6. **견적/계약 목록/상세/생성** — 목록 (상태, 고객사, 금액 필터) + 상세 (항목, 이력, 서명) + 생성 폼

---

## L1: Agent Bridge (AI 자동화) — Phase 14

MLX 서버 관리, Claude CLI 브릿지, SkillPattern 수집, AI 라우터 API

### L2: MLX 서버

#### L3: MLX Server Manager
1. **MLX 프로세스 관리** — apps/agent-bridge (mlx-lm 서버 자동 시작/종료, 헬스체크) — 수용 기준: agent-bridge 시작 → MLX 서버 자동 기동 + OpenAI-compatible API 응답

#### L3: OpenAI-Compatible Proxy
2. **API Proxy** — MLX 서버를 OpenAI API 형식으로 래핑 → packages/ai에서 투명 호출 — 수용 기준: /v1/chat/completions 호출 → MLX Hermes 3 응답

### L2: Claude CLI 브릿지

#### L3: .claude-mq/ 파일 워처
3. **MQ Watcher** — apps/agent-bridge (.claude-mq/ 디렉토리 감시 → claude -p 실행 → 결과 반환) — 수용 기준: .claude-mq/에 파일 생성 → claude -p 실행 → 결과 파일 생성

#### L3: MQ 작업 제출
4. **Task Submission** — web → QStash → agent-bridge → .claude-mq/ → 결과 콜백 — 수용 기준: 웹에서 사업계획서 AI 작업 → agent-bridge에서 처리 → 결과 반환

### L2: 음성 전사

#### L3: mlx-whisper
5. **Local Transcription** — apps/agent-bridge (mlx-whisper로 로컬 음성 전사, Apple Silicon 최적화) — 수용 기준: mp3 파일 → 한국어 텍스트 전사

### L2: SkillPattern 수집

#### L3: Pattern Collector
6. **SkillPattern Collector** — AiJob 완료 → 패턴 추출 → DB 저장 → 파인튜닝 후보 마킹 — 수용 기준: AiJob 완료 시 SkillPattern.successCount 자동 증가

### L2: API 서버

#### L3: Express Routes
7. **Health/AI/Transcribe API** — apps/agent-bridge Express 서버 (헬스체크, AI 라우팅, 전사 엔드포인트) — 수용 기준: /health → 200, /ai/chat → MLX 응답, /transcribe → 전사 결과

#### L3: launchd 서비스
8. **자동 시작** — Mac Mini launchd 등록 (재시작 시 자동 기동) — 수용 기준: 재부팅 후 agent-bridge 자동 시작

---

## L1: Desktop (데스크톱) — Phase 15

Electron, 네이티브 녹음, 인증서, 포털 자동화, 오프라인 캐시

### L2: Electron 기반

#### L3: App Shell
1. **Electron Scaffold** — apps/desktop (BrowserWindow → web 앱 로드, 시스템 트레이, 자동 업데이트) — 수용 기준: Electron 앱 빌드 → web 앱 정상 표시

#### L3: Preload Script
2. **contextBridge** — IPC 채널 안전 노출 (recorder, cert, portal, agent 네임스페이스) — 수용 기준: 렌더러에서 window.axle.recorder 등 API 접근

### L2: 네이티브 기능

#### L3: 오디오 녹음
3. **Native Recording** — IPC recorder (시스템 마이크 → WebM/WAV 녹음 → @axle/storage 업로드) — 수용 기준: 녹음 시작/중지 → 파일 업로드 → Meeting.recordingUrl 저장

#### L3: 인증서 관리
4. **PKCS#12 Certificate** — IPC cert (로컬 .pfx 파일 읽기 + 비밀번호 복호화) — 수용 기준: 인증서 파일 선택 → 유효기간/주체 정보 표시

### L2: 포털 자동화

#### L3: Playwright 포털 등록
5. **Portal Automation** — IPC portal (Playwright로 홈택스/민원24/4대보험/VENTUREIN/KOITA 자동화) — 수용 기준: 홈택스 서류 발급 → Document 저장 + AutomationLog 기록

#### L3: 셀프 리페어
6. **Selector Self-Repair** — 포털 셀렉터 변경 감지 → 스크린샷 → AI → 새 셀렉터 추출 — 수용 기준: 셀렉터 실패 시 자동 복구 재시도

#### L3: AutomationLog 조회
7. **AutomationLog API** — SSOT: /api/automation-logs, GET (Prisma AutomationLog 조회, clientId/type/status 필터) — 수용 기준: 포털 자동화 이력 조회 정상

### L2: 오프라인

#### L3: SQLite 로컬 캐시
8. **Offline Cache** — better-sqlite3 (오프라인 시 로컬 캐시 → 온라인 복귀 시 동기화) — 수용 기준: 네트워크 끊김 → 로컬 작업 → 재연결 시 동기화

---

## L1: Cron (자동화 스케줄) — Phase 16

9개 크론 잡, QStash 오프로딩, Vercel Cron

### L2: 리마인더

#### L3: doc-reminder
1. **서류 제출 리마인더** — /api/cron/doc-reminder (미제출 ChecklistItem → 고객사에 이메일/SMS 리마인더) — 수용 기준: 미제출 D-3 서류 → 리마인더 발송

#### L3: deadline-alert
2. **지원사업 마감 알림** — /api/cron/deadline-alert (ProgramInfo.applicationEnd D-30~D-1 → 담당자 알림) — 수용 기준: 마감 D-7 지원사업 → Notification + Telegram

#### L3: journal-remind
3. **연구일지 리마인더** — /api/cron/journal-remind (미작성 연구원에게 월말 리마인더) — 수용 기준: 월말 D-5 미작성 → 이메일 리마인더

#### L3: doc-expiry
4. **서류 만료 알림** — /api/cron/doc-expiry (Document.expiresAt D-30/D-7 → 담당자 알림) — 수용 기준: 만료 예정 서류 → Notification

### L2: 동기화

#### L3: schedule-sync
5. **Google Calendar 동기화** — /api/cron/schedule-sync (Schedule ↔ Google Calendar 양방향 동기화) — 수용 기준: 15분 간격 동기화 + 충돌 해결

### L2: AI 자동 작업

#### L3: crawler-execute
6. **크롤러 실행** — /api/cron/crawler-execute → QStash → packages/crawler 실행 — 수용 기준: 일일 크롤링 → 새 ProgramInfo 생성

#### L3: matching-refresh
7. **매칭 갱신** — /api/cron/matching-refresh → QStash → packages/matching 전체 재계산 — 수용 기준: 전체 Client-ProgramInfo 매칭 결과 갱신

#### L3: embedding-generate
8. **임베딩 생성** — /api/cron/embedding-generate (미처리 Document → OpenAI 임베딩 → pgvector) — 수용 기준: 미임베딩 문서 → 자동 벡터 생성

#### L3: daily-digest
9. **일일 요약 메일** — /api/cron/daily-digest (오늘 마감, 새 매칭, 미완료 액션 → 요약 메일) — 수용 기준: 매일 오전 → 담당자별 다이제스트 이메일

---

## 비기능 요구사항

### 성능
- AI 3-Tier 라우팅으로 비용 최적화 (LOCAL_MLX 우선, 복잡 작업만 API)
- pgvector 시맨틱 검색 응답 < 500ms
- 세션 캐시 3-tier (Redis → 메모리 → DB)

### 보안
- Auth.js v5 + ReBAC 세분화 권한
- 토큰 기반 외부 업로드 (인증 불필요, 시간 만료)
- PKCS#12 인증서 로컬 전용 (Desktop)
- OWASP Top 10 준수

### 안정성
- QStash Job Chaining (멀티스텝 파이프라인)
- AutomationLog 감사 추적
- Playwright 셀프 리페어 (포털 셀렉터 자동 복구)
- 크래시 복구 (completed_wis.txt SSOT)

### 확장성
- Turborepo 독립 빌드
- Organization 모델 (향후 SaaS)
- ReBAC (역할 기반 접근 제어)

## 외부 연동
- **Supabase**: PostgreSQL + pgvector + Storage
- **Vercel**: 웹 배포 + Cron
- **Upstash**: Redis + QStash
- **Claude API**: Opus/Haiku (AI 작업)
- **OpenAI**: text-embedding-3-small (임베딩)
- **Google Gemini**: Vision API (OCR)
- **Resend**: 이메일
- **Solapi**: SMS + 알림톡
- **Google Calendar**: 양방향 동기화
- **공공데이터 API (data.go.kr)**: 국세청 사업자등록 상태조회 (무료)
- **DART OpenAPI**: 상장사 재무 데이터 자동 수집
- **Telegram Bot**: 긴급 알림
- **Discord Webhook**: 팀 채널 알림
