# AXLE 메타플랫폼 — 모듈 카탈로그 정의

> **모델**: Odoo-style 조직 단위 모듈 install/uninstall
> **단위**: 도메인별 모듈 팩 (한 팩 안에 여러 기능 + 권한 + 사이드바 nav 묶음)
> **활성화 주체**: 조직 관리자 → 모든 멤버에게 노출

---

## 핵심 개념

```
플랫폼 (axle.io)
   │
   ├─ 공통 (항상 활성, uninstall 불가)
   │    └─ 로그인 / 조직 / 결제 / 알림 / 사용자 설정 / 관리자
   │
   └─ 모듈 (조직별 install 단위)
        ├─ 컨설팅 모듈        ← 컨설팅 회사가 install
        ├─ HR 모듈            ← 직원 관리하는 회사가 install
        ├─ 콘텐츠 생성 모듈   ← 상세페이지/광고 만드는 회사
        ├─ ERP 모듈           ← 재고/주문 다루는 회사
        ├─ 리터치 모듈        ← 사진관/이커머스
        └─ ...
```

**규칙**:
- 모듈 = "사이드바 섹션 + 라우트 묶음 + PBC 의존성 + 권한 정의"
- 한 조직은 N개 모듈을 install (중복 가능)
- 사용자가 보는 사이드바 = 조직이 install한 모듈만 표시
- 결제는 모듈 단위 (subscription per module)

---

## 모듈 인벤토리 (1년 후 목표)

### M1. 컨설팅 모듈 (Consulting Suite)
**대상**: 컨설팅 회사 (정부 지원사업, 인증, 특허 등)
**현재**: `apps/web`의 본체 (이미 구현됨)
**사이드바 nav** (12개):
- 고객관리 · 프로젝트 · 서류 · 지원사업 · 매칭 분석
- 일정 · 미팅 · 연구일지 · 재무 · 분석 · 견적/계약
**PBC 의존**: `pbc-consulting-crm` (1년 후 추출) + `pbc-block-builder` (서류 작성) + `pbc-scheduler`
**가격대** (예시): ₩99,000 / 조직 / 월

### M2. HR 모듈 (HR Suite)
**대상**: 직원 5명 이상 회사
**현재**: `apps/flowteams`에 4 페이지 (흡수 예정)
**사이드바 nav** (4개):
- 급여 · 근태 · 연차 · 노무 자문
**PBC 의존**: `pbc-hr-payroll` (WI-612 보강) + `pbc-messaging` (1년 후)
**가격대**: ₩49,000 / 조직 / 월 (직원 수 따라 변동)

### M3. 콘텐츠 생성 모듈 (Content Studio)
**대상**: 마케터, 이커머스, 1인 크리에이터
**현재**: 미존재 (FlowStudio 기능을 PBC로 추출 후 모듈화)
**사이드바 nav** (~7개):
- 이미지 생성 (CREATE / EDIT / POSTER / DETAIL_EDIT / SCENE / STYLE)
- 상세페이지 빌더 · 갤러리 · 프리셋 · ComfyUI 워크플로우
**PBC 의존**: `pbc-image-engine` (WI-611 보강) + `pbc-block-builder`
**가격대**: ₩59,000 + 사용량 (credits)

### M4. ERP 모듈 (ERP Suite)
**대상**: 도소매, 제조업
**현재**: 미존재 (FlowVue 추출 후)
**사이드바 nav** (~8개):
- 재고 · 주문 · 배송 · 발주 · 거래처 · 상품 카탈로그 · 리포트
**PBC 의존**: `pbc-erp-inventory` + `pbc-erp-orders` (1년 후 추출)
**가격대**: ₩89,000 / 조직 / 월

### M5. 리터치 모듈 (Retouch)
**대상**: 사진관, 이커머스 상품 사진
**현재**: 미존재 (FlowRetouch 흡수)
**사이드바 nav** (~4개):
- 에디터 · 배치 처리 · 프리셋 · 히스토리
**PBC 의존**: `pbc-image-engine` RETOUCH 모드 단독 (PRO/FREE preset)
**가격대**: ₩39,000 + credits

### M6. (예약 1개) 신규 도메인
vision-and-expansion §1.2의 "1년 후 6번째 앱" 슬롯 — 추후 확정.

---

## 공통(Core) — install 불가, 항상 활성

