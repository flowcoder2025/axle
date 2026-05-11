# Sprint Contract — WI-626-feat Pack G 모듈 메타데이터 (3 modules, Desktop Add-on)

## 계약 상태
- [x] 리드 초안 작성 (2026-05-11)
- [x] 자율 루프 진입 승인 (사용자, 2026-05-11)

## 배경
Pack G Desktop Add-on (3 modules) module.config.ts. Electron(apps/desktop) IPC 의존.
상세: `wireframes/packs/G-desktop.html`.

## 수용 기준
- [ ] 1. `apps/web/src/modules/pack-g-desktop/` 디렉토리
- [ ] 2. `pack.config.ts`: `{ id:"G", label:"Desktop", modules:[3 ids], pricing:{monthly:29000} }`
- [ ] 3. 3개 `module.config.ts`:
  - portal-automation (requiresDesktop:true, route:"/automation", pbc:["crawler"], integrations:["hometax","minwon24","insurance","venturein","koita"])
  - cert-management (requiresDesktop:true, route:"/certs")
  - voice-recording (requiresDesktop:true, route:"/recording", deps:soft:["meetings"])
- [ ] 4. multiOrg는 모두 false
- [ ] 5. `index.ts` + registry 등록
- [ ] 6. **Desktop 미감지 시 처리**: `requiresDesktop:true` 모듈은 Electron 환경 아닐 때 사이드바에 회색 + "Desktop 앱 필요" 안내 (UI는 WI-618 buildSidebar에서 처리, 본 WI는 meta만)
- [ ] 7. 단위 테스트 `__tests__/pack-g.test.ts` — packG.modules.length === 3 + requiresDesktop 모두 true
- [ ] 8. `npx turbo lint build typecheck test --filter=web` 통과

## 산출물
- `apps/web/src/modules/pack-g-desktop/{pack.config.ts, index.ts, 3×module.config.ts}`
- `apps/web/__tests__/pack-g.test.ts`
- `apps/web/src/modules/registry.ts` 갱신

## 제약
- 새 IPC 채널 추가 금지 (기존 apps/desktop IPC만 활용)
- Electron 자체 변경 금지 — 메타데이터만

## 평가 기준 유형
type: code
