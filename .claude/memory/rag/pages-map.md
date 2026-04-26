# Pages & API Map — AXLE

## Route Groups
| Route Group | 용도 | Phase |
|-------------|------|-------|
| (auth) | 로그인 | 0 |
| (app) | 인증된 앱 영역 | 0 |
| (settings) | 설정 | 0 |
| (portal) | 외부 고객 포털 | 12 |

## Pages (apps/web/src/app/)
| 경로 | 페이지 | Phase |
|------|--------|-------|
| /login | 로그인 | 0 |
| /dashboard | 대시보드 | 0 |
| /settings | 설정 | 0 |
| /clients | 고객사 목록 | 1 |
| /clients/[id] | 고객사 상세 | 1 |
| /documents | 서류 목록 | 2 |
| /projects | 프로젝트 목록 | 3 |
| /projects/[id] | 프로젝트 상세 | 3 |
| /calendar | 캘린더 | 7 |
| /programs | 지원사업 목록 | 7 |
| /matching | 매칭 결과 | 8 |
| /meetings | 미팅 목록 | 9 |
| /meetings/[id] | 미팅 상세 | 9 |
| /journals | 연구일지 목록 | 10 |
| /journals/[id] | 연구일지 상세 | 10 |
| /finance | 재무 대시보드 | 11 |
| /analytics | KPI 대시보드 | 11 |
| /estimates | 견적 목록 | 13 |
| /contracts | 계약 목록 | 13 |

## API Routes (apps/web/src/app/api/)
| 경로 | 용도 | Phase |
|------|------|-------|
| /api/auth/[...nextauth] | 인증 | 0 |
| /api/clients | Client CRUD | 1 |
| /api/clients/[id]/contacts | Contact CRUD | 1 |
| /api/clients/[id]/certificates | Certificate CRUD | 1 |
| /api/clients/[id]/portal-credentials | 포털 인증서/계정 목록 | 18 |
| /api/clients/[id]/portal-credentials/certificates | PFX 업로드/삭제 | 18 |
| /api/clients/[id]/portal-credentials/accounts | 포털 ID/PW CRUD | 18 |
| /api/scraper/jobs (GET) | 스크래퍼 작업 목록 (web UI) | 18 |
| /api/clients/[id]/financials | Financial CRUD | 11 |
| /api/clients/[id]/achievements | Achievement CRUD | 11 |
| /api/clients/[id]/financial-reports | Report 생성 | 11 |
| /api/documents | Document CRUD | 2 |
| /api/upload/[token] | 토큰 업로드 | 2 |
| /api/checklist-templates | 체크리스트 템플릿 | 2 |
| /api/projects | Project CRUD | 3 |
| /api/projects/[id]/members | Member CRUD | 3 |
| /api/notifications | Notification CRUD | 4 |
| /api/email-logs | EmailLog 조회 | 4 |
| /api/ai/jobs | AiJob CRUD | 5 |
| /api/schedules | Schedule CRUD | 7 |
| /api/programs | ProgramInfo CRUD | 7 |
| /api/matching | 매칭 실행/결과 | 8 |
| /api/meetings | Meeting CRUD | 9 |
| /api/meetings/[id]/actions | ActionItem CRUD | 9 |
| /api/journals | Journal CRUD | 10 |
| /api/estimates | Estimate CRUD | 13 |
| /api/contracts | Contract CRUD | 13 |
| /api/automation-logs | AutomationLog 조회 | 15 |
| /api/cron/* | 9개 크론 잡 | 16 |
