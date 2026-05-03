# App Shell UX 표준

> 위치: `~/AX/기획/research/modular-platform/app-shell-ux.md`
> 정합 산출물: `/Volumes/포터블/AXLE/docs/specs/meta-platform/` (PR로 이전 예정)
> 참조: [`themes/flowcoder-default.design.md`](./themes/flowcoder-default.design.md)
> 작성일: 2026-05-04
> 핵심: **"메인 대시보드 → 상세 모듈 분화"** 패턴을 모든 도메인 앱(axle/flowvue/flowteams/flowstudio/...)이 공통으로 따른다.

---

## 0. 원칙

### 0.1 한 줄 정의
> **모든 앱은 "Sidebar + Topbar + Main"의 단일 패턴에서 시작한다. 도메인이 달라도 골격은 같다.**

### 0.2 5가지 비협상 룰

1. **Sidebar는 한 개만**: 중첩 사이드바 금지. 깊이는 탭/sub-page로.
2. **Topbar는 한 개만**: 페이지마다 다른 topbar 금지. global하게 동일 위치.
3. **Main 영역은 단일 max-width**: 1200px (standard) / 1440px (dashboard / wide). 무제한 너비 금지.
4. **State는 항상 4종**: Loading / Empty / Error / Success — 누락 금지.
5. **모든 페이지는 6개 패턴 중 하나**: Dashboard / List / Detail / Form / Settings / Marketing — 새 패턴 추가는 RFC 필수.

---

## 1. App Shell 구조

### 1.1 Layout 다이어그램

```
┌──────────────────────────────────────────────────────────────────┐
│  TOPBAR (56px / 48px compact)                                     │
│  [Brand] [Page Title]                  [Search] [🔔] [Avatar ▾]   │
├─────────────┬────────────────────────────────────────────────────┤
│             │                                                    │
│  SIDEBAR    │                                                    │
│  240px      │                                                    │
│  (200       │                MAIN CONTENT                        │
│   compact)  │                (max-width 1200/1440px)             │
│             │                Page padding: 24px (16 mobile)      │
│  Brand      │                                                    │
│  ──────     │                                                    │
│  메인        │                                                    │
│  • 대시보드  │                                                    │
│  • 고객      │                                                    │
│  • 프로젝트  │                                                    │
│             │                                                    │
│  업무        │                                                    │
│  • A         │                                                    │
│  • B         │                                                    │
│             │                                                    │
│  ──────     │                                                    │
│  설정 / User │                                                    │
└─────────────┴────────────────────────────────────────────────────┘
```

### 1.2 Sidebar 사양

| 속성 | 값 |
|---|---|
| 너비 | 240px (comfortable) / 200px (compact) |
| 배경 | `--sidebar-bg` (브랜드 override 가능) |
| 경계선 | 우측 1px `--sidebar-border` |
| Sticky | 필수 (스크롤 시 고정) |
| 모바일 | < 1024px에서 drawer로 전환 |

#### 구성 요소
1. **Brand mark** (상단): 로고 24-28px + 앱 이름. 클릭 시 메인 대시보드로.
2. **Section labels**: caption-strong, uppercase, text-muted, 8px top margin.
3. **Nav items**: 40px height (32 compact), icon 16px + label, 8px gap.
4. **Active state**: `--sidebar-active-bg` + accent color text + 좌측 3px 막대 (accent).
5. **User/settings** (하단, `margin-top: auto`): 항상 사이드바 맨 아래.

#### 권장 항목 수
- **메인 그룹**: 4-6개 (도메인 핵심 라우트)
- **업무 그룹**: 3-6개 (도메인 특수 작업)
- **설정 + User**: 1-2개 (sticky bottom)
- **총 8-14개 권장.** 18개 초과 시 그룹 더 분리하거나 sub-nav 검토.

### 1.3 Topbar 사양

| 속성 | 값 |
|---|---|
| 높이 | 56px (comfortable) / 48px (compact) |
| 배경 | `hsla(--background, 0.85)` + `backdrop-filter: blur(8px)` |
| 경계선 | 하단 1px `--border-subtle` |
| Sticky | 필수 |

