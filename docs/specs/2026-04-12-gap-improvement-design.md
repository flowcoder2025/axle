# AXLE Gap Improvement Design

**Date**: 2026-04-12
**Scope**: Phase 5, 6, 7, 9-11, 12, Tier 3 미구현/부분구현 항목 전체 개선
**Approach**: Phase-grouped (B) — Phase 순서대로 완결

---

## 배경

2026-04-11 구현율 감사 결과, 17개 Phase 중 대부분이 85%+ 완성이나
일부 항목이 미구현/부분구현 상태. 2차 검증으로 실제 갭을 확인한 결과
총 15개 작업 항목이 도출됨.

### 1차→2차 검증 교훈

| 항목 | 1차 판단 | 2차 확인 |
|------|---------|---------|
| Phase 5 테스트 | 전무 | 7개 파일 모두 존재 |
| Program Deadline | 미구현 | API route에 인라인 구현됨 |
| Solapi | 미설치 | email 패키지에 REST API 구현 |
| Telegram/Discord | 미설치 | notification 패키지에 구현됨 |

**원인**: 계획 문서 파일 경로 매칭으로만 체크, 실제 기능 구현 여부 미확인

---

## Section 1: Phase 5 — AI Provider 추상화 + 검증

### 1-1. Provider Abstraction Layer

**현재 상태**:
- `claude.ts` — Anthropic SDK 직접 호출 (`complete()` 함수)
- `router.ts` — `resolveAiTier()` 가 AiTier enum만 반환
- Provider 패턴 없음

**신규 파일**:

```
packages/ai/src/providers/
├── types.ts          # AiProvider 인터페이스
├── anthropic.ts      # Anthropic Claude (기존 claude.ts 래핑)
├── local-mlx.ts      # Agent Bridge MLX 프록시 (HTTP 호출)
├── claude-cli.ts     # claude -p CLI (child_process)
└── index.ts          # Provider registry (tier → provider)
```

**AiProvider 인터페이스**:
```typescript
interface AiProvider {
  readonly tier: AiTier;
  isAvailable(): Promise<boolean>;
  complete(input: CompletionInput): Promise<CompletionResult>;
}

interface CompletionInput {
  system?: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
}

interface CompletionResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
}
```

**Provider Registry**:
```typescript
// providers/index.ts
const registry: Record<AiTier, AiProvider> = {
  API_HAIKU: new AnthropicProvider('claude-haiku-4-5-20251001'),
  API_OPUS: new AnthropicProvider('claude-opus-4-6'),
  CLI_CLAUDE: new ClaudeCliProvider(),
  LOCAL_MLX: new LocalMlxProvider(),
};

export function getProvider(tier: AiTier): AiProvider;
export async function getAvailableProvider(tier: AiTier): Promise<AiProvider>;
```

**router.ts 변경**:
- `resolveAiTier()` 유지 (하위 호환)
- `resolveProvider()` 추가 — AiTier 결정 후 Provider 인스턴스 반환

**claude.ts 변경**:
- `complete()` 유지하되 내부적으로 AnthropicProvider에 위임
- deprecated 주석 추가

### 1-2. Pre-Submission Verification

**신규 파일**:

```
packages/ai/src/verification/
├── types.ts              # VerificationRule, VerificationResult 타입
└── pre-submission.ts     # 사전 검증 로직
```

**VerificationRule 타입**:
```typescript
interface VerificationRule {
  id: string;
  name: string;
  description: string;
  check(document: DocumentData): VerificationIssue[];
}

interface VerificationResult {
  passed: boolean;
  score: number;          // 0-100
  issues: VerificationIssue[];
  recommendations: string[];
}

interface VerificationIssue {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  location?: string;
}
```

**검증 규칙**:
- 필수 섹션 존재 여부 (사업 개요, 시장 분석, 재무 계획 등)
- 섹션별 최소 글자수
- 첨부파일 필수 항목 누락
- 숫자/금액 일관성 (본문 vs 재무표)
- 맞춤법/형식 기본 체크

**테스트**: `__tests__/verification/pre-submission.test.ts` 추가

