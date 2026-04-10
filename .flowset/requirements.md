# 사용자 원본 요구사항 (수정 금지)
# 이 파일은 /wi:prd 확정 시 자동 생성됩니다.
# 에이전트가 이 파일을 수정하면 validate_post_iteration에서 위반으로 감지됩니다.

## 사용자 제약조건
- Turborepo monorepo 구조 (packages/ + apps/)
- Next.js 16 + Prisma 7 Client Engine + Supabase PostgreSQL
- Auth.js v5 Split Config + ReBAC 권한 시스템
- AI 3-Tier 라우팅 (LOCAL_MLX → API_HAIKU → API_OPUS/CLI_CLAUDE)
- 사업계획서 이중 엔진 (RAG 초안 + 정밀 편집)
- Desktop (Electron) 포털 자동화는 선택적
- Mac Mini agent-bridge 상시 가동

## 사용자 결정사항
- 기술 스택: TypeScript + Next.js 16 + Prisma 7 + Supabase (디자인 스펙 기반)
- 레포: flowcoder2025/axle (org, private)
- Phase 0~16 순차 구현 (Foundation → CRM → ... → Cron)
- 기존 프로젝트 75% 재사용 (FlowVue, FlowMate, FlowCoder_Dashboard, Program_Docs_Auto, FlowConnect, FlowSystem)

## 기능 요구사항 (L3 기준)

### Foundation (Phase 0)
- Turborepo Scaffold: 워크스페이스 구성 (packages/db, auth, ui, storage + apps/web)
- Prisma 스키마: 33+ 모델 4개 그룹으로 분할 (Auth/Org, CRM, Project/Document, AI/Communication)
- Meeting ↔ Client Prisma relation 포함
- ReBAC: check/grant/revoke 권한 시스템
- Auth.js v5: Edge/Node 분리, Prisma Adapter, 세션 캐시
- shadcn/ui: 공유 컴포넌트 패키지
- 웹앱: Next.js 16 앱 라우터, 인증 미들웨어, (settings) 라우트 그룹 스캐폴드

### CRM (Phase 1)
- Client CRUD: 고객사 관리, 사업자번호 검증, 파이프라인 칸반
- Contact CRUD: 인물 관리, 명함 OCR (Gemini Vision)
- 공공데이터 API: 국세청 사업자등록 상태조회 (사업자 검증, 무료)
- Client Onboarding: AI masterProfile/profileBlocks 자동 생성, 온보딩 체크리스트 발송
- Certificate CRUD: 인증서 등록/조회/만료 추적

### Documents (Phase 2)
- packages/storage: Supabase Storage 클라이언트, 버킷 구성, 이미지 처리, PDF 미리보기
- Document CRUD: @axle/storage 기반 파일 업로드/다운로드
- 토큰 업로드: 인증 없는 외부 업로드 링크
- OCR: Gemini Vision 문서 텍스트 추출
- 버전 관리: Document.version + parentDocId
- 체크리스트: ProjectType별 템플릿, 상태 관리
- 서류 만료: expiresAt 기반 추적

### Projects (Phase 3)
- Project CRUD: 8가지 타입, 상태 머신 (INTAKE → COMPLETED)
- BUNDLE: 하위 프로젝트 자동 생성 (벤처+연구소+특허, 소부장 선택)
- RESEARCH_TASK: 조사 항목 → AiJob(RESEARCH, CLI_CLAUDE) → 보고서 Document
- 팀 배정: ProjectMember (LEAD/MEMBER/VIEWER)
- 수수료 추적: FIXED/SUCCESS_RATE/MONTHLY

### Communication (Phase 4)
- 이메일: Resend + React Email 템플릿, 9가지 타입
- SMS/알림톡: Solapi 연동
- 이메일 수신거부: HMAC 토큰 + unsubscribe 엔드포인트
- EmailLog 조회: 고객사/프로젝트별 발송 이력 API
- 인앱 알림: 16가지 NotificationType (기존 13 + ACTION_ITEM_DUE, ESTIMATE_SENT, BUNDLE_COMPLETE)
- Web Push: Service Worker + web-push
- Telegram: 긴급 알림 전용
- Discord: 팀 채널 알림 (Webhook)
- Trigger Map: 14개 비즈니스 이벤트 → 채널 + 수신자 매핑
- Dispatcher: 이벤트 → 채널별 발송, 에러 격리