#### 좌측 (page identity)
- 데스크톱 (sidebar 보일 때): 페이지 타이틀만 (브랜드는 사이드바에 있음)
- 모바일 (sidebar drawer): 햄버거 메뉴 + 브랜드 + 페이지 타이틀

#### 우측 (global actions)
순서 고정: **Search → Notifications → User Avatar (dropdown)**
- Search: 200-280px input. `Cmd+K` 단축키 동작.
- Notifications: bell 아이콘 + 카운트 배지 (있을 때만).
- User: avatar + dropdown (프로필/설정/로그아웃).

### 1.4 Main 영역

| 속성 | 값 |
|---|---|
| Max-width | 1200px (standard) / 1440px (dashboard, wide) / 100% (full bleed 마케팅) |
| Page padding | 24px (16 mobile) |
| Background | `--background` |
| Scroll | 독립 (sidebar/topbar는 sticky) |

---

## 2. 메인 대시보드 → 상세 모듈 패턴

### 2.1 핵심 흐름

```
┌─ 메인 대시보드 (각 앱의 진입점) ──────────────────┐
│                                                  │
│  KPI Row (3-4 cards)                            │
│  ─────────────────                              │
│  Primary Chart (전체 흐름)                       │
│  ─────────────────                              │
│  Recent Activity (최근 N개)                      │
│  ─────────────────                              │
│  Quick Actions (도메인 자주 작업 진입)            │
│                                                  │
└──────────────────────────────────────────────────┘
                      ↓ click
┌─ 상세 모듈 1: List ──────────────────────────────┐
│  Filter Bar + Table                              │
└──────────────────────────────────────────────────┘
                      ↓ click row
┌─ 상세 모듈 2: Detail ────────────────────────────┐
│  Header (entity + status + actions)              │
│  Tabs (정보 / 활동 / 관련 / 설정)                  │
│  Content per tab                                 │
└──────────────────────────────────────────────────┘
```

### 2.2 모든 도메인 앱이 공통

각 앱은 자기 도메인의 메인 대시보드를 가진다:

| 앱 | 대시보드 KPI | 상세 모듈 |
|---|---|---|
| **axle** | 활성 고객 / 진행 프로젝트 / 월 매출 / 합격률 | 고객 / 프로젝트 / 사업계획서 / 견적·계약 |
| **flowvue** | 매출 / 재고 / 미수금 / 신규 주문 | 재고 / 주문 / 거래처 / 회계 |
| **flowteams** | 직원 수 / 이번 달 급여 / 휴가 신청 / 미해결 노무 | 인사 / 급여 / 근태 / 휴가 / 자문 |
| **flowstudio** | 생성 횟수 / 크레딧 / 최근 작업 / 인기 워크플로 | 이미지 / 블록빌더 / 워크플로 / 자산 |

→ **KPI 4개**가 각 앱의 정체성. 그 외 패턴은 동일.

### 2.3 상세 모듈 분화 (도메인별로 달라지는 지점)

상세 모듈은 5가지 패턴 중 선택:
1. **List** — 항목 다수 보기 (table or card grid)
2. **Detail** — 단일 항목 깊이 (tabs)
3. **Form** — 입력/편집 (sticky save bar)
4. **Workflow** — 다단계 진행 (stepper + 상태)
5. **Builder** — 시각적 조립 (block-builder, canvas)

---

## 3. 6가지 페이지 패턴 (표준)

### 3.1 Dashboard
**용도**: 도메인 전체 현황 한눈에. 모든 앱의 메인 라우트(`/`).

```
┌─ Page Title (32px) + 기간 selector (우측) ────────┐
├──────────────────────────────────────────────────┤
│  KPI Cards (3-4개, 가로 배치, 압축 padding)        │
├──────────────────────────────────────────────────┤
│  Primary Chart (높이 240-320px, full width)       │
├──────────────────────────────────────────────────┤
│  Secondary: 좌 chart / 우 recent activity table   │
├──────────────────────────────────────────────────┤
│  Quick Actions (3-4개 카드, "사업계획서 작성" 등)   │
└──────────────────────────────────────────────────┘
```

