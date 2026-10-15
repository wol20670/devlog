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

### 미실행 (다음 단계)
- 실제 Neon `dev` 브랜치 마이그레이션·CRUD·트랜잭션 검증 — DB 브랜치 생성 대기
- 실제 GitHub OAuth 로그인·활동 조회 — 로컬 OAuth App 키 입력 대기
- 프로덕션 배포 후 E2E
