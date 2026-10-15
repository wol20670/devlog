# 아키텍처

> 상태: v1.0 설계 (2026-10-15 작성). 구현 중 변경 사항은 "설계 변경 기록"에 추가한다.

## 1. 기술 선택과 이유

| 영역 | 선택 | 이유 |
|---|---|---|
| Framework | Next.js 16.4 (App Router) | 별도 API 서버 없이 Server Components·Server Actions·Route Handler로 서버 로직 처리. Vercel 배포와 궁합 |
| Language | TypeScript | 스키마 → 쿼리 → UI까지 타입 연결 |
| Styling | Tailwind CSS 4 | create-next-app 기본, 일관된 유틸리티 스타일 |
| DB | PostgreSQL (Neon, Vercel Marketplace) | 서버리스 친화적 관리형 Postgres, 브랜치로 개발/운영 분리 |
| ORM | Drizzle ORM + drizzle-kit | 타입 안전한 SQL, 마이그레이션 파일 기반 스키마 관리 |
| DB 드라이버 | `drizzle-orm/neon-serverless` (`Pool`, WebSocket) | `neon-http`는 interactive transaction을 지원하지 않음("No transactions support in neon-http driver"). Better Auth Drizzle 어댑터와 다중 쓰기 작업에서 트랜잭션 보장을 위해 선택 |
| 인증 | Better Auth 1.7 (GitHub provider, Drizzle adapter) | 안정 1.x, Drizzle 공식 어댑터, Next.js App Router 지원, OAuth 토큰 암호화 옵션 제공. Auth.js v5는 조사 시점(2026-10-15)에 beta |
| 입력 검증 | zod 4 | 서버 액션 입력 검증 |
| 테스트 | Vitest + PGlite | PGlite(WASM Postgres)에 실제 마이그레이션을 적용해 외부 DB 없이 CRUD·소유권 테스트 |

## 2. 계층 구조

```
Browser
  │  (form / Server Action)
  ▼
src/app/**            Server Components (페이지) — 데이터 조회 함수 호출, UI 렌더링
src/actions/*         "use server" — requireUser() → zod 검증 → server 계층 호출 → revalidate/redirect
src/server/*          데이터 접근 계층 — (db, userId, ...) 시그니처, 모든 쿼리 userId 스코프
src/db/*              Drizzle 클라이언트(Pool 싱글턴) + 스키마
src/lib/*             auth 설정, 세션 헬퍼, 날짜(KST 주간) 유틸 등 순수 로직
src/proxy.ts          세션 쿠키 존재 여부로 낙관적 리다이렉트 (보안 경계 아님)
```

- 보안 경계는 **서버 계층**이다. 페이지·액션은 `requireUser()`로 세션을 검증하고, `src/server/*`는 항상 `userId`를 조건에 포함한다.
- UI 컴포넌트는 DB에 직접 접근하지 않는다.

## 3. DB 설계

```
user 1─* account          (Better Auth: GitHub OAuth 계정, 토큰 암호화 저장)
user 1─* session          (Better Auth)
user 1─* projects
user 1─* dev_logs  *─0..1 projects   (프로젝트 삭제 시 project_id = NULL)
user 1─* weekly_reviews   (user_id, week_start) UNIQUE
```

| 테이블 | 주요 컬럼 |
|---|---|
| `projects` | id uuid PK, user_id FK→user ON DELETE CASCADE, name, description, status(`planning`/`active`/`paused`/`completed`), created_at, updated_at |
| `dev_logs` | id uuid PK, user_id FK CASCADE, project_id FK→projects ON DELETE SET NULL (nullable), log_date `date`, title, work_done, learned, problems, solutions, created_at, updated_at. INDEX(user_id, log_date) |
| `weekly_reviews` | id uuid PK, user_id FK CASCADE, week_start `date`(KST 월요일), title, content, created_at, updated_at. UNIQUE(user_id, week_start) |

### 날짜·시간
- `created_at`/`updated_at`: `timestamptz`(UTC) 저장, 화면에는 `Asia/Seoul`로 표시.
- `log_date`, `week_start`: 사용자가 의미하는 **KST 달력 날짜**이므로 `date` 타입. 서버 시간대(Vercel은 UTC)에 의존하지 않도록 "오늘"·"이번 주"는 `Asia/Seoul` 기준으로 계산.
- 주간 = KST 월요일 00:00 ~ 일요일 23:59.

## 4. 인증 흐름

1. `/login` → Better Auth `signIn.social({ provider: "github" })`
2. GitHub OAuth (scope: `read:user`, `user:email` — 최소 권한) → `/api/auth/callback/github`
3. Better Auth가 `user`/`account`/`session` 저장. `account.encryptOAuthTokens: true`로 access token 암호화.
4. 세션 쿠키로 로그인 유지. `(app)` 레이아웃·모든 서버 액션에서 `requireUser()`.

### 식별자 구분
- `account.id`: Better Auth 내부 PK → `auth.api.getAccessToken({ body: { accountId } })`에 사용.
- `account.accountId`: GitHub 사용자 숫자 ID(외부 식별자) → GitHub `GET /user` 응답의 `id`와 비교.
- GitHub 로그인명은 사용자가 수정 가능한 프로필 필드(`user.name`)를 쓰지 않고, 요청 시 토큰으로 `GET /user`를 호출해 얻는다.

## 5. GitHub 활동 조회

- `GET /user` → `login` 확인 → `GET /users/{login}/events/public?per_page=100&page=1..3`
- 공식 문서(2026-10-15 확인): 타임라인은 최대 300개, 최근 30일 이내 이벤트만 포함.
- 모든 GitHub 요청은 `cache: 'no-store'` (사용자 토큰을 쓰는 응답이 공유 캐시에 남지 않도록). 모듈은 `server-only`.
- 오류: 401 → 재로그인 안내, 403/429 + `x-ratelimit-*` → 재시도 가능 시각 안내, 그 외 → 오류 카드.
- 화면에서 "DevLog 기록 통계"와 "GitHub 공개 이벤트"를 분리해 표기. GitHub 수치는 전체 커밋/기여 통계가 아님을 명시.

## 6. 배포 구성

- Vercel (Production Branch `main`), Node.js 런타임(Fluid Compute).
- Neon 브랜치: `main` = Production 전용, `dev` = 로컬·테스트·Preview.
- 상세는 [DEPLOYMENT.md](DEPLOYMENT.md).

## 7. 설계 변경 기록

| 날짜 | 변경 | 이유 |
|---|---|---|
| 2026-10-15 | DB 드라이버를 `neon-http` → `neon-serverless`(Pool)로 결정 | neon-http의 트랜잭션 미지원 |
| 2026-10-15 | GitHub 조회 범위를 "최근 30일·최대 300건"으로 정정 | 최신 공식 문서 확인 결과 (초안의 90일은 오류) |
| 2026-10-15 | GitHub 요청 캐시 비활성(`no-store`) | 사용자 토큰 기반 응답의 캐시 격리 설계 전까지 안전 우선 |