- Density: **compact** (정보 밀도 ↑)
- Max-width: 1440px
- Refresh interval: 60s 권장
- 각 KPI 클릭 시 해당 List 페이지로

### 3.2 List
**용도**: 항목 다수 보기. 검색/필터/정렬/페이지네이션.

```
┌─ Page Title + Primary Action (우측, "+ 추가") ────┐
├──────────────────────────────────────────────────┤
│  Filter Bar: 검색 + 상태 filter + 날짜 range      │
├──────────────────────────────────────────────────┤
│  Table or Card Grid (compact density)             │
│  • Table: 5-8 컬럼, 정렬 가능, hover row          │
│  • Card Grid: 4-column desktop, 2 tablet, 1 mobile│
├──────────────────────────────────────────────────┤
│  Pagination (하단 중앙, 10/25/50 page size)        │
└──────────────────────────────────────────────────┘
```

- Density: **compact**
- Max-width: 1200px (table) / 1440px (card grid)
- 빈 상태: Empty State 패턴 (§4.2) 준수
- Bulk action: 선택 시 상단 sticky bar로 전환

### 3.3 Detail
**용도**: 단일 항목 깊이 보기 + 편집.

```
┌─ Breadcrumb (List > 항목 이름) ───────────────────┐
├──────────────────────────────────────────────────┤
│  Header:                                         │
│    [Avatar/Icon] 항목 이름 [Status Badge]         │
│    [Subtitle / 메타 정보]                          │
│    [편집] [삭제] [⋯] (우측 정렬)                  │
├──────────────────────────────────────────────────┤
│  Tabs: 개요 | 활동 | 관련 항목 | 설정             │
├──────────────────────────────────────────────────┤
│  Tab Content (페이지 padding 24px)                │
└──────────────────────────────────────────────────┘
```

- Density: **comfortable**
- Max-width: 1200px
- 탭 4개 권장 (최대 6개). 그 이상은 리뷰 필요.
- 사이드 패널 (관련 정보)은 옵션 — 데스크톱 ≥ 1280px에서만.

### 3.4 Form
**용도**: 신규 생성 / 편집. 다단계 가능.

```
┌─ Breadcrumb + Page Title ────────────────────────┐
├──────────────────────────────────────────────────┤
│  Form Container (max-width 720px)                │
│                                                  │
│  Section 1: 기본 정보                             │
│    [Label] [Input]                              │
│    [Label] [Input]                              │
│                                                  │
│  Section 2: 추가 정보                             │
│    ...                                           │
│                                                  │
│  ─────────────                                   │
├──────────────────────────────────────────────────┤
│  Sticky Save Bar (하단 고정):                     │
│    [Cancel]                       [Save Draft]   │
│                                   [Save & Next]  │
└──────────────────────────────────────────────────┘
```

- Density: **comfortable**
- Max-width: 720px (single column) / 960px (two-column 가능)
- Sticky save bar: 항상 하단에 고정. 변경 사항 있을 때만 활성화.
- Section gap: 32px. 같은 섹션 내 input gap: 16px.
- 다단계 (multi-step): 상단에 Stepper (1/4 → 2/4 → ...).

### 3.5 Settings
**용도**: 설정 / 환경 / 통합.

```
┌─ Page Title (예: "설정") ─────────────────────────┐
├─────────────┬────────────────────────────────────┤
│  Setting    │                                    │
│  Nav        │  Selected Section Content          │
│             │                                    │
│  • 일반     │  (Form 패턴 따름)                   │
│  • 프로필   │                                    │
│  • 보안     │                                    │
│  • 알림     │                                    │
│  • 통합     │                                    │
│  • 결제     │                                    │
└─────────────┴────────────────────────────────────┘
```

- Density: **comfortable**
- Max-width: 1200px (좌 220px nav + 우 main)
- 모바일 (< 1024px): 두 단계 (nav 페이지 → 선택 시 detail)
- Setting nav 6-12개 권장

