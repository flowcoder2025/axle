# AXLE 메타플랫폼 — 아키텍처

> **출처**: `docs/specs/meta-platform/PRD.md` §3 4-Layer 아키텍처 + 추출 매트릭스

---

## 1. 4-Layer 아키텍처

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 4: Domain Apps (apps/*)                                │
│   apps/web         (현존, 컨설팅 — 58 페이지)                 │
│   apps/flowteams   (현존, HR — 5 페이지)                      │
│   apps/desktop     (현존, Electron 클라이언트)                 │
│   apps/agent-bridge(현존, AI 서비스)                          │
│   apps/flowstudio  ★미존재 (이미지+콘텐츠)                    │
│   apps/flowvue     ★미존재 (ERP)                              │
│   apps/flowretouch ★미존재 (리터치)                           │
├──────────────────────────────────────────────────────────────┤
│  Layer 3: Packages — 횡단(11) + PBC(3+) + Core(2)             │
│  ┌─ 횡단 (AXLE 현행 11개, 유지) ─────────────────────────┐    │
│  │ ai · auth · crawler · db · docgen · email · matching  │    │
│  │ notification · ocr · storage · ui                     │    │
│  └────────────────────────────────────────────────────────┘    │
│  ┌─ PBC (Top 3, Phase 19) ──────────────────────────────┐     │
│  │ pbc-image-engine    (WI-401~410, WI-611 보강)         │     │
│  │ pbc-block-builder   (WI-501~511)                      │     │
│  │ pbc-hr-payroll      (WI-601~610, WI-612 보강)         │     │
│  └────────────────────────────────────────────────────────┘    │
│  ┌─ Core (PRD §4 L1-B, 보조 인프라) ────────────────────┐     │
│  │ core-design-md      ★ WI-613 신규                    │     │
│  │ core-rebac          ★ 미시작 (auth에서 분리)         │     │
│  └────────────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────────┤
│  Layer 2: FDP Core (현행, 유지)                                │
│   Next.js 16 + Prisma 7 + Auth.js v5 + ReBAC + 3-tier 세션    │
├──────────────────────────────────────────────────────────────┤
│  Layer 1: Rust 마이크로서비스 (3년 후 PoC)                     │
│   services/image-engine-rs   (Z-Image + FLUX.2)               │
│   services/ocr-engine-rs     (PaddleOCR-VL)                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. PBC × Apps 사용 매트릭스

`★` = WI-611~615로 보강/추가될 항목.

| PBC \ App | web | flowteams | desktop | agent-bridge | flowstudio | flowvue | flowretouch |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| pbc-image-engine | — | — | — | — | ●● 핵심 | — | ●● 핵심 (RETOUCH) |
| pbc-block-builder | ★ 데모 (WI-614) | — | — | — | ●● 빌더 | ● 상품상세 | — |
| pbc-hr-payroll | — | ●● 핵심 ★ (WI-612) | — | — | — | — | — |
| core-design-md ★ (WI-613) | ● 시범 헬퍼 | ● theme | — | — | ● theme 갈아끼움 | ● theme | ● 어두운 theme |
| core-rebac (미시작) | ● auth 추출 | ● 권한 결정 | — | — | ● 권한 | ● 권한 | — |
| pbc-billing (1년 후) | — | — | — | — | ● | ● | ● |
| pbc-messaging (1년 후) | ● 알림 | — | — | — | — | ● 주문 알림 | — |
| pbc-file-manager (1년 후) | ● 문서 | — | — | — | ● 이미지 | ● 상품 이미지 | ● 이미지 |
| pbc-erp-inventory (1년 후) | — | — | — | — | — | ●● 핵심 | — |
| pbc-erp-orders (1년 후) | — | — | — | — | — | ●● 핵심 | — |
| pbc-consulting-crm (1년 후) | ●● 핵심 (추출) | — | — | — | — | — | — |
| pbc-scheduler (1년 후) | ● 일정 | — | — | — | — | — | — |

`●●` = 핵심 의존, `●` = 사용함, `—` = 미사용.

---

## 3. WI-611~615가 메우는 갭

```
[현재 상태: 평균 72%]                    [WI-611~615 후 목표: ~85%]
                                  ─→
pbc-image-engine 65% (orchestrator 누락) →  generate()/getEstimatedCost() 보강 (WI-611)
pbc-hr-payroll 88% (팩토리 누락)          →  createPayrollService 보강 (WI-612)
core-design-md  미존재                    →  신규 패키지 + 시범 헬퍼 (WI-613)
PBC 사용 evidence 0건                     →  apps/web/showcase 데모 (WI-614)
flowteams 표준 shell 미적용               →  sidebar+topbar 적용 (WI-615)
```

---

## 4. 데이터 플로우 (예: FlowStudio 이미지 생성)

```
사용자 입력 (FlowStudio /create 페이지)
    ↓
Server Action / API Route (apps/flowstudio)
    ↓ generate(req)
@axle/pbc-image-engine
    ├─ buildPrompt(req)              ← promptBuilder.ts (WI-611)
    ├─ selectProvider(req)
    ├─ provider.generate(...)        ← google-genai / vertex / openrouter / comfyui
    └─ getEstimatedCost(req)         ← cost.ts (WI-611)
    ↓ GenerationResult
저장 (pbc-file-manager) + 크레딧 차감 (pbc-billing) + 결과 표시
```

---

## 5. 의사결정 (PRD §2.3 거부 옵션)

- ❌ 새 monorepo 생성 (AXLE 인프라 재구축 비용)
- ❌ Rust 전면 채택 (ORM 메타프로그래밍 비용 + FDP 자산 폐기)
- ❌ AXLE 메인 PRD 덮어쓰기 (Phase 17/18 진행 중)

→ **메타플랫폼은 AXLE 위에 추가**되는 형태. 기존 49 model + 11 횡단 패키지 유지.

---

## 6. 1년 후 도달 조건 (vision-and-expansion §1.2)

- 도메인 앱 6개 운영 (axle / flowstudio / flowteams / flowvue / flowretouch + 1)
- PBC 10개 (Top 3 + billing/erp×2/file-manager/messaging/scheduler/consulting-crm)
- DESIGN.md 3개 운영 (FlowCoder default + 2개)
- 외부 PBC 1개 등록 시도 (개발자 경험 검증)

**현재 거리**: 도메인 앱 4개 / PBC 3개 / DESIGN.md 1개(미주입). WI-611~615는 이 거리를 좁히는 1차 작업.
