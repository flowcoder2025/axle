# AXLE

컨설팅 자동화 플랫폼(정부 지원사업·벤처/연구소 인증·특허·재무) — Phase 19 Pack/Module 메타플랫폼(multi-org), Phase 20~21 AI ERP(영수증 OCR intake·거래처·계정과목·리포트)로 확장. TypeScript, Turborepo + Next.js 16 + Prisma 7(Supabase Postgres + pgvector). origin github.com/flowcoder2025/axle, `apps/web` → Vercel.

## 빌드/테스트
```bash
npm install          # 의존성 설치
npx prisma generate --schema=packages/db/prisma/schema.prisma  # typecheck 전 (CI와 동일 — 클라이언트 레이스, #201)
npx turbo lint       # 린트
npx turbo build      # 빌드
npx turbo test       # 테스트 (Vitest)
npx turbo typecheck  # 타입 체크
npm run test:e2e     # Playwright — 웹서버(기본 localhost:3000) 먼저 기동, 역할 계정 E2E_* env 8개(전부 또는 없음)
```
(10-04 미검증 — 로컬 미실행: Mini 체크아웃에 node_modules 없음. 명령은 package.json·ci.yml 기준)

## DB 스키마 변경
- WI-720(#197)부터 `prisma db push` 안 씀(db:push 스크립트 제거) → `npm run db:migrate -w @axle/db`로 `packages/db/prisma/migrations/`에 마이그레이션 생성. prod 적용은 GitHub Actions "DB Migrate (manual)"(dry_run 먼저, 실행은 사용자 확인). CI(e2e-write)가 migrations↔schema drift 차단. 상세 `packages/db/MIGRATIONS.md`.

## 구조 (비자명한 것만)
- `.flowset/requirements.md` → 사용자 원본 요구사항 (수정 금지)
- `.flowset/contracts/` 팀 간 API 표준·데이터 흐름 계약, `.flowset/ownership.json` 팀별 소유 디렉토리
- `.claude/memory/rag/` → RAG 참조 문서 (API·페이지·스키마 변경 시 갱신)
- `wireframes/` → 화면 설계, E2E `data-testid` 출처
- `docs/L0-vision`~`docs/L4-task` 요구사항 계층, `docs/plans`·`docs/specs` Phase별 계획·설계

## 핵심 규칙 (hook으로 강제 불가능한 판단 영역 — 반드시 숙지)
1. **requirements.md 수정 금지**: 사용자 원본 요구사항. 범위 축소 시 사용자 승인 필수.
2. **요구사항 충실 이행**: "나중에", "Phase 2로", "일단 빼고" 금지. 어려우면 확인을 구할 것.
3. **머지 확인 후 다음**: PR 머지 완료 → `git pull` → 다음 브랜치. 이전 PR 머지 전 다음 작업 금지.
4. **코드 숙지 먼저**: 수정 전 관련 파일 전문 읽기. 추측으로 구현 금지.
5. **영향도 평가**: 변경이 영향을 미치는 모든 파일/API/페이지 사전 파악.
6. **전수 조사**: 동일 패턴이 다른 곳에도 있는지 전수 검색. 부분 수정 금지.
7. **사이드이펙트 사전 분석**: 깨질 수 있는 기존 기능 미리 식별. 한쪽 고치면서 다른 쪽 깨지는 해결 금지.
8. **E2E = 브라우저 UI 조작**: `request.get()`·`request.post()`는 E2E가 아님(seed 준비에서만 허용). `page.goto → fill → click → 검증` 필수.
9. **Git 저자는 flowcoder25 고정**: 모든 커밋/PR 저자는 `flowcoder25 <flowcoder25@gmail.com>`. 다른 저자(Jerome87hyunil = Vercel 팀 `VIEWER_FOR_PLUS`)면 Production 배포가 `TEAM_ACCESS_REQUIRED`로 막혀 prod가 옛 빌드에 고정된다(신규 라우트 404). squash 머지 저자는 로컬 git user가 아니라 **`gh` 활성 계정** — 머지 전 `git config user.email`과 `gh auth status`(Active = flowcoder25) 둘 다 확인. CI commit-check.yml 이 PR 단계에서 저자 검사. 원인·교정 절차 `.claude/rules/project.md`.

## 자동 강제 (경고·차단 — 운영 규칙 `.claude/rules/flowset-operations.md`)
- 대화형 hook(`.claude/settings.json`): Edit/Write 전 소유권·팀간 영향 검사(TEAM_NAME 설정 시). Stop 시 RAG 미업데이트·E2E API shortcut·requirements.md 수정 감지 + 검증 에이전트(소스 3파일+ 변경 시 requirements.md vs 구현 대조).
- 루프 전용(`flowset.sh`, 비대화형 워커): 커밋 형식, scope creep(10파일 초과), .env/package-lock 수정, TODO/placeholder/stub, API 형식, WI 수용 기준 키워드 매칭, TESTS_ADDED=0 경고, requirements.md 수정 시 위반 + 자동 복원.
- git hook(commit-msg·pre-push) 원본은 추적 파일 `.flowset/hooks/`. repo-local `core.hooksPath` 는 git 설정이라 클론마다 `git config core.hooksPath .flowset/hooks` 를 직접 넣어야 한다(10-05 이 체크아웃 설정 — 그 전엔 포터블 클론 `/Volumes/포터블/AXLE/.git/hooks` 를 가리켜 미마운트 시 조용히 안 돌았다). 백스톱은 CI commit-check.
