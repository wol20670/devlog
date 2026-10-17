# 진행 기록

> 실제 수행한 작업만 기록한다. 계획은 [RELEASE_PLAN.md](RELEASE_PLAN.md) 참고.

## 2026-10-15

### 프로젝트 착수
- 작업 디렉터리 검사: 빈 디렉터리, Git 저장소 아님 → 신규 프로젝트로 판단.
- 환경 확인: Node 24.20, npm 11.19, git 2.55, gh 2.58(로그인됨), Claude Code 2.1.289. Vercel CLI 미설치 → `npx vercel` 사용.
- 최신 버전 확인: next 16.4.1, drizzle-orm 0.45.4, drizzle-kit 0.31.11, better-auth 1.7.8, zod 4.6.7, vitest 5.0.4.
- 설계 확정 및 사용자 리뷰 2회 반영:
  - 인증 라이브러리: Better Auth (Auth.js v5는 beta)
  - DB 드라이버: neon-http → neon-serverless(Pool) (트랜잭션 지원)
  - GitHub Events API 범위 정정: 최근 30일·최대 300건
  - Neon 개발/운영 브랜치 분리, OAuth 토큰 암호화, GitHub 요청 `no-store`
- 모델 역할 분담 도입: 메인 Opus 5.5(설계·리뷰·Git·배포), 구현 Sonnet 5.5 서브에이전트(`.claude/agents/devlog-implementer.md`).

### 스캐폴딩
- `create-next-app@latest`로 Next.js 16.4.1 + TypeScript + Tailwind 4 + ESLint 생성.
  - 문제: 디렉터리명 `Dev-log`의 대문자 때문에 npm 패키지명 제약으로 현재 폴더에 직접 생성 실패.
  - 해결: 임시 디렉터리에 `devlog`로 생성 후 프로젝트 폴더로 복사.
