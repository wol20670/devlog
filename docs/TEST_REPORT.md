# 테스트 보고서

> 실제로 실행한 명령과 결과만 기록한다. 실행하지 않은 항목은 "미실행"으로 남긴다.

## 테스트 구성 (계획)

| 종류 | 도구 | 대상 |
|---|---|---|
| 정적 검사 | `tsc --noEmit`, ESLint | 전체 소스 |
| 단위 테스트 | Vitest (`tests/unit`) | KST 주간 계산, 주간 통계 집계, GitHub 이벤트 정규화·rate limit 파싱, 계정 식별자 처리, zod 스키마 |
| 통합 테스트 | Vitest + PGlite (`tests/integration`) | 실제 마이그레이션 적용 후 프로젝트·기록·회고 CRUD, 타 사용자 접근 차단, 타 사용자 프로젝트 연결 거부, 프로젝트 삭제 시 기록 project_id NULL, 회고 unique |
| 실DB 검증 | Neon `dev` 브랜치 + 로컬 앱 | 마이그레이션, 로그인, CRUD, 트랜잭션 |
| 빌드 | `next build` | 프로덕션 빌드 |
| 배포 후 E2E | Playwright (프로덕션 URL) | 로그인 → CRUD → 주간 회고 → GitHub 활동 → 로그아웃 후 접근 제어 |

## 실행 결과

### 2026-10-15 — 로컬 자동 검증 (feature/dashboard, 커밋 9971846)

실행자: 메인 에이전트(Opus)가 각 기능 커밋 직전에 재실행. 환경: Windows 11, Node 24.20, PGlite(인메모리 Postgres).

| 명령 | 결과 |
|---|---|
| `npm run typecheck` (`next typegen && tsc --noEmit`) | 통과 |
| `npm run lint` | 통과 (경고 0) |
| `npm run test` | **15개 파일 / 94개 테스트 통과** (unit 10, integration 5) |
| `npm run build` | 성공 (모든 앱 라우트 Partial Prerender, `/api/auth/[...all]` Dynamic) |

테스트 파일별 범위:

| 파일 | 검증 내용 |
|---|---|
| unit/date, week | KST 오늘 경계(UTC 14:59:59/15:00:00), 날짜 유효성(윤년), 주 시작(KST 일 23:30 / 월 00:10), 연말·연초 주 |
| unit/format | UTC → KST 표시 |
| unit/stats, review-template | 기록 수·작성일 수(중복 날짜)·요일 7칸·프로젝트별 집계, 회고 기본 템플릿 |
| unit/validation-project, validation-dev-log | zod 입력 검증 |
| unit/github-events, github-http, github-activity | 이벤트 정규화(커밋 없는 PushEvent, 축약 PR), rate limit 분류, 페이지네이션(최대 3페이지), `/user` id 불일치 거부, `cache: no-store`, 반환값에 토큰 미포함 |
| integration/schema | 마이그레이션 적용, cascade, set null, unique, 트랜잭션 rollback |
| integration/projects, dev-logs, weekly-reviews, github-account | CRUD, **타 사용자 조회·수정·삭제 차단**, **타 사용자 프로젝트로 기록 연결 거부**, 조인으로 타인 프로젝트명 비노출, 주 경계 집계, GitHub 계정 조회 스코프 |

이상 사항: 브랜치 병합 직후 첫 `npm run test`에서 15개 파일이 테스트 수집 전에 실패(`no tests`). 같은 순서(typecheck → lint → test)로 2회 재실행 시 모두 통과하여 재현되지 않음. 원인 미확정.

### 2026-10-15 — 실DB·실OAuth 로컬 E2E (Neon `dev` 브랜치, `npm run dev`, Playwright)

환경: Neon 프로젝트 `devlog-db`의 `dev` 브랜치(엔드포인트 `ep-still-sea…`, 운영 `main`의 `ep-lucky-hat…`과 분리 확인), 로컬 GitHub OAuth App.

| # | 항목 | 방법 | 결과 |
|---|---|---|---|
| 1 | 마이그레이션 | `drizzle-kit migrate` (dev 브랜치 직접 연결) | ✅ 7개 테이블 생성, 적용 이력 1건 |
| 2 | WebSocket Pool 트랜잭션 | 스크립트: BEGIN → INSERT → 조회 → ROLLBACK | ✅ 트랜잭션 내 1건 → 롤백 후 0건 |
| 3 | 비로그인 라우팅 | curl | ✅ `/` 200, `/login` 200, `/dashboard` 307 → `/login` |
| 4 | OAuth 요청 | 로그인 버튼 클릭 후 GitHub authorize URL 확인 | ✅ `scope=read:user user:email`, PKCE S256, callback `localhost:3000/api/auth/callback/github` |
| 5 | GitHub 로그인 (1차) | 사용자가 GitHub 로그인 | ❌ `state_mismatch` — 로그 상 로그인 시작 01:57, 콜백 02:20(23분 경과)으로 OAuth state 만료가 원인 |
| 6 | GitHub 로그인 (2차) | 즉시 재시도 | ✅ `/dashboard` 진입 → 원인 가설(만료) 확인 |
| 7 | 토큰 저장 | DB 조회(값 미출력) | ✅ access/refresh token 모두 GitHub 평문 형식(`gho_`/`ghr_`) 아님 → **암호화 저장**, access 만료 8시간, refresh token 존재, `account_id`=GitHub 숫자 ID, scope `read:user,user:email`, 세션 7일 |
| 8 | 프로젝트 생성 | 폼 제출 | ✅ 상세 이동, 생성 시각 KST(11:22, UTC 02:22) |
| 9 | 기록 생성(프로젝트 연결) | `/logs/new?projectId=` | ✅ 날짜 기본값 KST 오늘, 프로젝트 기본 선택, 저장·상세 표시 |
| 10 | 기록 수정 | 제목 변경 | ✅ 반영 |
| 11 | 주간 회고 | `/reviews/2026-10-12/new` | ✅ 실제 기록 기반 템플릿 생성·저장, 주간 통계 1건/1일, 다음 주(미래) 버튼 비활성 |
| 12 | 회고 중복 작성 | 같은 주 `/new` 재방문 | ✅ 상세로 redirect |
| 13 | 존재하지 않는 리소스 | 임의 uuid 프로젝트, 월요일 아닌 주 | ✅ "페이지를 찾을 수 없습니다" |
| 14 | GitHub 활동 | `/github` | ✅ `@wol20670` 확인, **3페이지 300건**(API 상한) 조회, 기간 09-21~10-08(30일 이내), 유형별 이벤트 수·범위 안내 표시, 푸시는 compare 링크 |
| 15 | 대시보드 | `/dashboard` | ✅ 통계·최근 기록·프로젝트·회고·GitHub 5건 표시 |
| 16 | 프로젝트 삭제 | 확인 대화상자 수락 | ✅ 기록 유지, "프로젝트 없음" 표시(DB `project_id` NULL 확인) |
| 17 | 로그아웃 후 접근 | 기록 상세 URL 직접 접근 | ✅ `/login`으로 이동, DB session 0건 |

