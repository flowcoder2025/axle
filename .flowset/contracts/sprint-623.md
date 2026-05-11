# Sprint Contract — WI-623-feat Pack B 모듈 메타데이터 (6 modules)

## 계약 상태
- [x] 리드 초안 작성 (2026-05-11)
- [x] 자율 루프 진입 승인 (사용자, 2026-05-11)

## 배경
Pack B 정부 지원사업 + R&D (6 modules)의 module.config.ts. WI-622 패턴 그대로.
상세: `wireframes/packs/B-rd-support.html`, `wireframes/module-catalog.md` Pack B 섹션.

## 수용 기준
- [ ] 1. `apps/web/src/modules/pack-b-rd-support/` 디렉토리 생성
- [ ] 2. `pack.config.ts`: `{ id:"B", label:"정부 지원사업", modules:[6 ids], pricing:{monthly:39000} }`
- [ ] 3. 6개 `module.config.ts`:
  - programs (의존 X)
  - matching (deps: hard:["programs"], multiOrg: true, pbc:["matching"])
  - journals (multiOrg: true, pbc:["ai"])
  - hwpx-templates (admin:true, deps:soft:["documents"])
  - checklist-templates (admin:true, deps:hard:["programs"])
  - ai-patterns (admin:true, deps:hard:["matching"])
- [ ] 4. `index.ts` + registry 등록
- [ ] 5. route 필드 검증 (apps/web/src/app/(platform)/{programs,matching,journals,admin/hwpx,...}/ 존재)
- [ ] 6. 단위 테스트 `__tests__/pack-b.test.ts` — packB.modules.length === 6
- [ ] 7. `npx turbo lint build typecheck test --filter=web` 통과

## 검증 방법
1. `npx turbo build test --filter=web`
2. evaluator: packs/B-rd-support.html의 module.config.ts 예시와 정합

## 산출물
- `apps/web/src/modules/pack-b-rd-support/{pack.config.ts, index.ts, 6×module.config.ts}`
- `apps/web/__tests__/pack-b.test.ts`
- `apps/web/src/modules/registry.ts` 갱신

## 제약
- 페이지 신규 생성 금지
- ModuleConfig 변경 금지

## 평가 기준 유형
type: code