- `.gitignore`: `.env*` 무시 유지 + `!.env.example` 예외 추가.
- 문서 골격 작성: CLAUDE.md, README.md, CHANGELOG.md, docs/*.
- `.gitattributes`(`eol=lf`) 추가 — Windows CRLF 변환 경고 제거, 줄바꿈 일관성 확보.
- 초기 커밋 후 GitHub 저장소 생성·푸시: https://github.com/wol20670/devlog (Public, `main`).

### 구현 서브에이전트 검증
- `.claude/agents/devlog-implementer.md` 생성 (`model: claude-sonnet-5-5`, tools: Read/Write/Edit/Glob/Grep/Bash/PowerShell).
- 문제: 에이전트 파일을 세션 시작 이후에 만들어 현재 세션의 Agent 도구가 `devlog-implementer`를 인식하지 못함(`Agent type not found`).
- 검증: 새 headless 세션 `claude -p --agent devlog-implementer --output-format json` 실행 → 정의 로드 성공, `modelUsage`에 `claude-sonnet-5-5` 확인 (haiku는 Claude Code 내부 보조 호출).
- 조치: Claude Code 세션 재시작 → Agent 도구에서 `devlog-implementer` 인식 확인.
- 첫 구현 작업 후 서브에이전트 transcript(`subagents/agent-*.jsonl`) 확인: assistant 메시지 37개 모두 `"model":"claude-sonnet-5-5"`, meta `agentType: devlog-implementer`.

### 인프라 (Vercel / Neon)
- `vercel login`(사용자) → `vercel link --project devlog`로 Vercel 프로젝트 `wol20670s-projects/devlog` 생성.
  - 문제: 프로젝트 생성 중 GitHub 저장소 연결 실패(Vercel GitHub App 미설치로 추정). → 사용자에게 대시보드에서 Git 연결 요청.
  - 문제: `vercel link`가 `.gitignore` 끝에 `.env*`를 다시 추가해 `!.env.example` 예외가 무효화됨 → 해당 변경 되돌림, `git check-ignore`로 확인.
- Neon 요금제 조회(`free_v3` / `launch_v3` / `scale_v3`) 후 **Free** 플랜으로 `devlog-db` 생성, **Production 환경에만** 연결(`-e production`).
  - `vercel env ls`로 DATABASE_URL 등 Neon 변수가 Production 스코프에만 있는 것 확인.
  - 통합 설치 시 Neon 에이전트 스킬(`.agents/`, `.claude/skills/neon*`, `skills-lock.json`)이 함께 설치됨 → 로컬 도구로 보고 `.gitignore` 처리.

### feature/auth-db (1/2) — DB 계층·Better Auth 설정 (구현: Sonnet 5.5)
- Drizzle 스키마(Better Auth 4개 테이블 + projects/dev_logs/weekly_reviews), 초기 마이그레이션 생성.
- `neon-serverless` Pool: lazy 싱글턴(globalThis), `attachDatabasePool`(@vercel/functions 3.10) 적용, Node 24 내장 WebSocket 사용.
- Better Auth: GitHub provider, `account.encryptOAuthTokens: true` (설치 버전에서 옵션 존재 확인).
- Vitest unit/integration 분리, PGlite에 실제 마이그레이션 적용 후 스키마 테스트 5개.
- 리뷰(Opus): Better Auth Drizzle 어댑터가 insert/mutate 시 `db.transaction()`을 직접 호출함을 확인 → neon-http 대신 WebSocket 드라이버 선택이 필수였음을 재확인. 어댑터 `transaction: true`, scope 중복 제거, typecheck 스크립트 보완은 2/2에 반영 지시.
- 검증(Opus 재실행): typecheck ✓ / lint ✓ / test 5/5 ✓ / build ✓. 커밋 `0e4c6e3`.
- 참고: `@types/node`를 ^20 → ^24로 상향(vitest 5 peer 요구, 런타임 Node 24와 일치).

### feature/auth-db (2/2) ~ feature/dashboard — 기능 구현 (구현: Sonnet 5.5, 리뷰·검증·커밋: Opus 5.5)
| 브랜치 | 커밋 | 내용 | 리뷰에서 발견·조치 |
|---|---|---|---|
| feature/auth-db | c402af5 | 인증 라우트, requireUser, proxy, 로그인·앱 셸 | 만료/위조 쿠키 시 proxy ↔ requireUser **리다이렉트 루프** 발견 → proxy의 /login 리다이렉트 제거, 로그인 페이지가 DB 세션으로 판단. `runtime = "nodejs"`는 cacheComponents와 비호환이라 제거 |
| feature/projects | 19fab89 | 프로젝트 CRUD | 이상 없음 |
| feature/dev-logs | d6ffce7 | 개발 기록 CRUD, 프로젝트 상세의 기록 목록 | 소유권 검증 직후 프로젝트 삭제 경쟁 조건 → 트랜잭션 내 `FOR SHARE` 잠금 추가 |
| feature/weekly-review | ab4364e | 주간 통계·회고 CRUD·기본 템플릿 | 이상 없음 |
| feature/github-activity | 3f5b524 | GitHub 공개 활동 | 공식 문서 확인 결과 PushEvent에 commits/size 없음 → 커밋 수 대신 이벤트 수 표시. Better Auth 소스로 `getAccessToken`이 내부 account.id로 조회함을 확인 |
| feature/dashboard | 9971846 | 대시보드, 모바일 넘침 보정, loading 스켈레톤 | GitHub 섹션을 별도 Suspense로 분리해 외부 API 지연이 전체 렌더를 막지 않게 함 |

- 병렬 작업: 주간 회고(메인 디렉터리)와 GitHub 활동(git worktree)을 동시에 구현.
  - 문제: Agent 도구의 자동 worktree가 `origin/main`(스캐폴드) 기준으로 생성되어 구현 전제 코드가 없었음 → 메인 에이전트가 `git worktree add -b feature/github-activity ../devlog-github d6ffce7`로 직접 생성 후 재지시. 완료 후 `feature/dashboard`에 병합, worktree 제거.
- 모든 기능 브랜치를 origin에 푸시. `main` 병합은 실제 DB·OAuth 검증 후 진행 예정.
- 서브에이전트 모델 확인: 이 시점에는 첫 호출 transcript만 확인했음(전체 확인은 아래 릴리즈 항목 참고).

### 로컬 실DB·실OAuth 검증
- Neon CLI 로그인(사용자) 후 `dev` 브랜치 생성, `.env.local`에 dev pooled URL 기록(값 미출력), 마이그레이션 적용, WebSocket Pool 트랜잭션(BEGIN/ROLLBACK) 확인.
- 문제: 첫 로그인 `state_mismatch` → 서버 로그로 로그인 시작(01:57)과 콜백(02:20) 사이 23분 경과 확인, OAuth state 만료가 원인. 즉시 재시도로 가설 검증·성공.
- Playwright E2E 17항목(TEST_REPORT 참고). 발견 3건(instant navigation 경고, dev 도구 버튼이 로그아웃 버튼 가림, state 만료 안내 부족)을 `fix: address findings from local E2E`로 수정 후 재확인(콘솔 오류 0).

### main 병합 (PR #1~#6)
- 기능 브랜치 순서대로 PR 생성·병합: #1 auth-db, #2 projects, #3 dev-logs, #4 weekly-review, #5 github-activity, #6 dashboard.
- 문제: #6이 GitHub에서 CONFLICTING으로 표시 → 로컬에서 `origin/main` 병합 시 충돌 없이 병합됨(github-activity가 로컬 병합과 PR #5 두 경로로 들어간 이력 차이). 재검증(98 tests) 후 병합.

### 배포 (Vercel / Neon main)
- (a) 프로덕션 도메인 `devlog-psi-three.vercel.app` 확인.
- 사용자: Vercel GitHub App 설치로 저장소 연결(CLI `vercel git connect`는 2회 실패), 프로덕션 OAuth App 생성, `GITHUB_CLIENT_ID/SECRET`을 Production에만 직접 등록.
- (b) Production `BETTER_AUTH_SECRET`(신규)·`BETTER_AUTH_URL`, Preview `BETTER_AUTH_SECRET`·`DATABASE_URL`(Neon dev) 등록. Production `DATABASE_URL`이 `main` 엔드포인트임을 확인.
- (c) Neon `main`이 빈 상태임을 확인 후 마이그레이션 적용.
- (d) PR #7(docs) 병합으로 첫 Git 연동 프로덕션 배포(`c81eb84`, 42초, Ready). 배포 메타 `githubCommitSha`와 로컬 main HEAD 일치 확인.
- 문제: 프로덕션 로그인 `invalid_code` → 런타임 로그에서 GitHub `incorrect_client_credentials` 확인. Client ID는 authorize URL에서 프로덕션 앱 값으로 확인되어 Secret 불일치로 판단. 사용자가 Secret 재발급·교체 → 재배포 후 성공.
- 문제: 런타임 로그에서 일시적 DB 연결 시간 초과(1건) 시 Better Auth가 Drizzle 오류를 그대로 출력해 **세션 토큰이 로그에 평문 기록**됨을 발견. 해당 세션은 로그아웃으로 삭제되어 무효(운영 활성 세션 0 확인). `fix: redact database query params from auth logs`(PR #8)로 Better Auth 로거에 redaction 적용.
  - 함수 리전 확인: 함수는 `iad1`(DB `aws-us-east-1`과 동일 지역). 로그의 `icn1`은 엣지 진입 리전이었음(초기 가설 "리전 불일치"는 틀렸음). 연결 시간 초과 원인은 미확정, 재현되지 않음.
- PR #8 병합 → 프로덕션 배포(`411cb8c`) → 로그인·대시보드·GitHub·로그아웃 재검증, 해당 배포 런타임 오류 0건.

### 릴리즈 준비
- 서브에이전트 실행 모델 전수 확인: `devlog-implementer` 실행 9건, transcript의 assistant 메시지 338개 모두 `"model":"claude-sonnet-5-5"`.

| 작업 | 메시지 수 |
|---|---|
| DB layer and Better Auth server config | 37 |
| Auth routes, session guard, app shell UI | 49 |
| Project CRUD | 42 |
| Daily dev log CRUD | 54 |
| Weekly stats and reviews | 43 |
| GitHub public activity | 40 |
| Dashboard and UI polish | 49 |
| Fix findings from local E2E | 12 |
| Redact DB query params from auth logs | 12 |

## 2026-10-17 — v2 착수

### 계획 확정
- v2.0/v2.1 실행 계획을 rev.1 → rev.4 final까지 사용자 리뷰로 보정하고 확정(승인 범위: Phase 0, Phase 1a, dev DB 마이그레이션).
  - rev.4 final 마지막 보정 3건: PR 상세 요청과 `pr_details` 리소스 상태 연결(같은 트랜잭션 dirty), 리뷰 300개 상한과 부재 기반 삭제의 충돌(리뷰 upsert 전용으로 단순화), `processed_generation` 갱신 조건(pass 세대 + 결과 5종 단일 SQL).
  - GitHub 공식 문서로 확인: 리뷰 목록은 시간순·개수 제한 없음, 제출된 리뷰는 삭제 불가, PR 커밋 목록은 최대 250개.

### Phase 0 — 문서·브랜치
- `main`(`6a64eab`)에서 `release/v2` 생성·푸시. v2 작업은 `release/v2` 기준으로 PR 병합.
- 2026-10-15 블로그 발행 설계 초안(`docs/blog-publishing-design`, draft PR #10)은 지우지 않고 `docs/v2-phase0`에 merge로 가져와 v2.1 기준으로 갱신했다. PR #10은 그대로 둔다.
- 문서: `V2_ARCHITECTURE.md` 신규(확정 계획 §3·§4·§6·§8·§9, 섹션 번호 유지), `RELEASE_PLAN.md`(v2.0·v2.1 범위·구현 순서·완료 조건·승인 기록, 기존 v2 항목은 v2.x로 이동), `BLOG_PUBLISHING_DESIGN.md`(독립 posts·publications, App 2개, 템플릿 전용 초안, 2단계 배포 추적, 미결정 사항 정리 — 이미지 처리만 미결정으로 남김), `CLAUDE.md`·구현 에이전트 지침(v2 원칙), `ARCHITECTURE.md`(v2 안내·설계 변경 기록).
- 병렬 작업: Phase 1a 구현(메인 작업 트리, `feature/v2-schema`)과 Phase 0 문서(scratchpad의 git worktree, `docs/v2-phase0`)를 동시에 진행해 파일 충돌을 피했다.

### Phase 1a — v2 DB 스키마 (구현: Sonnet 5.5, 리뷰·검증·DB 적용: Opus 5.5)
- 브랜치 `feature/v2-schema`(`release/v2` 기준). 구현 서브에이전트가 스키마·마이그레이션·통합 테스트·`scripts/check-constraints.mjs`를 작성.
- 리뷰(Opus)에서 발견·조치:
  - drizzle-kit이 `projects`·`dev_logs`의 `UNIQUE(id,user_id)` 추가를 파일 끝에 생성 → 이 UNIQUE를 참조하는 `project_repos_project_fk`가 먼저 실행돼 실패. 적용 전에 UNIQUE를 FK 앞으로 수동 재정렬하고 파일 첫 줄에 이유를 주석으로 남김(V2_ARCHITECTURE §4.5-8).
  - 이름을 지정하지 않은 설치 FK의 기본 이름이 66자 → PostgreSQL이 63자로 잘라 drizzle 스냅샷 이름과 DB 이름이 달라짐(이후 DROP 마이그레이션 실패 위험). `connected_repos_installation_fk`로 명시하고 0001을 재생성, 모든 제약·인덱스 이름 63자 이하 테스트 추가.
- 검증(Opus 재실행): typecheck ✓ / lint ✓ / test 165/165 ✓ / build ✓. 커밋 `b4545f0`.
- dev DB 적용: 엔드포인트 `ep-still-sea…` 확인, 기존 이력 해시 일치 확인 → `drizzle-kit migrate` → `check-constraints` 48항목 OK, 적용 해시가 커밋 파일과 일치, 기존 데이터 유지. 운영 DB 미적용.
- Git: Phase 0 PR #11 병합은 자동 모드에서 "리뷰 없는 병합"으로 차단되어 사용자 확인 대기. Phase 1a 브랜치는 `docs/v2-phase0`을 merge한 stacked 브랜치로 PR 생성.
- 참고: `check-constraints.mjs`가 `.ts`를 import할 때 Node `MODULE_TYPELESS_PACKAGE_JSON` 경고가 출력된다(동작 영향 없음).
