# AXLE - Project Rules

이 파일은 글로벌 규칙(~/.claude/rules/wi-*.md)을 상속하며, 프로젝트 고유 규칙만 추가합니다.
**글로벌 규칙과 충돌 시 글로벌 규칙이 우선합니다.**

## 프로젝트 정보
- **이름**: AXLE
- **타입**: TypeScript (Turborepo + Next.js 16 + Prisma 7)

## 프로젝트 규칙 체크리스트 (필수)
작업 시작 전 다음 항목 확인:
- [ ] **경계 분리**: 변경 전 "이 코드의 경계는 무엇인가?" 정의
- [ ] **모듈화**: 모듈 구조 준수 (공개 API + 내부 구현 분리)
- [ ] **캡슐화**: 공개 API만 외부 노출, 내부 구현 직접 import 금지
- [ ] **컴포넌트 재사용**: 2회 이상 반복 → 분리
- [ ] **하드코딩 금지**: 상수는 별도 파일로 분리
- [ ] **UTF-8**: 모든 파일 UTF-8 (BOM 없음)

## Code Quality Rules

### 컴포넌트 재사용
- 같은 UI/로직이 2번 이상 나오면 컴포넌트로 분리
- 기존 컴포넌트 확인 후 새로 만들기 (중복 생성 금지)

### 하드코딩 금지
- 문자열, 숫자, URL 직접 코드에 박지 않기
- 상수는 constants/ 또는 설정 파일로 분리
- 환경별 값은 환경변수 사용

### UTF-8 인코딩
- 모든 파일 UTF-8 (BOM 없음)
- 파일 읽기/쓰기 시 utf-8 명시

## 프로젝트 고유 규칙
- Turborepo 워크스페이스 구조 준수 (packages/, apps/)
- 패키지 간 의존성은 package.json workspace:* 프로토콜 사용
- Prisma 7 Client Engine + Driver Adapter 패턴 준수
- Auth.js v5 Split Config (Edge config + Node config 분리)
- Server Components 우선, Client Components는 최소화
- API Route는 Route Handler (app/api/) 사용, Pages API 금지
- Zod로 모든 API 입출력 스키마 검증

## 워크플로우
- `/wi:init` → `/wi:prd` → `/wi:env` → `/wi:start` → `/wi:status`

## CI/CD
- PR 생성 시 자동 실행: lint → build → test → commit-check
- 모든 체크 통과 필수
- 머지 후 브랜치 자동 삭제

## Git 저자 고정 (CRITICAL — Vercel 배포 차단 방지)
- **모든 커밋/PR 저자는 `flowcoder25 <flowcoder25@gmail.com>` 필수**
- Vercel 팀(flowcoder)에서 `Jerome87hyunil <hyunil8702@gmail.com>`은 `VIEWER_FOR_PLUS` 역할 → Production 배포 시 `TEAM_ACCESS_REQUIRED` 에러로 차단됨
- 저자가 다르면: live prod가 이전 성공 빌드에 고정 → 신규 라우트가 배포 안 돼 404 발생
- 작업 시작 전 반드시 확인: `git config user.name && git config user.email`
- 다르면 교정:
  ```bash
  git config user.name "flowcoder25"
  git config user.email "flowcoder25@gmail.com"
  ```
- **PR squash 머지 시 저자는 `gh auth` 활성 계정으로 찍힘** (local git user가 아님!) — PR #8~#21이 Jerome87hyunil로 찍힌 실제 원인. 해결: `gh auth status` → flowcoder25가 Active인지 확인. 아니면 `gh auth switch --user flowcoder25`
- 기존에 다른 저자로 머지된 commit이 main에 있으면 `git commit --amend --author` 또는 rebase로 재작성 필요 (push force는 팀 합의 후)

## RAG 컨텍스트
- 작업 시작 전 `.claude/rules/rag-context.md`의 주제-파일 매핑에 따라 관련 RAG 로드
- 작업 중 변경사항은 해당 RAG 파일에 즉시 반영
