# Data Flow Contract — AXLE

## SSOT 엔드포인트

| 모델 | SSOT API | HTTP |
|------|----------|------|
| Client | /api/clients | GET, POST, PATCH, DELETE |
| Contact | /api/clients/[clientId]/contacts | GET, POST, PATCH, DELETE |
| Certificate | /api/clients/[clientId]/certificates | GET, POST, DELETE |
| ClientFinancial | /api/clients/[clientId]/financials | GET, POST, PATCH |
| ClientAchievement | /api/clients/[clientId]/achievements | GET, POST, DELETE |
| Document | /api/documents | GET, POST, DELETE |
| ChecklistTemplate | /api/checklist-templates | GET, POST, PATCH, DELETE |
| Project | /api/projects | GET, POST, PATCH, DELETE |
| ProjectMember | /api/projects/[id]/members | GET, POST, PATCH, DELETE |
| Schedule | /api/schedules | GET, POST, PATCH, DELETE |
| ProgramInfo | /api/programs | GET, POST, PATCH |
| MatchingResult | /api/matching | POST (실행), GET (결과) |
| Meeting | /api/meetings | GET, POST, PATCH, DELETE |
| ActionItem | /api/meetings/[id]/actions | GET, POST, PATCH |
| ResearchJournal | /api/journals | GET, POST, PATCH |
| AiJob | /api/ai/jobs | GET, POST |
| Notification | /api/notifications | GET, PATCH |
| EmailLog | /api/email-logs | GET |
| AutomationLog | /api/automation-logs | GET |
| Estimate | /api/estimates | GET, POST, PATCH |
| Contract | /api/contracts | GET, POST, PATCH |
| FinancialReport | /api/clients/[id]/financial-reports | GET, POST |

## SSOT 규칙
1. 각 모델은 **하나의 SSOT API**만 가짐
2. 다른 페이지에서도 같은 API 호출 (중복 엔드포인트 금지)
3. 역할별 필터링은 API 내부에서 session.role 기반 처리
4. 프론트에서 데이터 복사/로컬 캐시 금지 — 항상 서버 조회

## 역할별 접근
| 역할 | 읽기 | 쓰기 |
|------|------|------|
| OWNER | 전체 | 전체 |
| ADMIN | 전체 | 전체 (Organization 설정 제외) |
| MEMBER | 배정된 프로젝트/고객사만 | 배정된 범위만 |
| Portal (토큰) | 해당 프로젝트만 | 서류 업로드 + 연구일지만 |
