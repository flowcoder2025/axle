# Decisions Log

## 2026-04-10: API 뮤테이션 방식 — fetch() over Server Actions
- **선택**: API Route + fetch()
- **기각**: Next.js Server Actions
- **근거**: API Route가 범용적 (Desktop, agent-bridge 등 비-RSC 클라이언트도 호출 가능). Server Actions는 RSC 전용이라 확장성 제한. revalidatePath 대신 router.refresh() 사용.

## 2026-04-10: 사업자 검증 — 공공데이터 API over Popbill
- **선택**: 국세청 사업자등록 상태조회 API (data.go.kr, 무료)
- **기각**: Popbill (유료)
- **근거**: 사용자 요청. 동일 기능 무료 제공.
