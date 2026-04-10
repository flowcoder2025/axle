# API Standard Contract — AXLE

## 응답 형식

### 성공 (단건)
```json
{ "data": T }
```

### 성공 (목록)
```json
{ "data": T[], "total": number, "page": number, "pageSize": number }
```

### 에러
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "필드명 is required" } }
```

## HTTP Status
| Code | 용도 |
|------|------|
| 200 | 조회/수정 성공 |
| 201 | 생성 성공 |
| 400 | 입력 검증 실패 (Zod) |
| 401 | 미인증 |
| 403 | 권한 없음 (ReBAC) |
| 404 | 리소스 없음 |
| 500 | 서버 에러 |

## 공통 규칙
- 모든 API Route는 try-catch로 감싸고 500 시 에러 로그
- 날짜는 ISO 8601 (UTC)
- 페이지네이션: `?page=1&pageSize=20` (기본값 page=1, pageSize=20)
- 인증: `auth()` → 미인증 시 401
- 권한: `check(namespace, objectId, relation, 'user', userId)` → 실패 시 403
- 입력 검증: Zod schema `.parse(body)` → 실패 시 400
- orgId 필터: 모든 목록 API에 `orgId` 필수 (세션에서 추출)
