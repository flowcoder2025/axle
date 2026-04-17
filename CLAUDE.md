# AXLE

## 프로젝트 정보
- **이름**: AXLE
- **타입**: TypeScript (Turborepo + Next.js 16 + Prisma 7)
- **설명**: 컨설팅 자동화 플랫폼 — 정부 지원사업, 벤처/연구소 인증, 특허, 재무 컨설팅 업무 자동화

## 빌드/테스트
```bash
npm install          # 의존성 설치
npx turbo lint       # 린트
npx turbo build      # 빌드
npx turbo test       # 테스트
npx turbo typecheck  # 타입 체크
```

## 구조
```
packages/
  db/                   → Prisma 7 + pgvector (DB 패키지)
  auth/                 → Auth.js v5 Split Config + ReBAC
  ui/                   → shadcn/ui 공유 컴포넌트
apps/
  web/                  → Next.js 16 웹앱 → Vercel
docs/
  plans/                → Phase별 구현 계획서
  specs/                → 설계 문서
  L0-vision/            → 비전/목표
  L1-domain/            → 비즈니스 도메인
  L2-module/            → 기능 모듈
  L3-feature/           → 개별 기능
  L4-task/              → WI 단위 상세
.flowset/               → FlowSet 설정
.flowset/requirements.md → 사용자 원본 요구사항 (수정 금지)
.flowset/contracts/     → 팀 간 API 표준 + 데이터 흐름 계약
.flowset/ownership.json → 팀별 소유 디렉토리 매핑
.github/                → CI/CD 워크플로우
.claude/rules/          → 프로젝트 규칙 (자동 로드)
.claude/agents/         → Agent Teams 팀 역할 정의
.claude/memory/rag/     → RAG 참조 문서
```

## 핵심 규칙 (hook으로 강제 불가능한 판단 영역 — 반드시 숙지)
1. **requirements.md 수정 금지**: 사용자 원본 요구사항. 범위 축소 시 사용자 승인 필수.
2. **요구사항 충실 이행**: "나중에", "Phase 2로", "일단 빼고" 금지. 어려우면 확인을 구할 것.
3. **머지 확인 후 다음**: PR 머지 완료 → `git pull` → 다음 브랜치. 이전 PR 머지 전 다음 작업 금지.
4. **코드 숙지 먼저**: 수정 전 관련 파일 전문 읽기. 추측으로 구현 금지.
5. **영향도 평가**: 변경이 영향을 미치는 모든 파일/API/페이지 사전 파악.
6. **전수 조사**: 동일 패턴이 다른 곳에도 있는지 전수 검색. 부분 수정 금지.
7. **사이드이펙트 사전 분석**: 깨질 수 있는 기존 기능 미리 식별. 한쪽 고치면서 다른 쪽 깨지는 해결 금지.
8. **E2E = 브라우저 UI 조작**: `request.get/post`는 E2E가 아님. `page.goto → fill → click → 검증` 필수.
9. **Git 저자는 flowcoder25 고정**: 모든 커밋/PR 저자는 `flowcoder25 <flowcoder25@gmail.com>`. 다른 저자(예: `Jerome87hyunil`)는 Vercel 팀 `VIEWER_FOR_PLUS` 권한이라 Production 배포가 `TEAM_ACCESS_REQUIRED`로 block됨. PR 머지 시에도 저자 유지 필요 — `gh pr merge --squash --body` 전에 `git config user.name/email` 확인하고, squash 커밋 트레일러에 `Co-authored-by: flowcoder25 <flowcoder25@gmail.com>` 대신 **author 자체를 flowcoder25로** 설정할 것. 저자가 섞이면 라이브 prod가 5일 전 빌드에 고정되어 라우트 404가 발생한다.

## 자동 강제 (hook/validate/검증 에이전트 — 사람 개입 없이 동작)
- **검증 에이전트**: 소스 3파일+ 변경 시 자동 실행 — requirements.md vs 구현 대조, 누락/불완전 감지
- scope creep (10파일 초과) → validate 경고
- TODO/placeholder/stub → validate 경고
- .env/package-lock 수정 → validate 경고
- API 형식 미준수 → validate 경고
- RAG 미업데이트 → Stop hook 경고
- E2E API shortcut → Stop hook 경고
- requirements.md 수정 → validate 차단 + 자동 복원
- TDD 미수행 (TESTS_ADDED=0) → validate 경고
- GET/POST 수용 기준 미충족 → validate 경고
