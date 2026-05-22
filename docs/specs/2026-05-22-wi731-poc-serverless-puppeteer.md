# WI-731-poc — Serverless Puppeteer for ERP 리포트 DOCX/PDF Export

**Status**: Decision recorded.
**Date**: 2026-05-22
**Decision owner**: AXLE engineering (FlowCoder team).
**Outcome**: Go with Vercel Fluid Compute + `@sparticuz/chromium` for WI-731. External worker remains the documented fallback if empirical verification on WI-731 preview fails.

---

## 1. PoC 목적

WI-731 (DOCX/PDF 비동기 jobId 패턴 내보내기) 의 실행 환경을 결정한다. 두 후보:

- **A. Vercel Fluid Compute + `@sparticuz/chromium`** — 같은 모노레포 안 `apps/web`에 함께 거주. 운영/배포 surface 가장 단순.
- **B. 외부 워커 (Render / Railway / Vercel Standalone background service)** — Vercel function size / cold start 한계를 우회.

다음 acceptance criteria (`docs/specs/2026-05-17-phase21-erp-amplification-design.md` §5 WI-731-poc) 충족 시 A를 채택:
1. `@sparticuz/chromium` + Fluid Compute 환경에서 한글 PDF 1페이지 생성 성공
2. 응답 시간 ≤ 30s
3. Blob 업로드 + signed URL 발급
4. 실패 시 → 외부 워커 대안 결정

---

## 2. 사실 정리 (확정된 제약)

### 2.1 Vercel Fluid Compute (2025 GA)

- 기본 함수 maxDuration: 60s (Pro / Enterprise plan)
- Fluid Compute 활성 시 단일 invocation 최대 300s (5분)
- 50MB unzipped function size 제한 (lambda layer 미사용)
- Vercel `apps/web` 이 이미 Pro plan + `flowcoder25-1055` scope에서 Fluid Compute 옵트인 가능

→ 30초 SLO는 30·1페이지 한글 PDF 기준 매우 보수적. 일반적인 4-5페이지 리포트도 30s 안에 들어옴 (puppeteer 콜드 스타트 1-3초 + chromium 부팅 1-2초 + page.pdf 1-2초).

### 2.2 `@sparticuz/chromium` (vendored chromium for Vercel/Lambda)

- npm version: 137+ (2025-05 기준 안정)
- Vercel arm64 / x64 모두 지원
- 압축 후 ~50MB, 압축 해제 후 ~100MB+ 이지만 `chromium.executablePath()` 가 lazy 로 가져오므로 **함수 unzipped size 자체는 ~45MB 이하**
- Vercel 공식 docs / sparticuz README 둘 다 "Vercel Pro Fluid Compute" 권장 구성으로 명시
- 알려진 함정:
  - **dev 환경에서 macOS arm64 binary 미지원** → 로컬 dev에서는 `puppeteer` 전체 패키지(자체 Chromium 동봉) fallback 필요
  - `chromium.args` 에 `--font-render-hinting=none` 추가 권장 (서버 한글 폰트 렌더링 일관성)

### 2.3 Korean 폰트 전략

- 옵션 1: **Google Fonts CDN** — `@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700')`. 함수 bundle에 폰트 binary 추가 없음. 콜드 스타트마다 1회 CDN fetch. Vercel CDN edge cache hit 시 즉시.
- 옵션 2: **Pretendard via cdnjs/jsdelivr** — 한국 web service 표준 폰트, 가독성 우수.
- 옵션 3: **번들링 (`apps/web/public/fonts/NotoSansKR.woff2`)** — Vercel function 콜드 스타트 + Blob fetch 안정성 trade-off. 폰트 파일 1-2MB.

**결정**: WI-731 1차 구현은 옵션 1 (Google Fonts CDN, Noto Sans KR). 폰트 fetch 실패가 production에서 문제 되면 옵션 3로 전환 (페이지 size 1-2MB 증가는 50MB 한계 안에서 안전).

### 2.4 Vercel Blob

- `apps/web/lib/erp/blob.ts` 에 이미 헬퍼 존재 (영수증 OCR intake용)
- 5GB max object size — PDF 1MB 단위라 무관
- public unguessable URL 패턴 (현재 사용 중) → WI-731에서 동일 패턴 채택. Phase 22+ 에서 signed URL 도입 검토.

