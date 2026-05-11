# Sprint Contract — WI-625-feat Pack E 모듈 메타데이터 (4 modules)

## 계약 상태
- [x] 리드 초안 작성 (2026-05-11)
- [x] 자율 루프 진입 승인 (사용자, 2026-05-11)

## 배경
Pack E 콘텐츠 (4 modules). WI-611(image-engine orchestrator) 보강 연계.
상세: `wireframes/packs/E-content.html`.

## 수용 기준
- [ ] 1. `apps/web/src/modules/pack-e-content/` 디렉토리
- [ ] 2. `pack.config.ts`: `{ id:"E", label:"콘텐츠", modules:[4 ids], pricing:{monthly:59000, perUnit:"credits"} }`
- [ ] 3. 4개 `module.config.ts`:
  - image-generation (pbc:["image-engine"], route:"/create")
  - block-builder (pbc:["block-builder"], route:"/builder")
  - presets (deps:hard:["image-generation"], pbc:["image-engine"])
  - comfyui-workflows (admin:true, deps:hard:["image-generation"])
- [ ] 4. multiOrg는 모두 false — 콘텐츠는 Single-org 전용
- [ ] 5. `index.ts` + registry 등록
- [ ] 6. **WI-611과 연계**: image-generation 모듈의 사용처가 `generate()` API (orchestrator) — 즉 WI-611 머지 후 진입
- [ ] 7. 단위 테스트 `__tests__/pack-e.test.ts` — packE.modules.length === 4
- [ ] 8. `npx turbo lint build typecheck test --filter=web` 통과

## 산출물
- `apps/web/src/modules/pack-e-content/{pack.config.ts, index.ts, 4×module.config.ts}`
- `apps/web/__tests__/pack-e.test.ts`
- `apps/web/src/modules/registry.ts` 갱신

## 제약
- WI-611 머지 후 진행
- multiOrg:false 유지 (Pack E는 Single-org만)

## 평가 기준 유형
type: code