### AI Engine (Phase 5)
- 3-Tier 라우팅: AiJobType → AiTier 자동 결정
- AiJob: 10가지 타입, 상태 관리, cost/duration 추적
- RAG: OpenAI 임베딩 → pgvector 시맨틱 검색
- Gap 진단: Client 문서 vs ProgramInfo 요건 대조
- 평가 엔진: 사업계획서 자가 평가 + 개선안
- SkillPattern: 학습 루프 + 모니터링 UI
- SkillPattern: 10회 성공 → 파인튜닝 → LOCAL_MLX 승격

### DocGen (Phase 6)
- 사업계획서: RAG 초안 (Engine A) + 정밀 편집 (Engine B)
- 견적서/계약서: DOCX 생성
- HWPX: 한글 양식 자동 편집
- 연구일지 리포트: 월간 DOCX
- 특허 명세서: 선행기술 조사 + 초안
- 변환기: PDF→Markdown, Markdown→DOCX

### Calendar (Phase 7)
- Schedule CRUD: 4가지 타입, reminderDays
- Google Calendar: 양방향 동기화 + OAuth 설정 UI
- ProgramInfo CRUD: 지원사업 관리, 마감일 Schedule 자동 생성

### Matching (Phase 8)
- 크롤러: Playwright 지원사업 포털 스크래핑
- 셀프 리페어: 셀렉터 실패 → AI 자동 복구
- 3단계 매칭: 실격 필터 → 감점 → AI 점수화
- 매칭 피드백: isRelevant/feedbackNote

### Meetings (Phase 9)
- Meeting CRUD: 미팅 + 참석자 관리 (Meeting ↔ Client relation)
- 녹음/업로드: @axle/storage
- 전사: QStash Job Chain, mlx-whisper/API
- AI 요약: summary + keyDecisions + ActionItem 자동 추출
- ActionItem → Project 자동 생성: 액션 아이템에서 프로젝트 자동 생성 제안
- 요약 메일: 참석자 전체 자동 발송

### Journal (Phase 10)
- Journal CRUD: 연구일지 작성/관리
- 승인 워크플로우: DRAFT → SUBMITTED → APPROVED
- AI 초안: LOCAL_MLX 기반 연구일지 초안
- 월간 리포트: DOCX 자동 생성

### Finance (Phase 11)
- ClientFinancial CRUD: 연도별 재무 데이터
- DART OpenAPI: 상장사 재무 데이터 자동 수집 (AutomationLog DART_FETCH)
- AI 분석: 지표 분석 + 조정 컨설팅
- FinancialReport: DOCX 리포트
- Achievement: 특허/수상/계약/투자/인증 추적
- 대시보드: KPI + 재무 차트 (Recharts)

### Collaboration (Phase 12)
- 활동 타임라인: 프로젝트별 이력
- 핸드오프: 담당자 변경 → AI 요약 메일
- @멘션: 코멘트 멘션 → 알림
- 고객사 포털: 토큰 기반 서류 업로드 + 진행 상황
- 연구일지 포털: 연구원 직접 작성

### Estimates (Phase 13)
- Estimate CRUD: 견적서 + DOCX + 이메일
- Contract CRUD: 계약서 + 전자서명
- 견적 → 계약 전환: 자동 생성

### Agent Bridge (Phase 14)
- MLX Server: 자동 시작/종료 + 헬스체크
- OpenAI Proxy: MLX 래핑
- Claude CLI 브릿지: .claude-mq/ 파일 워처
- mlx-whisper: 로컬 음성 전사
- SkillPattern Collector: 패턴 수집
- Express Routes: API 서버
- launchd: 자동 시작

### Desktop (Phase 15)
- Electron: BrowserWindow + 트레이
- 네이티브 녹음: 시스템 마이크
- 인증서: PKCS#12 관리
- 포털 자동화: 홈택스/민원24/4대보험/VENTUREIN/KOITA
- 셀프 리페어: 포털 셀렉터 자동 복구
- AutomationLog API: 포털 자동화 이력 조회
- 오프라인 캐시: SQLite + 동기화

### Cron (Phase 16)
- doc-reminder: 서류 제출 리마인더
- deadline-alert: 지원사업 마감 알림
- journal-remind: 연구일지 리마인더
- doc-expiry: 서류 만료 알림
- schedule-sync: Google Calendar 동기화
- crawler-execute: 일일 크롤링
- matching-refresh: 매칭 결과 갱신
- embedding-generate: 문서 벡터 생성
- daily-digest: 일일 요약 메일