---

## Section 2: Phase 6 — DocGen 누락 모듈

### 2-1. text-parser.ts

**경로**: `packages/docgen/src/converters/text-parser.ts`

**인터페이스**:
```typescript
interface ParseResult {
  text: string;
  metadata: {
    title?: string;
    author?: string;
    pageCount?: number;
    fileType: 'pdf' | 'hwpx' | 'hwp' | 'docx';
  };
}

export function extractText(buffer: Buffer, fileType: string): Promise<ParseResult>;
```

**구현 전략**:
- PDF: 기존 `pdf-to-markdown.ts`의 pdf-parse 재활용
- HWPX: JSZip 압축 해제 → section XML에서 텍스트 노드 추출
- HWP: 바이너리 포맷 — 헤더/메타데이터 추출 + "HWP 바이너리는 HWPX 변환 후 처리 권장" 안내
- DOCX: JSZip → word/document.xml 파싱

**의존성**: `jszip` (이미 hwpx-editor에서 사용), `pdf-parse` (이미 설치)

### 2-2. image-generator.ts

**경로**: `packages/docgen/src/generators/image-generator.ts`

**인터페이스**:
```typescript
interface ImageGenerateOptions {
  width?: number;
  height?: number;
  style?: 'infographic' | 'diagram' | 'illustration';
}

export function generateImage(
  prompt: string,
  options?: ImageGenerateOptions
): Promise<{ buffer: Buffer; mimeType: string }>;
```

**구현**: Google Gemini `gemini-2.0-flash-exp` 이미지 생성 API
- `@google/generative-ai` (이미 설치됨)
- 환경변수: `GOOGLE_GENERATIVE_AI_API_KEY` (이미 사용 중)
- 실패 시 빈 결과 + 경고 (non-fatal)

### 2-3. mermaid-to-png.ts

**경로**: `packages/docgen/src/converters/mermaid-to-png.ts`

**인터페이스**:
```typescript
interface MermaidOptions {
  width?: number;
  height?: number;
  theme?: 'default' | 'dark' | 'forest';
  backgroundColor?: string;
}

export function convertMermaid(
  mermaidCode: string,
  options?: MermaidOptions
): Promise<Buffer>;
```

**구현**: `@mermaid-js/mermaid-cli` (mmdc) CLI 호출
- 임시 파일에 mermaid 코드 작성 → mmdc 실행 → PNG 읽기 → 임시 파일 삭제
- 의존성 추가: `@mermaid-js/mermaid-cli` (devDependency)

**테스트**: 3개 파일 추가
- `__tests__/converters/text-parser.test.ts`
- `__tests__/generators/image-generator.test.ts`
- `__tests__/converters/mermaid-to-png.test.ts`

---

## Section 3: Phase 7 — Calendar 서비스 레이어 추출

### 리팩토링 (신규 기능 아님)

**현재**: API route에 비즈니스 로직 인라인
**목표**: 서비스 파일로 추출, API route는 thin controller

### 3-1. schedule-service.ts

**경로**: `apps/web/lib/services/schedule-service.ts`

```typescript
export function listSchedules(orgId: string, filters: ScheduleQueryInput): Promise<{ schedules: Schedule[]; total: number }>;
export function createSchedule(orgId: string, data: ScheduleCreateInput): Promise<Schedule>;
export function getSchedule(id: string, orgId: string): Promise<Schedule | null>;
export function updateSchedule(id: string, orgId: string, data: ScheduleUpdateInput): Promise<Schedule>;
export function deleteSchedule(id: string, orgId: string): Promise<void>;
```

**API route 변경**:
- `app/api/schedules/route.ts` — GET/POST에서 서비스 함수 호출
- `app/api/schedules/[scheduleId]/route.ts` — GET/PATCH/DELETE에서 서비스 함수 호출

### 3-2. program-deadline.ts

**경로**: `apps/web/lib/services/program-deadline.ts`

