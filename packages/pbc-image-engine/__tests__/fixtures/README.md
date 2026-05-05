# PBC Image Engine — Test Fixtures

이 디렉토리는 **두 가지 통합 테스트 케이스**(WI-409)에서 공유하는 응답 fixture입니다.

| 파일 | 출처 API | 용도 |
|---|---|---|
| `google-genai-create-response.json` | `POST /v1beta/models/{model}:generateContent` | CREATE 모드 정상 응답. 이미지 바이트는 1x1 PNG로 치환 |
| `google-genai-blocked-response.json` | 동상 | SAFETY filter 차단 응답 (`promptFeedback.blockReason`) |
| `comfyui-prompt-response.json` | ComfyUI `POST /prompt` | 정상 큐 등록 응답 |
| `comfyui-history-success.json` | ComfyUI `GET /history/{prompt_id}` | 실행 성공 응답 (`status_str === "success"`) |
| `comfyui-history-error.json` | 동상 | 실행 에러 응답 (`status_str === "error"`) |
| `sample-png-1x1.base64.txt` | n/a | 1x1 transparent PNG. 실제 이미지 바이트 모킹용 |

## CI 동작

기본 `npm test`는 fixture를 mocked `fetch`에 주입하여 두 provider의 end-to-end 디코딩을 검증합니다 (`__tests__/integration/fixtures-smoke.test.ts`). 네트워크 호출 없이 통과하므로 CI에서 항상 실행됩니다.

## 라이브 호출 (수동, secrets 필요)

`npm run test:integration`은 `*.live.test.ts`를 실행합니다. 환경변수가 누락되면 `it.skipIf`로 자동 스킵됩니다.

| 변수 | 필요 시점 | 비고 |
|---|---|---|
| `GEMINI_API_KEY` | Google GenAI live test | https://aistudio.google.com/app/apikey |
| `COMFYUI_LOCAL_URL` | ComfyUI live test | 기본 `http://127.0.0.1:8188` |

비용 가드: spec(`pbc-image-engine.md` §5)의 "통합 테스트 cost ≤ $0.5" 조건을 지키기 위해 live test는 **각 provider 1회씩만** 호출합니다.

```bash
# Google만
GEMINI_API_KEY=... npm run test:integration -w @axle/pbc-image-engine -- googleGenAI.live

# 로컬 ComfyUI만 (서버가 떠 있어야 함)
COMFYUI_LOCAL_URL=http://127.0.0.1:8188 npm run test:integration -w @axle/pbc-image-engine -- comfyuiLocal.live

# 둘 다
GEMINI_API_KEY=... COMFYUI_LOCAL_URL=... npm run test:integration -w @axle/pbc-image-engine
```

## Fixture 갱신 절차

응답 형태가 바뀌면(예: provider API 변경) live test를 1회 실행하여 실제 응답을 캡처한 뒤, 다음 단계를 따릅니다.

1. live test에서 `console.log(JSON.stringify(response, null, 2))`로 응답 출력.
2. 출력의 이미지 base64를 `sample-png-1x1.base64.txt`의 1x1 PNG로 치환 (저작권/용량 회피).
3. 해당 fixture JSON 갱신 후 `npm test`가 여전히 통과하는지 확인.
4. PR description에 갱신 사유와 응답 차이를 기록.

## 왜 1x1 PNG로 치환하나

- 실제 모델 출력 이미지는 저작권/필터 위험이 있어 레포에 커밋할 수 없습니다.
- 디코딩 경로 검증에는 valid PNG bytes만 있으면 충분합니다 (어댑터가 base64 → bytes 변환을 수행할 뿐, 픽셀을 해석하지 않음).
- 1x1 transparent PNG는 67 bytes로 부담이 없습니다.
