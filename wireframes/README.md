# AXLE 메타플랫폼 — 와이어프레임 (v2: 단일 플랫폼 + 모듈)

> **작성일**: 2026-05-11
> **버전 노트**: v1은 "6개 별도 앱" 모델이었으나 **v2부터 단일 플랫폼 + 모듈 install/uninstall** 모델로 정정.
> **모델**: Odoo-style — 조직 관리자가 사용 모듈을 선택, 사용자는 권한 내에서 자유 사용.

---

## 핵심 한 줄

> **AXLE은 1개 플랫폼이고, 사용자는 필요한 기능만 모듈로 install해서 쓴다.**
> 컨설팅 / HR / 콘텐츠 / ERP / 리터치 = 별도 앱이 아니라 같은 플랫폼의 모듈.

---

## 보는 순서

1. **[module-catalog.md](./module-catalog.md)** — 모듈 정의 + Odoo-style install 흐름
2. **[architecture.md](./architecture.md)** — 4-Layer + 모듈 ⊃ PBC 매트릭스
3. **[sitemap.md](./sitemap.md)** — 단일 플랫폼 라우트 트리
4. **[pbc-usage.md](./pbc-usage.md)** — PBC × 모듈 매핑
5. **HTML 와이어프레임** (브라우저로 열기):
   - [shared/shell.html](./shared/shell.html) — 모듈-aware 사이드바
   - [platform/dashboard.html](./platform/dashboard.html) — 통합 대시보드
   - [platform/module-catalog.html](./platform/module-catalog.html) — install/uninstall UI
   - 모듈별:
     - [modules/consulting.html](./modules/consulting.html) — M1 컨설팅
     - [modules/hr.html](./modules/hr.html) — M2 HR (★ WI-612 + flowteams 흡수)
     - [modules/content.html](./modules/content.html) — M3 콘텐츠 (★ WI-611)
     - [modules/erp.html](./modules/erp.html) — M4 ERP (1년 후)
     - [modules/retouch.html](./modules/retouch.html) — M5 리터치 (1년 후)
   - 동반 앱 (별도 배포):
     - [companion/desktop.html](./companion/desktop.html) — Electron 클라이언트
     - [companion/agent-bridge.html](./companion/agent-bridge.html) — AI 백그라운드 서비스

브라우저로 열기:
```bash
open wireframes/README.md
open wireframes/shared/shell.html
open wireframes/platform/dashboard.html
open wireframes/platform/module-catalog.html
```

---

## v1 → v2 핵심 변경

| 항목 | v1 (잘못된 이해) | v2 (정정) |
|---|---|---|
| 진입점 | 6개 별도 도메인 | 1개 axle.io |
| 로그인 | 각 앱마다 | 1회 |
| 사이드바 | 앱마다 다름 | 활성 모듈에 따라 동적 |
| FlowStudio/FlowVue/FlowRetouch | apps/* 신규 생성 | 모듈로 흡수 (apps 생성 안 함) |
| FlowTeams | apps/flowteams 별도 | src/modules/hr/로 흡수 |
| PBC | 앱 간 공유 라이브러리 | 모듈의 구현체 |
| 결제 | 앱 단위 | 모듈 단위 (subscription) |
| 권한 | 앱별 ReBAC | 모듈 × scope ReBAC |
| 배포 | 6개 도메인 분리 | 1개 도메인 (apps/web) |

---

## WI-611~615의 의미 (v2 기준)

| WI | v2에서 의미 | 상태 |
|---|---|---|
| WI-611 | image-engine `generate()`/`getEstimatedCost()` — 콘텐츠 모듈의 핵심 의존 | 유지 (PBC 자체 기능, 모델 변경 무관) |
| WI-612 | hr-payroll `createPayrollService` 팩토리 — HR 모듈의 핵심 의존 | 유지 |
| WI-613 | core-design-md — 모듈별 theme 갈아끼움 가능하게 | 유지 |
| WI-614 (이전: showcase 데모) | **재정의 필요** — 데모가 아니라 모듈 시스템 자체 구축 | 재정의 |
| WI-615 (이전: flowteams shell) | **재정의 필요** — flowteams 흡수 + 모듈 디렉토리 분리 | 재정의 |

추가 신규 WI 후보:
- **WI-616-feat 모듈 레지스트리** (module.config.ts schema + module-registry.ts)
- **WI-617-feat 모듈 카탈로그 UI** (/settings/modules)
- **WI-618-feat 동적 사이드바** (활성 모듈 기반 nav 빌더)
- **WI-619-feat 모듈 권한 (ReBAC scope)** (consulting:* / hr:* / content:* 등)
- **WI-620-refactor apps/flowteams → src/modules/hr 마이그레이션** (이전 WI-615 대체)

---

## 디렉토리

```
wireframes/
├── README.md                ← 이 파일
├── module-catalog.md        모듈 정의 + install 흐름
├── architecture.md          4-Layer + 모듈 ⊃ PBC 매트릭스
├── sitemap.md               단일 플랫폼 라우트 (재작성)
├── pbc-usage.md             PBC × 모듈 매핑 (재작성)
├── shared/
│   ├── design-tokens.css    FlowCoder default theme
│   └── shell.html           모듈-aware 사이드바 (★ 재작성)
├── platform/
│   ├── dashboard.html       통합 대시보드
│   └── module-catalog.html  install/uninstall UI
├── modules/
│   ├── consulting.html      M1
│   ├── hr.html              M2 (★ WI-612 + 흡수)
│   ├── content.html         M3 (★ WI-611)
│   ├── erp.html             M4 (1년 후)
│   └── retouch.html         M5 (1년 후)
└── companion/
    ├── desktop.html         Electron 클라이언트 (별도 앱)
    └── agent-bridge.html    HTTP 서비스 (별도 앱)
```

---

## 다음 단계

1. **PRD 수정**: `docs/specs/meta-platform/PRD.md`를 모듈 모델로 재작성
2. **WI 재정의**: WI-614/615 취소 또는 재정의, WI-616~620 추가
3. **Sprint contract**: 새 WI들의 계약 작성
4. **`flowset.sh` 가동**: 별도 터미널