```typescript
export function createProgramWithDeadlines(orgId: string, data: ProgramCreateInput): Promise<ProgramInfo>;
export function syncDeadlines(programId: string, newEndDate: Date): Promise<void>;
export function deleteProgramWithDeadlines(programId: string): Promise<void>;
```

**핵심 로직** (기존 인라인에서 추출):
- 프로그램 생성 시 PROGRAM_DUE 타입 스케줄 자동 생성 (마감 30/14/7/3/1일 전)
- applicationEnd 변경 시 기존 스케줄 삭제 후 재생성
- 프로그램 삭제 시 관련 스케줄 cascade 삭제

**API route 변경**:
- `app/api/programs/route.ts` — POST에서 `createProgramWithDeadlines()` 호출
- `app/api/programs/[programId]/route.ts` — PATCH에서 `syncDeadlines()`, DELETE에서 `deleteProgramWithDeadlines()` 호출

**테스트**: 2개 파일 추가
- `__tests__/services/schedule-service.test.ts`
- `__tests__/services/program-deadline.test.ts`

---

## Section 4: Phase 9-11 — AI 호출 와이어링

### 전제: Phase 5 Provider 완성 후 진행

### 4-1. Meeting Transcription 요약

**수정 파일**: `apps/web/lib/services/meeting-summary.ts`

**현재**: `createAiJob()` 호출만 (Phase 14 TODO 주석)

**변경**:
```typescript
export async function generateSummary(meetingId: string): Promise<void> {
  const meeting = await getMeetingWithTranscript(meetingId);
  const job = await createAiJob({ type: 'SUMMARY', ... });

  try {
    const provider = await getAvailableProvider(resolveAiTier('SUMMARY'));
    const result = await provider.complete({
      system: MEETING_SUMMARY_PROMPT,
      prompt: meeting.transcript.rawText,
    });

    await updateMeetingSummary(meetingId, result.text);
    await updateJobStatus(job.id, 'COMPLETED', result);
  } catch (error) {
    await updateJobStatus(job.id, 'FAILED', { error: String(error) });
  }
}
```

**Whisper 음성→텍스트**: Agent Bridge에서 이미 구현됨 (`apps/agent-bridge/src/mlx/whisper.ts`). 웹앱에서는 텍스트→요약만 담당.

### 4-2. Journal AI Draft

**수정 파일**: `apps/web/lib/services/journal-draft.ts`

**현재**: `createAiJob()` 호출만 (Phase 14 TODO 주석)

**변경**: 위와 동일한 패턴
- Provider로 Claude 호출
- 프로젝트 정보 + 기간 컨텍스트로 연구일지 초안 생성
- Journal 필드 (content, activities, results 등) 업데이트

### 4-3. Financial AI Narrative (신규)

**신규 파일**:
- `apps/web/lib/services/financial-narrative.ts`
- `apps/web/app/api/analytics/narrative/route.ts`

**서비스**:
```typescript
export async function generateFinancialNarrative(
  clientId: string,
  year: number
): Promise<string> {
  const financial = await getClientFinancial(clientId, year);
  const ratios = calculateRatios(financial);

  const provider = await getAvailableProvider(resolveAiTier('EVALUATION'));
  const result = await provider.complete({
    system: FINANCIAL_ANALYSIS_PROMPT,
    prompt: JSON.stringify({ financial, ratios }),
  });

  return result.text;
}
```

**API Route**:
- POST `/api/analytics/narrative` — `{ clientId, year }` 입력 → 내러티브 텍스트 반환

**테스트**: 3개 파일 추가
- `__tests__/services/meeting-summary.test.ts` (수정)
- `__tests__/services/journal-draft.test.ts` (수정)
- `__tests__/services/financial-narrative.test.ts` (신규)

---

## Section 5: Phase 12 — Collaboration UI 컴포넌트

### 5-1. 멤버 관리 컴포넌트

**경로**: `apps/web/src/components/projects/`

**member-list.tsx**:
- 프로젝트 멤버 목록 (아바타 + 이름 + 역할 배지)
- 멤버별 제거 버튼 (LEADER만 가능)
- Props: `projectId`, `members`, `currentUserRole`