| 영역 | 라우트 | 설명 |
|---|---|---|
| 로그인/회원가입 | `/login` `/signup` | 1회 로그인 → 모든 모듈 접근 |
| 조직 | `/settings/organization` | 조직 정보, 로고 |
| 팀 | `/settings/team` | 팀원 초대, ReBAC 역할 |
| 결제 | `/settings/billing` | 구독 중인 모듈 + 사용량 |
| 모듈 카탈로그 | `/settings/modules` | install/uninstall 토글 |
| 알림 | `/notifications` | 모든 모듈 통합 알림 |
| 사용자 설정 | `/settings/profile` `/settings/ai` | 개인 설정 |
| 플랫폼 관리자 | `/admin/*` | PLATFORM_ADMIN only |
| 외부 클라이언트 포털 | `/portal/[token]` | 토큰 기반 게스트 액세스 |

---

## 모듈 install 흐름 (Odoo 모델)

```
1. 조직 가입 → 공통 영역만 활성, 사이드바 거의 비어 있음
2. 관리자가 /settings/modules 진입 → 카탈로그 6개 카드 표시
3. "컨설팅 모듈 install" 클릭
   ├─ 결제 정보 입력 (없으면)
   ├─ 활성화
   └─ 사이드바 즉시 갱신: "컨설팅" 섹션 + 12 nav 표시
4. "HR 모듈 install" 추가
   └─ 사이드바: "컨설팅" 섹션 + "HR" 섹션 동시 표시
5. 모듈별 권한은 ReBAC role × module scope로 결정
   예: user는 "consulting:read" + "hr:write" 가질 수 있음
```

---

## 모듈 × PBC × 데이터 흐름

| 모듈 | 사용 PBC | DB 모델 | 외부 API |
|---|---|---|---|
| 컨설팅 | consulting-crm(미추출) · block-builder · scheduler | Client/Project/Estimate/Contract/Program/... | 기업마당 · K-Startup |
| HR | hr-payroll · messaging | Employee/Payroll/Attendance/Leave/Nomu | (4대보험 — 미래) |
| 콘텐츠 | image-engine · block-builder | Image/Composition | Google GenAI · Vertex · OpenRouter · ComfyUI |
| ERP | erp-inventory · erp-orders · messaging | Product/SKU/Order/Shipment | 택배사 · 결제 |
| 리터치 | image-engine (RETOUCH) | Image | OpenRouter · ComfyUI |

---

## 사이드바 동적 렌더링 룰

```typescript
// 의사 코드
function buildSidebar(org: Organization, user: User): SidebarSection[] {
  const installedModules = await getInstalledModules(org.id);
  const userPerms = await getUserPermissions(user.id);

  return [
    ...installedModules
      .filter(m => userPerms.canAccess(m.id))
      .map(m => ({ section: m.label, nav: m.navItems })),
    { section: "공통", nav: ["알림", "설정"] },
    ...(user.isPlatformAdmin ? [{ section: "관리자", nav: [...] }] : [])
  ];
}
```

- **install 안 된 모듈** → 사이드바에 안 보임, 직접 URL 접근 시 403
- **install했지만 권한 없음** → 사이드바에 안 보임, 직접 URL 접근 시 403
- **install + 권한 있음** → 사이드바 표시

---

## 코드 구조 (모듈 시스템)

```
apps/web/                              ← 유일한 메인 앱
├── src/
│   ├── app/                          ← Next.js App Router (모든 라우트)
│   │   ├── (platform)/               ← 공통 + 모듈 페이지 통합
│   │   │   ├── dashboard/
│   │   │   ├── clients/              ← M1 consulting 모듈
│   │   │   ├── payroll/              ← M2 HR 모듈
│   │   │   ├── create/               ← M3 콘텐츠 모듈
│   │   │   └── ...
│   │   ├── settings/modules/         ← 모듈 카탈로그
│   │   └── ...
│   ├── modules/                      ← 모듈 정의 (메타데이터)
│   │   ├── consulting/
│   │   │   ├── module.config.ts      ← id/label/nav/permissions
│   │   │   ├── components/
│   │   │   └── server-actions/
│   │   ├── hr/                       ← apps/flowteams 흡수
│   │   ├── content/
│   │   └── ...
│   └── lib/
│       ├── module-registry.ts        ← 모듈 install 관리
│       └── sidebar.ts                ← 동적 사이드바 빌더
```

**`apps/flowteams`** → 흡수 후 디렉토리 제거.
**`apps/desktop`, `apps/agent-bridge`** → 그대로 유지 (별도 배포).

---

## 향후 확장 (3-5년)

- **마켓플레이스**: 외부 개발자 모듈 등록 (검증 게이트 통과 시)
- **모듈 간 데이터 공유**: 예) HR 모듈의 직원 → 컨설팅 모듈의 프로젝트 멤버로 자동 연결
- **모듈 의존성**: 한 모듈이 다른 모듈을 require (예: ERP는 결제 모듈 자동 install)
- **테마 per 모듈**: 콘텐츠 모듈 활성 시 어두운 캔버스 theme 자동 전환 (옵션)
