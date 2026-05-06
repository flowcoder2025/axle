# AXLE 메타플랫폼 — 와이어프레임

> **작성일**: 2026-05-07
> **목적**: AXLE이 메타플랫폼으로 발전하는 전체 그림을 한눈에 보기 위함.
> **범위**: 현존 4개 앱 + 1년 후 목표 3개 도메인 앱 + PBC × 앱 매트릭스.

---

## 보는 순서

1. **[architecture.md](./architecture.md)** — 4-Layer 아키텍처 + PBC × Apps 매트릭스
2. **[sitemap.md](./sitemap.md)** — 앱별 라우트 트리 (텍스트)
3. **[pbc-usage.md](./pbc-usage.md)** — PBC 공개 API와 누가 호출하는지
4. **[shared/shell.html](./shared/shell.html)** — 메타플랫폼 표준 shell (sidebar+topbar+main)
5. **앱별 시각 와이어프레임** (HTML, 브라우저로 열기):
   - [apps/web.html](./apps/web.html) — 컨설팅 자동화 (현존, 58 페이지)
   - [apps/flowteams.html](./apps/flowteams.html) — HR (현존, 5 페이지)
   - [apps/desktop.html](./apps/desktop.html) — Electron 클라이언트 (IPC + Tray)
   - [apps/agent-bridge.html](./apps/agent-bridge.html) — AI 서비스 (HTTP API)
   - [apps/flowstudio.html](./apps/flowstudio.html) ★ 미래 — 이미지 + 콘텐츠 빌더
   - [apps/flowvue.html](./apps/flowvue.html) ★ 미래 — ERP (재고/주문)
   - [apps/flowretouch.html](./apps/flowretouch.html) ★ 미래 — 리터치 전용

브라우저로 열기:
```bash
open wireframes/shared/shell.html
open wireframes/apps/web.html
# ... etc
```

---

## 한 문장 요약

> **AXLE은 컨설팅 자동화 SaaS 1개에서 출발했지만, 1년 안에 같은 모노레포 위에서 5~6개 도메인 SaaS가 돌아가는 메타플랫폼으로 발전한다.**
> Top 3 PBC(image-engine / block-builder / hr-payroll)가 중심축이고, DESIGN.md로 브랜드를 갈아끼우며, 각 앱은 thin shell이다.

---

## WI-611~615의 의미

audit 결과 (2026-05-07) 사양 대비 평균 구현율 **72%**. WI-611~615는 핵심 갭 5건 보강:

| WI | 갭 | 이 와이어프레임에서 ★ 표시된 곳 |
|---|---|---|
| WI-611 | image-engine `generate()`/`getEstimatedCost()` orchestrator 부재 | flowstudio.html · flowretouch.html · pbc-usage.md |
| WI-612 | hr-payroll `createPayrollService` 팩토리 부재 | flowteams.html (II) · pbc-usage.md |
| WI-613 | core-design-md 패키지 자체가 부재 | architecture.md · pbc-usage.md |
| WI-614 | apps/web에서 PBC 사용 evidence 0건 | web.html (XIV showcase) |
| WI-615 | flowteams가 표준 shell 미적용 | flowteams.html (★ 마지막 섹션) |

5건 모두 처리하면 메타플랫폼의 "메타" 부분이 비로소 동작한다 (PBC가 추출만 된 상태 → 실제 다른 앱이 사용하는 상태).

---

## 현존 vs 미래 한눈에

```
[현존 (2026-05)]                            [1년 후 (2027-05)]
─────────────────                           ─────────────────
apps/web         ●  컨설팅 (58 페이지)        →  + showcase 데모
apps/flowteams   ●  HR (5 페이지)             →  표준 shell 적용
apps/desktop     ●  Electron (IPC만)          →  포털 자동화 실구현
apps/agent-bridge●  AI 서비스                 →  유지
                                              + apps/flowstudio    ★ 신규
                                              + apps/flowvue       ★ 신규
                                              + apps/flowretouch   ★ 신규
                                              + 1개 신규

PBC: 3개 (image-engine, block-builder, hr-payroll)
                                              → 10개 (+ billing, erp×2,
                                                file-manager, messaging,
                                                scheduler, consulting-crm)

Core: 0개 운영                                → core-design-md (1개 시범)
                                                core-rebac (auth에서 분리)

Rust services: 0                              → PoC 시작 (image-engine-rs)
```

---

## 디렉토리

```
wireframes/
├── README.md             ← 이 파일
├── sitemap.md            전체 라우트 트리
├── architecture.md       4-Layer + PBC × Apps 매트릭스
├── pbc-usage.md          PBC 공개 API와 호출처 매핑
├── shared/
│   ├── design-tokens.css FlowCoder default theme 토큰
│   └── shell.html        표준 shell 미리보기
└── apps/
    ├── web.html
    ├── flowteams.html
    ├── desktop.html
    ├── agent-bridge.html
    ├── flowstudio.html     ★ 미래
    ├── flowvue.html        ★ 미래
    └── flowretouch.html    ★ 미래
```

---

## 다음 단계

이 와이어프레임을 보고 WI-611~615 진행 방향이 맞으면 `flowset.sh`를 별도 터미널에서 가동:

```bash
cd /Volumes/포터블/AXLE
bash .flowset/scripts/launch-loop.sh
```

방향이 다르면 사용자가 결정 → contracts/sprint-61X.md 수정 또는 fix_plan.md 재정렬.