발견 사항 → 수정 작업 진행 중:
- dev 콘솔: 페이지 간 이동 시 Next.js instant navigation 검증 경고(페이지 수준 Suspense 부재). 기능 영향 없음, UX/성능 개선 대상.
- dev 전용: Next.js dev 도구 버튼이 사이드바 로그아웃 버튼 클릭을 가로챔(Playwright에서 클릭 실패, JS 클릭으로 우회).
- OAuth state 만료 시 일반 오류 문구만 표시 → 원인별 안내 필요.

### 2026-10-15 — E2E 후속 수정 재확인 (로컬)
- `npm run test`: 16 files / 98 tests 통과 (auth-errors 단위 테스트 추가)
- 로그인 후 대시보드 → 프로젝트 → 개발 기록 → 주간 회고 → 대시보드 클라이언트 이동: 콘솔 오류 0건 (instant navigation 경고 해소)
- 사이드바 로그아웃 버튼 일반 클릭 동작 (dev indicator 우하단 이동)
- `/login?error=oauth&error=state_mismatch` → "로그인 요청 시간이 만료되었습니다. 다시 로그인해 주세요."

### 2026-10-15 — 프로덕션 E2E (https://devlog-psi-three.vercel.app)

| # | 항목 | 배포 | 결과 |
|---|---|---|---|
| 1 | 비로그인 라우팅 (curl) | `c81eb84` | ✅ `/` 200, `/login` 200, `/api/auth/ok` 200, `/dashboard` 307 → `/login` |
| 2 | OAuth 요청 | `c81eb84` | ✅ 프로덕션 client_id, scope `read:user user:email`, PKCE S256, callback `https://devlog-psi-three.vercel.app/api/auth/callback/github` |
| 3 | 로그인 (1차) | `c81eb84` | ❌ `invalid_code` — 런타임 로그 `incorrect_client_credentials`(Client Secret 불일치) |
| 4 | 로그인 (Secret 교체·재배포 후) | `c81eb84` 재배포 | ✅ `/dashboard` |
| 5 | 프로젝트 생성 → 기록 생성(프로젝트 연결) → 주간 회고 작성 | 〃 | ✅ 회고 템플릿에 실제 기록·문제/해결 반영 |
| 6 | GitHub 활동 | 〃 | ✅ `@wol20670`, 300건, 기간 09-21 ~ 10-15 |
| 7 | 저장 위치·보안 | 〃 | ✅ Neon `main`(`ep-lucky-hat…`)에 user/session/project/log/review 각 1건, OAuth 토큰 평문 아님, refresh token 존재 |
| 8 | 모바일 375px | 〃 | ✅ 가로 넘침 없음(scrollWidth 360 ≤ 375), 요일 막대 정상 |
| 9 | 로그아웃 후 보호 페이지 | 〃 | ✅ `/login` 이동 |
| 10 | 런타임 로그 점검 | 〃 | ⚠️ 일시적 DB 연결 시간 초과 1건, 이 오류 로그에 세션 토큰 평문 기록 → PR #8로 redaction 적용 |
| 11 | 최종 재검증 (로그인 → 대시보드 기존 데이터 → GitHub → 로그아웃 → 보호 페이지) | `411cb8c` | ✅, 해당 배포 런타임 오류 0건 |

### 자동 테스트 최종 (main `411cb8c`)
- `npm run typecheck` / `npm run lint` / `npm run build` 통과
- `npm run test`: **17 files / 105 tests 통과** (log-redaction 단위 테스트 7개 추가)

### 검증하지 않은 항목 (한계)
- 두 번째 GitHub 계정을 사용한 운영 환경 교차 사용자 접근 시험은 하지 않음. 사용자 간 데이터 격리는 통합 테스트(PGlite, 실제 마이그레이션)로 검증.
- Preview 배포의 인증 기능(설계상 미지원).
- GitHub API rate limit 초과 상황의 실제 재현(단위 테스트로만 검증).
- 일시적 DB 연결 시간 초과의 원인 규명(재현되지 않음).
