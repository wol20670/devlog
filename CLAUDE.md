@AGENTS.md

# DevLog — 프로젝트 지침

개발 활동 기록 및 주간 회고 웹 서비스. 대학 수업 결과물이자 개인 포트폴리오.
**개인 개발 기록 관리 서비스**이며 SNS 기능(친구·팔로우·피드·채팅)은 만들지 않는다.

## 기술 스택

Next.js 16 (App Router, `src/`) · TypeScript · Tailwind CSS 4 · PostgreSQL(Neon) · Drizzle ORM (`neon-serverless` Pool) · Better Auth (GitHub OAuth) · zod · Vitest · Vercel 배포.
개발 환경: Windows + VS Code + Git Bash, npm.

## 모델 역할 분담 (필수 정책)

| 역할 | 모델 | 담당 |
|---|---|---|
| 메인 에이전트 | Opus 5.5 (`claude-opus-5-5`) | 요구사항 분석, 아키텍처·DB·API 설계, 작업 분배, 코드 리뷰, 보안·성능 검토, 근본 원인 분석, Git/PR/릴리즈, 배포 운영, 문서화 |
| 구현 서브에이전트 | Sonnet 5.5 (`claude-sonnet-5-5`) — `.claude/agents/devlog-implementer.md` | React/Next.js·TypeScript 소스, Drizzle 스키마·데이터 접근, Better Auth·GitHub API 연동, UI, 테스트 코드, 빌드·테스트 실패 수정, 리팩터링 |

- **기능 코드 작성·수정은 반드시 `devlog-implementer`에 위임한다.** 메인 에이전트는 초기 스캐폴딩 명령, 문서, `.claude/` 설정, Git, 배포 운영만 직접 수행한다.
- 기능별 처리 흐름: Opus 요구사항 분석 → 범위·수정 파일·인터페이스·완료 조건 정의 → implementer 호출 → implementer가 구현·테스트 후 변경 파일과 검증 결과 반환 → Opus가 diff 리뷰 및 검증 재실행 → 문제 시 구체적 수정 지시로 재호출 → 통과 시 Opus가 커밋·PR.
- 같은 파일/DB 스키마를 수정하는 작업은 순차 처리. 독립 작업만 병렬.
- 한 번에 전체 구현을 지시하지 않고 기능 단위로 나눈다. 메인 모델을 Sonnet으로 바꾸지 않는다.

## 릴리즈 범위

