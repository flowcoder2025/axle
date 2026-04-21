# rhwp (edwardkim/rhwp) 채택 평가

**평가일:** 2026-04-21
**대상 버전:** v0.7.3 (2026-04-19 릴리스)
**저장소:** https://github.com/edwardkim/rhwp
**라이선스:** MIT

## 결론: 현재는 채택 보류, v1.0+ 시점 재평가

## 평가 근거

### 장점
- **MIT 라이선스** — 상업 이용/수정/재배포 자유
- **Rust + WASM** — 성능·이식성 우수
- **HWP 5.0 / HWPX 파싱·렌더링** 성숙: 문단, 표, 이미지, 수식, 머리말/꼬리말, 셀 병합, 다단, 마스터 페이지
- **웹 에디터 번들**(`@rhwp/editor`) 제공 — 미리보기/편집 UI 즉시 임베드 가능
- **hwpctl 호환** — ParameterSet API, Field API, 템플릿 바인딩 지원
- **한컴 한글 포맷의 첫 오픈소스 편집기**로 주목도 ↑ (단, 한컴의 공식 승인은 아님)
- **SVG 내보내기** 가능 — PDF 렌더 경로 확보

### 단점 / 차단 요인
1. **HWPX 저장 기능 v0.7.3에서 비활성화** ("데이터 손상 방지" 이유, #197 완전 변환기 완성 대기)
   - AXLE 유스케이스(양식 자동 채우기 후 HWPX 재생성)에 치명적
2. **알파 단계** — 로드맵상 프로덕션 안정 목표는 **v3.0.0**
3. **Node.js 서버사이드 지원 명시 없음** — 문서는 브라우저 WASM/웹 에디터 위주
4. **양식 필드 채우기 API**(체크박스 토글, 셀 값 입력, 텍스트 치환) 문서 미노출
5. **Vercel 서버리스 환경 WASM 로딩** 공식 가이드 없음 — 콜드스타트·바이너리 크기 리스크

### AXLE 유스케이스 매칭
| 요구 기능 | rhwp 현재 | 평가 |
|---|---|---|
| HWPX 템플릿 읽기 | ✅ | 가능 |
| 셀/체크박스 프로그래매틱 편집 | ⚠️ API 문서 없음 | 불확실 |
| HWPX 재저장 | ❌ (v0.7.3 비활성) | **차단** |
| Vercel 서버리스 실행 | ⚠️ 미확인 | 리스크 |
| 웹 브라우저 미리보기 | ✅ | 유용 |
| 공인인증 서명·제출 연계 | ❌ | 범위 외 |

## 권장 전략

### 단기 (현재 ~ v1.0 이전)
- **유지**: `packages/docgen/src/converters/hwpx-editor.ts` 의 ZIP + XML 직접 조작 방식
  - HWPX 가 OOXML 유사 ZIP 컨테이너이므로 셀/체크박스/텍스트 치환 수준은 충분
- **추가**: HWPX editor 인터페이스를 adapter 패턴으로 감싸 교체 가능하게 분리 (WI-210)
  ```ts
  interface HwpxEditorAdapter {
    loadTemplate(buf: Buffer): Promise<HwpxDoc>
    applyEdits(doc: HwpxDoc, edits: HwpxEdit[]): Promise<HwpxDoc>
    save(doc: HwpxDoc): Promise<Buffer>
  }
  ```

### 중기 (rhwp v1.0 릴리스 후)
- **미리보기 경로**: `@rhwp/core` WASM을 브라우저에서 로드해 HWPX 실시간 렌더링 (현재 PDF 변환 후 미리보기보다 UX ↑)
- **SVG 내보내기**: rhwp CLI로 HWPX → SVG 변환 후 인쇄 고해상도 미리보기

### 장기 (rhwp v3.0 프로덕션 안정 후)
- **adapter 교체 실행**: `HwpxEditorAdapter` 구현체를 rhwp 기반으로 스왑
- **편집 UI 삽입**: 플랫폼에서 고객이 직접 HWPX 편집 (`@rhwp/editor` 임베드)
- **서명 연동**: PKCS#12 서명 기능이 rhwp에 추가되면 Desktop 포털 자동화 대체 가능성

## 모니터링 지표 (재평가 트리거)
- [ ] #197 HWPX 완전 변환기 머지 여부
- [ ] v1.0 릴리스 (프로덕션 안정성 선언)
- [ ] Node.js server-side 빌드 타겟 공식 지원
- [ ] Field API / ParameterSet 예제 공개
- [ ] Vercel/Lambda WASM 실행 케이스 스터디

## 관련 WI
- WI-208: `/api/hwpx/edit` POST — 현재는 custom ZIP/XML 로직 사용
- WI-209: HWPX 템플릿 관리 Admin UI
- WI-210: rhwp 채택 여부 재평가 훅 (adapter 인터페이스 분리)
- WI-301/308/311: 벤처/소부장/KOITA 양식 HWPX 자동 채우기 — custom 로직으로 선행 구현
