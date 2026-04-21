# Fix Plan (Work Items)

---

## 🚦 EXECUTION ORDER (2026-04-21 확정)

**우선순위:** Phase 17 → Phase 18 → (남은 Phase 0~16 Gap은 Phase 17에서 커버)

1. **Phase 17 — Gap Fix (WI-201 ~ WI-228, 28건)**: 기존 엔진/파일은 있으나 UI·배선이 끊긴 항목을 E2E 동작까지 연결. ROI 최고.
2. **Phase 18 — 인증 업무 자동화 (WI-301 ~ WI-326, 26건)**: 설계 4.3 BUNDLE 워크플로우 중 핵심 가치인데 구현이 빠진 벤처/소부장/연구소/특허/포털 Playwright 실구현.

**Phase 0~16 기존 WI (WI-001 ~ WI-140) 처리 방침:**
- 대부분은 스캐폴드·구조 레벨이 이미 구현돼 있으나 `completed_wis.txt`에 미반영.
- flowset.sh `recover_completed_from_history()` 가 git log에서 자동 복원 — Phase 17 루프 실행 시점에 SSOT 동기화됨.
- 실제 미구현 gap은 Phase 17 WI가 대체 커버하므로 **이 영역은 Phase 17 완료 이후 재감사**.

**게이트:**
- Phase 17 완료 게이트 = WI-201 ~ WI-228 전부 merged + 사업계획서/서류요청/크롤러/Gap 진단 E2E 스모크 통과.
- Phase 18 시작 전 게이트 = HWPX 템플릿 포맷 + 포털 로그인 자격증명 관리 정책 (PKCS#12 저장 위치) 사용자 확정 필요.

---

## L1: Foundation (Phase 0)

### L2: Monorepo 설정 > L3: Turborepo Scaffold
- [ ] WI-001-chore Turborepo 루트 설정 | L1:Foundation > L2:Monorepo > L3:Scaffold
- [x] WI-002-chore 패키지 초기 구조 | L1:Foundation > L2:Monorepo > L3:Scaffold

### L2: 데이터베이스 > L3: Prisma 설정
- [x] WI-003-feat Prisma 7 Client Engine + Driver Adapter 설정 | L1:Foundation > L2:DB > L3:Prisma Setup

### L2: 데이터베이스 > L3: Auth/Org 모델
- [x] WI-004-feat 인증/조직 스키마 6개 모델 | L1:Foundation > L2:DB > L3:Auth Models

### L2: 데이터베이스 > L3: CRM 모델
- [ ] WI-005-feat CRM 스키마 7개 모델 | L1:Foundation > L2:DB > L3:CRM Models

### L2: 데이터베이스 > L3: Project/Document 모델
- [ ] WI-006-feat 프로젝트/서류 스키마 7개 모델 | L1:Foundation > L2:DB > L3:Project Models

### L2: 데이터베이스 > L3: AI/Communication/기타 모델
- [ ] WI-007-feat AI/알림/일정 스키마 13개 모델 (Meeting↔Client relation 포함) | L1:Foundation > L2:DB > L3:AI Models

### L2: 데이터베이스 > L3: ReBAC 권한
- [ ] WI-008-feat ReBAC check/grant/revoke | L1:Foundation > L2:DB > L3:ReBAC

### L2: 인증 > L3: Auth.js v5 Split Config
- [ ] WI-009-feat Auth.js v5 Edge+Node 분리 설정 | L1:Foundation > L2:Auth > L3:Auth.js

### L2: UI 기반 > L3: shadcn/ui 패키지
- [ ] WI-010-feat 공유 UI 컴포넌트 packages/ui | L1:Foundation > L2:UI > L3:shadcn

### L2: 웹앱 스캐폴드 > L3: Next.js 16 앱 구조
- [ ] WI-011-feat 앱 라우터 + 레이아웃 + 인증 | L1:Foundation > L2:Web > L3:App Router

### L2: 웹앱 스캐폴드 > L3: Settings 페이지 스캐폴드
- [ ] WI-012-feat 설정 페이지 기본 구조 | L1:Foundation > L2:Web > L3:Settings

---

## L1: CRM (Phase 1)

### L2: 고객사 관리 > L3: Client CRUD
- [ ] WI-013-feat Client API (/api/clients) | L1:CRM > L2:고객사 > L3:Client CRUD
- [ ] WI-014-feat Client 목록/상세 UI | L1:CRM > L2:고객사 > L3:Client UI

### L2: 고객사 관리 > L3: Contact CRUD
- [ ] WI-015-feat Contact API (/api/clients/[clientId]/contacts) | L1:CRM > L2:고객사 > L3:Contact CRUD
- [ ] WI-016-feat Contact UI | L1:CRM > L2:고객사 > L3:Contact UI

### L2: 고객사 관리 > L3: 명함 OCR
- [ ] WI-017-feat 명함 OCR packages/ocr Gemini Vision | L1:CRM > L2:고객사 > L3:OCR

### L2: 고객사 관리 > L3: 사업자번호 검증
- [ ] WI-018-feat 공공데이터 API 사업자 검증 | L1:CRM > L2:고객사 > L3:사업자검증

### L2: 고객 온보딩 > L3: Client Onboarding
- [ ] WI-019-feat AI 마스터 프로필 생성 Client.masterProfile | L1:CRM > L2:온보딩 > L3:masterProfile
- [ ] WI-020-feat 온보딩 체크리스트 발송 | L1:CRM > L2:온보딩 > L3:Onboarding

### L2: 인증서 관리 > L3: Certificate CRUD
- [ ] WI-021-feat Certificate API (/api/clients/[clientId]/certificates) | L1:CRM > L2:인증서 > L3:Certificate CRUD
- [ ] WI-022-feat Certificate UI | L1:CRM > L2:인증서 > L3:Certificate UI

### L2: 파이프라인 > L3: 칸반 뷰
- [ ] WI-023-feat Client 파이프라인 칸반 | L1:CRM > L2:파이프라인 > L3:Kanban

---

## L1: Documents (Phase 2)

### L2: Storage 패키지 > L3: packages/storage
- [ ] WI-024-feat Supabase Storage 클라이언트 packages/storage | L1:Documents > L2:Storage > L3:Scaffold
- [ ] WI-025-feat Upload/Download 유틸 Sharp PDF미리보기 | L1:Documents > L2:Storage > L3:Utils

### L2: 서류 저장소 > L3: Document CRUD
- [ ] WI-026-feat Document API (/api/documents @axle/storage) | L1:Documents > L2:서류 > L3:Document CRUD
- [ ] WI-027-feat Document UI 목록+미리보기+다운로드 | L1:Documents > L2:서류 > L3:Document UI

### L2: 서류 저장소 > L3: 토큰 업로드
- [ ] WI-028-feat 외부 업로드 링크 /api/upload/[token] | L1:Documents > L2:서류 > L3:Token Upload

### L2: 서류 저장소 > L3: 서류 OCR
- [ ] WI-029-feat Document OCR Gemini Vision→ocrResult | L1:Documents > L2:서류 > L3:OCR

### L2: 서류 저장소 > L3: 버전 관리
- [ ] WI-030-feat 서류 버전 추적 Document.version+parentDocId | L1:Documents > L2:서류 > L3:Versioning

### L2: 체크리스트 > L3: 체크리스트 템플릿
- [ ] WI-031-feat ChecklistTemplate CRUD /api/checklist-templates | L1:Documents > L2:체크리스트 > L3:Template

### L2: 체크리스트 > L3: 체크리스트 관리
- [ ] WI-032-feat ChecklistItem UI 상태관리+서류연결 | L1:Documents > L2:체크리스트 > L3:Item UI

### L2: 서류 만료 > L3: 만료 추적
- [ ] WI-033-feat 서류 만료 알림 Document.expiresAt | L1:Documents > L2:만료 > L3:Expiry

---

## L1: Projects (Phase 3)

### L2: 프로젝트 관리 > L3: Project CRUD
- [ ] WI-034-feat Project API (/api/projects 8가지 ProjectType) | L1:Projects > L2:프로젝트 > L3:Project CRUD

### L2: 프로젝트 관리 > L3: 상태 머신
- [ ] WI-035-feat 프로젝트 상태 전이 INTAKE→COMPLETED | L1:Projects > L2:프로젝트 > L3:State Machine

### L2: 프로젝트 관리 > L3: BUNDLE 프로젝트
- [ ] WI-036-feat 번들 생성 하위 프로젝트 자동 생성 | L1:Projects > L2:프로젝트 > L3:Bundle

### L2: 프로젝트 관리 > L3: RESEARCH_TASK
- [ ] WI-037-feat 리서치 태스크 AiJob RESEARCH→보고서 | L1:Projects > L2:프로젝트 > L3:Research Task

### L2: 팀 배정 > L3: ProjectMember 관리
- [ ] WI-038-feat 팀원 배정 API /api/projects/[id]/members | L1:Projects > L2:팀배정 > L3:Member
- [ ] WI-039-feat 수수료 추적 Project.feeType | L1:Projects > L2:팀배정 > L3:Fee

### L2: 프로젝트 UI > L3: 프로젝트 페이지
- [ ] WI-040-feat 프로젝트 목록 페이지 칸반/테이블 | L1:Projects > L2:UI > L3:List
- [ ] WI-041-feat 프로젝트 상세 페이지 탭 | L1:Projects > L2:UI > L3:Detail

---

## L1: Communication (Phase 4)

### L2: 이메일 > L3: Resend
- [ ] WI-042-feat 이메일 발송 서비스 packages/email Resend | L1:Comm > L2:이메일 > L3:Resend
- [ ] WI-043-feat 이메일 템플릿 9종 React Email | L1:Comm > L2:이메일 > L3:Templates

### L2: 이메일 > L3: SMS/알림톡
- [ ] WI-044-feat Solapi 연동 SMS+알림톡 | L1:Comm > L2:이메일 > L3:Solapi

### L2: 이메일 > L3: 수신거부
- [ ] WI-045-feat Email Unsubscribe HMAC 토큰 | L1:Comm > L2:이메일 > L3:Unsubscribe

### L2: 이메일 > L3: EmailLog 조회
- [ ] WI-046-feat EmailLog API /api/email-logs | L1:Comm > L2:이메일 > L3:EmailLog

### L2: 알림 > L3: 인앱 알림
- [ ] WI-047-feat Notification API (/api/notifications 16가지) | L1:Comm > L2:알림 > L3:Notification CRUD
- [ ] WI-048-feat 알림 UI 벨+드롭다운 | L1:Comm > L2:알림 > L3:Notification UI

### L2: 알림 > L3: Web Push
- [ ] WI-049-feat Push 알림 web-push | L1:Comm > L2:알림 > L3:Push

### L2: 알림 > L3: Telegram
- [ ] WI-050-feat Telegram Bot | L1:Comm > L2:알림 > L3:Telegram

### L2: 알림 > L3: Discord
- [ ] WI-051-feat Discord Webhook | L1:Comm > L2:알림 > L3:Discord

### L2: 이벤트 > L3: 트리거 맵
- [ ] WI-052-feat Notification Trigger Map 14개 이벤트 매핑 | L1:Comm > L2:이벤트 > L3:TriggerMap

### L2: 이벤트 > L3: 디스패처
- [ ] WI-053-feat Event Dispatcher 채널별 발송 | L1:Comm > L2:이벤트 > L3:Dispatcher

### L2: 이벤트 > L3: 이벤트 버스
- [ ] WI-054-feat TypedEventEmitter 이벤트 버스 | L1:Comm > L2:이벤트 > L3:EventBus

---

## L1: AI Engine (Phase 5)

### L2: AI 라우터 > L3: 3-Tier 라우팅
- [ ] WI-055-feat resolveAiTier AiJobType→AiTier | L1:AI > L2:라우터 > L3:Router

### L2: AI 라우터 > L3: AiJob
- [ ] WI-056-feat AiJob API /api/ai/jobs | L1:AI > L2:라우터 > L3:AiJob

### L2: RAG > L3: 임베딩
- [ ] WI-057-feat DocumentEmbedding OpenAI→pgvector | L1:AI > L2:RAG > L3:Embedding

### L2: RAG > L3: 검색
- [ ] WI-058-feat 시맨틱 검색 pgvector cosine | L1:AI > L2:RAG > L3:Search

### L2: 분석 > L3: Gap 진단
- [ ] WI-059-feat Gap Diagnosis Client문서 vs ProgramInfo | L1:AI > L2:분석 > L3:Gap

### L2: 분석 > L3: 평가 엔진
- [ ] WI-060-feat Evaluation Engine 사업계획서 평가 | L1:AI > L2:분석 > L3:Evaluation

### L2: SkillPattern > L3: 학습
- [ ] WI-061-feat SkillPattern 학습 루프 | L1:AI > L2:SkillPattern > L3:Learning

### L2: SkillPattern > L3: UI
- [ ] WI-062-feat 패턴 대시보드 (settings)/ai | L1:AI > L2:SkillPattern > L3:Dashboard

---

## L1: DocGen (Phase 6)

### L2: 사업계획서 > L3: RAG 초안
- [ ] WI-063-feat RAG Draft 사업계획서 초안 | L1:DocGen > L2:사업계획서 > L3:RAG
### L2: 사업계획서 > L3: 정밀 편집
- [ ] WI-064-feat Precision Editor 양식→DOCX | L1:DocGen > L2:사업계획서 > L3:Precision
### L2: 사업계획서 > L3: 검증
- [ ] WI-065-feat Verification 서류완비+양식적합 | L1:DocGen > L2:사업계획서 > L3:Verify

### L2: 기타 > L3: 견적서
- [ ] WI-066-feat Estimate DOCX | L1:DocGen > L2:기타 > L3:Estimate
### L2: 기타 > L3: 계약서
- [ ] WI-067-feat Contract DOCX | L1:DocGen > L2:기타 > L3:Contract
### L2: 기타 > L3: HWPX
- [ ] WI-068-feat HWPX Editor 한글 양식 편집 | L1:DocGen > L2:기타 > L3:HWPX
### L2: 기타 > L3: 연구일지 리포트
- [ ] WI-069-feat Monthly Report DOCX | L1:DocGen > L2:기타 > L3:Journal Report
### L2: 기타 > L3: 특허
- [ ] WI-070-feat Patent Draft 선행기술+명세서 | L1:DocGen > L2:기타 > L3:Patent

### L2: 변환 > L3: PDF/MD 변환기
- [ ] WI-071-feat PDF→Markdown 변환기 | L1:DocGen > L2:변환 > L3:PDF2MD
- [ ] WI-072-feat Markdown→DOCX 변환기 | L1:DocGen > L2:변환 > L3:MD2DOCX

---

## L1: Calendar (Phase 7)

### L2: 일정 > L3: Schedule CRUD
- [ ] WI-073-feat Schedule API /api/schedules | L1:Calendar > L2:일정 > L3:Schedule
### L2: 일정 > L3: 캘린더 UI
- [ ] WI-074-feat 통합 캘린더 뷰 월/주/일 | L1:Calendar > L2:일정 > L3:Calendar UI

### L2: Google > L3: 동기화
- [ ] WI-075-feat Google Calendar Sync 양방향 | L1:Calendar > L2:Google > L3:Sync
### L2: Google > L3: OAuth UI
- [ ] WI-076-feat Google Calendar OAuth 설정 UI | L1:Calendar > L2:Google > L3:OAuth

### L2: 지원사업 > L3: ProgramInfo CRUD
- [ ] WI-077-feat ProgramInfo API /api/programs | L1:Calendar > L2:지원사업 > L3:Program CRUD
### L2: 지원사업 > L3: UI
- [ ] WI-078-feat 지원사업 목록/상세 UI | L1:Calendar > L2:지원사업 > L3:Program UI

---

## L1: Matching (Phase 8)

### L2: 크롤러 > L3: 크롤링
- [ ] WI-079-feat Crawler Engine packages/crawler Playwright | L1:Matching > L2:크롤러 > L3:Crawler
### L2: 크롤러 > L3: 셀프 리페어
- [ ] WI-080-feat Selector Self-Repair AI 자동 복구 | L1:Matching > L2:크롤러 > L3:Self-Repair

### L2: 매칭 > L3: 3단계 엔진
- [ ] WI-081-feat Matching Engine packages/matching 3단계 | L1:Matching > L2:매칭 > L3:Engine
### L2: 매칭 > L3: UI
- [ ] WI-082-feat 매칭 결과 뷰 점수+피드백 | L1:Matching > L2:매칭 > L3:UI

---

## L1: Meetings (Phase 9)

### L2: 미팅 > L3: Meeting CRUD
- [ ] WI-083-feat Meeting API /api/meetings (Meeting↔Client) | L1:Meetings > L2:미팅 > L3:CRUD
### L2: 미팅 > L3: 녹음
- [ ] WI-084-feat Recording Upload @axle/storage | L1:Meetings > L2:미팅 > L3:Recording

### L2: 전사 > L3: 파이프라인
- [ ] WI-085-feat Transcription QStash Job Chain | L1:Meetings > L2:전사 > L3:Transcribe
### L2: 전사 > L3: 요약
- [ ] WI-086-feat Summary+ActionItem 추출 | L1:Meetings > L2:전사 > L3:Summary
### L2: 전사 > L3: 수동 입력
- [ ] WI-087-feat Manual Transcript 붙여넣기 | L1:Meetings > L2:전사 > L3:Manual

### L2: 액션 > L3: ActionItem
- [ ] WI-088-feat ActionItem API /api/meetings/[id]/actions | L1:Meetings > L2:액션 > L3:ActionItem
### L2: 액션 > L3: 프로젝트 자동 생성
- [ ] WI-089-feat ActionItem→Project 자동 생성 제안 | L1:Meetings > L2:액션 > L3:Auto Project
### L2: 액션 > L3: 요약 메일
- [ ] WI-090-feat Post-Meeting Email 참석자 발송 | L1:Meetings > L2:액션 > L3:Email

### L2: UI > L3: 미팅 페이지
- [ ] WI-091-feat 미팅 목록/상세/생성 UI | L1:Meetings > L2:UI > L3:Pages

---

## L1: Journal (Phase 10)

### L2: 연구일지 > L3: CRUD
- [ ] WI-092-feat ResearchJournal API /api/journals | L1:Journal > L2:연구일지 > L3:CRUD
### L2: 연구일지 > L3: 승인
- [ ] WI-093-feat Approval Workflow DRAFT→APPROVED | L1:Journal > L2:연구일지 > L3:Approval
### L2: 연구일지 > L3: AI 초안
- [ ] WI-094-feat Journal AI Draft LOCAL_MLX | L1:Journal > L2:연구일지 > L3:AI Draft

### L2: 연구원 > L3: 목록+리포트
- [ ] WI-095-feat Researcher List API | L1:Journal > L2:연구원 > L3:List
- [ ] WI-096-feat Monthly Report DOCX | L1:Journal > L2:연구원 > L3:Report

### L2: UI > L3: 일지 페이지
- [ ] WI-097-feat 일지 목록/상세/생성 UI | L1:Journal > L2:UI > L3:Pages

---

## L1: Finance (Phase 11)

### L2: 재무 > L3: Financial CRUD
- [ ] WI-098-feat ClientFinancial API /api/clients/[id]/financials | L1:Finance > L2:재무 > L3:CRUD
### L2: 재무 > L3: DART
- [ ] WI-099-feat DART 재무 데이터 수집 AutomationLog | L1:Finance > L2:재무 > L3:DART
### L2: 재무 > L3: AI 분석
- [ ] WI-100-feat Financial Analysis AiJob | L1:Finance > L2:재무 > L3:AI
### L2: 재무 > L3: 리포트
- [ ] WI-101-feat FinancialReport DOCX | L1:Finance > L2:재무 > L3:Report

### L2: 성과 > L3: Achievement
- [ ] WI-102-feat Achievement API /api/clients/[id]/achievements | L1:Finance > L2:성과 > L3:Achievement

### L2: 대시보드 > L3: KPI
- [ ] WI-103-feat Analytics Dashboard Recharts | L1:Finance > L2:대시보드 > L3:Analytics
### L2: 대시보드 > L3: 재무
- [ ] WI-104-feat Finance Dashboard Recharts | L1:Finance > L2:대시보드 > L3:Finance

---

## L1: Collaboration (Phase 12)

### L2: 팀 > L3: 타임라인
- [ ] WI-105-feat Activity Timeline 프로젝트 활동 기록 | L1:Collab > L2:팀 > L3:Timeline
### L2: 팀 > L3: 핸드오프
- [ ] WI-106-feat Handoff Workflow AI 요약+메일 | L1:Collab > L2:팀 > L3:Handoff
### L2: 팀 > L3: 멘션
- [ ] WI-107-feat Mention System 코멘트→알림 | L1:Collab > L2:팀 > L3:Mention

### L2: 포털 > L3: 고객사 포털
- [ ] WI-108-feat Client Portal 토큰 접근 | L1:Collab > L2:포털 > L3:Client
### L2: 포털 > L3: 연구일지 포털
- [ ] WI-109-feat Journal Portal 연구원 작성 | L1:Collab > L2:포털 > L3:Journal

---

## L1: Estimates (Phase 13)

### L2: 견적 > L3: Estimate
- [ ] WI-110-feat Estimate API /api/estimates | L1:Estimates > L2:견적 > L3:CRUD
- [ ] WI-111-feat 견적서 DOCX+이메일 | L1:Estimates > L2:견적 > L3:DOCX

### L2: 계약 > L3: Contract
- [ ] WI-112-feat Contract API /api/contracts | L1:Estimates > L2:계약 > L3:CRUD
- [ ] WI-113-feat 계약서 DOCX+전자서명 | L1:Estimates > L2:계약 > L3:DOCX
### L2: 계약 > L3: 전환
- [ ] WI-114-feat 견적→계약+프로젝트 자동 전환 | L1:Estimates > L2:계약 > L3:Conversion

### L2: UI > L3: 페이지
- [ ] WI-115-feat 견적/계약 목록/상세/생성 UI | L1:Estimates > L2:UI > L3:Pages

---

## L1: Agent Bridge (Phase 14)

### L2: MLX > L3: 서버
- [ ] WI-116-feat MLX 프로세스 관리 | L1:AgentBridge > L2:MLX > L3:Server
### L2: MLX > L3: Proxy
- [ ] WI-117-feat API Proxy MLX→OpenAI | L1:AgentBridge > L2:MLX > L3:Proxy

### L2: Claude > L3: MQ Watcher
- [ ] WI-118-feat MQ Watcher .claude-mq/ Chokidar | L1:AgentBridge > L2:Claude > L3:Watcher
### L2: Claude > L3: 제출
- [ ] WI-119-feat Task Submission web→QStash→MQ | L1:AgentBridge > L2:Claude > L3:Submit

### L2: 전사 > L3: Whisper
- [ ] WI-120-feat Local Transcription mlx-whisper | L1:AgentBridge > L2:전사 > L3:Whisper

### L2: SkillPattern > L3: Collector
- [ ] WI-121-feat SkillPattern Collector AiJob→패턴 | L1:AgentBridge > L2:SkillPattern > L3:Collector

### L2: API > L3: Routes
- [ ] WI-122-feat Express Health/AI/Transcribe API | L1:AgentBridge > L2:API > L3:Routes
### L2: API > L3: launchd
- [ ] WI-123-feat 자동 시작 launchd | L1:AgentBridge > L2:API > L3:launchd

---

## L1: Desktop (Phase 15)

### L2: Electron > L3: Shell
- [ ] WI-124-feat Electron Scaffold apps/desktop | L1:Desktop > L2:Electron > L3:Shell
### L2: Electron > L3: Preload
- [ ] WI-125-feat contextBridge IPC 채널 | L1:Desktop > L2:Electron > L3:Preload

### L2: 네이티브 > L3: 녹음
- [ ] WI-126-feat Native Recording IPC recorder | L1:Desktop > L2:네이티브 > L3:Recording
### L2: 네이티브 > L3: 인증서
- [ ] WI-127-feat PKCS#12 Certificate IPC cert | L1:Desktop > L2:네이티브 > L3:Cert

### L2: 포털 > L3: 자동화
- [ ] WI-128-feat Portal Automation 홈택스/민원24/4대보험/VENTUREIN/KOITA | L1:Desktop > L2:포털 > L3:Automation
### L2: 포털 > L3: 셀프 리페어
- [ ] WI-129-feat Selector Self-Repair 포털 셀렉터 | L1:Desktop > L2:포털 > L3:Self-Repair
### L2: 포털 > L3: AutomationLog
- [ ] WI-130-feat AutomationLog API /api/automation-logs | L1:Desktop > L2:포털 > L3:AutomationLog

### L2: 오프라인 > L3: SQLite
- [ ] WI-131-feat Offline Cache better-sqlite3 | L1:Desktop > L2:오프라인 > L3:SQLite

---

## L1: Cron (Phase 16)

### L2: 리마인더 > L3: doc-reminder
- [ ] WI-132-feat 서류 제출 리마인더 /api/cron/doc-reminder | L1:Cron > L2:리마인더 > L3:doc-reminder
### L2: 리마인더 > L3: deadline-alert
- [ ] WI-133-feat 지원사업 마감 알림 /api/cron/deadline-alert | L1:Cron > L2:리마인더 > L3:deadline-alert
### L2: 리마인더 > L3: journal-remind
- [ ] WI-134-feat 연구일지 리마인더 /api/cron/journal-remind | L1:Cron > L2:리마인더 > L3:journal-remind
### L2: 리마인더 > L3: doc-expiry
- [ ] WI-135-feat 서류 만료 알림 /api/cron/doc-expiry | L1:Cron > L2:리마인더 > L3:doc-expiry

### L2: 동기화 > L3: schedule-sync
- [ ] WI-136-feat Google Calendar 동기화 /api/cron/schedule-sync | L1:Cron > L2:동기화 > L3:schedule-sync

### L2: AI > L3: crawler
- [ ] WI-137-feat 크롤러 실행 /api/cron/crawler-execute | L1:Cron > L2:AI > L3:crawler
### L2: AI > L3: matching
- [ ] WI-138-feat 매칭 갱신 /api/cron/matching-refresh | L1:Cron > L2:AI > L3:matching
### L2: AI > L3: embedding
- [ ] WI-139-feat 임베딩 생성 /api/cron/embedding-generate | L1:Cron > L2:AI > L3:embedding
### L2: AI > L3: daily-digest
- [ ] WI-140-feat 일일 요약 메일 /api/cron/daily-digest | L1:Cron > L2:AI > L3:daily-digest

---

## L1: Phase 17 — 기능 연결 Gap Fix (2026-04-21 추가)
## Gap 감사 결과 "엔진/API는 있으나 UI·배선 누락"으로 판정된 항목을 E2E 동작까지 연결

### L2: 사업계획서 생성 > L3: RAG 초안 실제 연결
- [ ] WI-201-feat rag-draft.ts Mock 제거 + pgvector searchClientDocuments/searchPastPlans 실구현 | L1:Phase17 > L2:BizPlan > L3:Engine A
- [ ] WI-202-feat /api/business-plans POST (Engine A→B→Verification 파이프라인) + AiJob 생성 | L1:Phase17 > L2:BizPlan > L3:API
- [ ] WI-203-feat 사업계획서 생성 마법사 UI (프로젝트 상세 → "사업계획서 생성" 버튼) | L1:Phase17 > L2:BizPlan > L3:UI
- [ ] WI-204-feat /api/documents/[id]/verify + 평가 결과 패널 UI | L1:Phase17 > L2:BizPlan > L3:Verify UI

### L2: 사업계획서 생성 > L3: 평가/Gap 로직 심화
- [ ] WI-205-feat evaluation/engine.ts 채점 로직 완성 (키워드+길이+구조 매칭, A-F 등급) | L1:Phase17 > L2:BizPlan > L3:Evaluation
- [ ] WI-206-feat diagnosis/gap-analyzer.ts category별 severity 계산 + GapItem[] 생성 | L1:Phase17 > L2:BizPlan > L3:GapEngine
- [ ] WI-207-feat Client 상세에 "Gap 분석 보기" 진입점 + 진단 결과 렌더링 | L1:Phase17 > L2:BizPlan > L3:Gap UI

### L2: HWPX 편집 > L3: 양식 채우기 배선
- [ ] WI-208-feat /api/hwpx/edit POST (템플릿 ID + HwpxEdit[] → DOCX 저장) | L1:Phase17 > L2:HWPX > L3:API
- [ ] WI-209-feat HWPX 템플릿 관리 Admin (업로드 + 필드 매핑 정의) | L1:Phase17 > L2:HWPX > L3:Admin
- [ ] WI-210-feat rhwp 채택 여부 재평가 훅 (v1.0+ 대비 adapter 인터페이스 분리) | L1:Phase17 > L2:HWPX > L3:rhwp-adapter

### L2: 크롤러 > L3: DB 저장 완결
- [ ] WI-211-feat crawler-execute cron → ProgramInfo upsert (기업마당 API) | L1:Phase17 > L2:Crawler > L3:DB Save
- [ ] WI-212-feat crawler-execute cron → ProgramInfo upsert (K-Startup API) | L1:Phase17 > L2:Crawler > L3:DB Save
- [ ] WI-213-feat 크롤링 이력 AutomationLog 기록 + 실패 재시도 | L1:Phase17 > L2:Crawler > L3:Resilience
- [x] WI-214-chore 레거시 Playwright BizinfoSource 제거 (프로덕션 crawler는 공공 API 사용 — Playwright 경로 dead code) | L1:Phase17 > L2:Crawler > L3:Cleanup

### L2: 고객사 서류 요청 > L3: UI/메뉴 노출
- [ ] WI-215-feat Client 상세에 "서류 요청" 탭 추가 (체크리스트 기반 + 포털 토큰 UI 통합) | L1:Phase17 > L2:Client > L3:서류요청
- [ ] WI-216-feat 포털 토큰 생성 UI를 Client/Project 양쪽 진입 가능하게 일원화 | L1:Phase17 > L2:Client > L3:포털통합
- [ ] WI-217-feat 온보딩 체크리스트 발송 UI (Client 상세 → "온보딩 시작") | L1:Phase17 > L2:Client > L3:온보딩 UI
- [ ] WI-218-feat masterProfile 편집/확인 Client 상세 탭 | L1:Phase17 > L2:Client > L3:masterProfile
- [ ] WI-219-feat Client 생성 시 businessNumber 자동 검증 훅 (fire-and-forget) | L1:Phase17 > L2:Client > L3:자동검증
- [ ] WI-220-feat ChecklistTemplate Admin 관리 UI (플랫폼/조직) | L1:Phase17 > L2:Client > L3:Template Admin

### L2: AiJob Dispatcher > L3: 10 Type 핸들러
- [ ] WI-221-feat AiJob dispatcher 추상화 (type → handler 매핑) | L1:Phase17 > L2:AI > L3:Dispatcher
- [ ] WI-222-feat 10개 AiJobType 각 핸들러 (BUSINESS_PLAN/RESEARCH/OCR/TRANSCRIBE/SUMMARY/JOURNAL_DRAFT/FINANCIAL_ANALYSIS/GAP_DIAGNOSIS/EVALUATION/MATCHING) | L1:Phase17 > L2:AI > L3:Handlers

### L2: SkillPattern > L3: 학습 루프 완결
- [ ] WI-223-feat SkillPattern 10회 성공 → 파인튜닝 후보 표시 Admin UI | L1:Phase17 > L2:AI > L3:SkillPattern UI
- [ ] WI-224-feat Unsloth 파인튜닝 트리거 + LOCAL_MLX 승격 상태 머신 (markAsFineTuned 실제 연결) | L1:Phase17 > L2:AI > L3:FineTune

### L2: Trigger Map > L3: 14 이벤트 전부 emit
- [ ] WI-225-feat MEETING_SCHEDULED/JOURNAL_DUE/ACTION_ITEM_*/PORTAL_COMPLETE/HANDOFF 등 12개 emit 지점 배선 | L1:Phase17 > L2:Notification > L3:Emit 완결

### L2: Web Push > L3: Service Worker
- [ ] WI-226-feat public/service-worker.js + 클라이언트 구독 훅 + push subscription DB 저장 | L1:Phase17 > L2:Push > L3:SW

### L2: 재무 > L3: DART + AI 분석
- [ ] WI-227-feat DART OpenAPI 실호출 + ClientFinancial 자동 수집 | L1:Phase17 > L2:Finance > L3:DART
- [ ] WI-228-feat buildAnalysisStub → AI 분석(AiJob FINANCIAL_ANALYSIS) 실연결 + DOCX FinancialReport | L1:Phase17 > L2:Finance > L3:AI Report

---

## L1: Phase 18 — 인증 업무 자동화 (2026-04-21 추가)
## 설계 4.3 BUNDLE 워크플로우의 하위 인증별 자동화 (스펙에 명시됐으나 scope out된 항목)

### L2: 벤처기업 인증 > L3: 기술성평가서 자동화
- [ ] WI-301-feat 벤처 기술성평가서 HWPX 템플릿 등록 + 필드 맵(기업정보/기술내용/재무/실적) | L1:Phase18 > L2:Venture > L3:Template
- [ ] WI-302-feat Client masterProfile + ClientFinancial → 기술성평가서 자동 채우기 파이프라인 | L1:Phase18 > L2:Venture > L3:Autofill
- [ ] WI-303-feat VENTURE_CERT 프로젝트 상세에 "기술성평가서 생성" 버튼 + 미리보기 | L1:Phase18 > L2:Venture > L3:UI
- [ ] WI-304-feat 벤처 체크리스트 템플릿 seed (연구개발비/인력/매출 기준 증빙 12종) | L1:Phase18 > L2:Venture > L3:Checklist

### L2: 소부장 인증 > L3: 기술자립도 평가
- [ ] WI-305-feat SOBOOJANG_CERT 프로젝트 타입 schema 확정 (enum 정비) + 한글 라벨 통일 | L1:Phase18 > L2:SOBOOJANG > L3:Schema
- [ ] WI-306-feat 소부장 품목 마스터 데이터 seed (산업부 고시 품목) + Client 품목 매핑 | L1:Phase18 > L2:SOBOOJANG > L3:Data
- [ ] WI-307-feat 기술자립도 평가 엔진 (품목별 해외의존도/국산화율 AI 분석) | L1:Phase18 > L2:SOBOOJANG > L3:Engine
- [ ] WI-308-feat 소부장 신청서 HWPX 템플릿 + 자동 채우기 + 증빙 체크리스트 | L1:Phase18 > L2:SOBOOJANG > L3:Doc

### L2: 기업부설연구소 > L3: 설립/인정 자동화
- [ ] WI-309-feat 연구소 연구원 증빙 체크리스트 템플릿 seed (학위/경력/4대보험) | L1:Phase18 > L2:Institute > L3:Checklist
- [ ] WI-310-feat 연구시설 증빙 수집 UI (도면/사진/임대차계약 업로드) | L1:Phase18 > L2:Institute > L3:Facility
- [ ] WI-311-feat KOITA 신고서 HWPX 템플릿 + 자동 채우기 (masterProfile + 연구원 목록) | L1:Phase18 > L2:Institute > L3:KOITA Doc
- [ ] WI-312-feat 연구소 설립 후 연구일지 관리 자동 연결 (Journal 모듈 트리거) | L1:Phase18 > L2:Institute > L3:Journal Link

### L2: 특허 > L3: 선행기술 조사 + 명세서
- [ ] WI-313-feat KIPRIS 선행기술 API 연동 + AI 요약 (CLI_CLAUDE) | L1:Phase18 > L2:Patent > L3:PriorArt
- [ ] WI-314-feat 특허 명세서 초안 생성 API + UI (patent-draft.ts 배선) | L1:Phase18 > L2:Patent > L3:Draft
- [ ] WI-315-feat 발명신고서/직무발명 체크리스트 템플릿 seed | L1:Phase18 > L2:Patent > L3:Checklist

### L2: 포털 자동 등록 > L3: Desktop Playwright (Phase 15 확장)
- [ ] WI-316-feat VENTUREIN 로그인 + 신청 접수 Playwright 실구현 (page-object 스텁 제거) | L1:Phase18 > L2:Portal > L3:VENTUREIN
- [ ] WI-317-feat KOITA 로그인 + 신고서 제출 Playwright 실구현 | L1:Phase18 > L2:Portal > L3:KOITA
- [ ] WI-318-feat 홈택스 납세증명/사업자등록증 발급 Playwright 실구현 | L1:Phase18 > L2:Portal > L3:Hometax
- [ ] WI-319-feat 민원24 각종 증명서 발급 Playwright 실구현 | L1:Phase18 > L2:Portal > L3:Minwon24
- [ ] WI-320-feat 4대보험 가입자 명부/납부확인 Playwright 실구현 | L1:Phase18 > L2:Portal > L3:Insurance
- [ ] WI-321-feat PKCS#12 공인인증서 실제 비밀번호 검증 + 서명 (node-forge) | L1:Phase18 > L2:Portal > L3:PKCS12

### L2: BUNDLE 워크플로우 > L3: 통합 진행 관리
- [ ] WI-322-feat BUNDLE 하위 프로젝트 진행률 롤업 대시보드 (벤처+연구소+특허 한 화면) | L1:Phase18 > L2:Bundle > L3:Dashboard
- [ ] WI-323-feat BUNDLE 공통 서류 1회 수집 → 하위 프로젝트 자동 공유 | L1:Phase18 > L2:Bundle > L3:SharedDocs
- [ ] WI-324-feat BUNDLE 완료 트리거 (하위 전체 COMPLETED 시 자동 상태 전이 + 알림) | L1:Phase18 > L2:Bundle > L3:Complete

### L2: 인증서 관리 > L3: 기존 Certificate 모듈 통합
- [ ] WI-325-feat 인증 완료 시 Certificate 레코드 자동 생성 (VENTURE/RESEARCH_INSTITUTE/PATENT/INNOBIZ 등) | L1:Phase18 > L2:CertReg > L3:AutoCreate
- [ ] WI-326-feat 인증 만료 추적 + 갱신 프로젝트 자동 제안 (90일 전 알림) | L1:Phase18 > L2:CertReg > L3:Renewal