- **v1.0 — 2026-10-15 릴리즈 완료 (`v1.0.0`, https://devlog-psi-three.vercel.app)**: A 인증 / B 프로젝트 CRUD / C 일별 개발 기록 CRUD / D GitHub 공개 활동 조회 / E 주간 통계·회고 / F 대시보드.
- **v2.0 (기말고사 목표, 구현 중)**: GitHub 저장소 통합(Reader GitHub App) + 글감 + 초안 + Development Galaxy. 설계는 `docs/V2_ARCHITECTURE.md`(rev.4 final, 2026-10-17 승인).
- **v2.1**: 블로그 발행(Publisher GitHub App). 설계 `docs/BLOG_PUBLISHING_DESIGN.md`. 구현은 별도 승인 후.
- **v2.x 백로그**: 태그·검색·시각화·회고 개선 등 기존 v2 항목, AI 기능. **사용자 지시 전에는 구현하지 않는다.**
- **Phase 단위 승인**: 승인된 Phase만 진행한다(승인 기록은 `docs/RELEASE_PLAN.md` "승인 기록"). 다음 Phase는 진행 보고 후 착수한다.
- 상세: `docs/RELEASE_PLAN.md`. 계획일과 실제 완료일을 구분해 기록한다.

### v1.0 완료 조건 (DoD)
실데이터 연동 동작 · 사용자별 접근 검증 · typecheck/lint 통과 · 프로덕션 빌드 · 핵심 CRUD·주간 통계 테스트 · GitHub 인증·활동 조회 확인 · GitHub 업로드 · Vercel 프로덕션 배포 · 배포 URL에서 핵심 흐름 검증 · README/배포 문서.

## 아키텍처·보안 규칙

- DB 접근은 `src/server/*`에만. 함수는 `(db, userId, ...)`를 받고 모든 쿼리를 `userId`로 스코프.
- 서버 액션: `requireUser()` + zod 검증. 개발 기록의 `projectId`는 같은 사용자 소유인지 검증.
- OAuth 토큰: `account.encryptOAuthTokens: true`, 서버에서만 사용(`server-only`). GitHub 요청 `cache: 'no-store'`.
- `getAccessToken`에는 Better Auth 내부 `account.id`, GitHub `/user`.id 비교에는 `account.accountId`.
- GitHub Events API: 공개 이벤트, 최근 30일·최대 300건(per_page 100 × 3페이지). 전체 커밋/기여 통계로 표현하지 않는다.
- DB 라우트는 Node.js 런타임. 타임스탬프 UTC 저장 / KST 표시.
- 스키마 변경은 Drizzle 마이그레이션 파일로. 프로덕션 DB의 파괴적 변경은 사용자 확인 후.
- 비밀값 하드코딩·커밋 금지. `.env.example`에 이름·용도만.

### v2 원칙 (상세: `docs/V2_ARCHITECTURE.md`)

- **GitHub 접근**: 로그인 OAuth App은 그대로. 저장소 접근은 GitHub App(Reader·Publisher 분리). 사용자 접근 검증은 User Access Token, 서버 동기화는 저장소 단위로 축소한 Installation Token(메모리 캐시만). 토큰은 `better-auth/crypto`의 `symmetricEncrypt`(+`SecretConfig`)로 암호화 저장.
- **fail-closed**: 표시·동기화는 `access_state='ok'`이고 `access_verified_at`이 10분 이내인 저장소만(`getVisibleRepoIds`). 확인 불가면 숨긴다. 동기화 시작·글감 연결·원본 상세 조회 때는 항상 재검증(`assertRepoAccess(fresh)`).
- **DB 무결성은 DB에서**: 사용자 간·저장소 간·종류 간 연결은 `user_id`를 포함한 복합 FK와 NOT NULL·NULL-safe CHECK로 강제한다(§4.4). 컬럼 지정 `ON DELETE SET NULL (col)` FK는 수동 SQL 마이그레이션으로만 만들고 `src/db/manual-constraints.ts`에 등록한다(§4.5). `db:generate` 결과에 `mfk_` 제약 DROP이 나오면 반려.
- **동기화**: DB 영속 상태 + lease fencing(`lease_token`·`lease_expires_at > now()`) + 세대(`change_generation`·`pass_generation`·`processed_generation`). 종료 상태는 결과 5종 단일 SQL로만 결정(§3.4). 함수 안에서 rate limit을 기다리지 않는다.
- **webhook**: 앱별 secret으로 서명 검증 → delivery 기록과 상태 변경을 한 트랜잭션에서(외부 API 호출 금지) → 실제 수집은 동기화 엔진이 한다. payload에서 존재가 보장되지 않는 필드를 필수로 가정하지 않는다.
- **외부 텍스트**: 종류별 allowlist로 최소 저장(발췌 500자, 이메일 저장 금지), React 텍스트로만 렌더(`dangerouslySetInnerHTML` 금지). 초안은 근거 없는 사실·수치를 만들지 않는다.

## DB 환경

Neon 브랜치 분리: `main` = Vercel Production 전용, `dev` = 로컬 개발·테스트·Preview. Preview 배포에서는 인증 기능을 검증하지 않는다(OAuth callback 1개 제약).
dev DB에 migrate하기 직전에 `DATABASE_URL` 엔드포인트가 `ep-still-sea`(dev 브랜치)인지 확인하고, 적용 후 `node scripts/check-constraints.mjs`로 catalog를 확인한다. 대상이 불명확하거나 파괴적 문장이 있으면 적용하지 않고 보고한다.

## Git

- 브랜치: `main`(릴리즈) / `release/v2`(v2 통합) / `feature/*` / `fix/*` / `docs/*`. v2 작업은 `release/v2`에서 분기 → 검증 → PR → `release/v2` 병합. `release/v2` → `main` 병합은 사용자 승인 후.
- Conventional Commits. 커밋 날짜·이력 조작 금지.
- `v1.0.0` 태그는 프로덕션에 배포·검증된 커밋에만.

## 명령어

```bash
npm run dev            # 개발 서버
npm run typecheck      # tsc --noEmit
npm run lint
npm run test           # unit + integration
npm run test:unit
npm run test:integration
npm run build
npm run db:generate    # 마이그레이션 생성
npm run db:migrate     # 마이그레이션 적용 (메인 에이전트만)
```

## 문서 (실제 수행 결과 기준으로 갱신)

`README.md`, `CHANGELOG.md`, `docs/RELEASE_PLAN.md`, `docs/PROGRESS.md`, `docs/ARCHITECTURE.md`(v1), `docs/V2_ARCHITECTURE.md`(v2 설계·테스트 기준), `docs/BLOG_PUBLISHING_DESIGN.md`(v2.1), `docs/TEST_REPORT.md`, `docs/DEPLOYMENT.md`.
실제 확인한 결과와 계획·예상·미완료를 구분한다. 기술적 문제·해결·설계 변경 이유를 기록한다.