### 3.6 Marketing
**용도**: 랜딩, About, Pricing, 도큐먼트.

```
┌─ Topbar (투명, scroll 시 solid) ──────────────────┐
├──────────────────────────────────────────────────┤
│  Hero (full bleed, 배경 이미지 또는 그라디언트)     │
│                                                  │
│  Display Hero Title                              │
│  Tagline                                         │
│  [Primary CTA] [Secondary]                       │
├──────────────────────────────────────────────────┤
│  Feature Section 1 (full width, 96px padding)    │
├──────────────────────────────────────────────────┤
│  Feature Section 2                               │
├──────────────────────────────────────────────────┤
│  Social Proof (logos)                            │
├──────────────────────────────────────────────────┤
│  Pricing                                         │
├──────────────────────────────────────────────────┤
│  Footer (다단계)                                  │
└──────────────────────────────────────────────────┘
```

- Density: **marketing** (별도 스케일, 더 큰 padding)
- Sidebar 없음 (다른 패턴과 명확히 분리)
- 폰트 사이즈 한 단계 ↑ (Display Hero 56-72px)
- 배경: full-bleed 허용
- 마케팅 톤 사용 OK (앱 라우트와 분리)

---

## 4. 상태 패턴 (4종 — 모두 필수)

### 4.1 Loading
**원칙**: spinner 대신 skeleton.

```
┌──────────────────────────────────────────┐
│  ▓▓▓▓▓▓▓▓░░  (60% width, height 18px)    │
│  ▓▓▓▓▓▓▓▓▓░░░  (90%, 14px)              │
│  ▓▓▓▓▓▓▓░░░░  (80%, 14px)               │
│  ▓▓▓▓▓░░░░░░  (70%, 14px)               │
│                                          │
│  [▓▓▓▓░░] [▓▓▓▓▓░░] (32px buttons)      │
└──────────────────────────────────────────┘
```

- Skeleton shimmer: 1.5s linear infinite.
- 페이지 전체 로딩이 1초 이상 예상되면 적용.
- 0.3초 미만이면 표시 안 함 (깜빡임 회피).

### 4.2 Empty State
**원칙**: 사용자에게 다음 액션을 제시.

```
┌──────────────────────────────────────────┐
│                                          │
│              [Icon 64px]                 │
│                                          │
│      아직 등록된 고객이 없습니다           │
│                                          │
│   첫 번째 고객을 추가해 시작해 보세요      │
│                                          │
│         [+ 고객 추가하기]                  │
│                                          │
└──────────────────────────────────────────┘
```

- 중앙 정렬, max-width 480px
- 아이콘 (선택): 64px, text-muted
- 헤딩: Sub Title (16px / 600)
- 설명: Body (14px / muted)
- Primary CTA: 명확한 다음 액션 ("Nothing here" 류 금지)

### 4.3 Error State
**원칙**: 무엇이 / 왜 / 어떻게 회복.

```
┌──────────────────────────────────────────┐
│                                          │
│        [⚠ icon, destructive color]       │
│                                          │
│      프로젝트를 불러올 수 없습니다         │
│                                          │
│   네트워크 연결을 확인하거나 잠시 후       │
│       다시 시도해 주세요.                 │
│                                          │
│   에러 코드: NETWORK_TIMEOUT (5xx)        │
│                                          │
│        [다시 시도] [고객지원]              │
│                                          │
└──────────────────────────────────────────┘
```

- 에러 코드/ID는 항상 표시 (지원 문의용)
- 회복 액션 우선 ("다시 시도"), 그다음 escalation ("고객지원")
- 절대 "Oops!" 또는 "Sorry!" 금지

### 4.4 Success State
**원칙**: Toast로 confirm + 다음 단계 안내.

```
┌─────────────────────────────────────┐
│  [✓]  저장되었습니다                  │
│       3초 후 목록으로 이동합니다       │
└─────────────────────────────────────┘
                        (auto-dismiss 5s)
```