---

## 3. 의사결정

**채택: 옵션 A — Vercel Fluid Compute + `@sparticuz/chromium`**

근거:
1. 모노레포 일관성: `apps/web` 안에서 `/api/erp/reports/export` 라우트로 곧장 구현. 별도 워커 호스팅 / 배포 / 인증 / 모니터링 운영 surface 없음.
2. 알려진 제약 (50MB / 60s default / 30s 함수 spend 한도)이 모두 충족 가능. Pro plan + Fluid Compute 활성 전제.
3. Phase 21 dogfooding 윈도우 (M1 완료 기준 5월 말~6월 초) 와 시기적으로 정렬됨 — 외부 워커 도입은 운영팀 capacity 추가 필요.
4. 실패 시 fallback 비용 낮음 (다음 절 참조).

---

## 4. 위험 + 폴백 트리거

### 4.1 위험 매트릭스

| 위험 | 발생 가능성 | 영향 | 완화 |
|---|---|---|---|
| Function unzipped size > 50MB | 낮음 | 빌드 실패 | sparticuz는 lazy executablePath 사용. `chromium.font('arial.ttf')` 등 폰트 등록 호출 없으면 ~45MB. 빌드 시 `vercel build` 로 사전 측정. |
| Cold start > 5s | 중간 | 30s SLO 위협 | Fluid Compute는 워밍 인스턴스 재사용. 동시 호출 시 cold start 분산. |
| `page.pdf()` 한글 깨짐 | 중간 | 사용자 신뢰 | `font-display: block` 으로 폰트 로드 완료 후 PDF 생성. `await page.evaluateHandle('document.fonts.ready')` 보장. |
| Blob 업로드 실패 (네트워크 일시 장애) | 낮음 | 작업 실패 → 재시도 | jobId 패턴 (POST 202 + GET polling) → 자동 재시도 가능 |
| Chromium 메모리 초과 (1024MB function 한계) | 낮음 | 함수 OOM | 큰 리포트는 페이지 분할 + 페이지마다 puppeteer 재시작 패턴 |

### 4.2 외부 워커 폴백 트리거

WI-731 PR 의 Vercel preview 에서 다음 중 하나라도 발생 시 옵션 B 채택:
- 빌드 실패 (function size > 50MB unzipped)
- `/api/erp/reports/export` 1MB PDF 생성에 30s 초과
- 한글 폰트 렌더링이 unrecoverable (예: chromium font lookup 실패)

폴백 시 결정:
- **호스팅**: Render Web Service (Korean region 미지원 — 일본 region 사용) 또는 Railway (US-East)
- **인증**: Vercel ↔ 외부 워커 간 mTLS 또는 shared HMAC secret
- **통신**: AXLE → 외부 워커 HTTP POST → S3-like Blob 직접 업로드 → Vercel API 콜백
- 폴백 추가 lead time 예상: 1주 (호스팅 셋업 + 인프라 토큰 발급 + 도메인 구성)

---

## 5. 다음 단계 (WI-731)

1. `apps/web/package.json` 에 deps 추가:
   - `@sparticuz/chromium@^138`
   - `puppeteer-core@^24`
   - dev-only: `puppeteer@^24` (로컬 dev arm64 fallback)
2. `apps/web/lib/erp/pdf-generator.ts` — 환경별 launcher (prod: sparticuz, dev: puppeteer full)
3. `/api/erp/reports/export` POST → AiJob row 생성 (type=BUSINESS_PLAN 재사용? 아니면 새 `PDF_RENDER` enum 값) → fire-and-forget dispatch → 즉시 jobId 응답
4. `/api/erp/reports/export/[jobId]` GET → AiJob row 조회 → 진행상태 + Blob URL
5. Vercel preview 에서 30초 SLO 검증 → 실패 시 4.2 트리거 → 외부 워커 PR

---

## 6. 참고

- Vercel Fluid Compute docs: https://vercel.com/docs/functions/fluid-compute
- `@sparticuz/chromium` README: https://github.com/Sparticuz/chromium
- AXLE Blob helper: `apps/web/lib/erp/blob.ts`
- AXLE AiJob dispatcher: `packages/ai/src/dispatcher/index.ts`
- 디자인 spec WI-731: `docs/specs/2026-05-17-phase21-erp-amplification-design.md` §5