**add-member-dialog.tsx**:
- Dialog 기반 멤버 추가
- 조직 내 유저 검색 (debounced)
- 역할 선택 (MemberRoleSelect 사용)
- API: POST `/api/projects/[projectId]/members`

**member-role-select.tsx**:
- Select 컴포넌트 (LEADER, MEMBER, VIEWER)
- 한글 레이블 표시 (리더, 멤버, 뷰어)

### 5-2. 핸드오프 컴포넌트

**경로**: `apps/web/src/components/projects/`

**handoff-form.tsx**:
- 새 담당자 선택 (조직 내 유저 검색)
- 인수인계 사유 텍스트 입력
- 확인 다이얼로그 (되돌릴 수 없음 안내)
- API: POST `/api/projects/[projectId]/handoff`

**handoff-summary.tsx**:
- 인수인계 이력 카드 (이전 담당자 → 새 담당자, 일시, 사유)
- Activity feed에서 HANDOFF 타입 필터링

### 5-3. ProjectDetailTabs 확장

**수정 파일**: `apps/web/src/components/projects/project-detail-tabs.tsx`

**현재 탭**: overview, checklist (나머지 "추후 연동 예정")

**변경**: 기존 placeholder 제거, 실제 컴포넌트 연동

```typescript
const TABS = [
  { id: 'overview', label: '개요' },
  { id: 'checklist', label: '체크리스트' },
  { id: 'documents', label: '서류' },        // document-table 재사용
  { id: 'meetings', label: '미팅' },         // meeting-table 재사용
  { id: 'members', label: '팀원' },          // member-list + add-member-dialog
  { id: 'activity', label: '활동' },         // activity-feed 재사용
  { id: 'handoff', label: '인수인계' },      // handoff-form + handoff-summary
  { id: 'ai_jobs', label: 'AI 작업' },       // AiJob 목록 (간단 테이블)
] as const;
```

**데이터 페칭**: 각 탭은 lazy load (탭 선택 시 fetch)

---

## Section 6: Tier 3 — 버전 업그레이드

### 6-1. Next.js 15→16

- `apps/web/package.json`: `next` 버전 업데이트
- Breaking changes 확인 (릴리즈 노트 참조)
- 코드 수정 (필요시)
- 빌드 통과 확인

**조건**: Next.js 16 안정 릴리즈가 존재할 경우만 진행. 베타/RC면 스킵.

### 6-2. Prisma 6→7

- `packages/db/package.json`: `prisma`, `@prisma/client` 버전 업데이트
- Client Engine 모드 확인 (Prisma 7 기본값)
- `npx prisma generate` 실행
- 빌드 통과 확인

**조건**: Prisma 7 안정 릴리즈가 존재할 경우만 진행.

### 6-3. 최종 전체 검증

```bash
npx turbo lint       # 전체 린트
npx turbo typecheck  # 전체 타입체크
npx turbo build      # 전체 빌드
npx turbo test       # 전체 테스트
```

모든 체크 통과 필수. 실패 시 원인 수정 후 재검증.

---

## 작업 순서 (Phase-grouped)

| 순서 | Phase | 작업 | 예상 파일 수 |
|------|-------|------|------------|
| 1 | Phase 5 | Provider 추상화 + Pre-submission Verification | ~8 |
| 2 | Phase 6 | text-parser + image-generator + mermaid-to-png | ~6 |
| 3 | Phase 7 | schedule-service + program-deadline 추출 | ~6 |
| 4 | Phase 9-11 | AI 호출 와이어링 (meeting, journal, financial) | ~5 |
| 5 | Phase 12 | Member/Handoff UI + ProjectDetailTabs 확장 | ~7 |
| 6 | Tier 3 | 버전 업그레이드 + 전체 검증 | ~3 |
| **합계** | | | **~35** |

---

## 제외 항목

- Server Actions 전환: API Routes로 충분히 동작 중. 불필요한 리팩토링.
- E2E 테스트: 대화형 세션에서 별도 진행 (비대화형 워커 불가).
- Desktop/Agent Bridge 추가 기능: 이미 100%/93% 완성.