- Toast 우측 하단, slide-in 250ms
- 큰 변화 (생성/삭제 완료)는 Toast + 페이지 transition 둘 다.
- Inline 표시 (form save bar): "저장됨 ✓" 작은 텍스트 (3초 후 페이드)

---

## 5. Navigation 컨벤션

### 5.1 라우팅 구조

Next.js App Router 기준 (AXLE 패턴 계승):

```
app/
├── (marketing)/        ← 비로그인 (랜딩, about)
├── (auth)/             ← 로그인 플로우 (signup/login)
├── (app)/              ← 인증 필수 (메인 SaaS)
│   ├── layout.tsx      ← Sidebar + Topbar 표준 shell
│   ├── page.tsx        ← Dashboard (메인 진입)
│   ├── customers/
│   │   ├── page.tsx    ← List
│   │   └── [id]/
│   │       └── page.tsx ← Detail
│   ├── projects/
│   ├── settings/
│   └── ...
├── (admin)/            ← 플랫폼 운영자 only
└── (portal)/           ← 외부 포털 (인증 토큰)
```

### 5.2 URL 컨벤션

| 패턴 | URL 예시 | 페이지 패턴 |
|---|---|---|
| Dashboard | `/` | Dashboard |
| List | `/customers` | List |
| Detail | `/customers/[id]` | Detail |
| Create | `/customers/new` | Form |
| Edit | `/customers/[id]/edit` | Form |
| Settings | `/settings/profile` | Settings |
| 다단계 워크플로 | `/projects/[id]/biz-plan/step-1` | Workflow |

- **단수형 URL 금지**: `/customer` ❌ → `/customers` ✓
- **kebab-case**: `/biz-plan` ✓ / `/bizPlan` ❌
- **ID 위치 일관**: `[id]`는 항상 단어 뒤에

### 5.3 Breadcrumb

```
설정 > 보안 > API 키 > 신규 발급
```

- 항상 상단 (Topbar 아래 또는 페이지 헤더 위)
- 클릭 가능 (각 단계 페이지로)
- 모바일에서는 "← 뒤로"만 표시 (전체 경로 생략)

---

## 6. Keyboard Shortcuts (글로벌)

| 단축키 | 동작 |
|---|---|
| `Cmd+K` (Mac) / `Ctrl+K` | 글로벌 검색 / Command Palette 열기 |
| `Cmd+/` | 키보드 단축키 헬프 표시 |
| `Cmd+,` | 설정 페이지로 이동 |
| `Cmd+B` | Sidebar 토글 (collapse/expand) |
| `g d` | 대시보드로 이동 (Gmail 스타일) |
| `g c` | 고객 목록 (도메인별) |
| `g p` | 프로젝트 목록 |
| `Esc` | 모달/dropdown 닫기 |
| `Cmd+Enter` | Form submit (포커스가 input일 때) |

- 도메인 특수 단축키는 각 앱에서 정의, 단 글로벌 단축키와 충돌 금지.
- 단축키 헬프 (`Cmd+/`)에서 모든 단축키 검색 가능해야 함.

---

## 7. 모바일 (< 1024px) 동작

### 7.1 Sidebar → Drawer
- Topbar 좌측에 햄버거 (☰) 추가
- 클릭 시 drawer slide-in (300ms, 좌→우)
- Drawer 너비 280px (data-heavy) 또는 100% (mobile-first)
- Backdrop 클릭 시 닫힘
- Active link 클릭 시 자동 닫힘

### 7.2 Topbar 압축
- 페이지 타이틀은 단일 줄 ellipsis
- Search 아이콘만 (확장은 fullscreen)
- User avatar는 dropdown 그대로

### 7.3 Page padding
- 24px → 16px
- KPI 카드 grid: 4 col → 2 col → 1 col

### 7.4 Table → Card
- 모바일에서 table은 가로 스크롤 또는 card 변환
- 변환 시: 각 row가 card, 컬럼 → label-value pair

---

## 8. 메타플랫폼 특이사항: 다중 앱 전환

### 8.1 앱 전환 UI

메타플랫폼은 다중 도메인 앱 (axle / flowvue / flowteams / flowstudio)이 함께 운영됨. 사용자가 한 사용자로 여러 앱 사용 시:

#### 옵션 A — 서브도메인 분리 (권장)
- `axle.flow-coder.com` / `flowvue.flow-coder.com` / `flowstudio.flow-coder.com`
- 각자 독립 SaaS처럼 동작
- 사용자가 명시적으로 도메인 전환
- **첫 1년 채택**

#### 옵션 B — 단일 도메인 + 앱 스위처
- `app.flow-coder.com/axle` / `/flowvue` / `/flowstudio`
- Topbar 좌측에 앱 선택 dropdown
- **2년차 통합 운영 시 검토**

### 8.2 단일 사용자 + 다중 앱 시나리오

- 인증: Auth.js v5 단일 세션 → 모든 앱 SSO
- 권한: ReBAC `RelationTuple`로 앱별 접근 제어
- 데이터: Organization + Membership으로 격리
- DESIGN.md theme: 앱별 독립 (axle = 컨설팅 톤, flowstudio = 콘텐츠 톤)

### 8.3 Cross-App Search (Cmd+K, 1년 후 도입)

- 단일 검색 인터페이스에서 여러 앱의 데이터 탐색
- 결과는 앱별 그룹: "axle / 고객" "flowvue / 거래처" 등
- 클릭 시 해당 앱으로 이동

---

## 9. 권장 컴포넌트 의존 (shadcn/ui 기반)

| 패턴 | 사용 컴포넌트 |
|---|---|
| Sidebar | shadcn `Sidebar` (`<Sidebar>`, `<SidebarMenu>`, ...) |
| Topbar | 자체 (sticky div + 내부 컴포넌트) |
| Dashboard KPI | 자체 카드 + tnum number |
| Charts | Recharts (또는 inline SVG for 1-2 series) |
| Tables | shadcn `Table` + TanStack Table |
| Forms | React Hook Form + Zod + shadcn Input |
| Modals | shadcn `Dialog` |
| Toasts | shadcn `Sonner` (sonner library) |
| Tabs | shadcn `Tabs` |
| Command Palette | shadcn `Command` (cmdk) |
| Tooltips | shadcn `Tooltip` |

→ **새 컴포넌트 추가는 RFC 필요**. shadcn에 없으면 그제서야 검토.

---

## 10. Anti-Patterns (NEVER)

### Layout
- ❌ Sidebar 안의 또 다른 Sidebar
- ❌ 페이지마다 다른 Topbar (위치/높이/내용)
- ❌ Main 영역에 max-width 없이 100% width (와이드 모니터에서 라인 너무 길어짐)
- ❌ Sticky 요소가 3개 이상 (sidebar + topbar + sticky save bar = 최대 3)

### Navigation
- ❌ 사이드바 nav item을 18개 초과
- ❌ 단축키 충돌 (한 단축키 두 동작)
- ❌ Breadcrumb 없이 깊은 라우팅 (4 depth 이상)
- ❌ 뒤로가기 버튼 위치 페이지마다 다름

### Page Patterns
- ❌ 표준 6개 패턴 외 새 패턴 (RFC 없이)
- ❌ Form인데 Save 버튼 없음 (자동 저장은 OK, 단 사용자에게 인지)
- ❌ Table에 빈 상태 없음 (Empty State 누락)
- ❌ Detail 페이지 탭 7개 이상

### State
- ❌ Loading spinner만 (skeleton 없이)
- ❌ "Nothing here" 류 무성의 empty state
- ❌ 에러 메시지에 코드/ID 없음 (지원 문의 시 추적 불가)
- ❌ Success 후 페이지 변화 없음 (사용자 confirm 부재)

### Mobile
- ❌ < 1024px에서 sidebar 강제 표시 (drawer 미사용)
- ❌ Touch target < 44px (Apple HIG 위반)
- ❌ 가로 스크롤 (필요시 명시적 안내)

---

## 11. 검증 체크리스트 (각 페이지 완성 시)

### 구조
- [ ] Sidebar / Topbar / Main 구조 준수
- [ ] Page padding 24px (16 mobile)
- [ ] Max-width 적용 (1200/1440)

