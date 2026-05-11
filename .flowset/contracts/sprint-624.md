# Sprint Contract — WI-624-feat Pack D 모듈 메타데이터 (5 modules)

## 계약 상태
- [x] 리드 초안 작성 (2026-05-11)
- [x] 자율 루프 진입 승인 (사용자, 2026-05-11)

## 배경
Pack D HR (5 modules) module.config.ts. WI-621(flowteams 흡수) + WI-612(payroll service)와 연계.
상세: `wireframes/packs/D-hr.html`.

## 수용 기준
- [ ] 1. `apps/web/src/modules/pack-d-hr/` 디렉토리 생성
- [ ] 2. `pack.config.ts`: `{ id:"D", label:"HR", modules:[5 ids], pricing:{monthly:49000, perUnit:"employee"} }`
- [ ] 3. 5개 `module.config.ts`:
  - employees (multiOrg:true, pbc:["hr-payroll"])
  - payroll (deps:hard:["employees"], multiOrg:true, pbc:["hr-payroll"])
  - attendance (deps:hard:["employees"], multiOrg:true, pbc:["hr-payroll"])
  - leave (deps:hard:["employees"], multiOrg:true, pbc:["hr-payroll"])
  - nomu (multiOrg:true, pbc:["hr-payroll","ai"])
- [ ] 4. `index.ts` + registry 등록
- [ ] 5. **WI-621과 연계**: route 필드가 흡수된 페이지 경로(/payroll, /attendance, /leave, /nomu, /employees)와 일치
- [ ] 6. 단위 테스트 `__tests__/pack-d.test.ts` — packD.modules.length === 5
- [ ] 7. `npx turbo lint build typecheck test --filter=web` 통과

## 산출물
- `apps/web/src/modules/pack-d-hr/{pack.config.ts, index.ts, 5×module.config.ts}`
- `apps/web/__tests__/pack-d.test.ts`
- `apps/web/src/modules/registry.ts` 갱신

## 제약
- WI-621 머지 후 진행 (페이지 경로 의존)
- ModuleConfig 변경 금지

## 평가 기준 유형
type: code