### 패턴
- [ ] 6개 표준 패턴 중 하나 채택
- [ ] Density 적절 (compact for data, comfortable for content)
- [ ] Breadcrumb 표시 (depth 2 이상)

### 상태
- [ ] Loading state (skeleton)
- [ ] Empty state (의미 있는 다음 액션)
- [ ] Error state (코드/ID + 회복 액션)
- [ ] Success state (Toast 또는 inline confirm)

### 인터랙션
- [ ] Cmd+K로 검색 진입 가능
- [ ] Cmd+B로 sidebar 토글
- [ ] Esc로 모달 닫기
- [ ] Form: Cmd+Enter submit

### 모바일
- [ ] < 1024px에서 sidebar drawer 동작
- [ ] Touch target ≥ 44px
- [ ] Page padding 16px
- [ ] Table 또는 가로 스크롤 또는 card 변환

### 접근성
- [ ] 시맨틱 HTML (`<aside>`, `<header>`, `<main>`, `<section>`)
- [ ] ARIA labels (icon-only 버튼)
- [ ] Focus visible (모든 인터랙티브 요소)
- [ ] Keyboard navigation 완전 동작
- [ ] Color contrast ≥ WCAG AA (4.5:1 텍스트)

---

## 12. 적용 예시: AXLE 컨설팅 SaaS

### 12.1 사이드바 구조 (실제 적용)

```
[AXLE Brand]

메인
• 대시보드
• 고객
• 프로젝트
• 일정

업무
• 사업계획서
• 인증 트랙
• 견적·계약
• 문서

기타
• 분석
• 협업

(하단)
• 설정
• [User]
```

→ 메인 4 / 업무 4 / 기타 2 / 설정 + User = 11개 (권장 범위 내)

### 12.2 페이지 매핑

| 라우트 | 패턴 | Density |
|---|---|---|
| `/` | Dashboard | compact |
| `/customers` | List | compact |
| `/customers/[id]` | Detail | comfortable |
| `/customers/new` | Form | comfortable |
| `/projects` | List | compact |
| `/projects/[id]` | Detail | comfortable |
| `/projects/[id]/biz-plan` | Workflow | comfortable |
| `/calendar` | Custom (calendar view) | compact |
| `/settings/*` | Settings | comfortable |

### 12.3 다른 도메인 앱 적용 (시나리오)

같은 골격으로:
- **flowvue**: 메인 (대시보드/거래처/주문/재고) / 업무 (입출고/회계/리포트) / 기타 (분석)
- **flowteams**: 메인 (대시보드/직원/근태/급여) / 업무 (휴가/노무/계약서) / 기타 (보고서)
- **flowstudio**: 메인 (대시보드/이미지/블록빌더/워크플로) / 업무 (배치 생성/자산/템플릿) / 기타 (분석)

→ **앱이 달라도 골격은 같음.** DESIGN.md theme 갈아끼움 + Sidebar nav 항목 변경 + KPI 다른 데이터.

---

## 13. 다음 단계

이 문서는 모든 도메인 앱이 따라야 할 표준. 후속 작업:

1. **AXLE app shell** 이 표준에 맞게 검증 (현재 거의 일치, 미세 조정만)
2. **flowvue / flowteams / flowstudio** 신규 shell 생성 시 본 문서 강제 참조
3. **PBC들 (특히 pbc-block-builder)** 의 React 렌더러는 이 shell에 호스팅 가능해야 함
4. **shadcn `Sidebar` 컴포넌트** 통일 — `packages/ui/`에 표준화 검토

## 부록 A. 다른 표준과의 정합

| 표준 | 본 문서와의 관계 |
|---|---|
| `themes/flowcoder-default.design.md` | 색/타이포/spacing 토큰 출처 |
| open-design `dashboard` skill | KPI + chart layout 정확히 일치 |
| Linear / Notion / Stripe Dashboard | sidebar pattern 차용 |
| Apple HIG | touch target 44px, color contrast |
| WCAG 2.1 AA | 접근성 baseline |
